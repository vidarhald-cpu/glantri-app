"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ScenarioPlayerProjection } from "@glantri/domain";

import { loadScenarioPlayerProjection } from "../../../../../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../../../../../src/lib/auth/SessionUserContext";

interface ScenarioPlayerPageContentProps {
  scenarioId: string;
}

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem"
} as const;

export default function ScenarioPlayerPageContent({
  scenarioId
}: ScenarioPlayerPageContentProps) {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ScenarioPlayerProjection>();

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!currentUser) {
      setProjection(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function refreshProjection() {
      setLoading(true);

      try {
        const nextProjection = await loadScenarioPlayerProjection(scenarioId);

        if (cancelled) {
          return;
        }

        setProjection(nextProjection);
        setError(undefined);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the player scenario view."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refreshProjection();

    return () => {
      cancelled = true;
    };
  }, [currentUser, scenarioId, sessionLoading]);

  if (sessionLoading || loading) {
    return <section>Loading scenario player view...</section>;
  }

  if (!currentUser) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Scenario view</h1>
        <div style={panelStyle}>Sign in to open the player scenario view.</div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Scenario view</h1>
        <div style={panelStyle}>{error}</div>
      </section>
    );
  }

  if (!projection) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Scenario view</h1>
        <div style={panelStyle}>Scenario projection unavailable.</div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href="/characters">Back to characters</Link>
          <Link href="./combat">Open combat screen</Link>
        </div>
        <h1 style={{ margin: 0 }}>{projection.scenario.name}</h1>
        <p style={{ margin: 0 }}>
          {projection.scenario.description || "No scenario briefing has been written yet."}
        </p>
      </div>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(260px, 1fr) minmax(320px, 1.3fr)"
        }}
      >
        <div style={panelStyle}>
          <h2 style={{ margin: 0 }}>Scenario context</h2>
          <div>Status: {projection.scenario.status}</div>
          <div>Kind: {projection.scenario.kind}</div>
          <div>Combat status: {projection.scenario.combatStatus}</div>
          <div>Round: {projection.scenario.roundNumber}</div>
          <div>Phase: {projection.scenario.phase}</div>
          <div>Visibility model: {projection.visibilityMode}</div>
        </div>

        <div style={panelStyle}>
          <h2 style={{ margin: 0 }}>Your character</h2>
          {projection.hasControlledParticipant && projection.controlledParticipant ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <strong>{projection.controlledParticipant.displayName}</strong>
              <div>
                {projection.controlledParticipant.role} · {projection.controlledParticipant.sourceType}
              </div>
              <div>
                HP: {projection.controlledParticipant.currentHp}/
                {projection.controlledParticipant.maxHp}
              </div>
              <div>Conditions: {projection.controlledParticipant.conditionCount}</div>
              <div>Faction: {projection.controlledParticipant.factionId ?? "Unassigned"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <strong>No active character assigned</strong>
              <div>
                This account does not currently control an active player character in this scenario.
                Ask the GM to assign one from the scenario participant list.
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Visible participants</h2>
        {projection.hasControlledParticipant ? (
          projection.visibleParticipants.length > 0 ? (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {projection.visibleParticipants.map((participant) => (
                <div
                  key={participant.id}
                  style={{
                    background: participant.isControlledByPlayer ? "#fffaf0" : "#ffffff",
                    border: "1px solid #ddd7c9",
                    borderRadius: 10,
                    display: "grid",
                    gap: "0.25rem",
                    padding: "0.75rem"
                  }}
                >
                  <strong>{participant.displayName}</strong>
                  <div>
                    {participant.role} · {participant.sourceType}
                    {participant.isControlledByPlayer ? " · You" : ""}
                  </div>
                  <div>Faction: {participant.factionId ?? "Unassigned"}</div>
                  <div>{participant.isActive ? "Active in scenario" : "Inactive"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>No participants are currently visible in this scenario view.</div>
          )
        ) : (
          <div>
            Participant visibility will appear here once the GM assigns you an active character in
            this scenario.
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Actions coming next</h2>
        <div>{projection.actionStub.message}</div>
        <div style={{ color: "#5e5a50" }}>
          Future phases will add declaration hooks here for speech, movement, skill use, equipment
          interactions, and encounter actions.
        </div>
      </section>
    </section>
  );
}
