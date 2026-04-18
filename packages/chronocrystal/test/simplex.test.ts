import { describe, expect, test } from "bun:test";
import { extractMessage, extractMessages } from "../src/simplex";

describe("extractMessages", () => {
	test("extracts all text messages from a batch", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatInfo: { type: "direct", contact: { contactId: 1 } },
					chatItem: {
						content: { type: "rcvMsgContent", msgContent: { type: "text", text: "msg1" } },
					},
				},
				{
					chatInfo: { type: "direct", contact: { contactId: 2 } },
					chatItem: {
						content: { type: "rcvMsgContent", msgContent: { type: "text", text: "msg2" } },
					},
				},
				{
					chatInfo: { type: "direct", contact: { contactId: 1 } },
					chatItem: {
						content: { type: "rcvMsgContent", msgContent: { type: "text", text: "msg3" } },
					},
				},
			],
		};

		const result = extractMessages(event as any);
		expect(result).toEqual([
			{ contactId: 1, text: "msg1" },
			{ contactId: 2, text: "msg2" },
			{ contactId: 1, text: "msg3" },
		]);
	});

	test("returns empty array for non-newChatItems events", () => {
		const result = extractMessages({ type: "contactConnected" } as any);
		expect(result).toEqual([]);
	});

	test("skips non-direct chat items", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatInfo: { type: "group", groupInfo: { groupId: 7 } },
					chatItem: {
						content: { type: "rcvMsgContent", msgContent: { type: "text", text: "group msg" } },
					},
				},
			],
		};

		const result = extractMessages(event as any);
		expect(result).toEqual([]);
	});

	test("skips non-text messages", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatInfo: { type: "direct", contact: { contactId: 1 } },
					chatItem: {
						content: { type: "rcvMsgContent", msgContent: { type: "file", fileName: "photo.jpg" } },
					},
				},
			],
		};

		const result = extractMessages(event as any);
		expect(result).toEqual([]);
	});
});

describe("extractMessage", () => {
	test("extracts text from a direct chat item", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatInfo: {
						type: "direct",
						contact: { contactId: 42 },
					},
					chatItem: {
						content: {
							type: "rcvMsgContent",
							msgContent: {
								type: "text",
								text: "Hello bot!",
							},
						},
					},
				},
			],
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
					chatInfo: {
						type: "group",
						groupInfo: { groupId: 7 },
					},
					chatItem: {
						content: {
							type: "rcvMsgContent",
							msgContent: {
								type: "text",
								text: "group message",
							},
						},
					},
				},
			],
		};

		const result = extractMessage(event as any);
		expect(result).toBeNull();
	});

	test("returns null for non-text messages", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatInfo: {
						type: "direct",
						contact: { contactId: 42 },
					},
					chatItem: {
						content: {
							type: "rcvMsgContent",
							msgContent: {
								type: "file",
								fileName: "photo.jpg",
							},
						},
					},
				},
			],
		};

		const result = extractMessage(event as any);
		expect(result).toBeNull();
	});

	test("returns null for non-newChatItems events", () => {
		const result = extractMessage({ type: "contactConnected", contact: {} } as any);
		expect(result).toBeNull();
	});

	test("extracts text from sndMsgContent (sent messages)", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatInfo: {
						type: "direct",
						contact: { contactId: 99 },
					},
					chatItem: {
						content: {
							type: "sndMsgContent",
							msgContent: {
								type: "text",
								text: "I sent this",
							},
						},
					},
				},
			],
		};

		const result = extractMessage(event as any);
		expect(result).toEqual({
			contactId: 99,
			text: "I sent this",
		});
	});

	test("skips items with missing chatInfo or contact", () => {
		const event = {
			type: "newChatItems",
			chatItems: [
				{
					chatItem: {
						content: {
							type: "rcvMsgContent",
							msgContent: { type: "text", text: "no chatInfo" },
						},
					},
				},
				{
					chatInfo: { type: "direct" },
					chatItem: {
						content: {
							type: "rcvMsgContent",
							msgContent: { type: "text", text: "no contact" },
						},
					},
				},
				{
					chatInfo: { type: "direct", contact: {} },
					chatItem: {
						content: {
							type: "rcvMsgContent",
							msgContent: { type: "text", text: "contact missing contactId" },
						},
					},
				},
			],
		};

		const result = extractMessage(event as any);
		expect(result).toBeNull();
	});
});
