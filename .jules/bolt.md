## 2024-05-23 - Sequential File Hashing in Checkpoints
**Learning:** The checkpoint system was sequentially hashing all files in the workspace to detect changes. For 500+ files, this took ~500ms. In larger repos, this would be seconds.
**Action:** Parallelized file hashing and copying with `Promise.all` and a concurrency limit (50). Reduced time by ~3-4x. Always parallelize bulk IO operations.
