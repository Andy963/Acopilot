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
import type { HandlerContext, DiffPreviewContentProvider as IDiffPreviewContentProvider } from './types';

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseWebviewRequest(message: unknown): { type: string; requestId: string; data: unknown } | null {
    if (!isRecord(message)) return null;
    const type = typeof message.type === 'string' ? message.type : undefined;
    const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;
    if (!type || !requestId) return null;
    const data = Object.prototype.hasOwnProperty.call(message, 'data') ? message.data : undefined;
    return { type, requestId, data };
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
        // 1. 初始化设置管理器（需要最先初始化以获取存储路径配置）
        const settingsStorageDir = path.join(this.context.globalStorageUri.fsPath, 'settings');
        const settingsStorage = new FileSettingsStorage(settingsStorageDir);
        this.settingsManager = new SettingsManager(settingsStorage);
        await this.settingsManager.initialize();

        // 2. 初始化存储路径管理器
        this.storagePathManager = new StoragePathManager(this.settingsManager, this.context);
        await this.storagePathManager.ensureDirectories();

        // 3. 获取有效的数据存储路径（可能是自定义路径）
        const effectiveDataUri = this.storagePathManager.getEffectiveDataUri();

        // 4. 初始化存储适配器（使用文件系统存储，避免 globalState 过大）
        const storageAdapter = new FileSystemStorageAdapter(vscode, effectiveDataUri);

        // 5. 初始化 Diff 存储管理器（用于 apply_diff 的大文件内容抽离）
        this.diffStorageManager = DiffStorageManager.initialize(this.storagePathManager.getEffectiveDataPath());
        setGlobalDiffStorageManager(this.diffStorageManager);

        // 6. 初始化对话管理器
        this.conversationManager = new ConversationManager(storageAdapter);

        // 7. 初始化配置管理器（使用Memento存储）
        const configStorage = new MementoStorageAdapter(
            this.context.globalState,
            'acopilot.configs'
        );
        this.configManager = new ConfigManager(configStorage, this.context.secrets);

        // 8. 创建默认配置（如果不存在）
        await this.ensureDefaultConfig();

        // 9. 同步语言设置到后端 i18n
        this.syncLanguageToBackend();

        // 10. 设置全局上下文引用（供工具和其他模块访问）
        setGlobalSettingsManager(this.settingsManager);
        setGlobalConfigManager(this.configManager);
        setGlobalToolRegistry(toolRegistry);

        // 11. 注册所有工具到工具注册器（必须在 ChannelManager 之前）
        registerAllTools(toolRegistry);

        // 12. 初始化渠道管理器（传入工具注册器和设置管理器）
        this.channelManager = new ChannelManager(this.configManager, toolRegistry, this.settingsManager);

        // 13. 设置重试状态回调
        this.channelManager.setRetryStatusCallback((status) => {
            this.handleRetryStatus(status);
        });

        // 14. 设置全局渠道管理器引用
        setGlobalChannelManager(this.channelManager);

        // 15. 初始化检查点管理器（使用自定义路径）
        this.checkpointManager = new CheckpointManager(
            this.settingsManager,
            this.conversationManager,
            this.context,
            this.storagePathManager.getEffectiveDataPath()
        );
        await this.checkpointManager.initialize();

        // 16. 初始化聊天处理器（传入工具注册器和检查点管理器）
        this.chatHandler = new ChatHandler(
            this.configManager,
            this.channelManager,
            this.conversationManager,
            toolRegistry
        );
        this.chatHandler.setCheckpointManager(this.checkpointManager);
        this.chatHandler.setSettingsManager(this.settingsManager);
        this.chatHandler.setDiffStorageManager(this.diffStorageManager);

        // 17. 初始化模型管理处理器
        this.modelsHandler = new ModelsHandler(this.configManager);

        // 18. 初始化设置处理器（传入工具注册器）
        this.settingsHandler = new SettingsHandler(this.settingsManager, toolRegistry);

        // 19. 订阅终端输出事件
        this.terminalOutputUnsubscribe = onTerminalOutput((event) => {
            this.handleTerminalOutputEvent(event);
        });

        // 20. 订阅图像生成输出事件
        this.imageGenOutputUnsubscribe = onImageGenOutput((event) => {
            this.handleImageGenOutputEvent(event);
        });

        // 21. 订阅统一任务事件（用于未来扩展）
        this.taskEventUnsubscribe = TaskManager.onTaskEvent((event) => {
            this.handleTaskEvent(event);
        });

        // 22. 初始化 MCP 管理器（使用自定义路径下的 mcp 目录）
        const mcpConfigDir = vscode.Uri.file(this.storagePathManager.getMcpPath());
        try {
            await vscode.workspace.fs.stat(mcpConfigDir);
        } catch {
            await vscode.workspace.fs.createDirectory(mcpConfigDir);
        }
        const mcpConfigFile = vscode.Uri.joinPath(mcpConfigDir, 'servers.json');
        const mcpStorage = new VSCodeFileSystemMcpStorageAdapter(mcpConfigFile, vscode.workspace.fs);
        this.mcpManager = new McpManager(mcpStorage, this.context.secrets);
        await this.mcpManager.initialize();

        // 23. 将 MCP 管理器连接到 ChannelManager（用于工具声明）
        this.channelManager.setMcpManager(this.mcpManager);

        // 24. 将 MCP 管理器连接到 ChatHandler（用于工具调用）
        this.chatHandler.setMcpManager(this.mcpManager);

        // 25. 初始化依赖管理器（使用自定义路径）
        this.dependencyManager = DependencyManager.getInstance(
            this.context,
            this.storagePathManager.getDependenciesPath()
        );
        await this.dependencyManager.initialize();

        // 26. 设置依赖检查器到工具注册器（用于过滤未安装依赖的工具）
        toolRegistry.setDependencyChecker({
            isInstalled: (name: string) => this.dependencyManager.isInstalledSync(name)
        });

        // 27. 订阅依赖安装进度事件
        this.dependencyProgressUnsubscribe = this.dependencyManager.onProgress((event) => {
            this.handleDependencyProgressEvent(event);
        });

        // 28. 初始化消息路由器
        this.messageRouter = new MessageRouter(
            this.chatHandler,
            () => this._view,
            this.sendResponse.bind(this),
            this.sendError.bind(this)
        );

        console.log('Acopilot backend initialized with global context');
        console.log('Effective data path:', this.storagePathManager.getEffectiveDataPath());
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

    /**
     * 确保至少存在一个默认配置，并保证 activeChannelId 指向有效配置。
     *
     * 重要：不要因为缺少某个固定 ID（如 gemini-pro）就“自动补回”，
     * 否则用户删除默认供应商后会在下次启动时被重新创建。
     */
    private async ensureDefaultConfig() {
        try {
            // 1) 仅当完全没有任何配置时才创建默认配置
            const existingConfigs = await this.configManager.listConfigs();
            if (existingConfigs.length === 0) {
                const config = {
                    id: 'gemini-pro',
                    type: 'gemini' as const,
                    name: 'Gemini(Default)',
                    apiKey: process.env.GEMINI_API_KEY || '',
                    url: 'https://generativelanguage.googleapis.com/v1beta',
                    model: 'gemini-3-pro-preview',
                    timeout: 120000,
                    enabled: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                const storage = (this.configManager as any).storageAdapter;
                await storage.save(config);

                // 触发 ConfigManager 重新加载
                (this.configManager as any).loaded = false;
            }

            // 2) 修正 activeChannelId：如果为空或指向不存在的配置，则选择第一个可用配置
            const configs = await this.configManager.listConfigs();
            if (configs.length > 0) {
                const activeId = this.settingsManager.getActiveChannelId();
                const activeExists = !!activeId && configs.some(c => c.id === activeId);
                if (!activeExists) {
                    await this.settingsManager.setActiveChannelId(configs[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to ensure default config:', error);
        }
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
        console.log('All active streams cancelled');
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

        console.log('ChatViewProvider disposed');
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
