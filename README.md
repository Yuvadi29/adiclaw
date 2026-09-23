# 🐾 AdiClaw

> **An autonomous, sandboxed AI CLI coding assistant & high-performance inference engine built with Bun, TypeScript, Vercel AI SDK, Ollama, OpenRouter, and Firecrawl.**

## 🎥 Demo

[**Watch the Demo Video**](https://drive.google.com/file/d/1P1w1UCxnW7Mps57vz0ouIwCYRRKfoUTt/view?usp=sharing)

---

## 🌟 Overview

**AdiClaw** is a modern terminal-native AI coding assistant designed for safety, control, and blazing-fast inference. Unlike traditional AI tools that modify your codebase blindly, AdiClaw operates on a **Staging + Approval Architecture**:

1. **In-Memory Overlay Staging:** All file creations, modifications, deletions, and shell commands are staged in memory first.
2. **Interactive Diff Review:** Unified git diffs are rendered directly in your terminal for each proposed change.
3. **Human-in-the-Loop Control:** Approve all changes at once, review step-by-step, or cancel with zero risk to your filesystem.
4. **Dedicated Inference Engine:** Sits between the CLI modes and model runtimes, applying TTFT pre-warming, invariant prompt prefix caching, turn delta compression, and Apple Silicon Metal acceleration.

---

## ✨ Key Features

- **🚀 Dedicated Inference Engine:** Minimizes latency (TTFT) and maximizes throughput (TPS) with local Ollama runtimes and cloud providers via Vercel AI SDK middleware.
- **⚡ Apple Silicon Metal Acceleration:** Automatically tunes thread pinning to performance cores, Metal GPU offloading, and right-sized KV caching.
- **🤖 Sandboxed Agent Mode:** Autonomous tool loop (up to 40 steps) to read, search, plan, and stage codebase modifications safely.
- **🧭 Structured Plan Mode:** Researches your codebase and web resources to generate structured 1-15 step execution plans with complexity estimation (`low`, `medium`, `high`). Select and execute specific steps interactively.
- **❓ Ask Mode:** Read-only Q&A mode with native local filesystem inspection (`read_file`, `list_files`, `analyze_codebase`) and external web research. Export answers directly into markdown files (`.md`).
- **🔌 Model Context Protocol (MCP):** Native MCP support including Coding Adda YouTube analytics/dashboard and GitHub repository interaction.
- **🌐 Web Scraping & Search:** Powered by **Firecrawl API** (`web_search`, `web_crawl`, `fetch_url`) to scrape live documentation and search the web.
- **🎨 Terminal UI (TUI):** Built with `@clack/prompts`, `chalk`, `figlet`, and `marked-terminal` for interactive menus, file autocomplete (`@`), command dropdowns (`/`), and syntax-highlighted Markdown/Diff outputs.
- **⚡ Powered by Bun:** Ultra-fast startup and native TypeScript runtime.

---

## 🆕 Recent Updates

- **AdiClaw Inference Engine:** Built-in inference optimization layer featuring prefix caching, turn delta compression, and real-time TTFT/TPS telemetry.
- **Apple Silicon Hardware Tuning:** Transparent GPU offloading and performance core thread optimization on macOS.
- **Inference Diagnostics (`/inference`):** Real-time telemetry inspects TTFT, throughput, prefix cache hit rate, and provides on-demand model weight pre-warming (`/inference warmup`).
- **End-to-End Tool Execution in Ask Mode:** Native local tool execution to immediately analyze codebase structure without unnecessary prompts for external repositories.
- **GitHub & YouTube MCP Integrations:** Seamless connection and interaction with GitHub repositories and Coding Adda YouTube channel metrics.
- **Task Tracker & Obsidian Knowledge Base:** Built-in task tracking and knowledge base support using Obsidian notes.
- **Interactive Slash Commands:** Fast terminal command routing (`/help`, `/model`, `/inference`, `/agent`, `/ask`, `/plan`, `/youtube`, `/status`, `/clear`, `/exit`).
- **Continuous Workspace Indexing:** High-speed scanning and caching of codebase files for instant search and tool retrieval.

---

## 🔄 Core Architecture & Workflow

```
                        User Goal / Request
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   CLI Sub-Mode Router │
                     │  (Agent | Plan | Ask) │
                     └───────────┬───────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ AdiClaw Inference     │
                     │ Engine & Optimizer    │
                     │ - TTFT Pre-Warming    │
                     │ - Prefix Caching      │
                     │ - Turn Delta Compress │
                     │ - Metal GPU Offload   │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
 ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
 │ Local Ollama  │       │  llama.cpp    │       │  OpenRouter   │
 │ (Metal / GPU) │       │ (Local GGUF)  │       │ (Cloud API)   │
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

## 🛠️ CLI Modes & Commands

### Slash Commands

| Command | Description |
|---|---|
| `/agent [goal]` | Launch autonomous agent mode with in-memory staging & diff reviews |
| `/plan [goal]` | Deconstruct goals into structured multi-step plans with selective execution |
| `/ask [query]` | Read-only codebase and external research with local tool execution |
| `/inference` | View inference telemetry (TTFT, TPS, cache hit rate) or pre-warm models |
| `/model` | Switch model or runtime provider interactively (Ollama / OpenRouter) |
| `/youtube` | Launch Coding Adda YouTube dashboard and analytics |
| `/status` | View session metrics, active provider, token costs, and cache savings |
| `/help` | Display command reference and keybindings |
| `/clear` | Clear the terminal screen |
| `/exit` | Gracefully shut down AdiClaw |

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
Ask questions about your codebase or external documentation URLs:
- Operates in read-only mode (no filesystem modifications except optional markdown export).
- Automatically inspects the local codebase (`analyze_codebase`, `list_files`, `read_file`) to answer project questions.
- Renders answers in rich terminal Markdown.
- Prompts to optionally export Q&A logs to a local `.md` file.

---

## ⚡ Inference Engine & Hardware Acceleration

AdiClaw includes a dedicated inference optimization engine to maximize generation speed and minimize latency:

- **Apple Silicon Hardware Tuning:** Automatically inspects CPU core topology (Performance vs Efficiency cores), offloads to Metal GPU (`num_gpu: 99`), and optimizes prompt batching.
- **Context Window Management:** Right-sized KV context (`16,384` tokens) comfortably accommodates all local tools, MCP tools (GitHub & YouTube), and workspace files without context degradation.
- **Prompt Prefix Caching:** Memoizes invariant system prompts and tool schemas to accelerate repeated turns.
- **Turn Delta Compression:** Compresses older conversation turns during long-running agent loops while keeping the most recent turns uncompressed.
- **Telemetry & Monitoring:** Intercepts stream chunks to track Time-To-First-Token (TTFT) and throughput (TPS) live.

```bash
# Check inference telemetry & cache metrics
adiclaw > /inference

# Pre-warm model weights into Unified Memory
adiclaw > /inference warmup
```

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)
- [Ollama](https://ollama.com) (Recommended for local inference, e.g. `gemma4:latest`, `qwen2.5-coder`)
- OpenRouter API Key *(Optional, for cloud model inference)*
- Firecrawl API Key *(Optional, for web searching & crawling)*
- GitHub Personal Access Token *(Optional, for GitHub MCP tools)*

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
   # Local Model Configuration (Ollama)
   ADICLAW_PROVIDER=ollama
   ADICLAW_MODEL=gemma4:latest

   # Cloud Model Configuration (OpenRouter)
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_DEFAULT_MODEL="openrouter/free"

   # Optional Integrations
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token
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
adiclaw wakeup     # Launches the banner menu and REPL
adiclaw new        # Create a new adiclaw project
```

---

## 📂 Project Structure

```
adiclaw/
├── index.ts                     # CLI Entry point (Commander.js)
├── ai/
│   ├── ai.config.ts             # Inference Engine model integration
│   ├── provider.ts              # Provider interface
│   └── session/                 # Session management & token tracker
├── inference/                   # 🚀 AdiClaw Inference Engine
│   ├── engine.ts                # Core engine orchestration
│   ├── adapter.ts               # Vercel AI SDK middleware wrapper
│   ├── hardware.ts              # Apple Silicon Metal hardware detection & tuning
│   ├── manager.ts               # Model pre-warming & keep-alive manager
│   ├── types.ts                 # Inference request/response & metrics types
│   ├── cache/                   # Prompt prefix cache & context optimizer
│   ├── router/                  # Mode-aware runtime routing
│   ├── runtimes/                # Ollama, llama.cpp, OpenRouter runtimes
│   └── telemetry/               # TTFT, TPS, and status metrics collector
├── commands/                    # Slash command definitions & router
│   ├── agent.ts                 # /agent command
│   ├── ask.ts                   # /ask command
│   ├── plan.ts                  # /plan command
│   ├── inference.ts             # /inference telemetry & warmup
│   ├── model.ts                 # /model switcher
│   ├── status.ts                # /status dashboard
│   └── youtube.ts               # /youtube analytics
├── mcp/                         # Model Context Protocol registry & providers
│   ├── providers/github.ts      # GitHub MCP provider
│   └── providers/youtube.ts     # YouTube MCP provider
├── modes/
│   ├── agent/                   # Autonomous coding agent loop & tools
│   ├── ask/                     # Read-only Q&A orchestrator
│   └── plan/                    # Multi-step goal planner
├── workspace/                   # Local file scanner, summary & cache
└── tui/
    ├── repl.ts                  # Interactive readline REPL with / and @ triggers
    ├── terminal-md.ts           # Terminal Markdown renderer
    └── wakeup.ts                # ASCII Figlet banner & boot sequence
```

---

## 🧰 Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Inference Optimization:** Custom AdiClaw Engine (TTFT Pre-Warming, Prefix Caching, Metal Acceleration)
- **AI Integration:** [Vercel AI SDK](https://sdk.vercel.ai/docs), [Ollama](https://ollama.ai), [`@openrouter/ai-sdk-provider`](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)
- **Protocol:** [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- **Web Crawling:** [`@mendable/firecrawl-js`](https://www.npmjs.com/package/@mendable/firecrawl-js)
- **CLI Framework:** [Commander.js](https://github.com/tj/commander.js)
- **Terminal UI & Styling:** [`@clack/prompts`](https://github.com/natemoo-re/clack), [`chalk`](https://github.com/chalk/chalk), [`figlet`](https://github.com/patorjk/figlet.js), [`marked-terminal`](https://github.com/mscdex/marked-terminal)
- **Diff Generation:** [`diff`](https://github.com/kpdecker/jsdiff)
