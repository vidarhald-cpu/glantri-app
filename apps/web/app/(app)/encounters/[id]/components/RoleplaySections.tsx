import { useEffect, useState } from "react";

import type {
  Campaign,
  EncounterParticipant,
  EncounterSession,
  RoleplayActionLogEntry,
  RoleplayDifficulty,
  RoleplayParticipantDescription,
  RoleplayState,
  Scenario,
} from "@glantri/domain";
import { roleplayDifficultyOptions } from "@glantri/domain";

import {
  panelStyle,
  playerMetadataTagStyle,
  playerReadOnlyPanelStyle,
} from "./roleplayStyles";

interface EncounterInfoCardProps {
  campaignName?: string;
  encounter: EncounterSession;
  scenarioName?: string;
}

export function EncounterInfoCard({ campaignName, encounter, scenarioName }: EncounterInfoCardProps) {
  return (
    <section style={panelStyle}>
      <h1 style={{ margin: 0 }}>{encounter.title}</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <span>Type: Roleplaying</span>
        <span>Status: {encounter.status}</span>
        {encounter.timelineLabel ? <span>Timeline: {encounter.timelineLabel}</span> : null}
        {scenarioName ? <span>Scenario: {scenarioName}</span> : null}
        {campaignName ? <span>Campaign: {campaignName}</span> : null}
      </div>
      {encounter.description ? <div>{encounter.description}</div> : null}
    </section>
  );
}

export const RoleplayTopInfo = EncounterInfoCard;

export function PlayerEncounterTopInfo({ campaignName, encounter, scenarioName }: EncounterInfoCardProps) {
  return (
    <section aria-label="Player encounter summary" style={panelStyle}>
      <div style={{ alignItems: "baseline", display: "flex", gap: "0.5rem", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
        <h1 style={{ flex: "0 0 auto", fontSize: "1.35rem", lineHeight: 1.2, margin: 0 }}>
          {encounter.title}
        </h1>
        <span aria-hidden="true" style={playerMetadataTagStyle}>·</span>
        <span style={playerMetadataTagStyle}>{encounter.kind === "roleplay" ? "Roleplaying" : "Combat"}</span>
        {scenarioName ? (
          <>
            <span aria-hidden="true" style={playerMetadataTagStyle}>·</span>
            <span style={playerMetadataTagStyle}>Scenario: {scenarioName}</span>
          </>
        ) : null}
        {campaignName ? (
          <>
            <span aria-hidden="true" style={playerMetadataTagStyle}>·</span>
            <span style={playerMetadataTagStyle}>Campaign: {campaignName}</span>
          </>
        ) : null}
      </div>
      {encounter.description ? <div style={playerReadOnlyPanelStyle}>{encounter.description}</div> : null}
    </section>
  );
}

export function GmMessageSection({
  gmMessageDraft,
  onChange,
  onSave,
}: {
  gmMessageDraft: string;
  onChange: (message: string) => void;
  onSave: () => Promise<void> | void;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: 0 }}>GM message</h2>
      <textarea
        onChange={(event) => onChange(event.target.value)}
        placeholder="Message intended for player roleplaying screens."
        rows={4}
        value={gmMessageDraft}
      />
      <button onClick={() => void onSave()} type="button">
        Save GM message
      </button>
    </section>
  );
}

