/**
 * tests/e2e.mjs — end-to-end smoke test for the tomek-rules MCP server.
 *
 * Drives the real server through the MCP SDK's in-memory client/transport pair, so it
 * exercises the actual JSON-RPC tool/prompt plumbing (not just the helper functions).
 * Fully isolated: HOME, the data home, and the working directory are redirected to a
 * throwaway temp dir, which is removed on exit — so it never touches your real
 * ~/.tomek-rules, ~/.claude, or the repo working tree.
 *
 * Run with:  npm test   (which builds first), or  node tests/e2e.mjs  after a build.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- Isolation: redirect HOME, data home, and cwd to a temp sandbox -----------
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "tomek-rules-test-"));
const dataHome = path.join(sandbox, ".tomek-rules");
fs.mkdirSync(dataHome, { recursive: true });
process.env.HOME = sandbox; // isolates "global" skill scope (~/.claude)
process.env.USERPROFILE = sandbox;
process.env.TOMEK_RULES_HOME = dataHome;
process.chdir(sandbox); // isolates "project" skill scope (cwd/.claude)

// Seed the data home from bundled defaults.
fs.copyFileSync(path.join(REPO, "data/rules.json"), path.join(dataHome, "rules.json"));
fs.copyFileSync(path.join(REPO, "rules.config.json"), path.join(dataHome, "rules.config.json"));

// Derive expectations from the seeded registry so the test isn't tied to a fixed count.
const seeded = JSON.parse(fs.readFileSync(path.join(dataHome, "rules.json"), "utf-8"));
const TOTAL_RULES = seeded.rules.length;
const GUARD_IDS = seeded.rules.filter((r) => r.category === "guards").map((r) => r.id);
const DISABLE_ID = "assertion-functions-flat-narrowing";

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`${cond ? "  ok  " : " FAIL "}${label}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};
const banner = (s) => console.log("\n========== " + s + " ==========");

async function main() {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
  const { createServer } = await import(pathToFileURL(path.join(REPO, "dist/server.js")).href);

  const server = createServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "e2e", version: "0.0.0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  banner("capabilities");
  const tools = (await client.listTools()).tools.map((t) => t.name);
  console.log("tools:", tools.join(", "));
  check("get_tomek_paradigms registered", tools.includes("get_tomek_paradigms"));
  check("list_rules registered", tools.includes("list_rules"));
  check("set_rules_enabled registered", tools.includes("set_rules_enabled"));
  const promptNames = (await client.listPrompts()).prompts.map((p) => p.name);
  console.log("prompts:", promptNames.join(", "));
  check("apply-tomek-style registered", promptNames.includes("apply-tomek-style"));

  banner("get_tomek_paradigms (no args)");
  const all = await client.callTool({ name: "get_tomek_paradigms", arguments: {} });
  console.log("structured rules:", all.structuredContent.rules.length);
  check("returns all seeded rules", all.structuredContent.rules.length === TOTAL_RULES, `expected ${TOTAL_RULES}`);
  check("text content present", all.content[0].text.length > 100);

  banner("get_tomek_paradigms (category=guards)");
  const guards = await client.callTool({ name: "get_tomek_paradigms", arguments: { category: "guards" } });
  console.log("guards rule ids:", guards.structuredContent.rules.map((r) => r.id).join(", "));
  check("category filter narrows to guards",
    guards.structuredContent.rules.length === GUARD_IDS.length
      && guards.structuredContent.rules.every((r) => GUARD_IDS.includes(r.id)),
    `expected ${GUARD_IDS.length} guard rule(s)`);

  banner("list_rules (initial)");
  const list1 = await client.callTool({ name: "list_rules", arguments: {} });
  console.log(list1.content[0].text);
  check("all rules ON initially", (list1.content[0].text.match(/\[ON /g) || []).length === TOTAL_RULES, `expected ${TOTAL_RULES}`);

  banner("apply-tomek-style prompt");
  const prompt = await client.getPrompt({ name: "apply-tomek-style", arguments: {} });
  const ptext = prompt.messages[0].content.text;
  console.log(ptext.slice(0, 160).replace(/\n/g, " ") + " ...");
  check("prompt mentions @developertomek", ptext.includes("@developertomek"));

  banner("set_rules_enabled (disable assertion-functions-flat-narrowing)");
  const toggled = await client.callTool({
    name: "set_rules_enabled",
    arguments: { ids: [DISABLE_ID], enabled: false },
  });
  console.log(toggled.content[0].text);

  banner("list_rules (after toggle)");
  const list2 = await client.callTool({ name: "list_rules", arguments: {} });
  console.log(list2.content[0].text);
  check("one rule OFF after toggle", (list2.content[0].text.match(/\[OFF\]/g) || []).length === 1);

  banner("manifest persisted to disk");
  const manifest = JSON.parse(fs.readFileSync(path.join(dataHome, "rules.config.json"), "utf-8"));
  console.log(JSON.stringify(manifest));
  check("manifest reflects toggle", manifest.rules[DISABLE_ID] === false);

  banner("generated apply-skill files regenerated on toggle");
  const skillDir = path.join(sandbox, ".claude/skills/tomek-rules");
  const ruleFiles = fs.existsSync(path.join(skillDir, "rules"))
    ? fs.readdirSync(path.join(skillDir, "rules"))
    : [];
  console.log("rules/:", ruleFiles.join(", ") || "(none)", "| SKILL.md:", fs.existsSync(path.join(skillDir, "SKILL.md")));
  check("disabled rule's markdown removed", !ruleFiles.includes(`${DISABLE_ID}.md`));
  check("active rule markdown count matches", ruleFiles.length === TOTAL_RULES - 1, `expected ${TOTAL_RULES - 1}`);
  check("SKILL.md generated", fs.existsSync(path.join(skillDir, "SKILL.md")));

  banner("selfSync regenerates installed skill on a content version bump");
  const { selfSync } = await import(pathToFileURL(path.join(REPO, "dist/sync.js")).href);
  selfSync(); // establish the baseline stamp at the current version
  const rulesPath = path.join(dataHome, "rules.json");
  const reg = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  reg.version = "2099-01-01T00:00:00Z";
  fs.writeFileSync(rulesPath, JSON.stringify(reg, null, 2));
  const resync = selfSync();
  const skillMd = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
  console.log("selfSync:", JSON.stringify({ synced: resync.synced, previous: resync.previous, version: resync.version }));
  check("selfSync detects the version change", resync.synced && resync.previous !== null);
  check("regenerated SKILL.md carries the new version", skillMd.includes("2099-01-01T00:00:00Z"));
  check("selfSync is a no-op when version is unchanged", selfSync().synced === false);

  await client.close();
}

main()
  .catch((err) => {
    console.error("\nTEST ERROR:", err);
    failures++;
  })
  .finally(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
    console.log(`\n${failures === 0 ? "ALL PASSED ✅" : failures + " CHECK(S) FAILED ❌"}`);
    process.exit(failures === 0 ? 0 : 1);
  });
