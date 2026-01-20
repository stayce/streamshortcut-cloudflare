/**
 * StreamShortcut MCP Server - Cloudflare Workers
 *
 * A lightweight Shortcut MCP. One tool, eight actions.
 * Based on https://github.com/stayce/streamshortcut
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SHORTCUT_API = "https://api.app.shortcut.com/api/v3";

export interface Env {
  SHORTCUT_API_TOKEN: string;
}

const SERVER_NAME = "streamshortcut";
const SERVER_VERSION = "1.0.0";

// REST API helper
async function api(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${SHORTCUT_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Shortcut-Token": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 429) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ID resolution
function resolveId(input: string): number {
  const urlMatch = input.match(/shortcut\.com\/[^/]+\/story\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  const epicUrlMatch = input.match(/shortcut\.com\/[^/]+\/epic\/(\d+)/i);
  if (epicUrlMatch) return parseInt(epicUrlMatch[1], 10);

  const numMatch = input.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  throw new Error(`Invalid ID: ${input}`);
}

// Get workflows
async function getWorkflows(token: string): Promise<Array<Record<string, unknown>>> {
  return (await api(token, "GET", "/workflows")) as Array<Record<string, unknown>>;
}

// Get members
async function getMembers(token: string): Promise<Array<Record<string, unknown>>> {
  return (await api(token, "GET", "/members")) as Array<Record<string, unknown>>;
}

// Get current member
async function getCurrentMember(token: string): Promise<Record<string, unknown>> {
  return (await api(token, "GET", "/member")) as Record<string, unknown>;
}

// Get state name
async function getStateName(token: string, stateId: number): Promise<string> {
  const workflows = await getWorkflows(token);
  for (const wf of workflows) {
    const states = (wf.states as Array<Record<string, unknown>> | undefined) || [];
    const state = states.find((s) => s.id === stateId);
    if (state) return state.name as string;
  }
  return String(stateId);
}

// Resolve state name to ID
async function resolveState(token: string, stateName: string): Promise<number | null> {
  const workflows = await getWorkflows(token);
  const lower = stateName.toLowerCase();

  for (const wf of workflows) {
    const states = (wf.states as Array<Record<string, unknown>> | undefined) || [];

    let match = states.find((s) => (s.name as string)?.toLowerCase() === lower);
    if (match) return match.id as number;

    match = states.find((s) => (s.name as string)?.toLowerCase().includes(lower));
    if (match) return match.id as number;
  }

  const aliases: Record<string, string[]> = {
    done: ["done", "complete", "completed", "finished", "deployed"],
    "in progress": ["in progress", "started", "doing", "wip", "in prog"],
    ready: ["ready", "todo", "to do", "backlog", "open"],
  };

  for (const [canonical, alts] of Object.entries(aliases)) {
    if (alts.some((a) => lower.includes(a) || a.includes(lower))) {
      for (const wf of workflows) {
        const states = (wf.states as Array<Record<string, unknown>> | undefined) || [];
        const match = states.find((s) => (s.name as string)?.toLowerCase().includes(canonical));
        if (match) return match.id as number;
      }
    }
  }

  return null;
}

// Resolve member
async function resolveMember(token: string, input: string): Promise<string | null> {
  if (input === "me") {
    const member = await getCurrentMember(token);
    return member.id as string;
  }

  const members = await getMembers(token);
  const lower = input.toLowerCase();

  const match = members.find((m) => {
    const profile = m.profile as Record<string, unknown> | null;
    if (!profile) return false;
    const name = String(profile.name || "").toLowerCase();
    const mention = String(profile.mention_name || "").toLowerCase();
    return name.includes(lower) || mention.includes(lower);
  });

  return match ? (match.id as string) : null;
}

// Format story
function formatStory(story: Record<string, unknown>, stateName?: string): string {
  const labels = ((story.labels as Array<{ name: string }> | undefined) || [])
    .map((l) => l.name)
    .join(", ");

  const lines = [
    `**sc-${story.id}**: ${story.name || "Untitled"}`,
    `Type: ${story.story_type || "?"} | State: ${stateName || story.workflow_state_id || "?"} | Est: ${story.estimate ?? "?"}pts`,
    `Epic: ${story.epic_id || "none"} | Iteration: ${story.iteration_id || "none"}`,
  ];

  if (labels) lines.push(`Labels: ${labels}`);
  if (story.app_url) lines.push(`Link: ${story.app_url}`);
  if (story.description) lines.push("", String(story.description));

  return lines.join("\n");
}

// Format story list
function formatStoryList(stories: Array<Record<string, unknown>>): string {
  if (!stories || stories.length === 0) return "No stories found.";

  return stories
    .map((s) => {
      const state = s.completed ? "done" : s.started ? "started" : "unstarted";
      return `- **sc-${s.id}** [${state}] ${s.name || "Untitled"} (${s.story_type || "?"}, ${s.estimate ?? "?"}pts)`;
    })
    .join("\n");
}

// Normalize search response
function normalizeSearchResponse(response: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && "data" in response) {
    const data = (response as { data: unknown }).data;
    if (Array.isArray(data)) return data;
  }
  return [];
}

// Action handlers
async function handleSearch(token: string, query?: string | Record<string, unknown>): Promise<string> {
  let searchParams: Record<string, unknown> = {};

  if (!query) {
    const member = await getCurrentMember(token);
    searchParams = { owner_ids: [member.id], archived: false };
  } else if (typeof query === "string") {
    searchParams = { query };
  } else {
    if (query.owner === "me") {
      const member = await getCurrentMember(token);
      searchParams.owner_ids = [member.id];
    } else if (query.owner) {
      const memberId = await resolveMember(token, query.owner as string);
      if (memberId) searchParams.owner_ids = [memberId];
    }
    if (query.state) {
      const stateId = await resolveState(token, query.state as string);
      if (stateId) searchParams.workflow_state_id = stateId;
    }
    if (query.epic) searchParams.epic_ids = [query.epic];
    if (query.iteration) searchParams.iteration_ids = [query.iteration];
    if (query.type) searchParams.story_type = query.type;
    if (query.archived !== undefined) searchParams.archived = query.archived;
  }

  const response = await api(token, "POST", "/stories/search", searchParams);
  return formatStoryList(normalizeSearchResponse(response));
}

async function handleGet(token: string, id: string): Promise<string> {
  const storyId = resolveId(id);
  const story = (await api(token, "GET", `/stories/${storyId}`)) as Record<string, unknown>;
  if (!story) return `Story sc-${storyId} not found`;

  const stateName = await getStateName(token, story.workflow_state_id as number);
  let result = formatStory(story, stateName);

  const comments = story.comments as Array<Record<string, unknown>> | undefined;
  if (comments && comments.length > 0) {
    result += "\n\n## Recent Comments\n";
    result += comments
      .slice(0, 5)
      .map((c) => `**${c.author_id || "Unknown"}**:\n${c.text || ""}`)
      .join("\n\n");
  }

  return result;
}

async function handleUpdate(
  token: string,
  id: string,
  updates: { state?: string; estimate?: number; owner?: string | null; type?: string; name?: string }
): Promise<string> {
  const storyId = resolveId(id);
  const input: Record<string, unknown> = {};

  if (updates.state) {
    const stateId = await resolveState(token, updates.state);
    if (stateId) {
      input.workflow_state_id = stateId;
    } else {
      const workflows = await getWorkflows(token);
      const allStates = workflows
        .flatMap((wf) => ((wf.states as Array<Record<string, unknown>>) || []).map((s) => s.name))
        .join(", ");
      return `State "${updates.state}" not found. Valid: ${allStates}`;
    }
  }

  if (updates.estimate !== undefined) input.estimate = updates.estimate;
  if (updates.name) input.name = updates.name;
  if (updates.type) input.story_type = updates.type;

  if (updates.owner !== undefined) {
    if (updates.owner === null) {
      input.owner_ids = [];
    } else {
      const memberId = await resolveMember(token, updates.owner);
      if (memberId) input.owner_ids = [memberId];
      else return `Could not find member "${updates.owner}"`;
    }
  }

  if (Object.keys(input).length === 0) return "No updates provided";

  const story = (await api(token, "PUT", `/stories/${storyId}`, input)) as Record<string, unknown>;
  return `Updated sc-${story.id}: ${story.app_url}`;
}

async function handleComment(token: string, id: string, body: string): Promise<string> {
  const storyId = resolveId(id);
  await api(token, "POST", `/stories/${storyId}/comments`, { text: body });
  return `Added comment to sc-${storyId}`;
}

async function handleCreate(
  token: string,
  name: string,
  options: { type?: string; estimate?: number; epic?: number; state?: string; owner?: string }
): Promise<string> {
  const input: Record<string, unknown> = { name };

  if (options.state) {
    const stateId = await resolveState(token, options.state);
    if (stateId) input.workflow_state_id = stateId;
  } else {
    const workflows = await getWorkflows(token);
    if (workflows.length > 0) {
      const states = (workflows[0].states as Array<Record<string, unknown>>) || [];
      const readyState = states.find((s) => s.type === "unstarted");
      if (readyState) input.workflow_state_id = readyState.id;
    }
  }

  if (options.type) input.story_type = options.type;
  if (options.estimate !== undefined) input.estimate = options.estimate;
  if (options.epic) input.epic_id = options.epic;

  if (options.owner) {
    const memberId = await resolveMember(token, options.owner);
    if (memberId) input.owner_ids = [memberId];
  }

  const story = (await api(token, "POST", "/stories", input)) as Record<string, unknown>;
  return `Created sc-${story.id}: ${story.name}\n${story.app_url}`;
}

async function handleEpic(token: string, id: string): Promise<string> {
  const epicId = resolveId(id);
  const epic = (await api(token, "GET", `/epics/${epicId}`)) as Record<string, unknown>;
  if (!epic) return `Epic ${epicId} not found`;

  const stats = epic.stats as Record<string, number> | undefined;
  let result = `**Epic ${epic.id}**: ${epic.name || "Untitled"}
State: ${epic.state || "?"} | Stories: ${stats?.num_stories_total || 0} (${stats?.num_stories_done || 0} done)
Link: ${epic.app_url || "N/A"}`;

  const response = await api(token, "POST", "/stories/search", { epic_ids: [epicId] });
  const stories = normalizeSearchResponse(response);

  if (stories.length > 0) {
    result += "\n\n## Stories\n" + formatStoryList(stories.slice(0, 25));
  }

  return result;
}

async function handleApi(token: string, method: string, path: string, body?: Record<string, unknown>): Promise<string> {
  if (!path.startsWith("/")) throw new Error("Path must start with /");
  const result = await api(token, method.toUpperCase(), path, body);
  return JSON.stringify(result, null, 2);
}

function handleHelp(): string {
  return `# StreamShortcut

## Actions

**search** - Find stories
  {"action": "search"} → your active stories
  {"action": "search", "query": "auth bug"} → text search

**get** - Story details
  {"action": "get", "id": "704"}

**update** - Change state, estimate, owner
  {"action": "update", "id": "704", "state": "Done"}

**comment** - Add comment
  {"action": "comment", "id": "704", "body": "Fixed!"}

**create** - Create story
  {"action": "create", "name": "Bug title", "type": "bug"}

**epic** - Get epic with stories
  {"action": "epic", "id": "308"}

**api** - Raw REST API
  {"action": "api", "method": "GET", "path": "/workflows"}

**help** - This documentation`;
}

// Tool schema
const ShortcutParams = z.object({
  action: z.enum(["search", "get", "update", "comment", "create", "epic", "api", "help"]),
  query: z.union([z.string(), z.record(z.unknown())]).optional(),
  id: z.string().optional(),
  state: z.string().optional(),
  estimate: z.number().optional(),
  owner: z.string().nullable().optional(),
  type: z.enum(["feature", "bug", "chore"]).optional(),
  name: z.string().optional(),
  body: z.string().optional(),
  epic: z.number().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
});

// Create server
function createServer(env: Env) {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const token = env.SHORTCUT_API_TOKEN;

  server.tool(
    "shortcut",
    ShortcutParams.shape,
    async (args) => {
      if (!token) {
        return { content: [{ type: "text" as const, text: "Error: SHORTCUT_API_TOKEN not configured" }], isError: true };
      }

      const params = ShortcutParams.parse(args);

      try {
        let result: string;

        switch (params.action) {
          case "search":
            result = await handleSearch(token, params.query);
            break;
          case "get":
            if (!params.id) throw new Error("id required");
            result = await handleGet(token, params.id);
            break;
          case "update":
            if (!params.id) throw new Error("id required");
            result = await handleUpdate(token, params.id, {
              state: params.state,
              estimate: params.estimate,
              owner: params.owner,
              type: params.type,
              name: params.name,
            });
            break;
          case "comment":
            if (!params.id || !params.body) throw new Error("id and body required");
            result = await handleComment(token, params.id, params.body);
            break;
          case "create":
            if (!params.name) throw new Error("name required");
            result = await handleCreate(token, params.name, {
              type: params.type,
              estimate: params.estimate,
              epic: params.epic,
              state: params.state,
              owner: params.owner,
            });
            break;
          case "epic":
            if (!params.id) throw new Error("id required");
            result = await handleEpic(token, params.id);
            break;
          case "api":
            if (!params.method || !params.path) throw new Error("method and path required");
            result = await handleApi(token, params.method, params.path, params.query as Record<string, unknown>);
            break;
          case "help":
            result = handleHelp();
            break;
          default:
            throw new Error(`Unknown action: ${params.action}`);
        }

        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          server: SERVER_NAME,
          version: SERVER_VERSION,
          description: "StreamShortcut MCP - Lightweight Shortcut integration",
        }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (url.pathname === "/mcp") {
      const server = createServer(env);
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
