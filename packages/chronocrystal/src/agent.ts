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