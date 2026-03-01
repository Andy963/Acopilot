/**
 * Acopilot - 完整的聊天视图提供者
 * 
 * 集成后端API模块，提供完整功能
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { t, setLanguage as setBackendLanguage } from '../backend/i18n';
import type { SupportedLanguage } from '../backend/i18n';
import { debugLog } from '../backend/core/logger';
import {
    ConversationManager,
    FileSystemStorageAdapter
} from '../backend/modules/conversation';
import { ConfigManager, MementoStorageAdapter } from '../backend/modules/config';
import { ChannelManager } from '../backend/modules/channel';
import { ChatHandler } from '../backend/modules/api/chat';
import { ModelsHandler } from '../backend/modules/api/models';
import { SettingsManager, FileSettingsStorage, StoragePathManager } from '../backend/modules/settings';
import type { StoragePathConfig, StorageStats } from '../backend/modules/settings';
import { SettingsHandler } from '../backend/modules/api/settings';
import { CheckpointManager } from '../backend/modules/checkpoint';
import { McpManager, VSCodeFileSystemMcpStorageAdapter } from '../backend/modules/mcp';
import type { CreateMcpServerInput, UpdateMcpServerInput, McpServerInfo } from '../backend/modules/mcp';
import { DependencyManager, type InstallProgressEvent } from '../backend/modules/dependencies';
import { toolRegistry, registerAllTools, onTerminalOutput, onImageGenOutput, TaskManager } from '../backend/tools';
import type { TerminalOutputEvent, ImageGenOutputEvent, TaskEvent } from '../backend/tools';
import {
    setGlobalSettingsManager,
    setGlobalConfigManager,
    setGlobalChannelManager,
    setGlobalToolRegistry,
    setGlobalDiffStorageManager
} from '../backend/core/settingsContext';
import { DiffStorageManager } from '../backend/modules/conversation';
import { MessageRouter } from './MessageRouter';
import { initializeChatBackend } from './chatBackendInitializer';
import type { HandlerContext, DiffPreviewContentProvider as IDiffPreviewContentProvider } from './types';
import { isRecord, parseWebviewRequest } from './protocol';

/**
 * Diff 预览内容提供者
 */
class DiffPreviewContentProvider implements vscode.TextDocumentContentProvider, IDiffPreviewContentProvider {
    private contents: Map<string, string> = new Map();
    private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

    public onDidChange = this.onDidChangeEmitter.event;

    public setContent(uri: string, content: string): void {
        this.contents.set(uri, content);
    }

    public provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) || '';
    }

    public dispose(): void {
        this.contents.clear();
        this.onDidChangeEmitter.dispose();
    }
}

