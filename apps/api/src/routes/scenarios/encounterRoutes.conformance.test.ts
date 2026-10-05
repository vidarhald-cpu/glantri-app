import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "encounterRoutes.ts"), "utf8");

describe("combat route canonical-conformance guards", () => {
  it("keeps five-key adjudication and Bleed treatment server-owned", () => {
    expect(source).toContain("normalizeC1FiveKeyDamageReview(body.review)");
    expect(source).toContain("getC1FiveKeyCanonicalReview(criticalKey)");
    expect(source).toContain("buildRepresentativeCriticalRuntimeDefinition(criticalKey");
    expect(source).toContain('"/encounters/:encounterId/combat-round/transition-critical-bleed"');
    expect(source).toContain("Only GM users can update Critical Bleed treatment.");
    expect(source).toContain("transitionCombatCriticalBleedEffect({");
    expect(source).toContain("commitCombatParticipantStateMutation({");
  });

  it("negotiates compact active-only mutation responses before serialization", () => {
    expect(source).toContain('app.addHook("preSerialization"');
    expect(source).toContain("buildRequestedCombatMutationResponse({");
    expect(source).toContain("prefersActiveCombatMutationResponse(");
    expect(source).toContain("request.headers[ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER]");
  });

  it("keeps workspace summaries and revision polling off the full encounter-list path", () => {
    expect(source).toContain('app.get("/scenarios/:scenarioId/encounter-summaries"');
    expect(source).toContain("listEncounterSummariesByScenario");
    expect(source).toContain("listEncounterAccessMetadataByScenario");
    expect(source).toContain('app.get("/encounters/:encounterId/revision"');
    expect(source).toContain("getEncounterMetadataById");
    expect(source).toContain("buildEncounterSessionRevisionFromMetadataView");
  });

  it("keeps exact encounter GET projection-only", () => {
    const routeStart = source.indexOf('app.get("/encounters/:encounterId"');
    const nextRoute = source.indexOf('app.get("/encounters/:encounterId/revision"', routeStart);
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).toContain("persistChanges: false");
    expect(routeSource).not.toContain("updateCombatEncounter");
    expect(routeSource).not.toContain("updateScenarioParticipantState");
  });

  it("loads combat history through the narrow history-source boundary", () => {
    const routeStart = source.indexOf('app.get("/encounters/:encounterId/combat-history"');
    const nextRoute = source.indexOf('app.put("/encounters/:encounterId"', routeStart);
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).toContain("getCombatHistorySourceById");
    expect(routeSource).toContain("withCombatHistoryRoundState");
    expect(routeSource).not.toContain("encounterService.getEncounterById");
  });

  it("keeps the history projector independent of EncounterSession", () => {
    const projectionSource = readFileSync(
      resolve(__dirname, "../../../../../packages/domain/src/encounter/combatHistoryProjection.ts"),
      "utf8",
    );
    const signatureStart = projectionSource.indexOf("export function projectCombatHistory(input:");
    const signatureEnd = projectionSource.indexOf("): CombatHistoryProjection", signatureStart);
    const signatureSource = projectionSource.slice(signatureStart, signatureEnd);

    expect(signatureStart).toBeGreaterThanOrEqual(0);
    expect(signatureEnd).toBeGreaterThan(signatureStart);
    expect(signatureSource).toContain("source: CombatHistorySourceView");
    expect(signatureSource).not.toContain("sourceUpdatedAt?:");
    expect(signatureSource).not.toContain("state: CombatRoundState;");
  });

  it("does not expose the removed cursor-authorized GM mutation routes", () => {
    for (const route of [
      "combat-round/feint-feasibility",
      "combat-round/skip-current-action",
      "combat-round/advance-current-phase-resolution",
      "combat-round/complete-current-phase-resolution",
    ]) {
      expect(source).not.toContain(route);
    }
  });

  it("does not shadow projected attack authorization with the compatibility roll cursor", () => {
    expect(source).not.toContain("getPlayerCombatCurrentRollAction");
  });

  it("filters canonical attack results before deriving player-safe phase compatibility", () => {
    const sanitizerStart = source.indexOf(
      "function sanitizePlayerSafeCurrentCombatResultsState(input:",
    );
    const sanitizerEnd = source.indexOf(
      "export function buildPlayerFacingEncounterForUser(input:",
      sanitizerStart,
    );
    const sanitizerSource = source.slice(sanitizerStart, sanitizerEnd);

    expect(sanitizerStart).toBeGreaterThanOrEqual(0);
    expect(sanitizerEnd).toBeGreaterThan(sanitizerStart);
    expect(sanitizerSource).toContain(
      "Object.entries(participant.attackResultsByOpportunity ?? {}).filter",
    );
    expect(sanitizerSource).toContain("deriveCombatRoundAttackResultsCompatibility({");
    expect(sanitizerSource).not.toContain("participant.attackResults[");
    expect(sanitizerSource.indexOf("Object.fromEntries(")).toBeLessThan(
      sanitizerSource.indexOf("deriveCombatRoundAttackResultsCompatibility({"),
    );
  });

  it("requires the boundary command execution group and command type", () => {
    expect(source).toContain("expectedCommandType: body.commandType");
    expect(source).toContain("expectedExecutionGroupId: body.executionGroupId");
    expect(source).toContain("expectedTaskId: body.taskId");
  });

  it("executes GM bulk step completion as one descriptor-bound domain mutation", () => {
    const routeStart = source.indexOf(
      '"/encounters/:encounterId/combat-round/complete-remaining-step"',
    );
    const nextRoute = source.indexOf(
      '"/encounters/:encounterId/combat-round/skip-current-phase-action"',
      routeStart,
    );
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).toContain('commandType: "complete_remaining_step"');
    expect(routeSource.match(/completeRemainingCombatRoundStep\(\{/g)).toHaveLength(1);
    expect(routeSource.match(/updateCombatEncounter\(\{/g)).toHaveLength(1);
    expect(routeSource).toContain("expectedRevision: encounter.updatedAt");
    expect(routeSource).toContain("playerOwnedParticipantIds");
    expect(routeSource).toContain("scenarioParticipant.controlledByUserId !== user.id");
    expect(routeSource).toContain("blocker: completed.blocker");
    expect(routeSource).toContain("declaration.combatContext");
    expect(routeSource).toContain("buildCombatRoundCommandEnvelope({ state: completed.state })");
  });

  it("canonicalizes targeted secondary declarations and derives Parry from stable Dodge identity", () => {
    expect(source).toContain("scenarioParticipantSecondaryActionContextSchema.parse");
    expect(source).toContain('skill.skillId === "dodge"');
    expect(source).toContain("deriveParryPrimaryActionModifier(dodgeSkillValue)");
    expect(source).toContain("secondaryActionContext: canonicalSecondaryActionContext");
    expect(source).toContain("secondaryActions: canonicalSecondaryActionContext");
    expect(source).toContain("Parry requires the participant's canonical Dodge skill.");
  });

  it("projects an observer-owned Observe Opponent command and keeps the hidden roll player-safe", () => {
    expect(source).toContain("recordCombatObservationRoll({");
    expect(source).toContain("buildCombatObservationModifierContributions({");
    expect(source).toContain("buildPlayerSafeCombatObservationAttempts({");
    expect(source).toContain("buildPlayerSafeCombatObservationRelationships({");
    expect(source).toContain('"/encounters/:encounterId/combat-round/roll-observation"');
    expect(source).toContain('commandType: "roll_observation"');
    expect(source).toContain("buildObservationRollBasis({");
    expect(source).toContain('rollPurpose: "observe_opponent"');
    expect(source).toContain('rollType: "observation"');
    expect(source).toContain("observerModifierProjection.contributions");
    expect(source).toContain("targetModifierProjection.contributions");
  });

  it("resolves Feint rolls through canonical Skill Contest snapshots", () => {
    expect(source).toContain("resolveFeintSkillContestCalculation({");
    expect(source).toContain("resolveCombatFeintSkillContest({");
    expect(source).toContain("skillContestCalculation,");
    expect(source).toContain("finalTotal: skillContestCalculation.finalResult");
    expect(source).not.toContain(
      "profile.rollBaseValue +\n          profile.unknownSkillPenalty +\n          adjustment +\n          canonicalCombatModifier",
    );
  });

  it("resolves both Adjust Distance lifecycles through the canonical Skill Contest path", () => {
    const resolverStart = source.indexOf(
      "function resolveAdjustDistanceSkillContestCalculation(input:",
    );
    const resolverEnd = source.indexOf(
      "function buildRoundEndDistanceRollResult(input:",
      resolverStart,
    );
    const resolverSource = source.slice(resolverStart, resolverEnd);

    expect(resolverStart).toBeGreaterThanOrEqual(0);
    expect(resolverEnd).toBeGreaterThan(resolverStart);
    expect(resolverSource).toContain("resolveParticipantSkillRollProfile({");
    expect(resolverSource).toContain('linkedStatsOverride: ["dex"]');
    expect(resolverSource).toContain("resolveCombatSkillContest({");
    expect(resolverSource).toContain("buildCombatObservationSkillContestContribution({");
    expect(resolverSource).not.toContain("sheet.combat.dodge");
    expect(resolverSource).not.toContain("calculateDB");
    expect(resolverSource).not.toContain("shield");

    expect(source.match(/resolveAdjustDistanceSkillContestCalculation\(\{/g)?.length).toBe(5);
    expect(source).toContain('contestType: "adjust_distance_attack"');
    expect(source).toContain('contestType: "break_off"');
    expect(source).toContain('contestType: "round_end_adjust_distance"');
  });

  it("authorizes complete_round before applying observation boundary progress", () => {
    const advanceSource = readFileSync(
      resolve(
        __dirname,
        "../../../../../packages/domain/src/encounter/combatProgressionProjection/advance.ts",
      ),
      "utf8",
    );
    const routeStart = source.indexOf(
      'app.post("/encounters/:encounterId/combat-round/advance-current-step"',
    );
    const nextRoute = source.indexOf(
      'app.post("/encounters/:encounterId/combat-round/save-damage-review"',
      routeStart,
    );
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).not.toContain("resolveCombatObservationRoundBoundary");
    expect(routeSource).toContain("state: roundState");
    expect(advanceSource).toContain("const authorization = authorizeCombatProgressionTask({");
    expect(
      advanceSource.indexOf("const authorization = authorizeCombatProgressionTask({"),
    ).toBeLessThan(
      advanceSource.indexOf("const observationBoundary = resolveCombatObservationRoundBoundary({"),
    );
  });

  it("forwards initiative-group identity into projected-task authorization", () => {
    expect(source).toContain("initiativeGroupId: input.identity.initiativeGroupId");
    expect(source).toContain("initiativeValue: input.identity.initiativeValue");
  });

  it("binds server-owned attack calculation to the current task and initiative cutoff", () => {
    expect(source).toContain("effectCutoffInitiativeGroupId: task.identity.initiativeGroupId");
    expect(source).toContain("initiativeGroupId: task.identity.initiativeGroupId");
    expect(source).toContain("initiativeValue: task.identity.initiativeValue");
    expect(source).toContain('code: "modifier_validation_task_mismatch"');
    expect(source).not.toContain('code: "attacker_modifier_signature_mismatch"');
    expect(source).toContain("resolveCanonicalAttackOffense({");
    expect(source).toContain("resolveCanonicalScenarioParticipantDefense({");
    expect(source).not.toContain('code: "defender_modifier_signature_mismatch"');
  });

  it("binds Offensive Parry Brawling to exact task and parry lineage", () => {
    expect(source).toContain("combat-round/roll-offensive-parry-brawling");
    for (const identity of [
      "attackResultId",
      "contestId",
      "declarationId",
      "declaredOpponentParticipantId",
      "executionGroupId",
      "opportunityId",
      "offensiveParryAttemptId",
      "parryResultId",
      "processId",
      "stageId",
      "taskId",
    ]) {
      expect(source).toContain(`${identity}: body.${identity}`);
    }
    expect(source).toContain('commandType: "roll_offensive_parry_brawling"');
    expect(source).toContain('rollPurpose: "offensive_parry_brawling"');
  });

  it("binds Continued Contact maintenance to the exact task, contest, contact, and roll purpose", () => {
    expect(source).toContain("combat-round/roll-continued-contact-maintenance");
    for (const identity of [
      "contestId",
      "continuedContactId",
      "executionGroupId",
      "opponentParticipantId",
      "processId",
      "stageId",
      "taskId",
    ]) {
      expect(source).toContain(`${identity}: body.${identity}`);
    }
    expect(source).toContain('commandType: "roll_continued_contact_maintenance"');
    expect(source).toContain('rollPurpose: "escape_continued_contact"');
    expect(source).toContain("attachContinuedContactEffectTransitionFacts({");
    expect(source).toContain("commitCombatParticipantStateMutation({");
    expect(source).toContain('startProcessFamily === "continued_contact"');
    expect(source).toContain('reason: "continued_contact_review_required"');
  });

  it("authorizes proactive parry from the complete projected descriptor", () => {
    for (const identity of [
      "attackResultId",
      "attackerParticipantId",
      "declarationId",
      "declaredOpponentParticipantId",
      "defenderParticipantId",
      "executionGroupId",
      "offensiveParryAttemptId",
      "opportunityId",
      "parryPurpose",
      "parrySourceId",
      "processId",
      "stageId",
      "taskId",
    ]) {
      expect(source).toContain(`${identity}: body.${identity}`);
    }
    expect(source).toContain('commandType: "roll_parry"');
    expect(source).toContain("commandType must be roll_parry.");
    expect(source).toContain("resolveCanonicalCombatParryModifierFacts({");
    expect(source).toContain("getCombatDefenseSnapshotForAttack(");
    expect(source).toContain("resolveCanonicalParryBaseForDefenseSnapshot({");
    expect(source).toContain('code: "parry_modifier_signature_mismatch"');
    expect(source).not.toContain("parryBase: body.parryBase");
    expect(source).not.toContain("body.defenderModifierFingerprint !==");
    expect(source).toContain("body.effectCutoffInitiativeGroupId !== currentInitiativeGroupId");
  });

  it("binds Parry-Disarm to the declared exact wielded weapon instead of client hand flags", () => {
    const parryRouteStart = source.indexOf(
      'app.post("/encounters/:encounterId/combat-round/roll-parry"',
    );
    const parryRouteEnd = source.indexOf("\n  app.post(", parryRouteStart + 10);
    const parryRoute = source.slice(parryRouteStart, parryRouteEnd);

    expect(parryRouteStart).toBeGreaterThanOrEqual(0);
    expect(parryRouteEnd).toBeGreaterThan(parryRouteStart);
    expect(parryRoute).toContain('body.parryPurpose === "parry_disarm"');
    expect(parryRoute).toContain("resolveCanonicalWeaponParryBase({");
    expect(parryRoute).toContain(
      "parryDisarmAttempt.actingWeaponItemId !== parryDisarmDeclaration.actingWeapon.itemId",
    );
    expect(parryRoute).not.toContain(
      "body.parrySourceId !== parryDisarmDeclaration.actingWeapon.itemId",
    );
    expect(parryRoute.match(/hasExactWieldedWeaponItem\(\{/g)).toHaveLength(2);
  });

  it("uses the shared canonical Skill Contest resolver for Offensive Parry and maintenance", () => {
    expect(source).toContain("resolveOffensiveParryBrawlingSkillContestCalculation({");
    expect(source).toContain('purpose: "initial_offensive_parry"');
    expect(source).toContain('purpose: "continued_contact_maintenance"');
    expect(source).toContain("skillContestCalculation: calculation");
    expect(source).toContain("effectiveSkillValue: calculation.preDieTotal");
    expect(source).toContain("finalTotal: calculation.finalResult");
    const helperStart = source.indexOf(
      "function resolveOffensiveParryBrawlingSkillContestCalculation",
    );
    const helperEnd = source.indexOf("function buildRoundEndDistanceRollResult", helperStart);
    const helperSource = source.slice(helperStart, helperEnd);
    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helperSource).toContain('bucket: "general_fatigue"');
    expect(helperSource).not.toContain('bucket: "skill_ob"');
    expect(helperSource).toContain("totalXp: profile.totalXP");
    expect(helperSource).toContain("characteristicAverage: profile.avgStats");
  });

  it("binds a distance-control roll to the canonical opposite proposal side", () => {
    const routeStart = source.indexOf(
      '"/encounters/:encounterId/combat-round/roll-distance-control"',
    );
    const nextRoute = source.indexOf(
      '"/encounters/:encounterId/combat-round/roll-current-distance-control"',
      routeStart,
    );
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).toContain("const canonicalOpponentParticipantId =");
    expect(routeSource).toContain("canonicalOpponentParticipantId !== body.opponentParticipantId");
    expect(routeSource).toContain("opponentScenarioParticipant.id === scenarioParticipant.id");
    expect(routeSource).not.toContain("participants.find((participant, index)");
  });

  it("does not duplicate the initiative commit command beside the authoritative encounter", () => {
    const routeStart = source.indexOf(
      '"/encounters/:encounterId/combat-round/commit-phase-initiative-resolution"',
    );
    const nextRoute = source.indexOf(
      'app.post("/encounters/:encounterId/combat-round/roll-attack"',
      routeStart,
    );
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).not.toContain("command: committed.command");
    expect(routeSource).toContain("commandEnvelope");
    expect(routeSource).toContain("encounter: saved.encounter");
    expect(routeSource).toContain("commitCombatParticipantStateMutations");
  });

  it("persists ordinary combat mutations through the revision-guarded split boundary", () => {
    const combatStart = source.indexOf('app.post("/encounters/:encounterId/combat-declaration"');
    const roleplayStart = source.indexOf(
      'app.post("/encounters/:encounterId/roleplay/stat-checks"',
      combatStart,
    );
    const combatRoutes = source.slice(combatStart, roleplayStart);

    expect(combatStart).toBeGreaterThanOrEqual(0);
    expect(roleplayStart).toBeGreaterThan(combatStart);
    expect(combatRoutes).toContain("updateCombatEncounter");
    expect(combatRoutes).toContain("commitCombatParticipantStateMutation");
    expect(combatRoutes).toContain("commitCombatParticipantStateMutations");
    expect(combatRoutes).not.toContain("encounterService.updateEncounter");
    expect(combatRoutes).not.toContain("encounterService.updateScenarioParticipantState");
    expect(combatRoutes.match(/expectedRevision: encounter\.updatedAt/g)?.length).toBeGreaterThan(
      20,
    );
  });

  it("warns operationally when the equipment snapshot lacks a canonical Secondary Critical code", () => {
    const routeStart = source.indexOf(
      'app.post("/encounters/:encounterId/combat-round/roll-attack"',
    );
    const nextRoute = source.indexOf("app.post(", routeStart + 1);
    const routeSource = source.slice(routeStart, nextRoute);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextRoute).toBeGreaterThan(routeStart);
    expect(routeSource).toContain("detectSnapshotSecondaryCriticalCodeGap({");
    expect(routeSource).toContain("request.log.warn(");
    expect(routeSource).toContain("SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE");
    // Report-only: the snapshot is compared, never written back.
    expect(routeSource).not.toContain("secondCrit =");
  });
});
