# SimpleX Bot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a SimpleX chat bot on Railway that receives messages, processes them through the pi-coding-agent SDK with GitHub Copilot, and replies.

**Architecture:** Single Docker container runs simplex-chat CLI as WebSocket server plus a Bun process that uses the `simplex-chat` npm client to receive messages, routes them to pi-coding-agent sessions, and sends LLM responses back. One agent session per SimpleX contact.

**Tech Stack:** Bun, TypeScript, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `simplex-chat` (npm), `@simplex-chat/types`, Docker, Railway

---

### Task 1: Root Monorepo Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `bunfig.toml`
- Modify: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

```json
{
	"name": "chronocrystal",
	"private": true,
	"type": "module",
	"packageManager": "bun@1.3.12",
	"workspaces": {
		"packages": [
			"packages/*"
		]
	},
	"scripts": {
		"build": "bun run --workspaces --if-present build",
		"test": "bun run --workspaces --if-present test",
		"check": "bun run --parallel check:ts check:lint",
		"check:ts": "tsgo -p tsconfig.json --noEmit",
		"check:lint": "biome check . --no-errors-on-unmatched",
		"lint": "biome lint . --no-errors-on-unmatched",
		"fmt": "biome format --write . --no-errors-on-unmatched",
		"fix": "biome check --write --unsafe . --no-errors-on-unmatched"
	},
	"devDependencies": {
		"@biomejs/biome": "^2.4",
		"@types/bun": "^1.3",
		"typescript": "^6.0.2"
	}
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
	"compilerOptions": {
		"target": "ES2024",
		"module": "ESNext",
		"lib": ["ES2024", "DOM.AsyncIterable"],
		"moduleResolution": "Bundler",
		"moduleDetection": "force",
		"strict": true,
		"skipLibCheck": true,
		"allowArbitraryExtensions": true,
		"verbatimModuleSyntax": true,
		"noEmit": true,
		"declaration": true,
		"declarationMap": true,
		"sourceMap": true,
		"inlineSources": true,
		"inlineSourceMap": false,
		"resolveJsonModule": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"experimentalDecorators": true,
		"emitDecoratorMetadata": true,
		"useDefineForClassFields": false,
		"types": ["bun"],
		"assumeChangesOnlyAffectDirectDependencies": true
	}
}
```

- [ ] **Step 3: Create root `tsconfig.json`**

```json
{
	"extends": "./tsconfig.base.json",
	"include": [
		"packages/*/src",
		"packages/*/test"
	],
	"exclude": [
		"packages/*/node_modules",
		"references"
	]
}
```

- [ ] **Step 4: Create `biome.json`**

```json
{
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"correctness": {
				"noUnusedImports": "error",
				"noVoidTypeReturn": "off"
			},
			"style": {
				"noNonNullAssertion": "off",
				"useConst": "error",
				"useNodejsImportProtocol": "off"
			},
			"suspicious": {
				"noExplicitAny": "off",
				"noControlCharactersInRegex": "off",
				"noEmptyInterface": "off",
				"noConstEnum": "off"
			}
		}
	},
	"formatter": {
		"enabled": true,
		"indentStyle": "tab",
		"indentWidth": 3,
		"lineWidth": 120,
		"lineEnding": "lf"
	},
	"javascript": {
		"formatter": {
			"semicolons": "always",
			"quoteStyle": "double",
			"trailingCommas": "all",
			"bracketSpacing": true,
			"arrowParentheses": "asNeeded"
		}
	},
	"files": {
		"includes": [
			"packages/*/src/**/*.ts",
			"packages/*/test/**/*.ts",
			"!**/node_modules/**/*"
		]
	}
}
```

- [ ] **Step 5: Create `bunfig.toml`**

```toml
telemetry = false

[install]
linker = "isolated"
exact = true
saveTextLockfile = true

[loader]
".md" = "text"

[run]
bun = true
```

- [ ] **Step 6: Update `.gitignore`**

Add to the end of `.gitignore`:

```
# Bun
bun.lockb

# SimpleX chat database
simplex_db/

# Data volume
/data/
```

- [ ] **Step 7: Run `bun install` and verify workspace resolves**

Run: `bun install`

