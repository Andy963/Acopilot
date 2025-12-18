/**
 * LimCode - 基础配置类型
 *
 * 所有渠道配置的基础接口和通用类型
 */

/**
 * 支持的渠道类型
 */
export type ChannelType = 'gemini' | 'openai' | 'anthropic';

/**
 * 裁切图片工具配置
 */
export interface CropImageToolOptions {
    /**
     * 是否使用归一化坐标
     *
     * - true: 使用 0-1000 归一化坐标系统（适用于 Gemini 等模型）
     * - false: 模型直接输出像素坐标（适用于能自行计算坐标的模型）
     *
     * 默认值：true
     */
    useNormalizedCoordinates?: boolean;
}

/**
 * 工具配置
 *
 * 各工具的渠道级配置
 */
export interface ToolOptions {
    /** 裁切图片工具配置 */
    cropImage?: CropImageToolOptions;
}

/**
 * 工具使用模式
 */
export type ToolMode = 'function_call' | 'xml' | 'json';

/**
 * 自定义请求标头项
 */
export interface CustomHeader {
    /** 标头键名 */
    key: string;
    
    /** 标头值 */
    value: string;
    
    /** 是否启用 */
    enabled: boolean;
}

/**
 * 自定义 body 模式
 */
export type CustomBodyMode = 'simple' | 'advanced';

/**
 * 自定义 body 简单模式项
 *
 * 键值对形式，值可以是 JSON 字符串
 */
export interface CustomBodyItem {
    /** 键名（支持嵌套路径，如 "extra_body" 或 "extra_body.google"） */
    key: string;
    
    /** 值（JSON 字符串或普通字符串） */
    value: string;
    
    /** 是否启用 */
    enabled: boolean;
}

/**
 * 自定义 body 配置
 */
export interface CustomBodyConfig {
    /** 模式：simple = 键值对，advanced = 完整 JSON */
    mode: CustomBodyMode;
    
    /** 简单模式下的键值对列表 */
    items?: CustomBodyItem[];
    
    /** 复杂模式下的 JSON 字符串 */
    json?: string;
}

/**
 * 模型信息
 */
export interface ModelInfo {
    /** 模型 ID */
    id: string;
    
    /** 模型名称 */
    name?: string;
    
    /** 模型描述 */
    description?: string;
    
    /** 上下文窗口大小 */
    contextWindow?: number;
    
    /** 最大输出token */
    maxOutputTokens?: number;
}

/**
 * 基础配置接口
 *
 * 所有渠道配置都继承此接口
 */
export interface BaseChannelConfig {
    /** 唯一标识符 */
    id: string;
    
    /** 显示名称 */
    name: string;
    
    /** 渠道类型 */
    type: ChannelType;
    
    /** 是否启用 */
    enabled: boolean;
    
    /** 创建时间戳 */
    createdAt: number;
    
    /** 最后更新时间戳 */
    updatedAt: number;
    
    /** 描述信息（可选） */
    description?: string;
    
    /** 标签（用于分类） */
    tags?: string[];
    
    /**
     * 系统指令（可选）
     * 
     * 为模型提供系统级指令，定义其行为和角色
     * 例如："You are a helpful AI assistant"
     */
    systemInstruction?: string;
    
    /**
     * 请求超时时间（毫秒）
     *
     * 必填项，默认推荐：120000 (120秒)
     * 用于控制 API 请求的最大等待时间
     */
    timeout: number;
    
    /**
     * 是否优先使用流式输出
     *
     * - true: 默认使用流式（某些渠道可能只支持流式）
     * - false: 默认使用非流式（默认值）
     * - 注意：config.options.stream 可以覆盖此设置
     */
    preferStream?: boolean;
    
    /**
     * 工具使用模式
     *
     * - `function_call`: 使用 Function Calling（默认）
     *   工具定义会作为独立字段传递给 API
     * - `xml`: 使用 XML 提示词格式
     *   工具定义会被转换为 XML 格式并插入到系统提示词中
     * - `json`: 使用 JSON 代码块格式
     *   工具定义会被转换为 JSON 格式说明，模型输出 ```json 代码块
     *
     * 默认值：'function_call'
     */
    toolMode?: ToolMode;
    
    /**
     * 自定义请求标头
     *
     * 用于添加额外的 HTTP 请求标头
     * 按照数组顺序发送
     */
    customHeaders?: CustomHeader[];
    
    /**
     * 是否启用自定义标头功能
     */
    customHeadersEnabled?: boolean;
    
