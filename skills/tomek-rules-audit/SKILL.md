---
name: tomek-rules-audit
description: Use when the user wants to audit, analyze, or review a codebase for improvements based on Tomasz's (@developertomek) TypeScript paradigms — e.g. "audit this codebase with tomek rules", "where can I apply tomek's paradigms", "find tomek-rules improvements". Produces a READ-ONLY report (value, necessity, before/after, effort), no edits. Best run in plan mode.
---

# Tomek Rules Audit

Read-only audit: report where a codebase could adopt the **active** Tomek paradigms — no edits.
Run in **plan mode**. Requires the **tomek-rules** MCP server. Surface the changes genuinely worth
making for *this* codebase, not every possible application of a rule.

## Procedure

1. **Load active rules.** Call `get_tomek_paradigms` (no args) for the enabled rules'
   `explanation`, `whenToApply`, and Avoid/Prefer examples. Consider only these — don't invent
   paradigms. (Optional: `list_rules` to show the user the on/off state.)
2. **Read the project.** Note its scale and intent (script vs. app vs. library) and existing
   conventions — this calibrates how *necessary* each change is.
3. **Scope.** Scan the source the user pointed at (default: project TS/React source; skip
   `node_modules`, `dist`, and generated files). State what you scanned.
4. **Detect.** For each active rule, use its `whenToApply` as the heuristic and its **Avoid**
   example as the anti-pattern signature.
5. **Assess every finding on four axes:**
   - **Improvement** (High / Med / Low) — what it actually buys *here*.
   - **Necessity** (Recommended / Optional / Skip) — given project scope *and readability*; say
     *Skip* when a valid change adds ceremony for little gain.
   - **Effort** — 🟢 Low (localized) · 🟡 Medium (a few sites) · 🔴 High (cross-cutting / API).
   - **Risk** — chance of a bug or false positive.
6. **Reconcile.** Many paradigms compose (e.g. a `Result<T,E>` returned through a type-safe API
   contract; `satisfies` with a `const` type parameter). Present overlapping ones as a **combined**
   suggestion, and **never recommend a change that undermines another active rule** — if two
   conflict, say which to prefer and why.
7. **Report** using the format below: lead with high-value, low-effort wins, and be honest — a few
   real findings beat many weak ones, and "no worthwhile matches for rule X" is a valid result.

## Report format

```
## Tomek Rules Audit — <scope>

Project: <scale + intent>
Active rules: <titles>   ·   Files scanned: <n>

### Summary
| Rule | Findings | Improvement | Necessity | Effort |
|------|----------|-------------|-----------|--------|
| ...  | ...      | ...         | ...       | ...    |

Top picks (high value · low effort): <list>
Combined: <e.g. "src/api.ts: Result + API contract apply together">

### Findings

#### 1. <rule title> — `path/to/file.ts:LINE`
- **Why:** <one line> · **Improvement:** High · **Necessity:** Recommended · **Effort:** 🟢 Low · **Risk:** low
- **Before:**
  ```ts
  <current code>
  ```
- **After:**
  ```ts
  <suggested code>
  ```
- **Combines with:** <other finding(s) or —>
```

## Beyond the rules (opt-in only)

Only if the user explicitly asks for general suggestions, append a clearly-labeled
**"Beyond Tomek's rules"** section with at most ~3 high-confidence, widely-accepted TypeScript
improvements you noticed that aren't in the active rule set. Keep them conservative and never let
them outweigh the rule-based findings. By default, leave this out.

## Read-only

Never modify files — deliver the report only (plan mode enforces this; respect it regardless of
mode). Applying changes is the `tomek-rules` skill's job, not this one.
