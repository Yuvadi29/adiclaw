import type { IndexedFile, WorkspaceStats } from "./types";

function globToRegex(g: string): RegExp {
    const escaped = g
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§§")
        .replace(/\*/g, "[^/\\\\]*")
        .replace(/§§/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`, "i");
}

export class Workspace {
    private files = new Map<string, IndexedFile>();
    private contents = new Map<string, string>();

    private stats: WorkspaceStats = {
        totalFiles: 0,
        totalDirectories: 0,
        indexedAt: 0,
    }

    add(file: IndexedFile) {
        this.files.set(file.path, file);
    }

    get(path: string) {
        return this.files.get(path);
    }

    has(path: string) {
        return this.files.has(path);
    }

    updateStats(stats: WorkspaceStats) {
        this.stats = stats;
    }

    getStats() {
        return this.stats;
    }

    async read(path: string): Promise<string> {
        const cached = this.contents.get(path);
        if (cached) {
            return cached;
        }
        const content = await Bun.file(path).text();
        this.contents.set(path, content);
        return content;
    }

    update(path: string, content: string) {
        this.contents.set(path, content);
    }

    invalidate(path: string) {
        this.contents.delete(path);
    }

    remove(path: string) {
        this.files.delete(path);
        this.contents.delete(path);
    }

    list(): IndexedFile[] {
        return [...this.files.values()];
    }

    listUnder(root: string): IndexedFile[] {
        return this.list().filter(f => f.path.startsWith(root));
    }

    async search(
        glob: string,
        contentQuery?: string,
        root?: string
    ): Promise<IndexedFile[]> {

        const regex = globToRegex(glob);

        const matches = [];

        for (const file of this.files.values()) {

            if (root && !file.path.startsWith(root))
                continue;

            if (
                !regex.test(file.path) &&
                !regex.test(file.name)
            ) {
                continue;
            }

            if (contentQuery) {

                const text = await this.read(file.path);

                if (!text.includes(contentQuery))
                    continue;
            }

            matches.push(file);

        }

        return matches;

    }
}