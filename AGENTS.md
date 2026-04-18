# Development Rules

## Code Quality

- No `any` types unless absolutely necessary
- **NEVER use `ReturnType<>`** — use the actual type name. Look up return types in source or `node_modules` type definitions and reference them directly. If a function's return type has no exported name, define a named type alias at the call site.
- **No `private`/`protected`/`public` keyword on class fields or methods** — use ES native `#` private fields for encapsulation; leave members that need external access as bare (no keyword). The only place `private`/`protected`/`public` is allowed is on **constructor parameter properties** (e.g., `constructor(private readonly session: Session)`), where TypeScript requires the keyword for the implicit field declaration.
- Prefer `export * from "./module"` over named re-export-from blocks, including `export type { ... } from`. In pure `index.ts` barrel files (re-exports only), use star re-exports even for single-specifier cases.
- **NEVER use inline imports** — no `await import("./foo.js")`, no `import("pkg").Type` in type positions, no dynamic imports for types. Always use standard top-level imports.
- NEVER remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead
- Always ask before removing functionality or code that appears to be intentional
- Check `node_modules` for external API type definitions instead of guessing
- Use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`:

  ```typescript
  // BAD
  const promise = new Promise<string>((resolve, reject) => { ... });

  // GOOD
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  ```

## AI-Friendly Code Structure

- **One responsibility per file.** Split when a file grows beyond ~300 lines. Smaller files produce more reliable AI edits and better reasoning.
- **Predictable patterns.** Similar modules follow the same structure. Command handlers: parse -> validate -> execute -> respond. Services: constructor -> public methods -> private helpers.
- **Clear naming over clever naming.** No abbreviations, no implicit meaning. `handleUserMessage` not `hndl`, `extractInsight` not `proc`.
- **Explicit over implicit.** No hidden side effects. State changes visible at the call site. A function named `getX` must not mutate state.
- **Strategic comments.** Explain WHY, not WHAT. Document domain context, compliance requirements, non-obvious constraints. Never restate what the code already says.
- **Type safety for domain concepts.** Prefer tagged unions over booleans/strings. Use `interface` for contracts, `type` for unions/aliases. Encode domain distinctions in the type system.

## Bun Over Node

This project uses Bun. Use Bun APIs where they provide a cleaner alternative; use `node:fs` for operations Bun doesn't cover.

**NEVER spawn shell commands for operations that have proper APIs** (e.g., `Bun.spawnSync(["mkdir", "-p", dir])` — use `mkdirSync` instead).

### Process Execution

**Prefer Bun Shell** (`$` template literals) for simple commands:

```typescript
import { $ } from "bun";

const result = await $`git status`.cwd(dir).quiet().nothrow();
if (result.exitCode === 0) {
	const text = result.text();
}
```

**Use `Bun.spawn`/`Bun.spawnSync`** only for long-running processes, streaming stdin/stdout/stderr, or process lifecycle control.

**Bun Shell methods:** `.quiet()` suppresses output, `.nothrow()` prevents throwing on non-zero exit, `.text()` gets stdout as string, `.cwd(path)` sets working directory.

### Sleep

**Prefer** `await Bun.sleep(ms)` over `new Promise((resolve) => setTimeout(resolve, ms))`.

### File I/O

**Prefer Bun file APIs:**

```typescript
// Read
const text = await Bun.file(path).text();
const data = await Bun.file(path).json();

// Write (auto-creates parent directories)
await Bun.write(path, data);
```

**Use `node:fs/promises`** for directory operations (Bun has no native directory APIs):

```typescript
import * as fs from "node:fs/promises";

await fs.mkdir(path, { recursive: true });
await fs.rm(path, { recursive: true, force: true });
const entries = await fs.readdir(path);
```

**Avoid sync APIs** in async flows. Use sync only when required by a synchronous interface.

### File I/O Anti-Patterns

**NEVER check `.exists()` before reading** — use try-catch with error code:

```typescript
// BAD: Two syscalls, race condition
if (await Bun.file(path).exists()) {
	return await Bun.file(path).json();
}

// GOOD: One syscall, atomic
try {
	return await Bun.file(path).json();
} catch (err) {
	if (err.code === "ENOENT") return null;
	throw err;
}
```

**NEVER create multiple `Bun.file()` handles to the same path** — reuse a single handle or use try-catch.

**NEVER use `Buffer.from(await Bun.file(x).arrayBuffer())`** — use `fs.readFile(path)` instead.

### JSON5 and JSONL

**Use `Bun.JSON5`** — never add `json5` as a dependency:

```typescript
const data = Bun.JSON5.parse(text);
```

**Use `Bun.JSONL`** — never manually split and parse:

```typescript
const entries = Bun.JSONL.parse(text);
```

## Node Module Imports

**NEVER use named imports from `node:` modules** — always use namespace imports:

```typescript
// BAD
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

// GOOD
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
```

**Choosing between `node:fs` variants:**

- Async-only file → `import * as fs from "node:fs/promises"`
- Needs both sync and async → `import * as fs from "node:fs"`, use `fs.promises.xxx` for async

## Commands

- After code changes: `bun check` (tsc + biome with fixes). Fix all errors before committing.
- NEVER run the full test suite. Only run specific tests when instructed or when you modified test files.
- If you create or modify a test file, you MUST run it and iterate until it passes.

## Testing

- Test contracts, not internals. Tests assert observable behavior through public interfaces.
- No mocks. No `mock.module()`. No placeholder tests (`test("TODO", () => {})`).
- Tests must be full-suite safe: no global mutation leaks, no shared mutable state between tests.
- Run tests from the package root, not the repo root.

## Git Rules

- **ONLY commit files YOU changed in THIS session**
- NEVER use `git add -A` or `git add .` — always `git add <specific-file-paths>`
- Before committing, run `git status` and verify you are only staging your files
- NEVER force push
- NEVER use `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`, or `git commit --no-verify`

## Style

- No emojis in commits, code, or comments
- No fluff or filler text
- Technical prose only


## Secrets and Credentials

- **NEVER log, print, or expose full secret values** — API keys, tokens, passwords, connection strings, or any credential material. This applies to all output: logs, error messages, debug output, and tool results.
- **Existence checks only.** When you need to verify that a secret or token exists, log only enough to confirm presence — the first 4-8 characters followed by a mask:

  ```typescript
  // BAD
  console.log(`Token: ${token}`);
  console.log(`Using key: ${apiKey}`);

  // GOOD
  console.log(`Token: ${token.slice(0, 4)}****`);
  console.log(`Key present: ${apiKey.slice(0, 6)}****`);
  ```

- **Compare secrets by hash, never by value.** When you need to check if two secrets match, hash both and compare the hashes. Never compare plaintext values, and never log either value during comparison:

  ```typescript
  // BAD
  if (receivedToken === expectedToken) { ... }
  if (oldKey === newKey) { ... }

  // GOOD
  const hash = (value: string) =>
    new Bun.CryptoHasher('sha256').update(value).digest('hex');
  if (hash(receivedToken) === hash(expectedToken)) { ... }
  if (hash(oldKey) === hash(newKey)) { ... }
  ```

- **Do not embed secrets in URLs, query strings, or headers visible in logs.** Use environment variables or secret managers for injection. If a URL contains credentials, redact them before logging.
- **Do not commit secrets to version control.** Use `.env` files (listed in `.gitignore`) or environment variables. Never hardcode tokens, keys, or passwords in source code.