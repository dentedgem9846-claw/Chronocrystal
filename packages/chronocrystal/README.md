# Kawa remembers so you don't have to

A SimpleX chat bot that captures your thoughts, experiences, and learnings into a searchable TiddlyWiki — just message Kawa naturally.

![Conversation screenshot placeholder](docs/screenshot.png)

---

## The Story

Imagine a day with Kawa:

**Morning.** You read an interesting article about Bloom filters on the train. You pull out your phone and message Kawa:
> "Learned about Bloom filters today — space-efficient probabilistic data structures for membership testing"

Kawa extracts the key insight and stores it in your personal wiki, tagged with `#algorithms` and `#learning`.

**Afternoon.** You run into Jason at a coffee shop. Later, you tell Kawa:
> "Had great coffee with Jason, he's moving to Berlin next month"

This goes into your wiki too, linked to Jason's entry, dated today.

**Evening.** You're planning a trip and wonder:
> "When did I last meet Jason?"

Kawa searches your wiki and replies:
> "You met Jason on January 15th for coffee at Roast & Co. He mentioned moving to Berlin next month."

**Later.** You open `https://kawa-yourname.up.railway.app` in your browser and browse your personal knowledge base — today's entries, past learnings, people you've met, ideas you've had. Everything connected, everything searchable.

---

## How It Works

```
SimpleX Chat → Kawa (front-desk agent) → Pi Coding Agent → TiddlyWiki
                    ↓                           ↓
            Auto-extracts insights      Updates wiki entries
                    ↓                           ↓
            Natural language queries ← Answers from wiki
```

Kawa runs 24/7 on Railway, waiting for your messages. When you send a message:

1. **Extraction** — Kawa identifies what kind of information you're sharing (a learning, a meeting, a thought, a todo)
2. **Storage** — The Pi coding agent updates your TiddlyWiki with structured entries
3. **Confirmation** — Kawa confirms what was stored and how it was categorized
4. **Retrieval** — When you ask questions, Kawa searches the wiki and answers naturally

---

## What You Can Do

### Store naturally

```
You: Learned about Bloom filters today, they're space-efficient
Kawa: Noted! Adding to your wiki under "Learning Log" with tag #algorithms
```

```
You: Met Sarah from engineering, she's working on the new caching layer
Kawa: Got it. Created entry for Sarah and linked to #engineering #caching
```

```
You: [Photo of whiteboard sketch]
Kawa: Captured your whiteboard sketch. Stored with today's notes.
```

### Recall with questions

```
You: When did I last meet Jason?
Kawa: You met Jason on January 15th for coffee. He mentioned moving to Berlin.
```

```
You: What have I learned about distributed systems?
Kawa: Here are your learnings tagged #distributed-systems:
• Bloom filters (today)
• CAP theorem tradeoffs (Jan 10)
• Consensus protocols: Raft vs Paxos (Dec 28)
```

### Browse visually

- Open your public Railway URL (e.g., `https://kawa-yourname.up.railway.app`)
- Browse entries by date, by tag, or search full-text
- View images, audio notes, and attachments inline
- See connections between people, topics, and ideas

---

## Technical Notes

- **SimpleX Bot Server** — Receives messages via the SimpleX network
- **ChronoCrystal** — TypeScript/Bun orchestrator running on Railway
- **Kawa Agent** — Per-user front-desk agent with custom system prompt
- **Pi Coding Agent** — Handles wiki updates via SDK sessions
- **TiddlyWiki** — Self-contained personal wiki with full-text search

### Session Model

- Each SimpleX user gets an isolated Kawa session
- Background tasks spawn isolated Pi coding-agent sessions
- Everything is observable and logged

### Data Flow

Messages flow from SimpleX → Kawa → (optionally) background agent → TiddlyWiki. Kawa can handle simple queries directly or spawn background agents for complex tasks.

---

## Deployment

### Railway (Recommended)

Deploys in one click. Runs 24/7 with a public URL for your wiki.

```bash
# Coming soon: Railway template
```

### Local Development

```bash
# Clone and start SimpleX bot server + ChronoCrystal + TiddlyWiki
docker compose up
```

---

## References

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — Auto-extraction patterns for information extraction
- [TiddlyWiki5](https://github.com/TiddlyWiki/TiddlyWiki5) — The non-linear personal web notebook

Simplex chat bot sdk
https://github.com/simplex-chat/simplex-chat/blob/stable/bots/README.md
https://github.com/simplex-chat/simplex-chat/blob/stable/packages/simplex-chat-client

LLM-Wiki management
https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
https://gist.github.com/rohitg00/2067ab416f7bbe447c1977ed

Code Base style to follow
./references
---

*Kawa is Japanese for "river" — a continuous flow of memory that carries your thoughts forward.*
