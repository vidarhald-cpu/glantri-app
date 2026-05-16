import { describe, expect, it } from "vitest";

import { defaultCombatAllocationState } from "./combatAllocationState";
import {
  canUseWorkbookMeleeCalculation,
  getDerivedDmbValue,
  getDerivedInitiativeValue,
  getDerivedObValue,
  getDmbValue,
  getGripSummary,
  getSkillXpByName,
  getWeaponSkillXp,
  getWorkbookCombinedRowParry,
  getWorkbookOneItemDefensePair,
  getWorkbookShieldRowParry,
  getWorkbookWeaponRowParry,
} from "./deriveCombatValues";
import type { CombatStateCharacterInputs } from "./characterInputs";

function makeCharacterInputs(
  overrides: Partial<CombatStateCharacterInputs> = {},
): CombatStateCharacterInputs {
  return {
    brawlingCombatSkillXp: null,
    combatSkillXpByName: {},
    constitution: null,
    dexterity: null,
    dexterityGm: null,
    dodgeCombatSkillXp: null,
    parryCombatSkillXp: null,
    size: null,
    sizeGm: null,
    strength: null,
    strengthGm: null,
    ...overrides,
  };
}

describe("canUseWorkbookMeleeCalculation", () => {
  it("returns false for null template", () => {
    expect(canUseWorkbookMeleeCalculation(null)).toBe(false);
  });

  it("returns false for missile weapons", () => {
    expect(canUseWorkbookMeleeCalculation({ handlingClass: "missile" } as never)).toBe(false);
  });

  it("returns false for thrown weapons", () => {
    expect(canUseWorkbookMeleeCalculation({ handlingClass: "thrown" } as never)).toBe(false);
  });

  it.each(["one_handed", "two_handed", "polearm", "light", "paired"] as const)(
    "returns true for %s handling class",
    (handlingClass) => {
      expect(canUseWorkbookMeleeCalculation({ handlingClass } as never)).toBe(true);
    },
  );
});

describe("getWeaponSkillXp", () => {
  it("returns null for null template", () => {
    expect(getWeaponSkillXp(null, makeCharacterInputs())).toBeNull();
  });

  it("returns null when characterInputs are undefined", () => {
    expect(getWeaponSkillXp({ weaponSkill: "Sword" } as never, undefined)).toBeNull();
  });

  it("returns null when template has no weaponSkill", () => {
    expect(getWeaponSkillXp({} as never, makeCharacterInputs({ combatSkillXpByName: { Sword: 5 } }))).toBeNull();
  });

  it("returns xp value by weapon skill name", () => {
    expect(
      getWeaponSkillXp(
        { weaponSkill: "Scimitar" } as never,
        makeCharacterInputs({ combatSkillXpByName: { Scimitar: 15 } }),
      ),
    ).toBe(15);
  });

  it("returns null when skill is not in combatSkillXpByName", () => {
    expect(
      getWeaponSkillXp(
        { weaponSkill: "Greatsword" } as never,
        makeCharacterInputs({ combatSkillXpByName: { Sword: 5 } }),
      ),
    ).toBeNull();
  });
});

describe("getSkillXpByName", () => {
  it("returns null for null skillName", () => {
    expect(getSkillXpByName(null, makeCharacterInputs())).toBeNull();
  });

  it("returns null when characterInputs are undefined", () => {
    expect(getSkillXpByName("Throwing", undefined)).toBeNull();
  });

  it("returns xp for a known skill", () => {
    expect(getSkillXpByName("Throwing", makeCharacterInputs({ combatSkillXpByName: { Throwing: 7 } }))).toBe(7);
  });
});

describe("getGripSummary", () => {
  const sword = { handlingClass: "one_handed" } as never;
  const twoHander = { handlingClass: "two_handed" } as never;
  const polearm = { handlingClass: "polearm" } as never;
  const bow = { handlingClass: "missile" } as never;
  const dagger = { handlingClass: "light" } as never;
  const shield = {} as never;

  it("returns Unarmed when nothing equipped", () => {
    expect(getGripSummary({ primaryTemplate: null, secondaryTemplate: null, missileTemplate: null, shieldTemplate: null })).toBe("Unarmed");
  });

  it("returns One-handed for single one-handed weapon", () => {
    expect(getGripSummary({ primaryTemplate: sword, secondaryTemplate: null, missileTemplate: null, shieldTemplate: null })).toBe("One-handed");
  });

  it("returns One-handed + shield", () => {
    expect(getGripSummary({ primaryTemplate: sword, secondaryTemplate: null, missileTemplate: null, shieldTemplate: shield })).toBe("One-handed + shield");
  });

  it("returns Two-handed primary for two-handed weapon", () => {
    expect(getGripSummary({ primaryTemplate: twoHander, secondaryTemplate: null, missileTemplate: null, shieldTemplate: null })).toBe("Two-handed primary");
    expect(getGripSummary({ primaryTemplate: polearm, secondaryTemplate: null, missileTemplate: null, shieldTemplate: null })).toBe("Two-handed primary");
  });

  it("returns Dual-wield for two weapons without shield", () => {
    expect(getGripSummary({ primaryTemplate: sword, secondaryTemplate: dagger, missileTemplate: null, shieldTemplate: null })).toBe("Dual-wield / paired weapons ready");
  });

  it("returns Missile ready when only missile weapon is ready", () => {
    expect(getGripSummary({ primaryTemplate: null, secondaryTemplate: null, missileTemplate: bow, shieldTemplate: null })).toBe("Missile ready");
  });

  it("returns Shield-ready when only shield is equipped", () => {
    expect(getGripSummary({ primaryTemplate: null, secondaryTemplate: null, missileTemplate: null, shieldTemplate: shield })).toBe("Shield-ready, otherwise unarmed");
  });
});

