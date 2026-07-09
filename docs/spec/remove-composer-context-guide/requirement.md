# Remove Composer Context Guide Requirement

## Background

The composer top bar currently shows a context lifecycle guide chip next to the attachment button. The chip contains an info icon and text that explains how `@file`, attachments, and pinned context are included.

## Goal

Remove the context guide chip from above the input box.

## Requirements

- The composer top bar must no longer render the context guide label or info icon.
- Attachment, pinned context, plan, selection reference, and attachment chip behavior must remain unchanged.
- Removed UI strings must not remain in active input i18n dictionaries.
- Existing tests must be updated to assert the remaining attachment context metadata behavior only.

## Non-Goals

- Do not remove attachment support metadata.
- Do not remove pinned context behavior.
- Do not change Context Inspector behavior.

## Validation

- Static test for attachment context enhancements must pass.
- Frontend type checking must pass.
- Frontend build must pass.
