import React from "react";
import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import {
  buildCombatEventResultModel,
  type CombatEventResultModel,
} from "../view-models/buildCombatEventResultModel";
import { CombatCalculationPanel } from "./CombatCalculationPanel";

export function CombatEventResultList(input: {
  emptyMessage?: string;
  events: readonly ProjectedCombatHistoryEvent[];
  model?: CombatEventResultModel;
  title?: string;
}) {
  const model =
    input.model ??
    buildCombatEventResultModel(input.events, {
      calculationStage: "panel_historical_calculation_presentation",
      resultStage: "panel_historical_attack_parry_result_presentation",
    });
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
    <section
      aria-label={input.title ?? "Action result"}
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
      <strong>{input.title ?? "Action result"}</strong>
      {model.items.length ? (
        <ol style={{ display: "grid", gap: "0.55rem", margin: 0, paddingLeft: "1.4rem" }}>
          {model.items.map((item) => (
            <li key={item.id} style={{ paddingLeft: "0.15rem" }}>
              <article style={{ display: "grid", gap: "0.2rem" }}>
                <strong style={{ fontSize: "0.9rem" }}>{item.title}</strong>
                <div>{item.summary}</div>
                {item.outcomeRows.map((row) => (
                  <div key={row.key} style={{ fontSize: "0.88rem" }}>
                    {row.text}
                  </div>
                ))}
                {item.envelope?.publicCombatNote ? (
                  <div style={{ fontSize: "0.88rem" }}>
                    <strong>Combat note:</strong> {item.envelope.publicCombatNote}
                  </div>
                ) : null}
                {item.calculations.map((calculation) => (
                  <CombatCalculationPanel
                    expanded={expandedCalculationIds.has(calculation.calculationId)}
                    key={calculation.calculationId}
                    onToggle={() => toggleCalculation(calculation.calculationId)}
                    presentation={calculation}
                  />
                ))}
                {item.completenessLabel ? (
                  <div style={{ color: "#8a4f21", fontSize: "0.82rem", fontWeight: 700 }}>
                    {item.completenessLabel}
                  </div>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
          {input.emptyMessage ?? "No recorded result for this step."}
        </div>
      )}
    </section>
  );
}
