import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  advanceCombatRoundStep,
  buildCombatCommittedDamagePublicOutcome,
  combatStepEventSchema,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";

/**
 * #863 V2 — the three rows of the board-game visibility ruling, measured on the real route and on
 * the rendered page.
 *
 * Row 1: a non-controller receives the declaration's action, secondary action, movement and target
 * **only after the declaration step closes**, and nothing while it is open.
 * Row 2: the committed damage amount, with no armour arithmetic.
 * Row 3: the critical grade, the hit location and the short critical result title — and no resolved
 * critical effect and no foreign continuing consequence.
 *
 * **Three accounts, three participations.** `player` holds the attacker, `non-holder` holds the
 * defender and `unrelated` holds a third combatant who controls neither side of the exchange. The
 * third account is the measurement subject: with only two participations every damage event's
 * `involvedParticipantIds` covers both viewers and there is no bystander left to measure. The GM
 * and the defender are kept as positive controls on the same head, so an assertion that would pass
 * by disclosing nothing to anybody is visible as such.
 *
 * **The load-bearing assertions are on the raw response body of
 * `GET /encounters/:id/combat-history`, not on what renders.** A field can be in the payload and
 * not drawn, so a rendered check cannot establish a negative. The rendered reads are the separate
 * composition evidence this change needs because it changes what the inspector draws.
 *
 * **Stated limitation.** Row 1's declarations are produced by the production writer
 * (`recordCombatRoundDeclaration`) driven here, so both of its timing directions are
 * product-driven. The `damage_committed` event is **constructed in this spec** from
 * `buildCombatCommittedDamagePublicOutcome`, the single shared definition that the canonical writer
 * (`recordCombatRoundCommitPhaseDamageCommand`) and the legacy derivation (`combatStepEvents.ts`)
 * both call. Driving a GM damage commit from a cold round through this fixture additionally needs a
 * committed defence review for the connecting attack, which is its own multi-call workflow; the
 * authoring is measured instead in `combatRoundManager.test.ts`, end to end through the real
 * production chain, on both writer paths. What this spec measures about rows 2 and 3 is therefore
 * the **projection and the rendering** of that bucket through the real HTTP route and the real
 * page, not its authoring.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

/** The exact critical the fixture commits, taken from the `sharp|arm|05` catalogue row. */
const CRITICAL_TITLE = "Forearm gash; hand unusable";
const CRITICAL_GRADE = "b";
const COMMITTED_DAMAGE = 17;
const HIT_LOCATION = "rightArm";

/**
 * Damage arithmetic and resolved-critical vocabulary, asserted as substrings of the **whole** raw
 * response body.
 *
 * These are safe to assert body-wide because the bystander rolls no damage, reviews nothing and is
 * not the GM, so none of them can legitimately appear anywhere in its payload. Measured: a naive
 * body-wide assertion on the *declaration*-private names fails honestly, because the bystander
 * controls its own combatant and therefore legitimately receives its own declaration's
 * `involvedOutcome` — including `submittedBy` — and its own Combat Experience roll's
 * `privateCalculation`. Those names are therefore asserted per foreign event below instead, which
 * is the claim this lane actually makes.
 */
const FORBIDDEN_BODY_SUBSTRINGS = [
  "armorModifier",
  "armorCriticalModifier",
  "damageLookupTotal",
  "damageRoll",
  "defenderDm",
  "hitLookupTotal",
  "effectiveArmorClass",
  "effectiveArmorValue",
  "effectiveArmorCoverageLabel",
  "bleedRate",
  "bleedKind",
  "mortality",
  "urgency",
  "selfStaunch",
  "treatment",
  "followUpRisk",
  "gmReview",
] as const;

/**
 * Every field the issue names as staying private, asserted against the serialized projection of a
 * **foreign** event — one the bystander neither declared nor rolled nor is involved in. This is
 * where row 1's and row 2's private lists bite.
 */
