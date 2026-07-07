import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getToolsForDependency } from '../frontend/src/composables/useDependency';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

describe('dependency settings enhancements', () => {
  it('maps shared dependencies back to affected tools', () => {
    expect(getToolsForDependency('sharp')).toEqual([
      'remove_background',
      'crop_image',
      'resize_image',
      'rotate_image',
    ]);
  });

  it('adds one-click missing dependency install actions to the Tools page warning', () => {
    const toolsSettings = readProjectFile('frontend/src/components/settings/ToolsSettings.vue');
    const warning = readProjectFile('frontend/src/components/common/DependencyWarning.vue');

    expect(toolsSettings).toContain(':show-install-action="true"');
    expect(toolsSettings).toContain('@install="handleInstallMissingDependencies(tool.name)"');
    expect(toolsSettings).toContain('@copy-failure-log="copyDependencyInstallFailureLog(tool.name)"');
    expect(warning).toContain('installMissing');
    expect(warning).toContain('copyFailureLog');
    expect(warning).toContain("settingsStore.showSettings('tools')");
  });

  it('keeps dependency management inside Tools instead of a standalone settings tab', () => {
    const settingsStore = readProjectFile('frontend/src/stores/settingsStore.ts');
    const settingsPanel = readProjectFile('frontend/src/components/settings/SettingsPanel.vue');
    const settingsPanelComposable = readProjectFile('frontend/src/components/settings/useSettingsPanel.ts');
    const toolsSettings = readProjectFile('frontend/src/components/settings/ToolsSettings.vue');

    expect(settingsStore).not.toContain("'dependencies'");
    expect(settingsPanelComposable).not.toContain("id: 'dependencies'");
    expect(settingsPanel).not.toContain("activeTab === 'dependencies'");
    expect(settingsPanel).not.toContain("import DependencySettings");
    expect(toolsSettings).toContain("import DependencySettings from './DependencySettings.vue'");
    expect(toolsSettings).toContain('@dependency-changed="loadDependencies"');
  });

  it('refreshes Tools dependency state after embedded dependency changes', () => {
    const toolsSettings = readProjectFile('frontend/src/components/settings/ToolsSettings.vue');
    const dependencySettings = readProjectFile('frontend/src/components/settings/DependencySettings.vue');

    expect(toolsSettings).toContain('@dependency-changed="loadDependencies"');
    expect(toolsSettings).toContain('ref="dependencySettingsRef"');
    expect(dependencySettings).toContain('dependencyChanged');
    expect(dependencySettings).toContain("emit('dependencyChanged')");
    expect(dependencySettings).toContain('defineExpose');
    expect(dependencySettings).toContain('refreshDependencies');
  });

  it('guards shared dependency installs from concurrent tool actions', () => {
    const useToolsSettings = readProjectFile('frontend/src/components/settings/useToolsSettings.ts');
    const manager = readProjectFile('backend/modules/dependencies/DependencyManager.ts');

    expect(useToolsSettings).toContain('installingDependencies');
    expect(useToolsSettings).toContain('installingDependencies.value.has(dependencyName)');
    expect(manager).toContain('installLocks');
    expect(manager).toContain('installUnlocked');
  });

  it('shows affected tools before uninstalling and exposes copyable failure logs', () => {
    const dependencySettings = readProjectFile('frontend/src/components/settings/DependencySettings.vue');

    expect(dependencySettings).toContain('ConfirmDialog');
    expect(dependencySettings).toContain('getAffectedToolNames');
    expect(dependencySettings).toContain('uninstallConfirmMessage');
    expect(dependencySettings).toContain('copyFailureLog');
    expect(dependencySettings).toContain('pathRelation');
  });

  it('returns backend dependency failure logs to the webview', () => {
    const manager = readProjectFile('backend/modules/dependencies/DependencyManager.ts');
    const handlers = readProjectFile('webview/handlers/DependencyHandlers.ts');

    expect(manager).toContain('lastFailureLogs');
    expect(manager).toContain('buildFailureLog');
    expect(manager).toContain('redactSensitiveText');
    expect(handlers).toContain('getLastFailureLog(name)');
  });
});
