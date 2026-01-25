import { describe, expect, it } from 'vitest';

import { redactSensitiveText } from '../backend/core/redaction';

const REDACTED = '***REDACTED***';

describe('redactSensitiveText', () => {
  it('redacts bearer tokens', () => {
    const input = 'Authorization: Bearer sk-1234567890abcdef';
    expect(redactSensitiveText(input)).toBe(`Authorization: ${REDACTED}`);
  });

  it('redacts authorization header lines', () => {
    const input = 'authorization: Basic abcdef==\nnext: line';
    expect(redactSensitiveText(input)).toBe(`authorization: ${REDACTED}\nnext: line`);
  });

  it('redacts basic auth credentials in URLs', () => {
    const input = 'Proxy url is http://user:pass@example.com/path';
    expect(redactSensitiveText(input)).toBe(`Proxy url is http://user:${REDACTED}@example.com/path`);
  });

  it('redacts known query parameters', () => {
    const input = 'https://example.com/?api_key=abc&token=def&ok=yes';
    expect(redactSensitiveText(input)).toBe(`https://example.com/?api_key=${REDACTED}&token=${REDACTED}&ok=yes`);
  });

  it('redacts json-like secret fields', () => {
    const input = '{"apiKey":"abc","proxyUrl":"http://user:pass@host","safe":"value"}';
    const output = redactSensitiveText(input);
    expect(output).toContain(`"apiKey":"${REDACTED}"`);
    expect(output).toContain(`"proxyUrl":"${REDACTED}"`);
    expect(output).toContain('"safe":"value"');
  });

  it('redacts inline assignments', () => {
    const input = 'token=abc123 apiKey:xyz456';
    expect(redactSensitiveText(input)).toBe(`token=${REDACTED} apiKey:${REDACTED}`);
  });

  it('redacts common token formats', () => {
    const input = 'sk-ant-abcdef1234567890 AIzaSyDUMMYDUMMYDUMMY ghp_abcdef1234567890';
    expect(redactSensitiveText(input)).toBe(`${REDACTED} ${REDACTED} ${REDACTED}`);
  });
});
