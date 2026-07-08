import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

function readPackageJson(): any {
  return JSON.parse(readProjectFile('package.json'));
}

describe('VS Code outer menu enhancements', () => {
  it('uses a consistent Acopilot command title namespace', () => {
    const commands = readPackageJson().contributes.commands as Array<{ command: string; title: string }>;
    const expectedTitles: Record<string, string> = {
      'acopilot.openChat': 'Acopilot: Open Chat',
      'acopilot.addSelectionToChat': 'Acopilot: Add Selection to Chat',
      'acopilot.addFileToChat': 'Acopilot: Add File to Chat',
      'acopilot.newChat': 'Acopilot: New Chat',
      'acopilot.showHistory': 'Acopilot: Show History',
      'acopilot.showSettings': 'Acopilot: Show Settings',
    };

    for (const [command, title] of Object.entries(expectedTitles)) {
      expect(commands.find((entry) => entry.command === command)?.title).toBe(title);
    }
    expect(commands.every((entry) => entry.title.startsWith('Acopilot: '))).toBe(true);
  });

  it('keeps webview navigation actions out of the native view title menu', () => {
    const viewTitle = (readPackageJson().contributes.menus['view/title'] ?? []) as Array<{
      command: string;
      when: string;
      group: string;
    }>;
    const webviewNavigationCommands = new Set([
      'acopilot.newChat',
      'acopilot.showHistory',
      'acopilot.showSettings',
    ]);

    expect(viewTitle.filter((entry) => webviewNavigationCommands.has(entry.command))).toEqual([]);
  });

  it('renders spaced webview toolbar actions for new chat, history, and settings', () => {
    const app = readProjectFile('frontend/src/App.vue');

    expect(app).toContain('class="app-toolbar"');
    expect(app).toContain('class="app-toolbar-actions"');
    expect(app).toContain('class="app-view"');
    expect(app).toContain('gap: 12px');
    expect(app).toContain('icon="codicon-add"');
    expect(app).toContain('@click="handleNewChat"');
    expect(app).toContain('icon="codicon-history"');
    expect(app).toContain('@click="handleShowHistory"');
    expect(app).toContain('icon="codicon-settings-gear"');
    expect(app).toContain('@click="handleShowSettings"');
  });

  it('keeps file and selection reference feedback distinguishable', () => {
    const payloadBuilders = readProjectFile('extension/payloadBuilders.ts');
    const bridge = readProjectFile('frontend/src/composables/useAppBridge.ts');
    const topBar = readProjectFile('frontend/src/components/input/ComposerTopBar.vue');

    expect(payloadBuilders).toContain("source: 'selection'");
    expect(payloadBuilders).toContain("source: 'file'");
    expect(bridge).toContain('selectionReferenceAdded');
    expect(bridge).toContain('fileReferenceAdded');
    expect(topBar).toContain('referenceSources');
  });

  it('localizes reference source labels and notifications', () => {
    for (const locale of ['en', 'zh-CN', 'ja']) {
      const inputMessages = readProjectFile(`frontend/src/i18n/langs/${locale}/components/input.ts`);

      expect(inputMessages).toContain('referenceSources');
      expect(inputMessages).toContain('selectionReferenceAdded');
      expect(inputMessages).toContain('fileReferenceAdded');
    }
  });
});
