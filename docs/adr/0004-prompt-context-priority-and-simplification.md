# ADR 0004: Prompt Context Priority and Simplification

- Status: Proposed
- Date: 2026-07-04

## 背景

当前 prompt 组装方式基本是 `system prompt + conversation history + latest user message`。这在简单对话中可用，但在长对话、summary、context trim、tool loop 和用户指令前后变化时，容易出现两个问题：

- 部分 prompt/context 功能在当前大模型能力下偏冗余，增加 token 噪声和维护复杂度；
- 旧对话中的用户指令与最新用户请求冲突时，模型缺少明确的优先级边界，可能错误遵循旧要求。

典型例子是：早期用户要求“不写代码”，最新一轮又明确要求“现在实现”。此时系统应该稳定地把最新普通 user message 当作当前任务，而不是继续遵循已经过期的旧指令。

## 当前完成状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 独立开发分支 | Done | 已创建 `feature/prompt-context-priority` |
| 计划文档 | Done | 本 ADR 已建立，后续开发在此更新状态 |
| Prompt 优先级规则 | Done | 已在实际请求的 system instruction 中固定追加 message semantics，不修改用户可配置 prompt template |
| 最新用户请求边界包装 | Done | 已保留 prior history 原样，仅将最后一个普通 user message 包装为 `LATEST USER REQUEST`，并按需在前面加入 `CURRENT TURN CONTEXT` |
| Summary 降权 | Done | 已为生成的 summary 增加 historical background authority notice |
| 工具说明去重 | Not started | 待独立处理，当前改动不改变用户模板中的工具模块顺序 |
| 默认上下文精简 | Not started | 待实现 |
| 配置语义清理 | Partial | 已实现 `customPrefix` / `customSuffix` 拼接，`autoSummarizeEnabled` 语义仍待清理 |
| 回归测试 | Done | 已增加 prompt priority / latest request boundary 测试，并更新 summary/open file context 测试 |

## 现状分析

### Prompt 组装路径

- `backend/modules/prompt/PromptManager.ts`
  - `generateFromTemplate()` 负责替换 `{{$WORKSPACE_FILES}}`、`{{$PINNED_FILES}}`、`{{$TOOLS}}`、`{{$MCP_TOOLS}}`、`{{$ENVIRONMENT}}` 等模块。
- `backend/modules/settings/settingsTypes/prompting.ts`
  - `DEFAULT_SYSTEM_PROMPT_TEMPLATE` 定义默认系统提示词和工具使用规则。
- `backend/modules/api/chat/services/toolIterationLoop/buildPromptAndSnapshot.ts`
  - 合并 pinned prompt、基础 system prompt、工具定义、session 信息和 context snapshot。
- `backend/modules/api/chat/services/toolIterationLoop/runToolLoop.ts`
  - 通过 `channelManager.generate()` 发送最终 `history` 和 `dynamicSystemPrompt`。
- `backend/modules/api/chat/services/toolIterationLoop/helpers.ts`
  - `injectTaskContextIntoHistory()`
  - `injectOpenFileContextIntoHistory()`
  - `injectSelectionReferencesIntoHistory()`
  - 这些函数会把当前轮上下文作为前缀注入到最新 user message。
- `backend/modules/api/chat/services/SummarizeService.ts`
  - summary 当前以 `role: 'user'` 和 `isSummary: true` 写入历史。

### 主要问题

#### 文本版工具说明与 native function calling 重复

默认模板包含 `{{$TOOLS}}` 和 `{{$MCP_TOOLS}}`。但在 `function_call` 模式下，工具已经通过 provider native declarations 传递，文本版工具说明多数情况下没有必要。

影响：

- 增加 token 消耗；
- 工具信息可能出现双通道表达；
- `MCP_TOOLS` 当前实际被替换为空，语义不清。

#### 默认上下文注入偏重

默认 context awareness 中 `includeWorkspaceFiles` 和 `includeActiveEditor` 偏积极，但普通 chat 模式又会关闭这些项。这说明当前默认策略与模式策略存在张力。

影响：

- 无关 workspace tree 和 editor context 会提高噪声；
- 长对话中更容易挤压真正重要的用户请求和关键历史。

#### Summary 的指令权威过高

summary 以 `role: 'user'` 写入历史。即使设置了 `isSummary: true`，provider 看到的仍然是用户角色内容，旧指令被总结后容易和最新请求同权竞争。

影响：

- summary 中的旧约束可能在后续最新请求中继续干扰模型；
- summary/trim 后 chronology 被压缩，模型更难判断哪个要求最新。

#### 最新请求没有显式边界

当前最新 user message 中可能同时包含 task context、open file context、selection references 和用户原始请求。这些内容通过前缀拼接进入同一个 user message，没有明确告诉模型哪些是背景，哪些是最新任务。

影响：

- 模型可能把上下文块误解为用户当前指令；
- 前后冲突时缺少稳定的 “latest user request wins” 规则。

