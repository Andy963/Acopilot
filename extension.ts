/**
 * LimCode VSCode Extension 入口
 */

import * as vscode from 'vscode';
import { ChatViewProvider } from './webview/ChatViewProvider';

// 保存 ChatViewProvider 实例以便在停用时清理
let chatViewProvider: ChatViewProvider | undefined;

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