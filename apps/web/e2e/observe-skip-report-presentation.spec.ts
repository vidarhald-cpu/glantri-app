/**
 * #948 presentation acceptance for the GM Combat Round Manager's `Workflow status` section.
 *
 * The authorized visible change is the **conditional** skip lines — one summary line plus one line
 * per skipped participant. Everything else in that section is an invariant. This spec drives the
 * real GM action through the real stack and captures the section at three usable widths in three
 * states: no skips (the lines absent), one skip, and several skips, because the lines are a list
 * and a list is where composition moves.
 *
 * The underivable participant is a temporary entity actor whose snapshot carries no Stats, which is
 * the product situation #948 exists for: ruling 21026 requires the guard to key on the missing
 * Observation data rather than on the actor not being a Character, and a temporary actor's
 * `entityId` is null by design.
 *
 * It is deliberately **not** named `lane<digits>-…`: `playwright.config.ts` carries
 * `testIgnore: /lane\d+-.*\.spec\.ts/`, which matches the absolute path, so such a name silently
 * collects zero tests and reads as a pass.
 *
 * **Running it.** It is a capture instrument rather than a regression test, and CI runs this
 * Playwright suite, so it declares itself skipped unless `OBSERVE_SKIP_CAPTURES=1` is set. Produce
 * captures with, from the repository root and against this worktree's own disposable stack:
 *
 *     OBSERVE_SKIP_CAPTURES=1 \
 *     OBSERVE_SKIP_CAPTURE_DIR=<absolute directory> \
 *     OBSERVE_SKIP_CAPTURE_LABEL=after \
 *     pnpm db:task:e2e observe-skip-report-presentation
 *
 * `db:task:e2e` is what derives this worktree's own web/API ports and builds the bundle inside
 * that environment; a build outside it inlines `NEXT_PUBLIC_API_BASE_URL` for whatever stack holds
 * the default ports. Each case writes its PNGs and a geometry JSON, and also prints a `CAPTURE`
 * line to stdout, so a run whose output directory was wrong cannot read as a pass.
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import {
  combatRoundStateSchema,
  initializeCombatRoundState,
  prepareCombatRoundEndReview,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:4000";
const CAPTURES_ENABLED = process.env.OBSERVE_SKIP_CAPTURES === "1";
/**
 * No silent sink: an enabled run with no directory fails loudly instead of writing to a path
 * nobody reads, and the resolved directory is named in the printed `CAPTURE` line either way.
 */
const CAPTURE_DIR =
  process.env.OBSERVE_SKIP_CAPTURE_DIR ??
  (CAPTURES_ENABLED
    ? (() => {
        throw new Error(
          "OBSERVE_SKIP_CAPTURE_DIR is required: a capture run that writes nowhere measures nothing.",
        );
      })()
    : path.join(process.cwd(), "test-results", "observe-skip-captures"));
/** `after` on the repair head, `before` on the baseline. Stated, never inferred. */
const CAPTURE_LABEL = process.env.OBSERVE_SKIP_CAPTURE_LABEL ?? "after";
const WIDTHS = [768, 1024, 1440] as const;

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

type Member = { encounterId: string; label: string; scenarioParticipantId: string };

/**
 * Builds a live combat encounter sitting at round end with every participant review complete and
 * one Observe attempt due per observer, so the GM's `Roll remaining GM Observe checks` is the next
 * thing the batch does.
 */
