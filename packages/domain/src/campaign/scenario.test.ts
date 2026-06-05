import { describe, expect, it } from "vitest";

import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
} from "./scenario";

describe("scenario combat modifier entries", () => {
  it("accepts numeric duration rounds while keeping old entries compatible", () => {
    expect(
      scenarioCombatModifierEntrySchema.parse({
        durationRounds: 2,
        id: "modifier-1",
        notes: "High ground",
        value: -1,
      }),
    ).toEqual({
      durationRounds: 2,
      id: "modifier-1",
      notes: "High ground",
      scope: "until",
      value: -1,
    });

    expect(
      scenarioCombatModifierEntrySchema.parse({
        id: "modifier-legacy",
        scope: "save",
        value: 1,
      }),
    ).toEqual({
      id: "modifier-legacy",
      scope: "save",
      value: 1,
    });

    expect(
      scenarioCombatModifierEntrySchema.parse({
        generated: true,
        id: "generated-db-parry",
        sourceActionId: "attack_parry",
        sourcePhase: "phase1",
        sourceRule: "attack-parry-db-parry-phase1",
        value: -4,
      }),
    ).toEqual({
      generated: true,
      id: "generated-db-parry",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "attack-parry-db-parry-phase1",
      value: -4,
    });
  });

  it("keeps old combat contexts compatible while supporting Initiative modifiers", () => {
    expect(
      scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationObSkill: [],
        },
      }),
    ).toEqual({
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    });

    expect(
      scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [
            {
              durationRounds: 2,
              id: "initiative-1",
              notes: "Ready stance",
              value: 1,
            },
          ],
          situationObSkill: [],
        },
      }).modifierBuckets.situationInitiative,
    ).toEqual([
      {
        durationRounds: 2,
        id: "initiative-1",
        notes: "Ready stance",
        scope: "until",
        value: 1,
      },
    ]);
  });

  it("keeps old combat contexts compatible while supporting aimed target locations", () => {
    expect(scenarioParticipantCombatContextSchema.parse({})).toEqual({
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    });

    expect(
      scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetLocation: "rightArm",
      }).targetLocation,
    ).toBe("rightArm");
  });

  it("keeps old combat contexts compatible while supporting phase attack targets", () => {
    expect(scenarioParticipantCombatContextSchema.parse({}).targetParticipantId).toBeUndefined();

    expect(
      scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetParticipantId: "participant-target-1",
      }).targetParticipantId,
    ).toBe("participant-target-1");
  });
});
