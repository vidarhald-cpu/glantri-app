import type { CanonicalCombatModifierPayload } from "./combatModifierLifecycle";
import {
  createCriticalInjuryCase,
  type AcceptedCriticalOutcome,
  type CriticalInjuryCase,
  type CriticalOperationalProjection,
} from "./criticalInjuryDomain";
import {
  getCriticalResultWithEffects,
  type CriticalFamily,
  type CriticalLocationScope,
} from "./criticalEffectsTable";

const WORKBOOK = "docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx";
const WORKBOOK_SHA256 = "47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f";
const ACCEPTED_AT = "2026-08-13T12:00:00.000Z";

interface FixtureSourceInput {
  criticalIndex: number;
  family: CriticalFamily;
  location: CriticalLocationScope;
  sourceEffectRange: string;
  sourceResultRange: string;
}

function fixtureSource(input: FixtureSourceInput): AcceptedCriticalOutcome["originalSource"] {
  const source = getCriticalResultWithEffects(input.family, input.location, input.criticalIndex);
  if (!source) {
    throw new Error(
      `Missing Critical fixture source ${input.family}|${input.location}|${input.criticalIndex}.`,
    );
  }

  return {
    criticalResult: {
      ...source.result,
      sourceSpecialTags: [...source.result.sourceSpecialTags],
    },
    effectTemplates: source.effects.map((effect) => ({ ...effect })),
    sourceEffectRange: input.sourceEffectRange,
    sourceResultRange: input.sourceResultRange,
    tableVersion: "app-facing-v13",
    workbook: WORKBOOK,
    workbookSha256: WORKBOOK_SHA256,
  };
}

function numericProjection(input: {
  bucket: "general" | "initiative" | "skill_ob" | "db_parry";
  category: "general_fatigue" | "initiative" | "skill_ob" | "db_parry" | "movement_modifier";
  effectGroup: CriticalOperationalProjection["effectGroup"];
  value: number;
}): CriticalOperationalProjection {
  const payload: CanonicalCombatModifierPayload = {
    category: input.category,
    contributionScope: "live_value",
    kind: "numeric",
    unit: input.category === "initiative" ? "initiative_value" : "percentage",
    value: input.value,
  };

  return {
    effectGroup: input.effectGroup,
    kind: "combat_modifier",
    modifierBucket: input.bucket,
    payload,
  };
}

function restrictionProjection(input: {
  effectGroup: CriticalOperationalProjection["effectGroup"];
  effectKind:
    | "stunned"
    | "loss_of_use"
    | "dropped_item"
    | "no_combat_action"
    | "action_limited"
    | "unbalanced"
    | "condition";
  operationalRestriction:
    | "cannot_act"
    | "limited_action"
    | "cannot_use_body_part"
    | "dropped_item"
    | "disadvantaged";
  state: Extract<CriticalOperationalProjection, { kind: "combat_state" }>["state"];
}): CriticalOperationalProjection[] {
  return [
    {
      effectGroup: input.effectGroup,
      kind: "combat_modifier",
      payload: {
        effectKind: input.effectKind,
        kind: "restriction",
        operationalRestriction: input.operationalRestriction,
      },
    },
    {
      effectGroup: input.effectGroup,
      kind: "combat_state",
      state: input.state,
    },
  ];
}

function baseOutcome(input: {
  creationRolls?: AcceptedCriticalOutcome["creationRolls"];
  id: string;
  originalSource: AcceptedCriticalOutcome["originalSource"];
}): Omit<AcceptedCriticalOutcome, "childManifest"> {
  return {
    acceptedAt: ACCEPTED_AT,
    creationRolls: input.creationRolls ?? [],
    id: input.id,
    kind: "accepted_critical_outcome",
    originalSource: input.originalSource,
    provenance: {
      attackResultId: `${input.id}:attack`,
      encounterId: "fixture-encounter",
      sourceActorId: "fixture-attacker",
      sourceEventId: `${input.id}:event`,
      targetParticipantId: "fixture-target",
    },
  };
}

