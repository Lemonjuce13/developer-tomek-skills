/**
 * schema.ts — the single source of truth for every data shape in the project.
 *
 * Design choice: all data (the rule registry and the toggle manifest) is validated
 * through Zod at the boundary, and the rest of the codebase consumes the *inferred*
 * types (`z.infer`). This guarantees runtime safety (malformed JSON fails fast with a
 * readable error) and compile-time safety (no `any`) from one declaration.
 */
import { z } from "zod";

/** The fixed taxonomy a rule can belong to. Drives the `category` tool filter. */
export const CategorySchema = z.enum([
  "generics",
  "guards",
  "react",
  "types",
  "utility",
]);

/** Optional difficulty hint shown in the generated markdown. */
export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

/** A single code example attached to a rule (e.g. an Avoid/Prefer pair). */
export const ExampleSchema = z.object({
  label: z.string().optional(),
  language: z.string().default("typescript"),
  code: z.string().min(1),
});

/**
 * A single paradigm/idiom. The `id` is a unique kebab-case slug and is the key used
 * by the toggle manifest and the generated `<id>.md` skill files.
 */
export const RuleSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be kebab-case"),
  category: CategorySchema,
  title: z.string().min(1),
  difficulty: DifficultySchema.optional(),
  explanation: z.string().min(1),
  whenToApply: z.string().min(1),
  examples: z.array(ExampleSchema).min(1),
  tags: z.array(z.string()).optional(),
  source: z.string().url().optional(),
});

/** The canonical content file (`data/rules.json`). */
export const RegistryFileSchema = z.object({
  version: z.string().min(1),
  rules: z.array(RuleSchema),
});

/**
 * The toggle manifest (`rules.config.json`). A map of every rule id -> enabled flag,
 * so a user can see and edit the full on/off state in one place. The loader keeps this
 * complete by auto-adding any newly discovered rule id (defaulting to enabled).
 */
export const ConfigSchema = z.object({
  rules: z.record(z.string(), z.boolean()),
});

export type Category = z.infer<typeof CategorySchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type Example = z.infer<typeof ExampleSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type RegistryFile = z.infer<typeof RegistryFileSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/** A rule paired with its current enabled state — used by the `list_rules` tool. */
export interface RuleState {
  id: string;
  title: string;
  category: Category;
  active: boolean;
}
