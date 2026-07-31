import * as readline from "readline";
import { text } from "@clack/prompts";

async function run() {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "adiclaw > ",
    });

    rl.prompt();

    rl.on("line", async (line) => {
        rl.pause();
        const res = await text({ message: "What do you want?" });
        console.log(`Clack got: ${res}`);
        rl.resume();
        rl.prompt();
    });
}
run();
