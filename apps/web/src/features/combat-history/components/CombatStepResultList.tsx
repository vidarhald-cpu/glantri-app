import React from "react";

import type { CombatStepResultPresentation } from "../view-models/buildCombatStepResultPresentation";
import { CombatCalculationPanel } from "./CombatCalculationPanel";

export function CombatStepResultList(input: {
  presentation: CombatStepResultPresentation;
  title?: string;
}) {
  return (
    <section
      aria-label={input.title ?? "Current step results"}
      style={{
        alignContent: "start",
        background: "#fffdf8",
        border: "1px solid #d9ddd8",
        borderRadius: 10,
        display: "grid",
        gap: "0.55rem",
        padding: "0.7rem",
      }}
    >
      <strong>{input.title ?? "Current step results"}</strong>
      {input.presentation.entries.length ? (
        <ol style={{ display: "grid", gap: "0.65rem", margin: 0, paddingLeft: "1.4rem" }}>
          {input.presentation.entries.map((entry) => (
            <li key={entry.id} style={{ paddingLeft: "0.15rem" }}>
              <article style={{ display: "grid", gap: "0.2rem" }}>
                <strong style={{ fontSize: "0.9rem" }}>{entry.heading}</strong>
                <div>{entry.summary}</div>
                {entry.outcome && entry.outcome !== entry.summary ? (
                  <strong style={{ fontSize: "0.88rem" }}>{entry.outcome}</strong>
                ) : null}
                {[
                  ...new Set(
                    (entry.resultEnvelopes ?? []).flatMap((envelope) =>
                      envelope.publicCombatNote ? [envelope.publicCombatNote] : [],
                    ),
                  ),
                ].map((note) => (
                  <div key={`${entry.id}:combat-note:${note}`} style={{ fontSize: "0.88rem" }}>
                    <strong>Combat note:</strong> {note}
                  </div>
                ))}
                {entry.state === "pending" ? (
                  <div style={{ color: "#6b6253", fontSize: "0.84rem" }}>In progress.</div>
                ) : null}
                {entry.calculations.map((calculation) => (
                  <CombatCalculationPanel
                    key={calculation.calculationId}
                    presentation={calculation}
                  />
                ))}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.presentation.emptyState}</div>
      )}
    </section>
  );
}
