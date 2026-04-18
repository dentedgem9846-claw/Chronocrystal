// scripts/smoke-test.ts
// Smoke test that:
// 1. Deploys to Railway test environment
// 2. Spawns a local simplex-chat CLI
// 3. Connects to the production bot
// 4. Sends a test prompt
// 5. Verifies the response via AI judge

import { ChatClient } from "simplex-chat";
import { T, type ChatEvent } from "@simplex-chat/types";
import { logger } from "../src/logger";
import { getModel } from "@mariozechner/pi-ai";
import {
	AuthStorage,
	createAgentSession,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface JudgeVerdict {
	verdict: "pass" | "fail";
	reasoning: string;
}

const SIMPLEX_PORT = 5224;
const CONTACT_READY_TIMEOUT_MS = 60000;
const PRE_SEND_IDLE_TIMEOUT_MS = 2000;
const REPLY_TIMEOUT_MS = 120000;
const SMOKE_PROMPT = "What is 5 factorial?";
const JUDGE_RUBRIC = "The response must state that 5! equals 120.";

interface SmokeResult {
	botAddress: string;
	environment: string;
}

/** Buffer ChatEvents with timeout-based polling. */
class BufferedEvents {
	#queue: ChatEvent[] = [];
	#resolvers: Array<(event: ChatEvent | null) => void> = [];
	#error: Error | null = null;
	#closed = false;

	constructor(source: AsyncIterable<ChatEvent>) {
		void this.consume(source);
	}

	private async consume(source: AsyncIterable<ChatEvent>): Promise<void> {
		try {
			for await (const event of source) {
				const resolve = this.#resolvers.shift();
				if (resolve) {
					resolve(event);
					continue;
				}
				this.#queue.push(event);
			}
		} catch (error) {
			this.#error = error instanceof Error ? error : new Error(String(error));
		} finally {
			this.#closed = true;
			for (const resolve of this.#resolvers) {
				resolve(null);
			}
		}
	}

	async next(timeoutMs: number): Promise<ChatEvent | null> {
		if (this.#error) throw this.#error;

		const queued = this.#queue.shift();
		if (queued) return queued;
		if (this.#closed) throw new Error("Event stream ended unexpectedly");

		return new Promise<ChatEvent | null>((resolve) => {
			const timer = setTimeout(() => resolve(null), timeoutMs);
			this.#resolvers.push((event) => {
				clearTimeout(timer);
				resolve(event);
			});
		});
	}
}

async function* iterateEvents(
	source: { next(): Promise<{ value?: ChatEvent | Promise<ChatEvent>; done?: boolean }> },
): AsyncGenerator<ChatEvent> {
	while (true) {
		const next = await source.next();
		if (next.done) return;
		if (next.value !== undefined) yield await next.value;
	}
}

async function deployToRailway(): Promise<void> {
	logger.info("Deploying to Railway test environment...");

	// Check if there's already a deployment in progress
	const statusProcess = Bun.spawn({
		cmd: ["railway", "deployment", "list"],
		stdout: "pipe",
	});
	const statusOutput = statusProcess.stdout ? await new Response(statusProcess.stdout).text() : "";
	await statusProcess.exited;

	const hasDeploying = statusOutput.includes("DEPLOYING");
	if (hasDeploying) {
		logger.info("Deployment already in progress, waiting for it to complete...");
	} else {
		const deployProcess = Bun.spawn({
			cmd: ["railway", "up"],
			stdout: "pipe",
			stderr: "pipe",
		});

		let deployUrl = "";
		const stdout = deployProcess.stdout ? await new Response(deployProcess.stdout).text() : "";

		// Extract deployment URL from output
		const urlMatch = stdout.match(/https?:\/\/[^\s]+railway\.app/);
		if (urlMatch) {
			deployUrl = urlMatch[0];
			logger.info(`Deployment URL: ${deployUrl}`);
		}

		const exitCode = await deployProcess.exited;
		if (exitCode !== 0) {
			const stderr = deployProcess.stderr ? await new Response(deployProcess.stderr).text() : "";
			throw new Error(`Railway deployment failed with exit code ${exitCode}: ${stderr || stdout}`);
		}
	}

	logger.info("Waiting for deployment to complete...");

	// Poll deployment status until SUCCESS
	const deadline = Date.now() + 300_000; // 5 minute timeout
	let checkCount = 0;
	while (Date.now() < deadline) {
		await Bun.sleep(15_000);
		checkCount++;

		const statusProcess = Bun.spawn({
			cmd: ["railway", "deployment", "list"],
			stdout: "pipe",
		});
		const statusOutput = statusProcess.stdout ? await new Response(statusProcess.stdout).text() : "";
		await statusProcess.exited;

		logger.info(`Checking deployment status (attempt ${checkCount})...`);

		// Parse deployment list to find first non-REMOVED deployment
		const lines = statusOutput.split("\n").filter((l) => l.trim());
		for (const line of lines) {
			if (line.includes("SUCCESS")) {
				logger.info("Deployment successful!");
				return;
			}
			if (line.includes("FAILED")) {
				throw new Error(`Deployment failed: ${line}`);
			}
		}
	}

	throw new Error("Deployment timed out after 5 minutes");
}

async function getAutomationStatus(): Promise<SmokeResult> {
	const baseUrl = process.env.SMOKE_PROD_BASE_URL ?? "https://chronocrystal-bot-test.up.railway.app";
	const response = await fetch(`${baseUrl}/automation/status`);
	if (!response.ok) {
		throw new Error(`Automation status failed: ${response.status} ${await response.text()}`);
	}
	const status = await response.json() as { simplexAddress: string; environment: string };
	if (!status.simplexAddress) throw new Error("No simplex address in automation status");
	return { botAddress: status.simplexAddress, environment: status.environment };
}

async function runSmokeTest(): Promise<void> {
	// Deploy to Railway test first
	await deployToRailway();

	logger.info("Fetching automation status...");
	const { botAddress, environment } = await getAutomationStatus();
	logger.info(`Production bot: ${botAddress} (${environment})`);

	// Create temp directory for simplex database
	const tempDir = await fs.mkdtemp(join(tmpdir(), "smoke-"));
	const dataPrefix = join(tempDir, "simplex");

	// Spawn local simplex-chat
	logger.info("Starting local simplex-chat...");
	const simplexProcess = Bun.spawn({
		cmd: [
			"simplex-chat",
			"-d", dataPrefix,
			"-p", String(SIMPLEX_PORT),
			"-y",
			"--create-bot-display-name", `Smoke${Date.now().toString(36)}`,
		],
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		lazy: true,
	});

	// Connect to local simplex-chat
	logger.info(`Connecting to local simplex-chat on port ${SIMPLEX_PORT}...`);
	const client = await connectWithRetry(`ws://127.0.0.1:${SIMPLEX_PORT}`, simplexProcess);
	const events = new BufferedEvents(iterateEvents(client.msgQ));

	// Get or create active user
	const user = await client.apiGetActiveUser();
	if (!user) {
		throw new Error("No active user - simplex-chat failed to start properly");
	}
	logger.info(`Connected as: ${user.profile.displayName} (userId: ${user.userId})`);

		// Connect to production bot
	logger.info(`Connecting to bot at ${botAddress}...`);
	let connReqType: string;
	const connectTime = Date.now();
	
	try {
		connReqType = await client.apiConnectActiveUser(botAddress);
	} catch (err: any) {
		// CLI v6.5+ may return connectionPlan instead - connection was still initiated
		if (err?.response?.type === "connectionPlan") {
			connReqType = "Contact (connectionPlan)";
		} else {
			throw err;
		}
	}
	logger.info(`Connection sent: ${connReqType}`);

	// Wait for contact to be ready (bot may already have sent hello message)
	logger.info("Waiting for contact to be ready...");
	const contactId = await waitForContactReady(events, connectTime);

	// Bot already sent hello message before we got here - just send our test
	logger.info(`Sending: ${SMOKE_PROMPT}`);
	await client.apiSendTextMessage(T.ChatType.Direct, contactId, SMOKE_PROMPT);

	// Wait for reply
	const reply = await waitForReply(events, contactId);
	logger.info(`Received: ${reply}`);

	// Judge the response
	const verdict = await judgeResponse(SMOKE_PROMPT, reply);
	logger.info(`Judge: ${verdict.verdict} - ${verdict.reasoning}`);

	if (verdict.verdict !== "pass") {
		throw new Error(`Smoke test failed: ${verdict.reasoning}`);
	}

	logger.info("SMOKE TEST PASSED");

	// Cleanup
	await cleanup(client, contactId, simplexProcess, tempDir);
}

async function connectWithRetry(
	url: string,
	process: Bun.PipedSubprocess,
): Promise<ChatClient> {
	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		if (process.exitCode !== null) {
			const stderr = process.stderr ? await process.stderr.text() : "";
			throw new Error(`simplex-chat exited with code ${process.exitCode}: ${stderr}`);
		}
		try {
			return await ChatClient.create(url);
		} catch {
			await Bun.sleep(500);
		}
	}
	throw new Error(`Timed out connecting to ${url}`);
}

