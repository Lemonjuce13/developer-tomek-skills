# tomek-rules-mcp

An MCP server **and** three Claude skills that deliver Tomasz's
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
- **`tomek-rules` skill** — generated from the active rules; auto-triggers on TS/React work to
  apply the idioms.
- **`tomek-rules-config` skill** — user-triggered; walks you through enabling/disabling rules.
- **`tomek-rules-audit` skill** — read-only; analyzes a codebase and reports improvement
  opportunities (value, necessity, before/after, effort) from the active rules. Best run in plan
  mode.

> All command/skill/server names live as consts in [`src/names.ts`](src/names.ts) (easy to
> rebrand); the npm package name is read from `package.json` via [`src/config.ts`](src/config.ts).

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

## Quick start (one command)

```bash
npx tomek-rules-mcp
```

That's it. This single command installs both skills (`tomek-rules`, `tomek-rules-config`),
seeds your data home (`~/.tomek-rules`), generates the skill files, and registers the MCP
server with Claude Code. In a terminal it walks you through a couple of choices (scope,
confirm registration); when piped or scripted it falls back to sensible defaults (both
skills, project scope, auto-register) so it still completes in one shot.

Fully non-interactive / scripted:

```bash
npx tomek-rules-mcp --all --global --yes
```

After it finishes, restart (or reload) Claude Code so it picks up the new MCP server and
skills.

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

The installer picks the right one **automatically**: run from a cloned source tree it registers
the local `node …/dist/cli.js serve` form; run as an installed/`npx` package it registers
`npx -y tomek-rules-mcp serve`. Override with `--local` or `--npx` if needed — e.g. to test the
local build before publishing:

```bash
node dist/cli.js init --all --yes --local
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

Two mechanisms work together:

- **Remote check (informational).** The server pins a mock `REMOTE_VERSION`. On startup and on
  each `get_tomek_paradigms` call it compares that to your content's `version`; if the remote is
  newer it prints a 🔔 notice to **stderr** — demonstrating how the registry would sync from GitHub.
- **Self-sync (automatic).** On startup, the server compares your `rules.json` `version` to the
  last-synced stamp (`~/.tomek-rules/.sync-stamp`). If it changed, it **regenerates the installed
  skill files** for every installed scope — no manual `sync` needed. Because the server is spawned
  fresh by Claude Code each session, bumping the `version` after editing `rules.json` means the
  next session automatically picks up the new content. (Self-sync only refreshes already-installed
  skills; it never touches the read-only bundled package dir.)

In a full release, the startup step would first **fetch** the latest `rules.json` from GitHub and
then self-sync — closing the loop end to end.

## Roadmap

- Replace the mock version constant with a real GitHub fetch of the latest `rules.json`.
- Publish to npm so `npx tomek-rules-mcp` works without cloning.
- Add React-specific paradigms and expand the seeded rule set with Tomek's catalogue.
- Optional: per-project rule overrides and category presets.

## License

MIT
