import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  advanceCombatRoundStep,
  combatRoundAttackRollResultSchema,
  combatRoundStateSchema,
  combatRoundStepSnapshotSchema,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  upsertCombatRoundStepSnapshots,
  type CombatRoundAttackRollResult,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * **The rendered reading on #940 Tier A's third surface — the committed attack result main line.**
 *
 * The acceptance asked for this surface to be rendered and measured at the usable widths, exactly
 * as the two initiative panels were. The measurement below is what that attempt produced: **the
 * main line is not drawn in the shape the application writes.** The marker Tier A appended to
 * `formatCombatAttackResultMainLine` and `formatCombatDefenseResultMainLine` cannot reach a screen
 * from a committed attack result, so no positive capture of it exists to take.
 *
 * It is lane-scoped (`lane940-`), so `playwright.config.ts`'s `testIgnore` keeps it out of the
 * ordinary suite and out of CI. Run it with the lane configuration against a freshly provisioned,
 * migrated, unseeded task target:
 *
 * ```
 * pnpm db:task:e2e --config=playwright.lane940.config.ts e2e/lane940-attack-result-main-line.spec.ts
 * ```
 *
 * ## The chain the measurement walks, and where it breaks
 *
 * `formatCombatAttackResultLine` has exactly three call sites, all of them inside
 * `CombatRoundManagerPanel.tsx`, and all three feed the **historical** inspector:
 *
 * 1. `buildCombatAttackResultPanel` puts it in `interpretedResult` — and in the same object puts a
 *    one-entry `sections` array holding the `To hit` section.
 * 2. `formatCombatPhaseResolutionResultLines` puts it in `attackLine`, which
 *    `buildHistoricalCombatActionResult` returns as `rankLabel` — alongside a four- or five-entry
 *    `sections` array.
 * 3. `buildCombatRoundStepSnapshots` puts it in the snapshot's `actionResultSummary`, on the arm
 *    where the participant has an `attackResult` and no `phaseResolutionResult`.
 *
 * `PlayerCombatActionResultPanel` renders `sections` **in preference to** `interpretedResult` and
 * `rankLabel`: the markup is `result?.sections?.length ? (sections) : result ? (rankLabel,
 * interpretedResult, …)`. So (1) and (2) are never displayed. That is measured directly against
 * the production component in `PlayerCombatPanels.test.tsx`, not inferred from reading it.
 *
 * (3) is displayed — `buildHistoricalCombatActionResult` returns `{ interpretedResult:
 * snapshot.actionResultSummary }` with no `sections` — but only on the branch it reaches **after**
 * `if (snapshot.attackResult)` has already returned (1). And `actionResultSummary` carries the main
 * line only on the arm where `attackResult` exists, which the same builder writes into the same
 * snapshot. So the one shape that would display the line is the one shape the writer never
 * produces.
 *
 * The three readings below are the rendered form of that, at each usable width:
 *
 * - **`app-shaped`** — the snapshot the application writes: `attackResult` present and flagged,
 *   `actionResultSummary` present. Measured: **no main line anywhere in the document**, and the
 *   `To hit` section drawn in its place.
 * - **`legacy-shaped marked`** — the same snapshot with `attackResult` removed, which is the
 *   legacy shape the panel's own `Some historical result details are unavailable.` banner exists
 *   for. The main line *is* drawn, and the marker's geometry is measured on it. This reading is
 *   the **non-vacuity control**: it shows the instrument sees the line when the line is painted,
 *   so the `app-shaped` zero is a measurement and not a blind spot.
 * - **`legacy-shaped control`** — the same legacy shape with an unflagged result and an unmarked
 *   summary. The main line is drawn and the marker word appears nowhere in the DOM.
 *
 * ## What is the application's and what is the harness's
 *
 * The round is composed with the domain's own transition functions and the snapshot with
 * `combatRoundStepSnapshotSchema.parse` and `upsertCombatRoundStepSnapshots`, written with a single
 * `PUT` while the Encounter is still in legacy combat storage, and then verified against the stored
 * row. The `actionResultSummary` **string** is the harness's replica of the production template,
 * because the production formatter is module-private to a `.tsx` an e2e spec cannot import. So the
 * two legacy-shaped readings measure *display* — whether that text, with that marker in it, is
 * painted, placed and unclipped — and they do not re-verify the formatter, which
 * `combatExtrapolationPresentation.test.ts` and `CombatRoundManagerPanel.test.ts` already pin.
 *
 * The `app-shaped` reading needs no such caveat: its claim is that **no** main line is drawn, which
 * does not depend on what any string says.
 *
 * ## Why the legacy fallback is the generous case
 *
 * A round driven through the canonical commands carries `events`, and the panel then renders
 * `CombatEventResultList` from `projectGmCombatEvents` instead — a different presentation that does
 * not use these formatters at all. The hand-composed round here has no events, so the panel takes
 * the legacy fallback, which is the **only** branch that could ever draw the main line. Even there
 * it does not, in the shape the writer produces.
 *
 * ## How geometry is read
 *
 * Every reading is one `page.evaluate` with `window.scrollY` taken beside the rectangles, because
 * the Combat page autoscrolls and a read split across `await` boundaries straddles the scroll. The
 * marker here is an inline substring of the line's own text node rather than an element, so its
 * painted rectangle is taken from a `Range` over that text node, clipping is accumulated over
 * **every** clipping ancestor rather than the nearest one, the glyph probe samples five points
 * across the painted rectangle with strict identity, and the figure the marker qualifies is
 * asserted to be in the **same text node** — which is stronger than the descendant containment an
 * element badge can be asked for.
 */

