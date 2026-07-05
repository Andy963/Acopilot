import type { CreateConfigInput, GeminiConfig } from './types';
import type { ConfigManager } from './ConfigManager';

type ActiveChannelSettings = {
  getActiveChannelId(): string | undefined;
  setActiveChannelId(channelId: string): Promise<void>;
};

export type DefaultConfigBootstrapOptions = {
  geminiApiKey?: string;
};

function buildDefaultGeminiConfig(geminiApiKey: string): CreateConfigInput<GeminiConfig> {
  return {
    type: 'gemini',
    name: 'Gemini(Default)',
    apiKey: geminiApiKey,
    url: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3-pro-preview',
    timeout: 120000,
    enabled: true,
  };
}

export async function ensureDefaultConfig(
  configManager: ConfigManager,
  settingsManager: ActiveChannelSettings,
  options: DefaultConfigBootstrapOptions = {}
): Promise<void> {
  let configs = await configManager.listConfigs();

  if (configs.length === 0) {
    await configManager.createConfig(
      buildDefaultGeminiConfig(options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? '')
    );
    configs = await configManager.listConfigs();
  }

  if (configs.length === 0) {
    return;
  }

  const activeId = settingsManager.getActiveChannelId();
  const activeExists = !!activeId && configs.some((config) => config.id === activeId);
  if (!activeExists) {
    await settingsManager.setActiveChannelId(configs[0].id);
  }
}
