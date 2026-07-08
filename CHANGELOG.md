# Change Log

All notable changes to the "Acopilot" extension will be documented in this file.

## [1.1.6] - 2026-07-08

### Improved
  - Webview navigation: move New Chat, History, and Settings into a spaced Acopilot toolbar instead of relying on native view title action ranks.

## [1.1.5] - 2026-07-08

### Removed
  - Composer: remove the Context guide chip and info icon from the input toolbar.

## [1.1.4] - 2026-07-08

### Improved
  - Channel Settings: add vertical spacing between the model filter, model list, and manual model ID input.

## [1.1.3] - 2026-07-08

### Improved
  - Webview navigation: add a main view registry for chat, history, and settings metadata.
  - Settings navigation: remember the last opened settings tab across Webview reloads.
  - First-run setup: route settings entry to Channel settings when no model configuration is available.

## [1.1.2] - 2026-07-08

### Improved
  - VS Code entry menus: add History to the Acopilot view title actions and standardize command titles under the `Acopilot:` namespace.
  - Chat references: distinguish file and selection injections in payload metadata, composer chips, and user notifications.

## [1.1.1] - 2026-07-08

### Improved
  - Input: clarify `@file`, attachments, and pinned context lifecycles, with attachment support, token, and truncation indicators.
  - Context Settings: harden ignore glob previews against invalid pattern text.
  - Tools Settings: fix tool enablement and auto-exec controls, add `replace_in_files` configuration, and require confirmation for replacement auto-exec by default.
  - Image Generation Settings: add explicit provider selection, normalized limits, safe connection testing, and provider-specific tool schemas.

## [1.1] - 2026-07-07

### Added
  - Channel Settings: add connection testing and model capability summaries for configured chat channels.
  - Prompt Settings: add prompt template history, validation, variable autocomplete, and clearer Prompt Skill lifecycle guidance.
  - History: add richer search, sorting, grouping, and multi-select cleanup actions.

### Improved
  - Context Settings: preview workspace file tree, diagnostics, ignore-pattern matches, and estimated token or character costs.
  - Context Inspector: add bidirectional navigation with Context Settings and richer request context breakdowns.
  - Tools Settings: embed dependency management and add inline missing-dependency installation flows.
  - Summary Settings: improve summarization retention, visibility, regeneration, and continuation-state handling.
  - Pinned Context: clarify pinned files, prompts, and skills, and persist reusable prompt selections.

### Fixed
  - Chat: keep the latest user request authoritative over older history and summaries.
  - Chat: improve context token accounting, context snapshot preservation, and summary rendering stability.
  - UI: improve welcome, composer, history, prompt, dependency, and context settings workflows.

## [1.0.62-pre.10] - 2026-07-07

### Improved
  - Context Settings: preview workspace file tree, diagnostics, and ignore-pattern matches alongside active editor and open tabs.
  - Context Settings: show estimated token and character cost per context module and for the total configured context.
  - Context Settings: add a “View current context” bridge to Context Inspector and a return action from Context Inspector back to Context Settings.
  - Context Settings: validate ignore patterns with matched file counts and sample files.
  - Context Settings: add diagnostics presets for errors only, open files first, and current workspace.
  - Tools Settings: keep tool dependencies as an embedded Tools accordion instead of a visually separate settings page.

## [1.0.62-pre.9] - 2026-07-07

### Improved
  - Tools Settings: move dependency management into the Tools page and remove the standalone Dependencies settings entry.
  - Tools Settings: dependency warnings now link back to Tools Settings and keep the embedded dependency panel in sync after inline installs.
  - Dependencies: rename the embedded management section to Tool Dependencies to reflect that dependencies are only used by tools.

## [1.0.62-pre.8] - 2026-07-07

### Improved
  - Prompt Settings: add local prompt version history with restore support before saving or resetting templates.
  - Prompt Settings: validate empty, unknown, and duplicated template variables before saving.
  - Prompt Settings: add variable autocomplete while editing system prompt templates.
  - Prompt Settings: clarify Prompt Skills versus pinned skill selection lifecycle.
  - Prompt Settings: mark template token counts as estimates before dynamic variable expansion.

## [1.0.62-pre.7] - 2026-07-06

### Improved
  - Dependencies: Tools Settings now offers one-click installation for missing dependencies directly from each affected tool.
  - Dependencies: uninstall confirmation now lists tools that will be affected before removing a shared dependency.
  - Dependencies: installation and uninstall failures now expose copyable diagnostic logs with redaction applied to backend logs.
  - Dependencies: the settings page now explains how dependency install paths relate to the General storage path.

## [1.0.62-pre.6] - 2026-07-06

### Fixed
  - Summary messages: keep the latest context summary visible in the chat message list even when it falls outside the currently loaded/visible message window.
  - Context Inspector and the in-chat "Context Used" card now surface a summary preview (summarized message count, kept rounds, and cleaned preview text) so a completed summarization is actually visible after it succeeds.
  - Summary messages: strip the internal authority notice and title prefix consistently so only the real summary text is shown.
  - Composer footer: the "Summarize context" button now shows a loading state and is disabled while summarizing, instead of appearing unresponsive on click.

## [1.0.62-pre.5] - 2026-07-06

### Improved
  - Summary Settings: default context summarization retention now keeps the latest 10 rounds.
  - Composer footer: show the auto-summarize threshold in the token usage tooltip when enabled.
  - Summary messages: display the retained round count and generation time, and add regenerate/undo actions.
  - Summary Settings: warn when the dedicated summarization channel or model is missing and link back to Channel Settings.

### Fixed
  - Summary messages: regenerate summaries in place only after a replacement is successfully generated, so failures keep the existing summary.

## [1.0.62-pre.4] - 2026-07-05

### Added
  - Channel Settings: add a "Test Connection" action that validates the active URL, API key, and model with a minimal no-tools, no-retry request and redacts sensitive data from errors.
  - Channel Settings: show a model capability summary covering model metadata, context/output limits, tool protocol, multimodal, reasoning, prompt cache, and streaming state.

### Improved
  - Composer footer: make the context token ring visibly interactive, keyboard accessible, and clearer about opening the Context Inspector.
  - Composer footer: show the current summarization retention strategy in the manual summarize tooltip and refresh it after returning from settings.
  - Composer footer: replace the dead disabled model selector with a direct "Configure model" link when no model is configured.
  - Channel Settings: clarify that tool mode controls channel request protocol while tool enablement and auto-execution live in Tools settings.
  - Channel Settings: strengthen custom body and header validation with JSON object-root checks, error locations, duplicate/empty-key warnings, examples, reset, and clear actions.
  - Tests: add Vue aliasing for Vitest so frontend composable mocks resolve consistently.