function getNonce(length: number = 32): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < length; i++) {
        nonce += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return nonce;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    // Webview readiness handshake
    private webviewReady = false;
    private pendingWebviewMessages: unknown[] = [];

    // Diff 预览内容提供者
    private diffPreviewProvider: DiffPreviewContentProvider;
    private diffPreviewProviderDisposable: vscode.Disposable;

    // 后端模块
    private configManager!: ConfigManager;
    private channelManager!: ChannelManager;
    private conversationManager!: ConversationManager;
    private chatHandler!: ChatHandler;
    private modelsHandler!: ModelsHandler;
    private settingsManager!: SettingsManager;
    private settingsHandler!: SettingsHandler;
    private checkpointManager!: CheckpointManager;
    private mcpManager!: McpManager;
    private dependencyManager!: DependencyManager;
    private storagePathManager!: StoragePathManager;
    private diffStorageManager!: DiffStorageManager;

    // 消息路由器
    private messageRouter!: MessageRouter;

    // 事件取消订阅函数
    private terminalOutputUnsubscribe?: () => void;
    private imageGenOutputUnsubscribe?: () => void;
    private taskEventUnsubscribe?: () => void;
    private dependencyProgressUnsubscribe?: () => void;

    // 初始化状态
    private initPromise: Promise<void>;

    constructor(private readonly context: vscode.ExtensionContext) {
        // 初始化 Diff 预览内容提供者
        this.diffPreviewProvider = new DiffPreviewContentProvider();
        this.diffPreviewProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
            'acopilot-diff-preview',
            this.diffPreviewProvider
        );
        context.subscriptions.push(this.diffPreviewProviderDisposable);

        // 异步初始化后端
        this.initPromise = this.initializeBackend().catch(err => {
            console.error('Failed to initialize backend:', err);
            throw err;
        });
    }

    /**
     * 初始化后端模块
     */
    private async initializeBackend() {
        const backend = await initializeChatBackend({
            context: this.context,
            onRetryStatus: (status) => this.handleRetryStatus(status),
            onTerminalOutputEvent: (event) => this.handleTerminalOutputEvent(event),
            onImageGenOutputEvent: (event) => this.handleImageGenOutputEvent(event),
            onTaskEvent: (event) => this.handleTaskEvent(event),
            onDependencyProgressEvent: (event) => this.handleDependencyProgressEvent(event),
            getView: () => this._view,
            sendResponse: this.sendResponse.bind(this),
            sendError: this.sendError.bind(this)
        });

        this.configManager = backend.configManager;
        this.channelManager = backend.channelManager;
        this.conversationManager = backend.conversationManager;
        this.chatHandler = backend.chatHandler;
        this.modelsHandler = backend.modelsHandler;
        this.settingsManager = backend.settingsManager;
        this.settingsHandler = backend.settingsHandler;
        this.checkpointManager = backend.checkpointManager;
        this.mcpManager = backend.mcpManager;
        this.dependencyManager = backend.dependencyManager;
        this.storagePathManager = backend.storagePathManager;
        this.diffStorageManager = backend.diffStorageManager;
        this.messageRouter = backend.messageRouter;

        this.terminalOutputUnsubscribe = backend.terminalOutputUnsubscribe;
        this.imageGenOutputUnsubscribe = backend.imageGenOutputUnsubscribe;
        this.taskEventUnsubscribe = backend.taskEventUnsubscribe;
        this.dependencyProgressUnsubscribe = backend.dependencyProgressUnsubscribe;
    }

    /**
     * 处理终端输出事件，推送到前端
     */
    private handleTerminalOutputEvent(event: TerminalOutputEvent): void {
        if (!this._view) return;

        this._view.webview.postMessage({
            type: 'terminalOutput',
            data: event
        });
    }

    /**
     * 处理图像生成输出事件，推送到前端
     */
    private handleImageGenOutputEvent(event: ImageGenOutputEvent): void {
        if (!this._view) return;

        this._view.webview.postMessage({
            type: 'imageGenOutput',
            data: event
        });
    }

    /**
     * 处理统一任务事件，推送到前端
     */
    private handleTaskEvent(event: TaskEvent): void {
        if (!this._view) return;

        this._view.webview.postMessage({
            type: 'taskEvent',
            data: event
        });
    }

    /**
     * 处理依赖安装进度事件，推送到前端
     */
    private handleDependencyProgressEvent(event: InstallProgressEvent): void {
        if (!this._view) return;

        this._view.webview.postMessage({
            type: 'dependencyProgress',
            data: event
        });
    }

    /**
     * 处理重试状态，推送到前端
     */
    private handleRetryStatus(status: {
        type: 'retrying' | 'retrySuccess' | 'retryFailed';
        attempt: number;
        maxAttempts: number;
        error?: string;
        nextRetryIn?: number;
    }): void {
        if (!this._view) return;

        this._view.webview.postMessage({
            type: 'retryStatus',
            data: status
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        this.webviewReady = false;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'frontend', 'dist')),
                vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'codicons'))
            ]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // 监听来自 webview 的消息
        webviewView.webview.onDidReceiveMessage(
            async (message: unknown) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * 创建处理器上下文
     */
    private createHandlerContext(requestId: string): HandlerContext {
        return {
            context: this.context,
            view: this._view,
            configManager: this.configManager,
            channelManager: this.channelManager,
            conversationManager: this.conversationManager,
            chatHandler: this.chatHandler,
            modelsHandler: this.modelsHandler,
            settingsManager: this.settingsManager,
            settingsHandler: this.settingsHandler,
            checkpointManager: this.checkpointManager,
            mcpManager: this.mcpManager,
            dependencyManager: this.dependencyManager,
            storagePathManager: this.storagePathManager,
            diffStorageManager: this.diffStorageManager,
            streamAbortControllers: this.messageRouter.getAbortManager() as any,
            diffPreviewProvider: this.diffPreviewProvider,
            sendResponse: this.sendResponse.bind(this),
            sendError: this.sendError.bind(this),
            getCurrentWorkspaceUri: this.getCurrentWorkspaceUri.bind(this),
            syncLanguageToBackend: this.syncLanguageToBackend.bind(this)
        };
    }

    /**
     * 处理来自前端的消息
     */
    private async handleMessage(message: unknown) {
        const parsed = parseWebviewRequest(message);
        if (!parsed) {
            console.warn('Ignoring invalid webview message');
            return;
        }

        const { type, data, requestId } = parsed;

        try {
            // Webview ready handshake: flush any queued commands
            if (type === 'webviewReady') {
                this.webviewReady = true;
                this.flushPendingWebviewMessages();
                this.sendResponse(requestId, { success: true });
                return;
            }

            // 等待初始化完成
            await this.initPromise;

            // 创建处理器上下文
            const ctx = this.createHandlerContext(requestId);

            // 使用消息路由器处理消息
            const handled = await this.messageRouter.route(type, data, requestId, ctx);

            if (!handled) {
                console.warn('Unknown message type:', type);
                this.sendError(requestId, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'HANDLER_ERROR';
            const errMessage = error instanceof Error ? error.message : String(error);
            this.sendError(requestId, code, errMessage);
        }
    }

    private enqueueWebviewMessage(message: unknown): void {
        if (this._view?.webview && this.webviewReady) {
            this._view.webview.postMessage(message);
            return;
        }

        this.pendingWebviewMessages.push(message);
        // 防止极端情况下无限增长
        if (this.pendingWebviewMessages.length > 200) {
            this.pendingWebviewMessages.shift();
        }
    }

    private flushPendingWebviewMessages(): void {
        if (!this._view?.webview || !this.webviewReady) return;
        const pending = this.pendingWebviewMessages.splice(0);
        for (const msg of pending) {
            this._view.webview.postMessage(msg);
        }
    }

    /**
     * 同步语言设置到后端 i18n
     */
    private syncLanguageToBackend(): void {
        try {
            const settings = this.settingsManager.getSettings();
            const language = settings.ui?.language || 'zh-CN';
            setBackendLanguage(language as SupportedLanguage);
        } catch (error) {
            console.error('Failed to sync language to backend:', error);
        }
    }

    /**
     * 获取当前工作区 URI
     */
    private getCurrentWorkspaceUri(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder ? workspaceFolder.uri.toString() : null;
    }

    /**
     * 取消所有活跃的流式请求
     */
    public cancelAllStreams(): void {
        this.messageRouter?.cancelAllStreams();
        debugLog('All active streams cancelled');
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        // 取消所有活跃的流式请求
        this.cancelAllStreams();

        // 取消终端输出订阅
        if (this.terminalOutputUnsubscribe) {
            this.terminalOutputUnsubscribe();
        }

        // 取消图像生成输出订阅
        if (this.imageGenOutputUnsubscribe) {
            this.imageGenOutputUnsubscribe();
        }

        // 取消统一任务事件订阅
        if (this.taskEventUnsubscribe) {
            this.taskEventUnsubscribe();
        }

        // 取消依赖安装进度订阅
        if (this.dependencyProgressUnsubscribe) {
            this.dependencyProgressUnsubscribe();
        }

        // 取消所有活跃任务
        TaskManager.cancelAllTasks();

        // 释放 MCP 管理器资源（断开所有连接）
        this.mcpManager?.dispose();

        debugLog('ChatViewProvider disposed');
    }

    /**
     * 发送响应到前端
     */
    private sendResponse(requestId: string, data: unknown) {
        this._view?.webview.postMessage({
            type: 'response',
            requestId,
            success: true,
            data
        });
    }

    /**
     * 发送错误到前端
     */
    private sendError(requestId: string, code: string, message: string) {
        this._view?.webview.postMessage({
            type: 'error',
            requestId,
            success: false,
            error: {
                code,
                message
            }
        });
    }

    /**
     * 发送命令到 Webview
     */
    public sendCommand(command: string, data?: unknown): void {
        this.enqueueWebviewMessage({
            type: 'command',
            command,
            data
        });
    }

    /**
     * 生成webview的HTML
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'frontend', 'dist', 'index.js'))
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'frontend', 'dist', 'index.css'))
        );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'codicons', 'codicon.css'))
        );

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; media-src ${webview.cspSource} data: blob:;">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>Acopilot Chat</title>
</head>
<body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
