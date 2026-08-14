import type { CanonicalCombatModifierPayload } from "./combatModifierLifecycle";
import type {
  CriticalEffectGroup,
  CriticalEffectTemplate,
  CriticalResult,
} from "./criticalEffectsTable";

/**
 * Inert domain vocabulary for accepted Critical outcomes and their independently evolving
 * consequences. Nothing in this module is connected to live Critical acceptance, Combat state,
 * persistence, treatment, or elapsed-time processing.
 */

export type CriticalInjuryChildKind =
  | "operational_effect"
  | "injury"
  | "physiology_process"
  | "function_state"
  | "care_episode"
  | "information_fact";

export interface CriticalInjuryChildIdentity {
  criticalOutcomeId: string;
  id: string;
}

export interface CriticalInjuryChildManifestEntry {
  readonly id: string;
  readonly kind: CriticalInjuryChildKind;
}

export interface CriticalCreationRoll {
  readonly formula: string;
  readonly purpose: string;
  readonly rolls: readonly number[];
  readonly sourceEffectKey?: string;
  readonly total: number;
  readonly use: "accepted_mechanic" | "source_provenance_only";
}

export interface AcceptedCriticalOutcome {
  readonly acceptedAt: string;
  readonly acceptedByUserId?: string;
  readonly childManifest: readonly CriticalInjuryChildManifestEntry[];
  readonly creationRolls: readonly CriticalCreationRoll[];
  readonly id: string;
  readonly kind: "accepted_critical_outcome";
  readonly originalSource: {
    readonly criticalResult: Readonly<CriticalResult>;
    readonly effectTemplates: readonly Readonly<CriticalEffectTemplate>[];
    readonly sourceEffectRange: string;
    readonly sourceResultRange: string;
    readonly tableVersion: string;
    readonly workbook: string;
    readonly workbookSha256: string;
  };
  readonly provenance: {
    readonly attackResultId?: string;
    readonly encounterId?: string;
    readonly sourceActorId?: string;
    readonly sourceEventId: string;
    readonly targetParticipantId: string;
  };
}

export type CriticalOperationalStateProjection =
  | {
      kind: "action_capacity";
      value: "normal" | "restricted" | "parry_only" | "no_action";
    }
  | {
      kind: "stance";
      value: "stable" | "unbalanced" | "prone";
    }
  | {
      kind: "item_control";
      value: "drop_held_item";
    }
  | {
      kind: "consciousness";
      value: "conscious" | "dimly_aware" | "unconscious";
    }
  | {
      bodyPart: string;
      kind: "limb_function";
      side?: "left" | "right";
      value: "impaired" | "unusable" | "absent";
    };

export type CriticalOperationalProjection =
  | {
      effectGroup: CriticalEffectGroup;
      kind: "combat_modifier";
      modifierBucket?: "general" | "initiative" | "skill_ob" | "db_parry";
      payload: CanonicalCombatModifierPayload;
    }
  | {
      effectGroup: CriticalEffectGroup;
      kind: "combat_state";
      state: CriticalOperationalStateProjection;
    };

export interface CriticalOperationalEffect extends CriticalInjuryChildIdentity {
  duration:
    | { kind: "rounds"; rounds: number }
    | { condition: string; kind: "until_condition" }
    | { kind: "persistent" };
  initialState: "active" | "pending";
  kind: "operational_effect";
  label: string;
  projections: readonly CriticalOperationalProjection[];
  visibility: "observable" | "gm_only";
}

export interface CriticalInjuryRecord extends CriticalInjuryChildIdentity {
  anatomicalLocation: string;
  initialState: "acute" | "protected" | "healing" | "healed_with_deficit" | "permanent";
  kind: "injury";
  label: string;
  permanence: "temporary" | "possible_deficit" | "permanent";
  structuralKind:
    | "superficial"
    | "soft_tissue"
    | "puncture"
    | "concussion"
    | "digit_loss"
    | "major_vessel";
  structuredDetails?: Readonly<Record<string, string | number | boolean>>;
  visibility: "observable" | "gm_only";
}

