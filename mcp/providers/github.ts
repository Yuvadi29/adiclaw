import type { MCPClientConfig } from "../runtime/client";

export const githubProviderConfig: MCPClientConfig = {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "",
    }
};