"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import type { AuthUser } from "@glantri/auth";
import { defaultCanonicalContent } from "@glantri/content";
import type {
  CampaignRosterEntry,
  EncounterKind,
  EncounterParticipant,
  EncounterSession,
  EncounterStatus,
  ReusableEntity,
  Scenario,
  ScenarioEventLog,
  ScenarioParticipant,
} from "@glantri/domain";
import { createEncounterSession } from "@glantri/rules-engine";

import {
  addScenarioParticipantFromCharacterOnServer,
  addScenarioParticipantFromEntityOnServer,
  createEncounterOnServer,
  loadAuthUsers,
  loadCampaignEntities,
  loadCampaignRoster,
  loadServerCharacters,
  loadScenarioEncounters,
  loadTemplates,
  loadScenarioById,
  loadScenarioEventLogs,
  loadScenarioParticipants,
  updateEncounterOnServer,
  updateScenarioParticipantMetadataOnServer,
  updateScenarioOnServer
} from "../../../../../../src/lib/api/localServiceClient";
import {
  buildScenarioActorInputFromTemplate,
  getCampaignActorMetadata,
} from "../../../../../../src/lib/campaigns/campaignActors";
import RememberedCampaignWorkspaceEffect from "../../../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import type { ServerCharacterRecord } from "../../../../../../src/lib/api/localServiceClient";
import { getScenarioCharacterDefaultControllerId } from "../../../../../../src/lib/campaigns/scenarioCharacters";
import { buildCampaignWorkspaceHref } from "../../../../../../src/lib/campaigns/workspace";

interface ScenarioDetailPageContentProps {
  campaignId: string;
  embedded?: boolean;
  scenarioId: string;
}

interface ScenarioRosterCandidate {
  civilizationLabel: string;
  controllerFilter: ScenarioControllerFilter;
  controllerLabel: string;
  existingParticipant?: ScenarioParticipant;
  name: string;
  professionLabel: string;
  rosterEntry: CampaignRosterEntry;
  skillGroups: string[];
  sourceKind: string;
  typeFilter: ScenarioParticipantTypeFilter;
  typeLabel: string;
}

interface TemplateSource {
  entity: ReusableEntity;
  label: string;
}

type ScenarioParticipantTypeFilter = "all" | "pc" | "npc" | "temporary" | "monster" | "other";
type ScenarioControllerFilter = "all" | "players" | "gms";

const civilizationNameById = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [civilization.id, civilization.name])
);
const civilizationNameByName = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [
    civilization.name.toLowerCase(),
    civilization.name
  ])
);
const civilizationNamesBySocietyId = new Map<string, string[]>();

for (const civilization of defaultCanonicalContent.civilizations) {
  const existingNames = civilizationNamesBySocietyId.get(civilization.linkedSocietyId) ?? [];
  civilizationNamesBySocietyId.set(civilization.linkedSocietyId, [
    ...existingNames,
    civilization.name
  ]);
}

function formatEntityKind(kind: ReusableEntity["kind"]): string {
  if (kind === "npc") {
    return "NPC";
  }

  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function getCivilizationDisplayName(value?: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return "—";
  }

  const exactCivilizationName =
    civilizationNameById.get(normalizedValue) ??
    civilizationNameByName.get(normalizedValue.toLowerCase());

  if (exactCivilizationName) {
    return exactCivilizationName;
  }

  const societyCivilizationNames = civilizationNamesBySocietyId.get(normalizedValue);

  if (societyCivilizationNames && societyCivilizationNames.length > 0) {
    return societyCivilizationNames.join(" / ");
  }

  return "—";
}

function readSnapshotMetadata(snapshot: unknown): {
  civilizationLabel?: string;
  professionLabel?: string;
  skillGroups: string[];
} {
  if (!isRecord(snapshot)) {
    return { skillGroups: [] };
  }

  const progression = isRecord(snapshot.progression) ? snapshot.progression : undefined;
  const progressionSkillGroups = Array.isArray(progression?.skillGroups)
    ? progression.skillGroups
        .map((entry) => (isRecord(entry) ? readOptionalString(entry.groupId) : undefined))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return {
    civilizationLabel:
      readOptionalString(snapshot.civilization) ??
      readOptionalString(snapshot.civilizationId) ??
      readOptionalString(snapshot.culture) ??
      readOptionalString(snapshot.societyId) ??
      readOptionalString(snapshot.society),
    professionLabel: readOptionalString(snapshot.profession) ?? readOptionalString(snapshot.professionId),
    skillGroups: [
      ...readStringList(snapshot.skillGroups),
      ...readStringList(snapshot.skillGroupIds),
      ...readStringList(snapshot.trainingPackages),
      ...progressionSkillGroups
    ]
  };
}

function getScenarioParticipantType(input: {
  characterId?: string;
  entityId?: string;
  role: ScenarioParticipant["role"];
  sourceType: ScenarioParticipant["sourceType"];
}): {
  label: string;
  typeFilter: ScenarioParticipantTypeFilter;
} {
  if (input.role === "player_character" || input.sourceType === "character") {
    return { label: "PC", typeFilter: "pc" };
  }

  if (input.role === "monster") {
    return { label: input.entityId ? "Monster" : "Temporary monster", typeFilter: "monster" };
  }

  if (input.sourceType === "entity" && !input.entityId) {
    return { label: "Temporary actor", typeFilter: "temporary" };
  }

  if (input.role === "npc" || input.role === "enemy" || input.role === "ally") {
    return { label: "NPC", typeFilter: "npc" };
  }

  return { label: "Other", typeFilter: "other" };
}

function getConcreteParticipantMetadata(participant: ScenarioParticipant): {
  civilizationLabel: string;
  professionLabel: string;
  skillGroups: string[];
  typeFilter: ScenarioParticipantTypeFilter;
  typeLabel: string;
} {
  const participantType = getScenarioParticipantType({
    characterId: participant.characterId,
    entityId: participant.entityId,
    role: participant.role,
    sourceType: participant.sourceType
  });
  const buildMetadata = readSnapshotMetadata(participant.snapshot.build);

  return {
    civilizationLabel: getCivilizationDisplayName(buildMetadata.civilizationLabel),
    professionLabel: buildMetadata.professionLabel ?? "—",
    skillGroups: buildMetadata.skillGroups,
    typeFilter: participantType.typeFilter,
    typeLabel: participantType.label
  };
}

