---
id: native-type-predicate-guards
category: guards
title: "Narrow `unknown` payloads with native type predicates (no dependencies)"
difficulty: intermediate
tags: [type-predicates, guards, is-operator, narrowing, unknown, zod-alternative]
source: "https://www.instagram.com/developertomek/"
---

# Narrow `unknown` payloads with native type predicates (no dependencies)

## Explanation

A schema library like Zod is the right call for large production apps, but for a tiny script or single serverless function it can be overkill. TypeScript's native type predicates fill the gap: a small validation function whose return type is `v is User` acts as a compiler bridge. The moment the native checks pass, TypeScript locks the raw `unknown` payload into your exact interface — full autocomplete and type safety with zero extra dependencies.

## When to apply

Use a native type predicate for small, zero-dependency scripts or serverless functions where pulling in a schema validator is unnecessary. Write `function isUser(v: unknown): v is User { ... }` checking the required fields, then guard (`if (isUser(data))`) or assert before use. For large or security-sensitive apps, prefer a full schema validator like Zod.

## Examples

**Avoid: JSON.parse yields `any`**
```typescript
// ❌ JSON.parse returns `any` — no checks, no autocomplete
const data = JSON.parse(response);
data.name; // unchecked
```

**Prefer: a `v is T` type predicate narrows safely**
```typescript
interface User { id: string; name: string; }

function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v && "name" in v;
}

const data: unknown = JSON.parse(response);
if (isUser(data)) {
  console.log(data.name); // narrowed to User — zero dependencies
}
```
