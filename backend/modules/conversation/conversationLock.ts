import type { IStorageAdapter } from './storage';

const conversationLocks = new WeakMap<IStorageAdapter, Map<string, Promise<void>>>();

function getConversationLockMap(storage: IStorageAdapter): Map<string, Promise<void>> {
  let lockMap = conversationLocks.get(storage);
  if (!lockMap) {
    lockMap = new Map<string, Promise<void>>();
    conversationLocks.set(storage, lockMap);
  }
  return lockMap;
}

export async function serializeConversationOperation<T>(
  storage: IStorageAdapter,
  conversationId: string,
  operation: () => Promise<T>
): Promise<T> {
  const lockMap = getConversationLockMap(storage);
  const previous = lockMap.get(conversationId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const settled = run.then(() => undefined, () => undefined);

  lockMap.set(conversationId, settled);

  try {
    return await run;
  } finally {
    if (lockMap.get(conversationId) === settled) {
      lockMap.delete(conversationId);
      if (lockMap.size === 0) {
        conversationLocks.delete(storage);
      }
    }
  }
}
