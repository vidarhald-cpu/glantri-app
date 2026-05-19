"use client";

import type { CharacterWorkspaceCandidate } from "@/lib/campaigns/characterWorkspace";

interface WorkspaceParticipantInspectionHeaderProps {
  candidates?: CharacterWorkspaceCandidate[];
  isGameMaster: boolean;
  onSelectParticipantId?: (participantId: string) => void;
  screenName: string;
  selectedCandidate?: CharacterWorkspaceCandidate;
  selectorLabel?: string;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

export default function WorkspaceParticipantInspectionHeader({
  candidates = [],
  isGameMaster,
  onSelectParticipantId,
  screenName,
  selectedCandidate,
  selectorLabel = "Select character to inspect",
}: WorkspaceParticipantInspectionHeaderProps) {
  const selectedIndex = selectedCandidate
    ? candidates.findIndex((candidate) => candidate.id === selectedCandidate.id)
    : -1;
  const hasMultipleCandidates = candidates.length > 1;

  function selectCandidate(offset: number) {
    if (!selectedCandidate || candidates.length === 0) {
      return;
    }

    const nextIndex = (selectedIndex + offset + candidates.length) % candidates.length;
    const nextCandidate = candidates[nextIndex];

    if (nextCandidate) {
      onSelectParticipantId?.(nextCandidate.id);
    }
  }

  return (
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
        <h2 style={{ margin: 0 }}>
          {screenName}
          {selectedCandidate?.label ? ` — ${selectedCandidate.label}` : ""}
        </h2>
        {isGameMaster ? (
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {hasMultipleCandidates ? (
              <button type="button" onClick={() => selectCandidate(-1)}>
                Previous
              </button>
            ) : null}
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontWeight: 700 }}>{selectorLabel}</span>
              <select
                onChange={(event) => onSelectParticipantId?.(event.target.value)}
                value={selectedCandidate?.id ?? ""}
              >
                {candidates.length === 0 ? (
                  <option value="">No participants available</option>
                ) : null}
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
            {hasMultipleCandidates ? (
              <button type="button" onClick={() => selectCandidate(1)}>
                Next
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
