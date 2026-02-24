import { describe, expect, it, vi } from 'vitest';

import { FileSystemStorageAdapter } from '../backend/modules/conversation/storage';

describe('FileSystemStorageAdapter listSnapshots concurrency', () => {
  it('bounds concurrent snapshot reads', async () => {
    const snapshotCount = 50;
    const targetConversationId = 'target-conv';

    let inFlight = 0;
    let maxInFlight = 0;

    const mockFs = {
      readDirectory: vi.fn().mockResolvedValue(
        Array.from({ length: snapshotCount }, (_, i) => [`snap-${i}.json`, 1])
      ),
      readFile: vi.fn().mockImplementation(async (uri: any) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);

        await new Promise((resolve) => setTimeout(resolve, 1));

        inFlight -= 1;

        const fileName = String(uri.path).split('/').pop() || '';
        const id = fileName.replace('.json', '');
        const conversationId = id.endsWith('0') ? targetConversationId : 'other-conv';
        return Buffer.from(JSON.stringify({ conversationId, history: [] }));
      }),
      writeFile: vi.fn(),
      delete: vi.fn(),
    };

    const mockVscode = {
      Uri: {
        parse: (base: string) => ({ path: base, scheme: 'file' }),
        joinPath: (base: any, ...segments: string[]) => ({ path: `${base.path}/${segments.join('/')}`, scheme: base.scheme }),
      },
      workspace: {
        fs: mockFs,
      },
    };

    const adapter = new FileSystemStorageAdapter(mockVscode, '/test/storage');
    const result = await adapter.listSnapshots(targetConversationId);

    expect(result).toContain('snap-0');
    expect(result).toContain('snap-10');
    expect(result).toContain('snap-20');
    expect(result).toContain('snap-30');
    expect(result).toContain('snap-40');
    expect(result).toHaveLength(5);

    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });
});

