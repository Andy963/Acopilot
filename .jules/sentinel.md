## 2025-05-30 - Command Risk Regex Bypass
**Vulnerability:** The regex for detecting `curl | sh` patterns relied on `[^|]*` which stops at the first pipe, allowing bypass via intermediate commands like `curl | cat | sh`.
**Learning:** Simple regexes for shell commands are easily bypassed by chaining. Quoted strings also complicate analysis, but stripping them (as currently done) leads to conservative false positives which is acceptable for security.
**Prevention:** Use regexes that account for intermediate pipe segments `(?:[^;|&]*\|)*` when detecting pipe chains.
