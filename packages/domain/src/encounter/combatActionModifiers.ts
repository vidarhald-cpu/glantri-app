import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";
import {
  calculateDistanceObPenalty,
  combatDistanceSchema,
  getNearestPreferredDistance,
  type CombatDistance,
} from "./combatDistance";
import type { MovementIntent } from "./combatMovementIntent";
import {
  ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE,
  type CombatAttackPhaseDefensivePenalty,
} from "./combatAttackPhasePenalty";
import {
  attachCanonicalLifecycleToModifierBucketRow,
  restateCanonicalModifierBucketRowValue,
  type CanonicalCombatModifierCompatibilityContext,
} from "./combatModifierLifecycleCompatibility";

export const ATTACK_PARRY_DB_PARRY_MODIFIER_ID = "generated:attack-parry:phase1:db-parry";
export const ATTACK_PARRY_DB_PARRY_SOURCE_RULE = "attack-parry-db-parry-phase1";
export const PARRY_ATTACK_DB_PARRY_MODIFIER_ID = "generated:parry-attack:phase2:db-parry";
export const PARRY_ATTACK_DB_PARRY_SOURCE_RULE = "parry-attack-db-parry-phase2";
export const DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID = "generated:double-attack:phase1:ob-skill";
export const DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE = "double-attack-ob-skill-phase1";
export const DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID = "generated:double-attack:phase2:ob-skill";
export const DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE = "double-attack-ob-skill-phase2";
export const DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID = "generated:double-attack:phase1:db-parry";
export const DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE = "double-attack-db-parry-phase1";
export const DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID = "generated:double-attack:phase2:db-parry";
export const DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE = "double-attack-db-parry-phase2";
export const DOUBLE_ATTACK_CANCELLED_PHASE2_DB_PARRY_SOURCE_RULE =
  "double-attack-cancelled-db-parry-phase2";
export const ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID =
  "generated:adjust-range-attack:phase1:db-parry";
export const ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE = "adjust-range-phase1-db-parry";
/** Legacy placeholder row: retained only so refresh can remove saved copies. */
export const ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID =
  "generated:adjust-range-attack:phase2:db-parry";
export const ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE = "adjust-range-attack-phase2-db-parry";
export const DISTANCE_OB_SKILL_SOURCE_RULE = "distance-ob-skill";
export const REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID =
  "generated:parry-attack:phase2:initiative";
export const REACTIVE_ATTACK_PHASE2_INITIATIVE_SOURCE_RULE = "parry-attack-phase2-initiative";
export const OFFENSIVE_PARRY_ROUND_DB_MODIFIER_ID = "generated:offensive-parry:round:percentage-db";
export const OFFENSIVE_PARRY_ROUND_DB_SOURCE_RULE = "offensive-parry-round-percentage-db";
const LEGACY_OFFENSIVE_PARRY_ROUND_DB_MODIFIER_ID = "generated:offensive-parry:round:flat-db";
const LEGACY_OFFENSIVE_PARRY_ROUND_DB_SOURCE_RULE = "offensive-parry-round-flat-db";
export const PARRY_ROUND_PERCENTAGE_MODIFIER_ID = "generated:parry:round:db-parry-percentage";
export const PARRY_ROUND_PERCENTAGE_SOURCE_RULE = "parry-dodge-one-fifth";

export interface CombatActionGeneratedDistanceModifierInput {
  actualDistance: CombatDistance | number;
  actualDistanceBasis?: "current" | "declared_intent";
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  sourceActionId?: string;
  weaponName?: string;
}

function normalizeCombatDistanceValues(
  distances: readonly (CombatDistance | number)[],
): CombatDistance[] {
  return distances.map((distance) => combatDistanceSchema.parse(distance));
}

export function getSingleAttackDeclaredDistanceForPenalty(input: {
  actionId?: string;
  movementIntent?: MovementIntent;
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  targetParticipantId?: string;
}): CombatDistance | undefined {
  if (
    input.actionId !== "attack_parry" ||
    input.phase !== "phase1" ||
    input.movementIntent?.mode !== "set_distance_preferences" ||
    !input.targetParticipantId
  ) {
    return undefined;
  }

  const preferredDistances = normalizeCombatDistanceValues(input.preferredDistances);

  if (preferredDistances.length === 0) {
    return undefined;
  }

  const longestAttackDistance = Math.max(...preferredDistances);
  const matchingPreference = input.movementIntent.distancePreferences.find((preference) => {
    const preferencePhase = preference.phase ?? "round";

    return (
      preference.targetParticipantId === input.targetParticipantId &&
      (preferencePhase === "round" || preferencePhase === input.phase) &&
      preference.desiredDistance > longestAttackDistance
    );
  });

  return matchingPreference?.desiredDistance;
}