export const criticalInjuryFixtureA: CriticalInjuryCase = createCriticalInjuryCase({
  careEpisodes: [],
  functionStates: [],
  informationFacts: [
    {
      canonicalValue: "The target is off-balance and limited to parry for the next round.",
      criticalOutcomeId: "critical-a",
      id: "critical-a:fact:observable",
      initialState: "observable",
      kind: "information_fact",
      label: "Immediate effect",
      revealedToAudienceIds: [],
      visibility: "observable",
    },
  ],
  injuries: [],
  operationalEffects: [
    {
      criticalOutcomeId: "critical-a",
      duration: { kind: "rounds", rounds: 1 },
      id: "critical-a:effect:stance",
      initialState: "active",
      kind: "operational_effect",
      label: "Off-balance",
      projections: [
        numericProjection({
          bucket: "db_parry",
          category: "db_parry",
          effectGroup: "DB",
          value: -2,
        }),
        ...restrictionProjection({
          effectGroup: "DB",
          effectKind: "unbalanced",
          operationalRestriction: "disadvantaged",
          state: { kind: "stance", value: "unbalanced" },
        }),
      ],
      visibility: "observable",
    },
    {
      criticalOutcomeId: "critical-a",
      duration: { kind: "rounds", rounds: 1 },
      id: "critical-a:effect:parry-only",
      initialState: "active",
      kind: "operational_effect",
      label: "Parry only",
      projections: restrictionProjection({
        effectGroup: "Stun/Action",
        effectKind: "action_limited",
        operationalRestriction: "limited_action",
        state: { kind: "action_capacity", value: "parry_only" },
      }),
      visibility: "observable",
    },
  ],
  outcome: baseOutcome({
    id: "critical-a",
    originalSource: fixtureSource({
      criticalIndex: 1,
      family: "sharp",
      location: "head",
      sourceEffectRange: "AppFacing_Effects!A65:AE66",
      sourceResultRange: "AppFacing_Crits!A18:X18",
    }),
  }),
  physiologyProcesses: [],
  transitions: [],
});

