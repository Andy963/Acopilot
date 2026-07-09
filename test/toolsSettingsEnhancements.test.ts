import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import { DEFAULT_GLOBAL_SETTINGS } from '../backend/modules/settings/types';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

async function createSettingsManager(storage = new MemorySettingsStorage()): Promise<SettingsManager> {
  const manager = new SettingsManager(storage);
  await manager.initialize();
  return manager;
}

describe('tools settings enhancements', () => {
  it('uses registered tool routes for toggles and auto execution', () => {
    const composable = readProjectFile('frontend/src/components/settings/useToolsSettings.ts');

    expect(composable).toContain("'tools.setToolEnabled'");
    expect(composable).toContain("'tools.setToolAutoExec'");
    expect(composable).toContain("'apply_diff'");
    expect(composable).toContain("'delete_file'");
    expect(composable).toContain("'execute_command'");
    expect(composable).toContain("'replace_in_files'");
    expect(composable).not.toContain("'tools.toggleTool'");
    expect(composable).not.toContain("'tools.updateAutoExecConfig'");
  });

  it('ensures checkpoint protection before dangerous auto execution', () => {
    const composable = readProjectFile('frontend/src/components/settings/useToolsSettings.ts');

    expect(composable).toContain('AUTO_EXEC_CHECKPOINT_PROTECTED_TOOLS');
    expect(composable).toContain('ensureCheckpointProtectionForAutoExec');
    expect(composable).toContain("'checkpoint.getConfig'");
    expect(composable).toContain("'checkpoint.updateConfig'");
    expect(composable).toContain('beforeTools');
    expect(composable).toContain('afterTools');
  });

  it('adds replace_in_files settings and safe auto-exec defaults', async () => {
    const settingsManager = await createSettingsManager();

    expect(settingsManager.isToolAutoExec('replace_in_files')).toBe(false);
    expect(settingsManager.getToolAutoExecConfig().replace_in_files).toBe(false);
    expect(settingsManager.getReplaceInFilesConfig().excludePatterns).toContain('**/node_modules/**');
  });

  it('merges new auto-exec defaults into legacy stored settings', async () => {
    const storage = new MemorySettingsStorage();
    await storage.save({
      ...DEFAULT_GLOBAL_SETTINGS,
      toolAutoExec: {
        delete_file: false,
        execute_command: false,
      },
    });

    const settingsManager = await createSettingsManager(storage);

    expect(settingsManager.getToolAutoExecConfig().replace_in_files).toBe(false);
    expect(settingsManager.isToolAutoExec('replace_in_files')).toBe(false);
  });

  it('keeps replace_in_files exclude patterns separate from search_in_files', async () => {
    const settingsManager = await createSettingsManager();

    await settingsManager.updateSearchInFilesConfig({ excludePatterns: ['**/search-only/**'] });
    await settingsManager.updateReplaceInFilesConfig({ excludePatterns: ['**/replace-only/**'] });

    expect(settingsManager.getSearchInFilesConfig().excludePatterns).toEqual(['**/search-only/**']);
    expect(settingsManager.getReplaceInFilesConfig().excludePatterns).toEqual(['**/replace-only/**']);
    expect(readProjectFile('backend/tools/search/replace_in_files.ts')).toContain("getExcludePattern('replace_in_files')");
  });

  it('renders a replace_in_files configuration panel through generic tool config routes', () => {
    const settings = readProjectFile('frontend/src/components/settings/ToolsSettings.vue');
    const searchConfig = readProjectFile('frontend/src/components/settings/tools/search/search_in_files.vue');

    expect(settings).toContain("tool.name === 'replace_in_files'");
    expect(settings).toContain('i18n-section="replaceInFiles"');
    expect(searchConfig).toContain("'tools.getToolConfig'");
    expect(searchConfig).toContain("'tools.updateToolConfig'");
    expect(searchConfig).toContain("toolName?: 'search_in_files' | 'replace_in_files'");
  });

  it('warns about replace_in_files when enabling dangerous auto execution in bulk', () => {
    for (const locale of ['en', 'zh-CN', 'ja']) {
      const messages = readProjectFile(`frontend/src/i18n/langs/${locale}/components/settingsPart2b.ts`);
      expect(messages).toContain('apply_diff / delete_file / execute_command / replace_in_files');
      expect(messages).toContain('checkpointFailed');
    }
  });
});
