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

    // Laser scanner effect sweeping left to right
    const width = rowWidth + 10;
    for (let col = 0; col < width; col += 2) {
        process.stdout.write(`\x1b[${bannerLines.length}A`);
        
        for (let i = 0; i < bannerLines.length; i++) {
            const line = ("  " + bannerLines[i]).padEnd(rowWidth);
            let coloredLine = "";
            for (let j = 0; j < line.length; j++) {
                const dist = Math.abs(j - col);
                if (dist < 2) {
                    coloredLine += chalk.white.bold(line[j]);
                } else if (dist < 5) {
                    coloredLine += chalk.cyanBright(line[j]);
                } else if (dist < 8) {
                    coloredLine += chalk.blueBright(line[j]);
                } else if (j < col) {
                    coloredLine += PRIMARY(line[j]);
                } else {
                    coloredLine += SHADOW(line[j]);
                }
            }
            console.log(coloredLine);
        }
        await Bun.sleep(25);
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

    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

    for (const step of steps) {
        let currentFrame = 0;
        
        // Random duration between 300 and 700ms
        const duration = 300 + Math.random() * 400;
        const endTime = Date.now() + duration;
        
        while (Date.now() < endTime) {
            process.stdout.write(
                `\r${chalk.cyan(frames[currentFrame % frames.length])} ${chalk.gray(step + "...")}`
            );
            currentFrame++;
            await Bun.sleep(50);
        }

        process.stdout.write(
            `\r${chalk.green("✔")} ${chalk.white(step + "...")}\x1b[K\n`
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