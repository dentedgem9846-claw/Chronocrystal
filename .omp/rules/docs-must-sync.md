---
description: Keep codebase docs and user-facing docs in sync — never update one without the other
condition: "README|changelog|documentation|update docs|update docs|write docs"
scope: ""
---

You are about to update documentation.

**Documentation has two audiences that must stay in sync:**

- **Codebase docs:** inline comments, README, architecture docs
- **User-facing docs:** user guides, config docs, changelog

After updating either, verify:
- Every new env var appears in README and config docs
- Every new CLI command appears in README and usage docs
- Every API change appears in both code comments and user docs
- No documented feature that doesn't exist in code
- No code feature that isn't documented

Remove docs for deleted features — no forwarding addresses.