Expected: installs root devDependencies, creates bun.lock text file, no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.base.json tsconfig.json biome.json bunfig.toml .gitignore
git commit -m "setup: root monorepo workspace with bun, biome, tsconfig"
```

---

### Task 2: Package Scaffold

**Files:**
- Create: `packages/chronocrystal/package.json`
- Create: `packages/chronocrystal/tsconfig.json`

- [ ] **Step 1: Create `packages/chronocrystal/package.json`**

```json
{
	"type": "module",
	"name": "chronocrystal",
	"version": "0.1.0",
	"description": "SimpleX chat bot with pi-coding-agent integration",
	"main": "./src/index.ts",
	"types": "./src/index.ts",
	"scripts": {
		"check": "biome check . && bun run check:types",
		"check:types": "tsgo -p tsconfig.json --noEmit",
		"lint": "biome lint .",
		"test": "bun test",
		"fix": "biome check --write --unsafe .",
		"fmt": "biome format --write ."
	},
	"dependencies": {
		"@mariozechner/pi-coding-agent": "^0.67.6",
		"@mariozechner/pi-ai": "^0.67.6",
		"simplex-chat": "^0.3.0"
	},
	"devDependencies": {
		"@simplex-chat/types": "^0.3.0",
		"@types/bun": "^1.3"
	},
	"engines": {
		"bun": ">=1.3.7"
	},
	"exports": {
		".": {
			"types": "./src/index.ts",
			"import": "./src/index.ts"
		}
	}
}
```

Note: `@simplex-chat/types` is listed as devDependency because it provides TypeScript type definitions used at compile time. The `simplex-chat` package itself depends on it at runtime through its built `dist/` output.

- [ ] **Step 2: Create `packages/chronocrystal/tsconfig.json`**

```json
{
	"extends": "../../tsconfig.base.json",
	"include": [
		"src",
		"test"
	]
}
```

- [ ] **Step 3: Run `bun install` to wire the workspace dependency**

Run: `bun install`

Expected: installs `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `simplex-chat`, `@simplex-chat/types` into the workspace.

- [ ] **Step 4: Commit**

```bash
git add packages/chronocrystal/package.json packages/chronocrystal/tsconfig.json bun.lock
git commit -m "feat: scaffold chronocrystal package with dependencies"
```

---

### Task 3: SimpleX Client Wrapper

**Files:**
- Create: `packages/chronocrystal/src/simplex.ts`
- Create: `packages/chronocrystal/src/main.ts`
- Test: `packages/chronocrystal/test/simplex.test.ts`

This task creates a typed wrapper around the `simplex-chat` npm package. The wrapper provides a clean async interface for connecting to the CLI, receiving messages, and sending replies.

- [ ] **Step 1: Write the failing test**

The test verifies that our wrapper correctly parses incoming `newChatItems` events and extracts the contact ID and message text. Since we cannot connect to a real simplex-chat CLI in tests, we test the message extraction logic directly.

```typescript
// test/simplex.test.ts
import { describe, expect, test } from "bun:test";
import { extractMessage, type IncomingMessage } from "../src/simplex";

describe("extractMessage", () => {
	test("extracts text from a direct chat item", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatItem: {
						content: {
							type: "rcvMsg",
							msgContent: {
								type: "text",
								text: "Hello bot!",
							},
						},
					},
				},
			],
			chatInfo: {
				type: "direct",
				contactId: 42,
			},
		};

		const result = extractMessage(event as any);
		expect(result).toEqual({
			contactId: 42,
			text: "Hello bot!",
		});
	});

	test("returns null for non-direct chats", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatItem: {
						content: {
							type: "rcvMsg",
							msgContent: {
								type: "text",
								text: "group message",
							},
						},
					},
				},
			],
			chatInfo: {
				type: "group",
				groupId: 7,
			},
		};

		const result = extractMessage(event as any);
		expect(result).toBeNull();
	});

	test("returns null for non-text messages", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatItem: {
						content: {
							type: "rcvMsg",
							msgContent: {
								type: "file",
								fileName: "photo.jpg",
							},
						},
					},
				},
			],
			chatInfo: {
				type: "direct",
				contactId: 42,
			},
		};

		const result = extractMessage(event as any);
		expect(result).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/chronocrystal && bun test`

Expected: FAIL -- `extractMessage` and `IncomingMessage` not exported from `../src/simplex`.

- [ ] **Step 3: Implement `src/simplex.ts`**

