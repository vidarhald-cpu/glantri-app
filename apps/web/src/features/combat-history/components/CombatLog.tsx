import React from "react";
import type { CombatLogEventPresentation } from "@glantri/domain";

import type { CombatLogEventSelection } from "../view-models/combatLogSelection";

const PHASE_LABELS: Readonly<Record<NonNullable<CombatLogEventPresentation["phase"]>, string>> = {
  declaration: "Declaration",
  phase1: "Phase 1",
  phase2: "Phase 2",
  round_end: "Round end",
};

export function CombatLog(input: {
  events: readonly CombatLogEventPresentation[];
  onSelect: (selection: CombatLogEventSelection) => void;
  selectedCombatLogEventId?: string;
  selectedPresentationTargetId?: string;
}) {
  return (
    <section
      aria-label="Combat Log"
      style={{
        background: "#fbfaf7",
        border: "1px solid #e3e1dc",
        borderRadius: 8,
        display: "grid",
        gap: "0.5rem",
        padding: "0.65rem 0.75rem",
      }}
    >
      <strong>Combat Log</strong>
      {input.events.length ? (
        <ol
          aria-label="Recorded combat events"
          style={{
            display: "grid",
            gap: "0.35rem",
            listStyle: "none",
            margin: 0,
            maxHeight: "18rem",
            overflowY: "auto",
            padding: 0,
          }}
        >
          {input.events.map((event) => {
            const selected =
              input.selectedCombatLogEventId === event.id &&
              input.selectedPresentationTargetId === event.presentationTargetId;
            return (
              <li key={event.id}>
                <button
                  aria-pressed={selected}
                  data-presentation-target-id={event.presentationTargetId}
                  onClick={() =>
                    input.onSelect({
                      combatLogEventId: event.id,
                      presentationTargetId: event.presentationTargetId,
                    })
                  }
                  style={{
                    background: selected ? "#efe7d3" : "transparent",
                    border: selected ? "1px solid #c9bea4" : "1px solid transparent",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "grid",
                    gap: "0.1rem",
                    padding: "0.35rem 0.45rem",
                    textAlign: "left",
                    width: "100%",
                  }}
                  type="button"
                >
                  <span style={{ color: "#5e5a50", fontSize: "0.78rem", fontWeight: 700 }}>
                    Round {event.roundNumber}
                    {event.phase ? ` · ${PHASE_LABELS[event.phase]}` : ""}
                  </span>
                  <span>{event.summary}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
          No combat events have been recorded yet.
        </div>
      )}
    </section>
  );
}
