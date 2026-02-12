import { redactSensitiveText } from './redaction';

const DEBUG_ENABLED = process.env.ACOPILOT_DEBUG === '1' || process.env.ACOPILOT_DEBUG === 'true';

function redactValue(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[Circular]';
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map(item => redactValue(item, seen));
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactSensitiveText(value.message),
        stack: value.stack ? redactSensitiveText(value.stack) : undefined,
        // Clone other properties if any
        ...Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, redactValue(v, seen)])
        )
      };
    }

    // Handle plain objects
    const redactedObj: Record<string, unknown> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        redactedObj[key] = redactValue((value as Record<string, unknown>)[key], seen);
      }
    }
    return redactedObj;
  }

  return value;
}

export function debugLog(...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;

  const redactedArgs = args.map(arg => redactValue(arg));

  console.log(...redactedArgs);
}
