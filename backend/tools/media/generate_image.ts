/**
 * 图像生成工具 - 使用第三方模型生成图片
 *
 * 支持调用 Gemini Image 等模型生成图片
 * 支持单张生成和批量生成两种模式
 * 返回图片和文字解释作为工具响应
 */

import type { Tool, ToolResult, MultimodalData, ToolContext } from '../types';
import { getAllWorkspaces } from '../utils';
import { TaskManager, type TaskEvent } from '../taskManager';

import {
    SUPPORTED_ASPECT_RATIOS,
    SUPPORTED_IMAGE_SIZES,
    type AspectRatio,
    type GenerateImageConfig,
    type GeneratedImage,
    type ImageSize,
    type ImageTask,
    type ReferenceImage,
    type TaskResult,
    type ToolParamsConfig
} from './generateImageTypes';

import { executeImageTask } from './generate_image_core';

/** 图像生成任务类型常量 */
const TASK_TYPE_IMAGE_GEN = 'image_generation';

/**
 * 图像生成输出事件类型（保持向后兼容）
 */
export interface ImageGenOutputEvent {
    toolId: string;
    type: 'start' | 'progress' | 'complete' | 'cancelled' | 'error';
    data?: {
        message?: string;
        progress?: number;
        totalTasks?: number;
        completedTasks?: number;
    };
    error?: string;
}

/**
 * 订阅图像生成输出（使用 TaskManager）
 * @param listener 监听器函数
 * @returns 取消订阅函数
 */
export function onImageGenOutput(listener: (event: ImageGenOutputEvent) => void): () => void {
    // 将 TaskEvent 转换为 ImageGenOutputEvent
    return TaskManager.onTaskEventByType(TASK_TYPE_IMAGE_GEN, (taskEvent: TaskEvent) => {
        const imageGenEvent: ImageGenOutputEvent = {
            toolId: taskEvent.taskId,
            type: taskEvent.type as ImageGenOutputEvent['type'],
            data: taskEvent.data as ImageGenOutputEvent['data'],
            error: taskEvent.error
        };
        listener(imageGenEvent);
    });
}

/**
 * 生成唯一工具调用 ID（使用 TaskManager）
 */
export function generateToolId(): string {
    return TaskManager.generateTaskId('tool');
}

/**
 * 取消图像生成任务（使用 TaskManager）
 * @param toolId 工具调用 ID
 * @returns 取消结果
 */
export function cancelImageGeneration(toolId: string): {
    success: boolean;
    error?: string;
} {
    return TaskManager.cancelTask(toolId);
}

/**
 * 获取所有活跃的图像生成任务（使用 TaskManager）
 */
export function getActiveImageTasks(): Array<{
    toolId: string;
    startTime: number;
}> {
    return TaskManager.getTasksByType(TASK_TYPE_IMAGE_GEN).map(task => ({
        toolId: task.id,
        startTime: task.startTime
    }));
}

/**
 * 创建图像生成工具（支持动态配置）
 *
 * @param maxBatchTasks 单次调用允许的最大任务数
 * @param maxImagesPerTask 单个任务的最大图片数
 * @param paramsConfig 参数配置
 */
