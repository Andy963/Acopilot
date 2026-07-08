# Settings Defaults And Localization Requirement

## Background

Several settings surfaces have inconsistent defaults or layout behavior:

- Built-in tool descriptions are shown in English inside localized settings pages.
- The checkpoint cleanup conversation list can grow with many records instead of staying inside a bounded scroll area.
- Startup cleanup for expired conversations is disabled by default.
- Prompt token estimation defaults to Gemini instead of OpenAI.
- Provider streaming can still fall back to disabled when legacy configs omit `options.stream`.

## Goal

Make settings defaults consistent with the expected product behavior while keeping model-facing tool declarations unchanged.

## Requirements

- Built-in tool descriptions in Tools settings must use localized UI copy when available.
- MCP tool descriptions must continue to show server-provided descriptions.
- The localized display copy must not replace backend tool declarations used in model prompts or API tool definitions.
- The checkpoint cleanup conversation list must keep a bounded height and scroll internally when records exceed that height.
- Startup cleanup for expired conversations must default to enabled for new and legacy-missing checkpoint configs.
- Prompt Settings token estimation must select OpenAI by default.
- Provider streaming must default to enabled when a config omits `options.stream` and `preferStream`.
- Explicit user choices must continue to win over defaults.

## Non-Goals

- Do not redesign the settings page.
- Do not change tool execution behavior or tool schemas.
- Do not change MCP server tool metadata.
- Do not change token counting algorithms.
- Do not change release workflow behavior.

## Validation

- Static tests verify UI localization hooks and bounded checkpoint cleanup scrolling.
- Unit tests verify default checkpoint cleanup behavior and provider stream fallback.
- Existing config bootstrap tests verify new default configs carry streaming options.
- Frontend type checking passes.
- Frontend build passes.
- Project validation passes.
