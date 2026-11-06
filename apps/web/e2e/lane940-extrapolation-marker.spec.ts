import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  advanceCombatRoundStep,
  buildCombatProgressionProjection,
  combatRoundStateSchema,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatProgressionBoundaryKind,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { createCharacterForE2e } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * **Rendered acceptance for #940 Tier A.** An extrapolated initiative figure is visibly identified
 * as extrapolated on the GM initiative context panel and on the player initiative context panel,
 * at both usable widths the contract names, with the in-grid boundary and the base-zero row as
 * negative controls in the same run.
 *
 * It is lane-scoped (`lane940-`), so the ordinary suite and CI ignore it through `testIgnore`; run
 * it by hand with `playwright.lane940.config.ts` against a freshly provisioned, migrated, unseeded
 * task target. Its cost is a stack and a browser per state, which is why it is not in the gate.
 *
 * ## Why the round is written exactly once
 *
 * The first version of this harness built a `CombatRoundState` by hand and wrote it through
 * `PUT /encounters/:id` **three times**, once per state under test. That route cannot write a
 * combat round state once the Encounter has left legacy storage, and the failure is silent.
 * `updateEncounterPreservingSplitCombat` in
 * `packages/database/src/repositories/combatStatePersistenceRepository.ts` writes only
 * `sessionWithoutCombatState` and bumps `EncounterActiveCombatState.revision`; the session it
 * returns is composed from the `stateJson` already in the row. Its name is the contract. So the
 * harness received `200 OK` three times and changed the round exactly once — on the first write,
 * while the Encounter was still in legacy storage — after which every later write was a no-op and
 * the figure on screen stayed at the first value.
 *
 * Two further fields in that hand-built state do not exist. `activeCombatRoundStateShape` in
 * `packages/domain/src/encounter/combatRoundManager.ts` has **no round-level `stepStatuses`** —
 * step status is per participant — and `combatRoundDeclarationSchema` has **no `committed`** field.
 * `combatRoundStateSchema` is not `.strict()`, so both were dropped by the parse without an error,
 * and the fixture's claim to be "a round parked on phase-1 initiative with a committed
 * declaration" described three fields that never reached the database.
 *
 * Measured on the stored row rather than inferred: after a run that asked for a raw modifier of
 * `-6` last, the persisted state held `currentStep: "review_phase_2_modifiers"`,
 * `currentCursor.step: "M2"`, a round-level `stepStatuses` of `null`, `declaration.committed`
 * absent, and `situationInitiative` still at the **first** state's `-15`.
 *
 * So each state under test gets its **own Encounter**, composed with the domain's own transition
 * functions and written with a single `PUT` while that Encounter is still in legacy storage — the
 * pattern `gm-superseded-figure-visibility.spec.ts` established. Every write is then verified
 * against what the server holds afterwards rather than against what was sent, and the Encounter is
 * closed before the next one so the player page cannot land on a stale round.
 *
 * ## Why the modifier axis and not the base axis
 *
 * The base of this figure is the character's passive initiative. The authored grid runs to base 49,
 * so reaching the `base` axis here would need a character whose initiative is 50 — and the Product
 * Owner's correction of 2026-11-06 is precisely that a constructed extreme is not evidence of play.
 * The modifier axis is driven here because an initiative modifier is ordinary GM input. The base
 * boundary at 49 against 50 stays pinned as arithmetic in `combatExtrapolationPresentation.test.ts`
 * rather than manufactured on screen.
 *
 * ## Why not `open`
 *
 * `open` is **not** a supported action at this baseline: `combatDeclarationCompatibility.ts:101`
 * declares it
 * `partial_internal_only` and `validateCombatDeclarationCompatibility` refuses it for canonical
 * execution with `repair_required`. A reading taken from that state is a reading of a state the
 * application itself considers broken, so it is not used here.
 *
 * ## How geometry is read
 *
 * Every reading is one `page.evaluate` with `window.scrollY` taken inside it. The Combat page
 * autoscrolls to the current task a beat after mount, so a read split across `await` boundaries
 * straddles that scroll and reports a position no one ever saw. All three measurements the rendered
 * gate requires are taken in that same evaluate: viewport containment, clipping measured against
 * the nearest clipping ancestor, and an `elementFromPoint` glyph probe, because a clip of 0 is
 * correct and still silent about text that is painted and then covered.
 */

