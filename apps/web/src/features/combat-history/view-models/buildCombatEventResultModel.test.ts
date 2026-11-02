import { describe, expect, it } from "vitest";

import type { CombatResultEnvelope, ProjectedCombatHistoryEvent } from "@glantri/domain";

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

function resultEnvelope(): CombatResultEnvelope {
  return {
    actionType: "feint_committed",
    affectedParticipants: [],
    calculationReferences: [],
    committedConsequences: [{ key: "defenderPhase2SkillObModifier", label: "Skill/OB", value: -2 }],
    conciseOutcome: { details: ["Won by 7"], label: "Feint committed" },
    participants: [],
    privateDiagnostics: [],
    provenance: {
      completeness: "complete",
      occurredAt: null,
      sourceIds: [],
      sourceKind: "canonical",
    },
    publicCombatNote: "The defender commits to the false opening.",
    resultId: "feint-result",
    round: 1,
    schemaVersion: 1,
    sequence: 1,
    standardConsequences: [{ key: "defenderPhase2SkillObModifier", label: "Skill/OB", value: -2 }],
    step: "phase_1_actions",
    subordinateEventReferences: [],
    targets: [],
    visibility: {
      calculationAccess: "none",
      outcomeScope: "involved",
      privateDiagnosticsIncluded: false,
    },
  };
}

