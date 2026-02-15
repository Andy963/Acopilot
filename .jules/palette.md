## 2024-05-23 - Tooltip Accessibility
**Learning:** Pure hover-based tooltips are inaccessible to keyboard users. Using `focusin`/`focusout` on the wrapper element allows tooltips to appear for keyboard focus without conflicting with click actions.
**Action:** Always verify interactive components (like tooltips, dropdowns) with keyboard navigation (Tab/Shift+Tab) and screen reader considerations.
