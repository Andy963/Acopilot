# Checkpoint Safety Presets Design

## Current Shape

Checkpoint configuration already stores:

- `enabled`
- `beforeTools`
- `afterTools`
- `messageCheckpoint`
- cleanup and retention fields

The settings page updates these fields through `checkpoint.updateConfig`, and chat restore already uses the existing checkpoint records.

## Design

### Presets

Presets are frontend helpers that write existing config fields:

- `safe`: enable checkpointing, checkpoint user messages before send, and protect all mutating tools before and after execution.
- `light`: enable checkpointing, checkpoint user messages before send, and protect mutating tools before execution only.
- `dangerous`: enable checkpointing and protect risky tools before and after execution.
- `off`: disable checkpointing while preserving lists for future manual changes.

This avoids a schema migration and keeps current backend behavior unchanged.

### Risky Tool Auto-Execution Link

The tools settings composable already routes dangerous auto-exec changes through confirmation. After confirmation, it will:

1. Load the current checkpoint config.
2. Enable checkpointing if disabled.
3. Add the risky tool to both `beforeTools` and `afterTools` if missing.
4. Save via `checkpoint.updateConfig`.
5. Enable auto-execution.

The confirmation text will say checkpoint protection is enabled automatically when missing.

### Recent Checkpoint Restore Entry

The message list will compute the latest checkpoint by timestamp and render a compact restore entry near the end of the chat. It reuses the existing restore confirmation flow by calling the same `restoreCheckpoint` handler.

### 共享工具说明展示

设置界面必须把后端工具说明视为执行元数据，而不是内置工具的主要 UI 文案。共享的前端展示 helper 负责：

1. 识别 MCP 工具，并原样返回 MCP 提供的说明。
2. 通过 `components.settings.toolsSettings.descriptions.${tool.name}` 解析内置工具说明。
3. 仅在没有本地化 UI 文案时回退到后端说明。

工具设置、自动执行设置和存档点工具备份设置都应调用同一个 helper，确保界面语言变化时统一从现有 i18n 文案源更新。

## Tradeoffs

- Frontend-only presets are simpler and avoid config migration.
- The automatic checkpoint link is intentionally conservative: enabling auto-exec for risky tools also enables checkpoint protection.
- The recent checkpoint entry is a visible helper, not a new restore mechanism.
- 将本地化 helper 放在前端可以避免修改工具 schema，同时移除重复的 UI 说明逻辑。
