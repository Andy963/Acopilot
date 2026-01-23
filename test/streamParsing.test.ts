import { describe, expect, it } from 'vitest';

import { parseStreamBuffer } from '../backend/modules/channel/streamParsing';

describe('parseStreamBuffer', () => {
  it('parses SSE data events', () => {
    const { chunks, remaining } = parseStreamBuffer('data: {"a":1}\n\n');
    expect(chunks).toEqual([{ a: 1 }]);
    expect(remaining).toBe('');
  });

  it('ignores SSE comment/keep-alive events', () => {
    const { chunks, remaining } = parseStreamBuffer(': keep-alive\n\n');
    expect(chunks).toEqual([]);
    expect(remaining).toBe('');
  });

  it('parses SSE JSON with newline whitespace across multiple data lines', () => {
    const { chunks } = parseStreamBuffer('data: {"a":\ndata: 1}\n\n');
    expect(chunks).toEqual([{ a: 1 }]);
  });

  it('keeps incomplete SSE event as remaining when not final', () => {
    const { chunks, remaining } = parseStreamBuffer('data: {"a":1}\n\ndata: {"b":2}');
    expect(chunks).toEqual([{ a: 1 }]);
    expect(remaining).toBe('data: {"b":2}');
  });

  it('injects event name into parsed chunk type when missing', () => {
    const { chunks } = parseStreamBuffer('event: message\ndata: {"foo":"bar"}\n\n');
    expect(chunks).toEqual([{ foo: 'bar', type: 'message' }]);
  });

  it('returns an internal sentinel on data: [DONE]', () => {
    const { chunks } = parseStreamBuffer('data: [DONE]\n\n');
    expect(chunks).toEqual([{ __acopilot_sse_done: true }]);
  });

  it('parses JSONL objects', () => {
    const { chunks, remaining } = parseStreamBuffer('{"a":1}\n{"b":2}\n');
    expect(chunks).toEqual([{ a: 1 }, { b: 2 }]);
    expect(remaining).toBe('');
  });

  it('parses JSON array fragments line-by-line', () => {
    const { chunks, remaining } = parseStreamBuffer('[{"a":1},\n{"b":2}]\n');
    expect(chunks).toEqual([{ a: 1 }, { b: 2 }]);
    expect(remaining).toBe('');
  });

  it('uses final=true to flush and parse last JSON object', () => {
    const { chunks, remaining } = parseStreamBuffer('{"a":1}', true);
    expect(chunks).toEqual([{ a: 1 }]);
    expect(remaining).toBe('');
  });

  it('keeps partial JSON as remaining when not final', () => {
    const { chunks, remaining } = parseStreamBuffer('{"a":');
    expect(chunks).toEqual([]);
    expect(remaining).toBe('{"a":');
  });
});
