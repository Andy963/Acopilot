# ADR 0002: Group Consecutive Read-only Tool Output

- Status: Accepted
- Date: 2026-01-29

## 背景

在工具调用密集的对话中，模型往往会产生大量“只读型”工具调用（例如重复 `read_file`，以及 `git diff` / `rg` 之类的只读命令）。

这些调用在 UI 中按“一次调用一张卡片”展示会导致：

- 视觉噪音显著，用户难以快速定位关键结果；
- 对话滚动距离变长，影响回溯效率；
- 连续的只读信息本质上是一个批次的“上下文采集”，适合以组为单位展示。

在终端类工具中，这类只读调用的结果通常表现为“连续的日志/命令输出”，同样适合以批次聚合的方式降低噪音。

## 约束

- 不改变工具执行语义：该决策仅影响“提示词引导/展示层聚合”，不改变工具本身的权限与执行结果。
- 安全优先：聚合只允许覆盖“可证明只读”的调用；判定失败时必须回退到逐条展示。
- 可回溯：聚合后仍需要能查看每条调用的参数/结果，并保留原始顺序。
- 不跨越语义边界：当中间出现正文消息、不同类型工具、或任何可能产生工作区变更的调用时，不进行聚合。

## 决策

对“连续同类型且只读”的工具调用进行 UI 聚合，规则如下：

- `read_file`：同一段连续调用合并展示，作为一个组渲染。
- `execute_command`：仅当命令被判定为只读，且工具执行结果明确显示工作区无变更时，才允许聚合；否则逐条展示。
- 跨消息聚合仅适用于“无正文 + 仅工具”的 assistant 消息，避免吞并模型解释文本。

只读判定策略采用“保守白名单 + 明确反例拒绝”的方式：

- 允许的 `git` 子命令仅限只读类（例如 `diff` / `status` / `log` 等）。
- 显式拒绝重定向（例如 `>`）、`tee`、`sed -i` 及常见写操作（例如 `rm` / `mv` / `cp` 等）。
- 只要存在任何不确定性（例如缺少变更摘要、出现 unsupported reason），则不聚合。

## 后果

- 正向：
  - 显著降低连续工具调用带来的刷屏噪音；
  - 保留可展开查看的能力，同时让“采集阶段”更易被识别为一个批次。
- 负向/风险：
  - 只读判定基于启发式白名单，覆盖范围需要随使用场景演进；
  - 过度聚合可能弱化时间线的细粒度边界（通过“不跨正文/不跨变更”的规则缓解）。

## 替代方案

- 默认折叠所有工具卡片：实现简单，但会隐藏关键信息，且对“需要快速扫一眼参数/摘要”的场景不友好。
- 只做虚拟列表/渲染优化：改善性能但不解决信息结构问题，噪音仍然存在。
- 让模型输出更少工具调用：不稳定，且对不同模型/提示词敏感；只能作为辅助手段。

## 实现参考

- 只读命令判定：`frontend/src/utils/commandReadOnly.ts`
- 工具聚合渲染：`frontend/src/components/message/MessageList.vue`、`frontend/src/components/message/ToolMessage.vue`
- UI-only 分组工具：`frontend/src/utils/tools/terminal/execute_command_group.ts`、`frontend/src/components/tools/terminal/execute_command_group.vue`
- `read_file` 降噪提示与批量引导：`backend/tools/file/read_file.ts`、`backend/modules/settings/types.ts`
