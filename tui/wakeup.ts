import chalk from "chalk";
import figlet from "figlet";
import { aiSession } from "../ai/session";
import { sessionTracker } from "../ai/session/session-tracker";
import { loadConfig } from "../config/config";
import { runREPL } from "./repl";
import { memory } from "../memory";

const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#818CF8");
const PRIMARY = chalk.hex("#E0E7FF");

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
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  const steps = ["Initializing runtime", "Loading tools"];

  for (const step of steps) {
    let currentFrame = 0;
    const duration = 300 + Math.random() * 400;
    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      process.stdout.write(
        `\r${chalk.cyan(frames[currentFrame % frames.length])} ${chalk.gray(step + "...")}`,
      );
      currentFrame++;
      await Bun.sleep(50);
    }

    process.stdout.write(
      `\r${chalk.green("✔")} ${chalk.white(step + "...")}\x1b[K\n`,
    );
  }

  console.log();
}

export async function runWakeUp() {
  // Banner
  let ascii: string;
  try {
    ascii = figlet.textSync("AdiClaw", { font: BANNER_FONT });
  } catch {
    ascii = figlet.textSync("AdiClaw", {
      font: "Standard",
      horizontalLayout: "full",
    });
  }
  await printBannerWithShadow(ascii);

  // Load config from env (no interactive prompts)
  const config = loadConfig();
  aiSession.set({
    provider: config.provider,
    model: config.model,
    providerName: config.providerName,
  });

  sessionTracker.start(config.providerName, config.model);

  await bootSequence();

  console.log(chalk.gray("Initializing MCP servers..."));
  const { initMCP } = await import("../mcp");
  await initMCP();

  // Workspace indexing
  console.log(chalk.gray("Indexing workspace..."));
  const { scan } = await import("../workspace/scanner");
  await scan(process.cwd());

  //Initializing Memory
  console.log(chalk.grey("Loading Memory...."));
  memory.initialize();

  memory.remember({
      type: "preference",
      text: "User prefers Bun over npm.",
      tags: ["bun", "package-manager"],
      source: "user",
  });
  
  console.log(memory.stats());
  
  console.log(memory.search("bun"));   

  // Show active config
  console.log(
    chalk.dim(
      `  Provider: ${chalk.white(config.providerName)}  Model: ${chalk.white(config.model)}\n`,
    ),
  );

  // Enter REPL
  await runREPL();
}
