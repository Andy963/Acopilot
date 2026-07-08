# Settings Defaults And Localization Implementation

## Steps

1. Add UI-only tool description translations for built-in tools.
2. Resolve built-in tool descriptions through i18n in `useToolsSettings`.
3. Keep MCP descriptions as server-provided text.
4. Add bounded `CustomScrollbar` max height to checkpoint cleanup list.
5. Change checkpoint cleanup-on-startup defaults and legacy normalization to enabled.
6. Change Prompt Settings token estimate channel default to OpenAI.
7. Change provider streaming fallback defaults to enabled in manager and formatters.
8. Add tests for localized tool descriptions, bounded cleanup list, checkpoint defaults, prompt token default, and stream fallback.
9. Run targeted tests, type checking, frontend build, and full validation.

## Files

- `frontend/src/components/settings/useToolsSettings.ts`
- `frontend/src/components/settings/ToolsSettings.vue`
- `frontend/src/i18n/langs/*/components/settingsPart2b.ts`
- `frontend/src/components/settings/checkpoint/CheckpointCleanupList.vue`
- `frontend/src/components/settings/checkpoint/useCheckpointSettingsConfig.ts`
- `frontend/src/components/settings/CheckpointSettings.vue`
- `backend/modules/settings/settingsTypes/checkpoints.ts`
- `backend/modules/settings/settingsManager/tools.ts`
- `frontend/src/components/settings/PromptSettings.vue`
- `backend/modules/channel/channelManager/ChannelManager.ts`
- `backend/modules/channel/formatters/*`
- `backend/modules/channel/README.md`
- `test/settingsDefaultsAndLocalization.test.ts`
- `test/defaultConfigBootstrap.test.ts`
- `test/startupRetentionCleanup.test.ts`

## Verification

- `npx vitest run test/settingsDefaultsAndLocalization.test.ts test/defaultConfigBootstrap.test.ts test/startupRetentionCleanup.test.ts test/anthropicBuildRequest.test.ts test/openaiAuthHeaderNormalization.test.ts`
- `npm run typecheck`
- `npm --prefix frontend run build`
- `npm run validate`
