# Checkpoint Safety Presets Implementation

## Steps

1. Add preset definitions and apply logic to the checkpoint settings composable.
2. Render a preset control in checkpoint settings and localize labels/descriptions.
3. Extend dangerous tool detection to include `apply_diff` and ensure checkpoint before/after protection before enabling risky auto-exec.
4. Add a recent checkpoint restore entry to the chat message list and localize its copy.
5. 抽出共享的本地化工具展示 helper，并在工具设置、自动执行设置和存档点工具备份设置中复用。
6. Add focused tests that inspect the frontend implementation and settings strings.
7. Run validation:
   - `npm test`
   - `npm run typecheck`
   - `npm run build`

## Expected Files

- `frontend/src/components/settings/CheckpointSettings.vue`
- `frontend/src/components/settings/checkpoint/useCheckpointSettingsConfig.ts`
- `frontend/src/components/settings/toolDisplay.ts`
- `frontend/src/components/settings/AutoExecSettings.vue`
- `frontend/src/components/settings/useToolsSettings.ts`
- `frontend/src/components/message/MessageList.vue`
- `frontend/src/components/message/useMessageListActions.ts`
- `frontend/src/i18n/langs/*/components/settingsPart1.ts`
- `frontend/src/i18n/langs/*/components/settingsPart2b.ts`
- `frontend/src/i18n/langs/*/components/message.ts`
- `test/settingsDefaultsAndLocalization.test.ts`
- `test/toolsSettingsEnhancements.test.ts`