const FORBIDDEN_FOREIGN_EVENT_SUBSTRINGS = [
  ...FORBIDDEN_BODY_SUBSTRINGS,
  "dmb",
  "additionalActionNotes",
  "intent",
  "movementIntent",
  "movementId",
  "phaseContexts",
  "secondaryActionContext",
  "secondaryActionId",
  "submittedBy",
  "involvedOutcome",
  "privateCalculation",
  "rollerPrivate",
] as const;

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function post<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown = {},
): Promise<T> {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

interface ProjectedEvent {
  readonly facts: {
    readonly gmReview?: Record<string, unknown>;
    readonly involvedOutcome?: Record<string, unknown>;
    readonly privateCalculation?: Record<string, unknown>;
    readonly publicOutcome: Record<string, unknown>;
  };
  readonly identities: ReadonlyArray<{ displayName: string; role: string }>;
  readonly ownerParticipantId?: string;
  readonly type: string;
}

/**
 * The raw body and the parsed body from one request, returned together so that an assertion on a
 * field and the negative assertion on the text it came from read the same bytes.
 */
async function readCombatHistory(input: {
  context: APIRequestContext;
  encounterId: string;
}): Promise<{ consequences: unknown[]; events: ProjectedEvent[]; raw: string }> {
  const response = await input.context.get(
    `${API_URL}/encounters/${input.encounterId}/combat-history`,
  );
  const raw = await response.text();
  if (!response.ok()) throw new Error(`${response.status()} ${raw}`);
  const body = JSON.parse(raw) as {
    history: {
      activeRound: { events: ProjectedEvent[] };
      archivedRounds: Array<{ events: ProjectedEvent[] }>;
      currentConsequences: unknown[];
    };
  };
  return {
    consequences: body.history.currentConsequences,
    events: [
      ...body.history.archivedRounds.flatMap((round) => round.events),
      ...body.history.activeRound.events,
    ],
    raw,
  };
}

function eventOfType(events: ProjectedEvent[], type: string, ownerParticipantId?: string) {
  return events.find(
    (entry) =>
      entry.type === type &&
      (ownerParticipantId === undefined || entry.ownerParticipantId === ownerParticipantId),
  );
}

/** Whole rendered text of the inspector's result panel, read in one `page.evaluate`. */
async function readResultPanel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll("section[aria-label]")).find((node) =>
      (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
    );
    return panel ? (panel.textContent ?? "").replace(/\s+/g, " ").trim() : "";
  });
}

/**
 * Clicks one named tracker cell and returns the rendered result panel.
 *
 * The cell is addressed by its own `title`, which `buildProjectedCombatTrackerModel` writes as
 * `<participant label> · Round <n> · <ABBREVIATION>: <hover text>`. Addressing the participant
 * explicitly is load-bearing: the inspector shows one row at a time, and walking the cursor with
 * `Next step` alone lands on whichever row it started on — measured, it opened on the bystander's
 * own Pass declaration, which is exactly the row this measurement must not read.
 */
async function inspectCell(input: {
  abbreviation: string;
  label: string;
  page: Page;
}): Promise<string> {
  const cell = input.page.locator(
    `button[title^="${input.label} · Round 1 · ${input.abbreviation}"]`,
  );
  await expect(
    cell,
    `the ${input.label} / ${input.abbreviation} cell must be rendered`,
  ).toHaveCount(1);
  await cell.click();
  await input.page.waitForTimeout(250);
  return readResultPanel(input.page);
}

