import { describe, expect, it } from "vitest";

import {
  calculateWorkbookMeleeDmb,
  calculateWorkbookMeleeOb,
  getWorkbookStatGm,
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
});
