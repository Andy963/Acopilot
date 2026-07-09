# Settings Defaults And Localization Implementation

## Steps

1. Add UI-only tool description translations for built-in tools.
2. 在共享的前端展示 helper 中通过 i18n 解析内置工具说明。
3. 在工具设置、自动执行设置、存档点工具备份设置中复用该 helper。
4. MCP 工具说明继续使用服务器提供的文本。
5. 上下文总结数值输入与标签保持同一行。
6. 为存档点清理列表添加受限高度的 `CustomScrollbar`。
7. 将启动时清理过期对话的默认值和旧配置归一化结果改为启用。
8. 将 Prompt Settings 的 token 估算渠道默认值改为 OpenAI。
9. 将 provider streaming 的 fallback 默认值在 manager 和 formatters 中改为启用。
10. 添加测试覆盖工具说明本地化、上下文总结数值布局、受限清理列表、存档点默认值、prompt token 默认值和 stream fallback。
11. 运行目标测试、类型检查、前端构建和完整校验。

## Files

- `frontend/src/components/settings/useToolsSettings.ts`
- `frontend/src/components/settings/ToolsSettings.vue`
- `frontend/src/components/settings/AutoExecSettings.vue`
- `frontend/src/components/settings/toolDisplay.ts`
- `frontend/src/components/settings/SummarizeSettings.vue`
- `frontend/src/components/settings/SummarizeSettings.css`
- `frontend/src/i18n/langs/*/components/settingsPart2b.ts`
- `frontend/src/components/settings/checkpoint/CheckpointCleanupList.vue`
- `frontend/src/components/settings/checkpoint/CheckpointToolSettingsSection.vue`
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
