import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { buildOpenFileContextBlock } from '../backend/modules/api/chat/services/openFileContext';
import { getLastUserOpenFileContext, injectOpenFileContextIntoHistory } from '../backend/modules/api/chat/services/toolIterationLoop/helpers';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acopilot-open-file-context-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe('open file context injection', () => {
  it('builds a block from open files and injects it into request history', async () => {
    await withTempDir(async (tmp) => {
      const filePath = path.join(tmp, 'a.txt');
      await fs.writeFile(filePath, ['line1', 'line2'].join('\n'), 'utf8');

      const block = await buildOpenFileContextBlock([
        { path: 'a.txt', absolutePath: filePath, languageId: 'text' },
      ]);

      expect(block).toBeTruthy();
      expect(block!).toContain('OPEN FILE CONTEXT');
      expect(block!).toContain('[1] a.txt');
      expect(block!).toContain('line1');
      expect(block!).toContain('line2');

      const requestHistory: any[] = [
        { role: 'user', parts: [{ text: 'Question?' }] },
      ];

      const injected = injectOpenFileContextIntoHistory(requestHistory as any, block);
      const text = injected[0].parts[0].text as string;
      expect(text.startsWith('====\n\nOPEN FILE CONTEXT')).toBe(true);
      expect(text).toContain('line1');
      expect(text).toContain('Question?');
    });
  });

  it('does not inject when block is empty/undefined', () => {
    const requestHistory: any[] = [
      { role: 'user', parts: [{ text: 'Question?' }] },
    ];

    const injected = injectOpenFileContextIntoHistory(requestHistory as any, undefined);
    expect(injected).toBe(requestHistory);
    expect(injected[0].parts[0].text).toBe('Question?');
  });

  it('reads open file context from the latest user message', () => {
    const fullHistory: any[] = [
      { role: 'user', parts: [{ text: 'old' }], openFileContext: '====\n\nOPEN FILE CONTEXT\n\nold' },
      { role: 'model', parts: [{ text: 'ok' }] },
      { role: 'user', parts: [{ text: 'new' }], openFileContext: '====\n\nOPEN FILE CONTEXT\n\nnew' },
    ];

    expect(getLastUserOpenFileContext(fullHistory as any)).toBe('====\n\nOPEN FILE CONTEXT\n\nnew');
  });

  it('filters open files by ignore patterns', async () => {
    await withTempDir(async (tmp) => {
      const okPath = path.join(tmp, 'a.txt');
      const secretPath = path.join(tmp, 'secret.txt');
      await fs.writeFile(okPath, 'ok', 'utf8');
      await fs.writeFile(secretPath, 'secret', 'utf8');

      const block = await buildOpenFileContextBlock(
        [
          { path: 'a.txt', absolutePath: okPath, languageId: 'text' },
          { path: 'secret.txt', absolutePath: secretPath, languageId: 'text' },
        ],
        { ignorePatterns: ['secret.txt'] }
      );

      expect(block).toBeTruthy();
      expect(block!).toContain('a.txt');
      expect(block!).not.toContain('secret.txt');
      expect(block!).not.toContain('secret');
    });
  });

  it('supports partial buffers via textStartLine', async () => {
    const block = await buildOpenFileContextBlock([
      { path: 'a.txt', languageId: 'text', text: ['x', 'y', 'z'].join('\n'), textStartLine: 10 },
    ]);

    expect(block).toBeTruthy();
    expect(block!).toContain('a.txt#L10-L12');
    expect(block!).toContain('x');
    expect(block!).toContain('y');
    expect(block!).toContain('z');
  });

  it('prefers in-memory text over disk content', async () => {
    await withTempDir(async (tmp) => {
      const filePath = path.join(tmp, 'a.txt');
      await fs.writeFile(filePath, 'old', 'utf8');

      const block = await buildOpenFileContextBlock([
        { path: 'a.txt', absolutePath: filePath, languageId: 'text', text: 'new', textStartLine: 1 },
      ]);

      expect(block).toBeTruthy();
      expect(block!).toContain('new');
      expect(block!).not.toContain('old');
    });
  });
});
