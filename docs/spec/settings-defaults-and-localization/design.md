# Settings Defaults And Localization Design

## Tool Description Localization

Keep backend `ToolDeclaration.description` as the source for model-facing tool metadata.
Add UI-only translations under `components.settings.toolsSettings.descriptions`.
共享的前端展示 helper 按以下顺序解析说明：

1. MCP tools return `tool.description` unchanged.
2. Built-in tools look up `components.settings.toolsSettings.descriptions.<toolName>`.
3. Missing translations fall back to `tool.description`.

工具设置、自动执行设置、存档点工具备份设置都调用同一个 helper。这样可以保留 prompt/tool-call 使用的后端工具说明，同时让本地化设置页保持一致。

## Context Summarization Numeric Layout

紧凑数值控件使用标签/控件同行布局，而不是默认的上下堆叠表单布局。
只有小型数值控件使用该行布局；文本域和下拉选择等较大控件保持现有纵向布局。

## Checkpoint Cleanup List

Use the existing `CustomScrollbar` component in max-height mode.
Set the cleanup list scrollbar to `360px` and make the wrapper hide overflow.
The list content remains unchanged; only the scroll container receives the bounded height.

## Default Checkpoint Cleanup

Change defaults at every boundary that can synthesize a value:

- Backend `DEFAULT_CHECKPOINT_CONFIG`.
- Backend checkpoint config normalization for legacy configs.
- Frontend reactive default config.
- Frontend save payload fallback.
- Checkpoint settings prop fallback.

Explicit `false` must remain respected.

## Default Prompt Token Provider

Change `PromptSettings.vue` initial `selectedChannel` from `gemini` to `openai`.
The existing channel selector and count request path remain unchanged.

## Default Provider Streaming

Keep explicit `options.stream` and `preferStream` precedence.
Change fallback behavior from disabled to enabled:

```typescript
const useStream = request.streamOverride ?? config.options?.stream ?? config.preferStream ?? true;
```

Apply this in the manager and direct formatter build paths so direct tests and future call sites share the same default.

## Risk

Legacy users who omitted stream settings will now use streaming by default.
This matches the visible UI default and can still be disabled explicitly per provider.
