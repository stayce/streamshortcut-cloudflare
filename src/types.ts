/**
 * StreamShortcut MCP Server - Type Definitions
 */

import { z } from "zod";

// Server metadata
export const SERVER_NAME = "streamshortcut";
export const SERVER_VERSION = "1.0.0";

// Environment interface for Cloudflare Workers
// Note: SHORTCUT_API_TOKEN is provided by user via X-Shortcut-Token header
export interface Env {
  // No server-side secrets - users provide their own token
}

// MCP Tool result type
export interface ToolResult {
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

export type ShortcutParamsType = z.infer<typeof ShortcutParams>;
