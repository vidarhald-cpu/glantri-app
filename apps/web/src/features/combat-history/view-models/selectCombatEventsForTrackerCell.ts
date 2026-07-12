import type { CombatRoundStep, CombatStepEvent } from "@glantri/domain";

export function selectCombatEventsForTrackerCell(input: {
  events: readonly CombatStepEvent[];
  participantId?: string;
  retainLatestWhenEmpty: boolean;
  step: CombatRoundStep;
}): CombatStepEvent[] {
  const exactEvents = input.events.filter(
    (event) => event.ownerParticipantId === input.participantId && event.step === input.step,
  );
  const retainedEvents =
    exactEvents.length || !input.retainLatestWhenEmpty
      ? exactEvents
      : (() => {
          const participantEvents = input.participantId
            ? input.events.filter((event) => event.ownerParticipantId === input.participantId)
            : input.events;
          const latest = [...participantEvents].sort(
            (left, right) => right.sequence - left.sequence || right.id.localeCompare(left.id),
          )[0];
          return latest
            ? input.events.filter(
                (event) =>
                  event.ownerParticipantId === latest.ownerParticipantId &&
                  event.step === latest.step,
              )
            : [];
        })();
  const attackResultIds = new Set(
    retainedEvents
      .map((event) => event.attackResultId)
      .filter((attackResultId): attackResultId is string => Boolean(attackResultId)),
  );
  const distanceProposalIds = new Set(
    retainedEvents
      .map((event) => event.distanceProposalId)
      .filter((proposalId): proposalId is string => Boolean(proposalId)),
  );

  return input.events
    .filter(
      (event) =>
        retainedEvents.some((retained) => retained.id === event.id) ||
        Boolean(event.attackResultId && attackResultIds.has(event.attackResultId)) ||
        Boolean(event.distanceProposalId && distanceProposalIds.has(event.distanceProposalId)),
    )
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}
