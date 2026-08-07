import path from "path";
import { workspace } from "./index";

const IGNORED = new Set([
    "node_modules",
    ".next",
    "dist",
    ".env",
    "build",
    ".turbo"
]);

export async function scan(dir: string) {
    const start = Date.now();

    let files = 0;
    let directories = 0;

    async function walk(current: string) {
        for await (const entry of new Bun.Glob("*").scan({ cwd: current, onlyFiles: false })) {
            const absolute = path.join(current, entry);
            
            let stat;
            try {
                stat = await Bun.file(absolute).stat();
            } catch (error) {
                // Silently skip files that throw ELOOP (symlink loops), EACCES, ENOENT, etc.
                continue;
            }

            if (stat.isDirectory()) {
                if (IGNORED.has(path.basename(absolute)))
                    continue;

                directories++;
                await walk(absolute);
                continue;
            }

            files++;

            workspace.add({
                path: absolute,
                name: path.basename(absolute),
                extension: path.extname(absolute),
                size: stat.size,
                modified: stat.mtimeMs
            });
        }
    }

    await walk(dir);

    workspace.updateStats({
        totalFiles: files,
        totalDirectories: directories,
        indexedAt: Date.now(),
    });

    const time = Date.now() - start;
    console.log();
    console.log(`✓ Indexed ${files} files`);
    console.log(`✓ Completed in ${time} ms`);
    console.log(`✓ Cache ready\n`);

    return time;
}