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
8. 存档点工具备份说明必须跟随当前界面语言，并复用工具设置中同一套面向 UI 的本地化工具说明。
9. 后端工具说明可以继续作为面向模型/执行侧的 fallback 文案，但设置界面展示内置工具说明时不能依赖后端返回的英文原文。

## Non-Goals

- Do not change checkpoint storage format.
- Do not change restore semantics.
- Do not add new backend persistence APIs unless the existing settings API cannot support the behavior.
- 不主动翻译 MCP 工具提供的说明，除非 MCP 工具本身提供本地化元数据。

## Verification

- Unit tests should cover preset implementation evidence and dangerous auto-exec checkpoint protection evidence.
- 本地化测试需要覆盖工具设置、自动执行设置和存档点工具备份设置都通过共享 helper 展示内置工具说明。
- Frontend build must pass because this changes frontend components.
