import type { CombatRoundPhase } from "../combatRoundManager";
import type {
  CombatParticipationFact,
  CombatParticipationProcessFamily,
  CombatParticipationProjection,
} from "./types";

/** Bounded participant/process lookup over one already-built active-round matrix. */
export function projectParticipantProcessParticipation(input: {
  readonly participantId: string;
  readonly phase?: CombatRoundPhase;
  readonly processFamily: CombatParticipationProcessFamily;
  readonly projection: CombatParticipationProjection;
}): readonly CombatParticipationFact[] {
  return input.projection.facts.filter(
    (fact) =>
      fact.identity.participantId === input.participantId &&
      fact.identity.processFamily === input.processFamily &&
      (input.phase === undefined || fact.identity.phase === input.phase),
  );
}

/** Bounded initiative lookup; it never rebuilds action plans or initiative groups. */
export function projectPhaseInitiativeParticipation(input: {
  readonly phase: CombatRoundPhase;
  readonly projection: CombatParticipationProjection;
}): readonly CombatParticipationFact[] {
  return input.projection.facts.filter(
    (fact) => fact.identity.processFamily === "initiative" && fact.identity.phase === input.phase,
  );
}

const SU_PROCESS_FAMILIES = new Set<CombatParticipationProcessFamily>([
  "continued_contact",
  "distance_control",
  "effect_review",
  "health_bleed",
  "observation",
  "participant_completion",
]);

/** Bounded SU lookup for one participant over the canonical active-round matrix. */
export function projectSuParticipation(input: {
  readonly participantId: string;
  readonly projection: CombatParticipationProjection;
}): readonly CombatParticipationFact[] {
  return input.projection.facts.filter(
    (fact) =>
      fact.identity.participantId === input.participantId &&
      SU_PROCESS_FAMILIES.has(fact.identity.processFamily),
  );
}
