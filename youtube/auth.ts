import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

const YOUTUBE_DIR = path.join(os.homedir(), ".adiclaw", "youtube");

const TOKEN_PATH = path.join(YOUTUBE_DIR, "token.json");

const DEFAULT_CREDENTIALS_PATH = path.join(YOUTUBE_DIR, "client_secret.json");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];

interface GoogleCredentials {
  client_id: string;
  client_secret: string;
}

interface GoogleCredentialFile {
  installed?: {
    client_id?: string;
    client_secret?: string;
  };

  web?: {
    client_id?: string;
    client_secret?: string;
  };
}

interface StoredToken {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
  id_token?: string;
}

function ensureDirectory(): void {
  fs.mkdirSync(YOUTUBE_DIR, {
    recursive: true,
    mode: 0o700,
  });
}

function getCredentialsPath(): string {
  return (
    process.env.ADICLAW_YOUTUBE_CLIENT_SECRET ||
    process.env.GOOGLE_YOUTUBE_CLIENT_SECRET ||
    DEFAULT_CREDENTIALS_PATH
  );
}

function loadClientCredentials(): GoogleCredentials {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      [
        "YouTube Google OAuth credentials were not found.",
        "",
        `Expected file: ${credentialsPath}`,
        "",
        "Create a Desktop OAuth client in Google Cloud and place",
        "the downloaded JSON at that location.",
        "",
        "Or set:",
        "ADICLAW_YOUTUBE_CLIENT_SECRET=/absolute/path/client_secret.json",
      ].join("\n"),
    );
  }

  let parsed: GoogleCredentialFile;

  try {
    parsed = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  } catch {
    throw new Error(
      `Unable to parse Google OAuth credentials: ${credentialsPath}`,
    );
  }

  const credentials = parsed.installed ?? parsed.web;

  if (!credentials?.client_id || !credentials.client_secret) {
    throw new Error(
      [
        "Invalid Google OAuth credentials.",
        "",
        "The credentials JSON must contain either:",
        '  "installed": { "client_id": "...", "client_secret": "..." }',
        "",
        "or:",
        '  "web": { "client_id": "...", "client_secret": "..." }',
      ].join("\n"),
    );
  }

  return {
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
  };
}

function createOAuthClient(redirectUri: string): OAuth2Client {
  const credentials = loadClientCredentials();

  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    redirectUri,
  );
}

function loadStoredToken(): StoredToken | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")) as StoredToken;
  } catch {
    console.warn(`Warning: unable to read YouTube token at ${TOKEN_PATH}`);

    return null;
  }
}

function saveToken(token: StoredToken): void {
  ensureDirectory();

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });

  // chmod again because an existing file keeps its previous mode.
  try {
    fs.chmodSync(TOKEN_PATH, 0o600);
  } catch {
    // Best effort on platforms where chmod is unavailable.
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;

  if (platform === "darwin") {
    execFile("open", [url], () => {});

    return;
  }

  if (platform === "win32") {
    execFile("cmd", ["/c", "start", "", url], () => {});

    return;
  }

  execFile("xdg-open", [url], () => {});
}

