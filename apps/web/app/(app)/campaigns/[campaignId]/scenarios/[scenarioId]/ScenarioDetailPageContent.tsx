"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ReusableEntity, Scenario, ScenarioEventLog, ScenarioParticipant } from "@glantri/domain";

import {
  addScenarioParticipantFromEntityOnServer,
  loadCampaignEntities,
  loadTemplates,
  loadScenarioById,
  loadScenarioEventLogs,
  loadScenarioParticipants,
  updateScenarioLiveStateOnServer,
  updateScenarioOnServer
} from "../../../../../../src/lib/api/localServiceClient";
import {
  getCampaignActorMetadata,
  splitCampaignActors
} from "../../../../../../src/lib/campaigns/campaignActors";

interface ScenarioDetailPageContentProps {
  campaignId: string;
  scenarioId: string;
}

export default function ScenarioDetailPageContent({
  campaignId,
  scenarioId
}: ScenarioDetailPageContentProps) {
  const [entities, setEntities] = useState<ReusableEntity[]>([]);
  const [error, setError] = useState<string>();
  const [eventLogs, setEventLogs] = useState<ScenarioEventLog[]>([]);
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<ScenarioParticipant[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [participantRole, setParticipantRole] = useState<ScenarioParticipant["role"]>("npc");

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioStatus, setScenarioStatus] = useState<Scenario["status"]>("draft");
  const [roundNumber, setRoundNumber] = useState("1");
  const [phase, setPhase] = useState<"1" | "2">("1");
  const [combatStatus, setCombatStatus] = useState<
    NonNullable<Scenario["liveState"]>["combatStatus"]
  >("not_started");
  const splitEntities = useMemo(() => splitCampaignActors(entities, campaignId), [campaignId, entities]);

  async function refreshScenario() {
    const [nextScenario, nextParticipants, nextEntities, nextTemplates, nextEventLogs] = await Promise.all([
      loadScenarioById(scenarioId),
      loadScenarioParticipants(scenarioId),
      loadCampaignEntities(campaignId),
      loadTemplates(),
      loadScenarioEventLogs(scenarioId)
    ]);

    const globalTemplates = nextTemplates.filter(
      (entity) => getCampaignActorMetadata(entity).actorClass === "template"
    );

    setScenario(nextScenario);
    setParticipants(nextParticipants);
    setEntities(nextEntities);
    setTemplates(globalTemplates);
    setEventLogs(nextEventLogs);
    setSelectedEntityId((current) => current || globalTemplates[0]?.id || nextEntities[0]?.id || "");
    setScenarioName(nextScenario.name);
    setScenarioStatus(nextScenario.status);
    setRoundNumber(String(nextScenario.liveState?.roundNumber ?? 1));
    setPhase(String(nextScenario.liveState?.phase ?? 1) as "1" | "2");
    setCombatStatus(nextScenario.liveState?.combatStatus ?? "not_started");
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

  async function handleAddParticipant() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const participant = await addScenarioParticipantFromEntityOnServer({
        entityId: selectedEntityId,
        role: participantRole,
        scenarioId
      });

      setFeedback(`Added participant ${participant.snapshot.displayName}.`);
      await refreshScenario();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to add scenario participant."
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
      <div>
        <Link href={`/campaigns/${campaignId}`}>Back to campaign</Link>
        <h1 style={{ marginBottom: "0.5rem" }}>{scenario.name}</h1>
        <p style={{ margin: 0 }}>{scenario.description || "No description yet."}</p>
      </div>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Scenario summary</h2>
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
            <div>
              <button onClick={() => void handleAddParticipant()} type="button">
                Add participant
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
                HP: {participant.state.health.currentHp}/{participant.state.health.maxHp}
              </div>
              <div>Conditions: {participant.state.conditions.length}</div>
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
