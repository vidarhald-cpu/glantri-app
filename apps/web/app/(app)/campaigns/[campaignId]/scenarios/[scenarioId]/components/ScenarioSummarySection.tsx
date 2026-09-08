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
  const isArchived = scenarioStatus === "archived";
  const isMetadataReadOnly = scenarioStatus === "completed" || isArchived;
  const allowedStatuses: Scenario["status"][] =
    scenarioStatus === "draft"
      ? ["draft", "live", "archived"]
      : scenarioStatus === "live"
        ? ["live", "paused"]
        : scenarioStatus === "paused"
          ? ["paused", "live", "completed"]
          : scenarioStatus === "completed"
            ? ["completed", "archived"]
            : ["archived"];
  const statusLabel = (status: Scenario["status"]) =>
    status === "live"
      ? "Active"
      : status === "completed"
        ? "Closed"
        : status.charAt(0).toUpperCase() + status.slice(1);

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
          disabled={isMetadataReadOnly}
          onChange={(event) => onNameChange(event.target.value)}
          value={scenarioName}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Description</span>
        <input
          disabled={isMetadataReadOnly}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="No description yet."
          type="text"
          value={scenarioDescription}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Status</span>
        {isArchived ? (
          <output aria-label="Scenario status">Archived</output>
        ) : (
          <select
            onChange={(event) => onStatusChange(event.target.value as Scenario["status"])}
            value={scenarioStatus}
          >
            {allowedStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        )}
      </label>
      <button disabled={isArchived} onClick={onUpdate} type="button">
        Update scenario
      </button>
    </section>
  );
}
