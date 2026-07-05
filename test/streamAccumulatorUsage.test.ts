import { describe, expect, it } from 'vitest';

import { StreamAccumulator } from '../backend/modules/channel/StreamAccumulator';

describe('StreamAccumulator usage merging', () => {
    it('merges Anthropic-style partial usage chunks across message_start / message_delta', () => {
        const acc = new StreamAccumulator();

        // message_start: only promptTokenCount
        acc.add({
            delta: [],
            done: false,
            usage: { promptTokenCount: 1200 },
        });

        // text chunks (no usage)
        acc.add({ delta: [{ text: 'hello' }], done: false });

        // message_delta: only candidatesTokenCount
        acc.add({
            delta: [],
            done: false,
            usage: { candidatesTokenCount: 80 },
        });

        // message_stop
        acc.add({ delta: [], done: true });

        const usage = acc.getUsageMetadata();
        expect(usage).toBeDefined();
        expect(usage!.promptTokenCount).toBe(1200);
        expect(usage!.candidatesTokenCount).toBe(80);
        // totalTokenCount must be derived since Anthropic never sends it
        expect(usage!.totalTokenCount).toBe(1280);
    });

    it('keeps the full usage object when a provider sends it in one done chunk (OpenAI style)', () => {
        const acc = new StreamAccumulator();

        acc.add({ delta: [{ text: 'hello' }], done: false });
        acc.add({
            delta: [],
            done: true,
            usage: {
                promptTokenCount: 500,
                candidatesTokenCount: 100,
                totalTokenCount: 600,
            },
        });

        const usage = acc.getUsageMetadata();
        expect(usage).toEqual(
            expect.objectContaining({
                promptTokenCount: 500,
                candidatesTokenCount: 100,
                totalTokenCount: 600,
            })
        );
    });

    it('does not let a later partial usage clobber an earlier complete usage', () => {
        const acc = new StreamAccumulator();

        acc.add({
            delta: [],
            done: false,
            usage: {
                promptTokenCount: 500,
                candidatesTokenCount: 100,
                totalTokenCount: 600,
            },
        });

        // simulate a stray follow-up usage chunk that only carries part of the data
        acc.add({
            delta: [],
            done: true,
            usage: { candidatesTokenCount: 120 },
        });

        const usage = acc.getUsageMetadata();
        expect(usage!.promptTokenCount).toBe(500);
        expect(usage!.candidatesTokenCount).toBe(120);
        // totalTokenCount stays as the previously reported authoritative value
        expect(usage!.totalTokenCount).toBe(600);
    });

    it('derives totalTokenCount including thoughtsTokenCount', () => {
        const acc = new StreamAccumulator();

        acc.add({
            delta: [],
            done: true,
            usage: {
                promptTokenCount: 400,
                candidatesTokenCount: 60,
                thoughtsTokenCount: 40,
            },
        });

        const usage = acc.getUsageMetadata();
        expect(usage!.totalTokenCount).toBe(500);
    });
});
