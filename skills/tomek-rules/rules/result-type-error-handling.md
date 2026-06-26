---
id: result-type-error-handling
category: utility
title: "Return a `Result<T, E>` instead of throwing — make failure paths type-checked"
difficulty: advanced
tags: [result-type, error-handling, discriminated-union, rust, ok-err]
source: "https://www.instagram.com/p/DZnYATUxxbQ/"
---

# Return a `Result<T, E>` instead of throwing — make failure paths type-checked

## Explanation

Thrown exceptions are not part of a function's type signature, so the compiler cannot warn callers to handle them — a forgotten network, validation, or database failure slips past the type checker and crashes at runtime, and a caught `error` is typed `unknown`. The Result pattern (from Rust's `Result<T, E>`) models failure as ordinary data: the function returns a discriminated union of an `ok: true` success or an `ok: false` error. The caller cannot reach the value without first checking the `ok` flag, so error handling becomes compiler-enforced and self-documenting.

## When to apply

Use a `Result<T, E>` return type for operations with expected, domain-level failures (validation, parsing, network/DB calls) where callers should be forced to handle errors at compile time instead of relying on try/catch discipline. Define `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`, return the matching variant, and narrow with `if (result.ok)` before touching `result.value`. Keep throwing for truly unexpected programmer errors.

## Examples

**Avoid: an implicit throw is invisible to the type system**
```typescript
// ❌ The throw isn't in the signature — callers get no warning to handle it
function fetchUser(id: string): User {
  if (!id) throw new Error("Invalid ID");
  return { id, name: "Alex" };
}

const user = fetchUser(""); // compiles fine, throws at runtime
```

**Avoid: try/catch loses the error type**
```typescript
// ❌ `e` is `unknown` — no typed information about what failed
try {
  const user = fetchUser("");
} catch (e) {
  // e: unknown
}
```

**Prefer: Result makes failure typed and unavoidable**
```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function fetchUser(id: string): Result<User, string> {
  if (!id) return { ok: false, error: "Invalid ID" };
  return { ok: true, value: { id, name: "Alex" } };
}

const result = fetchUser("123");
if (result.ok) {
  console.log(result.value.name); // value only reachable after the check
} else {
  console.log(result.error); // typed error
}
```