## [1.0.62-pre.2] - 2026-07-05

### Improved
  - Pinned Context: rename "Pinned Files" to "Pinned Context" across the composer entry point and panel title, since the panel also manages skill and custom prompt selection, not just files.
  - Pinned Context: reorder the panel tabs to custom prompt, files, skill, and default to the custom prompt tab when no skill is actively pinned.
  - Composer: fix a misleading CSS class name on the "Plan & Run" button that still referenced the removed "create task" flow.

### Removed
  - Composer: remove the orphaned "Create Task" (GitHub issue → task) modal and its dead event wiring; it had no reachable UI entry point and no backend support.

## [1.0.62-pre.1] - 2026-07-05

### Improved
  - Welcome: show a primary "Configure Model" call-to-action when no channel/model is configured yet, so first-time users can reach setup immediately.
  - Welcome: display workspace info on recent conversations and add a more prominent history search entry.
  - History: extend search to match preview text, workspace, message count, and dates instead of title only.
  - History: add sort (updated/created/title/messages) and grouping (by date/workspace) controls.
  - History: add multi-select bulk management with delete-selected, delete-visible, and delete-by-group actions.
  - History: route all conversation deletion (welcome and history page) through a shared confirmation dialog showing the affected title or count.

## [1.0.61-pre.13] - 2026-07-05

### Fixed
  - Chat: restore the manual context summarization button in the composer footer so users can compact older conversation history on demand.
  - Chat: reset OpenAI Responses continuation and prompt-cache state after manual summarization so the next request uses the summarized history instead of stale response state.

## [1.0.61-pre.12] - 2026-07-04

### Added
  - Pinned Context: add a real global reusable prompt preset library under the custom prompt tab, so saved prompts can be selected again across projects without retyping or converting them into skills.

### Fixed
  - Pinned Context: restore selected prompt presets for new conversations in the same workspace and inject preset content from global settings.
  - Pinned Context: keep the custom prompt textarea tall enough to type and edit multi-line prompts after adding preset controls.

## [1.0.61-pre.11] - 2026-07-04

### Added
  - Pinned Context: persist reusable pinned prompt selections per workspace so new conversations in the same project restore the last selected skill.
  - Pinned Context: add a "save as skill" flow for custom pinned prompt text so prompts can be reused across conversations and projects without retyping.

### Fixed
  - Pinned Context: register the `skills.list` webview handler used by the pinned skill selector.
  - Pinned Context: avoid overwriting existing skills when saving a custom pinned prompt as a reusable skill.

## [1.0.61-pre.10] - 2026-07-04

### Fixed
  - Chat: keep prior conversation history unchanged while labeling only the final user message as `LATEST USER REQUEST`, so conflicting earlier user instructions do not override the latest request.
  - Chat: inject conversation-structure semantics into the actual request system instruction instead of the user-editable prompt template.
  - Chat: mark generated summaries as historical background so old summarized instructions cannot outrank the latest user request.

## [1.0.61-pre.9] - 2026-07-02

### Fixed
  - Chat: use CJK-aware character-to-token estimation instead of a uniform 4-chars-per-token heuristic, fixing systemic undercounting of Chinese/Japanese/Korean text in context-usage estimates.
  - UI: prioritize the provider's actual `usageMetadata` over the pre-request token estimate when computing the input-box context-usage ring, so completed turns match the per-message footer stats.

## [1.0.61-pre.8] - 2026-05-20

### Fixed
  - Chat: merge partial streaming usage metadata so Anthropic-style token chunks preserve prompt, output, and derived total counts.
  - Chat: prevent automatic context summarization from re-summarizing history before the latest summary, and avoid counting summary messages as normal user rounds.
  - UI: preserve explicit zero token values in context-window calculations.

## [1.0.61-pre.7] - 2026-05-15

### Fixed
  - Chat: count assistant message content and tool calls in context estimates so automatic summarization and trimming trigger before the model context overflows.
  - UI: show the backend estimated context usage in the token ring when available instead of relying only on provider response usage.

## [1.0.61-pre.6] - 2026-04-07

### Fixed
  - Chat: remove the redundant in-message "Context Used" block from the top of assistant replies while keeping the existing context inspector entry in the footer.

## [1.0.61-pre.5] - 2026-04-07

### Fixed
  - Chat: preserve the early `contextSnapshot` metadata across finalized streaming/tool-state updates so the in-message "Context Used" card stays available after tool loops and completion.
  - Chat: stop recursive history pagination reloads by keeping the `isLoadingMore` guard active until the next animation frame after restoring scroll position.

## [1.0.61-pre.3] - 2026-04-05

### Fixed
  - Proxy: route chat streaming, model discovery, MCP HTTP, and Codex skill downloads through Acopilot's own proxy setting when enabled, and fall back to direct connections when disabled.
  - MCP: skip invalid persisted MCP server entries instead of failing the full config load.
  - Chat: keep the "Context Used" card visible after streaming completes when a context snapshot exists.

## [1.0.61-pre.4] - 2026-04-03

### Fixed
  - Chat: stream an early context snapshot chunk so the "Context Used" card can render without waiting for generation to finish.
  - Chat: route the context snapshot to the active streaming message metadata for stable incremental rendering.

## [1.0.61-pre.2] - 2026-04-03

### Fixed
  - Chat: reserve the "Context Used" block at the top of the first assistant reply while streaming, then fill it in after completion to avoid late layout jumps when users are reading older content.
  - Chat: restore streaming auto-follow so new assistant output keeps the message list pinned to the latest content by default, and only pause follow mode after an actual user scroll.

## [1.0.61-pre.1] - 2026-04-02

### Improved
  - Build/Release: pin `@vscode/vsce` as a workspace dev dependency so VSIX packaging no longer depends on a transient `npx` install.

### Fixed
  - Settings: wrap long inline code and tag preview content in the context settings panel so long entries no longer overflow or force horizontal clipping.

## [1.0.61-pre.0] - 2026-04-01

