export const CHECKPOINT_IO_CONCURRENCY_ENV = 'ACOPILOT_CHECKPOINT_IO_CONCURRENCY';
export const DEFAULT_CHECKPOINT_IO_CONCURRENCY = 16;
export const MAX_CHECKPOINT_IO_CONCURRENCY = 64;

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function getCheckpointIoConcurrency(itemCount: number): number {
  if (itemCount <= 0) return 0;

  const requested = parsePositiveInt(process.env[CHECKPOINT_IO_CONCURRENCY_ENV]);
  const base = requested ?? DEFAULT_CHECKPOINT_IO_CONCURRENCY;
  const bounded = Math.max(1, Math.min(base, MAX_CHECKPOINT_IO_CONCURRENCY));

  return Math.min(bounded, itemCount);
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      await fn(items[index], index);
    }
  });

  await Promise.all(workers);
}

