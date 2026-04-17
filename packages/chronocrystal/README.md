# Kawa -- SimpleX AI Coding Assistant

A SimpleX chat bot that connects you to a Pi coding agent powered by GitHub Copilot.

## Architecture

```
SimpleX Chat App -> simplex-chat CLI (WebSocket) -> Kawa Bot (Bun) -> Pi Coding Agent -> GitHub Copilot LLM
```

## Quick Start

### Local Development

1. Install simplex-chat CLI:
   ```bash
   curl -L -o ~/.local/bin/simplex-chat \
     https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-22_04-x86_64 \
     && chmod +x ~/.local/bin/simplex-chat
   ```

2. Start the CLI:
   ```bash
   simplex-chat -p 5225 -d ./simplex_db
   ```

3. Set your GitHub token:
   ```bash
   export GITHUB_TOKEN=ghp_your_token
   ```

4. Run the bot:
   ```bash
   bun packages/chronocrystal/src/main.ts
   ```

5. Connect via SimpleX app using the bot address printed on startup

### Docker

```bash
docker build -t chronocrystal .
docker run -e GITHUB_TOKEN=ghp_your_token -v $(pwd)/data:/data chronocrystal
```

### Railway

```bash
railway link    # select chronocrystal project
railway variable set GITHUB_TOKEN=ghp_your_token
railway up
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub token for Copilot LLM access |
| `SIMPLEX_WS_URL` | No | WebSocket URL for simplex-chat CLI (default: `ws://localhost:5225`) |
| `DATA_DIR` | No | Directory for simplex-chat database and auth (default: `/data`) |

## Development

```bash
bun install          # Install dependencies
bun check            # Lint + type check
bun test             # Run tests
bun fix              # Auto-fix lint issues
```

## How It Works

1. simplex-chat CLI runs as a WebSocket server on port 5225
2. Kawa bot connects via the `simplex-chat` npm client
3. Each SimpleX contact gets an isolated pi-coding-agent session
4. Messages are forwarded to the agent session with GitHub Copilot as LLM
5. Agent responses are sent back via SimpleX

## Technical Notes

- **SimpleX Bot Server** -- Receives messages via the SimpleX network
- **ChronoCrystal** -- TypeScript/Bun orchestrator running on Railway
- **Kawa Agent** -- Per-user front-desk agent with custom system prompt
- **Pi Coding Agent** -- Handles wiki updates via SDK sessions

### Session Model

- Each SimpleX user gets an isolated Kawa session
- Background tasks spawn isolated Pi coding-agent sessions
- Everything is observable and logged

### Data Flow

Messages flow from SimpleX to Kawa to (optionally) background agent to TiddlyWiki. Kawa can handle simple queries directly or spawn background agents for complex tasks.

## References

- [SimpleX Chat Bot API](https://github.com/simplex-chat/simplex-chat/blob/stable/bots/README.md)
- [SimpleX Chat TypeScript Client](https://github.com/simplex-chat/simplex-chat/blob/stable/packages/simplex-chat-client/typescript/README.md)
- [Pi Coding Agent SDK](https://github.com/badlogic/pi-mono/tree/stable/packages/coding-agent/examples/sdk)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) -- Auto-extraction patterns
- [TiddlyWiki5](https://github.com/TiddlyWiki/TiddlyWiki5) -- The non-linear personal web notebook

---

*Kawa is Japanese for "river" -- a continuous flow of memory that carries your thoughts forward.*