export interface CriticalPhysiologyProcess extends CriticalInjuryChildIdentity {
  automation: "inert";
  initialState: "controlled" | "threatened" | "terminal";
  kind: "physiology_process";
  label: string;
  processClass: "ordinary_serious" | "serious_internal" | "catastrophic";
  processKind: "external_blood_loss" | "internal_blood_loss" | "fatal_process";
  ruleStatus: "calibration_reference_only" | "terminal_semantics_unresolved";
  visibility: "observable" | "gm_only";
}

export interface CriticalFunctionState extends CriticalInjuryChildIdentity {
  activationCondition?: string;
  consciousness: "conscious" | "dimly_aware" | "unconscious";
  initialState: "functioning" | "restricted" | "severely_impaired" | "no_meaningful_action";
  kind: "function_state";
  label: string;
  limbFunction?: readonly {
    bodyPart: string;
    side?: "left" | "right";
    state: "normal" | "impaired" | "unusable" | "absent";
  }[];
  minimumConsequence: boolean;
  visibility: "observable" | "gm_only";
}

export interface CriticalCareEpisode extends CriticalInjuryChildIdentity {
  affectedRecordIds: readonly string[];
  capability: string;
  initialState: "not_started" | "in_progress" | "stabilized" | "completed";
  kind: "care_episode";
  label: string;
  visibility: "observable" | "gm_only";
}

export interface CriticalInformationFact extends CriticalInjuryChildIdentity {
  canonicalValue: string;
  initialState: "observable" | "unrevealed" | "revealed";
  kind: "information_fact";
  label: string;
  revealedToAudienceIds: readonly string[];
  visibility: "observable" | "revealable" | "gm_only";
}

export interface CriticalInjuryTransition {
  audienceId?: string;
  fromState: string;
  id: string;
  recordedAt: string;
  recordedByUserId?: string;
  reason: string;
  supersedesTransitionId?: string;
  targetId: string;
  targetKind: CriticalInjuryChildKind;
  toState: string;
}

export interface CriticalInjuryCase {
  careEpisodes: readonly CriticalCareEpisode[];
  functionStates: readonly CriticalFunctionState[];
  informationFacts: readonly CriticalInformationFact[];
  injuries: readonly CriticalInjuryRecord[];
  operationalEffects: readonly CriticalOperationalEffect[];
  outcome: AcceptedCriticalOutcome;
  physiologyProcesses: readonly CriticalPhysiologyProcess[];
  transitions: readonly CriticalInjuryTransition[];
}

export interface CriticalInjuryCaseInput extends Omit<CriticalInjuryCase, "outcome"> {
  outcome: Omit<AcceptedCriticalOutcome, "childManifest">;
}

export type CriticalInjuryInformationProjection =
  | {
      facts: readonly CriticalInformationFact[];
      gmOnlyNotes: readonly string[];
      kind: "gm";
    }
  | {
      facts: readonly {
        id: string;
        label: string;
        value: string;
      }[];
      kind: "player";
    };

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function listChildren(input: CriticalInjuryCaseInput | CriticalInjuryCase) {
  return [
    ...input.operationalEffects,
    ...input.injuries,
    ...input.physiologyProcesses,
    ...input.functionStates,
    ...input.careEpisodes,
    ...input.informationFacts,
  ];
}

function assertValidLineage(input: CriticalInjuryCaseInput): void {
  const children = listChildren(input);
  const ids = new Set<string>();

  for (const child of children) {
    if (child.criticalOutcomeId !== input.outcome.id) {
      throw new Error(`Critical injury child '${child.id}' has invalid outcome lineage.`);
    }
    if (ids.has(child.id)) {
      throw new Error(`Critical injury child identity '${child.id}' is duplicated.`);
    }
    ids.add(child.id);
  }

  for (const care of input.careEpisodes) {
    for (const affectedId of care.affectedRecordIds) {
      if (!ids.has(affectedId)) {
        throw new Error(`Care episode '${care.id}' references unknown child '${affectedId}'.`);
      }
    }
  }
}

