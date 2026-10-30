import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { kickTemplate, punchTemplate } from "@glantri/content/equipment";
import { combatAttackSourceRefSchema, parseCompetencyId } from "@glantri/domain";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import {
  applyDefaultPlayerCombatPhaseContext,
  buildCanonicalCombatTargetOptions,
  buildCombatAttackSourceRef,
  buildCombatDeclarationAttackSelection,
  getCombatDeclarationAttackModeUnavailableMessage,
  getCombatDeclarationAttackSourceRequiredMessage,
  getCombatDeclarationSelectableAttackSourceCount,
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
    id: "missile" | "primary" | "secondary" | "throwing";
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

  it("projects a selected dagger throw only through its Throwing row and keeps melee modes ordinary", () => {
    const loadoutModel = buildLoadoutModel({
      fields: [
        {
          id: "primary",
          label: "Primary weapon",
          options: [],
          value: "scenario-dagger",
          valueLabel: "Dagger",
        },
        {
          id: "throwing",
          label: "Throwing weapon",
          options: [],
          value: "scenario-dagger",
          valueLabel: "Dagger",
        },
      ],
      rows: [
        ["Primary", "Dagger", "2", "Thrust", "8", "3", "DP", "—", "A"],
        ["Thrown", "Dagger", "-1", "Throw", "5", "1", "DP", "—", "A"],
      ],
      weaponRows: [
        {
          attackModes: [
            {
              attackType: "melee",
              canonicalMeleeMode: "thrust",
              crit: "DP",
              dmb: 3,
              id: "mode-1",
              initiative: 2,
              isPrimaryAttack: true,
              label: "Thrust",
              ob: 8,
              order: 0,
            },
            {
              attackType: "melee",
              canonicalMeleeMode: "slash",
              crit: "E",
              dmb: 2,
              id: "mode-2",
              initiative: 2,
              label: "Slash",
              ob: 7,
              order: 1,
            },
          ],
          attackMode1Id: "mode-1",
          currentItemLabel: "Dagger",
          itemId: "scenario-dagger",
          modeLabel: "Primary",
          templateId: "weapon-template-dagger",
        },
        {
          attackModes: [
            {
              allowsRepeatedRoundAttack: false,
              armorModifier: "A",
              attackType: "thrown",
              canonicalMeleeMode: null,
              crit: "DP",
              damageClass: "pointed",
              dmb: 1,
              id: "mode-3",
              initiative: -1,
              isPrimaryAttack: true,
              label: "Throw",
              ob: 5,
              order: 2,
              provenance: "imported",
              range: "10/30/60",
              sourceMetadata: {
                rawRow: { A: "Dagger" },
                row: 12,
                sheet: "Weapon2",
                sourceColumns: { A: "Weapon" },
                sourceRange: "A12:K12",
                workbook: "Themistogenes 1.07.xlsx",
              },
            },
          ],
          attackMode1Id: "mode-3",
          currentItemLabel: "Dagger",
          itemId: "scenario-dagger",
          modeLabel: "Thrown",
          templateId: "weapon-template-dagger",
        },
      ],
    });
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackModeId: "mode-3",
    });

    expect(summary.selectedAttackModeId).toBe("mode-3");
    // A player's attack stats name the provenance kind, never the workbook coordinates (#517
    // ruling E2); only the GM's Combat Round Manager asks for them.
    expect(summary.attackStats).toMatchObject({
      provenance: "imported",
      range: "10/30/60",
    });
    expect(JSON.stringify(summary)).not.toContain("A12:K12");
    const gmSummary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      includeSourceProvenance: true,
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackModeId: "mode-3",
    });
    expect(gmSummary.attackStats).toMatchObject({
      provenance: "Weapon2 row 12 · A12:K12",
      range: "10/30/60",
    });
    expect(summary.reference).toMatchObject({
      am: "A",
      attackMode: "Throw",
      crit: "DP",
      dmb: "1",
      initiative: "-1",
      ob: "5",
      sourceAttackModeId: "mode-3",
      sourceItemId: "scenario-dagger",
      sourceSlot: "throwing",
      sourceTemplateId: "weapon-template-dagger",
    });
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference: summary.reference,
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toMatchObject({
      attackModeId: "mode-3",
      scenarioItemId: "scenario-dagger",
      slot: "throwing",
      templateId: "weapon-template-dagger",
    });

    const meleeSummary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackModeId: "mode-1",
    });
    expect(meleeSummary.reference).toMatchObject({
      attackMode: "Thrust",
      dmb: "3",
      initiative: "2",
      ob: "8",
      sourceAttackModeId: "mode-1",
      sourceItemId: "scenario-dagger",
      sourceSlot: "primary",
    });
    expect(loadoutModel.combatStatePanelModel?.weaponRows?.[0]?.attackModes).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ attackType: "thrown" })]),
    );
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
    expect(
      buildCombatDeclarationAttackSelection({
        actionId: "disarm",
        disarmPhase: "phase2",
        phaseContexts: contexts,
        phaseLoadoutSummaries: summaries,
      }).phaseAttackSources,
    ).toMatchObject({
      phase2: { opportunitySlot: "attack_2", scenarioItemId: "scenario-long-sword" },
    });
    expect(
      buildCombatDeclarationAttackSelection({
        actionId: "parry_disarm",
        phaseContexts: contexts,
        phaseLoadoutSummaries: summaries,
      }).phaseAttackSources,
    ).toEqual({});
  });

  it("ignores unavailable attack modes when the declaration has no attack phase", () => {
    const phaseLoadoutSummaries = {
      phase1: { attackModeUnavailableMessage: "Phase 1 has no legal attack mode." },
      phase2: { attackModeUnavailableMessage: "Phase 2 has no legal attack mode." },
    };

    expect(
      getCombatDeclarationAttackModeUnavailableMessage({
        actionId: "pass",
        phaseLoadoutSummaries,
        secondaryActionId: "equip_unequip",
      }),
    ).toBeUndefined();
    expect(
      getCombatDeclarationAttackModeUnavailableMessage({
        actionId: "attack_parry",
        phaseLoadoutSummaries,
      }),
    ).toBe("Phase 1 has no legal attack mode.");
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

  // #666 — a Template-derived temporary actor never has a Character scenario-equipment projection,
  // because one is only ever written by the Character-only `refresh-character-equipment` reconcile.
  // Diagnosing that structural absence as a repairable Character fault both named a control the
  // participant assignment grid does not render for a temporary actor and, through
  // `allowUnarmedFallback`, withheld the intrinsic attack sources that are such an actor's only
  // legal ones.
  it("treats a temporary actor carrying no committed equipment as unarmed rather than incomplete", () => {
    expect(
      getScenarioCombatEquipmentStatus({
        participantSourceType: "entity",
        scenarioEquipmentState: undefined,
      }),
    ).toEqual({ kind: "unarmed" });

    // A template that authors an equipment state with no loadout owner is still unarmed, not faulty:
    // there is nothing a Character refresh could reconcile either way.
    expect(
      getScenarioCombatEquipmentStatus({
        participantSourceType: "entity",
        scenarioEquipmentState: {
          activeLoadoutByCharacterId: {},
          itemsById: {},
          locationsById: {},
          templatesById: {},
        },
      }),
    ).toEqual({ kind: "unarmed" });

    // A Character is unchanged: a missing projection stays a diagnosable fault.
    expect(
      getScenarioCombatEquipmentStatus({
        characterId: "character-1",
        participantSourceType: "character",
        scenarioEquipmentState: undefined,
      }),
    ).toMatchObject({ kind: "incomplete" });
    expect(getScenarioCombatEquipmentStatus({ characterId: "character-1" })).toMatchObject({
      kind: "incomplete",
    });
  });

  it("gives a temporary actor with no committed equipment an explicit empty loadout to derive from", () => {
    // `null` makes the combat loadout derivation return an empty model, which withholds the Punch
    // and Kick rows `combatStateDerivation` otherwise always derives.
    expect(resolveScenarioCombatEquipmentState({ participantSourceType: "entity" })).toEqual({
      activeLoadoutByCharacterId: {},
      itemsById: {},
      locationsById: {},
      templates: { templatesById: {} },
    });
    expect(resolveScenarioCombatEquipmentState({ participantSourceType: "character" })).toBeNull();
    expect(resolveScenarioCombatEquipmentState({})).toBeNull();
  });

  it("never sends a GM to the Character-only refresh control for a temporary actor", () => {
    const status = { kind: "incomplete" as const, message: "incomplete" };

    const gmDiagnostic = formatScenarioCombatEquipmentDiagnostic({
      isGameMaster: true,
      participantName: "Training Bandit",
      participantSourceType: "entity",
      status,
    });
    expect(gmDiagnostic).toBe(
      "Training Bandit’s committed scenario equipment is incomplete or out of date. Recreate this temporary actor from its Template source on the scenario page.",
    );
    expect(gmDiagnostic).not.toContain("participant assignment grid");

    const playerDiagnostic = formatScenarioCombatEquipmentDiagnostic({
      isGameMaster: false,
      participantName: "Training Bandit",
      participantSourceType: "entity",
      status,
    });
    expect(playerDiagnostic).toBe(
      "Training Bandit’s committed scenario equipment is incomplete or out of date. Ask the GM to recreate this temporary actor from its Template source.",
    );
    expect(playerDiagnostic).not.toContain("participant assignment grid");
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

  /*
   * #771 phase-panel composition. The fixture is the Product Owner's multi-source case: Halgeir
   * "Dunk" Halgeirsson carrying a Medium metal shield, whose Weapons table reads Primary `Dunk`
   * parry 9, Shield `Medium metal shield` parry 14, Combined `Sword / shield` parry 15 and
   * Unarmed `Brawling` parry 9, with Punch carrying no Parry at all.
   */
  const multiSourceParryRows: Array<Array<string | number>> = [
    ["Primary", "Dunk", "4", "Slash", "12", "7", "FS", "—", "C", "12", "−1", "9"],
    ["Shield", "Medium metal shield", "0", "Strike", "0", "0", "AC", "—", "A", "17", "−1", "14"],
    ["Combined", "Sword / shield", "—", "—", "—", "—", "—", "—", "—", "18", "−1", "15"],
    ["Brawling", "Brawling", "0", "Grapple", "1", "—", "—", "—", "—", "11", "−1", "9"],
    ["Unarmed", "Punch", "0", "Strike", "1", "0", "AC", "—", "A", "—", "—", "—"],
  ];

  const multiSourceWeaponRows = [
    {
      attackModes: [
        { allowsRepeatedRoundAttack: true, id: "mode-1", isPrimaryAttack: true, label: "Slash" },
        { allowsRepeatedRoundAttack: true, id: "mode-2", isPrimaryAttack: false, label: "Thrust" },
      ],
      attackMode1Id: "mode-1",
      currentItemLabel: "Dunk",
      itemId: "scenario-dunk",
      modeLabel: "Primary",
      templateId: "weapon-template-dunk",
    },
  ];

  it("offers every derived defensive mode that carries a Parry, and nothing else", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        rows: multiSourceParryRows,
        sourceItemId: "scenario-dunk",
        valueLabel: "Dunk",
        weaponRows: multiSourceWeaponRows,
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.parrySourceOptions).toEqual([
      {
        db: "12",
        dm: "−1",
        id: "Primary|Dunk",
        label: "Dunk · Primary",
        parry: "9",
        sourceName: "Dunk",
      },
      {
        db: "17",
        dm: "−1",
        id: "Shield|Medium metal shield",
        label: "Medium metal shield · Shield",
        parry: "14",
        sourceName: "Medium metal shield",
      },
      {
        db: "18",
        dm: "−1",
        id: "Combined|Sword / shield",
        label: "Sword / shield · Combined",
        parry: "15",
        sourceName: "Sword / shield",
      },
      {
        db: "11",
        dm: "−1",
        id: "Brawling|Brawling",
        label: "Brawling · Brawling",
        parry: "9",
        sourceName: "Brawling",
      },
    ]);
    // Punch carries no Parry, so it is not a parry source. Nothing is added to the derived set.
    expect(summary.parrySourceOptions?.map((option) => option.sourceName)).not.toContain("Punch");
  });

  it("defaults the parry source to the row the unchanged defence derivation already displays", () => {
    const loadoutModel = buildLoadoutModel({
      rows: multiSourceParryRows,
      sourceItemId: "scenario-dunk",
      valueLabel: "Dunk",
      weaponRows: multiSourceWeaponRows,
    });
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: summary.mainHandParryItemLabel,
      offHandParryItemLabel: summary.offHandParryItemLabel,
      phaseContext: createEmptyPlayerEncounterCombatContext(),
      reference: summary.reference,
    });
    const defaultOption = summary.parrySourceOptions?.find(
      (option) => option.id === summary.defaultParrySourceId,
    );

    // A Combined row exists, so the derivation shows it — and the default option names that row,
    // with the same DB/DM/Parry the mini-table renders.
    expect(summary.defaultParrySourceId).toBe("Combined|Sword / shield");
    expect(defenseStats).toMatchObject({ db: "18", dm: "−1", parry: "15" });
    expect(defaultOption).toMatchObject({ db: "18", dm: "−1", parry: "15" });
  });

  it("defaults the parry source to the attack reference row when no Combined row exists", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        rows: multiSourceParryRows.filter((row) => row[0] !== "Combined"),
        sourceItemId: "scenario-dunk",
        valueLabel: "Dunk",
        weaponRows: multiSourceWeaponRows,
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.defaultParrySourceId).toBe("Primary|Dunk");
    expect(summary.reference?.combinedParry).toBe("—");
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

