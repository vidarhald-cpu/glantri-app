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
  scenarioStatus,
}: ScenarioSummarySectionProps) {
  const isTerminal = scenarioStatus === "completed" || scenarioStatus === "archived";
  const scenarioStatusLabel = scenarioStatus === "completed" ? "Closed" : "Archived";

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
        padding: "0.85rem 1rem",
      }}
    >
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Name</span>
        <input
          disabled={isTerminal}
          onChange={(event) => onNameChange(event.target.value)}
          value={scenarioName}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Description</span>
        <input
          disabled={isTerminal}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="No description yet."
          type="text"
          value={scenarioDescription}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Status</span>
        {isTerminal ? (
          <output aria-label="Scenario status">{scenarioStatusLabel}</output>
        ) : (
          <select
            onChange={(event) => onStatusChange(event.target.value as Scenario["status"])}
            value={scenarioStatus}
          >
            <option value="draft">Draft</option>
            <option value="live">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        )}
      </label>
      <button disabled={isTerminal} onClick={onUpdate} type="button">
        Update scenario
      </button>
    </section>
  );
}
