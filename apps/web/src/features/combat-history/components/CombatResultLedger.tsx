import React from "react";

import type { CombatResultGroupPresentation } from "../view-models/combatResultLedgerPresentation";
import { CombatCalculationPanel } from "./CombatCalculationPanel";

export function CombatResultLedger(input: {
  calculationExpansion?: "controlled" | "native";
  groups: readonly CombatResultGroupPresentation[];
}) {
  const [expandedCalculationIds, setExpandedCalculationIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleCalculation = (calculationId: string) => {
    setExpandedCalculationIds((current) => {
      const next = new Set(current);
      if (next.has(calculationId)) next.delete(calculationId);
      else next.add(calculationId);
      return next;
    });
  };

  return (
    <ol style={{ display: "grid", gap: "0.65rem", margin: 0, paddingLeft: "1.4rem" }}>
      {input.groups.map((group) => {
        const grouped = group.subordinateResults.length > 1;
        return (
          <li key={group.groupId} style={{ paddingLeft: "0.15rem" }}>
            <article style={{ display: "grid", gap: "0.35rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>{group.heading}</strong>
              {group.subordinateResults.map((result) => (
                <section
                  key={result.id}
                  style={{
                    borderTop: grouped ? "1px solid #ece8de" : undefined,
                    display: "grid",
                    gap: "0.2rem",
                    paddingTop: grouped ? "0.3rem" : undefined,
                  }}
                >
                  {grouped ? (
                    <strong style={{ fontSize: "0.84rem" }}>{result.heading}</strong>
                  ) : null}
                  <div>{result.summary}</div>
                  {result.outcomeRows.map((row) => (
                    <div key={row.key} style={{ fontSize: "0.88rem" }}>
                      {row.text}
                    </div>
                  ))}
                  {result.state === "pending" ? (
                    <div style={{ color: "#6b6253", fontSize: "0.84rem" }}>In progress.</div>
                  ) : null}
                  {result.calculations.map((calculation) => (
                    <CombatCalculationPanel
                      expanded={
                        input.calculationExpansion === "native"
                          ? undefined
                          : expandedCalculationIds.has(calculation.calculationId)
                      }
                      key={calculation.calculationId}
                      onToggle={
                        input.calculationExpansion === "native"
                          ? undefined
                          : () => toggleCalculation(calculation.calculationId)
                      }
                      presentation={calculation}
                    />
                  ))}
                  {result.completenessLabel ? (
                    <div style={{ color: "#8a4f21", fontSize: "0.82rem", fontWeight: 700 }}>
                      {result.completenessLabel}
                    </div>
                  ) : null}
                </section>
              ))}
              {group.publicCombatNotes.map((note) => (
                <div key={`${group.groupId}:combat-note:${note}`} style={{ fontSize: "0.88rem" }}>
                  <strong>Combat note:</strong> {note}
                </div>
              ))}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