export default function ScenarioDetailPageContent({
  campaignId,
  embedded = false,
  scenarioId
}: ScenarioDetailPageContentProps) {
  const [assignableUsers, setAssignableUsers] = useState<AuthUser[]>([]);
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [entities, setEntities] = useState<ReusableEntity[]>([]);
  const [error, setError] = useState<string>();
  const [eventLogs, setEventLogs] = useState<ScenarioEventLog[]>([]);
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<ScenarioParticipant[]>([]);
  const [playerCharacters, setPlayerCharacters] = useState<ServerCharacterRecord[]>([]);
  const [roster, setRoster] = useState<CampaignRosterEntry[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [encounterTitle, setEncounterTitle] = useState("");
  const [encounterDescription, setEncounterDescription] = useState("");
  const [encounterKind, setEncounterKind] = useState<EncounterKind>("combat");
  const [encounterTimelineLabel, setEncounterTimelineLabel] = useState("");
  const [selectedTemplateSourceId, setSelectedTemplateSourceId] = useState("");
  const [temporaryActorCount, setTemporaryActorCount] = useState(1);
  const [temporaryActorName, setTemporaryActorName] = useState("");
  const [temporaryActorRole, setTemporaryActorRole] = useState<ScenarioParticipant["role"]>("npc");

  const [rosterTypeFilter, setRosterTypeFilter] =
    useState<ScenarioParticipantTypeFilter>("all");
  const [rosterControllerFilter, setRosterControllerFilter] =
    useState<ScenarioControllerFilter>("all");
  const [rosterCivilizationFilter, setRosterCivilizationFilter] = useState("");
  const [rosterProfessionFilter, setRosterProfessionFilter] = useState("");
  const [rosterSkillGroupFilter, setRosterSkillGroupFilter] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");

  const [participantTypeFilter, setParticipantTypeFilter] =
    useState<ScenarioParticipantTypeFilter>("all");
  const [participantCivilizationFilter, setParticipantCivilizationFilter] = useState("");
  const [participantProfessionFilter, setParticipantProfessionFilter] = useState("");
  const [participantSkillGroupFilter, setParticipantSkillGroupFilter] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [bulkEncounterId, setBulkEncounterId] = useState("");
  const [expandedAssignmentParticipantIds, setExpandedAssignmentParticipantIds] = useState<string[]>([]);
  const [selectedAssignmentParticipantIds, setSelectedAssignmentParticipantIds] = useState<string[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioStatus, setScenarioStatus] = useState<Scenario["status"]>("draft");
  const usersById = useMemo(
    () => new Map(assignableUsers.map((user) => [user.id, user])),
    [assignableUsers]
  );
  const charactersById = useMemo(
    () => new Map(playerCharacters.map((character) => [character.id, character])),
    [playerCharacters]
  );
  const entitiesById = useMemo(
    () => new Map([...entities, ...templates].map((entity) => [entity.id, entity])),
    [entities, templates]
  );
  const participantsByRosterSource = useMemo(() => {
    const entries = new Map<string, ScenarioParticipant>();

    for (const participant of participants) {
      if (participant.sourceType === "character" && participant.characterId) {
        entries.set(`character:${participant.characterId}`, participant);
      }

      if (participant.sourceType === "entity" && participant.entityId) {
        entries.set(`reusableEntity:${participant.entityId}`, participant);
        entries.set(`template:${participant.entityId}`, participant);
      }
    }

    return entries;
  }, [participants]);
  const scenarioRosterCandidates = useMemo<ScenarioRosterCandidate[]>(
    () =>
      roster
        .filter((entry) => entry.category !== "template")
        .map((entry) => {
          const character = entry.sourceType === "character" ? charactersById.get(entry.sourceId) : undefined;
          const entity = entry.sourceType === "reusableEntity" || entry.sourceType === "template"
            ? entitiesById.get(entry.sourceId)
            : undefined;
          const existingParticipant = participantsByRosterSource.get(`${entry.sourceType}:${entry.sourceId}`);
          const entityMetadata = entity ? getCampaignActorMetadata(entity) : undefined;
          const entitySnapshotMetadata = readSnapshotMetadata(entity?.snapshot);
          const name = character?.name ?? entity?.name ?? entry.labelSnapshot ?? "Unknown roster member";
          const sourceKind =
            entry.sourceType === "character"
              ? "Character"
              : entity
                ? formatEntityKind(entity.kind)
                : entry.sourceType;
          const participantType =
            entry.category === "pc"
              ? { label: "PC", typeFilter: "pc" as const }
              : entity?.kind === "monster"
                ? { label: "Monster", typeFilter: "monster" as const }
                : { label: "NPC", typeFilter: "npc" as const };
          const controllerUserId = existingParticipant?.controlledByUserId ?? character?.ownerId ?? undefined;
          const controllerUser = controllerUserId ? usersById.get(controllerUserId) : undefined;
          const controllerFilter: ScenarioControllerFilter =
            controllerUser?.roles.some((role) => role === "admin" || role === "game_master") ||
            !controllerUserId
              ? "gms"
              : "players";

          return {
            civilizationLabel:
              character
                ? getCivilizationDisplayName(character.build.societyId)
                : getCivilizationDisplayName(entitySnapshotMetadata.civilizationLabel),
            controllerFilter,
            controllerLabel: formatUserLabel(controllerUserId),
            existingParticipant,
            name,
            professionLabel:
              character?.build.professionId ??
              entityMetadata?.profession ??
              entitySnapshotMetadata.professionLabel ??
              "—",
            rosterEntry: entry,
            skillGroups:
              character?.build.progression.skillGroups.map((group) => group.groupId) ??
              entitySnapshotMetadata.skillGroups,
            sourceKind,
            typeFilter: participantType.typeFilter,
            typeLabel: participantType.label
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    [charactersById, entitiesById, participantsByRosterSource, roster, usersById]
  );
  const orderedEncounters = useMemo(
    () =>
      [...encounters].sort((left, right) => {
        const leftTimeline = left.timelineLabel?.trim() ?? "";
        const rightTimeline = right.timelineLabel?.trim() ?? "";

        if (leftTimeline || rightTimeline) {
          return leftTimeline.localeCompare(rightTimeline) || left.createdAt.localeCompare(right.createdAt);
        }

        return left.createdAt.localeCompare(right.createdAt);
      }),
    [encounters]
  );
  const nonArchivedEncounters = useMemo(
    () =>
      orderedEncounters.filter(
        (encounter) => encounter.status !== "archived" && encounter.status !== "complete"
      ),
    [orderedEncounters]
  );
  const templateSources = useMemo<TemplateSource[]>(() => {
    const sourcesById = new Map<string, TemplateSource>();

    for (const template of templates) {
      sourcesById.set(template.id, {
        entity: template,
        label: `${template.name} (template library)`
      });
    }

    for (const entry of roster) {
      if (entry.category !== "template") {
        continue;
      }

      const entity = entitiesById.get(entry.sourceId);

      if (!entity) {
        continue;
      }

      sourcesById.set(entity.id, {
        entity,
        label: `${entity.name} (campaign roster)`
      });
    }

    return [...sourcesById.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [entitiesById, roster, templates]);
  const concreteParticipants = useMemo(() => {
    const templateIds = new Set(templateSources.map((source) => source.entity.id));

    return participants.filter(
      (participant) =>
        participant.isActive && !(participant.entityId && templateIds.has(participant.entityId))
    );
  }, [participants, templateSources]);
  const participantTypeFilterOptions = useMemo(() => {
    const participantTypes = new Set<ScenarioParticipantTypeFilter>([
      ...scenarioRosterCandidates.map((candidate) => candidate.typeFilter),
      ...concreteParticipants.map((participant) => getConcreteParticipantMetadata(participant).typeFilter)
    ]);

    return [
      { id: "all" as const, label: "All types" },
      { id: "pc" as const, label: "PCs" },
      { id: "npc" as const, label: "NPCs" },
      { id: "temporary" as const, label: "Temporary actors" },
      { id: "monster" as const, label: "Monsters" },
      { id: "other" as const, label: "Other" }
    ].filter((option) => option.id === "all" || participantTypes.has(option.id));
  }, [concreteParticipants, scenarioRosterCandidates]);
  const participantCivilizationOptions = useMemo(
    () =>
      [
        ...new Set([
          ...scenarioRosterCandidates.map((candidate) => candidate.civilizationLabel),
          ...concreteParticipants.map(
            (participant) => getConcreteParticipantMetadata(participant).civilizationLabel
          )
        ].filter((value) => value !== "—"))
      ].sort(),
    [concreteParticipants, scenarioRosterCandidates]
  );
  const participantProfessionOptions = useMemo(
    () =>
      [
        ...new Set([
          ...scenarioRosterCandidates.map((candidate) => candidate.professionLabel),
          ...concreteParticipants.map(
            (participant) => getConcreteParticipantMetadata(participant).professionLabel
          )
        ].filter((value) => value !== "—"))
      ].sort(),
    [concreteParticipants, scenarioRosterCandidates]
  );
  const participantSkillGroupOptions = useMemo(
    () =>
      [
        ...new Set([
          ...scenarioRosterCandidates.flatMap((candidate) => candidate.skillGroups),
          ...concreteParticipants.flatMap(
            (participant) => getConcreteParticipantMetadata(participant).skillGroups
          )
        ])
      ].sort(),
    [concreteParticipants, scenarioRosterCandidates]
  );
  const rosterTypeFilterOptions = useMemo(() => {
    const rosterTypes = new Set(
      scenarioRosterCandidates
        .filter((candidate) => !candidate.existingParticipant?.isActive)
        .map((candidate) => candidate.typeFilter)
    );

    return [
      { id: "all" as const, label: "All types" },
      { id: "pc" as const, label: "PCs" },
      { id: "npc" as const, label: "NPCs" },
      { id: "monster" as const, label: "Monsters" },
      { id: "other" as const, label: "Other" }
    ].filter((option) => option.id === "all" || rosterTypes.has(option.id));
  }, [scenarioRosterCandidates]);
  const filteredScenarioRosterCandidates = useMemo(() => {
    const search = rosterSearch.trim().toLowerCase();

    return scenarioRosterCandidates.filter((candidate) => {
      const isAvailableForScenario = !candidate.existingParticipant?.isActive;
      const matchesType = rosterTypeFilter === "all" || candidate.typeFilter === rosterTypeFilter;
      const matchesController =
        rosterControllerFilter === "all" || candidate.controllerFilter === rosterControllerFilter;
      const matchesCivilization =
        !rosterCivilizationFilter || candidate.civilizationLabel === rosterCivilizationFilter;
      const matchesProfession =
        !rosterProfessionFilter || candidate.professionLabel === rosterProfessionFilter;
      const matchesSkillGroup =
        !rosterSkillGroupFilter || candidate.skillGroups.includes(rosterSkillGroupFilter);
      const matchesSearch =
        search.length === 0 ||
        candidate.name.toLowerCase().includes(search) ||
        candidate.typeLabel.toLowerCase().includes(search) ||
        candidate.sourceKind.toLowerCase().includes(search) ||
        candidate.controllerLabel.toLowerCase().includes(search) ||
        candidate.civilizationLabel.toLowerCase().includes(search) ||
        candidate.professionLabel.toLowerCase().includes(search) ||
        candidate.skillGroups.some((group) => group.toLowerCase().includes(search));

      return (
        isAvailableForScenario &&
        matchesType &&
        matchesController &&
        matchesCivilization &&
        matchesProfession &&
        matchesSkillGroup &&
        matchesSearch
      );
    });
  }, [
    rosterCivilizationFilter,
    rosterControllerFilter,
    rosterProfessionFilter,
    rosterSearch,
    rosterSkillGroupFilter,
    rosterTypeFilter,
    scenarioRosterCandidates
  ]);
  const filteredConcreteParticipants = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();

    return concreteParticipants.filter((participant) => {
      const metadata = getConcreteParticipantMetadata(participant);
      const matchesType = participantTypeFilter === "all" || metadata.typeFilter === participantTypeFilter;
      const matchesCivilization =
        !participantCivilizationFilter || metadata.civilizationLabel === participantCivilizationFilter;
      const matchesProfession =
        !participantProfessionFilter || metadata.professionLabel === participantProfessionFilter;
      const matchesSkillGroup =
        !participantSkillGroupFilter || metadata.skillGroups.includes(participantSkillGroupFilter);
      const matchesSearch =
        search.length === 0 ||
        participant.snapshot.displayName.toLowerCase().includes(search) ||
        metadata.typeLabel.toLowerCase().includes(search) ||
        (participant.controlledByUserId?.toLowerCase().includes(search) ?? false) ||
        metadata.civilizationLabel.toLowerCase().includes(search) ||
        metadata.professionLabel.toLowerCase().includes(search) ||
        metadata.skillGroups.some((group) => group.toLowerCase().includes(search));

      return (
        matchesType &&
        matchesCivilization &&
        matchesProfession &&
        matchesSkillGroup &&
        matchesSearch
      );
    });
  }, [
    concreteParticipants,
    participantCivilizationFilter,
    participantProfessionFilter,
    participantSearch,
    participantSkillGroupFilter,
    participantTypeFilter
  ]);
  const assignmentParticipants = useMemo(
    () => filteredConcreteParticipants,
    [filteredConcreteParticipants]
  );
  const selectedBulkEncounterId = bulkEncounterId || nonArchivedEncounters[0]?.id || "";

  function formatUserLabel(userId: string | undefined): string {
    if (!userId) {
      return "—";
    }

    const user = usersById.get(userId);
    if (!user) {
      return userId;
    }

    if (user.displayName) {
      return user.displayName;
    }

    return user.email;
  }

  function formatEventType(value: string): string {
    return value
      .split("_")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  function formatShortDateTime(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}.${month} ${hours}:${minutes}`;
  }

  function buildEncounterParticipant(
    encounter: EncounterSession,
    participant: ScenarioParticipant
  ): EncounterParticipant {
    const participantId = `scenario-${participant.id}`;

    return {
      declaration: {
        actionType: "none",
        defenseFocus: "none",
        defensePosture: "none",
        targetLocation: "any"
      },
      facing: "north",
      id: participantId,
      initiative: 0,
      label: participant.snapshot.displayName,
      order: encounter.participants.length,
      orientation: "neutral",
      participantType: "scenario",
      position: {
        x: 0,
        y: 0,
        zone: "center"
      },
      scenarioParticipantId: participant.id
    };
  }

  function isParticipantInEncounter(
    encounter: EncounterSession,
    participant: ScenarioParticipant
  ): boolean {
    const participantId = `scenario-${participant.id}`;

    return encounter.participants.some(
      (entry) => entry.scenarioParticipantId === participant.id || entry.id === participantId
    );
  }

  async function saveEncounterParticipants(input: {
    encounter: EncounterSession;
    participants: EncounterParticipant[];
    feedbackMessage: string;
  }) {
    await updateEncounterOnServer({
      encounterId: input.encounter.id,
      session: {
        ...input.encounter,
        participants: input.participants,
        updatedAt: new Date().toISOString()
      }
    });

    setFeedback(input.feedbackMessage);
    setEncounters((current) =>
      current.map((entry) =>
        entry.id === input.encounter.id ? { ...input.encounter, participants: input.participants } : entry
      )
    );
    await refreshScenario();
  }

  async function refreshScenario() {
    const [
      nextScenario,
      nextParticipants,
      nextEntities,
      nextTemplates,
      nextEventLogs,
      nextEncounters,
      nextUsers,
      nextPlayerCharacters,
      nextRoster,
    ] = await Promise.all([
      loadScenarioById(scenarioId),
      loadScenarioParticipants(scenarioId),
      loadCampaignEntities(campaignId),
      loadTemplates(),
      loadScenarioEventLogs(scenarioId),
      loadScenarioEncounters(scenarioId),
      loadAuthUsers(),
      loadServerCharacters(),
      loadCampaignRoster(campaignId),
    ]);

    const globalTemplates = nextTemplates.filter(
      (entity) => getCampaignActorMetadata(entity).actorClass === "template"
    );

    setScenario(nextScenario);
    setParticipants(nextParticipants);
    setEntities(nextEntities);
    setTemplates(globalTemplates);
    setEventLogs(nextEventLogs);
    setEncounters(nextEncounters);
    setAssignableUsers(nextUsers);
    setPlayerCharacters(nextPlayerCharacters);
    setRoster(nextRoster);
    setScenarioName(nextScenario.name);
    setScenarioDescription(nextScenario.description);
    setScenarioStatus(nextScenario.status);
  }

  async function handleCreateEncounter() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const encounter = await createEncounterOnServer({
        scenarioId,
        session: {
          ...createEncounterSession(encounterTitle.trim()),
          campaignId,
          description: encounterDescription.trim() || undefined,
          kind: encounterKind,
          scenarioId,
          status: "planned",
          timelineLabel: encounterTimelineLabel.trim() || undefined,
        },
      });

      setEncounterTitle("");
      setEncounterDescription("");
      setEncounterTimelineLabel("");
      setFeedback(`Created encounter ${encounter.title}.`);
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to create encounter.",
      );
    }
  }

  useEffect(() => {
    refreshScenario()
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load scenario.");
      })
      .finally(() => setLoading(false));
  }, [campaignId, scenarioId]);

  async function handleUpdateScenarioMetadata() {
    try {
      setError(undefined);
      setFeedback(undefined);
      const updatedScenario = await updateScenarioOnServer({
        description: scenarioDescription,
        name: scenarioName,
        scenarioId,
        status: scenarioStatus
      });

      setFeedback(`Updated scenario ${updatedScenario.name}.`);
      await refreshScenario();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update scenario.");
    }
  }

  async function handleRosterParticipantToggle(candidate: ScenarioRosterCandidate, member: boolean) {
    try {
      setError(undefined);
      setFeedback(undefined);

      if (!member) {
        if (candidate.existingParticipant) {
          const participant = await updateScenarioParticipantMetadataOnServer({
            isActive: false,
            participantId: candidate.existingParticipant.id,
            scenarioId
          });

          setParticipants((current) =>
            current.map((entry) => (entry.id === participant.id ? participant : entry))
          );
        }

        setFeedback(`Removed ${candidate.name} from active scenario participants.`);
        await refreshScenario();
        return;
      }

      if (candidate.existingParticipant) {
        const participant = await updateScenarioParticipantMetadataOnServer({
          isActive: true,
          participantId: candidate.existingParticipant.id,
          scenarioId
        });
        setParticipants((current) =>
          current.map((entry) => (entry.id === participant.id ? participant : entry))
        );
        setFeedback(`Reactivated ${candidate.name} in this scenario.`);
        await refreshScenario();
        return;
      }

      const participant =
        candidate.rosterEntry.sourceType === "character"
          ? await addScenarioParticipantFromCharacterOnServer({
              characterId: candidate.rosterEntry.sourceId,
              controlledByUserId:
                getScenarioCharacterDefaultControllerId({
                  character: charactersById.get(candidate.rosterEntry.sourceId) ?? null,
                }) || null,
              joinSource: "gm_added",
              role: "player_character",
              scenarioId,
            })
          : await addScenarioParticipantFromEntityOnServer({
              entityId: candidate.rosterEntry.sourceId,
              joinSource: "gm_added",
              role: candidate.typeLabel === "Monster" ? "monster" : "npc",
              scenarioId,
            });

      setFeedback(`Added ${participant.snapshot.displayName} to the scenario.`);
      setParticipants((current) =>
        current.some((entry) => entry.id === participant.id) ? current : [...current, participant]
      );
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update scenario participant.",
      );
    }
  }

  async function handleCreateTemporaryActorFromTemplate() {
    const templateSource =
      templateSources.find((source) => source.entity.id === selectedTemplateSourceId) ??
      templateSources[0];
    const template = templateSource?.entity;

    if (!template) {
      setError("Choose a template source.");
      return;
    }

    try {
      setError(undefined);
      setFeedback(undefined);

      const participant = await addScenarioParticipantFromEntityOnServer({
        entityInput: buildScenarioActorInputFromTemplate({
          name: temporaryActorName.trim() || template.name,
          template
        }),
        isTemporary: true,
        joinSource: "gm_added",
        role: temporaryActorRole,
        scenarioId
      });

      setFeedback(`Created temporary actor ${participant.snapshot.displayName}.`);
      setTemporaryActorName("");
      setParticipants((current) =>
        current.some((entry) => entry.id === participant.id) ? current : [...current, participant]
      );
      await refreshScenario();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create temporary actor.");
    }
  }

  async function handleUpdateEncounterStatus(
    encounter: EncounterSession,
    status: EncounterStatus
  ) {
    try {
      setError(undefined);
      setFeedback(undefined);
      const updated = await updateEncounterOnServer({
        encounterId: encounter.id,
        session: {
          ...encounter,
          status,
          updatedAt: new Date().toISOString()
        }
      });

      setFeedback(`Updated encounter ${updated.title}.`);
      await refreshScenario();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update encounter.");
    }
  }

  async function handleEncounterParticipantToggle(
    encounter: EncounterSession,
    participant: ScenarioParticipant,
    member: boolean
  ) {
    try {
      setError(undefined);
      setFeedback(undefined);

      const participantId = `scenario-${participant.id}`;
      const existing = isParticipantInEncounter(encounter, participant);
      const nextParticipants = member
        ? existing
          ? encounter.participants
          : [...encounter.participants, buildEncounterParticipant(encounter, participant)]
        : encounter.participants.filter(
            (entry) => entry.scenarioParticipantId !== participant.id && entry.id !== participantId
          );

      await saveEncounterParticipants({
        encounter,
        feedbackMessage: `Updated participants for ${encounter.title}.`,
        participants: nextParticipants
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update encounter participants."
      );
    }
  }

  async function handleBulkEncounterAssignment(member: boolean) {
    const encounter = encounters.find((entry) => entry.id === selectedBulkEncounterId);
    const selectedParticipants = assignmentParticipants.filter((participant) =>
      selectedAssignmentParticipantIds.includes(participant.id)
    );

    if (!encounter || selectedParticipants.length === 0) {
      return;
    }

    try {
      setError(undefined);
      setFeedback(undefined);

      const selectedIds = new Set(selectedParticipants.map((participant) => participant.id));
      const nextParticipants = member
        ? selectedParticipants.reduce<EncounterParticipant[]>((current, participant) => {
            if (
              current.some(
                (entry) =>
                  entry.scenarioParticipantId === participant.id ||
                  entry.id === `scenario-${participant.id}`
              )
            ) {
              return current;
            }

            return [
              ...current,
              buildEncounterParticipant(
                {
                  ...encounter,
                  participants: current
                },
                participant
              )
            ];
          }, encounter.participants)
        : encounter.participants.filter((entry) => {
            const scenarioParticipantId =
              entry.scenarioParticipantId ??
              (entry.id.startsWith("scenario-") ? entry.id.slice("scenario-".length) : undefined);

            return !scenarioParticipantId || !selectedIds.has(scenarioParticipantId);
          });

      await saveEncounterParticipants({
        encounter,
        feedbackMessage: `${member ? "Assigned" : "Withdrew"} ${selectedParticipants.length} participant${
          selectedParticipants.length === 1 ? "" : "s"
        } ${member ? "to" : "from"} ${encounter.title}.`,
        participants: nextParticipants
      });
      setSelectedAssignmentParticipantIds([]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update bulk encounter assignment."
      );
    }
  }

  async function handleParticipantActiveToggle(participant: ScenarioParticipant, isActive: boolean) {
    try {
      setError(undefined);
      setFeedback(undefined);

      const updatedParticipant = await updateScenarioParticipantMetadataOnServer({
        isActive,
        participantId: participant.id,
        scenarioId
      });

      setParticipants((current) =>
        current.map((entry) => (entry.id === updatedParticipant.id ? updatedParticipant : entry))
      );
      setFeedback(`${updatedParticipant.snapshot.displayName} is now ${isActive ? "active" : "inactive"}.`);
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update participant status."
      );
    }
  }

  if (loading) {
    return <section>Loading scenario...</section>;
  }

  if (!scenario) {
    return <section>{error ?? "Scenario not found."}</section>;
  }

  const selectedTemplateSource = templateSources.find(
    (source) => source.entity.id === selectedTemplateSourceId
  ) ?? templateSources[0];

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
      <RememberedCampaignWorkspaceEffect
        campaignId={campaignId}
        encounterId={null}
        scenarioId={scenarioId}
        tab="scenario"
      />
      <div>
        {!embedded ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId,
                tab: "campaign",
              })}
            >
              Back to campaign
            </Link>
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId,
                scenarioId,
                tab: "gm-encounter",
              })}
            >
              Open GM encounter workspace
            </Link>
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId,
                scenarioId,
                tab: "player-encounter",
              })}
            >
              Open player encounter workspace
            </Link>
          </div>
        ) : null}
        <h1 style={{ marginBottom: "0.5rem" }}>{scenario.name}</h1>
      </div>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      <section
        aria-label="Scenario summary"
        style={{
          alignItems: "end",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "minmax(160px, 1fr) minmax(240px, 2fr) minmax(130px, 0.7fr) auto",
          padding: "0.85rem 1rem"
        }}
      >
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Name</span>
          <input onChange={(event) => setScenarioName(event.target.value)} value={scenarioName} />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Description</span>
          <input
            onChange={(event) => setScenarioDescription(event.target.value)}
            placeholder="No description yet."
            type="text"
            value={scenarioDescription}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Status</span>
          <select
            onChange={(event) => setScenarioStatus(event.target.value as Scenario["status"])}
            value={scenarioStatus}
          >
            <option value="draft">Draft</option>
            <option value="prepared">Prepared</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button onClick={() => void handleUpdateScenarioMetadata()} type="button">
          Update scenario
        </button>
      </section>

      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
          <h2 style={{ margin: 0 }}>Encounters</h2>
          <p style={{ margin: 0 }}>
            Create combat or roleplaying encounters on one scenario timeline. More than one
            encounter can be active at the same time.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <input
              onChange={(event) => setEncounterTitle(event.target.value)}
              placeholder="Encounter name"
              style={{ minWidth: 260, padding: "0.5rem" }}
              type="text"
              value={encounterTitle}
            />
            <select
              onChange={(event) => setEncounterKind(event.target.value as EncounterKind)}
              value={encounterKind}
            >
              <option value="combat">Combat</option>
              <option value="roleplay">Roleplaying</option>
            </select>
            <input
              onChange={(event) => setEncounterTimelineLabel(event.target.value)}
              placeholder="Timeline label (optional)"
              style={{ minWidth: 180, padding: "0.5rem" }}
              type="text"
              value={encounterTimelineLabel}
            />
            <input
              onChange={(event) => setEncounterDescription(event.target.value)}
              placeholder="Description / notes (optional)"
              style={{ minWidth: 240, padding: "0.5rem" }}
              type="text"
              value={encounterDescription}
            />
            <button
              disabled={encounterTitle.trim().length === 0}
              onClick={() => void handleCreateEncounter()}
              type="button"
            >
              Create encounter
            </button>
          </div>
          {encounters.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 920, width: "100%" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Name</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Type</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Timeline</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Participants</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Open</th>
                    <th style={{ padding: "0.5rem 0" }}>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedEncounters.map((encounter) => (
                    <tr key={encounter.id} style={{ borderBottom: "1px solid #eee8dc", verticalAlign: "top" }}>
                      <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                        <strong>{encounter.title}</strong>
                        {encounter.description ? (
                          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                            {encounter.description}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {encounter.kind === "roleplay" ? "Roleplaying" : "Combat"}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{encounter.status}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {encounter.timelineLabel ?? encounter.createdAt}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                        {encounter.participants.length}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <div style={{ display: "grid", gap: "0.35rem" }}>
                          <Link
                            href={buildCampaignWorkspaceHref({
                              campaignId,
                              encounterId: encounter.id,
                              scenarioId,
                              tab: "gm-encounter",
                            })}
                          >
                            GM
                          </Link>
                          <Link
                            href={buildCampaignWorkspaceHref({
                              campaignId,
                              encounterId: encounter.id,
                              scenarioId,
                              tab: "player-encounter",
                            })}
                          >
                            Player
                          </Link>
                        </div>
                      </td>
                      <td style={{ padding: "0.6rem 0" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {encounter.status === "active" ? (
                            <button
                              onClick={() => void handleUpdateEncounterStatus(encounter, "paused")}
                              type="button"
                            >
                              Pause
                            </button>
                          ) : encounter.status !== "archived" && encounter.status !== "complete" ? (
                            <button
                              onClick={() => void handleUpdateEncounterStatus(encounter, "active")}
                              type="button"
                            >
                              {encounter.status === "paused" ? "Resume" : "Start"}
                            </button>
                          ) : null}
                          {encounter.status !== "archived" ? (
                            <button
                              onClick={() => void handleUpdateEncounterStatus(encounter, "archived")}
                              type="button"
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>No encounters have been created for this scenario yet.</div>
          )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Encounter Assignment</h2>
        <p style={{ margin: 0 }}>
          Assign concrete scenario participants to planned, active, or paused encounters. Click a
          participant name for scenario state and encounter-specific detail placeholders.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <select
            aria-label="Encounter assignment type filter"
            onChange={(event) =>
              setParticipantTypeFilter(event.target.value as ScenarioParticipantTypeFilter)
            }
            value={participantTypeFilter}
          >
            {participantTypeFilterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Encounter assignment civilization filter"
            onChange={(event) => setParticipantCivilizationFilter(event.target.value)}
            value={participantCivilizationFilter}
          >
            <option value="">All civilizations</option>
            {participantCivilizationOptions.map((civilization) => (
              <option key={civilization} value={civilization}>
                {civilization}
              </option>
            ))}
          </select>
          <select
            aria-label="Encounter assignment profession filter"
            onChange={(event) => setParticipantProfessionFilter(event.target.value)}
            value={participantProfessionFilter}
          >
            <option value="">All professions</option>
            {participantProfessionOptions.map((profession) => (
              <option key={profession} value={profession}>
                {profession}
              </option>
            ))}
          </select>
          <select
            aria-label="Encounter assignment skill group filter"
            onChange={(event) => setParticipantSkillGroupFilter(event.target.value)}
            value={participantSkillGroupFilter}
          >
            <option value="">All skill groups</option>
            {participantSkillGroupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <input
            aria-label="Search encounter assignment participants"
            onChange={(event) => setParticipantSearch(event.target.value)}
            placeholder="Search encounter participants"
            style={{ minWidth: 220 }}
            type="search"
            value={participantSearch}
          />
        </div>
        {concreteParticipants.length > 0 ? (
          <>
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <select
                aria-label="Bulk assignment encounter"
                disabled={nonArchivedEncounters.length === 0}
                onChange={(event) => setBulkEncounterId(event.target.value)}
                value={selectedBulkEncounterId}
              >
                {nonArchivedEncounters.length === 0 ? (
                  <option value="">No assignable encounters</option>
                ) : null}
                {nonArchivedEncounters.map((encounter) => (
                  <option key={encounter.id} value={encounter.id}>
                    {encounter.title}
                  </option>
                ))}
              </select>
              <button
                disabled={selectedAssignmentParticipantIds.length === 0 || !selectedBulkEncounterId}
                onClick={() => void handleBulkEncounterAssignment(true)}
                type="button"
              >
                Assign selected
              </button>
              <button
                disabled={selectedAssignmentParticipantIds.length === 0 || !selectedBulkEncounterId}
                onClick={() => void handleBulkEncounterAssignment(false)}
                type="button"
              >
                Withdraw selected
              </button>
              <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {selectedAssignmentParticipantIds.length} selected
              </span>
            </div>
            <div style={{ maxHeight: "36rem", overflow: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 620 + nonArchivedEncounters.length * 120, width: "100%" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem 0.5rem 0", position: "sticky", textAlign: "center", top: 0 }}>Select</th>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Name</th>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Type</th>
                    {nonArchivedEncounters.map((encounter) => (
                      <th
                        key={encounter.id}
                        style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", textAlign: "center", top: 0 }}
                        title={encounter.title}
                      >
                        {encounter.title.length > 16 ? `${encounter.title.slice(0, 15)}...` : encounter.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignmentParticipants.map((participant) => {
                    const participantMetadata = getConcreteParticipantMetadata(participant);
                    const expanded = expandedAssignmentParticipantIds.includes(participant.id);
                    const joinedEncounters = nonArchivedEncounters.filter((encounter) =>
                      isParticipantInEncounter(encounter, participant)
                    );

                    return (
                      <Fragment key={participant.id}>
                        <tr style={{ borderBottom: "1px solid #eee8dc" }}>
                          <td style={{ padding: "0.6rem 0.75rem 0.6rem 0", textAlign: "center" }}>
                            <input
                              aria-label={`Select ${participant.snapshot.displayName} for bulk encounter assignment`}
                              checked={selectedAssignmentParticipantIds.includes(participant.id)}
                              onChange={(event) =>
                                setSelectedAssignmentParticipantIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, participant.id])]
                                    : current.filter((id) => id !== participant.id)
                                )
                              }
                              type="checkbox"
                            />
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem" }}>
                            <button
                              aria-expanded={expanded}
                              aria-label={`Toggle ${participant.snapshot.displayName} assignment details`}
                              onClick={() =>
                                setExpandedAssignmentParticipantIds((current) =>
                                  current.includes(participant.id)
                                    ? current.filter((id) => id !== participant.id)
                                    : [...current, participant.id]
                                )
                              }
                              style={{
                                background: "transparent",
                                border: 0,
                                color: "#184f3d",
                                cursor: "pointer",
                                font: "inherit",
                                fontWeight: 700,
                                padding: 0,
                                textAlign: "left",
                                textDecoration: "underline"
                              }}
                              type="button"
                            >
                              {participant.snapshot.displayName}
                            </button>
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem" }}>{participantMetadata.typeLabel}</td>
                          {nonArchivedEncounters.map((encounter) => (
                            <td key={encounter.id} style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                              <input
                                aria-label={`Toggle ${participant.snapshot.displayName} in ${encounter.title}`}
                                checked={isParticipantInEncounter(encounter, participant)}
                                onChange={(event) =>
                                  void handleEncounterParticipantToggle(
                                    encounter,
                                    participant,
                                    event.target.checked
                                  )
                                }
                                type="checkbox"
                              />
                            </td>
                          ))}
                        </tr>
                        {expanded ? (
                          <tr key={`${participant.id}-details`}>
                            <td colSpan={3 + nonArchivedEncounters.length} style={{ background: "#fbfaf6", padding: "0.75rem 1rem" }}>
                              <div style={{ display: "grid", gap: "0.5rem" }}>
                                <strong>Encounter-specific details</strong>
                                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                                  <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                                    <input
                                      aria-label={`Toggle ${participant.snapshot.displayName} active scenario status`}
                                      checked={participant.isActive}
                                      onChange={(event) =>
                                        void handleParticipantActiveToggle(participant, event.target.checked)
                                      }
                                      type="checkbox"
                                    />
                                    Active
                                  </label>
                                  <span>Controller: {formatUserLabel(participant.controlledByUserId)}</span>
                                  <span>Status: {participant.isActive ? "Active" : "Inactive"}</span>
                                </div>
                                {joinedEncounters.length > 0 ? (
                                  joinedEncounters.map((encounter) => (
                                    <div key={encounter.id}>
                                      <strong>{encounter.title}:</strong>{" "}
                                      appearance, disguise, clothing/equipment notes, encounter role,
                                      visibility notes, and GM-only notes will live on this encounter
                                      participant entry.
                                    </div>
                                  ))
                                ) : (
                                  <div>
                                    This participant is not assigned to a non-archived encounter yet.
                                    Assign them to an encounter before recording encounter-specific details.
                                  </div>
                                )}
                                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                                  Editing these fields is deferred; this placeholder is intentionally here
                                  in Encounter Assignment, not a separate Scenario Participants roster.
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {assignmentParticipants.length === 0 ? (
                <div style={{ padding: "0.75rem 0" }}>
                  No concrete participants match the current encounter assignment filters.
                </div>
              ) : null}
            </div>
          </>
        ) : concreteParticipants.length === 0 ? (
          <div>Add a campaign roster member or create a temporary actor before assigning encounters.</div>
        ) : (
          <div>No concrete participants match the current encounter assignment filters.</div>
        )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Add from campaign roster</h2>
        <p style={{ margin: 0 }}>
          Add existing concrete campaign roster members to this scenario. Templates stay in
          Template sources below.
        </p>
        {scenarioRosterCandidates.length > 0 ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <select
                aria-label="Campaign roster type filter"
                onChange={(event) => setRosterTypeFilter(event.target.value as ScenarioParticipantTypeFilter)}
                value={rosterTypeFilter}
              >
                {rosterTypeFilterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Campaign roster controller filter"
                onChange={(event) => setRosterControllerFilter(event.target.value as ScenarioControllerFilter)}
                value={rosterControllerFilter}
              >
                <option value="all">All controllers</option>
                <option value="players">Players</option>
                <option value="gms">GMs</option>
              </select>
              <select
                aria-label="Campaign roster civilization filter"
                onChange={(event) => setRosterCivilizationFilter(event.target.value)}
                value={rosterCivilizationFilter}
              >
                <option value="">All civilizations</option>
                {participantCivilizationOptions.map((civilization) => (
                  <option key={civilization} value={civilization}>
                    {civilization}
                  </option>
                ))}
              </select>
              <select
                aria-label="Campaign roster profession filter"
                onChange={(event) => setRosterProfessionFilter(event.target.value)}
                value={rosterProfessionFilter}
              >
                <option value="">All professions</option>
                {participantProfessionOptions.map((profession) => (
                  <option key={profession} value={profession}>
                    {profession}
                  </option>
                ))}
              </select>
              <select
                aria-label="Campaign roster skill group filter"
                onChange={(event) => setRosterSkillGroupFilter(event.target.value)}
                value={rosterSkillGroupFilter}
              >
                <option value="">All skill groups</option>
                {participantSkillGroupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <input
                aria-label="Search campaign roster candidates"
                onChange={(event) => setRosterSearch(event.target.value)}
                placeholder="Search campaign roster"
                style={{ minWidth: 220 }}
                type="search"
                value={rosterSearch}
              />
            </div>
            <div style={{ maxHeight: "24rem", overflow: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 780, width: "100%" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem 0.5rem 0", position: "sticky", textAlign: "center", top: 0 }}>Add</th>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Name</th>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Type</th>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Source</th>
                    <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Controller</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScenarioRosterCandidates.map((candidate) => (
                    <tr key={candidate.rosterEntry.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                      <td style={{ padding: "0.6rem 0.75rem 0.6rem 0", textAlign: "center" }}>
                        <input
                          aria-label={`Toggle ${candidate.name} scenario participation`}
                          checked={false}
                          onChange={(event) =>
                            void handleRosterParticipantToggle(candidate, event.target.checked)
                          }
                          type="checkbox"
                        />
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <strong>{candidate.name}</strong>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.typeLabel}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.sourceKind}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.controllerLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredScenarioRosterCandidates.length === 0 ? (
                <div style={{ padding: "0.75rem 0" }}>
                  No campaign roster candidates match the current filters.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div>No campaign roster entries are available. Add PCs, NPCs, or templates to the campaign roster first.</div>
        )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Template sources</h2>
        <p style={{ margin: 0 }}>
          Templates create scenario-local temporary actors. The template itself is not an active
          scenario participant.
        </p>
        {templateSources.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", maxHeight: "28rem", overflowY: "auto" }}>
            <select
              onChange={(event) => setSelectedTemplateSourceId(event.target.value)}
              style={{ minWidth: 240 }}
              value={selectedTemplateSource?.entity.id ?? ""}
            >
              {templateSources.map((source) => (
                <option key={source.entity.id} value={source.entity.id}>
                  {source.label}
                </option>
              ))}
            </select>
            <input
              onChange={(event) => setTemporaryActorName(event.target.value)}
              placeholder="Temporary actor name override"
              style={{ minWidth: 240 }}
              value={temporaryActorName}
            />
            <select
              onChange={(event) =>
                setTemporaryActorRole(event.target.value as ScenarioParticipant["role"])
              }
              value={temporaryActorRole}
            >
              <option value="npc">NPC</option>
              <option value="monster">Monster</option>
              <option value="animal">Animal</option>
              <option value="neutral">Neutral</option>
              <option value="ally">Ally</option>
              <option value="enemy">Enemy</option>
            </select>
            <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
              <span>Count</span>
              <input
                aria-label="Temporary actor count"
                max={1}
                min={1}
                onChange={(event) => setTemporaryActorCount(Math.min(1, Math.max(1, Number(event.target.value) || 1)))}
                style={{ width: "4rem" }}
                title="Bulk temporary actor creation is planned; this pass supports one actor at a time."
                type="number"
                value={temporaryActorCount}
              />
            </label>
            <button onClick={() => void handleCreateTemporaryActorFromTemplate()} type="button">
              Create temporary actor
            </button>
          </div>
        ) : (
          <div>No template sources are available.</div>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Event log</h2>
        {eventLogs.length > 0 ? (
          eventLogs.map((eventLog) => (
            <div
              key={eventLog.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.25rem",
                padding: "0.75rem 1rem"
              }}
            >
              <strong>{formatEventType(eventLog.eventType)}</strong>
              <div>{eventLog.summary}</div>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {formatShortDateTime(eventLog.createdAt)}
              </div>
            </div>
          ))
        ) : (
          <div>No event log entries yet.</div>
        )}
      </section>
    </section>
  );
}
