"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AuthUser } from "@glantri/auth";
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
} from "@/lib/api/localServiceClient";
import {
  buildScenarioActorInputFromTemplate,
  getCampaignActorMetadata,
} from "@/lib/campaigns/campaignActors";
import RememberedCampaignWorkspaceEffect from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import type { ServerCharacterRecord } from "@/lib/api/localServiceClient";
import { getScenarioCharacterDefaultControllerId } from "@/lib/campaigns/scenarioCharacters";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

import { ScenarioCampaignRosterPickerSection } from "./components/ScenarioCampaignRosterPickerSection";
import { ScenarioEncounterAssignmentSection } from "./components/ScenarioEncounterAssignmentSection";
import { ScenarioEncountersSection } from "./components/ScenarioEncountersSection";
import { ScenarioEventLogSection } from "./components/ScenarioEventLogSection";
import { ScenarioSummarySection } from "./components/ScenarioSummarySection";
import { ScenarioTemplateSourcesSection } from "./components/ScenarioTemplateSourcesSection";
import {
  formatEntityKind,
  getCivilizationDisplayName,
  getConcreteParticipantMetadata,
  readSnapshotMetadata
} from "./components/scenarioScreenHelpers";
import type {
  ScenarioControllerFilter,
  ScenarioParticipantTypeFilter,
  ScenarioRosterCandidate,
  TemplateSource
} from "./components/scenarioScreenTypes";

interface ScenarioDetailPageContentProps {
  campaignId: string;
  embedded?: boolean;
  scenarioId: string;
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
        participantMembershipMode: "explicit",
        participants: input.participants,
        updatedAt: new Date().toISOString()
      }
    });

    setFeedback(input.feedbackMessage);
    setEncounters((current) =>
      current.map((entry) =>
        entry.id === input.encounter.id
          ? {
              ...input.encounter,
              participantMembershipMode: "explicit",
              participants: input.participants,
            }
          : entry
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
                tab: "encounter",
              })}
            >
              Open encounter workspace
            </Link>
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId,
                scenarioId,
                tab: "skill-rolls",
              })}
            >
              Open skill rolls
            </Link>
          </div>
        ) : null}
        <h1 style={{ marginBottom: "0.5rem" }}>{scenario.name}</h1>
      </div>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      <ScenarioSummarySection
        onDescriptionChange={setScenarioDescription}
        onNameChange={setScenarioName}
        onStatusChange={setScenarioStatus}
        onUpdate={() => void handleUpdateScenarioMetadata()}
        scenarioDescription={scenarioDescription}
        scenarioName={scenarioName}
        scenarioStatus={scenarioStatus}
      />

      <ScenarioEncountersSection
        campaignId={campaignId}
        encounterDescription={encounterDescription}
        encounterKind={encounterKind}
        encounterTimelineLabel={encounterTimelineLabel}
        encounterTitle={encounterTitle}
        onCreateEncounter={() => void handleCreateEncounter()}
        onDescriptionChange={setEncounterDescription}
        onKindChange={setEncounterKind}
        onTimelineLabelChange={setEncounterTimelineLabel}
        onTitleChange={setEncounterTitle}
        onUpdateEncounterStatus={(encounter, status) =>
          void handleUpdateEncounterStatus(encounter, status)
        }
        orderedEncounters={orderedEncounters}
        scenarioId={scenarioId}
      />

      <ScenarioEncounterAssignmentSection
        assignmentParticipants={assignmentParticipants}
        concreteParticipants={concreteParticipants}
        expandedAssignmentParticipantIds={expandedAssignmentParticipantIds}
        formatUserLabel={formatUserLabel}
        isParticipantInEncounter={isParticipantInEncounter}
        nonArchivedEncounters={nonArchivedEncounters}
        onBulkEncounterAssignment={(member) => void handleBulkEncounterAssignment(member)}
        onBulkEncounterIdChange={setBulkEncounterId}
        onEncounterParticipantToggle={(encounter, participant, member) =>
          void handleEncounterParticipantToggle(encounter, participant, member)
        }
        onParticipantActiveToggle={(participant, isActive) =>
          void handleParticipantActiveToggle(participant, isActive)
        }
        onParticipantCivilizationFilterChange={setParticipantCivilizationFilter}
        onParticipantProfessionFilterChange={setParticipantProfessionFilter}
        onParticipantSearchChange={setParticipantSearch}
        onParticipantSkillGroupFilterChange={setParticipantSkillGroupFilter}
        onParticipantTypeFilterChange={setParticipantTypeFilter}
        participantCivilizationFilter={participantCivilizationFilter}
        participantCivilizationOptions={participantCivilizationOptions}
        participantProfessionFilter={participantProfessionFilter}
        participantProfessionOptions={participantProfessionOptions}
        participantSearch={participantSearch}
        participantSkillGroupFilter={participantSkillGroupFilter}
        participantSkillGroupOptions={participantSkillGroupOptions}
        participantTypeFilter={participantTypeFilter}
        participantTypeFilterOptions={participantTypeFilterOptions}
        selectedAssignmentParticipantIds={selectedAssignmentParticipantIds}
        selectedBulkEncounterId={selectedBulkEncounterId}
        setExpandedAssignmentParticipantIds={setExpandedAssignmentParticipantIds}
        setSelectedAssignmentParticipantIds={setSelectedAssignmentParticipantIds}
      />

      <ScenarioCampaignRosterPickerSection
        filteredScenarioRosterCandidates={filteredScenarioRosterCandidates}
        onRosterCivilizationFilterChange={setRosterCivilizationFilter}
        onRosterControllerFilterChange={setRosterControllerFilter}
        onRosterParticipantToggle={(candidate, member) =>
          void handleRosterParticipantToggle(candidate, member)
        }
        onRosterProfessionFilterChange={setRosterProfessionFilter}
        onRosterSearchChange={setRosterSearch}
        onRosterSkillGroupFilterChange={setRosterSkillGroupFilter}
        onRosterTypeFilterChange={setRosterTypeFilter}
        participantCivilizationOptions={participantCivilizationOptions}
        participantProfessionOptions={participantProfessionOptions}
        participantSkillGroupOptions={participantSkillGroupOptions}
        rosterCivilizationFilter={rosterCivilizationFilter}
        rosterControllerFilter={rosterControllerFilter}
        rosterProfessionFilter={rosterProfessionFilter}
        rosterSearch={rosterSearch}
        rosterSkillGroupFilter={rosterSkillGroupFilter}
        rosterTypeFilter={rosterTypeFilter}
        rosterTypeFilterOptions={rosterTypeFilterOptions}
        scenarioRosterCandidates={scenarioRosterCandidates}
      />

      <ScenarioTemplateSourcesSection
        onCreateTemporaryActor={() => void handleCreateTemporaryActorFromTemplate()}
        onSelectedTemplateSourceIdChange={setSelectedTemplateSourceId}
        onTemporaryActorCountChange={setTemporaryActorCount}
        onTemporaryActorNameChange={setTemporaryActorName}
        onTemporaryActorRoleChange={setTemporaryActorRole}
        selectedTemplateSource={selectedTemplateSource}
        temporaryActorCount={temporaryActorCount}
        temporaryActorName={temporaryActorName}
        temporaryActorRole={temporaryActorRole}
        templateSources={templateSources}
      />

      <ScenarioEventLogSection eventLogs={eventLogs} />
    </section>
  );
}
