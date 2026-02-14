import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('debugLog', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let debugLog: (...args: unknown[]) => void;
  let previousDebugEnv: string | undefined;

  beforeEach(async () => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    previousDebugEnv = process.env.ACOPILOT_DEBUG;
    process.env.ACOPILOT_DEBUG = 'true';

    vi.resetModules();
    const loggerModule = await import('../backend/core/logger');
    debugLog = loggerModule.debugLog;
  });

  afterEach(() => {
    consoleSpy.mockRestore();

    if (previousDebugEnv === undefined) {
      delete process.env.ACOPILOT_DEBUG;
    } else {
      process.env.ACOPILOT_DEBUG = previousDebugEnv;
    }

    vi.resetModules();
  });

  it('redacts sensitive information in strings', () => {
    const sensitiveString = 'This is a secret key: sk-abcdef1234567890';
    debugLog(sensitiveString);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('***REDACTED***'));
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('sk-abcdef1234567890'));
  });

  it('does not redact non-sensitive strings', () => {
    const normalString = 'This is a normal log message';
    debugLog(normalString);
    expect(consoleSpy).toHaveBeenCalledWith(normalString);
  });

  it('redacts sensitive information in multiple arguments', () => {
    debugLog('Log:', 'Authorization: Bearer sk-1234567890');
    expect(consoleSpy).toHaveBeenCalledWith('Log:', expect.stringContaining('***REDACTED***'));
  });

  it('redacts sensitive information in objects', () => {
    const sensitiveObject = {
      user: 'admin',
      token: 'sk-abcdef1234567890',
      nested: {
        apiKey: 'sk-abcdef1234567890',
      },
    };
    debugLog(sensitiveObject);

    const loggedArg = consoleSpy.mock.calls[0][0] as any;
    expect(loggedArg.token).toContain('***REDACTED***');
    expect(loggedArg.nested.apiKey).toContain('***REDACTED***');
    expect(loggedArg.user).toBe('admin');
  });

  it('handles circular references', () => {
    const circular: any = { name: 'circular' };
    circular.self = circular;
    debugLog(circular);
    const loggedArg = consoleSpy.mock.calls[0][0] as any;
    expect(loggedArg.self).toBe('[Circular]');
  });

  it('redacts sensitive information in Errors', () => {
    const error = new Error('Failed with token sk-abcdef1234567890');
    debugLog(error);
    const loggedArg = consoleSpy.mock.calls[0][0] as any;
    expect(loggedArg.message).toContain('***REDACTED***');
    expect(loggedArg.message).not.toContain('sk-abcdef1234567890');
  });
});

