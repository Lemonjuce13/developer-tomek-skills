/**
 * markdown.ts — render a single Rule as a standalone markdown document.
 *
 * Design choice: the registry is JSON (machine-readable, the source of truth), but
 * Claude skills consume markdown. This module is the one place that translates a
 * validated `Rule` into the `<id>.md` file shape, so the on-disk skill content stays
 * consistent and is never hand-authored.
 */
import type { Rule } from "./schema.js";

/** Quote a YAML scalar that may contain `:` or quotes, escaping embedded quotes. */
function yamlQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** Render one rule as a frontmatter + Explanation/When/Examples markdown document. */
export function ruleToMarkdown(rule: Rule): string {
  const front: string[] = ["---"];
  front.push(`id: ${rule.id}`);
  front.push(`category: ${rule.category}`);
  front.push(`title: ${yamlQuote(rule.title)}`);
  if (rule.difficulty) front.push(`difficulty: ${rule.difficulty}`);
  if (rule.tags && rule.tags.length > 0) {
    front.push(`tags: [${rule.tags.join(", ")}]`);
  }
  if (rule.source) front.push(`source: ${yamlQuote(rule.source)}`);
  front.push("---");

  const body: string[] = [];
  body.push(`# ${rule.title}`);
  body.push("");
  body.push("## Explanation");
  body.push("");
  body.push(rule.explanation);
  body.push("");
  body.push("## When to apply");
  body.push("");
  body.push(rule.whenToApply);
  body.push("");
  body.push("## Examples");

  for (const example of rule.examples) {
    body.push("");
    if (example.label) body.push(`**${example.label}**`);
    body.push(`\`\`\`${example.language}`);
    body.push(example.code);
    body.push("```");
  }

  return `${front.join("\n")}\n\n${body.join("\n")}\n`;
}
