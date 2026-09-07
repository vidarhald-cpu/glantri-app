import { describe, expect, it } from "vitest";

import {
  ScenarioStatus,
  canMutateScenarioInStatus,
  canTransitionScenarioStatus,
  isScenarioLiveInteractive,
  isScenarioReadOnly,
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

    expect(
      scenarioCombatModifierEntrySchema.parse({
        id: "import:character_effect:haste:initiative",
        imported: true,
        readOnly: true,
        sourceDuration: "2 rounds",
        sourceEffectId: "haste",
        sourceType: "character_effect",
        value: 2,
      }),
    ).toMatchObject({
      imported: true,
      readOnly: true,
      sourceEffectId: "haste",
      sourceType: "character_effect",
      value: 2,
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

describe("scenario lifecycle gates", () => {
  it.each([
    ["draft", "draft", true],
    ["draft", "prepared", true],
    ["draft", "live", false],
    ["draft", "completed", false],
    ["draft", "archived", true],
    ["prepared", "draft", true],
    ["prepared", "prepared", true],
    ["prepared", "live", true],
    ["prepared", "completed", false],
    ["prepared", "archived", true],
    ["live", "draft", false],
    ["live", "prepared", false],
    ["live", "live", true],
    ["live", "completed", true],
    ["live", "archived", false],
    ["completed", "live", false],
    ["completed", "completed", true],
    ["completed", "archived", true],
    ["archived", "draft", false],
    ["archived", "prepared", false],
    ["archived", "live", false],
    ["archived", "completed", false],
    ["archived", "archived", true],
  ])("enforces transition from %s to %s", (from, to, expected) => {
    expect(canTransitionScenarioStatus(from as ScenarioStatus, to as ScenarioStatus)).toBe(
      expected,
    );
  });

  it.each([
    ["draft", false],
    ["prepared", false],
    ["live", false],
    ["completed", true],
    ["archived", true],
  ])("marks %s as %s read-only", (status, readOnly) => {
    expect(isScenarioReadOnly(status as ScenarioStatus)).toBe(readOnly);
    expect(canMutateScenarioInStatus(status as ScenarioStatus)).toBe(!readOnly);
  });

  it.each([
    ["draft", false],
    ["prepared", false],
    ["live", true],
    ["completed", false],
    ["archived", false],
  ])("reports interactive access for %s scenarios", (status, interactive) => {
    expect(isScenarioLiveInteractive(status as ScenarioStatus)).toBe(interactive);
  });
});
