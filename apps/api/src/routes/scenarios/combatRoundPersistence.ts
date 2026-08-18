import { isDeepStrictEqual } from "node:util";

import type { CombatRoundState } from "@glantri/domain";

function toPersistedJsonShape(value: CombatRoundState | undefined): unknown {
  return JSON.parse(JSON.stringify(value ?? null)) as unknown;
}

/**
 * Compares round state using the semantics of the JSON column that persists it.
 *
 * Domain materialization may add optional properties whose value is `undefined`, while Prisma's
 * JSON serialization omits those properties. Object insertion order can also change on schema
 * parsing. Neither difference is a persisted combat-state change and neither may trigger a
 * read-side repair write.
 */
export function combatRoundStatesDiffer(
  left: CombatRoundState | undefined,
  right: CombatRoundState | undefined,
): boolean {
  return !isDeepStrictEqual(toPersistedJsonShape(left), toPersistedJsonShape(right));
}
