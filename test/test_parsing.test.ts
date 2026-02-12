
import { parseStreamBuffer } from '../backend/modules/channel/streamParsing';
import { describe, it, expect } from 'vitest';

describe('parseStreamBuffer', () => {
    it('should handle multiline JSON (pretty printed)', () => {
        const input = `{
  "key": "value",
  "number": 123
}`;
        // Simulating receiving this in one chunk
        const result = parseStreamBuffer(input);

        // It should parse it as one chunk
        expect(result.chunks).toHaveLength(1);
        expect(result.chunks[0]).toEqual({ key: "value", number: 123 });
        expect(result.remaining).toBe('');
    });

    it('should handle multiline JSON received in chunks', () => {
        const chunk1 = '{\n  "key": ';
        const chunk2 = '"value"\n}';

        const result1 = parseStreamBuffer(chunk1);
        expect(result1.chunks).toHaveLength(0);
        expect(result1.remaining).toBe(chunk1); // Should keep everything

        const result2 = parseStreamBuffer(result1.remaining + chunk2);
        expect(result2.chunks).toHaveLength(1);
        expect(result2.chunks[0]).toEqual({ key: "value" });
        expect(result2.remaining).toBe('');
    });

    it('should handle multiple JSON objects separated by newlines', () => {
        const input = '{"a":1}\n{"b":2}\n';
        const result = parseStreamBuffer(input);
        expect(result.chunks).toHaveLength(2);
        expect(result.chunks[0]).toEqual({ a: 1 });
        expect(result.chunks[1]).toEqual({ b: 2 });
    });

    it('should handle streaming array of objects', () => {
        // Simulating: [ {"a": 1}, {"b": 2} ]
        // Chunk 1: Start of array + first object + comma
        const chunk1 = '[\n  {"a": 1},\n';
        const result1 = parseStreamBuffer(chunk1);

        // Should parse the first object
        expect(result1.chunks).toHaveLength(1);
        expect(result1.chunks[0]).toEqual({ a: 1 });

        // Chunk 2: Second object + end of array
        const chunk2 = '  {"b": 2}\n]';
        const result2 = parseStreamBuffer(result1.remaining + chunk2);

        expect(result2.chunks).toHaveLength(1);
        expect(result2.chunks[0]).toEqual({ b: 2 });
    });
});
