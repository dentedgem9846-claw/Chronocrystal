---
name: full-cycle-development
description: Use when taking a feature or idea from concept through design, implementation, testing, deployment, and documentation in a single end-to-end workflow
---

# Full-Cycle Development

## Overview

Orchestrates an end-to-end development pipeline from idea to deployed, verified feature. Chains existing skills into a sequential pipeline with entry/exit criteria at each stage.

## Pipeline

1. **Design** -- Use `brainstorming`. Entry: idea or request from user. Exit: approved design doc in `docs/superpowers/specs/`.
2. **Plan** -- Use `writing-plans`. Entry: approved design. Exit: TDD implementation plan with ordered tasks.
3. **Implement** -- Use `subagent-driven-development`. Entry: approved plan. Exit: all tasks complete, code review passed.
4. **Verify** -- Use `verification-before-completion`. Entry: implementation complete. Exit: `bun check` passes, all modified tests pass.
5. **Deploy to Staging** -- `[DEFERRED -- requires Railway CLI + token configuration]` Run `railway up` from repo root with `RAILWAY_TOKEN` configured. Entry: verification passes. Exit: deployment URL accessible, health check returns 200. Activate by installing Railway CLI and setting the `RAILWAY_TOKEN` environment variable.
6. **Smoke Test** -- `[DEFERRED -- requires Railway CLI + token configuration]` Run smoke test suite against deployment URL. Entry: staging deployed. Exit: all smoke scenarios pass with evidence. Activate alongside stage 5.
7. **Documentation** -- Update README and docs to reflect new capabilities. Entry: smoke tests pass (or verification passes if deploy deferred). Exit: docs accurate, no undocumented env vars.
8. **Finish** -- Use `finishing-a-development-branch`. Entry: docs updated. Exit: branch merged or PR created.

## Stage Skipping

Stages can be skipped when:

- Design exists already (skip 1)
- Plan exists already (skip 2)
- Deploy infra not configured (skip 5-6)
- No user-facing changes (skip 7)

The agent MUST state which stages are skipped and why.

## Common Mistakes

- Skipping design for "simple" changes -- brainstorming catches assumptions early.
- Deploying before local verification passes.
- Updating docs before code is final.
