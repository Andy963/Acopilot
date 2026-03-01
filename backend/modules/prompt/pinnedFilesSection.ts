import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getGlobalSettingsManager } from '../../core/settingsContext';

export function generatePinnedFilesSection(): string {
  const settingsManager = getGlobalSettingsManager();
  if (!settingsManager) {
    return '';
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return '';
  }

  const results: string[] = [];

  for (const workspaceFolder of workspaceFolders) {
    const workspaceUri = workspaceFolder.uri.toString();
    const pinnedFiles = settingsManager.getEnabledPinnedFilesForWorkspace(workspaceUri);

    for (const pinnedFile of pinnedFiles) {
      try {
        const filePath = pinnedFile.path;
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(workspaceFolder.uri.fsPath, filePath);

        if (!fs.existsSync(fullPath)) {
          continue;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');

        const displayPath = workspaceFolders.length > 1
          ? `${workspaceFolder.name}/${pinnedFile.path}`
          : pinnedFile.path;

        results.push(`--- ${displayPath} ---\n${content}`);
      } catch (error: any) {
        // Best-effort: pinned files are optional.
        console.warn(`Failed to read pinned file ${pinnedFile.path}:`, error.message);
      }
    }
  }

  if (results.length === 0) {
    return '';
  }

  return `The following are pinned files that should be read and considered for every response:\n\n${results.join('\n\n')}`;
}