describe("buildCombatEventResultModel", () => {
  it("presents private readiness counts explicitly without inventing them for the target", () => {
    const actor = buildCombatEventResultModel([
      event("missile_readiness", 1, {
        facts: {
          involvedOutcome: { status: "preparing" },
          privateCalculation: {
            aimCompletedRounds: 1,
            aimRequiredRounds: 4,
            baseCompletedRounds: 2,
            baseRequiredRounds: 3,
          },
          publicOutcome: { status: "preparing" },
        },
      }),
    ]);
    expect(actor.items[0]?.outcomeRows.map((row) => row.text)).toEqual([
      "Status: preparing",
      "Preparation: 2/3",
      "Aim: 1/4",
    ]);

    const target = buildCombatEventResultModel([
      event("missile_readiness", 1, {
        facts: {
          involvedOutcome: { status: "preparing" },
          publicOutcome: { status: "preparing" },
        },
      }),
    ]);
    expect(target.items[0]?.outcomeRows.map((row) => row.text)).toEqual(["Status: preparing"]);
  });

  /**
   * Forgejo issue #771 R2-5. This case previously asserted a third row,
   * `"Source: Weapon2 row 17 · A17:K17"`. The Product Owner ruled workbook/source-row
   * provenance off the ordinary Combat surface, so the assertion is narrowed to the two rows
   * that remain and the source row is now asserted absent rather than present. The event still
   * carries `weaponModeSourceMetadata`; nothing reads it for presentation.
   */
  it("presents a pending missile shot with Range and no source provenance", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, {
        facts: {
          involvedOutcome: {
            status: "awaiting_defense",
            weaponModeRange: "70/210/420",
            weaponModeSourceMetadata: {
              row: 17,
              sheet: "Weapon2",
              sourceRange: "A17:K17",
            },
            weaponName: "Longbow",
          },
          publicOutcome: { status: "shot_committed" },
        },
        identities: [
          {
            displayName: "Aria",
            participantId: "aria",
            role: "attacker",
            visibility: "visible",
          },
          {
            displayName: "Borin",
            participantId: "borin",
            role: "defender",
            visibility: "visible",
          },
        ],
        status: "proposed",
      }),
    ]);
    expect(model.items[0]?.summary).toBe(
      "Aria fired at Borin with a Longbow; defense review is pending.",
    );
    expect(model.items[0]?.outcomeRows.map((row) => row.text)).toEqual([
      "Shot committed · awaiting defense review",
      "Range: 70/210/420",
    ]);
    expect(model.items[0]?.outcomeRows.map((row) => row.text).join("\n")).not.toContain("Source:");
    expect(model.items[0]?.outcomeRows.map((row) => row.text).join("\n")).not.toContain("A17:K17");
  });

  it("excludes workflow boundary provenance from participant combat results", () => {
    const boundary = event("round_boundary", 1, {
      completeness: "legacy_derived",
      resultEnvelope: {
        ...resultEnvelope(),
        actionType: "round_boundary",
        conciseOutcome: {
          details: ["Combat boundary advanced"],
          label: "Round boundary",
        },
      },
      step: "round_summary",
    });
    const attack = event("attack", 2);

    const model = buildCombatEventResultModel([boundary, attack]);

    expect(model.items.map((item) => item.type)).toEqual(["attack"]);
    expect(
      model.groups?.flatMap((group) => group.subordinateResults).map((result) => result.heading),
    ).toEqual(["Attack"]);
    expect(boundary.completeness).toBe("legacy_derived");
    expect(boundary.resultEnvelope?.conciseOutcome.details).toEqual(["Combat boundary advanced"]);
  });

  it("excludes current and legacy deterministic empty participant closures from archived Results", () => {
    const closure = event("participant_su_review", 1, {
      facts: { publicOutcome: { changed: false, workflowOnly: true } },
      status: "committed",
      step: "round_summary",
    });
    const legacyClosure = event("participant_su_review", 2, {
      facts: { publicOutcome: { changed: false } },
      status: "committed",
      step: "round_summary",
    });

    expect(buildCombatEventResultModel([closure, legacyClosure]).items).toEqual([]);
  });

  it("retains the canonical envelope for archived result presentation", () => {
    const envelope = resultEnvelope();
    const model = buildCombatEventResultModel([
      event("feint_committed", 1, { resultEnvelope: envelope }),
    ]);

    expect(model.items[0]?.envelope).toBe(envelope);
    expect(model.items[0]?.envelope?.publicCombatNote).toBe(
      "The defender commits to the false opening.",
    );
  });

  it("describes bulk-skipped initiative without claiming that a die was rolled", () => {
    const model = buildCombatEventResultModel([
      event("initiative", 1, {
        facts: {
          involvedOutcome: { resolutionType: "bulk_skipped", total: 0 },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "roller",
            visibility: "visible",
          },
        ],
        status: "skipped",
        step: "initiative_phase_1",
      }),
    ]);

    expect(model.items[0]).toMatchObject({
      outcomeRows: [{ text: "Effective initiative: 0" }],
      summary: "The Gladiator initiative was bulk skipped by GM.",
    });
    expect(model.items[0]?.summary).not.toContain("rolled");
  });

  it("presents declaration, review, and skip results with only accepted facts", () => {
    const model = buildCombatEventResultModel([
      event("declaration", 1, {
        facts: {
          involvedOutcome: {
            actionLabel: "Parry",
            movementLabel: "Hold position",
            secondaryActionLabel: "Observe Opponent",
            submittedBy: "gm",
          },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
          {
            displayName: "Scyrian cavalry guy",
            participantId: "scyrian",
            role: "target",
            visibility: "visible",
          },
        ],
        step: "select_actions",
      }),
      event("modifier_review", 2, {
        facts: {
          involvedOutcome: {
            acceptedModifiers: [],
            changed: true,
            changes: [
              {
                category: "DB/Parry",
                changeType: "changed",
                id: "parry",
                previousValue: -1,
                value: -2,
              },
            ],
          },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
        ],
        step: "review_action_modifiers",
      }),
      event("action_skipped", 3, {
        facts: { involvedOutcome: { reason: "GM skip" }, publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
        ],
        status: "skipped",
      }),
    ]);

    expect(model.items[0]).toMatchObject({
      outcomeRows: [
        { text: "Action: Parry" },
        { text: "Secondary action: Observe Opponent" },
        { text: "Movement: Hold position" },
        { text: "Target: Scyrian cavalry guy" },
        { text: "Declared by: GM" },
      ],
      /*
       * #862 V1 row 5. This assertion previously pinned `"The Gladiator declared an action."` with
       * the action and the target present in the very same `outcomeRows` above — it was the
       * repository's own pin on the defect, and the Product Owner's ruling (#854 comment 19297)
       * reverses it. The declared *movement* is deliberately still not named: #862 places the
       * movement label in a later lane, so it stays an `outcomeRows` entry only.
       */
      summary: "The Gladiator declared Parry against Scyrian cavalry guy.",
    });
    expect(model.items[1]?.outcomeRows).toEqual([
      expect.objectContaining({ text: "DB/Parry: -1 → -2" }),
    ]);
    expect(model.items[2]).toMatchObject({
      outcomeRows: [{ text: "Reason: GM skip" }],
      summary: "The Gladiator was skipped.",
    });
    expect(JSON.stringify(model.items[0])).not.toContain("Attack mode");
  });

  it("presents an accepted no-change modifier review explicitly", () => {
    const model = buildCombatEventResultModel([
      event("modifier_review", 1, {
        facts: {
          involvedOutcome: { acceptedModifiers: [], changed: false, changes: [] },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
        ],
        step: "review_action_modifiers",
      }),
    ]);

    expect(model.items[0]).toMatchObject({
      outcomeRows: [{ text: "No changes" }],
      summary: "The Gladiator completed modifier review.",
    });
  });

  it("renders canonical modifier-review units and duration changes without internal ids", () => {
    const model = buildCombatEventResultModel([
      event("modifier_review", 1, {
        facts: {
          involvedOutcome: {
            changed: true,
            changes: [
              {
                category: "General/Fatigue",
                changeType: "edited",
                duration: "1 round",
                label: "Combat Experience",
                previousDuration: "2 rounds",
                previousValue: -2,
                unit: "percentage",
                value: -1,
              },
              {
                category: "Condition",
                changeType: "removed",
                label: "Stunned",
              },
            ],
          },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
        ],
        step: "review_action_modifiers",
      }),
    ]);

    expect(model.items[0]?.outcomeRows).toEqual([
      expect.objectContaining({
        text: "Combat Experience (General/Fatigue): -2% → -1% · 2 rounds → 1 round",
      }),
      expect.objectContaining({ text: "Stunned (Condition): removed" }),
    ]);
    expect(JSON.stringify(model.items[0])).not.toContain("effectId");
  });

  it("identifies an SU review by its canonical actor rather than an unrelated attacker", () => {
    const model = buildCombatEventResultModel([
      event("participant_su_review", 1, {
        identities: [
          {
            displayName: "Reviewed participant",
            participantId: "reviewed",
            role: "actor",
            visibility: "visible",
          },
          {
            displayName: "Earlier attacker",
            participantId: "attacker",
            role: "attacker",
            visibility: "visible",
          },
        ],
        step: "round_summary",
      }),
    ]);

    expect(model.items[0]?.summary).toBe("Reviewed participant completed SU review.");
  });

  it("orders attack, parry, location, critical, and damage fragments canonically", () => {
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
      "OB: 10",
      "Defender DB: 15",
      "Combat total: -5",
      "Die roll: 18",
      "Result: 13",
    ]);
    expect(model.items[1]?.calculationRows.map((row) => row.text)).toEqual([]);
  });

  it("groups archived Feint fragments by the canonical action instance", () => {
    const feintEnvelope = (type: CombatResultEnvelope["actionType"], sequence: number) => ({
      ...resultEnvelope(),
      actionInstanceId: "feint-1",
      actionType: type,
      publicCombatNote: type === "feint_committed" ? "Commit to the opening." : undefined,
      resultId: `feint:${sequence}`,
      sequence,
    });
    const model = buildCombatEventResultModel([
      event("feint_roll", 1, { resultEnvelope: feintEnvelope("feint_roll", 1) }),
      event("feint_result", 2, { resultEnvelope: feintEnvelope("feint_result", 2) }),
      event("feint_committed", 3, {
        resultEnvelope: feintEnvelope("feint_committed", 3),
      }),
    ]);

    expect(model.items).toHaveLength(3);
    expect(model.groups).toHaveLength(1);
    expect(model.groups?.[0]).toMatchObject({
      groupId: "combat-result-group:action:feint-1",
      heading: "Feint",
      publicCombatNotes: ["Commit to the opening."],
    });
    expect(model.groups?.[0]?.subordinateResults.map((result) => result.id)).toEqual([
      "1:feint_roll",
      "2:feint_result",
      "3:feint_committed",
    ]);
  });

  it("shows the opponent-specific Observe Opponent contribution in attack history", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, {
        facts: {
          involvedOutcome: { tableResult: "Miss", weaponName: "Long sword" },
          privateCalculation: {
            defenderDb: 16,
            lookupTotal: 15,
            ob: 13,
            obBeforeOpponentSpecificModifier: 10,
            opponentSpecificObModifierRows: [
              {
                label: "Observe Opponent · Scyrian cavalry guy",
                value: 3,
              },
            ],
            rollTotal: 18,
          },
          publicOutcome: {},
        },
      }),
    ]);

    expect(model.items[0]?.calculationRows.map((row) => row.text)).toEqual([
      "Base OB: 10",
      "Adjusted OB: 13",
      "Defender DB: 16",
      "Modifiers",
      "Observe Opponent · Scyrian cavalry guy: +3%",
      "Total modifiers: +3%",
      "Combat total: -3",
      "Die roll: 18",
      "Result: 15",
    ]);
  });

  it("presents one resolved observation contest with natural wording and named calculations", () => {
    const identities = [
      {
        displayName: "The Gladiator",
        participantId: "gladiator",
        role: "actor" as const,
        visibility: "visible" as const,
      },
      {
        displayName: "Scyrian cavalry guy",
        participantId: "scyrian",
        role: "target" as const,
        visibility: "visible" as const,
      },
    ];
    const resolved = event("observation", 2, {
      facts: {
        gmReview: {
          targetCalculation: {
            appliedModifiers: [],
            effectiveSkillValue: 17,
            finalTotal: 37,
            intelligenceValue: 12,
            intelligenceXp: 1,
            rollTotal: 13,
            skillLabel: "Dodge",
            skillXp: 5,
          },
        },
        involvedOutcome: {
          bestBonusAfter: 0,
          candidateBonus: 0,
          difference: -11,
          observationAttemptId: "attempt-1",
        },
        privateCalculation: {
          appliedModifiers: [],
          effectiveSkillValue: 22,
          finalTotal: 26,
          intelligenceValue: 14,
          intelligenceXp: 0,
          rollTotal: 4,
          skillLabel: "One-handed edged",
          skillXp: 8,
        },
        publicOutcome: {},
      },
      identities,
    });
    const placeholder = event("observation", 1, {
      facts: {
        involvedOutcome: {
          observationAttemptId: "attempt-1",
          observationStatus: "period_complete",
        },
        publicOutcome: {},
      },
      identities,
    });
    const proposedReview = event("participant_su_review", 3, {
      identities,
      status: "proposed",
    });

    const model = buildCombatEventResultModel([placeholder, resolved, proposedReview]);

    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.summary).toBe("Observe Opponent — Scyrian cavalry guy.");
    expect(model.items[0]?.outcomeRows.map((row) => row.text)).toEqual([
      "Lost by 11",
      "Result +0%",
      "Best +0%",
    ]);
    expect(model.items[0]?.calculationRows.map((row) => row.text)).toEqual([
      "Stat: Intelligence 14",
      "One-handed edged XP: 8",
      "Intelligence XP: 0",
      "Skill total: 22",
      "Die roll: 4",
      "Result: 26",
      "Stat: Intelligence 12",
      "Dodge XP: 5",
      "Intelligence XP: 1",
      "Skill total: 17",
      "Die roll: 13",
      "Result: 37",
    ]);
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

  it("presents a Continued Contact controller choice with its prior and chosen distance", () => {
    const model = buildCombatEventResultModel([
      event("distance_control_applied", 1, {
        facts: {
          involvedOutcome: {
            appliedDistance: 2,
            previousDistance: 4,
            reason: "continued_contact",
          },
          publicOutcome: {},
        },
        identities: [
          {
            displayName: "Scyrian cavalry guy",
            participantId: "controller",
            role: "actor",
            visibility: "visible",
          },
          {
            displayName: "The Gladiator",
            participantId: "affected",
            role: "target",
            visibility: "visible",
          },
        ],
      }),
    ]);

    expect(model.items[0]).toMatchObject({
      outcomeRows: [
        { text: "Applied distance: 2" },
        { text: "Previous distance: 4" },
        { text: "Reason: Continued Contact" },
      ],
      summary: "Scyrian cavalry guy chose the next-round engagement distance.",
    });
  });

  it("presents the final Continued Contact maintenance outcome without repeating its opening contest", () => {
    const model = buildCombatEventResultModel([
      event("continued_contact_maintenance", 1, {
        facts: {
          involvedOutcome: {
            contactMaintained: false,
            outcome: "escaped",
            resolved: true,
          },
          publicOutcome: {
            contactMaintained: false,
            outcome: "escaped",
            resolved: true,
          },
        },
        identities: [
          {
            displayName: "Scyrian cavalry guy",
            participantId: "controller",
            role: "actor",
            visibility: "visible",
          },
          {
            displayName: "The Gladiator",
            participantId: "affected",
            role: "target",
            visibility: "visible",
          },
        ],
        step: "round_summary",
      }),
    ]);

    expect(model.items).toHaveLength(1);
    expect(model.items[0]).toMatchObject({
      outcomeRows: [{ text: "Continued Contact broken." }],
      summary: "Unbalanced was removed. Ordinary distance control resumes.",
      title: "Continued Contact — Maintenance",
    });
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
      "Dodge base: 16",
      "Modifiers",
      "GM maneuver adjustment: +2%",
      "Total modifiers: +2%",
      "Skill total: 18",
      "Die roll: 3",
      "Result: 21",
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
      "Stat: Characteristic average 12",
      "Brawling XP: 928",
      "Base skill: 15",
      "Modifiers",
      "Parry quality: +1",
      "Total modifiers: +1",
      "Skill total: 16",
      "Die roll: 11",
      "Result: 27",
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

    expect(model.items[0]?.calculationRows.map((row) => row.text)).toContain(
      "Total modifiers: +1%",
    );
    expect(model.items[0]?.calculationRows.map((row) => row.text)).toContain(
      "GM maneuver adjustment: +2%",
    );
  });

  /**
   * Forgejo issue #771 R2-11. Narrowed, not deleted: the `"Incomplete history"` half still
   * holds and is still asserted. The `"Legacy-derived history"` expectation is replaced by its
   * negation, because the Product Owner ruled the reader must not be told which internal
   * projection reconstructed the record.
   */
  it("labels incomplete events and says nothing about legacy derivation", () => {
    const model = buildCombatEventResultModel([
      event("attack", 1, { completeness: "incomplete" }),
      event("parry", 2, { completeness: "legacy_derived" }),
      event("parry", 3, { completeness: "complete" }),
    ]);

    expect(model.items.map((item) => item.completenessLabel)).toEqual([
      "Incomplete history",
      undefined,
      undefined,
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

  /*
   * #862 V1 row 5. The summary names the committed action and target *from facts already in hand*.
   * The point of this block is that the wording cannot create a disclosure: it is driven only by
   * `factValue` (which reads `involvedOutcome` then `publicOutcome`, never `privateCalculation` or
   * `gmReview`) and by the already-projected `target` identity. So the cases below are shaped like
   * the payloads `projectCombatHistoryEvent` actually produces for each viewer, and the bystander
   * shape — no `involvedOutcome`, `target`/`defender` identities filtered out — must still get the
   * old sentence.
   */
  describe("#862 V1 — the declaration summary names what the viewer already has", () => {
    const declaration = (overrides: Partial<ProjectedCombatHistoryEvent>) =>
      buildCombatEventResultModel([
        event("declaration", 1, { step: "select_actions", ...overrides }),
      ]).items[0];

    it("names the action and the target when both are projected", () => {
      const item = declaration({
        facts: { involvedOutcome: { actionLabel: "Attack" }, publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
          {
            displayName: "Scyrian",
            participantId: "scyrian",
            role: "target",
            visibility: "visible",
          },
        ],
      });

      expect(item?.summary).toBe("The Gladiator declared Attack against Scyrian.");
    });

    it("names the action alone when no target identity is projected", () => {
      const item = declaration({
        facts: { involvedOutcome: { actionLabel: "Observe Opponent" }, publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
        ],
      });

      expect(item?.summary).toBe("The Gladiator declared Observe Opponent.");
    });

    it("keeps the previous wording for a bystander's projected declaration", () => {
      /*
       * Exactly the payload `projectCombatHistoryEvent` builds for a viewer who is neither the GM
       * nor involved: the `declaration` carve-out admits the event, `involvedOutcome` is dropped
       * because `involved` is false, and the `target`/`defender` identities are filtered out. No
       * action fact and no target identity, therefore no new sentence and nothing named that the
       * viewer did not already receive.
       */
      const item = declaration({
        facts: { publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
        ],
      });

      expect(item?.summary).toBe("The Gladiator declared an action.");
      expect(item?.outcomeRows).toEqual([]);
      expect(JSON.stringify(item)).not.toContain("Scyrian");
    });

    it("names a target it was given even with no action fact", () => {
      const item = declaration({
        facts: { publicOutcome: {} },
        identities: [
          {
            displayName: "The Gladiator",
            participantId: "gladiator",
            role: "actor",
            visibility: "visible",
          },
          {
            displayName: "Scyrian",
            participantId: "scyrian",
            role: "target",
            visibility: "visible",
          },
        ],
      });

      expect(item?.summary).toBe("The Gladiator declared an action against Scyrian.");
    });

    it("falls back to Participant when no identity is projected at all", () => {
      expect(declaration({ facts: { publicOutcome: {} } })?.summary).toBe(
        "Participant declared an action.",
      );
    });
  });
});
