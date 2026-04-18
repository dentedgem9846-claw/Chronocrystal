---
description: Use systematic-debugging when encountering failures — never guess fixes
condition: "fix this|quick fix|just change|try changing|maybe if I|probably because|seems like the issue|let me just|workaround"
scope: ""
---

You are about to propose a fix without investigating the root cause.

**Stop. Use `systematic-debugging` skill instead of guessing.**

The full-cycle pipeline requires systematic debugging when anything fails:

1. **Phase 1 — Root Cause:** Read errors, reproduce, check recent changes, gather evidence
2. **Phase 2 — Pattern Analysis:** Find working examples, compare against broken behavior
3. **Phase 3 — Hypothesis:** Form one hypothesis, test minimally
4. **Phase 4 — Fix:** Write failing test first (TDD), implement single fix, verify

If 3+ fixes fail, stop and question the architecture.

Never skip to Phase 4. Never guess. Never apply multiple fixes at once.