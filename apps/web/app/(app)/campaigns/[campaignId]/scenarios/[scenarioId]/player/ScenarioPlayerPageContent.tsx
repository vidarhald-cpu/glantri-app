"use client";

import { useEffect, useRef, useState } from "react";

import type {
  EncounterSession,
  EncounterSessionSummary,
  ScenarioSessionView,
} from "@glantri/domain";

import { ScenarioSituationView } from "@/features/scenarios/situation/ScenarioSituationView";
import {
  loadScenarioSession,
  pickUpScenarioAvailableItemOnServer,
} from "@/lib/api/localServiceClient";
import { startGuardedPolling } from "@/lib/browser/guardedPolling";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { shouldAcceptScenarioSessionResponse } from "@/lib/campaigns/scenarioSessionRefresh";

interface ScenarioPlayerPageContentProps {
  campaignId?: string;
  encounters?: Array<EncounterSessionSummary | EncounterSession>;
  scenarioId: string;
}

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

export default function ScenarioPlayerPageContent({
  campaignId,
  scenarioId,
}: ScenarioPlayerPageContentProps) {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ScenarioSessionView>();
  const sessionRef = useRef<ScenarioSessionView | undefined>(undefined);

  function acceptSession(incoming: ScenarioSessionView) {
    if (!shouldAcceptScenarioSessionResponse(sessionRef.current, incoming)) return;
    sessionRef.current = incoming;
    setSession(incoming);
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser) {
      setSession(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function refresh(initial = false) {
      if (initial) setLoading(true);
      try {
        const nextSession = await loadScenarioSession(scenarioId);
        if (!cancelled) {
          acceptSession(nextSession);
          setError(undefined);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load the player Scenario view.",
          );
        }
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    void refresh(true);
    const polling = startGuardedPolling({
      intervalMs: 4_000,
      refresh: () => refresh(false),
    });
    return () => {
      cancelled = true;
      polling.stop();
    };
  }, [currentUser, scenarioId, sessionLoading]);

  async function handlePickUp(availabilityId: string, targetParticipantId: string) {
    if (!session) return;
    try {
      setError(undefined);
      const result = await pickUpScenarioAvailableItemOnServer({
        availabilityId,
        expectedRevision: session.revision,
        requestId: crypto.randomUUID(),
        scenarioId,
        targetParticipantId,
      });
      acceptSession(result.session);
      setFeedback(result.idempotent ? "Pickup already completed." : "Item picked up.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to pick up the Item.");
    }
  }

  if (sessionLoading || loading) return <section>Loading Scenario view...</section>;
  if (!currentUser) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Scenario view</h1>
        <div style={panelStyle}>Sign in to open the player Scenario view.</div>
      </section>
    );
  }
  if (!session) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Scenario view</h1>
        <div style={panelStyle}>{error || "Scenario view unavailable."}</div>
      </section>
    );
  }
  const isTerminalScenario =
    session.scenario.status === "completed" || session.scenario.status === "archived";

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1400 }}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>{session.scenario.name}</h1>
        <p style={{ margin: 0 }}>
          {session.scenario.description || "No Scenario briefing has been written yet."}
        </p>
      </div>
      {isTerminalScenario ? (
        <section style={{ ...panelStyle, background: "#fff8df", borderColor: "#d8c57b" }}>
          <strong>Read-only Scenario history</strong>
          <div>
            This Scenario is {session.scenario.status === "archived" ? "archived" : "closed"}.
            Outcomes and objective history remain available, but pickups, rolls, and live play are
            unavailable.
          </div>
        </section>
      ) : null}
      {error ? <div role="alert">{error}</div> : null}
      {feedback ? <div role="status">{feedback}</div> : null}
      <ScenarioSituationView
        campaignId={campaignId}
        onPickUp={
          isTerminalScenario
            ? undefined
            : (availabilityId, targetParticipantId) =>
                void handlePickUp(availabilityId, targetParticipantId)
        }
        session={session}
      />
    </section>
  );
}
