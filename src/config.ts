/**
 * config.ts — single source of truth for the package's released name.
 *
 * Design choice: `package.json`'s `name` is the identity npm publishes under, so we read
 * it at runtime instead of duplicating the string across the CLI. Change the name once in
 * package.json and the registration command + help text follow automatically. (npm itself
 * reads package.json statically, so this is the one true source — there is no `.env`
 * indirection that could drift from the published name.)
 */
import fs from "node:fs";
import path from "node:path";
import { getPackageRoot } from "./paths.js";

/**
 * Native type predicate: narrows an arbitrary parsed JSON value into the
 * exact shape we need — a `{ name: string }` with a non-empty name. Replaces a
 * `JSON.parse(...) as { name?: unknown }` cast, which the compiler can't verify
 * (see Tomek's native-type-predicate-guards paradigm).
 */
function hasStringName(v: unknown): v is { name: string } {
  if (typeof v !== "object" || v === null || !("name" in v)) return false;
  const name = (v as { name: unknown }).name;
  return typeof name === "string" && name.length > 0;
}

function readPackageName(): string {
  try {
    const pkgPath = path.join(getPackageRoot(), "package.json");
    const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (hasStringName(pkg)) return pkg.name;
  } catch {
    // Fall through to the default if package.json is unreadable.
  }
  return "tomek-rules-mcp";
}

/** The npm package name, resolved once from package.json (with a safe fallback). */
export const PACKAGE_NAME: string = readPackageName();
