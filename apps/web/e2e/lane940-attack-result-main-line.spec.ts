import * as fs from "node:fs";
import * as path from "node:path";

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
 * **The rendered reading on #1002: the GM's `To hit` calculation rows carry the `Extrapolated`
 * badge and the review sentence, per figure, and nothing on a player surface does.**
 *
 * Product Owner ruling (#1002, comment 22528): an `Extrapolated` badge beside each affected figure
 * plus the visible sentence ending "Review this figure.", the same treatment as the two accepted
 * initiative panels. Product Owner decision (comment 23577): the badge is **GM-only**.
 *
 * The snapshot is the shape the application writes (`attackResult.extrapolatedWorkbookAdjustments`
 * on a recorded phase-1 step, no `actionResultSummary`), and it is read back through
 * `GET /encounters/:id`, the route the page reads, because that route materialises and can rewind a
 * hand-composed step (`review_phase_2_modifiers` is a global step and is returned as written).
 * The round carries no canonical events, so the GM inspector takes the snapshot fallback, which is
 * the branch the marked rows live on; the command-driven event path is out of scope by work order.
 *
 * Readings, each at 768, 1024 and 1440, every rectangle and text read for one capture inside a
 * single `page.evaluate`:
 *
 * - `both`: both figures flagged. `OB: 81` and `Defender DB: 12` each carry a badge and sentence.
 * - `ob-only`, `db-only`: only the flagged figure is badged.
 * - `control`: the same round unflagged, in the same run. The figures render, the marker is absent.
 * - the player's own result surface for the flagged round, enumerated by element.
 *
 * Lane-scoped (`lane940-` prefix, kept so the existing lane configuration matches it) and excluded
 * from the ordinary suite. Run it against a freshly provisioned, migrated, unseeded task target:
 *
 * ```
 * pnpm db:task:e2e --config=playwright.lane940.config.ts e2e/lane940-attack-result-main-line.spec.ts
 * ```
 *
 * `CAPTURE_LABEL=before` runs the same readings without the marker assertions, on a build without
 * the change, to produce the "before" capture and composition reading. `CAPTURE_DIR` receives the
 * screenshots and `reads.json`.
 */

const VIEWPORT_HEIGHT = 900;

/** The established usable-width set for these surfaces (#940 comment 21864). */
const WIDTHS = [768, 1024, 1440] as const;

const WEAPON_NAME = "Broad sword";
const ATTACKER_OB = 81;
const DEFENDER_DB = 12;

const CAPTURE_LABEL = process.env.CAPTURE_LABEL ?? "after";
const CAPTURE_DIR = process.env.CAPTURE_DIR ?? "";
const EXPECT_MARKERS = CAPTURE_LABEL !== "before";

const MARKER_TESTID = "combat-calculation-extrapolation-marker";
const DETAIL_TESTID = "combat-calculation-extrapolation-detail";

interface BoxRead {
  clippedByAllAncestorsPx: number;
  clippingAncestors: string[];
  glyphHits: number;
  rect: { bottom: number; height: number; left: number; right: number; top: number; width: number };
  text: string;
  visible: boolean;
}

interface FigureRead {
  badge: BoxRead | null;
  detail: BoxRead | null;
  /** The badge is a DOM descendant of the row element that holds the figure's own text node. */
  badgeIsDescendantOfFigureRow: boolean;
  /** The badge sits on the figure's own line, to its right. */
  badgeOnFigureLine: boolean;
  detailBelowBadge: boolean;
  figureText: string;
  figureVisible: boolean;
  label: string;
}

interface RowsRead {
  documentDetailTexts: string[];
  documentExtrapolatedTextNodes: number;
  documentMarkerElements: number;
  documentReviewSentences: number;
  /** Case-insensitive `extrapolat` anywhere in text, aria-label, title or alt. */
  documentExtrapolatMentions: number;
  figures: FigureRead[];
  innerWidth: number;
  noHorizontalOverflow: boolean;
  panelAriaLabels: string[];
  /** The result panel's text with the marker and sentence removed, for the composition check. */
  panelTextWithoutMarkers: string;
  panelHeight: number;
  scrollY: number;
}

/**
 * One atomic read of the calculation rows (`OB`, `Adjusted OB`, `Defender DB`), the marker inside
 * each, and the document-wide counts. Clipping is accumulated over every clipping ancestor and the
 * glyph probe takes five points that must resolve to the marker's own element.
 */
async function readCalculationRows(page: Page): Promise<RowsRead> {
  return page.evaluate(
    ({ detailTestId, markerTestId }) => {
      const describe = (node: Element | null) =>
        node
          ? `${node.tagName}${node.getAttribute("data-testid") ? `[${node.getAttribute("data-testid")}]` : ""}`
          : "";
      const measure = (el: Element | null): BoxRead | null => {
        if (!el) return null;
        const box = el.getBoundingClientRect();
        const rect = {
          bottom: box.bottom,
          height: box.height,
          left: box.left,
          right: box.right,
          top: box.top,
          width: box.width,
        };
        const clippingAncestors: string[] = [];
        let clipped = 0;
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          const style = window.getComputedStyle(parent);
          const clips = [style.overflow, style.overflowX, style.overflowY].some(
            (value) =>
              value === "hidden" || value === "clip" || value === "auto" || value === "scroll",
          );
          if (!clips) continue;
          const parentBox = parent.getBoundingClientRect();
          clippingAncestors.push(describe(parent));
          clipped += Math.round(
            Math.max(0, parentBox.left - rect.left) +
              Math.max(0, rect.right - parentBox.right) +
              Math.max(0, parentBox.top - rect.top) +
              Math.max(0, rect.bottom - parentBox.bottom),
          );
        }
        let glyphHits = 0;
        for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width * fraction));
          const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === el || el.contains(hit))) glyphHits += 1;
        }
        return {
          clippedByAllAncestorsPx: clipped,
          clippingAncestors,
          glyphHits,
          rect,
          text: (el.textContent ?? "").trim(),
          visible: el.checkVisibility(),
        };
      };

      const figureNodes: Text[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let extrapolatedTextNodes = 0;
      let reviewSentences = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const data = (node.data ?? "").trim();
        if (/^(Base OB|Adjusted OB|OB|Defender DB): -?\d+$/.test(data)) figureNodes.push(node);
        if (data === "Extrapolated") extrapolatedTextNodes += 1;
        if (data.endsWith("Review this figure.")) reviewSentences += 1;
      }

      const figures: FigureRead[] = figureNodes.map((node) => {
        const row = node.parentElement!;
        const badgeEl = row.querySelector(`[data-testid="${markerTestId}"]`);
        const detailEl = row.querySelector(`[data-testid="${detailTestId}"]`);
        const range = document.createRange();
        range.selectNodeContents(node);
        const figureRect = range.getBoundingClientRect();
        const badge = measure(badgeEl);
        const detail = measure(detailEl);
        return {
          badge,
          badgeIsDescendantOfFigureRow: Boolean(badgeEl && row.contains(badgeEl)),
          badgeOnFigureLine: Boolean(
            badge &&
            Math.abs(
              badge.rect.top + badge.rect.height / 2 - (figureRect.top + figureRect.height / 2),
            ) < figureRect.height &&
            badge.rect.left >= figureRect.right - 1,
          ),
          detail,
          detailBelowBadge: Boolean(badge && detail && detail.rect.top >= badge.rect.bottom - 1),
          figureText: (node.data ?? "").trim(),
          figureVisible: row.checkVisibility(),
          label: (node.data ?? "").split(":")[0] ?? "",
        };
      });

      const panels = [...document.querySelectorAll("section")].filter((node) =>
        (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
      );
      const clone = panels[0]?.cloneNode(true) as HTMLElement | undefined;
      clone
        ?.querySelectorAll(`[data-testid="${markerTestId}"],[data-testid="${detailTestId}"]`)
        .forEach((node) => node.remove());
      let mentions = ((document.body.textContent ?? "").match(/extrapolat/gi) ?? []).length;
      for (const el of document.querySelectorAll("[aria-label],[title],[alt]")) {
        for (const attr of ["aria-label", "title", "alt"]) {
          if (/extrapolat/i.test(el.getAttribute(attr) ?? "")) mentions += 1;
        }
      }
      return {
        documentDetailTexts: [...document.querySelectorAll(`[data-testid="${detailTestId}"]`)].map(
          (node) => (node.textContent ?? "").trim(),
        ),
        documentExtrapolatMentions: mentions,
        documentExtrapolatedTextNodes: extrapolatedTextNodes,
        documentMarkerElements: document.querySelectorAll(`[data-testid="${markerTestId}"]`).length,
        documentReviewSentences: reviewSentences,
        figures,
        innerWidth: window.innerWidth,
        noHorizontalOverflow:
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.body.scrollWidth <= window.innerWidth,
        panelAriaLabels: panels.map((node) => node.getAttribute("aria-label") ?? ""),
        panelHeight: Math.round(panels[0]?.getBoundingClientRect().height ?? 0),
        panelTextWithoutMarkers: (clone?.textContent ?? "").replace(/\s+/g, " ").trim(),
        scrollY: Math.round(window.scrollY),
      };
    },
    { detailTestId: DETAIL_TESTID, markerTestId: MARKER_TESTID },
  );
}