export function VisibilityGridSection({
  onSelectAllVisibility,
  onVisibilityChange,
  roster,
  state,
}: {
  onSelectAllVisibility: (viewerParticipantId: string) => Promise<void> | void;
  onVisibilityChange: (input: {
    targetParticipantId: string;
    viewerParticipantId: string;
    visible: boolean;
  }) => Promise<void> | void;
  roster: EncounterParticipant[];
  state: RoleplayState;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: 0 }}>Visibility grid</h2>
      {roster.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Viewer</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Row action</th>
                {roster.map((target) => (
                  <th key={target.id} style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                    {target.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((viewer) => (
                <tr key={viewer.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                  <td style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>{viewer.label}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <button onClick={() => void onSelectAllVisibility(viewer.id)} type="button">
                      Select all
                    </button>
                  </td>
                  {roster.map((target) => (
                    <td key={target.id} style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <input
                        aria-label={`${viewer.label} can see ${target.label}`}
                        checked={
                          viewer.id === target.id ||
                          Boolean(state.visibility[viewer.id]?.[target.id])
                        }
                        disabled={viewer.id === target.id}
                        onChange={(event) =>
                          void onVisibilityChange({
                            targetParticipantId: target.id,
                            viewerParticipantId: viewer.id,
                            visible: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>Add participants to this encounter from the Scenario screen before setting visibility.</div>
      )}
    </section>
  );
}

function getParticipantDescription(input: {
  fallbackName: string;
  participantId: string;
  state: RoleplayState;
}): RoleplayParticipantDescription {
  const existing = input.state.participantDescriptions[input.participantId];

  return {
    detailedDescription: existing?.detailedDescription ?? "",
    name: existing?.name ?? input.fallbackName,
    shortDescription: existing?.shortDescription ?? "",
  };
}

export function ParticipantDescriptionsSection({
  onSave,
  roster,
  state,
}: {
  onSave: (input: {
    description: RoleplayParticipantDescription;
    participantId: string;
  }) => Promise<void> | void;
  roster: EncounterParticipant[];
  state: RoleplayState;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: 0 }}>Roleplay roster descriptions</h2>
      {roster.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem", maxHeight: "36rem", overflow: "auto" }}>
          {roster.map((participant) => (
            <RoleplayDescriptionRow
              description={getParticipantDescription({
                fallbackName: participant.label,
                participantId: participant.id,
                state,
              })}
              key={participant.id}
              onSave={(description) =>
                void onSave({
                  description,
                  participantId: participant.id,
                })
              }
              participant={participant}
            />
          ))}
        </div>
      ) : (
        <div>No participants are assigned to this roleplaying encounter yet.</div>
      )}
    </section>
  );
}

function RoleplayDescriptionRow(input: {
  description: RoleplayParticipantDescription;
  onSave: (description: RoleplayParticipantDescription) => void;
  participant: EncounterParticipant;
}) {
  const [name, setName] = useState(input.description.name ?? input.participant.label);
  const [shortDescription, setShortDescription] = useState(input.description.shortDescription);
  const [detailedDescription, setDetailedDescription] = useState(input.description.detailedDescription);

  useEffect(() => {
    setName(input.description.name ?? input.participant.label);
    setShortDescription(input.description.shortDescription);
    setDetailedDescription(input.description.detailedDescription);
  }, [input.description, input.participant.label]);

  return (
    <details style={{ border: "1px solid #eee8dc", borderRadius: 10, padding: "0.75rem" }}>
      <summary>
        <strong>{input.participant.label}</strong>
      </summary>
      <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
        <input
          aria-label={`${input.participant.label} encounter-facing name`}
          onChange={(event) => setName(event.target.value)}
          placeholder="Encounter-facing name"
          value={name}
        />
        <input
          aria-label={`${input.participant.label} short description`}
          onChange={(event) => setShortDescription(event.target.value)}
          placeholder="Short description"
          value={shortDescription}
        />
        <textarea
          aria-label={`${input.participant.label} detailed description`}
          onChange={(event) => setDetailedDescription(event.target.value)}
          placeholder="Detailed GM description"
          rows={3}
          value={detailedDescription}
        />
        <button
          onClick={() =>
            input.onSave({
              detailedDescription,
              name: name.trim() || input.participant.label,
              shortDescription,
            })
          }
          type="button"
        >
          Save description
        </button>
      </div>
    </details>
  );
}

export function RankedRollResultsSection({
  entries,
  roster,
}: {
  entries: RoleplayActionLogEntry[];
  roster: EncounterParticipant[];
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: 0 }}>Ranked roll results</h2>
      {entries.length > 0 ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          {entries.map((entry, index) => {
            const participantLabel =
              roster.find((participant) => participant.id === entry.participantId)?.label ??
              entry.participantId ??
              "Unknown participant";

            return (
              <div key={entry.id}>
                {index + 1}. {participantLabel} · {entry.skillLabel ?? "Unknown skill"} ·{" "}
                {entry.numericSubtotal == null ? "unresolved" : `total ${entry.numericSubtotal}`}
              </div>
            );
          })}
        </div>
      ) : (
        <div>No GM roll results recorded yet.</div>
      )}
    </section>
  );
}

function formatDifficulty(value: RoleplayDifficulty): string {
  return roleplayDifficultyOptions.find((option) => option.id === value)?.label ?? value;
}

export function formatShortDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month} ${hours}:${minutes}`;
}

export function RoleplayActionLogSection({ entries }: { entries: RoleplayActionLogEntry[] }) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: 0 }}>Action log</h2>
      {entries.length > 0 ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          {entries.map((entry) => (
            <div key={entry.id}>
              {formatShortDateTime(entry.createdAt)} · {entry.summary}
              {entry.skillLabel ? ` · ${entry.skillLabel}` : ""}
              {entry.supportSkillLabel ? ` · Support ${entry.supportSkillLabel}` : ""}
              {entry.difficulty ? ` · ${formatDifficulty(entry.difficulty)}` : ""}
              {entry.rollD20 == null ? "" : ` · d20 ${entry.rollD20}`}
              {entry.openEndedD10s.length > 0 ? ` · d10s ${entry.openEndedD10s.join(", ")}` : ""}
              {entry.dieResult == null ? "" : ` · die ${entry.dieResult}`}
              {entry.numericSubtotal == null ? "" : ` · total ${entry.numericSubtotal}`}
              {entry.opponentSkillLabel ? ` · VERSUS ${entry.opponentParticipantName ?? "Opponent"} ${entry.opponentSkillLabel}` : ""}
              {entry.opponentRollD20 == null ? "" : ` · opponent d20 ${entry.opponentRollD20}`}
              {entry.opponentOpenEndedD10s.length > 0 ? ` · opponent d10s ${entry.opponentOpenEndedD10s.join(", ")}` : ""}
              {entry.opponentDieResult == null ? "" : ` · opponent die ${entry.opponentDieResult}`}
              {entry.opponentNumericSubtotal == null ? "" : ` · opponent total ${entry.opponentNumericSubtotal}`}
              {entry.opponentAchievedSuccessLevelLabel ? ` · opponent ${entry.opponentAchievedSuccessLevelLabel}` : ""}
              {entry.opposedResult ? ` · opposed ${entry.opposedResult}` : ""}
              {entry.opposedMargin == null ? "" : ` · margin ${entry.opposedMargin}`}
              {entry.achievedSuccessLevelLabel ? ` · ${entry.achievedSuccessLevelLabel}` : ""}
              {entry.resultModifier == null ? "" : ` · modifier ${entry.resultModifier >= 0 ? "+" : ""}${entry.resultModifier}`}
              {entry.success == null ? "" : entry.success ? " · SUCCESS" : " · NOT SUCCESSFUL"}
              {entry.fumble ? " · FUMBLE" : ""}
              {entry.partial ? " · Partial" : ""}
              {entry.useGenMod ? " · Gen mod" : ""}
              {entry.useObSkillMod ? " · OB/Skill mod" : ""}
              {entry.useDbMod ? " · DB mod" : ""}
              {entry.otherMod ? ` · Other ${entry.otherMod > 0 ? "+" : ""}${entry.otherMod}` : ""}
              {entry.silent ? " · Silent" : ""}
              {entry.opponentSilent ? " · Opponent silent" : ""}
              {entry.calculationText ? ` · ${entry.calculationText}` : ""}
            </div>
          ))}
        </div>
      ) : (
        <div>No roleplaying actions logged yet.</div>
      )}
    </section>
  );
}

export function PlayerRoleplayEncounterView({
  campaign,
  encounter,
  gmMessage,
  scenario,
}: {
  campaign: Campaign | null;
  encounter: EncounterSession;
  gmMessage: string;
  scenario: Scenario | null;
}) {
  return (
    <>
      <EncounterInfoCard
        campaignName={campaign?.name}
        encounter={encounter}
        scenarioName={scenario?.name}
      />
      {gmMessage ? (
        <section style={panelStyle}>
          <h2 style={{ margin: 0 }}>GM message</h2>
          <div>{gmMessage}</div>
        </section>
      ) : null}
      <section style={panelStyle}>
        Roleplaying encounter player tools will appear here.
      </section>
    </>
  );
}
