"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  Campaign,
  EncounterParticipant,
  EncounterSession,
  RoleplayDifficulty,
  RoleplayParticipantDescription,
  Scenario,
  ScenarioParticipant,
} from "@glantri/domain";
import {
  assignRoleplaySkillRoll,
  normalizeRoleplayState,
  orderRoleplayEncounterParticipants,
  recordRoleplayGmSkillRoll,
  roleplayDifficultyOptions,
  selectAllRoleplayVisibilityForViewer,
  updateRoleplayGmMessage,
  updateRoleplayParticipantDescription,
  updateRoleplayVisibility,
} from "@glantri/domain";

import {
  loadCampaignById,
  loadEncounterById,
  loadScenarioById,
} from "../../../../src/lib/api/localServiceClient";
import RememberedCampaignWorkspaceEffect from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref } from "../../../../src/lib/campaigns/workspace";
import type { loadCanonicalContent } from "../../../../src/lib/content/loadCanonicalContent";

interface RoleplayTopInfoProps {
  campaignName?: string;
  encounter: EncounterSession;
  scenarioName?: string;
}

interface GmRoleplayingEncounterScreenProps {
  campaignId?: string;
  campaignName?: string;
  content?: Awaited<ReturnType<typeof loadCanonicalContent>>;
  embedded?: boolean;
  encounter: EncounterSession;
  onPersist: (nextEncounter: EncounterSession, message?: string) => Promise<EncounterSession>;
  scenario?: Scenario | null;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
}

interface PlayerRoleplayingEncounterScreenProps {
  campaignId: string;
  embedded?: boolean;
  encounterId: string;
  scenarioId: string;
}

