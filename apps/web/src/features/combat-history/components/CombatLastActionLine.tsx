import React, { useMemo } from "react";

import {
  buildCombatLastAction,
  type BuildCombatLastActionInput,
} from "../view-models/buildCombatLastAction";

/** Compact, actor-qualified one-line "Last action" (Forgejo #836). Renders nothing when absent. */
export function CombatLastActionLine(input: BuildCombatLastActionInput) {
  const { committedInitiativeOrders, gmEvents, logEvents, participants, roundNumber } = input;
  const lastAction = useMemo(
    () =>
      buildCombatLastAction({
        committedInitiativeOrders,
        gmEvents,
        logEvents,
        participants,
        roundNumber,
      }),
    [committedInitiativeOrders, gmEvents, logEvents, participants, roundNumber],
  );
  if (!lastAction) return null;
  return (
    <div data-testid="combat-last-action" style={{ fontSize: "0.92rem", margin: "0 0 0.4rem" }}>
      <strong>Last action:</strong> {lastAction.text}
    </div>
  );
}
