export function normalizeReplacementArg(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.trim().length === 0) return undefined;
  return value;
}
