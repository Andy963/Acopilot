/**
 * 缩放图片工具
 *
 * 将图片缩放到指定的目标尺寸：
 * - 支持指定目标宽度和高度
 * - 自动拉伸填充（不保持宽高比）
 * - 使用 sharp 进行缩放
 * - 返回缩放后的图片
 *
 * 支持单张和批量两种模式
 */

import type { Tool, ToolResult, MultimodalData, ToolContext } from '../types';
import { getAllWorkspaces } from '../utils';
import { TaskManager, type TaskEvent } from '../taskManager';
import type { ResizeTask } from './resize_image_core';
import { executeResizeTask } from './resize_image_core';

/** 缩放任务类型常量 */
const TASK_TYPE_RESIZE = 'resize_image';

/**
 * 缩放图片工具配置（从 context.config 获取）
 */
interface ResizeImageConfig {
    /** 是否将图片返回给 AI */
    returnImageToAI?: boolean;
}

/**
 * 缩放输出事件类型
 */
export interface ResizeImageOutputEvent {
    toolId: string;
    type: 'start' | 'progress' | 'complete' | 'cancelled' | 'error';
    data?: {
        message?: string;
        currentTask?: number;
        totalTasks?: number;
    };
    error?: string;
}

/**
 * 订阅缩放输出
 */
export function onResizeImageOutput(listener: (event: ResizeImageOutputEvent) => void): () => void {
    return TaskManager.onTaskEventByType(TASK_TYPE_RESIZE, (taskEvent: TaskEvent) => {
        const event: ResizeImageOutputEvent = {
            toolId: taskEvent.taskId,
            type: taskEvent.type as ResizeImageOutputEvent['type'],
            data: taskEvent.data as ResizeImageOutputEvent['data'],
            error: taskEvent.error
        };
        listener(event);
    });
}

/**
 * 取消缩放任务
 */
export function cancelResizeImage(toolId: string): { success: boolean; error?: string } {
    return TaskManager.cancelTask(toolId);
}

/**
 * 创建缩放图片工具
 *
 * @param maxBatchTasks 单次调用允许的最大任务数
 */
