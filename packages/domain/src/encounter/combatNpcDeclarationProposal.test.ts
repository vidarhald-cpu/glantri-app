import { describe, expect, it } from "vitest";

import {
  buildCombatRoundDeclaredAttackOpportunities,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundStateSchema,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
} from "./combatRoundManager";
import {
  getCombatNpcDeclarationProposalAttackSources,
  projectCombatNpcDeclarationProposal,
  validateCombatNpcDeclarationProposal,
} from "./combatNpcDeclarationProposal";

const emptyModifierBuckets = () => ({
  general: [],
  situationDb: [],
  situationInitiative: [],
  situationObSkill: [],
  situationObSpecial: [],
  situationObStandard: [],
});

function encounterParticipant(input: { id: string; label: string; order: number }) {
  return {
    declaration: {
      actionType: "none" as const,
      defenseFocus: "none" as const,
      defensePosture: "none" as const,
      targetLocation: "any" as const,
    },
    facing: "north" as const,
    id: input.id,
    initiative: 0,
    label: input.label,
    order: input.order,
    orientation: "neutral" as const,
    participantType: "scenario" as const,
    position: { x: input.order, y: 0, zone: "center" },
    scenarioParticipantId: input.id,
  };
}

function priorRoundState(input: {
  actionId?: string;
  declaration?: Record<string, unknown>;
  secondaryActionId?: string;
}) {
  const base = initializeCombatRoundState({
    encounter: {
      currentRound: 1,
      id: "encounter-1",
      participants: [
        encounterParticipant({ id: "npc", label: "NPC", order: 0 }),
        encounterParticipant({ id: "target", label: "Target", order: 1 }),
      ],
    },
  });
  const phaseContexts = {
    phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target" },
    phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target" },
  };
  const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
    actionId: input.actionId,
    participantId: "npc",
    phaseContexts,
    roundNumber: 1,
    secondaryActionId: input.secondaryActionId,
    sources: {
      phase1: {
        attackModeId: "slash",
        itemId: "sword-1",
        sourceKind: "weapon",
        weaponSourceSlot: "primary",
        weaponTemplateId: "long-sword",
      },
      phase2: {
        attackModeId: "slash",
        itemId: "sword-2",
        sourceKind: "weapon",
        weaponSourceSlot: "secondary",
        weaponTemplateId: "long-sword",
      },
    },
  });
  const declared = recordCombatRoundDeclaration({
    command: {
      commandId: "round-1-declaration",
      createdAt: "2026-08-08T10:01:00.000Z",
      createdByUserId: "gm",
    },
    declaration: {
      actionId: input.actionId,
      attackOpportunities,
      id: "round:1:participant:npc:declaration",
      phaseContexts,
      roundNumber: 1,
      secondaryActionId: input.secondaryActionId,
      ...input.declaration,
    },
    participantId: "npc",
    state: { ...base, currentStep: "review_action_modifiers" },
    submittedBy: "gm",
  });
  return combatRoundStateSchema.parse({
    ...base,
    currentStep: "select_actions",
    participants: base.participants.map((participant) => ({
      ...participant,
      declaration: undefined,
    })),
    roundNumber: 2,
    rounds: [
      {
        ...declared,
        currentStep: "round_summary",
        rounds: undefined,
        roundNumber: 1,
      },
    ],
  });
}

function proposalFor(state: ReturnType<typeof priorRoundState>) {
  return projectCombatNpcDeclarationProposal({
    encounterId: "encounter-1",
    encounterRevision: "revision-2",
    participantId: "npc",
    proposalSequence: 4,
    state,
  });
}

const completeFacts = {
  adjustDistanceValid: true,
  currentDeclarationExists: false,
  declarationStillLegal: true,
  feintValid: true,
  movementValid: true,
  participantActive: true,
  participantCapable: true,
  participantGmControlled: true,
  phaseSourceStatus: { phase1: "valid" as const, phase2: "valid" as const },
  validTargetParticipantIds: new Set(["target"]),
};

