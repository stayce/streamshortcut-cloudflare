/**
 * StreamShortcut MCP Server - Action Handlers
 */

import { ShortcutClient, resolveId } from "./client";
import { ToolResult, ShortcutParamsType } from "./types";
import { formatStory, formatStoryList, formatEpic, formatComments } from "./formatters";

/**
 * Main action dispatcher
 */
export async function handleAction(
  params: ShortcutParamsType,
  client: ShortcutClient
): Promise<ToolResult> {
  try {
    let result: string;

    switch (params.action) {
      case "search":
        result = await handleSearch(client, params.query);
        break;

      case "get":
        if (!params.id) throw new Error("id required");
        result = await handleGet(client, params.id);
        break;

      case "update":
        if (!params.id) throw new Error("id required");
        result = await handleUpdate(client, params.id, {
          state: params.state,
          estimate: params.estimate,
          owner: params.owner,
          type: params.type,
          name: params.name,
        });
        break;

      case "comment":
        if (!params.id || !params.body) throw new Error("id and body required");
        result = await handleComment(client, params.id, params.body);
        break;

      case "create":
        if (!params.name) throw new Error("name required");
        result = await handleCreate(client, params.name, {
          type: params.type,
          estimate: params.estimate,
          epic: params.epic,
          state: params.state,
          owner: params.owner,
        });
        break;

      case "epic":
        if (!params.id) throw new Error("id required");
        result = await handleEpic(client, params.id);
        break;

      case "api":
        if (!params.method || !params.path) throw new Error("method and path required");
        result = await handleApi(client, params.method, params.path, params.query as Record<string, unknown>);
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

async function handleSearch(
  client: ShortcutClient,
  query?: string | Record<string, unknown>
): Promise<string> {
  let searchParams: Record<string, unknown> = {};

  if (!query) {
    // Default: current user's stories, not archived
    const member = await client.getCurrentMember();
    searchParams = { owner_ids: [member.id], archived: false };
  } else if (typeof query === "string") {
    searchParams = { query };
  } else {
    // Structured query
    if (query.owner === "me") {
      const member = await client.getCurrentMember();
      searchParams.owner_ids = [member.id];
    } else if (query.owner) {
      const memberId = await client.resolveMember(query.owner as string);
      if (memberId) searchParams.owner_ids = [memberId];
    }
    if (query.state) {
      const stateId = await client.resolveState(query.state as string);
      if (stateId) searchParams.workflow_state_id = stateId;
    }
    if (query.epic) searchParams.epic_ids = [query.epic];
    if (query.iteration) searchParams.iteration_ids = [query.iteration];
    if (query.type) searchParams.story_type = query.type;
    if (query.archived !== undefined) searchParams.archived = query.archived;
  }

  const stories = await client.searchStories(searchParams);
  return formatStoryList(stories);
}

async function handleGet(client: ShortcutClient, id: string): Promise<string> {
  const storyId = resolveId(id);
  const story = await client.getStory(storyId);
  if (!story) return `Story sc-${storyId} not found`;

  const stateName = await client.getStateName(story.workflow_state_id);
  let result = formatStory(story, stateName);
  result += formatComments(story.comments);

  return result;
}

async function handleUpdate(
  client: ShortcutClient,
  id: string,
  updates: {
    state?: string;
    estimate?: number;
    owner?: string | null;
    type?: string;
    name?: string;
  }
): Promise<string> {
  const storyId = resolveId(id);
  const input: Record<string, unknown> = {};

  if (updates.state) {
    const stateId = await client.resolveState(updates.state);
    if (stateId) {
      input.workflow_state_id = stateId;
    } else {
      const allStates = await client.getAllStateNames();
      return `State "${updates.state}" not found. Valid: ${allStates.join(", ")}`;
    }
  }

  if (updates.estimate !== undefined) input.estimate = updates.estimate;
  if (updates.name) input.name = updates.name;
  if (updates.type) input.story_type = updates.type;

  if (updates.owner !== undefined) {
    if (updates.owner === null) {
      input.owner_ids = [];
    } else {
      const memberId = await client.resolveMember(updates.owner);
      if (memberId) input.owner_ids = [memberId];
      else return `Could not find member "${updates.owner}"`;
    }
  }

  if (Object.keys(input).length === 0) return "No updates provided";

  const story = await client.updateStory(storyId, input);
  return `Updated sc-${story.id}: ${story.app_url}`;
}

async function handleComment(
  client: ShortcutClient,
  id: string,
  body: string
): Promise<string> {
  const storyId = resolveId(id);
  await client.addComment(storyId, body);
  return `Added comment to sc-${storyId}`;
}

async function handleCreate(
  client: ShortcutClient,
  name: string,
  options: {
    type?: string;
    estimate?: number;
    epic?: number;
    state?: string;
    owner?: string;
  }
): Promise<string> {
  const input: Record<string, unknown> = { name };

  if (options.state) {
    const stateId = await client.resolveState(options.state);
    if (stateId) input.workflow_state_id = stateId;
  } else {
    // Default to first unstarted state
    const workflows = await client.getWorkflows();
    if (workflows.length > 0) {
      const readyState = workflows[0].states.find((s) => s.type === "unstarted");
      if (readyState) input.workflow_state_id = readyState.id;
    }
  }

  if (options.type) input.story_type = options.type;
  if (options.estimate !== undefined) input.estimate = options.estimate;
  if (options.epic) input.epic_id = options.epic;

  if (options.owner) {
    const memberId = await client.resolveMember(options.owner);
    if (memberId) input.owner_ids = [memberId];
  }

  const story = await client.createStory(input);
  return `Created sc-${story.id}: ${story.name}\n${story.app_url}`;
}

async function handleEpic(client: ShortcutClient, id: string): Promise<string> {
  const epicId = resolveId(id);
  const epic = await client.getEpic(epicId);
  if (!epic) return `Epic ${epicId} not found`;

  let result = formatEpic(epic);

  const stories = await client.searchStories({ epic_ids: [epicId] });
  if (stories.length > 0) {
    result += "\n\n## Stories\n" + formatStoryList(stories.slice(0, 25));
  }

  return result;
}

async function handleApi(
  client: ShortcutClient,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<string> {
  if (!path.startsWith("/")) throw new Error("Path must start with /");
  const result = await client.request(method.toUpperCase(), path, body);
  return JSON.stringify(result, null, 2);
}

function handleHelp(): string {
  return `# StreamShortcut

## Actions

**search** - Find stories
  {"action": "search"} -> your active stories
  {"action": "search", "query": "auth bug"} -> text search

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
