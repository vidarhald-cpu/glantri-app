import React from "react";

import type { CombatStepResultPresentation } from "../view-models/buildCombatStepResultPresentation";
import {
  buildCombatResultGroups,
  type CombatResultLedgerFragmentInput,
} from "../view-models/combatResultLedgerPresentation";
import { CombatResultLedger } from "./CombatResultLedger";

function resolveGroups(presentation: CombatStepResultPresentation) {
  return (
    presentation.groups ??
    buildCombatResultGroups(
      presentation.entries.map(
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
    )
  );
}

export function CombatStepResultList(input: {
  presentation: CombatStepResultPresentation;
  recentPresentation?: CombatStepResultPresentation;
  title?: string;
}) {
  const groups = resolveGroups(input.presentation);
  const recentGroups = input.recentPresentation
    ? resolveGroups(input.recentPresentation).filter((recentGroup) => {
        if (
          input.presentation.participantId !== input.recentPresentation?.participantId ||
          input.presentation.roundNumber !== input.recentPresentation.roundNumber
        ) {
          return true;
        }
        const currentGroup = groups.find((group) => group.groupId === recentGroup.groupId);
        if (!currentGroup) return true;
        const currentResultIds = new Set(currentGroup.provenance.resultIds);
        const currentEventIds = new Set(currentGroup.provenance.sourceEventIds);
        return !(
          recentGroup.provenance.resultIds.every((resultId) => currentResultIds.has(resultId)) &&
          recentGroup.provenance.sourceEventIds.every((eventId) => currentEventIds.has(eventId))
        );
      })
    : [];
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
      ) : recentGroups.length === 0 ? (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.presentation.emptyState}</div>
      ) : null}
      {recentGroups.length ? (
        <div
          aria-label="Recent result"
          style={{
            background: "#f8f4e8",
            borderLeft: "3px solid #b8a66f",
            display: "grid",
            gap: "0.45rem",
            padding: "0.55rem 0.65rem",
          }}
        >
          <strong style={{ fontSize: "0.85rem" }}>Recent result</strong>
          <CombatResultLedger calculationExpansion="native" groups={recentGroups} />
        </div>
      ) : null}
    </section>
  );
}
