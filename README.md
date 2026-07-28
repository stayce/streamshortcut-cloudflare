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
| `update` | Change state, estimate, owner, type, name, or description |
| `comment` | Add comment to story |
| `create` | Create story with type, estimate, state, epic, owner, description |
| `epic` | Epic details with its stories |
| `api` | Raw REST API access for everything else |
| `help` | Documentation |

## Usage with Claude

**You must provide your own Shortcut API token.** Get one at: https://app.shortcut.com/settings/account/api-tokens

### Option 1: `claude mcp add` (recommended)

One command, no file editing. Replace `YOUR_TOKEN` with your real token:

```bash
claude mcp add --transport http shortcut https://streamshortcut.staycek.workers.dev/mcp --header "X-Shortcut-Token: YOUR_TOKEN"
```

Use `-s user` to make it available in every project instead of just the current one.

### Option 2: Edit the config directly

Add this to your Claude Desktop / Claude Code config:

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

> **Put the literal token in the config.** A `"${SHORTCUT_API_TOKEN}"` reference only
> resolves if the variable is present in the environment the app was *launched* from.
> On macOS, apps started from the Dock or Finder do **not** read `~/.zshrc`, so the
> variable will be undefined and the server will fail to authenticate. Environment
> references work reliably only when you launch from a terminal.

Either way, **restart Claude** afterwards so the new server is picked up.

## Verify It Works

Check the service is up (no token needed):

```bash
curl -s https://streamshortcut.staycek.workers.dev/health
```

Confirm your token is valid, straight against Shortcut:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.app.shortcut.com/api/v3/member -H "Shortcut-Token: YOUR_TOKEN"
```

`200` means the token is good; `401` means it's wrong or expired.

Then test the full path — this returns your active stories:

```bash
curl -s https://streamshortcut.staycek.workers.dev/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "X-Shortcut-Token: YOUR_TOKEN" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"shortcut","arguments":{"action":"search"}}}'
```

Once configured in Claude, just ask: *"show me my Shortcut stories."*

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| `401 Missing X-Shortcut-Token header` | No token sent — check the header name is exactly `X-Shortcut-Token` |
| `Error: API error (401): Unauthorized` | Token reached the server but Shortcut rejected it — expired or wrong token, or an unexpanded `${SHORTCUT_API_TOKEN}` placeholder sent literally |
| `403 Forbidden` from the worker | Cloudflare bot protection. Some default HTTP clients (e.g. Python's `urllib`) are blocked by user agent — set a normal `User-Agent` header |
| Server missing after config edit | Claude needs a restart; it only reads MCP config at startup |

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
