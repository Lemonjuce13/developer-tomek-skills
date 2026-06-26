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
  SKILL_APPLY,
  SKILL_CONFIG,
} from "./paths.js";

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
    : ["npx", "-y", "tomek-rules-mcp", "serve"];
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
tomek-rules-mcp — MCP server + Claude skills for @developertomek's TypeScript idioms

Usage:
  npx tomek-rules-mcp            Install everything (skills + MCP server) — one command
  tomek-rules-mcp <command> [flags]

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
  --npx                Register the published package (npx -y tomek-rules-mcp serve)
                       (default: auto-detected from where this CLI is running)

Examples:
  npx tomek-rules-mcp
  npx tomek-rules-mcp --all --global --yes
  npx tomek-rules-mcp sync
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
  return ["claude", "mcp", "add", "tomek-rules", ...scopeArgs, "--", ...serveInvocation(local)];
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
  console.log("\n✔ tomek-rules-mcp installed successfully\n");
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
  console.log(`  2. In Claude Code, use /tomek-rules to apply active idioms.`);
  console.log(`  3. Use /tomek-rules-config to toggle rules on/off.`);
  console.log(`  4. Run \`tomek-rules-mcp sync\` after editing data/rules.json.\n`);
}

// ---------------------------------------------------------------------------
// sync command
// ---------------------------------------------------------------------------

async function runSync(): Promise<void> {
  const { syncSkill } = await import("./sync.js");

  const results: Array<{ label: string; files: string[]; error?: string }> = [];

  // Sync the project-scoped apply skill
  try {
    const r = syncSkill(getApplySkillDir("project"));
    results.push({ label: `project (${r.skillRoot})`, files: r.ruleFiles });
  } catch {
    // Skip unwritable scopes silently
  }

  // Sync the global-scoped apply skill
  try {
    const r = syncSkill(getApplySkillDir("global"));
    results.push({ label: `global (${r.skillRoot})`, files: r.ruleFiles });
  } catch {
    // Skip unwritable scopes silently
  }

  // Also run a no-arg sync (respects syncSkill's own default)
  try {
    const r = syncSkill();
    results.push({ label: `default (${r.skillRoot})`, files: r.ruleFiles });
  } catch {
    // Skip unwritable scopes silently
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
// init — headless path (flags present)
// ---------------------------------------------------------------------------

async function runInitHeadless(opts: {
  skills: string[];
  scope: "project" | "global";
  registerMcp: boolean;
  local: boolean;
}): Promise<void> {
  const { syncSkill } = await import("./sync.js");
  const { skills, scope, registerMcp, local } = opts;

  seedDataHome();

  const skillsDir = getSkillsTargetDir(scope);
  fs.mkdirSync(skillsDir, { recursive: true });

  const installedSkills: string[] = [];

  if (skills.includes("apply")) {
    syncSkill(getApplySkillDir(scope));
    installedSkills.push(SKILL_APPLY);
  }

  if (skills.includes("config")) {
    const configSrc = path.join(getBundledSkillsDir(), SKILL_CONFIG);
    const configDest = path.join(skillsDir, SKILL_CONFIG);
    fs.cpSync(configSrc, configDest, { recursive: true });
    installedSkills.push(SKILL_CONFIG);
  }

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
  const { syncSkill } = await import("./sync.js");

  clack.intro("tomek-rules-mcp installer");

  // 1. Which skills?
  const skillsAnswer = await clack.multiselect({
    message: "Which Claude skills would you like to install?",
    options: [
      { value: "apply", label: "tomek-rules (apply idioms)", hint: "recommended" },
      { value: "config", label: "tomek-rules-config (configure active rules)", hint: "recommended" },
    ],
    initialValues: ["apply", "config"],
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

  const installedSkills: string[] = [];

  if (selectedSkills.includes("apply")) {
    syncSkill(getApplySkillDir(scope));
    installedSkills.push(SKILL_APPLY);
  }

  if (selectedSkills.includes("config")) {
    const configSrc = path.join(getBundledSkillsDir(), SKILL_CONFIG);
    const configDest = path.join(skillsDir, SKILL_CONFIG);
    fs.cpSync(configSrc, configDest, { recursive: true });
    installedSkills.push(SKILL_CONFIG);
  }

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
    skills = ["apply", "config"];
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
