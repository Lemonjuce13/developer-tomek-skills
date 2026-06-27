/**
 * names.ts — the configurable identifiers for this package's commands and skills.
 *
 * Change a value here to rebrand; the CLI, server, and installer all read from these
 * consts (no hardcoded strings elsewhere). This file intentionally has no imports so it
 * can be the single, dependency-free source of names.
 *
 * Note: the npm *package* name is separate — it lives in `package.json` (the identity npm
 * publishes under) and is read at runtime via `config.ts` (`PACKAGE_NAME`).
 */

/** MCP server id — used in `claude mcp add <id>` and `new McpServer({ name })`. */
export const MCP_SERVER_NAME = "tomek-rules";

/** Apply skill: generated from active rules; auto-triggers on TS/React work. */
export const SKILL_APPLY = "tomek-rules";

/** Config skill: user-triggered; enable/disable which rules are active. */
export const SKILL_CONFIG = "tomek-rules-config";

/** Audit skill: read-only; reports improvement opportunities (run in plan mode). */
export const SKILL_AUDIT = "tomek-rules-audit";
