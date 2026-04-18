---
description: After smoke test or verification failure, cycle back through verify — never shortcut to documentation
condition: "smoke test.*fail|verification.*fail|test.*fail.*but|still failing|just document|document anyway|skip.*deploy"
scope: ""
---

A verification gate has failed. You must cycle through the debug-verify loop, not shortcut to documentation.

**The pipeline only reaches Document when both cycles are green.**

When verification or smoke test fails:

1. Enter `systematic-debugging` — find root cause before fixing
2. After fix, return to Stage 6 (Verify locally)
3. Only after local verify passes: re-deploy (Stage 8)
4. Re-run smoke test (Stage 9)
5. Only after smoke test passes: proceed to Document (Stage 10)

**Never:** Document code that fails verification. Deploy code that fails locally. Claim "probably fixed" without running the verification commands.