import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { getGlobalSettingsManager } from '../../../core/settingsContext';
import { t } from '../../../i18n';

import { OriginalContentProvider } from './OriginalContentProvider';
import { isSameFsPath } from './pathUtils';
import { closeDiffTab } from './diffTab';
import type { DiffSaveListener, DiffSettings, PendingDiff, StatusChangeListener } from './types';

let userInterruptFlag = false;

export class DiffManager {
    private static instance: DiffManager | null = null;

    private pendingDiffs: Map<string, PendingDiff> = new Map();
    private contentProvider: OriginalContentProvider;
    private providerDisposable: vscode.Disposable | null = null;
    private settings: DiffSettings = {
        autoSave: false,
        autoSaveDelay: 3000
    };
    private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();
    private statusListeners: Set<StatusChangeListener> = new Set();
    private saveCompleteListeners: Set<DiffSaveListener> = new Set();
    private saveListeners: Map<string, vscode.Disposable> = new Map();
    private closeListeners: Map<string, vscode.Disposable> = new Map();

    private constructor() {
        this.contentProvider = new OriginalContentProvider();
        this.providerDisposable = vscode.workspace.registerTextDocumentContentProvider(
            'gemini-diff-original',
            this.contentProvider
        );
    }

    public static getInstance(): DiffManager {
        if (!DiffManager.instance) {
            DiffManager.instance = new DiffManager();
        }
        return DiffManager.instance;
    }

    public updateSettings(settings: Partial<DiffSettings>): void {
        this.settings = { ...this.settings, ...settings };
    }

    public getSettings(): DiffSettings {
        const settingsManager = getGlobalSettingsManager();
        if (settingsManager) {
            const config = settingsManager.getApplyDiffConfig();
            return {
                autoSave: config.autoSave,
                autoSaveDelay: config.autoSaveDelay
            };
        }

        return { ...this.settings };
    }

    public addStatusListener(listener: StatusChangeListener): void {
        this.statusListeners.add(listener);
    }

    public removeStatusListener(listener: StatusChangeListener): void {
        this.statusListeners.delete(listener);
    }

    private notifyStatusChange(): void {
        const pending = this.getPendingDiffs();
        const allProcessed = this.areAllProcessed();
        for (const listener of this.statusListeners) {
            listener(pending, allProcessed);
        }
    }

    public addSaveCompleteListener(listener: DiffSaveListener): void {
        this.saveCompleteListeners.add(listener);
    }

    public removeSaveCompleteListener(listener: DiffSaveListener): void {
        this.saveCompleteListeners.delete(listener);
    }

    private notifySaveComplete(diff: PendingDiff): void {
        for (const listener of this.saveCompleteListeners) {
            listener(diff);
        }
    }

