"use client";

import { useState } from "react";

import type { Scenario, ScenarioLifecycleAction, ScenarioStartPreflight } from "@glantri/domain";

const actionLabels: Record<ScenarioLifecycleAction, string> = {
  archive: "Archive",
  close: "Close",
  pause: "Pause",
  reopen: "Reopen for play",
  restore: "Restore",
  resume: "Resume",
  start: "Start Scenario",
};

interface ScenarioSummarySectionProps {
  availableLifecycleActions: ScenarioLifecycleAction[];
  lifecyclePending: boolean;
  onDescriptionChange: (value: string) => void;
  onLifecycleAction: (input: {
    acceptedWarningCodes: string[];
    action: ScenarioLifecycleAction;
    reason: string;
  }) => void;
  onNameChange: (value: string) => void;
  onUpdate: () => void;
  scenarioDescription: string;
  scenarioName: string;
  scenarioStatus: Scenario["status"];
  startPreflight?: ScenarioStartPreflight;
}

export function ScenarioSummarySection({
  availableLifecycleActions,
  lifecyclePending,
  onDescriptionChange,
  onLifecycleAction,
  onNameChange,
  onUpdate,
  scenarioDescription,
  scenarioName,
  scenarioStatus,
  startPreflight,
}: ScenarioSummarySectionProps) {
  const [acceptedWarningCodes, setAcceptedWarningCodes] = useState<string[]>([]);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const unacceptedWarnings =
    startPreflight?.warnings.filter((warning) => !acceptedWarningCodes.includes(warning.code)) ??
    [];

  return (
    <section
      aria-label="Scenario summary"
      style={{
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.9rem",
        padding: "0.85rem 1rem",
      }}
    >
      <div
        style={{
          alignItems: "end",
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "minmax(160px, 1fr) minmax(240px, 2fr) auto",
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
        <button onClick={onUpdate} type="button">
          Update Scenario
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid #e5e8e4",
          display: "grid",
          gap: "0.65rem",
          paddingTop: "0.75rem",
        }}
      >
        <div>
          <strong>
            Status: {scenarioStatus[0]?.toUpperCase()}
            {scenarioStatus.slice(1)}
          </strong>
        </div>

        {startPreflight?.blockers.map((blocker) => (
          <div key={blocker.code} role="alert">
            {blocker.message}
          </div>
        ))}

        {startPreflight?.warnings.map((warning) => (
          <label
            key={warning.code}
            style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}
          >
            <input
              checked={acceptedWarningCodes.includes(warning.code)}
              onChange={(event) =>
                setAcceptedWarningCodes((current) =>
                  event.target.checked
                    ? [...current, warning.code]
                    : current.filter((code) => code !== warning.code),
                )
              }
              type="checkbox"
            />
            Accept warning: {warning.message}
          </label>
        ))}

        <label style={{ display: "grid", gap: "0.25rem", maxWidth: 560 }}>
          <span>Reason for lifecycle action</span>
          <input
            onChange={(event) => setLifecycleReason(event.target.value)}
            placeholder="Record why this status is changing"
            value={lifecycleReason}
          />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {availableLifecycleActions.map((action) => {
            const startBlocked =
              action === "start" &&
              ((startPreflight?.blockers.length ?? 0) > 0 || unacceptedWarnings.length > 0);

            return (
              <button
                disabled={lifecyclePending || !lifecycleReason.trim() || startBlocked}
                key={action}
                onClick={() =>
                  onLifecycleAction({
                    acceptedWarningCodes,
                    action,
                    reason: lifecycleReason,
                  })
                }
                type="button"
              >
                {lifecyclePending ? "Saving…" : actionLabels[action]}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
