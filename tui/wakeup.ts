import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliMode } from "../modes/cli";

const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#818CF8");
const PRIMARY = chalk.hex("#E0E7FF");

function printBannerWithShadow(ascii: string) {
    const bannerLines = ascii.replace(/\s+$/, '').split('\n');
    const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
    const rowWidth = maxLen + 2;

    for (const line of bannerLines) {
        console.log(SHADOW('  ' + line).padEnd(rowWidth))
    };

    process.stdout.write(`\x1b[${bannerLines.length}A`);
    for (const line of bannerLines) {
        console.log(PRIMARY('  ' + line).padEnd(rowWidth));
    };
    console.log();

}

export async function runWakeUp() {
    let ascii: string
    try {
        ascii = figlet.textSync("AdiClaw", {
            font: BANNER_FONT,
        })
    } catch (error) {
        ascii = figlet.textSync("AdiClaw", {
            font: "Standard",
            horizontalLayout: "full"
        })
    }
    printBannerWithShadow(ascii);

    const mode = await select({
        message: "Which mode you wish to proceed with ?",
        options: [
            {
                value: "cli",
                label: "CLI Mode"
            },
            {
                value: "telegram",
                label: "Telegram Mode"
            },
            {
                value: "exit",
                label: "Exit"
            }
        ]
    });

    if (isCancel(mode || mode === "exit")) {
        console.log(chalk.dim("\n Goodbye.... \n"));
        return
    }

    if (mode === "cli") {
        await runCliMode();
    } else if(mode === "telegram") {
        console.log(chalk.dim("Starting Telegram Mode..."));
    }
}