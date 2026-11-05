import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  advanceCombatRoundStep,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseInitiativeResolution,
  ensureCombatRoundEndReviewPrepared,
  isCombatRoundEndReviewComplete,
  sortCombatRoundParticipantsByInitiative,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * #875 — the rendered proof: the GM tracker's top-to-bottom row order is the order the GM's
 * initiative commit recorded, and not encounter insertion order.
 *
 * Lane-scoped (`lane875-`), so the ordinary suite's `testIgnore` keeps it out of CI; it is run by
 * hand against a task stack with `playwright.lane875.config.ts`, which reuses the ordinary
 * account bootstrap because this spec builds its own fixture on an unseeded target:
 *
 *   pnpm build
 *   pnpm db:task:e2e --config playwright.lane875.config.ts
 *
 * Why it must be rendered: the unit and domain tests read the view-model's participant id list.
 * A component that re-sorted its own rows, or a sticky-header/row mismatch, would leave every one
 * of them passing. Across the Alpha wave every genuine UI defect was found by rendering.
 *
 * The discrimination: `beta` is created SECOND, so encounter insertion order is `[alpha, beta]`,
 * and `beta` then rolls the higher initiative so the committed order is `[beta, alpha]`. The two
 * orders are opposites, so a spec that read the wrong one cannot pass. The fixture is also built
 * **both ways round** — the same assertion is made with the initiative numbers swapped, so a
 * result that holds whichever participant is first is excluded.
 */

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) throw new Error(`${response.status()} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function post<T>(
  request: APIRequestContext,
  endpoint: string,
  data: unknown = {},
): Promise<T> {
  return json<T>(await request.post(`${API_URL}${endpoint}`, { data }));
}

/** An initiative result whose rolls are legal d6 values summing to `total`. */
function initiativeOf(total: number) {
  const rolls: number[] = [];
  let remaining = total;
  while (remaining > 6) {
    rolls.push(6);
    remaining -= 6;
  }
  rolls.push(remaining);
  return { baseInitiative: 0, modifierAdjustment: 0, rolls, rollTotal: total, total };
}

/**
 * The rendered row labels, top to bottom, read in **one** `page.evaluate` so no scroll or
 * re-render can straddle the reads, and read off the grid itself rather than off the view model.
 * `CombatTracker.tsx` puts each row's label in the first cell's `<strong>`.
 */
async function readRenderedRowLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const grid = document.querySelector('[aria-label="Combat round timeline grid"]');
    return Array.from(grid?.querySelectorAll("tbody tr") ?? []).map((row) =>
      (row.querySelector("td strong")?.textContent ?? "").trim(),
    );
  });
}

interface Side {
  characterId: string;
  combatantId: string;
  name: string;
  scenarioParticipantId: string;
}

test.describe("#875 the GM tracker renders the recorded initiative order", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  for (const [label, totals, discriminating] of [
    // alpha is always created first, so insertion order is always [alpha, beta].
    // "beta first" makes the committed order the opposite of insertion order — the discriminating
    // run. "alpha first" makes them coincide — the control, which a spec that merely reversed
    // insertion order would fail.
    ["beta first", { alpha: 4, beta: 9 }, true],
    ["alpha first", { alpha: 9, beta: 4 }, false],
  ] as const) {
    test(`renders the committed order and not insertion order — ${label}`, async ({
      browser,
      page,
    }) => {
      test.setTimeout(240_000);
      const suffix = `${Date.now()}-${label.replace(/\s+/g, "")}`;

      // One account may hold only one player-controlled Character per Scenario, and the
      // participant route coerces an absent `controlledByUserId` back to the caller — so the two
      // sides are held by two different player accounts, as the #771 tracker spec does it.
      const holders = await Promise.all(
        ["e2e/.auth/player.json", "e2e/.auth/non-holder.json"].map(async (storageState) => {
          const context = await browser.newContext({ storageState });
          const user = await json<{ user: { id: string } }>(
            await context.request.get(`${API_URL}/auth/me`),
          );
          return { context, userId: user.user.id };
        }),
      );

      // alpha is created first, so encounter insertion order is always [alpha, beta].
      const sides: Side[] = (["alpha", "beta"] as const).map((name) => ({
        characterId: `issue875-${name}-${suffix}`,
        combatantId: `issue875-combatant-${name}-${suffix}`,
        name: `Issue875 ${name} ${suffix}`,
        scenarioParticipantId: "",
      }));
      for (const [index, side] of sides.entries()) {
        const created = await holders[index]!.context.request.post(`${API_URL}/characters`, {
          data: characterPayload(side.characterId, side.name),
        });
        expect(created.ok(), await created.text()).toBe(true);
      }

      const campaignId = (
        await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
          name: `Issue 875 ${suffix}`,
          status: "active",
        })
      ).campaign.id;
      for (const side of sides) {
        await post(page.request, `/campaigns/${campaignId}/roster`, {
          category: "pc",
          sourceId: side.characterId,
          sourceType: "character",
        });
      }
      const scenarioId = (
        await post<{ scenario: { id: string } }>(
          page.request,
          `/campaigns/${campaignId}/scenarios`,
          { name: `Issue 875 Scenario ${suffix}`, status: "live" },
        )
      ).scenario.id;
      for (const [index, side] of sides.entries()) {
        side.scenarioParticipantId = (
          await post<{ participant: { id: string } }>(
            page.request,
            `/scenarios/${scenarioId}/participants/character`,
            { characterId: side.characterId, controlledByUserId: holders[index]!.userId },
          )
        ).participant.id;
      }

      const now = new Date().toISOString();
      const encounterId = `issue875-encounter-${suffix}`;
      await post(page.request, `/scenarios/${scenarioId}/encounters`, {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: encounterId,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: sides.map((side) => ({
            characterId: side.characterId,
            id: side.combatantId,
            label: side.name,
            participantType: "scenario",
            scenarioParticipantId: side.scenarioParticipantId,
          })),
          scenarioId,
          status: "active",
          title: `Issue 875 Combat ${suffix}`,
          updatedAt: now,
        },
      });
      const refreshed = await json<{ encounter: EncounterSession }>(
        await page.request.get(`${API_URL}/encounters/${encounterId}`),
      );
      const activated = await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
        data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
      });
      expect(activated.ok(), await activated.text()).toBe(true);
      const active = await json<{ encounter: EncounterSession }>(
        await page.request.get(`${API_URL}/encounters/${encounterId}`),
      );

      // The committed state, built with the domain's own commands and written through the real PUT.
      let state: CombatRoundState = sides.reduce(
        (current, side, index) =>
          rollCombatRoundCombatExperience({
            command: { createdAt: new Date(Date.now() + index).toISOString() },
            participantId: side.combatantId,
            rng: () => 0.6,
            skillTotal: 26,
            state: current,
          }).state,
        setCombatRoundCombatExperienceDifficulty({
          difficulty: 26,
          state: initializeCombatRoundState({ encounter: active.encounter }),
        }),
      );
      expect(state.currentStep).toBe("select_actions");
      sides.forEach((side, index) => {
        const opponent = sides[1 - index]!;
        const phaseContext = {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          targetParticipantId: opponent.combatantId,
        };
        state = recordCombatRoundDeclaration({
          command: {
            createdAt: new Date(Date.now() + 10 + index).toISOString(),
          },
          declaration: {
            actionId: "attack_parry",
            phaseContexts: { phase1: phaseContext, phase2: phaseContext },
            roundNumber: state.roundNumber,
          } as never,
          participantId: side.combatantId,
          state,
          submittedBy: "gm",
        });
      });
      for (let guard = 0; guard < 50 && state.currentStep !== "initiative_phase_1"; guard += 1) {
        state = advanceCombatRoundStep(state);
      }
      expect(state.currentStep).toBe("initiative_phase_1");
      sides.forEach((side, index) => {
        state = recordCombatRoundInitiative({
          command: { createdAt: new Date(Date.now() + 20 + index).toISOString() },
          initiative: initiativeOf(side.characterId.includes("alpha") ? totals.alpha : totals.beta),
          participantId: side.combatantId,
          phase: "phase1",
          state,
          submittedBy: "gm",
        });
      });
      state = commitCombatRoundPhaseInitiativeResolution({
        command: { createdAt: new Date(Date.now() + 30).toISOString() },
        phase: "phase1",
        state,
      }).state;

      const recordedOrder =
        state.committedInitiativeOrders.at(-1)?.entries.map((entry) => entry.participantId) ?? [];
      const insertionOrder = sides.map((side) => side.combatantId);
      const labelByCombatantId = new Map(sides.map((side) => [side.combatantId, side.name]));
      // The precondition that makes the rendered assertion readable: the committed order is
      // descending initiative, so it is the reverse of insertion order in the discriminating
      // variant and equal to it in the control variant.
      const expectedRecord = [...insertionOrder].sort((left, right) => {
        const totalOf = (participantId: string) =>
          participantId.includes("alpha") ? totals.alpha : totals.beta;
        return totalOf(right) - totalOf(left);
      });
      expect(recordedOrder, `the record for ${label}`).toEqual(expectedRecord);
      expect(
        recordedOrder.join() !== insertionOrder.join(),
        `${label} must be the discriminating variant only when it reverses insertion order`,
      ).toBe(discriminating);

      /** Writes `next` as the encounter's round state and returns the rendered row labels. */
      const renderRows = async (next: CombatRoundState, at: string): Promise<string[]> => {
        const current = await json<{ encounter: EncounterSession }>(
          await page.request.get(`${API_URL}/encounters/${encounterId}`),
        );
        const written = await page.request.put(`${API_URL}/encounters/${encounterId}`, {
          data: {
            expectedRevision: current.encounter.updatedAt,
            session: {
              ...current.encounter,
              combatRoundState: next,
              currentRound: next.roundNumber,
              status: "active",
            },
          },
        });
        expect(written.ok(), `${at}: ${await written.text()}`).toBe(true);
        await page.goto(
          `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`,
        );
        await expect(page.getByRole("heading", { name: "Combat Round Manager" })).toBeVisible();
        await expect
          .poll(async () => (await readRenderedRowLabels(page)).length, {
            message: `${at}: the tracker renders both participant rows`,
            timeout: 30_000,
          })
          .toBe(2);
        return readRenderedRowLabels(page);
      };

      const labelsOf = (participantIds: readonly string[]) =>
        participantIds.map((participantId) => labelByCombatantId.get(participantId));

      // ---- A: the round that was just committed ----
      // Here the pre-#875 derived order already agrees with the record, so this half is a control:
      // it shows the tracker follows the record where nothing distinguishes the two. On its own it
      // discriminates nothing, which is why B exists.
      const renderedCommitted = await renderRows(state, "A (committed round)");
      expect(renderedCommitted, `A rendered row order for ${label}`).toEqual(
        labelsOf(recordedOrder),
      );
      if (discriminating) {
        expect(renderedCommitted, `A rendered order is NOT insertion order (${label})`).not.toEqual(
          labelsOf(insertionOrder),
        );
      }

      // ---- B: the next round, before its own first initiative commit ----
      // This is the state #875 is about, and the half that actually discriminates. The round reset
      // clears every current initiative, so the order the old code derived here is encounter
      // insertion order while the record still holds the committed order — and unlike half A those
      // two differ, in the `beta first` variant. A tracker that recomputed the order renders
      // insertion order here, which is the reported defect. The `alpha first` variant is the
      // control: there the record coincides with insertion order, so the pair excludes a spec that
      // would pass by reversing insertion order instead of by reading the record.
      let nextRound = state;
      for (let guard = 0; guard < 160 && nextRound.roundNumber === state.roundNumber; guard += 1) {
        if (
          nextRound.currentStep === "round_summary" &&
          !isCombatRoundEndReviewComplete(nextRound)
        ) {
          nextRound = ensureCombatRoundEndReviewPrepared({
            command: { createdAt: new Date(Date.now() + 40).toISOString() },
            state: nextRound,
          });
          for (const side of sides) {
            if (
              nextRound.roundEndReview?.participantReviews[side.combatantId]?.status === "complete"
            ) {
              continue;
            }
            nextRound = commitCombatRoundEndParticipantReview({
              command: { createdAt: new Date(Date.now() + 41).toISOString() },
              participantId: side.combatantId,
              scenarioParticipantId: side.scenarioParticipantId,
              state: nextRound,
            }).state;
          }
          continue;
        }
        nextRound = advanceCombatRoundStep(nextRound);
      }
      expect(nextRound.roundNumber, "the fixture reached the next round").toBe(
        state.roundNumber + 1,
      );
      expect(
        nextRound.participants.every((entry) => entry.initiatives.phase1 === undefined),
        "the next round cleared every current initiative",
      ).toBe(true);
      const derivedInNextRound = sortCombatRoundParticipantsByInitiative({
        phase: "phase1",
        state: nextRound,
      }).map((entry) => entry.participantId);
      expect(
        derivedInNextRound,
        "with no current initiative the derived order is insertion order, so B discriminates",
      ).toEqual(insertionOrder);
      expect(
        nextRound.committedInitiativeOrders.at(-1)?.entries.map((entry) => entry.participantId),
        "the previous round's record survived the round boundary",
      ).toEqual(recordedOrder);

      const renderedNextRound = await renderRows(nextRound, "B (next round, before its commit)");
      expect(renderedNextRound, `B rendered row order for ${label}`).toEqual(
        labelsOf(recordedOrder),
      );
      if (discriminating) {
        expect(
          renderedNextRound,
          `B rendered order is NOT the order current state would produce (${label})`,
        ).not.toEqual(labelsOf(derivedInNextRound));
      } else {
        // Stated rather than asserted away: in the control variant these coincide by construction.
        expect(labelsOf(recordedOrder), `${label} is the control variant`).toEqual(
          labelsOf(derivedInNextRound),
        );
      }

      await Promise.all(holders.map((holder) => holder.context.close()));
    });
  }
});
