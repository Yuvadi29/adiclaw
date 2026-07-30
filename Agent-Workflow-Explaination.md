# Ask Mode

## Question

What is inside the /modes/agent. explain me what is going on with a proper code example.

## Answer

Now I have a complete picture. Let me explain what's happening in the `/modes/agent` directory.

---

## 🎯 What is `/modes/agent`?

This is a **sandboxed AI agent mode** for a coding assistant. It implements a **staging + approval workflow** where:

1. **Agent runs with tools** (read, write, search, shell, etc.)
2. **All mutations are staged** (not applied immediately)
3. **User reviews diffs** and approves/rejects changes
4. **Only approved changes get applied** to the filesystem

---

## 📁 File Structure & Responsibilities

| File | Purpose |
|------|---------|
| `types.ts` | Core types: `ActionType`, `ActionLog`, `AgentConfig` |
| `action-tracker.ts` | Append-only log of all agent actions |
| `tool-executor.ts` | **Staging engine** - executes tools but stages mutations in memory |
| `agent-tools.ts` | Defines 11 tools the agent can use (via Vercel AI SDK `tool()`) |
| `orchestrator.ts` | Main entry point: runs agent → shows diffs → approval flow → apply |
| `approval.ts` | Interactive CLI for reviewing diffs (accept/reject/diff) |
| `diff-view.ts` | Generates unified diffs for approval UI |

---

## 🔄 The Workflow (Code Flow)

```
User Goal
    │
    ▼
┌─────────────────────────────────────────┐
│  ToolLoopAgent (Vercel AI SDK)          │
│  - model + instructions + 11 tools      │
│  - runs up to 40 steps                  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  ToolExecutor (staging layer)           │
│  - overlay: Map<path, content>          │
│  - deleted: Set<path>                   │
│  - logs every action to ActionTracker   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Approval Flow (@clack/prompts)         │
│  - "Approve all" / "Review one by one"  │
│  - Shows unified diffs per file         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Apply Approved Changes                 │
│  - mkdir folders                        │
│  - write/modify/delete files            │
│  - spawnSync shell commands             │
└─────────────────────────────────────────┘
```

---

## 🛠️ Key Concepts with Code Examples

### 1. Staging (Not Direct FS Writes)

```typescript
// tool-executor.ts - createFile stages, doesn't write
createFile(rel: string, content: string): string {
    // ... validation ...
    const key = this.norm(rel);
    this.deleted.delete(key);
    this.overlay.set(key, content);  // ← STAGED in memory
    
    this.tracker.log({
        type: "file_create",
        path: key,
        details: { after: content },
        status: "pending",  // ← PENDING APPROVAL
    });
    return `Staged new file: ${key}`;
}
```

### 2. Tools Defined for the Agent

```typescript
// agent-tools.ts - 11 tools the LLM can call
export function createAgentTools(executor: ToolExecutor) {
    return {
        read_file: tool({
            description: "Read a text file from the workspace...",
            inputSchema: z.object({ path: z.string() }),
            execute: async ({ path: p }) => executor.readFile(p),
        }),
        
        create_file: tool({
            description: "Stage creation of a new file (not written until user approves).",
            inputSchema: z.object({ path: z.string(), content: z.string() }),
            execute: async ({ path: p, content }) => executor.createFile(p, content),
        }),
        
        modify_file: tool({ /* full-file replacement, staged */ }),
        delete_file: tool({ /* staged deletion */ }),
        create_folder: tool({ /* staged mkdir -p */ }),
        list_files: tool({ /* read-only */ }),
        search_files: tool({ /* glob + optional content filter */ }),
        analyze_codebase: tool({ /* file/dir counts */ }),
        execute_shell: tool({ /* queued, runs after approval */ }),
        list_skills: tool({ /* list SKILL.md files */ }),
        read_skill: tool({ /* read a SKILL.md */ }),
    };
}
```

### 3. Diff Generation for Approval

```typescript
// diff-view.ts - produces unified diffs
export function formatPatch(filePath: string, before: string, after: string): string {
    return createTwoFilesPatch(filePath, filePath, before, after, "", "", { context: 3 });
}

export function composeBeforeAfter(sorted: ActionLog[]): { before: string; after: string } {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    if (last?.type === "file_delete") 
        return { before: last.details.before ?? "", after: "" };
    
    const before = first?.type === "file_create" ? "" : (first?.details.before ?? "");
    const after = last?.details.after ?? "";
    return { before, after };
}
```

