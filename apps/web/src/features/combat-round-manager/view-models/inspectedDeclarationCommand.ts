import type { CombatProgressionPresentationProjection } from "@glantri/domain";
import { getCombatDistanceParticipantAliases } from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history/view-models/currentActionPresentation";

/**
 * #691 — resolves the declaration command for the participant the GM is **editing**.
 *
 * Declaration is open for every participant while the round is still in DE:
 * `isSelectedCombatRoundStepCurrentForGm` keeps it open deliberately, and recording one declaration
 * advances the row cursor only "for data-entry convenience", not as an ordering restriction. The
 * progression therefore projects one `declare_action` task per undeclared participant, and the API
 * authorizes any of them.
 *
 * The GM panel, however, took its command descriptor from the **cursor** task while every selector
 * in the declaration form — action, target, attack source, loadout, combat context — is derived
 * from the participant the inspector is **browsed** to. Submitting across that gap mixed three
 * participant contexts into one request. Resolving the descriptor from the browsed participant's
 * own task closes the gap in the direction where the data exists: the browsed row is the one whose
 * loadout and context are hydrated, so actor, source and target all become the ones on screen.
 *
 * This retargets nothing and invents nothing. It selects an already-projected, already-authorized
 * task by its owner, and returns `undefined` when the participant has no such task — in which case
 * the caller keeps the descriptor it already holds rather than guessing.
 */
export function resolveInspectedDeclarationCommandDescriptor(input: {
  descriptor: CurrentActionCommandDescriptor;
  participantAliases?: readonly string[];
  participantId?: string;
  projection?: CombatProgressionPresentationProjection;
}): CurrentActionCommandDescriptor {
  const participantId = input.participantId?.trim();
  if (
    input.descriptor.commandType !== "declare_action" ||
    !participantId ||
    !input.projection ||
    input.descriptor.participantId === participantId
  ) {
    return input.descriptor;
  }

  const aliases = new Set([participantId, ...(input.participantAliases ?? [])]);
  const task = input.projection.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .find(
      (candidate) =>
        candidate.expectedCommand === "declare_action" &&
        ((candidate.owner?.kind === "combatant" && aliases.has(candidate.owner.participantId)) ||
          (candidate.identity.participantId !== undefined &&
            aliases.has(candidate.identity.participantId))),
    );
  if (!task) {
    return input.descriptor;
  }

  return {
    ...input.descriptor,
    executionGroupId: task.executionGroupId,
    participantId:
      task.owner?.kind === "combatant"
        ? task.owner.participantId
        : (task.identity.participantId ?? participantId),
    processId: task.processId,
    stageId: task.stageId,
    taskId: task.id,
  };
}

/**
 * The alias set a declaration task owner may be recorded under. Shared with the panel so the lookup
 * above and the panel's own participant resolution agree on identity.
 */
export function getInspectedDeclarationParticipantAliases(participant?: {
  characterId?: string;
  id?: string;
  participantId?: string;
  scenarioParticipantId?: string;
}): string[] {
  return participant ? getCombatDistanceParticipantAliases(participant) : [];
}
