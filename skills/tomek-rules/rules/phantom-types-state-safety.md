---
id: phantom-types-state-safety
category: types
title: "Tag data state with phantom types to make invalid transitions uncompilable"
difficulty: advanced
tags: [phantom-types, branded-types, state-machine, nominal-typing, compile-time-safety]
source: "https://www.instagram.com/p/DZXyrH1Rb8H/"
---

# Tag data state with phantom types to make invalid transitions uncompilable

## Explanation

When two states share the same runtime shape (e.g. an unvalidated vs. a validated order), ordinary types cannot tell them apart, so you fall back to runtime `if` checks and risk calling `ship()` on an unvalidated order. A phantom type adds a generic parameter that exists only at the type level — it tags the data with its state and is erased from the emitted JavaScript (zero runtime cost). Functions then accept only the correctly-tagged type, so illegal transitions fail to compile instead of at runtime.

## When to apply

Use phantom types to model state machines and lifecycles (unvalidated → validated, draft → published, open → closed) where stages share structure but must not be interchangeable. Add a marker like `type Order<State> = { ... } & { readonly __state: State }`, expose distinct aliases (`Unvalidated`, `Validated`), and write transition functions that take one state and return the next (`validate(o: Unvalidated): Validated`) so consumers cannot skip steps.

## Examples

**Avoid: identical shapes leave state to runtime checks**
```typescript
type Order = { id: string; items: string[] };

function ship(order: Order) {
  /* ship logic */
}

// ❌ Nothing stops shipping an unvalidated order
ship({ id: "1", items: ["hat"] });
```

**Prefer: a phantom state parameter blocks illegal transitions**
```typescript
type Order<State> = { id: string; items: string[] } & {
  readonly __state: State;
};

type Unvalidated = Order<"unvalidated">;
type Validated = Order<"validated">;

function validate(order: Unvalidated): Validated {
  return { ...order, __state: "validated" };
}
function ship(order: Validated): void {
  /* ship logic */
}

const order: Unvalidated = { id: "1", items: ["hat"], __state: "unvalidated" };

ship(order);           // ❌ Validated expected, got Unvalidated
ship(validate(order)); // ✅ must validate first
```
