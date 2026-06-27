#!/usr/bin/env node
/**
 * cli.ts — entry point for the `tomek-rules-mcp` binary.
 *
 * Dispatches on the first positional argument:
 *   serve  — start the MCP server
 *   sync   — regenerate apply-skill files from the live rules registry
 *   init   — interactive (or headless) installer
 *   --help — print usage
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  getDataHome,
  getRulesJsonPath,
  getBundledDataDir,
  getBundledConfigPath,
  getBundledSkillsDir,
  getConfigJsonPath,
  getSkillsTargetDir,
  getApplySkillDir,
} from "./paths.js";
import { SKILL_APPLY, SKILL_CONFIG, SKILL_AUDIT, MCP_SERVER_NAME } from "./names.js";
import { PACKAGE_NAME } from "./config.js";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("-")) ?? "";

const hasFlag = (flag: string): boolean => args.includes(flag);
const flagValue = (prefix: string): string | undefined =>
  args.find((a) => a.startsWith(prefix))?.slice(prefix.length);

/** Absolute path to this running compiled CLI entry (…/dist/cli.js). */
const SELF_PATH = fileURLToPath(import.meta.url);

/**
 * Decide whether to register the locally-built entry or the published npx package.
 * Auto-detected: an installed/npx copy lives under node_modules, a source clone does
 * not. Overridable with --local (force the built dist path) or --npx (force the package).
 */
function isLocalInstall(): boolean {
  if (hasFlag("--npx")) return false;
  if (hasFlag("--local")) return true;
  return !SELF_PATH.includes(`${path.sep}node_modules${path.sep}`);
}

/** The `serve` invocation to register: locally-built entry vs published npx package. */
function serveInvocation(local: boolean): string[] {
  return local
    ? ["node", SELF_PATH, "serve"]
    : ["npx", "-y", PACKAGE_NAME, "serve"];
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
${PACKAGE_NAME} — MCP server + Claude skills for @developertomek's TypeScript idioms

Usage:
  npx ${PACKAGE_NAME}            Install everything (skills + MCP server) — one command
  ${PACKAGE_NAME} <command> [flags]

Commands:
  (no command)         Run the installer (same as 'init')
  init [flags]         Install skills, seed the data home, and register the MCP server
  serve                Start the MCP server (used by Claude Code)
  sync                 Regenerate apply-skill files from the live rule registry

Init flags (non-interactive / headless):
  --all                Install both skills (apply + config)
  --skills=apply,config  Comma-separated list of skills to install
  --project            Install into the project's .claude/skills (default)
  --global             Install into ~/.claude/skills
  --yes                Register the MCP server without prompting
  --local              Register the locally-built entry (node dist/cli.js serve)
  --npx                Register the published package (npx -y ${PACKAGE_NAME} serve)
                       (default: auto-detected from where this CLI is running)

Examples:
  npx ${PACKAGE_NAME}
  npx ${PACKAGE_NAME} --all --global --yes
  npx ${PACKAGE_NAME} sync
`);
}

// ---------------------------------------------------------------------------
// Seed DATA HOME (idempotent — never overwrites existing user state)
// ---------------------------------------------------------------------------

function seedDataHome(): void {
  fs.mkdirSync(getDataHome(), { recursive: true });

  const rulesJsonDest = getRulesJsonPath();
  if (!fs.existsSync(rulesJsonDest)) {
    fs.copyFileSync(path.join(getBundledDataDir(), "rules.json"), rulesJsonDest);
  }

  const configDest = getConfigJsonPath();
  if (!fs.existsSync(configDest)) {
    fs.copyFileSync(getBundledConfigPath(), configDest);
  }
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

/**
 * Build the `claude mcp add` argv, matching the MCP server's registration scope to the
 * chosen skill scope: "global" → `--scope user` (available in all of your projects),
 * "project" → the CLI default (local, this project only).
 */
function mcpCmdParts(scope: "project" | "global", local: boolean): string[] {
  const scopeArgs = scope === "global" ? ["--scope", "user"] : [];
  return ["claude", "mcp", "add", MCP_SERVER_NAME, ...scopeArgs, "--", ...serveInvocation(local)];
}

function mcpCmdString(scope: "project" | "global", local: boolean): string {
  return mcpCmdParts(scope, local).join(" ");
}

function attemptMcpRegistration(scope: "project" | "global", local: boolean): void {
  const parts = mcpCmdParts(scope, local);
  const cmdString = parts.join(" ");
  console.log(`\nRunning: ${cmdString}\n`);
  try {
    const result = spawnSync(parts[0]!, parts.slice(1), { stdio: "inherit" });
    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        console.log(
          "  `claude` CLI not found. Run the command above manually once Claude Code is installed."
        );
      } else {
        console.log(`  Registration failed (${err.message}). Run manually:\n  ${cmdString}`);
      }
    }
  } catch (e) {
    console.log(`  Unexpected error. Run manually:\n  ${cmdString}`);
  }
}

// ---------------------------------------------------------------------------
// Print success summary
// ---------------------------------------------------------------------------

function printSuccess(opts: {
  scope: "project" | "global";
  installedSkills: string[];
  skillsDir: string;
}): void {
  const { scope, installedSkills, skillsDir } = opts;
  console.log(`\n✔ ${PACKAGE_NAME} installed successfully\n`);
  console.log(`  Scope       : ${scope}`);
  console.log(`  Skills dir  : ${skillsDir}`);
  if (installedSkills.length > 0) {
    console.log(`  Skills      : ${installedSkills.join(", ")}`);
  }
  console.log(`  Data home   : ${getDataHome()}`);
  console.log(`  Rules JSON  : ${getRulesJsonPath()}`);
  console.log(`  Config JSON : ${getConfigJsonPath()}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Ensure the MCP server is registered (see command above).`);
  console.log(`  2. In Claude Code, the ${SKILL_APPLY} skill applies the active idioms automatically.`);
  console.log(`  3. Use the ${SKILL_CONFIG} skill to toggle which rules are active.`);
  console.log(`  4. Run the ${SKILL_AUDIT} skill (in plan mode) to audit a codebase for improvements.`);
  console.log(`  5. Run \`${PACKAGE_NAME} sync\` after editing data/rules.json.\n`);
}

