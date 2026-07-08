# View Title Action Spacing Implementation

## 步骤

1. 从 `package.json` 的 `contributes.menus["view/title"]` 中移除 `acopilot.newChat`、`acopilot.showHistory` 和 `acopilot.showSettings`，保留 command 注册。
2. 在 `frontend/src/App.vue` 中增加 webview top toolbar，使用现有 `Tooltip` 和 `IconButton` 组件渲染三个入口。
3. 使用 scoped CSS 为 toolbar 和按钮组设置固定高度、固定按钮尺寸和明确 `gap`，并为主视图根节点设置显式 flex 填充约束。
4. 更新 `test/vscodeMenuEnhancements.test.ts`，验证 manifest 不再使用 `view/title` rank spacing，并验证 webview toolbar 存在。
5. 运行 targeted test、validators 和 build。
6. 完成 review 后替换发布 `v1.1.6`。

## 文件

- `package.json`
- `frontend/src/App.vue`
- `test/vscodeMenuEnhancements.test.ts`
- `docs/spec/view-title-action-spacing/requirement.md`
- `docs/spec/view-title-action-spacing/design.md`
- `docs/spec/view-title-action-spacing/implementation.md`

## 验证

- `npx vitest run test/vscodeMenuEnhancements.test.ts test/useAppShellSettingsNavigation.test.ts test/chatViewBridge.test.ts`
- `npm run validate`
- `npm run build`
