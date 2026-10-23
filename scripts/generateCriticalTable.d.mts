/**
 * Types for the reader labels `scripts/generateCriticalTable.mjs` exports.
 *
 * The labels live in the generator because it is what publishes them, and
 * `apps/web/app/(app)/admin/rules-docs/criticalTable.test.ts` imports them so the section headings
 * on the published page have exactly one definition rather than a copy in the conformance suite.
 */

/** Reader label for each Critical family, keyed by the family as the authoritative data spells it. */
export const FAMILY_LABELS: Record<string, string>;

/** Reader label for each Critical location, keyed by the location in the authoritative data. */
export const LOCATION_LABELS: Record<string, string>;
