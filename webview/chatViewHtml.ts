import * as path from 'path';
import * as vscode from 'vscode';
import { readFrontendBuildAssets, resolveFrontendAssetFsPath } from './utils';

export function getChatWebviewLocalResourceRoots(extensionPath: string): vscode.Uri[] {
  return [
    vscode.Uri.file(path.join(extensionPath, 'frontend', 'dist')),
    vscode.Uri.file(path.join(extensionPath, 'resources', 'codicons')),
  ];
}

export function buildChatWebviewHtml(params: {
  webview: vscode.Webview;
  extensionPath: string;
}): string {
  const nonce = getNonce();
  const distDir = path.join(params.extensionPath, 'frontend', 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  const fallbackScriptPath = path.join(distDir, 'index.js');
  const fallbackStylePath = path.join(distDir, 'index.css');
  let scriptUris = [params.webview.asWebviewUri(vscode.Uri.file(fallbackScriptPath))];
  let styleUris = [params.webview.asWebviewUri(vscode.Uri.file(fallbackStylePath))];

  try {
    const assets = readFrontendBuildAssets(indexHtmlPath);
    if (assets.scriptPaths.length > 0) {
      scriptUris = assets.scriptPaths.map((assetPath) =>
        params.webview.asWebviewUri(vscode.Uri.file(resolveFrontendAssetFsPath(distDir, assetPath))),
      );
    }
    if (assets.stylePaths.length > 0) {
      styleUris = assets.stylePaths.map((assetPath) =>
        params.webview.asWebviewUri(vscode.Uri.file(resolveFrontendAssetFsPath(distDir, assetPath))),
      );
    }
  } catch (error) {
    console.warn('Failed to resolve frontend build assets from dist/index.html, using fallback asset names.', error);
  }

  const codiconsUri = params.webview.asWebviewUri(
    vscode.Uri.file(path.join(params.extensionPath, 'resources', 'codicons', 'codicon.css')),
  );
  const styleLinks = styleUris.map((styleUri) => `<link href="${styleUri}" rel="stylesheet">`).join('\n    ');
  const scriptTags = scriptUris
    .map((scriptUri) => `<script nonce="${nonce}" src="${scriptUri}"></script>`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${params.webview.cspSource} 'unsafe-inline'; font-src ${params.webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${params.webview.cspSource} data: blob:; media-src ${params.webview.cspSource} data: blob:;">
    <link href="${codiconsUri}" rel="stylesheet">
    ${styleLinks}
    <title>Acopilot Chat</title>
</head>
<body>
    <div id="app"></div>
    ${scriptTags}
</body>
</html>`;
}

function getNonce(length: number = 32): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < length; index += 1) {
    nonce += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return nonce;
}