const VIEWPORT_HEIGHT = 900;

/** The established usable-width set for these surfaces (#940 comment 21864). */
const WIDTHS = [768, 1024, 1440] as const;

const MARKER = "(extrapolated)";
const WEAPON_NAME = "Broad sword";
const ATTACKER_OB = 81;
const DEFENDER_DB = 12;

interface MarkerRead {
  /** Pixels of the marker's painted rectangle cut off, summed over every clipping ancestor. */
  clippedByAllAncestorsPx: number;
  clippingAncestors: string[];
  computedStyle: {
    color: string;
    fontSize: string;
    visibility: string;
    whiteSpace: string;
  };
  found: boolean;
  /** Five points across the painted rectangle; each must hit the line's own element. */
  glyphHits: number;
  glyphProbeTags: string[];
  insideViewportAtThisScroll: boolean;
  /** The marker and the figure it qualifies are the same text node, not merely the same line. */
  inSameTextNodeAsFigure: boolean;
  ownerTag: string;
  rect: { bottom: number; height: number; left: number; right: number; top: number; width: number };
}

interface AttackLineRead {
  historicalPanelAriaLabels: string[];
  historicalPanelText: string;
  innerHeight: number;
  /** The usable width actually measured, not the viewport requested. */
  innerWidth: number;
  legacyFallbackBannerPresent: boolean;
  /** Every text node in the document that carries a committed attack/defense main line. */
  mainLineNodeCount: number;
  mainLineTexts: string[];
  marker: MarkerRead;
  markerOccurrencesInDom: number;
  scrollY: number;
  sectionTitlesInHistoricalPanel: string[];
}

/**
 * One atomic read: the historical result panel, every main-line text node in the document, the
 * marker's painted geometry inside the first of them, and the scroll position they share.
 */
