import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as nodePath from 'node:path';
import * as vscode from 'vscode';
import type { SmokeStatus } from '../webview/chatViewSmokeState';

const DEFAULT_SMOKE_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 250;
const SMOKE_EXTENSION_ID = 'Andy963.acopilot';
const SMOKE_VIEW_ID = 'acopilot.chatView';
const SMOKE_WORKSPACE_FILE = 'extension.ts';

type SmokeHarnessConfig = {
    markerPath: string;
    outputPath: string;
    timeoutMs: number;
    workspacePath: string;
    expectedSource: 'development' | 'vsix' | null;
    expectedExtensionPathPrefix: string | null;
};

type SmokeExtensionState = {
    extensionId: string;
    extensionPath: string;
    extensionVersion: string;
    expectedSource: 'development' | 'vsix' | null;
    expectedExtensionPathPrefix: string | null;
    pathMatchesExpectation: boolean;
};

type SmokeHarnessParams = {
    getSmokeStatus: () => SmokeStatus | undefined;
};

export async function maybeRunSmokeHarness(params: SmokeHarnessParams): Promise<void> {
    const smokeConfig = await loadSmokeHarnessConfig();
    if (!smokeConfig) {
        return;
    }

    await runSmokeHarness(smokeConfig, params);
}

async function loadSmokeHarnessConfig(): Promise<SmokeHarnessConfig | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder || workspaceFolder.uri.scheme !== 'file') {
        return undefined;
    }

    const markerPath = nodePath.join(workspaceFolder.uri.fsPath, '.acopilot-smoke.json');

    try {
        const content = await readFile(markerPath, 'utf8');
        const parsed = JSON.parse(content);
        const outputPath = typeof parsed.outputPath === 'string' ? parsed.outputPath.trim() : '';
        const timeoutMs = typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0
            ? parsed.timeoutMs
            : DEFAULT_SMOKE_TIMEOUT_MS;
        const expectedSource = parsed.expectedSource === 'development' || parsed.expectedSource === 'vsix'
            ? parsed.expectedSource
            : null;
        const expectedExtensionPathPrefix = typeof parsed.expectedExtensionPathPrefix === 'string'
            ? parsed.expectedExtensionPathPrefix.trim() || null
            : null;

        if (!outputPath) {
            return undefined;
        }

        return {
            markerPath,
            outputPath,
            timeoutMs,
            workspacePath: workspaceFolder.uri.fsPath,
            expectedSource,
            expectedExtensionPathPrefix
        };
    } catch {
        return undefined;
    }
}

async function runSmokeHarness(
    config: SmokeHarnessConfig,
    params: SmokeHarnessParams
): Promise<void> {
    const startedAt = Date.now();
    const events: Array<{ name: string; at: string; detail?: unknown }> = [];
    const deadline = Date.now() + config.timeoutMs;

    const recordEvent = (name: string, detail?: unknown) => {
        events.push({
            name,
            at: new Date().toISOString(),
            detail
        });
    };

    try {
        const extensionState = resolveSmokeExtensionState(config);
        recordEvent('extensionResolved', extensionState);

        const smokeDocument = await vscode.workspace.openTextDocument(
            vscode.Uri.file(nodePath.join(config.workspacePath, SMOKE_WORKSPACE_FILE))
        );
        const smokeEditor = await vscode.window.showTextDocument(smokeDocument, { preview: false });

        const waitForSelectionReferenceCount = async (
            count: number,
            description: string
        ): Promise<SmokeStatus> => waitForSmokeStatus(
            deadline,
            params,
            (status) => status.currentView === 'chat' && status.selectionReferenceCount === count,
            description
        );

        recordEvent('activated', {
            extensionId: extensionState.extensionId,
            viewId: SMOKE_VIEW_ID,
            extensionPath: extensionState.extensionPath,
            expectedSource: extensionState.expectedSource
        });

        await vscode.commands.executeCommand('acopilot.openChat');
        recordEvent('openChatRequested');

        const initialStatus = await waitForSmokeStatus(
            deadline,
            params,
            (status) => status.viewResolved && status.webviewReady && status.currentView === 'chat' && status.showEmptyState === true,
            'Acopilot welcome chat surface'
        );
        recordEvent('chatReady', initialStatus);

        await vscode.commands.executeCommand('acopilot.showHistory');
        recordEvent('showHistoryRequested');
        const historyStatus = await waitForSmokeStatus(
            deadline,
            params,
            (status) => status.currentView === 'history',
            'Acopilot history surface'
        );
        recordEvent('historyReady', historyStatus);

        await vscode.commands.executeCommand('acopilot.showSettings');
        recordEvent('showSettingsRequested');
        const settingsStatus = await waitForSmokeStatus(
            deadline,
            params,
            (status) => status.currentView === 'settings',
            'Acopilot settings surface'
        );
        recordEvent('settingsReady', settingsStatus);

        smokeEditor.selection = new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(3, 0)
        );
        smokeEditor.revealRange(
            new vscode.Range(smokeEditor.selection.start, smokeEditor.selection.end),
            vscode.TextEditorRevealType.InCenter
        );

        await vscode.commands.executeCommand('acopilot.addSelectionToChat');
        recordEvent('addSelectionRequested', {
            path: smokeDocument.uri.fsPath,
            startLine: 1,
            endLine: 3
        });
        const selectionStatus = await waitForSelectionReferenceCount(
            1,
            'Acopilot selection reference injection'
        );
        recordEvent('selectionInjected', selectionStatus);

        await vscode.commands.executeCommand('acopilot.addSelectionToChat');
        recordEvent('addSelectionDuplicateRequested');
        const selectionDedupedStatus = await waitForSelectionReferenceCount(
            1,
            'Acopilot selection reference dedupe'
        );
        recordEvent('selectionDeduped', selectionDedupedStatus);

        await vscode.commands.executeCommand('acopilot.newChat');
        recordEvent('newChatRequested');
        const newChatStatus = await waitForSmokeStatus(
            deadline,
            params,
            (status) =>
                status.currentView === 'chat' &&
                status.showEmptyState === true &&
                status.currentConversationId === null &&
                status.selectionReferenceCount === 0,
            'Acopilot new chat surface'
        );
        recordEvent('newChatReady', newChatStatus);

        await vscode.commands.executeCommand('acopilot.addFileToChat');
        recordEvent('addFileFromEditorRequested', {
            path: smokeDocument.uri.fsPath
        });
        const fileFromEditorStatus = await waitForSelectionReferenceCount(
            1,
            'Acopilot file reference injection from editor'
        );
        recordEvent('fileFromEditorInjected', fileFromEditorStatus);

        await vscode.commands.executeCommand('acopilot.showHistory');
        recordEvent('showHistoryBeforeExplorerFileRequested');
        const historyBeforeExplorerStatus = await waitForSmokeStatus(
            deadline,
            params,
            (status) => status.currentView === 'history',
            'Acopilot history surface before explorer file injection'
        );
        recordEvent('historyBeforeExplorerFileReady', historyBeforeExplorerStatus);

        await vscode.commands.executeCommand('acopilot.addFileToChat', smokeDocument.uri);
        recordEvent('addFileFromExplorerRequested', {
            path: smokeDocument.uri.fsPath
        });
        const fileDedupedStatus = await waitForSelectionReferenceCount(
            1,
            'Acopilot file reference dedupe across editor and explorer injection'
        );
        recordEvent('fileDeduped', fileDedupedStatus);

        await writeSmokeResult(config, {
            ok: true,
            status: 'ok',
            durationMs: Date.now() - startedAt,
            extensionId: extensionState.extensionId,
            viewId: SMOKE_VIEW_ID,
            workspacePath: config.workspacePath,
            extension: extensionState,
            events,
            smokeStatus: fileDedupedStatus
        });
    } catch (error) {
        recordEvent('failed');
        await writeSmokeResult(config, {
            ok: false,
            status: 'error',
            durationMs: Date.now() - startedAt,
            extensionId: SMOKE_EXTENSION_ID,
            viewId: SMOKE_VIEW_ID,
            workspacePath: config.workspacePath,
            events,
            error: error instanceof Error
                ? { message: error.message, stack: error.stack }
                : { message: String(error) }
        });
    } finally {
        setTimeout(() => {
            void vscode.commands.executeCommand('workbench.action.closeWindow');
        }, 100);
    }
}

