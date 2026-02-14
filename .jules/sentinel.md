## 2025-05-19 - MCP Environment Isolation
**Vulnerability:** MCP servers spawned via `stdio` transport inherited the entire `process.env` of the extension, potentially exposing sensitive keys (OPENAI_API_KEY, GITHUB_TOKEN) to untrusted tools.
**Learning:** `child_process.spawn` defaults to inheriting `process.env` if `env` is not specified, but here it was explicitly spread. Extensions should follow "Least Privilege" for plugins.
**Prevention:** Implement an environment filter (`filterSafeEnv`) that only allows system basics and non-sensitive variables, or explicitly whitelist variables.
