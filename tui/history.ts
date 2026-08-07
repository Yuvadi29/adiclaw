import fs from "fs";
import os from "os";
import path from "path";

const HISTORY_FILE = path.join(os.homedir(), ".adiclaw", ".adiclaw_history");

export function loadHistory(): string[] {
    try {
        if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
            fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
        }
        
        if (fs.existsSync(HISTORY_FILE)) {
            const content = fs.readFileSync(HISTORY_FILE, "utf-8");
            // Readline expects index 0 to be the most recent command, so we should reverse the array.
            return content
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
                .reverse();
        }
    } catch (e) {
        // fail silently for history
    }
    return [];
}

export function appendHistory(command: string) {
    if (!command.trim()) return;
    try {
        fs.appendFileSync(HISTORY_FILE, command + "\n", "utf-8");
    } catch (e) {
        // fail silently for history
    }
}