export const criticalInjuryFixtureB: CriticalInjuryCase = createCriticalInjuryCase({
  careEpisodes: [
    {
      affectedRecordIds: ["critical-b:physiology:external"],
      capability: "external_bleeding_control",
      criticalOutcomeId: "critical-b",
      id: "critical-b:care:bleeding",
      initialState: "not_started",
      kind: "care_episode",
      label: "External bleeding care",
      visibility: "observable",
    },
  ],
  functionStates: [
    {
      consciousness: "conscious",
      criticalOutcomeId: "critical-b",
      id: "critical-b:function:leg",
      initialState: "severely_impaired",
      kind: "function_state",
      label: "Leg function",
      limbFunction: [{ bodyPart: "upper_leg", state: "impaired" }],
      minimumConsequence: true,
      visibility: "observable",
    },
  ],
  informationFacts: [
    {
      canonicalValue: "A deep upper-leg wound is bleeding externally.",
      criticalOutcomeId: "critical-b",
      id: "critical-b:fact:wound",
      initialState: "observable",
      kind: "information_fact",
      label: "Visible wound",
      revealedToAudienceIds: [],
      visibility: "observable",
    },
  ],
  injuries: [
    {
      anatomicalLocation: "upper_leg",
      criticalOutcomeId: "critical-b",
      id: "critical-b:injury:leg",
      initialState: "acute",
      kind: "injury",
      label: "Deep upper-leg wound",
      permanence: "possible_deficit",
      structuralKind: "soft_tissue",
      visibility: "observable",
    },
  ],
  operationalEffects: [
    {
      criticalOutcomeId: "critical-b",
      duration: { kind: "persistent" },
      id: "critical-b:effect:fall",
      initialState: "active",
      kind: "operational_effect",
      label: "Knocked down",
      projections: restrictionProjection({
        effectGroup: "Mobility",
        effectKind: "condition",
        operationalRestriction: "disadvantaged",
        state: { kind: "stance", value: "prone" },
      }),
      visibility: "observable",
    },
    {
      criticalOutcomeId: "critical-b",
      duration: { condition: "leg_function_changes", kind: "until_condition" },
      id: "critical-b:effect:leg",
      initialState: "active",
      kind: "operational_effect",
      label: "Leg severely impaired",
      projections: [
        {
          effectGroup: "Mobility",
          kind: "combat_modifier",
          payload: {
            category: "movement_modifier",
            contributionScope: "live_value",
            kind: "numeric",
            unit: "percentage",
            value: -8,
          },
        },
        ...restrictionProjection({
          effectGroup: "Mobility",
          effectKind: "loss_of_use",
          operationalRestriction: "cannot_use_body_part",
          state: { bodyPart: "upper_leg", kind: "limb_function", value: "impaired" },
        }),
      ],
      visibility: "observable",
    },
    {
      criticalOutcomeId: "critical-b",
      duration: { kind: "rounds", rounds: 1 },
      id: "critical-b:effect:shock",
      initialState: "active",
      kind: "operational_effect",
      label: "Immediate shock",
      projections: restrictionProjection({
        effectGroup: "Stun/Action",
        effectKind: "stunned",
        operationalRestriction: "cannot_act",
        state: { kind: "action_capacity", value: "no_action" },
      }),
      visibility: "observable",
    },
  ],
  outcome: baseOutcome({
    id: "critical-b",
    originalSource: fixtureSource({
      criticalIndex: 8,
      family: "sharp",
      location: "upper_leg",
      sourceEffectRange: "AppFacing_Effects!A217:AE220",
      sourceResultRange: "AppFacing_Crits!A73:X73",
    }),
  }),
  physiologyProcesses: [
    {
      automation: "inert",
      criticalOutcomeId: "critical-b",
      id: "critical-b:physiology:external",
      initialState: "threatened",
      kind: "physiology_process",
      label: "External blood-loss threat",
      processClass: "ordinary_serious",
      processKind: "external_blood_loss",
      ruleStatus: "calibration_reference_only",
      visibility: "observable",
    },
  ],
  transitions: [],
});

