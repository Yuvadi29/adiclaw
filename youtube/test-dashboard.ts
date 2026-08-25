import { getCodingAddaAnalytics } from "./analytics";
import { getMyChannel } from "./channel";
import { renderYouTubeDashboard } from "./dashboard";

try {
  const channel = await getMyChannel();

  const analytics = await getCodingAddaAnalytics();

  renderYouTubeDashboard(channel, analytics);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);

  process.exit(1);
}
