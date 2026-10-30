import type { ScenarioParticipant } from "../campaign/scenario";
import { getCombatDistanceParticipantAliases } from "./combatDistance";
import type { EncounterParticipantReadSource } from "./combatReadModels";
import {
  resolveEncounterParticipantForViewer,
  resolveEncounterParticipantMembership,
  type EncounterSession,
} from "./session";

function getEncounterParticipantsControlledByUser(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): EncounterSession["participants"] {
  return input.scenarioParticipants
    .map((scenarioParticipant) =>
      resolveEncounterParticipantForViewer({
        encounter: input.encounter,
        requestedParticipantId: scenarioParticipant.id,
        scenarioParticipants: input.scenarioParticipants,
        viewer: { kind: "player", userId: input.userId },
      }),
    )
    .filter((resolution): resolution is NonNullable<typeof resolution> => Boolean(resolution))
    .map((resolution) => resolution.encounterParticipant)
    .filter(
      (participant, index, participants) =>
        participants.findIndex((candidate) => candidate.id === participant.id) === index,
    );
}

export function hasCombatDistanceVisibility(input: {
  target: EncounterSession["participants"][number];
  viewer: EncounterSession["participants"][number];
  visibility?: NonNullable<EncounterSession["roleplayState"]>["visibility"];
}): boolean {
  const targetAliases = getCombatDistanceParticipantAliases(input.target);
  const viewerAliases = getCombatDistanceParticipantAliases(input.viewer);

  return viewerAliases.some((viewerAlias) => {
    const row = input.visibility?.[viewerAlias];

    return targetAliases.some((targetAlias) => Boolean(row?.[targetAlias]));
  });
}

export function buildPlayerSafeCombatScopeForUser(input: {
  encounter: EncounterParticipantReadSource & {
    participantVisibility?: NonNullable<EncounterSession["roleplayState"]>["visibility"];
    roleplayState?: Pick<NonNullable<EncounterSession["roleplayState"]>, "visibility">;
  };
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): {
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
} {
  const controlledEncounterParticipants = getEncounterParticipantsControlledByUser(input);
  return buildPlayerSafeCombatScopeForParticipants({
    controlledEncounterParticipants,
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
}

export function buildPlayerSafeCombatScopeForParticipants(input: {
  controlledEncounterParticipants: EncounterSession["participants"];
  encounter: EncounterParticipantReadSource & {
    participantVisibility?: NonNullable<EncounterSession["roleplayState"]>["visibility"];
    roleplayState?: Pick<NonNullable<EncounterSession["roleplayState"]>, "visibility">;
  };
  scenarioParticipants: ScenarioParticipant[];
}): {
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
} {
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
  const controlledEncounterParticipantIds = new Set(
    input.controlledEncounterParticipants.flatMap((participant) =>
      getCombatDistanceParticipantAliases(participant),
    ),
  );
  const visibility =
    input.encounter.participantVisibility ?? input.encounter.roleplayState?.visibility;
  const hasVisibilityRows = Object.keys(visibility ?? {}).length > 0;
  const visibleParticipantIds = new Set(
    membership.participants
      .filter((participant) => {
        const controlled = input.controlledEncounterParticipants.some(
          (candidate) => candidate.id === participant.id,
        );
        if (controlled) return true;

        const aliases = getCombatDistanceParticipantAliases(participant);
        const scenarioParticipant = input.scenarioParticipants.find(
          (candidate) =>
            aliases.includes(candidate.id) ||
            Boolean(candidate.characterId && aliases.includes(candidate.characterId)),
        );
        // `ScenarioParticipant.visibilityOverrides` has no production write path
        // (create-time only, and its sole non-test supplier is a test helper), so
        // this branch is inert in production and is retained only as a
        // fail-closed belt. Issue #798 deliberately does not make it
        // load-bearing: the GM's reachable hide control writes the per-viewer
        // matrix consulted below, and collapsing that matrix into this flat
        // per-participant enum would hide the participant from every player
        // rather than from the one viewer the GM chose (PO ruling D1).
        const scenarioVisibility = scenarioParticipant?.visibilityOverrides?.visibility;
        if (scenarioVisibility === "hidden" || scenarioVisibility === "gm_only") return false;

        return (
          !hasVisibilityRows ||
          input.controlledEncounterParticipants.some((viewer) =>
            hasCombatDistanceVisibility({
              target: participant,
              viewer,
              visibility,
            }),
          )
        );
      })
      .flatMap((participant) => getCombatDistanceParticipantAliases(participant)),
  );

  return {
    controlledEncounterParticipantIds,
    visibleParticipantIds,
  };
}
