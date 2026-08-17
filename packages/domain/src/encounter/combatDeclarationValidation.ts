import type { CombatRoundPhaseContexts } from "./combatRoundManager";
import type { ScenarioParticipantSecondaryActionContext } from "../campaign/scenario";
import {
  getCombatDeclarationRequiredContexts,
  validateCombatDeclarationCompatibility,
} from "./combatDeclarationCompatibility";
import { getCombatDistanceParticipantAliases } from "./combatDistance";

export type CombatDeclarationPhaseKey = "phase1" | "phase2";

export interface CombatDeclarationTargetValidationResult {
  missingPhases: CombatDeclarationPhaseKey[];
  message?: string;
  valid: boolean;
}

export interface CombatDeclarationParticipantIdentity {
  characterId?: string;
  id?: string;
  participantId?: string;
  scenarioParticipantId?: string;
}

function getCanonicalCombatDeclarationParticipantId(
  participant: CombatDeclarationParticipantIdentity,
): string | undefined {
  return participant.participantId ?? participant.id;
}

/**
 * Resolves a declaration participant alias without allowing an earlier secondary alias to shadow
 * an exact canonical participant id. Legacy aliases remain supported, but ambiguous aliases fail
 * closed instead of silently selecting one participant.
 */
export function resolveCombatDeclarationParticipantIdentity<
  TParticipant extends CombatDeclarationParticipantIdentity,
>(input: {
  participantId?: string;
  participants: readonly TParticipant[];
}): { canonicalParticipantId: string; participant: TParticipant } | undefined {
  const participantId = input.participantId?.trim();
  if (!participantId) return undefined;

  const exactMatches = input.participants.filter(
    (participant) => getCanonicalCombatDeclarationParticipantId(participant) === participantId,
  );
  if (exactMatches.length === 1) {
    return { canonicalParticipantId: participantId, participant: exactMatches[0]! };
  }
  if (exactMatches.length > 1) return undefined;

  const aliasMatches = input.participants.filter((participant) =>
    getCombatDistanceParticipantAliases(participant).includes(participantId),
  );
  const canonicalMatches = new Map(
    aliasMatches.flatMap((participant) => {
      const canonicalParticipantId = getCanonicalCombatDeclarationParticipantId(participant);
      return canonicalParticipantId ? [[canonicalParticipantId, participant] as const] : [];
    }),
  );
  if (canonicalMatches.size !== 1) return undefined;

  const [canonicalParticipantId, participant] = [...canonicalMatches.entries()][0]!;
  return { canonicalParticipantId, participant };
}

export function canonicalizeCombatObserveTargetContext(input: {
  participants: readonly CombatDeclarationParticipantIdentity[];
  secondaryActionContext?: ScenarioParticipantSecondaryActionContext;
}): ScenarioParticipantSecondaryActionContext | undefined {
  const context = input.secondaryActionContext;
  if (!context || context.action !== "observe_opponent") return context;
  const target = resolveCombatDeclarationParticipantIdentity({
    participantId: context.targetParticipantId,
    participants: input.participants,
  });

  return target
    ? { action: "observe_opponent", targetParticipantId: target.canonicalParticipantId }
    : undefined;
}

export const COMBAT_DECLARATION_ACTION_LABELS: Record<string, string> = {
  adjust_range_attack: "Adjust Range - Attack",
  attack_parry: "Single attack",
  counterattack: "Counterattack",
  disarm: "Disarm",
  double_attack: "Double Attack",
  feint_attack: "Feint - Attack",
  move_only: "Move only",
  observe_opponent: "Observe Opponent",
  offensive_parry: "Offensive Parry",
  other: "Other",
  parry: "Parry",
  parry_attack: "Reactive attack",
  parry_disarm: "Parry - Disarm",
  break_off_engagement: "Break Off Engagement",
};

export function getCombatDeclarationActionLabel(actionId?: string): string {
  return actionId ? (COMBAT_DECLARATION_ACTION_LABELS[actionId] ?? actionId) : "Open";
}

export function getCombatDeclarationAttackPhases(input: {
  actionId?: string;
  secondaryActionId?: string;
}): CombatDeclarationPhaseKey[] {
  switch (input.actionId) {
    case "attack_parry":
      return ["phase1"];
    case "parry_attack":
      return ["phase2"];
    case "double_attack":
      return ["phase1", "phase2"];
    case "feint_attack":
      return ["phase2"];
    case "adjust_range_attack":
      return ["phase2"];
    default:
      return [];
  }
}

function formatMissingTargetMessage(
  missingPhases: CombatDeclarationPhaseKey[],
): string | undefined {
  if (missingPhases.length === 0) {
    return undefined;
  }

  if (missingPhases.length === 1) {
    return `Select a target for ${missingPhases[0] === "phase1" ? "Phase 1" : "Phase 2"}.`;
  }

  return "Select targets for Phase 1 and Phase 2.";
}

