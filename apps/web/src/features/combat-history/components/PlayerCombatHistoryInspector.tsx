import type { ProjectedCombatHistoryEvent, ProjectedCombatHistorySnapshot } from "@glantri/domain";

import { CombatEventResultList } from "./CombatEventResultList";

const panelStyle = {
  background: "#fffdf8",
  border: "1px solid #d9ddd8",
  borderRadius: 10,
  display: "grid",
  gap: "0.35rem",
  padding: "0.7rem",
} as const;

function label(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        entry && typeof entry === "object" && "displayName" in entry
          ? String((entry as { displayName: unknown }).displayName)
          : displayValue(entry),
      )
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.toLowerCase().endsWith("id"))
      .map(([key, nested]) => `${label(key)} ${displayValue(nested)}`)
      .join(" · ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function SnapshotPanel(input: { facts: Record<string, unknown>; title: string }) {
  const rows = Object.entries(input.facts)
    .filter(([key, value]) => !key.toLowerCase().endsWith("id") && displayValue(value))
    .map(([key, value]) => ({ label: label(key), value: displayValue(value) }));

  return (
    <section aria-label={input.title} style={panelStyle}>
      <strong>{input.title}</strong>
      {rows.length ? (
        rows.map((row) => (
          <div key={row.label} style={{ fontSize: "0.88rem" }}>
            <strong>{row.label}:</strong> {row.value}
          </div>
        ))
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>No visible recorded detail.</div>
      )}
    </section>
  );
}

export function PlayerCombatHistoryInspector(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  snapshot?: ProjectedCombatHistorySnapshot;
}) {
  return (
    <section
      aria-label="Player combat historical inspector"
      style={{ display: "grid", gap: "0.75rem" }}
    >
      {input.snapshot?.incompleteMessage ? (
        <div style={{ color: "#8a4f21", fontWeight: 700 }}>{input.snapshot.incompleteMessage}</div>
      ) : null}
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <SnapshotPanel
          facts={input.snapshot?.panels.actionSelector ?? {}}
          title="Action selector"
        />
        <SnapshotPanel facts={input.snapshot?.panels.phase1 ?? {}} title="Phase 1" />
        <SnapshotPanel facts={input.snapshot?.panels.phase2 ?? {}} title="Phase 2" />
        <SnapshotPanel facts={input.snapshot?.panels.modifiers ?? {}} title="Combat modifiers" />
        <CombatEventResultList
          emptyMessage={input.snapshot?.incompleteMessage ?? "No recorded result for this step."}
          events={input.events}
        />
      </div>
    </section>
  );
}
