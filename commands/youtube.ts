import chalk from "chalk";
import type { Command } from "./types";
import { getMyChannel } from "../youtube/channel";
import { getCodingAddaAnalytics } from "../youtube/analytics";
import { renderYouTubeDashboard } from "../youtube/dashboard";
import { setYouTubeSession } from "../youtube/session";

export const youtubeCommand: Command = {
  name: "youtube",
  aliases: ["yt"],
  description: "View Coding Adda YouTube Studio analytics dashboard",

  async execute(args?: string[]) {
    const periodArg = args?.[0]?.toLowerCase();
    let period: "7d" | "28d" | "90d" | "365d" = "28d";

    if (periodArg === "7d" || periodArg === "7") period = "7d";
    else if (periodArg === "28d" || periodArg === "28") period = "28d";
    else if (periodArg === "90d" || periodArg === "90") period = "90d";
    else if (periodArg === "365d" || periodArg === "365" || periodArg === "1y") period = "365d";

    console.log(chalk.gray(`\nFetching Coding Adda YouTube analytics (${period})...\n`));

    try {
      const channel = await getMyChannel();
      const analytics = await getCodingAddaAnalytics({ period });

      setYouTubeSession(channel, analytics);
      renderYouTubeDashboard(channel, analytics);
    } catch (error) {
      console.error(
        chalk.red(`\n❌ Failed to load YouTube dashboard: ${error instanceof Error ? error.message : String(error)}\n`)
      );
    }
  },
};
