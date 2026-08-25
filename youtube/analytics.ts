import { getYouTubeAnalyticsClient } from "./client";

import { CHANNEL_ID } from "./channel";

export interface YouTubeAnalyticsSummary {
  startDate: string;
  endDate: string;

  views: number;
  likes: number;
  comments: number;

  estimatedMinutesWatched: number;

  averageViewDuration: number;

  subscribersGained: number;
  subscribersLost: number;
}

export interface AnalyticsOptions {
  period?: "7d" | "28d" | "90d" | "365d";
  startDate?: string;
  endDate?: string;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getCodingAddaAnalytics(
  options?: AnalyticsOptions,
): Promise<YouTubeAnalyticsSummary> {
  const analytics = await getYouTubeAnalyticsClient();

  const end = new Date();
  const start = new Date();

  let days = 28;
  if (options?.period === "7d") days = 7;
  else if (options?.period === "28d") days = 28;
  else if (options?.period === "90d") days = 90;
  else if (options?.period === "365d") days = 365;

  start.setDate(start.getDate() - days);

  const startDate = options?.startDate ?? formatDate(start);
  const endDate = options?.endDate ?? formatDate(end);

  const response = await analytics.reports.query({
    ids: `channel==${CHANNEL_ID}`,
    startDate,
    endDate,
    metrics: [
      "views",
      "likes",
      "comments",
      "estimatedMinutesWatched",
      "averageViewDuration",
      "subscribersGained",
      "subscribersLost",
    ].join(","),
  });

  const row = response.data.rows?.[0];

  if (!row) {
    return {
      startDate,
      endDate,
      views: 0,
      likes: 0,
      comments: 0,
      estimatedMinutesWatched: 0,
      averageViewDuration: 0,
      subscribersGained: 0,
      subscribersLost: 0,
    };
  }

  return {
    startDate,
    endDate,
    views: Number(row[0] ?? 0),
    likes: Number(row[1] ?? 0),
    comments: Number(row[2] ?? 0),
    estimatedMinutesWatched: Number(row[3] ?? 0),
    averageViewDuration: Number(row[4] ?? 0),
    subscribersGained: Number(row[5] ?? 0),
    subscribersLost: Number(row[6] ?? 0),
  };
}

