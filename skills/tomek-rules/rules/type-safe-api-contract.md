---
id: type-safe-api-contract
category: generics
title: "Share one typed API contract across client and server"
difficulty: advanced
tags: [generics, api, fetch, contract, full-stack, keyof, indexed-access]
source: "https://www.instagram.com/developertomek/"
---

# Share one typed API contract across client and server

## Explanation

Front-end fetch calls return any, forcing manual casts like `as User` — a lie the compiler can't verify, so a renamed back-end field breaks the front-end silently at runtime. A type-safe API layer defines a single contract interface mapping every endpoint to its exact request and response types, then wraps fetch in a generic keyed by that contract. Now a back-end rename makes every stale front-end reference fail to compile.

## When to apply

Use in full-stack TypeScript (e.g. Next.js) to stop casting fetch responses. Define an `ApiContract` interface mapping each route to its `{ response, request? }` types, then a generic `apiFetch<K extends keyof ApiContract>(path: K): Promise<ApiContract[K]["response"]>`. Drive both the client fetch wrapper and the route handlers off the same contract.

## Examples

**Avoid: untyped fetch and a casting lie**
```typescript
// ❌ res.json() is `any`; `as User` is unchecked and breaks silently
const res = await fetch("/api/user");
const data = (await res.json()) as User;
```

**Prefer: a shared generic contract**
```typescript
interface ApiContract {
  "/api/user": { response: User };
  "/api/posts": { response: Post[] };
}

async function apiFetch<K extends keyof ApiContract>(
  path: K
): Promise<ApiContract[K]["response"]> {
  const res = await fetch(path);
  return res.json();
}

const user = await apiFetch("/api/user");
user.name; // typed — rename a server field and every caller fails to compile
```
