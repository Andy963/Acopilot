import type { ChannelConfig } from './types';
import type { ConfigStorageAdapter } from './storage';

export type SecretStorage = {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
};

const CONFIG_API_KEY_SECRET_PREFIX = 'acopilot.config.apiKey.';

export function getApiKeySecretKey(configId: string): string {
  return `${CONFIG_API_KEY_SECRET_PREFIX}${configId}`;
}

export async function tryStoreSecret(secretStorage: SecretStorage | undefined, key: string, value: string): Promise<boolean> {
  if (!secretStorage) return false;
  try {
    await secretStorage.store(key, value);
    return true;
  } catch {
    return false;
  }
}

export async function tryDeleteSecret(secretStorage: SecretStorage | undefined, key: string): Promise<void> {
  if (!secretStorage) return;
  try {
    await secretStorage.delete(key);
  } catch {
    return;
  }
}

export async function tryGetSecret(secretStorage: SecretStorage | undefined, key: string): Promise<string | undefined> {
  if (!secretStorage) return undefined;
  try {
    return await secretStorage.get(key);
  } catch {
    return undefined;
  }
}

export function stripApiKeyForStorage(config: ChannelConfig, secretStorage: SecretStorage | undefined): ChannelConfig {
  if (!secretStorage) return config;
  if (!('apiKey' in (config as any))) return config;
  return { ...(config as any), apiKey: '' } as ChannelConfig;
}

export async function hydrateAndMigrateApiKey(params: {
  config: ChannelConfig;
  storageAdapter: ConfigStorageAdapter;
  secretStorage: SecretStorage | undefined;
}): Promise<ChannelConfig> {
  if (!params.secretStorage) {
    return params.config;
  }

  const apiKeySecretKey = getApiKeySecretKey(params.config.id);
  const rawApiKey = typeof (params.config as any).apiKey === 'string'
    ? String((params.config as any).apiKey)
    : '';
  const isRedacted = rawApiKey === '***REDACTED***';

  // Migration: older versions store apiKey in globalState. Move it into SecretStorage and wipe plaintext.
  if (rawApiKey.trim().length > 0 && !isRedacted) {
    const stored = await tryStoreSecret(params.secretStorage, apiKeySecretKey, rawApiKey);
    if (stored) {
      await params.storageAdapter.save(stripApiKeyForStorage(params.config, params.secretStorage));
    }
    return params.config;
  }

  const secretApiKey = await tryGetSecret(params.secretStorage, apiKeySecretKey);
  if (secretApiKey && secretApiKey.trim().length > 0) {
    return { ...(params.config as any), apiKey: secretApiKey } as ChannelConfig;
  }

  if (isRedacted) {
    return { ...(params.config as any), apiKey: '' } as ChannelConfig;
  }

  return params.config;
}

