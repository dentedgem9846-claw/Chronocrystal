import { describe, expect, test } from "bun:test";
import { extractMessage } from "../src/simplex";

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

	test("returns null for non-newChatItems events", () => {
		const result = extractMessage({ type: "contactConnected", contact: {} } as any);
		expect(result).toBeNull();
	});

	test("extracts text from sndMsg (sent messages)", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatItem: {
						content: {
							type: "sndMsg",
							msgContent: {
								type: "text",
								text: "I sent this",
							},
						},
					},
				},
			],
			chatInfo: {
				type: "direct",
				contactId: 99,
			},
		};

		const result = extractMessage(event as any);
		expect(result).toEqual({
			contactId: 99,
			text: "I sent this",
		});
	});
});
