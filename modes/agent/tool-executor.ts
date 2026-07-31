import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { AgentConfig, ActionLog } from "./types";
import { ActionTracker } from "./action-tracker";
import { activityEvents } from "./activity-events";
import { sessionTracker } from "../../ai/session/session-tracker";
import { workspace } from "../../workspace";
import { buildWorkspaceSummary } from "../../workspace/summary";

// Set of files which the tool executor should support
const TEXT_EXT = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.md',
    '.yaml',
    '.html',
    '.css',
    '.py',
    '.sh',
    '.lock',
    '.cjs',
    '.mdx',
    '.yml',
    '.toml',
    '.txt',
    '.mermaid'
]);

function isProbablyTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return TEXT_EXT.has(ext) || ext === '';
};

export class ToolExecutor {
    private overlay = new Map<string, string>();
    private deleted = new Set<string>();
    // Normalizing filePaths
    private readonly norm = (rel: string) => path.posix.normalize(rel.split(path.sep).join('/').replace(/^\.\//, ""));

    constructor(
        private readonly tracker: ActionTracker,
        private readonly config: AgentConfig,
    ) { }

    private runWithActivity<T>(
        message: string,
        fn: () => T,
        isSilent: boolean = false
    ): T {
        activityEvents.start(message);

        try {
            const result = fn();
            if (isSilent) {
                activityEvents.silentFinish(message);
            } else {
                activityEvents.finish(message);
            }
            return result;
        } catch (err) {
            activityEvents.fail(message);
            throw err;
        }
    }

    private resolveSafe(rel: string): string {
        const abs = path.resolve(this.config.codebasePath, rel);
        const root = path.resolve(this.config.codebasePath);
        const relCheck = path.relative(root, abs);
        if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
            throw new Error(`Path escapes workspace: ${rel}`);
        }
        return abs;
    }

    // Exclude some files when executing the tool. Acting like a security layer   
    private excluded(relPath: string): boolean {
        const norm = this.norm(relPath);
        const segments = norm.split('/');
        const base = segments[segments.length - 1] ?? '';

        for (const pat of this.config.excludePatterns) {
            if (pat === "*.log" && base.endsWith(".log")) return true;
            if (pat === ".env" && base.startsWith(".env")) return true;
            if (pat.includes("*")) continue;
            if (segments.includes(pat) || norm === pat || norm.startsWith(`${pat}/`))
                return true;
        }
        return false;
    };

    // Make sure the file is not excluded
    private assertNotExcluded(rel: string, op: string): void {
        if (this.excluded(rel)) {
            throw new Error(`${op}: path is excluded by policy: ${rel}`);
        }
    };

    // Get the effective text of a file.
    async getEffectiveText(rel: string): Promise<string | undefined> {
        const key = this.norm(rel);
        if (this.deleted.has(key)) return undefined;
        if (this.overlay.has(key)) return this.overlay.get(key);
        const abs = this.resolveSafe(rel);
        
        const file = workspace.get(abs);
        if (!file) return undefined;
        
        return await workspace.read(abs);
    };

    // Read File
    async readFile(rel: string) {
        return this.runWithActivity(
            `📖 Reading ${rel}`,
            async () => {
                this.assertNotExcluded(rel, "read_file");

                sessionTracker.incrementFilesRead();

                const abs = this.resolveSafe(rel);

                const file = workspace.get(abs);
                if (!file) {
                    throw new Error(`read_file: not found or not a file: ${rel}`);
                }

                if (file.size > 250_000) {
                    throw new Error(`File too large: ${rel}`);
                }

                // const text = fs.readFileSync(abs, "utf8");
                const text = await workspace.read(abs);

                this.tracker.log({
                    type: "code_analysis",
                    path: this.norm(rel),
                    details: {
                        after: text,
                        toolName: "read_file",
                    },
                    status: "executed",
                });

                sessionTracker.incrementFilesRead();
                return text;
            }
        );
    }

    // Create File
    createFile(rel: string, content: string): string {
        return this.runWithActivity(
            `📄 Creating ${rel}`,
            () => {
                if (!this.config.tools.allowFileCreation) {
                    throw new Error("File Creation Disabled");
                }

                this.assertNotExcluded(rel, "create_file");

                sessionTracker.incrementFilesCreated();


                const key = this.norm(rel);
                const abs = this.resolveSafe(rel);
                if (fs.existsSync(abs) && !this.deleted.has(key)) {
                    throw new Error(`create_file: already exists: ${rel}`);
                }
                this.deleted.delete(key);
                this.overlay.set(key, content);

                workspace.add({
                    path: abs,
                    name: path.basename(abs),
                    extension: path.extname(abs),
                    size: Buffer.byteLength(content),
                    modified: Date.now(),
                });
                workspace.update(abs, content);
                this.tracker.log({
                    type: "file_create",
                    path: key,
                    details: { after: content },
                    status: "pending",
                });
                return `Staged new file: ${key}`;
            },
        );
    }

    // Modify File
    async modifyFile(rel: string, content: string): Promise<string> {
        return this.runWithActivity(
            `✏️ Modifying ${rel}`,
            async () => {
                if (!this.config.tools.allowFileModification) {
                    throw new Error("File modification disabled");
                }

                this.assertNotExcluded(rel, "modify_file");

                sessionTracker.incrementFilesModified();

                const before = await this.getEffectiveText(rel);
                if (before === undefined) {
                    throw new Error(`modify_file: file not found: ${rel}`);
                }
                const key = this.norm(rel);
                const abs = this.resolveSafe(rel);
                this.overlay.set(key, content);
                workspace.update(abs, content);
                this.tracker.log({
                    type: "file_modify",
                    path: key,
                    details: { before, after: content },
                    status: "pending",
                });
                return `Staged updated: ${key}`;
            });
    }

    // Delete File
    async deleteFile(rel: string): Promise<string> {
        return this.runWithActivity(
            `🗑️ Deleting ${rel}`,
            async () => {
                if (!this.config.tools.allowFileModification) {
                    throw new Error("File Deletion Disabled");
                }
                this.assertNotExcluded(rel, "delete_file");
                sessionTracker.incrementFilesDeleted();

                const before = await this.getEffectiveText(rel);
                if (before === undefined) {
                    throw new Error(`delete_file: file not found: ${rel}`);
                }
                const key = this.norm(rel);
                const abs = this.resolveSafe(rel);
                this.overlay.delete(key);
                this.deleted.add(key);
                workspace.remove(abs);
                this.tracker.log({
                    type: "file_delete",
                    path: key,
                    details: { before },
                    status: "pending",
                });
                return `Staged delete : ${key}`;
            });
    }

    // Create Directory
    createFolder(rel: string): string {
        return this.runWithActivity(
            `📁 Creating ${rel}`,
            () => {
                if (!this.config.tools.allowFolderCreation)
                    throw new Error("Folder creation disabled");
                this.assertNotExcluded(rel, "create_folder");
                const key = this.norm(rel);
                this.tracker.log({
                    type: "folder_create",
                    path: key,
                    details: { after: key },
                    status: "pending",
                });
                return `Staged folder: ${key}`;
            });

    }

    //List Files
    // listFiles(rel: string, recursive: boolean = false): string {
    //     return this.runWithActivity(
    //         `📂 Listing ${rel}`,
    //         () => {
    //             this.assertNotExcluded(rel, "list_files");
    //             const abs = this.resolveSafe(rel);
    //             if (!fs.existsSync(abs)) throw new Error(`list_files: not found: ${rel}`);

    //             const lines: string[] = [];
    //             const walk = (dir: string, prefix: string) => {
    //                 const entries = fs.readdirSync(dir, { withFileTypes: true });
    //                 for (const ent of entries) {
    //                     const full = path.join(dir, ent.name);
    //                     const relP = path.relative(this.config.codebasePath, full);
    //                     if (this.excluded(relP)) continue;
    //                     if (ent.isDirectory()) {
    //                         lines.push(`${prefix}${ent.name}/`);
    //                         if (recursive) walk(full, `${prefix}${ent.name}/`);
    //                     } else {
    //                         lines.push(`${prefix}${ent.name}`);
    //                     }
    //                 }
    //             };
    //             if (fs.statSync(abs).isDirectory()) walk(abs, "");
    //             else lines.push(path.relative(this.config.codebasePath, abs));

    //             const out = lines.sort().join("\n");
    //             this.tracker.log({
    //                 type: "code_analysis",
    //                 path: this.norm(rel),
    //                 details: { after: out, toolName: "list_files" },
    //                 status: "executed",
    //             });
    //             return out || "(empty)";
    //         }
    //     );
    // }
    listFiles(rel: string, recursive = false): string {
        return this.runWithActivity(
            `📂 Listing ${rel}`,
            () => {
                this.assertNotExcluded(rel, "list_files");

                const abs = this.resolveSafe(rel);

                const files = workspace.listUnder(abs);

                let lines: string[];
                if (recursive) {
                    lines = files.map(file => path.relative(abs, file.path));
                } else {
                    const uniqueEntries = new Set<string>();
                    for (const file of files) {
                        const rel = path.relative(abs, file.path);
                        if (rel === '') continue;

                        const firstSep = rel.indexOf(path.sep);
                        if (firstSep === -1) {
                            uniqueEntries.add(rel);
                        } else {
                            const dirName = rel.slice(0, firstSep);
                            uniqueEntries.add(dirName + '/');
                        }
                    }
                    lines = [...uniqueEntries];
                }
                
                lines.sort();

                const out = lines.join("\n");

                this.tracker.log({
                    type: "code_analysis",
                    path: this.norm(rel),
                    details: {
                        after: out || "(empty)",
                        toolName: "list_files",
                    },
                    status: "executed",
                });

                return out || "(empty)";
            }
        );
    }

    // Search files
    // searchFiles(
    //     rootRel: string,
    //     globPattern: string,
    //     contentQuery?: string,
    // ): string {
    //     return this.runWithActivity(
    //         `🔍 Searching ${rootRel}`,
    //         () => {
    //             this.assertNotExcluded(rootRel, "search_files");
    //             const rootAbs = this.resolveSafe(rootRel);
    //             if (!fs.existsSync(rootAbs))
    //                 throw new Error(`search_files: root not found: ${rootRel}`);

    //             const results: string[] = [];
    //             const regexFromGlob = (g: string): RegExp => {
    //                 const escaped = g
    //                     .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    //                     .replace(/\*\*/g, "§§")
    //                     .replace(/\*/g, "[^/\\\\]*")
    //                     .replace(/§§/g, ".*")
    //                     .replace(/\?/g, ".");
    //                 return new RegExp(`^${escaped}$`, "i");
    //             };
    //             const nameRe = regexFromGlob(globPattern.replace(/\\/g, "/"));

    //             const walk = (dir: string) => {
    //                 for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    //                     const full = path.join(dir, ent.name);
    //                     const relP = path
    //                         .relative(this.config.codebasePath, full)
    //                         .split(path.sep)
    //                         .join("/");
    //                     if (this.excluded(relP)) continue;
    //                     if (ent.isDirectory()) walk(full);
    //                     else if (nameRe.test(relP) || nameRe.test(ent.name)) {
    //                         if (contentQuery) {
    //                             if (!isProbablyTextFile(full)) continue;
    //                             const text = fs.readFileSync(full, "utf8");
    //                             if (!text.includes(contentQuery)) continue;
    //                         }
    //                         results.push(relP);
    //                     }
    //                 }
    //             };

    //             if (fs.statSync(rootAbs).isDirectory()) walk(rootAbs);
    //             else {
    //                 const relP = path
    //                     .relative(this.config.codebasePath, rootAbs)
    //                     .split(path.sep)
    //                     .join("/");
    //                 results.push(relP);
    //             }

    //             const out = [...new Set(results)].sort().join("\n");
    //             this.tracker.log({
    //                 type: "code_analysis",
    //                 path: this.norm(rootRel),
    //                 details: { after: out || "(no matches)", toolName: "search_files" },
    //                 status: "executed",
    //             });
    //             return out || "(no matches)";
    //         }
    //     );
    // }
    async searchFiles(
        rootRel: string,
        globPattern: string,
        contentQuery?: string,
    ): Promise<string> {

        return this.runWithActivity(
            `🔍 Searching ${rootRel}`,
            async () => {

                this.assertNotExcluded(rootRel, "search_files");

                const root = this.resolveSafe(rootRel);

                const matches = await workspace.search(
                    globPattern,
                    contentQuery,
                    root
                );

                const out = matches
                    .map(f => path.relative(
                        this.config.codebasePath,
                        f.path
                    ))
                    .sort()
                    .join("\n");

                this.tracker.log({
                    type: "code_analysis",
                    path: this.norm(rootRel),
                    details: {
                        after: out || "(no matches)",
                        toolName: "search_files",
                    },
                    status: "executed",
                });

                return out || "(no matches)";

            }
        );
    }

    //Analyse Codebase
    // analyzeCodebase(rootRel: string): string {
    //     return this.runWithActivity(
    //         `📊 Analyzing ${rootRel}`,
    //         () => {
    //             const rootAbs = this.resolveSafe(rootRel);
    //             if (!fs.existsSync(rootAbs))
    //                 throw new Error(`analyze_codebase: not found: ${rootRel}`);

    //             let files = 0;
    //             let dirs = 0;
    //             const walk = (dir: string) => {
    //                 for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    //                     const full = path.join(dir, ent.name);
    //                     const relP = path.relative(this.config.codebasePath, full);
    //                     if (this.excluded(relP)) continue;
    //                     if (ent.isDirectory()) {
    //                         dirs++;
    //                         walk(full);
    //                     } else {
    //                         files++;
    //                     }
    //                 }
    //             };
    //             if (fs.statSync(rootAbs).isDirectory()) walk(rootAbs);
    //             else files = 1;

    //             const summary = `Files: ${files} | Directories: ${dirs}`;
    //             this.tracker.log({
    //                 type: "code_analysis",
    //                 path: this.norm(rootRel),
    //                 details: { after: summary, toolName: "analyze_codebase" },
    //                 status: "executed",
    //             });
    //             return summary;
    //         }
    //     );
    // }

    analyzeCodebase(rootRel: string): string {
        return this.runWithActivity(
            `📊 Analyzing ${rootRel}`,
            () => {

                const summary = buildWorkspaceSummary();

                const output = [
                    `Files: ${summary.totalFiles}`,
                    "",
                    "Extensions:",
                    ...summary.extensions.map(
                        ([ext, count]) => `${ext}: ${count}`
                    ),
                    "",
                    "Entry Points:",
                    ...summary.entryPoints.map(f => f.path)
                ].join("\n");

                this.tracker.log({
                    type: "code_analysis",
                    path: this.norm(rootRel),
                    details: {
                        after: output,
                        toolName: "analyze_codebase",
                    },
                    status: "executed",
                });

                return output;

            }
        );
    }

    // QueueShell
    queueShell(command: string): string {
        return this.runWithActivity(
            `💻 Queuing ${command}`,
            () => {
                if (!this.config.tools.allowShellExecution)
                    throw new Error("Shell execution disabled");

                sessionTracker.incrementShellCommands();

                this.tracker.log({
                    type: "tool_execute",
                    path: "shell",
                    details: { command, toolName: "execute_shell" },
                    status: "pending",
                });
                return `Shell queued: ${command}`;
            });
    }

    // SKILL Directories
    skillRoots(): string[] {
        return this.runWithActivity(
            `🧠 Loading skills`,
            () => {
                const extra =
                    process.env.SKILLS_DIRS?.split(/[;]/)
                        .map((s) => s.trim())
                        .filter(Boolean) ?? [];
                return [
                    ...extra,
                    path.join(homedir(), ".cursor/skills-cursor"),
                    path.join(homedir(), ".claude/skills"),
                ];
            });
    }

    // List Skills
    listSkills(): string {
        return this.runWithActivity(
            `🧠 Loading skills`,
            () => {
                const lines: string[] = [];
                for (const root of this.skillRoots()) {
                    if (!fs.existsSync(root)) continue;
                    const walk = (dir: string) => {
                        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                            const full = path.join(dir, ent.name);
                            if (ent.isDirectory()) walk(full);
                            else if (ent.name === "SKILL.md") lines.push(full);
                        }
                    };
                    walk(root);
                }
                const out = lines.sort().join("\n");
                this.tracker.log({
                    type: "code_analysis",
                    path: "skills",
                    details: { after: out || "(none)", toolName: "list_skills" },
                    status: "executed",
                });
                return out || "(none)";
            }
        );
    }

