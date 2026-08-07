import {
  scenarioParticipantCombatContextSchema,
  type ScenarioParticipant,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";
import {
  combineCombatModifierResolutions,
  createCombatParticipantPairKey,
  resolveCombatWideGeneralModifiers,
  resolveCombatModifierContributions,
  type CombatModifierContribution,
  type CombatModifierResolution,
} from "./combatModifierContributions";
import {
  buildLiveCombatFlatDbModifierContributions,
  buildLiveCombatModifierContributionProjection,
} from "./combatModifierProjection";
import { buildCombatObservationModifierContributions } from "./combatObservation";
import {
  getCombatRoundCurrentInitiativeExecutionGroup,
  getCombatRoundNextEventSequence,
  getCombatRoundPhaseActionStepForPhase,
  getCombatRoundParryReviewStepForPhase,
  type CombatRoundAttackOpportunity,
  type CombatRoundAttackRollResult,
  type CombatRoundPhase,
  type CombatRoundState,
} from "./combatRoundManager";

export interface CanonicalCombatAttackModifierFacts {
  attackerActionId: string;
  attackerCombatContext: ScenarioParticipantCombatContext;
  attackerOpponentResolution: CombatModifierResolution;
  attackerProposalId?: string;
  attackerResolution: CombatModifierResolution;
  declaredOpportunity?: CombatRoundAttackOpportunity;
  defenderCombatContext: ScenarioParticipantCombatContext;
  defenderFlatResolution: CombatModifierResolution;
  defenderResolution: CombatModifierResolution;
  pairKey: string;
}

export interface CanonicalCombatParryModifierFacts {
  attackOpportunity?: CombatRoundAttackOpportunity;
  attackResultModifier: number;
  defenderCombatContext: ScenarioParticipantCombatContext;
  defenderResolution: CombatModifierResolution;
  pairKey?: string;
}

function findRoundParticipant(input: {
  combatantId: string;
  scenarioParticipant: ScenarioParticipant;
  state: CombatRoundState;
}) {
  const aliases = new Set(
    [input.combatantId, input.scenarioParticipant.id, input.scenarioParticipant.characterId].filter(
      (id): id is string => Boolean(id),
    ),
  );
  return input.state.participants.find((participant) =>
    [participant.participantId, participant.scenarioParticipantId, participant.characterId].some(
      (id) => id !== undefined && aliases.has(id),
    ),
  );
}

export function fingerprintCombatModifierResolution<
  TRow extends Pick<CombatModifierContribution, "id" | "value">,
>(resolution: {
  bucket?: CombatModifierResolution["bucket"];
  rows: readonly TRow[];
  total?: number;
}): string {
  const serialized = JSON.stringify(
    resolution.rows
      .map((row) => ({ id: row.id, value: row.value }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** Resolves both sides of one attack from one canonical participant/pair/opportunity context. */
export function resolveCanonicalCombatAttackModifierFacts(input: {
  attackerCombatantId: string;
  attackerScenarioParticipant: ScenarioParticipant;
  defenderCombatantId: string;
  defenderScenarioParticipant: ScenarioParticipant;
  encounterId: string;
  opportunityId?: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CanonicalCombatAttackModifierFacts {
  const attackerRoundParticipant = findRoundParticipant({
    combatantId: input.attackerCombatantId,
    scenarioParticipant: input.attackerScenarioParticipant,
    state: input.state,
  });
  const defenderRoundParticipant = findRoundParticipant({
    combatantId: input.defenderCombatantId,
    scenarioParticipant: input.defenderScenarioParticipant,
    state: input.state,
  });
  const declaredOpportunity = attackerRoundParticipant?.declaration?.attackOpportunities?.find(
    (opportunity) =>
      opportunity.phase === input.phase &&
      opportunity.status === "committed" &&
      (input.opportunityId === undefined || opportunity.id === input.opportunityId),
  );
  const attackerActionId =
    attackerRoundParticipant?.declaration?.actionId ?? `${input.phase}_attack`;
  const attackerProposalId =
    attackerActionId === "feint_attack"
      ? input.state.feintProposals.find(
          (proposal) =>
            proposal.roundNumber === input.state.roundNumber &&
            proposal.status === "committed" &&
            proposal.attackerParticipantId === input.attackerCombatantId &&
            proposal.defenderParticipantId === input.defenderCombatantId,
        )?.id
      : attackerActionId === "adjust_range_attack"
        ? input.state.adjustDistanceProposals.find(
            (proposal) =>
              proposal.roundNumber === input.state.roundNumber &&
              proposal.status === "committed" &&
              proposal.attackerParticipantId === input.attackerCombatantId &&
              proposal.defenderParticipantId === input.defenderCombatantId,
          )?.id
        : undefined;
  const defenderFeintProposalId = input.state.feintProposals.find(
    (proposal) =>
      proposal.roundNumber === input.state.roundNumber &&
      proposal.status === "committed" &&
      proposal.attackerParticipantId === input.attackerCombatantId &&
      proposal.defenderParticipantId === input.defenderCombatantId,
  )?.id;
  const pairKey = createCombatParticipantPairKey(
    input.attackerScenarioParticipant.id,
    input.defenderScenarioParticipant.id,
  );
  const step = getCombatRoundPhaseActionStepForPhase(input.phase);
  const attackerCombatContext = scenarioParticipantCombatContextSchema.parse(
    input.attackerScenarioParticipant.state.combat.combatContext ?? {},
  );
  const defenderCombatContext = scenarioParticipantCombatContextSchema.parse(
    input.defenderScenarioParticipant.state.combat.combatContext ?? {},
  );
  const currentInitiativeGroupId = getCombatRoundCurrentInitiativeExecutionGroup({
    phase: input.phase,
    state: input.state,
  })?.id;
  const calculationSequence = getCombatRoundNextEventSequence(input.state);
  const attackerObservationContributions = buildCombatObservationModifierContributions({
    encounterId: input.encounterId,
    observerCombatantId: input.attackerCombatantId,
    observerParticipantId: input.attackerScenarioParticipant.id,
    opponentCombatantId: input.defenderCombatantId,
    opponentParticipantId: input.defenderScenarioParticipant.id,
    relationships: input.state.observationRelationships,
  });
  const attackerContributions = [
    ...buildLiveCombatModifierContributionProjection({
      combatContext: attackerCombatContext,
      combatEffects: input.attackerScenarioParticipant.state.combatEffects,
      currentInitiativeGroupId,
      currentRound: input.state.roundNumber,
      encounterId: input.encounterId,
      ownerParticipantId: input.attackerScenarioParticipant.id,
    }).contributions,
    ...attackerObservationContributions,
  ];
  const defenderContributions = [
    ...buildLiveCombatModifierContributionProjection({
      combatContext: defenderCombatContext,
      combatEffects: input.defenderScenarioParticipant.state.combatEffects,
      currentInitiativeGroupId,
      currentRound: input.state.roundNumber,
      encounterId: input.encounterId,
      ownerParticipantId: input.defenderScenarioParticipant.id,
    }).contributions,
    ...buildCombatObservationModifierContributions({
      encounterId: input.encounterId,
      observerCombatantId: input.defenderCombatantId,
      observerParticipantId: input.defenderScenarioParticipant.id,
      opponentCombatantId: input.attackerCombatantId,
      opponentParticipantId: input.attackerScenarioParticipant.id,
      relationships: input.state.observationRelationships,
    }),
  ];
  const defenderFlatContributions = buildLiveCombatFlatDbModifierContributions({
    combatContext: defenderCombatContext,
    combatEffects: input.defenderScenarioParticipant.state.combatEffects,
    currentInitiativeGroupId,
    currentRound: input.state.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.defenderScenarioParticipant.id,
  });
  const opportunityId = declaredOpportunity?.id ?? input.opportunityId;
  const attackerCalculationContext = {
    actionId: attackerActionId,
    encounterId: input.encounterId,
    opponentParticipantId: input.defenderScenarioParticipant.id,
    opportunityId,
    ownerParticipantId: input.attackerScenarioParticipant.id,
    pairKey,
    phase: input.phase,
    proposalId: attackerProposalId,
    rollType: "attack",
    roundNumber: input.state.roundNumber,
    initiativeSequence: calculationSequence,
    simultaneousGroupId: currentInitiativeGroupId,
    step,
  } as const;
  const defenderCalculationContext = {
    actionId: defenderRoundParticipant?.declaration?.actionId,
    encounterId: input.encounterId,
    opponentParticipantId: input.attackerScenarioParticipant.id,
    opportunityId,
    ownerParticipantId: input.defenderScenarioParticipant.id,
    pairKey,
    phase: input.phase,
    proposalId: defenderFeintProposalId,
    rollType: "db",
    roundNumber: input.state.roundNumber,
    initiativeSequence: calculationSequence,
    simultaneousGroupId: currentInitiativeGroupId,
    step,
  } as const;

  return {
    attackerActionId,
    attackerCombatContext,
    attackerOpponentResolution: resolveCombatModifierContributions({
      bucket: "skill_ob",
      context: attackerCalculationContext,
      contributions: attackerObservationContributions,
    }),
    attackerProposalId,
    attackerResolution: combineCombatModifierResolutions({
      additional: resolveCombatWideGeneralModifiers({
        context: attackerCalculationContext,
        contributions: attackerContributions,
      }),
      primary: resolveCombatModifierContributions({
        bucket: "skill_ob",
        context: attackerCalculationContext,
        contributions: attackerContributions,
      }),
    }),
    declaredOpportunity,
    defenderCombatContext,
    defenderFlatResolution: resolveCombatModifierContributions({
      bucket: "db_parry",
      context: defenderCalculationContext,
      contributions: defenderFlatContributions,
    }),
    defenderResolution: combineCombatModifierResolutions({
      additional: resolveCombatWideGeneralModifiers({
        context: defenderCalculationContext,
        contributions: defenderContributions,
      }),
      primary: resolveCombatModifierContributions({
        bucket: "db_parry",
        context: defenderCalculationContext,
        contributions: defenderContributions,
      }),
    }),
    pairKey,
  };
}

/** Resolves one parry from the exact live effect and opportunity context used by the API. */
export function resolveCanonicalCombatParryModifierFacts(input: {
  attackerScenarioParticipant?: ScenarioParticipant;
  attackResult: CombatRoundAttackRollResult;
  defenderCombatantId: string;
  defenderScenarioParticipant: ScenarioParticipant;
  encounterId: string;
  state: CombatRoundState;
}): CanonicalCombatParryModifierFacts {
  const defenderRoundParticipant = findRoundParticipant({
    combatantId: input.defenderCombatantId,
    scenarioParticipant: input.defenderScenarioParticipant,
    state: input.state,
  });
  const attackerRoundParticipant = input.attackerScenarioParticipant
    ? findRoundParticipant({
        combatantId: input.attackResult.attackerParticipantId,
        scenarioParticipant: input.attackerScenarioParticipant,
        state: input.state,
      })
    : input.state.participants.find(
        (participant) =>
          participant.participantId === input.attackResult.attackerParticipantId,
      );
  const attackOpportunity = attackerRoundParticipant?.declaration?.attackOpportunities?.find(
    (opportunity) => opportunity.id === input.attackResult.attackOpportunityId,
  );
  const defenderFeintProposal = input.state.feintProposals.find(
    (proposal) =>
      proposal.roundNumber === input.state.roundNumber &&
      proposal.status === "committed" &&
      proposal.attackerParticipantId === input.attackResult.attackerParticipantId &&
      proposal.defenderParticipantId === input.defenderCombatantId,
  );
  const defenderCombatContext = scenarioParticipantCombatContextSchema.parse(
    input.defenderScenarioParticipant.state.combat.combatContext ?? {},
  );
  const contributions = [
    ...buildLiveCombatModifierContributionProjection({
      combatContext: defenderCombatContext,
      combatEffects: input.defenderScenarioParticipant.state.combatEffects,
      currentInitiativeGroupId: getCombatRoundCurrentInitiativeExecutionGroup({
        phase: input.attackResult.phase,
        state: input.state,
      })?.id,
      currentRound: input.state.roundNumber,
      encounterId: input.encounterId,
      ownerParticipantId: input.defenderScenarioParticipant.id,
    }).contributions,
    ...(input.attackerScenarioParticipant
      ? buildCombatObservationModifierContributions({
          encounterId: input.encounterId,
          observerCombatantId: input.defenderCombatantId,
          observerParticipantId: input.defenderScenarioParticipant.id,
          opponentCombatantId: input.attackResult.attackerParticipantId,
          opponentParticipantId: input.attackerScenarioParticipant.id,
          relationships: input.state.observationRelationships,
        })
      : []),
  ];
  const pairKey = input.attackerScenarioParticipant
    ? createCombatParticipantPairKey(
        input.defenderScenarioParticipant.id,
        input.attackerScenarioParticipant.id,
      )
    : undefined;
  const calculationContext = {
    actionId: defenderRoundParticipant?.declaration?.actionId,
    encounterId: input.encounterId,
    opponentParticipantId: input.attackerScenarioParticipant?.id,
    opportunityId: attackOpportunity?.id,
    ownerParticipantId: input.defenderScenarioParticipant.id,
    pairKey,
    phase: input.attackResult.phase,
    proposalId: defenderFeintProposal?.id,
    rollType: "parry",
    roundNumber: input.state.roundNumber,
    step: getCombatRoundParryReviewStepForPhase(input.attackResult.phase),
  } as const;

  return {
    attackOpportunity,
    attackResultModifier: input.attackResult.defenderParryModifier,
    defenderCombatContext,
    defenderResolution: combineCombatModifierResolutions({
      additional: resolveCombatWideGeneralModifiers({
        context: calculationContext,
        contributions,
      }),
      primary: resolveCombatModifierContributions({
        bucket: "db_parry",
        context: calculationContext,
        contributions,
      }),
    }),
    pairKey,
  };
}
