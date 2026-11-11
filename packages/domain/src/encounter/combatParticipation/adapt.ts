import type { ScenarioParticipant } from "../../campaign/scenario";
import { scenarioParticipantCombatContextSchema } from "../../campaign/scenario";
import { projectCanonicalCombatModifierReviewInput } from "../combatModifierReviewProjection";
import { activeCombatRoundStateSchema, safeParseCombatRoundState } from "../combatRoundManager";
import { projectCombatParticipation } from "./project";
import type {
  CombatParticipationProjection,
  CombatParticipationProxyAuthoritySource,
} from "./types";

/**
 * Builds the one active-revision participation matrix from already-loaded canonical encounter and
 * participant facts. Archived rounds and presentation rows are outside this adapter by design.
 */
export function projectActiveCombatParticipation(input: {
  readonly encounterRevision: string;
  readonly proxyAuthorities?: readonly CombatParticipationProxyAuthoritySource[];
  readonly scenarioParticipants: readonly ScenarioParticipant[];
  readonly state: Parameters<typeof activeCombatRoundStateSchema.parse>[0];
}): CombatParticipationProjection {
  const fullState = safeParseCombatRoundState(input.state);
  const state = fullState.success
    ? activeCombatRoundStateSchema.parse(
        Object.fromEntries(Object.entries(fullState.data).filter(([key]) => key !== "rounds")),
      )
    : activeCombatRoundStateSchema.parse(input.state);
  if (!state.encounterId) {
    throw new Error("Active combat participation requires an encounter identity.");
  }
  const encounterId = state.encounterId;
  const scenarioParticipantById = new Map(
    input.scenarioParticipants.map((participant) => [participant.id, participant]),
  );
  const canonicalCutoff =
    state.events.reduce((maximum, event) => Math.max(maximum, event.sequence), -1) + 1;
  const modifierReviewSources = state.participants.flatMap((participant) => {
    const scenarioParticipantId = participant.scenarioParticipantId;
    const scenarioParticipant = scenarioParticipantId
      ? scenarioParticipantById.get(scenarioParticipantId)
      : undefined;
    if (!scenarioParticipant) return [];
    const durableParticipantId = scenarioParticipant.id;
    const currentContext = scenarioParticipantCombatContextSchema.parse(
      participant.declaration?.combatContext ?? scenarioParticipant.state.combat.combatContext,
    );
    const hasIncompleteLegacyModifierFacts =
      scenarioParticipant.state.combatEffects === undefined ||
      scenarioParticipant.state.combatEffects.effects.some(
        (effect) => !effect.canonicalLifecycle,
      ) ||
      Object.values(currentContext.modifierBuckets).some((rows) =>
        rows.some((row) => !row.canonicalLifecycle),
      );
    if (hasIncompleteLegacyModifierFacts) return [];
    return (["M1", "M2"] as const).map((phase) => ({
      participantId: participant.participantId,
      phase,
      review: projectCanonicalCombatModifierReviewInput({
        canonicalCutoff,
        commandId: `combat-participation:${input.encounterRevision}:${participant.participantId}:${phase}`,
        createdAt: input.encounterRevision,
        currentContext,
        draftContext: currentContext,
        encounterId,
        participantState: scenarioParticipant.state,
        phase,
        revision: input.encounterRevision,
        roundNumber: state.roundNumber,
        scenarioParticipantId: durableParticipantId,
      }),
    }));
  });

  return projectCombatParticipation({
    encounterRevision: input.encounterRevision,
    modifierReviewSources,
    participantAuthorities: state.participants.map((participant) => {
      const scenarioParticipant = participant.scenarioParticipantId
        ? scenarioParticipantById.get(participant.scenarioParticipantId)
        : undefined;
      return {
        authority: scenarioParticipant?.controlledByUserId ? "player" : "gm",
        participantId: participant.participantId,
        playerUserId: scenarioParticipant?.controlledByUserId,
      };
    }),
    proxyAuthorities: input.proxyAuthorities,
    state,
  });
}