### Improved
  - Build/Release: unify root validation, build, package, and smoke entrypoints around npm-driven workflows, and gate GitHub prereleases with validate/build/package steps.
  - Smoke: add both development-extension and packaged-VSIX smoke validation paths so the published artifact can be verified before testing.
  - Refactor: split several large extension/webview/frontend modules into smaller focused files, including extension bootstrap, ChatViewProvider bridge logic, app shell, plan modal, checkpoint settings, prompt skills, markdown rendering, and message-list orchestration.

### Fixed
  - Frontend: restore a green frontend typecheck baseline and remove several UI contract mismatches in settings, tools, and shared types.
  - UI: stabilize Acopilot view entry, chat/history/settings navigation, selection/file injection dedupe, and persisted language handling across reloads.
  - Runtime: make default config bootstrap honor the normal config/secret contract, bind streamed tool parsing to each request instead of ambient active config, serialize same-conversation writes, and prevent deleted conversations from being silently recreated.
  - Validation: harden malformed side-effect request rejection and persist post-edit validation preset execution through runtime, history, and reload flows.

## [1.0.60] - 2026-04-01

### Fixed
  - Chat: render TeX delimiters `\(...\)` and `\[...\]` in chat while preserving the existing `$...$` and `$$...$$` behavior.
  - Chat: preserve straight quotes for pseudo-math snippets like `"x ∈ ℝ"` and apply a math-oriented font stack to Unicode math symbols for more consistent inline rendering.
  - Chat: keep KaTeX layout styling without bundling KaTeX font assets into the VSIX, restoring the package size to the normal release range.
  - Webview: resolve built frontend script and style paths from `frontend/dist/index.html` so hashed asset names load correctly in the VS Code webview.

## [1.0.60-pre.9] - 2026-04-01

### Fixed
  - Chat: stop bundling KaTeX font assets into the VSIX while keeping the KaTeX layout rules needed for formula rendering.
  - Webview: resolve built frontend scripts and styles from `frontend/dist/index.html` so hashed asset names keep loading correctly.
  - Build: restore normal frontend asset naming instead of forcing every emitted asset to `index.css`.

## [1.0.60-pre.8] - 2026-04-01

### Fixed
  - Chat: preserve straight quotes in Markdown so pseudo-math snippets like `"x ∈ ℝ"` no longer get rewritten into smart quotes with mismatched glyphs.
  - Chat: load the official KaTeX stylesheet so TeX formulas use KaTeX's intended layout instead of a partial fallback.
  - Chat: apply a math-oriented font stack to plain Unicode math symbols outside TeX delimiters for more consistent pseudo-math rendering.

## [1.0.60-pre.7] - 2026-03-31

### Fixed
  - Chat: render KaTeX formulas in chat when messages use TeX delimiters `\(...\)` and `\[...\]`, while preserving the existing `$...$` and `$$...$$` behavior.

## [1.0.60-pre.6] - 2026-03-26

### Improved
  - Tool: split search and replace tools so `search_in_files` stays read-only while `replace_in_files` handles confirmed on-disk replacements, including allowlist propagation for confirmation/orphan execution.

### Fixed
  - Chat: keep streaming auto-follow pinned to the latest message without fighting user scroll, and show a "Jump to latest" action when follow mode is paused.

## [1.0.60-pre.5] - 2026-03-24

### Fixed
  - Channel: avoid double-consuming the response body for streaming error responses, preserving non-JSON payloads in error details.

## [1.0.60-pre.4] - 2026-03-19

### Changed
  - Refresh the pre-release cut from the latest `dev` baseline so the published VSIX aligns with the current release branch head.

## [1.0.60-pre.3] - 2026-03-19

### Fixed
  - Tool: stop leaking the full parent environment into `execute_command` child processes.
  - Tool: harden `execute_command` risk detection for privilege escalation and arbitrary command execution patterns.
  - UI: add accessible labels to message action buttons for screen-reader and tooltip parity.

## [1.0.60-pre.2] - 2026-03-12

### Fixed
  - Chat: stop rendering code-block copy buttons while assistant messages are still streaming, preventing hover flicker caused by repeated `v-html` subtree replacement.

## [1.0.60-pre.1] - 2026-03-12

### Fixed
  - Chat: restore pinned custom prompt persistence by wiring the Pinned Files panel to the correct handlers and persisting `pinnedPrompt.customPrompt` through conversation metadata.

## [1.0.59] - 2026-03-01

### Fixed
  - Settings: fix provider config fields not being persisted due to a missing handler binding.
  - Anthropic: improve Messages API request normalization (`/v1/messages`) and streaming error diagnostics.
  - Tool: restore risk confirmation prompt for high-risk `execute_command` calls.

## [1.0.59-pre.12] - 2026-03-02

### Fixed
  - OpenAI: prevent empty `Authorization` custom header values from overriding `apiKey` for both Chat Completions and Responses.
  - OpenAI: normalize `apiKey` by stripping a leading `Bearer ` prefix if present.

## [1.0.59-pre.13] - 2026-03-02

### Improved
  - Debug: include redacted request header info in API error details to help diagnose missing/empty Authorization headers.

## [1.0.59-pre.14] - 2026-03-02

### Changed
  - Debug: remove the temporary API request debug info injection added in `1.0.59-pre.13`.

## [1.0.59-pre.11] - 2026-02-11

### Fixed
  - Settings：修复“扩展依赖管理”的安装路径在窄屏下溢出，改为自动换行显示。

## [1.0.59-pre.10] - 2026-02-10

### Improved
  - Refactor：拆分多个超大前端组件（Message/ToolMessage/ExecuteCommand/WriteFile/ApplyDiff/InputBox 等）为 composables + utils，并抽离部分样式到独立 CSS；以保持行为一致为主，便于后续维护与演进。

## [1.0.59-pre.9] - 2026-02-08

### Improved
  - Chat/Plan：chat/plan 模式的工具迭代上限不再固定为 3/10，而是遵循全局设置 `maxToolIterations`（默认 50，支持 -1 无限制）。

## [1.0.59-pre.8] - 2026-02-05

### Added
  - Storage：启动时可选自动清理超过 30 天未更新的对话；同时删除该对话的 `checkpoints` / `diffs` / `snapshots` / 对话 JSON，以防止存储空间持续增长。

## [1.0.59-pre.7] - 2026-02-05

### Improved
  - UI：代码块高亮配色更贴近 VS Code 编辑器（Dark Modern）的语义化风格（comment/keyword/type/function/variable/string/number 等）。
  - UI：补全 highlight.js token class 的映射（operator/punctuation/literal/regexp/tag 等），减少“全都一个颜色”的观感。

## [1.0.59-pre.6] - 2026-02-04

