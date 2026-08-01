import { describe, expect, it } from "vitest";

import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import { buildCombatCalculationPresentations } from "./buildCombatCalculationPresentations";
import {
  buildCombatCalculationPresentationLines,
  buildCombatCalculationPresentationRows,
} from "./combatCalculationPresentation";

function event(
  type: ProjectedCombatHistoryEvent["type"],
  privateCalculation: Record<string, unknown>,
  overrides: Partial<ProjectedCombatHistoryEvent> = {},
): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts: { privateCalculation, publicOutcome: {} },
    id: `event:${type}`,
    identities: [],
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    sequence: 1,
    status: "recorded",
    step: "phase_1_actions",
    type,
    ...overrides,
  };
}

function lines(source: ProjectedCombatHistoryEvent): readonly string[] {
  const presentation = buildCombatCalculationPresentations(source)[0];
  expect(presentation).toBeDefined();
  return buildCombatCalculationPresentationLines(presentation!);
}

describe("shared combat calculation presentation", () => {
  it("uses stat, skill XP, modifiers, total, pre-die, die, result order for Feint", () => {
    const presentation = buildCombatCalculationPresentations(
      event(
        "feint_roll",
        {
          adjustment: -2,
          characteristic: "dex",
          characteristicValue: 17,
          finalTotal: 28,
          openEndedD10s: [],
          rollD20: 6,
          rollTotal: 6,
          skillId: "internal-skill-id",
          skillLabel: "Feint",
          skillXp: 7,
        },
        {
          facts: {
            involvedOutcome: { side: "attacker" },
            privateCalculation: {
              adjustment: -2,
              characteristic: "dex",
              characteristicValue: 17,
              finalTotal: 28,
              openEndedD10s: [],
              rollD20: 6,
              rollTotal: 6,
              skillId: "internal-skill-id",
              skillLabel: "Feint",
              skillXp: 7,
            },
            publicOutcome: {},
          },
        },
      ),
    )[0];

    expect(buildCombatCalculationPresentationLines(presentation!)).toEqual([
      "Stat: Dexterity 17",
      "Feint XP: 7",
      "Modifiers",
      "Adjustment: -2",
      "Total modifiers: -2",
      "Skill total: 22",
      "Die roll: 6",
      "Result: 28",
    ]);
    expect(JSON.stringify(presentation)).not.toContain("internal-skill-id");
    expect(buildCombatCalculationPresentationLines(presentation!).join(" ")).not.toMatch(
      /winner|margin|success|consequence/i,
    );

    const defender = buildCombatCalculationPresentations(
      event(
        "feint_roll",
        {
          adjustment: 0,
          characteristic: "int",
          characteristicValue: 14,
          finalTotal: 31,
          openEndedD10s: [],
          rollD20: 13,
          rollTotal: 13,
          skillLabel: "Dodge",
          skillXp: 5,
        },
        {
          facts: {
            involvedOutcome: { side: "defender" },
            privateCalculation: {
              adjustment: 0,
              characteristic: "int",
              characteristicValue: 14,
              finalTotal: 31,
              openEndedD10s: [],
              rollD20: 13,
              rollTotal: 13,
              skillLabel: "Dodge",
              skillXp: 5,
            },
            publicOutcome: {},
          },
        },
      ),
    )[0];

    expect(defender?.label).toBe("Defender");
    expect(buildCombatCalculationPresentationLines(defender!)).toEqual([
      "Stat: Intelligence 14",
      "Dodge XP: 5",
      "Skill total: 18",
      "Die roll: 13",
      "Result: 31",
    ]);
  });

  it("renders canonical Feint snapshots through the shared percentage grammar", () => {
    const privateCalculation = {
      adjustment: 2,
      characteristic: "int",
      characteristicValue: 14,
      finalTotal: 30,
      openEndedD10s: [],
      rollD20: 6,
      rollTotal: 6,
      skillContestCalculation: {
        baseSkill: 22,
        calculationId: "feint:defender",
        completeness: "complete",
        contestType: "weapon_feint",
        derivedIntegerAdjustment: 2,
        finalResult: 30,
        governingStat: { id: "int", label: "Intelligence", value: 14 },
        missingContributionPoints: [],
        openEndedDie: { openEndedD10s: [], rollD20: 6, rollTotal: 6 },
        opponentParticipantId: "attacker",
        participantId: "defender",
        percentageContributions: [
          {
            category: "relationship",
            id: "observation:defender:attacker",
            label: "Observe Opponent",
            unit: "percentage",
            value: 1,
          },
        ],
        preDieTotal: 24,
        role: "feint_defender",
        skill: { id: "sword", label: "Sword", totalXp: 8 },
        totalPercentageAdjustment: 1,
        visibility: "roller_and_gm",
      },
      skillId: "sword",
      skillLabel: "Sword",
      skillXp: 8,
    };
    const presentation = buildCombatCalculationPresentations(
      event(
        "feint_roll",
        privateCalculation,
        {
          facts: {
            involvedOutcome: { side: "defender" },
            privateCalculation,
            publicOutcome: {},
          },
        },
      ),
    )[0];

    expect(buildCombatCalculationPresentationLines(presentation!)).toEqual([
      "Stat: Intelligence 14",
      "Sword XP: 8",
      "Base skill: 22",
      "Modifiers",
      "Observe Opponent: +1%",
      "Total modifiers: +1%",
      "Derived adjustment: +2",
      "Skill total: 24",
      "Die roll: 6",
      "Result: 30",
    ]);
  });

  it("normalizes Observe Opponent and keeps opponent calculation GM-only", () => {
    const source = event(
      "observation",
      {
        appliedModifiers: [
          { bucket: "general_fatigue", label: "Combat Experience", value: 1 },
          { bucket: "skill_ob", label: "Fatigue", value: -1 },
        ],
        baseValue: 22,
        effectiveSkillValue: 22,
        finalTotal: 24,
        intelligenceValue: 11,
        intelligenceXp: 3,
        percentageAdjustment: 0,
        percentageModifierTotal: 0,
        rollD20: 2,
        rollTotal: 2,
        skillId: "one-handed-edged",
        skillLabel: "One-handed edged",
        skillXp: 7,
      },
      {
        facts: {
          gmReview: {
            targetCalculation: {
              appliedModifiers: [],
              baseValue: 17,
              effectiveSkillValue: 17,
              finalTotal: 30,
              intelligenceValue: 12,
              intelligenceXp: 1,
              percentageAdjustment: 0,
              percentageModifierTotal: 0,
              rollD20: 13,
              rollTotal: 13,
              skillLabel: "Dodge",
              skillXp: 5,
            },
          },
          privateCalculation: {
            appliedModifiers: [
              { bucket: "general_fatigue", label: "Combat Experience", value: 1 },
              { bucket: "skill_ob", label: "Fatigue", value: -1 },
            ],
            baseValue: 22,
            effectiveSkillValue: 22,
            finalTotal: 24,
            intelligenceValue: 11,
            intelligenceXp: 3,
            percentageAdjustment: 0,
            percentageModifierTotal: 0,
            rollD20: 2,
            rollTotal: 2,
            skillId: "one-handed-edged",
            skillLabel: "One-handed edged",
            skillXp: 7,
          },
          publicOutcome: {},
        },
      },
    );
    const calculations = buildCombatCalculationPresentations(source);

    expect(calculations).toHaveLength(2);
    expect(calculations[1]?.visibility).toBe("gm_full");
    expect(buildCombatCalculationPresentationLines(calculations[0]!)).toEqual([
      "Stat: Intelligence 11",
      "One-handed edged XP: 7",
      "Intelligence XP: 3",
      "Base skill: 22",
      "Percentage adjustment: 0",
      "Modifiers",
      "Combat Experience: +1%",
      "Fatigue: -1%",
      "Total modifiers: 0%",
      "Skill total: 22",
      "Die roll: 2",
      "Result: 24",
    ]);
  });

  it("expands attack and parry snapshots into the same arithmetic grammar", () => {
    const attackLines = lines(
      event("attack", {
        defenderDb: 16,
        lookupTotal: 15,
        ob: 13,
        obBeforeOpponentSpecificModifier: 10,
        opponentSpecificObModifierRows: [
          { label: "Observe Opponent · Scyrian cavalry guy", value: 3 },
        ],
        opponentSpecificObPercentageAdjustment: 3,
        opponentSpecificObRaw: 3,
        rollD20: 18,
        rollTotal: 18,
      }),
    );
    expect(attackLines).toEqual([
      "Base OB: 10",
      "Percentage adjustment: 3",
      "Adjusted OB: 13",
      "Defender DB: 16",
      "Modifiers",
      "Observe Opponent · Scyrian cavalry guy: +3%",
      "Total modifiers: +3%",
      "Combat total: -3",
      "Die roll: 18",
      "Result: 15",
    ]);

    const parryLines = lines(
      event("parry", {
        combinedParryScore: 12,
        modifierAdjustment: 1,
        modifierBreakdown: [{ label: "Observe Opponent", value: 1 }],
        openEndedD10s: [],
        rollD20: 11,
        rollTotal: 11,
        total: 24,
      }),
    );
    expect(parryLines).toEqual([
      "Base Parry: 12",
      "Modifiers",
      "Observe Opponent: +1",
      "Total modifiers: +1",
      "Combat total: 13",
      "Die roll: 11",
      "Result: 24",
    ]);
  });

  it("uses the common renderer for Dodge, initiative, CE, and health snapshots", () => {
    expect(
      lines(
        event("adjust_distance_roll", {
          dodgeSkillTotal: 16,
          finalTotal: 23,
          generalFatigueModifier: -1,
          openEndedD10s: [],
          rollD20: 6,
          rollTotal: 6,
          situationalAdjustment: 2,
        }),
      ),
    ).toEqual([
      "Dodge base: 16",
      "Modifiers",
      "General/Fatigue: -1%",
      "GM maneuver adjustment: +2%",
      "Total modifiers: +1%",
      "Skill total: 17",
      "Die roll: 6",
      "Result: 23",
    ]);
    expect(
      lines(
        event("initiative", {
          baseInitiative: 4,
          modifierAdjustment: 1,
          rolls: [5],
          rollTotal: 5,
          total: 10,
        }),
      ),
    ).toContain("Initiative total: 5");
    expect(
      lines(
        event("combat_experience", {
          finalTotal: 27,
          openEndedD10s: [],
          rollD20: 17,
          rollTotal: 17,
          skillTotal: 10,
        }),
      ),
    ).toEqual(["Skill total: 10", "Die roll: 17", "Result: 27"]);
    expect(
      lines(
        event("health_check", {
          finalTotal: 31,
          healthStat: 13,
          openEndedD10s: [],
          rollD20: 18,
          rollTotal: 18,
        }),
      ),
    ).toEqual(["Stat: Health 13", "Health total: 13", "Die roll: 18", "Result: 31"]);
  });

  it("keeps legacy DB-derived Adjust Distance snapshots explicitly incomplete", () => {
    const [presentation] = buildCombatCalculationPresentations(
      event("adjust_distance_roll", {
        dodgeSkillLabel: "Dodge",
        dodgeSkillTotal: 16,
        dodgeSkillXp: 6,
        dodgeStatLabel: "Dexterity",
        dodgeStatValue: 10,
        finalTotal: 23,
        openEndedD10s: [],
        rollD20: 6,
        rollTotal: 6,
      }),
    );

    expect(presentation?.completeness).toBe("legacy_incomplete");
    expect(buildCombatCalculationPresentationLines(presentation!)).toContain("Dodge base: 16");
  });

  it("renders canonical Skill Contest percentage and derived point facts distinctly", () => {
    expect(
      lines(
        event("adjust_distance_roll", {
          finalTotal: 30,
          openEndedD10s: [],
          rollD20: 6,
          rollTotal: 6,
          skillContestCalculation: {
            baseSkill: 22,
            calculationId: "adjust-distance:resister",
            completeness: "partial",
            contestType: "adjust_distance_attack",
            derivedIntegerAdjustment: 2,
            finalResult: 30,
            governingStat: { id: "dex", label: "Dexterity", value: 16 },
            missingContributionPoints: ["movement_mm", "encumbrance"],
            openEndedDie: { openEndedD10s: [], rollD20: 6, rollTotal: 6 },
            opponentParticipantId: "initiator",
            participantId: "resister",
            percentageContributions: [
              {
                category: "relationship",
                id: "observation:resister:initiator",
                label: "Observe Opponent",
                unit: "percentage",
                value: 1,
              },
            ],
            preDieTotal: 24,
            role: "resisting_opponent",
            skill: { id: "dodge", label: "Dodge", totalXp: 6 },
            totalPercentageAdjustment: 1,
            visibility: "roller_and_gm",
          },
        }),
      ),
    ).toEqual([
      "Stat: Dexterity 16",
      "Dodge XP: 6",
      "Base skill: 22",
      "Modifiers",
      "Observe Opponent: +1%",
      "Total modifiers: +1%",
      "Derived adjustment: +2",
      "Skill total: 24",
      "Die roll: 6",
      "Result: 30",
    ]);
  });

  it("uses bounded arithmetic presentations for hit location, damage, and critical snapshots", () => {
    expect(
      lines(
        event("hit_location", {
          hitLocationRolls: [17],
          selectedHitLocationRoll: 17,
        }),
      ),
    ).toEqual(["Die roll: 17"]);

    expect(
      lines(
        event("damage_proposed", {
          armorModifier: -2,
          damageLookupTotal: 19,
          damageRoll: { rolls: [6], total: 6 },
          defenderDm: -1,
          dmb: 4,
          hitLookupTotal: 12,
        }),
      ),
    ).toEqual([
      "Hit lookup total: 12",
      "Modifiers",
      "DMB: +4",
      "Defender DM: -1",
      "Armor: -2",
      "Total modifiers: +1",
      "Damage total: 13",
      "Die roll: 6",
      "Result: 19",
    ]);

    expect(
      lines(
        event("critical", {
          armorCriticalModifier: -2,
          criticalDice: [8],
          criticalDiceTotal: 8,
          criticalTypeModifier: 3,
          finalCriticalRoll: 9,
        }),
      ),
    ).toEqual([
      "Modifiers",
      "Critical type: +3",
      "Armor: -2",
      "Total modifiers: +1",
      "Critical modifier total: 1",
      "Die roll: 8",
      "Result: 9",
    ]);
  });

  it("omits zero modifier sections and produces stable rows for the same snapshot", () => {
    const source = event("adjust_distance_roll", {
      dodgeSkillTotal: 16,
      finalTotal: 22,
      generalFatigueModifier: 0,
      openEndedD10s: [],
      rollD20: 6,
      rollTotal: 6,
      situationalAdjustment: 0,
    });
    const first = buildCombatCalculationPresentations(source)[0]!;
    const second = buildCombatCalculationPresentations(source)[0]!;

    expect(buildCombatCalculationPresentationLines(first)).toEqual([
      "Dodge base: 16",
      "Skill total: 16",
      "Die roll: 6",
      "Result: 22",
    ]);
    expect(buildCombatCalculationPresentationRows(first)).toEqual(
      buildCombatCalculationPresentationRows(second),
    );
  });

  it("renders a complete Adjust Distance snapshot with every applied modifier once", () => {
    const presentation = buildCombatCalculationPresentations(
      event("adjust_distance_roll", {
        finalTotal: 30,
        openEndedD10s: [],
        rollD20: 6,
        rollTotal: 6,
        skillContestCalculation: {
          baseSkill: 22,
          calculationId: "adjust-distance:resister",
          completeness: "complete",
          contestType: "adjust_distance_attack",
          derivedIntegerAdjustment: 2,
          finalResult: 30,
          governingStat: { id: "dex", label: "Dexterity", value: 16 },
          missingContributionPoints: [],
          movementBurden: {
            schemaVersion: 1,
            participantId: "resister",
            sourceSnapshotId: "snapshot-before-equipment-change",
            carriedItems: [
              { effectiveEncumbrance: 20, itemId: "old-load", templateId: "old-template" },
            ],
            totalEffectiveCarriedEncumbrance: 20,
            carryingCapacityInputs: { constitution: 10, size: 10, strength: 10 },
            carryingCapacity: 25,
            carriedPercentage: 80,
            encumbranceLevel: 3,
            shieldMovementContribution: 0,
            finalMovementModifier: 2,
            completeness: "complete",
            missingFacts: [],
            provenance: {
              carriedLoadSource: "scenario_equipment_snapshot",
              formula: "themistogenes_movement_modifier_v1",
              sourceRange: "Calculations!L39:S42",
              workbook: "Themistogenes 1.07.xlsx",
            },
          },
          openEndedDie: { openEndedD10s: [], rollD20: 6, rollTotal: 6 },
          opponentParticipantId: "initiator",
          participantId: "resister",
          percentageContributions: [
            {
              category: "general_fatigue",
              id: "fatigue",
              label: "Fatigue",
              unit: "percentage",
              value: -1,
            },
            {
              category: "relationship",
              id: "observation",
              label: "Observe Opponent · City guard",
              unit: "percentage",
              value: 1,
            },
            {
              category: "movement_mm",
              id: "movement-mm",
              label: "Movement Modifier",
              unit: "percentage",
              value: -2,
            },
            {
              category: "gm_adjustment",
              id: "gm-adjustment",
              label: "GM maneuver adjustment",
              unit: "percentage",
              value: 3,
            },
          ],
          preDieTotal: 24,
          role: "resisting_opponent",
          skill: { id: "dodge", label: "Dodge", totalXp: 6 },
          totalPercentageAdjustment: 1,
          visibility: "roller_and_gm",
        },
      }),
    )[0]!;

    expect(buildCombatCalculationPresentationLines(presentation)).toEqual([
      "Stat: Dexterity 16",
      "Dodge XP: 6",
      "Base skill: 22",
      "Modifiers",
      "Fatigue: -1%",
      "Observe Opponent · City guard: +1%",
      "Movement Modifier: -2%",
      "GM maneuver adjustment: +3%",
      "Total modifiers: +1%",
      "Derived adjustment: +2",
      "Skill total: 24",
      "Die roll: 6",
      "Result: 30",
    ]);
    expect(presentation.completeness).toBe("complete");
  });

  it("does not expose arbitrary legacy fields or outcome prose", () => {
    const presentation = buildCombatCalculationPresentations(
      event("attack", {
        internalParticipantId: "secret-id",
        margin: 17,
        skillId: "secret-skill",
        success: true,
        tableBand: "critical",
      }),
    );
    expect(presentation).toEqual([]);
    expect(JSON.stringify(presentation)).not.toMatch(/secret|margin|success|tableBand/i);
  });
});