export function buildDistanceGeneratedObSkillModifier(input: {
  actualDistance: CombatDistance | number;
  actualDistanceBasis?: "current" | "declared_intent";
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  sourceActionId?: string;
  weaponName?: string;
}): ScenarioCombatModifierEntry | undefined {
  const actualDistance = combatDistanceSchema.parse(input.actualDistance);
  const preferredDistances = normalizeCombatDistanceValues(input.preferredDistances);
  const value = calculateDistanceObPenalty(actualDistance, preferredDistances);
  const nearestPreferredDistance = getNearestPreferredDistance(actualDistance, preferredDistances);

  if (value >= 0) {
    return undefined;
  }

  const preferredLabel =
    preferredDistances.length === 1
      ? String(preferredDistances[0])
      : `${Math.min(...preferredDistances)}-${Math.max(...preferredDistances)}`;
  const distanceLabel =
    input.actualDistanceBasis === "declared_intent"
      ? `declared ${actualDistance}`
      : `actual ${actualDistance}`;

  return scenarioCombatModifierEntrySchema.parse({
    durationRounds: 1,
    generated: true,
    id: `generated:distance:${input.phase}:ob-skill`,
    notes: `distance: ${input.weaponName ? `${input.weaponName} ` : ""}preferred ${preferredLabel} · ${distanceLabel} · nearest ${nearestPreferredDistance} · Skill/OB ${value}`,
    scope: "until",
    sourceActionId: input.sourceActionId,
    sourcePhase: input.phase,
    sourceRule: `${DISTANCE_OB_SKILL_SOURCE_RULE}-${input.phase}`,
    value,
  } satisfies ScenarioCombatModifierEntry);
}

export function isDistanceGeneratedObSkillModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id.startsWith("generated:distance:") ||
    entry.sourceRule === DISTANCE_OB_SKILL_SOURCE_RULE ||
    entry.sourceRule === `${DISTANCE_OB_SKILL_SOURCE_RULE}-phase1` ||
    entry.sourceRule === `${DISTANCE_OB_SKILL_SOURCE_RULE}-phase2`
  );
}

export function isAttackParryGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id === ATTACK_PARRY_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ATTACK_PARRY_DB_PARRY_SOURCE_RULE ||
    (entry.sourceActionId === "attack_parry" &&
      entry.sourceRule?.startsWith(ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE) === true)
  );
}

export function isParryAttackGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id === PARRY_ATTACK_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === PARRY_ATTACK_DB_PARRY_SOURCE_RULE ||
    (entry.sourceActionId === "parry_attack" &&
      entry.sourceRule?.startsWith(ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE) === true)
  );
}

export function isDoubleAttackGeneratedObSkillModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE ||
    entry.id === DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE
  );
}

export function isDoubleAttackGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE ||
    entry.id === DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE ||
    (entry.sourceActionId === "double_attack" &&
      entry.sourceRule?.startsWith(ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE) === true)
  );
}

export function isAttackPhaseDefensivePenaltyModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.sourceRule?.startsWith(ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE) === true ||
    isAttackParryGeneratedDbParryModifier(entry) ||
    isParryAttackGeneratedDbParryModifier(entry) ||
    isDoubleAttackGeneratedDbParryModifier(entry)
  );
}

export function isAdjustRangeAttackGeneratedDbParryModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE ||
    entry.id === ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID ||
    entry.sourceRule === ADJUST_RANGE_PHASE2_DB_PARRY_SOURCE_RULE
  );
}

export function isReactiveAttackGeneratedInitiativeModifier(
  entry: ScenarioCombatModifierEntry,
): boolean {
  return (
    entry.id === REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID ||
    entry.sourceRule === REACTIVE_ATTACK_PHASE2_INITIATIVE_SOURCE_RULE
  );
}

export function isOffensiveParryGeneratedDbModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id === OFFENSIVE_PARRY_ROUND_DB_MODIFIER_ID ||
    entry.sourceRule === OFFENSIVE_PARRY_ROUND_DB_SOURCE_RULE ||
    entry.id === LEGACY_OFFENSIVE_PARRY_ROUND_DB_MODIFIER_ID ||
    entry.sourceRule === LEGACY_OFFENSIVE_PARRY_ROUND_DB_SOURCE_RULE
  );
}

export function isParryGeneratedPercentageModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.id === PARRY_ROUND_PERCENTAGE_MODIFIER_ID ||
    entry.sourceRule === PARRY_ROUND_PERCENTAGE_SOURCE_RULE
  );
}

function isCombatActionGeneratedDbParryModifier(entry: ScenarioCombatModifierEntry): boolean {
  return (
    isAttackParryGeneratedDbParryModifier(entry) ||
    isParryAttackGeneratedDbParryModifier(entry) ||
    isDoubleAttackGeneratedDbParryModifier(entry) ||
    isAdjustRangeAttackGeneratedDbParryModifier(entry) ||
    isOffensiveParryGeneratedDbModifier(entry) ||
    isParryGeneratedPercentageModifier(entry)
  );
}

