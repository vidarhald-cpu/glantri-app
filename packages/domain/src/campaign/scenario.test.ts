import { describe, expect, it } from "vitest";

import {
  deriveScenarioStartPreflight,
  getAvailableScenarioLifecycleActions,
  getScenarioLifecycleTarget,
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  scenarioSchema,
} from "./scenario";

describe("Scenario lifecycle contract", () => {
  it("normalizes persisted legacy statuses without retaining a second authority", () => {
    const base = {
      campaignId: "campaign-1",
      createdAt: "2026-08-19T12:00:00.000Z",
      description: "",
      id: "scenario-1",
      kind: "mixed",
      name: "Legacy episode",
      updatedAt: "2026-08-19T12:00:00.000Z",
    };

    expect(scenarioSchema.parse({ ...base, status: "prepared" }).status).toBe("draft");
    expect(scenarioSchema.parse({ ...base, status: "completed" }).status).toBe("closed");
  });

  it("derives blockers and warnings without requiring an Encounter", () => {
    expect(
      deriveScenarioStartPreflight({
        participants: [],
        scenario: { description: "", name: "" },
      }),
    ).toEqual({
      blockers: [
        {
          code: "missing_name",
          message: "Add a Scenario name before starting play.",
        },
      ],
      ready: false,
      warnings: [
        {
          code: "missing_description",
          message: "This Scenario has no player-facing description yet.",
        },
        {
          code: "no_active_player_participants",
          message: "No active player characters are assigned to this Scenario.",
        },
      ],
    });

    expect(
      deriveScenarioStartPreflight({
        participants: [],
        scenario: { description: "A quiet opening.", name: "Episode one" },
      }),
    ).toMatchObject({ blockers: [], ready: true });
  });

  it("allows only the canonical five-state transitions", () => {
    expect(getAvailableScenarioLifecycleActions({ lifecycleCycle: 0, status: "draft" })).toEqual([
      "start",
      "archive",
    ]);
    expect(getAvailableScenarioLifecycleActions({ lifecycleCycle: 1, status: "live" })).toEqual([
      "pause",
      "close",
    ]);
    expect(getAvailableScenarioLifecycleActions({ lifecycleCycle: 1, status: "paused" })).toEqual([
      "resume",
      "close",
    ]);
    expect(getAvailableScenarioLifecycleActions({ lifecycleCycle: 1, status: "closed" })).toEqual([
      "reopen",
      "archive",
    ]);
    expect(
      getScenarioLifecycleTarget({ action: "restore", lifecycleCycle: 0, status: "archived" }),
    ).toBe("draft");
    expect(
      getScenarioLifecycleTarget({ action: "restore", lifecycleCycle: 2, status: "archived" }),
    ).toBe("closed");
    expect(
      getScenarioLifecycleTarget({ action: "archive", lifecycleCycle: 1, status: "live" }),
    ).toBeNull();
  });
});

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