function resolveSmokeExtensionState(config: SmokeHarnessConfig): SmokeExtensionState {
    const extension = vscode.extensions.getExtension(SMOKE_EXTENSION_ID);
    if (!extension) {
        throw new Error('Acopilot extension was not registered in the running VS Code instance.');
    }

    const extensionPath = extension.extensionPath;
    const pathMatchesExpectation = config.expectedExtensionPathPrefix
        ? hasNormalizedPathPrefix(extensionPath, config.expectedExtensionPathPrefix)
        : true;

    if (!pathMatchesExpectation) {
        throw new Error(
            `Expected Acopilot to load from ${config.expectedSource ?? 'the requested source'} path prefix ` +
            `"${config.expectedExtensionPathPrefix}", but resolved "${extensionPath}".`
        );
    }

    return {
        extensionId: extension.id,
        extensionPath,
        extensionVersion: String(extension.packageJSON?.version ?? ''),
        expectedSource: config.expectedSource,
        expectedExtensionPathPrefix: config.expectedExtensionPathPrefix,
        pathMatchesExpectation
    };
}

function hasNormalizedPathPrefix(actualPath: string, expectedPrefix: string): boolean {
    const normalizedActual = normalizeSmokePath(actualPath);
    const normalizedPrefix = normalizeSmokePath(expectedPrefix);

    return normalizedActual === normalizedPrefix || normalizedActual.startsWith(`${normalizedPrefix}${nodePath.sep}`);
}

function normalizeSmokePath(targetPath: string): string {
    return nodePath.normalize(targetPath).replace(/[\\/]+$/, '').toLowerCase();
}

async function waitForSmokeStatus(
    deadline: number,
    params: SmokeHarnessParams,
    predicate: (status: SmokeStatus) => boolean,
    description: string
): Promise<SmokeStatus> {
    while (Date.now() < deadline) {
        const smokeStatus = params.getSmokeStatus() ?? createInitialSmokeStatus();
        if (predicate(smokeStatus)) {
            return smokeStatus;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(`Timed out waiting for ${description}.`);
}

function createInitialSmokeStatus(): SmokeStatus {
    return {
        viewResolved: false,
        webviewReady: false,
        currentView: null,
        activeTab: null,
        showEmptyState: null,
        currentConversationId: null,
        selectionReferenceCount: null
    };
}

async function writeSmokeResult(config: SmokeHarnessConfig, result: unknown): Promise<void> {
    await mkdir(nodePath.dirname(config.outputPath), { recursive: true });
    await writeFile(config.outputPath, JSON.stringify(result, null, 2), 'utf8');
}
