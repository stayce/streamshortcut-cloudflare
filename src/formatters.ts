/**
 * StreamShortcut MCP Server - Output Formatters
 */

import { ShortcutStory, ShortcutEpic } from "./types";

/**
 * Format a single story for detailed display
 */
export function formatStory(story: ShortcutStory, stateName?: string): string {
  const labels = story.labels.map((l) => l.name).join(", ");

  const lines = [
    `**sc-${story.id}**: ${story.name || "Untitled"}`,
    `Type: ${story.story_type || "?"} | State: ${stateName || story.workflow_state_id || "?"} | Est: ${story.estimate ?? "?"}pts`,
    `Epic: ${story.epic_id || "none"} | Iteration: ${story.iteration_id || "none"}`,
  ];

  if (labels) lines.push(`Labels: ${labels}`);
  if (story.app_url) lines.push(`Link: ${story.app_url}`);
  if (story.description) lines.push("", story.description);

  return lines.join("\n");
}

/**
 * Format a list of stories
 */
export function formatStoryList(stories: ShortcutStory[]): string {
  if (!stories || stories.length === 0) return "No stories found.";

  return stories
    .map((s) => {
      const state = s.completed ? "done" : s.started ? "started" : "unstarted";
      return `- **sc-${s.id}** [${state}] ${s.name || "Untitled"} (${s.story_type || "?"}, ${s.estimate ?? "?"}pts)`;
    })
    .join("\n");
}

/**
 * Format an epic for display
 */
export function formatEpic(epic: ShortcutEpic): string {
  const stats = epic.stats;
  return `**Epic ${epic.id}**: ${epic.name || "Untitled"}
State: ${epic.state || "?"} | Stories: ${stats?.num_stories_total || 0} (${stats?.num_stories_done || 0} done)
Link: ${epic.app_url || "N/A"}`;
}

/**
 * Format comments on a story
 */
export function formatComments(
  comments: Array<{ author_id: string; text: string }> | undefined
): string {
  if (!comments || comments.length === 0) return "";

  return (
    "\n\n## Recent Comments\n" +
    comments
      .slice(0, 5)
      .map((c) => `**${c.author_id || "Unknown"}**:\n${c.text || ""}`)
      .join("\n\n")
  );
}
