## 2024-05-22 - Command Risk Assessment Obfuscation Bypass
**Vulnerability:** Shell command risk assessment using regex can be bypassed by simple obfuscation like quotes and backslashes (e.g., `'rm' -rf /`, `\rm -rf /`).
**Learning:** Regex-based security checks on raw command strings are insufficient without normalization.
**Prevention:** Normalize commands by stripping quotes and escape characters before applying risk patterns.
