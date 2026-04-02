import * as vscode from 'vscode';
import { setLanguage as setBackendLanguage } from '../backend/i18n';
import type { SupportedLanguage } from '../backend/i18n';
import { debugLog } from '../backend/core/logger';
import { TaskManager } from '../backend/tools';
import { initializeChatBackend, type ChatBackendInitializationResult, type RetryStatus } from './chatBackendInitializer';
import { ChatViewBridge } from './chatViewBridge';
import { buildChatWebviewHtml, getChatWebviewLocalResourceRoots } from './chatViewHtml';
import { ChatViewSmokeStateTracker, type SmokeStatus } from './chatViewSmokeState';
import { DiffPreviewContentProvider } from './diffPreviewProvider';
import { isRecord, parseWebviewRequest } from './protocol';
import type { HandlerContext } from './types';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private readonly bridge = new ChatViewBridge();
    private readonly smokeState = new ChatViewSmokeStateTracker();
    private readonly diffPreviewProvider = new DiffPreviewContentProvider();
    private readonly initPromise: Promise<void>;

    private backend?: ChatBackendInitializationResult;

    constructor(private readonly context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(
                'acopilot-diff-preview',
                this.diffPreviewProvider
            )
        );

        this.initPromise = this.initializeBackend().catch((error) => {
            console.error('Failed to initialize backend:', error);
            throw error;
        });
    }

    private async initializeBackend(): Promise<void> {
        this.backend = await initializeChatBackend({
            context: this.context,
            onRetryStatus: (status) => this.handleRetryStatus(status),
            onTerminalOutputEvent: (event) => this.bridge.postHostEvent('terminalOutput', event),
            onImageGenOutputEvent: (event) => this.bridge.postHostEvent('imageGenOutput', event),
            onTaskEvent: (event) => this.bridge.postHostEvent('taskEvent', event),
            onDependencyProgressEvent: (event) => this.bridge.postHostEvent('dependencyProgress', event),
            getView: () => this.bridge.getView(),
            sendResponse: (requestId, data) => this.sendResponse(requestId, data),
            sendError: (requestId, code, message) => this.sendError(requestId, code, message)
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this.bridge.attachView(webviewView);
        this.smokeState.reset();

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: getChatWebviewLocalResourceRoots(this.context.extensionPath)
        };
        webviewView.webview.html = buildChatWebviewHtml({
            webview: webviewView.webview,
            extensionPath: this.context.extensionPath
        });

        webviewView.webview.onDidReceiveMessage(
            async (message: unknown) => {
                await this.handleMessage(message);
            },
            undefined,
            this.context.subscriptions
        );
    }

    private createHandlerContext(requestId: string): HandlerContext {
        const backend = this.requireBackend();

        return {
            context: this.context,
            view: this.bridge.getView(),
            configManager: backend.configManager,
            channelManager: backend.channelManager,
            conversationManager: backend.conversationManager,
            chatHandler: backend.chatHandler,
            modelsHandler: backend.modelsHandler,
            settingsManager: backend.settingsManager,
            settingsHandler: backend.settingsHandler,
            checkpointManager: backend.checkpointManager,
            mcpManager: backend.mcpManager,
            dependencyManager: backend.dependencyManager,
            storagePathManager: backend.storagePathManager,
            diffStorageManager: backend.diffStorageManager,
            streamAbortControllers: backend.messageRouter.getAbortManager() as any,
            diffPreviewProvider: this.diffPreviewProvider,
            sendResponse: (id, data) => this.sendResponse(id, data),
            sendError: (id, code, message) => this.sendError(id, code, message),
            getCurrentWorkspaceUri: () => this.getCurrentWorkspaceUri(),
            syncLanguageToBackend: () => this.syncLanguageToBackend()
        };
    }

    private async handleMessage(message: unknown): Promise<void> {
        const parsed = parseWebviewRequest(message);
        if (!parsed) {
            console.warn('Ignoring invalid webview message');
            return;
        }

        const { type, data, requestId } = parsed;

        try {
            if (type === 'webviewReady') {
                this.bridge.markReady();
                this.sendResponse(requestId, { success: true });
                return;
            }

            if (type === 'uiStateChanged') {
                this.smokeState.update(data);
                this.sendResponse(requestId, { success: true });
                return;
            }

            await this.initPromise;

            const handled = await this.requireBackend().messageRouter.route(
                type,
                data,
                requestId,
                this.createHandlerContext(requestId)
            );

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

    private handleRetryStatus(status: RetryStatus): void {
        this.bridge.postHostEvent('retryStatus', status);
    }

    private requireBackend(): ChatBackendInitializationResult {
        if (!this.backend) {
            throw new Error('Chat backend has not been initialized yet.');
        }

        return this.backend;
    }

    private syncLanguageToBackend(): void {
        try {
            const settings = this.requireBackend().settingsManager.getSettings();
            const language = settings.ui?.language || 'zh-CN';
            setBackendLanguage(language as SupportedLanguage);
        } catch (error) {
            console.error('Failed to sync language to backend:', error);
        }
    }

    private getCurrentWorkspaceUri(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder ? workspaceFolder.uri.toString() : null;
    }

    public cancelAllStreams(): void {
        this.backend?.messageRouter.cancelAllStreams();
        debugLog('All active streams cancelled');
    }

    public getSmokeStatus(): SmokeStatus {
        return this.smokeState.getStatus({
            viewResolved: !!this.bridge.getView(),
            webviewReady: this.bridge.isReady()
        });
    }

    public dispose(): void {
        this.cancelAllStreams();

        this.backend?.terminalOutputUnsubscribe();
        this.backend?.imageGenOutputUnsubscribe();
        this.backend?.taskEventUnsubscribe();
        this.backend?.dependencyProgressUnsubscribe();

        TaskManager.cancelAllTasks();
        this.backend?.mcpManager.dispose();
        this.diffPreviewProvider.dispose();

        debugLog('ChatViewProvider disposed');
    }

    private sendResponse(requestId: string, data: unknown): void {
        this.bridge.sendResponse(requestId, data);
    }

    private sendError(requestId: string, code: string, message: string): void {
        this.bridge.sendError(requestId, code, message);
    }

    public sendCommand(command: string, data?: unknown): void {
        this.bridge.sendCommand(command, data);
    }
}
