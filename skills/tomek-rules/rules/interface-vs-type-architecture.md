---
id: interface-vs-type-architecture
category: types
title: "Choose Interface for Extensible Objects and Type Aliases for Data Transformation"
difficulty: intermediate
tags: [interface, type-alias, declaration-merging, unions, intersections, mapped-types]
source: "https://www.instagram.com/p/DaBKiI8xtEs/"
---

# Choose Interface for Extensible Objects and Type Aliases for Data Transformation

## Explanation

Interfaces and type aliases look identical for simple objects, but have different architectural strengths. Interfaces support native declaration merging which is optimal for public APIs and extensible object shapes. Type aliases support operations like unions, intersections, and mapped types that interfaces cannot replicate, making them ideal for complex domain logic.

## When to apply

Use an `interface` when defining public API contracts, database entities, or component prop types that may benefit from extension or merging. Use a `type` alias when creating status unions, combining shapes via intersections, creating scalar aliases, or utilizing complex mapped types.

## Examples

**Avoid: interface can't model a union**
```typescript
// ❌ Invalid: 'interface' can only declare object shapes, not union aliases
interface Status = "active" | "inactive" | "pending"; // Syntax Error
```

**Prefer Interface for object shapes and declaration merging**
```typescript
interface User {
  id: string;
  name: string;
}

// Automatically merges new properties
interface User {
  email: string;
}

const user: User = {
  id: "1",
  name: "Alex",
  email: "a@b.com"
};
```

**Prefer Type for unions, intersections, and mapped types**
```typescript
type Status = "active" | "inactive" | "pending";

type Timestamps = {
  createdAt: Date;
  updatedAt: Date;
};

// Intersection
type UserWithTimeline = {
  id: string;
  status: Status;
} & Timestamps;

// Mapped Type transformation
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};
```
