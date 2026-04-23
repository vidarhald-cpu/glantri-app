"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { EncounterSession } from "@glantri/domain";
import { createEncounterSession } from "@glantri/rules-engine";

import { LocalEncounterRepository } from "../../../src/lib/offline/repositories/localEncounterRepository";

const localEncounterRepository = new LocalEncounterRepository();

interface EncountersBrowserProps {
  campaignId?: string;
  scenarioId?: string;
}

export default function EncountersBrowser({
  campaignId,
  scenarioId
}: EncountersBrowserProps) {
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [titleInput, setTitleInput] = useState("");

  const isNestedScenarioFlow = Boolean(campaignId && scenarioId);
  const backHref = isNestedScenarioFlow
    ? `/campaigns/${campaignId}/scenarios/${scenarioId}`
    : "/campaigns";

  async function refreshEncounters() {
    const records = await localEncounterRepository.list();
    setEncounters(
      scenarioId ? records.filter((record) => record.scenarioId === scenarioId) : records
    );
  }

  useEffect(() => {
    refreshEncounters().finally(() => {
      setLoading(false);
    });
  }, [scenarioId]);

  async function handleCreateEncounter() {
    const session: EncounterSession = {
      ...createEncounterSession(titleInput),
      campaignId,
      scenarioId
    };
    await localEncounterRepository.save(session);
    setTitleInput("");
    await refreshEncounters();
    setFeedback(`Created encounter "${session.title}".`);
  }

  function getEncounterHref(encounter: EncounterSession): string {
    if (isNestedScenarioFlow) {
      return `/campaigns/${campaignId}/scenarios/${scenarioId}/encounters/${encounter.id}`;
    }

    return `/encounters/${encounter.id}`;
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 880 }}>
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href={backHref}>
            {isNestedScenarioFlow ? "Back to scenario" : "Back to campaigns"}
          </Link>
        </div>
        <h1 style={{ marginBottom: "0.5rem" }}>
          {isNestedScenarioFlow ? "Scenario encounters" : "Encounter workbench"}
        </h1>
        <p style={{ margin: 0 }}>
          {isNestedScenarioFlow
            ? "Encounters belong to this scenario. Use them for GM combat management, then hand players the combat screen from encounter context."
            : "Legacy local encounter records are still available here, but the intended play flow is Campaigns -> Campaign -> Scenario -> Encounter."}
        </p>
      </div>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>
          {isNestedScenarioFlow ? "Create encounter in this scenario" : "Create encounter"}
        </h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="Skirmish at the gate"
            style={{ minWidth: 260, padding: "0.5rem" }}
            type="text"
            value={titleInput}
          />
          <button onClick={() => void handleCreateEncounter()} type="button">
            Create encounter
          </button>
        </div>
        {feedback ? <div>{feedback}</div> : null}
      </section>

      {loading ? (
        <div>Loading encounters...</div>
      ) : encounters.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {encounters.map((encounter) => (
            <div
              key={encounter.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>{encounter.title}</strong>
              <div>Status: {encounter.status}</div>
              <div>Participants: {encounter.participants.length}</div>
              <div>Updated: {encounter.updatedAt}</div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link href={getEncounterHref(encounter)}>Open encounter</Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          No encounters yet.
        </div>
      )}
    </section>
  );
}
