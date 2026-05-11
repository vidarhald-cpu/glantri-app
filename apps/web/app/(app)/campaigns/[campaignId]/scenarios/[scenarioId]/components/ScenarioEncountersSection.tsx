"use client";

import Link from "next/link";

import type { EncounterKind, EncounterSession, EncounterStatus } from "@glantri/domain";

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
  onUpdateEncounterStatus: (encounter: EncounterSession, status: EncounterStatus) => void;
  orderedEncounters: EncounterSession[];
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
  scenarioId
}: ScenarioEncountersSectionProps) {
  return (
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
        Create combat or roleplaying encounters on one scenario timeline. More than one encounter
        can be active at the same time.
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
          onChange={(event) => onKindChange(event.target.value as EncounterKind)}
          value={encounterKind}
        >
          <option value="combat">Combat</option>
          <option value="roleplay">Roleplaying</option>
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
        <button disabled={encounterTitle.trim().length === 0} onClick={onCreateEncounter} type="button">
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
                          onClick={() => onUpdateEncounterStatus(encounter, "paused")}
                          type="button"
                        >
                          Pause
                        </button>
                      ) : encounter.status !== "archived" && encounter.status !== "complete" ? (
                        <button
                          onClick={() => onUpdateEncounterStatus(encounter, "active")}
                          type="button"
                        >
                          {encounter.status === "paused" ? "Resume" : "Start"}
                        </button>
                      ) : null}
                      {encounter.status !== "archived" ? (
                        <button
                          onClick={() => onUpdateEncounterStatus(encounter, "archived")}
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
  );
}
