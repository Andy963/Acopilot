## 2026-03-18 - Optimize array intersection filtering
**Learning:** Using `Set` for array intersection lookups inside filters improves performance from O(N * M) to O(N) by reducing lookup time to O(1). This pattern was specifically noted in memory as an optimization target.
**Action:** When filtering arrays by matching multiple criteria (e.g., tags), convert the filter criteria to a `Set` before the iteration loop.
