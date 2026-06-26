---
id: type-safe-event-emitter
category: generics
title: "Make an event emitter type-safe with a generic event map"
difficulty: advanced
tags: [generics, event-emitter, pub-sub, keyof, mapped-types, event-map]
source: "https://www.instagram.com/p/DZiLhwcxsYS/"
---

# Make an event emitter type-safe with a generic event map

## Explanation

An emitter typed with `string` event names and `any` payloads cannot guarantee that an event name matches its payload — a typo like `user:logn` or a wrong payload shape passes silently and breaks at runtime. Parameterise the emitter over an event-map type (`Record<event, payload>`) and key `on`/`emit` with `K extends keyof T`, binding each event name to its exact payload. The compiler then restricts both methods to declared events, gives full autocomplete, and rejects mismatched payloads — with zero runtime cost, since the types erase after compilation.

## When to apply

Use a generic event map whenever you build pub/sub, an event bus, or any `on`/`emit` API and want event names and payloads validated at compile time. Declare an interface mapping each event key to its payload type, make the emitter `class EventEmitter<T extends Record<string, unknown>>`, and type the methods with `on<K extends keyof T>(event: K, cb: (data: T[K]) => void)` and `emit<K extends keyof T>(event: K, data: T[K])`.

## Examples

**Avoid: string keys + any payload — typos and wrong shapes slip through**
```typescript
// ❌ Any string, any payload — nothing is checked
class EventEmitter {
  private listeners: Record<string, Function[]> = {};
  on(event: string, cb: Function) {
    (this.listeners[event] ??= []).push(cb);
  }
  emit(event: string, data: any) {
    this.listeners[event]?.forEach((cb) => cb(data));
  }
}

const e = new EventEmitter();
e.emit("user:logn", { id: 1 });    // typo — silently ignored
e.emit("user:login", { name: 1 }); // wrong payload — unnoticed
```

**Prefer: a generic event map binds each name to its payload**
```typescript
interface EventMap {
  "user:login": { id: number; name: string };
  "user:logout": { id: number };
  "page:view": { url: string };
}

class EventEmitter<T extends Record<string, unknown>> {
  private listeners: { [K in keyof T]?: Array<(data: T[K]) => void> } = {};
  on<K extends keyof T>(event: K, cb: (data: T[K]) => void) {
    (this.listeners[event] ??= []).push(cb);
  }
  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners[event]?.forEach((cb) => cb(data));
  }
}

const emitter = new EventEmitter<EventMap>();
emitter.emit("user:login", { id: 1, name: "tomek" }); // ✅
emitter.emit("user:logn", { id: 1 });    // ❌ not a known event
emitter.emit("user:login", { name: 1 }); // ❌ wrong payload
```
