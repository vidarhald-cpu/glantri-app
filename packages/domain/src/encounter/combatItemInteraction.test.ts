import { describe, expect, it } from "vitest";

import {
  declareCombatGenericAction,
  projectCombatItemInteractionRecipients,
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
        visibleToParticipantIds: ["participant-1"],
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
  it("projects pass recipients through the fail-closed participant visibility set", () => {
    const participants = [
      { label: "Aster", participantId: "participant-1" },
      { label: "Hidden Bram", participantId: "participant-2" },
    ];

    expect(
      projectCombatItemInteractionRecipients({
        participants,
        viewer: { kind: "player", visibleParticipantIds: new Set(["participant-1"]) },
      }),
    ).toEqual([{ label: "Aster", participantId: "participant-1" }]);
    expect(
      projectCombatItemInteractionRecipients({ participants, viewer: { kind: "gm" } }),
    ).toEqual(participants);
  });

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

  it("omits a GM-declared hidden Item action from every player projection", () => {
    const hidden = declareCombatGenericAction({
      ...declaration(),
      action: {
        ...declaration().action,
        itemInteraction: {
          ...declaration().action.itemInteraction,
          visibleToParticipantIds: [],
        },
      },
    }).map((action) => ({
      ...action,
      resolution: {
        resolvedAt: createdAt,
        text: "A secret Item was used.",
        visibleToParticipantIds: ["participant-2"],
      },
      status: "completed" as const,
    }));

    for (const controlledParticipantIds of [
      new Set(["participant-1"]),
      new Set(["participant-2"]),
    ]) {
      expect(
        projectCombatGenericActionsForPlayer({
          actions: hidden,
          controlledParticipantIds,
          visibleParticipantIds: new Set(["participant-1", "participant-2"]),
        }),
      ).toEqual([]);
    }
    expect(JSON.stringify(hidden)).toContain("item-1");
  });
});
