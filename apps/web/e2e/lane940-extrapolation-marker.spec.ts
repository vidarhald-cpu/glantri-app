import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  combatRoundStateSchema,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * **INCOMPLETE INSTRUMENT — NOT ACCEPTANCE EVIDENCE.** This spec does not yet reach a live
 * phase-1 initiative state, so it currently reports no verdict on either surface and must not be
 * cited as a rendered reading. It is lane-scoped (`lane940-`), so the ordinary suite and CI ignore
 * it by `testIgnore`; run it by hand with `playwright.lane940.config.ts` against a freshly
 * provisioned, migrated, unseeded task target.
 *
 * **What remains, measured rather than guessed.** A round whose declaration is valid and committed
 * parks on the round-1 modifier review, because the tracker's canonical order is
 * DE, M1, i1, A1 ... — the modifier review precedes phase-1 initiative. Setting
 * `review_action_modifiers: "complete"` in the written state does not move it: the server
 * re-derives the boundary, and both pages still rendered "Modifier review" and
 * "Complete modifier review" with no initiative figure. Advancing past that review needs
 * `POST /encounters/:id/combat-round/advance-current-step`, which requires a reconstructed task
 * identity — `expectedBoundary`, `commandType`, `executionGroupId` and `taskId` — of the kind
 * `gm-superseded-figure-visibility.spec.ts` builds with its own `taskCommandIdentity` helper. That
 * is the next step: drive the review to completion through the app's own task endpoints, then read.
 *
 * Two findings worth keeping whatever route the next attempt takes:
 *
 * - **`open` is not a supported combat action** at this baseline. It fails
 *   `validateCombatDeclarationCompatibility`, which raises `repair_required` ("an active legacy
 *   declaration cannot enter canonical execution"). The GM inspector then shows its *historical*
 *   reading, in which this card is not drawn at all. A declaration using it does render the
 *   player's card, so a capture taken from that state looks like a result and is a reading of a
 *   state the app considers broken.
 * - **The marker itself behaved correctly** in that broken state, at 768 and 1440 on the player
 *   panel: badge "Extrapolated" 84.36 x 15 px, unclipped and inside the viewport, present at
 *   |raw| 16, absent at |raw| 15, and absent on the zero row with the figure moved to -6. That is
 *   recorded as a pointer for the next attempt, not as acceptance.
 *
 * Rendered acceptance for #940 Tier A: an extrapolated figure is visibly identified as
 * extrapolated on the GM and the player initiative context panels.
 *
 * The Product Owner's ruling of 2026-11-05 is a property of the value, so a capture showing the
 * marker proves nothing on its own — each state here is paired with the control that should carry
 * no marker, and both are driven at a real axis boundary rather than asserted from the DOM alone.
 *
 * **Why the modifier axis and not the base axis.** The base of this figure is the character's
 * passive initiative. The authored grid runs to base 49, so reaching the `base` axis here would
 * need a character whose initiative is 50 — a value the game does not produce, and the Product
 * Owner's correction of 2026-11-06 is exactly that a constructed extreme is not evidence of play.
 * The modifier axis is driven here because initiative modifiers are ordinary GM input, and the
 * base boundary at 49 against 50 is pinned as arithmetic in
 * `combatExtrapolationPresentation.test.ts` instead of manufactured on screen.
 *
 * Every geometry read is one `page.evaluate` with `window.scrollY` taken inside it. The Combat
 * page autoscrolls to the current task a beat after mount, so a read split across `await`
 * boundaries straddles that scroll and reports a position no one ever saw.
 */

const VIEWPORT_HEIGHT = 900;
/**
 * The usable widths for this surface. Both panels are prose lines inside a card that reflows, so
 * 1024 sits between these two with no layout change of its own and is omitted deliberately rather
 * than silently: 768 is the narrow reflow and 1440 the wide one.
 */
const WIDTHS = [768, 1440] as const;

const MARKER_WORD = "Extrapolated";

interface FigureRead {
  badge: {
    clipped: boolean;
    found: boolean;
    insideViewportAtThisScroll: boolean;
    rect: {
      bottom: number;
      height: number;
      left: number;
      right: number;
      top: number;
      width: number;
    };
    text: string;
  };
  baseLine: string;
  detail: {
    clipped: boolean;
    found: boolean;
    insideViewportAtThisScroll: boolean;
    rect: {
      bottom: number;
      height: number;
      left: number;
      right: number;
      top: number;
      width: number;
    };
    text: string;
  };
  effectiveLine: string;
  innerHeight: number;
  innerWidth: number;
  markerWordOnPage: boolean;
  modifierLine: string;
  panelFound: boolean;
  probe: {
    ancestry: string[];
    baseNodeFound: boolean;
    baseNodeText: string;
    sectionStrongs: string[];
    strongs: string[];
  };
  scrollY: number;
}

/**
 * One atomic read of the initiative card: the three figure lines, the badge and its sentence, their
 * rectangles, their clipping, and the scroll position they were measured at — all inside a single
 * evaluate, so every number describes the same instant.
 */
async function readInitiativeFigure(
  page: Page,
  badgeTestId: string,
  detailTestId: string,
): Promise<FigureRead> {
  return page.evaluate(
    ({ badgeId, detailId, markerWord }) => {
      const scrollY = Math.round(window.scrollY);
      const emptyNode = {
        clipped: false,
        found: false,
        insideViewportAtThisScroll: false,
        rect: { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 },
        text: "",
      };
      const measure = (node: HTMLElement | null) => {
        if (!node) {
          return emptyNode;
        }
        const rect = node.getBoundingClientRect();
        return {
          clipped: node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight,
          found: true,
          insideViewportAtThisScroll:
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.left >= 0 &&
            rect.right <= window.innerWidth,
          rect: {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
          },
          text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
        };
      };

      const panel = [...document.querySelectorAll("section")].find(
        (node) =>
          node.firstElementChild?.tagName === "STRONG" &&
          node.firstElementChild.textContent === "Initiative",
      );
      // The innermost match: the card nests its lines inside a grid wrapper whose own textContent
      // concatenates all of them, so the shortest matching node is the line itself.
      const lines = panel ? [...panel.querySelectorAll("div")] : [];
      const lineStartingWith = (prefix: string) => {
        const matches = lines
          .filter((node) => (node.textContent ?? "").trim().startsWith(prefix))
          .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim());
        return matches.sort((a, b) => a.length - b.length)[0] ?? "";
      };

      // Unconditional structural probe: which cards exist, and where the figure text actually
      // lives. Recorded so a selector mismatch is distinguishable from a card that never rendered.
      const baseNode = [...document.querySelectorAll("div,span,p,td")].find((node) =>
        (node.textContent ?? "").trim().startsWith("Base initiative"),
      );
      const ancestry: string[] = [];
      for (
        let node = baseNode?.parentElement;
        node && ancestry.length < 10;
        node = node.parentElement
      ) {
        ancestry.push(
          `${node.tagName}${node.firstElementChild ? `>${node.firstElementChild.tagName}:${(node.firstElementChild.textContent ?? "").slice(0, 24)}` : ""}`,
        );
      }

      return {
        probe: {
          ancestry,
          baseNodeFound: Boolean(baseNode),
          baseNodeText: (baseNode?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
          sectionStrongs: [...document.querySelectorAll("section > strong")].map((n) =>
            (n.textContent ?? "").trim(),
          ),
          strongs: [...document.querySelectorAll("strong")]
            .map((n) => (n.textContent ?? "").trim())
            .slice(0, 40),
        },
        badge: measure(document.querySelector<HTMLElement>(`[data-testid="${badgeId}"]`)),
        baseLine: lineStartingWith("Base initiative"),
        detail: measure(document.querySelector<HTMLElement>(`[data-testid="${detailId}"]`)),
        effectiveLine: lineStartingWith("Effective before roll"),
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        markerWordOnPage: (document.body.innerText ?? "").includes(markerWord),
        modifierLine: lineStartingWith("Initiative modifiers"),
        panelFound: Boolean(panel),
        scrollY,
      };
    },
    { badgeId: badgeTestId, detailId: detailTestId, markerWord: MARKER_WORD },
  );
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function phaseContext(initiativeEntries: Array<{ id: string; scope: "until"; value: number }>) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: initiativeEntries,
      situationObSkill: [],
    },
  };
}