export function buildAttackPhaseDefensivePenaltyModifier(
  penalty: CombatAttackPhaseDefensivePenalty,
): ScenarioCombatModifierEntry | undefined {
  if (penalty.penalty === 0) return undefined;

  const reasonLabel =
    penalty.reason === "double_attack_second_cancelled"
      ? "Double Attack second attack cancelled"
      : penalty.reason === "simultaneous_attack_backout"
        ? "simultaneous attack backout"
        : "committed weapon attack";

  return scenarioCombatModifierEntrySchema.parse({
    application: "percentage",
    durationRounds: 1,
    expiresAtRound: penalty.roundNumber,
    generated: true,
    id: `generated:${penalty.id}:db-parry`,
    notes: `${reasonLabel}: DB/Parry ${penalty.penalty}% in ${penalty.phase}`,
    provisional: penalty.commitment === "provisional",
    scope: "until",
    sourceActionId: penalty.sourceActionId,
    sourceDuration: penalty.duration,
    sourceOpportunityId: penalty.attackOpportunityId,
    sourcePhase: penalty.phase,
    sourceProcessId: penalty.attackProcessId,
    sourceRoundNumber: penalty.roundNumber,
    sourceRule: `${ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE}:${penalty.reason}`,
    value: penalty.penalty,
  });
}

export function applyAttackPhaseDefensivePenaltyModifiers(input: {
  combatContext: ScenarioParticipantCombatContext;
  penalties: readonly CombatAttackPhaseDefensivePenalty[];
}): ScenarioParticipantCombatContext {
  const generated = input.penalties
    .map(buildAttackPhaseDefensivePenaltyModifier)
    .filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));

  return scenarioParticipantCombatContextSchema.parse({
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationDb: [
        ...input.combatContext.modifierBuckets.situationDb.filter(
          (entry) => !isAttackPhaseDefensivePenaltyModifier(entry),
        ),
        ...generated,
      ],
    },
  });
}

/**
 * What a rule event does to a figure the GM has already committed, while the review that committed
 * it is still open (#931, Product Owner ruling on comment 20917, narrowed on comment 21064).
 *
 * The rule's number applies, and it applies visibly: the superseded figure is kept on the row, the
 * row's own note says so through the existing notes-to-Details path, and the caller returns the
 * row to review. This is the one place that decides what counts as a superseded row; callers decide
 * only whether a rule event has happened and whether a review boundary is open to return it to.
 */
export const SUPERSEDED_GM_FIGURE_NOTE_MARKER = " · GM figure superseded by the rule: ";

const ATTACK_PHASE_PENALTY_ROW_ID_PREFIX = "generated:attack-phase-penalty:";

/**
 * A generated attack-phase DB/Parry row of one phase, recognised by the id the generator gives it
 * and not by its source rule. A Double Attack cancel rewrites the row's source rule to a value
 * `isAttackPhaseDefensivePenaltyModifier` does not recognise, while the id is stable.
 */
function isAttackPhasePenaltyRowOfPhase(
  entry: ScenarioCombatModifierEntry,
  phase: "phase1" | "phase2",
): boolean {
  return entry.sourcePhase === phase && entry.id.startsWith(ATTACK_PHASE_PENALTY_ROW_ID_PREFIX);
}

function formatSupersededFigure(entry: ScenarioCombatModifierEntry, value: number): string {
  return `DB/Parry ${value > 0 ? "+" : ""}${value}${entry.application === "percentage" ? "%" : ""}`;
}

export function stripSupersededGmFigureNote(notes: string | undefined): string | undefined {
  if (notes === undefined) return undefined;
  const index = notes.indexOf(SUPERSEDED_GM_FIGURE_NOTE_MARKER);
  const stripped = index < 0 ? notes : notes.slice(0, index);
  return stripped.length > 0 ? stripped : undefined;
}

/**
 * Marks every attack-phase row of `phase` in `next` whose figure differs from the figure `previous`
 * held for the same row id. A row `previous` did not hold is a row the GM removed (or never had),
 * and its superseded figure is 0. A figure that did not change is not a supersession and is left
 * alone, so a rule event that lands on the GM's own number marks nothing.
 *
 * A row `previous` already carries a superseded figure for keeps that figure: the GM has not
 * reviewed since, so the figure the GM committed is still the older one.
 */
export function supersedeGmCommittedAttackPhasePenaltyRows(input: {
  next: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
  previous: ScenarioParticipantCombatContext;
}): { combatContext: ScenarioParticipantCombatContext; supersededRowIds: string[] } {
  const previousById = new Map<string, ScenarioCombatModifierEntry>();
  for (const entry of input.previous.modifierBuckets.situationDb) {
    if (isAttackPhasePenaltyRowOfPhase(entry, input.phase) && !previousById.has(entry.id)) {
      previousById.set(entry.id, entry);
    }
  }
  const supersededRowIds: string[] = [];
  const situationDb = input.next.modifierBuckets.situationDb.map((entry) => {
    if (!isAttackPhasePenaltyRowOfPhase(entry, input.phase)) return entry;
    const previous = previousById.get(entry.id);
    const committed = previous?.supersededGmFigure ?? {
      text: previous ? (previous.notes ?? "") : "removed by the GM",
      value: previous?.value ?? 0,
    };
    if (committed.value === entry.value) return entry;
    supersededRowIds.push(entry.id);
    const base = stripSupersededGmFigureNote(entry.notes);
    return {
      ...entry,
      notes: `${base ?? ""}${SUPERSEDED_GM_FIGURE_NOTE_MARKER}${formatSupersededFigure(
        entry,
        committed.value,
      )}; review again`,
      supersededGmFigure: committed,
    };
  });
  return {
    combatContext:
      supersededRowIds.length === 0
        ? input.next
        : scenarioParticipantCombatContextSchema.parse({
            ...input.next,
            modifierBuckets: { ...input.next.modifierBuckets, situationDb },
          }),
    supersededRowIds: [...new Set(supersededRowIds)],
  };
}

