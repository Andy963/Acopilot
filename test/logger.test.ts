import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('debugLog', () => {
  let consoleSpy: any;
  let debugLog: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...originalEnv, ACOPILOT_DEBUG: 'true' };
    vi.resetModules();
    const loggerModule = await import('../backend/core/logger');
    debugLog = loggerModule.debugLog;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env = originalEnv;
    vi.resetModules();
  });

  it('should redact sensitive information in strings', () => {
    const sensitiveString = 'This is a secret key: sk-abcdef1234567890';
    debugLog(sensitiveString);

    // Should be called with redacted string
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('***REDACTED***'));
    // Should NOT be called with the original secret
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('sk-abcdef1234567890'));
  });

  it('should not redact non-sensitive strings', () => {
    const normalString = 'This is a normal log message';
    debugLog(normalString);
    expect(consoleSpy).toHaveBeenCalledWith(normalString);
  });

  it('should redact sensitive information in multiple arguments', () => {
    debugLog('Log:', 'Authorization: Bearer sk-1234567890');
    expect(consoleSpy).toHaveBeenCalledWith('Log:', expect.stringContaining('***REDACTED***'));
  });

  it('should redact sensitive information in objects', () => {
    const sensitiveObject = {
      user: 'admin',
      token: 'sk-abcdef1234567890',
      nested: {
        apiKey: 'sk-abcdef1234567890'
      }
    };
    debugLog(sensitiveObject);

    // Verify call arguments
    const loggedArg = consoleSpy.mock.calls[0][0];
    expect(loggedArg.token).toContain('***REDACTED***');
    expect(loggedArg.nested.apiKey).toContain('***REDACTED***');
    expect(loggedArg.user).toBe('admin');
  });

  it('should handle circular references', () => {
    const circular: any = { name: 'circular' };
    circular.self = circular;
    debugLog(circular);
    const loggedArg = consoleSpy.mock.calls[0][0];
    expect(loggedArg.self).toBe('[Circular]');
  });

  it('should redact sensitive information in Errors', () => {
    const error = new Error('Failed with token sk-abcdef1234567890');
    debugLog(error);
    const loggedArg = consoleSpy.mock.calls[0][0];
    expect(loggedArg.message).toContain('***REDACTED***');
    expect(loggedArg.message).not.toContain('sk-abcdef1234567890');
  });
});