### Improved
  - UI：代码块高亮改为 `highlight.js` core + language subset（`python/go/javascript/typescript/json/bash`），并在流式结束后再进行高亮，显著降低 webview bundle 体积并改善流式渲染性能。

## [1.0.59-pre.5] - 2026-02-04

### Fixed
  - Settings：修复 Tools/AutoExec 设置页分组无法展开（运行时异常导致内容区无法渲染）。
  - UI：修复 Pinned Skills 下拉选择器样式与可用性（对齐 VS Code dropdown 主题变量）。

## [1.0.59-pre.4] - 2026-02-04

### Added
  - Chat：chat 模式支持自动携带“当前打开文件上下文（Open File Context）”并注入到模型请求；支持选区范围、dirty buffer、预算限制与敏感路径过滤。

### Improved
  - Refactor：全仓库 TypeScript 源码按“单文件 <= 500 行”拆分，降低维护成本并提升可读性（以保持行为一致为主）。
  - UI：输入框自动高度调整逻辑优化，减少抖动并提升稳定性。

## [1.0.59-pre.2] - 2026-02-02

### Improved
  - UI：输入框底部选择器布局优化：Mode 移到 Model 前；Model 选中态仅展示模型名。
  - UI：模型下拉弹窗宽度与对齐策略调整，避免多余空白与文本被裁切。

## [1.0.59-pre.1] - 2026-02-01

### Added
  - Locate：支持自动/隐式触发模式，并支持在设置中自定义触发关键词；`/locate` 降级为兼容入口。

### Improved
  - Settings：修复 Locate 设置面板布局（输入框换行、保存按钮同行、滚动条更窄且与项目样式一致）。
  - UI：移除 Locate 输入区的“总结上下文”按钮。
  - Token：system prompt token 计数强制使用本地估算，避免额外 API 请求带来的延迟与费用。

### Removed
  - Settings：移除 Token Count 设置页/Tab。

## [1.0.58] - 2026-01-31

### Improved
  - UI：消息底部模型名跑马灯改为彩虹渐变流动效果（仅流式时显示）；在 `prefers-reduced-motion` / `forced-colors` 下自动降级为纯文本色。

## [1.0.58-pre.17] - 2026-01-29

### Improved
  - UI：连续只读工具调用（如 `read_file`、`execute_command` 的 `git diff` 等）支持自动聚合展示，减少刷屏；当中间出现非同类型工具/消息或命令导致工作区变更时不聚合。
  - 工具：强化 `read_file` 的批量读取与“先搜索再读取”指引，减少重复工具调用与上下文噪音。

## [1.0.58-pre.16] - 2026-01-29

### Improved
  - UI：输入区底部“思考强度”选择器改为仅显示英文值（low/medium/high/xhigh）并进一步缩窄宽度；当面板宽度不足时会自动隐藏该选择器以避免布局换行。

## [1.0.58-pre.15] - 2026-01-29

### Added
  - UI：输入区模型选择器右侧新增“思考强度”下拉（low/medium/high/xhigh），仅在 OpenAI 协议且模型名包含 `gpt` 时显示；切换会自动启用 reasoning 并写入对应 effort。

## [1.0.58-pre.14] - 2026-01-29

### Improved
  - UI：Pinned refs 展示改为仅显示文件名（basename），减少长路径占用与视觉噪音。

## [1.0.58-pre.13] - 2026-01-29

### Fixed
  - Settings：修正“启用/禁用渠道配置”按钮的眼睛图标语义，使其与实际状态一致（启用=eye，禁用=eye-closed）。

## [1.0.58-pre.12] - 2026-01-29

### Added
  - Settings：配置选择器支持“启用/禁用”渠道配置；禁用后会从统一模型选择中隐藏，并在当前配置被禁用时自动切换到一个仍启用的配置。

### Improved
  - UI：输入区模型选择器的下拉宽度改为跟随容器，避免窄屏下出现溢出或遮挡。

## [1.0.58-pre.11] - 2026-01-29

### Fixed
  - UI：Settings 的 Performance 区域在窄屏下布局溢出的问题（grid + input 宽度/最小宽度修正，520px 以下单列显示）。

## [1.0.58-pre.10] - 2026-01-26

### Fixed
  - 工具：修复 `search_in_files` 在 XML 解析出空 `replace` 时误判为替换模式，导致把匹配内容替换为空的问题。

## [1.0.58-pre.9] - 2026-01-26

### Fixed
  - UI：Context Used 卡片仅在工具循环结束后的最终助手回复展示，避免每次工具调用都重复显示。

## [1.0.58-pre.8] - 2026-01-25

### Fixed
  - 安全：渠道 `apiKey` 改用 VS Code SecretStorage 持久化，不再明文写入配置；启动时自动迁移旧明文并清理，删除配置时同步清理 secret。
  - 安全：MCP stdio `transport.env` 改用 VS Code SecretStorage 持久化，不再明文写入 MCP 配置；启动时自动迁移旧明文并清理，删除 server 时同步清理 secret。
  - 安全：MCP stdio 连接前增加显式确认（基于 `command + args` 指纹信任），避免启动/自动连接时静默执行本地命令。
  - 安全：对“用户可见”的错误信息统一脱敏，覆盖 `Authorization`/`Bearer`/`token`/`apiKey`/`proxyUrl`/URL basic auth 等常见敏感模式。
  - 安全：Webview 消息入口增加运行时协议校验（request envelope + stream payload），拒绝非预期类型/结构的消息，避免 `any` 解构导致的异常或注入面。
  - 安全：文件工具路径解析增加 workspace 边界校验，阻止 `..` 路径遍历与符号链接指向 workspace 外的逃逸。

### Tests
  - 新增/更新单测覆盖：SecretStorage 迁移、错误脱敏、Webview 协议校验、路径逃逸校验。

### Improved
  - 安全：调试日志默认关闭，需设置 `ACOPILOT_DEBUG=1` 才会输出（避免在生产日志中泄露对话/工具参数等内容）。

## [1.0.58-pre.4] - 2026-01-25

### Added
  - PlanRunner：步骤支持 `errorCode`（机器可读），用于识别需要 continue / 工具迭代上限等中断类型。
  - PlanRunner：支持在暂停态继续执行当前步骤，并在满足验收/完成后自动推进到下一步。
  - PlanRunner：步骤可选配置验收标准，并要求模型在回复末尾输出 `ACCEPTANCE: PASS` 或 `ACCEPTANCE: FAIL - <reason>`。
  - 测试：新增 `handleToolIteration` 回归测试，确保 functionResponse 后追加新的 assistant 占位并保留 modelVersion。

