## 2024-05-23 - Focus Preservation on Button State Change
**Learning:** Switching between two buttons using `v-if`/`v-else` (e.g., Send vs. Stop) causes keyboard focus to be lost when the state changes. This is disorienting for screen reader and keyboard-only users.
**Action:** Use a single `<button>` element and dynamically bind its properties (icon, title, aria-label, click handler) to preserve focus during state transitions.
