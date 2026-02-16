## 2024-05-22 - Environment Variable Leakage in Child Processes
**Vulnerability:** `execute_command` tool passed `{...process.env}` to child processes, exposing sensitive extension environment variables (like API keys) to executed commands.
**Learning:** In Node.js, `cp.spawn` by default inherits `process.env` if not specified, or if manually spread. Extensions often run with elevated secrets in their environment.
**Prevention:** Always sanitize `process.env` using a blocklist/allowlist before passing it to `cp.spawn`, especially when executing arbitrary user commands.
