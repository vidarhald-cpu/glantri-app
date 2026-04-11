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
});
