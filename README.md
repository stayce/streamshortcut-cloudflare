# StreamShortcut (Cloudflare Workers)

A lightweight Shortcut MCP deployed on Cloudflare Workers. One tool, ten actions.

**Live URL:** `https://streamshortcut.staycek.workers.dev/mcp`

## Why?

The official `@shortcut/mcp` uses ~11,652 tokens for tool definitions (52 tools).
StreamShortcut uses ~393 tokens — a **96.6% reduction**.

## Actions

| Action | Purpose |
|--------|---------|
| `search` | Find stories (default: your active stories) |
| `get` | Story details by ID or URL |
| `update` | Change state, estimate, owner |
| `comment` | Add comment to story |
| `create` | Create new story |
| `stories` | List stories with filters |
| `workflows` | List workflows and states |
| `members` | List team members |
| `projects` | List projects |
| `api` | Raw REST API |
| `help` | Documentation |

## Usage with Claude

**You must provide your own Shortcut API token.** Get one at: https://app.shortcut.com/settings/account/api-tokens

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "shortcut": {
      "type": "http",
      "url": "https://streamshortcut.staycek.workers.dev/mcp",
      "headers": {
        "X-Shortcut-Token": "your-token-here"
      }
    }
  }
}
```

Or set the `SHORTCUT_API_TOKEN` environment variable and use:

```json
{
  "mcpServers": {
    "shortcut": {
      "type": "http",
      "url": "https://streamshortcut.staycek.workers.dev/mcp",
      "headers": {
        "X-Shortcut-Token": "${SHORTCUT_API_TOKEN}"
      }
    }
  }
}
```

## Deploy Your Own (Optional)

If you prefer to self-host:

1. Clone and install:
   ```bash
   git clone https://github.com/stayce/streamshortcut-cloudflare
   cd streamshortcut-cloudflare
   npm install
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

No server-side secrets needed — users always provide their own token.

## Examples

```json
{"action": "search"}
{"action": "get", "id": "704"}
{"action": "update", "id": "704", "state": "Done"}
{"action": "comment", "id": "704", "body": "Fixed!"}
{"action": "create", "name": "New bug", "type": "bug"}
{"action": "workflows"}
{"action": "members"}
{"action": "api", "method": "GET", "path": "/projects"}
{"action": "help"}
```

## Related

- [streamshortcut](https://github.com/stayce/streamshortcut) - Original stdio version for local use

## License

MIT