export function createGenerateImageTool(
    maxBatchTasks: number = 5,
    maxImagesPerTask: number = 1,
    paramsConfig?: ToolParamsConfig
): Tool {
    // 默认配置
    const config: ToolParamsConfig = paramsConfig || {
        provider: 'gemini',
        enableAspectRatio: false,
        enableImageSize: false
    };
    const provider = config.provider || 'gemini';
    const supportsReferenceImages = provider !== 'together';
    const supportsImageParameters = provider !== 'together';
    
    // 获取工作区信息
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;
    
    // 构建参数说明
    const paramNotes: string[] = [];
    if (provider === 'together') {
        paramNotes.push('- **Provider**: Together AI text-to-image only. Do not use reference_images, aspect_ratio, or image_size.');
    }
    
    // 宽高比说明
    if (supportsImageParameters && config.enableAspectRatio) {
        if (config.forcedAspectRatio) {
            paramNotes.push(`- **Aspect Ratio**: User set to ${config.forcedAspectRatio} (cannot be changed)`);
        } else {
            paramNotes.push(`- **Aspect Ratio**: Can use aspect_ratio parameter (optional)`);
        }
    }
    
    // 图片尺寸说明
    if (supportsImageParameters && config.enableImageSize) {
        if (config.forcedImageSize) {
            paramNotes.push(`- **Image Size**: User set to ${config.forcedImageSize} (cannot be changed)`);
        } else {
            paramNotes.push(`- **Image Size**: Can use image_size parameter (optional)`);
        }
    }
    
    const paramSection = paramNotes.length > 0
        ? `\n\n**Parameter Configuration**:\n${paramNotes.join('\n')}`
        : '';

    // 动态生成描述
    let description = `Generate images using AI model. Supports single and batch generation modes.

**Important**: Generated images have solid backgrounds, NOT transparent backgrounds. If you need transparent background images, use the remove_background tool after generation.

**Limits**:
- Maximum ${maxBatchTasks} generation tasks per call
- Maximum ${maxImagesPerTask} images saved per task${paramSection}

**Single Mode**: Use prompt + output_path parameters
**Batch Mode**: Use images array parameter (max ${maxBatchTasks} tasks), generate multiple images with different prompts

**Prompt Format**:
- Natural language: Describe the scene in complete sentences (e.g., "an orange cat sitting on a windowsill, sunlight shining on it")
- Tag-style: Comma-separated keywords (e.g., "orange cat, sitting on windowsill, sunlight, warm lighting, high quality")
- Mixed: Combine both styles

Features:
- Text-to-image: Generate images from prompts
${supportsReferenceImages ? '- Image editing: Modify based on reference images\n- Multi-image composition: Create new scenes using multiple reference images\n' : ''}- Batch generation: Generate multiple different images in one request

Generated images will be saved to the specified path and returned for viewing.`;
    
    // 多工作区说明
    if (isMultiRoot) {
        description += `\n\n**Multi-root Workspace**: Paths must use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }

    // 构建批量任务的属性定义
    const batchItemProperties: Record<string, unknown> = {
        prompt: {
            type: 'string',
            description: 'Image generation prompt. Supports natural language, tags, or mixed.'
        },
        output_path: {
            type: 'string',
            description: 'Output file path (required)'
        }
    };

    if (supportsReferenceImages) {
        batchItemProperties.reference_images = {
            type: 'array',
            description: 'Reference image paths array (optional). Maximum 14 images. MUST be an array even for single image, e.g., ["image.png"]',
            items: { type: 'string' }
        };
    }

    // 仅当启用宽高比且没有强制值时，才包含 aspect_ratio 参数
    if (supportsImageParameters && config.enableAspectRatio && !config.forcedAspectRatio) {
        batchItemProperties.aspect_ratio = {
            type: 'string',
            description: 'Image aspect ratio (optional)',
            enum: [...SUPPORTED_ASPECT_RATIOS]
        };
    }
    
    // 仅当启用图片尺寸且没有强制值时，才包含 image_size 参数
    if (supportsImageParameters && config.enableImageSize && !config.forcedImageSize) {
        batchItemProperties.image_size = {
            type: 'string',
            description: 'Image resolution (optional)',
            enum: [...SUPPORTED_IMAGE_SIZES]
        };
    }

    // 构建单张模式的属性定义
    const singleModeProperties: Record<string, unknown> = {
        prompt: {
            type: 'string',
            description: 'Single mode: Image generation prompt. Supports: 1) Natural language description; 2) Comma-separated tags/keywords; 3) Mixed style.'
        },
        output_path: {
            type: 'string',
            description: isMultiRoot
                ? `Single mode: Output file path (required). Use "workspace_name/path" format.`
                : 'Single mode: Output file path (required). Relative to workspace directory.'
        }
    };

    if (supportsReferenceImages) {
        singleModeProperties.reference_images = {
            type: 'array',
            description: isMultiRoot
                ? `Single mode: Reference image paths array (optional). Maximum 14 images. Use "workspace_name/path" format. MUST be an array even for single image.`
                : 'Single mode: Reference image paths array (optional). Maximum 14 images. MUST be an array even for single image, e.g., ["image.png"]',
            items: {
                type: 'string',
                description: isMultiRoot
                    ? 'Reference image file path, use "workspace_name/path" format'
                    : 'Reference image file path (relative to workspace)'
            }
        };
    }

    // 仅当启用宽高比且没有强制值时，才包含 aspect_ratio 参数
    if (supportsImageParameters && config.enableAspectRatio && !config.forcedAspectRatio) {
        singleModeProperties.aspect_ratio = {
            type: 'string',
            description: 'Single mode: Image aspect ratio (optional). Supported: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9',
            enum: [...SUPPORTED_ASPECT_RATIOS]
        };
    }
    
    // 仅当启用图片尺寸且没有强制值时，才包含 image_size 参数
    if (supportsImageParameters && config.enableImageSize && !config.forcedImageSize) {
        singleModeProperties.image_size = {
            type: 'string',
            description: 'Single mode: Image resolution (optional). 1K=1024px, 2K=2048px, 4K=4096px.',
            enum: [...SUPPORTED_IMAGE_SIZES]
        };
    }

    return {
        declaration: {
            name: 'generate_image',
            description,
            category: 'media',
            parameters: {
                type: 'object',
                properties: {
                    // 批量生成模式参数
                    images: {
                        type: 'array',
                        description: 'Batch mode: Image generation task array. Each task can independently configure prompt, reference images, and output path. MUST be an array even for single task, e.g., [{"prompt": "...", "output_path": "..."}]',
                        items: {
                            type: 'object',
                            properties: batchItemProperties,
                            required: ['prompt', 'output_path']
                        }
                    },
                    // 单张生成模式参数（动态构建）
                    ...singleModeProperties
                }
            }
        },
        handler: async (args, context?: ToolContext): Promise<ToolResult> => {
            // 从 context 获取配置和工具 ID
            const config = (context?.config || {}) as GenerateImageConfig;
            const toolId = context?.toolId || generateToolId();
            
            // 创建本地取消控制器
            const abortController = new AbortController();
            const abortSignal = abortController.signal;
            
            // 如果外部传入了取消信号，将其连接到本地控制器
            if (context?.abortSignal) {
                context.abortSignal.addEventListener('abort', () => {
                    abortController.abort();
                });
            }
            
            // 使用 TaskManager 注册任务
            TaskManager.registerTask(toolId, TASK_TYPE_IMAGE_GEN, abortController, {
                prompt: args.prompt,
                outputPath: args.output_path
            });
            
            // 验证配置
            if (!config.apiKey) {
                TaskManager.unregisterTask(toolId, 'error', { error: 'API Key not configured' });
                return {
                    success: false,
                    error: 'API Key not configured. Please configure generate_image tool in settings (Tools Settings -> Image Generation).'
                };
            }

            // 检查使用哪种模式
            const imagesArray = args.images as ImageTask[] | undefined;
            const singlePrompt = args.prompt as string | undefined;
            const singleOutputPath = args.output_path as string | undefined;

            let tasks: ImageTask[] = [];

            if (imagesArray && Array.isArray(imagesArray) && imagesArray.length > 0) {
                // 批量生成模式
                tasks = imagesArray;
            } else if (singlePrompt && singleOutputPath) {
                // 单张生成模式 - 转换为单任务数组
                tasks = [{
                    prompt: singlePrompt,
                    reference_images: args.reference_images as string[] | undefined,
                    aspect_ratio: args.aspect_ratio as AspectRatio | undefined,
                    image_size: args.image_size as ImageSize | undefined,
                    output_path: singleOutputPath
                }];
            } else {
                return {
                    success: false,
                    error: 'Please use one of the following:\n1. Single mode: Provide prompt and output_path\n2. Batch mode: Provide images array'
                };
            }

            // 获取配置限制
            const configMaxBatchTasks = config.maxBatchTasks || 5;
            const configMaxImagesPerTask = config.maxImagesPerTask || 1;

            // 验证任务数量
            if (tasks.length === 0) {
                TaskManager.unregisterTask(toolId, 'error', { error: 'No valid generation tasks' });
                return { success: false, error: 'No valid generation tasks' };
            }

            if (tasks.length > configMaxBatchTasks) {
                TaskManager.unregisterTask(toolId, 'error', { error: `Maximum ${configMaxBatchTasks} generation tasks per call` });
                return { success: false, error: `Maximum ${configMaxBatchTasks} generation tasks per call (current: ${tasks.length})` };
            }

            try {
                // 并发执行所有任务（传递取消信号）
                const results = await Promise.all(
                    tasks.map((task, index) => executeImageTask(task, index, config, configMaxImagesPerTask, abortSignal))
                );

                // 统计结果
                const successResults = results.filter(r => r.success);
                const failedResults = results.filter(r => !r.success);
                const cancelledResults = results.filter(r => r.cancelled);
                
                // 任务完成，使用 TaskManager 注销
                TaskManager.unregisterTask(toolId, 'completed', {
                    totalTasks: tasks.length,
                    completedTasks: successResults.length
                });
                
                // 如果所有任务都被取消，返回用户中断信息
                if (cancelledResults.length === results.length) {
                    return {
                        success: false,
                        error: 'User cancelled the image generation request. Please wait for user\'s next instruction.',
                        cancelled: true
                    };
                }

            // 收集所有多模态数据
            const allMultimodal: MultimodalData[] = [];
            const allPaths: string[] = [];
            const allDimensions: Array<{ width: number; height: number; aspectRatio: string }> = [];
            let totalCount = 0;
            const descriptions: string[] = [];

            for (const result of successResults) {
                if (result.multimodal) {
                    allMultimodal.push(...result.multimodal);
                }
                if (result.paths) {
                    allPaths.push(...result.paths);
                }
                if (result.count) {
                    totalCount += result.count;
                }
                if (result.dimensions) {
                    allDimensions.push(...result.dimensions);
                }
                if (result.description) {
                    descriptions.push(result.description);
                }
            }

            // 生成报告
            const isBatch = tasks.length > 1;
            let message: string;

            if (failedResults.length === 0) {
                // 全部成功
                if (isBatch) {
                    message = `✅ Batch generation completed: ${successResults.length}/${tasks.length} tasks succeeded, ${totalCount} images generated\n\nSaved to:\n${allPaths.map(p => `• ${p}`).join('\n')}`;
                } else {
                    // 单张模式显示尺寸
                    const dimInfo = allDimensions.length > 0
                        ? `\n\nDimensions: ${allDimensions.map(d => `${d.width}×${d.height} (${d.aspectRatio})`).join(', ')}`
                        : '';
                    message = `✅ Successfully generated ${totalCount} images${dimInfo}\n\nSaved to: ${allPaths.join(', ')}`;
                }
            } else if (successResults.length === 0) {
                // 全部失败
                const errors = failedResults.map(r => r.error).join('\n');
                return {
                    success: false,
                    error: isBatch
                        ? `Batch generation failed: All ${tasks.length} tasks failed\n\n${errors}`
                        : failedResults[0].error || 'Generation failed'
                };
            } else {
                // 部分成功
                const errors = failedResults.map(r => r.error).join('\n');
                message = `⚠️ Batch generation partially completed: ${successResults.length}/${tasks.length} succeeded, ${failedResults.length}/${tasks.length} failed\n\n`;
                message += `Saved to:\n${allPaths.map(p => `• ${p}`).join('\n')}\n\n`;
                message += `Failure reasons:\n${errors}`;
            }

            // 如果有部分任务被取消
            const hasCancelled = cancelledResults.length > 0;
            const cancelledNote = hasCancelled
                ? `\n\n⚠️ Note: ${cancelledResults.length} tasks were cancelled by user`
                : '';

                // 根据配置决定是否返回多模态数据给 AI（默认关闭以节省 token）
                const shouldReturnImageToAI = config.returnImageToAI === true;
                
                return {
                    success: true,
                    data: {
                        message: message + cancelledNote,
                        toolId,
                        totalTasks: tasks.length,
                        successCount: successResults.length,
                        failedCount: failedResults.length,
                        cancelledCount: cancelledResults.length,
                        totalImages: totalCount,
                        paths: allPaths,
                        dimensions: allDimensions.length > 0 ? allDimensions : undefined,
                        model: config.model || 'gemini-2.5-flash-preview-05-20',
                        details: descriptions
                    },
                    multimodal: shouldReturnImageToAI && allMultimodal.length > 0 ? allMultimodal : undefined,
                    cancelled: hasCancelled
                };
            } catch (error) {
                // 检查是否是取消导致的错误
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorName = error instanceof Error ? error.name : '';
                
                const isCancelled = abortSignal.aborted ||
                    errorName === 'AbortError' ||
                    errorMessage.includes('aborted') ||
                    errorMessage.includes('cancelled') ||
                    errorMessage.includes('canceled');
                
                // 使用 TaskManager 注销任务
                TaskManager.unregisterTask(
                    toolId,
                    isCancelled ? 'cancelled' : 'error',
                    isCancelled ? undefined : { error: errorMessage }
                );
                
                if (isCancelled) {
                    return {
                        success: false,
                        error: 'User cancelled the image generation request. Please wait for user\'s next instruction.',
                        cancelled: true
                    };
                }
                
                throw error;
            }
        }
    };
}

/**
 * 注册图像生成工具（默认配置）
 */
export function registerGenerateImage(): Tool {
    return createGenerateImageTool();
}
