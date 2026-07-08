# Webview Main View Navigation Requirement

## Background

Webview navigation currently uses `settingsStore.currentView` for the main view and `settingsStore.activeTab` for the settings category. Main views are represented as string state, while settings tabs already have metadata in the settings panel.

## Goals

- Define main views through a single registry instead of scattering raw view metadata.
- Keep the last opened settings tab across Webview reloads.
- Preserve first-run configuration guidance so users without a usable channel or model can reach Channel settings directly.

## Requirements

- The supported main views remain `chat`, `history`, and `settings`.
- Main view metadata must be available from a single source of truth.
- Commands and UI handlers must continue to switch to chat, history, and settings through the settings store.
- The history view must expose a left-side back navigation control that returns to the chat view.
- The history-to-chat navigation control must use a directional back arrow icon instead of a close icon.
- The history-to-chat navigation control must keep an accessible label or title based on the existing history `backToChat` localization key.
- Opening settings without an explicit tab must keep the current or restored settings tab instead of forcing `channel`.
- Opening settings with an explicit tab must switch to that tab and persist it.
- Invalid persisted settings tab values must fall back to `channel`.
- Users without configured models must still see an explicit path to Channel settings from the chat entry experience.

## Non-Goals

- Do not add new main views.
- Do not redesign the settings panel layout.
- Do not change channel or model configuration semantics.
- Do not change extension command names or bridge message names.

## Validation

- Unit tests cover settings tab persistence and invalid persisted tab fallback.
- Static frontend tests cover the history view back navigation affordance.
- Type checking must pass for backend and frontend.
- The frontend build must pass.
