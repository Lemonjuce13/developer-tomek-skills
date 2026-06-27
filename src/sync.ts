/**
 * sync.ts — materialize the "apply" skill from the currently ACTIVE rules.
 *
 * Design choice: JSON is the single source of truth; this generator is the only writer
 * of the `tomek-rules` skill files. Regenerating (rather than hand-editing) guarantees
 * the skill content can never drift from the registry, and a re-run after any toggle
 * change keeps the on-disk skill in lockstep with `rules.config.json`.
 */
import fs from "node:fs";
import path from "node:path";
import type { Rule } from "./schema.js";
import { getBundledSkillsDir, getApplySkillDir, getDataHome } from "./paths.js";
import { SKILL_APPLY } from "./names.js";
import { getActiveRules, getVersion } from "./registry.js";
import { ruleToMarkdown } from "./markdown.js";

/** Render the apply skill's `SKILL.md`: a thin, auto-triggering wrapper over the rules. */
export function renderSkillMd(rules: Rule[], version: string): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`name: ${SKILL_APPLY}`);
  lines.push(
    "description: Use when writing, reviewing, or refactoring TypeScript or React code. " +
      "Applies Tomasz (@developertomek)'s curated type-safe idioms and clean-code paradigms; " +
      "call the get_tomek_paradigms MCP tool for the freshest set."
  );
  lines.push("---");
  lines.push("");
  lines.push("# Tomek Rules — apply Tomek's TypeScript style");
  lines.push("");
  lines.push(
    "When working in a TypeScript or React project, follow the curated paradigms below."
  );
  lines.push(`Content version: \`${version}\`.`);
  lines.push("");
  lines.push(
    "For each rule, follow its **When to apply** guidance and prefer the **Prefer** examples " +
      "over the **Avoid** anti-patterns. Apply these idioms by default; explain the reasoning " +
      "briefly when asked."
  );
  lines.push("");
  lines.push("## Active rules");
  lines.push("");
  if (rules.length === 0) {
    lines.push("_No rules are currently active. Enable some via the tomek-rules-config skill._");
  } else {
    for (const rule of rules) {
      lines.push(
        `- **${rule.title}** (\`${rule.category}\`) — see \`rules/${rule.id}.md\``
      );
    }
  }
  lines.push("");
  lines.push(
    "> For the always-current set (including rules added after install), call the " +
      "`get_tomek_paradigms` tool from the tomek-rules MCP server."
  );
  lines.push("");
  return lines.join("\n");
}

/**
 * Discriminated-union failure type for `syncSkill`. We distinguish "this scope
 * isn't writable / doesn't exist" — which callers legitimately want to skip
 * silently — from "the registry itself is invalid", which is a real bug callers
 * should surface instead of swallow.
 */
export type SyncError =
  | { kind: "unwritable"; cause: NodeJS.ErrnoException }
  | { kind: "invalid-registry"; message: string };

/** Rust-style `Result`: success and failure travel through the type system. */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Successful output of `syncSkill`. */
export interface SyncOutput {
  skillRoot: string;
  ruleFiles: string[];
  skillMdPath: string;
}

/** Filesystem error codes that mean "this scope is missing or not writable". */
const UNWRITABLE_CODES = new Set(["ENOENT", "EACCES", "EPERM", "EROFS", "ENOTDIR"]);

function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && typeof (e as NodeJS.ErrnoException).code === "string";
}

/**
 * Regenerate the apply skill at `skillRoot` (default: the bundled skill dir):
 * writes one `rules/<id>.md` per active rule plus a fresh `SKILL.md`, removing any
 * stale per-rule files first. Returns a `Result` so callers can route an
 * "unwritable" scope to a silent skip while still surfacing registry corruption.
 */
export function syncSkill(skillRoot?: string): Result<SyncOutput, SyncError> {
  const root = skillRoot ?? path.join(getBundledSkillsDir(), SKILL_APPLY);

  // Load the registry first: a malformed rules.json is a registry error, never
  // an "unwritable scope" — keep the two failure modes distinct.
  let activeRules: Rule[];
  let version: string;
  try {
    activeRules = getActiveRules();
    version = getVersion();
  } catch (err) {
    return {
      ok: false,
      error: { kind: "invalid-registry", message: err instanceof Error ? err.message : String(err) },
    };
  }

  const rulesDir = path.join(root, "rules");
  try {
    fs.mkdirSync(rulesDir, { recursive: true });

    // Remove stale rule files so disabled/renamed rules don't linger.
    for (const entry of fs.readdirSync(rulesDir)) {
      if (entry.endsWith(".md")) fs.rmSync(path.join(rulesDir, entry));
    }

    const ruleFiles: string[] = [];
    for (const rule of activeRules) {
      const filePath = path.join(rulesDir, `${rule.id}.md`);
      fs.writeFileSync(filePath, ruleToMarkdown(rule), "utf-8");
      ruleFiles.push(filePath);
    }

    const skillMdPath = path.join(root, "SKILL.md");
    fs.writeFileSync(skillMdPath, renderSkillMd(activeRules, version), "utf-8");

    return { ok: true, value: { skillRoot: root, ruleFiles, skillMdPath } };
  } catch (err) {
    if (isErrnoException(err) && err.code !== undefined && UNWRITABLE_CODES.has(err.code)) {
      return { ok: false, error: { kind: "unwritable", cause: err } };
    }
    // Anything else (out of disk, unexpected) is also treated as unwritable so
    // callers' "skip silently" intent is preserved — but the cause is carried
    // through, so a caller that wants to log it can.
    return {
      ok: false,
      error: {
        kind: "unwritable",
        cause: isErrnoException(err)
          ? err
          : Object.assign(new Error(err instanceof Error ? err.message : String(err)), { code: "EUNKNOWN" }),
      },
    };
  }
}

/** Stamp file recording which registry `version` the installed skills currently reflect. */
function syncStampPath(): string {
  return path.join(getDataHome(), ".sync-stamp");
}

/**
 * Self-sync: regenerate the *installed* apply skill(s) when the registry's content
 * `version` has changed since the last run, then record the new version. This is what
 * makes the skill auto-update — a session start (or any `serve`) after the content
 * version is bumped refreshes the on-disk skill with no manual `sync`.
 *
 * Deliberately conservative: it only refreshes skill scopes that already exist (it never
 * installs new ones or touches the read-only bundled package dir), and it is idempotent —
 * a no-op when the version is unchanged.
 */
export function selfSync(): {
  synced: boolean;
  version: string;
  previous: string | null;
  scopes: string[];
} {
  const version = getVersion();
  const stamp = syncStampPath();
  const previous = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf-8").trim() : null;

  if (previous === version) {
    return { synced: false, version, previous, scopes: [] };
  }

  const scopes: string[] = [];
  for (const scope of ["project", "global"] as const) {
    const dir = getApplySkillDir(scope);
    if (!fs.existsSync(dir)) continue; // only refresh already-installed scopes
    const r = syncSkill(dir);
    if (r.ok) {
      if (!scopes.includes(dir)) scopes.push(dir);
    } else if (r.error.kind === "invalid-registry") {
      // Don't silently swallow registry corruption — surface it on stderr.
      console.error(`[tomek-rules] self-sync: registry invalid — ${r.error.message}`);
    }
    // "unwritable" scopes are intentionally skipped (no log noise).
  }

  fs.mkdirSync(getDataHome(), { recursive: true });
  fs.writeFileSync(stamp, version, "utf-8");

  return { synced: true, version, previous, scopes };
}
