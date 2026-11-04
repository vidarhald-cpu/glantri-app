import { describe, expect, it } from "vitest";

import {
  applyCombatActionGeneratedModifiers,
  buildCombatRoundDeclaredAttackOpportunities,
  combatRoundStateSchema,
  getCombatRoundCommittedModifierReviewPhases,
  isAttackPhaseDefensivePenaltyModifier,
  resolveCombatAttackPhaseDefensivePenalties,
  scenarioParticipantCombatContextSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
} from "../index";

/**
 * #901 option B (ruling, issue comment 20229): once the GM commits the modifier review for a phase,
 * the engine stops rebuilding that phase's generated attack-phase rows. Generation belongs to
 * declaration.
 *
 * The route-driven proof lives in `apps/api/src/routes/scenarios.test.ts` under
 * `#915 a GM modifier review decision is accepted, and it sticks`, which commits a real review and
 * then runs a real regeneration pass. These tests pin the two halves that walk cannot reach: the
 * phase-2 side of the gate, and the round bound the signal carries.
 */
describe("the modifier-review generation gate (#901 option B)", () => {
  const ENCOUNTER_ID = "encounter-901";
  const ROUND = 7;

  function declaredDoubleAttack() {
    const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "double_attack",
      participantId: "encounter-alpha",
      roundNumber: ROUND,
    });
    const attackPhaseDefensivePenalties = resolveCombatAttackPhaseDefensivePenalties({
      commitment: "committed",
      opportunities: attackOpportunities,
      participantId: "encounter-alpha",
      roundNumber: ROUND,
    });
    // The exact lifecycle context `POST /combat-declaration` supplies.
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      lifecycleContext: {
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: "2026-01-01T00:00:00.000Z",
        createdSequence: 0,
        encounterId: ENCOUNTER_ID,
        ownerParticipantId: "scenario-alpha",
        visibility: { audience: "involved", sourceIdentity: "public" },
      },
      sourceEncounterId: ENCOUNTER_ID,
      sourceRoundNumber: ROUND,
    });
    return { attackPhaseDefensivePenalties, combatContext };
  }

  function penaltyRowsByPhase(combatContext: ScenarioParticipantCombatContext) {
    const rows = combatContext.modifierBuckets.situationDb.filter((entry) =>
      isAttackPhaseDefensivePenaltyModifier(entry),
    );
    return Object.fromEntries(
      rows.map((row) => [
        row.sourcePhase,
        {
          payload: (row.canonicalLifecycle as { payload?: { value?: number } } | undefined)?.payload
            ?.value,
          value: row.value,
        },
      ]),
    );
  }

  /** The GM's accepted edit, written on the row and on its attached canonical payload. */
  function reviewed(entry: ScenarioCombatModifierEntry, nextValue: number) {
    const lifecycle = entry.canonicalLifecycle as
      | { payload: { kind: string; value: number } }
      | undefined;
    if (!lifecycle || lifecycle.payload.kind !== "numeric") {
      throw new Error("the generated row carries no numeric canonical payload");
    }
    return {
      ...entry,
      canonicalLifecycle: { ...lifecycle, payload: { ...lifecycle.payload, value: nextValue } },
      value: nextValue,
    };
  }

  it("stops rebuilding only the reviewed phase, and regenerates the other phase in the same pass", () => {
    const declared = declaredDoubleAttack();
    expect(penaltyRowsByPhase(declared.combatContext)).toEqual({
      phase1: { payload: -4, value: -4 },
      phase2: { payload: -4, value: -4 },
    });

    // The GM commits the phase-1 review: -1 on the phase-1 row, phase 2 untouched. -1 is a figure
    // the generator cannot produce — the penalty is bounded -4..0 and both rule reductions give -2.
    const afterReview = scenarioParticipantCombatContextSchema.parse({
      ...declared.combatContext,
      modifierBuckets: {
        ...declared.combatContext.modifierBuckets,
        situationDb: declared.combatContext.modifierBuckets.situationDb.map((entry) =>
          isAttackPhaseDefensivePenaltyModifier(entry) && entry.sourcePhase === "phase1"
            ? reviewed(entry, -1)
            : entry,
        ),
      },
    });

    const regenerated = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties: declared.attackPhaseDefensivePenalties,
      combatContext: afterReview,
      committedModifierReviewPhases: ["phase1"],
      sourceEncounterId: ENCOUNTER_ID,
      sourceRoundNumber: ROUND,
    });

    // Phase 1 is the GM's and is left alone. Phase 2 has had no review committed, so the pass
    // rebuilds it exactly as before.
    expect(penaltyRowsByPhase(regenerated)).toEqual({
      phase1: { payload: -1, value: -1 },
      phase2: { payload: undefined, value: -4 },
    });
  });

  it("does not re-create a row the GM removed in the reviewed phase", () => {
    const declared = declaredDoubleAttack();
    const afterRemoval = scenarioParticipantCombatContextSchema.parse({
      ...declared.combatContext,
      modifierBuckets: {
        ...declared.combatContext.modifierBuckets,
        situationDb: declared.combatContext.modifierBuckets.situationDb.filter(
          (entry) =>
            !(isAttackPhaseDefensivePenaltyModifier(entry) && entry.sourcePhase === "phase1"),
        ),
      },
    });

    const regenerated = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties: declared.attackPhaseDefensivePenalties,
      combatContext: afterRemoval,
      committedModifierReviewPhases: ["phase1"],
      sourceEncounterId: ENCOUNTER_ID,
      sourceRoundNumber: ROUND,
    });

    expect(penaltyRowsByPhase(regenerated)).toEqual({ phase2: { payload: undefined, value: -4 } });
  });

  it("reads the review commands of the current round only, and only this participant's", () => {
    const command = (input: {
      id: string;
      participantId: string;
      roundNumber: number;
      type: "review_modifiers_phase1" | "review_modifiers_phase2" | "declare_action";
    }) => ({
      afterCursor: { roundNumber: input.roundNumber, step: "M1" },
      beforeCursor: { roundNumber: input.roundNumber, step: "M1" },
      createdAt: "2026-01-01T00:00:00.000Z",
      facts: {},
      id: input.id,
      participantId: input.participantId,
      roundNumber: input.roundNumber,
      type: input.type,
    });
    const state = combatRoundStateSchema.parse({
      commands: [
        // A previous round's review must not suppress this round's generation: `commands` is
        // emptied at the round boundary, and the round filter holds even if one survives.
        command({
          id: "stale",
          participantId: "encounter-alpha",
          roundNumber: ROUND - 1,
          type: "review_modifiers_phase2",
        }),
        // Another participant's review is not this participant's.
        command({
          id: "other",
          participantId: "encounter-bravo",
          roundNumber: ROUND,
          type: "review_modifiers_phase2",
        }),
        // A declaration is not a review.
        command({
          id: "declaration",
          participantId: "encounter-alpha",
          roundNumber: ROUND,
          type: "declare_action",
        }),
        command({
          id: "current",
          participantId: "encounter-alpha",
          roundNumber: ROUND,
          type: "review_modifiers_phase1",
        }),
      ],
      participants: [
        {
          label: "Alpha",
          participantId: "encounter-alpha",
          scenarioParticipantId: "scenario-alpha",
        },
        {
          label: "Bravo",
          participantId: "encounter-bravo",
          scenarioParticipantId: "scenario-bravo",
        },
      ],
      roundNumber: ROUND,
    });

    expect(
      getCombatRoundCommittedModifierReviewPhases({
        participantId: "encounter-alpha",
        state,
      }),
    ).toEqual(["phase1"]);
    expect(
      getCombatRoundCommittedModifierReviewPhases({
        participantId: "encounter-bravo",
        state,
      }),
    ).toEqual(["phase2"]);
    // The scenario-participant alias resolves to the same round participant.
    expect(
      getCombatRoundCommittedModifierReviewPhases({
        participantId: "scenario-alpha",
        state,
      }),
    ).toEqual(["phase1"]);
    expect(
      getCombatRoundCommittedModifierReviewPhases({
        participantId: "encounter-charlie",
        state,
      }),
    ).toEqual([]);
  });
});
