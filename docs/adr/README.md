# ADR

本目录用于存放本项目的 Architecture Decision Records（ADR），用于记录“为什么这么做”，而不仅是“做了什么”（后者更适合放在 `CHANGELOG.md`）。

## 约定

- 编号：使用 4 位数字递增（例如 `0001`、`0002`），避免重排带来的链接/引用断裂。
- 文件名：`NNNN-short-title.md`（title 使用英文短横线，便于稳定引用）。
- 状态：`Proposed` / `Accepted` / `Deprecated` / `Superseded`。
- 内容：优先覆盖背景、约束、决策、后果与替代方案；尽量聚焦“决策点”，避免把实现细节当成 ADR 主体。

## 何时需要新增/更新 ADR

- 引入新的抽象边界或组件职责调整（例如新增 UI-only tool、改变消息聚合规则）。
- 改变安全模型或默认行为（例如工具自动执行、命令风险/只读判定策略）。
- 引入新的持久化格式或迁移逻辑（例如设置存储、SecretStorage 迁移）。

## 索引

- `0001-record-architecture-decisions.md`
- `0002-group-consecutive-read-only-tool-output.md`
- `0003-expose-thinking-effort-in-composer.md`
