import * as vscode from 'vscode';

export async function closeDiffTab(filePath: string): Promise<void> {
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            if (tab.input instanceof vscode.TabInputTextDiff) {
                const diffInput = tab.input as vscode.TabInputTextDiff;
                if (diffInput.modified.fsPath === filePath) {
                    await vscode.window.tabGroups.close(tab);
                    return;
                }
            }
        }
    }
}

