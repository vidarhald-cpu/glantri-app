import type { EncounterSession, EncounterSessionRevision } from "@glantri/domain";

export type ActiveEncounterPollResult =
  | { kind: "unchanged" }
  | { kind: "stale" }
  | { encounter: EncounterSession; kind: "updated" };

export async function pollActiveEncounterRevision(input: {
  acceptedRevision?: string;
  encounterId: string;
  loadEncounter: (encounterId: string) => Promise<EncounterSession>;
  loadRevision: (encounterId: string) => Promise<EncounterSessionRevision>;
  onNewerRevision?: (revision: EncounterSessionRevision) => void;
}): Promise<ActiveEncounterPollResult> {
  const revision = await input.loadRevision(input.encounterId);

  if (revision.encounterId !== input.encounterId) {
    return { kind: "stale" };
  }

  if (
    input.acceptedRevision &&
    revision.revision <= input.acceptedRevision
  ) {
    return revision.revision === input.acceptedRevision
      ? { kind: "unchanged" }
      : { kind: "stale" };
  }

  input.onNewerRevision?.(revision);
  const encounter = await input.loadEncounter(input.encounterId);

  if (
    encounter.id !== input.encounterId ||
    encounter.updatedAt < revision.revision ||
    (input.acceptedRevision && encounter.updatedAt <= input.acceptedRevision)
  ) {
    return { kind: "stale" };
  }

  return {
    encounter,
    kind: "updated",
  };
}
