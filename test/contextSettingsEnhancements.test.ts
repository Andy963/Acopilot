import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

describe('context settings enhancements', () => {
  it('loads extended preview stats for workspace files, diagnostics, and ignore matches', () => {
    const handlers = readProjectFile('webview/handlers/ContextHandlers.ts');
    const composable = readProjectFile('frontend/src/components/settings/useContextSettings.ts');

    expect(handlers).toContain('getContextSettingsPreview');
    expect(handlers).toContain('getWorkspaceFileTree');
    expect(handlers).toContain('ignorePatterns');
    expect(handlers).toContain('diagnosticsToText');
    expect(composable).toContain("sendToExtension<ContextSettingsPreview>('getContextSettingsPreview'");
    expect(composable).toContain('previewStats');
  });

  it('shows token cost estimates and expanded context previews', () => {
    const settings = readProjectFile('frontend/src/components/settings/ContextSettings.vue');
    const composable = readProjectFile('frontend/src/components/settings/useContextSettings.ts');

    expect(composable).toContain('estimateTokensFromChars');
    expect(composable).toContain('totalEstimatedCost');
    expect(settings).toContain('workspaceFilesCost');
    expect(settings).toContain('openTabsCost');
    expect(settings).toContain('activeEditorCost');
    expect(settings).toContain('diagnosticsCost');
    expect(settings).toContain('workspaceFilesLabel');
    expect(settings).toContain('diagnosticsLabel');
    expect(settings).toContain('ignoreMatchesLabel');
  });

<<<<<<< HEAD
  it('keeps ignored file previews inside a bounded scroll area', () => {
    const settings = readProjectFile('frontend/src/components/settings/ContextSettings.vue');
    const styles = readProjectFile('frontend/src/components/settings/ContextSettings.css');

    expect(settings.match(/class="tabs-list ignore-files-list"/g)).toHaveLength(2);
    expect(styles).toContain('.ignore-files-list {');
    expect(styles).toContain('max-height: 120px;');
    expect(styles).toContain('overflow-y: auto;');
  });

=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
  it('adds diagnostics presets and bidirectional Context Inspector navigation', () => {
    const settings = readProjectFile('frontend/src/components/settings/ContextSettings.vue');
    const composable = readProjectFile('frontend/src/components/settings/useContextSettings.ts');
    const inspector = readProjectFile('frontend/src/components/common/ContextInspectorModal.vue');
    const appChatView = readProjectFile('frontend/src/components/shell/AppChatView.vue');

    expect(composable).toContain('diagnosticsPresets');
    expect(composable).toContain('applyDiagnosticsPreset');
    expect(composable).toContain('openCurrentContextInspector');
    expect(settings).toContain('applyDiagnosticsPreset(preset.id)');
    expect(settings).toContain('openCurrentContextInspector');
    expect(inspector).toContain('openSettings');
    expect(inspector).toContain('openContextSettings');
    expect(appChatView).toContain("settingsStore.showSettings('context')");
  });
<<<<<<< HEAD

  it('embeds summarize configuration in the context settings page', () => {
    const settings = readProjectFile('frontend/src/components/settings/ContextSettings.vue');
    const summarizeStyles = readProjectFile('frontend/src/components/settings/SummarizeSettings.css');

    expect(settings).toContain("import SummarizeSettings from './SummarizeSettings.vue'");
    expect(settings).toContain('class="form-group context-summarize-section"');
    expect(settings).toContain('<SummarizeSettings />');
    expect(summarizeStyles).toContain('grid-template-columns: minmax(0, 1fr) minmax(70px, 112px);');
  });
=======
>>>>>>> f327a97 (merge: dev into main for v1.2.0)
});
