/**
 * 上下文感知和诊断信息消息处理器
 */

import * as vscode from 'vscode';
import { t } from '../../backend/i18n';
import { getWorkspaceFileTree } from '../../backend/modules/prompt/fileTree';
import type { ContextAwarenessConfig } from '../../backend/modules/settings/settingsTypes/contextAwareness';
import type { DiagnosticSeverity } from '../../backend/modules/settings/settingsTypes/diagnostics';
import type { MessageHandler } from '../types';
import { shouldIgnorePath } from '../utils/WorkspaceUtils';

type WorkspaceDiagnosticPreview = Array<{
  file: string;
  diagnostics: Array<{
    line: number;
    column: number;
    severity: DiagnosticSeverity;
    message: string;
    source?: string;
    code?: string | number;
  }>;
}>;

function estimateTokensFromChars(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.max(1, Math.ceil(chars / 4));
}

function truncateText(text: string, maxChars: number): { preview: string; charCount: number; truncated: boolean } {
  const safeText = text || '';
  return {
    preview: safeText.length > maxChars ? safeText.slice(0, maxChars) : safeText,
    charCount: safeText.length,
    truncated: safeText.length > maxChars
  };
}

async function collectWorkspaceFiles(limit = 5000): Promise<string[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return [];

  const uris = await vscode.workspace.findFiles('**/*', undefined, limit);
  return uris
    .filter(uri => vscode.workspace.getWorkspaceFolder(uri))
    .map(uri => vscode.workspace.asRelativePath(uri, false))
    .sort((a, b) => a.localeCompare(b));
}

function getDiagnosticsPreview(config: NonNullable<ContextAwarenessConfig['diagnostics']>): WorkspaceDiagnosticPreview {
  if (!config.enabled) return [];

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return [];

  const severityMap: Record<vscode.DiagnosticSeverity, DiagnosticSeverity> = {
    [vscode.DiagnosticSeverity.Error]: 'error',
    [vscode.DiagnosticSeverity.Warning]: 'warning',
    [vscode.DiagnosticSeverity.Information]: 'information',
    [vscode.DiagnosticSeverity.Hint]: 'hint'
  };

  const openFileUris = new Set<string>();
  if (config.openFilesOnly) {
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          openFileUris.add(tab.input.uri.toString());
        }
      }
    }
  }

  const result: WorkspaceDiagnosticPreview = [];
  let fileCount = 0;

  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    if (config.maxFiles !== -1 && fileCount >= config.maxFiles) break;
    if (config.workspaceOnly && !vscode.workspace.getWorkspaceFolder(uri)) continue;
    if (config.openFilesOnly && !openFileUris.has(uri.toString())) continue;

    const filteredDiagnostics = diagnostics
      .filter(d => config.includeSeverities.includes(severityMap[d.severity]))
      .slice(0, config.maxDiagnosticsPerFile === -1 ? undefined : config.maxDiagnosticsPerFile)
      .map(d => ({
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        severity: severityMap[d.severity],
        message: d.message,
        source: d.source,
        code: typeof d.code === 'object' ? d.code.value : d.code
      }));

    if (filteredDiagnostics.length > 0) {
      result.push({
        file: vscode.workspace.asRelativePath(uri, false),
        diagnostics: filteredDiagnostics
      });
      fileCount++;
    }
  }

  return result;
}

