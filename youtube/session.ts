import type { YouTubeAnalyticsSummary } from "./analytics";
import type { YouTubeChannelSummary } from "./channel";

export interface YouTubeSessionData {
  channel: YouTubeChannelSummary;
  analytics: YouTubeAnalyticsSummary;
  loadedAt: string;
}

let sessionData: YouTubeSessionData | null = null;

export function setYouTubeSession(
  channel: YouTubeChannelSummary,
  analytics: YouTubeAnalyticsSummary,
): void {
  sessionData = {
    channel,
    analytics,
    loadedAt: new Date().toISOString(),
  };
}

export function getYouTubeSession(): YouTubeSessionData | null {
  return sessionData;
}

export function clearYouTubeSession(): void {
  sessionData = null;
}
