import * as vscode from 'vscode';
import type { DiffPreviewContentProvider as IDiffPreviewContentProvider } from './types';

export class DiffPreviewContentProvider implements vscode.TextDocumentContentProvider, IDiffPreviewContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this.onDidChangeEmitter.event;

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