/**
 * Keeps, for each phase in `phases`, the attack-phase rows `previous` held, in place of whatever
 * `next` rebuilt for that phase. This is the #915 generation gate applied to a writer that rebuilds
 * every attack-phase row at once: a phase the GM has committed is the GM's, and a decision about
 * another phase is not a rule event for it.
 */
export function keepGmCommittedAttackPhasePenaltyRows(input: {
  next: ScenarioParticipantCombatContext;
  phases: readonly ("phase1" | "phase2")[];
  previous: ScenarioParticipantCombatContext;
}): ScenarioParticipantCombatContext {
  if (input.phases.length === 0) return input.next;
  const inKeptPhase = (entry: ScenarioCombatModifierEntry) =>
    input.phases.some((phase) => isAttackPhasePenaltyRowOfPhase(entry, phase));
  return scenarioParticipantCombatContextSchema.parse({
    ...input.next,
    modifierBuckets: {
      ...input.next.modifierBuckets,
      situationDb: [
        ...input.previous.modifierBuckets.situationDb.filter(inKeptPhase),
        ...input.next.modifierBuckets.situationDb.filter((entry) => !inKeptPhase(entry)),
      ],
    },
  });
}

export function combatContextHasSupersededGmFigure(
  combatContext: ScenarioParticipantCombatContext,
  phase: "phase1" | "phase2",
): boolean {
  return combatContext.modifierBuckets.situationDb.some(
    (entry) => entry.sourcePhase === phase && entry.supersededGmFigure !== undefined,
  );
}

/**
 * Clears the superseded mark from the rows of the reviewed phase: the retained field and the note
 * suffix. The note is stripped by its marker whether or not the field survived the client's round
 * trip, so a submission that dropped the field still loses the visible text. The GM's decision on
 * the row is whatever the submission carries; this never touches a value.
 */
export function clearSupersededGmFigureMarks(input: {
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
}): ScenarioParticipantCombatContext {
  const marked = (entry: ScenarioCombatModifierEntry) =>
    entry.sourcePhase === input.phase &&
    (entry.supersededGmFigure !== undefined ||
      entry.notes?.includes(SUPERSEDED_GM_FIGURE_NOTE_MARKER) === true);
  if (!input.combatContext.modifierBuckets.situationDb.some(marked)) return input.combatContext;
  return scenarioParticipantCombatContextSchema.parse({
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationDb: input.combatContext.modifierBuckets.situationDb.map((entry) => {
        if (!marked(entry)) return entry;
        const { supersededGmFigure: _cleared, ...rest } = entry;
        void _cleared;
        const notes = stripSupersededGmFigureNote(entry.notes);
        return notes === undefined ? rest : { ...rest, notes };
      }),
    },
  });
}

function isCombatActionGeneratedObSkillModifier(entry: ScenarioCombatModifierEntry): boolean {
  return isDoubleAttackGeneratedObSkillModifier(entry) || isDistanceGeneratedObSkillModifier(entry);
}

function isCombatActionGeneratedInitiativeModifier(entry: ScenarioCombatModifierEntry): boolean {
  return isReactiveAttackGeneratedInitiativeModifier(entry);
}

export function applyDistanceGeneratedObSkillModifier(input: {
  actualDistance: CombatDistance | number;
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
  preferredDistances: readonly (CombatDistance | number)[];
  sourceActionId?: string;
  weaponName?: string;
}): ScenarioParticipantCombatContext {
  const modifier = buildDistanceGeneratedObSkillModifier(input);
  const situationObSkillWithoutDistanceModifier =
    input.combatContext.modifierBuckets.situationObSkill.filter(
      (entry) => !(isDistanceGeneratedObSkillModifier(entry) && entry.sourcePhase === input.phase),
    );

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationObSkill: modifier
        ? [...situationObSkillWithoutDistanceModifier, modifier]
        : situationObSkillWithoutDistanceModifier,
    },
  };
}

export function clearDistanceGeneratedObSkillModifierForPhase(input: {
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
}): ScenarioParticipantCombatContext {
  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationObSkill: input.combatContext.modifierBuckets.situationObSkill.filter(
        (entry) =>
          !(isDistanceGeneratedObSkillModifier(entry) && entry.sourcePhase === input.phase),
      ),
    },
  };
}

export function removeDistanceGeneratedObSkillModifiers(input: {
  combatContext?: ScenarioParticipantCombatContext;
  command?: { facts?: Record<string, unknown> };
  modifierIds?: readonly unknown[];
}): ScenarioParticipantCombatContext {
  const currentContext = scenarioParticipantCombatContextSchema.parse(input.combatContext ?? {});
  const modifierIds = new Set(
    (
      input.modifierIds ??
      (Array.isArray(input.command?.facts?.createdCombatModifierIds)
        ? input.command.facts.createdCombatModifierIds
        : [])
    ).filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
  );

  if (modifierIds.size === 0) {
    return currentContext;
  }

  return {
    ...currentContext,
    modifierBuckets: {
      ...currentContext.modifierBuckets,
      situationObSkill: currentContext.modifierBuckets.situationObSkill.filter(
        (entry) => !(modifierIds.has(entry.id) && isDistanceGeneratedObSkillModifier(entry)),
      ),
    },
  };
}

