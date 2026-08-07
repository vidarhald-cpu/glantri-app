import { describe, expect, it } from "vitest";

import type { ShieldTemplate, WeaponTemplate } from "@glantri/domain";

import {
  resolveCombatDefenseCalculation,
  selectCombatDefenseEquipment,
} from "./resolveCombatDefense";

const weapon = (id: string, name: string, defensiveValue: number) =>
  ({ category: "weapon", defensiveValue, id, name }) as WeaponTemplate;
const shield = (id: string, name: string, defensiveValue: number) =>
  ({ category: "shield", defensiveValue, id, name }) as ShieldTemplate;

describe("canonical combat defense composition", () => {
  it("selects the primary item and strongest off-hand defensive source", () => {
    expect(
      selectCombatDefenseEquipment({
        primaryWeaponTemplate: weapon("sword", "Sword", 4),
        readyShieldTemplate: shield("shield", "Shield", 3),
        secondaryWeaponTemplate: weapon("dagger", "Dagger", 2),
      }),
    ).toEqual({
      equipmentModifier: 7,
      itemTemplateIds: ["sword", "shield"],
      label: "Sword + Shield",
      sourceKind: "combined",
    });
  });

  it("composes exact-cutoff percentage rows once and direct DB points afterward", () => {
    const result = resolveCombatDefenseCalculation({
      characterInputs: {
        brawlingCombatSkillXp: null,
        combatSkillXpByName: { Dodge: 8 },
        constitution: 12,
        dexterity: 15,
        dexterityGm: 5,
        dodgeCombatSkillXp: 8,
        parryCombatSkillXp: null,
        size: 12,
        sizeGm: 3,
        strength: 12,
        strengthGm: 3,
      },
      dynamicRawModifiers: [
        { label: "General/Fatigue", value: -4 },
        { label: "DB/Parry", value: -6 },
      ],
      encumbranceLevel: 0,
      flatDbAdjustment: 2,
      primaryWeaponTemplate: weapon("sword", "Sword", 4),
      readyShieldTemplate: shield("shield", "Shield", 3),
      secondaryWeaponTemplate: null,
    });

    expect(result).toMatchObject({
      baseDb: 13,
      completeness: "complete",
      effectiveDb: 14,
      effectiveDm: 3,
      flatDbAdjustment: 2,
      percentage: {
        db: 12,
        fullModifier: -1,
        noToHitDb: 9,
      },
      toHitModifier: 2,
    });
  });

  it("is conservative when canonical character or load facts are missing", () => {
    expect(
      resolveCombatDefenseCalculation({
        encumbranceLevel: 0,
        primaryWeaponTemplate: null,
        readyShieldTemplate: null,
        secondaryWeaponTemplate: null,
      }),
    ).toEqual({ completeness: "partial", missingFacts: ["character_inputs"] });
  });
});
