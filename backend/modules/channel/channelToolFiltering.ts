import type { ToolRegistry } from '../../tools/ToolRegistry';
import type { SettingsManager } from '../settings/SettingsManager';
import type { ToolDeclaration } from '../../tools/types';

import { createReadFileTool } from '../../tools/file/read_file';
import {
    createCropImageTool,
    createGenerateImageTool,
    createRemoveBackgroundTool,
    createResizeImageTool,
    createRotateImageTool
} from '../../tools/media';

type ChannelType = 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom';
type ToolMode = 'function_call' | 'xml' | 'json';

function cleanJsonSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }

    const cleaned: any = {};

    for (const key of Object.keys(schema)) {
        if (key === '$schema' || key === 'additionalProperties') {
            continue;
        }

        const value = schema[key];

        if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
                cleaned[key] = value.map(item => cleanJsonSchema(item));
            } else {
                cleaned[key] = cleanJsonSchema(value);
            }
        } else {
            cleaned[key] = value;
        }
    }

    return cleaned;
}

export function getFilteredTools(
    toolRegistry: ToolRegistry | undefined,
    settingsManager: SettingsManager | undefined,
    multimodalEnabled?: boolean,
    channelType?: ChannelType,
    toolMode?: ToolMode,
    toolAllowList?: string[]
): ToolDeclaration[] | undefined {
    const allowSet = Array.isArray(toolAllowList) && toolAllowList.length > 0
        ? new Set(toolAllowList.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()))
        : null;

    const tools: ToolDeclaration[] = [];

    if (toolRegistry) {
        const builtinTools = settingsManager
            ? toolRegistry.getDeclarationsBy((toolName) => settingsManager.isToolEnabled(toolName))
            : toolRegistry.getAllDeclarations();

        if (builtinTools) {
            for (const tool of builtinTools) {
                if (allowSet && !allowSet.has(tool.name)) {
                    continue;
                }

                let declaration: any = { ...tool };

                if (tool.name === 'read_file') {
                    const dynamicTool = createReadFileTool(multimodalEnabled, channelType, toolMode);
                    declaration = { ...declaration, description: dynamicTool.declaration.description };
                }

                if (tool.name === 'generate_image') {
                    const shouldExclude = !multimodalEnabled ||
                        (channelType === 'openai' && toolMode === 'function_call');
                    if (shouldExclude) {
                        continue;
                    }

                    const imageConfig = settingsManager?.getGenerateImageConfig();
                    const maxBatchTasks = imageConfig?.maxBatchTasks || 5;
                    const maxImagesPerTask = imageConfig?.maxImagesPerTask || 1;

                    const paramsConfig = {
                        provider: imageConfig?.provider,
                        enableAspectRatio: imageConfig?.enableAspectRatio ?? false,
                        forcedAspectRatio: imageConfig?.defaultAspectRatio || undefined,
                        enableImageSize: imageConfig?.enableImageSize ?? false,
                        forcedImageSize: imageConfig?.defaultImageSize || undefined
                    };

                    const dynamicTool = createGenerateImageTool(maxBatchTasks, maxImagesPerTask, paramsConfig);
                    declaration = {
                        ...declaration,
                        description: dynamicTool.declaration.description,
                        parameters: dynamicTool.declaration.parameters
                    };
                }

                if (tool.name === 'remove_background') {
                    const shouldExclude = !multimodalEnabled ||
                        (channelType === 'openai' && toolMode === 'function_call');
                    if (shouldExclude) {
                        continue;
                    }

                    const imageConfig = settingsManager?.getGenerateImageConfig();
                    const maxBatchTasks = imageConfig?.maxBatchTasks || 5;
                    const dynamicTool = createRemoveBackgroundTool(maxBatchTasks);
                    declaration = { ...declaration, description: dynamicTool.declaration.description };
                }

                if (tool.name === 'crop_image') {
                    const shouldExclude = !multimodalEnabled ||
                        (channelType === 'openai' && toolMode === 'function_call');
                    if (shouldExclude) {
                        continue;
                    }

                    const imageConfig = settingsManager?.getGenerateImageConfig();
                    const maxBatchTasks = imageConfig?.maxBatchTasks || 10;
                    const dynamicTool = createCropImageTool(maxBatchTasks);
                    declaration = { ...declaration, description: dynamicTool.declaration.description };
                }

                if (tool.name === 'resize_image') {
                    const shouldExclude = !multimodalEnabled ||
                        (channelType === 'openai' && toolMode === 'function_call');
                    if (shouldExclude) {
                        continue;
                    }

                    const imageConfig = settingsManager?.getGenerateImageConfig();
                    const maxBatchTasks = imageConfig?.maxBatchTasks || 10;
                    const dynamicTool = createResizeImageTool(maxBatchTasks);
                    declaration = { ...declaration, description: dynamicTool.declaration.description };
                }

                if (tool.name === 'rotate_image') {
                    const shouldExclude = !multimodalEnabled ||
                        (channelType === 'openai' && toolMode === 'function_call');
                    if (shouldExclude) {
                        continue;
                    }

                    const imageConfig = settingsManager?.getGenerateImageConfig();
                    const maxBatchTasks = imageConfig?.maxBatchTasks || 10;
                    const dynamicTool = createRotateImageTool(maxBatchTasks);
                    declaration = { ...declaration, description: dynamicTool.declaration.description };
                }

                tools.push({
                    ...declaration,
                    parameters: cleanJsonSchema(declaration.parameters)
                } as ToolDeclaration);
            }
        }
    }

    return tools.length > 0 ? tools : undefined;
}
