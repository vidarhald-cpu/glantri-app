import { describe, expect, it } from "vitest";

import type { CombatEffectsState, ScenarioParticipantCombatContext } from "@glantri/domain";
import {
  calculateWorkbookDefensePair,
  lookupWorkbookPercentageAdjustment,
} from "@glantri/rules-engine";

import {
  applyLiveRawModifierToCombatValue,
  buildEncounterDbParryModifierCalculation,
  buildEncounterLiveCombatModifierSummary,
  buildEncounterInitiativeModifierCalculation,
  buildTargetAwareEncounterLiveCombatModifierSummary,
  filterCombatModifierEntriesForPhase,
  resolveEncounterLiveCombatModifierContext,
  resolveLiveRawModifierAdjustment,
  sumEncounterCombatEffectModifiers,
} from "./liveCombatModifiers";

function effect(overrides: Partial<CombatEffectsState["effects"][number]>) {
  return {
    createdAt: "2026-05-19T00:00:00.000Z",
    damage: 0,
    effectGroup: "general",
    generalDamage: 0,
    id: `effect-${overrides.type ?? "general"}-${overrides.status ?? "active"}`,
    modifierValue: -1,
    sourceEventId: "event-1",
    status: "active",
    targetParticipantId: "participant-1",
    type: "general_modifier",
    updatedAt: "2026-05-19T00:00:00.000Z",
    ...overrides,
  } satisfies CombatEffectsState["effects"][number];
}

