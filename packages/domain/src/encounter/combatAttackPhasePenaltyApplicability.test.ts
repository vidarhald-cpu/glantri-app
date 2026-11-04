import { describe, expect, it } from "vitest";

import {
  applyCombatActionGeneratedModifiers,
  buildCombatRoundAttackRollResult,
  buildCombatRoundDeclaredAttackOpportunities,
  canonicalCombatModifierEffectSchema,
  combatRoundStateSchema,
  decideCombatRoundDoubleAttackPhase2,
  isAttackPhaseDefensivePenaltyModifier,
  resolveCanonicalCombatAttackModifierFacts,
  resolveCanonicalCombatParryModifierFacts,
  resolveCombatAttackPhaseDefensivePenalties,
  scenarioParticipantCombatContextSchema,
  scenarioParticipantSchema,
  softenCombatActionGeneratedBackOutModifier,
  type ScenarioParticipantCombatContext,
} from "../index";

/**
 * #884 — the attack-phase DB/Parry penalty never reached the defending number.
 *
 * The rule is per phase: a character who attacks in a phase defends at -4% for that phase. The
 * generated row was created, shown in the GM panel, reviewed, and then excluded from every
 * defence resolution, because its stored applicability named its owner's own attack opportunity
 * while the evaluation context names the *incoming* attack's. Measured at `dev` 34a0b54e: an
 * attacker and a non-attacker both defended on DB 30 with an empty `dynamicContributions`
 * (issue comment 19994).
 *
 * Every row below is produced by the production generator with the lifecycle context
 * `POST /combat-declaration` supplies, so the canonical lifecycle is attached exactly as it is
 * persisted. That is load-bearing: the hand-written row in
 * `combatAttackModifierValidation.test.ts` carries no `canonicalLifecycle`, so it travelled the
 * inferred-applicability path, which never set an opportunity — and it passed throughout the
 * defect.
 */