export function validateCombatDeclarationTargets(input: {
  actingParticipantId?: string;
  actionId?: string;
  movementKind?: string;
  participantIdentities?: readonly CombatDeclarationParticipantIdentity[];
  phaseContexts?: CombatRoundPhaseContexts;
  secondaryActionContext?: ScenarioParticipantSecondaryActionContext;
  selectedOpponentId?: string;
  secondaryActionId?: string;
}): CombatDeclarationTargetValidationResult {
  const attackPhases = getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  });
  const missingPhases = attackPhases.filter((phaseKey) => {
    const targetParticipantId = input.phaseContexts?.[phaseKey]?.targetParticipantId;
    return !targetParticipantId || targetParticipantId.trim().length === 0;
  });
  if (
    input.actionId === "feint_attack" &&
    !input.phaseContexts?.phase1?.targetParticipantId &&
    !missingPhases.includes("phase1")
  ) {
    missingPhases.unshift("phase1");
  }
  const doubleAttackTargetsDiffer =
    input.actionId === "double_attack" &&
    Boolean(input.phaseContexts?.phase1?.targetParticipantId) &&
    Boolean(input.phaseContexts?.phase2?.targetParticipantId) &&
    input.phaseContexts?.phase1?.targetParticipantId !==
      input.phaseContexts?.phase2?.targetParticipantId;
  const feintTargetDiffers =
    input.actionId === "feint_attack" &&
    Boolean(input.phaseContexts?.phase1?.targetParticipantId) &&
    Boolean(input.phaseContexts?.phase2?.targetParticipantId) &&
    input.phaseContexts?.phase1?.targetParticipantId !==
      input.phaseContexts?.phase2?.targetParticipantId;
  const offensiveParryOpponentMissing =
    input.actionId === "offensive_parry" &&
    (!input.selectedOpponentId || input.selectedOpponentId.trim().length === 0);
  const compatibility = validateCombatDeclarationCompatibility({
    movementKind: input.movementKind,
    primaryAction: input.actionId,
    secondaryAction: input.secondaryActionId,
  });
  const requiredContexts = getCombatDeclarationRequiredContexts({
    primaryAction: input.actionId,
    secondaryAction: input.secondaryActionId,
  });
  const observeTargetMissing =
    requiredContexts.includes("secondary_target_participant") &&
    (!input.secondaryActionContext ||
      input.secondaryActionContext.action !== "observe_opponent" ||
      input.secondaryActionContext.targetParticipantId.trim().length === 0);
  const secondaryContextMismatch =
    Boolean(input.secondaryActionContext) &&
    input.secondaryActionContext?.action !== input.secondaryActionId;
  const resolvedObserveActor = input.participantIdentities
    ? resolveCombatDeclarationParticipantIdentity({
        participantId: input.actingParticipantId,
        participants: input.participantIdentities,
      })
    : undefined;
  const resolvedObserveTarget = input.participantIdentities
    ? resolveCombatDeclarationParticipantIdentity({
        participantId: input.secondaryActionContext?.targetParticipantId,
        participants: input.participantIdentities,
      })
    : undefined;
  const observeTargetUnavailable =
    input.secondaryActionId === "observe_opponent" &&
    Boolean(input.secondaryActionContext?.targetParticipantId) &&
    Boolean(input.participantIdentities) &&
    !resolvedObserveTarget;
  const observeTargetsSelf =
    input.secondaryActionId === "observe_opponent" &&
    Boolean(input.actingParticipantId) &&
    (resolvedObserveActor && resolvedObserveTarget
      ? resolvedObserveActor.canonicalParticipantId === resolvedObserveTarget.canonicalParticipantId
      : input.secondaryActionContext?.targetParticipantId === input.actingParticipantId);

  return {
    missingPhases,
    message: !compatibility.valid
      ? compatibility.message
      : observeTargetMissing
        ? "Select an opponent to observe."
        : secondaryContextMismatch
          ? "The secondary action context does not match the selected secondary action."
          : observeTargetUnavailable
            ? "Select an active opponent to observe."
            : observeTargetsSelf
              ? "Observe Opponent cannot target the acting participant."
              : offensiveParryOpponentMissing
                ? "Select an opponent to counter with Offensive Parry."
                : doubleAttackTargetsDiffer
                  ? "Double Attack must target the same opponent in both phases."
                  : feintTargetDiffers
                    ? "Feint and attack must target the same opponent."
                    : formatMissingTargetMessage(missingPhases),
    valid:
      missingPhases.length === 0 &&
      !doubleAttackTargetsDiffer &&
      !feintTargetDiffers &&
      !offensiveParryOpponentMissing &&
      compatibility.valid &&
      !observeTargetMissing &&
      !secondaryContextMismatch &&
      !observeTargetUnavailable &&
      !observeTargetsSelf,
  };
}
