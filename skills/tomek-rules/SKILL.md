---
name: tomek-rules
description: Use when writing, reviewing, or refactoring TypeScript or React code. Applies Tomasz (@developertomek)'s curated type-safe idioms and clean-code paradigms; call the get_tomek_paradigms MCP tool for the freshest set.
---

# Tomek Rules — apply Tomek's TypeScript style

When working in a TypeScript or React project, follow the curated paradigms below.
Content version: `2026-06-26T00:00:00Z`.

For each rule, follow its **When to apply** guidance and prefer the **Prefer** examples over the **Avoid** anti-patterns. Apply these idioms by default; explain the reasoning briefly when asked.

## Active rules

- **Choose Interface for Extensible Objects and Type Aliases for Data Transformation** (`types`) — see `rules/interface-vs-type-architecture.md`
- **Flatten nested guards with assertion functions (`asserts value is T`)** (`guards`) — see `rules/assertion-functions-flat-narrowing.md`
- **Lock down config objects with `as const satisfies` — validated and literal** (`types`) — see `rules/satisfies-as-const-config.md`
- **Share one typed API contract across client and server** (`generics`) — see `rules/type-safe-api-contract.md`
- **Narrow `unknown` payloads with native type predicates (no dependencies)** (`guards`) — see `rules/native-type-predicate-guards.md`

> For the always-current set (including rules added after install), call the `get_tomek_paradigms` tool from the tomek-rules MCP server.
