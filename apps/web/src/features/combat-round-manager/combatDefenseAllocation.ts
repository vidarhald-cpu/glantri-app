import {
  getCombatDefenseSnapshotForAttack,
  getCombatRoundAttackResultId,
  getLatestCombatDefenseSnapshot,
  type CombatDefenseSnapshot,
  type CombatRoundAttackRollResult,
  type CombatRoundPhase,
} from "@glantri/domain";

import type {
  PlayerCombatDefenseStatsView,
  PlayerCombatParrySourceOption,
} from "@/features/player-combat/PlayerCombatPanels";

/**
 * Forgejo #874 — the GM's defensive allocation is bound to the attack under resolution (Product
 * Owner ruling of 2026-11-03, #874 comment 19806, rules 1-6; extended to Feint by comment 23356).
 *
 * Both sources are included by default. An untick applies to that one attack only, so every value
 * here is read for one exact attack: the GM's uncommitted draft while that attack's review is
 * open, and the committed defense snapshot for that attack afterwards. With no attack under
 * resolution, nothing here applies and the panel shows its default.
 */
export interface CombatDefenseHandSelection {
  usedMainHand: boolean;
  usedOffHand: boolean;
}

/**
 * The committed snapshot for the attack under resolution, never another attacker's.
 *
 * Live, an attack with no committed review yet has no snapshot, so the panel falls back to the
 * defender's own declared context rather than to an earlier attack's review. Historical inspection
 * keeps its previous reading — the latest review for this defender in the phase — when no exact
 * attack is in view, because that is the recorded content a historical card exists to show.
 */
export function selectCombatDefenseSnapshotForAttackUnderResolution(input: {
  attackUnderResolutionId?: string;
  defenderParticipantId?: string;
  historical: boolean;
  phase: CombatRoundPhase;
  roundNumber: number;
  snapshots: readonly CombatDefenseSnapshot[];
}): CombatDefenseSnapshot | undefined {
  if (input.attackUnderResolutionId) {
    const snapshot = getCombatDefenseSnapshotForAttack(
      input.snapshots,
      input.attackUnderResolutionId,
    );
    return snapshot &&
      snapshot.defenderParticipantId === input.defenderParticipantId &&
      snapshot.phase === input.phase
      ? snapshot
      : undefined;
  }
  if (!input.historical || !input.defenderParticipantId) return undefined;
  return getLatestCombatDefenseSnapshot({
    defenderParticipantId: input.defenderParticipantId,
    phase: input.phase,
    roundNumber: input.roundNumber,
    snapshots: input.snapshots,
  });
}

/** The exact identity of one incoming attack, as defense snapshots record it. */
export function getCombatDefenseAttackId(input: {
  result: CombatRoundAttackRollResult;
  roundNumber: number;
}): string {
  return getCombatRoundAttackResultId(input);
}

/** The hands a committed snapshot included, in the terms the canonical parry resolver uses. */
export function getCombatDefenseSelectionFromSnapshot(
  snapshot: CombatDefenseSnapshot,
): CombatDefenseHandSelection {
  return {
    usedMainHand: snapshot.sources.some((source) => source.slot === "mainHand" && source.included),
    usedOffHand: snapshot.sources.some((source) => source.slot === "offHand" && source.included),
  };
}

/**
 * The one derived Defense / Parry row a hand selection resolves to: both hands to the `Combined`
 * row, one hand to that hand's own row. It selects an existing derived row and computes nothing.
 */
export function selectCombatDefenseCombinationRow(input: {
  mainHandLabel?: string;
  offHandLabel?: string;
  options?: readonly PlayerCombatParrySourceOption[];
  selection: CombatDefenseHandSelection;
}): PlayerCombatParrySourceOption | undefined {
  const options = input.options ?? [];
  if (input.selection.usedMainHand && input.selection.usedOffHand) {
    return options.find((option) => option.id.startsWith("Combined|"));
  }
  if (input.selection.usedMainHand) {
    return options.find((option) => option.sourceName === input.mainHandLabel);
  }
  if (input.selection.usedOffHand) {
    return options.find((option) => option.sourceName === input.offHandLabel);
  }
  return undefined;
}

/**
 * The mini-table row in force for the attack under resolution. An `incomplete` parry stays
 * incomplete — that state records an uncommitted parry direction, which no allocation completes.
 */
export function applyCombatDefenseAllocationToStats(
  stats: PlayerCombatDefenseStatsView,
  row: PlayerCombatParrySourceOption | undefined,
): PlayerCombatDefenseStatsView {
  if (!row) return stats;
  return {
    ...stats,
    db: row.db,
    dm: row.dm,
    parry: stats.parry === "incomplete" ? "incomplete" : row.parry,
    sourceName: row.sourceName,
  };
}