describe("the attack-phase defensive penalty applies to its owner's own defence (#884)", () => {
  const ENCOUNTER_ID = "encounter-884";
  const ROUND = 1;

  function declaredAttack(input: {
    actionId: "attack_parry" | "parry_attack" | "double_attack";
    participantId: string;
    scenarioParticipantId: string;
  }) {
    const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
      actionId: input.actionId,
      participantId: input.participantId,
      roundNumber: ROUND,
    });
    const attackPhaseDefensivePenalties = resolveCombatAttackPhaseDefensivePenalties({
      commitment: "committed",
      opportunities: attackOpportunities,
      participantId: input.participantId,
      roundNumber: ROUND,
    });
    const combatContext = applyCombatActionGeneratedModifiers({
      actionId: input.actionId,
      attackPhaseDefensivePenalties,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      // The exact lifecycle context the declaration route passes (encounterRoutes.ts).
      lifecycleContext: {
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: "2026-01-01T00:00:00.000Z",
        createdSequence: 0,
        encounterId: ENCOUNTER_ID,
        ownerParticipantId: input.scenarioParticipantId,
        visibility: { audience: "involved", sourceIdentity: "public" },
      },
      sourceEncounterId: ENCOUNTER_ID,
      sourceRoundNumber: ROUND,
    });
    return { attackOpportunities, attackPhaseDefensivePenalties, combatContext };
  }

  function participantWithContext(input: {
    combatContext: ScenarioParticipantCombatContext;
    id: string;
  }) {
    return scenarioParticipantSchema.parse({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: input.id,
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-884",
      snapshot: { displayName: input.id },
      sourceType: "character",
      state: {
        combat: { combatContext: input.combatContext },
        equipment: {},
        health: {},
        resources: {},
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }

  /**
   * The measured shape: two mutual Phase-1 attackers, and one participant who declared Pass.
   * `alpha` is attacked by `bravo` while carrying its own accepted penalty; `charlie` is attacked
   * by `delta` while carrying none. `delta` declared a Double attack, so it attacks in both
   * phases and the phase dimension can be exercised against a real Phase-2 attack.
   */
  function fixture() {
    const alpha = declaredAttack({
      actionId: "attack_parry",
      participantId: "encounter-alpha",
      scenarioParticipantId: "scenario-alpha",
    });
    const bravo = declaredAttack({
      actionId: "attack_parry",
      participantId: "encounter-bravo",
      scenarioParticipantId: "scenario-bravo",
    });
    const delta = declaredAttack({
      actionId: "double_attack",
      participantId: "encounter-delta",
      scenarioParticipantId: "scenario-delta",
    });
    const state = combatRoundStateSchema.parse({
      currentStep: "phase_1_actions",
      participants: [
        {
          declaration: {
            actionId: "attack_parry",
            attackOpportunities: alpha.attackOpportunities,
            attackPhaseDefensivePenalties: alpha.attackPhaseDefensivePenalties,
            roundNumber: ROUND,
            submittedBy: "player",
          },
          label: "Alpha",
          participantId: "encounter-alpha",
          scenarioParticipantId: "scenario-alpha",
        },
        {
          declaration: {
            actionId: "attack_parry",
            attackOpportunities: bravo.attackOpportunities,
            attackPhaseDefensivePenalties: bravo.attackPhaseDefensivePenalties,
            roundNumber: ROUND,
            submittedBy: "player",
          },
          label: "Bravo",
          participantId: "encounter-bravo",
          scenarioParticipantId: "scenario-bravo",
        },
        {
          declaration: { actionId: "pass", roundNumber: ROUND, submittedBy: "player" },
          label: "Charlie",
          participantId: "encounter-charlie",
          scenarioParticipantId: "scenario-charlie",
        },
        {
          declaration: {
            actionId: "double_attack",
            attackOpportunities: delta.attackOpportunities,
            attackPhaseDefensivePenalties: delta.attackPhaseDefensivePenalties,
            roundNumber: ROUND,
            submittedBy: "player",
          },
          label: "Delta",
          participantId: "encounter-delta",
          scenarioParticipantId: "scenario-delta",
        },
      ],
      roundNumber: ROUND,
    });

    return {
      alpha,
      bravo,
      delta,
      participants: {
        alpha: participantWithContext({ combatContext: alpha.combatContext, id: "scenario-alpha" }),
        bravo: participantWithContext({ combatContext: bravo.combatContext, id: "scenario-bravo" }),
        charlie: participantWithContext({
          combatContext: scenarioParticipantCombatContextSchema.parse({}),
          id: "scenario-charlie",
        }),
        delta: participantWithContext({ combatContext: delta.combatContext, id: "scenario-delta" }),
      },
      state,
    };
  }

  function generatedRow(combatContext: ScenarioParticipantCombatContext) {
    const row = combatContext.modifierBuckets.situationDb.find((entry) =>
      isAttackPhaseDefensivePenaltyModifier(entry),
    );
    if (!row) throw new Error("the generator produced no attack-phase defensive penalty row");
    return row;
  }

  it("keeps the attack opportunity as provenance and out of the row's applicability", () => {
    const { alpha } = fixture();
    const row = generatedRow(alpha.combatContext);
    // `ScenarioCombatModifierEntry.canonicalLifecycle` is deliberately loosely typed on the
    // scenario schema; read it through the canonical schema the resolution path uses.
    const canonical = canonicalCombatModifierEffectSchema.parse(row.canonicalLifecycle);
    const opportunityId = alpha.attackOpportunities[0]!.id;

    // One declared opportunity per participant per phase per round, and the slot is derived from
    // the phase, so the opportunity id states nothing the round, participant and phase dimensions
    // do not already state.
    expect(alpha.attackOpportunities).toHaveLength(1);
    expect(opportunityId).toBe(`round:${ROUND}:participant:encounter-alpha:phase1:attack_1`);
    expect(row.value).toBe(-4);
    expect(row.sourceOpportunityId).toBe(opportunityId);
    expect(canonical.sourceFamily).toBe("attack_opportunity");
    expect(canonical.sourceReferences.opportunityId).toBe(opportunityId);
    expect(canonical.applicability.opportunityId).toBeUndefined();
    expect(canonical.applicability.phase).toBe("phase1");
    expect(canonical.applicability.roundNumber).toBe(ROUND);
  });

  it("applies the accepted penalty to the attacker's own defence and not to a non-attacker's", () => {
    const { participants, state } = fixture();
    const attacked = resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-bravo",
      attackerScenarioParticipant: participants.bravo,
      defenderCombatantId: "encounter-alpha",
      defenderScenarioParticipant: participants.alpha,
      encounterId: ENCOUNTER_ID,
      phase: "phase1",
      state,
    });
    const passed = resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-delta",
      attackerScenarioParticipant: participants.delta,
      defenderCombatantId: "encounter-charlie",
      defenderScenarioParticipant: participants.charlie,
      encounterId: ENCOUNTER_ID,
      phase: "phase1",
      state,
    });

    // The defence is resolved against the attacker's opportunity, which is never the defender's.
    expect(attacked.declaredOpportunity?.id).toBe(
      `round:${ROUND}:participant:encounter-bravo:phase1:attack_1`,
    );
    expect(attacked.defenderResolution.rows.map((row) => row.value)).toEqual([-4]);
    expect(attacked.defenderResolution.total).toBe(-4);
    expect(passed.defenderResolution.rows).toEqual([]);
    expect(passed.defenderResolution.total).toBe(0);
  });

  it("applies the penalty in the phase it names and not in the other phase of the same round", () => {
    const { participants, state } = fixture();
    const read = (phase: "phase1" | "phase2") =>
      resolveCanonicalCombatAttackModifierFacts({
        attackerCombatantId: "encounter-delta",
        attackerScenarioParticipant: participants.delta,
        defenderCombatantId: "encounter-alpha",
        defenderScenarioParticipant: participants.alpha,
        encounterId: ENCOUNTER_ID,
        phase,
        state,
      }).defenderResolution;

    // Alpha declared Attack - Parry, so it attacks in Phase 1 only: it carries the penalty against
    // a Phase-1 attack and defends unmodified against Delta's Phase-2 attack in the same round.
    expect(read("phase1").total).toBe(-4);
    expect(read("phase2").rows).toEqual([]);
    expect(read("phase2").total).toBe(0);
  });

  it("resolves an unmodified defence when the reviewed context carries no penalty row", () => {
    const { alpha, participants, state } = fixture();
    const removedRowId = generatedRow(alpha.combatContext).id;
    // The reviewed combat context with that row gone, which is what the GM's "Remove modifier"
    // control puts in the submission (`CombatRoundManagerPanel`'s `onRemoveEntry`).
    //
    // This binds the resolution contract only, not a GM capability: the declaration route
    // recomputes the penalties and `applyCombatActionGeneratedModifiers` drops every existing
    // attack-phase row and re-creates it (combatActionModifiers.ts, the
    // `isAttackPhaseDefensivePenaltyModifier` branch), so a removal or value edit submitted in
    // review does not survive. Measured: a removed row and a row edited to -1 both come back at
    // -4. That is a separate question — what the GM may edit — and is not changed here.
    const reviewed = participantWithContext({
      combatContext: scenarioParticipantCombatContextSchema.parse({
        ...alpha.combatContext,
        modifierBuckets: {
          ...alpha.combatContext.modifierBuckets,
          situationDb: alpha.combatContext.modifierBuckets.situationDb.filter(
            (entry) => entry.id !== removedRowId,
          ),
        },
      }),
      id: "scenario-alpha",
    });
    const facts = resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-bravo",
      attackerScenarioParticipant: participants.bravo,
      defenderCombatantId: "encounter-alpha",
      defenderScenarioParticipant: reviewed,
      encounterId: ENCOUNTER_ID,
      phase: "phase1",
      state,
    });

    expect(facts.defenderResolution.rows).toEqual([]);
    expect(facts.defenderResolution.total).toBe(0);
  });

  it("also carries the penalty into the owner's Parry resolution", () => {
    const { participants, state } = fixture();
    const facts = resolveCanonicalCombatParryModifierFacts({
      attackerScenarioParticipant: participants.bravo,
      attackResult: {
        ...buildCombatRoundAttackRollResult({
          actionId: "attack_parry",
          attackerParticipantId: "encounter-bravo",
          defenderDb: 30,
          defenderParticipantId: "encounter-alpha",
          ob: 10,
          phase: "phase1",
          rollD20: 13,
          rollTotal: 13,
          rolledAt: "2026-01-01T00:00:00.000Z",
          weaponName: "Longsword",
        }),
        attackOpportunityId: `round:${ROUND}:participant:encounter-bravo:phase1:attack_1`,
      },
      defenderCombatantId: "encounter-alpha",
      defenderScenarioParticipant: participants.alpha,
      encounterId: ENCOUNTER_ID,
      state,
    });

    expect(facts.defenderResolution.total).toBe(-4);
  });

  /**
   * The rule's two named exceptions reduce this penalty from -4 to -2
   * (`CombatAttackPhasePenaltyException`), and both are applied by rewriting the generated row in
   * place. Each rewrite spread the existing row, so the row's own `value` and note became -2 while
   * the attached `canonicalLifecycle.payload.value` stayed at -4 — and
   * `normalizeScenarioCombatModifierEntry` resolves a row's value from the canonical payload
   * whenever one is attached. The reduction therefore never reached the defending number.
   *
   * The assertions below read the **resolved** value through the resolution path. `entry.value` was
   * already -2 throughout the defect and cannot discriminate: the committed assertion in
   * "keeps the one consumer that selects this row by its attack opportunity working" reads that
   * field and passed over this defect.
   */
  it("resolves a backed-out simultaneous attack at the reduced -2", () => {
    const { alpha, participants, state } = fixture();
    const opportunityId = alpha.attackOpportunities[0]!.id;
    // The production arguments and order of `submitCombatRoundPhaseInitiativeChoiceCommand`'s
    // back-out branch (`combatRoundManager.ts`): the declared action id, the participant's current
    // combat context, and the canonical opportunity. That function returns this softened context as
    // its `combatContext`, which `POST /combat-round/back-out` persists onto
    // `participant.state.combat.combatContext` — the context every defence is resolved against.
    const softened = softenCombatActionGeneratedBackOutModifier({
      actionId: "attack_parry",
      combatContext: alpha.combatContext,
      opportunityId,
      phase: "phase1",
    });
    const row = generatedRow(softened.combatContext);
    const canonical = canonicalCombatModifierEffectSchema.parse(row.canonicalLifecycle);
    const facts = resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-bravo",
      attackerScenarioParticipant: participants.bravo,
      defenderCombatantId: "encounter-alpha",
      defenderScenarioParticipant: participantWithContext({
        combatContext: softened.combatContext,
        id: "scenario-alpha",
      }),
      encounterId: ENCOUNTER_ID,
      phase: "phase1",
      state,
    });

    expect(softened.softenedModifiers).toHaveLength(1);
    // The resolved value first: it is the number the defence is calculated from.
    expect(facts.defenderResolution.rows.map((entry) => entry.value)).toEqual([-2]);
    expect(facts.defenderResolution.total).toBe(-2);
    // Then the two projections of the same figure the GM and the engine read.
    expect(row.value).toBe(-2);
    expect(row.notes).toBe("simultaneous attack backout: DB/Parry -2% in phase1");
    expect(canonical.payload.kind === "numeric" ? canonical.payload.value : undefined).toBe(-2);
  });

  it("resolves a cancelled Double Attack second attack at the reduced -2 in phase 2", () => {
    const { delta, participants, state } = fixture();
    const phase1Opportunity = delta.attackOpportunities.find(
      (opportunity) => opportunity.phase === "phase1",
    )!;
    // `decideCombatRoundDoubleAttackPhase2` requires Attack 1 resolved and the phase-2 modifier
    // review step, so the real command is driven rather than its parts composed by hand. The route
    // (`POST /combat-round/decide-double-attack-phase2`) persists the resulting declaration's
    // `combatContext` onto `participant.state.combat.combatContext`.
    const reviewState = combatRoundStateSchema.parse({
      ...state,
      currentStep: "review_phase_2_modifiers",
      participants: state.participants.map((entry) =>
        entry.participantId === "encounter-delta"
          ? {
              ...entry,
              attackResultsByOpportunity: {
                [phase1Opportunity.id]: {
                  ...buildCombatRoundAttackRollResult({
                    actionId: "double_attack",
                    attackerParticipantId: "encounter-delta",
                    defenderDb: 10,
                    defenderParticipantId: "encounter-alpha",
                    ob: 10,
                    phase: "phase1",
                    rollD20: 11,
                    rollTotal: 11,
                    rolledAt: "2026-01-01T00:00:01.000Z",
                    weaponName: "Longsword",
                  }),
                  attackOpportunityId: phase1Opportunity.id,
                },
              },
              declaration: { ...entry.declaration, combatContext: delta.combatContext },
            }
          : entry,
      ),
    });
    const decided = decideCombatRoundDoubleAttackPhase2({
      command: { createdAt: "2026-01-01T00:00:02.000Z", createdByUserId: "gm" },
      decision: "cancel",
      participantId: "encounter-delta",
      state: reviewState,
    });
    const cancelledContext = scenarioParticipantCombatContextSchema.parse(
      decided.participants.find((entry) => entry.participantId === "encounter-delta")?.declaration
        ?.combatContext ?? {},
    );
    const cancelledRow = cancelledContext.modifierBuckets.situationDb.find(
      (entry) => entry.sourcePhase === "phase2" && entry.canonicalLifecycle !== undefined,
    );
    if (!cancelledRow) throw new Error("the cancel path produced no projected phase-2 row");
    const canonical = canonicalCombatModifierEffectSchema.parse(cancelledRow.canonicalLifecycle);
    const read = (phase: "phase1" | "phase2") =>
      resolveCanonicalCombatAttackModifierFacts({
        attackerCombatantId: "encounter-bravo",
        attackerScenarioParticipant: participants.bravo,
        defenderCombatantId: "encounter-delta",
        defenderScenarioParticipant: participantWithContext({
          combatContext: cancelledContext,
          id: "scenario-delta",
        }),
        encounterId: ENCOUNTER_ID,
        phase,
        state: decided,
      }).defenderResolution;

    // The resolved value first: it is the number the phase-2 defence is calculated from.
    expect(read("phase2").rows.map((row) => row.value)).toEqual([-2]);
    expect(read("phase2").total).toBe(-2);
    // Attack 1 happened, so its phase-1 penalty is a recorded fact and stays at the full -4.
    expect(read("phase1").total).toBe(-4);
    // Then the two projections of the same figure the GM and the engine read.
    expect(cancelledRow.value).toBe(-2);
    expect(cancelledRow.notes).toBe("double attack cancelled after Attack 1");
    expect(canonical.payload.kind === "numeric" ? canonical.payload.value : undefined).toBe(-2);
  });

  it("keeps the one consumer that selects this row by its attack opportunity working", () => {
    const { alpha } = fixture();
    const opportunityId = alpha.attackOpportunities[0]!.id;
    const softened = softenCombatActionGeneratedBackOutModifier({
      combatContext: alpha.combatContext,
      opportunityId,
      phase: "phase1",
    });
    const otherOpportunity = softenCombatActionGeneratedBackOutModifier({
      combatContext: alpha.combatContext,
      opportunityId: `round:${ROUND}:participant:encounter-bravo:phase1:attack_1`,
      phase: "phase1",
    });

    // `softenCombatActionGeneratedBackOutModifier` reads the row's own `sourceOpportunityId`, not
    // its applicability, so narrowing the applicability leaves that selection intact.
    //
    // `entry.value` is the right field for *this* question — did the selection fire on this row —
    // and the wrong field for whether the reduction reaches a defence. That is asserted on the
    // resolved value in "resolves a backed-out simultaneous attack at the reduced -2".
    expect(softened.softenedModifiers).toHaveLength(1);
    expect(generatedRow(softened.combatContext).value).toBe(-2);
    expect(otherOpportunity.softenedModifiers).toEqual([]);
  });
});
