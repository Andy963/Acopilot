import * as vscode from 'vscode';
import * as path from 'path';
import type { SupportedLanguage } from '../backend/i18n';
import { setLanguage as setBackendLanguage } from '../backend/i18n';
import { debugLog } from '../backend/core/logger';
import {
  ConversationManager,
  DiffStorageManager,
  FileSystemStorageAdapter
} from '../backend/modules/conversation';
import { ConfigManager, MementoStorageAdapter } from '../backend/modules/config';
import { ChannelManager } from '../backend/modules/channel';
import { ChatHandler } from '../backend/modules/api/chat';
import { ModelsHandler } from '../backend/modules/api/models';
import { SettingsManager, FileSettingsStorage, StoragePathManager } from '../backend/modules/settings';
import { SettingsHandler } from '../backend/modules/api/settings';
import { CheckpointManager } from '../backend/modules/checkpoint';
import { McpManager, VSCodeFileSystemMcpStorageAdapter } from '../backend/modules/mcp';
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
import { MessageRouter } from './MessageRouter';

export type RetryStatus = {
  type: 'retrying' | 'retrySuccess' | 'retryFailed';
  attempt: number;
  maxAttempts: number;
  error?: string;
  nextRetryIn?: number;
};

export type ChatBackendInitializationResult = {
  configManager: ConfigManager;
  channelManager: ChannelManager;
  conversationManager: ConversationManager;
  chatHandler: ChatHandler;
  modelsHandler: ModelsHandler;
  settingsManager: SettingsManager;
  settingsHandler: SettingsHandler;
  checkpointManager: CheckpointManager;
  mcpManager: McpManager;
  dependencyManager: DependencyManager;
  storagePathManager: StoragePathManager;
  diffStorageManager: DiffStorageManager;
  messageRouter: MessageRouter;
  terminalOutputUnsubscribe: () => void;
  imageGenOutputUnsubscribe: () => void;
  taskEventUnsubscribe: () => void;
  dependencyProgressUnsubscribe: () => void;
};

