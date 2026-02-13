import { describe, expect, it } from 'vitest';

import {
  CHECKPOINT_IO_CONCURRENCY_ENV,
  DEFAULT_CHECKPOINT_IO_CONCURRENCY,
  MAX_CHECKPOINT_IO_CONCURRENCY,
  getCheckpointIoConcurrency,
  runWithConcurrency,
} from '../backend/modules/checkpoint/concurrency';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('getCheckpointIoConcurrency', () => {
  it('returns 0 for empty work', () => {
    expect(getCheckpointIoConcurrency(0)).toBe(0);
  });

  it('uses default when env is unset', () => {
    const previous = process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
    delete process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
    try {
      expect(getCheckpointIoConcurrency(999)).toBe(DEFAULT_CHECKPOINT_IO_CONCURRENCY);
    } finally {
      if (previous === undefined) {
        delete process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
      } else {
        process.env[CHECKPOINT_IO_CONCURRENCY_ENV] = previous;
      }
    }
  });

  it('respects env override and caps to itemCount', () => {
    const previous = process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
    process.env[CHECKPOINT_IO_CONCURRENCY_ENV] = '2';
    try {
      expect(getCheckpointIoConcurrency(10)).toBe(2);
    } finally {
      if (previous === undefined) {
        delete process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
      } else {
        process.env[CHECKPOINT_IO_CONCURRENCY_ENV] = previous;
      }
    }
  });

  it('caps env override to MAX_CHECKPOINT_IO_CONCURRENCY', () => {
    const previous = process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
    process.env[CHECKPOINT_IO_CONCURRENCY_ENV] = String(MAX_CHECKPOINT_IO_CONCURRENCY + 1000);
    try {
      expect(getCheckpointIoConcurrency(999)).toBe(MAX_CHECKPOINT_IO_CONCURRENCY);
    } finally {
      if (previous === undefined) {
        delete process.env[CHECKPOINT_IO_CONCURRENCY_ENV];
      } else {
        process.env[CHECKPOINT_IO_CONCURRENCY_ENV] = previous;
      }
    }
  });
});

describe('runWithConcurrency', () => {
  it('processes all items exactly once', async () => {
    const items = Array.from({ length: 25 }, (_, index) => index);
    const seen = new Set<number>();

    await runWithConcurrency(items, 4, async (item) => {
      await delay(1);
      seen.add(item);
    });

    expect(seen.size).toBe(items.length);
  });

  it('does not exceed provided concurrency', async () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency(items, 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('caps concurrency to item length', async () => {
    const items = [1, 2];
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency(items, 999, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active--;
    });

    expect(maxActive).toBe(2);
  });

  it('no-ops for empty lists', async () => {
    let called = false;

    await runWithConcurrency([], 10, async () => {
      called = true;
    });

    expect(called).toBe(false);
  });
});