describe("getDmbValue", () => {
  it("returns — for null mode", () => {
    expect(getDmbValue(null)).toBe("—");
  });

  it("returns numeric dmb directly when set", () => {
    expect(getDmbValue({ dmb: 5 } as never)).toBe(5);
  });

  it("returns raw dmb string when dmbRaw is set and dmb is absent", () => {
    expect(getDmbValue({ dmbRaw: "special" } as never)).toBe("special (raw)");
  });

  it("returns — when mode has no dmb, dmbFormula, or dmbRaw", () => {
    expect(getDmbValue({} as never)).toBe("—");
  });

  it("formats numeric dmbFormula", () => {
    expect(getDmbValue({ dmbFormula: { kind: "numeric", numericValue: 4, raw: "4" } } as never)).toBe("4");
  });

  it("formats dice dmbFormula", () => {
    expect(getDmbValue({ dmbFormula: { kind: "dice", diceCount: 1, diceSides: 6, raw: "1d6" } } as never)).toBe("1d6");
  });
});

describe("getDerivedInitiativeValue · workbook golden values", () => {
  it("returns — for null template", () => {
    expect(getDerivedInitiativeValue({ template: null })).toBe("—");
  });

  it("returns raw template initiative when characterInputs are absent", () => {
    expect(getDerivedInitiativeValue({ template: { handlingClass: "one_handed", initiative: 3 } as never })).toBe(3);
  });

  it("returns — when template has no initiative and no characterInputs", () => {
    expect(getDerivedInitiativeValue({ template: { handlingClass: "one_handed" } as never })).toBe("—");
  });

  it(
    "Themistogenes 1.07.xlsx → Calculations!I19: melee initiative dex-gm 3, skill 15, weapon-init 1 → 5",
    () => {
      expect(
        getDerivedInitiativeValue({
          template: { handlingClass: "one_handed", initiative: 1, weaponSkill: "Sword" } as never,
          characterInputs: makeCharacterInputs({ dexterityGm: 3, combatSkillXpByName: { Sword: 15 } }),
        }),
      ).toBe(5);
    },
  );

  it("missile weapon uses initiative + dexterityGm directly", () => {
    expect(
      getDerivedInitiativeValue({
        template: { handlingClass: "missile", initiative: 2 } as never,
        characterInputs: makeCharacterInputs({ dexterityGm: 3 }),
      }),
    ).toBe(5);
  });

  it("treatAsThrownUse uses initiative + dexterityGm directly", () => {
    expect(
      getDerivedInitiativeValue({
        template: { handlingClass: "one_handed", initiative: 2 } as never,
        characterInputs: makeCharacterInputs({ dexterityGm: 3 }),
        treatAsThrownUse: true,
      }),
    ).toBe(5);
  });
});

describe("getDerivedObValue · workbook golden values", () => {
  const alloc = defaultCombatAllocationState;

  it("returns — for null mode", () => {
    expect(getDerivedObValue({ allocationInputs: alloc, armorTemplate: null, mode: null, template: null })).toBe("—");
  });

  it(
    "Themistogenes 1.07.xlsx → Weapon1!A10:O10 (scimitar-like ob 3): dex-gm 3, str-gm 3, skill 15, weapon-ob 3 → finalOb 16",
    () => {
      expect(
        getDerivedObValue({
          allocationInputs: alloc,
          armorTemplate: null,
          characterInputs: makeCharacterInputs({
            dexterityGm: 3,
            strengthGm: 3,
            combatSkillXpByName: { Scimitar: 15 },
          }),
          mode: { ob: 3 } as never,
          template: { handlingClass: "one_handed", weaponSkill: "Scimitar" } as never,
        }),
      ).toBe(16);
    },
  );

  it("falls back to base OB formula when characterInputs are missing", () => {
    expect(
      getDerivedObValue({
        allocationInputs: alloc,
        armorTemplate: null,
        mode: { ob: 3 } as never,
        template: { handlingClass: "one_handed", weaponSkill: "Sword" } as never,
      }),
    ).toBe(3);
  });

  it("applies situational attack modifier from allocationInputs", () => {
    const allocWithMod = { ...alloc, situationalModifiers: { ...alloc.situationalModifiers, attack: 5 } };
    const result = getDerivedObValue({
      allocationInputs: allocWithMod,
      armorTemplate: null,
      characterInputs: makeCharacterInputs({
        dexterityGm: 3,
        strengthGm: 3,
        combatSkillXpByName: { Scimitar: 15 },
      }),
      mode: { ob: 3 } as never,
      template: { handlingClass: "one_handed", weaponSkill: "Scimitar" } as never,
    });
    expect(result).toBe(21);
  });
});

