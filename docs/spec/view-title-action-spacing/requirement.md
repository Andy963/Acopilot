# View Title Action Spacing Requirement

## Background

The Acopilot view title exposes three primary actions: New Chat, Show History, and Show Settings. Their menu ranks were consecutive, which made the top action row feel too dense and easier to misclick.

## Goal

Increase the separation between the three Acopilot view title actions while keeping all three actions available from the Acopilot view title.

## Requirements

- Keep New Chat, Show History, and Show Settings visible in the Acopilot view title menu.
- Preserve the existing command IDs, command titles, icons, and command behavior.
- Increase the menu rank spacing between the three view title actions.
- Add a static test assertion that prevents the actions from returning to consecutive ranks.

## Non-Goals

- Do not redesign the Webview UI.
- Do not remove any of the three title actions.
- Do not change activity bar view registration.

## Validation

- The VS Code menu enhancement test must pass.
- Project validators must pass.
- Extension build must pass.
