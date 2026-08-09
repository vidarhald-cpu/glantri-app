import { describe, expect, it } from "vitest";

import { weaponTemplates } from "@glantri/content/equipment";
import type {
  CombatModifierContribution,
  CombatModifierResolution,
  ScenarioParticipant,
} from "@glantri/domain";
import {
  buildLiveCombatModifierContributionProjection,
  characterBuildSchema,
} from "@glantri/domain";

import { resolveCanonicalScenarioParticipantDefense } from "./combatDefenseResolution";
import {
  resolveCanonicalAttackOffense,
  resolveCanonicalParryBase,
} from "./combatManualCalculationResolution";

function buildParticipant(): ScenarioParticipant {
  const characterId = "character-defender";
  return {
    characterId,
    controlledByUserId: "player-defender",
    createdAt: "2026-08-07T10:00:00.000Z",
    id: "scenario-defender",
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      build: {
        equipment: { items: [] },
        id: characterId,
        name: "Defender",
        profile: {
          distractionLevel: 3,
          id: "profile-defender",
          label: "Defender",
          rolledStats: {
            cha: 10,
            com: 10,
            con: 10,
            dex: 10,
            health: 10,
            int: 10,
            lck: 10,
            pow: 10,
            siz: 10,
            str: 10,
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
          secondaryPoolSpent: 8,
          secondaryPoolTotal: 20,
          skillGroups: [],
          skills: [
            {
              category: "secondary",
              categoryId: "combat",
              groupId: "basic_melee_training",
              secondaryRanks: 8,
              skillId: "dodge",
            },
          ],
          specializations: [],
        },
        progressionState: {
          availablePoints: 0,
          checks: [],
          history: [],
          pendingAttempts: [],
        },
        statModifiers: {},
      },
      displayName: "Defender",
      equipmentState: {
        activeLoadoutByCharacterId: {
          [characterId]: {
            activeAmmoItemIds: [],
            characterId,
            id: "loadout-defender",
            isActive: true,
            name: "Combat",
            quickAccessItemIds: [],
          },
        },
        itemsById: {},
        locationsById: {},
        templatesById: {},
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

function buildArmedParticipant(): ScenarioParticipant {
  const participant = buildParticipant();
  const characterId = participant.characterId!;
  const build = characterBuildSchema.parse(participant.snapshot.build);
  const primary = weaponTemplates.find((template) => template.name === "Long sword");
  const secondary = weaponTemplates.find((template) => template.name === "Dagger");
  if (!primary || !secondary) throw new Error("Missing canonical weapon fixtures.");
  const primaryItemId = "item-primary";
  const secondaryItemId = "item-secondary";
  const locationId = "location-equipped";
  const item = (id: string, templateId: string) => ({
    acquiredFrom: null,
    category: "weapon" as const,
    characterId,
    conditionState: "intact" as const,
    displayName: null,
    id,
    isFavorite: false,
    isStackable: false,
    material: "steel" as const,
    quality: "standard" as const,
    quantity: 1,
    specificityType: "generic" as const,
    storageAssignment: { carryMode: "equipped" as const, locationId },
    templateId,
  });
  return {
    ...participant,
    snapshot: {
      ...participant.snapshot,
      build: {
        ...build,
        progression: {
          ...build.progression,
          skills: [
            ...build.progression.skills,
            {
              category: "secondary",
              categoryId: "combat",
              groupId: "basic_melee_training",
              secondaryRanks: 8,
              skillId: "parry",
            },
          ],
        },
      },
      equipmentState: {
        activeLoadoutByCharacterId: {
          [characterId]: {
            activeAmmoItemIds: [],
            activePrimaryWeaponItemId: primaryItemId,
            activeSecondaryWeaponItemId: secondaryItemId,
            characterId,
            id: "loadout-defender",
            isActive: true,
            name: "Combat",
            quickAccessItemIds: [],
          },
        },
        itemsById: {
          [primaryItemId]: item(primaryItemId, primary.id),
          [secondaryItemId]: item(secondaryItemId, secondary.id),
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
        templatesById: { [primary.id]: primary, [secondary.id]: secondary },
      },
    },
  } as ScenarioParticipant;
}

function contribution(input: {
  bucket?: "db_parry" | "general_fatigue";
  id: string;
  value: number;
  unit?: "flat_db" | "percentage";
}): CombatModifierContribution {
  return {
    applicability: { combatWide: input.bucket === "general_fatigue" },
    bucket: input.bucket ?? "db_parry",
    editPolicy: "system_only",
    id: input.id,
    label: input.id,
    lifetime: { kind: "roll", status: "active" },
    ownerParticipantId: "scenario-defender",
    readOnly: true,
    schemaVersion: 1,
    sourceId: input.id,
    sourceKind: "system_derived",
    unit: input.unit ?? "percentage",
    value: input.value,
  };
}

const resolution = (rows: CombatModifierContribution[]): CombatModifierResolution => ({
  bucket: "db_parry",
  rows,
  total: rows.reduce((total, row) => total + row.value, 0),
});

describe("server-owned combat defense resolution", () => {
  it("derives base defense and composes private dynamic rows without presentation snapshots", () => {
    const calculation = resolveCanonicalScenarioParticipantDefense({
      defenderResolution: resolution([
        contribution({ bucket: "general_fatigue", id: "fatigue", value: -2 }),
        contribution({ id: "phase-db", value: -2 }),
      ]),
      flatDbResolution: resolution([
        contribution({ id: "legacy-flat", unit: "flat_db", value: 1 }),
      ]),
      participant: buildParticipant(),
    });

    expect(calculation).toMatchObject({
      authority: "canonical_scenario_state",
      completeness: "complete",
      dynamicRawModifiers: [
        { label: "fatigue", value: -2 },
        { label: "phase-db", value: -2 },
      ],
      equipment: { sourceKind: "unarmed" },
      flatDbAdjustment: 1,
      participantId: "scenario-defender",
      sourceSnapshotId:
        "scenario-participant:scenario-defender:snapshot:2026-08-07T09:00:00.000Z",
    });
    if (calculation.completeness === "complete") {
      expect(calculation.effectiveDb).toBe(calculation.percentage.db + 1);
      expect(calculation.effectiveDm).toBe(calculation.percentage.dm);
    }
  });

  it("returns partial rather than guessing when canonical base facts are absent", () => {
    expect(
      resolveCanonicalScenarioParticipantDefense({
        defenderResolution: resolution([]),
        participant: { ...buildParticipant(), snapshot: { displayName: "Defender" } },
      }),
    ).toMatchObject({
      authority: "canonical_scenario_state",
      completeness: "partial",
      participantId: "scenario-defender",
    });
  });

  it("excludes a same-group effect from effective DB and applies it to a later group", () => {
    const initiativeGroupId = "round:1:phase:phase1:initiative:6";
    const combatEffects = {
      effects: [
        {
          combatModifierBucket: "db_parry" as const,
          createdAt: "2026-08-07T10:01:00.000Z",
          createdInInitiativeGroupId: initiativeGroupId,
          damage: 0,
          effectGroup: "db" as const,
          effectiveAfterInitiativeGroupId: initiativeGroupId,
          generalDamage: 0,
          id: "same-phase-defense-effect",
          modifierValue: -10,
          sourceEventId: "same-phase-defense-event",
          status: "pending" as const,
          targetParticipantId: "scenario-defender",
          type: "db_modifier" as const,
          updatedAt: "2026-08-07T10:01:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-08-07T10:01:00.000Z",
          description: "Earlier attack consequence",
          id: "same-phase-defense-event",
          sourceLabel: "Attack consequence",
          sourceType: "combat_action" as const,
          targetParticipantId: "scenario-defender",
        },
      ],
    };
    const project = (currentInitiativeGroupId: string) =>
      buildLiveCombatModifierContributionProjection({
        combatEffects,
        currentInitiativeGroupId,
        currentRound: 1,
        encounterId: "encounter-1",
        ownerParticipantId: "scenario-defender",
      });
    const sameGroup = project(initiativeGroupId);
    const laterGroup = project("round:1:phase:phase1:initiative:4");
    const sameGroupCalculation = resolveCanonicalScenarioParticipantDefense({
      defenderResolution: resolution(sameGroup.contributions),
      participant: buildParticipant(),
    });
    const laterGroupCalculation = resolveCanonicalScenarioParticipantDefense({
      defenderResolution: resolution(laterGroup.contributions),
      participant: buildParticipant(),
    });

    expect(sameGroup.contributions).toEqual([]);
    expect(laterGroup.contributions).toEqual([
      expect.objectContaining({ sourceId: "same-phase-defense-effect", value: -10 }),
    ]);
    expect(sameGroupCalculation).toMatchObject({
      completeness: "complete",
      dynamicRawModifiers: [],
    });
    expect(laterGroupCalculation).toMatchObject({
      completeness: "complete",
      dynamicRawModifiers: [{ label: "Attack consequence", value: -10 }],
    });
    if (
      sameGroupCalculation.completeness === "complete" &&
      laterGroupCalculation.completeness === "complete"
    ) {
      expect(laterGroupCalculation.effectiveDb).toBeLessThan(
        sameGroupCalculation.effectiveDb,
      );
    }
  });
});

describe("server-owned manual combat inputs", () => {
  it("derives attack base and dynamic offense from canonical build and source facts", () => {
    const participant = buildArmedParticipant();
    const primary = weaponTemplates.find((template) => template.name === "Long sword")!;
    const calculation = resolveCanonicalAttackOffense({
      attackerResolution: { bucket: "skill_ob", rows: [], total: -2 },
      opponentResolution: { bucket: "skill_ob", rows: [], total: -1 },
      opportunity: {
        attackModeId: primary.attackModes![0]!.id,
        id: "opportunity-1",
        origin: "declared",
        phase: "phase1",
        slot: "attack_1",
        sourceKind: "weapon",
        status: "committed",
        weaponInstanceId: "item-primary",
        weaponSourceId: "item-primary",
        weaponSourceSlot: "primary",
        weaponTemplateId: primary.id,
      },
      participant,
    });

    expect(calculation).toMatchObject({
      authority: "canonical_scenario_state",
      completeness: "complete",
      dynamicRawPercentage: -1,
      participantId: "scenario-defender",
    });
    if (calculation.completeness === "complete") {
      expect(calculation.baseOb).toEqual(expect.any(Number));
      expect(calculation.preOpponentOb).toEqual(expect.any(Number));
    }
  });

  it("derives the selected Parry source totals without accepting a client base", () => {
    const calculation = resolveCanonicalParryBase({
      participant: buildArmedParticipant(),
      usedMainHand: true,
      usedOffHand: true,
    });

    expect(calculation).toMatchObject({
      authority: "canonical_scenario_state",
      completeness: "complete",
      parrySourceLabel: "Long sword + Dagger",
      usedMainHand: true,
      usedOffHand: true,
    });
    if (calculation.completeness === "complete") {
      expect(calculation.combinedParryScore).toEqual(expect.any(Number));
      expect(calculation.mainHandParryScore).toEqual(expect.any(Number));
      expect(calculation.offHandParryScore).toEqual(expect.any(Number));
    }
  });

  it("fails closed instead of accepting presentation totals for incomplete participants", () => {
    expect(
      resolveCanonicalParryBase({
        participant: { ...buildParticipant(), snapshot: { displayName: "Defender" } },
        usedMainHand: true,
      }),
    ).toMatchObject({
      authority: "canonical_scenario_state",
      completeness: "partial",
    });
  });

  it("fails closed when a declared weapon source is absent from canonical equipment", () => {
    const participant = buildArmedParticipant();
    const primary = weaponTemplates.find((template) => template.name === "Long sword")!;

    expect(
      resolveCanonicalAttackOffense({
        attackerResolution: { bucket: "skill_ob", rows: [], total: 0 },
        opponentResolution: { bucket: "skill_ob", rows: [], total: 0 },
        opportunity: {
          attackModeId: primary.attackModes![0]!.id,
          id: "missing-source-opportunity",
          origin: "declared",
          phase: "phase1",
          slot: "attack_1",
          sourceKind: "weapon",
          status: "committed",
          weaponInstanceId: "missing-item",
          weaponSourceId: "missing-item",
          weaponSourceSlot: "primary",
          weaponTemplateId: primary.id,
        },
        participant,
      }),
    ).toMatchObject({
      completeness: "partial",
      missingFacts: ["weapon_source_identity"],
    });
  });
});