export interface CombatActionGeneratedModifierSofteningChange {
  bucketKey: "situationDb";
  modifierId: string;
  nextEntry: ScenarioCombatModifierEntry;
  previousEntry: ScenarioCombatModifierEntry;
}

function combatActionGeneratedDbParryModifierMatchesPhase(input: {
  entry: ScenarioCombatModifierEntry;
  phase: "phase1" | "phase2";
}): boolean {
  if (input.entry.sourcePhase === input.phase) {
    return true;
  }

  if (input.phase === "phase1") {
    return (
      input.entry.sourceRule === ATTACK_PARRY_DB_PARRY_SOURCE_RULE ||
      input.entry.sourceRule === DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE
    );
  }

  return (
    input.entry.sourceRule === PARRY_ATTACK_DB_PARRY_SOURCE_RULE ||
    input.entry.sourceRule === DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE
  );
}

function isSoftenableBackOutAttackDbParryModifier(input: {
  actionId?: string;
  entry: ScenarioCombatModifierEntry;
  opportunityId?: string;
  phase: "phase1" | "phase2";
}): boolean {
  return Boolean(
    input.entry.generated &&
    input.entry.value === -4 &&
    isAttackPhaseDefensivePenaltyModifier(input.entry) &&
    combatActionGeneratedDbParryModifierMatchesPhase({
      entry: input.entry,
      phase: input.phase,
    }) &&
    (!input.opportunityId ||
      !input.entry.sourceOpportunityId ||
      input.entry.sourceOpportunityId === input.opportunityId) &&
    (!input.actionId ||
      !input.entry.sourceActionId ||
      input.entry.sourceActionId === input.actionId),
  );
}

export function softenCombatActionGeneratedBackOutModifier(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  opportunityId?: string;
  phase: "phase1" | "phase2";
}): {
  combatContext: ScenarioParticipantCombatContext;
  softenedModifiers: CombatActionGeneratedModifierSofteningChange[];
  warning?: string;
} {
  const softenedModifiers: CombatActionGeneratedModifierSofteningChange[] = [];
  const situationDb = input.combatContext.modifierBuckets.situationDb.map((entry) => {
    if (
      softenedModifiers.length > 0 ||
      !isSoftenableBackOutAttackDbParryModifier({
        actionId: input.actionId,
        entry,
        opportunityId: input.opportunityId,
        phase: input.phase,
      })
    ) {
      return entry;
    }

    // The row carries an attached canonical projection, and resolution reads the value from that
    // projection rather than from `entry.value`, so the reduction is restated on both (#884).
    const nextEntry = restateCanonicalModifierBucketRowValue({
      entry: {
        ...entry,
        notes: `simultaneous attack backout: DB/Parry -2% in ${input.phase}`,
        provisional: false,
        sourceRule: `${ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE}:simultaneous_attack_backout`,
      },
      nextValue: -2,
    });

    softenedModifiers.push({
      bucketKey: "situationDb",
      modifierId: entry.id,
      nextEntry,
      previousEntry: entry,
    });

    return nextEntry;
  });

  return {
    combatContext: {
      ...input.combatContext,
      modifierBuckets: {
        ...input.combatContext.modifierBuckets,
        situationDb,
      },
    },
    softenedModifiers,
    warning:
      softenedModifiers.length === 0
        ? "No generated attack DB/Parry -4 modifier was found to soften."
        : undefined,
  };
}

function parseCombatActionGeneratedModifierSofteningChange(
  value: unknown,
): CombatActionGeneratedModifierSofteningChange | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (record.bucketKey !== "situationDb" || typeof record.modifierId !== "string") {
    return undefined;
  }

  const previousEntry = scenarioCombatModifierEntrySchema.safeParse(record.previousEntry);
  const nextEntry = scenarioCombatModifierEntrySchema.safeParse(record.nextEntry);

  if (!previousEntry.success || !nextEntry.success) {
    return undefined;
  }

  return {
    bucketKey: "situationDb",
    modifierId: record.modifierId,
    nextEntry: nextEntry.data,
    previousEntry: previousEntry.data,
  };
}

export function restoreCombatActionGeneratedBackOutModifiers(input: {
  combatContext: ScenarioParticipantCombatContext;
  softenedModifiers?: readonly unknown[];
}): ScenarioParticipantCombatContext {
  const softenedModifiers = (input.softenedModifiers ?? [])
    .map(parseCombatActionGeneratedModifierSofteningChange)
    .filter((entry): entry is CombatActionGeneratedModifierSofteningChange => Boolean(entry));

  if (softenedModifiers.length === 0) {
    return input.combatContext;
  }

  const previousEntryById = new Map(
    softenedModifiers.map((change) => [change.modifierId, change.previousEntry]),
  );
  const restoredIds = new Set<string>();
  const situationDb = input.combatContext.modifierBuckets.situationDb.map((entry) => {
    const previousEntry = previousEntryById.get(entry.id);

    if (!previousEntry) {
      return entry;
    }

    restoredIds.add(entry.id);
    return previousEntry;
  });

  for (const change of softenedModifiers) {
    if (!restoredIds.has(change.modifierId)) {
      situationDb.push(change.previousEntry);
    }
  }

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      situationDb,
    },
  };
}

