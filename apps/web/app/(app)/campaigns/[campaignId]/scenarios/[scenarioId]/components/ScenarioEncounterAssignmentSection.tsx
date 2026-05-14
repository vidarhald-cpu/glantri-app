"use client";

import { Fragment, type Dispatch, type SetStateAction } from "react";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { getConcreteParticipantMetadata } from "./scenarioScreenHelpers";
import type {
  ScenarioParticipantTypeFilter,
  ScenarioParticipantTypeFilterOption
} from "./scenarioScreenTypes";

interface ScenarioEncounterAssignmentSectionProps {
  assignmentParticipants: ScenarioParticipant[];
  concreteParticipants: ScenarioParticipant[];
  expandedAssignmentParticipantIds: string[];
  formatUserLabel: (userId: string | undefined) => string;
  isParticipantInEncounter: (encounter: EncounterSession, participant: ScenarioParticipant) => boolean;
  nonArchivedEncounters: EncounterSession[];
  onBulkEncounterAssignment: (member: boolean) => void;
  onBulkEncounterIdChange: (value: string) => void;
  onEncounterParticipantToggle: (
    encounter: EncounterSession,
    participant: ScenarioParticipant,
    member: boolean
  ) => void;
  onParticipantActiveToggle: (participant: ScenarioParticipant, isActive: boolean) => void;
  onParticipantCivilizationFilterChange: (value: string) => void;
  onParticipantProfessionFilterChange: (value: string) => void;
  onParticipantSearchChange: (value: string) => void;
  onParticipantSkillGroupFilterChange: (value: string) => void;
  onParticipantTypeFilterChange: (value: ScenarioParticipantTypeFilter) => void;
  participantCivilizationFilter: string;
  participantCivilizationOptions: string[];
  participantProfessionFilter: string;
  participantProfessionOptions: string[];
  participantSearch: string;
  participantSkillGroupFilter: string;
  participantSkillGroupOptions: string[];
  participantTypeFilter: ScenarioParticipantTypeFilter;
  participantTypeFilterOptions: ScenarioParticipantTypeFilterOption[];
  selectedAssignmentParticipantIds: string[];
  selectedBulkEncounterId: string;
  setExpandedAssignmentParticipantIds: Dispatch<SetStateAction<string[]>>;
  setSelectedAssignmentParticipantIds: Dispatch<SetStateAction<string[]>>;
}

