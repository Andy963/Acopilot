# Chat Mode Read-Only Tools Requirements

## Goal

Prevent chat and plan modes from surfacing file-modifying tool confirmations, while keeping agent mode capable of executing implementation tasks.

## Requirements

1. Chat mode must continue to expose only read-only tools.
2. Plan mode must continue to expose only read-only tools until the user requests implementation.
3. Chat and plan mode prompts must explicitly state that file modification tools are not allowed.
4. Tool calls outside the active allowlist must not be sent to the user confirmation flow.
5. Tool calls outside the active allowlist must still be rejected by the execution layer if they reach execution.
6. Agent mode behavior must remain unchanged.

## Non-Goals

- Do not remove or disable mutating tools globally.
- Do not change the tool auto-execution settings schema.
- Do not change checkpoint behavior.

## Verification

- Unit tests must cover chat/plan read-only policy text and allowlist contents.
- Unit tests must cover confirmation filtering for tools outside the active allowlist.
- Project typecheck, build, and tests must pass.
