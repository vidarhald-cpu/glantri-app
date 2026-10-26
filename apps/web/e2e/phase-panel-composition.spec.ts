import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";

/**
 * Forgejo #771 — rendered evidence for the Product Owner's phase-panel composition refinement, on
 * both the player and the GM surface, with a character that has **multiple attack and parry source
 * options**: a ready primary weapon, a ready shield and the intrinsic unarmed sources. The design
 * asks for exactly that: "Rendered QA should include a character with multiple attack/parry source
 * options, not only the single-sword case."
 *
 * What it binds, bullet by bullet:
 *
 * - the Attack source selector is **in** the Attack mini-table's source/name cell, and the mode
 *   control sits beside it in the same cell;
 * - the standalone `Attack source` / `Attack mode` dropdowns below the mini-table are gone — the
 *   only such control in a phase panel is the one inside the cell;
 * - the Parry source selector is in the Defense/Parry DB/DM/P mini-table's source/name cell, offers
 *   every derived defensive mode, and changing it moves the displayed DB/DM/P immediately;
 * - the `Parry context` heading is gone, and so is the hairline that separated the parry controls
 *   from their mini-table: exactly one hairline remains, between the Attack and Defense groups;
 * - the parry selector is absent on a declaration whose parry allocation does not reach the
 *   DB/Parry stack, and present on Single attack;
 * - the groups are top-aligned and internally packed, so the slack a taller sibling column creates
 *   falls at the **bottom** of the panel.
 *
 * ## Geometry method
 *
 * Every compared box is read inside **one** `page.evaluate`, in document coordinates. These pages
 * autoscroll after mount (`CombatLog` calls `scrollIntoView`), so reads taken across `await`
 * boundaries straddle that scroll and report hundreds of pixels of phantom movement. `scrollY` is
 * returned with the measurement and quoted in any failure message.
 *
 * The before/after comparison toggles the single property that produces the distribution —
 * `align-content` on the phase panel and its groups — and re-measures synchronously in the same
 * evaluate. `stretch` is what the browser resolves `normal` to on these grid containers, so the
 * `before` numbers are the pre-change layout of this very DOM rather than a separate build.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

const PRIMARY_WEAPON_TEMPLATE = "weapon-template-longsword";
const SHIELD_TEMPLATE = "shield-template-medium-metal-shield";

interface PhaseGeometry {
  /** Unused vertical space between the last group and the panel's content bottom. */
  bottomSlack: number;
  /** Combined height of the panel's direct children: heading, Attack group, Defense group. */
  contentHeight: number;
  /** Top borders on the panel's direct children — the hairline between the major groups. */
  groupHairlines: number;
  height: number;
  /** Top borders inside the Defense / Parry group, which must have none of its own. */
  innerHairlines: number;
  label: string;
}

interface PhaseMeasurement {
  after: PhaseGeometry[];
  before: PhaseGeometry[];
  rowHeight: number;
  scrollY: number;
}

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

/**
 * Reads every compared box in one evaluate, in document coordinates, and takes the `before`
 * measurement by restoring the distribution the recomposition removed.
 */
async function measurePhaseGeometry(page: Page): Promise<PhaseMeasurement> {
  return page.evaluate(() => {
    const labels = ["Phase 1", "Phase 2"];
    const sections = [...document.querySelectorAll("section")].filter((section) => {
      const heading = section.firstElementChild?.firstElementChild;
      return heading?.tagName === "STRONG" && labels.includes(heading.textContent ?? "");
    });

    const hasTopBorder = (node: Element): boolean => {
      const style = window.getComputedStyle(node);
      return style.borderTopStyle !== "none" && parseFloat(style.borderTopWidth || "0") > 0;
    };

    const read = (): PhaseGeometryShape[] =>
      sections.map((section) => {
        const style = window.getComputedStyle(section);
        const rect = section.getBoundingClientRect();
        const children = [...section.children] as HTMLElement[];
        const last = children[children.length - 1]!;
        const contentHeight = children.reduce(
          (total, child) => total + child.getBoundingClientRect().height,
          0,
        );

        return {
          bottomSlack: Math.round(
            rect.bottom -
              parseFloat(style.paddingBottom || "0") -
              last.getBoundingClientRect().bottom,
          ),
          contentHeight: Math.round(contentHeight),
          groupHairlines: children.filter(hasTopBorder).length,
          height: Math.round(rect.height),
          // Only container `<div>`s count. A `<td>` reports the `<th>`'s bottom rule as its own
          // computed top border under `border-collapse: collapse`, and Chromium's UA stylesheet
          // gives every `<select>` a 1px border — neither is a group separator.
          innerHairlines: [...last.querySelectorAll("div")].filter(hasTopBorder).length,
          label: section.firstElementChild!.firstElementChild!.textContent ?? "",
        };
      });

    interface PhaseGeometryShape {
      bottomSlack: number;
      contentHeight: number;
      groupHairlines: number;
      height: number;
      innerHairlines: number;
      label: string;
    }

    const after = read();
    const packed: HTMLElement[] = [];
    for (const section of sections) {
      for (const node of [section, ...section.querySelectorAll("div")] as HTMLElement[]) {
        if (window.getComputedStyle(node).alignContent === "start") {
          packed.push(node);
          node.style.alignContent = "stretch";
        }
      }
    }
    const before = read();
    for (const node of packed) {
      node.style.alignContent = "start";
    }

    return {
      after,
      before,
      rowHeight: Math.round(sections[0]?.parentElement?.getBoundingClientRect().height ?? 0),
      scrollY: Math.round(window.scrollY),
    };
  });
}

