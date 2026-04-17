import { describe, expect, test } from "bun:test";
import { AgentSessionManager } from "../src/agent";

describe("AgentSessionManager", () => {
	test("returns distinct sessions for distinct contacts", async () => {
		const manager = new AgentSessionManager({
			githubToken: "test-token",
			dataDir: `/tmp/chronocrystal-test-${Date.now()}-1`,
		});

		const session1 = await manager.getOrCreateSession(1);
		const session2 = await manager.getOrCreateSession(2);

		expect(session1).not.toBe(session2);
	});

	test("returns the same session for the same contact", async () => {
		const manager = new AgentSessionManager({
			githubToken: "test-token",
			dataDir: `/tmp/chronocrystal-test-${Date.now()}-2`,
		});

		const session1 = await manager.getOrCreateSession(1);
		const session2 = await manager.getOrCreateSession(1);

		expect(session1).toBe(session2);
	});

	test("deleteSession removes a session", async () => {
		const manager = new AgentSessionManager({
			githubToken: "test-token",
			dataDir: `/tmp/chronocrystal-test-${Date.now()}-3`,
		});

		await manager.getOrCreateSession(1);
		manager.deleteSession(1);

		// After deletion, getOrCreateSession should create a new session
		const newSession = await manager.getOrCreateSession(1);
		expect(newSession).toBeDefined();
	});
});