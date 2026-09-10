"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  EncounterKind,
  EncounterStatus,
  ScenarioEncounterManagementProjection,
} from "@glantri/domain";

import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

interface ScenarioEncountersSectionProps {
  campaignId: string;
  encounterDescription: string;
  encounterKind: EncounterKind;
  encounterTimelineLabel: string;
  encounterTitle: string;
  onCreateEncounter: () => void;
  onDescriptionChange: (value: string) => void;
  onKindChange: (value: EncounterKind) => void;
  onTimelineLabelChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onUpdateEncounterStatus: (
    encounter: ScenarioEncounterManagementProjection,
    status: EncounterStatus,
    closing?: { gmPrivateClosingNote?: string; playerOutcome?: string },
  ) => void;
  orderedEncounters: ScenarioEncounterManagementProjection[];
  scenarioId: string;
}
export function ScenarioEncountersSection({
  campaignId,
  encounterDescription,
  encounterKind,
  encounterTimelineLabel,
  encounterTitle,
  onCreateEncounter,
  onDescriptionChange,
  onKindChange,
  onTimelineLabelChange,
  onTitleChange,
  onUpdateEncounterStatus,
  orderedEncounters,
  scenarioId,
}: ScenarioEncountersSectionProps) {
  const [closingNotes, setClosingNotes] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  return (
    <section
      style={{
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        padding: "1rem",
      }}
    >
      <h2 style={{ margin: 0 }}>Encounters</h2>
      <p style={{ margin: 0 }}>
        Create bounded situations on this Scenario timeline. Combat and skill rolls are activities
        you can run inside any active Encounter, and disjoint Encounters can be active together.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <input
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Encounter name"
          style={{ minWidth: 260, padding: "0.5rem" }}
          type="text"
          value={encounterTitle}
        />
        <select
          aria-label="Initial activity emphasis"
          onChange={(event) => onKindChange(event.target.value as EncounterKind)}
          value={encounterKind}
        >
          <option value="combat">Combat emphasis</option>
          <option value="roleplay">Roleplaying emphasis</option>
        </select>
        <input
          onChange={(event) => onTimelineLabelChange(event.target.value)}
          placeholder="Timeline label (optional)"
          style={{ minWidth: 180, padding: "0.5rem" }}
          type="text"
          value={encounterTimelineLabel}
        />
        <input
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Description / notes (optional)"
          style={{ minWidth: 240, padding: "0.5rem" }}
          type="text"
          value={encounterDescription}
        />
        <button
          disabled={encounterTitle.trim().length === 0}
          onClick={onCreateEncounter}
          type="button"
        >
          Create encounter
        </button>
      </div>
      {orderedEncounters.length > 0 ? (
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
                <tr
                  key={encounter.id}
                  style={{ borderBottom: "1px solid #eee8dc", verticalAlign: "top" }}
                >
                  <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                    <strong>{encounter.title}</strong>
                    {encounter.description ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        {encounter.description}
                      </div>
                    ) : null}
                    {encounter.status === "completed" && encounter.playerOutcome ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        Outcome: {encounter.playerOutcome}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {encounter.kind === "roleplay" ? "Roleplaying emphasis" : "Combat emphasis"}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {encounter.status === "completed"
                      ? "Closed"
                      : encounter.status.charAt(0).toUpperCase() + encounter.status.slice(1)}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {encounter.timelineLabel ?? encounter.createdAt}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                    {encounter.participantCount}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      <Link
                        href={buildCampaignWorkspaceHref({
                          campaignId,
                          encounterId: encounter.id,
                          scenarioId,
                          tab: "encounter",
                        })}
                      >
                        Encounter
                      </Link>
                      {encounter.status !== "completed" && encounter.status !== "archived" ? (
                        <Link
                          href={buildCampaignWorkspaceHref({
                            campaignId,
                            encounterId: encounter.id,
                            scenarioId,
                            tab: "skill-rolls",
                          })}
                        >
                          Skill rolls
                        </Link>
                      ) : null}
                      {encounter.status === "active" ? (
                        <Link
                          href={buildCampaignWorkspaceHref({
                            campaignId,
                            encounterId: encounter.id,
                            scenarioId,
                            tab: "combat",
                          })}
                        >
                          Combat
                        </Link>
                      ) : null}
                    </div>
                  </td>
                  <td style={{ padding: "0.6rem 0" }}>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {encounter.status === "active" ? (
                          <button
                            onClick={() => onUpdateEncounterStatus(encounter, "paused")}
                            type="button"
                          >
                            Pause
                          </button>
                        ) : encounter.status === "draft" || encounter.status === "paused" ? (
                          <button
                            onClick={() => onUpdateEncounterStatus(encounter, "active")}
                            type="button"
                          >
                            {encounter.status === "paused" ? "Resume" : "Start"}
                          </button>
                        ) : null}
                        {encounter.status === "draft" || encounter.status === "completed" ? (
                          <button
                            onClick={() => onUpdateEncounterStatus(encounter, "archived")}
                            type="button"
                          >
                            Archive
                          </button>
                        ) : null}
                      </div>
                      {encounter.status === "paused" ? (
                        <div style={{ display: "grid", gap: "0.35rem", minWidth: 230 }}>
                          <label htmlFor={`encounter-outcome-${encounter.id}`}>
                            Player-visible outcome
                          </label>
                          <textarea
                            id={`encounter-outcome-${encounter.id}`}
                            onChange={(event) =>
                              setOutcomes((current) => ({
                                ...current,
                                [encounter.id]: event.target.value,
                              }))
                            }
                            rows={2}
                            value={outcomes[encounter.id] ?? encounter.playerOutcome ?? ""}
                          />
                          <label htmlFor={`encounter-private-note-${encounter.id}`}>
                            Private GM closing note (optional)
                          </label>
                          <textarea
                            id={`encounter-private-note-${encounter.id}`}
                            onChange={(event) =>
                              setClosingNotes((current) => ({
                                ...current,
                                [encounter.id]: event.target.value,
                              }))
                            }
                            rows={2}
                            value={
                              closingNotes[encounter.id] ?? encounter.gmPrivateClosingNote ?? ""
                            }
                          />
                          <button
                            disabled={
                              (outcomes[encounter.id] ?? encounter.playerOutcome ?? "").trim()
                                .length === 0
                            }
                            onClick={() =>
                              onUpdateEncounterStatus(encounter, "completed", {
                                gmPrivateClosingNote:
                                  closingNotes[encounter.id] ?? encounter.gmPrivateClosingNote,
                                playerOutcome: outcomes[encounter.id] ?? encounter.playerOutcome,
                              })
                            }
                            type="button"
                          >
                            Close encounter
                          </button>
                        </div>
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
  );
}
