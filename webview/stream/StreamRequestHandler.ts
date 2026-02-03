/**
 * 流式请求处理器
 * 
 * 处理所有流式消息类型
 */

import * as vscode from 'vscode';
import type { ChatHandler } from '../../backend/modules/api/chat';
import { StreamAbortManager } from './StreamAbortManager';
import { StreamChunkProcessor } from './StreamChunkProcessor';
import { t } from '../../backend/i18n';
import type { OpenFileContextInput } from '../../backend/modules/api/chat/services/FileContextCollector';
import type {
  ChatStreamPayload,
  EditAndRetryStreamPayload,
  RetryStreamPayload,
  ToolConfirmationStreamPayload
} from '../protocol';

export interface StreamHandlerDeps {
  chatHandler: ChatHandler;
  abortManager: StreamAbortManager;
  getView: () => vscode.WebviewView | undefined;
  sendResponse: (requestId: string, data: any) => void;
  sendError: (requestId: string, code: string, message: string) => void;
}

async function collectOpenFilesForChat(maxFiles: number): Promise<OpenFileContextInput[]> {
  const activeEditor = vscode.window.activeTextEditor;
  const activeUri = activeEditor?.document?.uri;
  const activeSelection = (() => {
    if (!activeEditor) return undefined;
    const nonEmpty = activeEditor.selections.filter((s) => !s.isEmpty);
    if (nonEmpty.length === 0) return undefined;
    return nonEmpty[0];
  })();

  const uris: vscode.Uri[] = [];
  if (activeUri) uris.push(activeUri);

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        uris.push(tab.input.uri);
      }
    }
  }

  const uniqueUris: vscode.Uri[] = [];
  const seen = new Set<string>();
  for (const uri of uris) {
    const key = uri.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    // Limit to workspace files to avoid leaking unrelated paths.
    const ws = vscode.workspace.getWorkspaceFolder(uri);
    if (!ws) continue;

    uniqueUris.push(uri);
    if (uniqueUris.length >= maxFiles) break;
  }

  const openFiles: OpenFileContextInput[] = [];
  for (const uri of uniqueUris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const relPath = vscode.workspace.asRelativePath(uri, false);
      const languageId = doc.languageId;

      const isActive = !!activeUri && uri.toString() === activeUri.toString();

      if (isActive && activeSelection) {
        const start = activeSelection.start;
        const end = activeSelection.end;

        const startLine = start.line + 1;
        let endLine = end.line + 1;
        if (end.character === 0 && end.line > start.line) {
          endLine = end.line;
        }

        openFiles.push({
          path: relPath,
          uri: uri.toString(),
          languageId,
          text: doc.getText(activeSelection),
          textStartLine: startLine,
          startLine,
          endLine,
        });
        continue;
      }

      if (doc.isDirty || uri.scheme !== 'file') {
        const maxLines = 400;
        const lastLineIndex = Math.min(Math.max(0, doc.lineCount - 1), maxLines - 1);
        const endChar = doc.lineAt(lastLineIndex).text.length;
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lastLineIndex, endChar));

        openFiles.push({
          path: relPath,
          uri: uri.toString(),
          languageId,
          text: doc.getText(range),
          textStartLine: 1,
        });
      } else {
        openFiles.push({
          path: relPath,
          uri: uri.toString(),
          languageId,
          absolutePath: uri.fsPath,
        });
      }
    } catch {
      // Ignore unreadable documents and continue.
    }
  }

  return openFiles;
}

/**
 * 流式请求处理器
 */
export class StreamRequestHandler {
  constructor(private deps: StreamHandlerDeps) {}

  /**
   * 处理普通聊天流
   */
  async handleChatStream(data: ChatStreamPayload, requestId: string): Promise<void> {
    const { conversationId, message, configId, chatMode, attachments, selectionReferences, contextOverrides, taskContext } = data;
    
    const controller = this.deps.abortManager.create(conversationId);
    const processor = new StreamChunkProcessor(this.deps.getView(), conversationId);
    
    try {
      const openFiles = (chatMode ?? 'chat') === 'chat'
        ? await collectOpenFilesForChat(5)
        : undefined;

      const stream = this.deps.chatHandler.handleChatStream({
        conversationId,
        message,
        configId,
        chatMode,
        attachments,
        selectionReferences,
        contextOverrides,
        taskContext,
        openFiles,
        abortSignal: controller.signal
      });
      
      // 发送响应，通知前端请求已接收并开始
      this.deps.sendResponse(requestId, { started: true });
      
      for await (const chunk of stream) {
        const isError = processor.processChunk(chunk);
        if (isError) break;
      }
    } catch (error: any) {
      this.handleStreamError(error, processor, requestId, controller.signal.aborted);
    } finally {
      this.deps.abortManager.delete(conversationId);
    }
  }

