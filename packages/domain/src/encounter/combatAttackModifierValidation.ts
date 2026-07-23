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
  type CombatModifierResolution,
} from "./combatModifierContributions";
import { buildLiveCombatModifierContributionProjection } from "./combatModifierProjection";
import {
  getCombatRoundPhaseActionStepForPhase,
  type CombatRoundAttackOpportunity,
  type CombatRoundPhase,
  type CombatRoundState,
} from "./combatRoundManager";

export interface CanonicalCombatAttackModifierFacts {
  attackerActionId: string;
  attackerCombatContext: ScenarioParticipantCombatContext;
  attackerProposalId?: string;
  attackerResolution: CombatModifierResolution;
  declaredOpportunity?: CombatRoundAttackOpportunity;
  defenderResolution: CombatModifierResolution;
  pairKey: string;
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

export function fingerprintCombatModifierResolution(resolution: CombatModifierResolution): string {
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
  const attackerContributions = buildLiveCombatModifierContributionProjection({
    combatContext: attackerCombatContext,
    combatEffects: input.attackerScenarioParticipant.state.combatEffects,
    currentRound: input.state.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.attackerScenarioParticipant.id,
  }).contributions;
  const defenderContributions = buildLiveCombatModifierContributionProjection({
    combatContext: defenderCombatContext,
    combatEffects: input.defenderScenarioParticipant.state.combatEffects,
    currentRound: input.state.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.defenderScenarioParticipant.id,
  }).contributions;
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
    step,
  } as const;

  return {
    attackerActionId,
    attackerCombatContext,
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
