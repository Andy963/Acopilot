import { afterEach, describe, expect, it, vi } from 'vitest';

import * as cp from 'child_process';

import { StdioMcpClient } from '../backend/modules/mcp/StdioClient';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn() },
    kill: vi.fn(),
  })),
}));

describe('StdioMcpClient environment filtering', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not pass through common secret env vars', () => {
    process.env.OPENAI_API_KEY = 'sk-12345';
    process.env.GITHUB_TOKEN = 'ghp_abcde';
    process.env.AWS_ACCESS_KEY_ID = 'akid';
    process.env.AWS_SECRET_ACCESS_KEY = 'asecret';

    if (!process.env.PATH) process.env.PATH = '/usr/bin';

    const client = new StdioMcpClient('echo', ['hello']);
    // Do not await connect: we only need the spawn args.
    void client.connect();

    const spawnCalls = vi.mocked(cp.spawn).mock.calls;
    expect(spawnCalls.length).toBe(1);

    const options = spawnCalls[0][2] as any;
    expect(options.env).toBeDefined();
    expect(options.env.OPENAI_API_KEY).toBeUndefined();
    expect(options.env.GITHUB_TOKEN).toBeUndefined();
    expect(options.env.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(options.env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(options.env.PATH).toBeDefined();

    delete process.env.OPENAI_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });
});
