const DEBUG_ENABLED = process.env.ACOPILOT_DEBUG === '1' || process.env.ACOPILOT_DEBUG === 'true';

export function debugLog(...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  console.log(...args);
}