async function buildObserveRoundEndEncounter(input: {
  derivableCount: number;
  request: APIRequestContext;
  /** How many Stats-less temporary actors to add; each makes its own contest underivable. */
  underivableCount: number;
  /** When true, a derivable observer also observes an underivable actor, adding a skip. */
  observeAnUnderivableActor: boolean;
  runKey: string;
}) {
  const suffix = `${Date.now()}-${input.runKey}`;
  const { request } = input;
  const campaign = await json<{ campaign: { id: string } }>(
    await request.post(`${API_URL}/campaigns`, {
      data: { name: `Observe skip ${suffix}`, status: "active" },
    }),
  );
  const scenario = await json<{ scenario: { id: string } }>(
    await request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
      data: { name: `Observe skip ${suffix}`, status: "live" },
    }),
  );

  /**
   * Every participant is a temporary entity actor, which is the actor kind ruling 21026 names
   * ("future supported Template and monster actors must not be rejected merely for not being
   * Characters"). The only difference between a derivable and an underivable one is whether its
   * snapshot carries a build: with one, Intelligence resolves and the contest rolls; without one,
   * there are no Stats at all, so there is no Intelligence and the basis genuinely cannot be
   * derived. Nothing is stubbed, mocked or hand-written into the round to arrange either side.
   *
   * Characters are not used because one player may hold only one active controlled Character per
   * scenario, so a batch of derivable Character observers is not constructible as a single GM.
   */
  const addEntity = async (input2: {
    derivable: boolean;
    index: number;
    label: string;
  }): Promise<Member> => {
    const snapshot: Record<string, unknown> = { displayName: input2.label };
    if (input2.derivable) {
      snapshot.build = characterPayload(
        `observe-skip-build-${input2.index}-${suffix}`,
        input2.label,
      ).build;
    }
    const created = await json<{ participant: { id: string } }>(
      await request.post(`${API_URL}/scenarios/${scenario.scenario.id}/participants/entity`, {
        data: {
          entityInput: { kind: "monster", name: input2.label, snapshot },
          isTemporary: true,
          role: "monster",
        },
      }),
    );
    // `POST …/participants/entity` defaults the controller to the calling GM, and the inspector
    // offers its bulk `Roll remaining GM Observe checks` workflow only for a participant **no**
    // user controls — correctly, because a player-controlled observer is never set aside by
    // automation. Clearing the controller through the ordinary metadata route is what makes these
    // GM-run NPCs rather than the GM's own characters.
    await json(
      await request.put(
        `${API_URL}/scenarios/${scenario.scenario.id}/participants/${created.participant.id}/metadata`,
        { data: { controlledByUserId: null } },
      ),
    );
    return {
      encounterId: `observe-skip-member-${input2.index}-${suffix}`,
      label: input2.label,
      scenarioParticipantId: created.participant.id,
    };
  };

  const members: Member[] = [];
  for (let index = 0; index < input.derivableCount; index += 1) {
    members.push(await addEntity({ derivable: true, index, label: `NPC ${index + 1}` }));
  }

  const underivable: Member[] = [];
  for (let index = 0; index < input.underivableCount; index += 1) {
    const member = await addEntity({
      derivable: false,
      index: input.derivableCount + index,
      label: `Monster ${index + 1}`,
    });
    members.push(member);
    underivable.push(member);
  }

  const now = new Date().toISOString();
  const encounterId = `observe-skip-encounter-${suffix}`;
  await json<{ encounter: EncounterSession }>(
    await request.post(`${API_URL}/scenarios/${scenario.scenario.id}/encounters`, {
      data: {
        session: {
          campaignId: campaign.campaign.id,
          createdAt: now,
          currentRound: 3,
          id: encounterId,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: members.map((member, order) => ({
            id: member.encounterId,
            label: member.label,
            order,
            participantType: "scenario",
            scenarioParticipantId: member.scenarioParticipantId,
          })),
          scenarioId: scenario.scenario.id,
          status: "active",
          title: `Observe skip ${suffix}`,
          updatedAt: now,
        },
      },
    }),
  );
  const refreshed = await json<{ encounter: EncounterSession }>(
    await request.get(`${API_URL}/encounters/${encounterId}`),
  );
  const activated = await json<{ encounter: EncounterSession }>(
    await request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: refreshed.encounter.updatedAt, status: "active" },
    }),
  );

  const initial = initializeCombatRoundState({ encounter: activated.encounter });
  const underivableIds = new Set(underivable.map((member) => member.encounterId));
  /**
   * Who each participant observes. A derivable observer normally watches another derivable one, so
   * its contest resolves; `observeAnUnderivableActor` points the first one at a Stats-less actor
   * instead, which makes that observer's own contest underivable too — the reason several skips can
   * exceed the number of underivable participants.
   */
  const targetFor = (index: number): Member | undefined => {
    const self = initial.participants[index]!;
    if (input.observeAnUnderivableActor && index === 0 && underivable[0]) return underivable[0];
    const candidate = members.find(
      (member) =>
        member.encounterId !== self.participantId &&
        (underivableIds.has(self.participantId) || !underivableIds.has(member.encounterId)),
    );
    return candidate;
  };

  const withDeclarations = combatRoundStateSchema.parse({
    ...initial,
    currentCursor: {
      participantId: initial.participants[0]?.participantId,
      roundNumber: 3,
      step: "SU",
    },
    currentStep: "round_summary",
    observationRelationships: initial.participants.flatMap((participant, index) => {
      const target = targetFor(index);
      if (!target) return [];
      return [
        {
          bestBonus: 0,
          completedAttempts: 0,
          id: `observation:${participant.participantId}:${target.encounterId}`,
          observerParticipantId: participant.participantId,
          // At the threshold, so the attempt is due this round rather than merely progressing.
          roundsTowardNextAttempt: 2,
          targetParticipantId: target.encounterId,
        },
      ];
    }),
    participants: initial.participants.map((participant, index) => {
      const target = targetFor(index);
      return {
        ...participant,
        declaration: {
          actionId: "parry",
          id: `declaration:${participant.participantId}`,
          roundNumber: 3,
          submittedAt: now,
          submittedBy: "gm",
          ...(target
            ? {
                secondaryActionContext: {
                  action: "observe_opponent",
                  targetParticipantId: target.encounterId,
                },
                secondaryActionId: "observe_opponent",
                secondaryActions: [
                  { action: "observe_opponent", targetParticipantId: target.encounterId },
                ],
              }
            : {}),
        },
      };
    }),
    roundNumber: 3,
    selectedParticipantId: initial.participants[0]?.participantId,
    selectedStep: "round_summary",
  });
  const prepared = prepareCombatRoundEndReview({ participantInputs: {}, state: withDeclarations });
  // Every participant review complete, so the only round-end work left is the Observe contests.
  const roundState = combatRoundStateSchema.parse({
    ...prepared,
    roundEndReview: {
      ...prepared.roundEndReview!,
      participantReviews: Object.fromEntries(
        initial.participants.map((participant) => [
          participant.participantId,
          { participantId: participant.participantId, status: "complete" },
        ]),
      ),
    },
  });
  await json(
    await request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: activated.encounter.updatedAt,
        session: { ...activated.encounter, combatRoundState: roundState, currentRound: 3 },
      },
    }),
  );

  return {
    campaignId: campaign.campaign.id,
    encounterId,
    members,
    scenarioId: scenario.scenario.id,
    workspaceUrl: `/campaigns/${campaign.campaign.id}?tab=combat&scenarioId=${scenario.scenario.id}&encounterId=${encounterId}`,
  };
}

