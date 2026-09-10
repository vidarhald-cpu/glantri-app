import type { EncounterSession } from "@glantri/domain";

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

function formatTerminalStatus(status: EncounterSession["status"]): string {
  return status === "archived" ? "Archived" : "Closed";
}

export function CompletedEncounterHistory({
  campaignName,
  encounter,
  scenarioName,
  viewerMode,
}: {
  campaignName?: string;
  encounter: EncounterSession;
  scenarioName?: string;
  viewerMode: "gm" | "player";
}) {
  return (
    <section aria-label="Encounter history" style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
      <header style={{ display: "grid", gap: "0.35rem" }}>
        <div style={{ color: "#5e5a50" }}>
          {[campaignName, scenarioName].filter(Boolean).join(" · ")}
        </div>
        <h1 style={{ margin: 0 }}>{encounter.title}</h1>
        <strong>{formatTerminalStatus(encounter.status)} encounter</strong>
      </header>

      <section style={{ ...panelStyle, background: "#fff8df", borderColor: "#d8c57b" }}>
        <strong>Read-only history</strong>
        <div>
          This Encounter is {encounter.status === "archived" ? "archived" : "closed"}. It cannot be
          resumed, edited, rolled in, or opened in Combat.
        </div>
      </section>

      <section aria-labelledby="encounter-history-summary" style={panelStyle}>
        <h2 id="encounter-history-summary" style={{ margin: 0 }}>
          Summary
        </h2>
        {encounter.description ? <p style={{ margin: 0 }}>{encounter.description}</p> : null}
        {encounter.timelineLabel ? (
          <div>
            <strong>Timeline:</strong> {encounter.timelineLabel}
          </div>
        ) : null}
        <div>
          <strong>Activity:</strong> {encounter.kind === "roleplay" ? "Roleplaying" : "Combat"}
        </div>
      </section>

      <section aria-labelledby="encounter-history-outcome" style={panelStyle}>
        <h2 id="encounter-history-outcome" style={{ margin: 0 }}>
          Public outcome
        </h2>
        <p style={{ margin: 0 }}>{encounter.playerOutcome || "No public outcome was recorded."}</p>
      </section>

      {viewerMode === "gm" ? (
        <section aria-labelledby="encounter-history-private-note" style={panelStyle}>
          <h2 id="encounter-history-private-note" style={{ margin: 0 }}>
            Private GM closing note
          </h2>
          <p style={{ margin: 0 }}>
            {encounter.gmPrivateClosingNote || "No private closing note was recorded."}
          </p>
        </section>
      ) : null}
    </section>
  );
}
