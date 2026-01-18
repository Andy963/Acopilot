# Change Log

All notable changes to the "Acopilot" extension will be documented in this file.

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
