import { describe, expect, it } from "vitest";

import {
  getCombatDeclarationActionLabel,
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
});