export function buildAttackParryGeneratedDbParryModifier(): ScenarioCombatModifierEntry {
  return {
    durationRounds: 1,
    generated: true,
    id: ATTACK_PARRY_DB_PARRY_MODIFIER_ID,
    notes: "single attack",
    scope: "until",
    sourceActionId: "attack_parry",
    sourcePhase: "phase1",
    sourceRule: ATTACK_PARRY_DB_PARRY_SOURCE_RULE,
    value: -4,
  };
}

export function buildParryAttackGeneratedDbParryModifier(): ScenarioCombatModifierEntry {
  return {
    durationRounds: 1,
    generated: true,
    id: PARRY_ATTACK_DB_PARRY_MODIFIER_ID,
    notes: "reactive attack",
    scope: "until",
    sourceActionId: "parry_attack",
    sourcePhase: "phase2",
    sourceRule: PARRY_ATTACK_DB_PARRY_SOURCE_RULE,
    value: -4,
  };
}

export function buildOffensiveParryGeneratedDbModifier(input?: {
  roundNumber?: number;
}): ScenarioCombatModifierEntry {
  return scenarioCombatModifierEntrySchema.parse({
    application: "percentage",
    durationRounds: 1,
    expiresAtRound: input?.roundNumber,
    generated: true,
    id: OFFENSIVE_PARRY_ROUND_DB_MODIFIER_ID,
    notes: "offensive parry: DB/Parry -2% for the declared round",
    scope: "until",
    sourceActionId: "offensive_parry",
    sourceRoundNumber: input?.roundNumber,
    sourceRule: OFFENSIVE_PARRY_ROUND_DB_SOURCE_RULE,
    value: -2,
  });
}

export function buildParryGeneratedPercentageModifier(input: {
  dodgeSkillValue: number;
  percentageModifier: number;
  roundNumber?: number;
}): ScenarioCombatModifierEntry {
  return scenarioCombatModifierEntrySchema.parse({
    application: "percentage",
    durationRounds: 1,
    expiresAtRound: input.roundNumber,
    generated: true,
    id: PARRY_ROUND_PERCENTAGE_MODIFIER_ID,
    notes: `Parry: Dodge ${input.dodgeSkillValue}; one fifth, rounded down; Parry +${input.percentageModifier}%`,
    scope: "until",
    sourceActionId: "parry",
    sourceRoundNumber: input.roundNumber,
    sourceRule: PARRY_ROUND_PERCENTAGE_SOURCE_RULE,
    value: input.percentageModifier,
  });
}

export function buildReactiveAttackPhase2GeneratedInitiativeModifier(input: {
  reason: string;
  value: number;
}): ScenarioCombatModifierEntry {
  return scenarioCombatModifierEntrySchema.parse({
    durationRounds: 1,
    generated: true,
    id: REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
    notes: `reactive attack: ${input.reason}`,
    scope: "until",
    sourceActionId: "parry_attack",
    sourcePhase: "phase2",
    sourceRule: REACTIVE_ATTACK_PHASE2_INITIATIVE_SOURCE_RULE,
    value: input.value,
  } satisfies ScenarioCombatModifierEntry);
}

export function buildDoubleAttackGeneratedObSkillModifiers(): ScenarioCombatModifierEntry[] {
  return [
    {
      application: "percentage",
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase1",
      sourceRule: DOUBLE_ATTACK_PHASE1_OB_SKILL_SOURCE_RULE,
      value: -1,
    },
    {
      application: "percentage",
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase2",
      sourceRule: DOUBLE_ATTACK_PHASE2_OB_SKILL_SOURCE_RULE,
      value: -1,
    },
  ];
}

export function buildDoubleAttackGeneratedDbParryModifiers(): ScenarioCombatModifierEntry[] {
  return [
    {
      application: "percentage",
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase1",
      sourceRule: DOUBLE_ATTACK_PHASE1_DB_PARRY_SOURCE_RULE,
      value: -4,
    },
    {
      application: "percentage",
      durationRounds: 1,
      generated: true,
      id: DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID,
      notes: "double attack",
      scope: "until",
      sourceActionId: "double_attack",
      sourcePhase: "phase2",
      sourceRule: DOUBLE_ATTACK_PHASE2_DB_PARRY_SOURCE_RULE,
      value: -4,
    },
  ];
}

/**
 * Applies the rule consequence of cancelling Double Attack's second attack after phase 1.
 * Phase-1 rows are recorded facts and remain untouched; only the phase-2 attack penalty is
 * removed and the phase-2 defensive penalty is reduced from -4 to -2.
 */
