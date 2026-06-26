---
id: tuple-wrapped-conditional-types
category: types
title: "Wrap conditional types in tuples (`[T] extends [X]`) to stop union distribution"
difficulty: advanced
tags: [conditional-types, distributive, union-types, tuple-trick, type-level]
source: "https://www.instagram.com/p/DZdBJomxHHW/"
---

# Wrap conditional types in tuples (`[T] extends [X]`) to stop union distribution

## Explanation

When a bare generic parameter sits on the left of a conditional type (`T extends X ? ...`), TypeScript distributes: it evaluates the condition for each member of a union `T` separately and unions the results. That is ideal for filtering, but it breaks checks that must consider the union as a whole (e.g. 'is this union as a whole assignable to X?'), producing mixed results like `"valid" | "invalid"`. Wrapping both sides in a one-element tuple — `[T] extends [X]` — disables distribution and evaluates the union as a single unit. It is a pure type-level technique with no runtime footprint.

## When to apply

Reach for `[T] extends [X]` whenever a conditional type must treat a union as one whole value rather than per member — exact-union compatibility checks, `IsNever`/`IsAny`-style guards, or any rule where distribution gives wrong answers. Keep the bare `T extends X` form when you actually want to map or filter each union member individually.

## Examples

**Avoid: a bare parameter distributes the union**
```typescript
type Role = "admin" | "user";

// ❌ Distributes per member, so a mixed union yields a mixed result
type IsRole<T> = T extends Role ? "valid" : "invalid";

type Check = IsRole<"admin" | "guest">; // "valid" | "invalid"
```

**Prefer: tuple-wrap evaluates the whole union at once**
```typescript
type Role = "admin" | "user";

// ✅ Non-distributive: the union is checked as a single unit
type IsRole<T> = [T] extends [Role] ? "valid" : "invalid";

type Ok = IsRole<"admin" | "user">;  // "valid"
type No = IsRole<"admin" | "guest">; // "invalid"
```
