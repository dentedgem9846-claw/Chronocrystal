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

The project uses two Railway environments: **test** and **production**.

```bash
railway login
railway init              # create project
railway environment new test
railway variable set GITHUB_TOKEN=ghp_your_token
railway volume add --mount-path /data
railway up                # deploy
```

Deploy to **test** first, run smoke tests, then promote to **production**:

```bash
railway link --environment test --service chronocrystal-bot
railway up

# After smoke tests pass:
railway link --environment production --service chronocrystal-bot
railway up
```

## Health Check

The bot exposes an HTTP server on port **8080** for Railway health checks:

- `GET /health` -- returns `200 ok` when connected to SimpleX, `503 connecting` otherwise
- `GET /` -- returns `200 kawa`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub token for Copilot LLM access |
| `SIMPLEX_WS_URL` | No | WebSocket URL for simplex-chat CLI (default: `ws://localhost:5225`) |
| `DATA_DIR` | No | Directory for simplex-chat database and auth (default: `/data`) |

## Development

```bash
bun install          # Install dependencies
bun run check        # Type check (tsgo) + lint (biome)
bun run check:ts     # Type check only
bun test             # Run tests
bun run fix          # Auto-fix lint issues
```

## Smoke Test

The smoke test connects to a running bot via SimpleX, sends a message, and uses an AI judge to verify the response.

```bash
# Get the bot's address from logs
railway logs | grep "Bot address"

# Run smoke test against the deployed bot
GITHUB_TOKEN=ghp_your_token bun run packages/chronocrystal/scripts/smoke-test.ts <bot-address>
```

## How It Works

1. simplex-chat CLI runs as a WebSocket server on port 5225
2. Kawa bot connects via the `simplex-chat` npm client
3. Each SimpleX contact gets an isolated pi-coding-agent session
4. Messages are forwarded to the agent session with GitHub Copilot as LLM
5. Agent responses are sent back via SimpleX

## References

- [SimpleX Chat Bot API](https://github.com/simplex-chat/simplex-chat/blob/stable/bots/README.md)
- [SimpleX Chat TypeScript Client](https://github.com/simplex-chat/simplex-chat/blob/stable/packages/simplex-chat-client/typescript/README.md)
- [Pi Coding Agent SDK](https://github.com/badlogic/pi-mono/tree/stable/packages/coding-agent/examples/sdk)

---

*Kawa is Japanese for "river" -- a continuous flow of memory that carries your thoughts forward.*