/**
 * StreamShortcut MCP Server - Cloudflare Workers Entry Point
 *
 * A lightweight Shortcut MCP. One tool, eight actions.
 * Based on https://github.com/stayce/streamshortcut
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShortcutClient } from "./client";
import { handleAction } from "./handlers";
import { Env, SERVER_NAME, SERVER_VERSION, ShortcutParams } from "./types";

/**
 * Create MCP server with single tool configured for the given token
 */
function createServer(token: string) {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = new ShortcutClient(token);

  // Single tool with action dispatch
  server.tool("shortcut", ShortcutParams.shape, async (args) => {
    const params = ShortcutParams.parse(args);
    return handleAction(params, client);
  });

  return server;
}

/**
 * Health endpoint response
 */
function healthResponse(): Response {
  return new Response(
    JSON.stringify({
      status: "healthy",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      description: "StreamShortcut MCP - Lightweight Shortcut integration",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
      },
      tool: {
        name: "shortcut",
        actions: ["search", "get", "update", "comment", "create", "epic", "api", "help"],
      },
      documentation: "https://github.com/stayce/streamshortcut-cloudflare",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * Main Cloudflare Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return healthResponse();
    }

    // MCP endpoint - streamable HTTP transport
    if (url.pathname === "/mcp") {
      // Require user's Shortcut API token via header
      const token = request.headers.get("X-Shortcut-Token");

      if (!token) {
        return new Response(
          JSON.stringify({
            error: "Missing X-Shortcut-Token header",
            message: "You must provide your own Shortcut API token. Get one at: https://app.shortcut.com/settings/account/api-tokens",
            example: {
              mcpServers: {
                shortcut: {
                  type: "http",
                  url: "https://streamshortcut.staycek.workers.dev/mcp",
                  headers: {
                    "X-Shortcut-Token": "your-token-here"
                  }
                }
              }
            }
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const server = createServer(token);
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