export const criticalInjuryFixtureC: CriticalInjuryCase = createCriticalInjuryCase({
  careEpisodes: [],
  functionStates: [
    {
      consciousness: "conscious",
      criticalOutcomeId: "critical-c",
      id: "critical-c:function:whole-body",
      initialState: "restricted",
      kind: "function_state",
      label: "Painful breathing and movement",
      minimumConsequence: true,
      visibility: "observable",
    },
  ],
  informationFacts: [
    {
      canonicalValue: "A small chest puncture causes painful, guarded breathing.",
      criticalOutcomeId: "critical-c",
      id: "critical-c:fact:observable",
      initialState: "observable",
      kind: "information_fact",
      label: "Observable condition",
      revealedToAudienceIds: [],
      visibility: "observable",
    },
    {
      canonicalValue: "Active internal bleeding is present.",
      criticalOutcomeId: "critical-c",
      id: "critical-c:fact:hidden-process",
      initialState: "unrevealed",
      kind: "information_fact",
      label: "Canonical internal complication",
      revealedToAudienceIds: [],
      visibility: "revealable",
    },
    {
      canonicalValue: "Fixture C selects no universal hidden-complication probability.",
      criticalOutcomeId: "critical-c",
      id: "critical-c:fact:gm-note",
      initialState: "unrevealed",
      kind: "information_fact",
      label: "Calibration boundary",
      revealedToAudienceIds: [],
      visibility: "gm_only",
    },
  ],
  injuries: [
    {
      anatomicalLocation: "chest",
      criticalOutcomeId: "critical-c",
      id: "critical-c:injury:puncture",
      initialState: "acute",
      kind: "injury",
      label: "Penetrating chest injury",
      permanence: "possible_deficit",
      structuralKind: "puncture",
      visibility: "observable",
    },
  ],
  operationalEffects: [
    {
      criticalOutcomeId: "critical-c",
      duration: { condition: "explicit_treatment_rule", kind: "until_condition" },
      id: "critical-c:effect:impaired",
      initialState: "active",
      kind: "operational_effect",
      label: "Action impaired",
      projections: [
        numericProjection({
          bucket: "general",
          category: "general_fatigue",
          effectGroup: "Stun/Action",
          value: -2,
        }),
        ...restrictionProjection({
          effectGroup: "Stun/Action",
          effectKind: "action_limited",
          operationalRestriction: "limited_action",
          state: { kind: "action_capacity", value: "restricted" },
        }),
      ],
      visibility: "observable",
    },
  ],
  outcome: baseOutcome({
    id: "critical-c",
    originalSource: fixtureSource({
      criticalIndex: 5,
      family: "pointed_weapons",
      location: "chest",
      sourceEffectRange: "AppFacing_Effects!A1894:AE1896",
      sourceResultRange: "AppFacing_Crits!A550:X550",
    }),
  }),
  physiologyProcesses: [
    {
      automation: "inert",
      criticalOutcomeId: "critical-c",
      id: "critical-c:physiology:internal",
      initialState: "threatened",
      kind: "physiology_process",
      label: "Internal blood-loss threat",
      processClass: "serious_internal",
      processKind: "internal_blood_loss",
      ruleStatus: "calibration_reference_only",
      visibility: "gm_only",
    },
  ],
  transitions: [],
});

export const criticalInjuryFixtureD: CriticalInjuryCase = createCriticalInjuryCase({
  careEpisodes: [],
  functionStates: [
    {
      consciousness: "unconscious",
      criticalOutcomeId: "critical-d",
      id: "critical-d:function:consciousness",
      initialState: "no_meaningful_action",
      kind: "function_state",
      label: "Unconscious",
      minimumConsequence: true,
      visibility: "observable",
    },
    {
      activationCondition: "after_consciousness_returns",
      consciousness: "conscious",
      criticalOutcomeId: "critical-d",
      id: "critical-d:function:post-wake",
      initialState: "severely_impaired",
      kind: "function_state",
      label: "Post-wake impairment",
      minimumConsequence: true,
      visibility: "gm_only",
    },
  ],
  informationFacts: [
    {
      canonicalValue: "The target is unconscious after a heavy head impact.",
      criticalOutcomeId: "critical-d",
      id: "critical-d:fact:unconscious",
      initialState: "observable",
      kind: "information_fact",
      label: "Responsiveness",
      revealedToAudienceIds: [],
      visibility: "observable",
    },
  ],
  injuries: [
    {
      anatomicalLocation: "head",
      criticalOutcomeId: "critical-d",
      id: "critical-d:injury:concussion",
      initialState: "acute",
      kind: "injury",
      label: "Concussion",
      permanence: "temporary",
      structuralKind: "concussion",
      visibility: "gm_only",
    },
  ],
  operationalEffects: [
    {
      criticalOutcomeId: "critical-d",
      duration: { condition: "authored_waking_condition", kind: "until_condition" },
      id: "critical-d:effect:unconscious",
      initialState: "active",
      kind: "operational_effect",
      label: "Unconscious",
      projections: restrictionProjection({
        effectGroup: "Stun/Action",
        effectKind: "no_combat_action",
        operationalRestriction: "cannot_act",
        state: { kind: "consciousness", value: "unconscious" },
      }),
      visibility: "observable",
    },
  ],
  outcome: baseOutcome({
    creationRolls: [
      {
        formula: "d4",
        purpose: "source unconscious duration",
        rolls: [3],
        sourceEffectKey: "blunt|head|10|02",
        total: 3,
        use: "accepted_mechanic",
      },
    ],
    id: "critical-d",
    originalSource: fixtureSource({
      criticalIndex: 10,
      family: "blunt",
      location: "head",
      sourceEffectRange: "AppFacing_Effects!A384:AE385",
      sourceResultRange: "AppFacing_Crits!A123:X123",
    }),
  }),
  physiologyProcesses: [],
  transitions: [],
});

