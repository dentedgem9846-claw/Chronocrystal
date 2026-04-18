---
description: Run verification before claiming completion or deploying — never skip local verification
condition: "deploying|pushing to|merging to main|railway up|bun run smoke"
scope: ""
---

You are about to deploy or push code without evidence of local verification passing first.

**Stop. Run verification before proceeding.**

The full-cycle pipeline requires local verification (Cycle 1) to pass before any deployment:

1. Run `bun check` — must pass with 0 errors
2. Run all modified tests — must pass
3. Verify requirements against the plan — line by line

Only after all three pass with fresh evidence may you proceed to deploy.