async function readAttackResultLine(page: Page): Promise<AttackLineRead> {
  return page.evaluate(
    ({ figureNeedle, marker }) => {
      const scrollY = Math.round(window.scrollY);
      const describe = (node: Element | null) => {
        if (!node) return "";
        const testId = node.getAttribute("data-testid");
        const className = typeof node.className === "string" ? node.className.slice(0, 40) : "";
        const ariaLabel = node.getAttribute("aria-label");
        return `${node.tagName}${testId ? `[${testId}]` : ""}${ariaLabel ? `{${ariaLabel.slice(0, 40)}}` : ""}${className ? `.${className}` : ""}`;
      };

      const mainLineNodes: Text[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const data = node.data ?? "";
        if (data.includes("Main: ") || data.includes("Defense: DB ")) {
          mainLineNodes.push(node);
        }
      }

      const emptyMarker = {
        clippedByAllAncestorsPx: 0,
        clippingAncestors: [] as string[],
        computedStyle: { color: "", fontSize: "", visibility: "", whiteSpace: "" },
        found: false,
        glyphHits: 0,
        glyphProbeTags: [] as string[],
        insideViewportAtThisScroll: false,
        inSameTextNodeAsFigure: false,
        ownerTag: "",
        rect: { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 },
      };

      const measureMarker = () => {
        const host = mainLineNodes.find((node) => (node.data ?? "").includes(marker));
        if (!host) return emptyMarker;
        const owner = host.parentElement;
        if (!owner) return emptyMarker;
        const offset = host.data.indexOf(marker);
        const range = document.createRange();
        range.setStart(host, offset);
        range.setEnd(host, offset + marker.length);
        const rects = [...range.getClientRects()];
        if (rects.length === 0) return emptyMarker;
        const left = Math.min(...rects.map((entry) => entry.left));
        const right = Math.max(...rects.map((entry) => entry.right));
        const top = Math.min(...rects.map((entry) => entry.top));
        const bottom = Math.max(...rects.map((entry) => entry.bottom));
        const rect = { bottom, height: bottom - top, left, right, top, width: right - left };

        // Accumulated over EVERY clipping ancestor rather than the nearest one: a clip imposed
        // further up the chain is invisible to a nearest-ancestor measurement.
        const clippingAncestors: string[] = [];
        let clippedByAllAncestorsPx = 0;
        for (let parent = owner.parentElement; parent; parent = parent.parentElement) {
          const style = window.getComputedStyle(parent);
          const clips = [style.overflow, style.overflowX, style.overflowY].some(
            (value) =>
              value === "hidden" || value === "clip" || value === "auto" || value === "scroll",
          );
          if (!clips) continue;
          const box = parent.getBoundingClientRect();
          clippingAncestors.push(describe(parent));
          clippedByAllAncestorsPx += Math.round(
            Math.max(0, box.left - rect.left) +
              Math.max(0, rect.right - box.right) +
              Math.max(0, box.top - rect.top) +
              Math.max(0, rect.bottom - box.bottom),
          );
        }

        // Five points across the painted rectangle, strict identity: an occlusion over part of a
        // 14-character suffix is exactly the #931 class of defect a single centre probe misses.
        const probeTags: string[] = [];
        let glyphHits = 0;
        for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width * fraction));
          const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
          const hit = document.elementFromPoint(x, y);
          probeTags.push(describe(hit));
          if (hit && (hit === owner || owner.contains(hit))) glyphHits += 1;
        }

        const style = window.getComputedStyle(owner);
        return {
          clippedByAllAncestorsPx,
          clippingAncestors,
          computedStyle: {
            color: style.color,
            fontSize: style.fontSize,
            visibility: style.visibility,
            whiteSpace: style.whiteSpace,
          },
          found: true,
          glyphHits,
          glyphProbeTags: probeTags,
          insideViewportAtThisScroll:
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.left >= 0 &&
            rect.right <= window.innerWidth,
          // Same text node, not merely the same line: a substring check would also pass with the
          // marker in a sibling node, and node identity cannot.
          inSameTextNodeAsFigure: host.data.includes(figureNeedle),
          ownerTag: describe(owner),
          rect,
        };
      };

      const panels = [...document.querySelectorAll("section")].filter((node) =>
        (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
      );
      const bodyText = document.body.textContent ?? "";

      return {
        historicalPanelAriaLabels: panels.map((node) => node.getAttribute("aria-label") ?? ""),
        historicalPanelText: panels
          .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
          .join(" || "),
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        legacyFallbackBannerPresent: bodyText.includes(
          "Some historical result details are unavailable.",
        ),
        mainLineNodeCount: mainLineNodes.length,
        mainLineTexts: mainLineNodes.map((node) => (node.data ?? "").replace(/\s+/g, " ").trim()),
        marker: measureMarker(),
        markerOccurrencesInDom: bodyText.split(marker).length - 1,
        scrollY,
        sectionTitlesInHistoricalPanel: panels.flatMap((panel) =>
          [...panel.querySelectorAll("section > div:first-child")].map((node) =>
            (node.textContent ?? "").trim(),
          ),
        ),
      };
    },
    { figureNeedle: `OB ${ATTACKER_OB}`, marker: MARKER },
  );
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function phaseContext(targetParticipantId: string) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId,
  };
}