/**
 * **Forgejo issue #771 R2-5 supersedes ruling #517 E2 for the Combat surface.** The coordinates
 * are no longer rendered anywhere in Combat — `PlayerCombatPanels.tsx` dropped the `Source: …`
 * line. This guard therefore no longer pins a *visible* GM-only disclosure; it pins that the
 * `includeSourceProvenance` plumbing, retained for internal diagnostics, is still asked for
 * only from the GM's Combat Round Manager and never from the player page. That confinement is
 * the part worth keeping, so the guard is narrowed in meaning rather than deleted, and its
 * assertions are unchanged because the plumbing itself is unchanged.
 */
describe("workbook import provenance plumbing (#771 R2-5, superseding #517 ruling E2)", () => {
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
      return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [path] : [];
    });
  const read = (path: string) => readFileSync(join(webRoot, path), "utf8");
  const count = (source: string, text: string) => source.split(text).length - 1;

  it("is asked for the coordinates only by the GM's Combat Round Manager, at every one of its calls", () => {
    const askers = [...sourceFiles(join(webRoot, "src")), ...sourceFiles(join(webRoot, "app"))]
      .filter((path) => readFileSync(path, "utf8").includes("includeSourceProvenance"))
      .map((path) => relative(webRoot, path))
      .sort();
    expect(askers).toEqual([
      "src/features/combat-round-manager/CombatRoundManagerPanel.tsx",
      "src/features/player-combat/playerCombatPhaseModel.ts",
    ]);

    const gmPanel = read("src/features/combat-round-manager/CombatRoundManagerPanel.tsx");
    expect(count(gmPanel, "buildPlayerCombatLoadoutSummary({")).toBe(5);
    expect(count(gmPanel, "includeSourceProvenance: true,")).toBe(5);

    const playerPage = read(
      "app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent.tsx",
    );
    expect(count(playerPage, "buildPlayerCombatLoadoutSummary(")).toBe(4);
    expect(playerPage).not.toContain("includeSourceProvenance");
  });
});

