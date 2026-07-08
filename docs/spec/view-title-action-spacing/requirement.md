# View Title Action Spacing Requirement

## 背景

Acopilot 需要在主视图中提供三个高频入口：新建对话、历史记录和设置。此前的 `v1.1.6` 尝试通过拉开 VS Code `view/title` menu rank 来制造按钮间距，但 VS Code 原生 title action 只保证排序，不提供可控的像素间距，因此这个方案无法稳定解决视觉过密问题。

## 目标

把三个入口放入 Acopilot webview 内部的固定 toolbar，由前端 DOM 和 CSS 控制按钮间距；不要再依赖 VS Code 原生 `view/title` action 的 rank 来表达间距。

## 需求

- 新建对话、历史记录和设置三个入口必须在 Acopilot webview 顶部可见。
- 三个入口必须继续复用现有 command 行为和前端导航行为。
- 三个入口之间的间距必须由 webview CSS 控制，不能依赖 VS Code 原生 title action rank。
- `package.json` 不应继续把这三个入口贡献到 `view/title`，避免原生标题区继续显示紧密按钮组。
- 保留 command 注册、command ID、command title 和 icon，确保命令面板、快捷键或宿主侧发送命令仍可使用。
- 增加静态测试，防止再次把此问题退回到 `view/title` rank spacing。

## 非目标

- 不改变 Acopilot activity bar view 注册。
- 不改变 conversation、history 或 settings 的业务逻辑。
- 不引入新的后端协议。

## 验证

- VS Code 菜单增强测试必须覆盖 `view/title` 移除和 webview toolbar 存在。
- 项目 validators 必须通过。
- 前端和扩展构建必须通过。
