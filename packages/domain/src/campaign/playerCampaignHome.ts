import type {
  PlayerAccessibleCampaign,
  PlayerAccessibleScenario,
  PlayerCampaignCharacterSummary,
  PlayerCampaignHomeRecord,
} from "../api/campaigns";
import type { Campaign, Scenario, ScenarioParticipant } from "./scenario";
import { isUserAssignedToEncounterMembership, type EncounterSession } from "../encounter/session";

export function buildPlayerAccessibleCampaign(campaign: Campaign): PlayerAccessibleCampaign {
  return {
    description: campaign.description,
    id: campaign.id,
    name: campaign.name,
  };
}

export function buildPlayerAccessibleScenario(scenario: Scenario): PlayerAccessibleScenario {
  return {
    campaignId: scenario.campaignId,
    description: scenario.description,
    id: scenario.id,
    name: scenario.name,
    status: scenario.status,
  };
}

function encounterStatusRank(status: EncounterSession["status"]): number {
  switch (status) {
    case "active":
      return 0;
    case "paused":
      return 1;
    case "draft":
      return 3;
    default:
      return 99;
  }
}

function sortCharacters(
  characters: Iterable<PlayerCampaignCharacterSummary>,
): PlayerCampaignCharacterSummary[] {
  return [...characters].sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}

function userControlsParticipant(input: {
  participant: ScenarioParticipant;
  rosterCharacterIds: Set<string>;
  userId: string;
}): boolean {
  return (
    input.participant.isActive &&
    input.participant.role === "player_character" &&
    (input.participant.controlledByUserId === input.userId ||
      (input.participant.controlledByUserId === undefined &&
        Boolean(
          input.participant.characterId &&
          input.rosterCharacterIds.has(input.participant.characterId),
        )))
  );
}

export function buildPlayerCampaignHomeRecord(input: {
  campaign: Campaign;
  rosterCharacters: PlayerCampaignCharacterSummary[];
  scenarios: Array<{
    encounters: EncounterSession[];
    participants: ScenarioParticipant[];
    scenario: Scenario;
  }>;
  userId: string;
}): PlayerCampaignHomeRecord {
  const rosterCharacterIds = new Set(input.rosterCharacters.map((character) => character.id));
  const liveScenarios = input.scenarios.filter(({ scenario }) => scenario.status === "live");
  const controlledCharacterIds = new Set(
    liveScenarios.flatMap(({ participants }) =>
      participants
        .filter(
          (participant) =>
            userControlsParticipant({
              participant,
              rosterCharacterIds,
              userId: input.userId,
            }) &&
            participant.characterId &&
            participant.controlledByUserId === input.userId,
        )
        .map((participant) => participant.characterId!),
    ),
  );
  const delegatedCharacterIds = new Set(
    liveScenarios.flatMap(({ participants }) =>
      participants
        .filter(
          (participant) =>
            participant.isActive &&
            participant.role === "player_character" &&
            participant.characterId &&
            participant.controlledByUserId !== undefined &&
            participant.controlledByUserId !== input.userId,
        )
        .map((participant) => participant.characterId!),
    ),
  );
  const campaignCharactersById = new Map(
    input.rosterCharacters
      .filter(
        (character) =>
          !delegatedCharacterIds.has(character.id) || controlledCharacterIds.has(character.id),
      )
      .map((character) => [character.id, character]),
  );
  const scenarios = liveScenarios
    .filter(({ participants }) =>
      participants.some((participant) =>
        userControlsParticipant({
          participant,
          rosterCharacterIds,
          userId: input.userId,
        }),
      ),
    )
    .map(({ encounters, participants, scenario }) => {
      const controlledCharactersById = new Map<string, PlayerCampaignCharacterSummary>();

      for (const participant of participants) {
        if (
          !participant.characterId ||
          !userControlsParticipant({
            participant,
            rosterCharacterIds,
            userId: input.userId,
          })
        ) {
          continue;
        }

        const character = {
          id: participant.characterId,
          name:
            campaignCharactersById.get(participant.characterId)?.name ??
            participant.snapshot.displayName,
        };
        controlledCharactersById.set(character.id, character);
        campaignCharactersById.set(character.id, character);
      }

      const encounter = encounters
        .filter((candidate) => candidate.status === "active" || candidate.status === "paused")
        .filter((candidate) =>
          isUserAssignedToEncounterMembership({
            encounter: candidate,
            scenarioParticipants: participants,
            userId: input.userId,
          }),
        )
        .sort(
          (left, right) =>
            encounterStatusRank(left.status) - encounterStatusRank(right.status) ||
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
            left.title.localeCompare(right.title),
        )[0];

      return {
        characters: sortCharacters(controlledCharactersById.values()),
        encounter: encounter
          ? {
              id: encounter.id,
              status: encounter.status,
              title: encounter.title,
            }
          : undefined,
        encounterKind: encounter?.kind,
        scenario: buildPlayerAccessibleScenario(scenario),
      };
    });
  const resumeScenario = [...scenarios].sort(
    (left, right) =>
      (left.encounter ? encounterStatusRank(left.encounter.status) : 50) -
      (right.encounter ? encounterStatusRank(right.encounter.status) : 50),
  )[0];

  return {
    campaign: buildPlayerAccessibleCampaign(input.campaign),
    characters: sortCharacters(campaignCharactersById.values()),
    resume: resumeScenario
      ? resumeScenario.encounter
        ? {
            encounterId: resumeScenario.encounter.id,
            scenarioId: resumeScenario.scenario.id,
            tab: resumeScenario.encounterKind === "combat" ? "player-combat" : "encounter",
          }
        : {
            scenarioId: resumeScenario.scenario.id,
            tab: "scenario",
          }
      : {
          tab: "campaign",
        },
    scenarios: scenarios.map(({ encounterKind: _encounterKind, ...scenario }) => scenario),
  };
}
