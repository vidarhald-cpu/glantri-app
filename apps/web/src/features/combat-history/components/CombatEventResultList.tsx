import React from "react";
import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import { buildCombatEventResultModel } from "../view-models/buildCombatEventResultModel";

export function CombatEventResultList(input: {
  emptyMessage?: string;
  events: readonly ProjectedCombatHistoryEvent[];
  title?: string;
}) {
  const model = buildCombatEventResultModel(input.events, {
    calculationStage: "panel_historical_calculation_presentation",
    resultStage: "panel_historical_attack_parry_result_presentation",
  });
  const [expandedCalculationIds, setExpandedCalculationIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  const toggleCalculation = (eventId: string) => {
    setExpandedCalculationIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
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
                {item.calculationRows.length ? (
                  <div
                    style={{
                      background: "#f6f5ef",
                      borderRadius: 6,
                      color: "#5e5a50",
                      display: "grid",
                      fontSize: "0.84rem",
                      gap: "0.12rem",
                      padding: "0.35rem 0.45rem",
                    }}
                  >
                    <button
                      aria-controls={`${item.id}:calculation`}
                      aria-expanded={expandedCalculationIds.has(item.id)}
                      onClick={() => toggleCalculation(item.id)}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "inherit",
                        cursor: "pointer",
                        font: "inherit",
                        fontWeight: 700,
                        justifySelf: "start",
                        padding: 0,
                      }}
                      type="button"
                    >
                      Calculation
                    </button>
                    {expandedCalculationIds.has(item.id) ? (
                      <div
                        id={`${item.id}:calculation`}
                        style={{ display: "grid", gap: "0.12rem" }}
                      >
                        {item.calculationRows.map((row) => (
                          <div key={row.key}>{row.text}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
