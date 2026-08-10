import { describe, expect, it } from "vitest";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import {
  applyDefaultPlayerCombatPhaseContext,
  buildCanonicalCombatTargetOptions,
  buildCombatAttackSourceRef,
  buildCombatDeclarationAttackSelection,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  DEFAULT_MAIN_HAND_PARRY_DIRECTION,
  DEFAULT_OFF_HAND_PARRY_DIRECTION,
  formatScenarioCombatEquipmentDiagnostic,
  getScenarioCombatEquipmentStatus,
  normalizeCombatEquipmentFeatureState,
  resolveCombatFeintDeclarationRequestTarget,
  resolveCombatFeintWeaponSkill,
  resolveCanonicalCombatTargetIdentity,
  resolveCombatEquipmentCharacterId,
  resolveScenarioCombatEquipmentState,
  type PlayerCombatLoadoutReference,
} from "./playerCombatPhaseModel";

const phaseCard = {
  description: "",
  phaseLabel: "Phase 1",
  stats: [],
  title: "",
};

const attackStats = {
  attackMode: "C",
  dmb: "8",
  initiative: "3",
  maxCrits: "FS",
  ob: "10",
  weaponName: "Broad sword",
};

const reference: PlayerCombatLoadoutReference = {
  am: "C",
  am2: "C",
  attackMode: "C",
  attackMode2: "Thrust",
  combinedDb: "18",
  combinedDm: "0",
  combinedParry: "13",
  combinedSourceName: "Sword / shield",
  crit: "F",
  crit2: "E",
  damageClass: "edged",
  damageClass2: "pointed",
  db: "14",
  dmb: "8",
  dmb2: "6",
  dm: "0",
  initiative: "3",
  ob: "10",
  ob2: "9",
  parry: "7",
  secondCrit: "S",
  selectedWeapon: "Broad sword",
};

function buildLoadoutModel(input: {
  fields?: Array<{
    id: "primary" | "secondary";
    label: string;
    options: [];
    value: string;
    valueLabel: string;
  }>;
  rows: Array<Array<string | number>>;
  sourceItemId?: string;
  valueLabel?: string;
  weaponRows?: Array<Record<string, unknown>>;
}): Parameters<typeof buildPlayerCombatLoadoutSummary>[0]["loadoutModel"] {
  return {
    armorSummary: null,
    combatStatePanelModel: {
      capabilityRows: [],
      description: "",
      statsRows: [],
      title: "Combat State Panel",
      weaponRows: input.weaponRows as never,
      weaponModeTable: {
        columns: [
          "Mode",
          "Weapon",
          "I",
          "Attack 1",
          "OB",
          "DMB",
          "Crit 1",
          "Sec",
          "AM",
          "DB",
          "DM",
          "Parry",
          "Attack 2",
          "OB2",
          "DMB2",
          "Crit 2",
          "AM 2",
        ],
        description: "",
        rows: input.rows,
        title: "Weapons",
      },
    },
    encumbranceSkillsTable: null,
    fields: input.fields ?? [
      {
        id: "primary",
        label: "Primary weapon",
        options: [],
        value: input.sourceItemId ?? "primary-weapon",
        valueLabel: input.valueLabel ?? "Long sword",
      },
    ],
  } as Parameters<typeof buildPlayerCombatLoadoutSummary>[0]["loadoutModel"];
}

