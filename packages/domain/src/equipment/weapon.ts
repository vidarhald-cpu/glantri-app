import { z } from "zod";

import type { WeaponAttackMode } from "./types";

export const weaponSchema = z.object({
  baseOb: z.number(),
  id: z.string(),
  name: z.string()
});

export type Weapon = z.infer<typeof weaponSchema>;

/** Same-source Double Attack is opt-in and restricted to an explicit melee thrust mode. */
export function canRepeatWeaponAttackInRound(
  mode: Pick<WeaponAttackMode, "allowsRepeatedRoundAttack" | "canonicalMeleeMode"> | undefined,
): boolean {
  return mode?.allowsRepeatedRoundAttack === true && mode.canonicalMeleeMode === "thrust";
}
