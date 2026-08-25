import { getCodingAddaAnalytics } from "./analytics";

try {
  console.log("\nFetching Coding Adda analytics...\n");

  const analytics = await getCodingAddaAnalytics();

  console.log(`${analytics.startDate} → ${analytics.endDate}`);

  console.log();

  console.log(`Views:               ${analytics.views}`);

  console.log(`Likes:               ${analytics.likes}`);

  console.log(`Comments:            ${analytics.comments}`);

  console.log(
    `Watch time:          ${analytics.estimatedMinutesWatched} minutes`,
  );

  console.log(`Average view time:   ${analytics.averageViewDuration}s`);

  console.log(`Subscribers gained:  ${analytics.subscribersGained}`);

  console.log(`Subscribers lost:    ${analytics.subscribersLost}`);

  console.log("\n✓ Coding Adda analytics loaded\n");
} catch (error) {
  console.error("\n✗ Analytics failed\n");

  console.error(error instanceof Error ? error.message : error);

  process.exit(1);
}
