import { getMyChannel } from "./channel";

try {
  console.log("\nFetching Coding Adda channel...\n");

  const channel = await getMyChannel();

  console.log("Channel");
  console.log("──────────────");
  console.log(`Name:        ${channel.title}`);
  console.log(`Channel ID:  ${channel.id}`);
  console.log(`Subscribers: ${channel.subscribers}`);
  console.log(`Views:       ${channel.views}`);
  console.log(`Videos:      ${channel.videos}`);

  if (channel.thumbnail) {
    console.log(`Thumbnail:   ${channel.thumbnail}`);
  }

  console.log("\n✓ YouTube channel loaded\n");
} catch (error) {
  console.error("\n✗ Failed to load YouTube channel\n");

  console.error(error instanceof Error ? error.message : error);

  process.exit(1);
}
