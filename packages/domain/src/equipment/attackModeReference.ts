import { z } from "zod";

/**
 * Stable identity of a competency in the competency catalogue (Forgejo #515, programme #512).
 *
 * The identity is the catalogue entry's `id` (for example `one_handed_edged`), NOT its display
 * `name` (`1-h edged`). Names are what `characterInputs.combatSkillXpByName[template.weaponSkill]`
 * resolves today; ids are stable, so a rename of a competency cannot silently re-point a weapon.
 *
 * The catalogue types ids as plain `string`, so this is a nominal (branded) string. The brand is
 * compile-time only: a bare `string` is not assignable to `CompetencyId`, which forces every
 * producer through `parseCompetencyId`/`CompetencyIdSchema`, a visible and greppable boundary.
 * `@glantri/domain` is the bottom layer and cannot import `@glantri/content`, so this type does
 * NOT prove the id exists in the catalogue; that existence check belongs to the content/importer
 * layer that authors the value.
 *
 * At runtime and on the wire it is an ordinary non-empty string.
 */
export const CompetencyIdSchema = z.string().min(1).brand<"CompetencyId">();

export type CompetencyId = z.infer<typeof CompetencyIdSchema>;

/** The sanctioned way to turn an authored/imported raw id into a {@link CompetencyId}. Throws if empty. */
export function parseCompetencyId(raw: string): CompetencyId {
  return CompetencyIdSchema.parse(raw);
}