/**
 * A round parked on the first initiative step, carrying exactly the raw initiative modifier the
 * case under test needs. Nothing else about the round matters to this figure.
 */
function buildInitiativeRound(input: {
  participantId: string;
  participantLabel: string;
  rawInitiativeModifier: number;
}): CombatRoundState {
  const entries =
    input.rawInitiativeModifier === 0
      ? []
      : [
          {
            id: "e2e:initiative-situation",
            scope: "until" as const,
            value: input.rawInitiativeModifier,
          },
        ];

  return combatRoundStateSchema.parse({
    commands: [],
    currentCursor: { participantId: input.participantId, roundNumber: 1, step: "i1" },
    currentStep: "initiative_phase_1",
    participants: [
      {
        attackResults: {},
        declaration: {
          /**
           * A combatant who passes. `pass` is chosen because it is a supported primary action that
           * needs no target and no attack opportunities, so the round reaches a genuinely live
           * phase-1 initiative with no diagnostics: measured on this state,
           * `buildCombatProgressionProjection` reports no diagnostics, the first stage is `active`,
           * the single `roll_initiative` task is `executable` and the presentation's
           * `taskVisibility` is `available`.
           *
           * This matters for more than tidiness. `open` is **not** a supported action at this
           * baseline — it fails `validateCombatDeclarationCompatibility`, which raises
           * `repair_required` ("an active legacy declaration cannot enter canonical execution"),
           * and the GM inspector then shows its historical reading, in which this card is not
           * drawn at all. A capture taken from that state would be a reading of a state the app
           * considers broken, not of the figure a GM sees.
           */
          actionId: "pass",
          combatContext: phaseContext(entries),
          committed: true,
          phaseContexts: {
            phase1: phaseContext(entries),
            phase2: phaseContext(entries),
          },
          roundNumber: 1,
          submittedAt: "2026-11-06T12:00:00.000Z",
          submittedBy: "player" as const,
        },
        initiatives: {},
        label: input.participantLabel,
        participantId: input.participantId,
      },
    ],
    roundNumber: 1,
    stepStatuses: {
      initiative_phase_1: "pending",
      // `review_action_modifiers` is complete, not pending. The tracker's canonical order is
      // DE, M1, i1, A1 ... — the round-1 modifier review comes *before* phase-1 initiative — so a
      // round whose modifier review is still pending parks on that review and the initiative card
      // is never drawn. Measured: with it pending, both pages rendered "Modifier review" and
      // "Complete modifier review" and no initiative figure at all.
      initiative_phase_2: "pending",
      phase_1_actions: "pending",
      phase_2_actions: "pending",
      review_action_modifiers: "complete",
      review_phase_2_actions: "pending",
      review_phase_2_damage: "pending",
      review_phase_2_modifiers: "pending",
      round_summary: "pending",
      select_actions: "submitted",
    },
  });
}

