## 2024-05-22 - Unenforced Security Policy in Tool Execution
**Vulnerability:** The `execute_command` tool was not utilizing the existing `commandRisk.ts` module, allowing high-risk commands (e.g., `rm -rf /`, `curl | sh`) to be executed without any checks or user confirmation.
**Learning:** Security modules like `commandRisk` are useless if not explicitly integrated into the execution path. Having the policy defined in settings is not enough; the tool handler must enforce it.
**Prevention:** Ensure all sensitive tools (terminal, file operations) have explicit hooks into the risk assessment system. Add integration tests that verify risk policies are actually enforced, not just that the risk assessment logic works in isolation.
