# 修复消息工具栏 Hover 抖动与代码块溢出 - 设计

## Metadata
| Field | Value |
| ----- | ----- |
| Version | 0.1.0 |
| Status | Approved |
| Authors | Codex |
| Stakeholders | 维护者 / 使用者 |
| Created | 2026-01-09 |
| Last Updated | 2026-01-09 |
| Related Requirements | `docs/spec/20260109-1257-hover/requirements.md` |
| Related Implementation Plan | `docs/spec/20260109-1257-hover/implementation.md` |

## Context
该改动仅涉及前端 Webview 的聊天消息渲染（Vue 组件 + CSS）。目标是消除 hover 造成的布局变化，并保证代码块在长行场景下的渲染边界正确。

## Current State
### 1) 消息工具栏 Hover 抖动
- `MessageItem` 组件在 hover 时才插入/显示 `MessageActions`（按钮尺寸 24px）。
- 非 hover 状态下右侧仅显示时间/统计（高度较小），hover 后按钮出现使底部区域高度变大，导致列表出现“上下跳动”。

### 2) 代码块溢出边界
- `MarkdownRenderer` 自定义高亮输出结构为：`pre.code-block-wrapper > button + code`。
- 目前 `code` 使用 `display: block`。在长行/高亮 span 组合场景下，可能出现滚动宽度计算不一致，导致内容或背景在视觉上出现“溢出边界”。

## Target State
### A) 固定底部区域高度，消除 hover layout shift
设计原则：hover 只做视觉变化（opacity/显隐），不改变布局高度。

方案：
- 为消息底部（footer）设置固定最小高度（与按钮高度一致），使 hover 前后 footer 高度一致。
- `MessageActions` 仍可按 hover 控制出现/消失，但 footer 的高度不会因按钮出现而变化。

### B) 代码块：容器内横向滚动，不溢出
设计原则：默认不强制换行，保留代码格式，通过代码块内部滚动承载长行。

方案：
- `pre.code-block-wrapper` 保持 `overflow-x: auto`，并补充 `max-width: 100%` 与 `box-sizing: border-box`，确保边界受控。
- 将 `pre.code-block-wrapper code` 调整为 `display: inline-block` 并设置 `min-width: 100%`，让滚动宽度由实际内容决定，避免长行渲染溢出。
- 视需要补充 flex 场景的 `min-width: 0`，避免长内容影响父级布局计算。

## Alternatives Considered
- **强制换行（wrap / pre-wrap）**：阅读更“窄屏友好”，但会破坏代码对齐/可复制性；且换行策略（anywhere / break-word）对代码语义可能产生误导。
- **自适应扩展背景**：会撑破消息容器宽度，破坏整体布局，不符合聊天 UI 最佳实践。

结论：默认采用“代码块内部横向滚动”。

## Risks & Mitigations
- 风险：footer 固定最小高度会让未 hover 时底部区域略显“更高”。
  - 缓解：高度与按钮一致（24px），不额外增加 padding；整体视觉更稳定。
- 风险：代码块 `code` 的 display 改动可能影响复制按钮遮挡或行高。
  - 缓解：保持 `pre` padding 与现有按钮定位不变；通过手动长行样例验证。

## Verification
- hover 任意消息：确认列表无抖动。
- 长行代码块：确认不溢出且可在代码块内部横向滚动。
- `npm run build`：确认编译通过。
- 数据保护：{data_protection}
- 合规要求：{compliance_requirements}

### 9.4 Performance & Capacity
- 目标指标：{performance_targets}
- 负载预估：{capacity_assumptions}
- 优化手段：{optimization_strategies}

## 10. Testing & Validation Strategy
> 定义验证计划，确保设计目标在交付时被验证。
| 测试类型 | 目标 | 关键场景 | 负责人 |
| -------- | ---- | -------- | ------ |
| 单元测试 | {unit_goal} | {unit_cases} | {owner} |
| 集成测试 | {integration_goal} | {integration_cases} | {owner} |
| 端到端 | {e2e_goal} | {e2e_cases} | {owner} |
| 数据验证 | {data_goal} | {data_checks} | {owner} |

## 11. Alternatives & Decision Log
> 记录考虑过的方案及决策依据，便于后续回溯。
| 选项 | 描述 | 优势 | 劣势 | 决策 |
| ---- | ---- | ---- | ---- | ---- |
| {option_a} | {summary} | {pros} | {cons} | Accepted / Rejected |

## 12. Risks & Mitigations
> 梳理潜在风险与应对措施，支撑风险管理。
| 风险 | 影响 | 概率 | 缓解措施 |
| ---- | ---- | ---- | -------- |
| {risk_item} | {impact} | {likelihood} | {mitigation} |

## 13. Assumptions & Dependencies
> 列出关键假设及外部依赖，确保各方认知一致。
- 假设：{assumption}
- 依赖：{dependency}
- 触发条件：{trigger}

## 14. Implementation Notes (高层次)
> 给出实施的概览安排，为实施计划提供输入。
- 阶段划分：{phase_summary}
- 关键里程碑：{milestones}
- 回滚策略：{rollback_plan}
- 验证完成标准：{definition_of_done}

## 15. Appendix (可选)
> 归档支持材料或扩展信息，便于查阅。
- 参考链接：{references}
- 术语表：{glossary}
- 其他补充材料：{appendices}