export const criticalInjuryFixtureE: CriticalInjuryCase = createCriticalInjuryCase({
  careEpisodes: [],
  functionStates: [
    {
      consciousness: "conscious",
      criticalOutcomeId: "critical-e",
      id: "critical-e:function:hand",
      initialState: "severely_impaired",
      kind: "function_state",
      label: "Hand unusable",
      limbFunction: [{ bodyPart: "hand", state: "unusable" }],
      minimumConsequence: true,
      visibility: "observable",
    },
  ],
  informationFacts: [
    {
      canonicalValue: "Two digits are absent and the affected hand is unusable.",
      criticalOutcomeId: "critical-e",
      id: "critical-e:fact:digits",
      initialState: "observable",
      kind: "information_fact",
      label: "Hand injury",
      revealedToAudienceIds: [],
      visibility: "observable",
    },
  ],
  injuries: [
    {
      anatomicalLocation: "hand",
      criticalOutcomeId: "critical-e",
      id: "critical-e:injury:digits",
      initialState: "permanent",
      kind: "injury",
      label: "Two severed digits",
      permanence: "permanent",
      structuralKind: "digit_loss",
      structuredDetails: { absentDigitCount: 2 },
      visibility: "observable",
    },
  ],
  operationalEffects: [
    {
      criticalOutcomeId: "critical-e",
      duration: { kind: "persistent" },
      id: "critical-e:effect:drop-item",
      initialState: "active",
      kind: "operational_effect",
      label: "Drop held item",
      projections: restrictionProjection({
        effectGroup: "Special",
        effectKind: "dropped_item",
        operationalRestriction: "dropped_item",
        state: { kind: "item_control", value: "drop_held_item" },
      }),
      visibility: "observable",
    },
    {
      criticalOutcomeId: "critical-e",
      duration: { condition: "hand_function_changes", kind: "until_condition" },
      id: "critical-e:effect:hand",
      initialState: "active",
      kind: "operational_effect",
      label: "Hand unusable",
      projections: restrictionProjection({
        effectGroup: "OB/Skill",
        effectKind: "loss_of_use",
        operationalRestriction: "cannot_use_body_part",
        state: { bodyPart: "hand", kind: "limb_function", value: "unusable" },
      }),
      visibility: "observable",
    },
    {
      criticalOutcomeId: "critical-e",
      duration: { kind: "rounds", rounds: 1 },
      id: "critical-e:effect:shock",
      initialState: "active",
      kind: "operational_effect",
      label: "Immediate shock",
      projections: restrictionProjection({
        effectGroup: "Stun/Action",
        effectKind: "stunned",
        operationalRestriction: "limited_action",
        state: { kind: "action_capacity", value: "restricted" },
      }),
      visibility: "observable",
    },
  ],
  outcome: baseOutcome({
    creationRolls: [
      {
        formula: "d3",
        purpose: "severed digit count",
        rolls: [2],
        sourceEffectKey: "sharp|arm|11|05",
        total: 2,
        use: "accepted_mechanic",
      },
    ],
    id: "critical-e",
    originalSource: fixtureSource({
      criticalIndex: 11,
      family: "sharp",
      location: "arm",
      sourceEffectRange: "AppFacing_Effects!A31:AE35",
      sourceResultRange: "AppFacing_Crits!A12:X12",
    }),
  }),
  physiologyProcesses: [],
  transitions: [],
});

