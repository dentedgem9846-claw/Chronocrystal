import { ChatClient } from "simplex-chat";
import { AgentSessionManager } from "./agent";
import { logger } from "./logger";
import { extractMessages, sendReply } from "./simplex";

const SIMPLEX_WS_URL = "ws://localhost:5225";
const DATA_DIR = process.env.DATA_DIR ?? "/data";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
	logger.fatal("GITHUB_TOKEN environment variable is required");
	process.exit(1);
}

const agentManager = new AgentSessionManager({
	githubToken: GITHUB_TOKEN,
	dataDir: DATA_DIR,
});

async function main(): Promise<void> {
	const healthPort = Number(process.env.HEALTH_PORT ?? 8080);

	// Health check server
	Bun.serve({
		port: healthPort,
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname === "/automation/status") {
				return new Response(
					JSON.stringify({
						ok: true,
						simplexAddress: address ?? null,
						environment: process.env.RAILWAY_ENVIRONMENT ?? "development",
						service: "chronocrystal-bot",
						publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN ?? null,
					}),
					{ headers: { "Content-Type": "application/json" } },
				);
			}
			if (url.pathname === "/health") {
				return new Response("OK", { status: 200 });
			}
			return new Response("Not Found", { status: 404 });
		},
	});

	logger.info({ port: healthPort }, "Health check server listening");

	logger.info({ url: SIMPLEX_WS_URL }, "Connecting to SimpleX Chat CLI");
	const client = await ChatClient.create(SIMPLEX_WS_URL);

	const user = await client.apiGetActiveUser();
	if (!user) {
		logger.fatal("No user profile found. Initialize simplex-chat CLI first with: simplex-chat -d <db_path>");
		process.exit(1);
	}
	const userId = user.userId;
	logger.info({ userId, displayName: user.profile.displayName }, "Bot profile loaded");

	let address = await client.apiGetUserAddress(userId);
	if (address) {
		logger.info({ address }, "Bot address loaded");
	} else {
		const newAddress = await client.apiCreateUserAddress(userId);
		logger.info({ address: newAddress }, "Bot address created");
		address = newAddress;
	}

	await client.enableAddressAutoAccept(userId);
	logger.info("Auto-accept enabled for incoming contacts");

	logger.info("Listening for messages...");

	let _isConnected = true;

	// Process incoming events from SimpleX
	for await (const event of client.msgQ) {
		const resolved = event instanceof Promise ? await event : event;

		if (resolved.type === "contactConnected") {
			const contact = (resolved as any).contact;
			logger.info({ contact: contact.profile.displayName }, "Contact connected");
			await sendReply(
				client,
				contact.contactId,
				"Hello! I'm Kawa, your AI coding assistant. Send me a message and I'll help you out.",
			);
			continue;
		}

		// Handle incoming messages (batch processing)
		const messages = extractMessages(resolved as any);
		for (const msg of messages) {
			logger.info({ contactId: msg.contactId, text: msg.text }, "Message received");

			try {
				const response = await agentManager.prompt(msg.contactId, msg.text);
				if (response) {
					await sendReply(client, msg.contactId, response);
					logger.info({ contactId: msg.contactId }, "Replied to contact");
				}
			} catch (err) {
				const error = err as Error;
				logger.error({ contactId: msg.contactId, error: error.message }, "Error processing message");
				await sendReply(client, msg.contactId, "Sorry, I encountered an error processing your message.");
			}
		}
	}

	_isConnected = false;
	logger.info("SimpleX client disconnected");
}

main().catch((err) => {
	const error = err as Error;
	logger.fatal({ error: error.message }, "Fatal error");
	process.exit(1);
});
