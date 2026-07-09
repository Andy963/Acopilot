# Channel Settings Compact Layout Requirement

## Background

The Channel settings model manager places the model filter input, model list, and manual model ID input too tightly in the vertical direction.
The same settings page also renders capability controls in a narrow VS Code webview, where a separate left icon gutter and left-side multimodal checkbox can waste horizontal space.

## Goal

Improve vertical spacing between the model filter input, model list, and manual model ID input.
Keep capability controls compact and scan-friendly in narrow settings panels.

## Requirements

- Add clear vertical breathing room between the filter input and model list.
- Add clear vertical breathing room between the model list block and manual model ID input.
- Preserve model filtering, selection, removal, manual add, and fetch behavior.
- The tool protocol row must not reserve a separate left icon gutter.
- The tool protocol icon may remain inline with the row label.
- The tool protocol selector must continue to update `toolMode`.
- The multimodal row must render the label text before the checkbox control.
- The multimodal checkbox must remain keyboard and screen-reader accessible.
- The multimodal checkbox must continue to update `multimodalToolsEnabled`.
- Keep the change scoped to Channel settings layout.

## Non-Goals

- Do not change model manager behavior.
- Do not change model or provider capability detection.
- Do not redesign the Channel settings page.
- Do not change model data persistence or API calls.
- Do not change saved channel config shape.

## Validation

- Static test verifies the spacing rules exist.
- Static test verifies the capability control structure.
- Frontend type checking passes.
- Frontend build passes.