  /**
   * 处理重试流
   */
  async handleRetryStream(data: RetryStreamPayload, requestId: string): Promise<void> {
    const { conversationId, configId } = data;
    
    const controller = this.deps.abortManager.create(conversationId);
    const processor = new StreamChunkProcessor(this.deps.getView(), conversationId);
    
    try {
      const stream = this.deps.chatHandler.handleRetryStream({
        conversationId,
        configId,
        abortSignal: controller.signal
      });
      
      // 发送响应，通知前端请求已接收并开始
      this.deps.sendResponse(requestId, { started: true });
      
      for await (const chunk of stream) {
        const isError = processor.processChunk(chunk);
        if (isError) break;
      }
    } catch (error: any) {
      this.handleStreamError(error, processor, requestId, controller.signal.aborted);
    } finally {
      this.deps.abortManager.delete(conversationId);
    }
  }

  /**
   * 处理编辑并重试流
   */
  async handleEditAndRetryStream(data: EditAndRetryStreamPayload, requestId: string): Promise<void> {
    const { conversationId, messageIndex, newMessage, configId, attachments } = data;
    
    const controller = this.deps.abortManager.create(conversationId);
    const processor = new StreamChunkProcessor(this.deps.getView(), conversationId);
    
    try {
      const stream = this.deps.chatHandler.handleEditAndRetryStream({
        conversationId,
        messageIndex,
        newMessage,
        configId,
        attachments,
        abortSignal: controller.signal
      });
      
      // 发送响应，通知前端请求已接收并开始
      this.deps.sendResponse(requestId, { started: true });
      
      for await (const chunk of stream) {
        const isError = processor.processChunk(chunk);
        if (isError) break;
      }
    } catch (error: any) {
      this.handleStreamError(error, processor, requestId, controller.signal.aborted);
    } finally {
      this.deps.abortManager.delete(conversationId);
    }
  }

  /**
   * 处理工具确认流
   */
  async handleToolConfirmationStream(data: ToolConfirmationStreamPayload, requestId: string): Promise<void> {
    const { conversationId, toolResponses, annotation, configId } = data;
    
    const controller = this.deps.abortManager.create(conversationId);
    const processor = new StreamChunkProcessor(this.deps.getView(), conversationId);
    
    try {
      const stream = this.deps.chatHandler.handleToolConfirmation({
        conversationId,
        toolResponses,
        annotation,
        configId,
        abortSignal: controller.signal
      });
      
      // 发送响应，通知前端请求已接收并开始
      this.deps.sendResponse(requestId, { started: true });
      
      for await (const chunk of stream) {
        const isError = processor.processChunk(chunk);
        if (isError) break;
      }
    } catch (error: any) {
      this.handleStreamError(error, processor, requestId, controller.signal.aborted);
    } finally {
      this.deps.abortManager.delete(conversationId);
    }
  }

  /**
   * 取消流
   */
  cancelStream(conversationId: string, requestId: string): void {
    this.deps.abortManager.cancel(conversationId);
    this.deps.sendResponse(requestId, { cancelled: true });
  }

  /**
   * 处理流式错误
   */
  private handleStreamError(error: any, processor: StreamChunkProcessor, requestId: string, wasAborted?: boolean): void {
    // 仅在当前请求的 AbortController 被触发时才视为“用户取消”。
    // 之前用 error.message.includes('aborted') 会误吞掉真实网络错误（例如 ChannelError: "Request aborted"），
    // 导致前端表现为“思考一半就停了且无任何错误”。
    if (wasAborted) {
      return;
    }
    
    const errorMessage = error.message || t('webview.errors.streamFailed');
    processor.sendError('STREAM_ERROR', errorMessage);
    
    // 同时发送请求错误响应，确保前端 await sendToExtension 能够返回
    this.deps.sendError(requestId, 'STREAM_ERROR', errorMessage);
  }
}
