/**
 * Acopilot - 格式转换器基类
 * 
 * 定义格式转换器的抽象接口
 */

import type { Content } from '../../conversation/types';
import type { ChannelConfig } from '../../config/types';
import type { ToolDeclaration } from '../../../tools/types';
import type {
    GenerateRequest,
    GenerateResponse,
    StreamChunk,
    HttpRequestOptions
} from '../types';

/**
 * 格式转换器基类
 * 
 * 所有格式转换器都必须继承此类并实现抽象方法
 */
export abstract class BaseFormatter {
    /**
     * 构建 HTTP 请求
     *
     * 将统一的 GenerateRequest 转换为特定 API 的请求格式
     *
     * @param request 生成请求
     * @param config 渠道配置
     * @param tools 工具声明列表（可选）
     * @returns HTTP 请求选项
     */
    abstract buildRequest(
        request: GenerateRequest,
        config: ChannelConfig,
        tools?: ToolDeclaration[]
    ): HttpRequestOptions;
    
    /**
     * 解析响应
     * 
     * 将 API 响应转换为统一的 GenerateResponse 格式
     * 
     * @param response 原始响应
     * @returns 标准化的响应
     */
    abstract parseResponse(response: any): GenerateResponse;
    
    /**
     * 解析流式响应块
     * 
     * 将流式响应块转换为 StreamChunk 格式
     * 
     * @param chunk 原始响应块
     * @returns 标准化的流式响应块
     */
    abstract parseStreamChunk(chunk: any): StreamChunk;
    
    /**
     * 验证配置
     * 
     * 检查配置是否适用于此格式转换器
     * 
     * @param config 渠道配置
     * @returns 是否有效
     */
    abstract validateConfig(config: ChannelConfig): boolean;
    
    /**
     * 获取支持的配置类型
     *
     * @returns 配置类型
     */
    abstract getSupportedType(): string;
    
    /**
     * 转换工具声明
     *
     * 将统一的工具声明格式转换为特定 API 的工具格式
     *
     * @param tools 工具声明数组
     * @returns 转换后的工具格式
     */
    abstract convertTools(tools: ToolDeclaration[]): any;
}