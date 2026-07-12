import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import { buildCombatEventResultModel } from "../view-models/buildCombatEventResultModel";

export function CombatEventResultList(input: {
  emptyMessage?: string;
  events: readonly ProjectedCombatHistoryEvent[];
}) {
  const model = buildCombatEventResultModel(input.events);

  return (
    <section
      aria-label="Action result"
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
      <strong>Action result</strong>
      {model.items.length ? (
        <ol style={{ display: "grid", gap: "0.55rem", margin: 0, paddingLeft: "1.4rem" }}>
          {model.items.map((item) => (
            <li key={item.id} style={{ paddingLeft: "0.15rem" }}>
              <article style={{ display: "grid", gap: "0.2rem" }}>
                <strong style={{ fontSize: "0.9rem" }}>{item.title}</strong>
                <div>{item.summary}</div>
                {item.outcomeLines.map((line) => (
                  <div key={`outcome:${line}`} style={{ fontSize: "0.88rem" }}>
                    {line}
                  </div>
                ))}
                {item.calculationLines.length ? (
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
                    <strong>Calculation</strong>
                    {item.calculationLines.map((line) => (
                      <div key={`calculation:${line}`}>{line}</div>
                    ))}
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

