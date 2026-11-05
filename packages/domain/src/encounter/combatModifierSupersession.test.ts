import { describe, expect, it } from "vitest";

import {
  applyCombatActionGeneratedModifiers,
  buildCanonicalCombatModifierReviewFromDraft,
  buildCombatProgressionProjection,
  buildCombatRoundAttackRollResult,
  buildCombatRoundDeclaredAttackOpportunities,
  canonicalCombatModifierEffectSchema,
  clearSupersededGmFigureMarks,
  combatContextHasSupersededGmFigure,
  combatRoundStateSchema,
  decideCombatRoundDoubleAttackPhase2,
  getCombatRoundCommittedModifierReviewPhases,
  recordCombatRoundParticipantStepReview,
  resolveCanonicalCombatAttackModifierFacts,
  resolveCombatAttackPhaseDefensivePenalties,
  SUPERSEDED_GM_FIGURE_NOTE_MARKER,
  scenarioParticipantCombatContextSchema,
  scenarioParticipantSchema,
  undoLatestCombatRoundCommand,
  type CombatRoundState,
  type ScenarioParticipantCombatContext,
} from "../index";
import { restateCanonicalModifierBucketRowValue } from "./combatModifierLifecycleCompatibility";

/**
 * #931 — a rule event that replaces a figure the GM has committed, while the review that committed
 * it is still open (Product Owner rulings on comments 20917, 21064 and 21255).
 *
 * The one such event is the Double Attack second-attack cancel, which fires inside the phase-2
 * modifier review. Every figure below is read in the three places they have been measured to
 * disagree: the stored row, the participant's combat context (which is what the route copies the
 * declaration's context onto), and the resolved defence number.
 *
 * The ruling on comment 21255 moved the GM-facing signal from the row's `notes` to the re-offered
 * task label, after a rendered reading measured the note clipped before the mark at every usable
 * width. These tests therefore assert `supersededGmFigure` is set and `notes` is left clean:
 * `notes` is on the player allowlist and `supersededGmFigure` is not, so the restriction the
 * ruling requires is carried by the projection rather than by a viewer check.
 */
