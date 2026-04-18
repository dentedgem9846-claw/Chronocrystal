import { ChatClient } from "simplex-chat";
import { AgentSessionManager } from "./agent";
import { extractMessage, sendReply } from "./simplex";

const SIMPLEX_WS_URL = process.env.SIMPLEX_WS_URL ?? "ws://localhost:5225";
const DATA_DIR = process.env.DATA_DIR ?? "/data";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

if (!process.env.GITHUB_TOKEN) {
	console.error("GITHUB_TOKEN environment variable is required");
	process.exit(1);
}

async function main(): Promise<void> {
	console.log("Connecting to SimpleX Chat CLI at", SIMPLEX_WS_URL);
	const client = await ChatClient.create(SIMPLEX_WS_URL);

	// Get or create bot profile
	const user = await client.apiGetActiveUser();
	if (!user) {
		console.error("No user profile found. Initialize simplex-chat CLI first with: simplex-chat -d <db_path>");
		process.exit(1);
	}
	const userId = user.userId;
	console.log(`Bot profile: ${user.profile.displayName} (userId: ${userId})`);

	// Get or create address for accepting contacts
	const address = await client.apiGetUserAddress(userId);
	if (address) {
		console.log(`Bot address: ${address}`);
	} else {
		const newAddress = await client.apiCreateUserAddress(userId);
		console.log(`Created bot address: ${newAddress}`);
	}

	// Enable auto-accept for incoming contact requests
	await client.enableAddressAutoAccept(userId);
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
			const contact = (resolved as any).contact;
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
