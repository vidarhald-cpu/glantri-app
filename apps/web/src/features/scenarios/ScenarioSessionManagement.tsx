"use client";

import { useState } from "react";

import type { ScenarioAvailableObjectReference, ScenarioSessionView } from "@glantri/domain";

import { ScenarioSessionPanel } from "./ScenarioSessionPanel";

export interface ScenarioAvailableSourceOption {
  label: string;
  sourceId: string;
  sourceKind: ScenarioAvailableObjectReference["sourceKind"];
}

export function ScenarioSessionManagement({
  campaignId,
  initialReferences,
  onReconcileEquipment,
  onSave,
  session,
  sourceOptions,
}: {
  campaignId: string;
  initialReferences: ScenarioAvailableObjectReference[];
  onReconcileEquipment?: (participantId: string) => void;
  onSave: (input: {
    gmPrivateNotes: string;
    references: ScenarioAvailableObjectReference[];
  }) => void;
  session: ScenarioSessionView;
  sourceOptions: ScenarioAvailableSourceOption[];
}) {
  const [gmPrivateNotes, setGmPrivateNotes] = useState(session.gmPrivateNotes ?? "");
  const [references, setReferences] = useState(initialReferences);
  const [selectedSource, setSelectedSource] = useState("");
  const sourceByKey = new Map(
    sourceOptions.map((source) => [`${source.sourceKind}:${source.sourceId}`, source]),
  );

  function addSelectedSource() {
    const source = sourceByKey.get(selectedSource);
    if (!source) return;
    if (
      references.some(
        (reference) =>
          reference.sourceKind === source.sourceKind && reference.sourceId === source.sourceId,
      )
    ) {
      return;
    }
    setReferences((current) => [
      ...current,
      {
        addedAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        sourceId: source.sourceId,
        sourceKind: source.sourceKind,
        visibility: "players",
      },
    ]);
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section
        aria-labelledby="scenario-session-preparation-heading"
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
        }}
      >
        <h2 id="scenario-session-preparation-heading" style={{ margin: 0 }}>
          Session preparation
        </h2>
        <p style={{ margin: 0 }}>
          Make existing Campaign objects available. Picking up an Item moves that same item into the
          Character’s current equipment, so it can only be picked up once.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <label htmlFor="scenario-available-source">Campaign object</label>
          <select
            id="scenario-available-source"
            onChange={(event) => setSelectedSource(event.target.value)}
            value={selectedSource}
          >
            <option value="">Choose an object</option>
            {sourceOptions.map((source) => {
              const key = `${source.sourceKind}:${source.sourceId}`;
              return (
                <option key={key} value={key}>
                  {source.label}
                </option>
              );
            })}
          </select>
          <button disabled={!selectedSource} onClick={addSelectedSource} type="button">
            Make available
          </button>
        </div>
        {references.length ? (
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {references.map((reference) => (
              <li key={reference.id}>
                {sourceByKey.get(`${reference.sourceKind}:${reference.sourceId}`)?.label ??
                  "Unavailable source"}{" "}
                <button
                  onClick={() =>
                    setReferences((current) =>
                      current.filter((candidate) => candidate.id !== reference.id),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0 }}>No objects selected.</p>
        )}
        <label htmlFor="scenario-gm-private-notes">Private GM notes</label>
        <textarea
          id="scenario-gm-private-notes"
          onChange={(event) => setGmPrivateNotes(event.target.value)}
          rows={4}
          value={gmPrivateNotes}
        />
        <button
          onClick={() => onSave({ gmPrivateNotes, references })}
          style={{ justifySelf: "start" }}
          type="button"
        >
          Save session preparation
        </button>
      </section>
      <ScenarioSessionPanel
        campaignId={campaignId}
        onReconcileEquipment={onReconcileEquipment}
        session={session}
      />
    </section>
  );
}
