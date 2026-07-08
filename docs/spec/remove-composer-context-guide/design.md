# Remove Composer Context Guide Design

## UI Change

Remove the `context-lifecycle-chip` block from `ComposerTopBar.vue`.

The top bar order becomes:

1. Attach file action.
2. Pinned context action.
3. Plan action.
4. Selection references and attachment chips when present.

## Code Cleanup

Remove the `contextLifecycleTooltip` computed value because it only serves the deleted chip.

Remove the `components.input.contextLifecycle` translation group from all active input language dictionaries:

- English
- Simplified Chinese
- Japanese

## Test Update

The static attachment context enhancement test should no longer require lifecycle guidance. It should continue to require attachment support, token estimate, and truncation metadata.

## Risk

This removes an explanatory affordance but does not change context inclusion behavior. The remaining pinned context and attachment controls still expose their own labels and metadata.