    /**
     * 自定义请求 body
     *
     * 用于添加额外的请求体字段
     * 支持嵌套 JSON 覆盖
     */
    customBody?: CustomBodyConfig;
    
    /**
     * 是否启用自定义 body 功能
     */
    customBodyEnabled?: boolean;
    
    /**
     * 是否发送历史思考签名
     *
     * 启用后，将发送历史对话中的所有思考签名
     * 签名会根据渠道类型选择对应格式发送
     *
     * 默认值：false
     */
    sendHistoryThoughtSignatures?: boolean;
    
    /**
     * 是否发送历史思考内容
     *
     * 启用后，将发送历史对话中的所有思考内容（包括摘要）
     * 这可能会显著增加上下文长度
     *
     * 默认值：false
     */
    sendHistoryThoughts?: boolean;
    
    /**
     * 是否启用自动重试
     *
     * 启用后，当 API 返回非 200 错误时自动重试
     *
     * 默认值：true
     */
    retryEnabled?: boolean;
    
    /**
     * 重试次数
     *
     * API 返回错误时的最大重试次数
     *
     * 默认值：3
     */
    retryCount?: number;
    
    /**
     * 重试间隔（毫秒）
     *
     * 每次重试之间的等待时间
     *
     * 默认值：3000 (3秒)
     */
    retryInterval?: number;
    
    /**
     * 是否启用上下文阈值检测
     *
     * 启用后，当总 token 数超过阈值时，自动舍弃最旧的对话回合
     *
     * 默认值：false
     */
    contextThresholdEnabled?: boolean;
    
    /**
     * 上下文阈值
     *
     * 支持两种格式：
     * - 数值：直接指定 token 数量，如 100000
     * - 字符串百分比：如 "80%" 表示上下文窗口的 80%
     *
     * 当 totalTokenCount 超过此阈值时，自动舍弃最旧的对话回合
     *
     * 注意：此值应小于 maxContextTokens，否则无意义
     *
     * 默认值："80%"
     */
    contextThreshold?: number | string;
    
    /**
     * 是否启用自动总结（占位功能，暂未实现）
     *
     * 启用后，在舍弃旧回合前先进行总结
     *
     * 默认值：false
     */
    autoSummarizeEnabled?: boolean;
    
    /**
     * 是否启用多模态工具
     *
     * 启用后，read_file 等工具将支持读取以下类型的文件：
     * - 图片：image/png, image/jpeg, image/webp
     * - 文档：application/pdf, text/plain
     *
     * 禁用时，只允许读取文本文件 (text/plain)
     *
     * 默认值：false（禁用多模态，仅支持文本）
     */
    multimodalToolsEnabled?: boolean;
    
    /**
     * 工具配置
     *
     * 各工具的渠道级配置项
     */
    toolOptions?: ToolOptions;
}

/**
 * 深度合并两个对象
 *
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
export function deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
        return target;
    }
    
    if (typeof source !== 'object' || Array.isArray(source)) {
        return source;
    }
    
    if (typeof target !== 'object' || Array.isArray(target) || target === null) {
        target = {};
    }
    
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * 解析自定义 body 配置并与原始 body 合并
 *
 * @param originalBody 原始请求体
 * @param customBody 自定义 body 配置
 * @param enabled 是否启用
 * @returns 合并后的请求体
 */
export function applyCustomBody(originalBody: any, customBody?: CustomBodyConfig, enabled?: boolean): any {
    if (!enabled || !customBody) {
        return originalBody;
    }
    
    let result = { ...originalBody };
    
    if (customBody.mode === 'simple' && customBody.items) {
        // 简单模式：遍历键值对
        for (const item of customBody.items) {
            if (!item.enabled || !item.key || !item.key.trim()) {
                continue;
            }
            
            const key = item.key.trim();
            let value: any;
            
            // 尝试解析值为 JSON
            try {
                value = JSON.parse(item.value);
            } catch {
                // 解析失败，使用原始字符串
                value = item.value;
            }
            
            // 将值合并到结果中
            result = deepMerge(result, { [key]: value });
        }
    } else if (customBody.mode === 'advanced' && customBody.json) {
        // 复杂模式：解析完整 JSON 并深度合并
        try {
            const jsonValue = JSON.parse(customBody.json);
            result = deepMerge(result, jsonValue);
        } catch (error) {
            console.warn('Failed to parse custom body JSON:', error);
        }
    }
    
    return result;
}