async function waitForContactReady(events: BufferedEvents, connectTime: number): Promise<number> {
	// Track seen message timestamps to filter out hello message from bot
	const seenMessages = new Set<string>();
	let contactId: number | null = null;
	
	while (true) {
		const event = await events.next(CONTACT_READY_TIMEOUT_MS);
		if (!event) throw new Error("Timed out waiting for contact to be ready");

		if (event.type === "contactConnecting") {
			const cid = (event as any).contact?.contactId;
			if (cid !== undefined) {
				contactId = cid;
				logger.info(`Contact connecting: ${cid}`);
			}
			continue;
		}

		if (event.type === "contactConnected" || event.type === "contactSndReady") {
			const cid = (event as any).contact?.contactId;
			if (cid !== undefined) {
				logger.info(`Contact ready: ${cid}`);
				return cid;
			}
		}
		
		// Also get contactId from newChatItems events (bot sends hello message first)
		if (event.type === "newChatItems") {
			for (const item of event.chatItems ?? []) {
				const chatInfo = item?.chatInfo;
				if (chatInfo?.type === "direct" && chatInfo.contact?.contactId !== undefined) {
					if (contactId === null) {
						contactId = chatInfo.contact.contactId;
						logger.info(`Got contactId from newChatItems: ${contactId}`);
					}
				}

				const chatItem = item?.chatItem;
				const itemTs = chatItem?.meta?.itemTs;
				const content = chatItem?.content as Record<string, any>;
				const msgContent = content?.msgContent as Record<string, any>;
				
				if (itemTs && msgContent?.type === "text") {
					seenMessages.add(itemTs);
				}
			}
			
			// If we have contactId and have seen messages, we can proceed
			if (contactId !== null && seenMessages.size > 0) {
				logger.info(`Contact ready (from messages): ${contactId}`);
				return contactId;
			}
		}
	}
}

