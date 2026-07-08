# Channel Model Manager Spacing Requirement

## Background

The Channel settings model manager places the model filter input, model list, and manual model ID input too tightly in the vertical direction.

## Goal

Improve vertical spacing between the model filter input, model list, and manual model ID input.

## Requirements

- Add clear vertical breathing room between the filter input and model list.
- Add clear vertical breathing room between the model list block and manual model ID input.
- Preserve model filtering, selection, removal, manual add, and fetch behavior.
- Keep the change scoped to Channel settings model manager layout.

## Non-Goals

- Do not change model manager behavior.
- Do not redesign the Channel settings page.
- Do not change model data persistence or API calls.

## Validation

- Static test verifies the spacing rules exist.
- Frontend type checking passes.
- Frontend build passes.