describe("live combat modifiers", () => {
  it("drops a self-target resolved through another participant alias instead of creating a pair", () => {
    const context = resolveEncounterLiveCombatModifierContext({
      ownerCombatantId: "combatant-a",
      ownerParticipantId: "participant-a",
      participants: [
        {
          characterId: "character-a",
          id: "combatant-a",
          label: "The Gladiator",
          scenarioParticipantId: "participant-a",
        },
      ],
      targetParticipantId: "character-a",
    });

    expect(context).toMatchObject({
      ownerCombatantId: "combatant-a",
      ownerParticipantId: "participant-a",
    });
    expect(context.opponentCombatantId).toBeUndefined();
    expect(context.opponentParticipantId).toBeUndefined();
    expect(() => buildTargetAwareEncounterLiveCombatModifierSummary({ context })).not.toThrow();
  });

  it("projects an ordered Observe Opponent relationship into both target-aware live buckets", () => {
    const context = resolveEncounterLiveCombatModifierContext({
      actionId: "attack",
      encounterId: "encounter-1",
      ownerCombatantId: "combatant-a",
      ownerParticipantId: "participant-a",
      participants: [
        {
          id: "combatant-b",
          label: "Target B",
          scenarioParticipantId: "participant-b",
        },
      ],
      phaseKey: "phase1",
      relationships: [
        {
          bestBonus: 3,
          completedAttempts: 1,
          id: "observe:a:b",
          observerParticipantId: "combatant-a",
          roundsTowardNextAttempt: 0,
          targetParticipantId: "combatant-b",
        },
      ],
      roundNumber: 4,
      targetParticipantId: "combatant-b",
    });
    const summary = buildTargetAwareEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [{ id: "db", scope: "until", value: -1 }],
          situationInitiative: [],
          situationObSkill: [{ id: "ob", scope: "until", value: 2 }],
        },
      },
      context,
    });

    expect(summary).toMatchObject({
      dbRaw: 2,
      obSkillRaw: 5,
      opponentLabel: "Target B",
      opponentParticipantId: "participant-b",
    });
    expect(summary.opponentSpecificContributions).toEqual([
      expect.objectContaining({
        bucket: "skill_ob",
        id: "observe:a:b:modifier:skill_ob",
        value: 3,
      }),
      expect.objectContaining({
        bucket: "db_parry",
        id: "observe:a:b:modifier:db_parry",
        value: 3,
      }),
    ]);
  });

  it("does not apply Observe Opponent to an unrelated target or reverse the relationship", () => {
    const relationships = [
      {
        bestBonus: 3,
        completedAttempts: 1,
        id: "observe:a:b",
        observerParticipantId: "combatant-a",
        roundsTowardNextAttempt: 0,
        targetParticipantId: "combatant-b",
      },
      {
        bestBonus: 1,
        completedAttempts: 1,
        id: "observe:b:a",
        observerParticipantId: "combatant-b",
        roundsTowardNextAttempt: 0,
        targetParticipantId: "combatant-a",
      },
    ];
    const unrelated = buildTargetAwareEncounterLiveCombatModifierSummary({
      context: resolveEncounterLiveCombatModifierContext({
        ownerCombatantId: "combatant-a",
        ownerParticipantId: "participant-a",
        participants: [{ id: "combatant-c", scenarioParticipantId: "participant-c" }],
        relationships,
        targetParticipantId: "combatant-c",
      }),
    });
    const reverse = buildTargetAwareEncounterLiveCombatModifierSummary({
      context: resolveEncounterLiveCombatModifierContext({
        ownerCombatantId: "combatant-b",
        ownerParticipantId: "participant-b",
        participants: [{ id: "combatant-a", scenarioParticipantId: "participant-a" }],
        relationships,
        targetParticipantId: "combatant-a",
      }),
    });

    expect(unrelated.obSkillRaw).toBe(0);
    expect(unrelated.dbRaw).toBe(0);
    expect(unrelated.opponentSpecificContributions).toEqual([]);
    expect(reverse.obSkillRaw).toBe(1);
    expect(reverse.dbRaw).toBe(1);
  });

  it("uses the same raw target-aware total in live percentage adjustment", () => {
    const summary = buildTargetAwareEncounterLiveCombatModifierSummary({
      context: {
        opponentCombatantId: "combatant-b",
        opponentParticipantId: "participant-b",
        ownerCombatantId: "combatant-a",
        ownerParticipantId: "participant-a",
        relationships: [
          {
            bestBonus: 3,
            completedAttempts: 1,
            id: "observe:a:b",
            observerParticipantId: "combatant-a",
            roundsTowardNextAttempt: 0,
            targetParticipantId: "combatant-b",
          },
        ],
      },
    });
    const displayed = applyLiveRawModifierToCombatValue({
      baseValue: 20,
      rawModifier: summary.obSkillRaw,
    });

    expect(summary.obSkillRaw).toBe(3);
    expect(displayed).toBe(20 + lookupWorkbookPercentageAdjustment(20, summary.obSkillRaw)!);
  });

  it("sums active general and fatigue effects into General/Fatigue", () => {
    const sums = sumEncounterCombatEffectModifiers({
      effects: [
        effect({ effectGroup: "general", modifierValue: -4, type: "stun" }),
        effect({ effectGroup: "fatigue", modifierValue: -2, type: "fatigue" }),
        effect({ effectGroup: "general", modifierValue: -99, status: "resolved" }),
        effect({ effectGroup: "fatigue", modifierValue: -99, status: "expired", type: "fatigue" }),
      ],
      events: [],
    });

    expect(sums.general).toBe(-4);
    expect(sums.fatigue).toBe(-2);
    expect(sums.generalFatigue).toBe(-6);
  });

  it("keeps resolved, expired, and superseded effects out of live summaries", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatEffects: {
        effects: [
          effect({ effectGroup: "obSkill", modifierValue: 3, status: "resolved" }),
          effect({ effectGroup: "db", modifierValue: 4, status: "expired" }),
          effect({
            effectGroup: "fatigue",
            modifierValue: -5,
            status: "superseded",
            type: "fatigue",
          }),
        ],
        events: [],
      },
    });

    expect(summary.generalFatigueRaw).toBe(0);
    expect(summary.obSkillRaw).toBe(0);
    expect(summary.dbRaw).toBe(0);
  });

  it("removes round-expired contributions and reports only operational special effects", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              expiresAtRound: 3,
              id: "expired-db",
              scope: "until",
              value: -4,
            },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: {
        effects: [
          effect({
            expiresAtRound: 3,
            id: "expired-fatigue",
            modifierValue: -2,
            type: "fatigue",
          }),
          effect({
            id: "choice-effect",
            modifierValue: undefined,
            type: "special",
          }),
          effect({
            id: "damage-effect",
            modifierValue: undefined,
            type: "physical_damage",
          }),
        ],
        events: [],
      },
      currentRound: 4,
      ownerParticipantId: "participant-1",
    });

    expect(summary.dbRaw).toBe(0);
    expect(summary.generalFatigueRaw).toBe(0);
    expect(summary.specialEffectIds).toEqual(["choice-effect"]);
    expect(summary.specialEffectCount).toBe(1);
  });

  it("keeps committed phase-one combat action effects live for phase-two modifiers", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              id: "import:character_effect:commit-d1:combat-effect:additional-manual-db:db_parry",
              imported: true,
              readOnly: true,
              scope: "until",
              sourceEffectId: "commit-d1:combat-effect:additional-manual-db",
              sourceType: "character_effect",
              value: -2,
            },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: {
        effects: [
          effect({
            effectGroup: "db",
            id: "commit-d1:combat-effect:additional-manual-db",
            modifierValue: -2,
            sourceEventId: "commit-d1:combat-effect-event",
            type: "db_modifier",
          }),
        ],
        events: [
          {
            createdAt: "2026-05-19T00:00:00.000Z",
            description: "Phase 1 damage result",
            id: "commit-d1:combat-effect-event",
            phase: "phase1",
            sourceLabel: "Phase 1 damage",
            sourceType: "combat_action",
            targetParticipantId: "participant-1",
          },
        ],
      },
      phaseKey: "phase2",
    });

    expect(summary.dbRaw).toBe(-2);
  });

  it("uses the workbook percentage modifier table for live combat value adjustments", () => {
    const expectedAdjustment = lookupWorkbookPercentageAdjustment(20, 6);

    expect(expectedAdjustment).not.toBeNull();
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 20,
        rawModifier: -6,
      }),
    ).toBe(20 - expectedAdjustment!);
  });

  it("combines the Adjust Distance closer penalty with Phase 1 DB/Parry percentages once", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              application: "percentage",
              generated: true,
              id: "generated:adjust-range-attack:phase1:db-parry",
              scope: "until",
              sourceActionId: "adjust_range_attack",
              sourcePhase: "phase1",
              sourceProposalId: "adjust-distance:round:4:attacker",
              sourceRule: "adjust-range-phase1-db-parry",
              value: -2,
            },
            {
              application: "percentage",
              id: "phase1-cover",
              notes: "Phase 1 cover",
              scope: "until",
              sourcePhase: "phase1",
              value: 1,
            },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      phaseKey: "phase1",
    });
    const defense = calculateWorkbookDefensePair({
      baseDb: 16,
      rawModifiers: [{ label: "DB/Parry", value: summary.dbRaw }],
    });

    expect(summary).toMatchObject({ dbFlatAdjustment: 0, dbRaw: -1 });
    expect(defense).toMatchObject({
      db: 14,
      fullAdjustment: 2,
      fullModifier: -1,
      fullTrace: {
        baseValue: 16,
        finalValue: 14,
        percentageAdjustment: 2,
        rawModifierTotal: -1,
      },
    });
  });

  it("documents workbook live modifier results for zero, shield, and combined defense bases", () => {
    expect(lookupWorkbookPercentageAdjustment(0, 1)).toBe(1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: -1,
      }),
    ).toBe(-1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: 1,
      }),
    ).toBe(1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: 3,
      }),
    ).toBe(3);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: 100,
      }),
    ).toBe(100);

    expect(lookupWorkbookPercentageAdjustment(14, 1)).toBe(1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 14,
        rawModifier: -1,
      }),
    ).toBe(13);

    expect(lookupWorkbookPercentageAdjustment(15, 1)).toBe(2);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 15,
        rawModifier: -1,
      }),
    ).toBe(13);
  });

  /**
   * #922 repair cycle 1, finding 4 — this caller now produces extrapolated figures, and says so.
   *
   * Opening `lookupWorkbookPercentageAdjustment` for every caller activated this one. The measured
   * delta, base `a14c5c73` against the open-ended lookup: `{9, -20}` returned the base 9 unchanged
   * and now returns −11; `{9, -16}` returned 9 and now returns −7; `{60, -3}` returned 60 and now
   * returns 42; `{9, -15}` is 6 at both heads. The Product Owner's ruling is that every
   * extrapolation is flagged for review, so the fact travels with the figure.
   *
   * **The mutation this guards against:** going back to the value-only lookup here, which drops
   * `extrapolated` from every row below and silently changes three displayed figures.
   *
   * No surface displays the flag yet, deliberately: that is #940 and a Product Owner decision.
   */
  it("#922 says which live figures the open-ended rule resolved past the authored grid", () => {
    const measured = [
      { baseValue: 9, rawModifier: -20 },
      { baseValue: 9, rawModifier: -16 },
      { baseValue: 60, rawModifier: -3 },
      { baseValue: 9, rawModifier: -15 },
      { baseValue: 60, rawModifier: -20 },
      { baseValue: 9, rawModifier: 0 },
    ].map((input) => ({ ...input, ...resolveLiveRawModifierAdjustment(input) }));

    expect(measured).toEqual([
      // Past the modifier edge: the figure #922 was reported on.
      {
        baseValue: 9,
        extrapolated: true,
        extrapolatedAxes: ["modifier"],
        rawModifier: -20,
        resolved: true,
        value: -11,
      },
      {
        baseValue: 9,
        extrapolated: true,
        extrapolatedAxes: ["modifier"],
        rawModifier: -16,
        resolved: true,
        value: -7,
      },
      // Past the base edge, which this caller can reach with an ordinary high base.
      {
        baseValue: 60,
        extrapolated: true,
        extrapolatedAxes: ["base"],
        rawModifier: -3,
        resolved: true,
        value: 42,
      },
      // Inside the grid: the authored cell, and no flag.
      {
        baseValue: 9,
        extrapolated: false,
        extrapolatedAxes: [],
        rawModifier: -15,
        resolved: true,
        value: -6,
      },
      // Both axes at once.
      {
        baseValue: 60,
        extrapolated: true,
        extrapolatedAxes: ["base", "modifier"],
        rawModifier: -20,
        resolved: true,
        value: 5,
      },
      // No modifier at all is no adjustment, and nothing to flag.
      {
        baseValue: 9,
        extrapolated: false,
        extrapolatedAxes: [],
        rawModifier: 0,
        resolved: true,
        value: 9,
      },
    ]);

    // Every value matches the lookup's own output, never a figure computed here.
    for (const row of measured.filter((entry) => entry.rawModifier !== 0)) {
      const adjustment = lookupWorkbookPercentageAdjustment(
        row.baseValue,
        Math.abs(row.rawModifier),
      );
      expect(adjustment, `${row.baseValue}/${row.rawModifier}`).not.toBeNull();
      expect(row.value, `${row.baseValue}/${row.rawModifier}`).toBe(
        row.rawModifier > 0 ? row.baseValue + adjustment! : row.baseValue - adjustment!,
      );
    }

    // An input the rule has no reading of returns the base unchanged — which it did at the base
    // commit too — and says the adjustment was not resolved rather than claiming it was in-grid.
    expect(resolveLiveRawModifierAdjustment({ baseValue: -3, rawModifier: -4 })).toEqual({
      extrapolated: false,
      extrapolatedAxes: [],
      resolved: false,
      value: -3,
    });
    expect(applyLiveRawModifierToCombatValue({ baseValue: -3, rawModifier: -4 })).toBe(-3);
  });

  it("#922 carries the flag onto the initiative calculation a surface reads", () => {
    const combatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [{ id: "committed", scope: "until", value: -20 }],
        situationObSkill: [],
      },
    };
    const pastEdge = buildEncounterInitiativeModifierCalculation({
      baseInitiative: 9,
      combatContext,
    });

    expect(pastEdge.rawModifierTotal).toBe(-20);
    expect(pastEdge.extrapolated).toBe(true);
    expect(pastEdge.extrapolatedAxes).toEqual(["modifier"]);
    expect(pastEdge.modifiedInitiative).toBe(9 - lookupWorkbookPercentageAdjustment(9, 20)!);

    const inGrid = buildEncounterInitiativeModifierCalculation({
      baseInitiative: 9,
      combatContext: {
        modifierBuckets: {
          ...combatContext.modifierBuckets,
          situationInitiative: [{ id: "committed", scope: "until", value: -15 }],
        },
      },
    });

    expect(inGrid.rawModifierTotal).toBe(-15);
    expect(inGrid.extrapolated).toBe(false);
    expect(inGrid.extrapolatedAxes).toEqual([]);
  });

  it("documents previous defense overlay versus summed raw modifier strategy", () => {
    const baseDb = 10;
    const liveDbModifier = -1;
    const defenseCases = [
      {
        label: "shield-only DB",
        equipmentModifier: 5,
        expectedOverlay: 13,
        expectedSummedRaw: 14,
        expectedTheoretical: 15,
      },
      {
        label: "combined sword/shield DB",
        equipmentModifier: 6,
        expectedOverlay: 14,
        expectedSummedRaw: 15,
        expectedTheoretical: 16,
      },
    ];

    for (const testCase of defenseCases) {
      const theoreticalDefense = calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: testCase.equipmentModifier,
        toHitModifier: 0,
      });
      const previousLiveOverlay =
        theoreticalDefense == null
          ? null
          : applyLiveRawModifierToCombatValue({
              baseValue: theoreticalDefense.db,
              rawModifier: liveDbModifier,
            });
      const summedRawModifier = calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: testCase.equipmentModifier,
        rawModifiers: [{ label: "live DB", value: liveDbModifier }],
        toHitModifier: 0,
      });

      expect.soft(theoreticalDefense?.db, testCase.label).toBe(testCase.expectedTheoretical);
      expect.soft(previousLiveOverlay, testCase.label).toBe(testCase.expectedOverlay);
      expect.soft(summedRawModifier?.db, testCase.label).toBe(testCase.expectedSummedRaw);
      expect
        .soft(summedRawModifier?.fullTrace.rawModifierTotal, testCase.label)
        .toBe(testCase.equipmentModifier + liveDbModifier);
    }
  });

  it("uses canonical OB/Skill rows without separately adding raw persistent effects", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [{ id: "old-general", scope: "until", value: -99 }],
          situationDb: [{ id: "manual-db", scope: "until", value: 2 }],
          situationInitiative: [{ id: "manual-initiative", scope: "until", value: 5 }],
          situationObSkill: [{ id: "manual-ob", scope: "until", value: 3 }],
        },
      },
      combatEffects: {
        effects: [
          effect({ effectGroup: "general", modifierValue: -4, type: "stun" }),
          effect({ effectGroup: "fatigue", modifierValue: -2, type: "fatigue" }),
          effect({ effectGroup: "obSkill", modifierValue: 1, type: "morale" }),
          effect({ effectGroup: "db", modifierValue: -1, type: "fear" }),
        ],
        events: [],
      },
    });

    expect(summary.generalFatigueRaw).toBe(-6);
    expect(summary.initiativeRaw).toBe(5);
    expect(summary.obSkillRaw).toBe(3);
    expect(summary.dbRaw).toBe(2);
    expect(summary.modifierNoteLabels).toEqual([
      "Gen/Fatigue",
      "Initiative",
      "OB/Skill",
      "DB/Parry",
      "Enc",
      "Equipment",
    ]);
  });

  it("applies only explicitly combat-wide general effects to initiative, Skill/OB, and DB/Parry", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatEffects: {
        effects: [
          effect({
            combatWide: true,
            effectGroup: "general",
            modifierValue: -2,
            type: "general_modifier",
          }),
          effect({
            effectGroup: "general",
            modifierValue: -7,
            type: "general_modifier",
          }),
        ],
        events: [],
      },
    });

    expect(summary.generalFatigueRaw).toBe(-9);
    expect(summary.initiativeRaw).toBe(-2);
    expect(summary.dbRaw).toBe(-2);
    expect(summary.obSkillRaw).toBe(-2);
  });

  it("sums imported, generated, manual, and legacy Skill/OB rows exactly once by phase", () => {
    const combatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [{ id: "general-not-ob", scope: "until", value: -99 }],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [
          {
            id: "import:character_effect:skill-1:skill_ob",
            imported: true,
            readOnly: true,
            scope: "until",
            sourceEffectId: "skill-1",
            sourceType: "character_effect",
            value: 2,
          },
          {
            id: "import:character_effect:skill-2:skill_ob",
            imported: true,
            readOnly: true,
            scope: "until",
            sourceEffectId: "skill-2",
            sourceType: "character_effect",
            value: -1,
          },
          { generated: true, id: "generated", scope: "until", sourcePhase: "phase1", value: -2 },
          { id: "manual", scope: "until", value: 1 },
          { id: "legacy", scope: "until", value: 3 },
          { generated: true, id: "other-phase", scope: "until", sourcePhase: "phase2", value: 99 },
        ],
      },
    };

    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase1" }).obSkillRaw,
    ).toBe(3);
  });

  it("traces DB/Parry only from the canonical DB/Parry bucket", () => {
    const calculation = buildEncounterDbParryModifierCalculation({
      baseValue: 10,
      liveModifiers: {
        dbRaw: -4,
        generalFatigueRaw: -1,
        initiativeRaw: -99,
        modifierNoteLabels: [],
        obSkillRaw: -99,
      },
    });

    expect(calculation).toMatchObject({
      baseValue: 10,
      rawModifierTotal: -4,
      percentageAdjustment: lookupWorkbookPercentageAdjustment(10, 4),
      finalValue: 10 - lookupWorkbookPercentageAdjustment(10, 4)!,
      rawModifiers: [{ label: "DB/Parry", value: -4 }],
    });
  });

  it("leaves DB/Parry unchanged when only Skill/OB or Initiative modifiers exist", () => {
    expect(
      buildEncounterDbParryModifierCalculation({
        baseValue: 10,
        liveModifiers: {
          dbRaw: 0,
          generalFatigueRaw: 0,
          initiativeRaw: -4,
          modifierNoteLabels: [],
          obSkillRaw: -4,
        },
      }),
    ).toMatchObject({
      baseValue: 10,
      finalValue: 10,
      percentageAdjustment: 0,
      rawModifierTotal: 0,
      rawModifiers: [],
    });
  });

  it("filters generated modifiers by source phase while keeping manual rows broad", () => {
    const combatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [
          {
            id: "manual-db-parry",
            scope: "until" as const,
            value: -1,
          },
          {
            generated: true,
            id: "generated:attack-parry:phase1:db-parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:parry-attack:phase2:db-parry",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:double-attack:phase1:db-parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:double-attack:phase2:db-parry",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:adjust-range-attack:phase1:db-parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -2,
          },
          {
            generated: true,
            id: "generated:adjust-range-attack:phase2:db-parry",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
        ],
        situationInitiative: [],
        situationObSkill: [
          {
            id: "manual-ob-skill",
            scope: "until" as const,
            value: 2,
          },
          {
            generated: true,
            id: "generated:double-attack:phase1:ob-skill",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -1,
          },
          {
            generated: true,
            id: "generated:double-attack:phase2:ob-skill",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -1,
          },
        ],
      },
    };

    expect(buildEncounterLiveCombatModifierSummary({ combatContext })).toMatchObject({
      dbRaw: -1,
      obSkillRaw: 2,
    });
    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase1" }).dbRaw,
    ).toBe(-11);
    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase2" }).dbRaw,
    ).toBe(-13);
    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase1" }).obSkillRaw,
    ).toBe(1);
    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase2" }).obSkillRaw,
    ).toBe(1);
    expect(
      filterCombatModifierEntriesForPhase(combatContext.modifierBuckets.situationDb).map(
        (entry) => entry.id,
      ),
    ).toEqual(["manual-db-parry"]);
    expect(
      filterCombatModifierEntriesForPhase(combatContext.modifierBuckets.situationObSkill).map(
        (entry) => entry.id,
      ),
    ).toEqual(["manual-ob-skill"]);
    expect(
      filterCombatModifierEntriesForPhase(combatContext.modifierBuckets.situationDb, "phase1").map(
        (entry) => entry.id,
      ),
    ).toEqual([
      "manual-db-parry",
      "generated:attack-parry:phase1:db-parry",
      "generated:double-attack:phase1:db-parry",
      "generated:adjust-range-attack:phase1:db-parry",
    ]);
    expect(
      filterCombatModifierEntriesForPhase(combatContext.modifierBuckets.situationDb, "phase2").map(
        (entry) => entry.id,
      ),
    ).toEqual([
      "manual-db-parry",
      "generated:parry-attack:phase2:db-parry",
      "generated:double-attack:phase2:db-parry",
      "generated:adjust-range-attack:phase2:db-parry",
    ]);
    expect(
      filterCombatModifierEntriesForPhase(
        combatContext.modifierBuckets.situationObSkill,
        "phase1",
      ).map((entry) => entry.id),
    ).toEqual(["manual-ob-skill", "generated:double-attack:phase1:ob-skill"]);
    expect(
      filterCombatModifierEntriesForPhase(
        combatContext.modifierBuckets.situationObSkill,
        "phase2",
      ).map((entry) => entry.id),
    ).toEqual(["manual-ob-skill", "generated:double-attack:phase2:ob-skill"]);
  });

  it("does not sum Double Attack phase modifiers in no-specific-phase views", () => {
    const combatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [
          {
            generated: true,
            id: "generated:double-attack:phase1:db-parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:double-attack:phase2:db-parry",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:adjust-range-attack:phase1:db-parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -2,
          },
          {
            generated: true,
            id: "generated:adjust-range-attack:phase2:db-parry",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
        ],
        situationInitiative: [],
        situationObSkill: [
          {
            generated: true,
            id: "generated:double-attack:phase1:ob-skill",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -1,
          },
          {
            generated: true,
            id: "generated:double-attack:phase2:ob-skill",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -1,
          },
        ],
      },
    };

    expect(buildEncounterLiveCombatModifierSummary({ combatContext })).toMatchObject({
      dbRaw: 0,
      obSkillRaw: 0,
    });
    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase1" }),
    ).toMatchObject({
      dbRaw: -6,
      obSkillRaw: -1,
    });
    expect(
      buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase2" }),
    ).toMatchObject({
      dbRaw: -8,
      obSkillRaw: -1,
    });
  });

  it("applies only canonical initiative-bucket rows through the workbook table", () => {
    const combatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [{ id: "general", scope: "until", value: -99 }],
        situationDb: [],
        situationInitiative: [
          {
            id: "import:character_effect:initiative-1:initiative",
            imported: true,
            readOnly: true,
            scope: "until",
            sourceEffectId: "initiative-1",
            sourceType: "character_effect",
            value: 1,
          },
          { id: "manual", scope: "until", value: 2 },
        ],
        situationObSkill: [],
      },
    };
    const calculation = buildEncounterInitiativeModifierCalculation({
      baseInitiative: 12,
      combatContext,
    });
    const expectedAdjustment = lookupWorkbookPercentageAdjustment(12, 3);

    expect(calculation.rawModifierTotal).toBe(3);
    expect(calculation.modifierAdjustment).toBe(expectedAdjustment);
    expect(calculation.modifiedInitiative).toBe(12 + expectedAdjustment!);
  });

  it("sums imported, generated, manual, and legacy initiative rows exactly once by phase", () => {
    const combatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [
          {
            id: "import:character_effect:initiative-1:initiative",
            imported: true,
            readOnly: true,
            scope: "until",
            sourceEffectId: "initiative-1",
            sourceType: "character_effect",
            value: 2,
          },
          {
            id: "import:character_effect:initiative-2:initiative",
            imported: true,
            readOnly: true,
            scope: "until",
            sourceEffectId: "initiative-2",
            sourceType: "character_effect",
            value: -1,
          },
          { generated: true, id: "generated", scope: "until", sourcePhase: "phase2", value: 6 },
          { id: "manual", scope: "until", value: -2 },
          { id: "legacy", scope: "until", value: 1 },
          { generated: true, id: "other-phase", scope: "until", sourcePhase: "phase1", value: 99 },
        ],
        situationObSkill: [],
      },
    };

    expect(
      buildEncounterInitiativeModifierCalculation({
        baseInitiative: 10,
        combatContext,
        phaseKey: "phase2",
      }).rawModifierTotal,
    ).toBe(6);
  });

  it("leaves initiative unchanged when no initiative rows exist", () => {
    expect(
      buildEncounterInitiativeModifierCalculation({
        baseInitiative: 0,
        combatContext: {
          modifierBuckets: {
            general: [{ id: "general", scope: "until", value: -4 }],
            situationDb: [{ id: "db", scope: "until", value: -4 }],
            situationInitiative: [],
            situationObSkill: [{ id: "skill", scope: "until", value: 100 }],
          },
        },
      }),
    ).toMatchObject({
      modifiedInitiative: 0,
      modifierAdjustment: 0,
      rawModifierTotal: 0,
    });
  });
});