function diagnosticsToText(diagnostics: WorkspaceDiagnosticPreview): string {
  return diagnostics
    .map(file => {
      const lines = file.diagnostics.map(d => `  Line ${d.line}: [${d.severity}] ${d.message}${d.source ? ` (${d.source})` : ''}`);
      return `${file.file}:\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * 获取上下文感知配置
 */
export const getContextAwarenessConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getContextAwarenessConfig();
    ctx.sendResponse(requestId, config);
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_CONTEXT_AWARENESS_CONFIG_ERROR', error.message || t('webview.errors.getContextAwarenessConfigFailed'));
  }
};

/**
 * 更新上下文感知配置
 */
export const updateContextAwarenessConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { config } = data;
    await ctx.settingsManager.updateContextAwarenessConfig(config);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'UPDATE_CONTEXT_AWARENESS_CONFIG_ERROR', error.message || t('webview.errors.updateContextAwarenessConfigFailed'));
  }
};

/**
 * 获取 Context Inspector 预览数据
 */
export const getContextInspectorData: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { conversationId, configId, chatMode, attachments, selectionReferences, contextOverrides } = data || {};
    const result = await ctx.chatHandler.handleGetContextInspectorData({
      conversationId,
      configId,
      chatMode,
      attachments,
      selectionReferences,
      contextOverrides
    });
    ctx.sendResponse(requestId, result);
  } catch (error: any) {
    ctx.sendError(
      requestId,
      'GET_CONTEXT_INSPECTOR_DATA_ERROR',
      error.message || t('webview.errors.getContextAwarenessConfigFailed')
    );
  }
};

/**
 * 获取 Context 设置预览统计
 */
export const getContextSettingsPreview: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getContextAwarenessConfig();
    const ignorePatterns = config.ignorePatterns || [];

    const workspaceTreeText = config.includeWorkspaceFiles
      ? getWorkspaceFileTree(config.maxFileDepth === -1 ? 100 : config.maxFileDepth, ignorePatterns)
      : '';
    const workspaceTree = truncateText(workspaceTreeText, 12000);

    const diagnostics = getDiagnosticsPreview(ctx.settingsManager.getDiagnosticsConfig() as NonNullable<ContextAwarenessConfig['diagnostics']>);
    const diagnosticsText = diagnosticsToText(diagnostics);
    const diagnosticsPreview = truncateText(diagnosticsText, 12000);

    const allWorkspaceFiles = await collectWorkspaceFiles();
    const ignoredFiles = allWorkspaceFiles.filter(file => shouldIgnorePath(file, ignorePatterns));
    const ignoreSamplesByPattern = ignorePatterns.slice(0, 20).map(pattern => {
      const matches = allWorkspaceFiles.filter(file => shouldIgnorePath(file, [pattern]));
      return {
        pattern,
        count: matches.length,
        samples: matches.slice(0, 5)
      };
    });

    ctx.sendResponse(requestId, {
      workspaceFiles: {
        preview: workspaceTree.preview,
        charCount: workspaceTree.charCount,
        estimatedTokens: estimateTokensFromChars(workspaceTree.charCount),
        truncated: workspaceTree.truncated,
        lineCount: workspaceTreeText ? workspaceTreeText.split('\n').filter(Boolean).length : 0
      },
      diagnostics: {
        files: diagnostics.length,
        items: diagnostics.reduce((sum, file) => sum + file.diagnostics.length, 0),
        preview: diagnosticsPreview.preview,
        charCount: diagnosticsPreview.charCount,
        estimatedTokens: estimateTokensFromChars(diagnosticsPreview.charCount),
        truncated: diagnosticsPreview.truncated
      },
      ignorePatterns: {
        scannedFiles: allWorkspaceFiles.length,
        matchedFiles: ignoredFiles.length,
        samples: ignoredFiles.slice(0, 10),
        byPattern: ignoreSamplesByPattern
      }
    });
  } catch (error: any) {
    ctx.sendError(
      requestId,
      'GET_CONTEXT_SETTINGS_PREVIEW_ERROR',
      error.message || t('webview.errors.getContextAwarenessConfigFailed')
    );
  }
};

/**
 * 获取打开的标签页
 */
export const getOpenTabs: MessageHandler = async (data, requestId, ctx) => {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      ctx.sendResponse(requestId, { tabs: [] });
      return;
    }
    
    const tabs: string[] = [];
    const ignorePatterns = ctx.settingsManager.getContextIgnorePatterns();
    
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          const uri = tab.input.uri;
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
          if (workspaceFolder) {
            const relativePath = vscode.workspace.asRelativePath(uri, false);
            if (!shouldIgnorePath(relativePath, ignorePatterns)) {
              tabs.push(relativePath);
            }
          }
        }
      }
    }
    
    ctx.sendResponse(requestId, { tabs: [...new Set(tabs)] });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_OPEN_TABS_ERROR', error.message || t('webview.errors.getOpenTabsFailed'));
  }
};

/**
 * 获取活动编辑器
 */
export const getActiveEditor: MessageHandler = async (data, requestId, ctx) => {
  try {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      ctx.sendResponse(requestId, { path: null });
      return;
    }
    
    const uri = activeEditor.document.uri;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    
    if (!workspaceFolder) {
      ctx.sendResponse(requestId, { path: null });
      return;
    }
    
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const ignorePatterns = ctx.settingsManager.getContextIgnorePatterns();
    
    if (shouldIgnorePath(relativePath, ignorePatterns)) {
      ctx.sendResponse(requestId, { path: null });
      return;
    }
    
    ctx.sendResponse(requestId, { path: relativePath });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_ACTIVE_EDITOR_ERROR', error.message || t('webview.errors.getActiveEditorFailed'));
  }
};

/**
 * 获取诊断配置
 */
export const getDiagnosticsConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getDiagnosticsConfig();
    ctx.sendResponse(requestId, config);
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_DIAGNOSTICS_CONFIG_ERROR', error.message || t('webview.errors.getDiagnosticsConfigFailed'));
  }
};

/**
 * 更新诊断配置
 */
export const updateDiagnosticsConfig: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { config } = data;
    await ctx.settingsManager.updateDiagnosticsConfig(config);
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'UPDATE_DIAGNOSTICS_CONFIG_ERROR', error.message || t('webview.errors.updateDiagnosticsConfigFailed'));
  }
};

/**
 * 获取工作区诊断信息
 */
export const getWorkspaceDiagnostics: MessageHandler = async (data, requestId, ctx) => {
  try {
    const config = ctx.settingsManager.getDiagnosticsConfig();
    
    if (!config.enabled) {
      ctx.sendResponse(requestId, { diagnostics: [] });
      return;
    }
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      ctx.sendResponse(requestId, { diagnostics: [] });
      return;
    }
    
    const allDiagnostics = vscode.languages.getDiagnostics();
    
    const severityMap: Record<vscode.DiagnosticSeverity, 'error' | 'warning' | 'information' | 'hint'> = {
      [vscode.DiagnosticSeverity.Error]: 'error',
      [vscode.DiagnosticSeverity.Warning]: 'warning',
      [vscode.DiagnosticSeverity.Information]: 'information',
      [vscode.DiagnosticSeverity.Hint]: 'hint'
    };
    
    const openFileUris = new Set<string>();
    if (config.openFilesOnly) {
      for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          if (tab.input instanceof vscode.TabInputText) {
            openFileUris.add(tab.input.uri.toString());
          }
        }
      }
    }
    
    const result: Array<{
      file: string;
      diagnostics: Array<{
        line: number;
        column: number;
        severity: 'error' | 'warning' | 'information' | 'hint';
        message: string;
        source?: string;
        code?: string | number;
      }>;
    }> = [];
    
    let fileCount = 0;
    
    for (const [uri, diagnostics] of allDiagnostics) {
      if (config.maxFiles !== -1 && fileCount >= config.maxFiles) {
        break;
      }
      
      if (config.workspaceOnly) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
          continue;
        }
      }
      
      if (config.openFilesOnly && !openFileUris.has(uri.toString())) {
        continue;
      }
      
      const filteredDiagnostics = diagnostics
        .filter(d => {
          const severity = severityMap[d.severity];
          return config.includeSeverities.includes(severity);
        })
        .slice(0, config.maxDiagnosticsPerFile === -1 ? undefined : config.maxDiagnosticsPerFile)
        .map(d => ({
          line: d.range.start.line + 1,
          column: d.range.start.character + 1,
          severity: severityMap[d.severity],
          message: d.message,
          source: d.source,
          code: typeof d.code === 'object' ? d.code.value : d.code
        }));
      
      if (filteredDiagnostics.length > 0) {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        result.push({
          file: relativePath,
          diagnostics: filteredDiagnostics
        });
        fileCount++;
      }
    }
    
    ctx.sendResponse(requestId, { diagnostics: result });
  } catch (error: any) {
    ctx.sendError(requestId, 'GET_WORKSPACE_DIAGNOSTICS_ERROR', error.message || t('webview.errors.getWorkspaceDiagnosticsFailed'));
  }
};

/**
 * 注册上下文处理器
 */
export function registerContextHandlers(registry: Map<string, MessageHandler>): void {
  registry.set('getContextAwarenessConfig', getContextAwarenessConfig);
  registry.set('updateContextAwarenessConfig', updateContextAwarenessConfig);
  registry.set('getContextInspectorData', getContextInspectorData);
  registry.set('getContextSettingsPreview', getContextSettingsPreview);
  registry.set('getOpenTabs', getOpenTabs);
  registry.set('getActiveEditor', getActiveEditor);
  registry.set('getDiagnosticsConfig', getDiagnosticsConfig);
  registry.set('updateDiagnosticsConfig', updateDiagnosticsConfig);
  registry.set('getWorkspaceDiagnostics', getWorkspaceDiagnostics);
}