export function createResizeImageTool(maxBatchTasks: number = 10): Tool {
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;

    let description = `Resize image tool. Resizes images to specified target dimensions.

**Features**:
- Resize image to specified width and height
- Uses stretch fill mode (does not preserve aspect ratio)
- Suitable for scenarios requiring exact dimensions

**Parameters**:
- width: Target width (pixels, required)
- height: Target height (pixels, required)
- image_path: Source image path (required)
- output_path: Output file path (required)

**Examples**:
- Resize to 800x600: width=800, height=600
- Resize to square 512x512: width=512, height=512
- Resize to 1920x1080: width=1920, height=1080

**Supported Formats**: PNG, JPEG, WebP (auto-selected based on output path extension)

**Limits**:
- Maximum ${maxBatchTasks} resize tasks per call
- Target dimensions cannot exceed 16384x16384`;

    if (isMultiRoot) {
        description += `\n\n**Multi-root Workspace**: Use "workspace_name/path" format for paths. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }

    return {
        declaration: {
            name: 'resize_image',
            description,
            category: 'media',
            dependencies: ['sharp'],  // 声明依赖 sharp
            parameters: {
                type: 'object',
                properties: {
                    // 批量模式参数
                    images: {
                        type: 'array',
                        description: 'Batch mode: Resize task array. Each task can independently configure input, output, and target dimensions. MUST be an array even for single task.',
                        items: {
                            type: 'object',
                            properties: {
                                image_path: {
                                    type: 'string',
                                    description: 'Source image path (required)'
                                },
                                output_path: {
                                    type: 'string',
                                    description: 'Output file path (required)'
                                },
                                width: {
                                    type: 'integer',
                                    description: 'Target width (pixels, required)'
                                },
                                height: {
                                    type: 'integer',
                                    description: 'Target height (pixels, required)'
                                }
                            },
                            required: ['image_path', 'output_path', 'width', 'height']
                        }
                    },
                    // 单张模式参数（向后兼容）
                    image_path: {
                        type: 'string',
                        description: isMultiRoot
                            ? 'Single mode: Source image path (required). Use "workspace_name/path" format.'
                            : 'Single mode: Source image path (required). Relative to workspace.'
                    },
                    output_path: {
                        type: 'string',
                        description: isMultiRoot
                            ? 'Single mode: Output file path (required). Use "workspace_name/path" format.'
                            : 'Single mode: Output file path (required).'
                    },
                    width: {
                        type: 'integer',
                        description: 'Single mode: Target width (pixels, required)'
                    },
                    height: {
                        type: 'integer',
                        description: 'Single mode: Target height (pixels, required)'
                    }
                }
            }
        },
        handler: async (args, context?: ToolContext): Promise<ToolResult> => {
            const toolId = context?.toolId || TaskManager.generateTaskId('resize');
            const config = (context?.config || {}) as ResizeImageConfig;

            const abortController = new AbortController();
            const abortSignal = abortController.signal;

            if (context?.abortSignal) {
                context.abortSignal.addEventListener('abort', () => {
                    abortController.abort();
                });
            }

            // 检查使用哪种模式
            const imagesArray = args.images as ResizeTask[] | undefined;
            const singleImagePath = args.image_path as string | undefined;
            const singleOutputPath = args.output_path as string | undefined;
            const singleWidth = args.width as number | undefined;
            const singleHeight = args.height as number | undefined;

            let tasks: ResizeTask[] = [];

            if (imagesArray && Array.isArray(imagesArray) && imagesArray.length > 0) {
                // 批量模式
                tasks = imagesArray;
            } else if (singleImagePath && singleOutputPath && 
                       singleWidth !== undefined && singleHeight !== undefined) {
                // 单张模式 - 转换为单任务数组
                tasks = [{
                    image_path: singleImagePath,
                    output_path: singleOutputPath,
                    width: singleWidth,
                    height: singleHeight
                }];
            } else {
                return {
                    success: false,
                    error: 'Please use one of the following:\n1. Single mode: Provide image_path, output_path, width, height\n2. Batch mode: Provide images array'
                };
            }

            // 验证任务数量
            if (tasks.length === 0) {
                return { success: false, error: 'No valid resize tasks' };
            }

            if (tasks.length > maxBatchTasks) {
                return { success: false, error: `Maximum ${maxBatchTasks} resize tasks per call (current: ${tasks.length})` };
            }

            // 注册任务
            TaskManager.registerTask(toolId, TASK_TYPE_RESIZE, abortController, {
                totalTasks: tasks.length
            });

            try {
                // 并发执行所有任务
                const results = await Promise.all(
                    tasks.map((task, index) => executeResizeTask(task, index, abortSignal))
                );

                // 统计结果
                const successResults = results.filter(r => r.success);
                const failedResults = results.filter(r => !r.success && !r.cancelled);
                const cancelledResults = results.filter(r => r.cancelled);

                // 任务完成
                TaskManager.unregisterTask(toolId, 'completed', {
                    totalTasks: tasks.length,
                    successCount: successResults.length
                });

                // 如果所有任务都被取消
                if (cancelledResults.length === results.length) {
                    return {
                        success: false,
                        error: 'User cancelled the resize request. Please wait for user\'s next instruction.',
                        cancelled: true
                    };
                }

                // 收集所有多模态数据
                const allMultimodal: MultimodalData[] = [];
                const allPaths: string[] = [];

                for (const result of successResults) {
                    if (result.multimodal) {
                        allMultimodal.push(...result.multimodal);
                    }
                    if (result.outputPath) {
                        allPaths.push(result.outputPath);
                    }
                }

                // 生成报告
                const isBatch = tasks.length > 1;
                let message: string;

                if (failedResults.length === 0 && cancelledResults.length === 0) {
                    // 全部成功
                    if (isBatch) {
                        message = `✅ Batch resize completed: ${successResults.length}/${tasks.length} tasks succeeded\n\nSaved to:\n${allPaths.map(p => `• ${p}`).join('\n')}`;
                    } else {
                        const r = successResults[0];
                        message = `✅ Resize completed!\n\nOriginal: ${r.originalDimensions?.width}×${r.originalDimensions?.height} (${r.originalDimensions?.aspectRatio})\nResized: ${r.resizedDimensions?.width}×${r.resizedDimensions?.height} (${r.resizedDimensions?.aspectRatio})\n\nOutput: ${allPaths[0]}`;
                    }
                } else if (successResults.length === 0) {
                    // 全部失败
                    const errors = failedResults.map(r => r.error).join('\n');
                    return {
                        success: false,
                        error: isBatch
                            ? `Batch resize failed: All ${tasks.length} tasks failed\n\n${errors}`
                            : failedResults[0]?.error || 'Resize failed'
                    };
                } else {
                    // 部分成功
                    const errors = failedResults.map(r => r.error).join('\n');
                    message = `⚠️ Batch resize partially completed: ${successResults.length}/${tasks.length} succeeded, ${failedResults.length} failed\n\n`;
                    message += `Saved to:\n${allPaths.map(p => `• ${p}`).join('\n')}\n\n`;
                    if (failedResults.length > 0) {
                        message += `Failure reasons:\n${errors}`;
                    }
                }

                // 如果有部分任务被取消
                if (cancelledResults.length > 0) {
                    message += `\n\n⚠️ Note: ${cancelledResults.length} tasks were cancelled by user`;
                }

                // 根据配置决定是否返回多模态数据给 AI（默认关闭以节省 token）
                const shouldReturnImageToAI = config.returnImageToAI === true;
                
                return {
                    success: true,
                    data: {
                        message,
                        toolId,
                        totalTasks: tasks.length,
                        successCount: successResults.length,
                        failedCount: failedResults.length,
                        cancelledCount: cancelledResults.length,
                        paths: allPaths
                    },
                    multimodal: shouldReturnImageToAI && allMultimodal.length > 0 ? allMultimodal : undefined,
                    cancelled: cancelledResults.length > 0
                };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isCancelled = abortSignal.aborted ||
                    errorMessage.includes('aborted') ||
                    errorMessage.includes('cancelled');

                TaskManager.unregisterTask(
                    toolId,
                    isCancelled ? 'cancelled' : 'error',
                    isCancelled ? undefined : { error: errorMessage }
                );

                if (isCancelled) {
                    return {
                        success: false,
                        error: 'User cancelled the resize operation.',
                        cancelled: true
                    };
                }

                return {
                    success: false,
                    error: `Resize failed: ${errorMessage}`
                };
            }
        }
    };
}

/**
 * 注册缩放图片工具（默认配置）
 */
export function registerResizeImage(): Tool {
    return createResizeImageTool();
}
