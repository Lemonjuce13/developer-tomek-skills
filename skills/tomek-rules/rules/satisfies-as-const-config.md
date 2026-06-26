---
id: satisfies-as-const-config
category: types
title: "Lock down config objects with `as const satisfies` — validated and literal"
difficulty: intermediate
tags: [satisfies, as-const, config, literal-types, immutability, inference]
source: "https://www.instagram.com/developertomek/"
---

# Lock down config objects with `as const satisfies` — validated and literal

## Explanation

Typing a config object with an explicit interface annotation widens its literal values into primitives (e.g. "blue" becomes string), killing downstream autocomplete and narrowing. Using `as const` alone preserves the literals and immutability but performs no structural validation, so typos and missing keys slip through. Combining them — `as const satisfies T` — validates the object against your schema while keeping the exact, readonly literal types.

## When to apply

Reach for `as const satisfies YourType` on configuration, theme, route, or lookup objects whenever you want all three of: structural validation against a schema, preserved literal types for autocomplete/narrowing, and immutability. Append it at the end of the object literal rather than annotating the variable.

## Examples

**Avoid: explicit annotation widens the literals**
```typescript
interface Theme { primary: string; fontSize: number; }

// ❌ Annotation widens the literal
const theme: Theme = { primary: "blue", fontSize: 16 };
type PrimaryColor = typeof theme.primary; // string
```

**Avoid: `as const` alone skips validation**
```typescript
interface Theme { primary: string; fontSize: number; }

// ❌ Literals preserved, but the `fontsize` typo is NOT caught
const theme = { primary: "blue", fontsize: 16 } as const;
```

**Prefer: `as const satisfies` — validated + literal + immutable**
```typescript
interface Theme { primary: string; fontSize: number; }

// ✅ Structure validated, literals & readonly preserved
const theme = { primary: "blue", fontSize: 16 } as const satisfies Theme;
type PrimaryColor = typeof theme.primary; // "blue"
// A `fontsize` typo now errors: does not exist in type 'Theme'
```
