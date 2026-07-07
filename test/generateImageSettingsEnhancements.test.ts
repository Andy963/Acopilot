import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [],
  },
}));

import { MemorySettingsStorage } from '../backend/modules/settings/storage';
import { SettingsManager } from '../backend/modules/settings/SettingsManager';
import { DEFAULT_GLOBAL_SETTINGS } from '../backend/modules/settings/types';
import { createGenerateImageTool } from '../backend/tools/media/generate_image';
import { detectImageProvider, testGenerateImageConnection } from '../backend/tools/media/generateImageHelpers';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

async function createSettingsManager(storage = new MemorySettingsStorage()): Promise<SettingsManager> {
  const manager = new SettingsManager(storage);
  await manager.initialize();
  return manager;
}

describe('generate image settings enhancements', () => {
  it('normalizes provider, limits, and provider-specific parameters', async () => {
    const settingsManager = await createSettingsManager();

    await settingsManager.updateGenerateImageConfig({
      provider: 'together',
      url: '',
      model: '',
      enableAspectRatio: true,
      defaultAspectRatio: '16:9',
      enableImageSize: true,
      defaultImageSize: '4K',
      maxBatchTasks: 99,
      maxImagesPerTask: -5,
    });

    const config = settingsManager.getGenerateImageConfig();
    expect(config.provider).toBe('together');
    expect(config.url).toBe('https://api.together.xyz/v1');
    expect(config.model).toBe('google/flash-image-2.5');
    expect(config.enableAspectRatio).toBe(false);
    expect(config.defaultAspectRatio).toBeUndefined();
    expect(config.enableImageSize).toBe(false);
    expect(config.defaultImageSize).toBeUndefined();
    expect(config.maxBatchTasks).toBe(20);
    expect(config.maxImagesPerTask).toBe(1);
  });

  it('keeps legacy provider inference for stored configs without provider', async () => {
    const storage = new MemorySettingsStorage();
    await storage.save({
      ...DEFAULT_GLOBAL_SETTINGS,
      toolsConfig: {
        ...DEFAULT_GLOBAL_SETTINGS.toolsConfig,
        generate_image: {
          url: 'https://api.together.xyz/v1/images/generations',
          apiKey: '',
          model: 'google/flash-image-2.5',
          enableAspectRatio: true,
          enableImageSize: true,
          maxBatchTasks: 5,
          maxImagesPerTask: 1,
          returnImageToAI: false,
        } as any,
      },
    });

    const settingsManager = await createSettingsManager(storage);
    expect(settingsManager.getGenerateImageConfig().provider).toBe('together');
  });

  it('uses explicit provider for backend execution and safe connection tests', async () => {
    expect(detectImageProvider({
      provider: 'together',
      url: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-3-pro-image-preview',
    })).toBe('together');

    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
      url,
    })) as unknown as typeof fetch;

    const result = await testGenerateImageConnection({
      provider: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'test-api-key-secret-value',
      model: 'gemini-3-pro-image-preview',
    }, fetchMock);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/models/gemini-3-pro-image-preview?key='),
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining(':generateContent'), expect.anything());
  });

  it('redacts API keys from failed connection tests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid key test-api-key-secret-value',
    })) as unknown as typeof fetch;

    const result = await testGenerateImageConnection({
      provider: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'test-api-key-secret-value',
      model: 'gemini-3-pro-image-preview',
    }, fetchMock);

    expect(result.success).toBe(false);
    expect(result.error).toContain('***REDACTED***');
    expect(result.error).not.toContain('test-api-key-secret-value');
  });

  it('hides unsupported Together parameters from the dynamic tool schema', () => {
    const tool = createGenerateImageTool(5, 1, {
      provider: 'together',
      enableAspectRatio: true,
      enableImageSize: true,
    });
    const properties = tool.declaration.parameters.properties as Record<string, any>;
    const batchProperties = properties.images.items.properties as Record<string, any>;

    expect(properties.reference_images).toBeUndefined();
    expect(properties.aspect_ratio).toBeUndefined();
    expect(properties.image_size).toBeUndefined();
    expect(batchProperties.reference_images).toBeUndefined();
    expect(batchProperties.aspect_ratio).toBeUndefined();
    expect(batchProperties.image_size).toBeUndefined();
  });

  it('adds explicit provider and safe connection controls to the frontend settings', () => {
    const settings = readProjectFile('frontend/src/components/settings/GenerateImageSettings.vue');
    const css = readProjectFile('frontend/src/components/settings/GenerateImageSettings.css');

    expect(settings).toContain("provider: 'gemini' as ImageProvider");
    expect(settings).toContain("'testGenerateImageConnection'");
    expect(settings).toContain('isTogetherProvider');
    expect(settings).toContain('updateBoundedNumber');
    expect(css).toContain('.test-connection-btn');
  });
});
