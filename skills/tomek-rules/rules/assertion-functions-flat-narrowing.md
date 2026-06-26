---
id: assertion-functions-flat-narrowing
category: guards
title: "Flatten nested guards with assertion functions (`asserts value is T`)"
difficulty: advanced
tags: [asserts, assertion-functions, type-narrowing, guards, type-predicates]
source: "https://www.instagram.com/p/DZ7_r_DREnj/"
---

# Flatten nested guards with assertion functions (`asserts value is T`)

## Explanation

Standard type predicates (`x is T`) return a boolean, so they force you into conditional — often deeply nested — blocks to narrow a type. An assertion function instead uses `asserts value is T` in its return type: if the function doesn't throw, the compiler treats the value as that exact type for the rest of the scope. The result is flat, linear code that delivers runtime safety and compile-time narrowing in a single call. It's the same pattern Jest, Playwright, and Vitest rely on under the hood.

## When to apply

Reach for an assertion function when nested `if` guards are piling up just to satisfy the type checker, or for defensive checks and env/config validation where a missing value should hard-fail. Declare `function assertX(v: T | null | undefined): asserts v is T` (the `asserts` predicate must be an explicit return annotation — it can't be inferred), throw on the invalid case, then call it to narrow the variable without wrapping the rest of your logic in conditionals.

## Examples

**Avoid: nested if-guards to satisfy the type checker**
```typescript
// ❌ Type predicates (x is T) return a boolean,
//    forcing nested conditional blocks to narrow
const user = users.find((u) => u.id === "123");

if (user) {
  const order = orders.find((o) => o.userId === user.id);
  if (order) {
    console.log(order.total); // pyramid of nesting
  }
}
```

**Prefer: assertion function for flat, linear narrowing**
```typescript
// asserts value is T -> if it doesn't throw, the type is narrowed
function assertExists<T>(value: T | null | undefined): asserts value is T {
  if (value == null) throw new Error("Missing value");
}

const user = users.find((u) => u.id === "123");
assertExists(user); // user is now T for the rest of the scope

const order = orders.find((o) => o.userId === user.id);
assertExists(order);

// Flat, zero nesting
console.log(order.total);
```
