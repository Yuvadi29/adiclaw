import {
  getYouTubeAuth,
  getYouTubeTokenPath,
  getYouTubeCredentialsPath,
} from "./auth";

console.log("Credentials:");
console.log(getYouTubeCredentialsPath());

console.log();

console.log("Token:");
console.log(getYouTubeTokenPath());

console.log();

console.log("Authenticating with YouTube...");

try {
  const auth = await getYouTubeAuth();

  const token = await auth.getAccessToken();

  if (!token.token) {
    throw new Error(
      "Authentication succeeded but no access token was returned.",
    );
  }

  console.log();
  console.log("✓ YouTube authentication successful");
  console.log();
  console.log("Access token acquired successfully.");
} catch (error) {
  console.error();
  console.error("✗ YouTube authentication failed");
  console.error();

  console.error(error instanceof Error ? error.message : error);

  process.exit(1);
}
