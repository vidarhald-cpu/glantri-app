import { describe, expect, it } from "vitest";

import {
  declareCombatGenericAction,
  projectCombatGenericActionsForPlayer,
  reviewCombatGenericAction,
} from "./combatGenericAction";

const createdAt = "2026-08-16T10:00:00.000Z";

function declaration() {
  return {
    action: {
      createdAt,
      duration: { kind: "gm_decided" as const },
      id: "item-action-1",
      intent: "Draw Silverston.",
      itemInteraction: {
        itemId: "item-1",
        itemLabel: "Silverston",
        itemRevision: "2026-08-16T09:59:00.000Z",
        operation: "draw" as const,
        stateAtDeclaration: "stowed" as const,
      },
      ownerParticipantId: "participant-1",
      preset: "item_interaction" as const,
      reference: {
        itemId: "item-1",
        kind: "item" as const,
        label: "Silverston",
        ownerParticipantId: "participant-1",
      },
    },
    actions: [],
  };
}

describe("canonical Combat Item interaction lifecycle", () => {
  it("persists the exact Item identity, revision, operation, and GM-decided timing", () => {
    const actions = declareCombatGenericAction(declaration());

    expect(actions[0]).toMatchObject({
      duration: { kind: "gm_decided" },
      itemInteraction: {
        itemId: "item-1",
        itemRevision: "2026-08-16T09:59:00.000Z",
        operation: "draw",
      },
      preset: "item_interaction",
      status: "declared",
    });
  });

  it("does not let GM review replace the declared canonical Item reference", () => {
    const actions = declareCombatGenericAction(declaration());

    expect(() =>
      reviewCombatGenericAction({
        actionId: "item-action-1",
        actions,
        duration: { kind: "rounds", rounds: 2 },
        reference: { description: "forged", kind: "environment" },
        reviewedAt: "2026-08-16T10:01:00.000Z",
      }),
    ).toThrow("must retain their declared Item");
  });

  it("keeps an owner's canonical Item action across a player-safe reload", () => {
    const actions = declareCombatGenericAction(declaration());

    expect(
      projectCombatGenericActionsForPlayer({
        actions,
        controlledParticipantIds: new Set(["participant-1"]),
        visibleParticipantIds: new Set(["participant-1"]),
      })[0]?.itemInteraction,
    ).toMatchObject({ itemId: "item-1", operation: "draw" });
  });
});