const VIEWPORT_HEIGHT = 900;

/**
 * The usable widths for this surface. Both panels are prose lines inside a card that reflows, so
 * 1024 sits between these two with no layout change of its own and is omitted deliberately rather
 * than silently: 768 is the narrow reflow and 1440 the wide one. The usable width is recorded from
 * `window.innerWidth` inside the read rather than assumed equal to the viewport asked for.
 */
const WIDTHS = [768, 1440] as const;

const MARKER_WORD = "Extrapolated";
const MARKER_SENTENCE =
  "Resolved past the table, beyond the table's largest modifier. Review this figure.";

interface NodeRead {
  /** Pixels of the element's box cut off by the nearest clipping ancestor. */
  clippedByAncestorPx: number;
  /** Clipped by its own box — overflowing content the element itself hides. */
  clippedBySelf: boolean;
  clippingAncestor: string;
  found: boolean;
  /** `elementFromPoint` at the element's own centre resolves back into this element. */
  glyphHitAtCentre: boolean;
  glyphHitTag: string;
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
}

interface FigureRead {
  badge: NodeRead;
  baseLine: string;
  detail: NodeRead;
  effectiveLine: string;
  innerHeight: number;
  /** The usable width actually measured, not the viewport requested. */
  innerWidth: number;
  markerWordOnPage: boolean;
  modifierLine: string;
  panelFound: boolean;
  panelHeading: string;
  scrollY: number;
  sectionStrongs: string[];
}

/**
 * One atomic read of the initiative card: the three figure lines, the badge and its sentence, their
 * rectangles, all three clipping/occlusion measurements, and the scroll position they were measured
 * at — all inside a single evaluate, so every number describes the same instant.
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
        clippedByAncestorPx: 0,
        clippedBySelf: false,
        clippingAncestor: "",
        found: false,
        glyphHitAtCentre: false,
        glyphHitTag: "",
        insideViewportAtThisScroll: false,
        rect: { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 },
        text: "",
      };

      const describe = (node: Element | null) => {
        if (!node) return "";
        const testId = node.getAttribute("data-testid");
        const className = typeof node.className === "string" ? node.className.slice(0, 40) : "";
        return `${node.tagName}${testId ? `[${testId}]` : ""}${className ? `.${className}` : ""}`;
      };

      const measure = (node: HTMLElement | null) => {
        if (!node) {
          return emptyNode;
        }
        const rect = node.getBoundingClientRect();

        // Viewport-relative measurement cannot see a clip by an intermediate scroll container, so
        // the nearest ancestor that actually clips is found and the overlap measured against it.
        let clippingAncestor: Element | null = null;
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const style = window.getComputedStyle(parent);
          if (
            [style.overflow, style.overflowX, style.overflowY].some(
              (value) =>
                value === "hidden" || value === "clip" || value === "auto" || value === "scroll",
            )
          ) {
            clippingAncestor = parent;
            break;
          }
        }
        const clipBox = clippingAncestor
          ? clippingAncestor.getBoundingClientRect()
          : { bottom: window.innerHeight, left: 0, right: window.innerWidth, top: 0 };
        const clippedByAncestorPx = Math.round(
          Math.max(0, clipBox.left - rect.left) +
            Math.max(0, rect.right - clipBox.right) +
            Math.max(0, clipBox.top - rect.top) +
            Math.max(0, rect.bottom - clipBox.bottom),
        );

        // A clip of 0 is correct and still silent about text painted and then covered by an opaque
        // sibling, which only a hit test can see.
        const hit =
          rect.width > 0 && rect.height > 0
            ? document.elementFromPoint(
                Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2)),
                Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2)),
              )
            : null;

        return {
          clippedByAncestorPx,
          clippedBySelf:
            node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight,
          clippingAncestor: describe(clippingAncestor),
          found: true,
          glyphHitAtCentre: Boolean(
            hit && (hit === node || node.contains(hit) || hit.contains(node)),
          ),
          glyphHitTag: describe(hit),
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

      return {
        badge: measure(document.querySelector<HTMLElement>(`[data-testid="${badgeId}"]`)),
        baseLine: lineStartingWith("Base initiative"),
        detail: measure(document.querySelector<HTMLElement>(`[data-testid="${detailId}"]`)),
        effectiveLine: lineStartingWith("Effective before roll"),
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        markerWordOnPage: (document.body.innerText ?? "").includes(markerWord),
        modifierLine: lineStartingWith("Initiative modifiers"),
        panelFound: Boolean(panel),
        panelHeading: (panel?.firstElementChild?.textContent ?? "").trim(),
        scrollY,
        sectionStrongs: [...document.querySelectorAll("section > strong")].map((node) =>
          (node.textContent ?? "").trim(),
        ),
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

function phaseContext(input: { rawInitiativeModifier: number; targetParticipantId: string }) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative:
        input.rawInitiativeModifier === 0
          ? []
          : [
              {
                id: "e2e:initiative-situation",
                scope: "until" as const,
                value: input.rawInitiativeModifier,
              },
            ],
      situationObSkill: [],
    },
    targetParticipantId: input.targetParticipantId,
  };
}

interface ProjectedTask {
  executionGroupId: string;
  expectedCommand: string;
  id: string;
  kind: string;
  state: string;
  targetBoundary?: CombatProgressionBoundaryKind;
}

/**
 * The tasks the server's own projection currently offers, rebuilt from the state it holds. Every
 * combat command authorizes against that projection, so the identity has to come from here rather
 * than be constructed.
 */
