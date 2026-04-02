import * as vscode from 'vscode';
import { debugLog } from './backend/core/logger';
import { registerAcopilotCommands } from './extension/commandRegistration';
import { maybeRunSmokeHarness } from './extension/smokeHarness';
import { ChatViewProvider } from './webview/ChatViewProvider';

let chatViewProvider: ChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    debugLog('Acopilot extension is now active!');

    chatViewProvider = new ChatViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('acopilot.chatView', chatViewProvider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    registerAcopilotCommands(context, () => chatViewProvider);

    debugLog('Acopilot extension activated successfully!');

    void maybeRunSmokeHarness({
        getSmokeStatus: () => chatViewProvider?.getSmokeStatus()
    });
}

export function deactivate() {
    debugLog('Acopilot extension deactivating...');

    chatViewProvider?.dispose();
    chatViewProvider = undefined;

    debugLog('Acopilot extension deactivated');
}
