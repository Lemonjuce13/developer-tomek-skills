/**
 * update-checker.ts — lightweight freshness check against a pinned remote version.
 *
 * Design choice: the remote version is a compile-time constant rather than a live
 * network fetch. This keeps the MCP server startup instantaneous and avoids flaky
 * network dependencies. The orchestrator bumps REMOTE_VERSION on each content release.
 *
 * IMPORTANT: all output goes to STDERR. stdout carries the MCP JSON-RPC stream and any
 * stray write there would corrupt the framing.
 */

/** The latest content version published to GitHub — bumped by the release workflow. */
export const REMOTE_VERSION = "2026-09-01T00:00:00Z";

/**
 * Compare `localVersion` (an ISO-8601 date string) to the pinned REMOTE_VERSION.
 * When the remote is strictly newer, a human-readable notice is written to STDERR.
 * Returns a plain object that callers can forward to the `server_info` MCP response.
 */
export function checkForUpdates(localVersion: string): {
  updateAvailable: boolean;
  remoteVersion: string;
  localVersion: string;
} {
  const remoteMs = new Date(REMOTE_VERSION).getTime();
  const localMs = new Date(localVersion).getTime();
  const updateAvailable = remoteMs > localMs;

  if (updateAvailable) {
    // STDERR only — never stdout.
    console.error(
      `🔔 New Tomek content available on GitHub (remote ${REMOTE_VERSION} > local ${localVersion}) — run \`tomek-rules-mcp sync\` or the tomek-rules-config skill to refresh.`
    );
  }

  return { updateAvailable, remoteVersion: REMOTE_VERSION, localVersion };
}
