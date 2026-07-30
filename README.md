# 🐾 AdiClaw

> **An autonomous, sandboxed AI CLI coding assistant & planning engine built with Bun, TypeScript, Vercel AI SDK, OpenRouter, and Firecrawl.**

---

## 🌟 Overview

**AdiClaw** is a modern terminal-native AI coding assistant designed for safety, control, and intelligence. Unlike traditional AI tools that modify your codebase blindly, AdiClaw operates on a **Staging + Approval Architecture**:

1. **In-Memory Overlay Staging:** All file creations, modifications, deletions, and shell commands are staged in memory first.
2. **Interactive Diff Review:** Unified git diffs are rendered directly in your terminal for each proposed change.
3. **Human-in-the-Loop Control:** Approve all changes at once, review step-by-step, or cancel with zero risk to your filesystem.

---

## ✨ Key Features

- **🤖 Sandboxed Agent Mode:** Autonomous tool loop (up to 40 steps) to read, search, plan, and stage codebase modifications safely.
- **🧭 Structured Plan Mode:** Researches your codebase and web resources to generate structured 1-15 step execution plans with complexity estimation (`low`, `medium`, `high`). Select and execute specific steps interactively.
- **❓ Ask Mode:** Read-only Q&A mode to query your codebase or external web URLs. Export answers directly into markdown files (`.md`).
- **🌐 Web Scraping & Search:** Powered by **Firecrawl API** (`web_search`, `web_crawl`, `fetch_url`) to scrape live documentation and search the web.
- **🎨 Terminal UI (TUI):** Built with `@clack/prompts`, `chalk`, `figlet`, and `marked-terminal` for interactive menus and syntax-highlighted Markdown/Diff outputs.
- **⚡ Powered by Bun:** Ultra-fast startup and native TypeScript runtime.

---

## 🔄 Core Architecture & Workflow

```
                        User Goal / Request
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   CLI Sub-Mode Selection│
                     │  (Agent | Plan | Ask) │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
 ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
 │  Agent Mode   │       │   Plan Mode   │       │   Ask Mode    │
 │ (40-step loop)│       │ (Research/Plan│       │ (Read-only Q&A│
 └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │ ToolExecutor (Staging)  │
                    │ - In-Memory Overlay     │
                    │ - Append-Only Tracker   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Interactive Review    │
                    │  (@clack/prompts + Diff)│
                    └────────────┬────────────┘
                                 │
                        [ Approved / Rejected ]
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Apply Changes to Disk   │
                    └─────────────────────────┘
```

---

## 🛠️ CLI Modes

### 🤖 1. Agent Mode
Execute complex development tasks across your workspace. The agent reads, searches, and modifies files, staging all changes in an append-only tracker.
- **Tools Available:** `read_file`, `create_file`, `modify_file`, `delete_file`, `create_folder`, `list_files`, `search_files`, `analyze_codebase`, `execute_shell`, `list_skills`, `read_skill`, `web_search`, `web_crawl`, `fetch_url`.
- **Safety:** All mutations are held in memory until you explicitly approve the generated diffs.

### 🧭 2. Plan Mode
Deconstruct complex goals into actionable implementation steps before writing any code:
1. **Research Phase:** Analyzes codebase and web resources.
2. **Plan Generation:** Produces a structured JSON plan with step titles, detailed descriptions, hints, and complexity tags (`low`, `medium`, `high`).
3. **Step Selection:** Interactively select which steps to execute.
4. **Staged Execution & Approval:** Executes selected steps sequentially and presents unified diffs for review.

### ❓ 3. Ask Mode
Ask questions about your codebase or external documentation URLs (e.g. `https://chaicode.com/`):
- Operates in read-only mode (no filesystem modifications except optional markdown export).
- Renders answers in rich terminal Markdown.
- Prompts to optionally export Q&A logs to a local `.md` file.

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)
- OpenRouter API Key (for LLM model inference)
- Firecrawl API Key *(Optional, for web searching & crawling)*

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Yuvadi29/adiclaw.git
   cd adiclaw
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_DEFAULT_MODEL="openrouter/free" # Or your preferred model
   FIRECRAWL_API_KEY=your_firecrawl_api_key   # Optional for web scraping
   ```

---

## 💻 Usage

Start the interactive CLI:

```bash
bun run index.ts wakeup
```

Or execute directly via Bun:

```bash
bun index.ts wakeup
```

### CLI Sub-Commands

```bash
adiclaw wakeup     # Launches the banner menu to select CLI or Telegram modes
adiclaw new        # Create a new adiclaw project
```

---

## 📂 Project Structure

```
adiclaw/
├── index.ts                     # CLI Entry point (Commander.js)
├── ai/
│   └── ai.config.ts             # OpenRouter provider setup via Vercel AI SDK
├── modes/
│   ├── cli.ts                   # Sub-mode selection menu
│   ├── agent/
│   │   ├── action-tracker.ts    # Append-only action logging
│   │   ├── agent-tools.ts       # Tool definitions (Vercel AI SDK)
│   │   ├── approval.ts          # Interactive CLI diff review flow
│   │   ├── diff-view.ts         # Unified git patch generator
│   │   ├── orchestrator.ts      # Agent mode execution loop
│   │   ├── tool-executor.ts     # In-memory filesystem overlay & staging
│   │   └── types.ts             # Type definitions & config presets
│   ├── ask/
│   │   └── orchestrator.ts      # Read-only Q&A mode orchestrator
│   └── plan/
│       ├── orchestrator.ts      # Plan mode orchestrator
│       ├── planner.ts           # Plan drafting & JSON schema validation
│       ├── selection.ts         # Multi-select step prompt UI
│       ├── types.ts             # Plan & step interfaces
│       └── web-tools.ts         # Firecrawl web search & crawl integration
└── tui/
    ├── terminal-md.ts           # Terminal Markdown renderer (marked + marked-terminal)
    └── wakeup.ts                # ASCII Figlet banner & main menu
```

---

## 🧰 Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **AI Integration:** [Vercel AI SDK](https://sdk.vercel.ai/docs), [`@openrouter/ai-sdk-provider`](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)
- **Web Crawling:** [`@mendable/firecrawl-js`](https://www.npmjs.com/package/@mendable/firecrawl-js)
- **CLI Framework:** [Commander.js](https://github.com/tj/commander.js)
- **Terminal UI & Styling:** [`@clack/prompts`](https://github.com/natemoo-re/clack), [`chalk`](https://github.com/chalk/chalk), [`figlet`](https://github.com/patorjk/figlet.js), [`marked-terminal`](https://github.com/mscdex/marked-terminal)
- **Diff Generation:** [`diff`](https://github.com/kpdecker/jsdiff)

---

## 📄 License

MIT © [AdiClaw](https://github.com/Yuvadi29/adiclaw)
