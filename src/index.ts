/**
 * index.ts — MCP server entry-point.
 *
 * Creates the server, connects a stdio transport, and signals readiness.
 * IMPORTANT: stdout is reserved exclusively for JSON-RPC messages sent by the
 * MCP transport. All human-readable output (logs, warnings, readiness lines)
 * MUST go to stderr so it does not corrupt the protocol stream.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";
import { getVersion } from "./registry.js";
import { checkForUpdates } from "./update-checker.js";
import { selfSync } from "./sync.js";

/** Start the MCP server on stdio and wait indefinitely. */
export async function serve(): Promise<void> {
  const server = createServer();

  // Startup update check — checkForUpdates emits its own stderr notice when newer
  // content exists. Runs before the transport connects so it precedes JSON-RPC traffic.
  checkForUpdates(getVersion());

  // Self-sync: if the content version changed since the last run, regenerate the
  // installed skill files so they reflect the current registry — no manual sync needed.
  const synced = selfSync();
  if (synced.previous !== null && synced.synced && synced.scopes.length > 0) {
    console.error(
      `[tomek-rules] Content version changed ${synced.previous} → ${synced.version}; ` +
        `re-synced ${synced.scopes.length} installed skill scope(s).`
    );
  }

  // stdout is reserved for JSON-RPC — connect transport before logging ready.
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Signal readiness on stderr only.
  console.error("[tomek-rules] MCP server ready (stdio transport).");
}
