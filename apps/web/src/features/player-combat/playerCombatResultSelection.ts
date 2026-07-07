export interface PlayerCombatActionResultSelectionInput<TPanel> {
  actionRoll?: TPanel | null;
  attackerPrivileged?: TPanel | null;
  combatExperience?: TPanel | null;
  currentAttack?: TPanel | null;
  currentPhaseResolution?: TPanel | null;
  distanceControl?: TPanel | null;
  healthCheck?: TPanel | null;
  involvedDamage?: TPanel | null;
  phaseInitiativeChoice?: TPanel | null;
  relevantInitiative?: TPanel | null;
}

export function selectPlayerCombatActionResultPanel<TPanel>(
  input: PlayerCombatActionResultSelectionInput<TPanel>,
): TPanel | null {
  return (
    input.healthCheck ??
    input.distanceControl ??
    input.attackerPrivileged ??
    input.currentPhaseResolution ??
    input.currentAttack ??
    input.involvedDamage ??
    input.phaseInitiativeChoice ??
    input.relevantInitiative ??
    input.combatExperience ??
    input.actionRoll ??
    null
  );
}
