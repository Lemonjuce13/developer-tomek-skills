/**
 * registry.ts — the runtime facade over the rule registry and toggle manifest.
 *
 * Design choice: this module is the single access point for all rule data.
 * `loadRegistry` and `loadConfig` each resolve the live user path first and fall back
 * to the bundled read-only seed, so the package works out-of-the-box without a prior
 * `sync` step. `loadConfig` also auto-reconciles newly discovered rule ids so the
 * manifest never goes stale after a content update.
 */
import fs from "node:fs";
import path from "node:path";
import {
  RegistryFileSchema,
  ConfigSchema,
} from "./schema.js";
import type { Category, Rule, RegistryFile, Config, RuleState } from "./schema.js";
import {
  getBundledDataDir,
  getBundledConfigPath,
  getDataHome,
  getRulesJsonPath,
  getConfigJsonPath,
} from "./paths.js";

// ---------------------------------------------------------------------------
// Registry loading
// ---------------------------------------------------------------------------

/** Read and validate the rule registry, preferring the live user copy. */
export function loadRegistry(): RegistryFile {
  const livePath = getRulesJsonPath();
  const filePath = fs.existsSync(livePath)
    ? livePath
    : path.join(getBundledDataDir(), "rules.json");

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `registry.ts: failed to read rules file at ${filePath}: ${(err as Error).message}`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `registry.ts: invalid JSON in rules file at ${filePath}: ${(err as Error).message}`
    );
  }

  const result = RegistryFileSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `registry.ts: validation failed for rules file at ${filePath}: ${result.error.message}`
    );
  }

  return result.data;
}

/** Return the semver/date version string from the registry. */
export function getVersion(): string {
  return loadRegistry().version;
}

/** Return all rules from the registry, regardless of toggle state. */
export function getAllRules(): Rule[] {
  return loadRegistry().rules;
}

// ---------------------------------------------------------------------------
// Config (toggle manifest) loading and writing
// ---------------------------------------------------------------------------

/**
 * Read and validate the toggle manifest, then reconcile any newly-discovered rule ids
 * (defaulting them to enabled=true). If additions were made and the live config file
 * already exists, the reconciled manifest is persisted so it stays up to date.
 */
export function loadConfig(): Config {
  const livePath = getConfigJsonPath();
  const filePath = fs.existsSync(livePath) ? livePath : getBundledConfigPath();

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `registry.ts: failed to read config file at ${filePath}: ${(err as Error).message}`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `registry.ts: invalid JSON in config file at ${filePath}: ${(err as Error).message}`
    );
  }

  const result = ConfigSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `registry.ts: validation failed for config file at ${filePath}: ${result.error.message}`
    );
  }

  // Reconcile: any rule id missing from config defaults to true (enabled).
  const config = result.data;
  const allIds = getAllRules().map((r) => r.id);
  let added = false;
  for (const id of allIds) {
    if (!(id in config.rules)) {
      config.rules[id] = true;
      added = true;
    }
  }

  // Only persist if additions were made AND the live config file already exists
  // (we never auto-create the live config; that's left to the install/sync step).
  if (added && fs.existsSync(livePath)) {
    writeConfig(config);
  }

  return config;
}

/** Persist the toggle manifest to the live user path as 2-space pretty JSON. */
export function writeConfig(config: Config): void {
  fs.mkdirSync(getDataHome(), { recursive: true });
  fs.writeFileSync(getConfigJsonPath(), JSON.stringify(config, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Return true iff the given rule id is enabled in the toggle manifest. */
export function isActive(ruleId: string, config?: Config): boolean {
  return (config ?? loadConfig()).rules[ruleId] === true;
}

/** Return only the rules that are currently enabled. */
export function getActiveRules(): Rule[] {
  const config = loadConfig();
  return getAllRules().filter((r) => isActive(r.id, config));
}

/** Return all rules paired with their current enabled state. */
export function getAllWithState(): RuleState[] {
  const config = loadConfig();
  return getAllRules().map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    active: isActive(r.id, config),
  }));
}

/** Return active rules that belong to the given category. */
export function getByCategory(category: Category): Rule[] {
  const config = loadConfig();
  return getAllRules().filter(
    (r) => r.category === category && isActive(r.id, config)
  );
}

/**
 * Return active rules where `query` appears (case-insensitive) in the rule's
 * id, title, explanation, or any tags entry.
 */
export function search(query: string): Rule[] {
  const q = query.toLowerCase();
  const config = loadConfig();
  return getAllRules().filter((r) => {
    if (!isActive(r.id, config)) return false;
    return (
      r.id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.explanation.toLowerCase().includes(q) ||
      (r.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
    );
  });
}

/**
 * Return active rules filtered by optional category and/or query string.
 * When no options are provided, returns all active rules.
 * The query match logic is identical to `search`.
 */
export function findParadigms(opts: {
  category?: Category;
  query?: string;
}): Rule[] {
  const config = loadConfig();
  const q = opts.query?.toLowerCase();
  return getAllRules().filter((r) => {
    if (!isActive(r.id, config)) return false;
    if (opts.category !== undefined && r.category !== opts.category) return false;
    if (q !== undefined) {
      const hit =
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.explanation.toLowerCase().includes(q) ||
        (r.tags ?? []).some((t: string) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}

/**
 * Enable or disable a list of rule ids, persist the change, and return the
 * updated config. Unknown ids are written as-is (they will be ignored by query
 * helpers but are preserved so the manifest can be edited manually).
 */
export function setEnabled(ids: string[], enabled: boolean): Config {
  const config = loadConfig();
  for (const id of ids) {
    config.rules[id] = enabled;
  }
  writeConfig(config);
  return config;
}
