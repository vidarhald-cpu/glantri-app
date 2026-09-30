import { describe, expect, it } from "vitest";

import {
  scenarioParticipantCombatContextSchema,
  scenarioParticipantStateSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../campaign/scenario";
import {
  evaluateCanonicalCombatModifierDurationAtRoundEnd,
  type CanonicalCombatModifierDuration,
} from "./combatModifierLifecycle";
import {
  buildCanonicalCombatModifierReviewFromDraft,
  projectCanonicalCombatModifierReviewInput,
} from "./combatModifierReviewProjection";
import { buildCombatExperiencePersistentLifecycle } from "./combatPersistentModifierLifecycle";

const CREATION_ROUND = 7;
const ENCOUNTER_ID = "encounter-459";
const PARTICIPANT_ID = "participant-459";
const REVISION = "2026-09-30T00:00:00.000Z";

function context(rows: ScenarioCombatModifierEntry[]): ScenarioParticipantCombatContext {
  return scenarioParticipantCombatContextSchema.parse({
    modifierBuckets: {
      general: rows,
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
  });
}

function projectionInput(input: {
  currentRows: ScenarioCombatModifierEntry[];
  draftRows: ScenarioCombatModifierEntry[];
}) {
  return {
    canonicalCutoff: 5,
    commandId: "command-459",
    createdAt: REVISION,
    currentContext: context(input.currentRows),
    draftContext: context(input.draftRows),
    encounterId: ENCOUNTER_ID,
    participantState: scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    }),
    phase: "M1" as const,
    revision: REVISION,
    roundNumber: CREATION_ROUND,
    scenarioParticipantId: PARTICIPANT_ID,
  };
}

/**
 * Drives a duration through the one shared transition engine, Round End by Round End, and reports
 * the round at whose Round End it finally expires. This is the observable lifetime a GM sees, so a
 * producer that silently starts counting its own creation round again cannot pass by asserting a
 * flag that is never exercised.
 */
function expiresAtRoundEnd(duration: CanonicalCombatModifierDuration): number {
  let current = duration;
  for (let round = CREATION_ROUND; round < CREATION_ROUND + 25; round += 1) {
    const outcome = evaluateCanonicalCombatModifierDurationAtRoundEnd({
      duration: current,
      roundNumber: round,
    });
    if (outcome.kind === "expire") return round;
    if (outcome.kind === "decrement") current = outcome.nextDuration;
    else if (outcome.kind !== "hold") {
      throw new Error(`Unexpected round-boundary outcome ${outcome.kind}.`);
    }
  }
  throw new Error("The duration never expired.");
}

function addedDuration(rows: {
  currentRows: ScenarioCombatModifierEntry[];
  draftRows: ScenarioCombatModifierEntry[];
}): CanonicalCombatModifierDuration {
  const review = projectCanonicalCombatModifierReviewInput(projectionInput(rows));
  const added = review.decisions.find((decision) => decision.kind === "add");
  if (added?.kind !== "add") throw new Error("Expected an add decision.");
  return added.effect.lifecycle.duration;
}

describe("canonical modifier-review duration production", () => {
  it("does not spend the creation round on a GM-entered round duration", () => {
    const duration = addedDuration({
      currentRows: [],
      draftRows: [
        { durationRounds: 2, id: "row-new", notes: "GM penalty", scope: "until", value: -10 },
      ],
    });

    expect(duration).toMatchObject({ creationRoundCounts: false, kind: "rounds", remaining: 2 });
    expect(
      evaluateCanonicalCombatModifierDurationAtRoundEnd({
        duration,
        roundNumber: CREATION_ROUND,
      }),
    ).toEqual({ kind: "hold", reason: "creation_round_excluded" });
    expect(expiresAtRoundEnd(duration)).toBe(CREATION_ROUND + 2);
  });

  it("gives a one-round GM entry a full subsequent round rather than expiring at creation", () => {
    const duration = addedDuration({
      currentRows: [],
      draftRows: [{ durationRounds: 1, id: "row-one", scope: "until", value: -5 }],
    });

    expect(expiresAtRoundEnd(duration)).toBe(CREATION_ROUND + 1);
  });

  it("matches the Combat Experience producer's lifetime for the same entered concept", () => {
    const combatExperience = buildCombatExperiencePersistentLifecycle({
      context: {
        commandId: "command-459",
        createdAt: REVISION,
        createdSequence: 5,
        encounterId: ENCOUNTER_ID,
        eventId: "event-459",
        ownerParticipantId: PARTICIPANT_ID,
        roundNumber: CREATION_ROUND,
      },
      durationRounds: 2,
      effectId: "effect-ce",
      modifierValue: -10,
      status: "active",
    });
    const gmEntered = addedDuration({
      currentRows: [],
      draftRows: [{ durationRounds: 2, id: "row-parity", scope: "until", value: -10 }],
    });

    expect(expiresAtRoundEnd(gmEntered)).toBe(
      expiresAtRoundEnd(combatExperience.lifecycle.duration),
    );
  });

  it("puts an edited duration on the same round clock as a newly entered one", () => {
    const original = buildCanonicalCombatModifierReviewFromDraft(
      projectionInput({
        currentRows: [],
        draftRows: [{ durationRounds: 2, id: "row-edit", scope: "until", value: -10 }],
      }),
    );
    const canonicalLifecycle = original.outputEffects.find((effect) => effect.id === "row-edit");
    expect(canonicalLifecycle).toBeDefined();
    const storedRow: ScenarioCombatModifierEntry = {
      canonicalLifecycle,
      durationRounds: 2,
      id: "row-edit",
      scope: "until",
      value: -10,
    };

    const review = projectCanonicalCombatModifierReviewInput(
      projectionInput({
        currentRows: [storedRow],
        draftRows: [{ ...storedRow, durationRounds: 3 }],
      }),
    );
    const edit = review.decisions.find((decision) => decision.kind === "edit");
    if (edit?.kind !== "edit") throw new Error("Expected an edit decision.");
    expect(edit.nextDuration).toMatchObject({ creationRoundCounts: false, remaining: 3 });
    if (!edit.nextDuration) throw new Error("Expected an edited duration.");
    expect(expiresAtRoundEnd(edit.nextDuration)).toBe(CREATION_ROUND + 3);
  });

  it("preserves the stored meaning of a legacy modifier-bucket row it merely reconstructs", () => {
    const legacyRow: ScenarioCombatModifierEntry = {
      application: "percentage",
      durationRounds: 2,
      id: "row-legacy",
      scope: "until",
      value: -10,
    };
    const review = projectCanonicalCombatModifierReviewInput(
      projectionInput({ currentRows: [legacyRow], draftRows: [legacyRow] }),
    );
    const reconstructed = review.inputEffects.find((effect) => effect.id === "row-legacy");
    expect(reconstructed?.lifecycle.duration).toMatchObject({
      creationRoundCounts: true,
      kind: "rounds",
      remaining: 2,
    });
  });
});
