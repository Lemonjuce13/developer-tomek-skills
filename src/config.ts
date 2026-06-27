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

function readPackageName(): string {
  try {
    const pkgPath = path.join(getPackageRoot(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name?: unknown };
    if (typeof pkg.name === "string" && pkg.name.length > 0) return pkg.name;
  } catch {
    // Fall through to the default if package.json is unreadable.
  }
  return "tomek-rules-mcp";
}

/** The npm package name, resolved once from package.json (with a safe fallback). */
export const PACKAGE_NAME: string = readPackageName();
