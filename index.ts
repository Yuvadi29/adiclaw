#!/usr/bin/env bun

import { Command } from "commander";

const program = new Command();

program
    .name("adiclaw")
    .description("AdiClaw CLI Tool")
    .version("0.0.1");

program
    .command("new")
    .description("Create a new adiclaw project")
    .action(async () => {
        console.log("Creating new adiclaw project...");
    });

program
    .command("wakeup")
    .description("Show the Banner and pick cli or telegram mode")
    .action(
        async () => {
            console.log("Wakeup Calling...");
        }
    );

await program.parseAsync(process.argv);