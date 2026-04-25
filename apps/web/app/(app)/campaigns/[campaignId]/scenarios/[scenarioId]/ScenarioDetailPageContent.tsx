"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AuthUser } from "@glantri/auth";
import type {
  EncounterSession,
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
  loadServerCharacters,
  loadScenarioEncounters,
  loadTemplates,
  loadScenarioById,
  loadScenarioEventLogs,
  loadScenarioParticipants,
  updateScenarioParticipantMetadataOnServer,
  updateScenarioLiveStateOnServer,
  updateScenarioOnServer
} from "../../../../../../src/lib/api/localServiceClient";
import {
  buildScenarioActorInputFromTemplate,
  getCampaignActorMetadata,
  splitCampaignActors
} from "../../../../../../src/lib/campaigns/campaignActors";
import RememberedCampaignWorkspaceEffect from "../../../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import type { ServerCharacterRecord } from "../../../../../../src/lib/api/localServiceClient";
import {
  getAvailableScenarioCharacters,
  getScenarioCharacterDefaultControllerId,
} from "../../../../../../src/lib/campaigns/scenarioCharacters";
import { buildCampaignWorkspaceHref } from "../../../../../../src/lib/campaigns/workspace";

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

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedCharacterControllerId, setSelectedCharacterControllerId] = useState("");
  const [selectedCharacterFactionId, setSelectedCharacterFactionId] = useState("");
  const [temporaryActorName, setTemporaryActorName] = useState("");
  const [participantRole, setParticipantRole] = useState<ScenarioParticipant["role"]>("npc");
  const [encounterTitle, setEncounterTitle] = useState("");

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioStatus, setScenarioStatus] = useState<Scenario["status"]>("draft");
  const [roundNumber, setRoundNumber] = useState("1");
  const [phase, setPhase] = useState<"1" | "2">("1");
  const [combatStatus, setCombatStatus] = useState<
    NonNullable<Scenario["liveState"]>["combatStatus"]
  >("not_started");
  const splitEntities = useMemo(() => splitCampaignActors(entities, campaignId), [campaignId, entities]);
  const availablePlayerCharacters = useMemo(
    () =>
      getAvailableScenarioCharacters({
        characters: playerCharacters,
        participants,
      }),
    [participants, playerCharacters],
  );
  const usersById = useMemo(
    () => new Map(assignableUsers.map((user) => [user.id, user])),
    [assignableUsers]
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
    ] = await Promise.all([
      loadScenarioById(scenarioId),
      loadScenarioParticipants(scenarioId),
      loadCampaignEntities(campaignId),
      loadTemplates(),
      loadScenarioEventLogs(scenarioId),
      loadScenarioEncounters(scenarioId),
      loadAuthUsers(),
      loadServerCharacters(),
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
    setSelectedEntityId((current) => current || globalTemplates[0]?.id || nextEntities[0]?.id || "");
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
          scenarioId,
        },
      });

      setEncounterTitle("");
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

  useEffect(() => {
    const preferredCharacter =
      availablePlayerCharacters.find((character) => character.id === selectedCharacterId) ??
      availablePlayerCharacters[0] ??
      null;

    if (!preferredCharacter) {
      setSelectedCharacterId("");
      setSelectedCharacterControllerId("");
      return;
    }

    if (preferredCharacter.id !== selectedCharacterId) {
      setSelectedCharacterId(preferredCharacter.id);
      setSelectedCharacterControllerId(
        getScenarioCharacterDefaultControllerId({
          character: preferredCharacter,
        }),
      );
    }
  }, [availablePlayerCharacters, selectedCharacterId]);

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

  async function handleAddParticipant() {
    try {
      setError(undefined);
      setFeedback(undefined);
      const selectedTemplate = templates.find((template) => template.id === selectedEntityId);

      const participant = await addScenarioParticipantFromEntityOnServer({
        entityId: selectedTemplate ? undefined : selectedEntityId,
        entityInput: selectedTemplate
          ? {
              ...buildScenarioActorInputFromTemplate({
                name: temporaryActorName.trim() || selectedTemplate.name,
                template: selectedTemplate
              })
            }
          : undefined,
        isTemporary: Boolean(selectedTemplate),
        role: participantRole,
        scenarioId
      });

      setFeedback(`Added participant ${participant.snapshot.displayName}.`);
      setTemporaryActorName("");
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to add scenario participant."
      );
    }
  }

  async function handleAddCharacterParticipant() {
    if (!selectedCharacterId) {
      setError("Choose a character to add.");
      return;
    }

    try {
      setError(undefined);
      setFeedback(undefined);

      const participant = await addScenarioParticipantFromCharacterOnServer({
        characterId: selectedCharacterId,
        controlledByUserId: selectedCharacterControllerId || null,
        factionId: selectedCharacterFactionId.trim() || null,
        joinSource: "gm_added",
        role: "player_character",
        scenarioId,
      });

      setFeedback(`Added player character ${participant.snapshot.displayName}.`);
      setSelectedCharacterFactionId("");
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to add player character participant.",
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
            Canonical encounters are now shared server-backed scenario records. Create them here,
            then open GM or player encounter workspace on the same shared encounter.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <input
              onChange={(event) => setEncounterTitle(event.target.value)}
              placeholder="Arena clash"
              style={{ minWidth: 260, padding: "0.5rem" }}
              type="text"
              value={encounterTitle}
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
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {encounters.map((encounter) => (
                <div
                  key={encounter.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #ddd7c9",
                    borderRadius: 10,
                    display: "grid",
                    gap: "0.35rem",
                    padding: "0.75rem",
                  }}
                >
                  <strong>{encounter.title}</strong>
                  <div>Status: {encounter.status}</div>
                  <div>Participants: {encounter.participants.length}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                    <Link
                      href={buildCampaignWorkspaceHref({
                        campaignId,
                        encounterId: encounter.id,
                        scenarioId,
                        tab: "gm-encounter",
                      })}
                    >
                      Open GM encounter workspace
                    </Link>
                    <Link
                      href={buildCampaignWorkspaceHref({
                        campaignId,
                        encounterId: encounter.id,
                        scenarioId,
                        tab: "player-encounter",
                      })}
                    >
                      Open player encounter workspace
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>No encounters have been created for this scenario yet.</div>
          )}
      </section>

      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Add player character</h2>
        <p style={{ margin: 0 }}>
          Player characters come into the scenario directly from saved server-backed characters.
        </p>
        {availablePlayerCharacters.length > 0 ? (
          <>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Character</span>
              <select
                onChange={(event) => {
                  const nextCharacter =
                    availablePlayerCharacters.find(
                      (character) => character.id === event.target.value,
                    ) ?? null;
                  setSelectedCharacterId(event.target.value);
                  setSelectedCharacterControllerId(
                    getScenarioCharacterDefaultControllerId({
                      character: nextCharacter,
                    }),
                  );
                }}
                value={selectedCharacterId}
              >
                {availablePlayerCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {(character.build.name.trim() || character.name).trim()}
                    {character.owner?.displayName || character.owner?.email
                      ? ` (${character.owner?.displayName ?? character.owner?.email})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "minmax(220px, 1.25fr) minmax(160px, 1fr)",
              }}
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Assigned controller</span>
                <select
                  onChange={(event) => setSelectedCharacterControllerId(event.target.value)}
                  value={selectedCharacterControllerId}
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
                <span>Faction / side</span>
                <input
                  onChange={(event) => setSelectedCharacterFactionId(event.target.value)}
                  type="text"
                  value={selectedCharacterFactionId}
                />
              </label>
            </div>
            <div>
              <button onClick={() => void handleAddCharacterParticipant()} type="button">
                Add player character
              </button>
            </div>
          </>
        ) : (
          <div>No available server-backed player characters remain to add to this scenario.</div>
        )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Add participant from template or campaign NPC</h2>
        <p style={{ margin: 0 }}>
          Choose either a reusable archetype or a persistent campaign individual as the source.
        </p>
        {templates.length > 0 || splitEntities.campaignNpcs.length > 0 ? (
          <>
            <select
              onChange={(event) => setSelectedEntityId(event.target.value)}
              value={selectedEntityId}
            >
              {templates.length > 0 ? (
                <optgroup label="Templates">
                  {templates.map((entity) => {
                    const metadata = getCampaignActorMetadata(entity);

                    return (
                      <option key={entity.id} value={entity.id}>
                        {entity.name} ({entity.kind}
                        {metadata.roleLabel ? `, ${metadata.roleLabel}` : ""})
                      </option>
                    );
                  })}
                </optgroup>
              ) : null}
              {splitEntities.campaignNpcs.length > 0 ? (
                <optgroup label="Campaign NPCs">
                  {splitEntities.campaignNpcs.map((entity) => {
                    const metadata = getCampaignActorMetadata(entity);

                    return (
                      <option key={entity.id} value={entity.id}>
                        {entity.name} ({entity.kind}
                        {metadata.allegiance ? `, ${metadata.allegiance}` : ""})
                      </option>
                    );
                  })}
                </optgroup>
              ) : null}
            </select>
            <select
              onChange={(event) => setParticipantRole(event.target.value as ScenarioParticipant["role"])}
              value={participantRole}
            >
              <option value="npc">NPC</option>
              <option value="monster">Monster</option>
              <option value="animal">Animal</option>
              <option value="neutral">Neutral</option>
              <option value="ally">Ally</option>
              <option value="enemy">Enemy</option>
            </select>
            {templates.some((template) => template.id === selectedEntityId) ? (
              <input
                onChange={(event) => setTemporaryActorName(event.target.value)}
                placeholder="Temporary actor name override (optional)"
                value={temporaryActorName}
              />
            ) : null}
            <div>
              <button onClick={() => void handleAddParticipant()} type="button">
                {templates.some((template) => template.id === selectedEntityId)
                  ? "Create temporary scenario actor"
                  : "Add participant"}
              </button>
            </div>
          </>
        ) : (
          <div>No templates or campaign NPCs are available yet.</div>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Participants</h2>
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
