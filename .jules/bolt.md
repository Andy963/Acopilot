## 2024-05-22 - [Sequential I/O Bottleneck]
**Learning:** The `FileSystemStorageAdapter` used sequential `await` inside a `for` loop for `listSnapshots`, which caused significant latency (10x slower than parallel) when processing many snapshot files. Since `vscode.workspace.fs.readFile` reads the entire file content and there is no metadata-only read, parallelization is critical.
**Action:** Use `Promise.all` with a concurrency limit (batching) for bulk file operations involving `vscode.workspace.fs`. Avoid sequential `await` in loops for I/O.