test.describe("#940 Tier A the committed attack result main line", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("is not drawn in the shape the application writes, and is drawn only without the committed result", async ({
    page: gmPage,
  }) => {
    test.setTimeout(1_800_000);
    const record: Record<string, unknown> = {};
    const suffix = Date.now();

    const OWNER_CHARACTER = `s8-attacker-${suffix}`;
    const FOE_CHARACTER = `s8-defender-${suffix}`;
    const OWNER_NAME = `Main Line Attacker ${suffix}`;
    const FOE_NAME = `Main Line Defender ${suffix}`;

    for (const [id, name] of [
      [OWNER_CHARACTER, OWNER_NAME],
      [FOE_CHARACTER, FOE_NAME],
    ] as const) {
      await createCharacterForE2e({ apiUrl: API_URL, id, name, request: gmPage.request });
    }

    const campaign = await json<{ campaign: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns`, {
        data: { name: `Issue 940 S8 ${suffix}`, status: "active" },
      }),
    );
    const campaignId = campaign.campaign.id;
    for (const sourceId of [OWNER_CHARACTER, FOE_CHARACTER]) {
      await json(
        await gmPage.request.post(`${API_URL}/campaigns/${campaignId}/roster`, {
          data: { category: "pc", sourceId, sourceType: "character" },
        }),
      );
    }
    const scenario = await json<{ scenario: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns/${campaignId}/scenarios`, {
        data: { name: `Issue 940 S8 Scenario ${suffix}`, status: "live" },
      }),
    );
    const scenarioId = scenario.scenario.id;
    const ownerParticipant = await json<{ participant: { id: string } }>(
      await gmPage.request.post(`${API_URL}/scenarios/${scenarioId}/participants/character`, {
        data: { characterId: OWNER_CHARACTER },
      }),
    );
    const foeParticipant = await json<{ participant: { id: string } }>(
      await gmPage.request.post(`${API_URL}/scenarios/${scenarioId}/participants/character`, {
        data: { characterId: FOE_CHARACTER },
      }),
    );
    for (const participantId of [ownerParticipant.participant.id, foeParticipant.participant.id]) {
      await json(
        await gmPage.request.post(
          `${API_URL}/scenarios/${scenarioId}/participants/${participantId}/refresh-character-equipment`,
        ),
      );
    }

    const readEncounter = async (encounterId: string): Promise<EncounterSession> =>
      (
        await json<{ encounter: EncounterSession }>(
          await gmPage.request.get(`${API_URL}/encounters/${encounterId}`),
        )
      ).encounter;

    /**
     * One committed phase-1 attack result, validated by the domain's own schema.
     *
     * `extrapolatedWorkbookAdjustments` is the field #922 added and #940 Tier A reads: the committed
     * record of which figure used a workbook percentage resolved past the authored grid.
     */
    const attackResult = (input: {
      attackerParticipantId: string;
      defenderParticipantId: string;
      flagged: boolean;
      opportunityId: string;
    }): CombatRoundAttackRollResult =>
      combatRoundAttackRollResultSchema.parse({
        actionId: "double_attack",
        attackIndex: 1,
        attackOpportunityId: input.opportunityId,
        attackerParticipantId: input.attackerParticipantId,
        defenderDb: DEFENDER_DB,
        defenderParticipantId: input.defenderParticipantId,
        ...(input.flagged
          ? { extrapolatedWorkbookAdjustments: ["attacker_ob", "defender_db"] }
          : {}),
        grazing: false,
        hit: true,
        kind: "attackRoll",
        lookupTotal: ATTACKER_OB - DEFENDER_DB + 14,
        marginOverMissThreshold: 23,
        ob: ATTACKER_OB,
        openEndedD10s: [],
        phase: "phase1",
        rollD20: 14,
        rollTotal: 14,
        rolledAt: new Date().toISOString(),
        tableResult: "C",
        weaponName: WEAPON_NAME,
      });

    /**
     * The main line as `formatCombatAttackResultMainLine` composes it. The harness's replica, not
     * the production function: a `.tsx`-private formatter is not importable here. Its only job is
     * to be the text whose painting is measured.
     */
    const mainLine = (flagged: boolean) =>
      `Main: ${WEAPON_NAME} OB ${ATTACKER_OB}${flagged ? ` ${MARKER}` : ""} - DB ${DEFENDER_DB}${
        flagged ? ` ${MARKER}` : ""
      } + roll 14 = ${ATTACKER_OB - DEFENDER_DB + 14}`;

    /**
     * Builds one Encounter whose phase-1 attack step is in the past and carries a committed attack
     * result for the attacker, and returns its id with the evidence read back off the stored row.
     *
     * `includeAttackResultOnSnapshot` is the whole experiment. `true` is the shape
     * `buildCombatRoundStepSnapshots` writes — `attackResult` and `actionResultSummary` together.
     * `false` is the legacy shape the panel's own "Some historical result details are unavailable."
     * banner exists for, and the only shape in which the main line is displayed.
     */
    const buildRoundWithCommittedAttack = async (input: {
      flagged: boolean;
      includeAttackResultOnSnapshot: boolean;
      label: string;
    }): Promise<{ encounterId: string; evidence: Record<string, unknown>; ownerId: string }> => {
      const encounterId = `issue-940-s8-${input.label}-${suffix}`;
      const OWNER = `${encounterId}-owner`;
      const FOE = `${encounterId}-foe`;
      const now = new Date().toISOString();

      await json(
        await gmPage.request.post(`${API_URL}/scenarios/${scenarioId}/encounters`, {
          data: {
            session: {
              campaignId,
              createdAt: now,
              currentRound: 1,
              id: encounterId,
              kind: "combat",
              participantMembershipMode: "explicit",
              participants: [
                {
                  characterId: OWNER_CHARACTER,
                  id: OWNER,
                  label: OWNER_NAME,
                  participantType: "scenario",
                  scenarioParticipantId: ownerParticipant.participant.id,
                },
                {
                  characterId: FOE_CHARACTER,
                  id: FOE,
                  label: FOE_NAME,
                  participantType: "scenario",
                  scenarioParticipantId: foeParticipant.participant.id,
                },
              ],
              scenarioId,
              status: "draft",
              title: `Issue 940 S8 ${input.label}`,
              updatedAt: now,
            },
          },
        }),
      );
      const draft = await readEncounter(encounterId);
      await json(
        await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
          data: { expectedRevision: draft.updatedAt, status: "active" },
        }),
      );
      const active = await readEncounter(encounterId);

      let state: CombatRoundState = [OWNER, FOE].reduce(
        (current, participantId, index) =>
          rollCombatRoundCombatExperience({
            command: { createdAt: new Date(Date.now() + index).toISOString() },
            participantId,
            rng: () => 0.6,
            skillTotal: 26,
            state: current,
          }).state,
        setCombatRoundCombatExperienceDifficulty({
          difficulty: 1,
          state: initializeCombatRoundState({ encounter: active }),
        }),
      );
      const roundNumber = state.roundNumber;
      for (const [participantId, targetParticipantId] of [
        [OWNER, FOE],
        [FOE, OWNER],
      ] as const) {
        state = recordCombatRoundDeclaration({
          declaration: {
            actionId: "double_attack",
            combatContext: phaseContext(targetParticipantId),
            phaseContexts: {
              phase1: phaseContext(targetParticipantId),
              phase2: phaseContext(targetParticipantId),
            },
            roundNumber,
          },
          participantId,
          state,
          submittedBy: "gm",
        });
      }
      state = advanceCombatRoundStep(advanceCombatRoundStep(state));
      expect(state.currentStep, `${input.label}: two transitions reach phase-1 initiative`).toBe(
        "initiative_phase_1",
      );

      const opportunityId = `${encounterId}-opp-1`;
      const committed = attackResult({
        attackerParticipantId: OWNER,
        defenderParticipantId: FOE,
        flagged: input.flagged,
        opportunityId,
      });
      const summary = `${mainLine(input.flagged)}\nResult: ${committed.tableResult}`;

      // The attack step is put in the past so that its tracker cell is history, which is the only
      // place any of the three main-line call sites is reached.
      //
      // The step chosen is `review_phase_2_modifiers` rather than the step immediately after `A1`,
      // and that is load-bearing. `GET /encounters/:id` does not return the stored round state as
      // it stands: it builds `initializeMaterializedCombatRoundState` and, where that differs,
      // returns the materialized state instead. `initializeCombatRoundState` then runs
      // `combatRoundStateHasUnsupportedPhaseStep`, which for a **non-global** step demands a
      // `commands` entry whose `afterCursor` matches the cursor, and otherwise repairs the round
      // back down. Measured: a state written at `review_phase_2_actions`/`P1` persisted correctly
      // in `Encounter.sessionJson` — `currentStep: "review_phase_2_actions"`, one snapshot, both
      // declarations — and the very next `GET` answered `select_actions` with **zero** snapshots.
      // `isGlobalCombatRoundStep` lists `review_phase_2_modifiers`, so that step is returned as
      // written, and it is after `phase_1_actions` in `COMBAT_ROUND_STEPS`, which is all the A1 cell
      // needs to be reachable history.
      const withResult: CombatRoundState = combatRoundStateSchema.parse({
        ...state,
        currentCursor: { participantId: OWNER, roundNumber, step: "M2" },
        currentStep: "review_phase_2_modifiers",
        participants: state.participants.map((participant) =>
          participant.participantId === OWNER
            ? {
                ...participant,
                attackResultsByOpportunity: { [opportunityId]: committed },
                stepStatuses: { ...participant.stepStatuses, phase_1_actions: "complete" },
              }
            : participant,
        ),
        selectedParticipantId: OWNER,
        selectedStep: "review_phase_2_modifiers",
      });
      const snapshotState = upsertCombatRoundStepSnapshots({
        snapshots: [
          combatRoundStepSnapshotSchema.parse({
            actionResultStatus: "recorded",
            actionResultSummary: summary,
            ...(input.includeAttackResultOnSnapshot ? { attackResult: committed } : {}),
            committedAt: new Date().toISOString(),
            id: `${encounterId}-snapshot-a1`,
            participantId: OWNER,
            participantLabel: OWNER_NAME,
            phase: "phase1",
            roundNumber,
            step: "phase_1_actions",
          }),
        ],
        state: withResult,
      });

      const put = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
        data: {
          expectedRevision: active.updatedAt,
          session: {
            ...active,
            combatRoundState: snapshotState,
            currentRound: roundNumber,
            status: "active",
          },
        },
      });
      const putBody = await put.text();
      expect(put.ok(), `${input.label}: the single state write — ${putBody}`).toBe(true);
      const putBodySnapshotCount = (() => {
        try {
          return (
            (JSON.parse(putBody) as { encounter?: { combatRoundState?: { stepSnapshots?: [] } } })
              .encounter?.combatRoundState?.stepSnapshots?.length ?? -1
          );
        } catch {
          return -2;
        }
      })();

      // Verified against what the server holds, never against what was sent.
      const stored = combatRoundStateSchema.parse(
        (await readEncounter(encounterId)).combatRoundState,
      );
      const storedSnapshot = stored.stepSnapshots.find(
        (snapshot) => snapshot.participantId === OWNER && snapshot.step === "phase_1_actions",
      );
      const evidence = {
        storedCurrentStep: stored.currentStep,
        storedSnapshotCount: stored.stepSnapshots.length,
        storedSnapshotHasAttackResult: Boolean(storedSnapshot?.attackResult),
        storedSnapshotActionResultStatus: storedSnapshot?.actionResultStatus,
        storedSnapshotSummary: storedSnapshot?.actionResultSummary,
        storedSnapshotSummaryCarriesMarker: Boolean(
          storedSnapshot?.actionResultSummary?.includes(MARKER),
        ),
        storedSnapshotFlag: storedSnapshot?.attackResult?.extrapolatedWorkbookAdjustments,
        storedCommittedResultFlag: stored.participants.find(
          (participant) => participant.participantId === OWNER,
        )?.attackResultsByOpportunity?.[opportunityId]?.extrapolatedWorkbookAdjustments,
        storedEventCount: stored.events.length,
        storedSnapshotIndex: stored.stepSnapshots.map((snapshot) => ({
          id: snapshot.id,
          participantId: snapshot.participantId,
          status: snapshot.actionResultStatus,
          step: snapshot.step,
        })),
        sentSnapshotCount: snapshotState.stepSnapshots.length,
        putResponseSnapshotCount: putBodySnapshotCount,
      };
      console.log(`#940 S8 FIXTURE ${input.label}\n${JSON.stringify(evidence, null, 2)}`);
      // Read back through the route the page reads, not only out of the row: the `GET` materializes
      // and can repair, and a repair that moved the round would invalidate every reading below.
      expect(
        evidence.storedCurrentStep,
        `${input.label}: the route returns the round past the phase-1 attack step`,
      ).toBe("review_phase_2_modifiers");
      expect(
        evidence.storedSnapshotActionResultStatus,
        `${input.label}: the server holds a recorded phase-1 attack step`,
      ).toBe("recorded");
      expect(
        evidence.storedSnapshotHasAttackResult,
        `${input.label}: the stored snapshot carries the committed result exactly as asked`,
      ).toBe(input.includeAttackResultOnSnapshot);
      expect(
        evidence.storedEventCount,
        `${input.label}: no canonical events, so the legacy fallback is the branch under test`,
      ).toBe(0);

      return { encounterId, evidence, ownerId: OWNER };
    };

    /** Bounded wait for the historical panel, with the page's own state recorded if it never comes. */
    const selectAttackStepCell = async (where: string) => {
      const cell = gmPage
        .getByRole("button", { name: new RegExp(`${OWNER_NAME}.*Round 1.*A1:`) })
        .first();
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if ((await cell.count()) > 0 && (await cell.isEnabled())) {
          await cell.click();
          await gmPage.waitForTimeout(2000);
          return true;
        }
        await gmPage.waitForTimeout(1000);
      }
      record[`DIAGNOSTIC ${where}`] = await gmPage.evaluate(() => ({
        body: (document.body.innerText ?? "").slice(0, 2500),
        cellLabels: [...document.querySelectorAll("button[aria-label]")]
          .map((node) => node.getAttribute("aria-label"))
          .filter((label) => (label ?? "").includes("Round 1"))
          .slice(0, 40),
      }));
      return false;
    };

    /**
     * Brings the historical result panel into view before it is measured. The scroll is always a
     * separate step and never inside the atomic read.
     */
    const scrollHistoricalPanelIntoView = async () => {
      await gmPage.evaluate(() => {
        const panel = [...document.querySelectorAll("section")].find((node) =>
          (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
        );
        panel?.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
      });
      await gmPage.waitForTimeout(750);
    };

    const captureAtEveryWidth = async (input: { encounterId: string; stateKey: string }) => {
      const route = `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${input.encounterId}&tab=combat`;
      const reads: Record<string, AttackLineRead> = {};
      for (const width of WIDTHS) {
        await gmPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await gmPage.goto(route);
        await gmPage.waitForTimeout(3000);
        const selected = await selectAttackStepCell(`${input.stateKey} @${width}`);
        expect(selected, `${input.stateKey} @${width}: the A1 tracker cell is inspectable`).toBe(
          true,
        );
        await scrollHistoricalPanelIntoView();
        reads[`gm@${width}`] = await readAttackResultLine(gmPage);
      }
      record[input.stateKey] = reads;
      console.log(`#940 S8 STATE ${input.stateKey}\n${JSON.stringify(reads, null, 2)}`);
      return reads;
    };

    const closeEncounter = async (encounterId: string) => {
      const paused = await readEncounter(encounterId);
      await json(
        await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
          data: { expectedRevision: paused.updatedAt, status: "paused" },
        }),
      );
      const completed = await readEncounter(encounterId);
      await json(
        await gmPage.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
          data: {
            expectedRevision: completed.updatedAt,
            playerOutcome: "Measured for the #940 S8 rendered reading.",
            status: "completed",
          },
        }),
      );
    };

    // ========= the shape the application writes: the main line is not drawn at all =========
    const appShaped = await buildRoundWithCommittedAttack({
      flagged: true,
      includeAttackResultOnSnapshot: true,
      label: "app-shaped",
    });
    record["FIXTURE app-shaped"] = appShaped.evidence;
    expect(
      appShaped.evidence.storedSnapshotFlag,
      "app-shaped: the stored committed result carries the Tier A flag",
    ).toEqual(["attacker_ob", "defender_db"]);
    const appShapedReads = await captureAtEveryWidth({
      encounterId: appShaped.encounterId,
      stateKey: "app-shaped, snapshot carries the committed result",
    });
    for (const [where, read] of Object.entries(appShapedReads)) {
      expect
        .soft(read.historicalPanelAriaLabels.length, `app-shaped ${where}: the panel rendered`)
        .toBeGreaterThan(0);
      // The measured defect. `buildCombatAttackResultPanel` supplies a one-entry `sections` array
      // alongside `interpretedResult`, and the panel renders `sections` in preference, so the
      // committed main line — and with it Tier A's marker — is never painted.
      expect
        .soft(
          read.mainLineNodeCount,
          `app-shaped ${where}: no committed main line is drawn anywhere in the document`,
        )
        .toBe(0);
      expect
        .soft(
          read.markerOccurrencesInDom,
          `app-shaped ${where}: the marker appears nowhere in the DOM`,
        )
        .toBe(0);
      // What is drawn in its place, which is what makes the zero above a measurement rather than a
      // blind spot — and which is where the marker would have to go. The `To hit` section draws the
      // two committed figures Tier A flagged, as their own calculation rows, **unmarked**.
      expect
        .soft(read.historicalPanelText, `app-shaped ${where}: the To hit section is drawn instead`)
        .toContain("To hit");
      expect
        .soft(
          read.historicalPanelText,
          `app-shaped ${where}: the committed OB the flag names is on screen, unmarked`,
        )
        .toContain(`OB: ${ATTACKER_OB}`);
      expect
        .soft(
          read.historicalPanelText,
          `app-shaped ${where}: the committed DB the flag names is on screen, unmarked`,
        )
        .toContain(`Defender DB: ${DEFENDER_DB}`);
    }
    await closeEncounter(appShaped.encounterId);

    // ===== the legacy shape: the only shape that draws it, and the marker measured on it =====
    const legacyMarked = await buildRoundWithCommittedAttack({
      flagged: true,
      includeAttackResultOnSnapshot: false,
      label: "legacy-marked",
    });
    record["FIXTURE legacy-marked"] = legacyMarked.evidence;
    const legacyMarkedReads = await captureAtEveryWidth({
      encounterId: legacyMarked.encounterId,
      stateKey: "legacy-shaped, marked",
    });
    for (const [where, read] of Object.entries(legacyMarkedReads)) {
      expect
        .soft(read.mainLineNodeCount, `legacy marked ${where}: the main line is drawn`)
        .toBeGreaterThan(0);
      expect
        .soft(read.marker.found, `legacy marked ${where}: the marker is painted on that line`)
        .toBe(true);
      expect
        .soft(
          read.marker.inSameTextNodeAsFigure,
          `legacy marked ${where}: the marker and the OB figure are the same text node`,
        )
        .toBe(true);
      expect
        .soft(
          read.marker.clippedByAllAncestorsPx,
          `legacy marked ${where}: the marker is not clipped by any ancestor`,
        )
        .toBe(0);
      expect
        .soft(read.marker.glyphHits, `legacy marked ${where}: all five glyph probes hit its line`)
        .toBe(5);
      expect
        .soft(read.marker.insideViewportAtThisScroll, `legacy marked ${where}: it is on screen`)
        .toBe(true);
      expect
        .soft(read.marker.rect.width, `legacy marked ${where}: the marker has width`)
        .toBeGreaterThan(10);
      expect
        .soft(read.marker.rect.height, `legacy marked ${where}: the marker has height`)
        .toBeGreaterThan(8);
      expect
        .soft(read.marker.computedStyle.visibility, `legacy marked ${where}: it is visible`)
        .toBe("visible");
    }
    await closeEncounter(legacyMarked.encounterId);

    // ============ the negative control, in the one shape that draws the line ============
    const legacyControl = await buildRoundWithCommittedAttack({
      flagged: false,
      includeAttackResultOnSnapshot: false,
      label: "legacy-control",
    });
    record["FIXTURE legacy-control"] = legacyControl.evidence;
    const legacyControlReads = await captureAtEveryWidth({
      encounterId: legacyControl.encounterId,
      stateKey: "legacy-shaped, control",
    });
    for (const [where, read] of Object.entries(legacyControlReads)) {
      expect
        .soft(read.mainLineNodeCount, `legacy control ${where}: the main line is drawn`)
        .toBeGreaterThan(0);
      expect
        .soft(
          read.mainLineTexts.join(" "),
          `legacy control ${where}: the figure itself is rendered, so the control is not vacuous`,
        )
        .toContain(`OB ${ATTACKER_OB}`);
      expect.soft(read.marker.found, `legacy control ${where}: no marker is painted`).toBe(false);
      expect
        .soft(
          read.markerOccurrencesInDom,
          `legacy control ${where}: the marker appears nowhere in the DOM`,
        )
        .toBe(0);
    }
    await closeEncounter(legacyControl.encounterId);

    console.log(`#940 S8 rendered reading\n${JSON.stringify(record, null, 2)}`);
  });
});
