import React from "react";

import type { CombatStepResultPresentation } from "../view-models/buildCombatStepResultPresentation";
import {
  buildCombatResultGroups,
  type CombatResultLedgerFragmentInput,
} from "../view-models/combatResultLedgerPresentation";
import { CombatResultLedger } from "./CombatResultLedger";

export function CombatStepResultList(input: {
  presentation: CombatStepResultPresentation;
  title?: string;
}) {
  const groups =
    input.presentation.groups ??
    buildCombatResultGroups(
      input.presentation.entries.map(
        (entry, sequence): CombatResultLedgerFragmentInput => ({
          actionInstanceId:
            entry.resultEnvelopes?.find((envelope) => envelope.actionInstanceId)
              ?.actionInstanceId ??
            entry.proposalId ??
            entry.opportunityId,
          processId: entry.processId,
          result: {
            actor: entry.actor
              ? {
                  hidden: entry.actor.hidden,
                  id: entry.actor.id,
                  label: entry.actor.label,
                }
              : undefined,
            calculations: entry.calculations,
            heading: entry.heading,
            id: entry.id,
            outcomeRows:
              entry.outcome && entry.outcome !== entry.summary
                ? [{ key: `${entry.id}:outcome`, text: entry.outcome }]
                : [],
            resultEnvelopes: entry.resultEnvelopes ?? [],
            sequence,
            sourceEventIds: entry.sourceEventIds,
            state: entry.state,
            summary: entry.summary,
            target: entry.target
              ? {
                  hidden: entry.target.hidden,
                  id: entry.target.id,
                  label: entry.target.label,
                }
              : undefined,
          },
        }),
      ),
    );
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
      {groups.length ? (
        <CombatResultLedger calculationExpansion="native" groups={groups} />
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.presentation.emptyState}</div>
      )}
    </section>
  );
}
