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
  calculateWorkbookPercentageAdjustmentTrace,
  calculateWorkbookMovement,
  calculateWorkbookMovementModifier,
  getWorkbookStatGm,
  lookupWorkbookPercentageAdjustment,
  lookupWorkbookToHitModifier,
  lookupWorkbookMovementAdjustment,
  lookupWorkbookSkillInitiativeModifier,
  resolveWorkbookPercentageAdjustment,
  WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE,
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
        source: "Themistogenes 1.07.xlsx -> Weapon1!A10:O10, Calculations!R19/W19/Z19 formulas",
        weaponOb: 2,
        weaponDmb: 5,
        expected: {
          finalDmb: 9,
          finalOb: 14,
          rawDmb: 8,
          rawOb: 12,
        },
      },
      {
        name: "Hand axe",
        source: "Themistogenes 1.07.xlsx -> Weapon1!A20:O20, Calculations!R19/W19/Z19 formulas",
        weaponOb: 1,
        weaponDmb: 6,
        expected: {
          finalDmb: 10,
          finalOb: 13,
          rawDmb: 9,
          rawOb: 12,
        },
      },
      {
        name: "2-h Spear",
        source: "Themistogenes 1.07.xlsx -> Weapon1!A30:O30, Calculations!R19/W19/Z19 formulas",
        weaponOb: 3,
        weaponDmb: 6,
        expected: {
          finalDmb: 9,
          finalOb: 16,
          rawDmb: 9,
          rawOb: 12,
        },
      },
    ];

    for (const testCase of cases) {
      const effectiveSkillNumber = 15;
      const ob = calculateWorkbookMeleeOb({
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        strengthGm: 3,
        weaponOb: testCase.weaponOb,
      });
      const dmb = calculateWorkbookMeleeDmb({
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        strengthGm: 3,
        weaponDmb: testCase.weaponDmb,
        weaponOb: testCase.weaponOb,
      });

      expect.soft(ob, testCase.source).toMatchObject({
        finalOb: testCase.expected.finalOb,
        rawOb: testCase.expected.rawOb,
      });
      expect.soft(dmb, testCase.source).toMatchObject({
        finalDmb: testCase.expected.finalDmb,
        rawDmb: testCase.expected.rawDmb,
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
        weaponOb: 3,
      }),
    ).toMatchObject({
      finalOb: 16,
      rawOb: 12,
    });
    expect(
      calculateWorkbookMeleeOb({
        dexterityGm: 3,
        skillXp: directSkillXpOnly,
        strengthGm: 3,
        weaponOb: 3,
      }),
    ).not.toMatchObject({
      finalOb: 16,
      rawOb: 12,
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
        source: "Themistogenes 1.07.xlsx -> Weapon2!A10:J10, Calculations!R27/W27/Z27 formulas",
        weaponDmb: 6,
        weaponOb: 2,
        expected: {
          finalDmb: 9,
          finalOb: 13,
          rawOb: 11,
        },
      },
      {
        name: "T. Th. dagger",
        source: "Themistogenes 1.07.xlsx -> Weapon2!A4:J4, Calculations!R29/W29/Z29 formulas",
        weaponDmb: 0,
        weaponOb: 3,
        expected: {
          finalDmb: 3,
          finalOb: 14,
          rawOb: 11,
        },
      },
    ];

    for (const testCase of cases) {
      const effectiveSkillNumber = 13;
      const ob = calculateWorkbookProjectileOb({
        armorActivityModifier: 0,
        dexterityGm: 3,
        skillXp: effectiveSkillNumber,
        weaponOb: testCase.weaponOb,
      });
      const numericThrownDmb = 3 + testCase.weaponDmb;

      expect.soft(ob, testCase.source).toMatchObject({
        finalOb: testCase.expected.finalOb,
        rawOb: testCase.expected.rawOb,
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
        weaponOb: 2,
      }),
    ).toMatchObject({
      finalOb: 13,
      rawOb: 11,
    });
    expect(
      calculateWorkbookProjectileOb({
        armorActivityModifier: 0,
        dexterityGm: 3,
        skillXp: directSkillXpOnly,
        weaponOb: 2,
      }),
    ).not.toMatchObject({
      finalOb: 13,
      rawOb: 11,
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

  it("returns a trace for summed raw percentage modifiers", () => {
    expect(
      calculateWorkbookPercentageAdjustmentTrace({
        baseValue: 10,
        rawModifiers: [
          { label: "equipment", value: 5 },
          { label: "live DB", value: -1 },
        ],
      }),
    ).toEqual({
      baseValue: 10,
      extrapolated: false,
      extrapolatedAxes: [],
      finalValue: 14,
      percentageAdjustment: 4,
      rawModifierTotal: 4,
      rawModifiers: [
        { label: "equipment", value: 5 },
        { label: "live DB", value: -1 },
      ],
    });
  });

  it("sums live raw modifiers into melee OB before one percentage lookup", () => {
    const ob = calculateWorkbookMeleeOb({
      dexterityGm: 3,
      rawModifiers: [
        { label: "Gen/Fatigue", value: -1 },
        { label: "OB/Skill", value: 2 },
      ],
      skillXp: 15,
      strengthGm: 3,
      weaponOb: 3,
    });

    expect(ob).toMatchObject({
      adjustment: 5,
      combinedModifier: 4,
      finalOb: 17,
      rawOb: 12,
      trace: {
        baseValue: 12,
        finalValue: 17,
        percentageAdjustment: 5,
        rawModifierTotal: 4,
      },
    });
    expect(ob?.trace.rawModifiers).toEqual([
      { label: "armor activity", value: 0 },
      { label: "weapon OB", value: 3 },
      { label: "Gen/Fatigue", value: -1 },
      { label: "OB/Skill", value: 2 },
    ]);
  });

  it("traces the broad-sword-style OB 12 to live OB 11 calculation", () => {
    const theoretical = calculateWorkbookMeleeOb({
      dexterityGm: 2,
      skillXp: 9,
      strengthGm: 4,
      weaponOb: 2,
    });
    const live = calculateWorkbookMeleeOb({
      dexterityGm: 2,
      rawModifiers: [{ label: "Gen/Fatigue", value: -1 }],
      skillXp: 9,
      strengthGm: 4,
      weaponOb: 2,
    });

    expect(theoretical).toMatchObject({
      adjustment: 2,
      combinedModifier: 2,
      finalOb: 12,
      rawOb: 10,
      trace: {
        baseValue: 10,
        finalValue: 12,
        percentageAdjustment: 2,
        rawModifierTotal: 2,
      },
    });
    expect(live).toMatchObject({
      adjustment: 1,
      combinedModifier: 1,
      finalOb: 11,
      rawOb: 10,
      trace: {
        baseValue: 10,
        finalValue: 11,
        percentageAdjustment: 1,
        rawModifierTotal: 1,
      },
    });
    expect(live?.trace.rawModifiers).toEqual([
      { label: "armor activity", value: 0 },
      { label: "weapon OB", value: 2 },
      { label: "Gen/Fatigue", value: -1 },
    ]);
  });

  it("documents percentage helper behavior around bases 10, 11, and 12", () => {
    expect(lookupWorkbookPercentageAdjustment(12, 1)).toBe(1);
    expect(lookupWorkbookPercentageAdjustment(11, 1)).toBe(1);
    expect(lookupWorkbookPercentageAdjustment(10, 1)).toBe(1);
    expect(
      calculateWorkbookPercentageAdjustmentTrace({
        baseValue: 12,
        rawModifiers: [{ label: "signed raw", value: -1 }],
      })?.finalValue,
    ).toBe(11);
    expect(
      calculateWorkbookPercentageAdjustmentTrace({
        baseValue: 11,
        rawModifiers: [{ label: "signed raw", value: -1 }],
      })?.finalValue,
    ).toBe(10);
    expect(
      calculateWorkbookPercentageAdjustmentTrace({
        baseValue: 10,
        rawModifiers: [{ label: "signed raw", value: -1 }],
      })?.finalValue,
    ).toBe(9);
  });

  it("sums live raw modifiers into parry before one percentage lookup", () => {
    const parry = calculateWorkbookWeaponParry({
      armorActivityModifier: 0,
      dexterityGm: 3,
      parrySkillXp: 13,
      rawModifiers: [{ label: "Gen/Fatigue", value: -1 }],
      weaponParryModifier: -1,
    });

    expect(parry).toMatchObject({
      adjustment: 2,
      combinedModifier: -2,
      finalParry: 9,
      rawParry: 11,
      trace: {
        baseValue: 11,
        finalValue: 9,
        percentageAdjustment: 2,
        rawModifierTotal: -2,
      },
    });
    expect(parry?.trace.rawModifiers).toEqual([
      { label: "armor activity", value: 0 },
      { label: "weapon parry", value: -1 },
      { label: "Gen/Fatigue", value: -1 },
    ]);
  });

  it("traces summed raw modifiers for live combat skill rows", () => {
    expect(
      calculateWorkbookPercentageAdjustmentTrace({
        baseValue: 20,
        rawModifiers: [
          { label: "Gen/Fatigue + OB/Skill", value: -1 },
          { label: "Enc", value: -4 },
        ],
      }),
    ).toEqual({
      baseValue: 20,
      extrapolated: false,
      extrapolatedAxes: [],
      finalValue: 10,
      percentageAdjustment: 10,
      rawModifierTotal: -5,
      rawModifiers: [
        { label: "Gen/Fatigue + OB/Skill", value: -1 },
        { label: "Enc", value: -4 },
      ],
    });
  });

  it("documents the percentage adjustment comparison matrix for representative bases", () => {
    const cases = [
      { baseValue: 0, rawModifier: -1, expectedFinal: -1 },
      { baseValue: 5, rawModifier: -1, expectedFinal: 4 },
      { baseValue: 14, rawModifier: -1, expectedFinal: 13 },
      { baseValue: 15, rawModifier: -1, expectedFinal: 13 },
      { baseValue: 25, rawModifier: -1, expectedFinal: 22 },
      { baseValue: 0, rawModifier: 1, expectedFinal: 1 },
      { baseValue: 5, rawModifier: 1, expectedFinal: 6 },
      { baseValue: 14, rawModifier: 1, expectedFinal: 15 },
      { baseValue: 15, rawModifier: 1, expectedFinal: 17 },
      { baseValue: 15, rawModifier: 2, expectedFinal: 18 },
      { baseValue: 25, rawModifier: 1, expectedFinal: 28 },
    ];

    for (const testCase of cases) {
      expect
        .soft(
          calculateWorkbookPercentageAdjustmentTrace({
            baseValue: testCase.baseValue,
            rawModifiers: [{ label: "test modifier", value: testCase.rawModifier }],
          })?.finalValue,
          `base ${testCase.baseValue}, raw ${testCase.rawModifier}`,
        )
        .toBe(testCase.expectedFinal);
    }
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

  it("sums extra defense raw modifiers before applying the workbook percentage table", () => {
    const baseDb = calculateWorkbookBaseDb({
      dexterityGm: 1,
      dodgeSkillXp: 10,
    });
    const shield = calculateWorkbookDefensePair({
      baseDb,
      equipmentModifier: 5,
      rawModifiers: [{ label: "live DB", value: -1 }],
      toHitModifier: 0,
    });
    const combined = calculateWorkbookDefensePair({
      baseDb,
      equipmentModifier: 6,
      rawModifiers: [{ label: "live DB", value: -1 }],
      toHitModifier: 0,
    });

    expect(baseDb).toBe(10);
    expect(shield?.db).toBe(14);
    expect(combined?.db).toBe(15);
    expect(combined?.db).toBeGreaterThan(shield?.db ?? 0);
    expect(combined?.fullTrace.rawModifiers).toEqual([
      { label: "equipment", value: 6 },
      { label: "live DB", value: -1 },
      { label: "to-hit", value: 0 },
    ]);
  });
});

/**
 * Forgejo #922. The authored grid is an illustration of an open-ended rule, so the lookup resolves
 * past its edges and says when it did.
 *
 * The rule is written out a second time in this file, by hand, and is **not** imported from the
 * module under test. That is the whole point of the conformance test below: inside the authored
 * grid `lookupWorkbookPercentageAdjustment` returns the authored cell, so comparing it against this
 * independent restatement compares the rule against the authored data, cell by cell, rather than
 * comparing the production rule with itself. Outside the grid both sides are rules, and the
 * comparison pins the production continuation to the one derived here.
 *
 * The rule restated here is also the source sheet's own arithmetic:
 * `data/raw/glantri/Themistogenes 1.07.xlsx`, sheet `Prosent`, carries `=ROUND(B$4*$A16/10,0)` in
 * `B16:H57` and `=$H16+I$4-7` in `I16:P57`, with bases 0 to 10 authored as literal values that
 * supply the one-point-per-step floor.
 *
 * Mutating either side fails these tests, which is what makes them a guard rather than a label:
 * change the rounding here (or there) to half-even and the 750-cell conformance test fails on base
 * 13 step 5 among others; change the continuation past step 7 and it fails across every row.
 */
describe("#922 the percentage-adjustment lookup is open-ended and flags every extrapolation", () => {
  const AUTHORED_MAX_BASE = 49;
  const AUTHORED_MAX_STEP = 15;
  const PROPORTIONAL_STEP_LIMIT = 7;

  /** Ten percent of the base per raw step, half up, floored at one point per step; +1 past step 7. */
  function derivedRule(base: number, step: number): number {
    const proportional = (steps: number): number =>
      Math.max(steps, Math.floor((steps * base * 2 + 10) / 20));

    return step <= PROPORTIONAL_STEP_LIMIT
      ? proportional(step)
      : proportional(PROPORTIONAL_STEP_LIMIT) + (step - PROPORTIONAL_STEP_LIMIT);
  }

  const authoredBases = Object.keys(WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE)
    .map((key) => Number(key))
    .sort((left, right) => left - right);

  it("reads the authored grid as 50 base rows of 15 steps, 750 cells", () => {
    expect(authoredBases).toEqual(Array.from({ length: 50 }, (_unused, index) => index));
    for (const base of authoredBases) {
      expect(
        Object.keys(WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[base]!).map((key) => Number(key)),
        `base ${base}`,
      ).toEqual(Array.from({ length: AUTHORED_MAX_STEP }, (_unused, index) => index + 1));
    }
    expect(
      authoredBases.reduce(
        (total, base) => total + Object.keys(WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[base]!).length,
        0,
      ),
    ).toBe(750);
  });

  it("reproduces every authored cell the lookup trusts, and only the bad-import row differs", () => {
    const disagreements: Array<{ authored: number; base: number; rule: number; step: number }> = [];

    for (const base of authoredBases) {
      for (let step = 1; step <= AUTHORED_MAX_STEP; step += 1) {
        const authored = WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[base]![step]!;
        const rule = derivedRule(base, step);

        // What the lookup actually returns inside the grid, which is the authored cell for every
        // base the file treats as trustworthy and the documented override for base 0.
        expect(lookupWorkbookPercentageAdjustment(base, step), `lookup ${base}/${step}`).toBe(
          base === 0 ? step : authored,
        );

        if (authored !== rule) {
          disagreements.push({ authored, base, rule, step });
        } else {
          expect(rule, `rule ${base}/${step}`).toBe(authored);
        }
      }
    }

    // The 15 cells the rule does not reproduce are the whole base-0 row: the bad import the file's
    // own comment names, which the lookup already overrode by hand before #922. The rule predicts
    // that override exactly, so there is no authored cell the lookup trusts that it fails to
    // reproduce.
    expect(disagreements.map(({ base, step }) => `${base}/${step}`)).toEqual(
      Array.from({ length: AUTHORED_MAX_STEP }, (_unused, index) => `0/${index + 1}`),
    );
    for (const disagreement of disagreements) {
      expect(disagreement.authored).toBe(0);
      expect(disagreement.rule).toBe(disagreement.step);
      expect(lookupWorkbookPercentageAdjustment(0, disagreement.step)).toBe(disagreement.rule);
    }
  });

  it("marks no figure read from an authored cell as extrapolated", () => {
    for (const base of authoredBases) {
      for (let step = 1; step <= AUTHORED_MAX_STEP; step += 1) {
        expect(resolveWorkbookPercentageAdjustment(base, step), `${base}/${step}`).toEqual({
          extrapolated: false,
          extrapolatedAxes: [],
          value: base === 0 ? step : WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[base]![step]!,
        });
      }
    }
  });

  it("resolves past the modifier edge instead of returning nothing, and flags the axis", () => {
    expect(resolveWorkbookPercentageAdjustment(9, AUTHORED_MAX_STEP)).toEqual({
      extrapolated: false,
      extrapolatedAxes: [],
      value: WORKBOOK_PERCENTAGE_ADJUSTMENT_TABLE[9]![AUTHORED_MAX_STEP]!,
    });

    for (const step of [16, 20, 31, 64]) {
      expect(resolveWorkbookPercentageAdjustment(9, step), `step ${step}`).toEqual({
        extrapolated: true,
        extrapolatedAxes: ["modifier"],
        value: derivedRule(9, step),
      });
    }

    // The measured #922 case: base DB 9 against a committed raw total of 20.
    expect(lookupWorkbookPercentageAdjustment(9, 20)).toBe(derivedRule(9, 20));
    expect(lookupWorkbookPercentageAdjustment(9, 20)).not.toBeNull();
  });

  it("resolves past the base edge, and names both axes when a figure runs past both", () => {
    for (const base of [50, 51, 60, 97, 240]) {
      expect(resolveWorkbookPercentageAdjustment(base, 7), `base ${base}`).toEqual({
        extrapolated: true,
        extrapolatedAxes: ["base"],
        value: derivedRule(base, 7),
      });
    }

    expect(resolveWorkbookPercentageAdjustment(60, 20)).toEqual({
      extrapolated: true,
      extrapolatedAxes: ["base", "modifier"],
      value: derivedRule(60, 20),
    });
  });

  it("flags base 0 past the modifier edge, where the authored row is the bad import", () => {
    expect(resolveWorkbookPercentageAdjustment(0, AUTHORED_MAX_STEP)).toEqual({
      extrapolated: false,
      extrapolatedAxes: [],
      value: AUTHORED_MAX_STEP,
    });
    expect(resolveWorkbookPercentageAdjustment(0, 100)).toEqual({
      extrapolated: true,
      extrapolatedAxes: ["modifier"],
      value: 100,
    });
  });

  it("still refuses an input the rule has no reading of, and that refusal is not the grid's edge", () => {
    // A negative base is a third edge, below the grid rather than past it. #922 does not invent a
    // reading for it, so the lookup keeps saying it has none.
    expect(resolveWorkbookPercentageAdjustment(-1, 4)).toBeNull();
    expect(lookupWorkbookPercentageAdjustment(-1, 4)).toBeNull();
    expect(resolveWorkbookPercentageAdjustment(9.5, 4)).toBeNull();
    expect(resolveWorkbookPercentageAdjustment(9, 4.5)).toBeNull();
    expect(resolveWorkbookPercentageAdjustment(9, -4)).toBeNull();
    // Zero raw modifiers is no adjustment at all, at any base, including one off the grid.
    expect(resolveWorkbookPercentageAdjustment(400, 0)).toEqual({
      extrapolated: false,
      extrapolatedAxes: [],
      value: 0,
    });
  });

  it("negative control — a silent clamp at the modifier edge is not this rule", () => {
    // The mutation this guards against: returning the step-15 cell for every larger step. Each
    // assertion below fails under that mutation, and the first one fails under any clamp at all.
    const atEdge = lookupWorkbookPercentageAdjustment(9, AUTHORED_MAX_STEP)!;
    for (const step of [16, 17, 25]) {
      expect(lookupWorkbookPercentageAdjustment(9, step), `step ${step}`).toBe(
        atEdge + (step - AUTHORED_MAX_STEP),
      );
      expect(lookupWorkbookPercentageAdjustment(9, step)).not.toBe(atEdge);
    }

    // The same clamp on the base axis: base 50 and above are not base 49.
    expect(lookupWorkbookPercentageAdjustment(60, 7)).not.toBe(
      lookupWorkbookPercentageAdjustment(AUTHORED_MAX_BASE, 7),
    );
    expect(lookupWorkbookPercentageAdjustment(60, 7)).toBe(42);
  });

  it("negative control — a continuation that is not the derived rule is rejected", () => {
    // Mutation A: resume the proportional part past step 15 instead of adding one per step.
    // At base 49 that would read 49 * 20 / 10 = 98 rather than 47.
    expect(lookupWorkbookPercentageAdjustment(49, 20)).toBe(47);
    expect(lookupWorkbookPercentageAdjustment(49, 20)).not.toBe(98);

    // Mutation B: two points per step past the edge. At base 9 step 25 that reads 35, not 25.
    expect(lookupWorkbookPercentageAdjustment(9, 25)).toBe(25);
    expect(lookupWorkbookPercentageAdjustment(9, 25)).not.toBe(35);

    // Mutation C: the base axis continued by the last authored row's step instead of the rule.
    // Base 97 at step 3 is 29 under the rule; a per-step continuation from base 49 would read 15.
    expect(lookupWorkbookPercentageAdjustment(97, 3)).toBe(29);

    // Mutation D: round half even, or truncate, instead of half up. Base 55 step 1 is 6, not 5.
    expect(lookupWorkbookPercentageAdjustment(55, 1)).toBe(6);
    expect(lookupWorkbookPercentageAdjustment(50, 7)).toBe(35);

    // Mutation E: drop the one-point-per-step floor. A base of 1 still moves by its raw steps.
    expect(lookupWorkbookPercentageAdjustment(1, 7)).toBe(7);
    expect(lookupWorkbookPercentageAdjustment(300, 7)).toBe(210);
  });

  it("negative control — an extrapolated figure that carries no flag fails", () => {
    // The mutation this guards against: resolving past the grid and reporting `extrapolated:
    // false`, which would turn a loud wrong refusal into a quiet unverified figure.
    const pastEdge = resolveWorkbookPercentageAdjustment(9, 20)!;
    expect(pastEdge.extrapolated).toBe(true);
    expect(pastEdge.extrapolatedAxes).not.toEqual([]);

    const trace = calculateWorkbookPercentageAdjustmentTrace({
      baseValue: 9,
      rawModifiers: [
        { label: "committed damage", value: -12 },
        { label: "committed damage", value: -8 },
      ],
    });

    expect(trace).not.toBeNull();
    expect(trace?.rawModifierTotal).toBe(-20);
    expect(trace?.extrapolated).toBe(true);
    expect(trace?.extrapolatedAxes).toEqual(["modifier"]);
    expect(trace?.percentageAdjustment).toBe(lookupWorkbookPercentageAdjustment(9, 20));
    expect(trace?.finalValue).toBe(9 - trace!.percentageAdjustment);

    const inGrid = calculateWorkbookPercentageAdjustmentTrace({
      baseValue: 9,
      rawModifiers: [{ label: "committed damage", value: -4 }],
    });

    expect(inGrid?.rawModifierTotal).toBe(-4);
    expect(inGrid?.extrapolated).toBe(false);
    expect(inGrid?.extrapolatedAxes).toEqual([]);
  });

  it("keeps the defence pair resolvable past the edge and carries the flag on its trace", () => {
    const baseDb = calculateWorkbookBaseDb({ dexterityGm: 1, dodgeSkillXp: 8 });
    const pair = calculateWorkbookDefensePair({
      baseDb,
      equipmentModifier: 0,
      rawModifiers: [{ label: "committed damage", value: -20 }],
      toHitModifier: 0,
    });

    expect(pair).not.toBeNull();
    expect(pair?.fullModifier).toBe(-20);
    expect(pair?.fullTrace.extrapolated).toBe(true);
    expect(pair?.fullAdjustment).toBe(lookupWorkbookPercentageAdjustment(baseDb, 20));
    expect(pair?.db).toBe(baseDb - pair!.fullAdjustment);
  });
});
