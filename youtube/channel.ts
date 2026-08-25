import { getYouTubeClient } from "./client";

export const CHANNEL_ID = "UChVzP7gNOlkymoo000Y9_6Q";

export interface YouTubeChannelSummary {
  id: string;
  title: string;
  description: string;

  subscribers: number;
  views: number;
  videos: number;

  thumbnail: string;
}

export async function getMyChannel(): Promise<YouTubeChannelSummary> {
  const youtube = await getYouTubeClient();

  const response = await youtube.channels.list({
    part: ["snippet", "statistics"],
    id: [CHANNEL_ID],
  });

  const channel = response.data.items?.[0];

  if (!channel) {
    throw new Error(
      [
        "Coding Adda YouTube channel could not be found.",
        `Channel ID: ${CODING_ADDA_CHANNEL_ID}`,
        "",
        "Check that the configured channel ID is correct.",
      ].join("\n"),
    );
  }

  return {
    id: CHANNEL_ID,
    title: channel.snippet?.title ?? "",
    description: channel.snippet?.description ?? "",
    subscribers: Number(channel.statistics?.subscriberCount ?? 0),
    views: Number(channel.statistics?.viewCount ?? 0),
    videos: Number(channel.statistics?.videoCount ?? 0),
    thumbnail: channel.snippet?.thumbnails?.high?.url ?? "",
  }
}