// ---------------------------------------------------------------------------
// sync command
// ---------------------------------------------------------------------------

async function runSync(): Promise<void> {
  const { syncSkill } = await import("./sync.js");

  const results: Array<{ label: string; files: string[] }> = [];

  // syncSkill now returns Result<SyncOutput, SyncError>: "unwritable" scopes
  // are skipped silently (matches the old try/catch intent), but a registry
  // error — which the old blanket catch would swallow — gets surfaced.
  const targets: Array<{ label: (root: string) => string; dir?: string }> = [
    { label: (root) => `project (${root})`, dir: getApplySkillDir("project") },
    { label: (root) => `global (${root})`, dir: getApplySkillDir("global") },
    { label: (root) => `default (${root})` }, // no-arg → syncSkill's own default
  ];

  for (const { label, dir } of targets) {
    const r = dir === undefined ? syncSkill() : syncSkill(dir);
    if (r.ok) {
      results.push({ label: label(r.value.skillRoot), files: r.value.ruleFiles });
    } else if (r.error.kind === "invalid-registry") {
      console.error(`sync: registry invalid — ${r.error.message}`);
      process.exitCode = 1;
      return;
    }
    // "unwritable" → skip silently
  }

  if (results.length === 0) {
    console.log("sync: no writable skill directories found — nothing written.");
    return;
  }

  for (const { label, files } of results) {
    console.log(`\nsync: ${label}`);
    if (files.length === 0) {
      console.log("  (no rule files written)");
    } else {
      for (const f of files) {
        console.log(`  wrote ${f}`);
      }
    }
  }
  console.log(`\nsync: done (${results.reduce((n, r) => n + r.files.length, 0)} files total)\n`);
}

// ---------------------------------------------------------------------------
// Skill installation (shared by the headless and interactive paths)
// ---------------------------------------------------------------------------

/** Copy a static (hand-authored) skill from the bundled package into the target dir. */
function copyStaticSkill(name: string, skillsDir: string): void {
  fs.cpSync(path.join(getBundledSkillsDir(), name), path.join(skillsDir, name), {
    recursive: true,
  });
}

/**
 * Install the selected skills into `skillsDir`. The apply skill is generated from the
 * active rules; config and audit are static, hand-authored skills copied verbatim.
 * Returns the installed skill names.
 */
async function installSkills(
  selected: string[],
  scope: "project" | "global",
  skillsDir: string
): Promise<string[]> {
  const installed: string[] = [];
  if (selected.includes("apply")) {
    const { syncSkill } = await import("./sync.js");
    const r = syncSkill(getApplySkillDir(scope));
    if (!r.ok && r.error.kind === "invalid-registry") {
      throw new Error(`failed to generate ${SKILL_APPLY}: ${r.error.message}`);
    }
    installed.push(SKILL_APPLY);
  }
  if (selected.includes("config")) {
    copyStaticSkill(SKILL_CONFIG, skillsDir);
    installed.push(SKILL_CONFIG);
  }
  if (selected.includes("audit")) {
    copyStaticSkill(SKILL_AUDIT, skillsDir);
    installed.push(SKILL_AUDIT);
  }
  return installed;
}

// ---------------------------------------------------------------------------
// init — headless path (flags present)
// ---------------------------------------------------------------------------

async function runInitHeadless(opts: {
  skills: string[];
  scope: "project" | "global";
  registerMcp: boolean;
  local: boolean;
}): Promise<void> {
  const { skills, scope, registerMcp, local } = opts;

  seedDataHome();

  const skillsDir = getSkillsTargetDir(scope);
  fs.mkdirSync(skillsDir, { recursive: true });

  const installedSkills = await installSkills(skills, scope, skillsDir);

  console.log(`\nMCP registration command:\n  ${mcpCmdString(scope, local)}\n`);

  if (registerMcp) {
    attemptMcpRegistration(scope, local);
  }

  printSuccess({ scope, installedSkills, skillsDir });
}

