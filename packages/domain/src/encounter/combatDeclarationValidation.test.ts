import { describe, expect, it } from "vitest";

import {
  canonicalizeCombatObserveTargetContext,
  getCombatDeclarationAttackPhases,
  getCombatDeclarationActionLabel,
  resolveCombatDeclarationParticipantIdentity,
  validateCombatDeclarationTargets,
} from "./combatDeclarationValidation";

const phaseContexts = {
  phase1: {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
  },
  phase2: {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
  },
};

describe("combat declaration target validation", () => {
  it("keeps legacy action ids while returning renamed labels", () => {
    expect(getCombatDeclarationActionLabel("attack_parry")).toBe("Single attack");
    expect(getCombatDeclarationActionLabel("parry_attack")).toBe("Reactive attack");
    expect(getCombatDeclarationActionLabel("parry")).toBe("Parry");
    expect(getCombatDeclarationActionLabel("counterattack")).toBe("Counterattack");
    expect(getCombatDeclarationActionLabel("disarm")).toBe("Disarm");
  });

  it("never routes unsupported primary or secondary actions through generic attacks", () => {
    for (const actionId of [
      "counterattack",
      "disarm",
      "parry_disarm",
      "break_off_engagement",
      "other",
    ]) {
      expect(getCombatDeclarationAttackPhases({ actionId })).toEqual([]);
    }
    expect(
      getCombatDeclarationAttackPhases({
        actionId: "parry",
        secondaryActionId: "counterattack",
      }),
    ).toEqual([]);
  });

  it("marks active legacy unsupported declarations incomplete instead of substituting an attack", () => {
    for (const actionId of ["counterattack", "other"]) {
      expect(
        validateCombatDeclarationTargets({
          actionId,
          phaseContexts: {
            phase1: { ...phaseContexts.phase1, targetParticipantId: "guard" },
          },
        }),
      ).toMatchObject({
        message: `Combat action is not yet available: ${actionId}.`,
        missingPhases: [],
        valid: false,
      });
    }

    for (const actionId of ["disarm", "parry_disarm"]) {
      expect(validateCombatDeclarationTargets({ actionId })).toMatchObject({
        missingPhases: [],
        valid: true,
      });
    }
  });

  it("allows untargeted Parry with Observe Opponent's independent target", () => {
    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "actor",
        actionId: "parry",
        movementKind: "hold_position",
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "observer-target",
        },
        secondaryActionId: "observe_opponent",
      }),
    ).toEqual(expect.objectContaining({ valid: true }));
    expect(getCombatDeclarationAttackPhases({ actionId: "parry" })).toEqual([]);
  });

  it("requires a non-self Observe Opponent target", () => {
    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "actor",
        actionId: "parry",
        secondaryActionId: "observe_opponent",
      }),
    ).toMatchObject({ message: "Select an opponent to observe.", valid: false });
    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "actor",
        actionId: "parry",
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "actor",
        },
        secondaryActionId: "observe_opponent",
      }),
    ).toMatchObject({
      message: "Observe Opponent cannot target the acting participant.",
      valid: false,
    });
  });

  it("resolves Observe identities through one exact-first canonical participant roster", () => {
    const participants = [
      {
        characterId: "scenario-target",
        participantId: "encounter-actor",
        scenarioParticipantId: "scenario-actor",
      },
      {
        characterId: "character-target",
        participantId: "encounter-target",
        scenarioParticipantId: "scenario-target",
      },
    ];

    expect(
      resolveCombatDeclarationParticipantIdentity({
        participantId: "encounter-target",
        participants,
      }),
    ).toMatchObject({ canonicalParticipantId: "encounter-target" });
    expect(
      resolveCombatDeclarationParticipantIdentity({
        participantId: "scenario-actor",
        participants,
      }),
    ).toMatchObject({ canonicalParticipantId: "encounter-actor" });
    expect(
      resolveCombatDeclarationParticipantIdentity({
        participantId: "scenario-target",
        participants,
      }),
    ).toBeUndefined();
    expect(
      canonicalizeCombatObserveTargetContext({
        participants,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "encounter-target",
        },
      }),
    ).toEqual({
      action: "observe_opponent",
      targetParticipantId: "encounter-target",
    });
    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "encounter-actor",
        actionId: "parry",
        participantIdentities: participants,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "scenario-target",
        },
        secondaryActionId: "observe_opponent",
      }),
    ).toMatchObject({
      message: "Select an active opponent to observe.",
      valid: false,
    });
  });

  it("validates Observe self-targeting after canonical alias resolution", () => {
    const participantIdentities = [
      {
        characterId: "character-actor",
        participantId: "encounter-actor",
        scenarioParticipantId: "scenario-actor",
      },
      {
        characterId: "character-target",
        participantId: "encounter-target",
        scenarioParticipantId: "scenario-target",
      },
    ];

    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "encounter-actor",
        actionId: "parry",
        participantIdentities,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "scenario-target",
        },
        secondaryActionId: "observe_opponent",
      }),
    ).toMatchObject({ valid: true });
    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "encounter-target",
        actionId: "parry",
        participantIdentities,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "scenario-actor",
        },
        secondaryActionId: "observe_opponent",
      }),
    ).toMatchObject({ valid: true });
    expect(
      validateCombatDeclarationTargets({
        actingParticipantId: "encounter-actor",
        actionId: "parry",
        participantIdentities,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "character-actor",
        },
        secondaryActionId: "observe_opponent",
      }),
    ).toMatchObject({
      message: "Observe Opponent cannot target the acting participant.",
      valid: false,
    });
  });

  it("requires a Phase 1 target for Single attack", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "attack_parry",
        phaseContexts,
      }),
    ).toMatchObject({
      message: "Select a target for Phase 1.",
      missingPhases: ["phase1"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "attack_parry",
        phaseContexts: {
          ...phaseContexts,
          phase1: {
            ...phaseContexts.phase1,
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      missingPhases: [],
      valid: true,
    });
  });

  it("requires Double Attack to use the same opponent in both phases", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "double_attack",
        phaseContexts: {
          phase1: { ...phaseContexts.phase1, targetParticipantId: "opponent-1" },
          phase2: { ...phaseContexts.phase2, targetParticipantId: "opponent-2" },
        },
      }),
    ).toMatchObject({
      message: "Double Attack must target the same opponent in both phases.",
      valid: false,
    });
  });

  it("requires a Phase 2 target for Reactive attack", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "parry_attack",
        phaseContexts,
      }),
    ).toMatchObject({
      message: "Select a target for Phase 2.",
      missingPhases: ["phase2"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "parry_attack",
        phaseContexts: {
          ...phaseContexts,
          phase2: {
            ...phaseContexts.phase2,
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      missingPhases: [],
      valid: true,
    });
  });

  it("requires an explicit prepared opponent for Offensive Parry", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "offensive_parry",
        phaseContexts,
      }),
    ).toMatchObject({
      message: "Select an opponent to counter with Offensive Parry.",
      valid: false,
    });
    expect(
      validateCombatDeclarationTargets({
        actionId: "offensive_parry",
        phaseContexts,
        selectedOpponentId: "guard",
      }),
    ).toMatchObject({ valid: true });
  });

  it("requires both targets for Double Attack", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "double_attack",
        phaseContexts,
      }),
    ).toMatchObject({
      message: "Select targets for Phase 1 and Phase 2.",
      missingPhases: ["phase1", "phase2"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "double_attack",
        phaseContexts: {
          ...phaseContexts,
          phase1: {
            ...phaseContexts.phase1,
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      message: "Select a target for Phase 2.",
      missingPhases: ["phase2"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "double_attack",
        phaseContexts: {
          ...phaseContexts,
          phase2: {
            ...phaseContexts.phase2,
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      message: "Select a target for Phase 1.",
      missingPhases: ["phase1"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "double_attack",
        phaseContexts: {
          phase1: {
            ...phaseContexts.phase1,
            targetLocation: "head",
            targetParticipantId: "guard",
          },
          phase2: {
            ...phaseContexts.phase2,
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      missingPhases: [],
      valid: true,
    });
  });

  it("requires only a Phase 2 target for Adjust Range - Attack", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "adjust_range_attack",
        phaseContexts,
      }),
    ).toMatchObject({
      message: "Select a target for Phase 2.",
      missingPhases: ["phase2"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "adjust_range_attack",
        phaseContexts: {
          ...phaseContexts,
          phase1: {
            ...phaseContexts.phase1,
            targetParticipantId: "not-required-for-phase-1",
          },
        },
      }),
    ).toMatchObject({
      message: "Select a target for Phase 2.",
      missingPhases: ["phase2"],
      valid: false,
    });

    expect(
      validateCombatDeclarationTargets({
        actionId: "adjust_range_attack",
        phaseContexts: {
          ...phaseContexts,
          phase2: {
            ...phaseContexts.phase2,
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      missingPhases: [],
      valid: true,
    });
  });

  it("does not require attack location targeting", () => {
    expect(
      validateCombatDeclarationTargets({
        actionId: "attack_parry",
        phaseContexts: {
          ...phaseContexts,
          phase1: {
            ...phaseContexts.phase1,
            targetLocation: "head",
            targetParticipantId: "guard",
          },
        },
      }),
    ).toMatchObject({
      missingPhases: [],
      valid: true,
    });
  });
  /**
   * #691 — the pair invariant `createCombatParticipantPairKey` enforces on read must also hold on
   * write. An attack whose phase target resolves to its own attacker is impossible round state,
   * and before this it was only detected once the round was read back.
   */
  describe("#691 — an attack cannot target its own attacker", () => {
    const participantIdentities = [
      { id: "gladiator", participantId: "gladiator", scenarioParticipantId: "scenario-gladiator" },
      { id: "guard", participantId: "guard", scenarioParticipantId: "scenario-guard" },
    ];

    it("refuses a Phase 1 attack whose target is the acting participant", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "gladiator",
          actionId: "attack_parry",
          participantIdentities,
          phaseContexts: {
            ...phaseContexts,
            phase1: { ...phaseContexts.phase1, targetParticipantId: "gladiator" },
          },
        }),
      ).toMatchObject({
        message: "An attack cannot target its own attacker.",
        valid: false,
      });
    });

    it("refuses a Phase 2 attack whose target is the acting participant", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "guard",
          actionId: "parry_attack",
          participantIdentities,
          phaseContexts: {
            ...phaseContexts,
            phase2: { ...phaseContexts.phase2, targetParticipantId: "guard" },
          },
        }),
      ).toMatchObject({
        message: "An attack cannot target its own attacker.",
        valid: false,
      });
    });

    /**
     * The target arrives as a scenario-participant alias in the request body, which is exactly how
     * the measured mixed-context submission expressed it, so alias resolution must not let a
     * self-target slip past as a different id.
     */
    it("resolves aliases before comparing, so a scenario-participant alias of the actor is refused", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "gladiator",
          actionId: "attack_parry",
          participantIdentities,
          phaseContexts: {
            ...phaseContexts,
            phase1: { ...phaseContexts.phase1, targetParticipantId: "scenario-gladiator" },
          },
        }),
      ).toMatchObject({
        message: "An attack cannot target its own attacker.",
        valid: false,
      });
    });

    it("compares the raw ids when no participant identities are supplied", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "gladiator",
          actionId: "attack_parry",
          phaseContexts: {
            ...phaseContexts,
            phase1: { ...phaseContexts.phase1, targetParticipantId: "gladiator" },
          },
        }),
      ).toMatchObject({
        message: "An attack cannot target its own attacker.",
        valid: false,
      });
    });

    it("covers the phase a Disarm declaration turns into an attack opportunity", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "gladiator",
          actionId: "disarm",
          disarmPhase: "phase1",
          participantIdentities,
          phaseContexts: {
            ...phaseContexts,
            phase1: { ...phaseContexts.phase1, targetParticipantId: "gladiator" },
          },
        }),
      ).toMatchObject({
        message: "An attack cannot target its own attacker.",
        valid: false,
      });
    });

    it("never turns `disarmPhase` into a new missing-target refusal", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "gladiator",
          actionId: "disarm",
          disarmPhase: "phase1",
          participantIdentities,
          phaseContexts,
        }),
      ).toMatchObject({
        missingPhases: [],
        valid: true,
      });
    });

    it("accepts the same declaration once it targets a distinct participant", () => {
      expect(
        validateCombatDeclarationTargets({
          actingParticipantId: "gladiator",
          actionId: "attack_parry",
          participantIdentities,
          phaseContexts: {
            ...phaseContexts,
            phase1: { ...phaseContexts.phase1, targetParticipantId: "guard" },
          },
        }),
      ).toMatchObject({
        missingPhases: [],
        valid: true,
      });
    });
  });
});