interface SkillOption {
  id: string;
  label: string;
  value?: number;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

function formatDifficulty(value: RoleplayDifficulty): string {
  return roleplayDifficultyOptions.find((option) => option.id === value)?.label ?? value;
}

function formatShortDateTime(value: string): string {
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

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readSkillOptions(input: {
  content?: Awaited<ReturnType<typeof loadCanonicalContent>>;
  encounterParticipant?: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
}): SkillOption[] {
  const scenarioParticipant = input.encounterParticipant?.scenarioParticipantId
    ? input.scenarioParticipants.find(
        (participant) => participant.id === input.encounterParticipant?.scenarioParticipantId
      )
    : undefined;
  const sheetSummary = scenarioParticipant?.snapshot.sheetSummary;
  const draftView = isRecord(sheetSummary) && isRecord(sheetSummary.draftView)
    ? sheetSummary.draftView
    : undefined;
  const draftSkills = Array.isArray(draftView?.skills) ? draftView.skills : [];
  const skillsById = new Map(input.content?.skills.map((skill) => [skill.id, skill.name]) ?? []);

  return draftSkills
    .map((skill): SkillOption | undefined => {
      if (!isRecord(skill) || typeof skill.skillId !== "string") {
        return undefined;
      }

      const label =
        (typeof skill.name === "string" && skill.name.trim()) ||
        skillsById.get(skill.skillId) ||
        skill.skillId;

      return {
        id: skill.skillId,
        label,
        value: readNumber(skill.totalSkill) ?? readNumber(skill.effectiveSkillNumber),
      };
    })
    .filter((skill): skill is SkillOption => Boolean(skill))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function getParticipantDescription(input: {
  fallbackName: string;
  participantId: string;
  state: ReturnType<typeof normalizeRoleplayState>;
}): RoleplayParticipantDescription {
  const existing = input.state.participantDescriptions[input.participantId];

  return {
    detailedDescription: existing?.detailedDescription ?? "",
    name: existing?.name ?? input.fallbackName,
    shortDescription: existing?.shortDescription ?? "",
  };
}

function RoleplayTopInfo({ campaignName, encounter, scenarioName }: RoleplayTopInfoProps) {
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

export function GmRoleplayingEncounterScreen({
  campaignId,
  campaignName,
  content,
  embedded = false,
  encounter,
  onPersist,
  scenario,
  scenarioId,
  scenarioParticipants,
}: GmRoleplayingEncounterScreenProps) {
  const roleplayState = normalizeRoleplayState(encounter);
  const roster = orderRoleplayEncounterParticipants(encounter.participants);
  const [gmMessageDraft, setGmMessageDraft] = useState(roleplayState.gmMessage);
  const [selectedParticipantId, setSelectedParticipantId] = useState(roster[0]?.id ?? "");
  const selectedParticipant = roster.find((participant) => participant.id === selectedParticipantId) ?? roster[0];
  const skillOptions = useMemo(
    () =>
      readSkillOptions({
        content,
        encounterParticipant: selectedParticipant,
        scenarioParticipants,
      }),
    [content, scenarioParticipants, selectedParticipant]
  );
  const [selectedSkillId, setSelectedSkillId] = useState(skillOptions[0]?.id ?? "");
  const selectedSkill = skillOptions.find((skill) => skill.id === selectedSkillId) ?? skillOptions[0];
  const [difficulty, setDifficulty] = useState<RoleplayDifficulty>("medium");
  const [silent, setSilent] = useState(false);

  useEffect(() => {
    setGmMessageDraft(roleplayState.gmMessage);
  }, [roleplayState.gmMessage]);

  useEffect(() => {
    if (!selectedParticipantId && roster[0]) {
      setSelectedParticipantId(roster[0].id);
    }
  }, [roster, selectedParticipantId]);

  useEffect(() => {
    if (!selectedSkillId && skillOptions[0]) {
      setSelectedSkillId(skillOptions[0].id);
    }
  }, [selectedSkillId, skillOptions]);

  async function persist(nextEncounter: EncounterSession, message: string) {
    await onPersist(nextEncounter, message);
  }

  async function handleSaveGmMessage() {
    await persist(
      updateRoleplayGmMessage({
        message: gmMessageDraft,
        session: encounter,
      }),
      "Updated roleplaying encounter GM message."
    );
  }

  async function handleVisibilityChange(input: {
    targetParticipantId: string;
    viewerParticipantId: string;
    visible: boolean;
  }) {
    await persist(
      updateRoleplayVisibility({
        session: encounter,
        ...input,
      }),
      "Updated roleplaying visibility."
    );
  }

  async function handleSelectAllVisibility(viewerParticipantId: string) {
    await persist(
      selectAllRoleplayVisibilityForViewer({
        participantIds: roster.map((participant) => participant.id),
        session: encounter,
        viewerParticipantId,
      }),
      "Updated roleplaying visibility row."
    );
  }

  async function handleDescriptionSave(input: {
    description: RoleplayParticipantDescription;
    participantId: string;
  }) {
    await persist(
      updateRoleplayParticipantDescription({
        description: input.description,
        participantId: input.participantId,
        session: encounter,
      }),
      "Updated roleplaying participant description."
    );
  }

  async function handleAssignSkillRoll() {
    if (!selectedParticipant || !selectedSkill) {
      return;
    }

    await persist(
      assignRoleplaySkillRoll({
        difficulty,
        participantId: selectedParticipant.id,
        session: encounter,
        silent,
        skillId: selectedSkill.id,
        skillLabel: selectedSkill.label,
        skillValue: selectedSkill.value,
      }),
      "Assigned roleplaying skill roll."
    );
  }

  async function handleGmRoll() {
    if (!selectedParticipant || !selectedSkill) {
      return;
    }

    const roll = rollD20();
    const calculationText = `Roll ${roll}; ${
      selectedSkill.value == null ? "skill value unavailable" : `skill value ${selectedSkill.value}`
    }; ${formatDifficulty(difficulty)} difficulty; calculation pending rules.`;

    await persist(
      recordRoleplayGmSkillRoll({
        calculationText,
        difficulty,
        participantId: selectedParticipant.id,
        roll,
        session: encounter,
        silent,
        skillId: selectedSkill.id,
        skillLabel: selectedSkill.label,
      }),
      "Recorded GM roleplaying skill roll."
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1120 }}>
      {campaignId && scenarioId ? (
        <RememberedCampaignWorkspaceEffect
          campaignId={campaignId}
          encounterId={encounter.id}
          scenarioId={scenarioId}
          tab="gm-encounter"
        />
      ) : null}
      {!embedded && campaignId && scenarioId ? (
        <Link href={buildCampaignWorkspaceHref({ campaignId, scenarioId, tab: "scenario" })}>
          Back to scenario
        </Link>
      ) : null}
      <RoleplayTopInfo
        campaignName={campaignName}
        encounter={encounter}
        scenarioName={scenario?.name}
      />

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>GM message</h2>
        <textarea
          onChange={(event) => setGmMessageDraft(event.target.value)}
          placeholder="Message intended for player roleplaying screens."
          rows={4}
          value={gmMessageDraft}
        />
        <button onClick={() => void handleSaveGmMessage()} type="button">
          Save GM message
        </button>
      </section>

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
                      <button onClick={() => void handleSelectAllVisibility(viewer.id)} type="button">
                        Select all
                      </button>
                    </td>
                    {roster.map((target) => (
                      <td key={target.id} style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                        <input
                          aria-label={`${viewer.label} can see ${target.label}`}
                          checked={
                            viewer.id === target.id ||
                            Boolean(roleplayState.visibility[viewer.id]?.[target.id])
                          }
                          disabled={viewer.id === target.id}
                          onChange={(event) =>
                            void handleVisibilityChange({
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

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Roleplay roster descriptions</h2>
        {roster.length > 0 ? (
          <div style={{ display: "grid", gap: "0.75rem", maxHeight: "36rem", overflow: "auto" }}>
            {roster.map((participant) => (
              <RoleplayDescriptionRow
                description={getParticipantDescription({
                  fallbackName: participant.label,
                  participantId: participant.id,
                  state: roleplayState,
                })}
                key={participant.id}
                onSave={(description) =>
                  void handleDescriptionSave({
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

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Skill roll assignment</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <select
            aria-label="Roleplay roll participant"
            onChange={(event) => {
              setSelectedParticipantId(event.target.value);
              setSelectedSkillId("");
            }}
            value={selectedParticipant?.id ?? ""}
          >
            {roster.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Roleplay roll skill"
            disabled={skillOptions.length === 0}
            onChange={(event) => setSelectedSkillId(event.target.value)}
            value={selectedSkill?.id ?? ""}
          >
            {skillOptions.length > 0 ? (
              skillOptions.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.label}
                  {skill.value == null ? "" : ` (${skill.value})`}
                </option>
              ))
            ) : (
              <option value="">No skills available</option>
            )}
          </select>
          <select
            aria-label="Roleplay roll difficulty"
            onChange={(event) => setDifficulty(event.target.value as RoleplayDifficulty)}
            value={difficulty}
          >
            {roleplayDifficultyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
            <input
              checked={silent}
              onChange={(event) => setSilent(event.target.checked)}
              type="checkbox"
            />
            Silent skill roll
          </label>
          <button disabled={!selectedParticipant || !selectedSkill} onClick={() => void handleAssignSkillRoll()} type="button">
            Assign
          </button>
          <button disabled={!selectedParticipant || !selectedSkill} onClick={() => void handleGmRoll()} type="button">
            GM Roll
          </button>
        </div>
        <div style={{ color: "#5e5a50" }}>
          Roleplay difficulty math is not finalized yet. GM Roll records a d20 and marks the
          calculation as pending rules instead of inventing success logic.
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Action log</h2>
        {roleplayState.actionLog.length > 0 ? (
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {roleplayState.actionLog.map((entry) => (
              <div key={entry.id}>
                {formatShortDateTime(entry.createdAt)} · {entry.summary}
                {entry.skillLabel ? ` · ${entry.skillLabel}` : ""}
                {entry.difficulty ? ` · ${formatDifficulty(entry.difficulty)}` : ""}
                {entry.roll == null ? "" : ` · roll ${entry.roll}`}
                {entry.silent ? " · Silent" : ""}
                {entry.calculationText ? ` · ${entry.calculationText}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <div>No roleplaying actions logged yet.</div>
        )}
      </section>
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

export function PlayerRoleplayingEncounterScreen({
  campaignId,
  embedded = false,
  encounterId,
  scenarioId,
}: PlayerRoleplayingEncounterScreenProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [encounter, setEncounter] = useState<EncounterSession | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRoleplayEncounter() {
      const [nextEncounter, nextScenario, nextCampaign] = await Promise.all([
        loadEncounterById(encounterId),
        loadScenarioById(scenarioId),
        loadCampaignById(campaignId).catch(() => null),
      ]);

      if (cancelled) {
        return;
      }

      setEncounter(nextEncounter);
      setScenario(nextScenario);
      setCampaign(nextCampaign);
      setLoading(false);
    }

    void loadRoleplayEncounter();

    return () => {
      cancelled = true;
    };
  }, [campaignId, encounterId, scenarioId]);

  if (loading) {
    return <section>Loading roleplaying encounter...</section>;
  }

  if (!encounter) {
    return <section>Roleplaying encounter not found.</section>;
  }

  const roleplayState = normalizeRoleplayState(encounter);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <RememberedCampaignWorkspaceEffect
        campaignId={campaignId}
        encounterId={encounterId}
        scenarioId={scenarioId}
        tab="player-encounter"
      />
      {!embedded ? (
        <Link href={buildCampaignWorkspaceHref({ campaignId, scenarioId, tab: "scenario" })}>
          Back to scenario
        </Link>
      ) : null}
      <RoleplayTopInfo
        campaignName={campaign?.name}
        encounter={encounter}
        scenarioName={scenario?.name}
      />
      {roleplayState.gmMessage ? (
        <section style={panelStyle}>
          <h2 style={{ margin: 0 }}>GM message</h2>
          <div>{roleplayState.gmMessage}</div>
        </section>
      ) : null}
      <section style={panelStyle}>
        Roleplaying encounter player tools will appear here.
      </section>
    </section>
  );
}
