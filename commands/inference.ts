import chalk from "chalk";
import type { Command } from "./types";
import { inferenceEngine } from "../inference";
import { promptPrefixCache } from "../inference/cache/prompt-cache";
import { modelRouter } from "../inference/router/model-router";
import { modelManager } from "../inference/manager";

function visibleLength(str: string): number {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").length;
}

export const inferenceCommand: Command = {
  name: "inference",
  aliases: ["inf", "engine"],
  description: "Inspect inference engine performance, TTFT, TPS, KV cache, and runtime status",

  async execute(args) {
    const sub = (args[0] || "").toLowerCase();

    if (sub === "warmup" || sub === "prewarm") {
      process.stdout.write(chalk.cyan("⚡ Pre-warming model weights into unified memory...\n"));
      const res = await modelManager.warmup();
      if (res.success) {
        console.log(chalk.green(`✔ Pre-warmed model '${res.model}' on '${res.provider}' in ${res.durationMs}ms\n`));
      } else {
        console.log(chalk.yellow(`⚠ Pre-warm completed or skipped (${res.durationMs}ms)\n`));
      }
      return;
    }

    if (sub === "cache" && args[1] === "clear") {
      promptPrefixCache.clear();
      console.log(chalk.green("✔ Inference engine prefix cache cleared.\n"));
      return;
    }

    const status = inferenceEngine.getStatus();
    const cacheStats = promptPrefixCache.getStats();
    const health = await modelRouter.checkHealth();

    const width = 68;
    const border = chalk.hex("#06B6D4");
    const header = chalk.hex("#22D3EE").bold;
    const label = (txt: string) => chalk.dim(txt.padEnd(20));
    const val = (txt: string) => chalk.whiteBright(txt);

    const padLine = (content: string) => {
      const visLen = visibleLength(content);
      const padding = Math.max(0, width - 4 - visLen);
      return border("│ ") + content + " ".repeat(padding) + border(" │");
    };

    console.log();
    console.log(border("╭" + "─".repeat(width - 2) + "╮"));

    // Header
    const headerText = "⚡ AdiClaw Dedicated Inference Engine";
    const hVis = visibleLength(headerText);
    const headerPaddingLeft = Math.floor((width - 2 - hVis) / 2);
    const headerPaddingRight = width - 2 - hVis - headerPaddingLeft;
    console.log(
      border("│") +
        " ".repeat(headerPaddingLeft) +
        header(headerText) +
        " ".repeat(headerPaddingRight) +
        border("│")
    );
    console.log(border("├" + "─".repeat(width - 2) + "┤"));

    // Performance Section
    console.log(padLine(chalk.cyan.bold("🚀 LATENCY & THROUGHPUT")));
    const ttftDisplay = status.averageTTFT > 0 ? `${status.averageTTFT} ms` : "Warmup pending";
    const tpsDisplay = status.averageTPS > 0 ? `${status.averageTPS} tok/s` : "Awaiting requests";
    console.log(padLine(`  ${label("Avg Time to 1st Token:")} ${chalk.greenBright.bold(ttftDisplay)}`));
    console.log(padLine(`  ${label("Avg Tokens Per Sec:")} ${chalk.yellowBright.bold(tpsDisplay)}`));
    console.log(padLine(`  ${label("Active / Total Reqs:")} ${val(`${status.activeRequests} active • ${status.totalRequests} total`)}`));

    console.log(border("├" + "─".repeat(width - 2) + "┤"));

    // Context & Prefix Cache Section
    console.log(padLine(chalk.magenta.bold("🧠 CONTEXT REUSE & KV CACHE")));
    console.log(padLine(`  ${label("Prefix Cache Hit Rate:")} ${chalk.cyanBright.bold(`${cacheStats.hitRatePercentage}%`)} ${chalk.dim(`(${cacheStats.totalHits} hits / ${cacheStats.totalMisses} misses)`)}`));
    console.log(padLine(`  ${label("Tokens Reused / Saved:")} ${chalk.greenBright.bold(cacheStats.totalTokensSaved.toLocaleString())} tokens`));
    console.log(padLine(`  ${label("Cached Prefix Blocks:")} ${val(String(cacheStats.cachedPrefixes))}`));

    console.log(border("├" + "─".repeat(width - 2) + "┤"));

    // Runtimes Section
    console.log(padLine(chalk.blueBright.bold("🔌 RUNTIMES & MODEL STATE")));
    console.log(padLine(`  ${label("Active Provider:")} ${chalk.white.bold(status.activeProvider.toUpperCase())}`));
    console.log(padLine(`  ${label("Active Model:")} ${val(status.activeModel || "default")}`));
    console.log(padLine(`  ${label("Weight Pre-warmed:")} ${status.isPrewarmed ? chalk.greenBright("✔ In Memory / VRAM") : chalk.yellow("○ Cold Start")}`));

    const ollamaStatus = health.ollama ? chalk.green("✔ Online") : chalk.red("✘ Offline");
    const llamaStatus = health.llamacpp ? chalk.green("✔ Online (:8080)") : chalk.dim("○ Standby");
    const openrouterStatus = health.openrouter ? chalk.green("✔ Ready (API Key)") : chalk.dim("○ No Key");

    console.log(padLine(`  ${label("Ollama Daemon:")} ${ollamaStatus}`));
    console.log(padLine(`  ${label("Local llama.cpp:")} ${llamaStatus}`));
    console.log(padLine(`  ${label("OpenRouter Cloud:")} ${openrouterStatus}`));

    console.log(border("╰" + "─".repeat(width - 2) + "╯"));
    console.log(chalk.dim("  Commands: /inference warmup | /inference cache clear\n"));
  },
};