describe("player combat phase model", () => {
  it("derives a weapon Feint skill from authoritative weapon metadata", () => {
    expect(
      resolveCombatFeintWeaponSkill({
        equipmentState: {
          templates: {
            templatesById: {
              "broad-sword": {
                category: "weapon",
                id: "broad-sword",
                weaponSkill: "1-h edged",
              },
            },
          },
        } as unknown as Parameters<typeof resolveCombatFeintWeaponSkill>[0]["equipmentState"],
        skills: [
          { id: "dodge", name: "Dodge" },
          { id: "one-hand-edged", name: "1-h edged" },
        ],
        sourceTemplateId: "broad-sword",
      }),
    ).toEqual({ id: "one-hand-edged", label: "1-h edged" });
  });

  it("resolves a weapon specialization name through its canonical parent skill", () => {
    expect(
      resolveCombatFeintWeaponSkill({
        equipmentState: {
          templates: {
            templatesById: {
              rapier: {
                category: "weapon",
                id: "rapier",
                weaponSkill: "Fencing",
              },
            },
          },
        } as unknown as Parameters<typeof resolveCombatFeintWeaponSkill>[0]["equipmentState"],
        skills: [{ id: "one_handed_edged", name: "1-h edged" }],
        specializations: [
          {
            id: "fencing",
            name: "Fencing",
            skillId: "one_handed_edged",
          },
        ] as unknown as Parameters<typeof resolveCombatFeintWeaponSkill>[0]["specializations"],
        sourceTemplateId: "rapier",
      }),
    ).toEqual({ id: "one_handed_edged", label: "1-h edged" });
  });

  it("normalizes target options to encounter ids without synthetic raw labels", () => {
    expect(
      buildCanonicalCombatTargetOptions({
        encounterParticipants: [
          {
            id: "encounter-defender",
            scenarioParticipantId: "scenario-defender",
          },
        ] as Parameters<typeof buildCanonicalCombatTargetOptions>[0]["encounterParticipants"],
        options: [
          { displayName: "The Gladiator", id: "scenario-defender" },
          { displayName: "Saved target (scenario-missing)", id: "scenario-missing" },
        ],
      }),
    ).toEqual([{ displayName: "The Gladiator", id: "encounter-defender" }]);
  });

  it("keeps committed scenario item identities while enriching matching attack modes", () => {
    const scenarioEquipmentState = {
      activeLoadoutByCharacterId: {
        "character-1": { activePrimaryWeaponItemId: "scenario-javelin" },
      },
      itemsById: {
        "scenario-javelin": {
          characterId: "character-1",
          id: "scenario-javelin",
          templateId: "weapon-template-javelin",
        },
      },
      locationsById: {},
      templatesById: {
        "weapon-template-javelin": { category: "weapon", id: "weapon-template-javelin" },
      },
    };
    const resolvedEquipmentState = {
      activeLoadoutByCharacterId: {
        "character-1": { activePrimaryWeaponItemId: "external-javelin" },
      },
      itemsById: {
        "external-javelin": {
          characterId: "character-1",
          id: "external-javelin",
          templateId: "weapon-template-javelin",
        },
      },
      locationsById: {},
      templates: {
        templatesById: {
          "weapon-template-javelin": {
            attackModes: [{ id: "thrust", allowsRepeatedRoundAttack: true }],
            category: "weapon",
            id: "weapon-template-javelin",
          },
        },
      },
    };

    const result = resolveScenarioCombatEquipmentState({
      resolvedEquipmentState,
      scenarioEquipmentState,
    });

    expect(result?.activeLoadoutByCharacterId["character-1"]?.activePrimaryWeaponItemId).toBe(
      "scenario-javelin",
    );
    expect(Object.keys(result?.itemsById ?? {})).toEqual(["scenario-javelin"]);
    expect(result?.templates.templatesById["weapon-template-javelin"]).toMatchObject({
      attackModes: [{ id: "thrust", allowsRepeatedRoundAttack: true }],
    });
  });

  it("builds declaration references from committed scenario IDs rather than hydrated IDs", () => {
    const reference = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel: buildLoadoutModel({
        rows: [["Primary", "Fencing sword", "2", "Thrust", "10", "4", "A", "—", "A"]],
        sourceItemId: "scenario-fencing-sword",
        valueLabel: "Fencing sword",
        weaponRows: [
          {
            attackModes: [
              {
                allowsRepeatedRoundAttack: true,
                canonicalMeleeMode: "thrust",
                id: "mode-1",
                isPrimaryAttack: true,
                label: "Thrust",
                order: 0,
              },
            ],
            attackMode1Id: "mode-1",
            currentItemLabel: "Fencing sword",
            itemId: "scenario-fencing-sword",
            modeLabel: "Primary",
            templateId: "weapon-template-fencing-sword",
          },
        ],
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    }).reference;

    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference,
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toEqual({
      attackModeId: "mode-1",
      opportunitySlot: "attack_1",
      scenarioItemId: "scenario-fencing-sword",
      slot: "primary",
      sourceKind: "weapon",
      templateId: "weapon-template-fencing-sword",
    });
  });

  it("serializes the visible Single Attack source and hydrates its selected mode", () => {
    const sourceReference: PlayerCombatLoadoutReference = {
      ...reference,
      sourceAttackModeId: "slash",
      sourceItemId: "scenario-long-sword",
      sourceSlot: "primary",
      sourceTemplateId: "weapon-template-long-sword",
    };

    const selection = buildCombatDeclarationAttackSelection({
      actionId: "attack_parry",
      phaseContexts: {
        phase1: createEmptyPlayerEncounterCombatContext(),
        phase2: createEmptyPlayerEncounterCombatContext(),
      },
      phaseLoadoutSummaries: {
        phase1: {
          reference: sourceReference,
          selectedAttackModeId: "slash",
        },
        phase2: {
          reference: null,
          selectedAttackModeId: undefined,
        },
      },
    });

    expect(selection.phaseAttackSources).toEqual({
      phase1: {
        attackModeId: "slash",
        opportunitySlot: "attack_1",
        scenarioItemId: "scenario-long-sword",
        slot: "primary",
        sourceKind: "weapon",
        templateId: "weapon-template-long-sword",
      },
    });
    expect(selection.phaseContexts.phase1?.attackModeId).toBe("slash");
  });

  it("serializes two explicit Double Attack opportunities for the same weapon", () => {
    const phase1Reference: PlayerCombatLoadoutReference = {
      ...reference,
      sourceAttackModeId: "slash",
      sourceItemId: "scenario-broad-sword",
      sourceSlot: "primary",
      sourceTemplateId: "weapon-template-broad-sword",
    };
    const phase2Reference: PlayerCombatLoadoutReference = {
      ...phase1Reference,
      sourceAttackModeId: "thrust",
    };

    const selection = buildCombatDeclarationAttackSelection({
      actionId: "double_attack",
      phaseContexts: {
        phase1: createEmptyPlayerEncounterCombatContext(),
        phase2: createEmptyPlayerEncounterCombatContext(),
      },
      phaseLoadoutSummaries: {
        phase1: {
          reference: phase1Reference,
          selectedAttackModeId: "slash",
        },
        phase2: {
          reference: phase2Reference,
          selectedAttackModeId: "thrust",
        },
      },
    });

    expect(selection.phaseAttackSources.phase1).toMatchObject({
      attackModeId: "slash",
      opportunitySlot: "attack_1",
      scenarioItemId: "scenario-broad-sword",
    });
    expect(selection.phaseAttackSources.phase2).toMatchObject({
      attackModeId: "thrust",
      opportunitySlot: "attack_2",
      scenarioItemId: "scenario-broad-sword",
    });
    expect(selection.phaseContexts).toMatchObject({
      phase1: { attackModeId: "slash" },
      phase2: { attackModeId: "thrust" },
    });
  });

  it("keeps two same-named weapon instances distinct in the rendered Double Attack phases", () => {
    const attackModes = [
      {
        canonicalMeleeMode: "slash" as const,
        id: "mode-1",
        isPrimaryAttack: true,
        label: "Slash",
        order: 0,
      },
      {
        canonicalMeleeMode: "thrust" as const,
        id: "mode-2",
        isPrimaryAttack: false,
        label: "Thrust",
        order: 1,
      },
    ];
    const loadoutModel = buildLoadoutModel({
      fields: [
        {
          id: "primary",
          label: "Primary weapon",
          options: [],
          value: "long-sword-primary",
          valueLabel: "Long sword",
        },
        {
          id: "secondary",
          label: "Secondary weapon",
          options: [],
          value: "long-sword-secondary",
          valueLabel: "Long sword",
        },
      ],
      rows: [["Primary", "Long sword", "2", "Slash", "10", "8", "FS", "—", "C"]],
      weaponRows: [
        {
          attackModes,
          attackMode1Id: "mode-1",
          currentItemLabel: "Long sword",
          itemId: "long-sword-primary",
          modeLabel: "Primary",
          templateId: "weapon-template-longsword",
        },
        {
          attackModes,
          attackMode1Id: "mode-1",
          currentItemLabel: "Long sword",
          itemId: "long-sword-secondary",
          modeLabel: "Primary",
          templateId: "weapon-template-longsword",
        },
      ],
    });

    const phase1 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
    });
    const selection = buildCombatDeclarationAttackSelection({
      actionId: "double_attack",
      phaseContexts: {
        phase1: createEmptyPlayerEncounterCombatContext(),
        phase2: createEmptyPlayerEncounterCombatContext(),
      },
      phaseLoadoutSummaries: { phase1, phase2 },
    });

    expect(phase1.reference).toMatchObject({
      sourceItemId: "long-sword-primary",
      sourceSlot: "primary",
    });
    expect(phase2.attackModeOptions.map((mode) => mode.id)).toEqual(["mode-1", "mode-2"]);
    expect(phase2.selectedAttackModeId).toBe("mode-1");
    expect(phase2.reference).toMatchObject({
      sourceAttackModeId: "mode-1",
      sourceItemId: "long-sword-secondary",
      sourceSlot: "secondary",
    });
    expect(selection.phaseContexts.phase2?.attackModeId).toBe("mode-1");
    expect(selection.phaseAttackSources.phase2).toMatchObject({
      attackModeId: "mode-1",
      scenarioItemId: "long-sword-secondary",
      slot: "secondary",
    });
  });

  it("surfaces an explicit unavailable Phase 2 mode for an ineligible same-source weapon", () => {
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel: buildLoadoutModel({
        rows: [["Primary", "Long sword", "2", "Slash", "10", "8", "FS", "—", "C"]],
        sourceItemId: "long-sword-primary",
        valueLabel: "Long sword",
        weaponRows: [
          {
            attackModes: [
              {
                canonicalMeleeMode: "slash",
                id: "mode-1",
                isPrimaryAttack: true,
                label: "Slash",
                order: 0,
              },
              {
                canonicalMeleeMode: "thrust",
                id: "mode-2",
                isPrimaryAttack: false,
                label: "Thrust",
                order: 1,
              },
            ],
            attackMode1Id: "mode-1",
            currentItemLabel: "Long sword",
            itemId: "long-sword-primary",
            modeLabel: "Primary",
            templateId: "weapon-template-longsword",
          },
        ],
      }),
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase2.attackModeOptions).toEqual([]);
    expect(phase2.selectedAttackModeId).toBeUndefined();
    expect(phase2.attackModeUnavailableMessage).toBe(
      "The selected Phase 2 attack mode for Long sword is not eligible for same-weapon Double Attack.",
    );
  });

  it("uses the canonical action-phase mapping without affecting Offensive Parry", () => {
    const phase2Reference: PlayerCombatLoadoutReference = {
      ...reference,
      sourceAttackModeId: "slash",
      sourceItemId: "scenario-long-sword",
      sourceSlot: "primary",
      sourceTemplateId: "weapon-template-long-sword",
    };
    const summaries = {
      phase1: { reference: null, selectedAttackModeId: undefined },
      phase2: { reference: phase2Reference, selectedAttackModeId: "slash" },
    };
    const contexts = {
      phase1: createEmptyPlayerEncounterCombatContext(),
      phase2: createEmptyPlayerEncounterCombatContext(),
    };

    expect(
      buildCombatDeclarationAttackSelection({
        actionId: "parry_attack",
        phaseContexts: contexts,
        phaseLoadoutSummaries: summaries,
      }).phaseAttackSources,
    ).toMatchObject({ phase2: { opportunitySlot: "attack_2" } });
    expect(
      buildCombatDeclarationAttackSelection({
        actionId: "offensive_parry",
        phaseContexts: contexts,
        phaseLoadoutSummaries: summaries,
      }).phaseAttackSources,
    ).toEqual({});
  });

  it("retains the committed loadout slot when an enriched row uses an item alias", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        rows: [["Primary", "Long sword", "3", "Slash", "10", "8", "FS", "—", "C"]],
        sourceItemId: "scenario-long-sword",
        valueLabel: "Long sword",
        weaponRows: [
          {
            attackModes: [
              {
                canonicalMeleeMode: "slash",
                id: "mode-1",
                isPrimaryAttack: true,
                label: "Slash",
                order: 0,
              },
            ],
            attackMode1Id: "mode-1",
            currentItemLabel: "Long sword",
            itemId: "hydrated-long-sword-alias",
            modeLabel: "Primary",
            templateId: "weapon-template-long-sword",
          },
        ],
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.reference).toMatchObject({
      sourceAttackModeId: "mode-1",
      sourceItemId: "scenario-long-sword",
      sourceSlot: "primary",
      sourceTemplateId: "weapon-template-long-sword",
    });
  });

  it("does not display an unrelated first weapon row as the selected declaration source", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        rows: [["Primary", "Mace", "3", "Strike", "8", "5", "C", "—", "B"]],
        sourceItemId: "scenario-long-sword",
        valueLabel: "Long sword",
        weaponRows: [
          {
            attackModes: [
              {
                canonicalMeleeMode: "strike",
                id: "mode-1",
                isPrimaryAttack: true,
                label: "Strike",
                order: 0,
              },
            ],
            attackMode1Id: "mode-1",
            currentItemLabel: "Mace",
            itemId: "scenario-mace",
            modeLabel: "Primary",
            templateId: "weapon-template-mace",
          },
        ],
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.reference?.selectedWeapon).toBe("No ready weapon");
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference: summary.reference,
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toBeUndefined();
  });

  it("serializes only an explicitly displayed unarmed declaration source", () => {
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference: {
          ...reference,
          selectedWeapon: "Punch",
          sourceAttackModeId: "mode-1",
          sourceItemId: undefined,
          sourceSlot: undefined,
          sourceTemplateId: "virtual-weapon-template-punch",
        },
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toEqual({
      attackModeId: "mode-1",
      opportunitySlot: "attack_1",
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: "virtual-weapon-template-punch",
    });
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference: null,
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toBeUndefined();
  });

  it("normalizes flat legacy snapshots and resolves their sole committed loadout owner", () => {
    const state = normalizeCombatEquipmentFeatureState({
      activeLoadoutByCharacterId: {
        "base-character-id": { activePrimaryWeaponItemId: "scenario-sword" },
      },
      itemsById: {
        "scenario-sword": { id: "scenario-sword", templateId: "sword-template" },
      },
      templatesById: { "sword-template": { category: "weapon", id: "sword-template" } },
    });

    expect(state?.locationsById).toEqual({});
    expect(
      resolveCombatEquipmentCharacterId({ characterId: "scenario-participant-id", state }),
    ).toBe("base-character-id");
  });

  it("diagnoses a stale committed loadout without substituting hydrated item IDs", () => {
    const scenarioEquipmentState = {
      activeLoadoutByCharacterId: { "character-1": { activeAmmoItemIds: [] } },
      itemsById: {},
      locationsById: {},
      templatesById: {},
    };
    const resolvedEquipmentState = {
      activeLoadoutByCharacterId: {
        "character-1": { activePrimaryWeaponItemId: "external-sword" },
      },
      itemsById: {
        "external-sword": { id: "external-sword", templateId: "sword-template" },
      },
      locationsById: {},
      templatesById: { "sword-template": { category: "weapon", id: "sword-template" } },
    };

    expect(
      getScenarioCombatEquipmentStatus({
        characterId: "character-1",
        resolvedEquipmentState,
        scenarioEquipmentState,
      }),
    ).toMatchObject({ kind: "stale" });
    expect(
      resolveScenarioCombatEquipmentState({
        resolvedEquipmentState,
        scenarioEquipmentState,
      })?.itemsById,
    ).toEqual({});
  });

  it("directs GM and player equipment recovery to the scenario assignment grid", () => {
    const status = { kind: "stale" as const, message: "stale" };

    expect(
      formatScenarioCombatEquipmentDiagnostic({
        isGameMaster: true,
        participantName: "Scyrian",
        status,
      }),
    ).toBe(
      "Scyrian’s scenario equipment is incomplete or out of date. Refresh it from the participant assignment grid on the scenario page.",
    );
    expect(
      formatScenarioCombatEquipmentDiagnostic({
        isGameMaster: false,
        participantName: "Scyrian",
        status,
      }),
    ).toBe(
      "Scyrian’s scenario equipment is incomplete or out of date. Ask the GM to refresh it from the participant assignment grid on the scenario page.",
    );
  });

  it("does not silently replace incomplete committed equipment with Punch or Kick", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      allowUnarmedFallback: false,
      loadoutModel: buildLoadoutModel({ rows: [["Unarmed", "Punch", "0", "Strike", "0"]] }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.attackStats).toBeNull();
    expect(summary.reference).toBeNull();
  });

  it("maps Single attack into phase 1 attack/defense and phase 2 defense", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "attack_parry",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "attack_parry",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.showAttackStats).toBe(true);
    expect(phase1.showAttackLocationSelector).toBe(true);
    expect(phase1.showDefenseContext).toBe(true);
    expect(phase2.showAttackStats).toBe(false);
    expect(phase2.showAttackLocationSelector).toBe(false);
    expect(phase2.showDefenseContext).toBe(true);
  });

  it("maps Reactive attack into separate phase 1 defense and phase 2 attack/defense", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "parry_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "parry_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.showAttackStats).toBe(false);
    expect(phase1.showAttackLocationSelector).toBe(false);
    expect(phase1.showDefenseContext).toBe(true);
    expect(phase2.showAttackStats).toBe(true);
    expect(phase2.showAttackLocationSelector).toBe(true);
    expect(phase2.showDefenseContext).toBe(true);
  });

  it("resolves independent Double Attack modes and uses an eligible same-source fallback", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [
        [
          "Primary",
          "Dagger",
          "2",
          "Slash",
          "7",
          "3",
          "A",
          "—",
          "A",
          "10",
          "0",
          "4",
          "Thrust",
          "8",
          "4",
          "B",
          "B",
        ],
      ],
      valueLabel: "Dagger",
      weaponRows: [
        {
          attackModes: [
            {
              allowsRepeatedRoundAttack: false,
              armorModifier: "A",
              canonicalMeleeMode: "slash",
              crit: "A",
              damageClass: "edged",
              dmb: 3,
              id: "slash",
              isPrimaryAttack: true,
              label: "Slash",
              ob: 7,
              order: 0,
              secondCrit: "—",
            },
            {
              allowsRepeatedRoundAttack: true,
              armorModifier: "B",
              canonicalMeleeMode: "thrust",
              crit: "B",
              damageClass: "pointed",
              dmb: 4,
              id: "thrust",
              isPrimaryAttack: false,
              label: "Thrust",
              ob: 8,
              order: 1,
              secondCrit: "—",
            },
          ],
          attackMode1Id: "slash",
          currentItemLabel: "Dagger",
          itemId: "primary-weapon",
          modeLabel: "Primary",
          templateId: "weapon-template-dagger",
        },
      ],
    });

    const phase1 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackModeId: "slash",
    });
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
      selectedAttackModeId: "slash",
    });

    expect(phase1.selectedAttackModeId).toBe("slash");
    expect(phase1.attackModeOptions.map((mode) => mode.id)).toEqual(["slash", "thrust"]);
    expect(phase1.attackStats).toMatchObject({ ob: "7", weaponDamageClass: "edged" });
    expect(phase2.selectedAttackModeId).toBe("thrust");
    expect(phase2.selectedAttackModeUsedFallback).toBe(true);
    expect(phase2.attackModeOptions.map((mode) => mode.id)).toEqual(["thrust"]);
    expect(phase2.attackStats).toMatchObject({ ob: "8", weaponDamageClass: "pointed" });
  });

  it("keeps Broad sword Thrust canonical for both Double Attack display and submission", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [
        [
          "Primary",
          "Broad sword",
          "2",
          "Slash",
          "10",
          "8",
          "FS",
          "—",
          "C",
          "11",
          "0",
          "7",
          "Thrust",
          "10",
          "7",
          "EP",
          "C",
        ],
      ],
      sourceItemId: "scenario-broad-sword",
      valueLabel: "Broad sword",
      weaponRows: [
        {
          attackModes: [
            {
              armorModifier: "C",
              canonicalMeleeMode: "slash",
              crit: "FS",
              damageClass: "edged",
              dmb: 4,
              id: "mode-1",
              isPrimaryAttack: true,
              label: "Slash",
              ob: 2,
              order: 0,
              secondCrit: null,
            },
            {
              allowsRepeatedRoundAttack: true,
              armorModifier: "C",
              canonicalMeleeMode: "thrust",
              crit: "EP",
              damageClass: "pointed",
              dmb: 3,
              id: "mode-2",
              isPrimaryAttack: false,
              label: "Thrust",
              ob: 1,
              order: 1,
              secondCrit: null,
            },
          ],
          attackMode1Id: "mode-1",
          currentItemLabel: "Broad sword",
          itemId: "scenario-broad-sword",
          modeLabel: "Primary",
          templateId: "weapon-template-broad-sword",
        },
      ],
    });

    const phase1 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackModeId: "mode-2",
    });
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
      selectedAttackModeId: "mode-1",
    });

    expect(phase1.selectedAttackModeId).toBe("mode-2");
    expect(phase1.reference).toMatchObject({
      attackMode: "Thrust",
      sourceAttackModeId: "mode-2",
    });
    expect(phase1.attackStats).toMatchObject({
      weaponCriticalCode: "EP",
      weaponDamageClass: "pointed",
    });
    expect(phase2.selectedAttackModeId).toBe("mode-2");
    expect(phase2.selectedAttackModeUsedFallback).toBe(true);
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase2",
        reference: phase2.reference,
        unarmedTemplateId: "virtual-weapon-template-kick",
      }),
    ).toMatchObject({
      attackModeId: "mode-2",
      opportunitySlot: "attack_2",
      scenarioItemId: "scenario-broad-sword",
      templateId: "weapon-template-broad-sword",
    });
  });

  it("preserves an explicitly selected phase-2 source for authoritative repeat validation", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [["Primary", "Mace", "2", "Strike", "8", "5", "C", "—", "B"]],
      sourceItemId: "scenario-mace",
      valueLabel: "Mace",
      weaponRows: [
        {
          attackModes: [
            {
              canonicalMeleeMode: "strike",
              id: "mode-1",
              isPrimaryAttack: true,
              label: "Strike",
              order: 0,
            },
          ],
          attackMode1Id: "mode-1",
          currentItemLabel: "Mace",
          itemId: "scenario-mace",
          modeLabel: "Primary",
          templateId: "weapon-template-mace",
        },
      ],
    });
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
      selectedAttackModeId: "mode-1",
    });

    expect(phase2.selectedAttackModeId).toBeUndefined();
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase2",
        reference: phase2.reference,
        unarmedTemplateId: "virtual-weapon-template-kick",
      }),
    ).toMatchObject({
      attackModeId: "mode-1",
      opportunitySlot: "attack_2",
      scenarioItemId: "scenario-mace",
      sourceKind: "weapon",
    });
  });

  it("does not invent a phase-2 mode when no mode was selected or eligible", () => {
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel: buildLoadoutModel({
        rows: [["Primary", "Mace", "2", "Strike", "8", "5", "C", "—", "B"]],
        sourceItemId: "scenario-mace",
        valueLabel: "Mace",
        weaponRows: [
          {
            attackModes: [
              {
                canonicalMeleeMode: "strike",
                id: "mode-1",
                isPrimaryAttack: true,
                label: "Strike",
                order: 0,
              },
            ],
            attackMode1Id: "mode-1",
            currentItemLabel: "Mace",
            itemId: "scenario-mace",
            modeLabel: "Primary",
            templateId: "weapon-template-mace",
          },
        ],
      }),
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase2",
        reference: phase2.reference,
        unarmedTemplateId: "virtual-weapon-template-kick",
      }),
    ).toBeUndefined();
  });

  it("maps Double Attack into phase 1 and phase 2 attacks", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-1",
      targetLocation: "head" as const,
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-2",
      targetLocation: "rightArm" as const,
    };
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext: phase1Context,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "double_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext: phase1Context,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "double_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext: phase2Context,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.showAttackStats).toBe(true);
    expect(phase1.showAttackLocationSelector).toBe(true);
    expect(phase1.phaseContext.targetParticipantId).toBe("target-phase-1");
    expect(phase1.phaseContext.targetLocation).toBe("head");
    expect(phase2.showAttackStats).toBe(true);
    expect(phase2.showAttackLocationSelector).toBe(true);
    expect(phase2.phaseContext.targetParticipantId).toBe("target-phase-2");
    expect(phase2.phaseContext.targetLocation).toBe("rightArm");
  });

  it("does not reinterpret a weapon's alternate mode as Double Attack's second opportunity", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [
        [
          "Primary",
          "Long sword",
          "3",
          "Slash",
          "9",
          "8",
          "F",
          "S",
          "C",
          "12",
          "0",
          "7",
          "Thrust",
          "8",
          "6",
          "E",
          "C",
        ],
      ],
      weaponRows: [
        {
          currentItemLabel: "Long sword",
          damageClass1: "edged",
          damageClass2: "pointed",
          modeLabel: "Primary",
        },
      ],
    });

    const phase1 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.attackStats).toMatchObject({
      attackMode: "C",
      dmb: "8",
      maxCrits: "F / S",
      ob: "9",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponName: "Long sword",
    });
    expect(phase2.attackStats).toMatchObject({
      attackMode: "C",
      dmb: "8",
      maxCrits: "F / S",
      ob: "9",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponName: "Long sword",
    });
  });

  it("falls back to Attack 1 for Double Attack phase 2 when no second attack row exists", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [
        [
          "Primary",
          "Dagger",
          "2",
          "Slash",
          "7",
          "3",
          "A",
          "—",
          "A",
          "10",
          "0",
          "4",
          "—",
          "—",
          "—",
          "—",
          "—",
        ],
      ],
      valueLabel: "Dagger",
    });

    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase2.attackStats).toMatchObject({
      attackMode: "A",
      dmb: "3",
      maxCrits: "A",
      ob: "7",
      weaponName: "Dagger",
    });
  });

  it("does not expose a rollable attack source when the loadout has no weapon rows", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel: buildLoadoutModel({ rows: [] }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.attackStats).toBeNull();
  });

  it("maps Adjust Range - Attack into phase 1 range adjustment and phase 2 attack", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "adjust_range_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "adjust_range_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext: {
        ...phaseContext,
        targetParticipantId: "target-phase-2",
      },
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.phaseCard.title).toBe("Adjust range");
    expect(phase1.showAttackStats).toBe(false);
    expect(phase1.showAttackLocationSelector).toBe(false);
    expect(phase1.showDefenseContext).toBe(true);
    expect(phase2.showAttackStats).toBe(true);
    expect(phase2.showAttackLocationSelector).toBe(true);
    expect(phase2.phaseContext.targetParticipantId).toBe("target-phase-2");
  });

  it("keeps phase contexts separable for phase-specific parry directions", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      mainHandParryDirection: "left" as const,
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      mainHandParryDirection: "right" as const,
    };

    const phase1Defense = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext: phase1Context,
      reference,
    });
    const phase2Defense = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext: phase2Context,
      reference,
    });

    expect(phase1Context.mainHandParryDirection).toBe("left");
    expect(phase2Context.mainHandParryDirection).toBe("right");
    expect(phase1Defense?.sourceName).toBe("Sword / shield");
    expect(phase1Defense?.parry).toBe("13");
    expect(phase2Defense?.sourceName).toBe("Sword / shield");
    expect(phase2Defense?.parry).toBe("13");
  });

  it("defaults blank phase parry directions without overwriting saved values", () => {
    const emptyContext = createEmptyPlayerEncounterCombatContext();
    const defaultedContext = applyDefaultPlayerCombatPhaseContext(emptyContext);
    const savedContext = applyDefaultPlayerCombatPhaseContext({
      ...createEmptyPlayerEncounterCombatContext(),
      mainHandParryDirection: "right" as const,
      offHandParryDirection: "right_forward" as const,
    });

    expect(defaultedContext.mainHandParryDirection).toBe(DEFAULT_MAIN_HAND_PARRY_DIRECTION);
    expect(defaultedContext.offHandParryDirection).toBe(DEFAULT_OFF_HAND_PARRY_DIRECTION);
    expect(emptyContext.mainHandParryDirection).toBeUndefined();
    expect(emptyContext.offHandParryDirection).toBeUndefined();
    expect(savedContext.mainHandParryDirection).toBe("right");
    expect(savedContext.offHandParryDirection).toBe("right_forward");
  });

  it("keeps phase-specific aimed target locations separable", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetLocation: "head" as const,
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetLocation: "rightArm" as const,
    };

    expect(applyDefaultPlayerCombatPhaseContext(phase1Context).targetLocation).toBe("head");
    expect(applyDefaultPlayerCombatPhaseContext(phase2Context).targetLocation).toBe("rightArm");
  });

  it("keeps phase-specific attack targets separable", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-1",
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-2",
    };

    expect(applyDefaultPlayerCombatPhaseContext(phase1Context).targetParticipantId).toBe(
      "target-phase-1",
    );
    expect(applyDefaultPlayerCombatPhaseContext(phase2Context).targetParticipantId).toBe(
      "target-phase-2",
    );
  });

  it("serializes the visible scenario Feint target as one canonical encounter target", () => {
    const result = resolveCombatFeintDeclarationRequestTarget({
      encounterParticipants: [
        {
          characterId: "character-defender",
          id: "encounter-defender",
          scenarioParticipantId: "scenario-defender",
        },
      ] as Parameters<
        typeof resolveCombatFeintDeclarationRequestTarget
      >[0]["encounterParticipants"],
      phaseContexts: {
        phase1: {
          ...createEmptyPlayerEncounterCombatContext(),
          targetParticipantId: "scenario-defender",
        },
        phase2: {
          ...createEmptyPlayerEncounterCombatContext(),
          targetParticipantId: "scenario-defender",
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      phaseContexts: {
        phase1: expect.objectContaining({ targetParticipantId: "encounter-defender" }),
        phase2: expect.objectContaining({ targetParticipantId: "encounter-defender" }),
      },
      targetParticipantId: "encounter-defender",
    });
  });

  it("resolves a canonical encounter target to its scenario participant for live API reads", () => {
    expect(
      resolveCanonicalCombatTargetIdentity({
        encounterParticipants: [
          {
            characterId: "character-defender",
            id: "encounter-defender",
            scenarioParticipantId: "scenario-defender",
          },
        ] as Parameters<typeof resolveCanonicalCombatTargetIdentity>[0]["encounterParticipants"],
        targetParticipantId: "encounter-defender",
      }),
    ).toEqual({
      encounterParticipantId: "encounter-defender",
      scenarioParticipantId: "scenario-defender",
    });
  });

  it("does not let a legacy character alias shadow an exact encounter target", () => {
    expect(
      resolveCanonicalCombatTargetIdentity({
        encounterParticipants: [
          {
            characterId: "encounter-defender",
            id: "encounter-attacker",
            scenarioParticipantId: "scenario-attacker",
          },
          {
            characterId: "character-defender",
            id: "encounter-defender",
            scenarioParticipantId: "scenario-defender",
          },
        ] as Parameters<typeof resolveCanonicalCombatTargetIdentity>[0]["encounterParticipants"],
        targetParticipantId: "encounter-defender",
      }),
    ).toEqual({
      encounterParticipantId: "encounter-defender",
      scenarioParticipantId: "scenario-defender",
    });
  });

  it("resolves a fallback scenario-roster target when encounter membership is implicit", () => {
    expect(
      resolveCanonicalCombatTargetIdentity({
        encounterParticipants: [],
        fallbackParticipantIds: ["scenario-defender"],
        targetParticipantId: "scenario-defender",
      }),
    ).toEqual({
      encounterParticipantId: "scenario-defender",
      scenarioParticipantId: "scenario-defender",
    });
  });

  it("treats Phase 1 Feint as a contest and Phase 2 as the committed attack", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "feint_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "feint_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1).toMatchObject({
      showAttackLocationSelector: false,
      showAttackStats: false,
      showDefenseContext: false,
    });
    expect(phase2).toMatchObject({
      showAttackLocationSelector: true,
      showAttackStats: true,
      showDefenseContext: true,
    });
  });

  it("lets the current visible Feint target fill an older empty paired phase", () => {
    const result = resolveCombatFeintDeclarationRequestTarget({
      encounterParticipants: [
        { id: "encounter-defender", scenarioParticipantId: "scenario-defender" },
      ] as Parameters<
        typeof resolveCombatFeintDeclarationRequestTarget
      >[0]["encounterParticipants"],
      phaseContexts: {
        phase1: {
          ...createEmptyPlayerEncounterCombatContext(),
          targetParticipantId: "scenario-defender",
        },
        phase2: createEmptyPlayerEncounterCombatContext(),
      },
    });

    expect(result).toMatchObject({
      ok: true,
      phaseContexts: {
        phase1: { targetParticipantId: "encounter-defender" },
        phase2: { targetParticipantId: "encounter-defender" },
      },
    });
  });

  it("lets the current Phase 1 Feint target replace a stale Phase 2 target", () => {
    const result = resolveCombatFeintDeclarationRequestTarget({
      encounterParticipants: [
        { id: "encounter-a", scenarioParticipantId: "scenario-a" },
        { id: "encounter-b", scenarioParticipantId: "scenario-b" },
      ] as Parameters<
        typeof resolveCombatFeintDeclarationRequestTarget
      >[0]["encounterParticipants"],
      phaseContexts: {
        phase1: {
          ...createEmptyPlayerEncounterCombatContext(),
          targetParticipantId: "scenario-a",
        },
        phase2: {
          ...createEmptyPlayerEncounterCombatContext(),
          targetParticipantId: "scenario-b",
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      phaseContexts: {
        phase1: { targetParticipantId: "encounter-a" },
        phase2: { targetParticipantId: "encounter-a" },
      },
      targetParticipantId: "encounter-a",
    });
  });
});