### Fixed
  - Plan & Run：命中 `MAX_TOOL_ITERATIONS` 等工具迭代中断时，“继续”将补全回复而不重复执行工具/命令。
  - 流式工具迭代：合并消息时正确保留原消息的 `modelVersion`。

### Improved
  - PlanRunner UI：附件展示更紧凑，操作按钮与间距优化。
  - 打包：`vscode:prepublish` 改为 `build`，新增 `package:vsix`，并移除 `build.sh` 中重复 build。

## [1.0.58-pre.3] - 2026-01-24

### Fixed
  - Plan & Run：工具执行后点击“继续”不再重复执行工具/命令，避免死循环与 token 浪费。
  - PlanRunner：自动 continue 改为安全补全（不再重复跑工具），并降低自动 continue 次数，减少重复步骤。
  - 视图标题栏：设置按钮恢复为直接可点击的标题栏按钮（不再进入 “...” 子菜单）。
  - Plan：步骤附件展示移动到“步骤说明”下方，并缩小附件缩略图占用空间。

### Improved
  - 顶部图标按钮：增大按钮间距，减少误触。

## [1.0.58-pre.2] - 2026-01-23

### Added
  - 测试：引入 Vitest，并添加基础单元测试覆盖（命令风险、流式解析、token 工具函数）。

### Changed
  - Token 计数：对话发送与上下文裁剪默认使用本地估算，避免发送前额外调用 token 计数 API 带来的延迟与限流影响。
  - Token 计数：设置页 token 统计在未配置/失败时自动回退到本地估算，避免“必须配置 API 才能用”。

### Fixed
  - execute_command 风险评估：修复 `curl | bash` 等 critical 场景被后续分支降级的问题。

## [1.0.57] - 2026-01-22

### Improved
  - 工具面板：固定分类顺序，并将媒体相关工具移动到最底部。
  - 工具面板：修复 locate 模型选择下拉被遮挡（由父容器 overflow 裁切导致）。
  - /locate：定位后自动携带“本次定位 query + 打开的文件位置”到下一条消息，减少“我说的是这里吗？”的断上下文体验。
  - open_file：返回定位范围与附近代码片段（excerpt），便于后续追问快速对齐上下文。

## [1.0.58-pre.1] - 2026-01-22

### Added
  - 上下文总结：设置面板启用“自动总结”开关与阈值配置（百分比）。
  - 自动总结（方案A）：在发送请求前预估上下文 token 使用量，超过阈值时自动生成摘要，避免直接丢弃旧回合。

## [1.0.58-pre.0] - 2026-01-22

### Added
  - open_file：打开文件后在编辑器内临时高亮定位范围（关闭文件后自动清理）。

### Improved
  - 消息底部模型名：将“... 三点闪烁”改为模型名文字跑马灯效果（仅流式时显示）。

## [1.0.57-pre.18] - 2026-01-21

### Improved
  - /locate：发送消息时显示定位模型，并将 modelOverride 随请求传递，确保覆盖生效。
  - 定位（/locate）设置：定位模型改为下拉选择（从当前渠道已配置模型列表中选择，避免手输出错）。

## [1.0.57-pre.17] - 2026-01-21

### Fixed
  - /locate：流式请求透传 mode 字段，确保定位模式与模型覆盖配置生效。

## [1.0.57-pre.16] - 2026-01-21

### Added
  - /locate：定位模式（可选指定模型 + 限制工具白名单），用于快速定位并打开相关文件。
  - open_file：打开文件并跳转到行列的工具（供 /locate 使用）。

## [1.0.57-pre.15] - 2026-01-21

### Improved
  - 对话历史：标题栏仅保留“对话历史 + 工作区筛选”，搜索框单独一行展示。
  - list_files：移除重复的汇总行（目录/文件统计 + 复制按钮），避免信息重复。

## [1.0.57-pre.14] - 2026-01-21

### Improved
  - 对话历史：将“工作区筛选”移动到标题栏右侧，减少控制栏占位。

### Chore
  - 仓库：忽略本地 `.npm-cache/`。

## [1.0.57-pre.13] - 2026-01-21

### Fixed
  - read_file：单文件读取时工具头部合并为一行展示（“读取文件 文件名”），减少占位。
  - read_file：单文件模式下不再重复显示文件头/路径；修复文件扩展名重复展示。

## [1.0.57-pre.12] - 2026-01-21

### Improved
  - 对话历史：搜索与“显示对话历史”筛选合并为一行，减少占位。
  - apply_diff：工具卡片支持一键 Undo（按块回滚并最终保存）。
  - read_file：partial 标识在不同主题下更清晰易读。

## [1.0.57-pre.11] - 2026-01-21

### Improved
  - read_file：多文件读取改为限流并行（提高吞吐，保持输出顺序）。
  - write_file/apply_diff：在后台应用并保存（不打开编辑器 Tab），UI 仍可查看 diff。
  - 设置：Checkpoints 列表支持“当前筛选全选/批量删除”，并优化确认文案。

### Fixed
  - execute_command：将执行目录显示到工具标题后（同一行），不再单独占一行。
  - OpenAI Responses：流式在“思考阶段”异常断开时自动重试并清空 continuation，降低卡死概率。

## [1.0.57-pre.10] - 2026-01-20

### Fixed
  - 消息：用户消息的编辑/复制/删除按钮改为始终显示（不再依赖 hover）。

## [1.0.57-pre.9] - 2026-01-20

### Fixed
  - 工具 UI：工具状态图标（对勾/错误/加载）移到工具名称之前，read_file 不再出现重复对勾/数字。

## [1.0.57-pre.8] - 2026-01-20

### Fixed
  - 工具 UI：read_file 折叠状态不再显示文件路径列表，减少占位。

## [1.0.57-pre.7] - 2026-01-20

### Fixed
  - 工具 UI：展开内容区不再重复显示工具标题（如“读取文件”）。

## [1.0.57-pre.6] - 2026-01-20

### Improved
  - execute_command：命令行摘要中，执行结果图标移到命令前；风险标识移到命令后。

## [1.0.57-pre.5] - 2026-01-19