async function drainEvents(events: BufferedEvents, timeoutMs: number): Promise<void> {
	while (true) {
		const event = await events.next(timeoutMs);
		if (!event) return;
		// Drain until idle
	}
}

async function waitForReply(events: BufferedEvents, contactId: number): Promise<string> {
	const sentAt = Date.now();

	// Track messages we've already seen (to skip hello message)
	const seenTimestamps = new Set<string>();
	const helloPattern = /hello.*i'?m kawa|ai coding assistant/i;

	while (true) {
		const event = await events.next(REPLY_TIMEOUT_MS);
		if (!event) throw new Error("Timed out waiting for reply");

		if (event.type !== "newChatItems") continue;

		for (const item of event.chatItems ?? []) {
			// SimpleX 0.3.0: chatInfo is on each item
			const chatInfo = item?.chatInfo;
			const chatItem = item?.chatItem;

			if (!chatInfo || chatInfo.type !== "direct") continue;
			if (chatInfo.contact?.contactId !== contactId) continue;

			// Content can be rcvMsgContent (new CLI) or have msgContent directly (old CLI)
			const content = chatItem?.content as Record<string, any> | undefined;
			let msgContent = content?.msgContent as Record<string, any> | undefined;

			// Handle different content structures
			if (!msgContent) {
				msgContent = content?.rcvMsg ?? content?.sndMsg;
			}

			if (!msgContent || msgContent.type !== "text") continue;

			const msgText = msgContent.text.trim();

			// Skip if we've already seen this exact message
			if (seenTimestamps.has(msgText)) continue;
			seenTimestamps.add(msgText);

			// Skip the bot's hello message (sent before our prompt)
			if (helloPattern.test(msgText)) {
				logger.info(`Skipping hello message: ${msgText.substring(0, 30)}...`);
				continue;
			}

			// Check timestamp to avoid pre-send messages
			const itemTs = chatItem?.meta?.itemTs;
			if (itemTs) {
				const itemTime = Date.parse(itemTs);
				if (Number.isFinite(itemTime) && itemTime < sentAt) {
					logger.info(`Ignoring pre-prompt message (ts): ${msgText.substring(0, 30)}...`);
					continue;
				}
			}

			return msgText;
		}
	}
}

