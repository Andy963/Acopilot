/**
 * LimCode VSCode Extension 入口
 */

import * as vscode from 'vscode';
import { ChatViewProvider } from './webview/ChatViewProvider';

// 保存 ChatViewProvider 实例以便在停用时清理
let chatViewProvider: ChatViewProvider | undefined;

type SelectionReferencePayload = {
    uri: string;
    path: string;
    startLine: number;
    endLine: number;
    languageId: string;
    text: string;
    originalCharCount: number;
    truncated: boolean;
};

function buildSelectionReferencePayload(
    editor: vscode.TextEditor,
    maxChars: number
): SelectionReferencePayload | null {
    const nonEmptySelections = editor.selections.filter((s) => !s.isEmpty);
    if (nonEmptySelections.length === 0) return null;

    const selection = nonEmptySelections[0];
    const originalText = editor.document.getText(selection);
    const normalizedText = originalText.replace(/\r\n/g, '\n');

    const originalCharCount = normalizedText.length;
    const truncated = originalCharCount > maxChars;
    const text = truncated
        ? `${normalizedText.slice(0, maxChars)}\n…(truncated, original ${originalCharCount} chars)`
        : normalizedText;

    const start = selection.start;
    const end = selection.end;

    const startLine = start.line + 1;
    let endLine = end.line + 1;
    // 常见的“选中整行”会让 end 落在下一行的 column=0，此时不应把最后一行算进去
    if (end.character === 0 && end.line > start.line) {
        endLine = end.line;
    }

    const uri = editor.document.uri.toString();
    const path = vscode.workspace.asRelativePath(editor.document.uri, false);

    return {
        uri,
        path,
        startLine,
        endLine,
        languageId: editor.document.languageId,
        text,
        originalCharCount,
        truncated
    };
}

export function activate(context: vscode.ExtensionContext) {
    console.log('LimCode extension is now active!');

    // 注册聊天视图提供者
    chatViewProvider = new ChatViewProvider(context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'limcode.chatView',
            chatViewProvider,
            {
                // 保持 webview 状态，切换视图时不销毁
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // 注册命令：打开聊天面板
    context.subscriptions.push(
        vscode.commands.registerCommand('limcode.openChat', () => {
            vscode.commands.executeCommand('limcode.chatView.focus');
        })
    );

    // 注册命令：把选中内容添加到聊天引用（类似 Copilot 的 Add Selection to Chat）
    context.subscriptions.push(
        vscode.commands.registerCommand('limcode.addSelectionToChat', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const payload = buildSelectionReferencePayload(editor, 12000);
            if (!payload) {
                vscode.window.showInformationMessage('请先选中一段代码/文本');
                return;
            }

            await vscode.commands.executeCommand('limcode.chatView.focus');
            chatViewProvider?.sendCommand('addSelectionToChat', payload);
        })
    );

    // 注册命令：新建对话
    context.subscriptions.push(
        vscode.commands.registerCommand('limcode.newChat', () => {
            chatViewProvider.sendCommand('newChat');
        })
    );

    // 注册命令：显示历史
    context.subscriptions.push(
        vscode.commands.registerCommand('limcode.showHistory', () => {
            chatViewProvider.sendCommand('showHistory');
        })
    );

    // 注册命令：显示设置
    context.subscriptions.push(
        vscode.commands.registerCommand('limcode.showSettings', () => {
            chatViewProvider.sendCommand('showSettings');
        })
    );

    console.log('LimCode extension activated successfully!');
}

export function deactivate() {
    console.log('LimCode extension deactivating...');
    
    // 清理 ChatViewProvider 资源（取消所有流式请求、断开 MCP 连接等）
    if (chatViewProvider) {
        chatViewProvider.dispose();
        chatViewProvider = undefined;
    }
    
    console.log('LimCode extension deactivated');
}
