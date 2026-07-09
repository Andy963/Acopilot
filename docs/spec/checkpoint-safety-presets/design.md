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

## Tradeoffs

- Frontend-only presets are simpler and avoid config migration.
- The automatic checkpoint link is intentionally conservative: enabling auto-exec for risky tools also enables checkpoint protection.
- The recent checkpoint entry is a visible helper, not a new restore mechanism.
