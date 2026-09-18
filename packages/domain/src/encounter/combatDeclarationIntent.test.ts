import { describe, expect, it } from "vitest";

import { combatRoundDeclarationSchema } from "./combatRoundManager";
import {
  combatDeclarationIntentSchema,
  normalizeCombatDeclarationIntent,
} from "./combatDeclarationIntent";

describe("combat declaration intent", () => {
  it("round-trips prioritized relative intent, absolute movement, facing, and communication", () => {
    const intent = {
      facing: "backward_left" as const,
      movementDirection: "forward_right" as const,
      primaryAction: {
        actionId: "perform_task",
        description: "Bar the gate before the pursuers arrive.",
        taskId: "combat-task-1",
      },
      relativePositions: [
        {
          desiredDistance: 2 as const,
          intendedSpeed: "as quickly as footing permits",
          kind: "adjust_distance" as const,
          targetParticipantId: "ally-1",
        },
        {
          formation: "Hold the shield line around Mira.",
          kind: "hold_formation" as const,
        },
      ],
      secondaryAction: {
        actionId: "talk_shout",
        utteranceText: "Fall back to the gate!",
        utteranceType: "shout" as const,
      },
    };

    expect(combatDeclarationIntentSchema.parse(intent)).toEqual(intent);
  });

  it("keeps an omitted primary action blank rather than converting it to Pass", () => {
    expect(normalizeCombatDeclarationIntent({ relativePositions: [] })).toEqual({
      relativePositions: [],
    });
    expect(normalizeCombatDeclarationIntent(undefined)).toBeUndefined();
  });

  it("keeps legacy declaration records readable without the new intent payload", () => {
    expect(
      combatRoundDeclarationSchema.parse({
        actionId: "parry",
        declaredAt: "2026-09-18T09:00:00.000Z",
        declarationId: "declaration-1",
        movementId: "hold",
        participantId: "participant-1",
        roundNumber: 2,
        submittedBy: "player",
      }).intent,
    ).toBeUndefined();
  });
});
