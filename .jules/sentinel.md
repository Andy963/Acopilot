
## 2025-02-14 - [CRITICAL] Fix sensitive environment variable leak to child processes
**Vulnerability:** The `execute_command` tool was passing `process.env` directly to child processes when executing shell commands. This could expose sensitive environment variables (e.g., API keys, secrets) to the shell environment.
**Learning:** Even though `filterSensitiveEnv` was implemented, it was not being utilized when `execute_command` was creating child processes via `cp.spawn`. This highlights a pattern of defining security measures but failing to apply them at all relevant execution boundaries.
**Prevention:** Always verify that environment filtering is applied before passing `process.env` to any child process or external execution context. Ensure that tools that execute external commands are rigorously audited for environmental leakages.
