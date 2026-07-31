import * as readline from "readline/promises";
import { select, isCancel, text } from "@clack/prompts";

async function run() {
    let prefilledInput = "";

    while (true) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        if (prefilledInput) {
            rl.write(prefilledInput);
            prefilledInput = "";
        }

        let slashIntercepted = false;
        const onKeypress = (str: string, key: any) => {
            if (rl.line === "/" && str === "/") {
                setTimeout(() => {
                    if (rl.line !== "/") return;
                    process.stdout.write('\x1b[2K\r');
                    slashIntercepted = true;
                    rl.close();
                }, 10);
            }
        };

        process.stdin.on("keypress", onKeypress);

        // using question to wait for enter
        const answer = await rl.question("adiclaw > ");
        process.stdin.removeListener("keypress", onKeypress);

        if (slashIntercepted) {
            const choice = await select({
                message: "Choose:",
                options: [{label: "/agent", value: "agent"}, {label: "/ask", value: "ask"}]
            });
            if (!isCancel(choice)) {
                prefilledInput = `/${choice} `;
            }
            continue;
        }

        rl.close();
        if (!answer.trim()) continue;

        if (answer.startsWith("/agent")) {
            // simulate clack prompt inside a command
            const res = await text({ message: "What do you want the agent to do?" });
            console.log(`Command got: ${res}`);
        } else {
            console.log(`Executed: ${answer}`);
        }
    }
}
run();
