"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  existingParticipant?: ScenarioParticipant;
  member: boolean;
  name: string;
  professionLabel: string;
  rosterEntry: CampaignRosterEntry;
  skillGroups: string[];
  sourceKind: string;
  statusFilter: ScenarioParticipantMembershipFilter;
  typeFilter: ScenarioParticipantTypeFilter;
  typeLabel: string;
}

interface TemplateSource {
  entity: ReusableEntity;
  label: string;
}

type ScenarioParticipantMembershipFilter = "all" | "active" | "available" | "inactive";
type ScenarioParticipantTypeFilter = "all" | "pc" | "npc" | "temporary" | "monster" | "other";

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

function getScenarioParticipantStatusFilter(
  participant: ScenarioParticipant | undefined
): ScenarioParticipantMembershipFilter {
  if (!participant) {
    return "available";
  }

  return participant.isActive ? "active" : "inactive";
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
  const [participantDrafts, setParticipantDrafts] = useState<
    Record<
      string,
      {
        controlledByUserId: string;
        displayOrder: string;
        factionId: string;
        isActive: boolean;
        roleTag: string;
        tacticalGroupId: string;
      }
    >
  >({});
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [encounterTitle, setEncounterTitle] = useState("");
  const [encounterDescription, setEncounterDescription] = useState("");
  const [encounterKind, setEncounterKind] = useState<EncounterKind>("combat");
  const [encounterTimelineLabel, setEncounterTimelineLabel] = useState("");
  const [selectedTemplateSourceId, setSelectedTemplateSourceId] = useState("");
  const [temporaryActorName, setTemporaryActorName] = useState("");
  const [temporaryActorRole, setTemporaryActorRole] = useState<ScenarioParticipant["role"]>("npc");

  const [participantMembershipFilter, setParticipantMembershipFilter] =
    useState<ScenarioParticipantMembershipFilter>("all");
  const [participantTypeFilter, setParticipantTypeFilter] =
    useState<ScenarioParticipantTypeFilter>("all");
  const [participantCivilizationFilter, setParticipantCivilizationFilter] = useState("");
  const [participantProfessionFilter, setParticipantProfessionFilter] = useState("");
  const [participantSkillGroupFilter, setParticipantSkillGroupFilter] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");

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

          return {
            civilizationLabel:
              character
                ? getCivilizationDisplayName(character.build.societyId)
                : getCivilizationDisplayName(entitySnapshotMetadata.civilizationLabel),
            existingParticipant,
            member: Boolean(existingParticipant?.isActive),
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
            statusFilter: getScenarioParticipantStatusFilter(existingParticipant),
            typeFilter: participantType.typeFilter,
            typeLabel: participantType.label
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    [charactersById, entitiesById, participantsByRosterSource, roster]
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
      (participant) => !(participant.entityId && templateIds.has(participant.entityId))
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
  const filteredScenarioRosterCandidates = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();

    return scenarioRosterCandidates.filter((candidate) => {
      const matchesMembership =
        participantMembershipFilter === "all" || candidate.statusFilter === participantMembershipFilter;
      const matchesType = participantTypeFilter === "all" || candidate.typeFilter === participantTypeFilter;
      const matchesCivilization =
        !participantCivilizationFilter || candidate.civilizationLabel === participantCivilizationFilter;
      const matchesProfession =
        !participantProfessionFilter || candidate.professionLabel === participantProfessionFilter;
      const matchesSkillGroup =
        !participantSkillGroupFilter || candidate.skillGroups.includes(participantSkillGroupFilter);
      const matchesSearch =
        search.length === 0 ||
        candidate.name.toLowerCase().includes(search) ||
        candidate.typeLabel.toLowerCase().includes(search) ||
        candidate.sourceKind.toLowerCase().includes(search) ||
        candidate.civilizationLabel.toLowerCase().includes(search) ||
        candidate.professionLabel.toLowerCase().includes(search) ||
        candidate.skillGroups.some((group) => group.toLowerCase().includes(search));

      return (
        matchesMembership &&
        matchesType &&
        matchesCivilization &&
        matchesProfession &&
        matchesSkillGroup &&
        matchesSearch
      );
    });
  }, [
    participantCivilizationFilter,
    participantMembershipFilter,
    participantProfessionFilter,
    participantSearch,
    participantSkillGroupFilter,
    participantTypeFilter,
    scenarioRosterCandidates
  ]);
  const filteredConcreteParticipants = useMemo(() => {
    const search = participantSearch.trim().toLowerCase();

    return concreteParticipants.filter((participant) => {
      const metadata = getConcreteParticipantMetadata(participant);
      const statusFilter = getScenarioParticipantStatusFilter(participant);
      const matchesMembership =
        participantMembershipFilter === "all" || statusFilter === participantMembershipFilter;
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
        metadata.civilizationLabel.toLowerCase().includes(search) ||
        metadata.professionLabel.toLowerCase().includes(search) ||
        metadata.skillGroups.some((group) => group.toLowerCase().includes(search));

      return (
        matchesMembership &&
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
    participantMembershipFilter,
    participantProfessionFilter,
    participantSearch,
    participantSkillGroupFilter,
    participantTypeFilter
  ]);

  function formatUserLabel(userId: string | undefined): string {
    if (!userId) {
      return "GM / unassigned";
    }

    const user = usersById.get(userId);
    if (!user) {
      return userId;
    }

    if (user.displayName) {
      return `${user.displayName} (${user.email})`;
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
    setParticipantDrafts(
      Object.fromEntries(
        nextParticipants.map((participant) => [
          participant.id,
          {
            controlledByUserId: participant.controlledByUserId ?? "",
            displayOrder:
              participant.displayOrder === undefined ? "" : String(participant.displayOrder),
            factionId: participant.factionId ?? "",
            isActive: participant.isActive,
            roleTag: participant.roleTag ?? "",
            tacticalGroupId: participant.tacticalGroupId ?? ""
          }
        ])
      )
    );
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
      const nextEncounterParticipant: EncounterParticipant = {
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
      const existing = encounter.participants.some(
        (entry) => entry.scenarioParticipantId === participant.id || entry.id === participantId
      );
      const nextParticipants = member
        ? existing
          ? encounter.participants
          : [...encounter.participants, nextEncounterParticipant]
        : encounter.participants.filter(
            (entry) => entry.scenarioParticipantId !== participant.id && entry.id !== participantId
          );

      await updateEncounterOnServer({
        encounterId: encounter.id,
        session: {
          ...encounter,
          participants: nextParticipants,
          updatedAt: new Date().toISOString()
        }
      });

      setFeedback(`Updated participants for ${encounter.title}.`);
      setEncounters((current) =>
        current.map((entry) =>
          entry.id === encounter.id ? { ...encounter, participants: nextParticipants } : entry
        )
      );
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update encounter participants."
      );
    }
  }

  async function handleSaveParticipantMetadata(participantId: string) {
    const draft = participantDrafts[participantId];

    if (!draft) {
      return;
    }

    try {
      setError(undefined);
      setFeedback(undefined);

      const participant = await updateScenarioParticipantMetadataOnServer({
        controlledByUserId: draft.controlledByUserId || null,
        displayOrder:
          draft.displayOrder.trim().length > 0
            ? Number.parseInt(draft.displayOrder, 10)
            : null,
        factionId: draft.factionId.trim() || null,
        isActive: draft.isActive,
        participantId,
        roleTag: draft.roleTag.trim() || null,
        scenarioId,
        tacticalGroupId: draft.tacticalGroupId.trim() || null
      });

      setFeedback(`Updated control assignment for ${participant.snapshot.displayName}.`);
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update participant control metadata."
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

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Scenario summary</h2>
        {!embedded ? (
          <p style={{ margin: 0 }}>
            Scenarios sit inside a campaign and handle session-level setup, participant assignment,
            visibility/state controls, and links onward to encounters.
          </p>
        ) : null}
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Name</span>
          <input onChange={(event) => setScenarioName(event.target.value)} value={scenarioName} />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Description</span>
          <textarea
            onChange={(event) => setScenarioDescription(event.target.value)}
            placeholder="No description yet."
            rows={3}
            value={scenarioDescription}
          />
        </label>
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
        <div>
          <button onClick={() => void handleUpdateScenarioMetadata()} type="button">
            Update scenario
          </button>
        </div>
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
        <h2 style={{ margin: 0 }}>Scenario participants</h2>
        <p style={{ margin: 0 }}>
          Pull concrete PCs, NPCs, and monsters from the campaign roster into this scenario.
          Templates are handled as sources for temporary scenario actors below.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <select
            aria-label="Scenario participant status filter"
            onChange={(event) =>
              setParticipantMembershipFilter(event.target.value as ScenarioParticipantMembershipFilter)
            }
            value={participantMembershipFilter}
          >
            <option value="all">All</option>
            <option value="active">In scenario / Active</option>
            <option value="available">Available / Not in scenario</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            aria-label="Scenario participant type filter"
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
            aria-label="Scenario participant civilization filter"
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
            aria-label="Scenario participant profession filter"
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
            aria-label="Scenario participant skill group filter"
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
            aria-label="Search scenario participants"
            onChange={(event) => setParticipantSearch(event.target.value)}
            placeholder="Search scenario participants"
            style={{ minWidth: 220 }}
            type="search"
            value={participantSearch}
          />
        </div>
        {scenarioRosterCandidates.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 780, width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem 0.5rem 0", textAlign: "center" }}>In scenario</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Type</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Source</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Controller</th>
                  <th style={{ padding: "0.5rem 0" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredScenarioRosterCandidates.map((candidate) => (
                  <tr key={candidate.rosterEntry.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0", textAlign: "center" }}>
                      <input
                        aria-label={`Toggle ${candidate.name} scenario participation`}
                        checked={candidate.member}
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
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {formatUserLabel(candidate.existingParticipant?.controlledByUserId)}
                    </td>
                    <td style={{ padding: "0.6rem 0" }}>
                      {candidate.existingParticipant
                        ? candidate.existingParticipant.isActive
                          ? "Active"
                          : "Inactive"
                        : "Available"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredScenarioRosterCandidates.length === 0 ? (
              <div style={{ padding: "0.75rem 0" }}>
                No campaign roster candidates match the current scenario participant filters.
              </div>
            ) : null}
          </div>
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
          <>
            <select
              onChange={(event) => setSelectedTemplateSourceId(event.target.value)}
              value={selectedTemplateSource?.entity.id ?? ""}
            >
              {templateSources.map((source) => (
                <option key={source.entity.id} value={source.entity.id}>
                  {source.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <input
                onChange={(event) => setTemporaryActorName(event.target.value)}
                placeholder="Temporary actor name override"
                style={{ minWidth: 260 }}
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
              <button onClick={() => void handleCreateTemporaryActorFromTemplate()} type="button">
                Create temporary actor
              </button>
            </div>
          </>
        ) : (
          <div>No template sources are available.</div>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Concrete participant roster</h2>
        {concreteParticipants.length > 0 ? (
          filteredConcreteParticipants.map((participant) => {
            const participantMetadata = getConcreteParticipantMetadata(participant);

            return (
              <div
                key={participant.id}
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "0.35rem",
                  padding: "1rem"
                }}
              >
                <strong>{participant.snapshot.displayName}</strong>
                <div>
                  {participantMetadata.typeLabel} · {participant.isActive ? "Active" : "Inactive"}
                </div>
              <div>
                Controller: {formatUserLabel(participant.controlledByUserId)}
                {participant.role === "player_character" && participant.controlledByUserId ? (
                  <> · Active controlled character</>
                ) : null}
              </div>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                Source trace: participant {participant.id}
                {participant.characterId ? ` · character ${participant.characterId}` : ""}
                {participant.entityId ? ` · entity ${participant.entityId}` : ""}
              </div>
              <div>
                HP: {participant.state.health.currentHp}/{participant.state.health.maxHp}
              </div>
              <div>Conditions: {participant.state.conditions.length}</div>
              <div
                style={{
                  borderTop: "1px solid #e7e2d7",
                  display: "grid",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                  paddingTop: "0.75rem"
                }}
              >
                <strong style={{ fontSize: "0.95rem" }}>Encounters</strong>
                {nonArchivedEncounters.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {nonArchivedEncounters.map((encounter) => (
                      <label
                        key={encounter.id}
                        style={{
                          alignItems: "center",
                          border: "1px solid #d9ddd8",
                          borderRadius: 999,
                          display: "flex",
                          gap: "0.35rem",
                          padding: "0.25rem 0.6rem",
                          whiteSpace: "nowrap"
                        }}
                      >
                        <input
                          checked={encounter.participants.some(
                            (entry) => entry.scenarioParticipantId === participant.id
                          )}
                          onChange={(event) =>
                            void handleEncounterParticipantToggle(
                              encounter,
                              participant,
                              event.target.checked
                            )
                          }
                          type="checkbox"
                        />
                        {encounter.title}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>No planned, active, or paused encounters are available.</div>
                )}
              </div>
              <div
                style={{
                  borderTop: "1px solid #e7e2d7",
                  display: "grid",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                  paddingTop: "0.75rem"
                }}
              >
                <strong style={{ fontSize: "0.95rem" }}>Control and grouping</strong>
                <div
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(220px, 1.4fr) repeat(4, minmax(120px, 1fr))"
                  }}
                >
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Assigned controller</span>
                    <select
                      onChange={(event) =>
                        setParticipantDrafts((current) => ({
                          ...current,
                          [participant.id]: {
                            ...current[participant.id],
                            controlledByUserId: event.target.value
                          }
                        }))
                      }
                      value={participantDrafts[participant.id]?.controlledByUserId ?? ""}
                    >
                      <option value="">GM / unassigned</option>
                      {assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName ? `${user.displayName} (${user.email})` : user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Faction / side</span>
                    <input
                      onChange={(event) =>
                        setParticipantDrafts((current) => ({
                          ...current,
                          [participant.id]: {
                            ...current[participant.id],
                            factionId: event.target.value
                          }
                        }))
                      }
                      type="text"
                      value={participantDrafts[participant.id]?.factionId ?? ""}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Tactical group</span>
                    <input
                      onChange={(event) =>
                        setParticipantDrafts((current) => ({
                          ...current,
                          [participant.id]: {
                            ...current[participant.id],
                            tacticalGroupId: event.target.value
                          }
                        }))
                      }
                      type="text"
                      value={participantDrafts[participant.id]?.tacticalGroupId ?? ""}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Role tag</span>
                    <input
                      onChange={(event) =>
                        setParticipantDrafts((current) => ({
                          ...current,
                          [participant.id]: {
                            ...current[participant.id],
                            roleTag: event.target.value
                          }
                        }))
                      }
                      type="text"
                      value={participantDrafts[participant.id]?.roleTag ?? ""}
                    />
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.85rem" }}>Display order</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        setParticipantDrafts((current) => ({
                          ...current,
                          [participant.id]: {
                            ...current[participant.id],
                            displayOrder: event.target.value
                          }
                        }))
                      }
                      type="number"
                      value={participantDrafts[participant.id]?.displayOrder ?? ""}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                  <label style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                    <input
                      checked={participantDrafts[participant.id]?.isActive ?? participant.isActive}
                      onChange={(event) =>
                        setParticipantDrafts((current) => ({
                          ...current,
                          [participant.id]: {
                            ...current[participant.id],
                            isActive: event.target.checked
                          }
                        }))
                      }
                      type="checkbox"
                    />
                    Participant active in scenario
                  </label>
                  <button onClick={() => void handleSaveParticipantMetadata(participant.id)} type="button">
                    Save assignment
                  </button>
                </div>
              </div>
              </div>
            );
          })
        ) : (
          <div>No participants yet.</div>
        )}
        {concreteParticipants.length > 0 && filteredConcreteParticipants.length === 0 ? (
          <div>No concrete participants match the current scenario participant filters.</div>
        ) : null}
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
