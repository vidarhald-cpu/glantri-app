import { describe, expect, it } from "vitest";

import { defaultCombatAllocationState } from "./combatAllocationState";
import {
  canUseWorkbookMeleeCalculation,
  getDerivedDmbValue,
  getDerivedInitiativeValue,
  getDerivedObValue,
  getDmbValue,
  getGripSummary,
  getWorkbookCombinedRowParry,
  getWorkbookOneItemDefensePair,
  getWorkbookShieldRowParry,
  getWorkbookWeaponRowParry,
  canTemplateParry,
  resolveAttackModeCompetency,
  resolveTemplateParryModifier,
} from "./deriveCombatValues";
import type { CombatStateCharacterInputs } from "./characterInputs";

function makeCharacterInputs(
  overrides: Partial<CombatStateCharacterInputs> = {},
): CombatStateCharacterInputs {
  return {
    brawlingCombatSkillXp: null,
    combatSkillXpByCompetencyId: {},
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

describe("resolveAttackModeCompetency", () => {
  it("refuses a mode with no competencyRef rather than falling back to any skill", () => {
    const characterInputs = makeCharacterInputs({
      combatSkillXpByCompetencyId: { throwing: 9 },
      combatSkillXpByName: { Throwing: 9, Sword: 5 },
    });

    for (const attackMode of [{}, { competencyRef: null }, null, undefined]) {
      expect(
        resolveAttackModeCompetency({ attackMode: attackMode as never, characterInputs }),
      ).toEqual({
        reason: "no_competency_reference",
        status: "refused",
      });
    }
  });

  it("resolves the referenced catalogue id through the id-keyed map", () => {
    expect(
      resolveAttackModeCompetency({
        attackMode: { competencyRef: "one_handed_edged" } as never,
        characterInputs: makeCharacterInputs({
          combatSkillXpByCompetencyId: { one_handed_edged: 15 },
        }),
      }),
    ).toEqual({ competencyId: "one_handed_edged", skillXp: 15, status: "resolved" });
  });

  it("does not read the name-keyed map: a display name never resolves a competency id", () => {
    expect(
      resolveAttackModeCompetency({
        attackMode: { competencyRef: "one_handed_edged" } as never,
        characterInputs: makeCharacterInputs({ combatSkillXpByName: { "1-h edged": 15 } }),
      }),
    ).toEqual({ competencyId: "one_handed_edged", skillXp: null, status: "resolved" });
  });

  it("resolves to a null skillXp, not a refusal, when the character lacks the competency", () => {
    expect(
      resolveAttackModeCompetency({
        attackMode: { competencyRef: "bow" } as never,
        characterInputs: makeCharacterInputs({ combatSkillXpByCompetencyId: { sling: 4 } }),
      }),
    ).toEqual({ competencyId: "bow", skillXp: null, status: "resolved" });
    expect(
      resolveAttackModeCompetency({
        attackMode: { competencyRef: "bow" } as never,
        characterInputs: undefined,
      }),
    ).toEqual({ competencyId: "bow", skillXp: null, status: "resolved" });
  });
});

describe("competency and thrown use come from the attack mode itself (#512 P1.3)", () => {
  const alloc = defaultCombatAllocationState;
  const inputsWith = (byId: Record<string, number>) =>
    makeCharacterInputs({ combatSkillXpByCompetencyId: byId, dexterityGm: 3, strengthGm: 3 });
  const template = { handlingClass: "one_handed", initiative: 1 } as never;
  const ob = (mode: object, byId: Record<string, number>) =>
    getDerivedObValue({
      allocationInputs: alloc,
      armorTemplate: null,
      characterInputs: inputsWith(byId),
      mode: mode as never,
      template,
    });

  it("a thrown mode attacks with ITS competencyRef, not a fixed Throwing skill", () => {
    const thrownSling = { attackType: "thrown", competencyRef: "sling", ob: 2 };
    const reference = ob(thrownSling, { sling: 30, throwing: 4 });
    expect(typeof reference).toBe("number");
    expect(ob(thrownSling, { sling: 30, throwing: 90 })).toBe(reference);
    expect(ob(thrownSling, { sling: 12, throwing: 4 })).not.toBe(reference);
  });

  it("a thrown mode whose competency the character lacks yields no OB, never another skill", () => {
    expect(ob({ attackType: "thrown", competencyRef: "sling", ob: 2 }, { throwing: 40 })).toBe("—");
  });

  it("thrown use is the authored attackType: a melee mode that references Throwing is not thrown", () => {
    const melee = { attackType: "melee", competencyRef: "throwing", initiative: 1, ob: 2 };
    const sameSkillAsEdged = { ...melee, competencyRef: "one_handed_edged" };
    const byId = { one_handed_edged: 15, throwing: 15 };
    expect(ob(melee, byId)).toBe(ob(sameSkillAsEdged, byId));
    // Workbook melee initiative (dex GM 3, skill 15, weapon 1 -> 5), not the thrown 1 + dex GM = 4.
    expect(
      getDerivedInitiativeValue({
        attackMode: melee as never,
        characterInputs: inputsWith(byId),
        template,
      }),
    ).toBe(5);
  });

  it("a thrown mode on another competency still takes the thrown initiative (initiative + dex GM)", () => {
    expect(
      getDerivedInitiativeValue({
        attackMode: { attackType: "thrown", competencyRef: "sling", initiative: 1 } as never,
        characterInputs: inputsWith({ sling: 15 }),
        template,
      }),
    ).toBe(4);
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
    expect(
      getGripSummary({
        primaryTemplate: null,
        secondaryTemplate: null,
        missileTemplate: null,
        shieldTemplate: null,
      }),
    ).toBe("Unarmed");
  });

  it("returns One-handed for single one-handed weapon", () => {
    expect(
      getGripSummary({
        primaryTemplate: sword,
        secondaryTemplate: null,
        missileTemplate: null,
        shieldTemplate: null,
      }),
    ).toBe("One-handed");
  });

  it("returns One-handed + shield", () => {
    expect(
      getGripSummary({
        primaryTemplate: sword,
        secondaryTemplate: null,
        missileTemplate: null,
        shieldTemplate: shield,
      }),
    ).toBe("One-handed + shield");
  });

  it("returns Two-handed primary for two-handed weapon", () => {
    expect(
      getGripSummary({
        primaryTemplate: twoHander,
        secondaryTemplate: null,
        missileTemplate: null,
        shieldTemplate: null,
      }),
    ).toBe("Two-handed primary");
    expect(
      getGripSummary({
        primaryTemplate: polearm,
        secondaryTemplate: null,
        missileTemplate: null,
        shieldTemplate: null,
      }),
    ).toBe("Two-handed primary");
  });

  it("returns Dual-wield for two weapons without shield", () => {
    expect(
      getGripSummary({
        primaryTemplate: sword,
        secondaryTemplate: dagger,
        missileTemplate: null,
        shieldTemplate: null,
      }),
    ).toBe("Dual-wield / paired weapons ready");
  });

  it("returns Missile ready when only missile weapon is ready", () => {
    expect(
      getGripSummary({
        primaryTemplate: null,
        secondaryTemplate: null,
        missileTemplate: bow,
        shieldTemplate: null,
      }),
    ).toBe("Missile ready");
  });

  it("returns Shield-ready when only shield is equipped", () => {
    expect(
      getGripSummary({
        primaryTemplate: null,
        secondaryTemplate: null,
        missileTemplate: null,
        shieldTemplate: shield,
      }),
    ).toBe("Shield-ready, otherwise unarmed");
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
    expect(
      getDmbValue({ dmbFormula: { kind: "numeric", numericValue: 4, raw: "4" } } as never),
    ).toBe("4");
  });

  it("formats dice dmbFormula", () => {
    expect(
      getDmbValue({
        dmbFormula: { kind: "dice", diceCount: 1, diceSides: 6, raw: "1d6" },
      } as never),
    ).toBe("1d6");
  });
});

describe("getDerivedInitiativeValue · workbook golden values", () => {
  it("returns — for null template", () => {
    expect(getDerivedInitiativeValue({ template: null })).toBe("—");
  });

  it("returns raw template initiative when characterInputs are absent", () => {
    expect(
      getDerivedInitiativeValue({
        template: { handlingClass: "one_handed", initiative: 3 } as never,
      }),
    ).toBe(3);
  });

  it("returns — when template has no initiative and no characterInputs", () => {
    expect(getDerivedInitiativeValue({ template: { handlingClass: "one_handed" } as never })).toBe(
      "—",
    );
  });

  it("Themistogenes 1.07.xlsx → Calculations!I19: melee initiative dex-gm 3, skill 15, weapon-init 1 → 5", () => {
    expect(
      getDerivedInitiativeValue({
        attackMode: { competencyRef: "sword" } as never,
        template: { handlingClass: "one_handed", initiative: 1, weaponSkill: "Sword" } as never,
        characterInputs: makeCharacterInputs({
          dexterityGm: 3,
          combatSkillXpByCompetencyId: { sword: 15 },
        }),
      }),
    ).toBe(5);
  });

  it("missile weapon uses initiative + dexterityGm directly", () => {
    expect(
      getDerivedInitiativeValue({
        attackMode: { attackType: "missile", competencyRef: "bow" } as never,
        template: { handlingClass: "missile", initiative: 2 } as never,
        characterInputs: makeCharacterInputs({ dexterityGm: 3 }),
      }),
    ).toBe(5);
  });

  it("a thrown attack type uses initiative + dexterityGm directly", () => {
    expect(
      getDerivedInitiativeValue({
        attackMode: { attackType: "thrown", competencyRef: "throwing" } as never,
        template: { handlingClass: "one_handed", initiative: 2 } as never,
        characterInputs: makeCharacterInputs({ dexterityGm: 3 }),
      }),
    ).toBe(5);
  });

  it("uses the explicit thrown-mode initiative instead of the base melee initiative", () => {
    expect(
      getDerivedInitiativeValue({
        attackMode: { attackType: "thrown", competencyRef: "throwing", initiative: -2 } as never,
        template: { handlingClass: "two_handed", initiative: 1 } as never,
        characterInputs: makeCharacterInputs({
          combatSkillXpByCompetencyId: { polearms: 20, throwing: 4 },
          dexterityGm: 3,
        }),
      }),
    ).toBe(1);
  });
});

describe("getDerivedObValue · workbook golden values", () => {
  const alloc = defaultCombatAllocationState;

  it("returns — for null mode", () => {
    expect(
      getDerivedObValue({
        allocationInputs: alloc,
        armorTemplate: null,
        mode: null,
        template: null,
      }),
    ).toBe("—");
  });

  it("Themistogenes 1.07.xlsx → Weapon1!A10:O10 (scimitar-like ob 3): dex-gm 3, str-gm 3, skill 15, weapon-ob 3 → finalOb 16", () => {
    expect(
      getDerivedObValue({
        allocationInputs: alloc,
        armorTemplate: null,
        characterInputs: makeCharacterInputs({
          dexterityGm: 3,
          strengthGm: 3,
          combatSkillXpByCompetencyId: { scimitar: 15 },
        }),
        mode: { competencyRef: "scimitar", ob: 3 } as never,
        template: { handlingClass: "one_handed", weaponSkill: "Scimitar" } as never,
      }),
    ).toBe(16);
  });

  it("falls back to base OB formula when characterInputs are missing", () => {
    expect(
      getDerivedObValue({
        allocationInputs: alloc,
        armorTemplate: null,
        mode: { competencyRef: "sword", ob: 3 } as never,
        template: { handlingClass: "one_handed", weaponSkill: "Sword" } as never,
      }),
    ).toBe(3);
  });

  it("applies situational attack modifier from allocationInputs", () => {
    const allocWithMod = {
      ...alloc,
      situationalModifiers: { ...alloc.situationalModifiers, attack: 5 },
    };
    const result = getDerivedObValue({
      allocationInputs: allocWithMod,
      armorTemplate: null,
      characterInputs: makeCharacterInputs({
        dexterityGm: 3,
        strengthGm: 3,
        combatSkillXpByCompetencyId: { scimitar: 15 },
      }),
      mode: { competencyRef: "scimitar", ob: 3 } as never,
      template: { handlingClass: "one_handed", weaponSkill: "Scimitar" } as never,
    });
    expect(result).toBe(21);
  });

  it("applies live attack modifiers once for a broad-sword-style OB 12 row", () => {
    const broadSword = {
      handlingClass: "one_handed",
      weaponSkill: "1-h edged",
    } as never;
    const slashMode = { competencyRef: "one_handed_edged", ob: 2 } as never;
    const characterInputs = makeCharacterInputs({
      combatSkillXpByCompetencyId: { one_handed_edged: 9 },
      dexterityGm: 2,
      strengthGm: 4,
    });

    expect(
      getDerivedObValue({
        allocationInputs: alloc,
        armorTemplate: null,
        characterInputs,
        mode: slashMode,
        template: broadSword,
      }),
    ).toBe(12);
    expect(
      getDerivedObValue({
        allocationInputs: {
          ...alloc,
          situationalModifiers: { ...alloc.situationalModifiers, attack: -1 },
        },
        armorTemplate: null,
        characterInputs,
        mode: slashMode,
        template: broadSword,
      }),
    ).toBe(11);
  });

  it("uses the zero-base percentage adjustment path for fallback OB rows", () => {
    expect(
      getDerivedObValue({
        allocationInputs: {
          ...alloc,
          situationalModifiers: { ...alloc.situationalModifiers, attack: 1 },
        },
        armorTemplate: null,
        mode: { competencyRef: "brawling", ob: 0 } as never,
        template: { handlingClass: "one_handed", weaponSkill: "Kick" } as never,
      }),
    ).toBe(1);

    expect(
      getDerivedObValue({
        allocationInputs: {
          ...alloc,
          situationalModifiers: { ...alloc.situationalModifiers, attack: -1 },
        },
        armorTemplate: null,
        mode: { competencyRef: "brawling", ob: 0 } as never,
        template: { handlingClass: "one_handed", weaponSkill: "Kick" } as never,
      }),
    ).toBe(-1);
  });
});

describe("getDerivedDmbValue · workbook golden values", () => {
  it("returns — for null mode", () => {
    expect(getDerivedDmbValue({ armorTemplate: null, mode: null, template: null })).toBe("—");
  });

  it("Themistogenes 1.07.xlsx → Weapon1!A10:O10 (scimitar-like ob 3, dmb 3): dex-gm 3, str-gm 3, skill 15 → finalDmb 6", () => {
    expect(
      getDerivedDmbValue({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({
          dexterityGm: 3,
          strengthGm: 3,
          combatSkillXpByCompetencyId: { scimitar: 15 },
        }),
        mode: { competencyRef: "scimitar", ob: 3, dmb: 3 } as never,
        template: { handlingClass: "one_handed", weaponSkill: "Scimitar" } as never,
      }),
    ).toBe(6);
  });

  it("thrown use: returns strengthGm + mode.dmb when both present", () => {
    expect(
      getDerivedDmbValue({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ strengthGm: 3 }),
        mode: { attackType: "thrown", competencyRef: "throwing", dmb: 4 } as never,
        template: { handlingClass: "one_handed" } as never,
      }),
    ).toBe(7);
  });
});

