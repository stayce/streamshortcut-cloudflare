# StreamShortcut (Cloudflare Workers)

A lightweight Shortcut MCP deployed on Cloudflare Workers. One tool, eight actions.

**Live URL:** `https://streamshortcut.staycek.workers.dev/mcp`

## Why?

The official `@shortcut/mcp` uses ~11,652 tokens for tool definitions (52 tools).
StreamShortcut uses ~500 tokens — a **~96% reduction**.

## Actions

| Action | Purpose |
|--------|---------|
| `search` | Find stories (default: your active stories); text query or structured filters |
| `get` | Story details by ID or URL |
| `update` | Change state, estimate, owner, type, or name |
| `comment` | Add comment to story |
| `create` | Create story with type, estimate, state, epic, owner |
| `epic` | Epic details with its stories |
| `api` | Raw REST API access for everything else |
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

## Development

```bash
npm run dev        # local server on http://localhost:8787
npm run typecheck  # tsc --noEmit
npm run build      # verify the Worker bundles (dry-run deploy)
```

## Examples

```json
{"action": "search"}
{"action": "search", "query": {"owner": "me", "state": "In Progress"}}
{"action": "get", "id": "704"}
{"action": "update", "id": "704", "state": "Done"}
{"action": "comment", "id": "704", "body": "Fixed!"}
{"action": "create", "name": "New bug", "type": "bug", "estimate": 3, "state": "Ready", "owner": "me"}
{"action": "epic", "id": "308"}
{"action": "api", "method": "GET", "path": "/workflows"}
{"action": "help"}
```

## Related

- [streamshortcut](https://github.com/stayce/streamshortcut) - Original stdio version for local use

## License

MIT
