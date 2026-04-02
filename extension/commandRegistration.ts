import * as vscode from 'vscode';
import {
    revealAcopilotViewAndSendCommand,
    type AcopilotFrontendCommand
} from '../webview/viewEntry';
import {
    buildFileReferencePayload,
    buildSelectionReferencePayload,
    MAX_REFERENCE_PAYLOAD_CHARS
} from './payloadBuilders';

type CommandCapableProvider = {
    sendCommand(command: AcopilotFrontendCommand, data?: unknown): void;
};

export function registerAcopilotCommands(
    context: vscode.ExtensionContext,
    getChatViewProvider: () => CommandCapableProvider | undefined
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('acopilot.openChat', async () => {
            await revealChatView(getChatViewProvider, 'showChat');
        }),
        vscode.commands.registerCommand('acopilot.addSelectionToChat', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const payload = buildSelectionReferencePayload(editor, MAX_REFERENCE_PAYLOAD_CHARS);
            if (!payload) {
                vscode.window.showInformationMessage('请先选中一段代码/文本');
                return;
            }

            await revealChatView(getChatViewProvider, 'addSelectionToChat', payload);
        }),
        vscode.commands.registerCommand('acopilot.addFileToChat', async (resource?: unknown) => {
            const document = await resolveReferenceDocument(resource);
            if (!document) {
                return;
            }

            const payload = buildFileReferencePayload(document, MAX_REFERENCE_PAYLOAD_CHARS);
            if (!payload) {
                vscode.window.showInformationMessage('未能读取文件内容');
                return;
            }

            await revealChatView(getChatViewProvider, 'addSelectionToChat', payload);
        }),
        vscode.commands.registerCommand('acopilot.newChat', async () => {
            await revealChatView(getChatViewProvider, 'newChat');
        }),
        vscode.commands.registerCommand('acopilot.showHistory', async () => {
            await revealChatView(getChatViewProvider, 'showHistory');
        }),
        vscode.commands.registerCommand('acopilot.showSettings', async () => {
            await revealChatView(getChatViewProvider, 'showSettings');
        })
    );
}

async function revealChatView(
    getChatViewProvider: () => CommandCapableProvider | undefined,
    command: AcopilotFrontendCommand,
    data?: unknown
): Promise<void> {
    const provider = getChatViewProvider();
    const sendCommand = provider ? provider.sendCommand.bind(provider) : undefined;

    await revealAcopilotViewAndSendCommand(
        vscode.commands.executeCommand,
        sendCommand,
        command,
        data
    );
}

async function resolveReferenceDocument(resource?: unknown): Promise<vscode.TextDocument | undefined> {
    const uri = extractUri(resource);

    try {
        return uri
            ? await vscode.workspace.openTextDocument(uri)
            : vscode.window.activeTextEditor?.document;
    } catch {
        vscode.window.showInformationMessage('请选择一个可打开的文本文件');
        return undefined;
    }
}

function extractUri(resource?: unknown): vscode.Uri | undefined {
    if (resource instanceof vscode.Uri) {
        return resource;
    }

    if (Array.isArray(resource) && resource.length > 0 && resource[0] instanceof vscode.Uri) {
        return resource[0];
    }

    return undefined;
}