describe("getWorkbookOneItemDefensePair", () => {
  it("returns — for both values when inputs are missing", () => {
    expect(
      getWorkbookOneItemDefensePair({
        characterInputs: undefined,
        encumbranceLevel: null,
        equipmentModifier: 0,
      }),
    ).toEqual({ db: "—", dm: "—" });
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
    expect(
      getWorkbookWeaponRowParry({ armorTemplate: null, template: { parry: -1 } as never }),
    ).toBe("—");
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

  it("Themistogenes 1.07.xlsx → Parry column: dex-gm 3, parry-skill 13, weapon-parry -1 → finalParry 10", () => {
    expect(
      getWorkbookWeaponRowParry({
        armorTemplate: null,
        characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
        template: { parry: -1 } as never,
      }),
    ).toBe(10);
  });
});

describe("getWorkbookShieldRowParry", () => {
  it("returns — when characterInputs are absent", () => {
    expect(
      getWorkbookShieldRowParry({ armorTemplate: null, shieldTemplate: { parry: 2 } as never }),
    ).toBe("—");
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

  it("Themistogenes 1.07.xlsx → Shield parry column: dex-gm 3, parry-skill 13, shield-parry 2 → uses same formula as weapon parry", () => {
    const result = getWorkbookShieldRowParry({
      armorTemplate: null,
      characterInputs: makeCharacterInputs({ dexterityGm: 3, parryCombatSkillXp: 13 }),
      shieldTemplate: { parry: 2 } as never,
    });
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });
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

// Forgejo #665. Parry-source eligibility is a property of the template alone, so that a wielded
// Item which authors no Parry modifier is never committed as a Parry source the canonical
// calculation must then refuse.
describe("Parry source eligibility", () => {
  it("reads an authored Parry modifier, including a zero one", () => {
    expect(resolveTemplateParryModifier({ parry: 3 })).toBe(3);
    // A Long sword authors `parry: 0`. Zero is a real modifier and must not be read as absent.
    expect(resolveTemplateParryModifier({ parry: 0 })).toBe(0);
    expect(canTemplateParry({ parry: 0 })).toBe(true);
  });

  it("treats an absent or null Parry modifier as ineligible", () => {
    // Thrown and missile modes author `parry: null` deliberately; the two legacy-compatibility
    // shield templates omit the field entirely. Neither can be scored by any Parry row.
    expect(resolveTemplateParryModifier({ parry: null })).toBeNull();
    expect(canTemplateParry({ parry: null })).toBe(false);
    expect(canTemplateParry({})).toBe(false);
    expect(canTemplateParry(null)).toBe(false);
    expect(canTemplateParry(undefined)).toBe(false);
  });

  it("agrees with the Parry rows it gates", () => {
    const characterInputs = makeCharacterInputs({ dexterityGm: 0, parryCombatSkillXp: 8 });

    // An ineligible template yields no Parry row, which is exactly why it must not be committed.
    expect(
      getWorkbookShieldRowParry({
        armorTemplate: null,
        characterInputs,
        shieldTemplate: { parry: null } as never,
      }),
    ).toBe("—");
    expect(
      getWorkbookCombinedRowParry({
        armorTemplate: null,
        characterInputs,
        offHandShieldTemplate: { parry: null } as never,
        primaryWeaponTemplate: { parry: 0 } as never,
        secondaryWeaponTemplate: null,
      }),
    ).toBe("—");

    // An eligible one does, so eligibility never suppresses a Parry that exists.
    expect(
      getWorkbookWeaponRowParry({
        armorTemplate: null,
        characterInputs,
        template: { parry: 0 } as never,
      }),
    ).not.toBe("—");
  });
});

describe("#922 raw modifiers on a derived value below zero", () => {
  const derive = (attackModifier: number, weaponOb: number) =>
    getDerivedObValue({
      allocationInputs: {
        ...defaultCombatAllocationState,
        situationalModifiers: {
          ...defaultCombatAllocationState.situationalModifiers,
          attack: attackModifier,
        },
      },
      armorTemplate: null,
      // No skill XP, so the workbook melee and projectile paths do not answer and the raw
      // modifiers are applied to the weapon's own OB — the call site this covers.
      characterInputs: makeCharacterInputs(),
      mode: { attackType: "melee", competencyRef: "one_handed_edged", ob: weaponOb } as never,
      template: { handlingClass: "one_handed", initiative: 1 } as never,
    });

  it("applies them at one point per step rather than dropping them", () => {
    // Product Owner ruling on #922, comment 20793. On a base below zero this call site used to
    // receive a no-answer and display the **unadjusted** base as an ordinary figure.
    expect(derive(-4, -3)).toBe(-7);
    expect(derive(-4, -3)).not.toBe(-3);
    // At zero and in-grid are unchanged, so the rule is not new at the boundary.
    expect(derive(-4, 0)).toBe(-4);
    expect(derive(-4, 9)).toBe(5);
  });

  it("shows no value rather than a wrong one when the rule has no reading", () => {
    // What remains after the ruling is a non-integer figure. The dash is this function's own
    // existing no-value answer, which is what a missing input already shows.
    expect(derive(-4.5, 9)).toBe("—");
    expect(derive(-4.5, -3)).toBe("—");
    // And no modifier at all is still the base itself, not a dash.
    expect(derive(0, -3)).toBe(-3);
  });
});