export function cancelDoubleAttackPhase2GeneratedModifiers(
  combatContext: ScenarioParticipantCombatContext,
): ScenarioParticipantCombatContext {
  return scenarioParticipantCombatContextSchema.parse({
    ...combatContext,
    modifierBuckets: {
      ...combatContext.modifierBuckets,
      situationDb: combatContext.modifierBuckets.situationDb.map((entry) =>
        entry.id === DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID ||
        (entry.sourceActionId === "double_attack" &&
          entry.sourcePhase === "phase2" &&
          isAttackPhaseDefensivePenaltyModifier(entry))
          ? // Resolution reads an attached canonical projection in preference to `entry.value`, so
            // the reduction is restated on both (#884).
            restateCanonicalModifierBucketRowValue({
              entry: {
                ...entry,
                notes: "double attack cancelled after Attack 1",
                sourceRule: DOUBLE_ATTACK_CANCELLED_PHASE2_DB_PARRY_SOURCE_RULE,
              },
              nextValue: -2,
            })
          : entry,
      ),
      situationObSkill: combatContext.modifierBuckets.situationObSkill.filter(
        (entry) => entry.id !== DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
      ),
    },
  });
}

/** Restores the committed phase-2 Double Attack rows without touching unrelated rows. */
export function continueDoubleAttackPhase2GeneratedModifiers(
  combatContext: ScenarioParticipantCombatContext,
): ScenarioParticipantCombatContext {
  const dbRows = buildDoubleAttackGeneratedDbParryModifiers();
  const obRows = buildDoubleAttackGeneratedObSkillModifiers();
  const phase2Db = dbRows.find((entry) => entry.sourcePhase === "phase2");
  const phase2Ob = obRows.find((entry) => entry.sourcePhase === "phase2");

  const genericPhase2Db = combatContext.modifierBuckets.situationDb.find(
    (entry) =>
      entry.sourceActionId === "double_attack" &&
      entry.sourcePhase === "phase2" &&
      isAttackPhaseDefensivePenaltyModifier(entry),
  );

  return scenarioParticipantCombatContextSchema.parse({
    ...combatContext,
    modifierBuckets: {
      ...combatContext.modifierBuckets,
      situationDb: [
        ...combatContext.modifierBuckets.situationDb.filter(
          (entry) =>
            entry.id !== DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID &&
            !(
              entry.sourceActionId === "double_attack" &&
              entry.sourcePhase === "phase2" &&
              isAttackPhaseDefensivePenaltyModifier(entry)
            ),
        ),
        ...(genericPhase2Db
          ? [
              {
                ...genericPhase2Db,
                notes: "committed weapon attack: DB/Parry -4% in phase2",
                sourceRule: `${ATTACK_PHASE_DEFENSIVE_PENALTY_SOURCE_RULE}:ordinary_committed_attack`,
                value: -4,
              },
            ]
          : phase2Db
            ? [phase2Db]
            : []),
      ],
      situationObSkill: [
        ...combatContext.modifierBuckets.situationObSkill.filter(
          (entry) => entry.id !== DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
        ),
        ...(phase2Ob ? [phase2Ob] : []),
      ],
    },
  });
}

export function buildAdjustRangeAttackGeneratedDbParryModifiers(input?: {
  currentDistance?: number;
  requestedDistance?: number;
  roundNumber?: number;
}): ScenarioCombatModifierEntry[] {
  if (
    input?.currentDistance === undefined ||
    input.requestedDistance === undefined ||
    input.requestedDistance >= input.currentDistance
  ) {
    return [];
  }
  return [
    {
      application: "percentage",
      durationRounds: 1,
      ...(input.roundNumber ? { expiresAtRound: input.roundNumber } : {}),
      generated: true,
      id: ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
      notes: "adjust range",
      scope: "until",
      sourceActionId: "adjust_range_attack",
      sourcePhase: "phase1",
      sourceRule: ADJUST_RANGE_PHASE1_DB_PARRY_SOURCE_RULE,
      value: -2,
    },
  ];
}

export function expireAdjustDistanceAttackGeneratedModifiersBeforeRound(
  combatContext: ScenarioParticipantCombatContext | undefined,
  roundNumber: number,
): ScenarioParticipantCombatContext {
  const context = scenarioParticipantCombatContextSchema.parse(combatContext ?? {});
  return scenarioParticipantCombatContextSchema.parse({
    ...context,
    modifierBuckets: {
      ...context.modifierBuckets,
      situationDb: context.modifierBuckets.situationDb.filter(
        (entry) =>
          !isAdjustRangeAttackGeneratedDbParryModifier(entry) ||
          entry.expiresAtRound === undefined ||
          entry.expiresAtRound >= roundNumber,
      ),
    },
  });
}

