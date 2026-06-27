# Self-Audit — `tomek-rules-mcp` against Tomek's TypeScript paradigms

> Generated 2026-06-27 by running the `tomek-rules-audit` skill against this repo's own `src/`.
> Read-only report; the `self-test` branch contains the implementation of Findings #1 and #2.

## Scope

- **Project**: small (~12 TS files, ~1000 LOC) MCP server + skill installer. Showcase quality matters — the README pitches a collaboration with @developertomek, so even small idiomatic wins are worth more than usual.
- **Active rules** (10): interface-vs-type-architecture · assertion-functions-flat-narrowing · satisfies-as-const-config · type-safe-api-contract · native-type-predicate-guards · result-type-error-handling · type-safe-event-emitter · tuple-wrapped-conditional-types · phantom-types-state-safety · const-type-parameters
- **Files scanned**: every `.ts` under `src/` (cli, config, index, markdown, names, paths, prompts, registry, schema, server, sync, update-checker). Excluded: `tests/e2e.mjs` (JS), `data/`, `dist/`, `skills/` (generated/static markdown), `node_modules/`.

## Summary

| Rule | Findings | Improvement | Necessity | Effort |
|------|----------|-------------|-----------|--------|
| native-type-predicate-guards | 1 | High | Recommended | 🟢 Low |
| result-type-error-handling | 1 | Medium | Recommended | 🟡 Med |
| assertion-functions-flat-narrowing | 1 | Low | Skip | 🟢 Low |
| interface-vs-type-architecture | 0 | — | — | — |
| satisfies-as-const-config | 0 | — | — | — |
| type-safe-api-contract | 0 (n/a — no fetches) | — | — | — |
| type-safe-event-emitter | 0 (n/a — no emitter) | — | — | — |
| tuple-wrapped-conditional-types | 0 (n/a — no conditional types) | — | — | — |
| phantom-types-state-safety | 0 | — | — | — |
| const-type-parameters | 0 (n/a — no consumer-facing config-taking generics) | — | — | — |

**Top picks (high value · low effort)**: native predicate for `package.json` parsing in `src/config.ts`.

**Combined**: Findings #1 and #2 both replace silent failure-handling lies with typed contracts — they share a theme ("make failure paths visible to the compiler") and can ship together as a small "error-handling tighten-up" pair without conflicting with any other rule.

**Honest note**: 6 of 10 rules have no applicable site in this codebase — it has no fetch layer, no pub/sub, no conditional types, no obvious state machines, and no public consumer-facing generic utilities. That's a real result, not a gap in the audit.

---

## Findings

### 1. native-type-predicate-guards — `src/config.ts:14-23`

