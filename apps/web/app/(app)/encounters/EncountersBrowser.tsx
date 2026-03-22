"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { EncounterSession } from "@glantri/domain";
import { createEncounterSession } from "@glantri/rules-engine";

import { LocalEncounterRepository } from "../../../src/lib/offline/repositories/localEncounterRepository";

const localEncounterRepository = new LocalEncounterRepository();

export default function EncountersBrowser() {
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [titleInput, setTitleInput] = useState("");

  async function refreshEncounters() {
    const records = await localEncounterRepository.list();
    setEncounters(records);
  }

  useEffect(() => {
    refreshEncounters().finally(() => {
      setLoading(false);
    });
  }, []);

  async function handleCreateEncounter() {
    const session = createEncounterSession(titleInput);
    await localEncounterRepository.save(session);
    setTitleInput("");
    await refreshEncounters();
    setFeedback(`Created encounter "${session.title}".`);
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 880 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Encounters</h1>
        <p style={{ margin: 0 }}>
          Local-first encounter/session records collect saved characters into a combat-facing
          context without starting full combat resolution yet.
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
        <h2 style={{ margin: 0 }}>Create encounter</h2>
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
                <Link href={`/encounters/${encounter.id}`}>Open encounter</Link>
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
