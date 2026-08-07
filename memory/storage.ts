import fs, { writeFileSync } from "fs";
import os from "os";
import path from "path";

import type { MemoryDatabase } from "./types";
import { MemoryDatabaseSchema } from "./schemas";

const ROOT = path.join(os.homedir(), ".adiclaw");
const MEMORY_DIR = path.join(ROOT, "memory");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.json");

const DEFAULT_DB: MemoryDatabase = {
  version: 1,
  memories: [],
};

export class MemoryStorage {
  getRootPath() {
    return ROOT;
  }

  getMemoryDirectory() {
    return MEMORY_DIR;
  }

  getMemoryFile() {
    return MEMORY_FILE;
  }

  initialize() {
    // Create memory directory & db if missing
    if (!fs.existsSync(ROOT)) {
      fs.mkdirSync(ROOT, {
        recursive: true,
      });
    }

    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, {
        recursive: true,
      });
    }

    if (!fs.existsSync(MEMORY_FILE)) {
      fs.writeFileSync(
        MEMORY_FILE,
        JSON.stringify(DEFAULT_DB, null, 2),
        "utf-8",
      );
    }
  }

  // Load memory from disk
  load(): MemoryDatabase {
    this.initialize();
    const raw = fs.readFileSync(MEMORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return MemoryDatabaseSchema.parse(parsed);
  }

  // Save memory database
  save(db: MemoryDatabase) {
    MemoryDatabaseSchema.parse(db);

    fs.writeFileSync(MEMORY_FILE, JSON.stringify(db, null, 2), "utf8");
  }
}
