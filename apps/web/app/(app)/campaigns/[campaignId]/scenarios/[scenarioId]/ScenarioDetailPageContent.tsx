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
  updateScenarioLiveStateOnServer,
  updateScenarioOnServer
} from "../../../../../../src/lib/api/localServiceClient";
import {
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
  existingParticipant?: ScenarioParticipant;
  member: boolean;
  name: string;
  rosterEntry: CampaignRosterEntry;
  sourceKind: string;
  typeLabel: string;
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

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioStatus, setScenarioStatus] = useState<Scenario["status"]>("draft");
  const [roundNumber, setRoundNumber] = useState("1");
  const [phase, setPhase] = useState<"1" | "2">("1");
  const [combatStatus, setCombatStatus] = useState<
    NonNullable<Scenario["liveState"]>["combatStatus"]
  >("not_started");
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
        .map((entry) => {
          const character = entry.sourceType === "character" ? charactersById.get(entry.sourceId) : undefined;
          const entity = entry.sourceType === "reusableEntity" || entry.sourceType === "template"
            ? entitiesById.get(entry.sourceId)
            : undefined;
          const existingParticipant = participantsByRosterSource.get(`${entry.sourceType}:${entry.sourceId}`);
          const name = character?.name ?? entity?.name ?? entry.labelSnapshot ?? "Unknown roster member";
          const sourceKind =
            entry.sourceType === "character"
              ? "Character"
              : entity
                ? `${entity.kind.charAt(0).toUpperCase()}${entity.kind.slice(1)}`
                : entry.sourceType;

          return {
            existingParticipant,
            member: Boolean(existingParticipant?.isActive),
            name,
            rosterEntry: entry,
            sourceKind,
            typeLabel:
              entry.category === "pc"
                ? "PC"
                : entry.category === "template"
                  ? "Template"
                  : entity?.kind === "monster"
                    ? "Monster"
                    : "NPC"
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
    setScenarioStatus(nextScenario.status);
    setRoundNumber(String(nextScenario.liveState?.roundNumber ?? 1));
    setPhase(String(nextScenario.liveState?.phase ?? 1) as "1" | "2");
    setCombatStatus(nextScenario.liveState?.combatStatus ?? "not_started");
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

  async function handleUpdateLiveState() {
    try {
      setError(undefined);
      setFeedback(undefined);

      await updateScenarioLiveStateOnServer({
        liveState: {
          combatStatus,
          phase: phase === "2" ? 2 : 1,
          roundNumber: Math.max(1, Number.parseInt(roundNumber, 10) || 1)
        },
        scenarioId
      });

      setFeedback("Updated scenario live state.");
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update live state."
      );
    }
  }

  async function handleRosterParticipantToggle(candidate: ScenarioRosterCandidate, member: boolean) {
    try {
      setError(undefined);
      setFeedback(undefined);

      if (!member) {
        if (candidate.existingParticipant) {
          await updateScenarioParticipantMetadataOnServer({
            isActive: false,
            participantId: candidate.existingParticipant.id,
            scenarioId
          });
        }

        setFeedback(`Removed ${candidate.name} from active scenario participants.`);
        await refreshScenario();
        return;
      }

      if (candidate.existingParticipant) {
        await updateScenarioParticipantMetadataOnServer({
          isActive: true,
          participantId: candidate.existingParticipant.id,
          scenarioId
        });
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
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update scenario participant.",
      );
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
        <p style={{ margin: 0 }}>{scenario.description || "No description yet."}</p>
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
        <input onChange={(event) => setScenarioName(event.target.value)} value={scenarioName} />
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

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Live state</h2>
        <div>Status: {scenario.status}</div>
        <div>Combat status: {scenario.liveState?.combatStatus ?? "not_started"}</div>
        <div>Round: {scenario.liveState?.roundNumber ?? 1}</div>
        <div>Phase: {scenario.liveState?.phase ?? 1}</div>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "140px 140px 180px" }}>
          <input
            min={1}
            onChange={(event) => setRoundNumber(event.target.value)}
            type="number"
            value={roundNumber}
          />
          <select onChange={(event) => setPhase(event.target.value as "1" | "2")} value={phase}>
            <option value="1">Phase 1</option>
            <option value="2">Phase 2</option>
          </select>
          <select
            onChange={(event) =>
              setCombatStatus(
                event.target.value as NonNullable<Scenario["liveState"]>["combatStatus"]
              )
            }
            value={combatStatus}
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </select>
        </div>
        <div>
          <button onClick={() => void handleUpdateLiveState()} type="button">
            Update live state
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
                        {participants.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                            {participants.map((participant) => (
                              <label
                                key={participant.id}
                                style={{ alignItems: "center", display: "flex", gap: "0.25rem", whiteSpace: "nowrap" }}
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
                                {participant.snapshot.displayName}
                              </label>
                            ))}
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
          Pull PCs, NPCs, monsters, and templates from the campaign roster into this scenario.
          Encounter membership is chosen separately below.
        </p>
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
                {scenarioRosterCandidates.map((candidate) => (
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
          </div>
        ) : (
          <div>No campaign roster entries are available. Add PCs, NPCs, or templates to the campaign roster first.</div>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Participant state and assignment</h2>
        {participants.length > 0 ? (
          participants.map((participant) => (
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
                {participant.sourceType} · {participant.role}
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
          ))
        ) : (
          <div>No participants yet.</div>
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
              <strong>{eventLog.eventType}</strong>
              <div>{eventLog.summary}</div>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                Round {eventLog.roundNumber ?? "-"} · Phase {eventLog.phase ?? "-"} · {eventLog.createdAt}
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
