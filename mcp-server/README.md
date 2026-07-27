# Notaion MCP Server

Exposes your Notaion **Daily Notes** to Claude Code as MCP tools:
`list_daily_notes`, `search_daily_notes`, `create_daily_note`,
`append_to_daily_note`, `update_daily_note`, `delete_daily_note`.

## Requirements
- Node 18+
- A Notaion account (email + password)

## Install
```bash
cd mcp-server
npm install
```

## Configure

Environment variables:
- `NOTAION_EMAIL` (required)
- `NOTAION_PASSWORD` (required)
- `NOTAION_API_URL` (optional, default `https://notaion.runasp.net`)

## Register with Claude Code

Option A — CLI:
```bash
claude mcp add notaion \
  --env NOTAION_EMAIL=you@example.com \
  --env NOTAION_PASSWORD=yourpassword \
  -- node /ABSOLUTE/PATH/notaion/mcp-server/src/index.js
```

Option B — `.mcp.json` at the repo root:
```json
{
  "mcpServers": {
    "notaion": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/notaion/mcp-server/src/index.js"],
      "env": {
        "NOTAION_EMAIL": "you@example.com",
        "NOTAION_PASSWORD": "yourpassword"
      }
    }
  }
}
```

Restart Claude Code, then try: "list my daily notes for today".

## Test
```bash
npm test
```
