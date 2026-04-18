import * as path from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import {
	AuthStorage,
	type CreateAgentSessionResult,
	createAgentSession,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@mariozechner/pi-coding-agent";
import { logger } from "./logger";

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

		// Use GPT-4.1 via GitHub Copilot (claude-sonnet-4 doesn't support thinking parameters)
		const model = getModel("github-copilot", "gpt-4.1");
		if (!model) {
			throw new Error("Failed to resolve github-copilot gpt-4.1 model");
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
		logger.debug({ contactId }, "Created new agent session");
		return result;
	}

	/** Send a prompt to a contact's session and collect the full text response.
	 * Handles retries: on auto_retry_start, clears accumulated text and waits.
	 * On agent_end with stopReason=error, rejects with the error message.
	 * On agent_end with stopReason=success (or undefined), resolves with accumulated text.
	 */
	async prompt(contactId: number, text: string): Promise<string> {
		const { session } = await this.getOrCreateSession(contactId);

		const { promise, resolve, reject } = Promise.withResolvers<string>();
		let accumulated = "";
		let retryCount = 0;
		let finalError: string | null = null;
		let waitingForRetryEnd = false;

		const unsubscribe = session.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				accumulated += event.assistantMessageEvent.delta;
			}

			// Auto-retry started - clear accumulated text and wait for retry to complete
			if (event.type === "auto_retry_start") {
				retryCount++;
				accumulated = "";
				waitingForRetryEnd = true;
				logger.info(
					{ contactId, attempt: event.attempt, maxAttempts: event.maxAttempts, error: event.errorMessage },
					"Agent retry started",
				);
			}

			// Auto-retry completed - record result but don't resolve yet
			if (event.type === "auto_retry_end") {
				waitingForRetryEnd = false;
				if (!event.success && event.finalError) {
					finalError = event.finalError;
				}
			}

			// Agent finished - only resolve if we're not waiting for a retry
			if (event.type === "agent_end" && !waitingForRetryEnd) {
				// Check if this was an error response
				const stopReason = (event as any).stopReason;
				const errorMessage = (event as any).errorMessage;

				if (stopReason === "error" && errorMessage) {
					unsubscribe();
					logger.error({ contactId, stopReason, errorMessage }, "Agent error");
					reject(new Error(`Agent error: ${errorMessage}`));
					return;
				}

				if (finalError) {
					unsubscribe();
					logger.error({ contactId, retryCount, finalError }, "Agent failed after retries");
					reject(new Error(`Agent failed after ${retryCount} retries: ${finalError}`));
					return;
				}

				logger.info({ contactId, responseLength: accumulated.length }, "Agent response complete");
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
		logger.debug({ contactId }, "Deleted agent session");
	}
}
