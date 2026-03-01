/**
 * 抠图工具 - 移除图片背景
 *
 * 工作流程：
 * 1. 读取原图
 * 2. 调用 Gemini Image API 生成遮罩图（黑色=主体，白色=背景）
 * 3. 缩放遮罩图对齐原图尺寸
 * 4. 应用遮罩：保留黑色区域，白色区域设为透明
 * 5. 保存为透明 PNG
 *
 * 支持单张和批量两种模式
 */

import type { Tool, ToolResult, MultimodalData, ToolContext } from '../types';
import { getAllWorkspaces } from '../utils';
import { TaskManager, type TaskEvent } from '../taskManager';
import type { RemoveBackgroundConfig, RemoveTask } from './remove_background_core';
import { executeRemoveTask } from './remove_background_core';

/** 抠图任务类型常量 */
const TASK_TYPE_REMOVE_BG = 'remove_background';

/**
 * 抠图输出事件类型
 */
export interface RemoveBgOutputEvent {
    toolId: string;
    type: 'start' | 'progress' | 'complete' | 'cancelled' | 'error';
    data?: {
        message?: string;
        step?: 'reading' | 'generating_mask' | 'processing' | 'saving';
        currentTask?: number;
        totalTasks?: number;
    };
    error?: string;
}

/**
 * 订阅抠图输出
 */
export function onRemoveBgOutput(listener: (event: RemoveBgOutputEvent) => void): () => void {
    return TaskManager.onTaskEventByType(TASK_TYPE_REMOVE_BG, (taskEvent: TaskEvent) => {
        const event: RemoveBgOutputEvent = {
            toolId: taskEvent.taskId,
            type: taskEvent.type as RemoveBgOutputEvent['type'],
            data: taskEvent.data as RemoveBgOutputEvent['data'],
            error: taskEvent.error
        };
        listener(event);
    });
}

/**
 * 取消抠图任务
 */
export function cancelRemoveBackground(toolId: string): { success: boolean; error?: string } {
    return TaskManager.cancelTask(toolId);
}

/**
 * 创建抠图工具（支持动态配置）
 *
 * @param maxBatchTasks 单次调用允许的最大任务数
 */
