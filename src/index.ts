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
 * Create MCP server with single tool configured for the given environment
 */
function createServer(env: Env) {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = new ShortcutClient(env.SHORTCUT_API_TOKEN);

  // Single tool with action dispatch
  server.tool("shortcut", ShortcutParams.shape, async (args) => {
    if (!env.SHORTCUT_API_TOKEN) {
      return {
        content: [{ type: "text" as const, text: "Error: SHORTCUT_API_TOKEN not configured" }],
        isError: true,
      };
    }

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
      const server = createServer(env);
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