function createState(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function waitForOAuthCallback(
  server: http.Server,
  expectedState: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        server.close();

        reject(new Error("YouTube authentication timed out."));
      },
      5 * 60 * 1000,
    );

    server.on("request", (req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400);
          res.end("Missing OAuth callback.");

          return;
        }

        const requestUrl = new URL(req.url, "http://127.0.0.1");

        if (requestUrl.pathname !== "/oauth2callback") {
          res.writeHead(404);
          res.end("Not found.");

          return;
        }

        const error = requestUrl.searchParams.get("error");

        if (error) {
          clearTimeout(timeout);

          res.writeHead(400, {
            "Content-Type": "text/html; charset=utf-8",
          });

          res.end(`
                            <html>
                                <body>
                                    <h2>AdiClaw YouTube authorization failed.</h2>
                                    <p>${escapeHtml(error)}</p>
                                    <p>You can close this window.</p>
                                </body>
                            </html>
                        `);

          server.close();

          reject(new Error(`Google OAuth authorization failed: ${error}`));

          return;
        }

        const state = requestUrl.searchParams.get("state");

        if (state !== expectedState) {
          res.writeHead(400, {
            "Content-Type": "text/html; charset=utf-8",
          });

          res.end(`
                            <html>
                                <body>
                                    <h2>Invalid authorization request.</h2>
                                    <p>You can close this window.</p>
                                </body>
                            </html>
                        `);

          return;
        }

        const code = requestUrl.searchParams.get("code");

        if (!code) {
          res.writeHead(400, {
            "Content-Type": "text/html; charset=utf-8",
          });

          res.end(`
                            <html>
                                <body>
                                    <h2>Authorization code missing.</h2>
                                    <p>You can close this window.</p>
                                </body>
                            </html>
                        `);

          return;
        }

        clearTimeout(timeout);

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
        });

        res.end(`
                        <html>
                            <head>
                                <title>AdiClaw</title>
                            </head>
                            <body>
                                <h2>✓ YouTube connected to AdiClaw</h2>
                                <p>You can close this browser window and return to AdiClaw.</p>
                            </body>
                        </html>
                    `);

        server.close();

        resolve(code);
      } catch (error) {
        clearTimeout(timeout);
        server.close();

        reject(error);
      }
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function authorize(): Promise<OAuth2Client> {
  ensureDirectory();

  return new Promise(async (resolve, reject) => {
    const server = http.createServer();

    server.on("error", (error) => {
      reject(error);
    });

    server.listen(0, "127.0.0.1", async () => {
      try {
        const address = server.address();

        if (!address || typeof address === "string") {
          server.close();

          reject(new Error("Unable to determine OAuth callback port."));

          return;
        }

        const port = address.port;

        const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

        const oauth2Client = createOAuthClient(redirectUri);

        /*
         * PKCE:
         *
         * Google's current installed-app guidance
         * recommends PKCE for desktop applications.
         */
        const { codeVerifier, codeChallenge } =
          await oauth2Client.generateCodeVerifierAsync();

        const state = createState();

        const authorizationUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",

          scope: SCOPES,

          prompt: "consent",

          state,

          code_challenge_method: "S256",

          code_challenge: codeChallenge,
        });

        console.log();
        console.log("YouTube authorization required.");
        console.log();
        console.log("Opening your browser...");
        console.log();

        console.log("If the browser does not open, visit:");

        console.log();
        console.log(authorizationUrl);
        console.log();

        openBrowser(authorizationUrl);

        try {
          const code = await waitForOAuthCallback(server, state);

          const { tokens } = await oauth2Client.getToken({
            code,
            codeVerifier,
          });

          if (!tokens.refresh_token) {
            server.close();

            reject(
              new Error(
                [
                  "Google did not return a refresh token.",
                  "",
                  "Delete the existing AdiClaw YouTube authorization",
                  "from your Google account and authorize again.",
                ].join("\n"),
              ),
            );

            return;
          }

          oauth2Client.setCredentials(tokens);

          saveToken(tokens);

          resolve(oauth2Client);
        } catch (error) {
          reject(error);
        }
      } catch (error) {
        server.close();

        reject(error);
      }
    });
  });
}

export async function getYouTubeAuth(): Promise<OAuth2Client> {
  ensureDirectory();

  const credentials = loadClientCredentials();

  /*
   * We don't know the callback port until
   * we actually start the OAuth server.
   *
   * For an existing refresh token, no callback
   * server is necessary.
   */
  const storedToken = loadStoredToken();

  if (storedToken?.refresh_token) {
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
    );

    oauth2Client.setCredentials({
      refresh_token: storedToken.refresh_token,
      access_token: storedToken.access_token,
      expiry_date: storedToken.expiry_date,
      scope: storedToken.scope,
      token_type: storedToken.token_type,
    });

    /*
     * Keep the stored refresh token if Google
     * returns a new access token.
     */
    oauth2Client.on("tokens", (tokens) => {
      const current = loadStoredToken();

      saveToken({
        ...current,
        ...tokens,
        refresh_token:
          tokens.refresh_token ??
          current?.refresh_token ??
          storedToken.refresh_token,
      });
    });

    /*
     * Force an access-token request here.
     *
     * This makes startup fail early if the
     * refresh token has been revoked/expired.
     */
    try {
      await oauth2Client.getAccessToken();

      return oauth2Client;
    } catch {
      console.log();
      console.log("Stored YouTube authorization is no longer valid.");
      console.log("Starting YouTube authorization again...");
      console.log();

      try {
        fs.unlinkSync(TOKEN_PATH);
      } catch {
        // Ignore if token is already gone.
      }
    }
  }

  const oauth2Client = await authorize();

  oauth2Client.on("tokens", (tokens) => {
    const current = loadStoredToken();

    saveToken({
      ...current,
      ...tokens,
      refresh_token: tokens.refresh_token ?? current?.refresh_token,
    });
  });

  return oauth2Client;
}

export function isYouTubeAuthenticated(): boolean {
  const token = loadStoredToken();

  return Boolean(token?.refresh_token);
}

export function getYouTubeTokenPath(): string {
  return TOKEN_PATH;
}

export function getYouTubeCredentialsPath(): string {
  return getCredentialsPath();
}

export async function revokeYouTubeAuth(): Promise<void> {
  const token = loadStoredToken();

  if (!token?.refresh_token) {
    return;
  }

  const credentials = loadClientCredentials();

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
  );

  oauth2Client.setCredentials({
    refresh_token: token.refresh_token,
  });

  try {
    await oauth2Client.revokeCredentials();
  } finally {
    try {
      fs.unlinkSync(TOKEN_PATH);
    } catch {
      // Ignore missing token file.
    }
  }
}