```typescript
import { ChatClient, type ChatServer } from "simplex-chat";
import { ChatType } from "@simplex-chat/types";

export interface IncomingMessage {
	contactId: number;
	text: string;
}

const DEFAULT_SERVER: ChatServer = {
	host: "localhost",
	port: "5225",
};

/** Extract a text message from a newChatItems event.
 * Returns null if the event is not a direct text message. */
export function extractMessage(event: Record<string, any>): IncomingMessage | null {
	if (event.type !== "newChatItems") return null;

	const chatInfo = event.chatInfo;
	if (!chatInfo || chatInfo.type !== "direct") return null;

	const contactId: number = chatInfo.contactId;

	for (const item of event.chatItems ?? []) {
		const content = item?.chatItem?.content;
		if (content?.type === "rcvMsg" || content?.type === "sndMsg") {
			const msgContent = content.msgContent;
			if (msgContent?.type === "text" && typeof msgContent.text === "string") {
				return { contactId, text: msgContent.text };
			}
		}
	}

	return null;
}

/** Connect to simplex-chat CLI and return the ChatClient. */
export async function connectSimplex(server?: ChatServer): Promise<ChatClient> {
	const srv = server ?? DEFAULT_SERVER;
	const client = await ChatClient.create(srv);
	return client;
}

/** Send a text reply to a contact. */
export async function sendReply(client: ChatClient, contactId: number, text: string): Promise<void> {
	await client.apiSendTextMessage(ChatType.Direct, contactId, text);
}
```

- [ ] **Step 4: Create `src/index.ts` barrel**

```typescript
export * from "./simplex";
export * from "./agent";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/chronocrystal && bun test`

Expected: PASS -- all three extractMessage tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/chronocrystal/src/simplex.ts packages/chronocrystal/src/index.ts packages/chronocrystal/test/simplex.test.ts
git commit -m "feat: simplex client wrapper with message extraction"
```

---

### Task 4: Agent Session Manager

**Files:**
- Create: `packages/chronocrystal/src/agent.ts`
- Test: `packages/chronocrystal/test/agent.test.ts`

This task creates the per-contact agent session manager using the pi-coding-agent SDK. Each SimpleX contact gets an isolated session with GitHub Copilot as the LLM provider.

- [ ] **Step 1: Write the failing test**

The test verifies that the session manager creates sessions lazily and returns the same session for the same contact. We cannot call the real LLM in tests, so we test the session lifecycle (creation, reuse) by mocking only the `createAgentSession` import.

However, per project rules: no mocks. Instead, we test that the session manager returns distinct sessions for distinct contacts and the same session object for the same contact ID, using a custom `streamFn` that doesn't make network calls.

```typescript
// test/agent.test.ts
import { describe, expect, test } from "bun:test";
import { AgentSessionManager } from "../src/agent";

