import { T } from "@simplex-chat/types";
import { ChatClient } from "simplex-chat";
import { type ChatServer, localServer } from "simplex-chat/dist/transport";

export interface IncomingMessage {
	contactId: number;
	text: string;
}

/** Extract all text messages from a newChatItems event batch.
 * SimpleX 0.3.0 emits chatInfo on each AChatItem, not at the event root.
 * AChatItem = { chatInfo: { type: "direct", contact: { contactId } }, chatItem: ChatItem }
 * ChatItem.content = sndMsgContent | rcvMsgContent (with msgContent.text)
 *
 * Returns all text messages from the batch, preserving contactId per message.
 * Messages with missing contactId or non-text content are skipped silently.
 */
export function extractMessages(event: Record<string, any>): IncomingMessage[] {
	const messages: IncomingMessage[] = [];

	if (event.type !== "newChatItems") return messages;

	for (const item of event.chatItems ?? []) {
		// Each AChatItem has chatInfo at the item level
		const chatInfo = item?.chatInfo;
		if (!chatInfo || chatInfo.type !== "direct") continue;

		const contactId: number = chatInfo.contact?.contactId;
		if (contactId === undefined) continue;

		const chatItem = item?.chatItem;
		if (!chatItem) continue;

		// ChatItem.content is sndMsgContent or rcvMsgContent (not sndMsg/rcvMsg)
		const content = chatItem.content;
		if (!content) continue;

		const isIncoming = content.type === "rcvMsgContent";
		const isOutgoing = content.type === "sndMsgContent";
		if (!isIncoming && !isOutgoing) continue;

		const msgContent = content.msgContent;
		if (msgContent?.type === "text" && typeof msgContent.text === "string") {
			messages.push({ contactId, text: msgContent.text });
		}
	}

	return messages;
}

/** Extract the first text message from a newChatItems event.
 * For backward compatibility - prefer extractMessages for batch processing.
 */
export function extractMessage(event: Record<string, any>): IncomingMessage | null {
	const messages = extractMessages(event);
	return messages[0] ?? null;
}

/** Connect to simplex-chat CLI and return the ChatClient. */
export async function connectSimplex(server?: ChatServer | string): Promise<ChatClient> {
	const srv = server ?? localServer;
	const client = await ChatClient.create(srv);
	return client;
}

/** Send a text reply to a contact. */
export async function sendReply(client: ChatClient, contactId: number, text: string): Promise<void> {
	await client.apiSendTextMessage(T.ChatType.Direct, contactId, text);
}