describe("#899 a GM modifier committed in the review reaches the panel summary once", () => {
  const committedLifecycle = {
    applicability: {
      combatWide: true,
      encounterId: "encounter-1",
      rollPurposes: [],
      roundNumber: 1,
    },
    createdAt: "2026-05-19T00:00:00.000Z",
    createdRevision: "2026-05-19T00:00:00.000Z",
    createdSequence: 1,
    id: "modifier-899-db-parry",
    lifecycle: {
      duration: {
        creationRoundCounts: false,
        kind: "rounds" as const,
        remaining: 2,
        startPhase: "phase1" as const,
        startRound: 1,
        startSequence: 1,
        transitionBoundary: "round_boundary" as const,
      },
      state: "active" as const,
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "participant-1",
    payload: {
      category: "db_parry" as const,
      contributionScope: "calculation" as const,
      kind: "numeric" as const,
      unit: "percentage" as const,
      value: -7,
    },
    provenanceCompleteness: "complete" as const,
    publicLabel: "GM cover",
    schemaVersion: 1 as const,
    sourceFamily: "manual" as const,
    sourceReferences: { rowId: "modifier-899-db-parry" },
    version: 1,
    visibility: { audience: "public" as const, sourceIdentity: "public" as const },
  };

  /** The pair the API persists for one row added in the modifier review. */
  const committedCombatContext: ScenarioParticipantCombatContext = {
    modifierBuckets: {
      general: [],
      situationDb: [
        {
          canonicalLifecycle: committedLifecycle,
          durationRounds: 2,
          id: "modifier-899-db-parry",
          notes: "GM cover",
          scope: "until",
          value: -7,
        },
      ],
      situationInitiative: [],
      situationObSkill: [],
    },
  };

  const committedCombatEffects: CombatEffectsState = {
    effects: [
      {
        canonicalLifecycle: committedLifecycle,
        canonicalTransitions: [],
        combatModifierBucket: "db_parry",
        combatWide: true,
        createdAt: "2026-05-19T00:00:00.000Z",
        damage: 0,
        description: "GM cover",
        duration: "2 rounds",
        effectGroup: "db",
        generalDamage: 0,
        id: "modifier-899-db-parry",
        modifierValue: -7,
        sourceEventId: "event-899",
        status: "active",
        targetParticipantId: "participant-1",
        type: "other_modifier",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
    ],
    events: [
      {
        createdAt: "2026-05-19T00:00:00.000Z",
        description: "GM cover",
        id: "event-899",
        sourceLabel: "GM cover",
        sourceType: "gm_adjustment",
        targetParticipantId: "participant-1",
      },
    ],
  };

  it("reads the committed row's own value, not twice it", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: committedCombatContext,
      combatEffects: committedCombatEffects,
      currentRound: 1,
      encounterId: "encounter-1",
      ownerParticipantId: "participant-1",
      phaseKey: "phase1",
    });

    expect(summary.dbRaw).toBe(-7);
  });
});
