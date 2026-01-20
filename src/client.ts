/**
 * StreamShortcut MCP Server - Shortcut API Client
 */

import {
  ShortcutMember,
  ShortcutWorkflow,
  ShortcutStory,
  ShortcutEpic,
  ShortcutSearchResponse,
} from "./types";

const SHORTCUT_API = "https://api.app.shortcut.com/api/v3";

export class ShortcutClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Make an API request to Shortcut
   */
  async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${SHORTCUT_API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Shortcut-Token": this.token,
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
    if (!text) return null as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // Workflow methods
  async getWorkflows(): Promise<ShortcutWorkflow[]> {
    return this.request<ShortcutWorkflow[]>("GET", "/workflows");
  }

  async resolveState(stateName: string): Promise<number | null> {
    const workflows = await this.getWorkflows();
    const lower = stateName.toLowerCase();

    for (const wf of workflows) {
      // Exact match
      let match = wf.states.find((s) => s.name.toLowerCase() === lower);
      if (match) return match.id;

      // Partial match
      match = wf.states.find((s) => s.name.toLowerCase().includes(lower));
      if (match) return match.id;
    }

    // Alias matching
    const aliases: Record<string, string[]> = {
      done: ["done", "complete", "completed", "finished", "deployed"],
      "in progress": ["in progress", "started", "doing", "wip", "in prog"],
      ready: ["ready", "todo", "to do", "backlog", "open"],
    };

    for (const [canonical, alts] of Object.entries(aliases)) {
      if (alts.some((a) => lower.includes(a) || a.includes(lower))) {
        for (const wf of workflows) {
          const match = wf.states.find((s) =>
            s.name.toLowerCase().includes(canonical)
          );
          if (match) return match.id;
        }
      }
    }

    return null;
  }

  async getStateName(stateId: number): Promise<string> {
    const workflows = await this.getWorkflows();
    for (const wf of workflows) {
      const state = wf.states.find((s) => s.id === stateId);
      if (state) return state.name;
    }
    return String(stateId);
  }

  async getAllStateNames(): Promise<string[]> {
    const workflows = await this.getWorkflows();
    return workflows.flatMap((wf) => wf.states.map((s) => s.name));
  }

  // Member methods
  async getMembers(): Promise<ShortcutMember[]> {
    return this.request<ShortcutMember[]>("GET", "/members");
  }

  async getCurrentMember(): Promise<ShortcutMember> {
    return this.request<ShortcutMember>("GET", "/member");
  }

  async resolveMember(input: string): Promise<string | null> {
    if (input === "me") {
      const member = await this.getCurrentMember();
      return member.id;
    }

    const members = await this.getMembers();
    const lower = input.toLowerCase();

    const match = members.find((m) => {
      const name = m.profile.name.toLowerCase();
      const mention = m.profile.mention_name.toLowerCase();
      return name.includes(lower) || mention.includes(lower);
    });

    return match ? match.id : null;
  }

  // Story methods
  async getStory(id: number): Promise<ShortcutStory> {
    return this.request<ShortcutStory>("GET", `/stories/${id}`);
  }

  async createStory(data: Record<string, unknown>): Promise<ShortcutStory> {
    return this.request<ShortcutStory>("POST", "/stories", data);
  }

  async updateStory(
    id: number,
    data: Record<string, unknown>
  ): Promise<ShortcutStory> {
    return this.request<ShortcutStory>("PUT", `/stories/${id}`, data);
  }

  async searchStories(
    params: Record<string, unknown>
  ): Promise<ShortcutStory[]> {
    const response = await this.request<ShortcutSearchResponse | ShortcutStory[]>(
      "POST",
      "/stories/search",
      params
    );

    // Normalize response format
    if (Array.isArray(response)) return response;
    if (response && "data" in response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  async addComment(storyId: number, text: string): Promise<void> {
    await this.request("POST", `/stories/${storyId}/comments`, { text });
  }

  // Epic methods
  async getEpic(id: number): Promise<ShortcutEpic> {
    return this.request<ShortcutEpic>("GET", `/epics/${id}`);
  }
}

/**
 * Resolve ID from various formats (704, sc-704, URL)
 */
export function resolveId(input: string): number {
  // Story URL
  const urlMatch = input.match(/shortcut\.com\/[^/]+\/story\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  // Epic URL
  const epicUrlMatch = input.match(/shortcut\.com\/[^/]+\/epic\/(\d+)/i);
  if (epicUrlMatch) return parseInt(epicUrlMatch[1], 10);

  // Numeric ID (possibly with sc- prefix)
  const numMatch = input.match(/(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);

  throw new Error(`Invalid ID: ${input}`);
}
