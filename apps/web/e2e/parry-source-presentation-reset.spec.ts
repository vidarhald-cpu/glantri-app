import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";

/**
 * Forgejo #782, QA finding F1 — rendered regression evidence that the Defense/Parry mini-table's
 * **presentation** choice of defensive mode does not outlive the selector that made it.
 *
 * The defect this binds: picking a derived defensive row under `Single attack` kept governing the
 * displayed DB/DM/P after the declaration changed to `Parry`, where the selector is deliberately
 * not offered. The panel then showed, and named, a row chosen under a different declaration, with
 * no control on screen to change or clear it — measured as DB low by 5 and Parry low by 6.
 *
 * ## Locator method
 *
 * The defence mini-table is located by its **actual** header row, `DB | DM | P`. QA's first probe
 * looked for a `<th>` reading `Parry`, matched nothing, and compared `[]` against `[]` green. Every
 * read here therefore asserts three value cells, and every "went back to the default" comparison is
 * preceded by a guard that the chosen row genuinely differs from the default one.
 *
 * ## Read method
 *
 * The three values and the source cell's text are read inside **one** `page.evaluate`, together
 * with `scrollY`. These pages autoscroll after mount (`CombatLog` calls `scrollIntoView`), so reads
 * split across `await` boundaries straddle that scroll; `scrollY` is quoted in every failure
 * message so a garbage read is recognisable as one.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

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

/** A fighter with enough combat skill for an attack to resolve through a real competency. */
function fighterPayload(id: string, name: string) {
  const payload = characterPayload(id, name);
  return {
    build: {
      ...payload.build,
      progression: {
        ...payload.build.progression,
        secondaryPoolTotal: 240,
        // Parry and Dodge are what the workbook defence rows need: without `parryCombatSkillXp`
        // and `dodgeCombatSkillXp` every derived DB/DM/Parry is "—", so there are no defensive
        // modes to choose between and no parry source to select.
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

function phaseSection(page: Page, label: "Phase 1" | "Phase 2") {
  return page.locator(`section:has(> div > strong:text-is("${label}"))`).first();
}

interface DefenseRead {
  /** The text of the source/name cell that sits beside the mini-table. */
  sourceCell: string;
  /** Whether a `Parry source` selector is rendered in that cell. */
  selectorOffered: boolean;
  /** The selector's current value, where one is offered. */
  selectorValue: string | null;
  /** The selected option's label (`Name \u00b7 Mode`), where a selector is offered. */
  selectedLabel: string | null;
  /** How many `<option>`s the selector offers. */
  optionCount: number;
  scrollY: number;
  /** The `DB | DM | P` value cells. Asserted to be exactly three before anything is compared. */
  values: string[];
}

/**
 * Reads the Defense/Parry mini-table of one phase panel atomically. The table is the one whose
 * header row is exactly `DB`, `DM`, `P`.
 */
async function readDefenseTable(page: Page, label: string): Promise<DefenseRead> {
  return page.evaluate((phaseLabel) => {
    const section = [...document.querySelectorAll("section")].find(
      (candidate) =>
        candidate.querySelector(":scope > div > strong")?.textContent?.trim() === phaseLabel,
    );
    const table = [...(section?.querySelectorAll("table") ?? [])].find((candidate) => {
      const headers = [...candidate.querySelectorAll("thead th")].map((cell) =>
        (cell.textContent ?? "").trim(),
      );
      return headers.length === 3 && headers.join("|") === "DB|DM|P";
    });
    const sourceCell = table?.previousElementSibling as HTMLElement | null;
    const selector = sourceCell?.querySelector("select") ?? null;
    return {
      optionCount: selector ? selector.options.length : 0,
      scrollY: Math.round(window.scrollY),
      selectedLabel: selector
        ? (selector.options[selector.selectedIndex]?.textContent ?? "").trim()
        : null,
      selectorOffered: Boolean(selector),
      selectorValue: selector ? selector.value : null,
      sourceCell: (sourceCell?.textContent ?? "").trim(),
      values: [...(table?.querySelectorAll("tbody td") ?? [])].map((cell) =>
        (cell.textContent ?? "").trim(),
      ),
    };
  }, label);
}

function describeRead(what: string, read: DefenseRead): string {
  return `${what} (scrollY ${read.scrollY}): ${JSON.stringify(read)}`;
}

test.describe("Parry source presentation selection does not outlive its selector (#782 F1)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("drops the chosen defensive mode when the declaration closes the selector's gate", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(300_000);
    const suffix = Date.now();
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    // ---- A multi-source fighter: ready primary weapon + ready shield + intrinsic unarmed. ----
    const characterId = `parry-reset-${suffix}`;
    const characterName = `Parry Reset Fighter ${suffix}`;
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
      name: `Issue 782 Parry Reset ${suffix}`,
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
      { name: `Issue 782 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const participant = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId, controlledByUserId: playerUser.user.id },
    );
    await post(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/${participant.participant.id}/refresh-character-equipment`,
    );
    const targetName = `Parry Reset Target ${suffix}`;
    const target = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: targetName, snapshot: { displayName: targetName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const fighterCombatantId = `issue-782-fighter-${suffix}`;
    const targetCombatantId = `issue-782-target-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-782-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId,
              id: fighterCombatantId,
              label: characterName,
              participantType: "scenario",
              scenarioParticipantId: participant.participant.id,
            },
            {
              id: targetCombatantId,
              label: targetName,
              participantType: "scenario",
              scenarioParticipantId: target.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 782 Combat ${suffix}`,
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
    // Round 1 opens with a Combat Experience check that gates the declaration controls. Resolving
    // it is scaffolding, exactly as the GM panel's own fixtures do it.
    const combatRoundState = [fighterCombatantId, targetCombatantId].reduce(
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
    expect(combatRoundState.currentStep).toBe("select_actions");
    const stateUpdate = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: activeEncounter.encounter.updatedAt,
        session: {
          ...activeEncounter.encounter,
          combatRoundState,
          currentRound: 1,
          status: "active",
        },
      },
    });
    expect(stateUpdate.ok(), await stateUpdate.text()).toBe(true);

    // ================= PLAYER SURFACE =================
    const playerPage = await playerContext.newPage();
    await playerPage.setViewportSize({ height: 900, width: 1440 });
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    const playerAction = playerPage.getByRole("combobox", { name: "Action" }).first();
    await expect(playerAction).toBeVisible();

    // ---- Step 1: Single attack, untouched. The derivation's own row. ----
    await playerAction.selectOption("attack_parry");
    await expect(phaseSection(playerPage, "Phase 1")).toBeVisible();
    await expect(
      phaseSection(playerPage, "Phase 1").getByRole("combobox", { name: "Parry source" }),
    ).toHaveCount(1);
    const untouched = await readDefenseTable(playerPage, "Phase 1");
    expect(untouched.values, describeRead("untouched", untouched)).toHaveLength(3);
    expect(untouched.selectorOffered, describeRead("untouched", untouched)).toBe(true);
    expect(untouched.optionCount, describeRead("untouched", untouched)).toBeGreaterThan(1);
    const defaultSelectorValue = untouched.selectorValue;
    console.log(`#782 untouched: ${JSON.stringify(untouched)}`);

    // ---- Step 2: choose a defensive mode whose row differs from the derivation's. ----
    const parrySource = phaseSection(playerPage, "Phase 1").getByRole("combobox", {
      name: "Parry source",
    });
    const optionValues = await parrySource
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    let chosenValue: string | undefined;
    let chosen: DefenseRead | undefined;
    for (const value of optionValues) {
      if (value === defaultSelectorValue) continue;
      await parrySource.selectOption(value);
      const read = await readDefenseTable(playerPage, "Phase 1");
      expect(read.values, describeRead(`option ${value}`, read)).toHaveLength(3);
      if (read.values.join("|") !== untouched.values.join("|")) {
        chosenValue = value;
        chosen = read;
        break;
      }
    }
    // Guard: without a row that actually differs, every comparison below would be vacuous.
    expect(
      chosen,
      `no offered defensive mode moved the displayed DB/DM/P away from ${JSON.stringify(
        untouched.values,
      )}; options were ${JSON.stringify(optionValues)}`,
    ).toBeTruthy();
    expect(chosen!.values, describeRead("chosen", chosen!)).toHaveLength(3);
    expect(chosen!.values, describeRead("chosen", chosen!)).not.toEqual(untouched.values);
    expect(chosen!.selectorValue, describeRead("chosen", chosen!)).toBe(chosenValue);
    console.log(`#782 chosen ${chosenValue}: ${JSON.stringify(chosen)}`);

    // ---- Step 3: the gate closes. `Parry` does not offer the selector at all. ----
    await playerAction.selectOption("parry");
    await expect(
      phaseSection(playerPage, "Phase 1").getByRole("combobox", { name: "Parry source" }),
    ).toHaveCount(0);
    const gated = await readDefenseTable(playerPage, "Phase 1");
    console.log(`#782 gate closed: ${JSON.stringify(gated)}`);
    expect(gated.values, describeRead("gate closed", gated)).toHaveLength(3);
    expect(gated.selectorOffered, describeRead("gate closed", gated)).toBe(false);
    // The displayed row is the unchanged derivation's, not the one chosen under `Single attack`.
    expect(gated.values, describeRead("gate closed", gated)).toEqual(untouched.values);
    expect(gated.values, describeRead("gate closed", gated)).not.toEqual(chosen!.values);
    /*
     * And the cell *names* that row, rather than the source the player can no longer reach. With a
     * selector present the cell's text is the whole `<select>`, so the comparison is made on the
     * source name taken from each selected option's `Name \u00b7 Mode` label.
     */
    const defaultSourceName = (untouched.selectedLabel ?? "").split(" \u00b7 ")[0]!;
    const chosenSourceName = (chosen!.selectedLabel ?? "").split(" \u00b7 ")[0]!;
    // Guards: both names are real, they differ, and neither contains the other, so the
    // contains/not-contains pair below cannot both hold for the wrong reason.
    expect(defaultSourceName.length, `default source name: ${defaultSourceName}`).toBeGreaterThan(
      0,
    );
    expect(chosenSourceName, `chosen vs default source name`).not.toBe(defaultSourceName);
    expect(
      defaultSourceName.includes(chosenSourceName) || chosenSourceName.includes(defaultSourceName),
      `source names must not nest: ${defaultSourceName} / ${chosenSourceName}`,
    ).toBe(false);
    expect(gated.sourceCell, describeRead("gate closed", gated)).toContain(defaultSourceName);
    expect(gated.sourceCell, describeRead("gate closed", gated)).not.toContain(chosenSourceName);

    /*
     * ---- Step 4: back on Single attack the selector returns, and so does the choice. ----
     *
     * The repair *ignores* the stored choice rather than erasing it: the same option set is on
     * offer again and its selector is back on screen set to that choice, so honouring it shows
     * the player their own selection under a control that names and can change it. The invariant
     * this binds is the defect's negation — a row other than the derivation's is displayed **only**
     * while a selector naming it is on screen. (Erasing instead would be a one-line change here;
     * it is a product question, not a correctness one.)
     */
    await playerAction.selectOption("attack_parry");
    await expect(
      phaseSection(playerPage, "Phase 1").getByRole("combobox", { name: "Parry source" }),
    ).toHaveCount(1);
    const reopened = await readDefenseTable(playerPage, "Phase 1");
    console.log(`#782 reopened: ${JSON.stringify(reopened)}`);
    expect(reopened.values, describeRead("reopened", reopened)).toHaveLength(3);
    expect(reopened.selectorOffered, describeRead("reopened", reopened)).toBe(true);
    // Whatever row is displayed, the on-screen selector names it and can change it.
    expect(
      [reopened.selectorValue, reopened.values.join("|")],
      describeRead("reopened", reopened),
    ).toEqual([chosenValue, chosen!.values.join("|")]);
    // And moving the selector back to the derivation's own row still works.
    await parrySource.selectOption(defaultSelectorValue!);
    const backToDefault = await readDefenseTable(playerPage, "Phase 1");
    expect(backToDefault.values, describeRead("back to default", backToDefault)).toHaveLength(3);
    expect(backToDefault.values, describeRead("back to default", backToDefault)).toEqual(
      untouched.values,
    );

    // ---- The choice is still presentation-only: it reaches no declaration field. ----
    const declaration = await json<{ encounter: EncounterSession }>(
      await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const serialized = JSON.stringify(declaration.encounter);
    expect(serialized.includes('"parrySource"'), "parrySource must stay unwritten").toBe(false);
    console.log(
      `#782 persisted combat context carries no parrySource (payload ${serialized.length} bytes)`,
    );

    await playerContext.close();
  });
});
