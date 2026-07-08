# Webview Main View Navigation Design

## Main View Registry

Add a frontend registry that describes each main Webview view:

- `id`
- `title`
- `icon`
- `command`
- `restoresState`

The registry is intentionally lightweight. It does not own rendering yet; `App.vue` may continue to render the three existing view components directly. The registry becomes the type and metadata source for navigation state and future commands.

## Settings Store Responsibilities

`settingsStore` remains the single mutation boundary for main view navigation:

- `showChat()`
- `showHistory()`
- `showSettings(tab?)`
- `hideSettings()`
- `setActiveTab(tab)`

The store loads the initial settings tab from Webview state and persists every explicit tab change. `showSettings()` without a tab does not overwrite `activeTab`.

## Settings Tab Persistence

Use the existing Webview state helpers:

- Key: `ui.settings.activeTab`
- Valid values: the existing `SettingsTab` union
- Fallback: `channel`

This keeps persistence scoped to the Webview state without changing extension settings or backend storage.

## First Configuration Guidance

The current chat entry already exposes Channel settings from two places:

- Welcome panel configure action when `chatStore.configId` or `chatStore.currentConfig` is missing.
- Input footer configure action when no model options are available.

The implementation keeps these paths explicit and routes them through `settingsStore.showSettings('channel')`, which also persists `channel` as the current settings tab.

External settings navigation also uses the same rule: if no current channel or model config is available, `Show Settings` opens Channel settings instead of restoring an unrelated tab.

## Risks

- Persisted state can contain stale values from older builds. Runtime validation must reject invalid tab IDs.
- Adding registry metadata without using it broadly could become decorative. The store should use the registry for view validation and exported metadata.
