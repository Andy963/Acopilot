## 2025-02-23 - Tooltip & Icon Button Accessibility
**Learning:** `Tooltip` components wrapping `IconButton`s were often visually present but inaccessible to keyboard users and screen readers.
- `Tooltip.vue` lacked keyboard focus triggers (`focusin/focusout`).
- `IconButton`s inside tooltips often lacked `aria-label`, relying solely on the visual tooltip for context.
- Some usages passed incorrect props (`:text` instead of `:content`), causing tooltips to not render at all.
**Action:** Always ensure `Tooltip` supports keyboard interaction. When wrapping icon-only buttons with `Tooltip`, explicitly pass `aria-label` to the button matching the tooltip content. Verify prop names against component definitions.