/** The player's rendered result surface, enumerated by element (acceptance 3). */
async function readPlayerSurface(page: Page) {
  return page.evaluate(() => {
    const panels = [...document.querySelectorAll("section")].filter((node) =>
      (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
    );
    const enumerate = (root: ParentNode) =>
      [...root.querySelectorAll("*")]
        .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim())
        .map((el) => (el.textContent ?? "").trim().slice(0, 80));
    const mentions = [...document.querySelectorAll("*")].filter((el) => {
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join("");
      return (
        /extrapolat|review this figure/i.test(own) ||
        ["aria-label", "title", "alt"].some((a) => /extrapolat/i.test(el.getAttribute(a) ?? ""))
      );
    });
    return {
      bodyHasExtrapolatText: /extrapolat|review this figure/i.test(document.body.textContent ?? ""),
      calculationRowTexts: [...document.querySelectorAll("div")]
        .filter(
          (el) =>
            /^(Base OB|Adjusted OB|OB|Defender DB): /.test((el.textContent ?? "").trim()) &&
            el.children.length === 0,
        )
        .map((el) => (el.textContent ?? "").trim()),
      markerTestIdElements: document.querySelectorAll('[data-testid*="extrapolat"]').length,
      mentionElements: mentions.length,
      panelLabels: panels.map((p) => p.getAttribute("aria-label") ?? ""),
      panelLeafTexts: panels.flatMap((p) => enumerate(p)),
      toHitCalculationSummaries: [...document.querySelectorAll("summary")]
        .map((s) => (s.textContent ?? "").trim())
        .filter((t) => /calculation$/.test(t)),
      totalElements: document.querySelectorAll("*").length,
    };
  });
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

test.describe("#1002 the GM calculation rows carry the Extrapolated badge", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("badges each flagged figure on the GM surface and nothing on the player surface", async ({
    browser,
    page: gmPage,
  }) => {
    test.setTimeout(1_800_000);
    const record: Record<string, unknown> = {};
    const suffix = Date.now();

    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );

    const OWNER_CHARACTER = `s1-attacker-${suffix}`;
    const FOE_CHARACTER = `s1-defender-${suffix}`;
    const OWNER_NAME = `Badge Attacker ${suffix}`;
    const FOE_NAME = `Badge Defender ${suffix}`;

    for (const [id, name] of [
      [OWNER_CHARACTER, OWNER_NAME],
      [FOE_CHARACTER, FOE_NAME],
    ] as const) {
      await createCharacterForE2e({ apiUrl: API_URL, id, name, request: gmPage.request });
    }

    const campaign = await json<{ campaign: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns`, {
        data: { name: `Issue 1002 ${suffix}`, status: "active" },
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
        data: { name: `Issue 1002 Scenario ${suffix}`, status: "live" },
      }),
    );
    const scenarioId = scenario.scenario.id;
    const ownerParticipant = await json<{ participant: { id: string } }>(
      await gmPage.request.post(`${API_URL}/scenarios/${scenarioId}/participants/character`, {
        data: { characterId: OWNER_CHARACTER, controlledByUserId: playerUser.user.id },
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
    const playerPage = await playerContext.newPage();
    const playerRoute = `/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`;

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
      flags: string[];
      opportunityId: string;
    }): CombatRoundAttackRollResult =>
      combatRoundAttackRollResultSchema.parse({
        actionId: "double_attack",
        attackIndex: 1,
        attackOpportunityId: input.opportunityId,
        attackerParticipantId: input.attackerParticipantId,
        defenderDb: DEFENDER_DB,
        defenderParticipantId: input.defenderParticipantId,
        ...(input.flags.length ? { extrapolatedWorkbookAdjustments: input.flags } : {}),
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
     * Builds one Encounter whose phase-1 attack step is in the past and carries a committed attack
     * result for the attacker, and returns its id with the evidence read back off the stored row.
     *
     * The snapshot is the shape the application writes: `attackResult` present, no
     * `actionResultSummary`, which no production writer produces at this baseline.
     */
    const buildRoundWithCommittedAttack = async (input: {
      flags: string[];
      label: string;
    }): Promise<{ encounterId: string; evidence: Record<string, unknown>; ownerId: string }> => {
      const encounterId = `issue-1002-${input.label}-${suffix}`;
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
              title: `Issue 1002 ${input.label}`,
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
        flags: input.flags,
        opportunityId,
      });

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
            attackResult: committed,
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
      console.log(`#1002 FIXTURE ${input.label}\n${JSON.stringify(evidence, null, 2)}`);
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
      ).toBe(true);
      expect(
        evidence.storedEventCount,
        `${input.label}: no canonical events, so the legacy fallback is the branch under test`,
      ).toBe(0);

      return { encounterId, evidence, ownerId: OWNER };
    };

    /** Bounded wait for the A1 tracker cell, with the page's own state recorded if it never comes. */
    const selectAttackStepCell = async (page: Page, where: string) => {
      const cell = page
        .getByRole("button", { name: new RegExp(`${OWNER_NAME}.*Round 1.*A1:`) })
        .first();
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if ((await cell.count()) > 0 && (await cell.isEnabled())) {
          await cell.click();
          await page.waitForTimeout(2000);
          return true;
        }
        await page.waitForTimeout(1000);
      }
      record[`DIAGNOSTIC ${where}`] = await page.evaluate(() => ({
        body: (document.body.innerText ?? "").slice(0, 2500),
        cellLabels: [...document.querySelectorAll("button[aria-label]")]
          .map((node) => node.getAttribute("aria-label"))
          .filter((label) => (label ?? "").includes("Round 1"))
          .slice(0, 40),
      }));
      return false;
    };

    /** Scroll and expansion are separate steps, never inside the atomic read. */
    const openCalculation = async (page: Page) => {
      const summary = page
        .locator('section[aria-label^="Historical result"] summary')
        .filter({ hasText: "To hit calculation" })
        .first();
      if ((await summary.count()) > 0) {
        const open = await summary.evaluate(
          (node) => (node.parentElement as HTMLDetailsElement).open,
        );
        if (!open) await summary.click();
      }
      await page.evaluate(() => {
        const panel = [...document.querySelectorAll("section")].find((node) =>
          (node.getAttribute("aria-label") ?? "").startsWith("Historical result"),
        );
        panel?.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
      });
      await page.waitForTimeout(750);
    };

    const captureDir = CAPTURE_DIR ? path.join(CAPTURE_DIR, CAPTURE_LABEL) : "";
    if (captureDir) fs.mkdirSync(captureDir, { recursive: true });

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
            playerOutcome: "Measured for the #1002 rendered reading.",
            status: "completed",
          },
        }),
      );
    };

    const gmRoute = (encounterId: string) =>
      `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`;

    const readings: Record<string, Record<string, RowsRead>> = {};
    const playerReadings: Record<string, unknown> = {};

    const cases = [
      { flags: ["attacker_ob", "defender_db"], key: "both" },
      { flags: ["attacker_ob"], key: "ob-only" },
      { flags: ["defender_db"], key: "db-only" },
      { flags: [] as string[], key: "control" },
    ];

    for (const testCase of cases) {
      const round = await buildRoundWithCommittedAttack({
        flags: testCase.flags,
        label: testCase.key,
      });
      record[`FIXTURE ${testCase.key}`] = round.evidence;
      expect(
        round.evidence.storedSnapshotFlag ?? [],
        `${testCase.key}: the stored snapshot carries exactly the intended flags`,
      ).toEqual(testCase.flags);
      readings[testCase.key] = {};
      for (const width of WIDTHS) {
        await gmPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await gmPage.goto(gmRoute(round.encounterId));
        await gmPage.waitForTimeout(3000);
        expect(
          await selectAttackStepCell(gmPage, `${testCase.key} gm@${width}`),
          `${testCase.key} @${width}: A1 cell inspectable`,
        ).toBe(true);
        await openCalculation(gmPage);
        const read = await readCalculationRows(gmPage);
        readings[testCase.key][`gm@${width}`] = read;
        if (captureDir) {
          await gmPage
            .locator('section[aria-label^="Historical result"]')
            .first()
            .screenshot({ path: path.join(captureDir, `${testCase.key}-${width}.png`) });
        }

        const ofLabel = (label: string) => read.figures.find((f) => f.label === label);
        const where = `${testCase.key} @${width}`;
        expect
          .soft(
            read.figures.map((f) => f.figureText),
            `${where}: the committed figures are rendered`,
          )
          .toEqual([`OB: ${ATTACKER_OB}`, `Defender DB: ${DEFENDER_DB}`]);
        expect
          .soft(
            read.figures.every((f) => f.figureVisible),
            `${where}: figure rows visible`,
          )
          .toBe(true);
        expect.soft(read.noHorizontalOverflow, `${where}: no horizontal overflow`).toBe(true);
        if (!EXPECT_MARKERS) continue;

        const wantOb = testCase.flags.includes("attacker_ob");
        const wantDb = testCase.flags.includes("defender_db");
        for (const [label, want] of [
          ["OB", wantOb],
          ["Defender DB", wantDb],
        ] as const) {
          const figure = ofLabel(label);
          expect
            .soft(Boolean(figure?.badge), `${where}: ${label} badge presence is ${want}`)
            .toBe(want);
          expect
            .soft(Boolean(figure?.detail), `${where}: ${label} sentence presence is ${want}`)
            .toBe(want);
          if (!want || !figure?.badge || !figure.detail) continue;
          expect.soft(figure.badge.text, `${where}: ${label} badge text`).toBe("Extrapolated");
          expect
            .soft(figure.detail.text, `${where}: ${label} sentence`)
            .toMatch(/Review this figure\.$/);
          expect
            .soft(
              figure.badgeIsDescendantOfFigureRow,
              `${where}: ${label} badge is a descendant of the figure's own element`,
            )
            .toBe(true);
          expect
            .soft(figure.badgeOnFigureLine, `${where}: ${label} badge sits beside the figure`)
            .toBe(true);
          expect.soft(figure.detailBelowBadge, `${where}: ${label} sentence is beneath`).toBe(true);
          for (const box of [figure.badge, figure.detail]) {
            expect.soft(box.visible, `${where}: ${label} marker visible`).toBe(true);
            expect
              .soft(
                box.clippedByAllAncestorsPx,
                `${where}: ${label} marker unclipped by every ancestor`,
              )
              .toBe(0);
            expect
              .soft(box.glyphHits, `${where}: ${label} five glyph probes hit the marker's own node`)
              .toBe(5);
            expect.soft(box.rect.width, `${where}: ${label} marker has width`).toBeGreaterThan(10);
            expect
              .soft(box.rect.right, `${where}: ${label} inside viewport`)
              .toBeLessThanOrEqual(read.innerWidth);
          }
        }
        expect
          .soft(read.documentMarkerElements, `${where}: badge count`)
          .toBe(testCase.flags.length);
        expect
          .soft(read.documentReviewSentences, `${where}: sentence count`)
          .toBe(testCase.flags.length);
        if (testCase.flags.length === 0) {
          expect
            .soft(
              read.documentExtrapolatMentions,
              `${where}: control has no extrapolation text anywhere`,
            )
            .toBe(0);
        }
      }

      // The player's own surface for the same round (acceptance 3): enumerated, never marked.
      playerReadings[testCase.key] = {};
      for (const width of WIDTHS) {
        await playerPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await playerPage.goto(playerRoute);
        await playerPage.waitForTimeout(3000);
        const opened = await selectAttackStepCell(playerPage, `${testCase.key} player@${width}`);
        await playerPage.waitForTimeout(1000);
        const surface = await readPlayerSurface(playerPage);
        (playerReadings[testCase.key] as Record<string, unknown>)[`player@${width}`] = {
          opened,
          ...surface,
        };
        expect
          .soft(
            surface.bodyHasExtrapolatText,
            `player ${testCase.key} @${width}: no extrapolation text`,
          )
          .toBe(false);
        expect
          .soft(
            surface.markerTestIdElements,
            `player ${testCase.key} @${width}: no marker elements`,
          )
          .toBe(0);
        expect
          .soft(surface.mentionElements, `player ${testCase.key} @${width}: no element mentions it`)
          .toBe(0);
      }
      await closeEncounter(round.encounterId);
    }

    record["gm readings"] = readings;
    record["player readings"] = playerReadings;
    if (captureDir) {
      fs.writeFileSync(path.join(captureDir, "reads.json"), JSON.stringify(record, null, 2));
    }
    console.log(`#1002 rendered reading\n${JSON.stringify(record, null, 2)}`);
    await playerPage.close();
    await playerContext.close();
  });
});
