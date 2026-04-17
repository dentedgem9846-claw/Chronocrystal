import { ChatClient, type ChatServer } from "simplex-chat";
import { T } from "@simplex-chat/types";

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
	await client.apiSendTextMessage(T.ChatType.Direct, contactId, text);
}