export function applyCombatActionGeneratedModifiers(input: {
  actionId?: string;
  attackPhaseDefensivePenalties?: readonly CombatAttackPhaseDefensivePenalty[];
  combatContext: ScenarioParticipantCombatContext;
  /**
   * Phases of the current round whose GM modifier review is already committed. Option B of #901:
   * generation does not run over the attack-phase defensive-penalty rows of such a phase again.
   * `getCombatRoundCommittedModifierReviewPhases` derives it from the round state.
   */
  committedModifierReviewPhases?: readonly ("phase1" | "phase2")[];
  distanceModifiers?: readonly CombatActionGeneratedDistanceModifierInput[];
  initiativeModifiers?: readonly ScenarioCombatModifierEntry[];
  parryModifier?: { dodgeSkillValue: number; percentageModifier: number };
  adjustDistance?: { currentDistance: number; requestedDistance: number; roundNumber?: number };
  sourceEncounterId?: string;
  sourceRoundNumber?: number;
  lifecycleContext?: CanonicalCombatModifierCompatibilityContext & {
    ownerParticipantId: string;
  };
}): ScenarioParticipantCombatContext {
  // Option B of #901 (ruling, comment 20229): after the GM commits the review for a phase, the
  // engine stops rebuilding that phase's attack-phase defensive-penalty rows. Both halves are
  // needed, because the pass is a drop followed by a rebuild and either half alone discards the
  // GM's decision: an edited row that survives the drop would be replaced by a regenerated one at
  // -4, and a removed row that is not regenerated would still be dropped and re-added. So a
  // reviewed phase keeps whatever rows it has and contributes no generated ones.
  const reviewedPhases = new Set(input.committedModifierReviewPhases ?? []);
  const situationDbWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationDb.filter((entry) => {
      if (isAttackPhaseDefensivePenaltyModifier(entry)) {
        if (entry.sourcePhase !== undefined && reviewedPhases.has(entry.sourcePhase)) return true;
        return input.attackPhaseDefensivePenalties === undefined;
      }
      return !isCombatActionGeneratedDbParryModifier(entry);
    });
  const situationObSkillWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationObSkill.filter(
      (entry) => !isCombatActionGeneratedObSkillModifier(entry),
    );
  const situationInitiativeWithoutGeneratedActionModifiers =
    input.combatContext.modifierBuckets.situationInitiative.filter(
      (entry) => !isCombatActionGeneratedInitiativeModifier(entry),
    );
  const generatedAttackPhaseDefensivePenaltyModifiers = (input.attackPhaseDefensivePenalties ?? [])
    .filter((penalty) => !reviewedPhases.has(penalty.phase))
    .map(buildAttackPhaseDefensivePenaltyModifier)
    .filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));
  const generatedDbParryModifiers =
    input.actionId === "adjust_range_attack"
      ? buildAdjustRangeAttackGeneratedDbParryModifiers(input.adjustDistance)
      : input.actionId === "offensive_parry"
        ? [
            buildOffensiveParryGeneratedDbModifier({
              roundNumber: input.sourceRoundNumber,
            }),
          ]
        : input.actionId === "parry" && input.parryModifier
          ? [
              buildParryGeneratedPercentageModifier({
                ...input.parryModifier,
                roundNumber: input.sourceRoundNumber,
              }),
            ]
          : [];
  const generatedObSkillModifiers =
    input.actionId === "double_attack" ? buildDoubleAttackGeneratedObSkillModifiers() : [];
  const generatedDistanceObSkillModifiers = (input.distanceModifiers ?? [])
    .map((modifierInput) =>
      buildDistanceGeneratedObSkillModifier({
        ...modifierInput,
        sourceActionId: modifierInput.sourceActionId ?? input.actionId,
      }),
    )
    .filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));
  const withSourceProvenance = (
    bucket: "situation_db" | "situation_initiative" | "situation_ob_skill",
    entry: ScenarioCombatModifierEntry,
  ): ScenarioCombatModifierEntry => {
    const sourced = scenarioCombatModifierEntrySchema.parse({
      ...entry,
      sourceEncounterId: input.sourceEncounterId ?? entry.sourceEncounterId,
      sourceRoundNumber: input.sourceRoundNumber ?? entry.sourceRoundNumber,
    });
    return input.lifecycleContext
      ? scenarioCombatModifierEntrySchema.parse(
          attachCanonicalLifecycleToModifierBucketRow({
            bucket,
            context: input.lifecycleContext,
            entry: sourced,
            ownerParticipantId: input.lifecycleContext.ownerParticipantId,
          }),
        )
      : sourced;
  };

  return {
    ...input.combatContext,
    modifierBuckets: {
      ...input.combatContext.modifierBuckets,
      // The stored key remains situationDb for backward compatibility, while the
      // product-facing bucket is now DB/Parry.
      situationDb: [
        ...situationDbWithoutGeneratedActionModifiers,
        ...generatedAttackPhaseDefensivePenaltyModifiers.map((entry) =>
          withSourceProvenance("situation_db", entry),
        ),
        ...generatedDbParryModifiers.map((entry) => withSourceProvenance("situation_db", entry)),
      ],
      situationInitiative: [
        ...situationInitiativeWithoutGeneratedActionModifiers,
        ...(input.initiativeModifiers ?? []).map((entry) =>
          withSourceProvenance("situation_initiative", entry),
        ),
      ],
      situationObSkill: [
        ...situationObSkillWithoutGeneratedActionModifiers,
        ...generatedObSkillModifiers.map((entry) =>
          withSourceProvenance("situation_ob_skill", entry),
        ),
        ...generatedDistanceObSkillModifiers.map((entry) =>
          withSourceProvenance("situation_ob_skill", entry),
        ),
      ],
    },
  };
}