function projectTasks(state: CombatRoundState): {
  boundaryKind: CombatProgressionBoundaryKind;
  diagnostics: unknown[];
  tasks: ProjectedTask[];
} {
  const projection = buildCombatProgressionProjection(state);
  return {
    boundaryKind: projection.boundary.kind,
    diagnostics: [...projection.diagnostics],
    tasks: projection.boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .map((task) => ({
        executionGroupId: task.executionGroupId,
        expectedCommand: task.expectedCommand,
        id: task.id,
        kind: task.kind,
        state: task.state,
        targetBoundary: task.transition?.targetBoundary,
      })),
  };
}

test.describe("#940 Tier A an extrapolated initiative figure is marked on screen", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("marks the figure past the table's largest modifier and leaves every in-grid figure clean", async ({
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

    const OWNER_CHARACTER = `extrapolation-owner-${suffix}`;
    const FOE_CHARACTER = `extrapolation-foe-${suffix}`;
    const OWNER_NAME = `Extrapolation Marker ${suffix}`;
    const FOE_NAME = `Opposing Combatant ${suffix}`;

    const otherContext = await browser.newContext({ storageState: "e2e/.auth/non-holder.json" });
    const otherUser = await json<{ user: { id: string } }>(
      await otherContext.request.get(`${API_URL}/auth/me`),
    );

    for (const [id, name] of [
      [OWNER_CHARACTER, OWNER_NAME],
      [FOE_CHARACTER, FOE_NAME],
    ] as const) {
      await createCharacterForE2e({ apiUrl: API_URL, id, name, request: gmPage.request });
    }

    const campaign = await json<{ campaign: { id: string } }>(
      await gmPage.request.post(`${API_URL}/campaigns`, {
        data: { name: `Issue 940 Marker ${suffix}`, status: "active" },
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
        data: { name: `Issue 940 Scenario ${suffix}`, status: "live" },
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
        data: { characterId: FOE_CHARACTER, controlledByUserId: otherUser.user.id },
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
     * Builds one Encounter parked at phase-1 initiative and returns its id.
     *
     * **Two combatants, both attacking, is a requirement rather than tidiness.** The GM panel runs
     * the application's own deterministic advance on mount, and a sole actor's phase-1 initiative
     * is deterministic: `combatParticipation/project.ts:540` reports the initiative fact as
     * `not_required` with reason `sole_actor_order_irrelevant` whenever
     * `required = hasAction && (competing || orderedManeuver)` is false, after which the
     * `commit_i1` boundary is a `deterministic_transition` and the page advances straight past the
     * card. Measured on a one-combatant round that passed: the walk read
     * `initiative_phase_1`/`i1`, and by the first page read the stored state was
     * `review_phase_2_modifiers`/`M2` with the initiative card gone. `hasAction` needs a valid
     * attack opportunity, so a `pass` declaration never makes initiative required at all — which
     * is why both combatants here declare an attack on each other.
     *
     * The round is composed with the domain's own transition functions and written with a **single**
     * `PUT`, which lands because the Encounter is still in legacy combat storage at that moment.
     * This is the pattern `gm-superseded-figure-visibility.spec.ts` established; a second `PUT`
     * would be the silent no-op described in this file's header.
     */
    const buildRoundAtPhaseOneInitiative = async (input: {
      label: string;
      rawInitiativeModifier: number;
    }): Promise<{ encounterId: string; evidence: Record<string, unknown> }> => {
      const encounterId = `issue-940-${input.label}-${suffix}`;
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
              title: `Issue 940 Combat ${input.label}`,
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

      let state = [OWNER, FOE].reduce(
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
      expect(state.currentStep, `${input.label}: the fixture reached Declaration`).toBe(
        "select_actions",
      );
      const roundNumber = state.roundNumber;
      for (const [participantId, targetParticipantId] of [
        [OWNER, FOE],
        [FOE, OWNER],
      ] as const) {
        const context = phaseContext({
          rawInitiativeModifier: input.rawInitiativeModifier,
          targetParticipantId,
        });
        state = recordCombatRoundDeclaration({
          declaration: {
            actionId: "double_attack",
            /**
             * `combatContext` as well as the per-phase contexts, because the figure under test is
             * read from the declaration's own `combatContext`: the GM panel seeds its inspector
             * draft from it and `buildEncounterInitiativeModifierCalculation` is given that draft.
             * Measured with `phaseContexts` alone, the Combat situation rows showed the modifier
             * and the Initiative card still read "Initiative modifiers +0".
             */
            combatContext: context,
            phaseContexts: { phase1: context, phase2: context },
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

      const atInitiative = combatRoundStateSchema.parse({
        ...state,
        currentCursor: { participantId: OWNER, roundNumber, step: "i1" },
        currentStep: "initiative_phase_1",
        selectedParticipantId: OWNER,
        selectedStep: "initiative_phase_1",
      });
      const put = await gmPage.request.put(`${API_URL}/encounters/${encounterId}`, {
        data: {
          expectedRevision: active.updatedAt,
          session: {
            ...active,
            combatRoundState: atInitiative,
            currentRound: roundNumber,
            status: "active",
          },
        },
      });
      expect(put.ok(), `${input.label}: the single state write — ${await put.text()}`).toBe(true);

      // The write is verified against what the server now holds, not against what was sent: the
      // route that silently preserved combat state is exactly the failure this fixture replaced.
      const stored = combatRoundStateSchema.parse(
        (await readEncounter(encounterId)).combatRoundState,
      );
      const projected = projectTasks(stored);
      const evidence = {
        boundaryKind: projected.boundaryKind,
        diagnostics: projected.diagnostics,
        executable: projected.tasks
          .filter((task) => task.state === "executable")
          .map((task) => `${task.kind}/${task.expectedCommand}`),
        storedCursorStep: stored.currentCursor?.step,
        storedCurrentStep: stored.currentStep,
        storedSituationInitiative: stored.participants.map((participant) => ({
          combatContext:
            participant.declaration?.combatContext?.modifierBuckets.situationInitiative,
          participantId: participant.participantId,
          phase1:
            participant.declaration?.phaseContexts?.phase1?.modifierBuckets.situationInitiative,
        })),
      };
      expect(stored.currentStep, `${input.label}: the server holds phase-1 initiative`).toBe(
        "initiative_phase_1",
      );
      expect(projected.boundaryKind, `${input.label}: the boundary is phase-1 initiative`).toBe(
        "phase1_initiative",
      );
      expect(
        evidence.executable,
        `${input.label}: an initiative roll is required, so the page cannot advance past the card`,
      ).toContain("roll_initiative/roll_initiative_phase1");

      return { encounterId, evidence };
    };
    /** Bounded wait for the card, with the page's own state recorded when it never appears. */
    const waitForInitiativeCard = async (page: Page, where: string) => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if ((await page.getByText("Base initiative", { exact: false }).count()) > 0) {
          return true;
        }
        await page.waitForTimeout(1000);
      }
      record[`DIAGNOSTIC ${where}`] = await page.evaluate(() => ({
        body: (document.body.innerText ?? "").slice(0, 2500),
        cardHeadings: [...document.querySelectorAll("section > strong")].map((n) => n.textContent),
      }));
      return false;
    };

    /**
     * Brings the Initiative card into view before it is measured. The GM Combat tab is a long page
     * and its own autoscroll goes to the tracker table, not to this card: measured at `scrollY 0`
     * with the badge at `top 1462.83` in a 900px viewport, so a reading taken without scrolling
     * says only that the page is long. The player page autoscrolls to the card already
     * (`scrollY 995` at 768), and scrolling it again is a no-op. The scroll is a separate step and
     * never inside the atomic read, which takes `window.scrollY` with the rectangles.
     */
    const scrollInitiativeCardIntoView = async (page: Page) => {
      await page.evaluate(() => {
        const panel = [...document.querySelectorAll("section")].find(
          (node) =>
            node.firstElementChild?.tagName === "STRONG" &&
            node.firstElementChild.textContent === "Initiative",
        );
        panel?.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
      });
      await page.waitForTimeout(750);
    };

    const captureBothSurfaces = async (input: { encounterId: string; stateKey: string }) => {
      const gmRoute = `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${input.encounterId}&tab=combat`;
      const reads: Record<string, FigureRead> = {};

      for (const width of WIDTHS) {
        await gmPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await gmPage.goto(gmRoute);
        await gmPage.waitForTimeout(3000);
        /**
         * The inspector draws this card only while its selection is the live current task, and a
         * freshly loaded panel can sit on the historical reading of the same step. The page's own
         * control is what a GM uses to get there, so the proof uses it too. A disabled control
         * already means the selection is current; clicking it would only hang.
         */
        const currentTask = gmPage.getByRole("button", { name: /^(Resume )?current task$/i });
        if ((await currentTask.count()) > 0 && (await currentTask.first().isEnabled())) {
          await currentTask.first().click();
          await gmPage.waitForTimeout(2500);
        }
        await waitForInitiativeCard(gmPage, `${input.stateKey} gm@${width}`);
        await scrollInitiativeCardIntoView(gmPage);
        reads[`gm@${width}`] = await readInitiativeFigure(
          gmPage,
          "gm-initiative-extrapolation-marker",
          "gm-initiative-extrapolation-detail",
        );

        await playerPage.setViewportSize({ height: VIEWPORT_HEIGHT, width });
        await playerPage.goto(playerRoute);
        await playerPage.waitForTimeout(3000);
        await waitForInitiativeCard(playerPage, `${input.stateKey} player@${width}`);
        await scrollInitiativeCardIntoView(playerPage);
        reads[`player@${width}`] = await readInitiativeFigure(
          playerPage,
          "player-initiative-extrapolation-marker",
          "player-initiative-extrapolation-detail",
        );
      }

      record[input.stateKey] = reads;
      // Printed per state, so a later timeout cannot take the measurement with it.
      console.log(`#940 STATE ${input.stateKey}\n${JSON.stringify(reads, null, 2)}`);
      return reads;
    };

    /**
     * Closes the Encounter, so the next state is read on a round of its own and the player page
     * cannot land on a stale one. The lifecycle has no `active -> completed` edge
     * (`session.ts:539`), so it goes through `paused`, which is the GM's own route.
     */
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
            playerOutcome: "Measured for the #940 rendered reading.",
            status: "completed",
          },
        }),
      );
    };

    const expectMarked = (read: FigureRead, where: string) => {
      expect.soft(read.panelFound, `${where}: the Initiative card rendered`).toBe(true);
      expect.soft(read.badge.found, `${where}: the badge is in the DOM`).toBe(true);
      expect.soft(read.badge.text, `${where}: the badge reads as a word`).toBe(MARKER_WORD);
      expect
        .soft(read.badge.clippedBySelf, `${where}: the badge is not clipped by its own box`)
        .toBe(false);
      expect
        .soft(read.badge.clippedByAncestorPx, `${where}: the badge is not clipped by an ancestor`)
        .toBe(0);
      expect
        .soft(
          read.badge.glyphHitAtCentre,
          `${where}: the badge's own glyphs are on top at its centre`,
        )
        .toBe(true);
      expect
        .soft(read.badge.insideViewportAtThisScroll, `${where}: the badge is on screen`)
        .toBe(true);
      expect.soft(read.badge.rect.width, `${where}: the badge has width`).toBeGreaterThan(10);
      expect.soft(read.badge.rect.height, `${where}: the badge has height`).toBeGreaterThan(8);
      expect.soft(read.detail.found, `${where}: the sentence is in the DOM`).toBe(true);
      expect
        .soft(read.detail.clippedBySelf, `${where}: the sentence is not clipped by its own box`)
        .toBe(false);
      expect
        .soft(
          read.detail.clippedByAncestorPx,
          `${where}: the sentence is not clipped by an ancestor`,
        )
        .toBe(0);
      expect
        .soft(
          read.detail.glyphHitAtCentre,
          `${where}: the sentence's glyphs are on top at its centre`,
        )
        .toBe(true);
      expect
        .soft(read.detail.insideViewportAtThisScroll, `${where}: the sentence is on screen`)
        .toBe(true);
      expect
        .soft(read.detail.text, `${where}: the sentence names the edge and asks for a review`)
        .toBe(MARKER_SENTENCE);
      // The marker sits beside and under the figure it qualifies rather than somewhere on the page.
      expect
        .soft(read.effectiveLine, `${where}: the badge sits on the figure's own line`)
        .toContain(MARKER_WORD);
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
    const inGridRound = await buildRoundAtPhaseOneInitiative({
      label: "in-grid",
      rawInitiativeModifier: -15,
    });
    record["FIXTURE in-grid"] = inGridRound.evidence;
    console.log(`#940 FIXTURE in-grid\n${JSON.stringify(inGridRound.evidence, null, 2)}`);
    const inGrid = await captureBothSurfaces({
      encounterId: inGridRound.encounterId,
      stateKey: "in-grid |raw| = 15",
    });
    for (const [where, read] of Object.entries(inGrid)) {
      expectUnmarked(read, `|raw| 15 ${where}`);
      expect
        .soft(read.modifierLine, `|raw| 15 ${where}: the raw modifier really is -15`)
        .toContain("-15");
    }
    await closeEncounter(inGridRound.encounterId);

    // ============ the marker: one step past the edge, |raw| = 16, marked on both ============
    const pastEdgeRound = await buildRoundAtPhaseOneInitiative({
      label: "past-edge",
      rawInitiativeModifier: -16,
    });
    record["FIXTURE past-edge"] = pastEdgeRound.evidence;
    console.log(`#940 FIXTURE past-edge\n${JSON.stringify(pastEdgeRound.evidence, null, 2)}`);
    const pastEdge = await captureBothSurfaces({
      encounterId: pastEdgeRound.encounterId,
      stateKey: "past the edge |raw| = 16",
    });
    for (const [where, read] of Object.entries(pastEdge)) {
      expectMarked(read, `|raw| 16 ${where}`);
      expect
        .soft(read.modifierLine, `|raw| 16 ${where}: the raw modifier really is -16`)
        .toContain("-16");
    }
    await closeEncounter(pastEdgeRound.encounterId);

    /**
     * The zero-row negative control. A base of zero with a non-zero raw modifier departs from the
     * authored cell — `Prosent!B5:P5` is authored as literal zeroes and the app moves the figure
     * one point per raw step — and it is deliberately **not** marked. The Product Owner ruled on
     * 2026-11-04, in comment 20880 on issue #922, that the override supersedes the authored row and
     * is an explicit rule decision, so it is a rule rather than an unreviewed extrapolation.
     */
    const zeroRowRound = await buildRoundAtPhaseOneInitiative({
      label: "zero-row",
      rawInitiativeModifier: -6,
    });
    record["FIXTURE zero-row"] = zeroRowRound.evidence;
    console.log(`#940 FIXTURE zero-row\n${JSON.stringify(zeroRowRound.evidence, null, 2)}`);
    const zeroRow = await captureBothSurfaces({
      encounterId: zeroRowRound.encounterId,
      stateKey: "zero row, base 0 with raw -6",
    });
    for (const [where, read] of Object.entries(zeroRow)) {
      expectUnmarked(read, `zero row ${where}`);
      expect
        .soft(read.baseLine, `zero row ${where}: the base really is zero`)
        .toBe("Base initiative 0");
      expect
        .soft(read.modifierLine, `zero row ${where}: the raw modifier really is non-zero`)
        .toContain("-6");
      // The figure moved away from the authored zero, which is what makes this a control and not a
      // vacuous pass: an unchanged figure would prove nothing about marking a departure.
      expect
        .soft(read.effectiveLine, `zero row ${where}: the figure departed from the authored zero`)
        .toContain("-6");
    }
    await closeEncounter(zeroRowRound.encounterId);

    await playerPage.close();
    await playerContext.close();
    console.log(`#940 Tier A rendered reading\n${JSON.stringify(record, null, 2)}`);
  });
});
