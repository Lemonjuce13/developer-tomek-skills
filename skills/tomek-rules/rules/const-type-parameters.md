---
id: const-type-parameters
category: generics
title: "Use `const` type parameters to keep literal types without `as const` at every call"
difficulty: intermediate
tags: [const-type-parameters, generics, literal-types, as-const, inference, typescript-5]
source: "https://www.instagram.com/p/DZSnDhnREPr/"
---

# Use `const` type parameters to keep literal types without `as const` at every call

## Explanation

Passing an inline object or array into a generic function widens its literals — `{ theme: "dark" }` becomes `{ theme: string }` — so callers had to append `as const` at every call site to preserve exact values. TypeScript 5.0's const type parameters move that decision into the function signature: prefix the generic with `const` (`function f<const T>(x: T)`) and any argument is inferred as deeply readonly and literal automatically, with no caller-side syntax and no runtime cost.

## When to apply

Add `const` to a generic parameter (`<const T>`) when authoring library or utility functions that take inline config objects, arrays, or tuples and should preserve literal types and readonly-ness for the caller — so consumers get precise inference without writing `as const`. Requires TypeScript >= 5.0.

## Examples

**Avoid: a plain generic widens; the caller must add `as const`**
```typescript
// ❌ Literals widen to string / number…
function createConfig<T>(config: T) {
  return config;
}
const a = createConfig({ theme: "dark", port: 3000 });
// a: { theme: string; port: number }

// …so every caller has to opt back in:
const b = createConfig({ theme: "dark", port: 3000 } as const);
```

**Prefer: a const type parameter preserves literals automatically**
```typescript
// ✅ `const T` infers deeply readonly, literal types with no caller syntax
function createConfig<const T>(config: T) {
  return config;
}

const c = createConfig({ theme: "dark", port: 3000 });
// c: { readonly theme: "dark"; readonly port: 3000 }
```
