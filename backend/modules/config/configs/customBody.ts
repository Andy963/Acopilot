import type { CustomBodyConfig } from './base';

export function deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
        return target;
    }

    // Arrays should be appended so fields like `tools` can't be silently wiped by a custom body.
    if (Array.isArray(target)) {
        const sourceItems = Array.isArray(source) ? source : [source];
        return [...target, ...sourceItems];
    }

    // If the target is not an array but source is, prefer source to avoid type confusion.
    if (Array.isArray(source)) {
        return source;
    }

    // Primitives override.
    if (typeof source !== 'object') {
        return source;
    }

    // Ensure target is an object.
    if (typeof target !== 'object' || target === null) {
        target = {};
    }

    const result = { ...target };
    for (const key of Object.keys(source)) {
        result[key] = deepMerge(result[key], (source as any)[key]);
    }
    return result;
}

export function applyCustomBody(
    originalBody: any,
    customBody?: CustomBodyConfig,
    enabled?: boolean
): any {
    if (!enabled || !customBody) {
        return originalBody;
    }

    let result = { ...originalBody };

    if (customBody.mode === 'simple' && customBody.items) {
        for (const item of customBody.items) {
            if (!item.enabled || !item.key || !item.key.trim()) {
                continue;
            }

            const rawKey = item.key.trim();
            let value: any;

            try {
                value = JSON.parse(item.value);
            } catch {
                value = item.value;
            }

            // Support nested path keys like "extra_body.google".
            if (rawKey.includes('.')) {
                const parts = rawKey.split('.');
                const nestedObj: Record<string, any> = {};
                let current: any = nestedObj;
                for (let i = 0; i < parts.length - 1; i++) {
                    current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
                result = deepMerge(result, nestedObj);
            } else {
                result = deepMerge(result, { [rawKey]: value });
            }
        }
    } else if (customBody.mode === 'advanced' && customBody.json) {
        try {
            const customData = JSON.parse(customBody.json);

            // Only accept object roots. Arrays/primitives would clobber the entire body and
            // can break required fields (e.g. Gemini "contents").
            if (customData && typeof customData === 'object' && !Array.isArray(customData)) {
                result = deepMerge(result, customData);
            } else {
                console.warn('Custom body JSON must be an object; ignoring non-object root.');
            }
        } catch (error) {
            console.warn('Failed to parse custom body JSON:', error);
        }
    }

    return result;
}

