# 修复消息工具栏 Hover 抖动与代码块溢出 - 实施计划

## Metadata
| Field | Value |
| ----- | ----- |
| Version | 0.1.0 |
| Status | Approved |
| Owner | Codex |
| Created | 2026-01-09 |
| Updated | 2026-01-09 |
| Requirements | R1, R2 |

## Affected Areas
- `frontend/src/components/message/MessageItem.vue`
- `frontend/src/components/common/MarkdownRenderer.vue`

## Tasks

- [ ] T1. 固定消息底部区域高度，消除 hover 抖动
  - Owner: Codex
  - Steps:
    - 调整 `MessageItem.vue` 中 `.message-footer` / `.message-footer-right` 的最小高度与对齐方式，使 hover 前后高度一致。
    - 保持按钮尺寸不变，不通过 hover 添加额外 padding。
  - Verification Checklist:
    - [ ] hover 用户/助手消息时列表不跳动
    - [ ] 时间/统计信息仍可读且不被遮挡
  - Files:
    - `frontend/src/components/message/MessageItem.vue`

- [ ] T2. 修正代码块滚动与边界，避免溢出
  - Owner: Codex
  - Steps:
    - 调整 `MarkdownRenderer.vue` 的代码块样式：`pre.code-block-wrapper` 保持容器内滚动；`code` 使用 `inline-block + min-width: 100%` 让滚动宽度跟随内容。
    - 必要时为消息容器补充 `min-width: 0` 以避免 flex 下的长内容撑破布局。
  - Verification Checklist:
    - [ ] 长行代码块不溢出消息容器边界
    - [ ] 代码块可横向滚动查看完整内容
    - [ ] 复制按钮 hover 可用
  - Files:
    - `frontend/src/components/common/MarkdownRenderer.vue`
    - `frontend/src/components/message/MessageItem.vue`（如需 `min-width: 0`）

- [ ] T3. 构建验证（必须）
  - Owner: Codex
  - Command: `npm run build`
  - Verification Checklist:
    - [ ] 命令退出码为 0

- [ ] T4. 提交与推送
  - Owner: Codex
  - Steps:
    - `git status` 确认变更
    - `git commit -m "...“` 生成提交
    - `git push` 推送到当前分支
  - Verification Checklist:
    - [ ] push 成功

## Manual Verification Notes
- 准备一条包含长行代码块的助手消息（或使用已有消息），观察是否出现右侧溢出。
- 在消息列表中反复 hover（进/出）多条消息，确认不再有高度跳动。
