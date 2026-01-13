# Lim Code TODO List

> 目标：记录 Lim Code 在“可用性、可控性、工程闭环、扩展生态”上的关键欠缺点与改进方向，便于后续按优先级拆分任务实施。

## Branch ↔ TODO 映射（已落地/已合并到 dev）

- `feature/context-inspector` → P0/上下文：系统提示词模块预览、工具声明/定义预览、历史裁剪信息展示、`Context Used` 快照、Copy debug info
- `feature/checkpoint-write-file` → P0/可靠性：工具执行前 checkpoint + Restore checkpoint
- `feature/validation-presets` → P0/可靠性：改动后校验提示卡片（build/test/lint presets）+ 结果回写对话
- `feature/auto-locate-next-step` → P0/可靠性：`execute_command` 失败一键跳到首个报错位置
- `feature/plan-runner` → P1/Plan：Plan & Run（逐步执行、暂停/继续/取消、状态持久化恢复）
- `feature/plan-runner-plan-attachments` → P1/Plan：步骤级图片附件注入
- `feature/plan-runner-step-rerun-icon` → P1/Plan：步骤级重执行（refresh icon）
- `feature/fix-gemini-duplicate-responses` → Bugfix：Gemini 重复回答（history role 归一化）
- （历史）`feature/skills-install-url` → P2：支持通过 URL 安装 skill（GitHub 仓库）
- （历史）`feature/skills-in-prompt` → P2：Prompt 页支持选择 skill / 自定义 prompt（仅对当前对话生效）

## P0（最影响体验，优先做）

- [ ] **上下文可控性与可解释性不足**
  - [ ] 在每次发送前/后可视化“本次注入了哪些上下文”（系统提示词模块、Pinned Files、Skills、附件、历史裁剪信息）与粗略 token 占用。
    - [x] 系统提示词模块预览（按 `====` 分段）
    - [x] 工具声明/工具定义预览（含 MCP 数量统计；xml/json 模式展示 definition）
    - [x] 历史裁剪信息展示（full/trimmed/trimStartIndex/lastSummaryIndex）
    - [ ] Pinned Files / Skills / 附件 的实际注入明细
    - [ ] 按模块粗略 token 占用拆分（而非仅总占用百分比）
  - [ ] 对话内落一条可折叠的 `Context Used / Context Trimmed` 摘要，支持复制调试信息用于复现问题。
    - [x] 每条助手消息保存 `Context Used` 快照（按钮打开弹窗查看）
    - [x] 支持复制调试信息（Copy debug info）
    - [ ] 将摘要以“消息卡片”形式落到对话流中（可折叠/可引用）
  - [ ] 支持“本次消息级”临时开关（仅本条生效）与“全局设置”联动，避免用户每次去设置页改。
    - [ ] 仅本条生效的注入开关（Pinned Files / Skills / Diagnostics / Tools 等）
    - [ ] 与 Settings 全局默认值联动（发送时可覆写）

- [ ] **代码改动的可靠性链路不完整（改动→校验→回滚）**
  - [x] 工具执行前自动创建 checkpoint；失败可一键回滚（Restore checkpoint）
  - [x] 改完引导用户运行最相关的 build/test/lint（可配置预设），并把结果回写到对话（可折叠）。
  - [ ] 失败时提供“自动定位下一步”（比如打开错误文件、跳转到报错行、提供建议的下一条命令）。
    - [x] `execute_command` 输出识别 `path:line:col` 并支持一键跳转
    - [ ] 基于错误类型给出建议的下一条命令

- [ ] **差异/补丁工作流不够顺滑**
  - [ ] 更强的 diff 审阅体验（分块/hunk 级 apply/undo、冲突提示）。
  - [ ] 与 git 联动的最小化操作（仅展示本次改动文件、可选 stage/unstage）。

## P1（明显增益，但需要一定设计/工程投入）

- [ ] **多步任务控制面薄弱（Plan/执行/恢复）**
  - [ ] 先做 `Plan Only`：生成可审阅计划卡片（步骤、验收标准、附件 alias 映射）。
    - [x] 支持创建/编辑 plan（title/goal/steps/instruction）
    - [ ] 验收标准字段
    - [ ] 附件 alias 映射展示
  - [x] 再做 `Plan & Run`：PlanRunner 逐步执行、暂停/继续/取消、游标恢复（重启 VS Code 也能继续）。
    - [x] 面板：Start/Resume、Pause、Cancel、Clear
    - [x] 状态持久化到对话 metadata（重启后可继续）
    - [x] 步骤级重执行（refresh icon）
  - [ ] 步骤级附件重注入：每步只携带必要附件，避免上下文裁剪导致“忘图/忘文件”。
    - [x] 每步支持图片附件（Plan 创建/执行时注入）
    - [ ] 支持非图片附件 + alias 映射

- [ ] **模型与工具的能力路由较弱**
  - [ ] 提供轻量“意图/模式”或策略（Ask/Explain vs Edit/Fix vs Agent），影响工具调用倾向与自动执行策略。
  - [ ] 工具调用显示“为什么调用/预计影响/是否危险”，并支持一键切换确认策略（自动/手动）。

- [ ] **检索能力偏文件级/关键词**
  - [ ] 深度利用 LSP：符号、定义/引用、调用链、结构摘要的自动提取与注入。
  - [ ] 可选接入语义检索（本地服务或 MCP），实现“语义找文件/片段”，并可视化命中来源。

## P2（生态与长期体验）

- [ ] **扩展生态与分发（skills/MCP）产品化不足**
  - [x] 支持通过 URL 安装 skill（GitHub 仓库）
  - [x] Prompt 页支持选择 skill / 自定义 prompt（仅对当前对话生效）
  - [ ] curated 列表（元数据、版本、作者、风险提示），支持一键安装/更新/禁用。
  - [ ] 对带 `scripts` 的 skill 做权限提示与隔离（路径与执行范围），降低误用/滥用风险。
  - [ ] MCP 配置体验优化：模板、导入/导出、健康检查与一键诊断。

- [ ] **性能与成本管理不足**
  - [ ] 每轮 token 预算与占用明细（系统提示词、文件树、诊断、历史、附件、工具返回）。
  - [ ] 自动收敛策略：先发小上下文→不足再工具检索/读取；高成本模块做上限与缓存。
  - [ ] 成本/耗时统计：按对话/按渠道/按工具汇总，支持限额与告警。
