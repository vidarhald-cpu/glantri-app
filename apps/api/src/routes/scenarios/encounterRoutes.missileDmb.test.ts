import { weaponTemplates } from "@glantri/content";
import { describe, expect, it } from "vitest";

import { rollMissileWeaponDmbSnapshot } from "./encounterRoutes";

const cases = [
  ["weapon-template-sling", 12, 2, 6, 0, false, 2],
  ["weapon-template-bow", 14, 2, 6, 0, false, 2],
  ["weapon-template-composite-bow", 15, 2, 6, 0, true, 6],
  ["weapon-template-long-bow", 17, 3, 6, 0, true, 7],
  ["weapon-template-hand-crossbow", 26, 1, 8, 0, false, 1],
  ["weapon-template-crossbow", 28, 2, 8, 1, false, 3],
  ["weapon-template-heavy-crossbow", 29, 3, 8, 1, false, 4],
] as const;

describe("Missile Weapons V1 DMB snapshots", () => {
  it.each(cases)(
    "evaluates %s from Weapon2 row %i once with exact provenance",
    (templateId, row, diceCount, diceSides, flatModifier, usesStrength, total) => {
      const template = weaponTemplates.find((candidate) => candidate.id === templateId);
      const mode = template?.attackModes?.[0];
      expect(mode?.dmbFormula).toBeDefined();
      if (!mode?.dmbFormula) throw new Error(`${templateId} has no DMB formula.`);

      const snapshot = rollMissileWeaponDmbSnapshot({
        formula: mode.dmbFormula,
        randomFn: () => 0,
        raw: mode.dmbRaw ?? undefined,
        sourceMetadata: mode.sourceMetadata ?? undefined,
        strengthGm: 4,
      });

      expect(snapshot).toEqual({
        diceCount,
        diceSides,
        flatModifier,
        ...(usesStrength ? { gmStrengthModifier: 4 } : {}),
        provenance: `Weapon2:${row}:${mode.dmbRaw}`,
        rolls: Array.from({ length: diceCount }, () => 1),
        total,
      });
    },
  );
});
