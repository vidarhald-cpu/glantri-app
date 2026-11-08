import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  buildCombatRoundDeclaredAttackOpportunities,
  combatRoundStateSchema,
  commitCombatRoundPhaseInitiativeResolution,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";
import { setScenarioParticipantVisibilityForTest } from "@glantri/database/testing/scenarioPrivacy";
import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function buildAttackRound(input: {
  attackerAId: string;
  attackerBId: string;
  sentinelId: string;
}): CombatRoundState {
  const stepStatuses = {
    initiative_phase_1: "submitted" as const,
    initiative_phase_2: "pending" as const,
    phase_1_actions: "pending" as const,
    phase_2_actions: "pending" as const,
    review_action_modifiers: "complete" as const,
    review_phase_2_actions: "pending" as const,
    review_phase_2_damage: "pending" as const,
    review_phase_2_modifiers: "pending" as const,
    round_summary: "pending" as const,
    select_actions: "submitted" as const,
  };
  const declaration = (participantId: string, attackModeId: string) => ({
    actionId: "double_attack",
    attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
      actionId: "double_attack",
      participantId,
      phaseContexts: {
        phase1: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: input.sentinelId,
        },
        phase2: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: input.sentinelId,
        },
      },
      roundNumber: 1,
      sources: {
        phase1: {
          attackModeId,
          sourceKind: "unarmed" as const,
          weaponSourceId: "unarmed:virtual-weapon-template-punch",
          weaponSourceSlot: "virtual",
          weaponTemplateId: "virtual-weapon-template-punch",
        },
        phase2: {
          attackModeId,
          sourceKind: "unarmed" as const,
          weaponSourceId: "unarmed:virtual-weapon-template-kick",
          weaponSourceSlot: "virtual",
          weaponTemplateId: "virtual-weapon-template-kick",
        },
      },
    }),
    committed: true,
    phaseContexts: {
      phase1: {
        attackModeId,
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetParticipantId: input.sentinelId,
      },
      phase2: {
        attackModeId,
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
        targetParticipantId: input.sentinelId,
      },
    },
    roundNumber: 1,
    secondaryActionId: "open",
    submittedAt: "2026-08-23T12:00:00.000Z",
    submittedBy: "player" as const,
  });
  const initial = combatRoundStateSchema.parse({
    commands: [],
    currentCursor: { participantId: input.attackerAId, roundNumber: 1, step: "i1" },
    currentStep: "initiative_phase_1",
    participants: [
      {
        attackResults: {},
        declaration: declaration(input.attackerAId, "mode-1"),
        initiatives: {
          phase1: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [6, 1],
            rollTotal: 7,
            total: 7,
          },
        },
        label: "Smoke Character",
        participantId: input.attackerAId,
        stepStatuses,
      },
      {
        attackResults: {},
        declaration: declaration(input.attackerBId, "mode-1"),
        initiatives: {
          phase1: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
        },
        label: "Smoke Non-holder Character",
        participantId: input.attackerBId,
        stepStatuses,
      },
      {
        attackResults: {},
        initiatives: {},
        label: "Initiative Sentinel",
        participantId: input.sentinelId,
        stepStatuses: { ...stepStatuses, initiative_phase_1: "skipped" },
      },
    ],
    phaseResolutionResults: [],
    phaseResolutionStatuses: {},
    roundNumber: 1,
    selectedParticipantId: input.attackerAId,
    selectedStep: "initiative_phase_1",
    stepSnapshots: [
      {
        attackSummary: {
          attackMode: "C",
          dmb: "0",
          initiative: "7",
          maxCrits: "BS",
          ob: "100",
          weaponName: "Unarmed",
        },
        committedAt: "2026-08-23T12:00:00.000Z",
        id: "snapshot-attacker-a",
        participantId: input.attackerAId,
        participantLabel: "Smoke Character",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
      {
        attackSummary: {
          attackMode: "C",
          dmb: "0",
          initiative: "4",
          maxCrits: "BS",
          ob: "90",
          weaponName: "Unarmed",
        },
        committedAt: "2026-08-23T12:00:00.000Z",
        id: "snapshot-attacker-b",
        participantId: input.attackerBId,
        participantLabel: "Smoke Non-holder Character",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
      {
        committedAt: "2026-08-23T12:00:00.000Z",
        defenseSummary: { db: "0", dm: "0", parry: "0", sourceName: "No defense" },
        id: "snapshot-sentinel-defense",
        participantId: input.sentinelId,
        participantLabel: "Initiative Sentinel",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
    ],
  });

  return commitCombatRoundPhaseInitiativeResolution({
    command: {
      commandId: "commit-material-initiative",
      createdAt: "2026-08-23T12:00:01.000Z",
      participantId: input.attackerAId,
    },
    nonParticipatingParticipantIds: new Set([input.sentinelId]),
    phase: "phase1",
    state: initial,
  }).state;
}

test.describe("Player attack initiative identity", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("keeps the first Player attack executable through reload and sends one canonical mutation", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(90_000);
    const suffix = Date.now();
    const playerAContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerBContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const unrelatedContext = await browser.newContext({
      storageState: "e2e/.auth/unrelated.json",
    });
    const anonymousContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const playerAUser = await json<{ user: { id: string } }>(
      await playerAContext.request.get(`${API_URL}/auth/me`),
    );
    const playerBUser = await json<{ user: { id: string } }>(
      await playerBContext.request.get(`${API_URL}/auth/me`),
    );
    const characterAId = `initiative-player-${suffix}`;
    const characterBId = `initiative-other-${suffix}`;
    const characterAName = `Initiative Player ${suffix}`;
    const characterBName = `Initiative Other ${suffix}`;
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterAId,
      name: characterAName,
      request: playerAContext.request,
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterBId,
      name: characterBName,
      request: playerBContext.request,
    });
    for (const [context, characterId] of [
      [playerAContext, characterAId],
      [playerBContext, characterBId],
    ] as const) {
      const equipment = await json<{ state: { revision: number } }>(
        await context.request.get(`${API_URL}/characters/${characterId}/equipment`),
      );
      await json(
        await context.request.post(
          `${API_URL}/characters/${characterId}/equipment/loadout/active-primary-weapon`,
          { data: { expectedRevision: equipment.state.revision, itemId: null } },
        ),
      );
    }

    const campaign = await json<{ campaign: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns`, {
        data: { name: `Issue 352 Initiative ${suffix}`, status: "active" },
      }),
    );
    for (const sourceId of [characterAId, characterBId]) {
      await json(
        await gmPage.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/roster`, {
          data: { category: "pc", sourceId, sourceType: "character" },
        }),
      );
    }
    const scenario = await json<{ scenario: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
        data: { name: `Issue 352 Scenario ${suffix}`, status: "live" },
      }),
    );
    const participantA = await json<{ participant: { id: string } }>(
      await gmPage.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
        { data: { characterId: characterAId, controlledByUserId: playerAUser.user.id } },
      ),
    );
    const participantB = await json<{ participant: { id: string } }>(
      await gmPage.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
        { data: { characterId: characterBId, controlledByUserId: playerBUser.user.id } },
      ),
    );
    let participantARevision: string | undefined;
    for (const participantId of [participantA.participant.id, participantB.participant.id]) {
      const refreshed = await json<{ participant: { id: string; updatedAt: string } }>(
        await gmPage.request.post(
          `${API_URL}/scenarios/${scenario.scenario.id}/participants/${participantId}/refresh-character-equipment`,
        ),
      );
      if (refreshed.participant.id === participantA.participant.id) {
        participantARevision = refreshed.participant.updatedAt;
      }
    }
    expect(participantARevision).toBeTruthy();
    const sentinel = await json<{ participant: { id: string } }>(
      await gmPage.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/entity`,
        {
          data: {
            entityInput: {
              kind: "npc",
              name: "Initiative Sentinel",
              snapshot: { displayName: "Initiative Sentinel" },
            },
            role: "enemy",
          },
        },
      ),
    );
    const hiddenWitness = await json<{ participant: { id: string } }>(
      await gmPage.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/entity`,
        {
          data: {
            entityInput: {
              kind: "npc",
              name: `Hidden initiative witness ${suffix}`,
              snapshot: { displayName: `Hidden initiative witness ${suffix}` },
            },
            role: "npc",
          },
        },
      ),
    );
    await setScenarioParticipantVisibilityForTest({
      participantId: hiddenWitness.participant.id,
      visibility: "gm_only",
    });

    const encounterParticipantIds = {
      attackerAId: `issue-352-attacker-a-${suffix}`,
      attackerBId: `issue-352-attacker-b-${suffix}`,
      sentinelId: `issue-352-sentinel-${suffix}`,
    };
    const combatRoundState = buildAttackRound(encounterParticipantIds);
    expect(combatRoundState.currentCursor).toMatchObject({
      participantId: encounterParticipantIds.attackerAId,
      step: "A1",
    });
    const now = new Date().toISOString();
    const encounterId = `issue-352-encounter-${suffix}`;
    const createdEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
        data: {
          session: {
            campaignId: campaign.campaign.id,
            combatRoundState,
            createdAt: now,
            currentRound: 1,
            id: encounterId,
            kind: "combat",
            participantMembershipMode: "explicit",
            participants: [
              {
                characterId: characterAId,
                id: encounterParticipantIds.attackerAId,
                label: characterAName,
                participantType: "scenario",
                scenarioParticipantId: participantA.participant.id,
              },
              {
                characterId: characterBId,
                id: encounterParticipantIds.attackerBId,
                label: characterBName,
                participantType: "scenario",
                scenarioParticipantId: participantB.participant.id,
              },
              {
                id: encounterParticipantIds.sentinelId,
                label: "Initiative Sentinel",
                participantType: "scenario",
                scenarioParticipantId: sentinel.participant.id,
              },
            ],
            scenarioId: scenario.scenario.id,
            status: "active",
            title: `Issue 352 Combat ${suffix}`,
            updatedAt: now,
          },
        },
      }),
    );
    await json(
      await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
        data: {
          expectedRevision: createdEncounter.encounter.updatedAt,
          session: {
            ...createdEncounter.encounter,
            combatRoundState,
            currentRound: 1,
            status: "active",
          },
        },
      }),
    );

    const playerHistory = await playerAContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-history`,
    );
    expect(playerHistory.ok(), await playerHistory.text()).toBe(true);
    const playerHistoryText = await playerHistory.text();
    const playerHistoryBody = JSON.parse(playerHistoryText) as {
      history: {
        currentAttackModifierValidation?: Record<string, unknown>;
        progression: {
          processes: Array<{
            stages: Array<{ tasks: Array<Record<string, unknown>> }>;
          }>;
        };
      };
    };
    const findAttackTask = (history: typeof playerHistoryBody.history) =>
      history.progression.processes
        .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
        .find((task) => task.kind === "attack");
    const playerAAttackTask = findAttackTask(playerHistoryBody.history);
    const playerAValidation = playerHistoryBody.history.currentAttackModifierValidation;
    expect(playerAAttackTask).toMatchObject({
      actorAccess: { combatant: true },
      identity: {
        attackIndex: 1,
        attackerParticipantId: encounterParticipantIds.attackerAId,
        defenderParticipantId: encounterParticipantIds.sentinelId,
        initiativeGroupId: expect.stringContaining(":initiative:7"),
        initiativeValue: 7,
        opportunityId: expect.stringContaining(":attack_1"),
      },
    });
    expect(playerAValidation).toMatchObject({
      attackContextAvailability: "complete",
      initiativeGroupId: expect.stringContaining(":initiative:7"),
      initiativeValue: 7,
      taskId: playerAAttackTask?.id,
    });
    expect(playerHistoryText).not.toContain(hiddenWitness.participant.id);
    expect(playerHistoryText).not.toContain(`Hidden initiative witness ${suffix}`);
    expect(playerHistoryText).not.toContain("defenderCalculation");
    expect(playerHistoryText).not.toContain("defenderInventory");

    const playerBHistoryResponse = await playerBContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-history`,
    );
    expect(playerBHistoryResponse.ok(), await playerBHistoryResponse.text()).toBe(true);
    const playerBHistoryText = await playerBHistoryResponse.text();
    const playerBHistoryBody = JSON.parse(playerBHistoryText) as typeof playerHistoryBody;
    const playerBAttackTask = findAttackTask(playerBHistoryBody.history);
    expect(playerBHistoryBody.history.currentAttackModifierValidation).toBeUndefined();
    expect(playerBAttackTask).toMatchObject({
      actorAccess: { combatant: false },
      automation: { authority: { kind: "unknown" }, eligibility: "unsupported" },
      identity: {
        attackerParticipantId: encounterParticipantIds.attackerAId,
        defenderParticipantId: encounterParticipantIds.sentinelId,
        phase: "phase1",
      },
    });
    expect(playerBAttackTask?.id).not.toBe(playerAAttackTask?.id);
    expect((playerBAttackTask?.identity as Record<string, unknown>).executionGroupId).not.toBe(
      (playerAAttackTask?.identity as Record<string, unknown>).executionGroupId,
    );
    for (const actionableField of [
      "attackIndex",
      "attackModeId",
      "initiativeGroupId",
      "initiativeValue",
      "opportunityId",
      "weaponSourceId",
      "weaponTemplateId",
    ]) {
      expect(playerBAttackTask?.identity).not.toHaveProperty(actionableField);
    }
    expect(JSON.stringify(playerBAttackTask)).not.toContain(String(playerAAttackTask?.id));
    expect(JSON.stringify(playerBAttackTask)).not.toContain(
      String((playerAAttackTask?.identity as Record<string, unknown>).opportunityId),
    );
    expect(playerBHistoryText).not.toContain(hiddenWitness.participant.id);
    expect(playerBHistoryText).not.toContain(`Hidden initiative witness ${suffix}`);
    expect(playerBHistoryText).not.toContain("defenderCalculation");
    expect(playerBHistoryText).not.toContain("defenderInventory");

    const foreignProbe = await unrelatedContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-history`,
    );
    expect(foreignProbe.status()).toBe(404);
    const anonymousProbe = await anonymousContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-history`,
    );
    expect(anonymousProbe.status()).toBe(401);

    const waitingPlayerPage = await playerBContext.newPage();
    await waitingPlayerPage.goto(
      `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player/combat`,
    );
    await expect(waitingPlayerPage.getByRole("button", { name: /Roll.*attack/i })).toHaveCount(0);
    await expect(waitingPlayerPage.getByText(`Hidden initiative witness ${suffix}`)).toHaveCount(0);
    await waitingPlayerPage.reload();
    await waitingPlayerPage.waitForTimeout(2_500);
    await expect(waitingPlayerPage.getByRole("button", { name: /Roll.*attack/i })).toHaveCount(0);
    await waitingPlayerPage.close();
    const reconnectedWaitingPlayerPage = await playerBContext.newPage();
    await reconnectedWaitingPlayerPage.goto(
      `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player/combat`,
    );
    await expect(
      reconnectedWaitingPlayerPage.getByRole("button", { name: /Roll.*attack/i }),
    ).toHaveCount(0);
    await expect(
      reconnectedWaitingPlayerPage.getByText(`Hidden initiative witness ${suffix}`),
    ).toHaveCount(0);
    await reconnectedWaitingPlayerPage.close();

    const playerBPolledHistoryResponse = await playerBContext.request.get(
      `${API_URL}/encounters/${encounterId}/combat-history`,
    );
    const playerBPolledHistory = (
      await json<typeof playerHistoryBody>(playerBPolledHistoryResponse)
    ).history;
    expect(playerBPolledHistory.currentAttackModifierValidation).toBeUndefined();
    expect(findAttackTask(playerBPolledHistory)?.identity).not.toHaveProperty("initiativeGroupId");

    for (const context of [unrelatedContext, anonymousContext]) {
      const deniedPage = await context.newPage();
      await deniedPage.goto(
        `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player/combat`,
      );
      await expect(deniedPage.getByRole("button", { name: /Roll.*attack/i })).toHaveCount(0);
      await expect(deniedPage.getByText(`Hidden initiative witness ${suffix}`)).toHaveCount(0);
      await deniedPage.close();
    }

    const before = await json<{
      encounter: { combatRoundState: CombatRoundState; updatedAt: string };
    }>(await gmPage.request.get(`${API_URL}/encounters/${encounterId}`));
    const beforeCommandCount = before.encounter.combatRoundState.commands.length;
    const actorIdentity = playerAAttackTask?.identity as Record<string, unknown>;
    const forgedPayload = {
      actionId: actorIdentity.actionId,
      attackIndex: actorIdentity.attackIndex,
      attackModeId: actorIdentity.attackModeId,
      declarationId: actorIdentity.declarationId,
      defenderParticipantId: actorIdentity.defenderParticipantId,
      effectCutoffInitiativeGroupId: playerAValidation?.effectCutoffInitiativeGroupId,
      executionGroupId: playerAAttackTask?.executionGroupId,
      expectedParticipantRevision: participantARevision,
      expectedRevision: playerAValidation?.expectedRevision,
      initiativeGroupId: playerAValidation?.initiativeGroupId,
      initiativeValue: playerAValidation?.initiativeValue,
      modifierValidationTaskId: playerAValidation?.taskId,
      opportunityId: actorIdentity.opportunityId,
      phase: actorIdentity.phase,
      scenarioParticipantId: participantA.participant.id,
      taskId: playerAAttackTask?.id,
      weaponInstanceId: actorIdentity.weaponInstanceId,
      weaponSourceId: actorIdentity.weaponSourceId,
      weaponSourceSlot: actorIdentity.weaponSourceSlot,
      weaponTemplateId: actorIdentity.weaponTemplateId,
    };
    const forgedAttackResponse = await playerBContext.request.post(
      `${API_URL}/encounters/${encounterId}/combat-round/roll-attack`,
      { data: forgedPayload },
    );
    expect(forgedAttackResponse.status()).toBe(403);
    const afterForge = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    expect(afterForge.encounter.combatRoundState.commands).toHaveLength(beforeCommandCount);
    expect(
      afterForge.encounter.combatRoundState.participants.find(
        (participant) => participant.participantId === encounterParticipantIds.attackerAId,
      )?.attackResults.phase1,
    ).toBeUndefined();

    const playerPage = await playerAContext.newPage();
    await playerPage.goto(
      `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player/combat`,
    );
    const rollAttack = playerPage.getByRole("button", { name: /Roll.*attack/i }).first();
    await expect(rollAttack).toBeVisible();
    await expect(rollAttack).toBeEnabled();
    await playerPage.reload();
    await playerPage.waitForTimeout(2_500);
    await expect(rollAttack).toBeVisible();
    await expect(rollAttack).toBeEnabled();
    await expect(playerPage.getByText(`Hidden initiative witness ${suffix}`)).toHaveCount(0);

    const attackRequests: Array<Record<string, unknown>> = [];
    playerPage.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/combat-round/roll-attack")) {
        attackRequests.push(request.postDataJSON() as Record<string, unknown>);
      }
    });
    const attackResponsePromise = playerPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/combat-round/roll-attack"),
    );
    await rollAttack.click();
    const attackResponse = await attackResponsePromise;
    expect(attackResponse.ok(), await attackResponse.text()).toBe(true);
    await expect.poll(() => attackRequests.length).toBe(1);
    expect(attackRequests[0]).toMatchObject({
      attackIndex: 1,
      effectCutoffInitiativeGroupId: expect.stringContaining(":initiative:7"),
      initiativeGroupId: expect.stringContaining(":initiative:7"),
      initiativeValue: 7,
      opportunityId: expect.stringContaining(":attack_1"),
      taskId: expect.any(String),
    });

    const after = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    expect(after.encounter.combatRoundState.commands).toHaveLength(beforeCommandCount + 1);
    expect(after.encounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: encounterParticipantIds.attackerAId,
      type: "roll_attack",
    });
    // #874 (amendment A4): the roll is real, so the cursor depends on its outcome. A hit opens the
    // sentinel's defense review at P1; a visible attacker's melee miss is recorded at the attack
    // commit with no defense review owed, so the cursor does not stop at a defense step.
    const playerAttack = after.encounter.combatRoundState.participants.find(
      (participant) => participant.participantId === encounterParticipantIds.attackerAId,
    )?.attackResults.phase1;
    console.log(
      `#874 player attack outcome: ${playerAttack?.hit ? "hit" : "miss"} (lookupTotal=${playerAttack?.lookupTotal}) cursor=${JSON.stringify(after.encounter.combatRoundState.currentCursor)}`,
    );
    if (playerAttack?.hit) {
      expect(after.encounter.combatRoundState.currentCursor).toMatchObject({
        participantId: encounterParticipantIds.sentinelId,
        step: "P1",
      });
    } else {
      expect(after.encounter.combatRoundState.currentCursor?.step).not.toBe("P1");
      expect(after.encounter.combatRoundState.phaseResolutionCursor?.substep).not.toBe("defense");
      expect(after.encounter.combatRoundState.commands.at(-1)?.facts.defenseReviewNotOwed).toBe(
        true,
      );
    }
    expect(
      after.encounter.combatRoundState.participants.find(
        (participant) => participant.participantId === encounterParticipantIds.attackerAId,
      )?.attackResults.phase1,
    ).toBeDefined();

    const replay = await playerAContext.request.post(
      `${API_URL}/encounters/${encounterId}/combat-round/roll-attack`,
      { data: attackRequests[0] },
    );
    expect(replay.status()).toBe(409);
    const afterReplay = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    expect(afterReplay.encounter.combatRoundState.commands).toHaveLength(beforeCommandCount + 1);

    const completedPlayerEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const pausedPlayerEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
        data: {
          expectedRevision: completedPlayerEncounter.encounter.updatedAt,
          status: "paused",
        },
      }),
    );
    await json(
      await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
        data: {
          expectedRevision: pausedPlayerEncounter.encounter.updatedAt,
          playerOutcome: "The initiative identity check is complete.",
          status: "completed",
        },
      }),
    );

    const gmEncounterId = `issue-352-gm-parity-${suffix}`;
    const gmEncounterCreatedAt = new Date().toISOString();
    const gmCreatedEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
        data: {
          session: {
            campaignId: campaign.campaign.id,
            combatRoundState,
            createdAt: gmEncounterCreatedAt,
            currentRound: 1,
            id: gmEncounterId,
            kind: "combat",
            participantMembershipMode: "explicit",
            participants: createdEncounter.encounter.participants,
            scenarioId: scenario.scenario.id,
            status: "active",
            title: `Issue 352 GM parity ${suffix}`,
            updatedAt: gmEncounterCreatedAt,
          },
        },
      }),
    );
    await json(
      await gmPage.request.put(`${API_URL}/encounters/${gmEncounterId}`, {
        data: {
          expectedRevision: gmCreatedEncounter.encounter.updatedAt,
          session: {
            ...gmCreatedEncounter.encounter,
            combatRoundState,
            currentRound: 1,
            status: "active",
          },
        },
      }),
    );
    const gmHistoryBody = await json<typeof playerHistoryBody>(
      await gmPage.request.get(`${API_URL}/encounters/${gmEncounterId}/combat-history`),
    );
    const gmAttackTask = findAttackTask(gmHistoryBody.history);
    const gmValidation = gmHistoryBody.history.currentAttackModifierValidation;
    expect(gmAttackTask).toMatchObject({
      actorAccess: { combatant: true, gm: true },
      id: playerAAttackTask?.id,
      identity: playerAAttackTask?.identity,
    });
    expect(gmValidation).toMatchObject({
      attackContextAvailability: "complete",
      initiativeGroupId: expect.stringContaining(":initiative:7"),
      initiativeValue: 7,
      taskId: gmAttackTask?.id,
    });
    const gmIdentity = gmAttackTask?.identity as Record<string, unknown>;
    const gmAttackPayload = {
      ...attackRequests[0],
      actionId: gmIdentity.actionId,
      attackIndex: gmIdentity.attackIndex,
      attackModeId: gmIdentity.attackModeId,
      declarationId: gmIdentity.declarationId,
      defenderParticipantId: gmIdentity.defenderParticipantId,
      effectCutoffInitiativeGroupId: gmValidation?.effectCutoffInitiativeGroupId,
      executionGroupId: gmAttackTask?.executionGroupId,
      expectedRevision: gmValidation?.expectedRevision,
      initiativeGroupId: gmValidation?.initiativeGroupId,
      initiativeValue: gmValidation?.initiativeValue,
      modifierValidationTaskId: gmValidation?.taskId,
      opportunityId: gmIdentity.opportunityId,
      taskId: gmAttackTask?.id,
    };
    const gmBefore = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
      await gmPage.request.get(`${API_URL}/encounters/${gmEncounterId}`),
    );
    const gmAttackResponse = await gmPage.request.post(
      `${API_URL}/encounters/${gmEncounterId}/combat-round/roll-attack`,
      { data: gmAttackPayload },
    );
    expect(gmAttackResponse.ok(), await gmAttackResponse.text()).toBe(true);
    const gmAfter = await json<{ encounter: { combatRoundState: CombatRoundState } }>(
      await gmPage.request.get(`${API_URL}/encounters/${gmEncounterId}`),
    );
    expect(gmAfter.encounter.combatRoundState.commands).toHaveLength(
      gmBefore.encounter.combatRoundState.commands.length + 1,
    );
    expect(gmAfter.encounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: encounterParticipantIds.attackerAId,
      type: "roll_attack",
    });
    expect(gmAfter.encounter.combatRoundState.currentCursor).toMatchObject({
      participantId: encounterParticipantIds.sentinelId,
      step: "P1",
    });

    await playerPage.close();
    await playerAContext.close();
    await playerBContext.close();
    await unrelatedContext.close();
    await anonymousContext.close();
  });
});
