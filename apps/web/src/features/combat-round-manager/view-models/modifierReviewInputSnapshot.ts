import type { ScenarioParticipantCombatContext } from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history";

export interface CombatModifierReviewInputSnapshot {
  readonly combatContext: ScenarioParticipantCombatContext;
  readonly encounterRevision: string;
  readonly expectedParticipantRevision: string;
  readonly key: string;
  readonly participantId: string;
  readonly taskId: string;
}
export function buildCombatModifierReviewInputSnapshotKey(input: {
  readonly descriptor?: CurrentActionCommandDescriptor;
  readonly participantId?: string;
}): string | undefined {
  const descriptor = input.descriptor;
  if (
    !descriptor ||
    !input.participantId ||
    descriptor.participantId == null ||
    descriptor.participantId.length === 0 ||
    (descriptor.commandType !== "review_modifiers_phase1" &&
      descriptor.commandType !== "review_modifiers_phase2")
  ) {
    return undefined;
  }

  return [
    descriptor.encounterId,
    descriptor.expectedRevision,
    descriptor.taskId,
    descriptor.participantId,
    input.participantId,
  ].join(":");
}

/**
 * Retains the exact canonical participant revision and generated review input that were visible
 * when one modifier-review task opened. Presentation rebuilds and local draft edits cannot replace
 * it; a new canonical task/revision receives a new snapshot.
 */
export function getOrCreateCombatModifierReviewInputSnapshot(input: {
  readonly combatContext: ScenarioParticipantCombatContext;
  readonly descriptor?: CurrentActionCommandDescriptor;
  readonly expectedParticipantRevision?: string;
  readonly participantId?: string;
  readonly snapshots: Map<string, CombatModifierReviewInputSnapshot>;
}): CombatModifierReviewInputSnapshot | undefined {
  const key = buildCombatModifierReviewInputSnapshotKey(input);
  if (!key || !input.descriptor || !input.participantId || !input.expectedParticipantRevision) {
    return undefined;
  }

  const existing = input.snapshots.get(key);
  if (existing) return existing;

  const snapshot = Object.freeze({
    combatContext: input.combatContext,
    encounterRevision: input.descriptor.expectedRevision,
    expectedParticipantRevision: input.expectedParticipantRevision,
    key,
    participantId: input.participantId,
    taskId: input.descriptor.taskId,
  });
  input.snapshots.set(key, snapshot);
  return snapshot;
}
