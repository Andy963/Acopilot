# Multiple Pinned Prompts Requirements

## Goal

Allow users to pin multiple prompt blocks per conversation and control where those prompt blocks appear in the final system prompt through template placeholders.

## Requirements

1. A conversation must support multiple active pinned prompts.
2. Existing single `pinnedPrompt` metadata must continue to work.
3. Multiple pinned prompts must preserve a stable order.
4. The system prompt template must support a placeholder that renders all active pinned prompts.
5. The system prompt template must support a placeholder that renders a single pinned prompt by id.
6. If a template has no pinned prompt placeholder, the old behavior must remain: pinned prompts are prepended before the base system prompt.
7. Pinned prompt injection must be consistent across streaming, non-streaming, context preview, and token estimation paths.
8. Context Inspector must show enough metadata for users to verify which pinned prompts were injected.
9. Agent mode, tool declarations, pinned files, and existing pinned file behavior must remain unchanged.

## Non-Goals

- Do not force users to store prompts as files.
- Do not change pinned file storage or rendering semantics.
- Do not introduce database migrations.
- Do not remove the existing reusable prompt preset and skill concepts.

## Verification

- Unit tests must cover legacy single prompt compatibility.
- Unit tests must cover multiple prompt rendering, placeholder rendering, fallback rendering, and named placeholder consumption.
- Frontend tests must cover normalization and persistence of multiple pinned prompts.
- Run `npm run typecheck`, `npm run build`, `npm test`, and `npm run validate`.
