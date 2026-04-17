# SimpleX Bot MVP Design

Prove the end-to-end pipeline: SimpleX message in, LLM response out, deployed on Railway.

## Architecture

```
Railway Service (single Docker container)
 +--------------+    WS localhost:5225    +----------------------------+
 | simplex-chat |<---------------------->| Kawa Bot (Bun)             |
 | CLI binary   |                        |                            |
 +--------------+                        |  simplex-chat npm client   |
                                         |         |                  |
                                         |  Message Router            |
                                         |         |                  |
                                         |  Pi Coding Agent Session   |
                                         |  (@mariozechner/           |
                                         |   pi-coding-agent)         |
                                         |         |                  |
                                         |  GitHub Copilot LLM        |
                                         |  (GITHUB_TOKEN env)        |
                                         +----------------------------+

Env vars: GITHUB_TOKEN (Railway variable)
Volume: /data (simplex-chat database persistence)
```

## Components

### 1. Monorepo Workspace (root)

Follow the OMP pattern for Bun workspaces:

- `package.json` -- workspaces: `packages/*`, type: module, packageManager: bun
- `tsconfig.base.json` -- ES2024, Bundler moduleResolution, strict, verbatimModuleSyntax
- `tsconfig.json` -- references workspace packages
- `biome.json` -- tabs, 3-indent, 120 width, matching OMP rules
- `bunfig.toml` -- isolated linker, .md as text loader

### 2. `packages/chronocrystal` -- the bot package

#### Dependencies

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-coding-agent` | Agent session SDK |
| `@mariozechner/pi-ai` | LLM provider (GitHub Copilot built in) |
| `simplex-chat` | Official SimpleX Chat WS client |

#### Source Files

| File | Responsibility |
|------|---------------|
| `src/main.ts` | Entrypoint: connect to SimpleX CLI, create bot profile/address, start message loop |
| `src/simplex.ts` | Thin wrapper around `simplex-chat` ChatClient -- connect, send reply, process events |
| `src/agent.ts` | Creates and manages pi-coding-agent session per SimpleX contact |
| `src/index.ts` | Barrel exports |

#### `src/main.ts` -- Entrypoint

1. Connect to `simplex-chat` CLI on `ws://localhost:5225`
2. Get or create active user (bot profile)
3. Get or create long-term user address
4. Enable auto-accept for contact requests
5. Log the bot's SimpleX address (for QR code / sharing)
6. Enter message processing loop

#### `src/simplex.ts` -- SimpleX Client Wrapper

Uses the `simplex-chat` npm package's `ChatClient`:
- `ChatClient.create("ws://localhost:5225")` to connect
- `chat.msgQ` async iterator for incoming events
- `chat.apiSendTextMessage(ChatType.Direct, contactId, text)` for replies
- Handles `newChatItems` (incoming messages) and `contactConnected` (new contacts)

#### `src/agent.ts` -- Agent Session Manager

Per-contact sessions using pi-coding-agent SDK:

```typescript
const authStorage = AuthStorage.create("/data/auth.json");
authStorage.setRuntimeApiKey("github-copilot", process.env.GITHUB_TOKEN);
const modelRegistry = ModelRegistry.inMemory(authStorage);
const model = getModel("github-copilot", "claude-sonnet-4");

const { session } = await createAgentSession({
  model,
  authStorage,
  modelRegistry,
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
  // full default tools: read, bash, edit, write
});
```

Session management:
- Map of `contactId -> session`
- Lazy creation on first message from a contact
- Subscribe to session events, collect full text response
- Return response text to SimpleX wrapper for sending

### 3. Dockerfile

Multi-stage build:

```dockerfile
# Stage 1: Build
FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
RUN bun install

# Stage 2: Runtime
FROM ubuntu:24.04
# Install simplex-chat CLI binary (from GitHub releases)
# Install Bun runtime
COPY --from=build /app /app
WORKDIR /app

# Entrypoint starts simplex-chat CLI + bot process
COPY entrypoint.sh /entrypoint.sh
CMD ["/entrypoint.sh"]
```

`entrypoint.sh`:
```bash
#!/bin/bash
# Start simplex-chat CLI as WebSocket server
simplex-chat -p 5225 -d /data/simplex_db &
sleep 2  # wait for CLI to start

# Start bot
cd /app && bun packages/chronocrystal/src/main.ts
```

### 4. Railway Config

`railway.toml`:
```toml
[build]
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "/entrypoint.sh"

[[volumes]]
mount = "/data"
```

Environment variable in Railway dashboard: `GITHUB_TOKEN`

## Data Flow

1. User sends message via SimpleX app
2. `simplex-chat` CLI receives it over SimpleX protocol, emits `newChatItems` WS event
3. Bot process receives event via `ChatClient.msgQ`
4. Extract message text and contact ID from the chat item
5. Find or create pi-coding-agent session for that contact ID
6. Call `session.prompt(messageText)` -- agent runs with full tools against GitHub Copilot
7. Subscribe to session events, accumulate text deltas into full response
8. Send response back via `ChatClient.apiSendTextMessage()`
9. User sees reply in SimpleX app

## What This Validates

- Bun monorepo workspace setup
- Docker build (simplex-chat binary + Bun runtime)
- Railway deployment pipeline
- SimpleX WS communication stability
- pi-coding-agent SDK running headless (no TUI)
- GitHub Copilot auth via env var
- End-to-end: human -> SimpleX -> bot -> LLM -> SimpleX -> human

## Scope Boundaries

**In scope:**
- Single container with simplex-chat CLI + bot
- One pi-coding-agent session per SimpleX contact
- Full default coding tools (read, bash, edit, write)
- Text messages only (no files/images for MVP)

**Out of scope (future work):**
- TiddlyWiki integration (Kawa extraction/storage)
- File/image handling
- Background agent sessions
- Session persistence across restarts
- Multiple Railway services
- Custom system prompt / Kawa personality
