import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliMode } from "../modes/cli";

const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#818CF8");
const PRIMARY = chalk.hex("#E0E7FF");
const GLOW = [
    chalk.hex("#A5B4FC"),
    chalk.hex("#C7D2FE"),
    chalk.hex("#E0E7FF"),
];

async function printBannerWithShadow(ascii: string) {
    const bannerLines = ascii.replace(/\s+$/, "").split("\n");

    const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
    const rowWidth = maxLen + 2;

    // Draw shadow first
    for (const line of bannerLines) {
        console.log(SHADOW("  " + line).padEnd(rowWidth));
    }

    // Go back to top
    process.stdout.write(`\x1b[${bannerLines.length}A`);

    // Reveal the foreground line-by-line
    for (const color of GLOW) {

        process.stdout.write(`\x1b[${bannerLines.length + 1}A`);

        for (const line of bannerLines) {
            console.log(color("  " + line).padEnd(rowWidth));
        }

        await Bun.sleep(90);

    }

    console.log();
}

async function bootSequence() {

    const steps = [
        "Initializing runtime",
        "Loading AI models",
        "Loading tools",
        "Preparing workspace",
    ];

    for (const step of steps) {

        process.stdout.write(chalk.gray(`○ ${step}...`));

        await Bun.sleep(250);

        process.stdout.write(
            `\r${chalk.green("✔")} ${step}\n`
        );

    }

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
    await printBannerWithShadow(ascii);

    await bootSequence();
    console.log(chalk.gray(">_"));
    await Bun.sleep(400);
    process.stdout.write("\x1b[1A");
    process.stdout.write("\x1b[2K");

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
    } else if (mode === "telegram") {
        console.log(chalk.dim("Starting Telegram Mode..."));
    }
}