---
id: req_yl4wdeo3
type: requirement
title: 修复消息工具栏 Hover 抖动与代码块溢出 - 需求
status: finalized
created_at: 2026-01-09T04:57:53.822Z
updated_at: 2026-01-08T21:07:05.000Z
---

# 修复消息工具栏 Hover 抖动与代码块溢出 - 需求

# 修复消息工具栏 Hover 抖动与代码块溢出 - 需求

## Metadata
| Field | Value |
| ----- | ----- |
| Version | 0.1.0 |
| Status | Approved |
| Owner | Codex |
| Created | 2026-01-09 |
| Updated | 2026-01-09 |
| Related Design | `docs/spec/20260109-1257-hover/design.md` |
| Related Plan | `docs/spec/20260109-1257-hover/implementation.md` |

## Background / Problem
当前聊天消息 UI 存在两类视觉问题：
1. 消息工具栏（编辑/复制/删除等）在鼠标 hover 触发显示时，会导致消息底部区域高度变化，出现“下方像增加了 padding”的抖动/跳动感。
2. 助手消息渲染的代码块在某些长行场景会出现内容或背景超出边界的情况，视觉上“溢出边框”，影响可读性。

## Goals
- Hover 显示消息工具栏时不发生布局抖动（无高度变化、无列表位移）。
- 代码块在任何长度内容下都不应溢出消息容器边界；长行应以最佳实践方式处理。
- 改动最小化，仅针对消息渲染与样式，不影响消息内容与功能行为。

## Non-Goals / Out of Scope
- 不调整消息列表结构、消息数据结构、后端接口。
- 不引入新的 Markdown 渲染库/高亮主题，仅修正样式与容器行为。
- 不新增“代码自动换行开关”等额外功能（本次仅采用最佳实践默认值）。

## Functional Requirements

### R1: 消息工具栏 Hover 不抖动
**User Story:** 作为用户，我希望在 hover 消息时显示操作按钮，但界面不发生上下跳动，以便更流畅地操作消息。

#### Acceptance Criteria
- [ ] WHEN 鼠标移入/移出任意用户消息或助手消息 THEN 消息列表不发生垂直位移（验证：对比 hover 前后相邻消息位置）。
- [ ] WHEN hover 触发显示/隐藏按钮 THEN 消息底部信息区域高度保持固定（验证：视觉观察 + DevTools 观察 DOM 高度不变）。
- [ ] WHEN 非 hover 状态 THEN 仍可正常显示时间/统计信息，不被按钮遮挡。

### R2: 助手消息代码块不溢出边界
**User Story:** 作为用户，我希望代码块始终在消息容器内部展示，并对长行提供可预期的阅读方式，以便正确阅读与复制代码。

#### Best Practice Decision
- 默认采用“水平滚动”而不是强制换行：保留代码格式与对齐，长行在代码块内横向滚动查看。

#### Acceptance Criteria
- [ ] WHEN 代码块出现超长行 THEN 代码块背景与内容均不溢出消息容器边界（验证：长行样例观察右侧边界）。
- [ ] WHEN 代码块内容超宽 THEN 可在代码块内部横向滚动查看完整内容（验证：滚动条/触控板横向滚动生效）。
- [ ] WHEN hover 代码块 THEN 复制按钮正常显示且可用。

## Verification
- 手动验证：
  - hover 任意消息：确认不抖动。
  - 使用包含超长行的代码块消息：确认不溢出且可横向滚动。
- 自动验证：在仓库根目录运行 `npm run build`，确保前端改动可编译通过。

## Change Log
| Version | Date | Description | Author |
| ------- | ---- | ----------- | ------ |
| 0.1.0 | 2026-01-09 | 初版需求：修复 hover 抖动与代码块溢出 | Codex |
