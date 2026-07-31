import * as readline from "readline";
import { select, isCancel } from "@clack/prompts";

async function run() {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "adiclaw > ",
    });

    const onKeypress = async (str: string, key: any) => {
        if (rl.line === "/") {
            process.stdout.write('\x1b[2K\r'); // clear line
            rl.pause();
            process.stdin.removeListener("keypress", onKeypress);

            const choice = await select({
                message: "Choose a command:",
                options: [
                    { label: "/help", value: "help" },
                    { label: "/agent", value: "agent" },
                    { label: "/ask", value: "ask" },
                ]
            });

            if (!isCancel(choice)) {
                rl.write(`/${choice} `);
            } else {
                rl.write("/");
            }

            // Restore readline
            process.stdin.on("keypress", onKeypress);
            rl.resume();
            rl.prompt(true);
        }
    };

    process.stdin.on("keypress", onKeypress);
    rl.prompt();

    rl.on("line", (line) => {
        console.log(`Received: ${line}`);
        rl.prompt();
    });
}
run();
