# View Title Action Spacing Design

## 设计

在 Acopilot webview 根组件中增加一个固定的 top toolbar。Toolbar 包含三个 icon button：

1. 新建对话：调用现有 `handleNewChat`。
2. 历史记录：调用现有 `handleShowHistory`。
3. 设置：调用现有 `handleShowSettings`。

三个按钮使用现有 `IconButton` 和 `Tooltip` 组件，图标继续使用 codicon。按钮组使用 CSS `gap` 控制间距，并使用固定尺寸按钮，避免 hover、tooltip 或视图切换造成布局抖动。

## Manifest 边界

`package.json` 继续注册 `acopilot.newChat`、`acopilot.showHistory` 和 `acopilot.showSettings` command，但从 `contributes.menus["view/title"]` 中移除这三个 action。

这样做有两个原因：

- VS Code 原生 title action 的 `group` rank 只表达排序，不表达像素间距。
- 如果保留 title action，用户仍会看到原生标题区的紧密按钮组，webview toolbar 不能真正修复问题。

## 前端边界

Toolbar 位于 `frontend/src/App.vue`，作为所有主视图的共同外壳。它不拥有业务状态，只转发到 `useAppShell` 已有 handler：

- `handleNewChat`
- `handleShowHistory`
- `handleShowSettings`

`HistoryPage`、`SettingsPanel` 和 `AppChatView` 内部逻辑保持不变。

## 测试策略

- 静态检查 `package.json` 中不再存在三个 Acopilot `view/title` action。
- 静态检查 `frontend/src/App.vue` 中存在 toolbar markup、固定按钮组和三个 handler 绑定。
- 保留 command title namespace 测试，确保外部 command 注册不被破坏。

## 风险

- Toolbar 会占用 webview 顶部一行高度。该高度是显式布局的一部分，比依赖 VS Code 原生 title action 的不可控渲染更可维护。
- Chat view 在已有会话时仍有 conversation header 的 history back button。它是上下文返回入口，和全局 toolbar 的 history 入口职责不同，本次不移除以避免扩大行为变更。
