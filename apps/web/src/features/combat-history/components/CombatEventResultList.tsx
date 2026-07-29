import React from "react";
import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import {
  buildCombatEventResultModel,
  type CombatEventResultModel,
} from "../view-models/buildCombatEventResultModel";
import {
  buildCombatResultGroups,
  type CombatResultLedgerFragmentInput,
} from "../view-models/combatResultLedgerPresentation";
import { CombatResultLedger } from "./CombatResultLedger";

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
  const groups =
    model.groups ??
    buildCombatResultGroups(
      model.items.map(
        (item): CombatResultLedgerFragmentInput => ({
          actionInstanceId: item.envelope?.actionInstanceId,
          result: {
            calculations: item.calculations,
            completenessLabel: item.completenessLabel,
            heading: item.title,
            id: item.id,
            outcomeRows: item.outcomeRows,
            resultEnvelopes: item.envelope ? [item.envelope] : [],
            sequence: item.sequence,
            sourceEventIds: [item.id],
            state: "final",
            summary: item.summary,
          },
        }),
      ),
    );
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
      {groups.length ? (
        <CombatResultLedger groups={groups} />
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
          {input.emptyMessage ?? "No recorded result for this step."}
        </div>
      )}
    </section>
  );
}