export async function initializeChatBackend(params: {
  context: vscode.ExtensionContext;
  onRetryStatus: (status: RetryStatus) => void;
  onTerminalOutputEvent: (event: TerminalOutputEvent) => void;
  onImageGenOutputEvent: (event: ImageGenOutputEvent) => void;
  onTaskEvent: (event: TaskEvent) => void;
  onDependencyProgressEvent: (event: InstallProgressEvent) => void;
  getView: () => vscode.WebviewView | undefined;
  sendResponse: (requestId: string, data: unknown) => void;
  sendError: (requestId: string, code: string, message: string) => void;
}): Promise<ChatBackendInitializationResult> {
  const settingsStorageDir = path.join(params.context.globalStorageUri.fsPath, 'settings');
  const settingsStorage = new FileSettingsStorage(settingsStorageDir);
  const settingsManager = new SettingsManager(settingsStorage);
  await settingsManager.initialize();

  const storagePathManager = new StoragePathManager(settingsManager, params.context);
  await storagePathManager.ensureDirectories();

  const effectiveDataUri = storagePathManager.getEffectiveDataUri();
  const storageAdapter = new FileSystemStorageAdapter(vscode, effectiveDataUri);

  const diffStorageManager = DiffStorageManager.initialize(storagePathManager.getEffectiveDataPath());
  setGlobalDiffStorageManager(diffStorageManager);

  const conversationManager = new ConversationManager(storageAdapter);

  const configStorage = new MementoStorageAdapter(params.context.globalState, 'acopilot.configs');
  const configManager = new ConfigManager(configStorage, params.context.secrets);

  await ensureDefaultConfig(configManager, settingsManager);
  syncLanguageToBackend(settingsManager);

  setGlobalSettingsManager(settingsManager);
  setGlobalConfigManager(configManager);
  setGlobalToolRegistry(toolRegistry);

  registerAllTools(toolRegistry);

  const channelManager = new ChannelManager(configManager, toolRegistry, settingsManager);
  channelManager.setRetryStatusCallback(params.onRetryStatus);
  setGlobalChannelManager(channelManager);

  const checkpointManager = new CheckpointManager(
    settingsManager,
    conversationManager,
    params.context,
    storagePathManager.getEffectiveDataPath()
  );
  await checkpointManager.initialize();

  const chatHandler = new ChatHandler(configManager, channelManager, conversationManager, toolRegistry);
  chatHandler.setCheckpointManager(checkpointManager);
  chatHandler.setSettingsManager(settingsManager);
  chatHandler.setDiffStorageManager(diffStorageManager);

  const modelsHandler = new ModelsHandler(configManager);
  const settingsHandler = new SettingsHandler(settingsManager, toolRegistry);

  const terminalOutputUnsubscribe = onTerminalOutput(params.onTerminalOutputEvent);
  const imageGenOutputUnsubscribe = onImageGenOutput(params.onImageGenOutputEvent);
  const taskEventUnsubscribe = TaskManager.onTaskEvent(params.onTaskEvent);

  const mcpConfigDir = vscode.Uri.file(storagePathManager.getMcpPath());
  try {
    await vscode.workspace.fs.stat(mcpConfigDir);
  } catch {
    await vscode.workspace.fs.createDirectory(mcpConfigDir);
  }
  const mcpConfigFile = vscode.Uri.joinPath(mcpConfigDir, 'servers.json');
  const mcpStorage = new VSCodeFileSystemMcpStorageAdapter(mcpConfigFile, vscode.workspace.fs);
  const mcpManager = new McpManager(mcpStorage, params.context.secrets);
  await mcpManager.initialize();

  channelManager.setMcpManager(mcpManager);
  chatHandler.setMcpManager(mcpManager);

  const dependencyManager = DependencyManager.getInstance(params.context, storagePathManager.getDependenciesPath());
  await dependencyManager.initialize();

  toolRegistry.setDependencyChecker({
    isInstalled: (name: string) => dependencyManager.isInstalledSync(name)
  });

  const dependencyProgressUnsubscribe = dependencyManager.onProgress(params.onDependencyProgressEvent);

  const messageRouter = new MessageRouter(
    chatHandler,
    params.getView,
    params.sendResponse,
    params.sendError
  );

  debugLog('Acopilot backend initialized with global context');
  debugLog('Effective data path:', storagePathManager.getEffectiveDataPath());

  return {
    configManager,
    channelManager,
    conversationManager,
    chatHandler,
    modelsHandler,
    settingsManager,
    settingsHandler,
    checkpointManager,
    mcpManager,
    dependencyManager,
    storagePathManager,
    diffStorageManager,
    messageRouter,
    terminalOutputUnsubscribe,
    imageGenOutputUnsubscribe,
    taskEventUnsubscribe,
    dependencyProgressUnsubscribe
  };
}

async function ensureDefaultConfig(configManager: ConfigManager, settingsManager: SettingsManager): Promise<void> {
  try {
    const existingConfigs = await configManager.listConfigs();
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

      const storage = (configManager as any).storageAdapter;
      await storage.save(config);

      (configManager as any).loaded = false;
    }

    const configs = await configManager.listConfigs();
    if (configs.length > 0) {
      const activeId = settingsManager.getActiveChannelId();
      const activeExists = !!activeId && configs.some(c => c.id === activeId);
      if (!activeExists) {
        await settingsManager.setActiveChannelId(configs[0].id);
      }
    }
  } catch (error) {
    console.error('Failed to ensure default config:', error);
  }
}

function syncLanguageToBackend(settingsManager: SettingsManager): void {
  try {
    const settings = settingsManager.getSettings();
    const language = settings.ui?.language || 'zh-CN';
    setBackendLanguage(language as SupportedLanguage);
  } catch (error) {
    console.error('Failed to sync language to backend:', error);
  }
}

