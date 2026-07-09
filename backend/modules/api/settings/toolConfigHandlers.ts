import type { SettingsManager } from '../../settings/SettingsManager';
import type {
  GetToolConfigRequest,
  GetToolConfigResponse,
  UpdateToolConfigRequest,
  UpdateToolConfigResponse
} from './types';

export async function getToolConfigImpl(
  settingsManager: SettingsManager,
  request: GetToolConfigRequest
): Promise<GetToolConfigResponse> {
  const { toolName } = request;

  if (toolName === 'list_files') {
    return { success: true, config: settingsManager.getListFilesConfig() };
  }

  if (toolName === 'apply_diff') {
    return { success: true, config: settingsManager.getApplyDiffConfig() };
  }

  if (toolName === 'delete_file') {
    return { success: true, config: settingsManager.getDeleteFileConfig() };
  }

  if (toolName === 'locate') {
    return { success: true, config: settingsManager.getLocateConfig() };
  }

  if (toolName === 'replace_in_files') {
    return { success: true, config: settingsManager.getReplaceInFilesConfig() };
  }

  if (toolName === 'generate_image') {
    return { success: true, config: settingsManager.getGenerateImageConfig() };
  }

  if (toolName === 'remove_background') {
    return { success: true, config: settingsManager.getRemoveBackgroundConfig() };
  }

  if (toolName === 'crop_image') {
    return { success: true, config: settingsManager.getCropImageConfig() };
  }

  if (toolName === 'resize_image') {
    return { success: true, config: settingsManager.getResizeImageConfig() };
  }

  if (toolName === 'rotate_image') {
    return { success: true, config: settingsManager.getRotateImageConfig() };
  }

  const toolsConfig = settingsManager.getToolsConfig();
  return { success: true, config: toolsConfig[toolName] || {} };
}

export async function updateToolConfigImpl(
  settingsManager: SettingsManager,
  request: UpdateToolConfigRequest
): Promise<UpdateToolConfigResponse> {
  const { toolName, config } = request;

  if (toolName === 'list_files') {
    await settingsManager.updateListFilesConfig(config);
  } else if (toolName === 'find_files') {
    await settingsManager.updateFindFilesConfig(config);
  } else if (toolName === 'search_in_files') {
    await settingsManager.updateSearchInFilesConfig(config);
  } else if (toolName === 'replace_in_files') {
    await settingsManager.updateReplaceInFilesConfig(config);
  } else if (toolName === 'apply_diff') {
    await settingsManager.updateApplyDiffConfig(config);
  } else if (toolName === 'delete_file') {
    await settingsManager.updateDeleteFileConfig(config);
  } else if (toolName === 'execute_command') {
    await settingsManager.updateExecuteCommandConfig(config);
  } else if (toolName === 'locate') {
    await settingsManager.updateLocateConfig(config);
  } else if (toolName === 'checkpoint') {
    await settingsManager.updateCheckpointConfig(config);
  } else if (toolName === 'summarize') {
    await settingsManager.updateSummarizeConfig(config);
  } else if (toolName === 'generate_image') {
    await settingsManager.updateGenerateImageConfig(config);
  } else if (toolName === 'remove_background') {
    await settingsManager.updateRemoveBackgroundConfig(config);
  } else if (toolName === 'crop_image') {
    await settingsManager.updateCropImageConfig(config);
  } else if (toolName === 'resize_image') {
    await settingsManager.updateResizeImageConfig(config);
  } else if (toolName === 'rotate_image') {
    await settingsManager.updateRotateImageConfig(config);
  } else if (toolName === 'context_awareness') {
    await settingsManager.updateContextAwarenessConfig(config);
  } else if (toolName === 'pinned_files') {
    await settingsManager.updatePinnedFilesConfig(config);
  } else if (toolName === 'system_prompt') {
    await settingsManager.updateSystemPromptConfig(config);
  } else if (toolName === 'token_count') {
    await settingsManager.updateTokenCountConfig(config);
  } else {
    await settingsManager.updateToolConfig(toolName, config);
  }

  const settings = settingsManager.getSettings();
  return { success: true, settings };
}

