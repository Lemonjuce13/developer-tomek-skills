---
name: tomek-rules-config
description: Use when the user wants to view, enable, or disable Tomek's TypeScript rules — e.g. "configure tomek rules", "which tomek rules are active", "turn off the React rules". Lists available paradigms and toggles them.
---

# Configure Tomek Rules

This skill curates which of Tomasz's (@developertomek) TypeScript paradigms are active.
It requires the **tomek-rules** MCP server to be connected (the tools below come from it).

When invoked:

1. **List.** Call the `list_rules` tool to fetch every rule with its current on/off state.
2. **Present.** Show the rules to the user as a checklist, clearly marking each as
   **ACTIVE** or **INACTIVE**, grouped by category when helpful. Include each rule's title.
3. **Ask.** Ask the user which rules they want to enable or disable. Accept ids, titles, or
   categories and resolve them to rule ids.
4. **Apply.** Call `set_rules_enabled` with the chosen `ids` array and the boolean `enabled`
   value. Make one call per distinct boolean (one for the ids to enable, one for the ids to
   disable) if the user changes both directions at once.
5. **Confirm.** Report the new active set back to the user, and mention that the `tomek-rules`
   apply skill regenerates automatically — no manual sync needed.

Keep responses concise. Do not edit `rules.config.json` directly; always go through the
`set_rules_enabled` tool so the skill files stay in sync.