test.describe("Player Combat visibility V2 — public declaration content, committed damage, critical facts (#863)", () => {
  test.use({ storageState: "e2e/.auth/gm.json", viewport: { height: 900, width: 1280 } });

  test("publishes declaration content only after the step closes, and the committed damage and critical facts, to a bystander", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(300_000);
    const suffix = Date.now();
    const attackerContext = await browser.newContext({
      storageState: "e2e/.auth/player.json",
      viewport: { height: 900, width: 1280 },
    });
    const defenderContext = await browser.newContext({
      storageState: "e2e/.auth/non-holder.json",
    });
    const bystanderContext = await browser.newContext({
      storageState: "e2e/.auth/unrelated.json",
      viewport: { height: 900, width: 1280 },
    });

    const roles = [
      { context: attackerContext, key: "attacker" as const },
      { context: defenderContext, key: "defender" as const },
      { context: bystanderContext, key: "bystander" as const },
    ];
    const characters = await Promise.all(
      roles.map(async (role) => {
        const { user } = await json<{ user: { id: string } }>(
          await role.context.request.get(`${API_URL}/auth/me`),
        );
        return {
          context: role.context,
          id: `v2-${role.key}-${suffix}`,
          key: role.key,
          name: `V2 ${role.key} ${suffix}`,
          userId: user.id,
        };
      }),
    );
    for (const character of characters) {
      const created = await character.context.request.post(`${API_URL}/characters`, {
        data: characterPayload(character.id, character.name),
      });
      expect(created.ok(), await created.text()).toBe(true);
    }

    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 863 Visibility ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const character of characters) {
      await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId: character.id,
        sourceType: "character",
      });
    }
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 863 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const scenarioParticipantIdByKey: Record<string, string> = {};
    for (const character of characters) {
      const participant = await post<{ participant: { id: string } }>(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/character`,
        { characterId: character.id, controlledByUserId: character.userId },
      );
      scenarioParticipantIdByKey[character.key] = participant.participant.id;
      await post(
        gmPage.request,
        `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
      );
    }

    const now = new Date().toISOString();
    const combatantIdByKey = {
      attacker: `issue-863-${characters[0]!.id}`,
      defender: `issue-863-${characters[1]!.id}`,
      bystander: `issue-863-${characters[2]!.id}`,
    };
    const created = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-863-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: characters.map((character) => ({
            characterId: character.id,
            id: combatantIdByKey[character.key],
            label: character.name,
            participantType: "scenario",
            scenarioParticipantId: scenarioParticipantIdByKey[character.key],
          })),
          scenarioId,
          status: "active",
          title: `Issue 863 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = created.encounter.id;
    const refreshed = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const activated = await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
    });
    expect(activated.ok(), await activated.text()).toBe(true);
    let latest = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );

    /** Writes a round state onto the live encounter and refreshes the local revision. */
    const persist = async (combatRoundState: CombatRoundState) => {
      const update = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
        data: {
          expectedRevision: latest.encounter.updatedAt,
          session: { ...latest.encounter, combatRoundState, currentRound: 1, status: "active" },
        },
      });
      expect(update.ok(), await update.text()).toBe(true);
      latest = await json<{ encounter: EncounterSession }>(
        await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
      );
    };

    // Round 1 opens on the Combat Experience check, which gates declaration.
    const combatantIds = [
      combatantIdByKey.attacker,
      combatantIdByKey.defender,
      combatantIdByKey.bystander,
    ];
    const afterExperience = combatantIds.reduce(
      (state, participantId, index) =>
        rollCombatRoundCombatExperience({
          command: { createdAt: new Date(Date.now() + index).toISOString() },
          participantId,
          rng: () => 0.6,
          skillTotal: 26,
          state,
        }).state,
      setCombatRoundCombatExperienceDifficulty({
        difficulty: 26,
        state: initializeCombatRoundState({ encounter: latest.encounter }),
      }),
    );
    expect(afterExperience.currentStep).toBe("select_actions");

    /*
     * The attacker declares a single attack on the defender with a secondary action and a held
     * position, so all three of row 1's public labels and the declared target exist on one event.
     */
    const declaredState = recordCombatRoundDeclaration({
      command: { createdAt: new Date(Date.now() + 120).toISOString() },
      declaration: {
        actionId: "attack_parry",
        additionalActionNotes: "Hold the doorway.",
        movementIntent: { distancePreferences: [], mode: "hold_position" },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: combatantIdByKey.defender,
          },
        },
        roundNumber: 1,
        secondaryActionId: "talk_shout",
      },
      participantId: combatantIdByKey.attacker,
      state: recordCombatRoundDeclaration({
        command: { createdAt: new Date(Date.now() + 110).toISOString() },
        declaration: { actionId: "parry", roundNumber: 1 },
        participantId: combatantIdByKey.defender,
        state: recordCombatRoundDeclaration({
          command: { createdAt: new Date(Date.now() + 100).toISOString() },
          declaration: { actionId: "pass", roundNumber: 1 },
          participantId: combatantIdByKey.bystander,
          state: afterExperience,
          submittedBy: "player",
        }),
        submittedBy: "player",
      }),
      submittedBy: "player",
    });
    expect(
      declaredState.currentStep,
      "positive control: the measurement below is taken while the declaration step is genuinely open",
    ).toBe("select_actions");

    // ---- Row 1, the withheld direction, on the raw body ----
    await persist(declaredState);
    const openStep = await readCombatHistory({ context: bystanderContext.request, encounterId });
    const openDeclaration = eventOfType(openStep.events, "declaration", combatantIdByKey.attacker);
    expect(
      openDeclaration,
      "bystander, step open: the declaration event itself is still admitted as a progression fact",
    ).toBeDefined();
    expect(
      openDeclaration?.facts.publicOutcome,
      "bystander, step open: no committed declaration content",
    ).toEqual({});
    expect(openDeclaration?.facts.involvedOutcome).toBeUndefined();
    expect(
      openDeclaration?.identities.map((identity) => identity.role),
      "bystander, step open: the declared target is not named",
    ).not.toContain("target");
    expect(
      openStep.raw,
      "bystander, step open: the declared action label is nowhere in the raw body",
    ).not.toContain("Single attack");
    expect(openStep.raw).not.toContain("Talk / Shout");
    expect(openStep.raw).not.toContain("Hold position");

    // The control on the other side of the same gate, at the same moment: the declarer sees it.
    const declarerWhileOpen = await readCombatHistory({
      context: attackerContext.request,
      encounterId,
    });
    expect(
      eventOfType(declarerWhileOpen.events, "declaration", combatantIdByKey.attacker)?.facts
        .involvedOutcome?.actionLabel,
      "the declarer's own declaration is unaffected while the step is open",
    ).toBe("Single attack");
    // And the GM, who was never gated.
    const gmWhileOpen = await readCombatHistory({ context: gmPage.request, encounterId });
    expect(gmWhileOpen.raw).toContain("Hold the doorway.");

    /*
     * ---- Close the round, so every step becomes historical ----
     *
     * Bounded loop. `advanceCombatRoundStep` throws `Round-end review incomplete.` at
     * `round_summary`, so the bound is both the guard and the stop condition. Advancing also makes
     * every visible step `stageReached`, which is what lets the rendered inspector land on the D1
     * cell further down — the tracker refuses to draw the cursor past the shared board's own step.
     */
    let roundState = declaredState;
    for (
      let advance = 0;
      advance < 16 && roundState.currentStep !== "round_summary";
      advance += 1
    ) {
      roundState = advanceCombatRoundStep(roundState, {
        command: { createdAt: new Date(Date.now() + 200 + advance).toISOString() },
      });
    }
    expect(roundState.currentStep).toBe("round_summary");

    /*
     * The committed-damage event, in the buckets the production writers use. The public bucket is
     * built by `buildCombatCommittedDamagePublicOutcome`, the one shared definition both writers
     * call, so this fixture cannot drift from what they author. The private buckets are populated
     * on purpose, with the exact field names the issue says stay private, so the negative
     * assertions below measure withholding rather than absence.
     */
    const damageEvent = combatStepEventSchema.parse({
      attackResultId: `1:phase1:${combatantIdByKey.attacker}:${combatantIdByKey.defender}`,
      attackerParticipantId: combatantIdByKey.attacker,
      completeness: "complete",
      defenderParticipantId: combatantIdByKey.defender,
      encounterId,
      facts: {
        gmReview: {
          computedCriticalGrade: "c",
          review: {
            bleedKind: "external",
            bleedRate: "1/3",
            criticalEffectProposal: { title: CRITICAL_TITLE },
            mortality: "none",
            selfStaunch: false,
            treatment: "surgery",
            urgency: "immediate",
          },
        },
        involvedOutcome: {
          criticalGrade: CRITICAL_GRADE,
          criticalTitle: CRITICAL_TITLE,
          finalCommittedDamage: COMMITTED_DAMAGE,
          hitLocation: HIT_LOCATION,
        },
        publicOutcome: buildCombatCommittedDamagePublicOutcome({
          criticalGrade: CRITICAL_GRADE,
          criticalTitle: CRITICAL_TITLE,
          finalCommittedDamage: COMMITTED_DAMAGE,
          hitLocation: HIT_LOCATION,
        }),
        rollerPrivate: {
          armorModifier: -8,
          damageLookupTotal: 94,
          damageRoll: 12,
          defenderDm: 0,
          dmb: 8,
          hitLookupTotal: 94,
        },
      },
      id: `issue-863-damage-committed-${suffix}`,
      missingFacts: [],
      occurredAt: new Date(Date.now() + 400).toISOString(),
      ownerParticipantId: combatantIdByKey.defender,
      phase: "phase1",
      rollerParticipantId: combatantIdByKey.attacker,
      roundNumber: 1,
      schemaVersion: 1,
      sequence: roundState.events.length + 1,
      source: { kind: "canonical", sourceIds: [] },
      status: "committed",
      step: "phase_1_damage",
      targetParticipantId: combatantIdByKey.defender,
      type: "damage_committed",
      visibility: {
        identityRefs: [
          { participantId: combatantIdByKey.attacker, role: "attacker" },
          { participantId: combatantIdByKey.defender, role: "defender" },
          { participantId: combatantIdByKey.defender, role: "target" },
        ],
        involvedParticipantIds: [combatantIdByKey.attacker, combatantIdByKey.defender],
        outcomeScope: "involved",
        rollerParticipantId: combatantIdByKey.attacker,
      },
    });
    await persist({ ...roundState, events: [...roundState.events, damageEvent] });

    // ---- Rows 1, 2 and 3, the published direction, on the raw body ----
    const published = await readCombatHistory({ context: bystanderContext.request, encounterId });
    const publishedDeclaration = eventOfType(
      published.events,
      "declaration",
      combatantIdByKey.attacker,
    );
    expect(publishedDeclaration?.facts.publicOutcome.actionLabel).toBe("Single attack");
    expect(publishedDeclaration?.facts.publicOutcome.secondaryActionLabel).toBe("Talk / Shout");
    expect(publishedDeclaration?.facts.publicOutcome.movementLabel).toBe("Hold position");
    expect(
      publishedDeclaration?.identities.find((identity) => identity.role === "target")?.displayName,
      "bystander, step closed: the declared target rides free on the Declaration row",
    ).toBe(`V2 defender ${suffix}`);
    expect(
      publishedDeclaration?.facts.involvedOutcome,
      "bystander, step closed: only the public bucket opened",
    ).toBeUndefined();

    const publishedDamage = eventOfType(published.events, "damage_committed");
    expect(publishedDamage, "bystander: the committed damage event arrives").toBeDefined();
    expect(publishedDamage?.facts.publicOutcome.finalCommittedDamage).toBe(COMMITTED_DAMAGE);
    expect(publishedDamage?.facts.publicOutcome.criticalGrade).toBe(CRITICAL_GRADE);
    expect(publishedDamage?.facts.publicOutcome.hitLocation).toBe(HIT_LOCATION);
    expect(publishedDamage?.facts.publicOutcome.criticalTitle).toBe(CRITICAL_TITLE);
    expect(publishedDamage?.facts.involvedOutcome).toBeUndefined();
    expect(publishedDamage?.facts.privateCalculation).toBeUndefined();
    expect(publishedDamage?.facts.gmReview).toBeUndefined();
    expect(
      published.events.some((entry) => entry.type === "damage_proposed"),
      "bystander: damage_proposed is still refused",
    ).toBe(false);

    /*
     * The negative assertions. Two scopes, for the reason recorded on the two constants above: the
     * damage and resolved-critical vocabulary is asserted across the whole raw body, and the
     * declaration-private and bucket names are asserted on the two **foreign** events, because the
     * bystander legitimately receives its own participant's declaration and its own roll.
     */
    for (const field of FORBIDDEN_BODY_SUBSTRINGS) {
      expect(
        published.raw,
        `bystander: ${field} must not appear anywhere in the raw combat-history body`,
      ).not.toContain(field);
    }
    const foreignEvents = JSON.stringify([publishedDeclaration, publishedDamage]);
    for (const field of FORBIDDEN_FOREIGN_EVENT_SUBSTRINGS) {
      expect(
        foreignEvents,
        `bystander: ${field} must not appear in a foreign event's projected payload`,
      ).not.toContain(field);
    }
    expect(
      published.consequences,
      "bystander: no continuing-consequence entry for a participant the viewer does not control",
    ).toEqual([]);

    /*
     * Positive controls on the same head, so none of the negatives above can be passing because
     * nobody receives anything.
     */
    const gmHistory = await readCombatHistory({ context: gmPage.request, encounterId });
    expect(eventOfType(gmHistory.events, "damage_committed")?.facts.gmReview).toBeDefined();
    expect(gmHistory.raw, "GM control: the private material exists on this head").toContain(
      "armorModifier",
    );
    expect(gmHistory.raw, "GM control: the resolved critical effect exists on this head").toContain(
      "bleedRate",
    );
    const defenderHistory = await readCombatHistory({
      context: defenderContext.request,
      encounterId,
    });
    expect(
      eventOfType(defenderHistory.events, "damage_committed")?.facts.involvedOutcome
        ?.finalCommittedDamage,
      "defender control: an involved party still receives the involved bucket",
    ).toBe(COMMITTED_DAMAGE);

    // ---- Rendered evidence, player and GM ----
    const bystanderPage = await bystanderContext.newPage();
    await bystanderPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    await expect(bystanderPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();
    const bystanderDeclarationPanel = await inspectCell({
      abbreviation: "DE",
      label: `V2 attacker ${suffix}`,
      page: bystanderPage,
    });
    expect(
      bystanderDeclarationPanel,
      "bystander rendered: the committed declaration content is drawn",
    ).toContain("Action: Single attack");
    expect(bystanderDeclarationPanel).toContain("Secondary action: Talk / Shout");
    expect(bystanderDeclarationPanel).toContain("Movement: Hold position");
    await bystanderPage.screenshot({
      fullPage: true,
      path: "test-results/issue-863-player-declaration.png",
    });

    const bystanderDamagePanel = await inspectCell({
      abbreviation: "D1",
      label: `V2 defender ${suffix}`,
      page: bystanderPage,
    });
    expect(bystanderDamagePanel, "bystander rendered: the committed amount is drawn").toContain(
      `received ${COMMITTED_DAMAGE} damage`,
    );
    expect(bystanderDamagePanel, "bystander rendered: the critical grade is drawn").toContain(
      `Critical ${CRITICAL_GRADE.toUpperCase()} committed.`,
    );
    expect(bystanderDamagePanel, "bystander rendered: the critical title is drawn").toContain(
      `Critical result: ${CRITICAL_TITLE}`,
    );
    for (const field of FORBIDDEN_FOREIGN_EVENT_SUBSTRINGS) {
      expect(bystanderDamagePanel, `bystander rendered: ${field} must not be drawn`).not.toContain(
        field,
      );
    }
    await bystanderPage.screenshot({
      fullPage: true,
      path: "test-results/issue-863-player-damage.png",
    });

    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await expect(gmPage.getByRole("heading", { name: /^Combat inspector — / })).toBeVisible();
    await expect(gmPage.locator('[aria-label="Combat round timeline grid"]')).toBeVisible();
    const gmDamagePanel = await inspectCell({
      abbreviation: "D1",
      label: `V2 defender ${suffix}`,
      page: gmPage,
    });
    expect(gmDamagePanel, "GM rendered: the GM also sees the critical result title").toContain(
      `Critical result: ${CRITICAL_TITLE}`,
    );
    await gmPage.screenshot({ fullPage: true, path: "test-results/issue-863-gm-damage.png" });

    await bystanderPage.close();
    await attackerContext.close();
    await defenderContext.close();
    await bystanderContext.close();
  });
});