test.describe("#940 Tier A an extrapolated initiative figure is marked on screen", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("marks the figure past the table's largest modifier and leaves every in-grid figure clean", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(900_000);
    const record: Record<string, unknown> = {};
    const suffix = Date.now();

    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    const characterId = `extrapolation-marker-${suffix}`;
    const characterName = `Extrapolation Marker ${suffix}`;
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterId,
      name: characterName,
      request: playerContext.request,
    });

    const campaign = await json<{ campaign: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns`, {
        data: { name: `Issue 940 Marker ${suffix}`, status: "active" },
      }),
    );
    await json(
      await gmPage.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/roster`, {
        data: { category: "pc", sourceId: characterId, sourceType: "character" },
      }),
    );
    const scenario = await json<{ scenario: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
        data: { name: `Issue 940 Scenario ${suffix}`, status: "live" },
      }),
    );
    const participant = await json<{ participant: { id: string } }>(
      await gmPage.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/character`,
        { data: { characterId, controlledByUserId: playerUser.user.id } },
      ),
    );
    await json(
      await gmPage.request.post(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/${participant.participant.id}/refresh-character-equipment`,
      ),
    );

    const encounterParticipantId = `issue-940-combatant-${suffix}`;
    const encounterId = `issue-940-encounter-${suffix}`;
    const now = new Date().toISOString();
    const created = await json<{ encounter: EncounterSession }>(
      await gmPage.request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
        data: {
          session: {
            campaignId: campaign.campaign.id,
            combatRoundState: buildInitiativeRound({
              participantId: encounterParticipantId,
              participantLabel: characterName,
              rawInitiativeModifier: 0,
            }),
            createdAt: now,
            currentRound: 1,
            id: encounterId,
            kind: "combat",
            participantMembershipMode: "explicit",
            participants: [
              {
                characterId,
                id: encounterParticipantId,
                label: characterName,
                participantType: "scenario",
                scenarioParticipantId: participant.participant.id,
              },
            ],
            scenarioId: scenario.scenario.id,
            status: "active",
            title: `Issue 940 Combat ${suffix}`,
            updatedAt: now,
          },
        },
      }),
    );
    expect(created.encounter.id).toBe(encounterId);

    const setRawInitiativeModifier = async (rawInitiativeModifier: number) => {
      const current = await json<{ encounter: EncounterSession }>(
        await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      await json(
        await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
          data: {
            expectedRevision: current.encounter.updatedAt,
            session: {
              ...current.encounter,
              combatRoundState: buildInitiativeRound({
                participantId: encounterParticipantId,
                participantLabel: characterName,
                rawInitiativeModifier,
              }),
              currentRound: 1,
              status: "active",
            },
          },
        }),
      );
    };

    const gmRoute = `/campaigns/${campaign.campaign.id}?scenarioId=${scenario.scenario.id}&encounterId=${encounterId}&tab=combat`;
    const playerRoute = `/campaigns/${campaign.campaign.id}/scenarios/${scenario.scenario.id}/player/combat`;
    const playerPage = await playerContext.newPage();

    /**
     * One state, both surfaces, both widths. The settle wait precedes every read and never splits
     * one, and the wait for the card is bounded by an explicit attempt count rather than left open.
     */
    const waitForInitiativeCard = async (page: Page, surface: string, width: number) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if ((await page.getByText("Base initiative", { exact: false }).count()) > 0) {
          return true;
        }
        await page.waitForTimeout(1000);
      }
      const diagnostic = await page.evaluate(() => ({
        body: (document.body.innerText ?? "").slice(0, 2500),
        cardHeadings: [...document.querySelectorAll("section > strong")].map((n) => n.textContent),
        headings: [...document.querySelectorAll("h1,h2,h3")].map((n) =>
          (n.textContent ?? "").trim(),
        ),
      }));
      record[`DIAGNOSTIC ${surface}@${width}`] = diagnostic;
      return false;
    };

    const captureBothSurfaces = async (stateKey: string) => {
      const reads: Record<string, FigureRead> = {};
      for (const width of WIDTHS) {
        await gmPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await gmPage.goto(gmRoute);
        await gmPage.waitForTimeout(3000);
        /**
         * The inspector draws this card only while its selection is the live current task:
         * `inspectorIsHistorical` is true whenever the selection is not the current progression,
         * and a freshly loaded panel can sit on the historical reading of the same step. The
         * page's own control is what a GM uses to get there, so the proof uses it too.
         */
        const resume = gmPage.getByRole("button", { name: /^(Resume )?current task$/i });
        // Disabled means the inspector is already on the current task, which is the state wanted:
        // clicking a disabled control would only hang until the test timed out.
        if ((await resume.count()) > 0 && (await resume.first().isEnabled())) {
          await resume.first().click();
          await gmPage.waitForTimeout(2500);
        }
        await waitForInitiativeCard(gmPage, "gm", width);
        reads[`gm@${width}`] = await readInitiativeFigure(
          gmPage,
          "gm-initiative-extrapolation-marker",
          "gm-initiative-extrapolation-detail",
        );

        await playerPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await playerPage.goto(playerRoute);
        await playerPage.waitForTimeout(3000);
        await waitForInitiativeCard(playerPage, "player", width);
        reads[`player@${width}`] = await readInitiativeFigure(
          playerPage,
          "player-initiative-extrapolation-marker",
          "player-initiative-extrapolation-detail",
        );
      }
      record[stateKey] = reads;
      // Printed per state, so a later timeout cannot take the measurement with it.
      console.log(`#940 STATE ${stateKey}\n${JSON.stringify(reads, null, 2)}`);
      return reads;
    };

    const expectMarked = (read: FigureRead, where: string) => {
      expect.soft(read.panelFound, `${where}: the Initiative card rendered`).toBe(true);
      expect.soft(read.badge.found, `${where}: the badge is in the DOM`).toBe(true);
      expect.soft(read.badge.text, `${where}: the badge reads as a word`).toBe(MARKER_WORD);
      expect.soft(read.badge.clipped, `${where}: the badge is not clipped`).toBe(false);
      expect
        .soft(read.badge.insideViewportAtThisScroll, `${where}: the badge is on screen`)
        .toBe(true);
      expect.soft(read.badge.rect.width, `${where}: the badge has width`).toBeGreaterThan(10);
      expect.soft(read.detail.found, `${where}: the sentence is in the DOM`).toBe(true);
      expect.soft(read.detail.clipped, `${where}: the sentence is not clipped`).toBe(false);
      expect
        .soft(read.detail.insideViewportAtThisScroll, `${where}: the sentence is on screen`)
        .toBe(true);
      expect
        .soft(read.detail.text, `${where}: the sentence names the edge and asks for a review`)
        .toBe("Resolved past the table, beyond the table's largest modifier. Review this figure.");
      // The sentence sits under the figure it qualifies, not above it or elsewhere on the page.
      expect
        .soft(read.detail.rect.top, `${where}: the sentence follows the badge`)
        .toBeGreaterThanOrEqual(read.badge.rect.top);
    };

    const expectUnmarked = (read: FigureRead, where: string) => {
      expect.soft(read.panelFound, `${where}: the Initiative card rendered`).toBe(true);
      expect
        .soft(read.effectiveLine, `${where}: the figure itself is rendered`)
        .toContain("Effective before roll");
      expect.soft(read.badge.found, `${where}: no badge is drawn`).toBe(false);
      expect.soft(read.detail.found, `${where}: no sentence is drawn`).toBe(false);
      expect
        .soft(read.markerWordOnPage, `${where}: the word appears nowhere on the page`)
        .toBe(false);
    };

    // ============ control: in grid at the modifier edge, |raw| = 15, nothing marked ============
    await setRawInitiativeModifier(-15);
    const inGrid = await captureBothSurfaces("in-grid |raw| = 15");
    for (const [where, read] of Object.entries(inGrid)) {
      expectUnmarked(read, `|raw| 15 ${where}`);
    }

    // ============ the marker: one step past the edge, |raw| = 16, marked on both ============
    await setRawInitiativeModifier(-16);
    const pastEdge = await captureBothSurfaces("past the edge |raw| = 16");
    for (const [where, read] of Object.entries(pastEdge)) {
      expectMarked(read, `|raw| 16 ${where}`);
    }

    /**
     * The zero-row negative control. A base of zero with a non-zero raw modifier departs from the
     * authored cell — `Prosent!B5:P5` is authored as literal zeroes and the app moves the figure one
     * point per raw step — and it is deliberately **not** marked. The Product Owner ruled on
     * 2026-11-04, in comment 20880 on issue #922, that the override supersedes the authored row and
     * is an explicit rule decision, so it is a rule rather than an unreviewed extrapolation.
     */
    await setRawInitiativeModifier(-6);
    const zeroRow = await captureBothSurfaces("zero row, base 0 with raw -6");
    for (const [where, read] of Object.entries(zeroRow)) {
      expectUnmarked(read, `zero row ${where}`);
      expect
        .soft(read.baseLine, `zero row ${where}: the base really is zero`)
        .toBe("Base initiative 0");
      expect
        .soft(read.modifierLine, `zero row ${where}: the raw modifier really is non-zero`)
        .toContain("-6");
    }

    // The figure moved away from the authored zero, which is what makes this a control and not a
    // vacuous pass: an unchanged figure would prove nothing about marking a departure.
    for (const [where, read] of Object.entries(zeroRow)) {
      expect
        .soft(read.effectiveLine, `zero row ${where}: the figure departed from the authored zero`)
        .toContain("-6");
    }

    await playerPage.close();
    await playerContext.close();
    console.log(`#940 Tier A rendered reading\n${JSON.stringify(record, null, 2)}`);
  });
});
