"use client";

import { isScenarioReadOnly, scenarioLifecycleTransitions, type Scenario } from "@glantri/domain";

import { formatScenarioStatus } from "@/lib/campaigns/scenarioStatusLabel";

interface ScenarioSummarySectionProps {
  onDescriptionChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onStatusChange: (value: Scenario["status"]) => void;
  onUpdate: () => void;
  scenarioDescription: string;
  scenarioName: string;
  /** The Scenario's persisted status. Authoritative for every lifecycle judgement. */
  scenarioStatus: Scenario["status"];
  /**
   * The status the GM currently has selected but has not yet saved. It is only the
   * `select`'s value. Deriving editability or the offered transitions from it would
   * mean the control disabled itself the moment a terminal step was chosen, which is
   * exactly why the `completed -> archived` step was unreachable.
   */
  selectedStatus: Scenario["status"];
}

export function ScenarioSummarySection({
  onDescriptionChange,
  onNameChange,
  onStatusChange,
  onUpdate,
  scenarioDescription,
  scenarioName,
  scenarioStatus,
  selectedStatus,
}: ScenarioSummarySectionProps) {
  const isArchived = scenarioStatus === "archived";
  /**
   * Metadata editability and the offered lifecycle steps are both read from the
   * domain vocabulary instead of being re-derived here. `scenarioLifecycleTransitions`
   * is a `Record<ScenarioStatus, ScenarioStatus[]>`, so a new status or a changed
   * transition set reaches this control through the compiler.
   *
   * The current status leads the list so the `select` can display it; the rest of
   * the list is exactly the domain's permitted next steps, which is what makes
   * `completed -> archived` reachable without widening anything else.
   */
  const isMetadataReadOnly = isScenarioReadOnly(scenarioStatus);
  const allowedStatuses: Scenario["status"][] = [
    scenarioStatus,
    ...scenarioLifecycleTransitions[scenarioStatus],
  ];

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
            value={selectedStatus}
          >
            {allowedStatuses.map((status) => (
              <option key={status} value={status}>
                {formatScenarioStatus(status)}
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
