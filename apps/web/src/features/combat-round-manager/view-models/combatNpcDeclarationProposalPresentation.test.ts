import { describe, expect, it } from "vitest";

import { combatNpcDeclarationProposalSchema } from "@glantri/domain";

import { buildCombatNpcDeclarationProposalPresentation } from "./combatNpcDeclarationProposalPresentation";

function proposal(reason?: "target_invalid") {
  return combatNpcDeclarationProposalSchema.parse({
    encounterId: "encounter-1",
    participantId: "npc",
    proposalRevision: "revision-4",
    proposalSequence: 8,
    roundNumber: 4,
    schemaVersion: 1,
    sourceCommandId: "declaration-command",
    sourceDeclaration: {
      actionId: "feint_attack",
      feint: {
        attackerSkillId: "sword",
        attackerSkillLabel: "Sword",
        defenderSkillId: "dodge",
        defenderSkillLabel: "Dodge",
        method: "weapon",
        targetParticipantId: "target",
      },
      id: "declaration-3",
      roundNumber: 3,
      submittedBy: "gm",
    },
    sourceDeclarationId: "declaration-3",
    sourceRoundNumber: 3,
    validation: reason
      ? { reasons: [reason], status: "invalid" }
      : { reasons: [], status: "complete" },
  });
}

describe("NPC declaration proposal presentation", () => {
  it("uses compact canonical declaration language without exposing identities", () => {
    expect(
      buildCombatNpcDeclarationProposalPresentation({
        participantLabelsById: new Map([["target", "The Gladiator"]]),
        proposal: proposal(),
      }),
    ).toEqual({
      reason: undefined,
      sourceLabel: "Proposed from Round 3",
      summary: "Feint - Attack · Weapon Feint · against The Gladiator",
    });
  });

  it("maps typed validation reasons to concise GM wording", () => {
    expect(
      buildCombatNpcDeclarationProposalPresentation({
        participantLabelsById: new Map([["target", "The Gladiator"]]),
        proposal: proposal("target_invalid"),
      }).reason,
    ).toBe("Previous target is no longer valid.");
  });
});
