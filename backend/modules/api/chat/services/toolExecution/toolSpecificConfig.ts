import type { SettingsManager } from '../../../../settings/SettingsManager';

export function applyToolSpecificConfig(
  settingsManager: SettingsManager | undefined,
  toolName: string,
  toolContext: Record<string, unknown>
): void {
  if (!settingsManager) {
    return;
  }

  if (toolName === 'generate_image') {
    const imageConfig = settingsManager.getGenerateImageConfig();
    toolContext.config = {
      ...imageConfig,
      proxyUrl: settingsManager.getEffectiveProxyUrl()
    };
  }

  if (toolName === 'remove_background') {
    const imageConfig = settingsManager.getGenerateImageConfig();
    const removeConfig = settingsManager.getRemoveBackgroundConfig();
    toolContext.config = {
      ...imageConfig,
      ...removeConfig,
      proxyUrl: settingsManager.getEffectiveProxyUrl()
    };
  }

  if (toolName === 'crop_image') {
    const cropConfig = settingsManager.getCropImageConfig();
    toolContext.config = { ...cropConfig };
  }

  if (toolName === 'resize_image') {
    const resizeConfig = settingsManager.getResizeImageConfig();
    toolContext.config = { ...resizeConfig };
  }

  if (toolName === 'rotate_image') {
    const rotateConfig = settingsManager.getRotateImageConfig();
    toolContext.config = { ...rotateConfig };
  }
}

