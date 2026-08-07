#!/usr/bin/env bun

import { Command } from "commander";
import { runWakeUp } from "./tui/wakeup";
import { setupShutdownHandlers, shutdown } from "./ai/session/shutdown";
import { MemoryStorage } from "./memory/storage";

setupShutdownHandlers();

const program = new Command();
const storage = new MemoryStorage();
storage.initialize();
console.log(storage.getMemoryFile());
console.log(storage.load())

program.name("adiclaw").description("AdiClaw CLI Tool").version("0.0.1");

program
  .command("new")
  .description("Create a new adiclaw project")
  .action(async () => {
    console.log("Creating new adiclaw project...");
  });

program
  .command("wakeup")
  .description("Show the Banner and pick cli or telegram mode")
  .action(async () => {
    await runWakeUp();
  });

await program.parseAsync(process.argv);
shutdown("completed", 0);