### 4. Approval Flow (Interactive CLI)

```typescript
// approval.ts - user reviews each change
export async function runApprovalFlow(tracker: ActionTracker): Promise<boolean> {
    const pending = tracker.getPendingMutations();
    
    // Group by file, show options
    const choice = await select({
        message: "Apply staged changes?",
        options: [
            { value: "all", label: "Approve and apply all" },
            { value: "select", label: "Review one by one" },
            { value: "cancel", label: "Cancel" },
        ],
    });
    
    if (choice === "select") {
        for (const g of groupPending(pending)) {
            while (true) {
                const opt = await select({
                    message: chalk.bold(g.label),  // e.g. "src/index.ts (file_modify)"
                    options: [
                        { value: "accept", label: "Accept" },
                        { value: "diff", label: "Show diff" },
                        { value: "reject", label: "Reject" }
                    ],
                });
                if (opt === "diff") {
                    console.log('\n' + renderTerminalMarkdown('```diff\n' + g.patch + '\n```\n') + '\n');
                    continue;  // re-prompt
                }
                // update tracker status
                break;
            }
        }
    }
    // ...
}
```

### 5. Applying Approved Changes

```typescript
// tool-executor.ts - applies only approved actions
applyApprovedFromTracker(): { errors: string[] } {
    const errors: string[] = [];
    const all = [...this.tracker.getActions()];

    // 1. Create folders first
    for (const a of all.filter(x => x.type === "folder_create" && x.status === "approved")) {
        fs.mkdirSync(this.resolveSafe(a.path), { recursive: true });
    }

    // 2. File ops (create/modify/delete) - sorted by timestamp
    const fileOps = all.filter(...).sort(...);
    for (const [p, a] of lastByPath) {
        if (a.type === "file_delete") 
            fs.rmSync(this.resolveSafe(p), { force: true });
        else {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, a.details.after ?? "", "utf8");
        }
    }

    // 3. Shell commands
    for (const a of all.filter(x => x.type === "tool_execute" && x.status === "approved")) {
        const r = spawnSync(a.details.command, { shell: true, cwd: this.config.codebasePath, ... });
        if (r.status !== 0) errors.push(`shell exit ${r.status}: ${cmd}`);
    }
    return { errors };
}
```

---

## 🔐 Safety Features

| Feature | Implementation |
|---------|----------------|
| **Path traversal protection** | `resolveSafe()` checks `path.relative(root, abs).startsWith('..')` |
| **Exclusion patterns** | `node_modules`, `.git`, `.env`, `dist`, `*.log` blocked by default |
| **File size limit** | `maxFileSizeToRead: 1MB` default |
| **Tool permissions** | Config flags: `allowFileCreation`, `allowShellExecution`, etc. |
| **Skill roots only** | `read_skill` restricted to `~/.cursor/skills-cursor`, `~/.claude/skills` |

---

## 📝 Complete Usage Example

```bash
# Run the agent mode
bun run modes/cli.ts agent

# Or programmatically:
import { runAgentMode } from "./modes/agent/orchestrator";
await runAgentMode();
```

**Interactive session:**

```
$ Running Agent Mode
? What would you want the agent to do? Create a hello world TypeScript file

 ✔️ create_file {"path":"hello.ts","content":"console.log('Hello, World!');"}
 ✔️ execute_shell {"command":"tsc hello.ts"}

Apply staged changes?
❯ Approve and apply all
  Review one by one
  Cancel

✔️ Applied.
```

---

## 🎓 Summary

This is a **production-ready agent framework** with:

- **Vercel AI SDK** `ToolLoopAgent` for multi-step reasoning
- **Staging overlay** pattern (like git staging area)
- **Human-in-the-loop** approval with unified diffs
- **Sandboxed filesystem** access with path validation
- **Extensible tool set** (11 built-in, easy to add more)

The architecture cleanly separates:
- **Agent reasoning** (LLM + tools)
- **Execution staging** (ToolExecutor)
- **Audit trail** (ActionTracker)
- **User consent** (approval.ts + diff-view.ts)
