# MCP Server Guide

How to configure and extend MCP (Model Context Protocol) servers for claude-harness.

## What is MCP?

MCP servers give Claude direct access to external tools and data sources — databases, browsers, APIs, and more. Instead of writing shell commands, Claude calls MCP tools natively.

## Included Servers

### Playwright (Browser Automation)

Used by the QA and test-writer agents for E2E testing.

```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

**No configuration needed.** Works out of the box.

### PostgreSQL (Database Access)

Used by the database agent for schema inspection, queries, and migrations.

```json
"postgres": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres"],
  "env": {
    "DATABASE_URL": "${DATABASE_URL}"
  }
}
```

**Setup:**
```bash
# Add to .env (never commit this file)
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Or use env-manager
./harness/env-manager.sh init
```

### GitHub (API Access)

Used by the DevOps agent and CI workflows for issues, PRs, and repo management.

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

**Setup:**
```bash
# Create a token: GitHub → Settings → Developer settings → Personal access tokens
# Scopes needed: repo, read:org

# Add to .env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

## Auto-Recommendation

The MCP selector analyzes your project and recommends servers:

```bash
./mcp/mcp-selector.sh              # Current directory
./mcp/mcp-selector.sh /path/to/app # Specific project
```

Output shows which servers are active vs. recommended.

## Adding Custom MCP Servers

Edit `mcp.json` to add servers:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@scope/mcp-server-name"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      },
      "description": "What this server provides"
    }
  }
}
```

### Available Community Servers

| Server | Package | Use Case |
|--------|---------|----------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Enhanced file operations |
| Brave Search | `@modelcontextprotocol/server-brave-search` | Web search integration |
| Slack | `@modelcontextprotocol/server-slack` | Team notifications |
| Google Drive | `@modelcontextprotocol/server-gdrive` | Document access |
| SQLite | `@modelcontextprotocol/server-sqlite` | SQLite database access |

## Environment Variables

All MCP server secrets use `${VAR_NAME}` syntax in `mcp.json`, which resolves from:

1. Shell environment variables
2. `.env` file in project root
3. GitHub Secrets (in CI context)

**Never hardcode secrets in `mcp.json`.** Use environment variable references.

## Troubleshooting

### Server fails to start
```bash
# Check if npx can find the package
npx -y @playwright/mcp@latest --help

# Check environment variables
./harness/env-manager.sh check
```

### Permission denied
MCP servers run with the same permissions as your Claude Code session. Ensure:
- Database is accessible from localhost
- GitHub token has required scopes
- File paths are within allowed directories

### Server not recognized
Restart Claude Code after editing `mcp.json`. MCP configuration is loaded at session start.
