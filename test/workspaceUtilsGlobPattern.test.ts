import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  workspaceFolders: [] as Array<{ name: string; uri: { fsPath: string } }>
}));

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockState.workspaceFolders;
    }
  }
}));

import { matchGlobPattern } from '../webview/utils/WorkspaceUtils';
import { getWorkspaceFileTree } from '../backend/modules/prompt/fileTree';

describe('workspace glob matching', () => {
  it('treats regex metacharacters as literal pattern text', () => {
    expect(() => matchGlobPattern('src/file.ts', '[')).not.toThrow();
    expect(() => matchGlobPattern('src/file.ts', 'foo(bar')).not.toThrow();
    expect(matchGlobPattern('src/foo(bar.ts', 'foo(bar.ts')).toBe(true);
    expect(matchGlobPattern('src/[draft].md', '[draft].md')).toBe(true);
  });

  it('preserves single-star and globstar behavior', () => {
    expect(matchGlobPattern('src/components/Button.vue', 'src/**/*.vue')).toBe(true);
    expect(matchGlobPattern('src/components/Button.vue', '*.vue')).toBe(true);
    expect(matchGlobPattern('src/components/Button.vue', '*.ts')).toBe(false);
  });

  it('keeps workspace file tree ignores safe for invalid regex text', () => {
    const root = mkdtempSync(join(tmpdir(), 'acopilot-glob-'));

    try {
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src', 'foo(bar.ts'), '');
      writeFileSync(join(root, 'src', 'keep.ts'), '');
      mockState.workspaceFolders = [{ name: 'project', uri: { fsPath: root } }];

      expect(() => getWorkspaceFileTree(2, ['foo(bar*'])).not.toThrow();
      expect(getWorkspaceFileTree(2, ['foo(bar*'])).toContain('keep.ts');
      expect(getWorkspaceFileTree(2, ['foo(bar*'])).not.toContain('foo(bar.ts');
    } finally {
      mockState.workspaceFolders = [];
      rmSync(root, { recursive: true, force: true });
    }
  });
});
