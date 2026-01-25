/**
 * 消息路由器
 * 
 * 负责将前端消息路由到正确的处理器
 */

import type { HandlerContext, MessageHandler, MessageHandlerRegistry } from './types';
import { createMessageHandlerRegistry } from './handlers';
import { StreamRequestHandler, StreamAbortManager } from './stream';
import type { ChatHandler } from '../backend/modules/api/chat';
import type * as vscode from 'vscode';
import { isRecord, parseStreamPayload, type StreamMessageType } from './protocol';

/**
 * 流式消息类型
 */
const STREAM_MESSAGE_TYPES = [
  'chatStream',
  'retryStream',
  'editAndRetryStream',
  'toolConfirmation',
  'cancelStream'
] as const;

/**
 * 消息路由器
 */
export class MessageRouter {
  private registry: MessageHandlerRegistry;
  private streamHandler: StreamRequestHandler;
  private abortManager: StreamAbortManager;

  constructor(
    private chatHandler: ChatHandler,
    private getView: () => vscode.WebviewView | undefined,
    private sendResponse: (requestId: string, data: any) => void,
    private sendError: (requestId: string, code: string, message: string) => void
  ) {
    // 创建处理器注册表
    this.registry = createMessageHandlerRegistry();
    
    // 创建流式处理器
    this.abortManager = new StreamAbortManager();
    this.streamHandler = new StreamRequestHandler({
      chatHandler: this.chatHandler,
      abortManager: this.abortManager,
      getView: this.getView,
      sendResponse: this.sendResponse,
      sendError: this.sendError
    });
  }

  /**
   * 路由消息到正确的处理器
   * 
   * @returns true 如果消息已处理，false 如果需要回退到原有处理
   */
  async route(type: string, data: any, requestId: string, ctx: HandlerContext): Promise<boolean> {
    // 检查是否是流式消息
    if (this.isStreamMessage(type)) {
      await this.handleStreamMessage(type as StreamMessageType, data, requestId);
      return true;
    }

    // 检查注册表中是否有处理器
    const handler = this.registry.get(type);
    if (handler) {
      if (!isRecord(data)) {
        this.sendError(requestId, 'INVALID_PAYLOAD', `${type} requires an object payload`);
        return true;
      }
      await handler(data, requestId, ctx);
      return true;
    }

    // 未找到处理器，返回 false 表示需要回退
    return false;
  }

  /**
   * 检查是否是流式消息
   */
  private isStreamMessage(type: string): type is StreamMessageType {
    return STREAM_MESSAGE_TYPES.includes(type as StreamMessageType);
  }

  /**
   * 处理流式消息
   */
  private async handleStreamMessage(type: StreamMessageType, data: any, requestId: string): Promise<void> {
    switch (type) {
      case 'chatStream': {
        // 不阻塞消息循环，流式处理在后台进行
        const parsed = parseStreamPayload('chatStream', data);
        if (parsed.ok === false) {
          this.sendError(requestId, 'INVALID_PAYLOAD', parsed.error);
          return;
        }
        this.streamHandler.handleChatStream(parsed.value, requestId).catch((error: unknown) => {
          console.error('chatStream handler failed:', error);
          this.sendError(requestId, 'STREAM_HANDLER_ERROR', error instanceof Error ? error.message : String(error));
        });
        break;
      }
        
      case 'retryStream': {
        const parsed = parseStreamPayload('retryStream', data);
        if (parsed.ok === false) {
          this.sendError(requestId, 'INVALID_PAYLOAD', parsed.error);
          return;
        }
        this.streamHandler.handleRetryStream(parsed.value, requestId).catch((error: unknown) => {
          console.error('retryStream handler failed:', error);
          this.sendError(requestId, 'STREAM_HANDLER_ERROR', error instanceof Error ? error.message : String(error));
        });
        break;
      }
        
      case 'editAndRetryStream': {
        const parsed = parseStreamPayload('editAndRetryStream', data);
        if (parsed.ok === false) {
          this.sendError(requestId, 'INVALID_PAYLOAD', parsed.error);
          return;
        }
        this.streamHandler.handleEditAndRetryStream(parsed.value, requestId).catch((error: unknown) => {
          console.error('editAndRetryStream handler failed:', error);
          this.sendError(requestId, 'STREAM_HANDLER_ERROR', error instanceof Error ? error.message : String(error));
        });
        break;
      }
        
      case 'toolConfirmation': {
        const parsed = parseStreamPayload('toolConfirmation', data);
        if (parsed.ok === false) {
          this.sendError(requestId, 'INVALID_PAYLOAD', parsed.error);
          return;
        }
        this.streamHandler.handleToolConfirmationStream(parsed.value, requestId).catch((error: unknown) => {
          console.error('toolConfirmation handler failed:', error);
          this.sendError(requestId, 'STREAM_HANDLER_ERROR', error instanceof Error ? error.message : String(error));
        });
        break;
      }
        
      case 'cancelStream': {
        const parsed = parseStreamPayload('cancelStream', data);
        if (parsed.ok === false) {
          this.sendError(requestId, 'INVALID_PAYLOAD', parsed.error);
          return;
        }
        this.streamHandler.cancelStream(parsed.value.conversationId, requestId);
        break;
      }
    }
  }

  /**
   * 取消所有活跃的流
   */
  cancelAllStreams(): void {
    this.abortManager.cancelAll(this.getView());
  }

  /**
   * 获取流式请求取消控制器
   */
  getAbortManager(): StreamAbortManager {
    return this.abortManager;
  }
}
