"use client";

import type { Scenario } from "@glantri/domain";

interface ScenarioSummarySectionProps {
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onStatusChange: (value: Scenario["status"]) => void;
  onUpdate: () => void;
  scenarioDescription: string;
  scenarioName: string;
  scenarioStatus: Scenario["status"];
}

export function ScenarioSummarySection({
  onDescriptionChange,
  onNameChange,
  onStatusChange,
  onUpdate,
  scenarioDescription,
  scenarioName,
  scenarioStatus
}: ScenarioSummarySectionProps) {
  return (
    <section
      aria-label="Scenario summary"
      style={{
        alignItems: "end",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "minmax(160px, 1fr) minmax(240px, 2fr) minmax(130px, 0.7fr) auto",
        padding: "0.85rem 1rem"
      }}
    >
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Name</span>
        <input onChange={(event) => onNameChange(event.target.value)} value={scenarioName} />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Description</span>
        <input
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="No description yet."
          type="text"
          value={scenarioDescription}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Status</span>
        <select
          onChange={(event) => onStatusChange(event.target.value as Scenario["status"])}
          value={scenarioStatus}
        >
          <option value="draft">Draft</option>
          <option value="prepared">Prepared</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <button onClick={onUpdate} type="button">
        Update scenario
      </button>
    </section>
  );
}
