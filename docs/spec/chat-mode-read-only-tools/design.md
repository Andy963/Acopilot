# Chat Mode Read-Only Tools Design

## Current Shape

Chat and plan modes already create a `toolAllowList` through `resolveChatModePolicy`. The allowlist contains read/search/LSP tools and excludes mutating tools such as `write_file`, `apply_diff`, `delete_file`, and `execute_command`.

The model request and execution layer both receive this allowlist. However, the confirmation flow checks whether a tool needs confirmation before considering the allowlist. A disallowed mutating tool can therefore appear as a pending confirmation before execution rejects it.

The default system prompt also describes mutating tools globally, so chat mode needs a mode-specific instruction that resolves the prompt conflict for the current request.

## Design

### Mode Prompt

Add an explicit no-write instruction to the chat and plan task context:

- Do not modify files.
- Do not call mutating tools.

This keeps the global system prompt reusable for agent mode while making chat and plan mode intent explicit.

### Confirmation Filtering

Extend `ToolExecutionService.getToolsNeedingConfirmation` to accept the active `toolAllowList`.

When a call is outside the allowlist, it is not returned as a confirmation candidate. The existing execution-layer allowlist check remains the final enforcement point and returns a tool error if the call reaches execution.

### Scope

The change is intentionally narrow:

- Chat and plan mode prompts become stricter.
- Confirmation UI no longer surfaces disallowed mutating tools.
- Agent mode keeps the full tool set.

## Risks

- A model may still emit a disallowed tool call from stale history or prompt-only formats. The execution layer already rejects it, and the confirmation filter prevents it from becoming a user-facing write confirmation.
