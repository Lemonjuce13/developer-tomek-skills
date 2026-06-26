/**
 * paths.ts — central, deterministic path resolution.
 *
 * Design choice: never use `process.cwd()` to locate package data — Claude Code (and
 * `npx`) launch the server from arbitrary working directories. Bundled assets are
 * resolved relative to this compiled module via `import.meta.url`; mutable user state
 * lives in a writable DATA HOME (overridable with TOMEK_RULES_HOME).
 */
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Slugs for the two skills this package ships. */
export const SKILL_APPLY = "tomek-rules";
export const SKILL_CONFIG = "tomek-rules-config";

/**
 * Package root. At runtime this file is `dist/paths.js`, so the package root is one
 * directory up from `dist/`. Bundled `data/` and `skills/` sit at the package root.
 */
export function getPackageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

/** Bundled (read-only) seed content shipped inside the package. */
export function getBundledDataDir(): string {
  return path.join(getPackageRoot(), "data");
}

/** Bundled skill templates shipped inside the package. */
export function getBundledSkillsDir(): string {
  return path.join(getPackageRoot(), "skills");
}

/** Bundled default toggle manifest (used to seed DATA HOME on first run). */
export function getBundledConfigPath(): string {
  return path.join(getPackageRoot(), "rules.config.json");
}

/**
 * Writable home for mutable user state (the live rules.json + rules.config.json).
 * Defaults to ~/.tomek-rules and is overridable via TOMEK_RULES_HOME.
 */
export function getDataHome(): string {
  const override = process.env.TOMEK_RULES_HOME;
  if (override && override.trim().length > 0) return path.resolve(override);
  return path.join(os.homedir(), ".tomek-rules");
}

/** Live content path — DATA HOME copy of rules.json. */
export function getRulesJsonPath(): string {
  return path.join(getDataHome(), "rules.json");
}

/** Live toggle manifest path — DATA HOME copy of rules.config.json. */
export function getConfigJsonPath(): string {
  return path.join(getDataHome(), "rules.config.json");
}

/** Where Claude Code looks for skills: project-local or the user's home. */
export function getSkillsTargetDir(scope: "project" | "global"): string {
  if (scope === "global") {
    return path.join(os.homedir(), ".claude", "skills");
  }
  return path.join(process.cwd(), ".claude", "skills");
}

/** Directory of the installed `tomek-rules` apply skill for a given scope. */
export function getApplySkillDir(scope: "project" | "global"): string {
  return path.join(getSkillsTargetDir(scope), SKILL_APPLY);
}
