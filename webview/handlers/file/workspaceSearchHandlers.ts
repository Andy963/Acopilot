import * as vscode from 'vscode';
import * as path from 'path';
import { t } from '../../../backend/i18n';
import type { MessageHandler } from '../../types';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  '.vscode',
  '.idea',
  '__pycache__',
  '.cache',
  'coverage'
]);

async function searchDirectories(
  baseUri: vscode.Uri,
  query: string,
  limit: number,
  results: { path: string; name: string; isDirectory: boolean }[],
  currentPath = ''
): Promise<void> {
  if (results.length >= limit) return;

  try {
    const entries = await vscode.workspace.fs.readDirectory(baseUri);

    for (const [name, type] of entries) {
      if (results.length >= limit) break;
      if (EXCLUDED_DIRS.has(name)) continue;

      const relativePath = currentPath ? `${currentPath}/${name}` : name;

      if (type === vscode.FileType.Directory) {
        if (!query || name.toLowerCase().includes(query.toLowerCase())) {
          results.push({ path: relativePath, name, isDirectory: true });
        }

        // Limit recursion depth to avoid scanning extremely large workspaces.
        if (relativePath.split('/').length < 5) {
          await searchDirectories(vscode.Uri.joinPath(baseUri, name), query, limit, results, relativePath);
        }
      }
    }
  } catch {
    // ignore
  }
}

export const searchWorkspaceFiles: MessageHandler = async (data, requestId, ctx) => {
  try {
    const { query = '', limit = 50 } = data;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      ctx.sendResponse(requestId, { files: [] });
      return;
    }

    const results: { path: string; name: string; isDirectory: boolean }[] = [];

    await searchDirectories(workspaceFolder.uri, String(query).trim(), Math.floor(limit / 2), results);

    const trimmedQuery = String(query).trim();
    const pattern = trimmedQuery ? `**/*${trimmedQuery}*` : '**/*';
    const excludePattern =
      '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/out/**,**/.vscode/**,**/.idea/**,**/__pycache__/**,**/.cache/**,**/coverage/**}';

    const files = await vscode.workspace.findFiles(pattern, excludePattern, limit - results.length);

    for (const uri of files) {
      if (results.length >= limit) break;
      const relativePath = vscode.workspace.asRelativePath(uri);
      results.push({ path: relativePath, name: path.basename(uri.fsPath), isDirectory: false });
    }

    results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.path.length - b.path.length;
    });

    ctx.sendResponse(requestId, { files: results });
  } catch (error: any) {
    ctx.sendError(requestId, 'SEARCH_FILES_ERROR', error.message || t('webview.errors.searchFilesFailed'));
  }
};

