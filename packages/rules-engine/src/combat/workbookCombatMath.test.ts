import { describe, expect, it } from "vitest";

import {
  calculateWorkbookBaseDb,
  calculateWorkbookCombinedParry,
  calculateWorkbookDefensePair,
  calculateWorkbookBaseMove,
  calculateWorkbookCarryCapacity,
  calculateWorkbookEncumbranceLevel,
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeInitiative,
  calculateWorkbookMeleeOb,
  calculateWorkbookProjectileOb,
  calculateWorkbookWeaponParry,
  calculateWorkbookMovement,
  calculateWorkbookMovementModifier,
  getWorkbookStatGm,
  lookupWorkbookPercentageAdjustment,
  lookupWorkbookToHitModifier,
  lookupWorkbookMovementAdjustment,
  lookupWorkbookSkillInitiativeModifier,
} from "./workbookCombatMath";

describe("workbookCombatMath", () => {
  it("matches the workbook's scimitar row for melee OB and DMB", () => {
    const ob = calculateWorkbookMeleeOb({
      dexterityGm: 3,
      skillXp: 15,
      strengthGm: 3,
      weaponOb: 3,
    });
    const dmb = calculateWorkbookMeleeDmb({
      dexterityGm: 3,
      skillXp: 15,
      strengthGm: 3,
      weaponDmb: 3,
      weaponOb: 3,
    });

    expect(ob).toMatchObject({
      adjustment: 4,
      combinedModifier: 3,
      finalOb: 16,
      rawOb: 12,
    });
    expect(dmb).toMatchObject({
      finalDmb: 6,
      rawDmb: 6,
      referenceOb: 16,
    });
  });

  it("matches the workbook's short sword row for melee OB and DMB", () => {
    expect(
      calculateWorkbookMeleeOb({
        dexterityGm: 3,
        skillXp: 15,
        strengthGm: 3,
        weaponOb: 2,
      }),
    ).toMatchObject({
      adjustment: 2,
      combinedModifier: 2,
      finalOb: 14,
      rawOb: 12,
    });
    expect(
      calculateWorkbookMeleeDmb({
        dexterityGm: 3,
        skillXp: 15,
        strengthGm: 3,
        weaponDmb: 2,
        weaponOb: 2,
      }),
    ).toMatchObject({
      finalDmb: 6,
      rawDmb: 5,
      referenceOb: 16,
    });
  });

  it("locks workbook golden rows for representative melee OB and DMB cases", () => {
    const cases = [
      {
        name: "Long sword",
        source:
          "Themistogenes 1.07.xlsx -> Weapon1!A10:O10, Calculations!R19/W19/Z19 formulas",
        weaponOb: 2,
        weaponDmb: 5,
        expected: {
          finalDmb: 9,
          finalOb: 14,
          rawDmb: 8,
          rawOb: 12
        }
      },
      {
        name: "Hand axe",
        source:
          "Themistogenes 1.07.xlsx -> Weapon1!A20:O20, Calculations!R19/W19/Z19 formulas",
        weaponOb: 1,
        weaponDmb: 6,
        expected: {
          finalDmb: 10,
          finalOb: 13,
          rawDmb: 9,
          rawOb: 12
        }
      },
      {
        name: "2-h Spear",
        source:
          "Themistogenes 1.07.xlsx -> Weapon1!A30:O30, Calculations!R19/W19/Z19 formulas",
        weaponOb: 3,
        weaponDmb: 6,
        expected: {
          finalDmb: 9,
          finalOb: 16,
          rawDmb: 9,
          rawOb: 12
        }
      }
    ];

    for (const testCase of cases) {
      const effectiveSkillNumber = 15;
      const ob = calculateWorkbookMeleeOb({
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        strengthGm: 3,
        weaponOb: testCase.weaponOb
      });
      const dmb = calculateWorkbookMeleeDmb({
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        strengthGm: 3,
        weaponDmb: testCase.weaponDmb,
        weaponOb: testCase.weaponOb
      });

      expect.soft(ob, testCase.source).toMatchObject({
        finalOb: testCase.expected.finalOb,
        rawOb: testCase.expected.rawOb
      });
      expect.soft(dmb, testCase.source).toMatchObject({
        finalDmb: testCase.expected.finalDmb,
        rawDmb: testCase.expected.rawDmb
      });
    }
  });

  it("uses total effectiveSkillNumber for workbook melee skill XP input", () => {
    // Source: Themistogenes 1.07.xlsx -> Calculations!Q19/R19/W19.
    // Q19 is the workbook skill XP lookup, and R19 uses ROUND(Q19/2,0).
    const directSkillXpOnly = 4;
    const groupDerivedSkillXp = 11;
    const effectiveSkillNumber = directSkillXpOnly + groupDerivedSkillXp;

    expect(
      calculateWorkbookMeleeOb({
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        strengthGm: 3,
        weaponOb: 3
      })
    ).toMatchObject({
      finalOb: 16,
      rawOb: 12
    });
    expect(
      calculateWorkbookMeleeOb({
        dexterityGm: 3,
        skillXp: directSkillXpOnly,
        strengthGm: 3,
        weaponOb: 3
      })
    ).not.toMatchObject({
      finalOb: 16,
      rawOb: 12
    });
  });

  it("matches the workbook projectile OB pattern for a composite bow style row", () => {
    expect(
      calculateWorkbookProjectileOb({
        armorActivityModifier: 0,
        dexterityGm: 1,
        skillXp: 3,
        weaponOb: 2,
      }),
    ).toMatchObject({
      adjustment: 2,
      combinedModifier: 2,
      finalOb: 6,
      rawOb: 4,
    });
  });

  it("locks workbook golden rows for thrown projectile OB and numeric DMB cases", () => {
    const cases = [
      {
        name: "T. Spear",
        source:
          "Themistogenes 1.07.xlsx -> Weapon2!A10:J10, Calculations!R27/W27/Z27 formulas",
        weaponDmb: 6,
        weaponOb: 2,
        expected: {
          finalDmb: 9,
          finalOb: 13,
          rawOb: 11
        }
      },
      {
        name: "T. Th. dagger",
        source:
          "Themistogenes 1.07.xlsx -> Weapon2!A4:J4, Calculations!R29/W29/Z29 formulas",
        weaponDmb: 0,
        weaponOb: 3,
        expected: {
          finalDmb: 3,
          finalOb: 14,
          rawOb: 11
        }
      }
    ];

    for (const testCase of cases) {
      const effectiveSkillNumber = 13;
      const ob = calculateWorkbookProjectileOb({
        armorActivityModifier: 0,
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        weaponOb: testCase.weaponOb
      });
      const numericThrownDmb = 3 + testCase.weaponDmb;

      expect.soft(ob, testCase.source).toMatchObject({
        finalOb: testCase.expected.finalOb,
        rawOb: testCase.expected.rawOb
      });
      expect.soft(numericThrownDmb, testCase.source).toBe(testCase.expected.finalDmb);
    }
  });

  it("uses total effectiveSkillNumber for workbook projectile skill XP input", () => {
    // Source: Themistogenes 1.07.xlsx -> Calculations!Q27/R27/W27.
    // Q27 is the workbook skill XP lookup, and R27 uses ROUND(Q27/2,0).
    const directSkillXpOnly = 5;
    const groupDerivedSkillXp = 8;
    const effectiveSkillNumber = directSkillXpOnly + groupDerivedSkillXp;

    expect(
      calculateWorkbookProjectileOb({
        armorActivityModifier: 0,
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        weaponOb: 2
      })
    ).toMatchObject({
      finalOb: 13,
      rawOb: 11
    });
    expect(
      calculateWorkbookProjectileOb({
        armorActivityModifier: 0,
        dexterityGm: 3,
        skillXp: directSkillXpOnly,
        weaponOb: 2
      })
    ).not.toMatchObject({
      finalOb: 13,
      rawOb: 11
    });
  });

  it("uses workbook character-sheet GMs for the OB input characteristics", () => {
    expect(getWorkbookStatGm(17)).toBe(3);
    expect(getWorkbookStatGm(11)).toBe(0);
    expect(getWorkbookStatGm(null)).toBeNull();
  });

  it("applies the low-base minimum percentage adjustment to zero-base combat values", () => {
    expect(lookupWorkbookPercentageAdjustment(0, 1)).toBe(1);
    expect(lookupWorkbookPercentageAdjustment(0, 3)).toBe(3);
    expect(lookupWorkbookPercentageAdjustment(0, 10)).toBe(10);
    expect(lookupWorkbookPercentageAdjustment(0, 100)).toBe(100);
    expect(lookupWorkbookPercentageAdjustment(1, 1)).toBe(1);
    expect(lookupWorkbookPercentageAdjustment(2, 1)).toBe(1);
  });

  it("matches the workbook's melee initiative formula for weapon and brawling rows", () => {
    expect(
      calculateWorkbookMeleeInitiative({
        dexterityGm: 3,
        gameModifier: 0,
        skillXp: 15,
        weaponInitiative: 1,
      }),
    ).toMatchObject({
      baseInitiative: 5,
      finalInitiative: 5,
      gameModifier: 0,
      skillModifier: 1,
    });

    expect(
      calculateWorkbookMeleeInitiative({
        dexterityGm: 0,
        gameModifier: 0,
        skillXp: 9,
        weaponInitiative: 0,
      }),
    ).toMatchObject({
      baseInitiative: 0,
      finalInitiative: 0,
      gameModifier: 0,
      skillModifier: 0,
    });
  });

  it("matches the workbook's weapon-row parry formula", () => {
    expect(
      calculateWorkbookWeaponParry({
        armorActivityModifier: 0,
        dexterityGm: 3,
        parrySkillXp: 13,
        weaponParryModifier: -1,
      }),
    ).toMatchObject({
      adjustment: 1,
      combinedModifier: -1,
      finalParry: 10,
      rawParry: 11,
    });

    expect(
      calculateWorkbookWeaponParry({
        armorActivityModifier: 0,
        dexterityGm: 0,
        parrySkillXp: 11,
        weaponParryModifier: 0,
      }),
    ).toMatchObject({
      adjustment: 0,
      combinedModifier: 0,
      finalParry: 7,
      rawParry: 7,
    });

    expect(
      calculateWorkbookWeaponParry({
        armorActivityModifier: 0,
        dexterityGm: 0,
        parrySkillXp: 11,
        weaponParryModifier: 5,
      }),
    ).toMatchObject({
      adjustment: 5,
      combinedModifier: 5,
      finalParry: 12,
      rawParry: 7,
    });
  });

  it("applies armor AA once globally after summing minimum-1 item parry contributions", () => {
    expect(
      calculateWorkbookCombinedParry({
        armorActivityModifier: 2,
        dexterityGm: 0,
        offHandParryModifier: 5,
        parrySkillXp: 11,
        primaryParryModifier: 0,
      }),
    ).toMatchObject({
      primaryContribution: 1,
      offHandContribution: 5,
      combinedModifier: 8,
      adjustment: 8,
      finalParry: 15,
      rawParry: 7,
    });
  });

  it("looks up the workbook skill initiative modifier table faithfully", () => {
    expect(lookupWorkbookSkillInitiativeModifier(0)).toBe(0);
    expect(lookupWorkbookSkillInitiativeModifier(6)).toBe(0);
    expect(lookupWorkbookSkillInitiativeModifier(10)).toBe(0);
    expect(lookupWorkbookSkillInitiativeModifier(11)).toBe(1);
    expect(lookupWorkbookSkillInitiativeModifier(15)).toBe(1);
    expect(lookupWorkbookSkillInitiativeModifier(16)).toBe(2);
    expect(lookupWorkbookSkillInitiativeModifier(20)).toBe(2);
    expect(lookupWorkbookSkillInitiativeModifier(31)).toBe(5);
    expect(lookupWorkbookSkillInitiativeModifier(32)).toBeNull();
  });

  it("returns initiative 1 for dex gm 1, skill 6, weapon initiative 0", () => {
    expect(
      calculateWorkbookMeleeInitiative({
        dexterityGm: 1,
        gameModifier: 0,
        skillXp: 6,
        weaponInitiative: 0,
      }),
    ).toMatchObject({
      baseInitiative: 1,
      finalInitiative: 1,
      gameModifier: 0,
      skillModifier: 0,
    });
  });

  it("matches the workbook's encumbrance level and movement chain for the sample carried load", () => {
    const carryCapacity = calculateWorkbookCarryCapacity({
      constitution: 11,
      size: 13,
      strength: 17,
    });
    const encumbrance = calculateWorkbookEncumbranceLevel({
      carryCapacity,
      totalEncumbrance: 32.66666666658,
    });

    expect(carryCapacity).toBe(36);
    expect(encumbrance).toMatchObject({
      carryCapacity: 36,
      encumbranceLevel: 4,
      encumbrancePercent: 91,
      totalEncumbrance: 32.66666666658,
    });

    const movementModifier = calculateWorkbookMovementModifier({
      encumbranceLevel: encumbrance!.encumbranceLevel,
      shieldMovementModifier: 2,
    });
    const baseMove = calculateWorkbookBaseMove({
      dexterityGm: 0,
      sizeGm: 1,
      strengthGm: 3,
    });

    expect(movementModifier).toBe(4);
    expect(baseMove).toBe(14);
    expect(lookupWorkbookMovementAdjustment(baseMove, movementModifier)).toBe(6);
    expect(
      calculateWorkbookMovement({
        baseMove,
        movementModifier,
      }),
    ).toBe(8);
  });

  it("keeps lighter and heavier loads in different encumbrance bands", () => {
    expect(
      calculateWorkbookEncumbranceLevel({
        carryCapacity: 40,
        totalEncumbrance: 8,
      }),
    ).toMatchObject({
      encumbranceLevel: 0,
      encumbrancePercent: 20,
    });

    expect(
      calculateWorkbookEncumbranceLevel({
        carryCapacity: 40,
        totalEncumbrance: 60.4,
      }),
    ).toMatchObject({
      encumbranceLevel: 6,
      encumbrancePercent: 151,
    });
  });

  it("maps the workbook to-hit modifier table faithfully", () => {
    expect(lookupWorkbookToHitModifier(0)).toBe(2);
    expect(lookupWorkbookToHitModifier(3)).toBe(0);
    expect(lookupWorkbookToHitModifier(4)).toBe(0);
    expect(lookupWorkbookToHitModifier(5)).toBe(-1);
    expect(lookupWorkbookToHitModifier(15)).toBe(-6);
    expect(lookupWorkbookToHitModifier(16)).toBeNull();
  });

  it("matches the workbook defense chain for unarmed, one-item, and two-item cases", () => {
    const baseDb = calculateWorkbookBaseDb({
      dexterityGm: 0,
      dodgeSkillXp: 15,
    });
    const toHitModifier = lookupWorkbookToHitModifier(4);

    expect(baseDb).toBe(12);
    expect(toHitModifier).toBe(0);

    expect(
      calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: 0,
        toHitModifier,
      }),
    ).toMatchObject({
      db: 12,
      dm: 0,
      noToHitDb: 12,
    });

    expect(
      calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: 5,
        toHitModifier,
      }),
    ).toMatchObject({
      db: 18,
      dm: 0,
      noToHitDb: 18,
    });

    expect(
      calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: 6,
        toHitModifier,
      }),
    ).toMatchObject({
      db: 19,
      dm: 0,
      noToHitDb: 19,
    });
  });

  it("matches the worksheet example for no weapon, shield, and longsword defense", () => {
    const baseDb = calculateWorkbookBaseDb({
      dexterityGm: 1,
      dodgeSkillXp: 10,
    });
    const toHitModifier = lookupWorkbookToHitModifier(4);

    expect(baseDb).toBe(10);
    expect(toHitModifier).toBe(0);

    expect(
      calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: 0,
        toHitModifier,
      }),
    ).toMatchObject({
      db: 10,
      dm: 0,
    });

    expect(
      calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: 5,
        toHitModifier,
      }),
    ).toMatchObject({
      db: 15,
      dm: 0,
    });

    expect(
      calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: 1,
        toHitModifier,
      }),
    ).toMatchObject({
      db: 11,
      dm: 0,
    });
  });
});
