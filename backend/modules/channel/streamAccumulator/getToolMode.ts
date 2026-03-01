import type { ToolMode } from '../../config/configs/base';

import { getGlobalConfigManager, getGlobalSettingsManager } from '../../../core/settingsContext';

export function getStreamAccumulatorToolMode(): ToolMode {
    const settingsManager = getGlobalSettingsManager();
    const configManager = getGlobalConfigManager();

    if (settingsManager && configManager) {
        const activeChannelId = settingsManager.getActiveChannelId();
        if (activeChannelId) {
            const configCache = (configManager as any).configCache as Map<string, any>;
            const config = configCache?.get(activeChannelId);
            if (config?.toolMode) {
                return config.toolMode;
            }
        }

        return settingsManager.getDefaultToolMode();
    }

    return 'function_call';
}

