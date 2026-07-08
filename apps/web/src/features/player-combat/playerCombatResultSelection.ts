import type { CombatRoundAttackRollResult } from "@glantri/domain";

type PlayerCombatAttackPhase = "phase1" | "phase2";

export interface PlayerCombatAttackResultStateLike {
  participants: readonly {
    attackResults: Partial<Record<PlayerCombatAttackPhase, CombatRoundAttackRollResult | undefined>>;
  }[];
}

export interface PlayerCombatActionResultSelectionInput<TPanel> {
  actionRoll?: TPanel | null;
  attackerPrivileged?: TPanel | null;
  combatExperience?: TPanel | null;
  currentAttack?: TPanel | null;
  currentPhaseResolution?: TPanel | null;
  distanceControl?: TPanel | null;
  healthCheck?: TPanel | null;
  involvedDamage?: TPanel | null;
  latestAttack?: TPanel | null;
  phaseInitiativeChoice?: TPanel | null;
  relevantInitiative?: TPanel | null;
}

const PLAYER_COMBAT_ATTACK_PHASES: readonly PlayerCombatAttackPhase[] = ["phase1", "phase2"];

export function getLatestRelevantPlayerCombatAttackResult(input: {
  participantId?: string;
  state?: PlayerCombatAttackResultStateLike | null;
}): CombatRoundAttackRollResult | undefined {
  if (!input.participantId || !input.state) {
    return undefined;
  }

  return input.state.participants
    .flatMap((participant) =>
      PLAYER_COMBAT_ATTACK_PHASES.map((phase) => participant.attackResults[phase]),
    )
    .filter(
      (result): result is CombatRoundAttackRollResult =>
        result !== undefined &&
        (result.attackerParticipantId === input.participantId ||
          result.defenderParticipantId === input.participantId),
    )
    .sort((left, right) => right.rolledAt.localeCompare(left.rolledAt))[0];
}

export function selectPlayerCombatActionResultPanel<TPanel>(
  input: PlayerCombatActionResultSelectionInput<TPanel>,
): TPanel | null {
  return (
    input.healthCheck ??
    input.distanceControl ??
    input.attackerPrivileged ??
    input.currentPhaseResolution ??
    input.involvedDamage ??
    input.currentAttack ??
    input.latestAttack ??
    input.phaseInitiativeChoice ??
    input.relevantInitiative ??
    input.combatExperience ??
    input.actionRoll ??
    null
  );
}
