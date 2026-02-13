## 2026-02-13 - Redaction Throughput Optimization
**Learning:** The redaction logic was applying sequential regex replacements, causing O(K) string allocations and traversals for K patterns.
**Action:** Combine compatible patterns (e.g., token formats) into a single regex with alternation to reduce overhead from O(K) to O(1) pass.
