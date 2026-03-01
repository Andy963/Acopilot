import * as vscode from 'vscode';

export class OriginalContentProvider implements vscode.TextDocumentContentProvider {
    private contents: Map<string, string> = new Map();
    private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

    public onDidChange = this.onDidChangeEmitter.event;

    public setContent(id: string, content: string): void {
        this.contents.set(id, content);
    }

    public removeContent(id: string): void {
        this.contents.delete(id);
    }

    public provideTextDocumentContent(uri: vscode.Uri): string {
        const id = uri.path.split('/')[0];
        return this.contents.get(id) || '';
    }
}