### Improved
  - execute_command：减少“文件变更”区块闪烁/重复展示（仅当工作区变更发生变化时才收集并展示变更；默认收起，按需展开）。
  - execute_command：精简工具 UI（去除输出复制/展开按钮、命令行内联按钮等），交互更接近 Copilot Chat。
  - 消息：流式输出指示器改为三点打字动画，并支持 `prefers-reduced-motion`。
  - 打包：`.vscodeignore` 增加忽略 `.env*` 与 `vscode-copilot-chat/**`，避免误打包。
  - 仓库：移除过期 `todo.md`。

## [1.0.57-pre.4] - 2026-01-19

### Improved
  - Provider：流式输出开关默认改为开启（新建配置默认 stream=true，旧配置未设置时也默认视为开启）。

## [1.0.57-pre.3] - 2026-01-19

### Improved
  - Context Used：仅在每轮用户消息的首条助手回复展示一次，避免工具循环重复占位。
  - 消息底部：眼睛/复制/重试等按钮改为始终显示，不再依赖 hover。
  - 缓存命中：命中百分比改为绿色显示。

## [1.0.57-pre.2] - 2026-01-19

### Improved
  - 上下文：不再每次请求注入 “Current Time”；仅在会话首条用户消息注入一次 “Conversation Start Time”，提升提示词缓存命中稳定性。
  - execute_command：在聊天工具展开内容中隐藏内部命令头部并默认展开输出，避免命令重复显示与双层展开。

## [1.0.57-pre.1] - 2026-01-19

### Added
  - Gemini：支持 usageMetadata.cachedContentTokenCount 统计，并在消息底部展示提示词缓存命中（tokens/%）。

### Fixed
  - Diff 预览：打开 `vscode.diff` 时默认使用 inline 模式，避免窄窗口下右侧内容不可见。
  - 输入区：底部栏在窄宽度下自动换行，避免右侧按钮被裁切。
  - 模型选择器：下拉列表在窄宽度下限制最大宽度，避免溢出。

## [1.0.57-pre.0] - 2026-01-18

### Fixed
  - 流式：Webview 不再误把包含 “aborted” 的网络错误当作用户取消而吞掉，避免出现“思考一半停住但无错误提示”。
  - 流式：当连接在思考阶段异常关闭且没有正文/工具调用时，自动重试一次，降低“只输出思考就中断”的概率。
  - execute_command：失败时也展示 stdout/stderr 输出，便于定位 pytest 等错误原因。
  - execute_command：补齐输出截断元数据（truncated/totalLines/outputLines），UI 统一提示“仅显示最后 N 行”。
  - execute_command：文件变更操作按钮在窄宽度下更紧凑（“在 VS Code 中查看”改为图标），避免按钮被裁切。

## [1.0.56] - 2026-01-18

### Added
  - LSP：新增 `get_errors` 工具，直接获取编辑器 diagnostics（类型错误/lint/编译错误等），无需运行编译命令解析输出。
  - LSP：新增 `get_usages` 工具，一次返回 definition/references/implementations，减少多次 LSP 工具调用。
  - 图像生成：`generate_image` 支持 Together Images API，并在设置中提供 Provider/推荐模型选择。

### Improved
  - 差异/补丁：`apply_diff` 匹配逻辑更健壮（含回退匹配），并支持按配置自动保存，减少“总是失败/需要手动保存”的摩擦。
  - Plan Runner：支持单步执行（Run step）。
  - 渠道设置：配置选择器支持直接删除配置。

## [1.0.55] - 2026-01-16

### Fixed
  - OpenAI/兼容网关：支持将 `data: [DONE]` 作为流式完成标记，避免偶发出现“流式响应异常结束 未收到完成标记”。
  - 修复 Webview 通过 `postMessage` 发送选中引用（Add Selection to Chat）时的 `DataCloneError`（`[object Array] could not be cloned`）。

### Added
  - OpenAI Responses：在消息底部状态栏展示提示词缓存命中（cached input tokens）。

## [1.0.54] - 2026-01-16

### Fixed
  - Gemini：兼容 `url` 配置为 base/full-endpoint、多种 model 写法（`gemini-xxx`/`models/gemini-xxx`），避免出现“找不到模型”。
  - OpenAI/OpenAI Responses/Anthropic：自定义 body 不再允许覆盖 `stream` 导致请求与解析模式不一致；当上游要求 `stream=true` 时会自动回退到流式，避免直接不可用。

## [1.0.53] - 2026-01-16

### Fixed
  - Gemini：对请求体做更严格的 schema 对齐与清洗（`systemInstruction.role`、`tools.functionDeclarations`、`contents` 结构兜底），降低工具循环中触发 “contents array is required” 的概率。
  - OpenAI Responses：prompt cache key 采用对话内 stateful marker 持久化；当对话元数据缺失/被清理时可自动恢复继续透传（不支持时仍会自动熔断回退）。

## [1.0.52] - 2026-01-16

### Fixed
  - Gemini：防止自定义 body（advanced）误覆盖请求体导致 `contents` 丢失/为空并触发 “contents array is required”；现在会忽略非对象的 custom body 根并做必填字段兜底校验。

## [1.0.51] - 2026-01-16

### Fixed
  - OpenAI Responses：当 `previous_response_id` / `prompt_cache_key` 不被服务端接受时，对该对话自动熔断并停止继续透传，避免每轮“报错→回退→再报错”的慢循环。

## [1.0.50] - 2026-01-15

### Added
  - 上下文：支持“仅本条消息”注入覆写（与 Settings 默认值联动），可临时开/关 Workspace Files/Open Tabs/Active Editor/Diagnostics/Pinned Files/Pinned Prompt/Tools，且会写入该条 user 消息以便重试/复现。
  - 输入区：新增“本条上下文”开关面板；Context Inspector 预览会按当前覆写生成系统提示词/工具声明等内容，确保预览与实际注入一致。

## [1.0.49] - 2026-01-15

### Improved
  - Gemini：工具迭代（tool-loop）限速下调到 200~400ms（含 jitter），减少等待。
  - Gemini：429/RESOURCE_EXHAUSTED 重试不再强制最少 15s，继续使用指数退避（基于 retryInterval）+ jitter。

## [1.0.48] - 2026-01-15

### Improved
  - OpenAI Responses：支持 prompt_cache_key + previous_response_id continuation，减少重复发送历史与 token 成本（失败自动回退到全量历史）。
  - Gemini：工具迭代（tool-loop）后续轮次增加轻量限速，降低工具链路触发 429 的概率。

### Fixed
  - Gemini：遇到 429/RESOURCE_EXHAUSTED 时重试退避至少 15s + jitter，避免重试过快。