function captureName(state: string, width: number) {
  return `${CAPTURE_LABEL}-${state}-w${width}.png`;
}

test.describe("#948 Workflow status skip lines — presentation acceptance", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });
  // A capture instrument, not a regression test: it is reported as skipped rather than passed in
  // an ordinary suite run, so a run that produced no captures cannot be read as one that did.
  test.skip(
    !CAPTURES_ENABLED,
    "Set OBSERVE_SKIP_CAPTURES=1 with OBSERVE_SKIP_CAPTURE_DIR to produce the #948 captures.",
  );

  for (const scenarioCase of [
    { derivableCount: 4, key: "no-skips", observeAnUnderivableActor: false, underivableCount: 0 },
    { derivableCount: 4, key: "one-skip", observeAnUnderivableActor: false, underivableCount: 1 },
    {
      derivableCount: 4,
      key: "several-skips",
      observeAnUnderivableActor: true,
      underivableCount: 2,
    },
  ]) {
    test(`captures the Workflow status section with ${scenarioCase.key}`, async ({ page }) => {
      test.setTimeout(240_000);
      fs.mkdirSync(CAPTURE_DIR, { recursive: true });

      const fixture = await buildObserveRoundEndEncounter({
        derivableCount: scenarioCase.derivableCount,
        observeAnUnderivableActor: scenarioCase.observeAnUnderivableActor,
        request: page.request,
        runKey: scenarioCase.key,
        underivableCount: scenarioCase.underivableCount,
      });

      await page.goto(fixture.workspaceUrl);
      // The inspector opens on the selected participant's declaration surface, so the current
      // round-end task — and with it the bulk-workflow selector — appears only after snapping the
      // inspector to it. "Clear current step" sits beside this control and is deliberately never
      // used: it recovers a stuck round by backtracking a completed Observe roll.
      await page.getByRole("button", { name: "Current task" }).first().click();
      // The inspector's bulk-workflow selector; its accessible name is the label's own "Workflow".
      const outcome = page.getByRole("combobox", { name: "Workflow" });
      await expect(outcome).toBeVisible({ timeout: 60_000 });
      await outcome.selectOption("complete_remaining");
      await page.getByRole("button", { name: "Roll remaining GM Observe checks" }).click();

      const workflow = page.getByLabel("Workflow status");
      await expect(workflow).toBeVisible({ timeout: 60_000 });
      await expect(workflow).toContainText("Workflow");

      const skipLines = await workflow
        .locator("span")
        .filter({ hasText: /^Skipped / })
        .allTextContents();
      const measured: Array<Record<string, unknown>> = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ height: 1200, width });
        await workflow.scrollIntoViewIfNeeded();
        // One `page.evaluate`: the Combat page autoscrolls, so reads split across awaits straddle
        // the scroll and report geometry from two different scroll positions.
        const geometry = await page.evaluate(() => {
          const section = document.querySelector('[aria-label="Workflow status"]');
          if (!section) return undefined;
          const rect = section.getBoundingClientRect();
          const rows = Array.from(section.querySelectorAll(":scope > span, :scope > strong")).map(
            (row) => {
              const rowRect = row.getBoundingClientRect();
              return {
                height: Math.round(rowRect.height),
                text: (row.textContent ?? "").trim(),
                width: Math.round(rowRect.width),
              };
            },
          );
          return {
            documentScrollWidth: document.documentElement.scrollWidth,
            rows,
            sectionHeight: Math.round(rect.height),
            sectionWidth: Math.round(rect.width),
            usableWidth: document.documentElement.clientWidth,
          };
        });
        expect(geometry, "the Workflow status section did not render").toBeDefined();
        await workflow.screenshot({
          path: path.join(CAPTURE_DIR, captureName(scenarioCase.key, width)),
        });
        measured.push({ requestedWidth: width, ...geometry });
      }

      fs.writeFileSync(
        path.join(CAPTURE_DIR, `${CAPTURE_LABEL}-${scenarioCase.key}-geometry.json`),
        JSON.stringify({ label: CAPTURE_LABEL, measured, skipLines }, undefined, 2),
      );
      // Printed as well as written, so a run whose output directory was wrong cannot read as a pass.
      console.log(
        `CAPTURE ${CAPTURE_LABEL} ${scenarioCase.key} skipLines=${skipLines.length} ${JSON.stringify(measured)}`,
      );
    });
  }
});
