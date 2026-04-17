// scripts/smoke-test.ts
// Smoke test that connects to the bot as a contact, sends a message,
// captures the response, and uses an AI judge to verify correctness.

import { ChatClient } from "simplex-chat";
import { T } from "@simplex-chat/types";
import { getModel } from "@mariozechner/pi-ai";
import {
	AuthStorage,
	createAgentSession,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";

interface TestCase {
	message: string;
	criteria: string;
}

const SIMPLEX_WS_URL = process.env.SIMPLEX_WS_URL ?? "ws://localhost:5224";
const TIMEOUT_MS = 60000;

async function createJudge(testCase: TestCase, response: string): Promise<string> {
	const authStorage = AuthStorage.create("/tmp/judge-auth.json");
	authStorage.setRuntimeApiKey("github-copilot", process.env.GITHUB_TOKEN!);
	const modelRegistry = ModelRegistry.inMemory(authStorage);
	const model = getModel("github-copilot", "claude-sonnet-4");

	const { session } = await createAgentSession({
		model: model!,
		authStorage,
		modelRegistry,
		sessionManager: SessionManager.inMemory(),
		settingsManager: SettingsManager.inMemory(),
	});

	const judgePrompt = `You are an AI judge evaluating bot responses. Given a user message and the bot's response, determine if the response adequately addresses the user's request.

User message: "${testCase.message}"
Bot response: "${response}"

Criteria: ${testCase.criteria}

Respond with only one word: PASS or FAIL
Then explain your reasoning in 1-2 sentences.`;

	const { promise, resolve } = Promise.withResolvers<string>();
	let verdict = "";

	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			verdict += event.assistantMessageEvent.delta;
		}
		if (event.type === "agent_end") {
			resolve(verdict);
		}
	});

	await session.prompt(judgePrompt);
	return promise;
}

async function smokeTest(): Promise<void> {
	if (!process.env.GITHUB_TOKEN) {
		console.error("GITHUB_TOKEN environment variable required");
		process.exit(1);
	}

	const testCases: TestCase[] = [
		{
			message: "What is 5 factorial?",
			criteria: "The response must state that 5! equals 120",
		},
	];

	console.log("Connecting to bot at", SIMPLEX_WS_URL);
	const client = await ChatClient.create(SIMPLEX_WS_URL);

	// Get active user (should be created by the bot's simplex-chat CLI)
	const user = await client.apiGetActiveUser();
	if (!user) {
		console.error("No active user found. Make sure simplex-chat CLI is running.");
		process.exit(1);
	}

	const userId = user.userId;
	console.log(`Connected as: ${user.profile.displayName} (userId: ${userId})`);

	// Get or create address
	const address = await client.apiGetUserAddress(userId);
	console.log(`Bot address: ${address ?? "none"}`);

	// Enable auto-accept
	await client.enableAddressAutoAccept(userId);

	let response = "";

	for await (const event of client.msgQ) {
		const resolved = event instanceof Promise ? await event : event;

		if (resolved.type === "contactConnected") {
			const contact = (resolved as any).contact;
			console.log(`Contact connected: ${contact.profile.displayName}`);
			await client.apiSendTextMessage(
				T.ChatType.Direct,
				contact.contactId,
				testCases[0].message,
			);
			console.log(`Sent: ${testCases[0].message}`);
		}

		if (resolved.type === "newChatItems") {
			const chatItems = (resolved as any).chatItems;
			for (const item of chatItems ?? []) {
				const content = item?.chatItem?.content;
				if (content?.type === "rcvMsg" && content.msgContent?.type === "text") {
					response += content.msgContent.text;
				}
			}
		}
	}

	console.log(`Received: ${response}`);

	if (!response) {
		console.error("No response received within timeout");
		process.exit(1);
	}

	// Run AI judge
	const judgeResult = await createJudge(testCases[0], response);
	console.log(`Judge: ${judgeResult}`);

	if (judgeResult.startsWith("PASS")) {
		console.log("SMOKE TEST PASSED");
		process.exit(0);
	} else {
		console.error("SMOKE TEST FAILED");
		process.exit(1);
	}
}

smokeTest().catch((err) => {
	console.error("Error:", err);
	process.exit(1);
});