## [1.0.47] - 2026-01-15

### Added
  - 对话内 Context Used 摘要：在每条助手回复下方展示本次注入的 Pinned Files / Pinned Prompt / Attachments，并可一键打开 Context Inspector。

### Improved
  - execute_command：风险等级显示改为彩色 badge（低=绿/中=黄/高=橙/致命=红）。

### Fixed
  - Gemini：history role 归一化更健壮，并合并连续同角色消息，减少错位/忽略。
  - 校验预设：运行校验命令时回传最近的 thought signatures，兼容 Gemini Thinking（function call 流程）。

## [1.0.46] - 2026-01-14

### Improved
  - Skills 列表：长 ID 显示优化（不再竖排换行，超长省略，hover 可看全称）。
  - 多模态：文档图片开关在未选中时也可见，并修复该行图标显示。

## [1.0.45] - 2026-01-13

### Improved
  - Token 统计：支持 k/m 缩写显示（如 2409 -> 2k）。
  - Finish reason：状态改为图标显示，Completed 显示绿色通过 icon。

## [1.0.44] - 2026-01-13

### Added
  - Plan Runner：步骤级重执行（refresh icon）。
  - Plan Runner：步骤级图片附件注入（执行时按步携带）。

### Improved
  - 差异/补丁工作流：`apply_diff` 支持 hunk 级 apply/undo + 冲突提示，文件级 git 状态展示与 stage/unstage。
  - 写入文件工作流：`write_file` 支持文件级 apply/undo，文件级 git 状态展示与 stage/unstage。

### Fixed
  - 修复 Gemini 重复回答（历史消息 role 归一化）。

## [1.0.43] - 2026-01-13

### Added
  - Plan Runner（Plan & Run）：创建计划并逐步执行，支持暂停/继续/取消，状态对话级持久化（重启 VS Code 也可恢复）。
  - 改动后校验预设：当工具导致文件发生改动后，提示一键运行 build/test/lint 等命令，并将 execute_command 结果写回对话流。
  - execute_command 失败定位：从终端输出解析 `path:line:col` 并一键打开文件跳转到报错位置。

### Improved
  - 新增“任务卡片”创建入口与展示（Create Task modal / TaskCardMessage）。
  - 新增 Context Inspector：可视化注入上下文与裁剪信息，并支持复制调试信息。

### Fixed
  - 修复 checkpoint 对 `write_file` 工具名的兼容问题（兼容 `write_to_file`）。

## [1.0.42] - 2026-01-12

### Added
  - Skills 支持从 GitHub URL 一键安装（安装到当前项目 `.codex/skills/`，并自动导入到 Skills 列表）

### Improved
  - 兼容部分第三方 skill 仓库脚本引用路径（自动修正 SKILL.md 中 `.codex/scripts` 到 `.codex/skills/<skill>/scripts`）
  - 支持通过 `GITHUB_TOKEN`/`GH_TOKEN` 访问私有仓库（如需要）

## [1.0.41] - 2026-01-12

### Added
  - 无标题对话自动从首条用户消息生成标题（兜底）

### Improved
  - 合并「工具」与「自动执行」设置为单页「工具与执行」，右侧列对齐并更紧凑
  - 工具描述支持 hover 查看完整内容

## [1.0.38] - 2026-01-08

### Fixed
  - 修复cmd工具无法执行的问题

## [1.0.40] - 2026-01-11

### Added
  - execute_command 风险策略（前后端）

### Fixed
  - 修复 markdown/text 附件处理
  - 修复模型名称下沿被裁剪问题
  - 修复渠道设置下拉层级遮挡问题
  - 优化重试/删除对话框体验

### Improved
  - 调整历史/返回按钮位置
  - 渠道设置界面优化（折叠多模态细节等）

## [1.0.37] - 2026-01-08

### Fixed
  - 修复了报错后点击重试按钮无响应的问题

## [1.0.36] - 2026-01-08

### Fixed
  - 修复了搜索工具的显示内容问题
  - 修复了cmd终端类型引号参数问题
  - 修复了搜索工具无法指定单个文件内搜索的问题

### Improved
  - 优化了初始化时按钮的线程堵塞问题
  - 添加了加载历史对话的等待动画
  - 优化了一个大文件，进行了拆分解耦

## [1.0.35] - 2026-01-07

### Added
  - 添加了输入框里"@"选择路径功能

### Fixed
  - 修复中断后点击继续按钮无法继续问题
  - 修复工具显示问题
  - 修复工具分类问题
  - 修复裁剪上下文问题
  - 修复部分情况下思考签名的存储问题
  - 修复文件夹文件不显示末尾/的问题
  - 修复cmd运行问题
  - 修复中断后点击继续无响应的问题
  - 修复上面三种工具显示问题

## [1.0.34] - 2026-01-07

### Added
  - 添加了find_references、get_symbols、goto_definition工具
  - 添加了read_file工具带行号的阅读功能，这可能会导致旧对话旧的读取文件块显示异常，建议开新对话

## [1.0.33] - 2026-01-07

### Improved
  - 优化了两个大文件，进行了拆分解耦

## [1.0.32] - 2026-01-06

### Improved
  - 优化了oai-responses格式，使其更符合官方示例

## [1.0.31] - 2026-01-06

### Fixed
  - 修复终端工具编码显示异常问题

## [1.0.30] - 2026-01-05

### Added
  - 添加openai-responses格式对话和token计数支持

## [1.0.29] - 2026-01-01

### Backed
  - 暂时回档到1.0.26

## [1.0.28] - 2025-12-31

### Fixed
  - 修复diff无法自动确认问题

## [1.0.27] - 2025-12-31

### Added
  - 支持工具确认后的分步批注提交

### Fixed
  - 修复总结对话后functionCall被错误裁剪

## [1.0.26] - 2025-12-31

### Fixed
  - 修复存档点问题
  - 修复自定义body时的合并问题

## [1.0.25] - 2025-12-26

### Added
  - 添加回退存档点二次确认功能

## [1.0.24] - 2025-12-26

### Added
  - 在工具确认界面支持读取输入框内容作为批注发送给 AI
  - 当有待确认工具时，发送输入框内容将自动触发“全部拒绝”并带上批注消息
  - 后端 ChatHandler 支持在处理工具结果前插入用户批注消息并重新计算 Token
  - 优化 diff 管理器：在非自动保存模式下，用户手动保存文件后自动关闭 diff 标签页
  - 前端chatStore 增加待确认工具检测逻辑及 rejectPendingToolsWithAnnotation 方法
  - 调整输入框逻辑，允许在工具待确认状态下发送文本内容