export function createRemoveBackgroundTool(maxBatchTasks: number = 5): Tool {
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;

    let description = `Remove background from images, generating transparent PNG. Supports single and batch modes.

**Limits**:
- Maximum ${maxBatchTasks} background removal tasks per call

**Single Mode**: Use image_path + output_path parameters
**Batch Mode**: Use images array parameter (max ${maxBatchTasks} tasks)

**How it works**:
1. Uses AI to generate a mask (subject=black, background=white)
2. Sets background to transparent based on the mask
3. Saves as transparent PNG

**Use cases**:
- Product image background removal
- Portrait cutout
- Object extraction
- Creative composite material preparation`;

    if (isMultiRoot) {
        description += `\n\n**Multi-root Workspace**: Use "workspace_name/path" format for paths. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }

    return {
        declaration: {
            name: 'remove_background',
            description,
            category: 'media',
            dependencies: ['sharp'],  // 声明依赖 sharp
            parameters: {
                type: 'object',
                properties: {
                    // 批量模式参数
                    images: {
                        type: 'array',
                        description: 'Batch mode: Background removal task array. Each task can independently configure input, output, and subject description. MUST be an array even for single task.',
                        items: {
                            type: 'object',
                            properties: {
                                image_path: {
                                    type: 'string',
                                    description: 'Source image path (required)'
                                },
                                output_path: {
                                    type: 'string',
                                    description: 'Output file path (required). Recommend using .png extension.'
                                },
                                subject_description: {
                                    type: 'string',
                                    description: 'Subject description (optional). Helps AI identify the subject to keep more accurately.'
                                },
                                mask_path: {
                                    type: 'string',
                                    description: 'Mask image save path (optional). If provided, also saves the mask image.'
                                }
                            },
                            required: ['image_path', 'output_path']
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
                            ? 'Single mode: Output file path (required). Recommend using .png extension. Use "workspace_name/path" format.'
                            : 'Single mode: Output file path (required). Recommend using .png extension.'
                    },
                    subject_description: {
                        type: 'string',
                        description: 'Single mode: Subject description (optional). Helps AI identify the subject to keep more accurately. E.g., "person", "product", "cat".'
                    },
                    mask_path: {
                        type: 'string',
                        description: isMultiRoot
                            ? 'Single mode: Mask image save path (optional). If provided, also saves the mask image. Use "workspace_name/path" format.'
                            : 'Single mode: Mask image save path (optional). If provided, also saves the mask image.'
                    }
                }
            }
        },
        handler: async (args, context?: ToolContext): Promise<ToolResult> => {
            const config = (context?.config || {}) as RemoveBackgroundConfig;
            const toolId = context?.toolId || TaskManager.generateTaskId('rmbg');

            const abortController = new AbortController();
            const abortSignal = abortController.signal;

            if (context?.abortSignal) {
                context.abortSignal.addEventListener('abort', () => {
                    abortController.abort();
                });
            }

            // 验证配置
            if (!config.apiKey) {
                return {
                    success: false,
                    error: 'API Key not configured. Please configure image generation tool in settings (Tools Settings -> Image Generation).'
                };
            }

            // 检查使用哪种模式
            const imagesArray = args.images as RemoveTask[] | undefined;
            const singleImagePath = args.image_path as string | undefined;
            const singleOutputPath = args.output_path as string | undefined;

            let tasks: RemoveTask[] = [];

            if (imagesArray && Array.isArray(imagesArray) && imagesArray.length > 0) {
                // 批量模式
                tasks = imagesArray;
            } else if (singleImagePath && singleOutputPath) {
                // 单张模式 - 转换为单任务数组
                tasks = [{
                    image_path: singleImagePath,
                    output_path: singleOutputPath,
                    subject_description: args.subject_description as string | undefined,
                    mask_path: args.mask_path as string | undefined
                }];
            } else {
                return {
                    success: false,
                    error: 'Please use one of the following:\n1. Single mode: Provide image_path and output_path\n2. Batch mode: Provide images array'
                };
            }

            // 获取配置限制
            const configMaxBatchTasks = config.maxBatchTasks || maxBatchTasks;

            // 验证任务数量
            if (tasks.length === 0) {
                return { success: false, error: 'No valid background removal tasks' };
            }

            if (tasks.length > configMaxBatchTasks) {
                return { success: false, error: `Maximum ${configMaxBatchTasks} background removal tasks per call (current: ${tasks.length})` };
            }

            // 注册任务
            TaskManager.registerTask(toolId, TASK_TYPE_REMOVE_BG, abortController, {
                totalTasks: tasks.length
            });

            try {
                // 并发执行所有任务
                const results = await Promise.all(
                    tasks.map((task, index) => executeRemoveTask(task, index, config, abortSignal))
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
                        error: 'User cancelled the background removal request. Please wait for user\'s next instruction.',
                        cancelled: true
                    };
                }

                // 收集所有多模态数据
                const allMultimodal: MultimodalData[] = [];
                const allPaths: string[] = [];
                const maskPaths: string[] = [];
                const warnings: string[] = [];

                for (const result of successResults) {
                    if (result.multimodal) {
                        allMultimodal.push(...result.multimodal);
                    }
                    if (result.outputPath) {
                        allPaths.push(result.outputPath);
                    }
                    if (result.maskPath) {
                        maskPaths.push(result.maskPath);
                    }
                    if (result.error) {
                        warnings.push(result.error);
                    }
                }

                // 生成报告
                const isBatch = tasks.length > 1;
                let message: string;

                if (failedResults.length === 0 && cancelledResults.length === 0) {
                    // 全部成功
                        if (isBatch) {
                            message = `✅ Batch background removal completed: ${successResults.length}/${tasks.length} tasks succeeded\n\nSaved to:\n${allPaths.map(p => `• ${p}`).join('\n')}`;
                        } else {
                            const r = successResults[0];
                            const dimInfo = r.dimensions
                                ? `\n\nDimensions: ${r.dimensions.width}×${r.dimensions.height} (${r.dimensions.aspectRatio})`
                                : '';
                            message = `✅ Background removal completed!${dimInfo}\n\nOutput: ${allPaths[0]}`;
                        }
                    
                    if (maskPaths.length > 0) {
                        message += `\n\nMask paths:\n${maskPaths.map(p => `• ${p}`).join('\n')}`;
                    }
                } else if (successResults.length === 0) {
                    // 全部失败
                    const errors = failedResults.map(r => r.error).join('\n');
                    return {
                        success: false,
                        error: isBatch
                            ? `Batch background removal failed: All ${tasks.length} tasks failed\n\n${errors}`
                            : failedResults[0]?.error || 'Background removal failed'
                    };
                } else {
                    // 部分成功
                    const errors = failedResults.map(r => r.error).join('\n');
                    message = `⚠️ Batch background removal partially completed: ${successResults.length}/${tasks.length} succeeded, ${failedResults.length} failed\n\n`;
                    message += `Saved to:\n${allPaths.map(p => `• ${p}`).join('\n')}\n\n`;
                    if (failedResults.length > 0) {
                        message += `Failure reasons:\n${errors}`;
                    }
                }

                // 添加警告信息
                if (warnings.length > 0) {
                    message += `\n\n⚠️ Warnings:\n${warnings.join('\n')}`;
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
                        paths: allPaths,
                        maskPaths
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
                        error: 'User cancelled the background removal operation.',
                        cancelled: true
                    };
                }

                return {
                    success: false,
                    error: `Background removal failed: ${errorMessage}`
                };
            }
        }
    };
}

/**
 * 注册抠图工具（默认配置）
 */
export function registerRemoveBackground(): Tool {
    return createRemoveBackgroundTool();
}