describe("getDerivedDmbValue · workbook golden values", () => {
  it("returns — for null mode", () => {
    expect(getDerivedDmbValue({ armorTemplate: null, mode: null, template: null })).toBe("—");
  });

  it(
    "Themistogenes 1.07.xlsx → Weapon1!A10:O10 (scimitar-like ob 3, dmb 3): dex-gm 3, str-gm 3, skill 15 → finalDmb 6",
    () => {
      expect(
        getDerivedDmbValue({
          armorTemplate: null,
          characterInputs: makeCharacterInputs({
            dexterityGm: 3,
            strengthGm: 3,
            combatSkillXpByName: { Scimitar: 15 },
          }),
          mode: { ob: 3, dmb: 3 } as never,
          template: { handlingClass: "one_handed", weaponSkill: "Scimitar" } as never,
        }),
      ).toBe(6);
    },
  );

  it("thrown use: returns strengthGm + mode.dmb when both present", () => {
    expect(
      getDerivedDmbValue({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ strengthGm: 3 }),
        mode: { dmb: 4 } as never,
        template: { handlingClass: "one_handed" } as never,
        treatAsThrownUse: true,
      }),
    ).toBe(7);
  });
});

describe("getWorkbookOneItemDefensePair", () => {
  it("returns — for both values when inputs are missing", () => {
    expect(getWorkbookOneItemDefensePair({ characterInputs: undefined, encumbranceLevel: null, equipmentModifier: 0 })).toEqual({ db: "—", dm: "—" });
  });

  it("returns — when encumbranceLevel is null even with character inputs", () => {
    expect(
      getWorkbookOneItemDefensePair({
        characterInputs: makeCharacterInputs({ dexterityGm: 3, dodgeCombatSkillXp: 10 }),
        encumbranceLevel: null,
        equipmentModifier: 0,
      }),
    ).toEqual({ db: "—", dm: "—" });
  });
});

describe("getWorkbookWeaponRowParry · workbook golden values", () => {
  it("returns — when characterInputs are absent", () => {
    expect(getWorkbookWeaponRowParry({ armorTemplate: null, template: { parry: -1 } as never })).toBe("—");
  });

  it("returns — when template has no parry modifier", () => {
    expect(
      getWorkbookWeaponRowParry({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
        template: { parry: null } as never,
      }),
    ).toBe("—");
  });

  it(
    "Themistogenes 1.07.xlsx → Parry column: dex-gm 3, parry-skill 13, weapon-parry -1 → finalParry 10",
    () => {
      expect(
        getWorkbookWeaponRowParry({
          armorTemplate: null,
          characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
          template: { parry: -1 } as never,
        }),
      ).toBe(10);
    },
  );
});

describe("getWorkbookShieldRowParry", () => {
  it("returns — when characterInputs are absent", () => {
    expect(getWorkbookShieldRowParry({ armorTemplate: null, shieldTemplate: { parry: 2 } as never })).toBe("—");
  });

  it("returns — when shield has no parry modifier", () => {
    expect(
      getWorkbookShieldRowParry({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
        shieldTemplate: { parry: null } as never,
      }),
    ).toBe("—");
  });

  it(
    "Themistogenes 1.07.xlsx → Shield parry column: dex-gm 3, parry-skill 13, shield-parry 2 → uses same formula as weapon parry",
    () => {
      const result = getWorkbookShieldRowParry({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
        shieldTemplate: { parry: 2 } as never,
      });
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    },
  );
});

describe("getWorkbookCombinedRowParry", () => {
  it("returns — when characterInputs are absent", () => {
    expect(
      getWorkbookCombinedRowParry({
        armorTemplate: null,
        offHandShieldTemplate: { parry: 2 } as never,
        primaryWeaponTemplate: { parry: -1 } as never,
        secondaryWeaponTemplate: null,
      }),
    ).toBe("—");
  });

  it("returns — when primary weapon has no parry modifier", () => {
    expect(
      getWorkbookCombinedRowParry({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
        offHandShieldTemplate: { parry: 2 } as never,
        primaryWeaponTemplate: null,
        secondaryWeaponTemplate: null,
      }),
    ).toBe("—");
  });
});