### Fixed
  - 修复输入框无法右键粘贴问题，简单模式”下，支持使用 a.b.c 这样的键名

## [1.0.23] - 2025-12-25

### Improved
  - 优化apply diff等工具的存储和显示以及实现

## [1.0.22] - 2025-12-23

### Fixed
  - 修复输入框以及长对话时卡顿问题，引入消息分页，每次多加载40条

## [1.0.21] - 2025-12-22

### Fixed
  - 修复oai格式流式响应中提取token计数问题

## [1.0.20] - 2025-12-22

### Fixed
  - 修复oai格式，Anthropic格式的工具调用格式和显示问题

## [1.0.19] - 2025-12-22

### Fixed
  - 修复终止按钮以及思考消息存储和前端显示问题

## [1.0.18] - 2025-12-22

### Fixed
  - 修复思考删除消息

## [1.0.17] - 2025-12-22

### Fixed
  - 修复文件扩展名识别问题，添加兜底机制
  - 修复空目录的增量备份问题

## [1.0.16] - 2025-12-22

### Added
  - 添加token计数api配置面板

### Improved
  - 大幅优化token计数方法
  - 大幅优化裁剪上下文功能


## [1.0.15] - 2025-12-21

### Fixed
  - 修复开关返回图片给ai时刷新多模态工具配置问题
  - 修复工具调用块里思维链存储和返回问题

## [1.0.14] - 2025-12-21

### Fixed
  - 暂时修复多工具确认问题

## [1.0.13] - 2025-12-21

### Fixed
- 修复提示词的刷新规则，每次循环都刷新
- 修复总结对话问题

## [1.0.12] - 2025-12-21

### Added
  - 新增发送前估算token功能
  - 新增额外裁剪功能
  - 新增发送历史对话思考时，控制发送对话轮数的功能

### Fixed
  - 修复历史思考签名回传开关的问题
  - 修复token计算问题，现在会实时裁剪上下文
  - 修复不同渠道的发送思考问题

### Improved
  - 优化了历史思维链回传说明
  - 优化了写入文件，应用差异工具的diff预览问题


## [1.0.11] - 2025-12-21

### Fixed
  - 修复工具格式和解析不匹配问题

### Improved
  - 优化了系统提示词

## [1.0.10] - 2025-12-21

### Improved
  - 优化了系统提示词

### Fixed
  - 修复抓包问题
  - 修复保存正文签名问题
  - 修复总结上下文后使用token不对问题
  - 修复裁剪上下文问题

## [1.0.9] - 2025-12-20

### Added
  - 新增单回合最大工具调用次数配置
  - 在工具设置面板中添加配置项，允许用户自定义每轮对话中 AI 最多可调用的工具次数
  - 默认值为 50，-1 表示无限制

### Improved
  - 优化工具设置面板的数字输入框样式，隐藏上下箭头按钮

### Fixed
  - 修复工具参数验证问题：强调所有数组类型参数必须使用数组格式（即使只有单个值）
  - 文件工具：read_file、write_file、list_files、delete_file、create_directory、apply_diff
  - 搜索工具：find_files
  - 媒体工具：generate_image、resize_image、rotate_image、crop_image、remove_background
  - 修复 AI 调用时出现 `Malformed function call` 错误的问题

## [1.0.8] - 2025-12-20

### Fixed
  - 修复增量存档，始终使用


## [1.0.7] - 2025-12-20

### Added
  - 新增自定义存储路径功能
  - 支持在通用设置中配置自定义存储路径，用于存放对话历史、存档点等数据
  - 支持路径验证和数据迁移功能
  - 可将现有数据迁移到新的存储位置
  - 为搜索工具添加替换功能

### Fixed
  - 修复上下文阈值在有总结消息时不生效的问题
  - 原逻辑：发现总结消息后直接从总结开始返回历史，跳过上下文阈值检查
  - 修复后：即使有总结消息，也会继续检查 token 数是否超过阈值，超过时会对总结后的历史进行回合裁剪
  - 修复 apply_diff 工具前端缩略视图行号始终从 1 开始的问题
  - 将 `start_line` 参数改为必填，要求 AI 必须提供准确的起始行号
  - 后端返回带有实际匹配行号的 diffs 供前端显示
  - 前端优先使用后端返回的 diffs 数据（包含实际匹配行号）
  - 修复diff差异工具的显示问题，优化diff工具的存储

### Improved
  - 优化大部分工具定义和响应
  - 改为使用增量备份功能
  - 添加更多md渲染支持

## [1.0.6] - 2025-12-19

### Fixed
- 修复上下文总结功能发送给 API 时包含无效字段的问题（如 `functionCall.rejected`、`inlineData.id/name` 等内部字段）
- 修复 apply_diff 工具前端面板中行号从 0 开始显示的问题，现在正确使用 `start_line` 作为起始行号

### Improved
- 优化总结请求的字段清理，过滤思考内容和思考签名，保持与 `getHistoryForAPI` 一致的清理逻辑
- 改进 apply_diff 工具的"查看差异"按钮功能，现在点击后在 VSCode 中显示完整文件的差异视图（包含完整代码上下文），而不仅仅是 search/replace 块
- 改进切换对话时的自动滚动逻辑
- 前端添加取消兜底机制，避免一直显示等待

## [1.0.5] - 2025-12-19

### Improved
- 优化生图工具（generate_image）描述，添加提示说明生成的图片是实色背景而非透明底图

## [1.0.4] - 2025-12-19

### Fixed
- 修复工具执行完成后点击终止按钮无法正常结束的问题（循环开始时检测取消信号后需发送 cancelled 消息给前端）

### Improved
- 优化搜索工具（find_files、search_in_files）忽略问题，添加默认排除模式配置

## [1.0.3] - 2025-12-19

### Added
- 添加了向 AI 发送诊断信息功能

### Fixed
- 修复上下文感知页面保存问题

### Note
- ⚠️ 旧版本使用者建议重置系统提示词以添加诊断信息功能

## [1.0.0] - 2025-12-19

### Added
- 🎉 首次发布
- AI 编程助手核心功能
- 多模态支持
- 对话历史管理
- 多语言支持（中文、英文、日文）
- MCP 服务器集成
- 文件操作工具
- 终端命令执行
- 图像处理功能
