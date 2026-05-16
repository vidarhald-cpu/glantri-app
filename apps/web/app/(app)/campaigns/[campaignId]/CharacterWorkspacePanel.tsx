"use client";

import { useMemo } from "react";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import {
  buildGmCharacterWorkspaceCandidates,
  resolvePlayerCharacterWorkspaceCandidate,
} from "@/lib/campaigns/characterWorkspace";
import CharacterLoadoutView from "../../characters/[id]/components/CharacterLoadoutView";

interface CharacterWorkspacePanelProps {
  activeEncounter?: EncounterSession;
  currentUserId?: string | null;
  isGameMaster: boolean;
  onSelectParticipantId?: (participantId: string) => void;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
  selectedParticipantId?: string | null;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

export default function CharacterWorkspacePanel({
  activeEncounter,
  currentUserId,
  isGameMaster,
  onSelectParticipantId,
  scenarioId,
  scenarioParticipants,
  selectedParticipantId,
}: CharacterWorkspacePanelProps) {
  const gmCandidates = useMemo(
    () =>
      buildGmCharacterWorkspaceCandidates({
        activeEncounter,
        scenarioId,
        scenarioParticipants,
      }),
    [activeEncounter, scenarioId, scenarioParticipants],
  );
  const playerCandidate = useMemo(
    () =>
      resolvePlayerCharacterWorkspaceCandidate({
        activeEncounter,
        scenarioId,
        scenarioParticipants,
        userId: currentUserId,
      }),
    [activeEncounter, currentUserId, scenarioId, scenarioParticipants],
  );
  const selectedGmCandidate =
    gmCandidates.find((candidate) => candidate.id === selectedParticipantId) ?? gmCandidates[0];
  const selectedCandidate = isGameMaster ? selectedGmCandidate : playerCandidate;
  const selectedIndex = selectedGmCandidate
    ? gmCandidates.findIndex((candidate) => candidate.id === selectedGmCandidate.id)
    : -1;
  const hasMultipleGmCandidates = gmCandidates.length > 1;

  function selectGmCandidate(offset: number) {
    if (!selectedGmCandidate || gmCandidates.length === 0) {
      return;
    }

    const nextIndex = (selectedIndex + offset + gmCandidates.length) % gmCandidates.length;
    const nextCandidate = gmCandidates[nextIndex];

    if (nextCandidate) {
      onSelectParticipantId?.(nextCandidate.id);
    }
  }

  if (!scenarioId) {
    return (
      <section style={panelStyle}>
        <strong>No active scenario is currently available.</strong>
      </section>
    );
  }

  if (!isGameMaster && !selectedCandidate) {
    return (
      <section style={panelStyle}>
        <strong>You are not currently assigned to a character in this scenario.</strong>
      </section>
    );
  }

  if (isGameMaster && gmCandidates.length === 0) {
    return (
      <section style={panelStyle}>
        <strong>No character sheet is available for this participant.</strong>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      {isGameMaster ? (
        <section style={panelStyle}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ margin: 0 }}>Character</h2>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {hasMultipleGmCandidates ? (
                <button type="button" onClick={() => selectGmCandidate(-1)}>
                  Previous
                </button>
              ) : null}
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span style={{ fontWeight: 700 }}>Select character to inspect</span>
                <select
                  onChange={(event) => onSelectParticipantId?.(event.target.value)}
                  value={selectedGmCandidate?.id ?? ""}
                >
                  {gmCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
              {hasMultipleGmCandidates ? (
                <button type="button" onClick={() => selectGmCandidate(1)}>
                  Next
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {selectedCandidate ? (
        <CharacterLoadoutView characterId={selectedCandidate.characterId} showPhysicalState />
      ) : null}
    </section>
  );
}
