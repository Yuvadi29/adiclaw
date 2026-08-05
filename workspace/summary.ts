import path from "path";
import { workspace } from "./index";
import fs from "fs";



function getGitRemote(root: string) {

    const config = path.join(root, ".git", "config");

    if (!fs.existsSync(config))
        return null;

    const text = fs.readFileSync(config, "utf8");

    const match = text.match(/url\s*=\s*(.+)/);

    return match?.[1] ?? null;

}


export function buildWorkspaceSummary() {

    const files = workspace.list();
    const extensionCount = new Map<string, number>();

    for (const file of files) {
        const ext = file.extension || "(none)";
        extensionCount.set(
            ext,
            (extensionCount.get(ext) ?? 0) + 1,
        );
    }

    const extensions = [...extensionCount.entries()].sort((a, b) => b[1] - a[1]);

    const largestFiles = [...files]
        .sort((a, b) => b.size - a.size).slice(0, 10);


    const entryPoints = files.filter((f) => {
        const n = path.basename(f.path);

        return (
            n === "index.ts" ||
            n === "main.ts" ||
            n === "cli.ts" ||
            n === "app.ts" ||
            n === "server.ts"
        );
    });
    return {
        totalFiles: files.length,
        extensions,
        largestFiles,
        entryPoints,
        gitRemote: getGitRemote(process.cwd()),
    };

}
