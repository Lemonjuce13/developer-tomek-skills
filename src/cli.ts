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

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
tomek-rules-mcp — MCP server + Claude skills for @developertomek's TypeScript idioms

Usage:
  tomek-rules-mcp <command> [flags]

Commands:
  serve                Start the MCP server (used by Claude Code)
  sync                 Regenerate apply-skill files from the live rule registry
  init [flags]         Install skills and register the MCP server

Init flags (non-interactive / headless):
  --all                Install both skills (apply + config)
  --skills=apply,config  Comma-separated list of skills to install
  --project            Install into the project's .claude/skills (default)
  --global             Install into ~/.claude/skills
  --yes                Skip the MCP-registration prompt; print the command instead

Examples:
  npx tomek-rules-mcp init
  npx tomek-rules-mcp init --all --global --yes
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

const MCP_CMD_PARTS = [
  "claude",
  "mcp",
  "add",
  "tomek-rules",
  "--",
  "npx",
  "-y",
  "tomek-rules-mcp",
  "serve",
];
const MCP_CMD_STRING = MCP_CMD_PARTS.join(" ");

function attemptMcpRegistration(): void {
  console.log(`\nRunning: ${MCP_CMD_STRING}\n`);
  try {
    const result = spawnSync(MCP_CMD_PARTS[0]!, MCP_CMD_PARTS.slice(1), {
      stdio: "inherit",
    });
    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        console.log(
          "  `claude` CLI not found. Run the command above manually once Claude Code is installed."
        );
      } else {
        console.log(`  Registration failed (${err.message}). Run manually:\n  ${MCP_CMD_STRING}`);
      }
    }
  } catch (e) {
    console.log(`  Unexpected error. Run manually:\n  ${MCP_CMD_STRING}`);
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
}): Promise<void> {
  const { syncSkill } = await import("./sync.js");
  const { skills, scope, registerMcp } = opts;

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

  console.log(`\nMCP registration command:\n  ${MCP_CMD_STRING}\n`);

  if (registerMcp) {
    attemptMcpRegistration();
  }

  printSuccess({ scope, installedSkills, skillsDir });
}

// ---------------------------------------------------------------------------
// init — interactive path (@clack/prompts)
// ---------------------------------------------------------------------------

async function runInitInteractive(): Promise<void> {
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
    message: `Register the MCP server with Claude Code now?\n  (runs: ${MCP_CMD_STRING})`,
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

  clack.note(MCP_CMD_STRING, "MCP registration command");

  if (registerMcp) {
    attemptMcpRegistration();
  }

  clack.outro("Installation complete!");
  printSuccess({ scope, installedSkills, skillsDir });
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
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

    case "init": {
      // Determine if we're running headless (any relevant flag present)
      const allFlag = hasFlag("--all");
      const skillsFlag = flagValue("--skills=");
      const projectFlag = hasFlag("--project");
      const globalFlag = hasFlag("--global");
      const yesFlag = hasFlag("--yes");

      const isHeadless = allFlag || skillsFlag !== undefined || projectFlag || globalFlag || yesFlag;

      if (isHeadless) {
        // Parse skills
        let skills: string[];
        if (allFlag) {
          skills = ["apply", "config"];
        } else if (skillsFlag !== undefined && skillsFlag.length > 0) {
          skills = skillsFlag.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
          // Default: both
          skills = ["apply", "config"];
        }

        const scope: "project" | "global" = globalFlag ? "global" : "project";
        const registerMcp = yesFlag;

        await runInitHeadless({ skills, scope, registerMcp });
      } else {
        await runInitInteractive();
      }
      break;
    }

    default: {
      printUsage();
      break;
    }
  }
}

main().catch((err: unknown) => {
  console.error("tomek-rules-mcp:", err instanceof Error ? err.message : err);
  process.exit(1);
});
