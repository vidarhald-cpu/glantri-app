"use client";

import type { ScenarioEventLog } from "@glantri/domain";

import { formatEventType, formatShortDateTime } from "./scenarioScreenHelpers";

interface ScenarioEventLogSectionProps {
  eventLogs: ScenarioEventLog[];
}

export function ScenarioEventLogSection({ eventLogs }: ScenarioEventLogSectionProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h2 style={{ margin: 0 }}>Event log</h2>
      {eventLogs.length > 0 ? (
        eventLogs.map((eventLog) => (
          <div
            key={eventLog.id}
            style={{
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.25rem",
              padding: "0.75rem 1rem"
            }}
          >
            <strong>{formatEventType(eventLog.eventType)}</strong>
            <div>{eventLog.summary}</div>
            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              {formatShortDateTime(eventLog.createdAt)}
            </div>
          </div>
        ))
      ) : (
        <div>No event log entries yet.</div>
      )}
    </section>
  );
}