export function createCriticalInjuryCase(input: CriticalInjuryCaseInput): CriticalInjuryCase {
  assertValidLineage(input);

  const childManifest = listChildren(input).map(({ id, kind }) => ({ id, kind }));
  return deepFreeze({
    ...input,
    outcome: {
      ...input.outcome,
      childManifest,
    },
  });
}

function findTransitionTarget(
  injuryCase: CriticalInjuryCase,
  transition: CriticalInjuryTransition,
) {
  return listChildren(injuryCase).find(
    (child) => child.id === transition.targetId && child.kind === transition.targetKind,
  );
}

export function getCriticalInjuryChildState(
  injuryCase: CriticalInjuryCase,
  targetId: string,
  audienceId?: string,
): string | undefined {
  const target = listChildren(injuryCase).find((child) => child.id === targetId);
  if (!target) return undefined;

  return (
    injuryCase.transitions
      .filter(
        (transition) =>
          transition.targetId === targetId &&
          (target.kind !== "information_fact" || transition.audienceId === audienceId),
      )
      .at(-1)?.toState ?? target.initialState
  );
}

export function appendCriticalInjuryTransition(
  injuryCase: CriticalInjuryCase,
  transition: CriticalInjuryTransition,
): CriticalInjuryCase {
  const target = findTransitionTarget(injuryCase, transition);
  if (!target) {
    throw new Error(
      `Critical injury transition '${transition.id}' targets an unknown child record.`,
    );
  }
  if (injuryCase.transitions.some((candidate) => candidate.id === transition.id)) {
    throw new Error(`Critical injury transition identity '${transition.id}' is duplicated.`);
  }

  if (
    target.kind === "information_fact" &&
    transition.toState === "revealed" &&
    (target.visibility !== "revealable" || !transition.audienceId)
  ) {
    throw new Error(
      `Critical injury transition '${transition.id}' cannot reveal this information fact.`,
    );
  }

  const currentState = getCriticalInjuryChildState(
    injuryCase,
    transition.targetId,
    transition.audienceId,
  );
  if (currentState !== transition.fromState) {
    throw new Error(
      `Critical injury transition '${transition.id}' expected '${currentState}' but received '${transition.fromState}'.`,
    );
  }

  if (transition.supersedesTransitionId) {
    const superseded = injuryCase.transitions.find(
      (candidate) => candidate.id === transition.supersedesTransitionId,
    );
    if (!superseded || superseded.targetId !== transition.targetId) {
      throw new Error(
        `Critical injury transition '${transition.id}' has invalid superseding lineage.`,
      );
    }
  }

  return deepFreeze({
    ...injuryCase,
    outcome: injuryCase.outcome,
    transitions: [...injuryCase.transitions, transition],
  });
}

function isFactRevealed(
  injuryCase: CriticalInjuryCase,
  fact: CriticalInformationFact,
  audienceId: string,
): boolean {
  return (
    fact.revealedToAudienceIds.includes(audienceId) ||
    injuryCase.transitions.some(
      (transition) =>
        transition.targetId === fact.id &&
        transition.targetKind === "information_fact" &&
        transition.toState === "revealed" &&
        transition.audienceId === audienceId,
    )
  );
}

export function projectCriticalInjuryInformation(input: {
  audienceId?: string;
  injuryCase: CriticalInjuryCase;
  viewer: "gm" | "player";
}): CriticalInjuryInformationProjection {
  if (input.viewer === "gm") {
    return deepFreeze({
      facts: [...input.injuryCase.informationFacts],
      gmOnlyNotes: input.injuryCase.informationFacts
        .filter((fact) => fact.visibility === "gm_only")
        .map((fact) => fact.canonicalValue),
      kind: "gm" as const,
    });
  }

  const audienceId = input.audienceId;
  const facts = input.injuryCase.informationFacts
    .filter(
      (fact) =>
        fact.visibility === "observable" ||
        (fact.visibility === "revealable" &&
          audienceId !== undefined &&
          isFactRevealed(input.injuryCase, fact, audienceId)),
    )
    .map((fact) => ({ id: fact.id, label: fact.label, value: fact.canonicalValue }));

  return deepFreeze({ facts, kind: "player" as const });
}
