"use client";

import type {
  ScenarioControllerFilter,
  ScenarioParticipantTypeFilter,
  ScenarioParticipantTypeFilterOption,
  ScenarioRosterCandidate
} from "./scenarioScreenTypes";

interface ScenarioCampaignRosterPickerSectionProps {
  filteredScenarioRosterCandidates: ScenarioRosterCandidate[];
  onRosterCivilizationFilterChange: (value: string) => void;
  onRosterControllerFilterChange: (value: ScenarioControllerFilter) => void;
  onRosterParticipantToggle: (candidate: ScenarioRosterCandidate, member: boolean) => void;
  onRosterProfessionFilterChange: (value: string) => void;
  onRosterSearchChange: (value: string) => void;
  onRosterSkillGroupFilterChange: (value: string) => void;
  onRosterTypeFilterChange: (value: ScenarioParticipantTypeFilter) => void;
  participantCivilizationOptions: string[];
  participantProfessionOptions: string[];
  participantSkillGroupOptions: string[];
  rosterCivilizationFilter: string;
  rosterControllerFilter: ScenarioControllerFilter;
  rosterProfessionFilter: string;
  rosterSearch: string;
  rosterSkillGroupFilter: string;
  rosterTypeFilter: ScenarioParticipantTypeFilter;
  rosterTypeFilterOptions: ScenarioParticipantTypeFilterOption[];
  scenarioRosterCandidates: ScenarioRosterCandidate[];
}

export function ScenarioCampaignRosterPickerSection({
  filteredScenarioRosterCandidates,
  onRosterCivilizationFilterChange,
  onRosterControllerFilterChange,
  onRosterParticipantToggle,
  onRosterProfessionFilterChange,
  onRosterSearchChange,
  onRosterSkillGroupFilterChange,
  onRosterTypeFilterChange,
  participantCivilizationOptions,
  participantProfessionOptions,
  participantSkillGroupOptions,
  rosterCivilizationFilter,
  rosterControllerFilter,
  rosterProfessionFilter,
  rosterSearch,
  rosterSkillGroupFilter,
  rosterTypeFilter,
  rosterTypeFilterOptions,
  scenarioRosterCandidates
}: ScenarioCampaignRosterPickerSectionProps) {
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
      <h2 style={{ margin: 0 }}>Add from campaign roster</h2>
      <p style={{ margin: 0 }}>
        Add existing concrete campaign roster members to this scenario. Templates stay in Template
        sources below.
      </p>
      {scenarioRosterCandidates.length > 0 ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <select
              aria-label="Campaign roster type filter"
              onChange={(event) => onRosterTypeFilterChange(event.target.value as ScenarioParticipantTypeFilter)}
              value={rosterTypeFilter}
            >
              {rosterTypeFilterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Campaign roster controller filter"
              onChange={(event) => onRosterControllerFilterChange(event.target.value as ScenarioControllerFilter)}
              value={rosterControllerFilter}
            >
              <option value="all">All controllers</option>
              <option value="players">Players</option>
              <option value="gms">GMs</option>
            </select>
            <select
              aria-label="Campaign roster civilization filter"
              onChange={(event) => onRosterCivilizationFilterChange(event.target.value)}
              value={rosterCivilizationFilter}
            >
              <option value="">All civilizations</option>
              {participantCivilizationOptions.map((civilization) => (
                <option key={civilization} value={civilization}>
                  {civilization}
                </option>
              ))}
            </select>
            <select
              aria-label="Campaign roster profession filter"
              onChange={(event) => onRosterProfessionFilterChange(event.target.value)}
              value={rosterProfessionFilter}
            >
              <option value="">All professions</option>
              {participantProfessionOptions.map((profession) => (
                <option key={profession} value={profession}>
                  {profession}
                </option>
              ))}
            </select>
            <select
              aria-label="Campaign roster skill group filter"
              onChange={(event) => onRosterSkillGroupFilterChange(event.target.value)}
              value={rosterSkillGroupFilter}
            >
              <option value="">All skill groups</option>
              {participantSkillGroupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <input
              aria-label="Search campaign roster candidates"
              onChange={(event) => onRosterSearchChange(event.target.value)}
              placeholder="Search campaign roster"
              style={{ minWidth: 220 }}
              type="search"
              value={rosterSearch}
            />
          </div>
          <div style={{ maxHeight: "24rem", overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 780, width: "100%" }}>
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
                    Add
                  </th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>
                    Name
                  </th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>
                    Type
                  </th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>
                    Source
                  </th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>
                    Controller
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredScenarioRosterCandidates.map((candidate) => (
                  <tr key={candidate.rosterEntry.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0", textAlign: "center" }}>
                      <input
                        aria-label={`Toggle ${candidate.name} scenario participation`}
                        checked={false}
                        onChange={(event) => onRosterParticipantToggle(candidate, event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <strong>{candidate.name}</strong>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.typeLabel}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.sourceKind}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.controllerLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredScenarioRosterCandidates.length === 0 ? (
              <div style={{ padding: "0.75rem 0" }}>
                No campaign roster candidates match the current filters.
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div>No campaign roster entries are available. Add PCs, NPCs, or templates to the campaign roster first.</div>
      )}
    </section>
  );
}
