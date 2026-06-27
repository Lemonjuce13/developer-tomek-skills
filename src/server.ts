/**
 * server.ts — MCP server factory.
 *
 * Creates and configures the McpServer instance with all tools and prompts.
 * Kept separate from the entry-point (index.ts) so it can be imported in tests
 * without starting a transport.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CategorySchema, RuleSchema } from "./schema.js";
import type { Category } from "./schema.js";
import {
  getVersion,
  findParadigms,
  getAllWithState,
  getActiveRules,
  setEnabled,
  getByCategory,
} from "./registry.js";
import { checkForUpdates } from "./update-checker.js";
import { ruleToMarkdown } from "./markdown.js";
import { syncSkill } from "./sync.js";
import { buildTomekStylePrompt } from "./prompts.js";
import { getApplySkillDir } from "./paths.js";
import { MCP_SERVER_NAME } from "./names.js";

/** Instantiate, register all tools and prompts, and return the server. */
export function createServer(): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: "0.1.0" });

  // ── Tool: get_tomek_paradigms ────────────────────────────────────────────────
  server.registerTool(
    "get_tomek_paradigms",
    {
      title: "Get Tomek Paradigms",
      description:
        "Return active TypeScript paradigms from @developertomek, optionally filtered by category or a free-text query.",
      inputSchema: {
        category: CategorySchema.optional(),
        query: z.string().optional(),
      },
      outputSchema: {
        rules: z.array(RuleSchema),
      },
    },
    async ({ category, query }) => {
      // Side-effect: checkForUpdates emits its own stderr notice when newer content
      // exists (proving the remote-sync theory). Never blocks the response.
      checkForUpdates(getVersion());

      const rules = findParadigms({ category, query });

      const text =
        rules.length > 0
          ? rules.map(ruleToMarkdown).join("\n---\n")
          : "No matching active paradigms found.";

      return {
        content: [{ type: "text", text }],
        structuredContent: { rules },
      };
    }
  );

  // ── Tool: list_rules ─────────────────────────────────────────────────────────
  server.registerTool(
    "list_rules",
    {
      title: "List Rules",
      description:
        "List all known rules with their id, title, category, and current enabled state (ON/OFF).",
      inputSchema: {},
      outputSchema: {
        rules: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            category: CategorySchema,
            active: z.boolean(),
          })
        ),
      },
    },
    async () => {
      const states = getAllWithState();

      const lines = states.map(
        (r) =>
          `[${r.active ? "ON " : "OFF"}] ${r.id} — ${r.title} (${r.category})`
      );
      const text =
        lines.length > 0
          ? lines.join("\n")
          : "No rules found in the registry.";

      return {
        content: [{ type: "text", text }],
        structuredContent: { rules: states },
      };
    }
  );

  // ── Tool: set_rules_enabled ──────────────────────────────────────────────────
  server.registerTool(
    "set_rules_enabled",
    {
      title: "Set Rules Enabled",
      description:
        "Enable or disable one or more rules by id, then regenerate skill files for all scopes.",
      inputSchema: {
        ids: z.array(z.string()).min(1),
        enabled: z.boolean(),
      },
    },
    async ({ ids, enabled }) => {
      setEnabled(ids, enabled);

      // Regenerate the *installed* apply skill in both the project and global Claude
      // Code skill directories. We deliberately do NOT touch the bundled package dir:
      // at runtime that lives in a read-only npx cache, and writing it would also
      // pollute a checked-out repo during local dev/tests. syncSkill's Result type
      // lets us silently skip missing/unwritable scopes (the old behaviour) while
      // still surfacing a corrupt registry — which the old blanket catch hid.
      for (const scope of ["project", "global"] as const) {
        const r = syncSkill(getApplySkillDir(scope));
        if (!r.ok && r.error.kind === "invalid-registry") {
          console.error(`[tomek-rules] set_rules_enabled: registry invalid — ${r.error.message}`);
        }
      }

      const active = getActiveRules();
      const summary =
        active.length > 0
          ? `Active rules (${active.length}):\n` +
            active.map((r) => `  • ${r.id} — ${r.title}`).join("\n")
          : "No rules are currently active.";

      return { content: [{ type: "text", text: summary }] };
    }
  );

  // ── Prompt: apply-tomek-style ────────────────────────────────────────────────
  server.registerPrompt(
    "apply-tomek-style",
    {
      title: "Apply Tomek Style",
      description:
        "Generate a system-style prompt instructing the model to apply @developertomek's TypeScript paradigms.",
      argsSchema: {
        category: z.string().optional(),
      },
    },
    async ({ category }) => {
      const rules = category
        ? getByCategory(category as Category)
        : getActiveRules();

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: buildTomekStylePrompt(rules) },
          },
        ],
      };
    }
  );

  return server;
}
