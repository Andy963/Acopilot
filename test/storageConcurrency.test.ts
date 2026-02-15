import { describe, it, expect, vi } from 'vitest';
import { FileSystemStorageAdapter } from '../backend/modules/conversation/storage';

describe('FileSystemStorageAdapter Concurrency', () => {
  it('should list snapshots concurrently', async () => {
    const SNAPSHOT_COUNT = 50;
    const READ_DELAY_MS = 10;
    const TARGET_CONVERSATION_ID = 'target-conv';

    const mockFs = {
      readDirectory: vi.fn().mockResolvedValue(
        Array.from({ length: SNAPSHOT_COUNT }, (_, i) => [`snap-${i}.json`, 1])
      ),
      readFile: vi.fn().mockImplementation(async (uri) => {
        await new Promise(resolve => setTimeout(resolve, READ_DELAY_MS));
        const id = uri.path.split('/').pop()?.replace('.json', '');
        // Make every 10th snapshot belong to the target conversation
        const conversationId = id?.endsWith('0') ? TARGET_CONVERSATION_ID : 'other-conv';
        return Buffer.from(JSON.stringify({ conversationId, history: [] }));
      }),
      writeFile: vi.fn(),
      delete: vi.fn(),
    };

    const mockVscode = {
      Uri: {
        parse: (path: string) => ({ path, scheme: 'file' }),
        joinPath: (base: any, ...segments: string[]) => ({ path: base.path + '/' + segments.join('/'), scheme: 'file' }),
      },
      workspace: {
        fs: mockFs,
      },
    };

    const adapter = new FileSystemStorageAdapter(mockVscode, '/test/storage');

    const startTime = Date.now();
    const result = await adapter.listSnapshots(TARGET_CONVERSATION_ID);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Duration: ${duration}ms`);

    // Verify correctness
    expect(result).toHaveLength(Math.ceil(SNAPSHOT_COUNT / 10)); // 0, 10, 20, 30, 40 -> 5 items
    expect(result).toContain('snap-0');
    expect(result).toContain('snap-10');
  });
});
