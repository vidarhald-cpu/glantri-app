import { describe, expect, it } from "vitest";

import {
  calculateWorkbookBaseDb,
  calculateWorkbookDefensePair,
  calculateWorkbookBaseMove,
  calculateWorkbookCarryCapacity,
  calculateWorkbookEncumbranceLevel,
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeInitiative,
  calculateWorkbookMeleeOb,
  calculateWorkbookMovement,
  calculateWorkbookMovementModifier,
  getWorkbookStatGm,
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

  it("uses workbook character-sheet GMs for the OB input characteristics", () => {
    expect(getWorkbookStatGm(17)).toBe(3);
    expect(getWorkbookStatGm(11)).toBe(0);
    expect(getWorkbookStatGm(null)).toBeNull();
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
});
