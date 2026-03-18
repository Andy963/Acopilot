/**
 * 读取文件工具
 *
 * 支持读取单个或多个文件
 * 支持多工作区（Multi-root Workspaces）
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { Tool, ToolResult, MultimodalData, MultimodalCapability } from '../types';
import { t } from '../../i18n';
import type { ImageDimensions } from '../imageDimensions';
import { parseImageDimensions } from './parseImageDimensions';
import { runWithConcurrency } from '../../modules/checkpoint/concurrency';
import {
    resolveUri,
    resolveUriWithInfo,
    getAllWorkspaces,
    isMultimodalSupported,
    getMultimodalMimeType,
    isBinaryFile,
    formatFileSize,
    canReadFile,
    getReadFileError,
    isMultimodalSupportedWithConfig,
    canReadFileWithCapability,
    getReadFileErrorWithCapability,
    isImageFile,
    isPdfFile
} from '../utils';

/**
 * 行范围选项
 */
interface LineRange {
    startLine?: number;  // 1-based, 包含，不指定则从第 1 行开始
    endLine?: number;    // 1-based, 包含，不指定则读取到文件末尾
}

/**
 * 文件读取请求（支持单独的行范围）
 */
interface FileReadRequest {
    path: string;
    startLine?: number;
    endLine?: number;
}

/**
 * 单个文件读取结果
 */
interface ReadResult {
    path: string;
    workspace?: string;
    success: boolean;
    type?: 'text' | 'multimodal' | 'binary';
    content?: string;
    lineCount?: number;      // 返回的行数（如果指定了范围）或总行数
    totalLines?: number;     // 文件总行数（仅在指定范围时返回）
    startLine?: number;      // 实际读取的起始行（仅在指定范围时返回）
    endLine?: number;        // 实际读取的结束行（仅在指定范围时返回）
    mimeType?: string;
    size?: number;
    dimensions?: ImageDimensions;  // 图片尺寸信息
    error?: string;
}


/**
 * 读取单个文件
 *
 * @param filePath 文件路径
 * @param capability 多模态能力
 * @param isMultiRoot 是否是多工作区模式
 * @param lineRange 行范围（可选）
 */