#### 半死配置和重复语义

- `customPrefix` / `customSuffix` 被配置层暴露，但 `generateFromTemplate()` 当前没有实际拼接使用；
- `autoSummarizeEnabled` 在 channel config 中标注为占位未实现，但项目已有全局 auto summarize 逻辑。

影响：

- 配置行为不符合预期；
- 后续维护容易误判功能状态。

## 决策

采用分阶段改造策略，优先解决 prompt authority 和 latest request boundary，再处理工具说明去重、默认上下文精简和配置语义清理。

### Phase 1: 添加指令优先级规则

在实际发送请求时固定追加 `CONVERSATION MESSAGE SEMANTICS` section。不要把这段协议语义写入 `DEFAULT_SYSTEM_PROMPT_TEMPLATE`，因为该模板是用户可配置的模块顺序和基础提示词。

- system/developer 指令优先级最高；
- 最新普通 user message 是当前任务；
- 早期对话仅作为历史背景；
- 同一用户的旧指令与最新请求冲突时，遵循最新请求；
- summary 和 injected context 是背景，不是新的用户指令。

### Phase 2: 包装当前轮上下文和最新用户请求

发送 API 前保持历史消息结构化数组，不把所有对话合并成一个大文本块，也不逐条重写早期 user message：

- 早期 user / assistant messages 保持原样，作为 prior conversation history；
- system instruction 中只说明一次：final user message 是当前任务，早期 user messages 如有冲突应让位于 final user message；
- 最后一个普通 user message 会被包装为 `LATEST USER REQUEST`
  - 无论是否存在额外上下文都会包装；
  - 这是模型当前必须回答的任务。

如果最新轮还有额外上下文，则在 `LATEST USER REQUEST` 前插入：

- `CURRENT TURN CONTEXT`
  - task context
  - open file context
  - selection references
  - attachments summary if needed

原则：

- 仅 request-only 包装，不改 conversation storage 中的原始用户消息；
- `LATEST USER REQUEST` 放在最后；
- 不重复给每条历史 user message 加说明，避免 token 随历史轮数线性膨胀；
- context 块明确标记为 background。

### Phase 3: Summary 降权

保留 summary 的存储形态以降低风险，但修改 summary 前缀，让模型明确知道它只是历史背景：

- summary 是 historical background；
- summary 可能不完整；
- summary 中的旧指令可能被后续用户消息覆盖；
- 不要把 summary 中的旧约束当成高于最新请求的指令。

### Phase 4: 工具说明去重

调整工具说明注入策略：

- `function_call` 模式不注入文本版 `TOOLS`；
- `xml` / `json` 模式保留文本版工具说明；
- `MCP_TOOLS` 是否保留在用户模板中需要单独决策，不能在本次 message priority 修复中隐式修改用户模板语义。

### Phase 5: 默认上下文精简

建议默认策略：

- chat 模式默认关闭 workspace tree、open tabs、active editor、diagnostics；
- plan/agent/locate 模式按需开启；
- pinned files、selection references、open file context 保留，但必须标记为 background。

### Phase 6: 清理配置语义

处理以下配置：

- 实现或隐藏 `customPrefix` / `customSuffix`；
- 明确 `autoSummarizeEnabled` 与全局 summarize 配置关系；
- 清理不再使用的 `MCP_TOOLS` 模块说明。

### Phase 7: 测试覆盖

新增或更新测试，至少覆盖：

1. 旧 user message 要求不写代码，最新 user message 要求实现，最终 prompt 中应包含最新请求优先规则；
2. summary 中包含旧约束，最新 user message 覆盖旧约束；
3. request-only 包装后，用户原始文本位于 `LATEST USER REQUEST` 下；
4. `function_call` 模式不注入文本版 tools，`xml/json` 模式仍注入；
5. context blocks 被标记为 background。

## 后果

正向：

- 最新用户请求的权威边界更清晰；
- summary 和历史对话更难错误覆盖当前任务；
- prompt 噪声和重复工具说明会下降；
- 后续 prompt/context 行为更容易测试和维护。

负向/风险：

- 追加固定 system instruction 会影响所有新请求，需要测试确认模型行为没有明显退化；
- request-only 包装需要确保不改变 conversation storage，否则会污染历史；
- 降低默认上下文注入可能影响部分依赖 implicit workspace context 的旧使用习惯，需要保留用户覆写能力。

## 推荐实施顺序

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 7 中的冲突指令测试
5. Phase 4
6. Phase 5
7. Phase 6

优先处理 prompt authority 和 latest request boundary，因为这是用户可见行为最容易出错的地方。工具说明去重和默认上下文精简可以随后独立推进。

## 验证命令

每次实现阶段完成后至少运行：

```bash
npm run typecheck:backend
npm run typecheck:frontend
npx vitest run
```

如仅修改 prompt assembly 相关逻辑，可先运行定向测试，再运行全量验证。