    // Read Skills
    readSkill(skillPath: string): string {
        return this.runWithActivity(
            `🧠 Reading ${skillPath}`,
            () => {
                const abs = path.isAbsolute(skillPath)
                    ? path.normalize(skillPath)
                    : path.normalize(path.resolve(this.config.codebasePath, skillPath));
                const allowed = this.skillRoots().some((root) => {
                    const r = path.resolve(root);
                    return abs === r || abs.startsWith(r + path.sep);
                });
                if (!allowed) throw new Error("read_skill: outside skill roots");
                const text = fs.readFileSync(abs, "utf8");
                this.tracker.log({
                    type: "code_analysis",
                    path: abs,
                    details: { after: text, toolName: "read_skill" },
                    status: "executed",
                });
                return text;
            }
        );
    }

    applyApprovedFromTracker(): { errors: string[] } {
        const errors: string[] = [];
        const all = [...this.tracker.getActions()];

        for (const a of all.filter(
            (x) => x.type === "folder_create" && x.status === "approved",
        )) {
            try {
                fs.mkdirSync(this.resolveSafe(a.path), { recursive: true });
            } catch (e) {
                errors.push(String(e));
            }
        }

        const fileOps = all
            .filter(
                (a) =>
                    (a.type === "file_create" ||
                        a.type === "file_modify" ||
                        a.type === "file_delete") &&
                    a.status === "approved",
            )
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        const lastByPath = new Map<string, ActionLog>();
        for (const a of fileOps) lastByPath.set(this.norm(a.path), a);

        for (const [p, a] of lastByPath) {
            try {
                if (a.type === "file_delete")
                    fs.rmSync(this.resolveSafe(p), { force: true });
                else {
                    const target = this.resolveSafe(p);
                    fs.mkdirSync(path.dirname(target), { recursive: true });
                    fs.writeFileSync(target, a.details.after ?? "", "utf8");
                }
            } catch (e) {
                errors.push(String(e));
            }
        }

        for (const a of all.filter(
            (x) => x.type === "tool_execute" && x.status === "approved",
        )) {
            const cmd = a.details.command;
            if (!cmd) continue;
            const r = spawnSync(cmd, {
                shell: true,
                cwd: this.config.codebasePath,
                encoding: "utf8",
                maxBuffer: 16 * 1024 * 1024,
            });
            if (r.status && r.status !== 0)
                errors.push(`shell exit ${r.status}: ${cmd}`);
        }

        return { errors };
    }

    // Clear Staging 
    clearStaging(): void {
        this.overlay.clear()
        this.deleted.clear()
    }

}