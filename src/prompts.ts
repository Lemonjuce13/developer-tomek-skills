/**
 * prompts.ts — compile active rules into the `apply-tomek-style` instruction block.
 *
 * Design choice: the MCP prompt is a single, self-contained system-style message so any
 * LLM client can adopt Tomek's style without further tool calls. We surface each rule's
 * "when to apply" guidance plus one representative *Prefer* snippet — the smallest payload
 * that still teaches the idiom.
 */
import type { Rule, Example } from "./schema.js";

/** Pick the most instructive snippet: the "Prefer" example, else the last one. */
function representativeExample(rule: Rule): Example {
  const preferred = rule.examples.find((e) =>
    (e.label ?? "").toLowerCase().includes("prefer")
  );
  return preferred ?? rule.examples[rule.examples.length - 1]!;
}

/** Build one system-style instruction block from the given rules. */
export function buildTomekStylePrompt(rules: Rule[]): string {
  if (rules.length === 0) {
    return (
      "No active Tomek paradigms are configured. Enable some via the tomek-rules-config " +
      "skill or by editing rules.config.json, then try again."
    );
  }

  const lines: string[] = [];
  lines.push(
    "You are coding in the style of Tomasz (@developertomek): clean, strongly-typed, " +
      "idiomatic TypeScript. Apply the following paradigms by default."
  );
  lines.push("");

  rules.forEach((rule, index) => {
    const example = representativeExample(rule);
    lines.push(`${index + 1}. ${rule.title}`);
    lines.push(`   When to apply: ${rule.whenToApply}`);
    lines.push("");
    lines.push(`\`\`\`${example.language}`);
    lines.push(example.code);
    lines.push("```");
    lines.push("");
  });

  lines.push(
    "Apply these idioms by default in any TypeScript or React code you write or review, " +
      "and explain the reasoning briefly when asked."
  );

  return lines.join("\n");
}