describe("canonical NPC declaration proposals", () => {
  it.each([
    ["ordinary attack", "attack_parry"],
    ["Parry", "parry"],
    ["Double Attack", "double_attack"],
  ])("derives the exact previous-round %s intent", (_label, actionId) => {
    const proposal = proposalFor(priorRoundState({ actionId }));
    expect(proposal).toMatchObject({
      sourceCommandId: "round-1-declaration",
      sourceDeclaration: { actionId },
      sourceRoundNumber: 1,
      validation: { status: "complete" },
    });
    if (actionId === "attack_parry" || actionId === "double_attack") {
      expect(getCombatNpcDeclarationProposalAttackSources(proposal!)).toMatchObject({
        phase1: { scenarioItemId: "sword-1" },
      });
    }
  });

  it("preserves Parry plus its exact Observe target", () => {
    const proposal = proposalFor(
      priorRoundState({
        actionId: "parry",
        declaration: {
          secondaryActionContext: { action: "observe_opponent", targetParticipantId: "target" },
        },
        secondaryActionId: "observe_opponent",
      }),
    );
    expect(proposal?.sourceDeclaration.secondaryActionContext).toEqual({
      action: "observe_opponent",
      targetParticipantId: "target",
    });
  });

  it("never replays a stale incompatible primary-secondary pair", () => {
    const proposal = proposalFor(
      priorRoundState({
        actionId: "attack_parry",
        declaration: {
          secondaryActionContext: { action: "observe_opponent", targetParticipantId: "target" },
        },
        secondaryActionId: "observe_opponent",
      }),
    );
    expect(proposal?.validation).toEqual({
      reasons: ["unsupported_declaration"],
      status: "unsupported",
    });
  });

  it("preserves Feint method, target, and weapon source", () => {
    const proposal = proposalFor(
      priorRoundState({
        actionId: "feint_attack",
        declaration: {
          feint: {
            attackerSkillId: "sword",
            attackerSkillLabel: "Sword",
            defenderSkillId: "dodge",
            defenderSkillLabel: "Dodge",
            method: "weapon",
            targetParticipantId: "target",
            weaponSource: {
              attackModeId: "slash",
              opportunitySlot: "attack_1",
              scenarioItemId: "sword-1",
              slot: "primary",
              sourceKind: "weapon",
              templateId: "long-sword",
            },
          },
        },
      }),
    );
    expect(proposal?.validation.status).toBe("complete");
    expect(proposal?.sourceDeclaration.feint).toMatchObject({
      method: "weapon",
      targetParticipantId: "target",
      weaponSource: { scenarioItemId: "sword-1" },
    });
  });

  it("preserves Adjust Distance intent", () => {
    const proposal = proposalFor(
      priorRoundState({
        actionId: "adjust_range_attack",
        declaration: {
          adjustDistance: {
            currentDistance: 4,
            requestedDistance: 3,
            targetParticipantId: "target",
          },
        },
      }),
    );
    expect(proposal?.sourceDeclaration.adjustDistance).toMatchObject({
      requestedDistance: 3,
      targetParticipantId: "target",
    });
  });

  it("returns no proposal for round 1, no prior declaration, or an already-declared participant", () => {
    const state = priorRoundState({ actionId: "parry" });
    expect(
      projectCombatNpcDeclarationProposal({
        encounterId: "encounter-1",
        encounterRevision: "revision-1",
        participantId: "npc",
        proposalSequence: 0,
        state: { ...state, roundNumber: 1, rounds: [] },
      }),
    ).toBeUndefined();
    expect(
      proposalFor({
        ...state,
        rounds: state.rounds.map((round) => ({
          ...round,
          participants: round.participants.map((participant) => ({
            ...participant,
            declaration: undefined,
          })),
        })),
      }),
    ).toBeUndefined();
    expect(
      proposalFor({
        ...state,
        participants: state.participants.map((participant) =>
          participant.participantId === "npc"
            ? { ...participant, declaration: state.rounds[0]?.participants[0]?.declaration }
            : participant,
        ),
      }),
    ).toBeUndefined();
  });

  it("never executes unsupported or free-text-only intent", () => {
    expect(proposalFor(priorRoundState({ actionId: "other" }))?.validation).toMatchObject({
      reasons: ["declaration_review_required"],
      status: "requires_review",
    });
    expect(proposalFor(priorRoundState({ actionId: "disarm" }))?.validation).toMatchObject({
      reasons: ["source_identity_incomplete"],
      status: "legacy_incomplete",
    });
  });

  it("blocks changed targets, sources, ownership, capability, and restrictions conservatively", () => {
    const proposal = proposalFor(priorRoundState({ actionId: "attack_parry" }))!;
    expect(
      validateCombatNpcDeclarationProposal({
        facts: {
          ...completeFacts,
          declarationStillLegal: false,
          participantCapable: false,
          participantGmControlled: false,
          phaseSourceStatus: { phase1: "weapon_invalid" },
          validTargetParticipantIds: new Set(),
        },
        proposal,
      }).validation,
    ).toMatchObject({
      reasons: expect.arrayContaining([
        "participant_not_gm_controlled",
        "participant_incapable",
        "restrictions_changed",
        "target_invalid",
        "weapon_invalid",
      ]),
      status: "invalid",
    });
  });

  it("accepts structurally complete intent only when every current fact remains valid", () => {
    const proposal = proposalFor(priorRoundState({ actionId: "double_attack" }))!;
    expect(
      validateCombatNpcDeclarationProposal({ facts: completeFacts, proposal }).validation,
    ).toEqual({ reasons: [], status: "complete" });
  });

  it("derives the same prior-round proposal after the accepted declaration is undone", () => {
    const state = priorRoundState({ actionId: "parry" });
    const sourceProposal = proposalFor(state)!;
    const { submittedBy: _sourceAuthority, ...sourceDeclaration } =
      sourceProposal.sourceDeclaration;
    const accepted = recordCombatRoundDeclaration({
      command: {
        commandId: "round-2-proposal-acceptance",
        createdAt: "2026-08-08T10:02:00.000Z",
        createdByUserId: "gm",
      },
      declaration: {
        ...sourceDeclaration,
        id: "round:2:participant:npc:declaration",
        roundNumber: 2,
        submittedAt: "2026-08-08T10:02:00.000Z",
      },
      participantId: "npc",
      state,
      submittedBy: "gm",
    });

    expect(proposalFor(accepted)).toBeUndefined();
    const restored = clearCurrentCombatRoundStepAndRewind(accepted);
    expect(
      restored.participants.find((participant) => participant.participantId === "npc")?.declaration,
    ).toBeUndefined();
    expect(proposalFor(restored)).toMatchObject({
      sourceCommandId: "round-1-declaration",
      sourceDeclarationId: "round:1:participant:npc:declaration",
      validation: { status: "complete" },
    });
  });
});
