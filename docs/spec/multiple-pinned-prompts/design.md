# Multiple Pinned Prompts Design

## Current Shape

Pinned files already use a prompt template placeholder: `{{$PINNED_FILES}}`.

Pinned prompts are different today. A conversation stores one `pinnedPrompt` object with a mode of `none`, `skill`, `preset`, or `custom`. The backend resolves that object and prepends the resulting prompt block before the base system prompt.

That design has two limitations:

- Only one pinned prompt can be active.
- The user cannot choose where the pinned prompt appears because it is injected outside the template.

## Data Model

Add a new conversation metadata key:

```ts
pinnedPrompts: Array<{
  id: string
  mode: 'skill' | 'preset' | 'custom'
  skillId?: string
  presetId?: string
  customPrompt?: string
  name?: string
  enabled: boolean
  order: number
}>
```

The old `pinnedPrompt` key remains valid. When `pinnedPrompts` is absent, the backend and frontend normalize the old single value into a list with one enabled item.

## Prompt Placeholders

Add these placeholders:

- `{{$PINNED_PROMPTS}}`: renders all active pinned prompts not consumed by named placeholders.
- `{{$PINNED_PROMPT:<id>}}`: renders one active pinned prompt by id and marks it consumed.

If no pinned prompt placeholder appears in the template, all active pinned prompts are prepended before the base system prompt. This preserves existing behavior.

If the same named prompt is referenced multiple times, only the first reference renders content. Later references render an empty string to prevent accidental duplicate instruction injection.

## Rendering

Each pinned prompt renders as its own section:

```text
====

PINNED PROMPT: Review

...
```

Skill prompts keep the `SKILL: <name>` title. Preset and custom prompts use `PINNED PROMPT: <name>` when a name is available.

## UI

The pinned context panel should manage a list of active prompt blocks:

- Add custom prompt.
- Add selected preset.
- Add selected skill.
- Remove prompt.
- Move prompt up or down.

This keeps prompt management separate from pinned files while still sharing the same panel.

## Compatibility

Existing conversations keep working because the old single prompt is normalized into a one-item list.

Existing templates keep working because fallback prepend remains active when no pinned prompt placeholder is present.
