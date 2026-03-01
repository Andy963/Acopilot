import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { FileContextCollector, type OpenFileContextInput } from '../backend/modules/api/chat/services/FileContextCollector';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acopilot-file-context-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function writeFileBytes(filePath: string, bytes: Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
}

describe('FileContextCollector', () => {
  it('collects UTF-8 files and applies line range + truncation', async () => {
    await withTempDir(async (tmp) => {
      const utf8Path = path.join(tmp, 'a.txt');
      await fs.writeFile(utf8Path, ['line1', 'line2', 'line3', 'line4'].join('\n'), 'utf8');

      const collector = new FileContextCollector();
      const inputs: OpenFileContextInput[] = [
        {
          path: 'a.txt',
          absolutePath: utf8Path,
          languageId: 'text',
          startLine: 2,
          endLine: 3
        }
      ];

      const res = await collector.collect(inputs, {
        maxFiles: 10,
        maxBytesPerFile: 1024,
        maxLinesPerFile: 10,
        maxCharsPerFile: 1000,
        maxTotalChars: 5000
      });

      expect(res.includedCount).toBe(1);
      expect(res.skippedCount).toBe(0);
      expect(res.items[0].included).toBe(true);
      expect(res.items[0].startLine).toBe(2);
      expect(res.items[0].endLine).toBe(3);
      expect(res.items[0].content).toBe(['line2', 'line3'].join('\n'));
      expect(res.block).toContain('OPEN FILE CONTEXT');
      expect(res.block).toContain('[1] a.txt#L2-L3');
      expect(res.block).toContain('```text');
      expect(res.block).toContain('line2');
      expect(res.block).toContain('line3');
    });
  });

  it('skips binary, non-utf8, empty, and missing files with stable reasons', async () => {
    await withTempDir(async (tmp) => {
      const emptyPath = path.join(tmp, 'empty.txt');
      await fs.writeFile(emptyPath, '', 'utf8');

      const binaryPath = path.join(tmp, 'bin.dat');
      await writeFileBytes(binaryPath, new Uint8Array([0x00, 0x01, 0x02, 0x03]));

      const nonUtf8Path = path.join(tmp, 'latin1.txt');
      await writeFileBytes(nonUtf8Path, new Uint8Array([0xc3, 0x28])); // Invalid UTF-8

      const missingPath = path.join(tmp, 'missing.txt');

      const collector = new FileContextCollector();
      const inputs: OpenFileContextInput[] = [
        { path: 'empty.txt', absolutePath: emptyPath },
        { path: 'bin.dat', absolutePath: binaryPath },
        { path: 'latin1.txt', absolutePath: nonUtf8Path },
        { path: 'missing.txt', absolutePath: missingPath }
      ];

      const res = await collector.collect(inputs, {
        maxFiles: 10,
        maxBytesPerFile: 1024,
        maxLinesPerFile: 50,
        maxCharsPerFile: 1000,
        maxTotalChars: 5000,
        includeEmptyFiles: false
      });

      expect(res.includedCount).toBe(0);
      expect(res.skippedCount).toBe(4);

      const byPath = new Map(res.items.map((i) => [i.path, i]));
      expect(byPath.get('empty.txt')?.skippedReason).toBe('empty');
      expect(byPath.get('bin.dat')?.skippedReason).toBe('binary');
      expect(byPath.get('latin1.txt')?.skippedReason).toBe('non_utf8');
      expect(byPath.get('missing.txt')?.skippedReason).toBe('not_found');

      expect(res.block).toContain('SKIPPED FILES');
      expect(res.block).toContain('- empty.txt (empty)');
      expect(res.block).toContain('- bin.dat (binary)');
      expect(res.block).toContain('- latin1.txt (non_utf8)');
      expect(res.block).toContain('- missing.txt (not_found)');
    });
  });

  it('marks large files as truncated (head-only) and respects maxTotalChars budget', async () => {
    await withTempDir(async (tmp) => {
      const largePath = path.join(tmp, 'large.txt');
      const content = `header\n${'a'.repeat(50_000)}\nfooter\n`;
      await fs.writeFile(largePath, content, 'utf8');

      const otherPath = path.join(tmp, 'b.txt');
      await fs.writeFile(otherPath, 'hello', 'utf8');

      const collector = new FileContextCollector();
      const inputs: OpenFileContextInput[] = [
        { path: 'b.txt', absolutePath: otherPath },
        { path: 'large.txt', absolutePath: largePath }
      ];

      const res = await collector.collect(inputs, {
        maxFiles: 10,
        maxBytesPerFile: 1024,
        maxLinesPerFile: 1000,
        maxCharsPerFile: 2000,
        maxTotalChars: 1000
      });

      // Sorted by path, so b.txt first.
      expect(res.items[0].path).toBe('b.txt');
      expect(res.items[0].included).toBe(true);
      expect(res.items[1].path).toBe('large.txt');

      // Large file will likely exceed the remaining budget and be skipped, or included but truncated.
      const large = res.items[1];
      if (large.included) {
        expect(large.truncated).toBe(true);
        expect(large.content?.length).toBeLessThanOrEqual(2000 + 80);
      } else {
        expect(large.skippedReason).toBe('over_budget');
      }
    });
  });

  it('deduplicates and sorts inputs to keep output stable', async () => {
    await withTempDir(async (tmp) => {
      const aPath = path.join(tmp, 'a.txt');
      const bPath = path.join(tmp, 'b.txt');
      await fs.writeFile(aPath, 'a', 'utf8');
      await fs.writeFile(bPath, 'b', 'utf8');

      const collector = new FileContextCollector();
      const inputs: OpenFileContextInput[] = [
        { path: 'b.txt', absolutePath: bPath },
        { path: 'a.txt', absolutePath: aPath },
        { path: 'a.txt', absolutePath: aPath }, // duplicate
        { path: 'a.txt', absolutePath: aPath, startLine: 1, endLine: 1 } // different range, not a duplicate
      ];

      const res = await collector.collect(inputs, {
        maxFiles: 10,
        maxBytesPerFile: 1024,
        maxLinesPerFile: 10,
        maxCharsPerFile: 1000,
        maxTotalChars: 5000
      });

      expect(res.items.map((i) => i.path)).toEqual(['a.txt', 'a.txt', 'b.txt']);
      expect(res.items[0].requestedStartLine).toBe(1);
      expect(res.items[0].requestedEndLine).toBe(1);
      expect(res.items[1].requestedStartLine).toBeUndefined();
      expect(res.items[1].requestedEndLine).toBeUndefined();
    });
  });
});

