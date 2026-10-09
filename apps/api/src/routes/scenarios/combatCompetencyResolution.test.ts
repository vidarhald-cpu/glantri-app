/**
 * #512 P1.3 — competency resolution for combat values.
 *
 * The thrown/missile/melee decision comes from the attack mode's authored `attackType`, never from
 * the display slot the weapon sits in, and the competency a mode attacks with comes from the mode's
 * authored `competencyRef`. A mode with no `competencyRef` is refused explicitly.
 */
import { describe, expect, it } from "vitest";

import { weaponTemplates } from "@glantri/content/equipment";
import type {
  CombatRoundAttackOpportunity,
  ScenarioParticipant,
  WeaponTemplate,
} from "@glantri/domain";
import { characterBuildSchema } from "@glantri/domain";

import { resolveCanonicalAttackOffense } from "./combatManualCalculationResolution";
import { resolveCanonicalCombatInitiativeBase } from "./combatInitiativeResolution";

const template = (name: string): WeaponTemplate => {
  const found = weaponTemplates.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing canonical weapon fixture ${name}.`);
  return found;
};

function skillRow(skillId: string, secondaryRanks: number) {
  return {
    category: "secondary",
    categoryId: "combat",
    groupId: "basic_melee_training",
    secondaryRanks,
    skillId,
  };
}

/** A character whose weapon skills (by catalogue id) hold distinct, known ranks. */
function buildParticipant(input: {
  skills: Record<string, number>;
  template: WeaponTemplate;
}): ScenarioParticipant {
  const characterId = "character-attacker";
  const itemId = "item-weapon";
  const locationId = "location-equipped";
  const build = characterBuildSchema.parse({
    equipment: { items: [] },
    id: characterId,
    name: "Attacker",
    profile: {
      distractionLevel: 3,
      id: "profile-attacker",
      label: "Attacker",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 14,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 12,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: Object.values(input.skills).reduce((a, b) => a + b, 0),
      secondaryPoolTotal: 200,
      skillGroups: [],
      skills: Object.entries(input.skills).map(([id, ranks]) => skillRow(id, ranks)),
      specializations: [],
    },
    progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
    statModifiers: {},
  });
  return {
    characterId,
    createdAt: "2026-08-07T10:00:00.000Z",
    id: "scenario-attacker",
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      build,
      displayName: "Attacker",
      equipmentState: {
        activeLoadoutByCharacterId: {
          [characterId]: {
            activeAmmoItemIds: [],
            activePrimaryWeaponItemId: itemId,
            characterId,
            id: "loadout-attacker",
            isActive: true,
            name: "Combat",
            quickAccessItemIds: [],
          },
        },
        itemsById: {
          [itemId]: {
            acquiredFrom: null,
            category: "weapon",
            characterId,
            conditionState: "intact",
            displayName: null,
            id: itemId,
            isFavorite: false,
            isStackable: false,
            material: "steel",
            quality: "standard",
            quantity: 1,
            revision: "2026-08-07T09:00:00.000Z",
            specificityType: "generic",
            storageAssignment: { carryMode: "equipped", locationId },
            templateId: input.template.id,
          },
        },
        locationsById: {
          [locationId]: {
            availabilityClass: "with_you",
            characterId,
            id: locationId,
            isAccessibleInEncounter: true,
            isMobile: true,
            name: "Equipped",
            type: "equipped_system",
          },
        },
        templatesById: { [input.template.id]: input.template },
      },
      sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
    },
    sourceType: "character",
    state: {
      combat: { combatContext: { modifierBuckets: {} } },
      conditions: [],
      equipment: {},
      health: {},
      modifiers: [],
      resources: {},
    },
    updatedAt: "2026-08-07T10:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

function opportunity(input: {
  attackModeId: string;
  slot: "primary" | "throwing";
  template: WeaponTemplate;
}): CombatRoundAttackOpportunity {
  return {
    attackModeId: input.attackModeId,
    id: "opportunity-1",
    origin: "declared",
    phase: "phase1",
    slot: "attack_1",
    sourceKind: "weapon",
    status: "committed",
    weaponInstanceId: "item-weapon",
    weaponSourceId: "item-weapon",
    weaponSourceSlot: input.slot,
    weaponTemplateId: input.template.id,
  } as CombatRoundAttackOpportunity;
}

const noModifiers = { bucket: "skill_ob" as const, rows: [], total: 0 };

function baseOb(input: {
  attackModeId: string;
  skills: Record<string, number>;
  slot: "primary" | "throwing";
  template: WeaponTemplate;
}) {
  return resolveCanonicalAttackOffense({
    attackerResolution: noModifiers,
    opponentResolution: noModifiers,
    opportunity: opportunity(input),
    participant: buildParticipant(input),
  });
}

describe("bow in the throwing slot (the #512 defect)", () => {
  const bow = template("Short bow");

  it("fixture: the Short bow's mode is an authored missile mode whose competency is Bow", () => {
    expect(bow.attackModes?.map((mode) => [mode.id, mode.attackType, mode.competencyRef])).toEqual([
      ["mode-1", "missile", "bow"],
    ]);
  });

  it("resolves a bow in the throwing slot with Bow, never with Throwing", () => {
    const attackModeId = "mode-1";
    const lowThrowing = baseOb({
      attackModeId,
      skills: { bow: 12, throwing: 3 },
      slot: "throwing",
      template: bow,
    });
    const highThrowing = baseOb({
      attackModeId,
      skills: { bow: 12, throwing: 25 },
      slot: "throwing",
      template: bow,
    });
    const lowBow = baseOb({
      attackModeId,
      skills: { bow: 4, throwing: 3 },
      slot: "throwing",
      template: bow,
    });

    expect(lowThrowing.completeness).toBe("complete");
    expect(highThrowing.completeness).toBe("complete");
    expect(lowBow.completeness).toBe("complete");
    // Independent of the Throwing skill ...
    expect(highThrowing).toEqual(lowThrowing);
    // ... and driven by the Bow skill.
    expect(lowBow).not.toEqual(lowThrowing);
  });

  it("resolves a bow identically in the throwing slot and in any other slot", () => {
    const attackModeId = "mode-1";
    const skills = { bow: 12, throwing: 3 };
    expect(baseOb({ attackModeId, skills, slot: "throwing", template: bow })).toEqual(
      baseOb({ attackModeId, skills, slot: "primary", template: bow }),
    );
  });
});

describe("per-mode competency on one weapon, whichever slot it is declared from", () => {
  const dagger = template("Dagger");
  const ob = (input: {
    attackModeId: string;
    skills: Record<string, number>;
    slot: "primary" | "throwing";
  }) => baseOb({ ...input, template: dagger });

  it("fixture: Dagger mode-1 is an authored melee mode on 1-h edged, mode-3 a thrown mode on Throwing", () => {
    expect(
      dagger.attackModes?.map((mode) => [mode.id, mode.attackType, mode.competencyRef]),
    ).toEqual([
      ["mode-1", "melee", "one_handed_edged"],
      ["mode-2", "melee", "one_handed_edged"],
      ["mode-3", "thrown", "throwing"],
    ]);
  });

  it("resolves the melee mode with 1-h edged even when declared from the throwing slot", () => {
    const base = { one_handed_edged: 9, throwing: 4 };
    const reference = ob({ attackModeId: "mode-1", skills: base, slot: "throwing" });
    expect(reference.completeness).toBe("complete");
    expect(
      ob({ attackModeId: "mode-1", skills: { ...base, throwing: 40 }, slot: "throwing" }),
    ).toEqual(reference);
    expect(
      ob({ attackModeId: "mode-1", skills: { ...base, one_handed_edged: 30 }, slot: "throwing" }),
    ).not.toEqual(reference);
    expect(ob({ attackModeId: "mode-1", skills: base, slot: "primary" })).toEqual(reference);
  });

  it("resolves the thrown mode with Throwing even when declared from a non-throwing slot", () => {
    const base = { one_handed_edged: 9, throwing: 4 };
    const reference = ob({ attackModeId: "mode-3", skills: base, slot: "throwing" });
    expect(reference.completeness).toBe("complete");
    expect(ob({ attackModeId: "mode-3", skills: base, slot: "primary" })).toEqual(reference);
    expect(
      ob({ attackModeId: "mode-3", skills: { ...base, one_handed_edged: 40 }, slot: "primary" }),
    ).toEqual(reference);
    expect(
      ob({ attackModeId: "mode-3", skills: { ...base, throwing: 30 }, slot: "primary" }),
    ).not.toEqual(reference);
  });
});

describe("a mode with no competency reference is refused explicitly (the six Firearms modes)", () => {
  const firearms = [
    "Arquebus",
    "Cartridge Pistol",
    "Cartridge Rifle",
    "Hand Cannon",
    "Musket",
    "Pistol",
  ];
  // The character holds every weapon skill, Firearms-named skill included.
  const skills = { bow: 12, crossbow: 8, firearms: 20, throwing: 6 };

  it.each(firearms)("%s: manual calculation is partial with attack_mode_competency", (name) => {
    const weapon = template(name);
    for (const slot of ["primary", "throwing"] as const) {
      const result = baseOb({ attackModeId: "mode-1", skills, slot, template: weapon });
      expect(result).toMatchObject({
        completeness: "partial",
        missingFacts: ["attack_mode_competency"],
      });
      expect(result).not.toHaveProperty("baseOb");
    }
  });

  it.each(firearms)("%s: initiative base is partial with attack_mode_competency", (name) => {
    const weapon = template(name);
    for (const slot of ["primary", "throwing"] as const) {
      expect(
        resolveCanonicalCombatInitiativeBase({
          opportunity: opportunity({ attackModeId: "mode-1", slot, template: weapon }),
          participant: buildParticipant({ skills, template: weapon }),
        }),
      ).toEqual({ completeness: "partial", missingFacts: ["attack_mode_competency"] });
    }
  });

  it("an undeclared attack mode is not answered with some other mode of the weapon", () => {
    const longbow = template("Long bow");
    expect(
      resolveCanonicalCombatInitiativeBase({
        opportunity: opportunity({ attackModeId: "mode-9", slot: "primary", template: longbow }),
        participant: buildParticipant({ skills: { longbow: 10 }, template: longbow }),
      }),
    ).toEqual({ completeness: "partial", missingFacts: ["attack_mode"] });
  });
});

describe("initiative of a bow in the throwing slot", () => {
  it("is the same as from any other slot (missile initiative + Dex GM), never Throwing-dependent", () => {
    const bow = template("Short bow");
    const resolve = (slot: "primary" | "throwing", throwing: number) =>
      resolveCanonicalCombatInitiativeBase({
        opportunity: opportunity({ attackModeId: "mode-1", slot, template: bow }),
        participant: buildParticipant({ skills: { bow: 12, throwing }, template: bow }),
      });
    expect(resolve("throwing", 3).completeness).toBe("complete");
    expect(resolve("throwing", 3)).toEqual(resolve("primary", 3));
    expect(resolve("throwing", 30)).toEqual(resolve("throwing", 3));
  });
});
