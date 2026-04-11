import { describe, expect, it } from "vitest";

import {
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeInitiative,
  calculateWorkbookMeleeOb,
  getWorkbookStatGm,
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
      baseInitiative: 6,
      finalInitiative: 6,
      gameModifier: 0,
      skillModifier: 2,
    });

    expect(
      calculateWorkbookMeleeInitiative({
        dexterityGm: 0,
        gameModifier: 0,
        skillXp: 9,
        weaponInitiative: 0,
      }),
    ).toMatchObject({
      baseInitiative: -1,
      finalInitiative: -1,
      gameModifier: 0,
      skillModifier: -1,
    });
  });

  it("looks up the workbook skill initiative modifier table faithfully", () => {
    expect(lookupWorkbookSkillInitiativeModifier(1)).toBe(-5);
    expect(lookupWorkbookSkillInitiativeModifier(9)).toBe(-1);
    expect(lookupWorkbookSkillInitiativeModifier(15)).toBe(2);
    expect(lookupWorkbookSkillInitiativeModifier(25)).toBe(7);
    expect(lookupWorkbookSkillInitiativeModifier(26)).toBeNull();
  });
});
