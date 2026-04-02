import type * as vscode from 'vscode';

export class ChatViewBridge {
  private view?: vscode.WebviewView;
  private webviewReady = false;
  private pendingCommands: unknown[] = [];

  attachView(view: vscode.WebviewView): void {
    this.view = view;
    this.webviewReady = false;
  }

  getView(): vscode.WebviewView | undefined {
    return this.view;
  }

  isReady(): boolean {
    return this.webviewReady;
  }

  markReady(): void {
    this.webviewReady = true;
    this.flushPendingCommands();
  }

  postHostEvent(type: string, data: unknown): void {
    this.view?.webview.postMessage({
      type,
      data,
    });
  }

  sendResponse(requestId: string, data: unknown): void {
    this.view?.webview.postMessage({
      type: 'response',
      requestId,
      success: true,
      data,
    });
  }

  sendError(requestId: string, code: string, message: string): void {
    this.view?.webview.postMessage({
      type: 'error',
      requestId,
      success: false,
      error: {
        code,
        message,
      },
    });
  }

  sendCommand(command: string, data?: unknown): void {
    const message = {
      type: 'command',
      command,
      data,
    };

    if (this.view?.webview && this.webviewReady) {
      this.view.webview.postMessage(message);
      return;
    }

    this.pendingCommands.push(message);
    if (this.pendingCommands.length > 200) {
      this.pendingCommands.shift();
    }
  }

  private flushPendingCommands(): void {
    if (!this.view?.webview || !this.webviewReady) {
      return;
    }

    const pendingCommands = this.pendingCommands.splice(0);
    for (const message of pendingCommands) {
      this.view.webview.postMessage(message);
    }
  }
}

