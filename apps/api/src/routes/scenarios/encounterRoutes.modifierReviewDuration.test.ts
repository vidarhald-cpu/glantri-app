import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildCanonicalCombatModifierReviewFromDraft,
  evaluateCanonicalCombatModifierDurationAtRoundEnd,
  scenarioParticipantCombatContextSchema,
  scenarioParticipantStateSchema,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "encounterRoutes.ts"), "utf8");

describe("modifier-review duration production is owned by the domain", () => {
  it("commits GM modifier review through the shared domain producer", () => {
    expect(source).toContain("buildCanonicalCombatModifierReviewFromDraft({");
    expect(source).toContain("projectCanonicalCombatModifierReviewInput({");
  });

  it("keeps no route-local copy of the modifier-review duration producer", () => {
    expect(source).not.toContain("creationRoundCounts");
    expect(source).not.toContain("function modifierReviewDuration");
    expect(source).not.toContain("function buildManualModifierReviewEffect");
    expect(source).not.toContain("function buildCanonicalModifierReviewFromDraft");
  });

  it("gives a GM-entered round duration the remainder of its creation round plus full rounds", () => {
    const creationRound = 7;
    const context = (rows: unknown[]) =>
      scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          general: rows,
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      });
    const transaction = buildCanonicalCombatModifierReviewFromDraft({
      canonicalCutoff: 5,
      commandId: "command-459",
      createdAt: "2026-09-30T00:00:00.000Z",
      currentContext: context([]),
      draftContext: context([
        { durationRounds: 2, id: "row-new", notes: "GM penalty", scope: "until", value: -10 },
      ]),
      encounterId: "encounter-459",
      participantState: scenarioParticipantStateSchema.parse({
        combat: {},
        equipment: {},
        health: {},
        resources: {},
      }),
      phase: "M1",
      revision: "2026-09-30T00:00:00.000Z",
      roundNumber: creationRound,
      scenarioParticipantId: "participant-459",
    });

    const effect = transaction.outputEffects.find((candidate) => candidate.id === "row-new");
    expect(effect?.lifecycle.duration).toMatchObject({
      creationRoundCounts: false,
      kind: "rounds",
      remaining: 2,
    });
    if (!effect) throw new Error("Expected the committed GM modifier effect.");
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration: effect.lifecycle.duration,
        roundNumber: creationRound,
      }),
    ).toEqual({ kind: "hold", reason: "creation_round_excluded" });
  });
});
