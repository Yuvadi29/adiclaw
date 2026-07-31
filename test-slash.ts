import * as readline from "readline";
import { select, isCancel, text } from "@clack/prompts";

async function run() {
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "adiclaw > ",
    });

    const onKeypress = async (str: string, key: any) => {
        if (rl.line === "/") {
            // HACK: hide the slash we just typed
            process.stdout.write('\x1b[2K\r');
            
            // Temporarily disable readline to let clack take over
            rl.pause();
            process.stdin.removeListener("keypress", onKeypress);

            const choice = await select({
                message: "Choose a command:",
                options: [
                    { label: "/help", value: "help" },
                    { label: "/exit", value: "exit" },
                    { label: "/agent", value: "agent" },
                ]
            });

            if (isCancel(choice)) {
                // Resume normal input
                console.log("Cancelled");
            } else {
                console.log(`You selected: ${choice}`);
            }

            // Restore readline
            rl.prompt();
            process.stdin.on("keypress", onKeypress);
            rl.resume();
        }
    };

    process.stdin.on("keypress", onKeypress);
    rl.prompt();

    rl.on("line", (line) => {
        console.log(`Received line: ${line}`);
        rl.prompt();
    });
}
run();
