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
  resolveCanonicalWeaponParryBase,
} from "./combatManualCalculationResolution";
import {
  buildCanonicalCombatDefenseSnapshot,
  getCombatDefenseRefusalMessage,
  resolveCanonicalParryBaseForDefenseSnapshot,
} from "./combatDefenseSnapshotResolution";
import { resolveCanonicalParticipantCalculationContext } from "./combatParticipantCalculationResolution";

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
    revision: "2026-08-07T09:00:00.000Z",
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

function getArmedEquipmentState(participant: ScenarioParticipant) {
  return participant.snapshot.equipmentState as {
    activeLoadoutByCharacterId: Record<
      string,
      { activePrimaryWeaponItemId?: string; activeSecondaryWeaponItemId?: string }
    >;
    itemsById: Record<
      string,
      { id: string; revision?: string; templateId: string } & Record<string, unknown>
    >;
  };
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
      sourceSnapshotId: "scenario-participant:scenario-defender:snapshot:2026-08-07T09:00:00.000Z",
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
      expect(laterGroupCalculation.effectiveDb).toBeLessThan(sameGroupCalculation.effectiveDb);
    }
  });
});

describe("per-attack defense snapshot resolution", () => {
  it("captures exact equipment revisions and GM inclusion provenance", () => {
    const attacker = {
      ...buildParticipant(),
      id: "scenario-attacker",
      visibilityOverrides: { visibility: "hidden" as const },
    };
    const defender = buildArmedParticipant();
    const equipmentState = defender.snapshot.equipmentState as {
      activeLoadoutByCharacterId: Record<
        string,
        { activePrimaryWeaponItemId?: string; activeSecondaryWeaponItemId?: string }
      >;
    };
    const loadout = equipmentState.activeLoadoutByCharacterId[defender.characterId!];
    const primaryId = loadout!.activePrimaryWeaponItemId!;
    const secondaryId = loadout!.activeSecondaryWeaponItemId!;

    const result = buildCanonicalCombatDefenseSnapshot({
      attacker,
      attackerCombatantId: "attacker",
      attackId: "1:opportunity:attack-1",
      attackOpportunityId: "attack-1",
      aware: true,
      defender,
      defenderCombatantId: "defender",
      phase: "phase1",
      reviewedAt: "2026-08-18T10:00:00.000Z",
      reviewedByUserId: "gm",
      roundNumber: 1,
      sourceSelections: [
        { included: true, itemId: primaryId },
        { included: false, itemId: secondaryId },
      ],
    });

    expect(result).toMatchObject({
      aware: true,
      awarenessDefault: false,
      awarenessOverridden: true,
      ordinaryDodgeAvailable: true,
    });
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decision: "gm_included",
          included: true,
          itemId: primaryId,
          itemRevision: "2026-08-07T09:00:00.000Z",
        }),
        expect.objectContaining({
          decision: "gm_excluded",
          included: false,
          itemId: secondaryId,
          itemRevision: "2026-08-07T09:00:00.000Z",
        }),
      ]),
    );
  });

  it("rejects forged defense-source item identities before creating a snapshot", () => {
    expect(() =>
      buildCanonicalCombatDefenseSnapshot({
        attacker: buildParticipant(),
        attackerCombatantId: "attacker",
        attackId: "1:opportunity:attack-1",
        attackOpportunityId: "attack-1",
        aware: true,
        defender: buildArmedParticipant(),
        defenderCombatantId: "defender",
        phase: "phase1",
        reviewedAt: "2026-08-18T10:00:00.000Z",
        roundNumber: 1,
        sourceSelections: [{ included: true, itemId: "forged-item" }],
      }),
    ).toThrow(/Defense sources changed/);
  });

  it("uses only the exact included source committed for this incoming attack", () => {
    const attacker = { ...buildParticipant(), id: "scenario-attacker" };
    const defender = buildArmedParticipant();
    const equipmentState = getArmedEquipmentState(defender);
    const loadout = equipmentState.activeLoadoutByCharacterId[defender.characterId!]!;
    const snapshot = buildCanonicalCombatDefenseSnapshot({
      attacker,
      attackerCombatantId: "attacker",
      attackId: "1:opportunity:attack-a",
      attackOpportunityId: "attack-a",
      aware: true,
      defender,
      defenderCombatantId: "defender",
      phase: "phase1",
      reviewedAt: "2026-08-18T10:00:00.000Z",
      roundNumber: 1,
      sourceSelections: [
        { included: true, itemId: loadout.activePrimaryWeaponItemId! },
        { included: false, itemId: loadout.activeSecondaryWeaponItemId! },
      ],
    });

    const result = resolveCanonicalParryBaseForDefenseSnapshot({
      attackId: snapshot.attackId,
      attackOpportunityId: snapshot.attackOpportunityId,
      attackerCombatantId: snapshot.attackerParticipantId,
      defender,
      defenderCombatantId: snapshot.defenderParticipantId,
      phase: snapshot.phase,
      snapshot,
    });

    expect(result).toMatchObject({
      completeness: "complete",
      parrySourceLabel: "Long sword",
      usedMainHand: true,
      usedOffHand: false,
    });
  });

  it("rejects stale included equipment instead of substituting the current loadout", () => {
    const attacker = { ...buildParticipant(), id: "scenario-attacker" };
    const defender = buildArmedParticipant();
    const equipmentState = getArmedEquipmentState(defender);
    const loadout = equipmentState.activeLoadoutByCharacterId[defender.characterId!]!;
    const snapshot = buildCanonicalCombatDefenseSnapshot({
      attacker,
      attackerCombatantId: "attacker",
      attackId: "1:opportunity:attack-a",
      attackOpportunityId: "attack-a",
      aware: true,
      defender,
      defenderCombatantId: "defender",
      phase: "phase1",
      reviewedAt: "2026-08-18T10:00:00.000Z",
      roundNumber: 1,
      sourceSelections: [{ included: true, itemId: loadout.activePrimaryWeaponItemId! }],
    });
    const stale = {
      ...defender,
      snapshot: {
        ...defender.snapshot,
        equipmentState: {
          ...defender.snapshot.equipmentState!,
          itemsById: {
            ...equipmentState.itemsById,
            [loadout.activePrimaryWeaponItemId!]: {
              ...equipmentState.itemsById[loadout.activePrimaryWeaponItemId!]!,
              revision: "2026-08-18T10:01:00.000Z",
            },
          },
        },
      },
    } as ScenarioParticipant;

    expect(
      resolveCanonicalParryBaseForDefenseSnapshot({
        attackId: snapshot.attackId,
        attackOpportunityId: snapshot.attackOpportunityId,
        attackerCombatantId: snapshot.attackerParticipantId,
        defender: stale,
        defenderCombatantId: snapshot.defenderParticipantId,
        phase: snapshot.phase,
        snapshot,
      }),
    ).toMatchObject({ completeness: "partial", missingFacts: ["defense_snapshot_source"] });
  });

  it("rejects a snapshot linked to another incoming attack", () => {
    const attacker = { ...buildParticipant(), id: "scenario-attacker" };
    const defender = buildArmedParticipant();
    const snapshot = buildCanonicalCombatDefenseSnapshot({
      attacker,
      attackerCombatantId: "attacker",
      attackId: "1:opportunity:attack-a",
      attackOpportunityId: "attack-a",
      aware: true,
      defender,
      defenderCombatantId: "defender",
      phase: "phase1",
      reviewedAt: "2026-08-18T10:00:00.000Z",
      roundNumber: 1,
      sourceSelections: [],
    });

    expect(
      resolveCanonicalParryBaseForDefenseSnapshot({
        attackId: "1:opportunity:attack-b",
        attackOpportunityId: "attack-b",
        attackerCombatantId: snapshot.attackerParticipantId,
        defender,
        defenderCombatantId: snapshot.defenderParticipantId,
        phase: snapshot.phase,
        snapshot,
      }),
    ).toMatchObject({ completeness: "partial", missingFacts: ["defense_snapshot_identity"] });
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

  it("binds special Parry to one exact main/off-hand weapon and excludes combined sources", () => {
    const participant = buildArmedParticipant();
    const equipmentState = participant.snapshot.equipmentState as {
      itemsById: Record<string, { templateId: string }>;
    };
    const mainHand = resolveCanonicalWeaponParryBase({
      expectedItemRevision: "2026-08-07T09:00:00.000Z",
      expectedTemplateId: equipmentState.itemsById["item-primary"]!.templateId,
      participant,
      weaponItemId: "item-primary",
    });
    const offHand = resolveCanonicalWeaponParryBase({
      expectedItemRevision: "2026-08-07T09:00:00.000Z",
      expectedTemplateId: equipmentState.itemsById["item-secondary"]!.templateId,
      participant,
      weaponItemId: "item-secondary",
    });
    const forgedCombined = resolveCanonicalParryBase({
      participant,
      usedMainHand: true,
      usedOffHand: true,
    });

    expect(mainHand).toMatchObject({
      completeness: "complete",
      offHandParryScore: undefined,
      parrySourceLabel: "Long sword",
      usedMainHand: true,
      usedOffHand: false,
    });
    expect(offHand).toMatchObject({
      completeness: "complete",
      mainHandParryScore: undefined,
      parrySourceLabel: "Dagger",
      usedMainHand: false,
      usedOffHand: true,
    });
    if (mainHand.completeness === "complete" && forgedCombined.completeness === "complete") {
      expect(mainHand.combinedParryScore).not.toBe(forgedCombined.combinedParryScore);
    }
  });

  it("rejects stale, mismatched, and no-longer-wielded special Parry Items", () => {
    const participant = buildArmedParticipant();
    const equipmentState = participant.snapshot.equipmentState as {
      activeLoadoutByCharacterId: Record<string, Record<string, unknown>>;
      itemsById: Record<string, { templateId: string }>;
    };
    const primaryTemplateId = equipmentState.itemsById["item-primary"]!.templateId;
    const resolve = (override: Partial<Parameters<typeof resolveCanonicalWeaponParryBase>[0]>) =>
      resolveCanonicalWeaponParryBase({
        expectedItemRevision: "2026-08-07T09:00:00.000Z",
        expectedTemplateId: primaryTemplateId,
        participant,
        weaponItemId: "item-primary",
        ...override,
      });

    expect(resolve({ expectedItemRevision: "2026-08-07T08:00:00.000Z" })).toMatchObject({
      completeness: "partial",
      missingFacts: ["parry_source_identity"],
    });
    expect(resolve({ expectedTemplateId: "weapon-template-dagger" })).toMatchObject({
      completeness: "partial",
      missingFacts: ["parry_source_identity"],
    });
    expect(
      resolve({
        participant: {
          ...participant,
          snapshot: {
            ...participant.snapshot,
            equipmentState: {
              ...equipmentState,
              activeLoadoutByCharacterId: {
                [participant.characterId!]: {
                  ...equipmentState.activeLoadoutByCharacterId[participant.characterId!],
                  activePrimaryWeaponItemId: null,
                  quickAccessItemIds: ["item-primary"],
                },
              },
            },
          },
        },
      }),
    ).toMatchObject({
      completeness: "partial",
      missingFacts: ["parry_source_identity"],
    });
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

/**
 * Forgejo #694. A Template-derived temporary actor has no Character and therefore no
 * Character-sourced equipment aggregate — `scenarioParticipantSnapshotSchema` types that
 * projection's provenance as `character_equipment_aggregate`, and #666 settled that deliberately.
 * The defense-review step used to demand both a Character identifier and that aggregate, so the
 * same participant was resolvable for the attack step and unresolvable for the next one. These
 * tests bind the capability that closes the asymmetry, and the boundary that keeps a Character
 * participant's missing aggregate a refusal.
 */
function buildTemporaryActorParticipant(input?: { omitBuild?: boolean }): ScenarioParticipant {
  const character = buildParticipant();
  const build = characterBuildSchema.parse(character.snapshot.build);
  return {
    controlledByUserId: undefined,
    createdAt: "2026-08-07T10:00:00.000Z",
    id: "scenario-temporary-actor",
    isActive: true,
    joinSource: "gm_added",
    role: "npc",
    scenarioId: "scenario-1",
    snapshot: {
      ...(input?.omitBuild ? {} : { build: { ...build, id: "temporary-actor", name: "Bandit" } }),
      displayName: "Bandit",
      entity: { kind: "npc", name: "Bandit" },
      sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
    },
    sourceType: "entity",
    state: character.state,
    updatedAt: "2026-08-07T10:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

describe("#694 defense resolution for a participant with no Character equipment aggregate", () => {
  it("resolves a complete calculation context from the build alone and records the aggregate as absent", () => {
    const context = resolveCanonicalParticipantCalculationContext(buildTemporaryActorParticipant());

    expect(context.completeness).toBe("complete");
    if (context.completeness !== "complete") return;
    // Nothing is synthesised to satisfy a Character-shaped test: the identifier and the aggregate
    // are reported as the absences they are, and every equipment-derived slot stays empty.
    expect(context.equipmentProvenance).toBe("absent");
    expect(context.characterId).toBeNull();
    expect(context.equipmentState).toBeNull();
    expect(context.primaryWeaponTemplate).toBeNull();
    expect(context.secondaryWeaponTemplate).toBeNull();
    expect(context.readyShieldTemplate).toBeNull();
    expect(context.armorTemplate).toBeNull();
    expect(context.loadout).toBeUndefined();
    expect([...context.itemsById.keys()]).toEqual([]);
  });

  it("commits a defense review for that participant with no Parry sources", () => {
    const snapshot = buildCanonicalCombatDefenseSnapshot({
      attacker: buildArmedParticipant(),
      attackerCombatantId: "attacker",
      attackId: "1:opportunity:attack-1",
      attackOpportunityId: "opportunity-1",
      aware: true,
      defender: buildTemporaryActorParticipant(),
      defenderCombatantId: "defender",
      phase: "phase1",
      reviewedAt: "2026-08-07T10:05:00.000Z",
      reviewedByUserId: "user-gm",
      roundNumber: 1,
      sourceSelections: [],
    });

    expect(snapshot.status).toBe("committed");
    expect(snapshot.sources).toEqual([]);
    expect(snapshot.ordinaryDodgeAvailable).toBe(true);
  });

  it("refuses a Parry source selection naming equipment the participant does not have", () => {
    expect(() =>
      buildCanonicalCombatDefenseSnapshot({
        attacker: buildArmedParticipant(),
        attackerCombatantId: "attacker",
        attackId: "1:opportunity:attack-1",
        attackOpportunityId: "opportunity-1",
        aware: true,
        defender: buildTemporaryActorParticipant(),
        defenderCombatantId: "defender",
        phase: "phase1",
        reviewedAt: "2026-08-07T10:05:00.000Z",
        roundNumber: 1,
        sourceSelections: [{ included: true, itemId: "item-primary" }],
      }),
    ).toThrow(/Defense sources changed/);
  });

  it("reports the absent carried load rather than defaulting the defender to an unencumbered one", () => {
    const calculation = resolveCanonicalScenarioParticipantDefense({
      defenderResolution: resolution([]),
      participant: buildTemporaryActorParticipant(),
    });

    // Encumbrance is derived from a carried load, and there is no carried-load projection to
    // derive it from. An unencumbered default here would publish a DB and DM nobody authored.
    expect(calculation).toMatchObject({
      authority: "canonical_scenario_state",
      completeness: "partial",
      missingFacts: ["character_equipment_aggregate"],
      participantId: "scenario-temporary-actor",
    });
  });

  it("still refuses a participant that has no build at all", () => {
    const context = resolveCanonicalParticipantCalculationContext(
      buildTemporaryActorParticipant({ omitBuild: true }),
    );

    expect(context).toMatchObject({
      completeness: "partial",
      missingFacts: ["character_build"],
    });
  });

  it("keeps a Character participant's missing equipment aggregate a refusal", () => {
    const character = buildParticipant();
    const withoutAggregate = {
      ...character,
      snapshot: { ...character.snapshot, equipmentState: undefined },
    } as ScenarioParticipant;

    const context = resolveCanonicalParticipantCalculationContext(withoutAggregate);

    // The participant has a Character, so it has an aggregate to read: a missing one is a missing
    // fact, not an absent one. Defining absence by the equipment state alone would resolve this
    // participant `complete` and silently drop its real equipment from the calculation.
    expect(context).toMatchObject({
      completeness: "partial",
      missingFacts: ["equipment_items", "equipment_state"],
    });
  });

  it("keeps the aggregate Character-sourced when only the loadout map names the Character", () => {
    const character = buildArmedParticipant();
    const withoutParticipantCharacterId = {
      ...character,
      characterId: undefined,
    } as ScenarioParticipant;

    const context = resolveCanonicalParticipantCalculationContext(withoutParticipantCharacterId);

    expect(context.completeness).toBe("complete");
    if (context.completeness !== "complete") return;
    // Defining absence by the participant's own `characterId` alone would call this aggregate
    // absent and discard the equipment it actually carries.
    expect(context.equipmentProvenance).toBe("character_equipment_aggregate");
    expect(context.characterId).toBe("character-defender");
    expect(context.primaryWeaponTemplate?.name).toBe("Long sword");
  });
});

describe("#694 GM-facing wording for a defense that cannot be resolved", () => {
  it("never tells the GM to refresh for a condition refreshing cannot repair", () => {
    const noBuild = getCombatDefenseRefusalMessage(["character_build"]);
    const noAggregate = getCombatDefenseRefusalMessage(["character_equipment_aggregate"]);

    for (const message of [noBuild, noAggregate]) {
      expect(message.toLowerCase()).not.toContain("refresh");
      expect(message).toContain("Nothing was recorded.");
    }
    expect(noBuild).toContain("characteristics or skills");
    expect(noAggregate).toContain("reloading will not add any");
  });

  it("names the control that does repair a Character's stale scenario equipment", () => {
    const message = getCombatDefenseRefusalMessage(["equipment_state", "equipment_items"]);

    expect(message).toContain("participant assignment grid on the scenario page");
    expect(message).toContain("Nothing was recorded.");
    expect(message.toLowerCase()).not.toContain("refresh combat");
  });

  /**
   * #922. `workbook_adjustment` used to mean "the committed modifier total ran off the end of an
   * authored table", which is no longer a refusal at all. What it can still mean is a defence value
   * the open-ended rule has no reading of — a base defence below zero — and no change to the
   * defender's skills or equipment repairs that, so the sentence asks for neither.
   */
  it("does not blame skills or equipment for a defence value the rule cannot read", () => {
    const message = getCombatDefenseRefusalMessage(["workbook_adjustment"]);

    expect(message).toContain("no reading for");
    expect(message).toContain("Nothing was recorded.");
    expect(message.toLowerCase()).not.toContain("refresh");
    expect(message).not.toContain("no defensive skill");
    expect(message).not.toContain("defensive skill such as Dodge");
    // The cause wins over the equipment fallback even when another fact is reported beside it.
    expect(getCombatDefenseRefusalMessage(["equipment_state", "workbook_adjustment"])).toBe(
      message,
    );
  });
});

/**
 * #1103. A generated NPC has no Character and no persistent Item record, so its Items carry no
 * `revision`. Its armed shape mirrors `buildArmedParticipant`, without a participant `characterId`
 * and with every Item revision removed, as Generate NPC writes it.
 */
function buildGeneratedNpcParticipant(): ScenarioParticipant {
  const armed = buildArmedParticipant();
  const state = getArmedEquipmentState(armed);
  return {
    ...armed,
    characterId: undefined,
    snapshot: {
      ...armed.snapshot,
      equipmentState: {
        ...state,
        itemsById: Object.fromEntries(
          Object.entries(state.itemsById).map(([itemId, { revision: _revision, ...item }]) => [
            itemId,
            item,
          ]),
        ),
      },
    },
    sourceType: "reusable_entity",
  } as unknown as ScenarioParticipant;
}

function commitDefenseFor(defender: ScenarioParticipant) {
  return buildCanonicalCombatDefenseSnapshot({
    attacker: buildArmedParticipant(),
    attackerCombatantId: "attacker",
    attackId: "1:opportunity:attack-1",
    attackOpportunityId: "opportunity-1",
    aware: true,
    defender,
    defenderCombatantId: "defender",
    phase: "phase1",
    reviewedAt: "2026-08-07T10:05:00.000Z",
    reviewedByUserId: "user-gm",
    roundNumber: 1,
    sourceSelections: [],
  });
}

describe("#1103 defense review for an armed participant without a Character", () => {
  it("reads a missing Item revision as the participant snapshot's version", () => {
    const context = resolveCanonicalParticipantCalculationContext(buildGeneratedNpcParticipant());

    expect(context.completeness).toBe("complete");
    if (context.completeness !== "complete") return;
    expect(context.itemsById.get("item-primary")?.revision).toBe("2026-08-07T09:00:00.000Z");
    expect(context.primaryWeaponTemplate?.name).toBe("Long sword");
  });

  it("falls back to the participant's createdAt when the snapshot has no sourceUpdatedAt", () => {
    const npc = buildGeneratedNpcParticipant();
    const context = resolveCanonicalParticipantCalculationContext({
      ...npc,
      snapshot: { ...npc.snapshot, sourceUpdatedAt: undefined },
    } as ScenarioParticipant);

    expect(context.completeness).toBe("complete");
    if (context.completeness !== "complete") return;
    expect(context.itemsById.get("item-primary")?.revision).toBe("2026-08-07T10:00:00.000Z");
  });

  it("commits the defense review with the weapon Parry and verifies it against the same revision", () => {
    const defender = buildGeneratedNpcParticipant();
    const snapshot = commitDefenseFor(defender);

    expect(snapshot.status).toBe("committed");
    expect(snapshot.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: "item-primary",
          itemRevision: "2026-08-07T09:00:00.000Z",
        }),
      ]),
    );
    expect(
      resolveCanonicalParryBaseForDefenseSnapshot({
        attackId: snapshot.attackId,
        attackOpportunityId: snapshot.attackOpportunityId,
        attackerCombatantId: snapshot.attackerParticipantId,
        defender,
        defenderCombatantId: snapshot.defenderParticipantId,
        phase: snapshot.phase,
        snapshot,
      }),
    ).toMatchObject({ completeness: "complete", parrySourceLabel: "Long sword + Dagger" });
  });

  it("keeps an Item revision the participant already carries", () => {
    const armed = buildArmedParticipant();
    const context = resolveCanonicalParticipantCalculationContext({
      ...armed,
      characterId: undefined,
    } as ScenarioParticipant);

    expect(context.completeness).toBe("complete");
    if (context.completeness !== "complete") return;
    expect(context.itemsById.get("item-primary")?.revision).toBe("2026-08-07T09:00:00.000Z");
  });

  it("keeps a Character participant's missing Item revision a refusal", () => {
    const character = buildArmedParticipant();
    const state = getArmedEquipmentState(character);
    const withoutRevision = {
      ...character,
      snapshot: {
        ...character.snapshot,
        equipmentState: {
          ...state,
          itemsById: Object.fromEntries(
            Object.entries(state.itemsById).map(([itemId, { revision: _revision, ...item }]) => [
              itemId,
              item,
            ]),
          ),
        },
      },
    } as unknown as ScenarioParticipant;

    expect(() => commitDefenseFor(withoutRevision)).toThrow(/Defense sources changed/);
  });
});