    public async createPendingDiff(
        filePath: string,
        absolutePath: string,
        originalContent: string,
        newContent: string,
        toolId?: string
    ): Promise<PendingDiff> {
        const id = `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const pendingDiff: PendingDiff = {
            id,
            toolId: toolId ? String(toolId) : undefined,
            filePath,
            absolutePath,
            originalContent,
            newContent,
            timestamp: Date.now(),
            status: 'pending'
        };

        this.pendingDiffs.set(id, pendingDiff);

        this.contentProvider.setContent(id, originalContent);
        await this.showDiffView(pendingDiff);

        // If VS Code auto-save happens before our listeners are attached, the diff could stay `pending`
        // forever. As a safety net, detect the on-disk content immediately after opening the editor.
        if (pendingDiff.status === 'pending') {
            try {
                const currentOnDisk = fs.readFileSync(pendingDiff.absolutePath, 'utf8');
                if (currentOnDisk === pendingDiff.newContent) {
                    pendingDiff.status = 'accepted';

                    const saveListener = this.saveListeners.get(pendingDiff.id);
                    if (saveListener) {
                        saveListener.dispose();
                        this.saveListeners.delete(pendingDiff.id);
                    }

                    const closeListener = this.closeListeners.get(pendingDiff.id);
                    if (closeListener) {
                        closeListener.dispose();
                        this.closeListeners.delete(pendingDiff.id);
                    }

                    this.cleanup(pendingDiff.id);
                    this.notifyStatusChange();
                    this.notifySaveComplete(pendingDiff);
                }
            } catch {
                // ignore
            }
        }

        const currentSettings = this.getSettings();
        if (currentSettings.autoSave) {
            this.scheduleAutoSave(id);
        }

        this.notifyStatusChange();

        return pendingDiff;
    }

    private async showDiffView(diff: PendingDiff): Promise<void> {
        const fileUri = vscode.Uri.file(diff.absolutePath);

        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document, {
            preview: false,
            preserveFocus: false
        });

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, diff.newContent);
        });

        const originalUri = vscode.Uri.parse(`gemini-diff-original:${diff.id}/${path.basename(diff.filePath)}`);

        const config = vscode.workspace.getConfiguration('diffEditor');
        await config.update('renderSideBySide', false, vscode.ConfigurationTarget.Global);

        const title = t('tools.file.diffManager.diffTitle', { filePath: diff.filePath });
        await vscode.commands.executeCommand('vscode.diff', originalUri, fileUri, title, {
            preview: false
        });

        const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (isSameFsPath(savedDoc.uri.fsPath, diff.absolutePath)) {
                diff.status = 'accepted';

                saveListener.dispose();
                this.saveListeners.delete(diff.id);

                const closeListener = this.closeListeners.get(diff.id);
                if (closeListener) {
                    closeListener.dispose();
                    this.closeListeners.delete(diff.id);
                }

                this.cleanup(diff.id);
                this.notifyStatusChange();
                this.notifySaveComplete(diff);
                vscode.window.showInformationMessage(t('tools.file.diffManager.saved', { filePath: diff.filePath }));

                const currentSettings = this.getSettings();
                if (!currentSettings.autoSave) {
                    await closeDiffTab(diff.absolutePath);
                }
            }
        });

        const closeListener = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
            if (isSameFsPath(closedDoc.uri.fsPath, diff.absolutePath) && diff.status === 'pending') {
                try {
                    const currentContent = fs.readFileSync(diff.absolutePath, 'utf8');
                    const wasAccepted = currentContent === diff.newContent;
                    diff.status = wasAccepted ? 'accepted' : 'rejected';
                    this.cleanup(diff.id);
                    this.notifyStatusChange();
                    if (wasAccepted) {
                        this.notifySaveComplete(diff);
                    }
                } catch {
                    // ignore
                }

                closeListener.dispose();
                this.closeListeners.delete(diff.id);

                const saveListener = this.saveListeners.get(diff.id);
                if (saveListener) {
                    saveListener.dispose();
                    this.saveListeners.delete(diff.id);
                }
            }
        });

        this.saveListeners.set(diff.id, saveListener);
        this.closeListeners.set(diff.id, closeListener);
    }

    private scheduleAutoSave(id: string): void {
        const existingTimer = this.autoSaveTimers.get(id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const currentSettings = this.getSettings();
        const timer = setTimeout(async () => {
            await this.acceptDiff(id, true);
            this.autoSaveTimers.delete(id);
        }, currentSettings.autoSaveDelay);

        this.autoSaveTimers.set(id, timer);
    }

    public async acceptDiff(id: string, closeTab: boolean = false): Promise<boolean> {
        const diff = this.pendingDiffs.get(id);
        if (!diff || diff.status !== 'pending') {
            return false;
        }

        try {
            const saveListener = this.saveListeners.get(id);
            if (saveListener) {
                saveListener.dispose();
                this.saveListeners.delete(id);
            }
            const closeListener = this.closeListeners.get(id);
            if (closeListener) {
                closeListener.dispose();
                this.closeListeners.delete(id);
            }

            const uri = vscode.Uri.file(diff.absolutePath);
            let doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === diff.absolutePath);

            if (!doc) {
                doc = await vscode.workspace.openTextDocument(uri);
            }

            const currentContent = doc.getText();
            if (currentContent !== diff.newContent) {
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    doc.positionAt(0),
                    doc.positionAt(currentContent.length)
                );
                edit.replace(uri, fullRange, diff.newContent);
                await vscode.workspace.applyEdit(edit);
            }

            const saved = await doc.save();

            if (!saved) {
                fs.writeFileSync(diff.absolutePath, diff.newContent, 'utf8');
            }

            diff.status = 'accepted';
            this.cleanup(id);
            this.notifyStatusChange();
            this.notifySaveComplete(diff);

            vscode.window.setStatusBarMessage(
                `$(check) ${t('tools.file.diffManager.savedShort', { filePath: diff.filePath })}`,
                3000
            );

            if (closeTab) {
                await closeDiffTab(diff.absolutePath);
            }

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                t('tools.file.diffManager.saveFailed', { error: error instanceof Error ? error.message : String(error) })
            );
            return false;
        }
    }

    public async rejectDiff(id: string): Promise<boolean> {
        const diff = this.pendingDiffs.get(id);
        if (!diff || diff.status !== 'pending') {
            return false;
        }

        diff.status = 'rejected';
        this.cleanup(id);
        this.notifyStatusChange();

        vscode.window.showInformationMessage(t('tools.file.diffManager.rejected', { filePath: diff.filePath }));

        return true;
    }

    public async acceptAll(): Promise<number> {
        let count = 0;
        for (const [id, diff] of this.pendingDiffs.entries()) {
            if (diff.status === 'pending') {
                const success = await this.acceptDiff(id);
                if (success) {
                    count++;
                }
            }
        }
        return count;
    }

    public async rejectAll(): Promise<number> {
        let count = 0;
        for (const [id, diff] of this.pendingDiffs.entries()) {
            if (diff.status === 'pending') {
                const success = await this.rejectDiff(id);
                if (success) {
                    count++;
                }
            }
        }
        return count;
    }

    private cleanup(id: string): void {
        const timer = this.autoSaveTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.autoSaveTimers.delete(id);
        }

        this.contentProvider.removeContent(id);

        const tempDir = path.join(os.tmpdir(), 'gemini-diff');
        const diff = this.pendingDiffs.get(id);
        if (diff) {
            const tempFilePath = path.join(tempDir, `${id}-${path.basename(diff.filePath)}`);
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    public getPendingDiffs(): PendingDiff[] {
        return Array.from(this.pendingDiffs.values()).filter(d => d.status === 'pending');
    }

    public getPendingDiffsByToolId(toolId: string): PendingDiff[] {
        const normalized = String(toolId || '').trim();
        if (!normalized) return [];

        return Array.from(this.pendingDiffs.values()).filter(d => d.status === 'pending' && d.toolId === normalized);
    }

    public areAllProcessed(): boolean {
        return this.getPendingDiffs().length === 0;
    }

    public waitForAllProcessed(): Promise<void> {
        return new Promise((resolve) => {
            if (this.areAllProcessed()) {
                resolve();
                return;
            }

            const listener: StatusChangeListener = (_pending, allProcessed) => {
                if (allProcessed) {
                    this.removeStatusListener(listener);
                    resolve();
                }
            };

            this.addStatusListener(listener);
        });
    }

    public markUserInterrupt(): void {
        userInterruptFlag = true;

        for (const timer of this.autoSaveTimers.values()) {
            clearTimeout(timer);
        }
        this.autoSaveTimers.clear();
    }

    public resetUserInterrupt(): void {
        userInterruptFlag = false;
    }

    public isUserInterrupted(): boolean {
        return userInterruptFlag;
    }

    public async cancelAllPending(): Promise<{ cancelled: PendingDiff[] }> {
        const cancelled: PendingDiff[] = [];

        for (const [id, diff] of this.pendingDiffs.entries()) {
            if (diff.status === 'pending') {
                diff.status = 'rejected';
                cancelled.push({ ...diff });
                this.cleanup(id);

                try {
                    const uri = vscode.Uri.file(diff.absolutePath);
                    const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === diff.absolutePath);
                    if (doc && doc.isDirty) {
                        const edit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            doc.positionAt(0),
                            doc.positionAt(doc.getText().length)
                        );
                        edit.replace(uri, fullRange, diff.originalContent);
                        await vscode.workspace.applyEdit(edit);
                    }
                } catch {
                    // ignore
                }
            }
        }

        if (cancelled.length > 0) {
            this.notifyStatusChange();
        }

        return { cancelled };
    }

    public getDiff(id: string): PendingDiff | undefined {
        return this.pendingDiffs.get(id);
    }

    public dispose(): void {
        for (const timer of this.autoSaveTimers.values()) {
            clearTimeout(timer);
        }
        this.autoSaveTimers.clear();

        for (const listener of this.saveListeners.values()) {
            listener.dispose();
        }
        this.saveListeners.clear();

        for (const listener of this.closeListeners.values()) {
            listener.dispose();
        }
        this.closeListeners.clear();

        if (this.providerDisposable) {
            this.providerDisposable.dispose();
        }

        DiffManager.instance = null;
    }
}

export function getDiffManager(): DiffManager {
    return DiffManager.getInstance();
}