export const criticalInjuryFixtureF: CriticalInjuryCase = createCriticalInjuryCase({
  careEpisodes: [
    {
      affectedRecordIds: ["critical-f:physiology:catastrophic"],
      capability: "catastrophic_external_bleeding_control",
      criticalOutcomeId: "critical-f",
      id: "critical-f:care:bleeding",
      initialState: "not_started",
      kind: "care_episode",
      label: "Catastrophic bleeding care",
      visibility: "observable",
    },
  ],
  functionStates: [
    {
      consciousness: "dimly_aware",
      criticalOutcomeId: "critical-f",
      id: "critical-f:function:collapse",
      initialState: "no_meaningful_action",
      kind: "function_state",
      label: "Collapsed",
      minimumConsequence: true,
      visibility: "observable",
    },
  ],
  informationFacts: [
    {
      canonicalValue: "Catastrophic visible neck bleeding with collapse.",
      criticalOutcomeId: "critical-f",
      id: "critical-f:fact:catastrophic",
      initialState: "observable",
      kind: "information_fact",
      label: "Immediate condition",
      revealedToAudienceIds: [],
      visibility: "observable",
    },
    {
      canonicalValue: "Death and terminal-state semantics require a newly accepted rule.",
      criticalOutcomeId: "critical-f",
      id: "critical-f:fact:terminal-boundary",
      initialState: "unrevealed",
      kind: "information_fact",
      label: "Terminal rule boundary",
      revealedToAudienceIds: [],
      visibility: "gm_only",
    },
  ],
  injuries: [
    {
      anatomicalLocation: "neck",
      criticalOutcomeId: "critical-f",
      id: "critical-f:injury:vessel",
      initialState: "acute",
      kind: "injury",
      label: "Major neck-vessel injury",
      permanence: "possible_deficit",
      structuralKind: "major_vessel",
      visibility: "observable",
    },
  ],
  operationalEffects: [
    {
      criticalOutcomeId: "critical-f",
      duration: { condition: "catastrophic_process_resolved", kind: "until_condition" },
      id: "critical-f:effect:collapse",
      initialState: "active",
      kind: "operational_effect",
      label: "Collapse and no action",
      projections: [
        ...restrictionProjection({
          effectGroup: "Stun/Action",
          effectKind: "no_combat_action",
          operationalRestriction: "cannot_act",
          state: { kind: "action_capacity", value: "no_action" },
        }),
        {
          effectGroup: "Stun/Action",
          kind: "combat_state",
          state: { kind: "consciousness", value: "dimly_aware" },
        },
      ],
      visibility: "observable",
    },
  ],
  outcome: baseOutcome({
    creationRolls: [
      {
        formula: "d4",
        purpose: "legacy fatal countdown",
        rolls: [3],
        sourceEffectKey: "sharp|head|12|03",
        total: 3,
        use: "source_provenance_only",
      },
    ],
    id: "critical-f",
    originalSource: fixtureSource({
      criticalIndex: 12,
      family: "sharp",
      location: "head",
      sourceEffectRange: "AppFacing_Effects!A93:AE96",
      sourceResultRange: "AppFacing_Crits!A29:X29",
    }),
  }),
  physiologyProcesses: [
    {
      automation: "inert",
      criticalOutcomeId: "critical-f",
      id: "critical-f:physiology:catastrophic",
      initialState: "threatened",
      kind: "physiology_process",
      label: "Catastrophic potentially treatable process",
      processClass: "catastrophic",
      processKind: "fatal_process",
      ruleStatus: "terminal_semantics_unresolved",
      visibility: "observable",
    },
  ],
  transitions: [],
});

export const REPRESENTATIVE_CRITICAL_INJURY_FIXTURES = [
  criticalInjuryFixtureA,
  criticalInjuryFixtureB,
  criticalInjuryFixtureC,
  criticalInjuryFixtureD,
  criticalInjuryFixtureE,
  criticalInjuryFixtureF,
] as const;
