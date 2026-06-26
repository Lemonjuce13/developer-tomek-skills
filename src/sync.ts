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
import { SKILL_APPLY, getBundledSkillsDir, getApplySkillDir, getDataHome } from "./paths.js";
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
 * Regenerate the apply skill at `skillRoot` (default: the bundled skill dir):
 * writes one `rules/<id>.md` per active rule plus a fresh `SKILL.md`, removing any
 * stale per-rule files first.
 */
export function syncSkill(skillRoot?: string): {
  skillRoot: string;
  ruleFiles: string[];
  skillMdPath: string;
} {
  const root = skillRoot ?? path.join(getBundledSkillsDir(), SKILL_APPLY);
  const rulesDir = path.join(root, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  // Remove stale rule files so disabled/renamed rules don't linger.
  for (const entry of fs.readdirSync(rulesDir)) {
    if (entry.endsWith(".md")) fs.rmSync(path.join(rulesDir, entry));
  }

  const activeRules = getActiveRules();
  const ruleFiles: string[] = [];
  for (const rule of activeRules) {
    const filePath = path.join(rulesDir, `${rule.id}.md`);
    fs.writeFileSync(filePath, ruleToMarkdown(rule), "utf-8");
    ruleFiles.push(filePath);
  }

  const skillMdPath = path.join(root, "SKILL.md");
  fs.writeFileSync(skillMdPath, renderSkillMd(activeRules, getVersion()), "utf-8");

  return { skillRoot: root, ruleFiles, skillMdPath };
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
    try {
      syncSkill(dir);
      if (!scopes.includes(dir)) scopes.push(dir);
    } catch {
      // Skip unwritable scopes.
    }
  }

  fs.mkdirSync(getDataHome(), { recursive: true });
  fs.writeFileSync(stamp, version, "utf-8");

  return { synced: true, version, previous, scopes };
}
