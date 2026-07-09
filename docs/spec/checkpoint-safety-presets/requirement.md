# Checkpoint Safety Presets Requirements

## Goal

Improve checkpoint configuration so users can choose intent-based protection levels, get checkpoint protection when enabling risky automatic tool execution, and see an obvious recent checkpoint restore path in chat.

## Requirements

1. Checkpoint settings must offer scenario presets:
   - Safe mode
   - Lightweight mode
   - Off mode
   - Dangerous tool protection mode
2. Applying a preset must update the existing checkpoint config fields rather than introducing a parallel config source.
3. Enabling automatic execution for risky tools must ensure matching before/after checkpoint protection for that tool.
4. Risky tools must include at least `execute_command`, `delete_file`, `apply_diff`, and `replace_in_files`.
5. Chat must show a visible recent checkpoint restore entry when checkpoints exist.
6. Restore actions must keep the existing destructive restore confirmation.
7. Existing cleanup views that show checkpoint counts and storage sizes must keep working.

## Non-Goals

- Do not change checkpoint storage format.
- Do not change restore semantics.
- Do not add new backend persistence APIs unless the existing settings API cannot support the behavior.

## Verification

- Unit tests should cover preset implementation evidence and dangerous auto-exec checkpoint protection evidence.
- Frontend build must pass because this changes frontend components.
