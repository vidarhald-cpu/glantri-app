import { describe, expect, it } from "vitest";

import { gearTemplatesById } from "./gearTemplates";
import { weaponTemplatesById } from "./weaponTemplates";

const expected = [
  ["weapon-template-sling", 12, "Sling", 1, "2d6", -4, "3.0", "A", "CC", 1, "sling", 2],
  ["weapon-template-bow", 14, "Bow", 3, "2d6", -1, "3.0", "A", "DP", 5, "short_bow", 1],
  [
    "weapon-template-composite-bow",
    15,
    "Bow",
    2,
    "2d6 + GMstr",
    -2,
    "3.0",
    "C",
    "EP",
    8,
    "composite_bow",
    1,
  ],
  [
    "weapon-template-long-bow",
    17,
    "Longbow",
    2,
    "3d6 + GMstr",
    -4,
    "4.0",
    "E",
    "FP as",
    12,
    "long_bow",
    1,
  ],
  [
    "weapon-template-hand-crossbow",
    26,
    "Crossbow",
    2,
    "1d8",
    3,
    "1.0",
    "B",
    "DP",
    4,
    "hand_crossbow",
    3,
  ],
  ["weapon-template-crossbow", 28, "Crossbow", 3, "2d8+1", 2, "3.0", "D", "FP", 9, "crossbow", 7],
  [
    "weapon-template-heavy-crossbow",
    29,
    "Crossbow",
    2,
    "3d8+1",
    1,
    "4.0",
    "E",
    "FP ac",
    12,
    "heavy_crossbow",
    9,
  ],
] as const;

describe("Missile Weapons V1 canonical content", () => {
  it.each(expected)(
    "preserves %s Weapon2 row and mode provenance",
    (id, row, skill, ob, dmb, initiative, range, armor, crit, encumbrance, family, rounds) => {
      const weapon = weaponTemplatesById[id]!;
      const mode = weapon.attackModes?.[0];
      expect(mode).toBeDefined();
      if (!mode) throw new Error(`${id} is missing its missile mode.`);
      expect(weapon).toMatchObject({ baseEncumbrance: encumbrance, weaponSkill: skill });
      expect(mode).toMatchObject({
        attackType: "missile",
        armorModifier: armor,
        crit,
        initiative,
        ob,
        range,
        dmbRaw: dmb,
      });
      expect(mode.sourceMetadata).toMatchObject({
        workbook: "Themistogenes 1.07.xlsx",
        sheet: "Weapon2",
        row,
        sourceRange: `Weapon2!A${row}:K${row}`,
      });
      expect(weapon.missileProfile).toMatchObject({ family, standardPreparationRounds: rounds });
    },
  );

  it("defines explicit ammunition compatibility while keeping quivers non-authoritative", () => {
    expect(gearTemplatesById["gear-template-arrows"]).toMatchObject({
      equipmentRole: "ammunition",
      ammunitionProfile: { family: "arrow", quantityPerShot: 1 },
    });
    expect(gearTemplatesById["gear-template-crossbow-bolts"]).toMatchObject({
      equipmentRole: "ammunition",
      ammunitionProfile: { family: "crossbow_bolt", quantityPerShot: 1 },
    });
    expect(gearTemplatesById["gear-template-sling-projectiles"]).toMatchObject({
      equipmentRole: "ammunition",
      ammunitionProfile: { family: "sling_projectile", quantityPerShot: 1 },
    });
    expect(gearTemplatesById["gear-template-quiver"]).toMatchObject({
      equipmentRole: "ammunition_container",
      ammunitionProfile: null,
    });
  });
});
