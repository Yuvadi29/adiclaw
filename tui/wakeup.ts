import { select, isCancel, spinner } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliMode } from "../modes/cli";
import { checkOllama } from "../ai/ollama";
import { type AIProvider, PROVIDERS } from "../ai/provider";
import { aiSession } from "../ai/session";
import { activity } from "./activity";
import { sessionTracker } from "../ai/session/session-tracker";
import { shutdown } from "../ai/session/shutdown";

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

function formatBytes(bytes: number): string {
    if(bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB"];
    let size = bytes;
    let unit = -1;

    do {
        size /= 1024;
        unit++;
    } while (size >= 1024 && unit < units.length -1 );

    return `${size.toFixed(1)} ${units[unit]}`;
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

    const provider = await select<AIProvider>({
        message: "Choose AI Provider",
        options: PROVIDERS.map((p) => ({

            value: p.id,
            label: p.name,
            hint: p.description,
        })),
    });

    if (isCancel(provider)) {
        console.log(chalk.dim("\nGoodbye"));
        shutdown("cancelled", 0);
        return;
    }

    if (provider === "openrouter") {
        aiSession.set({
            provider: "openrouter",
            providerName: "OpenRouter",
            model: "openrouter/free"
        });
        activity.setSession("OpenRouter", "openrouter/free");
    }

    if (provider === "ollama") {
        const s = spinner();
        s.start("Checking Ollama...");

        const status = await checkOllama();
        if (!status.running) {
            s.stop("Ollama not detected");
            console.log();
            console.log(
                chalk.red("⚠️ Ollama is not running. Please install and run Ollama (ollama serve) to use local models.")
            );
            console.log();
            return;
        }
        s.stop(`Found ${status.models?.length ?? 0} local model(s)`);

        if (!status.models || status.models.length === 0) {
            console.log(chalk.yellow("⚠️ No local models found. Please pull a model (e.g., ollama run llama3)."));
            shutdown("crashed", 1);
            return;
        }

        const model = await select<string>({
            message: "Choose Ollama Model",
            options: status.models.map((m) => ({
                value: m.name,
                label: m.name,
                hint: formatBytes(m.size),
            })),
        });

        if (isCancel(model)) {
            shutdown("cancelled", 0);
            return;
        }

        aiSession.set({
            provider: "ollama",
            providerName: "Ollama",
            model,
        });
        activity.setSession("Ollama", model);
    }

    const sess = aiSession.get();
    sessionTracker.start(sess.providerName || sess.provider, sess.model);

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

    if (isCancel(mode)) {
        console.log(chalk.dim("\n Goodbye.... \n"));
        shutdown("cancelled", 0);
        return;
    }
    
    if (mode === "exit") {
        console.log(chalk.dim("\n Goodbye.... \n"));
        shutdown("completed", 0);
        return;
    }

    if (mode === "cli") {
        await runCliMode();
    } else if (mode === "telegram") {
        console.log(chalk.dim("Starting Telegram Mode..."));
    }
}