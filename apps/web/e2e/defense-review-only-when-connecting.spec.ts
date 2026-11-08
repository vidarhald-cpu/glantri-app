import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  advanceCombatRoundStep,
  buildCombatRoundAttackRollResult,
  buildCombatRoundDeclaredAttackOpportunities,
  combatRoundStateSchema,
  commitCombatRoundPhaseInitiativeResolution,
  initializeCombatRoundState,
  recordCombatRoundAttackResult,
  recordCombatRoundDeclaration,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundParticipantInitiative,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #832 — rendered GM evidence that the defense review is asked for only when there is
 * something to defend against, that the awareness checkbox is gone, that Main hand and Off hand
 * stay independently selectable, and that the selection names one DB/DM/P combination.
 *
 * ## Why the state is written rather than clicked through
 *
 * Reaching the defense substep through the UI needs declaration, modifier review, initiative and
 * an attack roll first, none of which this change touches. The round state is therefore composed
 * with the same exported domain functions the panel's own fixtures use and written through
 * `PUT /encounters/:id`, so the two cases differ in exactly one recorded fact: the attack result's
 * `hit`. `ob - defenderDb + rollTotal` decides it inside `resolveCombatToHit`; nothing here asserts
 * `hit` by hand.
 *
 * ## Why the absences are not vacuous
 *
 * The defense review is conditional, so "absent" proves nothing unless the surface that carries it
 * is mounted. The hit's absences are taken after clicking the defender's own enabled `P1` tracker
 * cell — the baseline mount condition — and are paired with the two per-hand checkboxes inside the
 * same region. Since #874 a miss has no `P1` parry step and no review task, so its absences are
 * taken with the inspector mounted on the defender, paired with the rendered miss result.
 *
 * ## Read method
 *
 * The review region's text, its checkbox states and the Defense / Parry mini-table's `DB | DM | P`
 * cells are read inside **one** `page.evaluate` together with `scrollY`. These pages autoscroll
 * after mount, so a read split across `await` boundaries straddles that scroll; `scrollY` is
 * quoted in every failure message so a garbage read is recognisable as one.
 */

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const SHIELD_TEMPLATE = "shield-template-medium-metal-shield";

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

/** A fighter with the Parry and Dodge skill the workbook defence rows need to derive DB/DM/P. */
function fighterPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 240,
        skills: ["brawling", "dodge", "one_handed_edged", "parry"].map((skillId) => ({
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          secondaryRanks: 9,
          skillId,
        })),
      },
    },
  };
}

interface ReviewRead {
  /** Whether the `Defense review choices` region is in the document at all. */
  regionPresent: boolean;
  /** Every checkbox inside that region, by accessible name and checked state. */
  checkboxes: Array<{ checked: boolean; name: string }>;
  /** Whether a checkbox named exactly for the removed awareness control is present. */
  awarenessPresent: boolean;
  /** Whether the removed implementation sentence is present. */
  implementationProsePresent: boolean;
  /** The region's trailing combination line, where one is rendered. */
  combinationLine: string | null;
  /** Every `DB | DM | P` mini-table on the page, as its three value cells. */
  miniTables: string[][];
  /** Whether the live `Commit defense review` control is mounted. */
  commitControlPresent: boolean;
  scrollY: number;
}

