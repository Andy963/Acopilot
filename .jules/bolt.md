## 2026-02-16 - [Regex Compilation Cache]
**Learning:** `new RegExp()` in a loop over thousands of file paths is a significant bottleneck (~4x slowdown). Gitignore patterns are often static during a session, making them ideal candidates for memoization.
**Action:** When working with file matching or pattern filtering in tight loops, always cache compiled regexes.