async function selectGmInspectorParticipant(input: { label: string; page: Page }): Promise<void> {
  const heading = input.page.getByRole("heading", { name: /^Combat inspector — / });
  await expect(heading).toBeVisible();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await heading.innerText()).includes(input.label)) return;
    await input.page.getByRole("button", { name: "Next participant" }).click();
  }
  throw new Error(`The GM inspector never reached ${input.label}.`);
}

test.describe("Phase-panel composition refinement (#771)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("places the source selectors in the mini-table cells and packs the groups to the top", async ({
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
    const characterId = `phase-panel-${suffix}`;
    const characterName = `Phase Panel Fighter ${suffix}`;
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
      name: `Issue 771 Phase Panels ${suffix}`,
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
      { name: `Issue 771 Scenario ${suffix}`, status: "live" },
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
    const targetName = `Phase Panel Target ${suffix}`;
    const target = await post<{ participant: { id: string } }>(
      gmPage.request,
      `/scenarios/${scenarioId}/participants/entity`,
      {
        entityInput: { kind: "npc", name: targetName, snapshot: { displayName: targetName } },
        role: "enemy",
      },
    );

    const now = new Date().toISOString();
    const fighterCombatantId = `issue-771-fighter-${suffix}`;
    const targetCombatantId = `issue-771-target-${suffix}`;
    const encounter = await post<{ encounter: EncounterSession }>(
      gmPage.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `issue-771-encounter-${suffix}`,
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
          title: `Issue 771 Combat ${suffix}`,
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
    await playerAction.selectOption("attack_parry");

    const playerPhase1 = phaseSection(playerPage, "Phase 1");
    await expect(playerPhase1).toBeVisible();

    // --- Bullet: the Attack source selector is in the mini-table's source/name cell. ---
    const playerAttackSource = playerPhase1.getByRole("combobox", { name: "Attack source" });
    await expect(playerAttackSource).toHaveCount(1);
    const attackSourceLabels = await playerAttackSource.locator("option").allInnerTexts();
    // Multiple attack sources, not the single-sword case.
    expect(attackSourceLabels.length).toBeGreaterThanOrEqual(3);
    expect(attackSourceLabels).toContain("Punch · Unarmed");
    expect(attackSourceLabels).toContain("Kick · Unarmed");
    expect(attackSourceLabels.some((label) => label.endsWith("· Primary"))).toBe(true);
    // The cell is the first child of the mini-table row, and the table is its sibling.
    expect(
      await playerAttackSource.evaluate(
        (node) => node.parentElement?.nextElementSibling?.tagName ?? "",
      ),
    ).toBe("TABLE");

    // --- Bullet: no redundant standalone Attack source / Attack mode dropdown below. ---
    // Every such control inside a phase panel is the one in the mini-table's source cell.
    for (const name of ["Attack source", "Attack mode"]) {
      const inPanelCells = await playerPhase1
        .getByRole("combobox", { name })
        .evaluateAll((nodes) =>
          nodes.map((node) => node.parentElement?.nextElementSibling?.tagName ?? ""),
        );
      expect(
        inPanelCells.every((tag) => tag === "TABLE"),
        `${name}: ${inPanelCells}`,
      ).toBe(true);
    }

    // --- Bullet: the Parry source selector is in the Defense/Parry mini-table's source cell. ---
    const playerParrySource = playerPhase1.getByRole("combobox", { name: "Parry source" });
    await expect(playerParrySource).toHaveCount(1);
    const parrySourceLabels = await playerParrySource.locator("option").allInnerTexts();
    expect(parrySourceLabels.length).toBeGreaterThanOrEqual(3);
    expect(parrySourceLabels.some((label) => label.endsWith("· Combined"))).toBe(true);
    expect(parrySourceLabels.some((label) => label.endsWith("· Shield"))).toBe(true);
    expect(
      await playerParrySource.evaluate(
        (node) => node.parentElement?.nextElementSibling?.tagName ?? "",
      ),
    ).toBe("TABLE");

    // --- Bullet: changing a source updates the displayed combat values immediately. ---
    const readDefenseValues = () =>
      playerParrySource.evaluate((node) =>
        [...(node.parentElement?.nextElementSibling?.querySelectorAll("tbody td") ?? [])].map(
          (cell) => cell.textContent ?? "",
        ),
      );
    const defenseByOption: Record<string, string[]> = {};
    for (const value of await playerParrySource
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))) {
      await playerParrySource.selectOption(value);
      defenseByOption[value] = await readDefenseValues();
    }
    const distinctDefenseRows = new Set(Object.values(defenseByOption).map((row) => row.join("|")));
    console.log(
      `#771 player source sets: ${JSON.stringify({
        attackModes: await playerPhase1
          .getByRole("combobox", { name: "Attack mode" })
          .locator("option")
          .allInnerTexts()
          .catch(() => []),
        attackSources: attackSourceLabels,
        parrySources: parrySourceLabels,
      })}`,
    );
    console.log(`#771 player parry source -> DB/DM/P: ${JSON.stringify(defenseByOption)}`);
    expect(
      distinctDefenseRows.size,
      `parry source -> DB/DM/P: ${JSON.stringify(defenseByOption)}`,
    ).toBeGreaterThan(1);

    // --- Bullet: no `Parry context` heading, and one hairline between the two groups. ---
    await expect(playerPhase1.getByText("Parry context")).toHaveCount(0);
    await expect(playerPhase1.getByText("Main hand").first()).toBeVisible();
    await expect(playerPhase1.getByText("Off hand").first()).toBeVisible();

    // --- Bullet: top-aligned and internally packed, slack at the bottom. ---
    const playerGeometry = await measurePhaseGeometry(playerPage);
    expect(
      playerGeometry.after.map((phase) => phase.label),
      `player geometry (scrollY ${playerGeometry.scrollY}): ${JSON.stringify(playerGeometry)}`,
    ).toEqual(["Phase 1", "Phase 2"]);
    for (const [index, phase] of playerGeometry.after.entries()) {
      const baseline = playerGeometry.before[index]!;
      const context = `player ${phase.label} (scrollY ${playerGeometry.scrollY}): ${JSON.stringify({
        after: phase,
        before: baseline,
        rowHeight: playerGeometry.rowHeight,
      })}`;
      // Exactly one hairline between the two major groups, and none inside the Defense group.
      /*
       * One hairline between the two major groups where both render, none where the Defense /
       * Parry group stands alone — Phase 2 of a Single attack carries no attack, so a top border
       * there would separate the group from nothing. Never more than one, and never one inside
       * the Defense group itself.
       */
      expect(phase.groupHairlines, context).toBe(phase.label === "Phase 1" ? 1 : 0);
      expect(phase.innerHairlines, context).toBe(0);
      // The panel keeps its height — a sibling column still sets the row — but the content is
      // packed, so the slack that was distributed through it now falls at the bottom.
      expect(phase.height, context).toBe(baseline.height);
      expect(phase.bottomSlack, context).toBeGreaterThan(baseline.bottomSlack);
      expect(phase.contentHeight, context).toBeLessThan(baseline.contentHeight);
    }
    console.log(`#771 player phase geometry: ${JSON.stringify(playerGeometry)}`);

    // --- Ruling: the parry selector is absent where the parry allocation does nothing. ---
    await playerAction.selectOption("parry");
    const playerParryPhase1 = phaseSection(playerPage, "Phase 1");
    await expect(playerParryPhase1.getByRole("combobox", { name: "Parry source" })).toHaveCount(0);
    await expect(playerParryPhase1.getByText("Main hand").first()).toBeVisible();
    await expect(playerParryPhase1.getByText("Parry context")).toHaveCount(0);
    // Present again on Single attack: the gate is the declaration predicate, not a one-way switch.
    await playerAction.selectOption("attack_parry");
    await expect(
      phaseSection(playerPage, "Phase 1").getByRole("combobox", { name: "Parry source" }),
    ).toHaveCount(1);

    // ================= GM SURFACE =================
    await gmPage.setViewportSize({ height: 900, width: 1440 });
    await gmPage.goto(
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
    );
    await selectGmInspectorParticipant({ label: characterName, page: gmPage });
    const gmAction = gmPage.getByRole("combobox", { name: "Action" }).first();
    await expect(gmAction).toBeVisible();
    await gmAction.selectOption("attack_parry");

    const gmPhase1 = phaseSection(gmPage, "Phase 1");
    await expect(gmPhase1).toBeVisible();
    const gmAttackSource = gmPhase1.getByRole("combobox", { name: "Attack source" });
    await expect(gmAttackSource).toHaveCount(1);
    expect(
      await gmAttackSource.evaluate(
        (node) => node.parentElement?.nextElementSibling?.tagName ?? "",
      ),
    ).toBe("TABLE");
    const gmParrySource = gmPhase1.getByRole("combobox", { name: "Parry source" });
    await expect(gmParrySource).toHaveCount(1);
    expect(
      await gmParrySource.evaluate((node) => node.parentElement?.nextElementSibling?.tagName ?? ""),
    ).toBe("TABLE");
    const gmParryLabels = await gmParrySource.locator("option").allInnerTexts();
    expect(gmParryLabels.length).toBeGreaterThanOrEqual(3);
    expect(gmParryLabels.some((label) => label.endsWith("· Combined"))).toBe(true);
    await expect(gmPhase1.getByText("Parry context")).toHaveCount(0);
    await expect(gmPhase1.getByText("Main hand").first()).toBeVisible();

    const gmReadDefenseValues = () =>
      gmParrySource.evaluate((node) =>
        [...(node.parentElement?.nextElementSibling?.querySelectorAll("tbody td") ?? [])].map(
          (cell) => cell.textContent ?? "",
        ),
      );
    const gmDefenseByOption: Record<string, string[]> = {};
    for (const value of await gmParrySource
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))) {
      await gmParrySource.selectOption(value);
      gmDefenseByOption[value] = await gmReadDefenseValues();
    }
    expect(
      new Set(Object.values(gmDefenseByOption).map((row) => row.join("|"))).size,
      `GM parry source -> DB/DM/P: ${JSON.stringify(gmDefenseByOption)}`,
    ).toBeGreaterThan(1);
    console.log(
      `#771 GM source sets: ${JSON.stringify({
        attackModes: await gmPhase1
          .getByRole("combobox", { name: "Attack mode" })
          .locator("option")
          .allInnerTexts()
          .catch(() => []),
        attackSources: await gmAttackSource.locator("option").allInnerTexts(),
        parrySources: gmParryLabels,
      })}`,
    );
    console.log(`#771 GM parry source -> DB/DM/P: ${JSON.stringify(gmDefenseByOption)}`);

    const gmGeometry = await measurePhaseGeometry(gmPage);
    for (const [index, phase] of gmGeometry.after.entries()) {
      const baseline = gmGeometry.before[index]!;
      const context = `GM ${phase.label} (scrollY ${gmGeometry.scrollY}): ${JSON.stringify({
        after: phase,
        before: baseline,
        rowHeight: gmGeometry.rowHeight,
      })}`;
      /*
       * One hairline between the two major groups where both render, none where the Defense /
       * Parry group stands alone — Phase 2 of a Single attack carries no attack, so a top border
       * there would separate the group from nothing. Never more than one, and never one inside
       * the Defense group itself.
       */
      expect(phase.groupHairlines, context).toBe(phase.label === "Phase 1" ? 1 : 0);
      expect(phase.innerHairlines, context).toBe(0);
      expect(phase.height, context).toBe(baseline.height);
      expect(phase.bottomSlack, context).toBeGreaterThan(baseline.bottomSlack);
      expect(phase.contentHeight, context).toBeLessThan(baseline.contentHeight);
    }
    console.log(`#771 GM phase geometry: ${JSON.stringify(gmGeometry)}`);

    await gmAction.selectOption("parry");
    await expect(
      phaseSection(gmPage, "Phase 1").getByRole("combobox", { name: "Parry source" }),
    ).toHaveCount(0);
  });
});
