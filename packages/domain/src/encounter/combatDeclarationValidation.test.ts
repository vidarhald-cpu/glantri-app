import { describe, expect, it } from "vitest";

import { validateCombatDeclarationTargets } from "./combatDeclarationValidation";

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
  it("requires a Phase 1 target for Attack - Parry", () => {
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

  it("requires a Phase 2 target for Parry - Attack", () => {
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
            targetParticipantId: "goblin",
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
