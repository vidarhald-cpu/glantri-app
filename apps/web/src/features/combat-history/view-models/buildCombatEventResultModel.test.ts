import { describe, expect, it } from "vitest";

import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

import { buildCombatEventResultModel } from "./buildCombatEventResultModel";

function event(
  type: ProjectedCombatHistoryEvent["type"],
  sequence: number,
  overrides: Partial<ProjectedCombatHistoryEvent> = {},
): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts: { publicOutcome: {} },
    id: `${sequence}:${type}`,
    identities: [],
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    sequence,
    status: "recorded",
    step: "phase_1_actions",
    type,
    ...overrides,
  };
}

describe("buildCombatEventResultModel", () => {
  it("orders attack, parry, location, critical, and damage without collapsing the chain", () => {
    const model = buildCombatEventResultModel([
      event("damage_committed", 5),
      event("parry", 2, {
        facts: {
          involvedOutcome: { resultLabel: "Parry failed", status: "resolved", success: false },
          privateCalculation: { rollD20: 8, total: 17 },
          publicOutcome: { status: "resolved", success: false },
        },
        identities: [
          {
            displayName: "Scyrian cavalry guy",
            participantId: "attacker",
            role: "attacker",
            visibility: "visible",
          },
          {
            displayName: "The Gladiator",
            participantId: "defender",
            role: "defender",
            visibility: "visible",
          },
        ],
      }),
      event("attack", 1, {
        facts: {
          involvedOutcome: { tableResult: "Grazing hit", weaponName: "Long sword" },
          privateCalculation: { defenderDb: 15, lookupTotal: 13, ob: 10, rollTotal: 18 },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "Scyrian cavalry guy",
            participantId: "attacker",
            role: "attacker",
            visibility: "visible",
          },
          {
            displayName: "The Gladiator",
            participantId: "defender",
            role: "defender",
            visibility: "visible",
          },
        ],
      }),
      event("critical", 4, {
        facts: { involvedOutcome: { criticalGrade: "e" }, publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "defender",
            role: "defender",
            visibility: "visible",
          },
        ],
      }),
      event("hit_location", 3, {
        facts: { involvedOutcome: { selectedHitLocation: "abdomen" }, publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "defender",
            role: "defender",
            visibility: "visible",
          },
        ],
      }),
    ]);

    expect(model.items.map((item) => item.type)).toEqual([
      "attack",
      "parry",
      "hit_location",
      "critical",
      "damage_committed",
    ]);
    expect(model.items[0]?.summary).toBe(
      "Scyrian cavalry guy attacked The Gladiator with a Long sword.",
    );
    expect(model.items[1]?.summary).toBe("The Gladiator attempted to parry Scyrian cavalry guy.");
    expect(model.items[1]?.outcomeRows.map((row) => row.text)).toEqual(["Result: Parry failed"]);
    expect(model.items[2]?.summary).toBe("The Gladiator was hit in the abdomen.");
    expect(model.items[3]?.summary).toBe("Critical E against The Gladiator.");
    expect(model.items[0]?.outcomeRows.map((row) => row.text)).toEqual(["Result: Grazing hit"]);
    expect(model.items[0]?.calculationRows.map((row) => row.text)).toEqual([
      "OB 10 + roll 18 - DB 15 = 13",
    ]);
    expect(model.items[1]?.calculationRows.map((row) => row.text)).toContain("Roll D20: 8");
  });

  it("orders distance rolls before result and applied distance", () => {
    const model = buildCombatEventResultModel([
      event("distance_control_applied", 4),
      event("distance_control_roll", 1),
      event("distance_control_result", 3),
      event("distance_control_roll", 2),
    ]);

    expect(model.items.map((item) => item.type)).toEqual([
      "distance_control_roll",
      "distance_control_roll",
      "distance_control_result",
      "distance_control_applied",
    ]);
  });

  it("uses the concise Dodge calculation structure for an in-round distance roll", () => {
    const model = buildCombatEventResultModel([
      event("adjust_distance_roll", 1, {
        facts: {
          involvedOutcome: { side: "attacker" },
          privateCalculation: {
            dodgeSkillTotal: 16,
            finalTotal: 21,
            generalFatigueModifier: 0,
            openEndedD10s: [],
            rollD20: 3,
            rollTotal: 3,
            situationalAdjustment: 2,
          },
          publicOutcome: {},
        },
      }),
    ]);
    expect(model.items[0]?.calculationRows.map((row) => row.text)).toEqual([
      "Skill: Dodge 16",
      "Modifier: +2",
      "Die roll: 3",
      "Result: 21",
      "Outcome: Roll recorded",
      "Maneuver adjustment: +2",
    ]);
  });

  it("uses the concise skill calculation for Offensive Parry Brawling", () => {
    const model = buildCombatEventResultModel([
      event("offensive_parry_brawling", 1, {
        facts: {
          involvedOutcome: { resolved: false },
          privateCalculation: {
            brawlingBaseValue: 15,
            brawlingSkillId: "brawling",
            brawlingSkillXp: 928,
            characteristicAverage: 12,
            finalTotal: 27,
            generalModifier: 0,
            parryQualityModifier: 1,
            rollD20: 11,
            rollTotal: 11,
            skillModifier: 0,
          },
          publicOutcome: { resolved: false },
        },
      }),
    ]);

    expect(model.items[0]?.calculationRows.map((row) => row.text)).toEqual([
      "Brawling",
      "Skill: 15",
      "Modifiers: +1",
      "- Parry quality: +1",
      "Effective skill: 16",
      "Die roll: 11",
      "Total: 27",
    ]);
    expect(JSON.stringify(model)).not.toContain("Brawling Skill Xp");
    expect(JSON.stringify(model)).not.toContain("Characteristic Average");
  });

  it("shows the final combined modifier and the maneuver adjustment separately", () => {
    const model = buildCombatEventResultModel([
      event("adjust_distance_roll", 1, {
        facts: {
          involvedOutcome: { side: "attacker" },
          privateCalculation: {
            dodgeSkillTotal: 16,
            finalTotal: 23,
            generalFatigueModifier: -1,
            openEndedD10s: [],
            rollD20: 6,
            rollTotal: 6,
            situationalAdjustment: 2,
          },
          publicOutcome: {},
        },
      }),
    ]);

    expect(model.items[0]?.calculationRows.map((row) => row.text)).toContain("Modifier: +1");
    expect(model.items[0]?.calculationRows.map((row) => row.text)).toContain(
      "Maneuver adjustment: +2",
    );
  });

  it("labels incomplete and legacy-derived events", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, { completeness: "incomplete" }),
      event("parry", 2, { completeness: "legacy_derived" }),
    ]);

    expect(model.items.map((item) => item.completenessLabel)).toEqual([
      "Incomplete history",
      "Legacy-derived history",
    ]);
  });

  it("projects attack semantics once while retaining stable contextual row keys", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, {
        facts: {
          involvedOutcome: { hit: false },
          privateCalculation: { hit: false },
          publicOutcome: { hit: false },
        },
      }),
      event("parry", 2, { facts: { publicOutcome: { hit: false } } }),
    ]);
    const rows = model.items.flatMap((item) => [...item.outcomeRows, ...item.calculationRows]);

    expect(rows.map((row) => row.text)).toEqual(["Result: Miss"]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(model.items.map((item) => item.type)).toEqual(["attack", "parry"]);
  });

  it("whitelists concise parry and damage outcomes instead of flattening internal facts", () => {
    const model = buildCombatEventResultModel([
      event("parry", 1, {
        facts: {
          involvedOutcome: {
            damageRollRequired: false,
            resultLabel: "Parry failed",
            status: "resolved",
            success: false,
          },
          publicOutcome: { status: "resolved", success: false },
        },
      }),
      event("damage_proposed", 2, {
        facts: {
          involvedOutcome: { criticalGrade: "e", selectedHitLocation: "abdomen", totalDamage: 11 },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "target",
            role: "defender",
            visibility: "visible",
          },
        ],
      }),
      event("damage_committed", 3, {
        facts: {
          involvedOutcome: { criticalGrade: "e", finalCommittedDamage: 11, hitLocation: "abdomen" },
          publicOutcome: { status: "committed" },
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "target",
            role: "defender",
            visibility: "visible",
          },
        ],
      }),
    ]);
    const displayedText = model.items.flatMap((item) => [
      item.summary,
      ...item.outcomeRows.map((row) => row.text),
    ]);

    expect(displayedText).toEqual([
      "Defender attempted to parry.",
      "Result: Parry failed",
      "Proposed damage to The Gladiator: 11 · Critical E.",
      "The Gladiator received 11 damage to the abdomen.",
      "Critical E committed.",
    ]);
    expect(displayedText.join(" ")).not.toMatch(/Status:|Success:|Required: No|damageRollRequired/);
  });

  it("presents the feint ruling, contest, and committed modifiers chronologically", () => {
    const identities = [
      {
        displayName: "The Gladiator",
        participantId: "attacker",
        role: "actor" as const,
        visibility: "visible" as const,
      },
      {
        displayName: "Scyrian",
        participantId: "defender",
        role: "target" as const,
        visibility: "visible" as const,
      },
    ];
    const model = buildCombatEventResultModel([
      event("feint_committed", 3, {
        facts: {
          involvedOutcome: {
            attackerPhase1DbParryModifier: 0,
            defenderPhase2DbParryModifier: -2,
            defenderPhase2SkillObModifier: -2,
          },
          publicOutcome: {},
        },
        identities,
      }),
      event("feint_feasibility", 1, {
        facts: {
          involvedOutcome: { feasibility: "possible", method: "weapon" },
          publicOutcome: {},
        },
        identities,
      }),
      event("feint_result", 2, {
        facts: { involvedOutcome: { difference: 7 }, publicOutcome: {} },
        identities,
      }),
    ]);

    expect(model.items.map((item) => item.type)).toEqual([
      "feint_feasibility",
      "feint_result",
      "feint_committed",
    ]);
    expect(model.items[0]?.summary).toBe("The Gladiator attempted a weapon feint against Scyrian.");
    expect(model.items[1]?.outcomeRows[0]?.text).toBe("The Gladiator won the feint contest by 7.");
    expect(model.items[2]?.outcomeRows.map((row) => row.text)).toContain(
      "Scyrian receives Skill/OB -2 and DB/Parry -2 in Phase 2.",
    );
  });
});