describe("a Double Attack cancel supersedes the GM's committed phase-2 figure (#931)", () => {
  const ENCOUNTER_ID = "encounter-931";
  const ROUND = 1;
  const OWNER = "encounter-delta";
  const OWNER_SCENARIO = "scenario-delta";
  const AT = (second: number) => `2026-01-01T00:00:${String(second).padStart(2, "0")}.000Z`;

  function generatedContext() {
    const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "double_attack",
      participantId: OWNER,
      roundNumber: ROUND,
    });
    const attackPhaseDefensivePenalties = resolveCombatAttackPhaseDefensivePenalties({
      commitment: "committed",
      opportunities: attackOpportunities,
      participantId: OWNER,
      roundNumber: ROUND,
    });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      lifecycleContext: {
        createdAt: AT(0),
        createdRevision: AT(0),
        createdSequence: 0,
        encounterId: ENCOUNTER_ID,
        ownerParticipantId: OWNER_SCENARIO,
        visibility: { audience: "involved", sourceIdentity: "public" },
      },
      sourceEncounterId: ENCOUNTER_ID,
      sourceRoundNumber: ROUND,
    });
    return { attackOpportunities, attackPhaseDefensivePenalties, combatContext };
  }

  function participantWithContext(
    combatContext: ScenarioParticipantCombatContext,
    id = OWNER_SCENARIO,
  ) {
    return scenarioParticipantSchema.parse({
      createdAt: AT(0),
      id,
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-931",
      snapshot: { displayName: "Delta" },
      sourceType: "character",
      state: { combat: { combatContext }, equipment: {}, health: {}, resources: {} },
      updatedAt: AT(0),
    });
  }

  /** The round at the open phase-2 modifier review, Attack 1 resolved, nothing yet reviewed. */
  function openPhase2Review(): {
    base: ScenarioParticipantCombatContext;
    state: CombatRoundState;
  } {
    const { attackOpportunities, attackPhaseDefensivePenalties, combatContext } =
      generatedContext();
    const phase1 = attackOpportunities.find((opportunity) => opportunity.phase === "phase1")!;
    const state = combatRoundStateSchema.parse({
      currentStep: "review_phase_2_modifiers",
      participants: [
        {
          attackResultsByOpportunity: {
            [phase1.id]: {
              ...buildCombatRoundAttackRollResult({
                actionId: "double_attack",
                attackerParticipantId: OWNER,
                defenderDb: 10,
                defenderParticipantId: "encounter-bravo",
                ob: 10,
                phase: "phase1",
                rollD20: 11,
                rollTotal: 11,
                rolledAt: AT(1),
                weaponName: "Longsword",
              }),
              attackOpportunityId: phase1.id,
            },
          },
          declaration: {
            actionId: "double_attack",
            attackOpportunities,
            attackPhaseDefensivePenalties,
            combatContext,
            phaseContexts: { phase2: combatContext },
            roundNumber: ROUND,
            submittedBy: "player",
          },
          label: "Delta",
          participantId: OWNER,
          scenarioParticipantId: OWNER_SCENARIO,
        },
        {
          declaration: { actionId: "pass", roundNumber: ROUND, submittedBy: "player" },
          label: "Bravo",
          participantId: "encounter-bravo",
          scenarioParticipantId: "scenario-bravo",
        },
      ],
      roundNumber: ROUND,
    });
    return { base: combatContext, state };
  }

  function withPhaseRowValue(
    context: ScenarioParticipantCombatContext,
    phase: "phase1" | "phase2",
    value: number,
  ) {
    return scenarioParticipantCombatContextSchema.parse({
      ...context,
      modifierBuckets: {
        ...context.modifierBuckets,
        situationDb: context.modifierBuckets.situationDb.map((entry) =>
          entry.id.startsWith("generated:attack-phase-penalty:") && entry.sourcePhase === phase
            ? restateCanonicalModifierBucketRowValue({ entry, nextValue: value })
            : entry,
        ),
      },
    });
  }

  /**
   * The GM commits the phase-2 review with `committed` as the context, through the same domain
   * calls the review route makes: the declaration takes the submitted context and the step review
   * is recorded, which writes the `review_modifiers_phase2` command.
   */
  function gmCommitsPhase2Review(
    state: CombatRoundState,
    committed: ScenarioParticipantCombatContext,
    second = 2,
  ): CombatRoundState {
    const declaration = declarationOf(state);
    const reviewed = combatRoundStateSchema.parse({
      ...state,
      participants: state.participants.map((entry) =>
        entry.participantId === OWNER
          ? {
              ...entry,
              declaration: {
                ...declaration,
                combatContext: committed,
                phaseContexts: { ...declaration.phaseContexts, phase2: committed },
              },
            }
          : entry,
      ),
    });
    return recordCombatRoundParticipantStepReview({
      command: { createdAt: AT(second) },
      participantId: OWNER,
      state: reviewed,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
  }

  const cancel = (state: CombatRoundState) =>
    decideCombatRoundDoubleAttackPhase2({
      command: { createdAt: AT(10) },
      decision: "cancel",
      participantId: OWNER,
      state,
    });

  const declarationOf = (state: CombatRoundState) =>
    state.participants.find((entry) => entry.participantId === OWNER)!.declaration!;
  const phase2Rows = (context: ScenarioParticipantCombatContext | undefined) =>
    (context?.modifierBuckets.situationDb ?? []).filter((entry) => entry.sourcePhase === "phase2");
  const reviewStatus = (state: CombatRoundState) =>
    state.participants.find((entry) => entry.participantId === OWNER)!.stepStatuses
      .review_phase_2_modifiers;
  const modifierReviewTasks = (state: CombatRoundState) =>
    buildCombatProgressionProjection(state)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .filter(
        (task) =>
          task.kind === "modifier_review" &&
          task.identity.phase === "phase2" &&
          task.owner?.kind === "combatant" &&
          task.owner.participantId === OWNER,
      );

  /** The resolved phase-2 defence modifier total against the owner, from a stored context. */
  const resolvedPhase2Total = (state: CombatRoundState, stored: ScenarioParticipantCombatContext) =>
    resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-bravo",
      attackerScenarioParticipant: participantWithContext(
        scenarioParticipantCombatContextSchema.parse({}),
        "scenario-bravo",
      ),
      defenderCombatantId: OWNER,
      defenderScenarioParticipant: participantWithContext(stored),
      encounterId: ENCOUNTER_ID,
      phase: "phase2",
      state,
    }).defenderResolution.total;

  it("applies the rule's -2, keeps the GM's -1 with its text and number, and marks the row", () => {
    const { base, state } = openPhase2Review();
    const gmContext = withPhaseRowValue(base, "phase2", -1);
    const committed = gmCommitsPhase2Review(state, gmContext);
    // 1. Before the cancel, the GM's -1 is what resolution reads (the measurement's control).
    expect(resolvedPhase2Total(committed, gmContext)).toBe(-1);

    const decided = cancel(committed);
    const stored = scenarioParticipantCombatContextSchema.parse(
      declarationOf(decided).combatContext,
    );
    // The route copies this declaration context onto the participant (`nextDeclaration.combatContext`).
    const rows = phase2Rows(stored);

    // Stored row, resolved figure: the rule's number is in force.
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.value).toBe(-2);
      const canonical = canonicalCombatModifierEffectSchema.safeParse(row.canonicalLifecycle);
      if (canonical.success && canonical.data.payload.kind === "numeric") {
        expect(canonical.data.payload.value).toBe(-2);
      }
    }
    expect(resolvedPhase2Total(decided, stored)).toBe(-2);

    // Retained, as a row field with both halves, and never in the canonical payload.
    for (const row of rows) {
      expect(row.supersededGmFigure).toEqual({
        text: "committed weapon attack: DB/Parry -4% in phase2",
        value: -1,
      });
      expect(JSON.stringify(row.canonicalLifecycle ?? {})).not.toContain("supersededGmFigure");
      // #931 comment 21255: the fact lives only in `supersededGmFigure`, which no player receives.
      // `notes` is on the player allowlist, so nothing about the supersession is written there and
      // the row's text is exactly what the rule writer produced.
      expect(row.notes).not.toContain(SUPERSEDED_GM_FIGURE_NOTE_MARKER);
      expect(row.notes).not.toMatch(/supersed/i);
      expect(row.notes).not.toContain("review again");
    }
    // The phase-2 context the declaration carries agrees with the combat context.
    expect(
      phase2Rows(declarationOf(decided).phaseContexts?.phase2).map((row) => row.notes),
    ).toEqual(rows.map((row) => row.notes));
  });

  it("re-offers the committed modifier review while the boundary is open and keeps the gate closed", () => {
    const { base, state } = openPhase2Review();
    const committed = gmCommitsPhase2Review(state, withPhase2(base, -1));
    expect(reviewStatus(committed)).toBe("gmEdited");
    expect(modifierReviewTasks(committed)).toEqual([]);

    const decided = cancel(committed);

    expect(reviewStatus(decided)).toBe("pending");
    expect(modifierReviewTasks(decided)).toHaveLength(1);
    expect(modifierReviewTasks(decided)[0]!.owner).toMatchObject({ participantId: OWNER });
    // The review command is untouched, so the #915 generation gate stays closed.
    expect(
      decided.commands.filter((command) => command.type === "review_modifiers_phase2"),
    ).toHaveLength(1);
    expect(
      getCombatRoundCommittedModifierReviewPhases({ participantId: OWNER, state: decided }),
    ).toEqual(["phase2"]);
    expect(decided.currentStep).toBe("review_phase_2_modifiers");
    // The cursor points at the pending review, not past it.
    expect(decided.currentCursor?.participantId).toBe(OWNER);
  });

  function withPhase2(context: ScenarioParticipantCombatContext, value: number) {
    return withPhaseRowValue(context, "phase2", value);
  }

  it("the GM's re-commit of the identical value is accepted, sticks, and ends the mark", () => {
    const { base, state } = openPhase2Review();
    const gmContext = withPhase2(base, -1);
    const decided = cancel(gmCommitsPhase2Review(state, gmContext));
    const markedContext = scenarioParticipantCombatContextSchema.parse(
      declarationOf(decided).combatContext,
    );

    // The producer, run on what the route runs it on, sees one edit and outputs the GM's -1 again.
    const draft = withPhase2(markedContext, -1);
    const transaction = buildCanonicalCombatModifierReviewFromDraft({
      canonicalCutoff: 20,
      commandId: "command-recommit",
      createdAt: AT(11),
      currentContext: clearSupersededGmFigureMarks({
        combatContext: markedContext,
        phase: "phase2",
      }),
      draftContext: clearSupersededGmFigureMarks({ combatContext: draft, phase: "phase2" }),
      encounterId: ENCOUNTER_ID,
      participantState: participantWithContext(markedContext).state,
      phase: "M2",
      revision: AT(11),
      roundNumber: ROUND,
      scenarioParticipantId: OWNER_SCENARIO,
    });
    const phase2Output = transaction.outputEffects.filter(
      (effect) =>
        effect.applicability.phase === "phase2" && effect.sourceFamily === "attack_opportunity",
    );
    expect(phase2Output.length).toBeGreaterThan(0);
    for (const effect of phase2Output) {
      expect(effect.payload.kind === "numeric" ? effect.payload.value : undefined).toBe(-1);
    }

    // Commit it: the declaration takes the cleared draft and the review is recorded again.
    const clearedDraft = clearSupersededGmFigureMarks({ combatContext: draft, phase: "phase2" });
    const recommitted = gmCommitsPhase2Review(decided, clearedDraft, 12);
    const rows = phase2Rows(declarationOf(recommitted).combatContext);
    for (const row of rows) {
      expect(row.value).toBe(-1);
      expect(row.supersededGmFigure).toBeUndefined();
      expect(row.notes).not.toContain(SUPERSEDED_GM_FIGURE_NOTE_MARKER);
    }
    expect(resolvedPhase2Total(recommitted, clearedDraft)).toBe(-1);
    expect(reviewStatus(recommitted)).toBe("gmEdited");
    expect(modifierReviewTasks(recommitted)).toEqual([]);

    // Still -1 after a later unrelated generation pass: the gate reads the review command, which
    // is still present, so the pass keeps the GM's rows and contributes none.
    const { attackPhaseDefensivePenalties } = generatedContext();
    const afterUnrelatedPass = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties,
      combatContext: clearedDraft,
      committedModifierReviewPhases: getCombatRoundCommittedModifierReviewPhases({
        participantId: OWNER,
        state: recommitted,
      }),
    });
    expect(phase2Rows(afterUnrelatedPass).map((row) => row.value)).toEqual(
      phase2Rows(clearedDraft).map((row) => row.value),
    );
    expect(phase2Rows(afterUnrelatedPass).every((row) => row.value === -1)).toBe(true);
  });

  it("reports a marked review so step automation does not treat it as straightforward", () => {
    const { base, state } = openPhase2Review();
    const decided = cancel(gmCommitsPhase2Review(state, withPhase2(base, -1)));
    const marked = scenarioParticipantCombatContextSchema.parse(
      declarationOf(decided).combatContext,
    );

    expect(combatContextHasSupersededGmFigure(marked, "phase2")).toBe(true);
    // Another phase's review is not the marked one.
    expect(combatContextHasSupersededGmFigure(marked, "phase1")).toBe(false);
    // An unreviewed generated context, and one the GM has re-committed, carry no mark.
    expect(combatContextHasSupersededGmFigure(base, "phase2")).toBe(false);
    expect(
      combatContextHasSupersededGmFigure(
        clearSupersededGmFigureMarks({ combatContext: marked, phase: "phase2" }),
        "phase2",
      ),
    ).toBe(false);
  });

  it("clears the mark from the reviewed phase only, and by its note even if the field was dropped", () => {
    const { base, state } = openPhase2Review();
    const decided = cancel(gmCommitsPhase2Review(state, withPhase2(base, -1)));
    const marked = scenarioParticipantCombatContextSchema.parse(
      declarationOf(decided).combatContext,
    );
    const phase1Before = marked.modifierBuckets.situationDb.filter(
      (row) => row.sourcePhase === "phase1",
    );

    const wrongPhase = clearSupersededGmFigureMarks({ combatContext: marked, phase: "phase1" });
    expect(phase2Rows(wrongPhase).every((row) => row.supersededGmFigure !== undefined)).toBe(true);

    // A row written before #931 comment 21255 moved the signal to the task label: the marker text
    // in `notes`, round-tripped by a client that dropped the retained field. That text is
    // player-visible, so the clear must remove it even with nothing structured left to key on.
    // Driven from an explicitly constructed legacy row, because the writer no longer produces one.
    const legacy = scenarioParticipantCombatContextSchema.parse({
      ...marked,
      modifierBuckets: {
        ...marked.modifierBuckets,
        situationDb: marked.modifierBuckets.situationDb.map(
          ({ supersededGmFigure: _drop, ...row }) => {
            void _drop;
            return row.sourcePhase === "phase2"
              ? {
                  ...row,
                  notes: `${row.notes ?? ""}${SUPERSEDED_GM_FIGURE_NOTE_MARKER}DB/Parry -1%; review again`,
                }
              : row;
          },
        ),
      },
    });
    // The instrument is alive: the legacy text really is there before the clear.
    expect(
      phase2Rows(legacy).every((row) => row.notes?.includes(SUPERSEDED_GM_FIGURE_NOTE_MARKER)),
    ).toBe(true);
    const cleared = clearSupersededGmFigureMarks({ combatContext: legacy, phase: "phase2" });
    for (const row of phase2Rows(cleared)) {
      expect(row.notes).not.toContain(SUPERSEDED_GM_FIGURE_NOTE_MARKER);
      expect(row.notes).not.toContain("review again");
      expect(row.value).toBe(-2);
    }
    expect(
      cleared.modifierBuckets.situationDb.filter((row) => row.sourcePhase === "phase1"),
    ).toEqual(phase1Before);
  });

  describe("conditions, each shown failing when disabled", () => {
    it("fires only after the GM committed the phase: a cancel before any review supersedes nothing", () => {
      const { state } = openPhase2Review();
      const decided = cancel(state);
      const rows = phase2Rows(declarationOf(decided).combatContext);

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.value).toBe(-2);
        expect(row.supersededGmFigure).toBeUndefined();
        expect(row.notes).not.toContain(SUPERSEDED_GM_FIGURE_NOTE_MARKER);
      }
      expect(reviewStatus(decided)).toBe("pending");
      expect(decided.commands.some((command) => command.facts.supersededModifierRowIds)).toBe(
        false,
      );
    });

    it("fires only on a cancel: continuing is not a rule event, so the GM's -1 stands unmarked", () => {
      const { base, state } = openPhase2Review();
      const committed = gmCommitsPhase2Review(state, withPhase2(base, -1));
      const continued = decideCombatRoundDoubleAttackPhase2({
        command: { createdAt: AT(10) },
        decision: "continue",
        participantId: OWNER,
        state: committed,
      });

      const rows = phase2Rows(declarationOf(continued).combatContext);
      expect(rows.map((row) => row.value)).toEqual([-1]);
      expect(rows.every((row) => row.supersededGmFigure === undefined)).toBe(true);
      expect(reviewStatus(continued)).toBe("gmEdited");
      expect(modifierReviewTasks(continued)).toEqual([]);
    });

    it("fires only when the figure changes: a GM figure equal to the rule's -2 is left alone", () => {
      const { base, state } = openPhase2Review();
      const decided = cancel(gmCommitsPhase2Review(state, withPhase2(base, -2)));
      const rows = phase2Rows(declarationOf(decided).combatContext);

      expect(rows.every((row) => row.value === -2 && row.supersededGmFigure === undefined)).toBe(
        true,
      );
      expect(reviewStatus(decided)).toBe("gmEdited");
      expect(modifierReviewTasks(decided)).toEqual([]);
    });

    it("treats a row the GM removed as a committed figure of 0 and supersedes it", () => {
      const { base, state } = openPhase2Review();
      const removed = scenarioParticipantCombatContextSchema.parse({
        ...base,
        modifierBuckets: {
          ...base.modifierBuckets,
          situationDb: base.modifierBuckets.situationDb.filter(
            (row) => row.sourcePhase !== "phase2",
          ),
        },
      });
      const decided = cancel(gmCommitsPhase2Review(state, removed));
      const rows = phase2Rows(declarationOf(decided).combatContext);

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.value).toBe(-2);
        expect(row.supersededGmFigure).toEqual({ text: "removed by the GM", value: 0 });
      }
      expect(reviewStatus(decided)).toBe("pending");
    });

    it("is scoped to the phase being decided: a GM-committed phase-1 figure is a recorded fact and is kept", () => {
      // The writer rebuilds the rows of both phases; a phase-2 decision is not a rule event for
      // phase 1, so the GM's committed phase-1 figure must survive it rather than be reset to -4.
      const { base, state } = openPhase2Review();
      const gmContext = withPhaseRowValue(withPhase2(base, -1), "phase1", -3);
      const phase1Committed = recordCombatRoundParticipantStepReview({
        command: { createdAt: AT(2) },
        participantId: OWNER,
        state: combatRoundStateSchema.parse({
          ...state,
          participants: state.participants.map((entry) =>
            entry.participantId === OWNER
              ? { ...entry, declaration: { ...entry.declaration, combatContext: gmContext } }
              : entry,
          ),
        }),
        step: "review_action_modifiers",
        submittedBy: "gm",
      });
      const decided = cancel(gmCommitsPhase2Review(phase1Committed, gmContext, 3));
      const phase1 = (
        declarationOf(decided).combatContext?.modifierBuckets.situationDb ?? []
      ).filter((row) => row.sourcePhase === "phase1");

      expect(phase1.map((row) => row.value)).toEqual([-3]);
      expect(phase1.every((row) => row.supersededGmFigure === undefined)).toBe(true);
    });

    it("keeps a phase-1 row only when the GM committed phase 1: otherwise the writer's rebuild stands", () => {
      const { base, state } = openPhase2Review();
      // The same -3 sits in the declaration, but no phase-1 review command was recorded.
      const gmContext = withPhaseRowValue(withPhase2(base, -1), "phase1", -3);
      const decided = cancel(gmCommitsPhase2Review(state, gmContext));
      const phase1 = (
        declarationOf(decided).combatContext?.modifierBuckets.situationDb ?? []
      ).filter((row) => row.sourcePhase === "phase1");

      expect(phase1.map((row) => row.value)).toEqual([-4]);
      // A phase-2 rule event supersedes phase-2 figures only, whatever the phase-1 rebuild did.
      expect(phase1.every((row) => row.supersededGmFigure === undefined)).toBe(true);
      expect(phase1.every((row) => !row.notes?.includes(SUPERSEDED_GM_FIGURE_NOTE_MARKER))).toBe(
        true,
      );
    });

    it("cannot be reached with the boundary closed: the cancel itself refuses outside phase-2 review", () => {
      const { base, state } = openPhase2Review();
      const committed = gmCommitsPhase2Review(state, withPhase2(base, -1));
      const closed = combatRoundStateSchema.parse({
        ...committed,
        currentStep: "initiative_phase_2",
      });

      expect(() => cancel(closed)).toThrow(/only available during phase-2 review/);
    });

    it("keeps the participant that did not cancel out of review", () => {
      const { base, state } = openPhase2Review();
      const other = {
        ...state.participants[0]!,
        declaration: { actionId: "pass", roundNumber: ROUND, submittedBy: "player" },
        label: "Echo",
        participantId: "encounter-echo",
        scenarioParticipantId: "scenario-echo",
        stepStatuses: {
          ...state.participants[0]!.stepStatuses,
          review_phase_2_modifiers: "gmEdited",
        },
      };
      const two = combatRoundStateSchema.parse({
        ...state,
        participants: [...state.participants, other],
      });
      const committed = gmCommitsPhase2Review(two, withPhase2(base, -1));
      const decided = cancel(committed);

      expect(
        decided.participants.find((entry) => entry.participantId === "encounter-echo")!.stepStatuses
          .review_phase_2_modifiers,
      ).toBe("gmEdited");
      expect(reviewStatus(decided)).toBe("pending");
    });
  });

  it("take-back of the decision restores the committed row and the committed review status", () => {
    const { base, state } = openPhase2Review();
    const committed = gmCommitsPhase2Review(state, withPhase2(base, -1));
    const decided = cancel(committed);
    expect(reviewStatus(decided)).toBe("pending");

    const restored = undoLatestCombatRoundCommand({ state: decided });
    if (!restored) throw new Error("The decision could not be taken back.");

    expect(reviewStatus(restored)).toBe("gmEdited");
    const rows = phase2Rows(declarationOf(restored).combatContext);
    expect(rows.map((row) => row.value)).toEqual([-1]);
    expect(rows.every((row) => row.supersededGmFigure === undefined)).toBe(true);
    expect(modifierReviewTasks(restored)).toEqual([]);
  });
});
