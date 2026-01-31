import * as vscode from 'vscode';

export function getWorkspaceRootPath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getAllWorkspaceRoots(): Array<{ name: string; path: string }> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return [];
    return folders.map(f => ({ name: f.name, path: f.uri.fsPath }));
}

export function getWorkspacePathByName(name: string): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return undefined;
    const folder = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
    return folder?.uri.fsPath;
}