describe("explicit player attack source selection (#575)", () => {
  const daggerWeaponRow = {
    attackModes: [
      {
        allowsRepeatedRoundAttack: false,
        armorModifier: "A",
        canonicalMeleeMode: "thrust",
        crit: "A",
        damageClass: "pointed",
        dmb: 3,
        id: "thrust",
        isPrimaryAttack: true,
        label: "Thrust",
        ob: 7,
        order: 0,
        secondCrit: "—",
      },
    ],
    attackMode1Id: "thrust",
    currentItemLabel: "Dagger",
    itemId: "primary-weapon",
    modeLabel: "Primary",
    templateId: "weapon-template-dagger",
  };
  // `canonicalMeleeMode` is passed explicitly so a test can state which case it is exercising
  // rather than depend on an omission by accident: a mode without it is given no legal attack mode
  // and is not declarable, a mode with it is. The real catalogue rows are built from the templates
  // themselves by `catalogueBrawlingRows` below, so the authored field stays load-bearing.
  const brawlingRow = (input: {
    canonicalMeleeMode?: "slash" | "strike" | "thrust";
    label: string;
    templateId: string;
  }) => ({
    attackModes: [
      {
        allowsRepeatedRoundAttack: false,
        armorModifier: "A",
        canonicalMeleeMode: input.canonicalMeleeMode,
        crit: "AC",
        damageClass: "blunt",
        dmb: 0,
        id: "mode-1",
        isPrimaryAttack: true,
        label: "Strike",
        ob: 1,
        order: 0,
      },
    ],
    attackMode1Id: "mode-1",
    currentItemLabel: input.label,
    modeLabel: "Unarmed",
    templateId: input.templateId,
  });
  const weaponModeRow = (weapon: string, mode: string) => [
    mode,
    weapon,
    "0",
    "Strike",
    "1",
    "0",
    "AC",
    "—",
    "A",
    "—",
    "—",
    "—",
    "—",
    "—",
    "—",
    "—",
    "—",
  ];
  const unarmedRows = [weaponModeRow("Punch", "Unarmed"), weaponModeRow("Kick", "Unarmed")];
  /**
   * A brawling row authoring no canonical melee mode, so the mode-legality rule gives it no legal
   * attack mode. This is no longer the catalogue's state (#586/#590 ruling); it is kept because the
   * exclusion must stay computed from mode legality rather than hard-coded against brawling.
   */
  const unarmedWeaponRows = [
    brawlingRow({ label: "Punch", templateId: "virtual-weapon-template-punch" }),
    brawlingRow({ label: "Kick", templateId: "virtual-weapon-template-kick" }),
  ];
  /** Brawling rows carrying a legal attack mode, as the catalogue now authors them. */
  const declarableUnarmedWeaponRows = [
    brawlingRow({
      canonicalMeleeMode: "strike",
      label: "Punch",
      templateId: "virtual-weapon-template-punch",
    }),
    brawlingRow({
      canonicalMeleeMode: "strike",
      label: "Kick",
      templateId: "virtual-weapon-template-kick",
    }),
  ];
  /**
   * The real Punch and Kick catalogue rows, built from the templates themselves rather than
   * restated, so the authored `canonicalMeleeMode: "strike"` is what makes them declarable below.
   * `combatStateDerivation` derives exactly these two rows for every character.
   */
  const catalogueBrawlingRows = [punchTemplate, kickTemplate].map((template) => ({
    attackModes: (template.attackModes ?? []).map((mode, order) => ({
      allowsRepeatedRoundAttack: false,
      armorModifier: mode.armorModifier,
      canonicalMeleeMode: mode.canonicalMeleeMode,
      crit: mode.crit,
      damageClass: mode.damageClass,
      dmb: mode.dmb,
      id: mode.id,
      isPrimaryAttack: order === 0,
      label: mode.label,
      ob: mode.ob,
      order,
    })),
    attackMode1Id: template.attackModes?.[0]?.id,
    currentItemLabel: template.name,
    modeLabel: "Unarmed",
    templateId: template.id,
  }));
  const emptyPhaseContexts = () => ({
    phase1: createEmptyPlayerEncounterCombatContext(),
    phase2: createEmptyPlayerEncounterCombatContext(),
  });

  it("offers the ready weapon and preselects it, and does not offer an illegal brawling row", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        rows: [weaponModeRow("Dagger", "Primary"), ...unarmedRows],
        valueLabel: "Dagger",
        weaponRows: [daggerWeaponRow, ...unarmedWeaponRows],
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    // These brawling rows author no canonical melee mode, so the existing mode-legality rule
    // gives them no legal attack mode and they are not offered as a choice. The catalogue does
    // author one now (#590); this fixture pins that the exclusion is still computed from legality
    // rather than hard-coded, so a row the rules reject is never offered.
    expect(summary.attackSourceOptions).toEqual([
      {
        id: "weapon:primary-weapon",
        label: "Dagger · Primary",
        slot: "primary",
        sourceKind: "weapon",
      },
    ]);
    // The preselection is reported, so the control can show it rather than leave it implicit.
    expect(summary.selectedAttackSourceId).toBe("weapon:primary-weapon");
    expect(summary.attackStats?.weaponName).toBe("Dagger");
  });

  it("offers both brawling rows once they carry a legal attack mode", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        rows: [weaponModeRow("Dagger", "Primary"), ...unarmedRows],
        valueLabel: "Dagger",
        weaponRows: [daggerWeaponRow, ...declarableUnarmedWeaponRows],
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.attackSourceOptions).toEqual([
      {
        id: "weapon:primary-weapon",
        label: "Dagger · Primary",
        slot: "primary",
        sourceKind: "weapon",
      },
      {
        id: "unarmed:virtual-weapon-template-punch",
        label: "Punch · Unarmed",
        slot: "virtual",
        sourceKind: "unarmed",
        templateId: "virtual-weapon-template-punch",
      },
      {
        id: "unarmed:virtual-weapon-template-kick",
        label: "Kick · Unarmed",
        slot: "virtual",
        sourceKind: "unarmed",
        templateId: "virtual-weapon-template-kick",
      },
    ]);
  });

  it("omits the brawling rows when the committed equipment is not usable", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      allowUnarmedFallback: false,
      loadoutModel: buildLoadoutModel({
        rows: unarmedRows,
        weaponRows: declarableUnarmedWeaponRows,
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.attackSourceOptions).toEqual([
      {
        id: "weapon:primary-weapon",
        label: "Long sword · Primary",
        slot: "primary",
        sourceKind: "weapon",
      },
    ]);
  });

  it("resolves an explicitly chosen brawling row into its own unarmed source", () => {
    const loadoutModel = buildLoadoutModel({
      fields: [],
      rows: unarmedRows,
      weaponRows: declarableUnarmedWeaponRows,
    });
    const phase1 = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackSourceId: "unarmed:virtual-weapon-template-kick",
    });

    expect(phase1.selectedAttackSourceId).toBe("unarmed:virtual-weapon-template-kick");
    expect(phase1.attackStats?.weaponName).toBe("Kick");
    // The phase default is Punch for phase 1; the explicit choice wins over it.
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference: phase1.reference,
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toEqual({
      attackModeId: "mode-1",
      opportunitySlot: "attack_1",
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: "virtual-weapon-template-kick",
    });
  });

  it("reports the attack phase instead of silently dropping an unresolvable source", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel: buildLoadoutModel({
        fields: [],
        rows: unarmedRows,
        weaponRows: unarmedWeaponRows,
      }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const selection = buildCombatDeclarationAttackSelection({
      actionId: "attack_parry",
      phaseContexts: emptyPhaseContexts(),
      phaseLoadoutSummaries: {
        phase1: { reference: null, selectedAttackModeId: undefined },
        phase2: { reference: null, selectedAttackModeId: undefined },
      },
      secondaryActionId: "",
    });

    expect(summary.selectedAttackSourceId).toBeUndefined();
    expect(selection.phaseAttackSources).toEqual({});
    expect(selection.missingSourcePhases).toEqual(["phase1"]);
    expect(getCombatDeclarationAttackSourceRequiredMessage(selection.missingSourcePhases)).toBe(
      "Select an attack source for Phase 1.",
    );
  });

  it("names every attack phase that still needs a source, and nothing when all resolve", () => {
    expect(getCombatDeclarationAttackSourceRequiredMessage(["phase1", "phase2"])).toBe(
      "Select an attack source for Phase 1 and Phase 2.",
    );
    expect(getCombatDeclarationAttackSourceRequiredMessage([])).toBeUndefined();
  });

  it("does not ask the player to choose a source when there is none to choose", () => {
    expect(
      getCombatDeclarationAttackSourceRequiredMessage(["phase1"], { selectableSourceCount: 0 }),
    ).toBe(
      "No attack source is available for Phase 1. Ready a weapon, or ask the GM to refresh your scenario equipment.",
    );
    expect(
      getCombatDeclarationAttackSourceRequiredMessage(["phase1"], { selectableSourceCount: 2 }),
    ).toBe("Select an attack source for Phase 1.");
  });

  it("does not default an unequipped Double Attack to Punch and Kick", () => {
    // Declarable brawling rows, so the absence of a source is the removed silent default rather
    // than the mode-legality filter.
    const loadoutModel = buildLoadoutModel({
      fields: [],
      rows: unarmedRows,
      weaponRows: declarableUnarmedWeaponRows,
    });
    const phaseSummaries = {
      phase1: buildPlayerCombatLoadoutSummary({
        actionId: "double_attack",
        loadoutModel,
        phaseKey: "phase1",
        secondaryActionId: "",
      }),
      phase2: buildPlayerCombatLoadoutSummary({
        actionId: "double_attack",
        loadoutModel,
        phaseKey: "phase2",
        secondaryActionId: "",
      }),
    };

    expect(phaseSummaries.phase1.selectedAttackSourceId).toBeUndefined();
    expect(phaseSummaries.phase2.selectedAttackSourceId).toBeUndefined();

    const selection = buildCombatDeclarationAttackSelection({
      actionId: "double_attack",
      phaseContexts: emptyPhaseContexts(),
      phaseLoadoutSummaries: phaseSummaries,
      secondaryActionId: "",
    });
    expect(selection.phaseAttackSources).toEqual({});
    expect(selection.missingSourcePhases).toEqual(["phase1", "phase2"]);
  });

  it("serializes two explicitly chosen brawling sources as distinct Double Attack opportunities", () => {
    const loadoutModel = buildLoadoutModel({
      fields: [],
      rows: unarmedRows,
      weaponRows: declarableUnarmedWeaponRows,
    });
    const phaseSummaries = {
      phase1: buildPlayerCombatLoadoutSummary({
        actionId: "double_attack",
        loadoutModel,
        phaseKey: "phase1",
        secondaryActionId: "",
        selectedAttackSourceId: "unarmed:virtual-weapon-template-punch",
      }),
      phase2: buildPlayerCombatLoadoutSummary({
        actionId: "double_attack",
        loadoutModel,
        phaseKey: "phase2",
        secondaryActionId: "",
        selectedAttackSourceId: "unarmed:virtual-weapon-template-kick",
      }),
    };
    const selection = buildCombatDeclarationAttackSelection({
      actionId: "double_attack",
      phaseContexts: emptyPhaseContexts(),
      phaseLoadoutSummaries: phaseSummaries,
      secondaryActionId: "",
    });

    expect(selection.missingSourcePhases).toEqual([]);
    expect(selection.phaseAttackSources).toEqual({
      phase1: {
        attackModeId: "mode-1",
        opportunitySlot: "attack_1",
        slot: "virtual",
        sourceKind: "unarmed",
        templateId: "virtual-weapon-template-punch",
      },
      phase2: {
        attackModeId: "mode-1",
        opportunitySlot: "attack_2",
        slot: "virtual",
        sourceKind: "unarmed",
        templateId: "virtual-weapon-template-kick",
      },
    });
  });

  it("declares from the chosen slot rather than the action's default slot", () => {
    const loadoutModel = buildLoadoutModel({
      fields: [
        {
          id: "primary",
          label: "Primary weapon",
          options: [],
          value: "primary-weapon",
          valueLabel: "Dagger",
        },
        {
          id: "secondary",
          label: "Second hand weapon",
          options: [],
          value: "secondary-weapon",
          valueLabel: "Club",
        },
      ],
      rows: [
        weaponModeRow("Dagger", "Primary"),
        weaponModeRow("Club", "Secondary"),
        ...unarmedRows,
      ],
      weaponRows: [
        daggerWeaponRow,
        {
          ...brawlingRow({ label: "Club", templateId: "weapon-template-club" }),
          itemId: "secondary-weapon",
          modeLabel: "Secondary",
        },
        ...unarmedWeaponRows,
      ],
    });

    expect(
      buildPlayerCombatLoadoutSummary({
        actionId: "attack_parry",
        loadoutModel,
        phaseKey: "phase1",
        secondaryActionId: "",
      }).selectedAttackSourceId,
    ).toBe("weapon:primary-weapon");

    const chosen = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
      selectedAttackSourceId: "weapon:secondary-weapon",
    });
    expect(chosen.selectedAttackSourceId).toBe("weapon:secondary-weapon");
    expect(chosen.attackStats?.weaponName).toBe("Club");
    expect(
      buildCombatAttackSourceRef({
        phaseKey: "phase1",
        reference: chosen.reference,
        unarmedTemplateId: "virtual-weapon-template-punch",
      }),
    ).toEqual({
      attackModeId: "mode-1",
      opportunitySlot: "attack_1",
      scenarioItemId: "secondary-weapon",
      slot: "secondary",
      sourceKind: "weapon",
      templateId: "weapon-template-club",
    });
  });

  // #583 repair of #575. The ruling forbade silently DEFAULTING to unarmed at declaration time.
  // It did not authorise removing unarmed EXECUTION, and #586 defers the unarmed-rules question
  // rather than settling it. These pin both halves of that line at once, on both surfaces: no
  // existing test covered the execution half, which is why its removal reached `dev`.
  describe("unarmed attack execution (#583)", () => {
    // The real catalogue rows, so the brawling rows below carry the authored legal attack mode and
    // unarmed IS offered as an explicit choice. The execution/declaration separation must hold in
    // exactly that state: offering the choice is what #590 authorized, taking it unasked is not.
    const unequippedLoadoutModel = () =>
      buildLoadoutModel({ fields: [], rows: unarmedRows, weaponRows: catalogueBrawlingRows });
    const unequippedDoubleAttackSummaries = (
      overrides: Partial<Parameters<typeof buildPlayerCombatLoadoutSummary>[0]> = {},
    ) => {
      const loadoutModel = unequippedLoadoutModel();
      const build = (phaseKey: "phase1" | "phase2") =>
        buildPlayerCombatLoadoutSummary({
          actionId: "double_attack",
          loadoutModel,
          phaseKey,
          secondaryActionId: "",
          ...overrides,
        });
      return { phase1: build("phase1"), phase2: build("phase2") };
    };

    it("keeps an already-declared unarmed Double Attack rollable on the player surface", () => {
      const summaries = unequippedDoubleAttackSummaries();

      // The roll gate on the player surface is `!attackStats`, so these two assertions are the
      // "Roll attack" button being enabled for an unequipped participant.
      expect(summaries.phase1.attackStats).not.toBeNull();
      expect(summaries.phase2.attackStats).not.toBeNull();
      expect(summaries.phase1.attackStats?.weaponName).toBe("Punch");
      expect(summaries.phase2.attackStats?.weaponName).toBe("Kick");
      expect(summaries.phase1.reference?.selectedWeapon).toBe("Punch");
      expect(summaries.phase2.reference?.selectedWeapon).toBe("Kick");
      expect(summaries.phase1.referenceUsedUnarmedExecutionFallback).toBe(true);
      expect(summaries.phase2.referenceUsedUnarmedExecutionFallback).toBe(true);
    });

    it("keeps the same declared unarmed attack rollable on the GM surface", () => {
      // The GM's Combat Round Manager passes no selected source and derives
      // `allowUnarmedFallback` from the inspected participant's equipment status, so an unarmed
      // participant reaches the shared helper with exactly these inputs.
      const summaries = unequippedDoubleAttackSummaries({
        allowUnarmedFallback: true,
        includeSourceProvenance: true,
      });

      expect(summaries.phase1.attackStats).not.toBeNull();
      expect(summaries.phase2.attackStats).not.toBeNull();
      expect(summaries.phase1.attackStats?.weaponName).toBe("Punch");
      expect(summaries.phase2.attackStats?.weaponName).toBe("Kick");

      // No GM file changed when the fallback was removed, and the GM surface broke anyway,
      // because it gates its roll on the same `attackStats` from the same helper. Pin that
      // coupling so a future change to one surface cannot silently break the other.
      const gmPanel = readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          "../combat-round-manager/CombatRoundManagerPanel.tsx",
        ),
        "utf8",
      );
      expect(gmPanel).toContain("buildPlayerCombatLoadoutSummary({");
      expect(gmPanel).toContain(
        '!inspectorPhaseLoadoutSummaries[inspectorCurrentAttackPhase ?? "phase1"].attackStats',
      );
      expect(gmPanel).not.toContain("allowUnarmedFallback: false");
    });

    it("still refuses to declare unarmed for a player who chose nothing", () => {
      const summaries = unequippedDoubleAttackSummaries();

      // #590 made Punch and Kick offerable, so the choice is now ON the control...
      expect(summaries.phase1.attackSourceOptions.map((option) => option.id)).toEqual([
        "unarmed:virtual-weapon-template-punch",
        "unarmed:virtual-weapon-template-kick",
      ]);

      // ...but nothing is preselected, so no unarmed source is chosen on the player's behalf.
      expect(summaries.phase1.selectedAttackSourceId).toBeUndefined();
      expect(summaries.phase2.selectedAttackSourceId).toBeUndefined();

      // The declaration is still reported as missing a source rather than quietly submitting
      // unarmed, even though execution resolved a Punch/Kick reference from the same summary.
      // Making unarmed declarable must not make it implicit: that is the #583 line.
      const selection = buildCombatDeclarationAttackSelection({
        actionId: "double_attack",
        phaseContexts: emptyPhaseContexts(),
        phaseLoadoutSummaries: summaries,
        secondaryActionId: "",
      });
      expect(selection.phaseAttackSources).toEqual({});
      expect(selection.missingSourcePhases).toEqual(["phase1", "phase2"]);
      // The player can now pick something, so the message asks them to pick rather than claiming
      // nothing is available.
      expect(
        getCombatDeclarationAttackSourceRequiredMessage(selection.missingSourcePhases, {
          selectableSourceCount: summaries.phase1.attackSourceOptions.length,
        }),
      ).toBe("Select an attack source for Phase 1 and Phase 2.");
    });

    it("does not let the execution reference stand in for a declaration source", () => {
      const summaries = unequippedDoubleAttackSummaries();

      // The reference itself names Punch, so only the explicit marker separates execution from
      // declaration. Without the marker this would serialize an unarmed source nobody chose.
      expect(
        buildCombatAttackSourceRef({
          phaseKey: "phase1",
          reference: summaries.phase1.reference,
          referenceUsedUnarmedExecutionFallback: true,
          unarmedTemplateId: "virtual-weapon-template-punch",
        }),
      ).toBeUndefined();
      expect(
        buildCombatAttackSourceRef({
          phaseKey: "phase1",
          reference: summaries.phase1.reference,
          unarmedTemplateId: "virtual-weapon-template-punch",
        }),
      ).toEqual({
        attackModeId: "mode-1",
        opportunitySlot: "attack_1",
        slot: "virtual",
        sourceKind: "unarmed",
        templateId: "virtual-weapon-template-punch",
      });
    });

    it("keeps the unarmed exclusion computed, now that #586 has self-healed it", () => {
      // #586's self-heal has landed: the catalogue authors `canonicalMeleeMode: "strike"`, so the
      // real rows are offered with no change to this helper. The fixtures still differ by exactly
      // that one field, which is the whole mechanism.
      const buildFromRows = (weaponRows: Array<Record<string, unknown>>) =>
        buildPlayerCombatLoadoutSummary({
          actionId: "double_attack",
          loadoutModel: buildLoadoutModel({ fields: [], rows: unarmedRows, weaponRows }),
          phaseKey: "phase1",
          secondaryActionId: "",
        });

      for (const rows of [declarableUnarmedWeaponRows, catalogueBrawlingRows]) {
        expect(buildFromRows(rows).attackSourceOptions.map((option) => option.id)).toEqual([
          "unarmed:virtual-weapon-template-punch",
          "unarmed:virtual-weapon-template-kick",
        ]);
      }

      // Still computed, not hard-coded the other way either: drop the authored mode and the rows
      // go back to being withheld, so the rules keep governing what is offered.
      expect(buildFromRows(unarmedWeaponRows).attackSourceOptions).toEqual([]);
    });
  });

  // #590: Punch and Kick are intrinsic attack sources and must be declarable without equipment,
  // using the existing Brawling competency and their existing authored stats. One pin per
  // Product-Owner acceptance criterion, at the shared boundary both surfaces go through.
  describe("declarable intrinsic unarmed attack sources (#590)", () => {
    const brawlingOnlyLoadoutModel = () =>
      buildLoadoutModel({ fields: [], rows: unarmedRows, weaponRows: catalogueBrawlingRows });
    const chooseUnarmed = (input: {
      phaseKey: "phase1" | "phase2";
      selectedAttackSourceId: string;
      /** The GM/proxy path differs from the player's only by these two inputs. */
      proxy?: boolean;
    }) =>
      buildPlayerCombatLoadoutSummary({
        actionId: "double_attack",
        allowUnarmedFallback: true,
        includeSourceProvenance: input.proxy === true,
        loadoutModel: brawlingOnlyLoadoutModel(),
        phaseKey: input.phaseKey,
        secondaryActionId: "",
        selectedAttackSourceId: input.selectedAttackSourceId,
      });

    it("authors exactly the one catalogue field that makes brawling declarable", () => {
      // The whole blockage was this field's absence, and `"strike"` is the templates' own authored
      // mode label. Everything else the ruling requires was already authored.
      for (const template of [punchTemplate, kickTemplate]) {
        expect(template.attackModes).toHaveLength(1);
        expect(template.attackModes?.[0]?.canonicalMeleeMode).toBe("strike");
        expect(template.attackModes?.[0]?.label).toBe("Strike");
        // Criterion 3: resolution routes through Brawling because the mode says so.
        expect(template.attackModes?.[0]?.competencyRef).toEqual(parseCompetencyId("brawling"));
        expect(template.weaponSkill).toBe("Brawling");
        expect(template.weaponClass).toBe("brawling");
      }
    });

    it("declares an explicitly chosen Punch or Kick, with the authored stats", () => {
      // Criterion 1 at the shared boundary: an explicit choice becomes a canonical unarmed source.
      const cases = [
        {
          dmb: "0",
          ob: "1",
          opportunitySlot: "attack_1",
          phaseKey: "phase1" as const,
          templateId: "virtual-weapon-template-punch",
          weapon: "Punch",
        },
        {
          dmb: "2",
          ob: "0",
          opportunitySlot: "attack_2",
          phaseKey: "phase2" as const,
          templateId: "virtual-weapon-template-kick",
          weapon: "Kick",
        },
      ];

      for (const expected of cases) {
        const summary = chooseUnarmed({
          phaseKey: expected.phaseKey,
          selectedAttackSourceId: `unarmed:${expected.templateId}`,
        });

        // The choice is reported back, so the control shows it rather than leaving it implicit.
        expect(summary.selectedAttackSourceId).toBe(`unarmed:${expected.templateId}`);
        expect(summary.attackModeUnavailableMessage).toBeUndefined();
        expect(summary.selectedAttackModeId).toBe("mode-1");
        // Criterion 3: the existing authored Punch/Kick stats, not a substitute.
        expect(summary.attackStats?.weaponName).toBe(expected.weapon);
        expect(summary.attackStats?.ob).toBe(expected.ob);
        expect(summary.attackStats?.dmb).toBe(expected.dmb);
        expect(summary.attackStats?.maxCrits).toBe("AC");

        const source = buildCombatAttackSourceRef({
          phaseKey: expected.phaseKey,
          reference: summary.reference,
          referenceUsedUnarmedExecutionFallback: summary.referenceUsedUnarmedExecutionFallback,
          unarmedTemplateId: expected.templateId,
        });
        expect(source).toEqual({
          attackModeId: "mode-1",
          opportunitySlot: expected.opportunitySlot,
          slot: "virtual",
          sourceKind: "unarmed",
          templateId: expected.templateId,
        });
        // Criterion 5: the canonical reference the API parses carries no Item instance at all.
        expect(combatAttackSourceRefSchema.parse(source)).not.toHaveProperty("scenarioItemId");
      }
    });

    it("submits a complete declaration from an explicit unarmed choice on both surfaces", () => {
      // Criteria 1 and 2: the player path and the GM/proxy path differ only by the two inputs the
      // GM passes, so both are exercised against the same helper the surfaces share.
      for (const proxy of [false, true]) {
        const summaries = {
          phase1: chooseUnarmed({
            phaseKey: "phase1",
            proxy,
            selectedAttackSourceId: "unarmed:virtual-weapon-template-punch",
          }),
          phase2: chooseUnarmed({
            phaseKey: "phase2",
            proxy,
            selectedAttackSourceId: "unarmed:virtual-weapon-template-kick",
          }),
        };

        const selection = buildCombatDeclarationAttackSelection({
          actionId: "double_attack",
          phaseContexts: emptyPhaseContexts(),
          phaseLoadoutSummaries: summaries,
          secondaryActionId: "",
        });

        expect(selection.missingSourcePhases).toEqual([]);
        expect(selection.phaseAttackSources).toEqual({
          phase1: {
            attackModeId: "mode-1",
            opportunitySlot: "attack_1",
            slot: "virtual",
            sourceKind: "unarmed",
            templateId: "virtual-weapon-template-punch",
          },
          phase2: {
            attackModeId: "mode-1",
            opportunitySlot: "attack_2",
            slot: "virtual",
            sourceKind: "unarmed",
            templateId: "virtual-weapon-template-kick",
          },
        });
        expect(
          getCombatDeclarationAttackModeUnavailableMessage({
            actionId: "double_attack",
            phaseLoadoutSummaries: summaries,
            secondaryActionId: "",
          }),
        ).toBeUndefined();
      }
    });

    it("keeps normal melee resolution unchanged when a weapon is ready", () => {
      // Criterion 4. Punch and Kick are now offered alongside the ready weapon, and the weapon is
      // still what a declaration starts from and still serializes as a weapon source.
      const summary = buildPlayerCombatLoadoutSummary({
        actionId: "attack_parry",
        loadoutModel: buildLoadoutModel({
          rows: [weaponModeRow("Dagger", "Primary"), ...unarmedRows],
          valueLabel: "Dagger",
          weaponRows: [daggerWeaponRow, ...catalogueBrawlingRows],
        }),
        phaseKey: "phase1",
        secondaryActionId: "",
      });

      expect(summary.attackSourceOptions.map((option) => option.id)).toEqual([
        "weapon:primary-weapon",
        "unarmed:virtual-weapon-template-punch",
        "unarmed:virtual-weapon-template-kick",
      ]);
      expect(summary.selectedAttackSourceId).toBe("weapon:primary-weapon");
      expect(summary.attackStats?.weaponName).toBe("Dagger");
      expect(
        buildCombatAttackSourceRef({
          phaseKey: "phase1",
          reference: summary.reference,
          unarmedTemplateId: "virtual-weapon-template-punch",
        }),
      ).toEqual({
        attackModeId: "thrust",
        opportunitySlot: "attack_1",
        scenarioItemId: "primary-weapon",
        slot: "primary",
        sourceKind: "weapon",
        templateId: "weapon-template-dagger",
      });
    });

    it("gives the GM surface the same explicit choice through the shared helper", () => {
      // #583's regression reached GM Combat with no GM file changed, so pin the GM wiring rather
      // than assume it: the GM's own chosen source reaches the shared summary helper, and the GM
      // renders the player's control instead of a GM-only idiom.
      const gmPanel = readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          "../combat-round-manager/CombatRoundManagerPanel.tsx",
        ),
        "utf8",
      );
      expect(gmPanel).toContain("PlayerCombatAttackSourceSelector");
      expect(gmPanel).toContain(
        "selectedAttackSourceId: inspectorDraft.phaseAttackSourceIds[phaseKey],",
      );
      expect(gmPanel).toContain("options={phaseLoadoutSummary.attackSourceOptions}");
      // Nothing may pre-populate the GM's choice: an unarmed declaration has to be chosen.
      expect(gmPanel).toContain("phaseAttackSourceIds: {},");
      expect(gmPanel).not.toContain("virtual-weapon-template-punch");
      expect(gmPanel).not.toContain("virtual-weapon-template-kick");
    });
  });

  /**
   * #794: the Feint source control offers weapon sources only, but the submitted Phase 1 source is
   * built from the resolved loadout reference, which can be unarmed. The endpoint's real behaviour
   * is measured in `apps/api/src/routes/scenarios.test.ts` ("rejects a weapon Feint whose Phase 1
   * attack source is unarmed"): HTTP 400 `{"error":"Select a weapon for the weapon feint."}`, with
   * no encounter write. So an unarmed Phase 1 source must never leave this boundary.
   */
  describe("weapon Feint Phase 1 source (#794)", () => {
    const armedLoadoutModel = () =>
      buildLoadoutModel({
        rows: [weaponModeRow("Dagger", "Primary"), ...unarmedRows],
        valueLabel: "Dagger",
        weaponRows: [daggerWeaponRow, ...catalogueBrawlingRows],
      });
    const feintSummaries = (phase1SourceId: string | undefined) => ({
      phase1: buildPlayerCombatLoadoutSummary({
        actionId: "feint_attack",
        allowUnarmedFallback: true,
        loadoutModel: armedLoadoutModel(),
        phaseKey: "phase1",
        secondaryActionId: "",
        selectedAttackSourceId: phase1SourceId,
      }),
      phase2: buildPlayerCombatLoadoutSummary({
        actionId: "feint_attack",
        allowUnarmedFallback: true,
        loadoutModel: armedLoadoutModel(),
        phaseKey: "phase2",
        secondaryActionId: "",
        selectedAttackSourceId: "weapon:primary-weapon",
      }),
    });
    const weaponFeintSelection = (phase1SourceId: string | undefined) =>
      buildCombatDeclarationAttackSelection({
        actionId: "feint_attack",
        feintMethod: "weapon",
        phaseContexts: emptyPhaseContexts(),
        phaseLoadoutSummaries: feintSummaries(phase1SourceId),
        secondaryActionId: "",
      });

    it("refuses to submit an unarmed Phase 1 source for a weapon Feint", () => {
      // The reachable state: an unarmed source chosen for another action stays in the per-phase
      // source draft when the action becomes Feint, so the reference still resolves to Punch even
      // though the Feint control offers the ready Dagger only.
      const summaries = feintSummaries("unarmed:virtual-weapon-template-punch");
      expect(summaries.phase1.reference?.selectedWeapon).toBe("Punch");
      expect(summaries.phase1.reference?.sourceItemId).toBeUndefined();

      const selection = weaponFeintSelection("unarmed:virtual-weapon-template-punch");
      expect(selection.phaseAttackSources.phase1).toBeUndefined();
      expect(selection.missingSourcePhases).toEqual(["phase1"]);
      // And the declaration is blocked with a reason, rather than sending a request the endpoint
      // has been measured to refuse.
      expect(
        getCombatDeclarationAttackSourceRequiredMessage(selection.missingSourcePhases, {
          selectableSourceCount: getCombatDeclarationSelectableAttackSourceCount({
            actionId: "feint_attack",
            feintMethod: "weapon",
            missingSourcePhases: selection.missingSourcePhases,
            phaseLoadoutSummaries: feintSummaries("unarmed:virtual-weapon-template-punch"),
          }),
        }),
      ).toBe("Select an attack source for Phase 1.");
    });

    it("still submits the ready weapon as the Phase 1 source for a weapon Feint", () => {
      const selection = weaponFeintSelection("weapon:primary-weapon");
      expect(selection.missingSourcePhases).toEqual([]);
      expect(selection.phaseAttackSources.phase1).toEqual({
        attackModeId: "thrust",
        opportunitySlot: "attack_1",
        scenarioItemId: "primary-weapon",
        slot: "primary",
        sourceKind: "weapon",
        templateId: "weapon-template-dagger",
      });
    });

    it("names the dead end when no ready weapon can perform a weapon Feint", () => {
      // Brawling only: the Feint source control shows its own empty state, so asking the player to
      // pick a source would be a misleading instruction.
      const brawlingOnly = {
        attackSourceOptions: buildPlayerCombatLoadoutSummary({
          actionId: "feint_attack",
          allowUnarmedFallback: true,
          loadoutModel: buildLoadoutModel({
            fields: [],
            rows: unarmedRows,
            weaponRows: catalogueBrawlingRows,
          }),
          phaseKey: "phase1",
          secondaryActionId: "",
          selectedAttackSourceId: "unarmed:virtual-weapon-template-punch",
        }).attackSourceOptions,
      };
      expect(
        getCombatDeclarationSelectableAttackSourceCount({
          actionId: "feint_attack",
          feintMethod: "weapon",
          missingSourcePhases: ["phase1"],
          phaseLoadoutSummaries: { phase1: brawlingOnly, phase2: brawlingOnly },
        }),
      ).toBe(0);
      expect(
        getCombatDeclarationAttackSourceRequiredMessage(["phase1"], { selectableSourceCount: 0 }),
      ).toBe(
        "No attack source is available for Phase 1. Ready a weapon, or ask the GM to refresh your scenario equipment.",
      );
    });

    it("has no weapon Feint skill to derive from an unarmed reference", () => {
      // Why the divergence was never observed in play: the virtual Punch and Kick templates are
      // derived rows, not equipment templates, so the page's feint-skill resolution finds nothing
      // for an unarmed reference and already renders "The selected weapon has no valid combat
      // skill for a weapon feint.", which disables the submit control. The guard above closes the
      // boundary itself, for the GM proxy path and any other caller of the shared helper.
      const equipmentState = {
        templates: {
          templatesById: {
            "weapon-template-dagger": {
              category: "weapon",
              id: "weapon-template-dagger",
              weaponSkill: "1-h edged",
            },
          },
        },
      } as unknown as Parameters<typeof resolveCombatFeintWeaponSkill>[0]["equipmentState"];
      const skills = [{ id: "one_handed_edged", name: "1-h edged" }];
      expect(
        resolveCombatFeintWeaponSkill({
          equipmentState,
          skills,
          sourceTemplateId: punchTemplate.id,
        }),
      ).toBeUndefined();
      expect(
        resolveCombatFeintWeaponSkill({
          equipmentState,
          skills,
          sourceTemplateId: "weapon-template-dagger",
        }),
      ).toEqual({ id: "one_handed_edged", label: "1-h edged" });
    });

    it("leaves a movement Feint's Phase 1 source untouched", () => {
      // A movement Feint declares no Phase 1 attack at all, so the weapon rule must not reach it.
      const selection = buildCombatDeclarationAttackSelection({
        actionId: "feint_attack",
        feintMethod: "movement",
        phaseContexts: emptyPhaseContexts(),
        phaseLoadoutSummaries: feintSummaries("unarmed:virtual-weapon-template-punch"),
        secondaryActionId: "",
      });
      expect(selection.missingSourcePhases).toEqual([]);
      expect(selection.phaseAttackSources.phase1).toBeUndefined();
    });
  });
});