export function ScenarioEncounterAssignmentSection({
  assignmentParticipants,
  concreteParticipants,
  expandedAssignmentParticipantIds,
  formatUserLabel,
  isParticipantInEncounter,
  nonArchivedEncounters,
  onBulkEncounterAssignment,
  onBulkEncounterIdChange,
  onEncounterParticipantToggle,
  onParticipantActiveToggle,
  onParticipantCivilizationFilterChange,
  onParticipantProfessionFilterChange,
  onParticipantSearchChange,
  onParticipantSkillGroupFilterChange,
  onParticipantTypeFilterChange,
  participantCivilizationFilter,
  participantCivilizationOptions,
  participantProfessionFilter,
  participantProfessionOptions,
  participantSearch,
  participantSkillGroupFilter,
  participantSkillGroupOptions,
  participantTypeFilter,
  participantTypeFilterOptions,
  selectedAssignmentParticipantIds,
  selectedBulkEncounterId,
  setExpandedAssignmentParticipantIds,
  setSelectedAssignmentParticipantIds
}: ScenarioEncounterAssignmentSectionProps) {
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
      <h2 style={{ margin: 0 }}>Encounter Assignment</h2>
      <p style={{ margin: 0 }}>
        Assign concrete scenario participants to planned, active, or paused encounters. Click a
        participant name for scenario state and encounter-specific detail placeholders.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <select
          aria-label="Encounter assignment type filter"
          onChange={(event) => onParticipantTypeFilterChange(event.target.value as ScenarioParticipantTypeFilter)}
          value={participantTypeFilter}
        >
          {participantTypeFilterOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Encounter assignment civilization filter"
          onChange={(event) => onParticipantCivilizationFilterChange(event.target.value)}
          value={participantCivilizationFilter}
        >
          <option value="">All civilizations</option>
          {participantCivilizationOptions.map((civilization) => (
            <option key={civilization} value={civilization}>
              {civilization}
            </option>
          ))}
        </select>
        <select
          aria-label="Encounter assignment profession filter"
          onChange={(event) => onParticipantProfessionFilterChange(event.target.value)}
          value={participantProfessionFilter}
        >
          <option value="">All professions</option>
          {participantProfessionOptions.map((profession) => (
            <option key={profession} value={profession}>
              {profession}
            </option>
          ))}
        </select>
        <select
          aria-label="Encounter assignment skill group filter"
          onChange={(event) => onParticipantSkillGroupFilterChange(event.target.value)}
          value={participantSkillGroupFilter}
        >
          <option value="">All skill groups</option>
          {participantSkillGroupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <input
          aria-label="Search encounter assignment participants"
          onChange={(event) => onParticipantSearchChange(event.target.value)}
          placeholder="Search encounter participants"
          style={{ minWidth: 220 }}
          type="search"
          value={participantSearch}
        />
      </div>
      {concreteParticipants.length > 0 ? (
        <>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <select
              aria-label="Bulk assignment encounter"
              disabled={nonArchivedEncounters.length === 0}
              onChange={(event) => onBulkEncounterIdChange(event.target.value)}
              value={selectedBulkEncounterId}
            >
              {nonArchivedEncounters.length === 0 ? (
                <option value="">No assignable encounters</option>
              ) : null}
              {nonArchivedEncounters.map((encounter) => (
                <option key={encounter.id} value={encounter.id}>
                  {encounter.title}
                </option>
              ))}
            </select>
            <button
              disabled={selectedAssignmentParticipantIds.length === 0 || !selectedBulkEncounterId}
              onClick={() => onBulkEncounterAssignment(true)}
              type="button"
            >
              Assign selected
            </button>
            <button
              disabled={selectedAssignmentParticipantIds.length === 0 || !selectedBulkEncounterId}
              onClick={() => onBulkEncounterAssignment(false)}
              type="button"
            >
              Withdraw selected
            </button>
            <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              {selectedAssignmentParticipantIds.length} selected
            </span>
          </div>
          <div style={{ maxHeight: "36rem", overflow: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                minWidth: 620 + nonArchivedEncounters.length * 120,
                width: "100%"
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th
                    style={{
                      background: "#fff",
                      padding: "0.5rem 0.75rem 0.5rem 0",
                      position: "sticky",
                      textAlign: "center",
                      top: 0
                    }}
                  >
                    Select
                  </th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>
                    Name
                  </th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>
                    Type
                  </th>
                  {nonArchivedEncounters.map((encounter) => (
                    <th
                      key={encounter.id}
                      style={{
                        background: "#fff",
                        padding: "0.5rem 0.75rem",
                        position: "sticky",
                        textAlign: "center",
                        top: 0
                      }}
                      title={encounter.title}
                    >
                      {encounter.title.length > 16 ? `${encounter.title.slice(0, 15)}...` : encounter.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignmentParticipants.map((participant) => {
                  const participantMetadata = getConcreteParticipantMetadata(participant);
                  const expanded = expandedAssignmentParticipantIds.includes(participant.id);
                  const joinedEncounters = nonArchivedEncounters.filter((encounter) =>
                    isParticipantInEncounter(encounter, participant)
                  );

                  return (
                    <Fragment key={participant.id}>
                      <tr style={{ borderBottom: "1px solid #eee8dc" }}>
                        <td style={{ padding: "0.6rem 0.75rem 0.6rem 0", textAlign: "center" }}>
                          <input
                            aria-label={`Select ${participant.snapshot.displayName} for bulk encounter assignment`}
                            checked={selectedAssignmentParticipantIds.includes(participant.id)}
                            onChange={(event) =>
                              setSelectedAssignmentParticipantIds((current) =>
                                event.target.checked
                                  ? [...new Set([...current, participant.id])]
                                  : current.filter((id) => id !== participant.id)
                              )
                            }
                            type="checkbox"
                          />
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem" }}>
                          <button
                            aria-expanded={expanded}
                            aria-label={`Toggle ${participant.snapshot.displayName} assignment details`}
                            onClick={() =>
                              setExpandedAssignmentParticipantIds((current) =>
                                current.includes(participant.id)
                                  ? current.filter((id) => id !== participant.id)
                                  : [...current, participant.id]
                              )
                            }
                            style={{
                              background: "transparent",
                              border: 0,
                              color: "#184f3d",
                              cursor: "pointer",
                              font: "inherit",
                              fontWeight: 700,
                              padding: 0,
                              textAlign: "left",
                              textDecoration: "underline"
                            }}
                            type="button"
                          >
                            {participant.snapshot.displayName}
                          </button>
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem" }}>{participantMetadata.typeLabel}</td>
                        {nonArchivedEncounters.map((encounter) => (
                          <td key={encounter.id} style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                            <input
                              aria-label={`Toggle ${participant.snapshot.displayName} in ${encounter.title}`}
                              checked={isParticipantInEncounter(encounter, participant)}
                              onChange={(event) =>
                                onEncounterParticipantToggle(
                                  encounter,
                                  participant,
                                  event.target.checked
                                )
                              }
                              type="checkbox"
                            />
                          </td>
                        ))}
                      </tr>
                      {expanded ? (
                        <tr key={`${participant.id}-details`}>
                          <td
                            colSpan={3 + nonArchivedEncounters.length}
                            style={{ background: "#fbfaf6", padding: "0.75rem 1rem" }}
                          >
                            <div style={{ display: "grid", gap: "0.5rem" }}>
                              <strong>Encounter-specific details</strong>
                              <div
                                style={{
                                  alignItems: "center",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "0.75rem"
                                }}
                              >
                                <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                                  <input
                                    aria-label={`Toggle ${participant.snapshot.displayName} active scenario status`}
                                    checked={participant.isActive}
                                    onChange={(event) =>
                                      onParticipantActiveToggle(participant, event.target.checked)
                                    }
                                    type="checkbox"
                                  />
                                  Active
                                </label>
                                <span>Controller: {formatUserLabel(participant.controlledByUserId)}</span>
                                <span>Status: {participant.isActive ? "Active" : "Inactive"}</span>
                              </div>
                              {joinedEncounters.length > 0 ? (
                                joinedEncounters.map((encounter) => (
                                  <div key={encounter.id}>
                                    <strong>{encounter.title}:</strong>{" "}
                                    appearance, disguise, clothing/equipment notes, encounter role,
                                    visibility notes, and GM-only notes will live on this encounter
                                    participant entry.
                                  </div>
                                ))
                              ) : (
                                <div>
                                  This participant is not assigned to a non-archived encounter yet.
                                  Assign them to an encounter before recording encounter-specific details.
                                </div>
                              )}
                              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                                Editing these fields is deferred; this placeholder is intentionally here
                                in Encounter Assignment, not a separate Scenario Participants roster.
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {assignmentParticipants.length === 0 ? (
              <div style={{ padding: "0.75rem 0" }}>
                No concrete participants match the current encounter assignment filters.
              </div>
            ) : null}
          </div>
        </>
      ) : concreteParticipants.length === 0 ? (
        <div>Add a campaign roster member or create a temporary actor before assigning encounters.</div>
      ) : (
        <div>No concrete participants match the current encounter assignment filters.</div>
      )}
    </section>
  );
}
