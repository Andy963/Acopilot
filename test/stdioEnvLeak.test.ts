import { describe, it, expect, vi, afterEach } from 'vitest';
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

describe('StdioMcpClient Environment Safety', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should not inherit sensitive environment variables', async () => {
        // Setup sensitive env var
        process.env.OPENAI_API_KEY = 'sk-12345';
        process.env.GITHUB_TOKEN = 'ghp_abcde';
        // Ensure PATH exists
        if (!process.env.PATH) {
            process.env.PATH = '/usr/bin';
        }

        const client = new StdioMcpClient('echo', ['hello']);

        // Start connection but don't await it fully
        client.connect().catch(() => {});

        const spawnCalls = vi.mocked(cp.spawn).mock.calls;
        expect(spawnCalls.length).toBe(1);
        const options = spawnCalls[0][2] as any; // 3rd arg is options

        expect(options.env).toBeDefined();

        // Check for leakage
        const hasOpenAI = options.env?.OPENAI_API_KEY === 'sk-12345';
        const hasGithub = options.env?.GITHUB_TOKEN === 'ghp_abcde';

        // We expect leakage to be PREVENTED now
        expect(hasOpenAI).toBe(false);
        expect(hasGithub).toBe(false);
        // And PATH should still be there
        expect(options.env?.PATH).toBeDefined();

        // Cleanup
        delete process.env.OPENAI_API_KEY;
        delete process.env.GITHUB_TOKEN;
    });
});