/** One atomic read of the review region, its controls and the page's DB/DM/P mini-tables. */
async function readReview(page: Page): Promise<ReviewRead> {
  return page.evaluate(() => {
    const region = document.querySelector('[aria-label="Defense review choices"]');
    const labelOf = (input: HTMLInputElement) =>
      (input.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim();
    const checkboxes = [...(region?.querySelectorAll('input[type="checkbox"]') ?? [])].map(
      (node) => {
        const input = node as HTMLInputElement;
        return { checked: input.checked, name: labelOf(input) };
      },
    );
    const spans = [...(region?.querySelectorAll(":scope > span") ?? [])].map((node) =>
      (node.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    const miniTables = [...document.querySelectorAll("table")]
      .filter((table) => {
        const headers = [...table.querySelectorAll("thead th")].map((cell) =>
          (cell.textContent ?? "").trim(),
        );
        return headers.length === 3 && headers.join("|") === "DB|DM|P";
      })
      .map((table) =>
        [...table.querySelectorAll("tbody td")].map((cell) => (cell.textContent ?? "").trim()),
      );
    return {
      awarenessPresent: checkboxes.some(
        (entry) => entry.name === "Defender is aware of this attack",
      ),
      checkboxes,
      combinationLine: spans.find((text) => text.includes(" · P ")) ?? null,
      commitControlPresent: [...document.querySelectorAll("button")].some(
        (button) => (button.textContent ?? "").trim() === "Commit defense review",
      ),
      implementationProsePresent: (document.body.textContent ?? "").includes(
        "This review is committed for this exact attack",
      ),
      miniTables,
      regionPresent: Boolean(region),
      scrollY: Math.round(window.scrollY),
    };
  });
}

function describe(what: string, read: ReviewRead): string {
  return `${what} (scrollY ${read.scrollY}): ${JSON.stringify(read)}`;
}

test.describe("Defense review is asked for only when the attack connects (#832)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("shows per-hand sources and one DB/DM/P combination on a hit, and no defense review at all on a miss", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(300_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    // ---- The defender: a fighter with a ready primary weapon and a ready shield. ----
    const characterId = `defense-review-832-${suffix}`;
    const characterName = `Defense Review Fighter ${suffix}`;
    const created = await playerContext.request.post(`${API_URL}/characters`, {
      data: fighterPayload(characterId, characterName),
    });
    expect(created.ok(), await created.text()).toBe(true);

    let equipmentRevision = (
      await json<{ state: { revision: number } }>(
        await playerContext.request.get(`${API_URL}/characters/${characterId}/equipment`),
      )
    ).state.revision;
    const addItem = async (templateId: string) => {
      const withItem = await post<{
        state: { itemsById: Record<string, { id: string; templateId?: string }>; revision: number };
      }>(playerContext.request, `/characters/${characterId}/equipment/items`, {
        expectedRevision: equipmentRevision,
        initialCarryMode: "equipped",
        initialLocationId: `${characterId}:loc-equipped`,
        quantity: 1,
        templateId,
      });
      equipmentRevision = withItem.state.revision;
      const itemId = Object.values(withItem.state.itemsById).find(
        (item) => item.templateId === templateId,
      )?.id;
      expect(itemId, `no item created for ${templateId}`).toBeTruthy();
      return itemId!;
    };
    const weaponItemId = await addItem(PRIMARY_WEAPON_TEMPLATE);
    const shieldItemId = await addItem(SHIELD_TEMPLATE);
    const setLoadout = async (field: string, itemId: string) => {
      const updated = await post<{ state: { revision: number } }>(
        playerContext.request,
        `/characters/${characterId}/equipment/loadout/${field}`,
        { expectedRevision: equipmentRevision, itemId },
      );
      equipmentRevision = updated.state.revision;
    };
    await setLoadout("active-primary-weapon", weaponItemId);
    await setLoadout("ready-shield", shieldItemId);

    // ---- Campaign, scenario, participants, encounter. ----
    const campaign = await post<{ campaign: { id: string } }>(gmPage.request, "/campaigns", {
      name: `Issue 832 Defense Review ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    await post(gmPage.request, `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    const scenario = await post<{ scenario: { id: string } }>(
      gmPage.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 832 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const defenderParticipant = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: playerUser.user.id },
    );
    await post(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${defenderParticipant.participant.id}/refresh-character-equipment`,
    );
    const attackerName = `Defense Review Attacker ${suffix}`;
    const attackerParticipant = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: attackerName, snapshot: { displayName: attackerName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const attackerCombatantId = `issue-832-attacker-${suffix}`;
    const defenderCombatantId = `issue-832-defender-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-832-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              id: attackerCombatantId,
              label: attackerName,
              participantType: "scenario",
              scenarioParticipantId: attackerParticipant.participant.id,
            },
            {
              characterId,
              id: defenderCombatantId,
              label: characterName,
              participantType: "scenario",
              scenarioParticipantId: defenderParticipant.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 832 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = encounter.encounter.id;
    const refreshed = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const activated = await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
    });
    expect(activated.ok(), await activated.text()).toBe(true);
    const activeEncounter = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );

    /**
     * Composes the round state up to the open defense review for one exact attack. `ob` and
     * `rollTotal` are the only difference between the two cases this spec reads.
     */
    const buildDefenseSubstepState = (input: {
      ob: number;
      rollTotal: number;
    }): CombatRoundState => {
      const experienced = [attackerCombatantId, defenderCombatantId].reduce(
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
          state: initializeCombatRoundState({ encounter: activeEncounter.encounter }),
        }),
      );
      expect(experienced.currentStep).toBe("select_actions");
      const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
        actionId: "attack_parry",
        participantId: attackerCombatantId,
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: defenderCombatantId,
          },
        },
        roundNumber: experienced.roundNumber,
        sources: {
          phase1: {
            attackModeId: "mode-1",
            sourceKind: "weapon",
            weaponInstanceId: "issue-832-attacker-sword",
            weaponSourceId: "item:issue-832-attacker-sword",
            weaponSourceSlot: "primary",
            weaponTemplateId: PRIMARY_WEAPON_TEMPLATE,
          },
        },
      });
      const emptyBuckets = {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      };
      const attackerDeclared = recordCombatRoundDeclaration({
        command: { createdAt: new Date().toISOString(), createdByUserId: "gm-1" },
        declaration: {
          actionId: "attack_parry",
          attackOpportunities,
          combatContext: { modifierBuckets: emptyBuckets },
          id: `issue-832-declaration-attacker-${suffix}`,
          phaseContexts: {
            phase1: {
              modifierBuckets: emptyBuckets,
              targetParticipantId: defenderCombatantId,
            },
          },
          roundNumber: experienced.roundNumber,
          submittedAt: new Date().toISOString(),
        },
        participantId: attackerCombatantId,
        state: experienced,
        submittedBy: "gm",
      });
      const bothDeclared = recordCombatRoundDeclaration({
        command: { createdAt: new Date().toISOString(), createdByUserId: "gm-1" },
        declaration: {
          actionId: "parry",
          combatContext: {
            modifierBuckets: emptyBuckets,
            selectedOpponentId: attackerCombatantId,
          },
          id: `issue-832-declaration-defender-${suffix}`,
          roundNumber: experienced.roundNumber,
          submittedAt: new Date().toISOString(),
        },
        participantId: defenderCombatantId,
        state: attackerDeclared,
        submittedBy: "gm",
      });
      let atInitiative = bothDeclared;
      for (
        let guard = 0;
        guard < 20 && atInitiative.currentStep !== "initiative_phase_1";
        guard += 1
      ) {
        atInitiative = advanceCombatRoundStep(atInitiative);
      }
      expect(atInitiative.currentStep).toBe("initiative_phase_1");
      const withInitiative = [attackerCombatantId, defenderCombatantId].reduce(
        (state, participantId, index) =>
          setCombatRoundParticipantInitiative({
            initiative: {
              baseInitiative: 0,
              modifierAdjustment: 0,
              rolls: [index === 0 ? 6 : 4],
              rollTotal: index === 0 ? 6 : 4,
              total: index === 0 ? 6 : 4,
            },
            participantId,
            phase: "phase1",
            state,
          }),
        atInitiative,
      );
      const resolved = commitCombatRoundPhaseInitiativeResolution({
        command: { createdAt: new Date().toISOString(), createdByUserId: "gm-1" },
        phase: "phase1",
        state: withInitiative,
        visibility: {
          [attackerCombatantId]: { [defenderCombatantId]: true },
          [defenderCombatantId]: { [attackerCombatantId]: true },
        },
      }).state;
      const opportunity = resolved.participants.find(
        (participant) => participant.participantId === attackerCombatantId,
      )?.declaration?.attackOpportunities?.[0];
      expect(opportunity, "the attacker must carry its declared attack opportunity").toBeTruthy();
      const attack = buildCombatRoundAttackRollResult({
        actionId: "attack_parry",
        attackIndex: opportunity!.attackIndex,
        attackModeId: opportunity!.attackModeId,
        attackOpportunityId: opportunity!.id,
        attackSlot: opportunity!.slot,
        attackerParticipantId: attackerCombatantId,
        declarationId: opportunity!.declarationId,
        defenderDb: 20,
        defenderParticipantId: defenderCombatantId,
        ob: input.ob,
        phase: "phase1",
        rollD20: 10,
        rollTotal: input.rollTotal,
        rolledAt: new Date().toISOString(),
        weaponInstanceId: opportunity!.weaponInstanceId,
        weaponName: "Long sword",
        weaponSourceId: opportunity!.weaponSourceId,
        weaponSourceSlot: opportunity!.weaponSourceSlot,
        weaponTemplateId: opportunity!.weaponTemplateId,
      });
      console.log(
        `#832 composed attack: ob=${input.ob} rollTotal=${input.rollTotal} lookupTotal=${attack.lookupTotal} hit=${attack.hit} tableResult=${attack.tableResult}`,
      );
      return combatRoundStateSchema.parse(
        recordCombatRoundAttackResult({
          command: { createdAt: attack.rolledAt, createdByUserId: "gm-1" },
          // #874: the roll-attack route passes the attacker's awareness default; this attacker is
          // visible, so a miss is resolved at the attack commit exactly as the route records it.
          defenderAware: true,
          participantId: attackerCombatantId,
          result: attack,
          state: resolved,
          submittedBy: "gm",
        }),
      );
    };

    const writeState = async (combatRoundState: CombatRoundState) => {
      const current = await json<{ encounter: EncounterSession }>(
        await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      const update = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
        data: {
          expectedRevision: current.encounter.updatedAt,
          session: {
            ...current.encounter,
            combatRoundState,
            currentRound: 1,
            status: "active",
          },
        },
      });
      expect(update.ok(), await update.text()).toBe(true);
    };

    /**
     * Opens the GM Combat surface and clicks the defender's own enabled `P1` tracker cell. That
     * click is the baseline mount condition: without it the GM Inspector renders a phase-wide
     * branch in which the Action Selector, and therefore the defense review, never mounts — so an
     * absence read before it would be vacuous.
     */
    const openDefenderParryCell = async () => {
      await gmPage.goto(
        `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
      );
      await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
      const cell = gmPage
        .getByRole("button", {
          name: new RegExp(`^${characterName} · Round 1 · P1:`),
        })
        .first();
      await expect(cell).toBeVisible();
      await expect(cell).toBeEnabled();
      await cell.click();
      await expect(gmPage.getByRole("heading", { name: /^Combat inspector — / })).toContainText(
        characterName,
      );
    };

    /**
     * The defender's scenario equipment reaches the panel through its own fetch, so the per-hand
     * source list mounts after the first paint. Waiting for both per-hand controls is what makes
     * the awareness-checkbox absence a read taken where that checkbox used to render; without it an
     * early read reports an empty region and every absence in it is vacuous.
     */
    const waitForPerHandSources = async () => {
      await expect(gmPage.getByRole("checkbox", { name: /^Main hand: / })).toBeVisible();
      await expect(gmPage.getByRole("checkbox", { name: /^Off hand: / })).toBeVisible();
    };

    // ================= CASE 1: the attack connects =================
    const hitState = buildDefenseSubstepState({ ob: 40, rollTotal: 10 });
    await writeState(hitState);
    await gmPage.setViewportSize({ height: 900, width: 1440 });
    await openDefenderParryCell();
    await expect(gmPage.locator('[aria-label="Defense review choices"]')).toBeVisible();
    await waitForPerHandSources();
    await gmPage
      .locator('[aria-label="Defense review choices"]')
      .screenshot({ path: "test-results/832-defense-review-hit-region.png" });
    await gmPage.screenshot({
      path: "test-results/832-defense-review-hit-1440.png",
      fullPage: true,
    });

    const hit = await readReview(gmPage);
    console.log(`#832 hit: ${JSON.stringify(hit)}`);
    expect(hit.regionPresent, describe("hit", hit)).toBe(true);
    expect(hit.commitControlPresent, describe("hit", hit)).toBe(true);
    // Acceptance 3: both hands are offered, and both start selected.
    expect(hit.checkboxes.map((entry) => entry.name).sort(), describe("hit", hit)).toHaveLength(2);
    const mainHandName = hit.checkboxes.find((entry) => entry.name.startsWith("Main hand: "))!.name;
    const offHandName = hit.checkboxes.find((entry) => entry.name.startsWith("Off hand: "))!.name;
    expect(mainHandName, describe("hit", hit)).toBeTruthy();
    expect(offHandName, describe("hit", hit)).toBeTruthy();
    expect(
      hit.checkboxes.every((entry) => entry.checked),
      describe("hit", hit),
    ).toBe(true);
    // Acceptance 5 and 7, asserted where the removed controls would have rendered: the region and
    // both per-hand checkboxes are mounted in this very read.
    expect(hit.awarenessPresent, describe("hit", hit)).toBe(false);
    expect(hit.implementationProsePresent, describe("hit", hit)).toBe(false);
    // Acceptance 4: the selection names one DB/DM/P combination, and it is the mini-table's.
    expect(hit.combinationLine, describe("hit", hit)).toBeTruthy();
    expect(hit.miniTables.length, describe("hit", hit)).toBeGreaterThan(0);
    const bothHandsCombination = hit.combinationLine!;
    const combinationValues = /· DB (.+?) · DM (.+?) · P (.+)$/.exec(bothHandsCombination);
    expect(combinationValues, describe("hit", hit)).not.toBeNull();
    const [, combinationDb, combinationDm, combinationParry] = combinationValues!;
    // Guard: a line of three dashes would make the comparison below vacuous.
    expect([combinationDb, combinationDm, combinationParry], describe("hit", hit)).not.toContain(
      "—",
    );
    expect(
      hit.miniTables.some(
        (values) => values.join("|") === [combinationDb, combinationDm, combinationParry].join("|"),
      ),
      `${describe("hit", hit)} — the combination ${JSON.stringify([
        combinationDb,
        combinationDm,
        combinationParry,
      ])} must be one of the rendered DB/DM/P mini-table rows`,
    ).toBe(true);

    // Acceptance 3 continued: either hand alone, and both again. Each click is followed by one
    // atomic read, so no comparison straddles the page's autoscroll.
    const clickSource = async (name: string) => {
      await gmPage.getByRole("checkbox", { name, exact: true }).click();
    };
    await clickSource(offHandName);
    const mainOnly = await readReview(gmPage);
    console.log(`#832 main hand only: ${JSON.stringify(mainOnly)}`);
    expect(
      mainOnly.checkboxes.find((entry) => entry.name === mainHandName)?.checked,
      describe("main only", mainOnly),
    ).toBe(true);
    expect(
      mainOnly.checkboxes.find((entry) => entry.name === offHandName)?.checked,
      describe("main only", mainOnly),
    ).toBe(false);
    expect(mainOnly.combinationLine, describe("main only", mainOnly)).not.toBe(
      bothHandsCombination,
    );

    await clickSource(mainHandName);
    await clickSource(offHandName);
    const offOnly = await readReview(gmPage);
    console.log(`#832 off hand only: ${JSON.stringify(offOnly)}`);
    expect(
      offOnly.checkboxes.find((entry) => entry.name === mainHandName)?.checked,
      describe("off only", offOnly),
    ).toBe(false);
    expect(
      offOnly.checkboxes.find((entry) => entry.name === offHandName)?.checked,
      describe("off only", offOnly),
    ).toBe(true);
    expect(offOnly.combinationLine, describe("off only", offOnly)).not.toBe(bothHandsCombination);
    expect(offOnly.combinationLine, describe("off only", offOnly)).not.toBe(
      mainOnly.combinationLine,
    );

    await clickSource(mainHandName);
    const bothAgain = await readReview(gmPage);
    console.log(`#832 both hands again: ${JSON.stringify(bothAgain)}`);
    expect(
      bothAgain.checkboxes.every((entry) => entry.checked),
      describe("both again", bothAgain),
    ).toBe(true);
    expect(bothAgain.combinationLine, describe("both again", bothAgain)).toBe(bothHandsCombination);

    // ================= CASE 2: the hit reloaded, same page =================
    /*
     * Before the miss is written: the same hit state on a fresh load mounts the region again, so the
     * miss's absences below cannot be explained by a fetch that had not landed yet. (The miss runs
     * last because since #874 it records one more command than the hit, and a later write may not
     * rewind the recorded command log.)
     */
    await writeState(hitState);
    await openDefenderParryCell();
    await expect(gmPage.locator('[aria-label="Defense review choices"]')).toBeVisible();
    await waitForPerHandSources();
    const restored = await readReview(gmPage);
    console.log(`#832 hit restored: ${JSON.stringify(restored)}`);
    expect(restored.regionPresent, describe("restored", restored)).toBe(true);
    expect(restored.checkboxes.length, describe("restored", restored)).toBe(2);
    expect(restored.awarenessPresent, describe("restored", restored)).toBe(false);
    expect(restored.combinationLine, describe("restored", restored)).toBe(bothHandsCombination);

    // ================= CASE 3: the attack already missed =================
    /*
     * Only one recorded fact changes: the attack result's `hit`. Everything else that decides
     * whether the review surface can mount — the same encounter, the same participants, the same
     * loaded scenario equipment and the same `P1` tracker cell — is held fixed, and case 1 above
     * has already shown on this very page that the region, both per-hand controls and the commit
     * control do mount under it. #874 (Product Owner ruling of 2026-11-08): the miss is recorded
     * at the attack commit, so no `commit_defense_review` task exists and neither the choices nor
     * the commit control may render. The inspector mounted on the defender and the rendered miss
     * result are the positive controls, and case 2 has just shown the region mounting again on a
     * fresh load of the hit.
     */
    const missState = buildDefenseSubstepState({ ob: 20, rollTotal: 3 });
    // #874: the miss is recorded at the attack commit and no defense review is scheduled for it.
    expect(
      missState.phaseResolutionCursor?.substep,
      "the miss leaves the defense substep at the attack commit",
    ).not.toBe("defense");
    await writeState(missState);
    // With no review owed there is no `P1` parry step, so no enabled `P1` cell to click: the miss
    // is read on the Combat surface with the defender selected through the inspector navigation.
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await expect(gmPage.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
    // Select the defender through the inspector's own participant navigation (bounded).
    const defenderHeading = gmPage.getByRole("heading", {
      name: new RegExp(`^Combat inspector — ${characterName} · `),
    });
    for (const direction of ["Next participant", "Previous participant"]) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (await defenderHeading.isVisible().catch(() => false)) break;
        const button = gmPage.getByRole("button", { name: direction, exact: true });
        if (!(await button.isVisible().catch(() => false))) break;
        await button.click();
        await gmPage.waitForTimeout(400);
      }
    }
    await expect(defenderHeading).toBeVisible();
    // Positive controls for the absences below: the inspector is mounted on the defender, and the
    // recorded miss is rendered on the defender's own `P1` tracker cell. (After a miss there is no Parry step, so the
    // defender's DB/DM/P mini-table has no step to mount on.)
    await expect(
      gmPage
        .getByRole("button", {
          name: new RegExp(
            `^${characterName} · Round 1 · P1: No parry required\\. The incoming attack missed\\.`,
          ),
        })
        .first(),
    ).toBeVisible();
    await gmPage.screenshot({
      path: "test-results/832-defense-review-miss-1440.png",
      fullPage: true,
    });
    const miss = await readReview(gmPage);
    console.log(`#832 miss: ${JSON.stringify(miss)}`);
    // #874: no review surface at all — neither the choices nor the commit control.
    expect(miss.commitControlPresent, describe("miss", miss)).toBe(false);
    expect(miss.regionPresent, describe("miss", miss)).toBe(false);
    expect(miss.checkboxes, describe("miss", miss)).toEqual([]);
    expect(miss.awarenessPresent, describe("miss", miss)).toBe(false);
    expect(miss.implementationProsePresent, describe("miss", miss)).toBe(false);

    await playerContext.close();
  });
});
