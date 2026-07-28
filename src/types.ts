/**
 * StreamShortcut MCP Server - Type Definitions
 */

import { z } from "zod";

// Server metadata
export const SERVER_NAME = "streamshortcut";
export const SERVER_VERSION = "1.2.0";

// Environment interface for Cloudflare Workers
// Note: SHORTCUT_API_TOKEN is provided by user via X-Shortcut-Token header
export interface Env {
  // No server-side secrets - users provide their own token
}

// MCP Tool result type (index signature required by the SDK's CallToolResult)
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// Shortcut API types
export interface ShortcutMember {
  id: string;
  profile: {
    name: string;
    mention_name: string;
    email_address?: string;
  };
  role: string;
}

export interface ShortcutWorkflowState {
  id: number;
  name: string;
  type: "unstarted" | "started" | "done";
  position: number;
}

export interface ShortcutWorkflow {
  id: number;
  name: string;
  states: ShortcutWorkflowState[];
}

export interface ShortcutLabel {
  id: number;
  name: string;
  color: string;
}

export interface ShortcutStory {
  id: number;
  name: string;
  story_type: "feature" | "bug" | "chore";
  workflow_state_id: number;
  estimate?: number;
  epic_id?: number;
  iteration_id?: number;
  owner_ids: string[];
  labels: ShortcutLabel[];
  description?: string;
  app_url: string;
  started: boolean;
  completed: boolean;
  comments?: ShortcutComment[];
}

export interface ShortcutComment {
  id: number;
  text: string;
  author_id: string;
  created_at: string;
}

export interface ShortcutEpic {
  id: number;
  name: string;
  state: string;
  app_url: string;
  stats?: {
    num_stories_total: number;
    num_stories_done: number;
    num_stories_started: number;
    num_stories_unstarted: number;
  };
}

export interface ShortcutSearchResponse {
  data?: ShortcutStory[];
  total?: number;
}

// Shortcut action schema - single tool with action dispatch
export const ShortcutParams = z.object({
  action: z.enum(["search", "get", "update", "comment", "create", "epic", "api", "help"])
    .describe("Operation to perform"),
  query: z.union([z.string(), z.record(z.unknown())]).optional()
    .describe("search: free-text string, or a filter object {owner, state, epic, iteration, type, archived}"),
  id: z.string().optional()
    .describe("Story or epic ID (e.g. '704', 'sc-704', or a Shortcut URL). Required for get/update/comment/epic"),
  state: z.string().optional()
    .describe("Workflow state name (e.g. 'Ready', 'In Progress', 'Done'), resolved to workflow_state_id. Used by create/update"),
  estimate: z.number().optional()
    .describe("Point estimate for the story. Used by create/update"),
  owner: z.string().nullable().optional()
    .describe("Owner name, mention name, or 'me'; pass null to unassign. Used by create/update"),
  type: z.enum(["feature", "bug", "chore"]).optional()
    .describe("Story type. Used by create/update"),
  name: z.string().optional()
    .describe("Story title. Required for create; optional rename for update"),
  description: z.string().optional()
    .describe("Story description (Markdown). Used by create/update"),
  body: z.string().optional()
    .describe("Comment text. Required for comment"),
  epic: z.number().optional()
    .describe("Epic ID to attach the story to. Used by create"),
  method: z.string().optional()
    .describe("HTTP method for the api action (GET, POST, PUT, DELETE)"),
  path: z.string().optional()
    .describe("REST API path for the api action, e.g. '/workflows'"),
});

export type ShortcutParamsType = z.infer<typeof ShortcutParams>;
