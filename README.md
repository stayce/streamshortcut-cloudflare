# StreamShortcut (Cloudflare Workers)

A lightweight Shortcut MCP deployed on Cloudflare Workers. One tool, eight actions.

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
| `epic` | Get epic with its stories |
| `api` | Raw REST API |
| `help` | Documentation |

## Usage with Claude

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "shortcut": {
      "type": "url",
      "url": "https://streamshortcut.staycek.workers.dev/mcp"
    }
  }
}
```

Note: This requires the SHORTCUT_API_TOKEN to be set on the server. For personal use, deploy your own instance.

## Deploy Your Own

1. Clone and install:
   ```bash
   git clone https://github.com/stayce/streamshortcut-cloudflare
   cd streamshortcut-cloudflare
   npm install
   ```

2. Set your Shortcut API token:
   ```bash
   wrangler secret put SHORTCUT_API_TOKEN
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## Examples

```json
{"action": "search"}
{"action": "get", "id": "704"}
{"action": "update", "id": "704", "state": "Done"}
{"action": "comment", "id": "704", "body": "Fixed!"}
{"action": "create", "name": "New bug", "type": "bug"}
{"action": "epic", "id": "308"}
{"action": "api", "method": "GET", "path": "/workflows"}
{"action": "help"}
```

## Related

- [streamshortcut](https://github.com/stayce/streamshortcut) - Original stdio version for local use

## License

MIT