- **Why**: The current code does `JSON.parse(...) as { name?: unknown }` — exactly the "casting lie" the rule calls out. `JSON.parse` returns `any`, so the assertion is unverified and a malformed `package.json` slides past at compile time. A tiny type predicate gives compiler-checked narrowing with zero extra dependencies — and this file is the rule's poster child (a single small script-style helper where pulling in Zod would be overkill). Worth doing in a showcase repo.
- **Improvement**: High · **Necessity**: Recommended · **Effort**: 🟢 Low · **Risk**: low (the file's only callsite already has a safe `try/catch` + fallback).

**Before**:
```ts
function readPackageName(): string {
  try {
    const pkgPath = path.join(getPackageRoot(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name?: unknown };
    if (typeof pkg.name === "string" && pkg.name.length > 0) return pkg.name;
  } catch {
    // Fall through to the default if package.json is unreadable.
  }
  return "tomek-rules-mcp";
}
```

**After**:
```ts
function hasStringName(v: unknown): v is { name: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "name" in v &&
    typeof (v as { name: unknown }).name === "string" &&
    (v as { name: string }).name.length > 0
  );
}

function readPackageName(): string {
  try {
    const pkgPath = path.join(getPackageRoot(), "package.json");
    const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (hasStringName(pkg)) return pkg.name;
  } catch {
    // Fall through to the default if package.json is unreadable.
  }
  return "tomek-rules-mcp";
}
```

**Combines with**: Finding #2 (both eliminate unchecked failure modes).

---

### 2. result-type-error-handling — `src/sync.ts:67-93` and its 4 call sites

- **Why**: `syncSkill` throws on any failure, and every caller wraps it in a bare `try {} catch {}` to "skip unwritable scopes silently" — in `src/cli.ts:189-211` (×3) and `src/server.ts:124-130`. That swallows *all* errors, not just `ENOENT`/`EACCES`: a corrupt `rules.json`, a Zod validation failure, an out-of-disk error all disappear silently, masking real bugs in a tool whose whole purpose is to keep generated skill files in sync. Returning `Result<T, SyncError>` makes the failure modes part of the signature, lets callers explicitly skip "unwritable" but log/report "invalid registry", and removes the four blanket catches.
- **Improvement**: Medium · **Necessity**: Recommended · **Effort**: 🟡 Med (one new return type + ~5 call sites) · **Risk**: low–medium — the existing semantics ("skip silently") are preserved by mapping `ok: false, error: "unwritable"` to a no-op; only the `invalid-registry` branch changes from "swallow" to "surface".

**Before** (`src/cli.ts:189-211`, representative — same shape in `src/server.ts:124-130`):
```ts
// syncSkill throws on every error type — caller can't tell them apart
try {
  const r = syncSkill(getApplySkillDir("project"));
  results.push({ label: `project (${r.skillRoot})`, files: r.ruleFiles });
} catch {
  // Skip unwritable scopes silently — also hides bad rules.json, validation errors, etc.
}
```

**After**:
```ts
// sync.ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
type SyncError =
  | { kind: "unwritable"; cause: NodeJS.ErrnoException }
  | { kind: "invalid-registry"; message: string };

export function syncSkill(skillRoot?: string): Result<SyncOutput, SyncError> {
  // …classify fs errors as "unwritable", registry/Zod errors as "invalid-registry"…
}

// cli.ts caller
const r = syncSkill(getApplySkillDir("project"));
if (r.ok) {
  results.push({ label: `project (${r.value.skillRoot})`, files: r.value.ruleFiles });
} else if (r.error.kind === "invalid-registry") {
  console.error(`sync: registry invalid — ${r.error.message}`); // surface real bugs
}
// "unwritable" falls through silently, preserving today's behaviour
```

**Combines with**: Finding #1 (both make failure paths typed and explicit). Does **not** conflict with any other active rule — in particular, `assertExists` (rule #2) is still fine for genuinely-must-exist invariants; `Result` is for expected, recoverable failures, which is exactly the sync case.

---

### 3. assertion-functions-flat-narrowing — `src/prompts.ts:16`, `src/cli.ts:137-139`

- **Why**: There are two non-null `!` sites: `rule.examples[rule.examples.length - 1]!` (guarded by Zod's `.min(1)`) and `parts[0]!` in `spawnSync` (guarded by the hardcoded `mcpCmdParts` builder). An `assertExists` helper would technically remove the `!`, but: (a) neither callsite has nested `if`-guards — the rule's stated trigger is "nested `if` guards are piling up", which isn't the case here; (b) introducing a one-line helper used at two trivially-safe sites is exactly the "ceremony for little gain" the audit format warns against. The `!` here is a precise local statement that the invariant is upheld.
- **Improvement**: Low · **Necessity**: **Skip** · **Effort**: 🟢 Low · **Risk**: low.

---

## Rules with no applicable sites (honest skips)

- **interface-vs-type-architecture** — `schema.ts` already follows the paradigm (Zod schemas + `z.infer` for data, `interface RuleState` for the plain DTO shape). Nothing to change.
- **satisfies-as-const-config** — no inline annotated config objects whose literals get widened. The `clack.multiselect` options arrays in `cli.ts` *could* take `as const satisfies`, but their return type is shaped by `@clack/prompts` (which forces the `as string[]` cast), so adding `as const satisfies` wouldn't actually remove a cast or unlock narrowing downstream — it would be ceremony.
- **type-safe-api-contract** — project makes no `fetch` calls; the MCP tools are already typed end-to-end via Zod `inputSchema`/`outputSchema` + the SDK's `registerTool` generics. The rule's intent is already satisfied by a different mechanism.
- **type-safe-event-emitter** — no event emitter exists.
- **tuple-wrapped-conditional-types** — no conditional types exist.
- **phantom-types-state-safety** — no lifecycle types where two states share the same runtime shape. `"project" | "global"` is a plain discriminator, not a state machine.
- **const-type-parameters** — project authors no public generic utility that takes inline config and would benefit consumers with literal preservation.

---

## Implementation status

| Finding | Status | Commit |
|---------|--------|--------|
| #1 native-type-predicate-guards in `src/config.ts` | Implemented on this branch | see `self-test` branch history |
| #2 Result<T, E> in `src/sync.ts` + callers | Implemented on this branch | see `self-test` branch history |
| #3 assertion-functions | Skipped (per audit) | — |
