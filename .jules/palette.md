## 2024-05-22 - Tooltip Keyboard Accessibility
**Learning:** The custom `Tooltip` component relied solely on `mouseenter`/`mouseleave`, making it inaccessible to keyboard users. This affected all icon-only buttons wrapped in tooltips.
**Action:** Always ensure tooltips and interactive wrappers support `focusin`/`focusout` events to expose context to keyboard users.
