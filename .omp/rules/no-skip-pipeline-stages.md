---
description: Always use the full-cycle pipeline — never skip stages without justification
condition: "just deploy|skip testing|skip review|skip design|straight to|skip verification|don't need to|overkill to|too simple to"
scope: ""
---

You are about to skip a pipeline stage.

**Stop. Every stage exists for a reason. No stage is skipped without explicit justification.**

Common rationalizations and why they fail:

| Rationalization | Reality |
|----------------|---------|
| "Too simple to need design" | Simple changes harbor the most unexamined assumptions |
| "Skip testing, it's obvious" | Obvious bugs are the ones that ship |
| "Skip review, it's small" | Small changes break things in large systems |
| "Skip verification, tests passed earlier" | Verify FRESH — not from memory |
| "Skip docs, no user-facing changes" | API changes and env vars are user-facing |
| "Straight to deploy" | Cycle 1 must be green before Cycle 2 |

If you're about to skip a stage, state which stage and why. If you can't justify it, run the stage.