async function judgeResponse(prompt: string, reply: string): Promise<JudgeVerdict> {
	const authStorage = AuthStorage.create("/tmp/judge-auth.json");
	authStorage.setRuntimeApiKey("github-copilot", process.env.GITHUB_TOKEN!);
	const modelRegistry = ModelRegistry.inMemory(authStorage);
	// Use GPT-4.1 for judge (claude-sonnet-4 doesn't support thinking parameters)
	const model = getModel("github-copilot", "gpt-4.1");

	if (!model) throw new Error("Failed to resolve judge model");

	const { session } = await createAgentSession({
		model,
		authStorage,
		modelRegistry,
		sessionManager: SessionManager.inMemory(),
		settingsManager: SettingsManager.inMemory(),
	});

	const judgePrompt = `You are a smoke-test judge. Respond with ONLY one JSON object and nothing else.
Schema: {"verdict":"pass"|"fail","reasoning":string}

Prompt: ${prompt}
Reply: ${reply}
Rubric: ${JUDGE_RUBRIC}`;

	const { promise, resolve, reject } = Promise.withResolvers<string>();
	let verdict = "";
	let retryError: string | null = null;

	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			verdict += event.assistantMessageEvent.delta;
		}

		// Handle retry errors
		if (event.type === "auto_retry_end" && !event.success && event.finalError) {
			retryError = event.finalError;
		}

		// Agent completed - resolve or reject based on state
		if (event.type === "agent_end") {
			if (retryError) {
				reject(new Error(`Judge failed after retries: ${retryError}`));
			} else if (!verdict.trim()) {
				// Empty response from LLM
				reject(new Error("Judge returned empty response"));
			} else {
				resolve(verdict);
			}
		}
	});

	await session.prompt(judgePrompt);
	const raw = (await promise).trim();

	logger.info(`Judge raw response: ${raw.substring(0, 200)}...`);

	// Parse JSON from response
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) throw new Error(`Judge returned non-JSON: ${raw}`);

	try {
		const parsed = JSON.parse(match[0]);
		if (!parsed?.verdict || !parsed?.reasoning) throw new Error(`Invalid judge response: ${raw}`);
		return { verdict: parsed.verdict, reasoning: parsed.reasoning };
	} catch (err: any) {
		throw new Error(`Judge returned invalid JSON: ${raw}`);
	}
}

async function cleanup(
	client: ChatClient,
	contactId: number | null,
	process: Bun.PipedSubprocess,
	tempDir: string,
): Promise<void> {
	logger.info("Cleaning up...");

	if (client) {
		try {
			await client.disconnect();
		} catch { /* ignore */ }
	}

	if (process.exitCode === null) {
		process.kill("SIGTERM");
		await Promise.race([
			process.exited,
			Bun.sleep(5000).then(() => { process.kill("SIGKILL"); }),
		]);
	}

	try {
		await fs.rm(tempDir, { recursive: true, force: true });
	} catch { /* ignore */ }
}

async function main(): Promise<void> {
	if (!process.env.GITHUB_TOKEN) {
		logger.error("GITHUB_TOKEN environment variable required");
		process.exit(1);
	}

	try {
		await runSmokeTest();
		process.exit(0);
	} catch (err) {
		logger.error("SMOKE TEST FAILED:", err);
		process.exit(1);
	}
}

main();