import {
  activeCombatMutationResponseSchema,
  buildActiveCombatMutationResponse,
  type CombatRoundCommandEnvelope,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

export const ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER = "x-glantri-combat-response";
export const ACTIVE_COMBAT_MUTATION_RESPONSE_VERSION = "active-v1";

type LegacyCombatMutationPayload = Record<string, unknown> & {
  commandEnvelope?: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
  participant?: ScenarioParticipant;
  participants?: ScenarioParticipant[];
};

function isLegacyCombatMutationPayload(payload: unknown): payload is LegacyCombatMutationPayload {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "encounter" in payload &&
    (payload as { encounter?: unknown }).encounter,
  );
}

export function prefersActiveCombatMutationResponse(
  header: string | string[] | undefined,
): boolean {
  return (Array.isArray(header) ? header[0] : header) === ACTIVE_COMBAT_MUTATION_RESPONSE_VERSION;
}

/**
 * Transitional adapter: legacy callers continue receiving their established payload while every
 * migrated combat client receives the compact active-state contract.
 */
export function buildRequestedCombatMutationResponse(input: {
  activeResponseRequested: boolean;
  payload: unknown;
}): unknown {
  if (!input.activeResponseRequested || !isLegacyCombatMutationPayload(input.payload)) {
    return input.payload;
  }

  const {
    command: _duplicateFullCommand,
    commandEnvelope,
    encounter,
    participant,
    participants,
    ...mutationPresentation
  } = input.payload;
  const updatedParticipants = participants ?? (participant ? [participant] : undefined);
  const compact = buildActiveCombatMutationResponse({
    commandEnvelope,
    encounter,
    mutationPresentation:
      Object.keys(mutationPresentation).length > 0 ? mutationPresentation : undefined,
    updatedParticipants,
  });

  return activeCombatMutationResponseSchema.parse(compact);
}
