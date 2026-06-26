# tomek-rules-mcp

An MCP server **and** two Claude skills that deliver Tomasz's
([@developertomek](https://www.instagram.com/developertomek/)) advanced, type-safe TypeScript
paradigms straight to AI coding agents. When you work in a TypeScript/React project, Claude
auto-applies his curated idioms; the content is centrally toggleable and stays fresh via a
remote update check.

> Proof-of-concept built to pitch an official collaboration with Tomasz.

## How it fits together

- **`data/rules.json`** — the single source of truth: a JSON registry of paradigms (the user
  pastes Tomek's posts in here), validated with Zod.
- **`rules.config.json`** — a toggle manifest mapping every rule id → `true`/`false`, so you can
  see and curate the full active set in one file.
- **MCP server** (`tomek-rules`) — the live back-end. Exposes tools to fetch and toggle rules,
  a prompt to adopt the style, and a mock remote update check.
- **`tomek-rules` skill** — generated from the active rules; auto-triggers on TS/React work.
- **`tomek-rules-config` skill** — user-triggered; walks you through enabling/disabling rules.

```
data/rules.json ──┐
                  ├──► MCP server (serve) ──► get_tomek_paradigms / list_rules /
rules.config.json ┘        │                 set_rules_enabled / apply-tomek-style
                           └──► sync ──► skills/tomek-rules/SKILL.md + rules/<id>.md
```

## Capabilities

| Type | Name | Purpose |
|------|------|---------|
| Tool | `get_tomek_paradigms(category?, query?)` | Return active paradigms, optionally filtered. Runs the update check. |
| Tool | `list_rules()` | List every rule with its on/off state (drives the config skill). |
| Tool | `set_rules_enabled(ids, enabled)` | Toggle rules and regenerate the apply skill. |
| Prompt | `apply-tomek-style(category?)` | A system-style instruction block to code like Tomek. |

## Prerequisites

- Node.js **≥ 18**
- [Claude Code](https://claude.com/claude-code) (for the `claude mcp add` step / skills)

## Quick start (npx)

```bash
npx tomek-rules-mcp init
```

The interactive installer asks which skills to install (`tomek-rules`, `tomek-rules-config`)
and whether to install them for the current project or globally, seeds your data home
(`~/.tomek-rules`), generates the skill files, and offers to register the MCP server.

Headless / scripted:

```bash
npx tomek-rules-mcp init --all --project --yes
```

## Manual / local-dev setup

```bash
npm install        # installs deps and builds (via the prepare script)
npm run build      # compile TypeScript → dist/
npm run sync       # (re)generate the apply-skill markdown from active rules
```

## Register the MCP server with Claude Code

Published (npx) form:

```bash
claude mcp add tomek-rules -- npx -y tomek-rules-mcp serve
```

Local-dev form (point at your built entry):

```bash
claude mcp add tomek-rules -- node /ABSOLUTE/PATH/to/tomek-rules-mcp/dist/cli.js serve
```

This server speaks the **stdio** transport. All logs go to **stderr** — stdout is reserved for
the JSON-RPC protocol.

## Adding content

Edit `data/rules.json` and add an object to the `rules` array, then run `npm run sync` (or
toggle via the config skill, which re-syncs automatically). Each rule:

| Field | Required | Notes |
|-------|----------|-------|
| `id` | ✅ | Unique kebab-case slug. |
| `category` | ✅ | `generics` \| `guards` \| `react` \| `types` \| `utility`. |
| `title` | ✅ | Short headline. |
| `difficulty` | optional | `beginner` \| `intermediate` \| `advanced`. |
| `explanation` | ✅ | What it is and why it matters. |
| `whenToApply` | ✅ | Instructions for the agent on when/how to use it. |
| `examples` | ✅ (≥1) | Array of `{ label?, language, code }` (e.g. Avoid/Prefer pairs). |
| `tags` | optional | Search keywords. |
| `source` | optional | Link to the original post (attribution). |

The top-level `version` (ISO-8601) is what the update checker compares against the remote.

## Toggling rules

`rules.config.json` is a complete map of rule ids to enabled state:

```json
{
  "rules": {
    "interface-vs-type-architecture": true,
    "assertion-functions-flat-narrowing": false
  }
}
```

Edit it directly, or just ask Claude (with the `tomek-rules-config` skill installed) to
"turn off the React rules" — it calls `list_rules` and `set_rules_enabled` for you. Newly
added rules are auto-listed (defaulting to enabled) so the file always shows the full set.

## Auto-update

The server pins a mock `REMOTE_VERSION`. On startup and on each `get_tomek_paradigms` call it
compares that to your content's `version` and, if the remote is newer, prints a 🔔 notice to
**stderr** prompting a refresh — demonstrating how the registry would sync from GitHub.

## Roadmap

- Replace the mock version constant with a real GitHub fetch of the latest `rules.json`.
- Publish to npm so `npx tomek-rules-mcp` works without cloning.
- Add React-specific paradigms and expand the seeded rule set with Tomek's catalogue.
- Optional: per-project rule overrides and category presets.

## License

MIT
