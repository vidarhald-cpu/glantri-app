"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  EncounterSession,
  ScenarioParticipant,
  ScenarioPlayerProjection,
} from "@glantri/domain";

import {
  loadScenarioMyParticipant,
  loadScenarioPlayerProjection,
} from "@/lib/api/localServiceClient";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { isUserAssignedToEffectiveEncounter } from "@/lib/campaigns/encounterParticipantFallback";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

interface ScenarioPlayerPageContentProps {
  campaignId?: string;
  encounters?: EncounterSession[];
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
  campaignId,
  encounters = [],
  scenarioId
}: ScenarioPlayerPageContentProps) {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ScenarioPlayerProjection>();
  const [scenarioParticipants, setScenarioParticipants] = useState<ScenarioParticipant[]>([]);

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
        const [nextProjection, nextScenarioParticipant] = await Promise.all([
          loadScenarioPlayerProjection(scenarioId),
          loadScenarioMyParticipant(scenarioId),
        ]);

        if (cancelled) {
          return;
        }

        setProjection(nextProjection);
        setScenarioParticipants(nextScenarioParticipant ? [nextScenarioParticipant] : []);
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

  const playerAvailableEncounters = encounters.filter((encounter) =>
    isUserAssignedToEffectiveEncounter({
      encounter,
      scenarioParticipants,
      userId: currentUser.id,
    })
  );
  const hasUnavailableEncounters = encounters.length > 0 && playerAvailableEncounters.length === 0;

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 960 }}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>{projection.scenario.name}</h1>
        <p style={{ margin: 0 }}>
          {projection.scenario.description || "No scenario briefing has been written yet."}
        </p>
      </div>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Encounter</h2>
        {playerAvailableEncounters.length > 0 ? (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {playerAvailableEncounters.map((encounter) => (
              <div
                key={encounter.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #ddd7c9",
                  borderRadius: 10,
                  display: "grid",
                  gap: "0.25rem",
                  padding: "0.75rem",
                }}
              >
                <strong>{encounter.title}</strong>
                {campaignId ? (
                  <Link
                    href={buildCampaignWorkspaceHref({
                      campaignId,
                      encounterId: encounter.id,
                      scenarioId,
                      tab: "encounter",
                    })}
                  >
                    Open encounter
                  </Link>
                ) : (
                  <div>Open encounter from the campaign workspace.</div>
                )}
              </div>
            ))}
          </div>
        ) : hasUnavailableEncounters ? (
          <div>You are not assigned to this encounter.</div>
        ) : (
          <div>No active encounter is currently available.</div>
        )}
      </section>
    </section>
  );
}