describe("AgentSessionManager", () => {
	test("returns distinct sessions for distinct contacts", async () => {
		const manager = new AgentSessionManager({
			githubToken: "test-token",
			dataDir: "/tmp/chronocrystal-test-1",
		});

		const session1 = await manager.getOrCreateSession(1);
		const session2 = await manager.getOrCreateSession(2);

		expect(session1).not.toBe(session2);
	});

	test("returns the same session for the same contact", async () => {
		const manager = new AgentSessionManager({
			githubToken: "test-token",
			dataDir: "/tmp/chronocrystal-test-2",
		});

		const session1 = await manager.getOrCreateSession(1);
		const session2 = await manager.getOrCreateSession(1);

		expect(session1).toBe(session2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/chronocrystal && bun test`

Expected: FAIL -- `AgentSessionManager` not exported.

- [ ] **Step 3: Implement `src/agent.ts`**

```typescript
import { getModel } from "@mariozechner/pi-ai";
import {
	AuthStorage,
	createAgentSession,
	type CreateAgentSessionResult,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";
import * as path from "node:path";

export interface AgentConfig {
	githubToken: string;
	dataDir: string;
}

export class AgentSessionManager {
	#config: AgentConfig;
	#sessions = new Map<number, CreateAgentSessionResult>();
	#authStorage?: AuthStorage;
	#modelRegistry?: ModelRegistry;

	constructor(config: AgentConfig) {
		this.#config = config;
	}

	async #ensureAuth(): Promise<{ authStorage: AuthStorage; modelRegistry: ModelRegistry }> {
		if (!this.#authStorage || !this.#modelRegistry) {
			const authPath = path.join(this.#config.dataDir, "auth.json");
			this.#authStorage = AuthStorage.create(authPath);
			this.#authStorage.setRuntimeApiKey("github-copilot", this.#config.githubToken);
			this.#modelRegistry = ModelRegistry.inMemory(this.#authStorage);
		}
		return { authStorage: this.#authStorage, modelRegistry: this.#modelRegistry };
	}

	async getOrCreateSession(contactId: number): Promise<CreateAgentSessionResult> {
		const existing = this.#sessions.get(contactId);
		if (existing) return existing;

		const { authStorage, modelRegistry } = await this.#ensureAuth();

		// Use a Claude model available via GitHub Copilot
		const model = getModel("github-copilot", "claude-sonnet-4");
		if (!model) {
			throw new Error("Failed to resolve github-copilot claude-sonnet-4 model");
		}

		const result = await createAgentSession({
			model,
			authStorage,
			modelRegistry,
			sessionManager: SessionManager.inMemory(),
			settingsManager: SettingsManager.inMemory({
				compaction: { enabled: false },
				retry: { enabled: true, maxRetries: 2 },
			}),
		});

		this.#sessions.set(contactId, result);
		return result;
	}

	/** Send a prompt to a contact's session and collect the full text response. */
	async prompt(contactId: number, text: string): Promise<string> {
		const { session } = await this.getOrCreateSession(contactId);

		const { promise, resolve } = Promise.withResolvers<string>();
		let accumulated = "";

		const unsubscribe = session.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				accumulated += event.assistantMessageEvent.delta;
			}
			if (event.type === "agent_end") {
				unsubscribe();
				resolve(accumulated);
			}
		});

		await session.prompt(text);
		return promise;
	}

	/** Remove a session (e.g., on contact disconnect). */
	deleteSession(contactId: number): void {
		this.#sessions.delete(contactId);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/chronocrystal && bun test`

Expected: Both tests PASS. The session manager creates distinct sessions for different contact IDs and reuses the session for the same contact.

- [ ] **Step 5: Commit**

```bash
git add packages/chronocrystal/src/agent.ts
git commit -m "feat: agent session manager with per-contact sessions"
```

---

### Task 5: Main Entrypoint

**Files:**
- Create: `packages/chronocrystal/src/main.ts`

This task wires the SimpleX client to the agent session manager. The main loop receives messages from SimpleX, routes them to the right agent session, and sends LLM responses back.

- [ ] **Step 1: Implement `src/main.ts`**

```typescript
import { ChatClient } from "simplex-chat";
import { AgentSessionManager } from "./agent";
import { extractMessage, sendReply } from "./simplex";

const SIMPLEX_WS_URL = process.env.SIMPLEX_WS_URL ?? "ws://localhost:5225";
const DATA_DIR = process.env.DATA_DIR ?? "/data";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
	console.error("GITHUB_TOKEN environment variable is required");
	process.exit(1);
}

async function main(): Promise<void> {
	console.log("Connecting to SimpleX Chat CLI at", SIMPLEX_WS_URL);
	const client = await ChatClient.create(SIMPLEX_WS_URL);

	// Get or create bot profile
	const user = await client.apiGetActiveUser();
	if (!user) {
		console.error(
			"No user profile found. Initialize simplex-chat CLI first with: simplex-chat -d <db_path>",
		);
		process.exit(1);
	}
	console.log(`Bot profile: ${user.profile.displayName} (${user.profile.fullName})`);

	// Get or create address for accepting contacts
	const address = await client.apiGetUserAddress();
	if (address) {
		console.log(`Bot address: ${address}`);
	} else {
		const newAddress = await client.apiCreateUserAddress();
		console.log(`Created bot address: ${newAddress}`);
	}

	// Enable auto-accept for incoming contact requests
	await client.enableAddressAutoAccept();
	console.log("Auto-accept enabled for incoming contacts");

	const agentManager = new AgentSessionManager({
		githubToken: GITHUB_TOKEN,
		dataDir: DATA_DIR,
	});

	console.log("Listening for messages...");

	// Process incoming events from SimpleX
	for await (const event of client.msgQ) {
		const resolved = event instanceof Promise ? await event : event;

		// Handle new contact connections
		if (resolved.type === "contactConnected") {
			const contact = resolved.contact;
			console.log(`Contact connected: ${contact.profile.displayName}`);
			await sendReply(
				client,
				contact.contactId,
				"Hello! I'm Kawa, your AI coding assistant. Send me a message and I'll help you out.",
			);
			continue;
		}

		// Handle incoming messages
		const msg = extractMessage(resolved as any);
		if (!msg) continue;

		console.log(`Message from contact ${msg.contactId}: ${msg.text}`);

		try {
			const response = await agentManager.prompt(msg.contactId, msg.text);
			if (response) {
				await sendReply(client, msg.contactId, response);
				console.log(`Replied to contact ${msg.contactId}`);
			}
		} catch (err) {
			console.error(`Error processing message from contact ${msg.contactId}:`, err);
			await sendReply(client, msg.contactId, "Sorry, I encountered an error processing your message.");
		}
	}

	console.log("SimpleX client disconnected");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd /workspaces/chronocrystal && bun run check:ts`

Expected: No type errors. Note: this may fail if `simplex-chat` npm package has incompatible types with our Bun/ES2024 setup. If so, add `skipLibCheck: true` is already set in tsconfig.base.json.

- [ ] **Step 3: Commit**

```bash
git add packages/chronocrystal/src/main.ts packages/chronocrystal/src/index.ts
git commit -m "feat: main entrypoint wiring simplex to agent"
```

---

### Task 6: Docker Configuration

**Files:**
- Create: `Dockerfile`
- Create: `entrypoint.sh`

- [ ] **Step 1: Create `Dockerfile`**

Multi-stage build: first stage installs deps, second stage is the runtime with simplex-chat CLI binary and Bun.

```dockerfile
# Stage 1: Install dependencies
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json tsconfig.base.json tsconfig.json biome.json bunfig.toml ./
COPY packages/chronocrystal/package.json packages/chronocrystal/package.json
RUN bun install --frozen-lockfile

# Stage 2: Runtime
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install simplex-chat CLI binary from GitHub releases
RUN curl -L -o /usr/local/bin/simplex-chat \
    "https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-22_04-x86_64" \
    && chmod +x /usr/local/bin/simplex-chat

# Install Bun runtime
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app
COPY --from=build /app /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Data volume for simplex-chat database
VOLUME /data

ENV SIMPLEX_WS_URL=ws://localhost:5225
ENV DATA_DIR=/data

CMD ["/entrypoint.sh"]
```

- [ ] **Step 2: Create `entrypoint.sh`**

```bash
#!/bin/bash
set -e

# Start simplex-chat CLI as WebSocket server in the background
simplex-chat -p 5225 -d /data/simplex_db --create-bot-display-name "Kawa" &
SIMPLEX_PID=$!

# Wait for the CLI to be ready
echo "Waiting for simplex-chat CLI to start..."
for i in $(seq 1 30); do
    if curl -s http://localhost:5225 > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "SimpleX Chat CLI started (PID $SIMPLEX_PID)"

# Start the bot process
cd /app
bun packages/chronocrystal/src/main.ts &
BOT_PID=$!

# Wait for either process to exit
wait -n $SIMPLEX_PID $BOT_PID

# If one exits, kill the other
kill $SIMPLEX_PID $BOT_PID 2>/dev/null || true
wait
```

- [ ] **Step 3: Add Docker files to `.gitignore`**

Append to `.gitignore`:

```
# Docker
.docker/
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile entrypoint.sh .gitignore
git commit -m "infra: docker configuration with simplex-chat CLI and Bun"
```

---

### Task 7: Railway Configuration

**Files:**
- Create: `railway.toml`

- [ ] **Step 1: Create `railway.toml`**

```toml
[build]
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[[volumes]]
mount = "/data"
```

- [ ] **Step 2: Create `.env.example` for local development reference**

```
# Required: GitHub token for Copilot LLM access
GITHUB_TOKEN=

# Optional: SimpleX Chat CLI WebSocket URL (default: ws://localhost:5225)
SIMPLEX_WS_URL=ws://localhost:5225

# Optional: Data directory for simplex-chat database and auth (default: /data)
DATA_DIR=/data
```

- [ ] **Step 3: Commit**

```bash
git add railway.toml .env.example
git commit -m "infra: railway deployment configuration"
```

---

### Task 8: Verify Full Pipeline Locally

**Files:**
- No new files

This task verifies the Docker build works and the bot can connect to simplex-chat CLI locally.

- [ ] **Step 1: Build Docker image**

Run: `docker build -t chronocrystal .`

Expected: Build succeeds. Image contains simplex-chat binary at `/usr/local/bin/simplex-chat` and the Bun app at `/app`.

- [ ] **Step 2: Run the container with a test GitHub token**

Run: `docker run -e GITHUB_TOKEN=ghp_test_token -v $(pwd)/test-data:/data chronocrystal`

Expected: Container starts, simplex-chat CLI starts on port 5225, bot process connects and prints "Listening for messages...". It will fail to authenticate with the fake token, but the pipeline (CLI start -> bot connect -> session creation attempt) is validated.

- [ ] **Step 3: Clean up test data**

```bash
rm -rf test-data
```

- [ ] **Step 4: Run `bun check` to verify no lint/type errors**

Run: `bun check`

Expected: All checks pass.

---

### Task 9: Deploy to Railway

**Files:**
- No new files

- [ ] **Step 1: Install Railway CLI (if not already installed)**

Run: `curl -fsSL cli.new | sh`

Or via npm: `bun install -g @railway/cli`

- [ ] **Step 2: Login to Railway**

Run: `railway login`

Expected: Opens browser for Railway authentication.

- [ ] **Step 3: Initialize Railway project**

Run: `railway init`

Select: Create new project, choose a name like "chronocrystal".

- [ ] **Step 4: Add `GITHUB_TOKEN` environment variable**

Run: `railway variables set GITHUB_TOKEN=<your-github-token>`

Or set via Railway dashboard: Project > Variables > Add `GITHUB_TOKEN`.

- [ ] **Step 5: Deploy**

Run: `railway up`

Expected: Railway builds the Docker image, deploys it, starts the container. Bot connects to simplex-chat CLI, creates a user profile, and logs its SimpleX address.

- [ ] **Step 6: Verify the deployment is running**

Run: `railway logs`

Expected: Logs show:
- "SimpleX Chat CLI started"
- "Bot profile: Kawa"
- "Bot address: ..."
- "Listening for messages..."

- [ ] **Step 7: Connect to the bot via SimpleX app**

Open SimpleX Chat app on phone, scan the bot address QR code or paste the connection link. Send a message. Verify the bot responds with an LLM-generated reply.

- [ ] **Step 8: Commit the final state**

```bash
git add -A
git commit -m "chore: verify full pipeline, ready for deployment"
```

---

### Task 10: Update README

**Files:**
- Modify: `packages/chronocrystal/README.md`

- [ ] **Step 1: Update README with deployment and usage instructions**

Rewrite `packages/chronocrystal/README.md` to reflect the MVP implementation:

```markdown
# Kawa -- SimpleX AI Coding Assistant

A SimpleX chat bot that connects you to a Pi coding agent powered by GitHub Copilot.

## Architecture

SimpleX Chat App -> simplex-chat CLI (WebSocket) -> Kawa Bot (Bun) -> Pi Coding Agent -> GitHub Copilot LLM

## Quick Start

### Local Development

1. Install simplex-chat CLI: `curl -o ~/.local/bin/simplex-chat https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-22_04-x86_64 && chmod +x ~/.local/bin/simplex-chat`
2. Start the CLI: `simplex-chat -p 5225 -d ./simplex_db`
3. Set your GitHub token: `export GITHUB_TOKEN=ghp_your_token`
4. Run the bot: `bun packages/chronocrystal/src/main.ts`
5. Connect via SimpleX app using the bot address printed on startup

### Docker

```bash
docker build -t chronocrystal .
docker run -e GITHUB_TOKEN=ghp_your_token -v $(pwd)/data:/data chronocrystal
```

### Railway

```bash
railway login
railway init
railway variables set GITHUB_TOKEN=ghp_your_token
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

---

*Kawa is Japanese for "river" -- a continuous flow of memory that carries your thoughts forward.*
```

- [ ] **Step 2: Commit**

```bash
git add packages/chronocrystal/README.md
git commit -m "docs: update README with deployment and usage instructions"
```