// ---------------------------------------------------------------------------
// init — interactive path (@clack/prompts)
// ---------------------------------------------------------------------------

async function runInitInteractive(local: boolean): Promise<void> {
  const clack = await import("@clack/prompts");

  clack.intro(`${PACKAGE_NAME} installer`);

  // 1. Which skills?
  const skillsAnswer = await clack.multiselect({
    message: "Which Claude skills would you like to install?",
    options: [
      { value: "apply", label: `${SKILL_APPLY} (apply idioms)`, hint: "recommended" },
      { value: "config", label: `${SKILL_CONFIG} (configure active rules)`, hint: "recommended" },
      { value: "audit", label: `${SKILL_AUDIT} (analyze a codebase for improvements)`, hint: "plan mode" },
    ],
    initialValues: ["apply", "config", "audit"],
    required: true,
  });

  if (clack.isCancel(skillsAnswer)) {
    clack.cancel("Aborted");
    process.exit(0);
  }

  const selectedSkills = skillsAnswer as string[];

  // 2. Scope?
  const scopeAnswer = await clack.select({
    message: "Install skills for this project or globally?",
    options: [
      { value: "project", label: "Project (.claude/skills)", hint: "default" },
      { value: "global", label: "Global (~/.claude/skills)" },
    ],
    initialValue: "project",
  });

  if (clack.isCancel(scopeAnswer)) {
    clack.cancel("Aborted");
    process.exit(0);
  }

  const scope = scopeAnswer as "project" | "global";

  // 3. Register MCP now?
  const registerAnswer = await clack.confirm({
    message: `Register the MCP server with Claude Code now?\n  (runs: ${mcpCmdString(scope, local)})`,
    initialValue: true,
  });

  if (clack.isCancel(registerAnswer)) {
    clack.cancel("Aborted");
    process.exit(0);
  }

  const registerMcp = registerAnswer as boolean;

  // --- Actions ---
  seedDataHome();

  const skillsDir = getSkillsTargetDir(scope);
  fs.mkdirSync(skillsDir, { recursive: true });

  const installedSkills = await installSkills(selectedSkills, scope, skillsDir);

  clack.note(mcpCmdString(scope, local), "MCP registration command");

  if (registerMcp) {
    attemptMcpRegistration(scope, local);
  }

  clack.outro("Installation complete!");
  printSuccess({ scope, installedSkills, skillsDir });
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

/**
 * Run the installer. Interactive when a TTY is present and no flags were passed;
 * otherwise headless with sensible defaults so a bare, piped, or scripted
 * `npx tomek-rules-mcp` still installs everything in one shot.
 */
async function runInit(): Promise<void> {
  const allFlag = hasFlag("--all");
  const skillsFlag = flagValue("--skills=");
  const projectFlag = hasFlag("--project");
  const globalFlag = hasFlag("--global");
  const yesFlag = hasFlag("--yes");
  const anyFlag = allFlag || skillsFlag !== undefined || projectFlag || globalFlag || yesFlag;

  // Register the locally-built entry when run from a clone, the npx package otherwise
  // (auto-detected, overridable with --local / --npx). --local/--npx are not install
  // flags, so they don't by themselves force the non-interactive path.
  const local = isLocalInstall();

  // Prompt only when we can (a real terminal) and the user didn't pass install flags.
  if (process.stdin.isTTY && !anyFlag) {
    await runInitInteractive(local);
    return;
  }

  // Headless defaults: install both skills into the project scope and register the
  // MCP server. A bare non-interactive run is treated as "set everything up".
  let skills: string[];
  if (skillsFlag !== undefined && skillsFlag.length > 0) {
    skills = skillsFlag.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    skills = ["apply", "config", "audit"];
  }
  const scope: "project" | "global" = globalFlag ? "global" : "project";
  const registerMcp = yesFlag || !anyFlag;

  await runInitHeadless({ skills, scope, registerMcp, local });
}

async function main(): Promise<void> {
  if (hasFlag("--help") || hasFlag("-h") || command === "help") {
    printUsage();
    return;
  }

  switch (command) {
    case "serve": {
      const { serve } = await import("./index.js");
      await serve();
      break;
    }

    case "sync": {
      await runSync();
      break;
    }

    // Bare `npx tomek-rules-mcp` (no command) runs the full installer — one command
    // installs both skills, seeds the data home, and registers the MCP server.
    case "":
    case "init": {
      await runInit();
      break;
    }

    default: {
      console.error(`tomek-rules-mcp: unknown command "${command}".\n`);
      printUsage();
      process.exitCode = 1;
      break;
    }
  }
}

main().catch((err: unknown) => {
  console.error("tomek-rules-mcp:", err instanceof Error ? err.message : err);
  process.exit(1);
});