async function readSingleFile(
    filePath: string,
    capability: MultimodalCapability,
    isMultiRoot: boolean,
    lineRange?: LineRange
): Promise<{
    result: ReadResult;
    multimodal?: MultimodalData[];
}> {
    const { uri, workspace, error } = resolveUriWithInfo(filePath);
    if (!uri) {
        return {
            result: {
                path: filePath,
                success: false,
                error: error || 'No workspace folder open'
            }
        };
    }

    // 检查是否允许读取此文件
    if (!canReadFileWithCapability(filePath, capability)) {
        const readError = getReadFileErrorWithCapability(filePath, true, capability);
        return {
            result: {
                path: filePath,
                workspace: isMultiRoot ? workspace?.name : undefined,
                success: false,
                error: readError || t('tools.file.readFile.cannotReadFile')
            }
        };
    }

    try {
        const content = await vscode.workspace.fs.readFile(uri);
        const fileName = path.basename(filePath);
        
        // 检查是否支持多模态返回
        let shouldReturnMultimodal = false;
        if (isImageFile(filePath) && capability.supportsImages) {
            shouldReturnMultimodal = true;
        } else if (isPdfFile(filePath) && capability.supportsDocuments) {
            shouldReturnMultimodal = true;
        }
        
        if (shouldReturnMultimodal) {
            const mimeType = getMultimodalMimeType(filePath);
            if (mimeType) {
                const base64Data = Buffer.from(content).toString('base64');
                
                // 解析图片尺寸（仅对图片文件）
                let dimensions: ImageDimensions | undefined;
                if (isImageFile(filePath)) {
                    dimensions = parseImageDimensions(content, mimeType);
                }
                
                return {
                    result: {
                        path: filePath,
                        workspace: isMultiRoot ? workspace?.name : undefined,
                        success: true,
                        type: 'multimodal',
                        mimeType,
                        size: content.byteLength,
                        dimensions
                    },
                    multimodal: [{
                        mimeType,
                        data: base64Data,
                        name: fileName
                    }]
                };
            }
        }
        
        // 检查是否是其他二进制文件（不支持多模态返回）
        if (isBinaryFile(filePath)) {
            return {
                result: {
                    path: filePath,
                    workspace: isMultiRoot ? workspace?.name : undefined,
                    success: true,
                    type: 'binary',
                    size: content.byteLength
                }
            };
        }
        
        // 文本文件：返回带行号的内容
        const text = new TextDecoder().decode(content);
        const allLines = text.split('\n');
        const totalLines = allLines.length;
        
        // 处理行范围
        let selectedLines: string[];
        let actualStartLine: number | undefined;
        let actualEndLine: number | undefined;
        
        if (lineRange) {
            // 确定起始行：默认从第 1 行开始
            let startLine = lineRange.startLine ?? 1;
            if (startLine < 1) startLine = 1;
            if (startLine > totalLines) {
                return {
                    result: {
                        path: filePath,
                        workspace: isMultiRoot ? workspace?.name : undefined,
                        success: false,
                        totalLines,
                        error: `startLine (${startLine}) exceeds total lines (${totalLines})`
                    }
                };
            }
            
            // 确定结束行：默认读取到文件末尾
            let endLine = lineRange.endLine ?? totalLines;
            if (endLine > totalLines) endLine = totalLines;
            if (endLine < startLine) endLine = startLine;
            
            actualStartLine = startLine;
            actualEndLine = endLine;
            selectedLines = allLines.slice(startLine - 1, endLine);
        } else {
            selectedLines = allLines;
        }
        
        // 添加行号前缀
        const startLineNum = actualStartLine ?? 1;
        const numberedLines = selectedLines.map((line, index) => {
            const lineNum = startLineNum + index;
            return `${lineNum.toString().padStart(4)} | ${line}`;
        });
        
        // 构建返回结果
        const result: ReadResult = {
            path: filePath,
            workspace: isMultiRoot ? workspace?.name : undefined,
            success: true,
            type: 'text',
            content: numberedLines.join('\n'),
            lineCount: selectedLines.length
        };
        
        // 如果指定了行范围，添加额外信息
        if (lineRange) {
            result.totalLines = totalLines;
            result.startLine = actualStartLine;
            result.endLine = actualEndLine;
        }
        
        return { result };
    } catch (error) {
        return {
            result: {
                path: filePath,
                workspace: isMultiRoot ? workspace?.name : undefined,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        };
    }
}

/**
 * 创建读取文件工具
 *
 * @param multimodalEnabled 是否启用多模态工具（可选，用于生成不同的工具声明）
 * @param channelType 渠道类型（可选）
 * @param toolMode 工具模式（可选）
 */
export function createReadFileTool(
    multimodalEnabled?: boolean,
    channelType?: 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom',
    toolMode?: 'function_call' | 'xml' | 'json'
): Tool {
    // 获取工作区信息
    const workspaces = getAllWorkspaces();
    const isMultiRoot = workspaces.length > 1;
    
    // 根据多模态配置和渠道类型生成不同的工具描述
    let description: string;
    
    // 行号格式说明
    const lineNumberNote = '\n\n**Note**: Text files return content with line number prefixes (e.g., "   1 | code here"). The numbers and "|" are line markers and not part of the file content. Please ignore these prefixes when editing files.';

    // Batching guidance (reduces tool-iteration loops and UI noise)
    const batchingNote = '\n\n**Batching**: When you need to read multiple files, prefer ONE `read_file` call and include all targets in the `files` array. This reduces tool-iteration loops. If the list is large, split into a few batched calls (e.g., <= 10 files per call).';

    // Search first, then read (reduces token cost and unnecessary file reads)
    const efficiencyNote = '\n\n**Efficiency**: If you are unsure which files/lines are relevant, use search_in_files/find_files/get_symbols (or LSP tools like goto_definition/find_references) first, then read only the necessary files or precise line ranges.';
    
    // 数组格式强调说明
    const arrayFormatNote = '\n\n**IMPORTANT**: The `files` parameter MUST be an array, even for a single file. Example: `{"files": [{"path": "file.txt"}]}` or `{"files": [{"path": "file.txt", "startLine": 100, "endLine": 200}]}`.';
    
    // 行范围说明
    const lineRangeNote = '\n\n**Line Range**: Each file can have its own `startLine` and `endLine`. ONLY use line range when you have PRECISE line numbers (e.g., from get_symbols, goto_definition, find_references, or previous read_file results). Do NOT guess line numbers - if uncertain, read the entire file without specifying line range.';
    
    if (!multimodalEnabled) {
        // 未启用多模态时，只支持文本文件
        description = 'Read the content of one or more files in the workspace. Supported types: text files.' + batchingNote + efficiencyNote + lineNumberNote + arrayFormatNote + lineRangeNote;
    } else if (channelType === 'openai') {
        // OpenAI 格式有特殊限制
        if (toolMode === 'function_call') {
            // OpenAI function_call 模式不支持多模态
            description = 'Read the content of one or more files in the workspace. Supported types: text files.' + batchingNote + efficiencyNote + lineNumberNote + arrayFormatNote + lineRangeNote;
        } else {
            // OpenAI xml/json 模式只支持图片
            description = 'Read the content of one or more files in the workspace. Supported types: text files, images (PNG/JPEG/WebP). Images are returned as multimodal data.' + batchingNote + efficiencyNote + lineNumberNote + arrayFormatNote + lineRangeNote;
        }
    } else {
        // Gemini 和 Anthropic 全面支持
        description = 'Read the content of one or more files in the workspace. Supported types: text files, images (PNG/JPEG/WebP), documents (PDF). Images and documents are returned as multimodal data.' + batchingNote + efficiencyNote + lineNumberNote + arrayFormatNote + lineRangeNote;
    }
    
    // 多工作区说明
    if (isMultiRoot) {
        description += '\n\nMulti-root workspace: Use "workspace_name/path" format to specify the workspace.';
    }
    
    // 路径参数描述
    let filesDescription = 'Array of file objects. Each object has: path (required), startLine (optional), endLine (optional). Example: [{"path": "src/main.ts", "startLine": 100}]';
    if (isMultiRoot) {
        filesDescription = `Array of file objects. Path must use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`;
    }
    
    return {
        declaration: {
            name: 'read_file',
            description,
            category: 'file',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: 'File path (relative to workspace root)'
                                },
                                startLine: {
                                    type: 'number',
                                    description: 'Start line number (1-based, inclusive). Reads from this line to end of file, or to endLine if specified.'
                                },
                                endLine: {
                                    type: 'number',
                                    description: 'End line number (1-based, inclusive). Reads from beginning (or startLine) to this line.'
                                }
                            },
                            required: ['path']
                        },
                        description: filesDescription
                    }
                },
                required: ['files']
            }
        },
        handler: async (args, context): Promise<ToolResult> => {
            // 从 context 中获取多模态能力
            const capability = context?.capability as MultimodalCapability ?? {
                supportsImages: false,
                supportsDocuments: false,
                supportsHistoryMultimodal: false
            };
            
            // 获取工作区信息
            const workspaces = getAllWorkspaces();
            const isMultiRoot = workspaces.length > 1;
            
            // 获取文件列表参数
            const fileList = args.files as FileReadRequest[];
            if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
                return { success: false, error: 'files is required and must be a non-empty array' };
            }

            const allMultimodal: (MultimodalData[] | undefined)[] = new Array(fileList.length);
            const MAX_CONCURRENT = 10;

            // 处理单个文件请求的函数
            const processFileRequest = async (fileReq: FileReadRequest, index: number): Promise<{
                index: number;
                result: ReadResult;
                multimodal?: MultimodalData[];
            }> => {
                // 验证每个文件请求
                if (!fileReq || typeof fileReq.path !== 'string') {
                    return {
                        index,
                        result: {
                            path: String(fileReq?.path || 'unknown'),
                            success: false,
                            error: 'Invalid file request: path is required'
                        }
                    };
                }
                
                // 构建行范围对象（每个文件单独的行范围）
                let lineRange: LineRange | undefined;
                const startLine = fileReq.startLine;
                const endLine = fileReq.endLine;
                
                if ((typeof startLine === 'number' && startLine >= 1) || (typeof endLine === 'number' && endLine >= 1)) {
                    lineRange = {};
                    if (typeof startLine === 'number' && startLine >= 1) {
                        lineRange.startLine = startLine;
                    }
                    if (typeof endLine === 'number' && endLine >= 1) {
                        lineRange.endLine = endLine;
                    }
                }
                
                const { result, multimodal } = await readSingleFile(fileReq.path, capability, isMultiRoot, lineRange);
                return { index, result, multimodal };
            };

            // 并行读取文件，限制最大并发数
            const results: ReadResult[] = new Array(fileList.length);
            let successCount = 0;
            let failCount = 0;

            await runWithConcurrency(fileList, MAX_CONCURRENT, async (fileReq, index) => {
                const { result, multimodal } = await processFileRequest(fileReq, index);
                
                results[index] = result;
                allMultimodal[index] = multimodal;

                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            });

            const flatMultimodal: MultimodalData[] = [];
            for (const item of allMultimodal) {
                if (item) {
                    flatMultimodal.push(...item);
                }
            }

            const allSuccess = failCount === 0;
            return {
                success: allSuccess,
                data: {
                    results,
                    successCount,
                    failCount,
                    totalCount: fileList.length,
                    multiRoot: isMultiRoot
                },
                multimodal: flatMultimodal.length > 0 ? flatMultimodal : undefined,
                error: allSuccess ? undefined : `${failCount} files failed to read`
            };
        }
    };
}

/**
 * 注册读取文件工具
 */
export function registerReadFile(): Tool {
    return createReadFileTool();
}
