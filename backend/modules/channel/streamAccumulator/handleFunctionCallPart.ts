import type { ContentPart } from '../../conversation/types';

import { debugLog } from '../../../core/logger';

export type StreamAccumulatorProviderType = 'gemini' | 'openai' | 'anthropic' | 'openai-responses' | 'custom';

export function handleFunctionCallPart(params: {
    parts: ContentPart[];
    providerType: StreamAccumulatorProviderType;
    part: ContentPart;
}): boolean {
    const { parts, providerType, part } = params;

    if (!part.functionCall) {
        return false;
    }

    const fc = part.functionCall as any;

    debugLog('[Accumulator] Received FC part:', JSON.stringify({
        index: fc.index,
        id: fc.id,
        name: fc.name,
        partialArgs: fc.partialArgs,
        existingPartsCount: parts.length,
        existingFCIndices: parts.filter(p => p.functionCall).map(p => (p.functionCall as any).index)
    }));

    for (let i = parts.length - 1; i >= 0; i--) {
        const existingPart = parts[i];
        if (!existingPart.functionCall) continue;

        const lastFc = existingPart.functionCall as any;

        let canMerge = false;

        if (typeof fc.index === 'number' && typeof lastFc.index === 'number') {
            canMerge = fc.index === lastFc.index;
            debugLog(`[Accumulator] Index match check: fc.index=${fc.index}, lastFc.index=${lastFc.index}, canMerge=${canMerge}`);
        } else if (fc.id && lastFc.id) {
            canMerge = fc.id === lastFc.id;
            debugLog(`[Accumulator] ID match check: fc.id=${fc.id}, lastFc.id=${lastFc.id}, canMerge=${canMerge}`);
        } else if (!fc.id && typeof fc.index !== 'number' && fc.partialArgs !== undefined && i === parts.length - 1) {
            canMerge = true;
            debugLog('[Accumulator] Pure increment mode, canMerge=true');
        } else {
            debugLog(`[Accumulator] No match: fc.index=${fc.index}(${typeof fc.index}), lastFc.index=${lastFc.index}(${typeof lastFc.index}), fc.id=${fc.id}, lastFc.id=${lastFc.id}`);
        }

        if (!canMerge) {
            continue;
        }

        debugLog(`[Accumulator] Merging into existing FC at index ${i}`);

        if (fc.name && !lastFc.name) {
            lastFc.name = fc.name;
        }
        if (fc.id && !lastFc.id) {
            lastFc.id = fc.id;
        }
        if (typeof fc.index === 'number' && typeof lastFc.index !== 'number') {
            lastFc.index = fc.index;
        }

        if (part.thoughtSignatures) {
            existingPart.thoughtSignatures = {
                ...(existingPart.thoughtSignatures || {}),
                ...part.thoughtSignatures
            };
        }
        if ((part as any).thoughtSignature) {
            existingPart.thoughtSignatures = {
                ...(existingPart.thoughtSignatures || {}),
                [providerType]: (part as any).thoughtSignature
            };
        }

        if (fc.partialArgs !== undefined) {
            lastFc.partialArgs = (lastFc.partialArgs || '') + fc.partialArgs;
            debugLog(`[Accumulator] After merge, partialArgs length: ${lastFc.partialArgs.length}`);

            if (lastFc.partialArgs.trim()) {
                try {
                    const parsed = JSON.parse(lastFc.partialArgs);
                    lastFc.args = parsed;
                    debugLog('[Accumulator] Successfully parsed args:', JSON.stringify(parsed));
                } catch {
                    // Ignore until the JSON becomes complete.
                }
            }
        }

        return true;
    }

    debugLog('[Accumulator] No mergeable FC found, adding new FC part');

    if (fc.partialArgs) {
        try {
            fc.args = JSON.parse(fc.partialArgs);
        } catch {
            // ignore
        }
    }

    const { thoughtSignature: rawSignature, ...restPart } = part as any;
    const newPart: ContentPart = { ...restPart };
    newPart.functionCall = { ...fc };
    if (fc.args) newPart.functionCall.args = { ...fc.args };

    if (rawSignature) {
        newPart.thoughtSignatures = {
            ...(newPart.thoughtSignatures || {}),
            [providerType]: rawSignature
        };
    }

    parts.push(newPart);
    debugLog(`[Accumulator] After adding, parts count: ${parts.length}`);
    return true;
}

