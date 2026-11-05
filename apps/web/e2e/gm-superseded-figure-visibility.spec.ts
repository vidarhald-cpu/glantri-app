import fs from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  advanceCombatRoundStep,
  applyCombatActionGeneratedModifiers,
  buildCombatProgressionProjection,
  buildCombatRoundAttackRollResult,
  buildCombatRoundDeclaredAttackOpportunities,
  combatRoundStateSchema,
  commitCombatRoundPhaseInitiativeResolution,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  resolveCombatAttackPhaseDefensivePenalties,
  restateCanonicalModifierBucketRowValue,
  rollCombatRoundCombatExperience,
  scenarioParticipantCombatContextSchema,
  setCombatRoundCombatExperienceDifficulty,
  SUPERSEDED_GM_FIGURE_NOTE_MARKER,
  type CombatRoundState,
  type EncounterSession,
} from "@glantri/domain";

import { characterPayload } from "./character-fixture";
import { API_URL } from "./targets";

/**
 * Forgejo #931 — the two proofs the Product Owner's ruling on comment 21255 requires.
 *
 * The first attempt at making the supersession visible put a suffix in the row's `notes`, which
 * the Details cell renders as the value of a single-line `<input type="text">`. A rendered reading
 * measured that suffix clipped before the mark at 768, 1024 and 1440 CSS px — the GM never saw it.
 * The ruling moved the signal to the re-offered `modifier_review` task label and took the
 * supersession off the player side entirely: it is GM workflow, not table-visible game state.
 *
 * So this spec proves two things against a real browser and a real stack:
 *
 * 1. **The label.** At each usable width the GM's Current action card leads with the Product
 *    Owner's sentence, the label is not clipped, it sits inside the first viewport, and the
 *    Details cell carries nothing about the supersession. All geometry is read inside one
 *    `page.evaluate` per state and width together with `window.scrollY`: this page autoscrolls and
 *    a read split across an `await` straddles the scroll.
 * 2. **The player side.** Three real player reads — the controlling player, another player in the
 *    same Encounter, and a player with no access to the Scenario — classified by response key
 *    rather than by route, because a route-level sweep has reported "zero unclassified" here while
 *    a sibling key on the same response leaked.
 *
 * It measures and asserts. It repairs nothing.
 */

const WIDTHS = [768, 1024, 1440] as const;
const VIEWPORT_HEIGHT = 1000;
const DETAILS_SELECTOR = 'input[aria-label$="modifier details"]';
/** The Product Owner's wording, recorded verbatim in #931 comment 21255. */
const SUPERSEDED_SENTENCE = "Rule changed the committed DB/Parry value — review again.";
const READY_SENTENCE = "Phase 2 modifiers are ready for review.";
/** What a player read must not contain, in any key or value, at any depth. */
const FORBIDDEN_SUBSTRINGS = [
  "supersededGmFigure",
  "superseded",
  SUPERSEDED_GM_FIGURE_NOTE_MARKER.trim(),
  "review again",
] as const;

interface LabelRead {
  cardFound: boolean;
  clientHeight: number;
  clientWidth: number;
  clipped: boolean;
  computed: { overflow: string; textOverflow: string; whiteSpace: string };
  /** Page-coordinate top, so "where it sits relative to the fold" does not depend on the scroll. */
  documentTop: number;
  /** The card's own heading, so a structural drift is visible rather than silent. */
  heading: string;
  innerHeight: number;
  innerWidth: number;
  /** Inside the first viewport of the page, before the reader scrolls anything. */
  insideFirstViewport: boolean;
  /** Inside the viewport at the scroll position this read was taken at. */
  insideViewportAtThisScroll: boolean;
  rect: { bottom: number; height: number; left: number; top: number; width: number };
  scrollHeight: number;
  scrollWidth: number;
  scrollY: number;
  startsWithSupersededSentence: boolean;
  text: string;
}

interface DetailsRead {
  ariaLabel: string | null;
  carriesForbiddenText: string[];
  clientWidth: number;
  disabled: boolean;
  overflows: boolean;
  scrollLeft: number;
  scrollWidth: number;
  title: string | null;
  value: string;
}

/**
 * The control that takes a GM to the task the round is waiting on. It is what answers "below the
 * fold with nothing to draw the eye": if it sits in the first viewport, there is something.
 */
interface TaskControlRead {
  documentTop: number;
  found: boolean;
  insideFirstViewport: boolean;
  rect: { bottom: number; height: number; left: number; top: number; width: number };
  text: string;
}

/**
 * The control that completes the task, read from inside the same card as the label. Co-location is
 * the property that does not depend on where the page happens to be scrolled: a GM cannot complete
 * the review without being at the card the sentence is in.
 */
interface PrimaryActionRead {
  foundInSameCard: boolean;
  rect: { bottom: number; height: number; left: number; top: number; width: number };
  text: string;
}

interface SurfaceRead {
  currentTaskControl: TaskControlRead;
  details: DetailsRead[];
  label: LabelRead;
  /** Every forbidden substring present anywhere in the rendered page text. */
  pageTextHits: string[];
  primaryAction: PrimaryActionRead;
}

/**
 * One atomic read: the label geometry, the Details inputs and the page text, in a single turn with
 * no `await` inside, so every rect and `window.scrollY` describe the same instant.
 */
async function readSurface(
  page: Page,
  forbidden: readonly string[],
  supersededSentence: string,
): Promise<SurfaceRead> {
  return page.evaluate(
    ({ forbiddenTexts, sentence }) => {
      const card = [...document.querySelectorAll("section")].find(
        (node) =>
          node.firstElementChild?.tagName === "STRONG" &&
          node.firstElementChild.textContent === "Current action",
      );
      const grid = card?.children[1];
      const headingNode = grid?.children[0];
      const summaryNode = grid?.children[1] as HTMLElement | undefined;
      const scrollY = Math.round(window.scrollY);
      const emptyLabel = {
        cardFound: false,
        clientHeight: 0,
        clientWidth: 0,
        clipped: false,
        computed: { overflow: "", textOverflow: "", whiteSpace: "" },
        documentTop: 0,
        heading: "",
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        insideFirstViewport: false,
        insideViewportAtThisScroll: false,
        rect: { bottom: 0, height: 0, left: 0, top: 0, width: 0 },
        scrollHeight: 0,
        scrollWidth: 0,
        scrollY,
        startsWithSupersededSentence: false,
        text: "",
      };
      let label = emptyLabel;
      if (summaryNode) {
        const style = window.getComputedStyle(summaryNode);
        const rect = summaryNode.getBoundingClientRect();
        const text = (summaryNode.textContent ?? "").replace(/\s+/g, " ").trim();
        label = {
          cardFound: true,
          clientHeight: summaryNode.clientHeight,
          clientWidth: summaryNode.clientWidth,
          clipped:
            summaryNode.scrollWidth > summaryNode.clientWidth ||
            summaryNode.scrollHeight > summaryNode.clientHeight,
          computed: {
            overflow: style.overflow,
            textOverflow: style.textOverflow,
            whiteSpace: style.whiteSpace,
          },
          documentTop: Math.round(rect.top + window.scrollY),
          heading: (headingNode?.textContent ?? "").trim(),
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth,
          insideFirstViewport:
            rect.top + window.scrollY >= 0 && rect.bottom + window.scrollY <= window.innerHeight,
          insideViewportAtThisScroll: rect.top >= 0 && rect.bottom <= window.innerHeight,
          rect: {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          },
          scrollHeight: summaryNode.scrollHeight,
          scrollWidth: summaryNode.scrollWidth,
          scrollY,
          startsWithSupersededSentence: text.startsWith(sentence),
          text,
        };
      }

      const controlNode = [...document.querySelectorAll("button")].find((node) =>
        /^(resume )?current task$/i.test((node.textContent ?? "").trim()),
      );
      const controlRect = controlNode?.getBoundingClientRect();
      const currentTaskControl = {
        documentTop: controlRect ? Math.round(controlRect.top + window.scrollY) : -1,
        found: Boolean(controlNode),
        insideFirstViewport: controlRect
          ? controlRect.top + window.scrollY >= 0 &&
            controlRect.bottom + window.scrollY <= window.innerHeight
          : false,
        rect: controlRect
          ? {
              bottom: controlRect.bottom,
              height: controlRect.height,
              left: controlRect.left,
              top: controlRect.top,
              width: controlRect.width,
            }
          : { bottom: 0, height: 0, left: 0, top: 0, width: 0 },
        text: (controlNode?.textContent ?? "").trim(),
      };

      // The button that completes the task, taken from inside the label's own card.
      const actionNode = card ? card.querySelector("button") : null;
      const actionRect = actionNode?.getBoundingClientRect();
      const primaryAction = {
        foundInSameCard: Boolean(actionNode),
        rect: actionRect
          ? {
              bottom: actionRect.bottom,
              height: actionRect.height,
              left: actionRect.left,
              top: actionRect.top,
              width: actionRect.width,
            }
          : { bottom: 0, height: 0, left: 0, top: 0, width: 0 },
        text: (actionNode?.textContent ?? "").replace(/\s+/g, " ").trim(),
      };

      const details = (
        [
          ...document.querySelectorAll('input[aria-label$="modifier details"]'),
        ] as HTMLInputElement[]
      ).map((element) => ({
        ariaLabel: element.getAttribute("aria-label"),
        carriesForbiddenText: forbiddenTexts.filter((needle) =>
          element.value.toLowerCase().includes(needle.toLowerCase()),
        ),
        clientWidth: element.clientWidth,
        disabled: element.disabled,
        overflows: element.scrollWidth > element.clientWidth,
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        title: element.getAttribute("title"),
        value: element.value,
      }));

      const pageText = (document.body.textContent ?? "").toLowerCase();
      const pageTextHits = forbiddenTexts.filter((needle) =>
        pageText.includes(needle.toLowerCase()),
      );

      return { currentTaskControl, details, label, pageTextHits, primaryAction };
    },
    { forbiddenTexts: [...forbidden], sentence: supersededSentence },
  );
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

const ATTACK_PHASE_ROW_PREFIX = "generated:attack-phase-penalty:";

function phase2AttackPhaseRows(context: unknown) {
  return scenarioParticipantCombatContextSchema
    .parse(context)
    .modifierBuckets.situationDb.filter(
      (entry) => entry.id.startsWith(ATTACK_PHASE_ROW_PREFIX) && entry.sourcePhase === "phase2",
    );
}

function modifierReviewOwners(state: CombatRoundState): string[] {
  return buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .filter((task) => task.kind === "modifier_review")
    .map((task) => (task.owner?.kind === "combatant" ? task.owner.participantId : ""))
    .filter((id) => id.length > 0);
}

/**
 * The task identity every combat write requires. The route authorizes the command against the
 * projection it builds itself, so the identity comes from the state the server currently holds.
 */
function taskCommandIdentity(input: {
  expectedCommand: string;
  participantId: string;
  state: CombatRoundState;
}): { executionGroupId: string; opportunityId?: string; taskId: string } {
  const allTasks = buildCombatProgressionProjection(input.state)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks);
  const tasks = allTasks.filter((task) => task.expectedCommand === input.expectedCommand);
  const selected =
    tasks.find(
      (task) =>
        (task.owner?.kind === "combatant" && task.owner.participantId === input.participantId) ||
        task.identity.participantId === input.participantId,
    ) ?? tasks[0];
  if (!selected) {
    throw new Error(
      `No ${input.expectedCommand} task is offered for ${input.participantId}; offered: ${JSON.stringify(
        allTasks.map((task) => task.expectedCommand),
      )}`,
    );
  }
  return {
    executionGroupId: selected.executionGroupId,
    opportunityId: selected.identity.opportunityId,
    taskId: selected.id,
  };
}

/**
 * Walks a response body and returns the key paths whose key name or string value carries forbidden
 * text, with the number of leaves walked. The leaf count is what separates "nothing leaked" from
 * "nothing was there": an empty hit list over zero leaves proves nothing.
 */
function classifyResponseKeys(
  node: unknown,
  forbidden: readonly string[],
  path = "$",
): { hits: string[]; leaves: number } {
  if (Array.isArray(node)) {
    return node.reduce<{ hits: string[]; leaves: number }>(
      (total, entry, index) => {
        const child = classifyResponseKeys(entry, forbidden, `${path}[${index}]`);
        return { hits: [...total.hits, ...child.hits], leaves: total.leaves + child.leaves };
      },
      { hits: [], leaves: 0 },
    );
  }
  if (node !== null && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).reduce<{
      hits: string[];
      leaves: number;
    }>(
      (total, [key, value]) => {
        const keyPath = `${path}.${key}`;
        const keyHit = forbidden.some((needle) => key.toLowerCase().includes(needle.toLowerCase()));
        const child = classifyResponseKeys(value, forbidden, keyPath);
        return {
          hits: [...total.hits, ...(keyHit ? [`${keyPath} <key>`] : []), ...child.hits],
          leaves: total.leaves + child.leaves,
        };
      },
      { hits: [], leaves: 0 },
    );
  }
  const isHit =
    typeof node === "string" &&
    forbidden.some((needle) => node.toLowerCase().includes(needle.toLowerCase()));
  return { hits: isHit ? [`${path} = ${JSON.stringify(node)}`] : [], leaves: 1 };
}

test.describe("the #931 supersession signal: the task label, and nothing on the player side", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("labels the re-offered review for the GM and leaks nothing to any player", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(480_000);

    // --- the probe's own output path: unset or unwritable is a failure, never a green no-op ---
    const artefactDir = process.env.GM_SUPERSESSION_ARTEFACT_DIR ?? testInfo.outputPath("");
    expect(
      typeof artefactDir === "string" && artefactDir.trim().length > 0,
      "the probe refuses to run without an output directory",
    ).toBe(true);
    fs.mkdirSync(artefactDir, { recursive: true });
    const artefacts: string[] = [];
    const artefact = (name: string) => {
      const resolved = path.resolve(artefactDir, name);
      artefacts.push(resolved);
      return resolved;
    };
    const shoot = async (name: string) => {
      const file = artefact(`${name}.png`);
      await page.screenshot({ fullPage: true, path: file });
      console.log(`#931 artefact ${file}`);
      return file;
    };

    const measurements: Record<string, unknown> = {};
    const measurementsPath = artefact("superseded-label-measurements.json");
    // Written on every record, so a failure part-way through still leaves the measurements that
    // were taken. An earlier build wrote them only at the end and a mid-run failure left nothing.
    const record = (key: string, value: unknown) => {
      measurements[key] = value;
      console.log(`#931 measured ${key}: ${JSON.stringify(value)}`);
      fs.writeFileSync(measurementsPath, `${JSON.stringify(measurements, null, 2)}\n`);
    };

    // =================== fixture: a real encounter at the open phase-2 review ===================
    // The Double Attack owner is the smoke player's Character and the opponent is the non-holder's,
    // so the player-read proof has a controlling player, a second player in the same Encounter and
    // an unrelated player. The GM drives both production routes.
    const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const otherContext = await browser.newContext({ storageState: "e2e/.auth/non-holder.json" });
    const unrelatedContext = await browser.newContext({
      storageState: "e2e/.auth/unrelated.json",
    });
    const playerUser = await json<{ user: { id: string } }>(
      await playerContext.request.get(`${API_URL}/auth/me`),
    );
    const otherUser = await json<{ user: { id: string } }>(
      await otherContext.request.get(`${API_URL}/auth/me`),
    );

    const suffix = Date.now();
    const ownerCharacterId = `s931-owner-${suffix}`;
    const foeCharacterId = `s931-foe-${suffix}`;
    const ownerName = `Double Attacker ${suffix}`;
    const foeName = `Opposing Guard ${suffix}`;

    for (const [id, name] of [
      [ownerCharacterId, ownerName],
      [foeCharacterId, foeName],
    ] as const) {
      const created = await page.request.post(`${API_URL}/characters`, {
        data: characterPayload(id, name),
      });
      expect(created.ok(), await created.text()).toBe(true);
    }

    const campaign = await post<{ campaign: { id: string } }>(page.request, "/campaigns", {
      name: `Issue 931 Supersession ${suffix}`,
      status: "active",
    });
    const campaignId = campaign.campaign.id;
    for (const characterId of [ownerCharacterId, foeCharacterId]) {
      await post(page.request, `/campaigns/${campaignId}/roster`, {
        category: "pc",
        sourceId: characterId,
        sourceType: "character",
      });
    }
    const scenario = await post<{ scenario: { id: string } }>(
      page.request,
      `/campaigns/${campaignId}/scenarios`,
      { name: `Issue 931 Scenario ${suffix}`, status: "live" },
    );
    const scenarioId = scenario.scenario.id;
    const ownerParticipant = await post<{ participant: { id: string } }>(
      page.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId: ownerCharacterId, controlledByUserId: playerUser.user.id },
    );
    const foeParticipant = await post<{ participant: { id: string } }>(
      page.request,
      `/scenarios/${scenarioId}/participants/character`,
      { characterId: foeCharacterId, controlledByUserId: otherUser.user.id },
    );

    const now = new Date().toISOString();
    const OWNER = `s931-owner-combatant-${suffix}`;
    const FOE = `s931-foe-combatant-${suffix}`;
    const created = await post<{ encounter: EncounterSession }>(
      page.request,
      `/scenarios/${scenarioId}/encounters`,
      {
        session: {
          campaignId,
          createdAt: now,
          currentRound: 1,
          id: `s931-encounter-${suffix}`,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: [
            {
              characterId: ownerCharacterId,
              id: OWNER,
              label: ownerName,
              participantType: "scenario",
              scenarioParticipantId: ownerParticipant.participant.id,
            },
            {
              characterId: foeCharacterId,
              id: FOE,
              label: foeName,
              participantType: "scenario",
              scenarioParticipantId: foeParticipant.participant.id,
            },
          ],
          scenarioId,
          status: "active",
          title: `Issue 931 Combat ${suffix}`,
          updatedAt: now,
        },
      },
    );
    const encounterId = created.encounter.id;
    const fetched = await json<{ encounter: EncounterSession }>(
      await page.request.get(`${API_URL}/encounters/${encounterId}`),
    );
    const activated = await page.request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: fetched.encounter.updatedAt, status: "active" },
    });
    expect(activated.ok(), await activated.text()).toBe(true);
    const active = await json<{ encounter: EncounterSession }>(
      await page.request.get(`${API_URL}/encounters/${encounterId}`),
    );

    const visibility = { [OWNER]: { [FOE]: true }, [FOE]: { [OWNER]: true } };
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
        state: initializeCombatRoundState({ encounter: active.encounter }),
      }),
    );
    expect(state.currentStep, "the fixture reached the declaration step").toBe("select_actions");
    const roundNumber = state.roundNumber;
    for (const [participantId, targetId] of [
      [OWNER, FOE],
      [FOE, OWNER],
    ] as const) {
      state = recordCombatRoundDeclaration({
        declaration: {
          actionId: "double_attack",
          phaseContexts: { phase1: phaseContext(targetId), phase2: phaseContext(targetId) },
          roundNumber,
        },
        participantId,
        state,
        submittedBy: "gm",
      });
    }
    state = advanceCombatRoundStep(advanceCombatRoundStep(state));
    for (const participantId of [OWNER, FOE]) {
      state = recordCombatRoundInitiative({
        command: { createdAt: new Date().toISOString(), createdByUserId: "gm" },
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [5],
          rollTotal: 5,
          total: 5,
        },
        participantId,
        phase: "phase1",
        state,
        submittedBy: "gm",
        visibility,
      });
    }
    state = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: new Date().toISOString(), createdByUserId: "gm" },
      phase: "phase1",
      state,
      visibility,
    }).state;

    const ownerDeclaration = state.participants.find(
      (participant) => participant.participantId === OWNER,
    )!.declaration!;
    const opportunities = buildCombatRoundDeclaredAttackOpportunities({
      actionId: "double_attack",
      participantId: OWNER,
      phaseContexts: ownerDeclaration.phaseContexts,
      roundNumber,
    });
    const penalties = resolveCombatAttackPhaseDefensivePenalties({
      commitment: "committed",
      opportunities,
      participantId: OWNER,
      roundNumber,
    });
    const generated = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      attackPhaseDefensivePenalties: penalties,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      lifecycleContext: {
        createdAt: now,
        createdRevision: now,
        createdSequence: 0,
        encounterId,
        ownerParticipantId: ownerParticipant.participant.id,
        visibility: { audience: "involved", sourceIdentity: "public" },
      },
      sourceEncounterId: encounterId,
      sourceRoundNumber: roundNumber,
    });
    const phase1Result = buildCombatRoundAttackRollResult({
      actionId: "double_attack",
      attackerParticipantId: OWNER,
      defenderDb: 20,
      defenderParticipantId: FOE,
      ob: 0,
      phase: "phase1",
      rollD20: 1,
      rollTotal: 1,
      rolledAt: new Date().toISOString(),
      weaponName: "Sword",
    });
    const atReview = combatRoundStateSchema.parse({
      ...state,
      currentCursor: { participantId: OWNER, roundNumber, step: "M2" },
      currentStep: "review_phase_2_modifiers",
      participants: state.participants.map((participant) =>
        participant.participantId === OWNER
          ? {
              ...participant,
              attackResults: { ...participant.attackResults, phase1: phase1Result },
              declaration: {
                ...participant.declaration,
                attackOpportunities: opportunities,
                attackPhaseDefensivePenalties: penalties,
                combatContext: generated,
                phaseContexts: { ...participant.declaration?.phaseContexts, phase2: generated },
              },
            }
          : participant,
      ),
      phaseResolutionCursor: undefined,
      selectedParticipantId: OWNER,
      selectedStep: "review_phase_2_modifiers",
    });
    const put = await page.request.put(`${API_URL}/encounters/${encounterId}`, {
      data: {
        expectedRevision: active.encounter.updatedAt,
        session: {
          ...active.encounter,
          combatRoundState: atReview,
          currentRound: roundNumber,
          status: "active",
        },
      },
    });
    expect(put.ok(), await put.text()).toBe(true);
    record("fixture generator figures", {
      phase2Rows: phase2AttackPhaseRows(generated).map((row) => ({
        id: row.id,
        notes: row.notes,
        value: row.value,
      })),
    });

    const readEncounter = async (): Promise<EncounterSession> =>
      (
        await json<{ encounter: EncounterSession }>(
          await page.request.get(`${API_URL}/encounters/${encounterId}`),
        )
      ).encounter;
    const readRound = async (): Promise<CombatRoundState> =>
      (await readEncounter()).combatRoundState as CombatRoundState;
    const readOwnerParticipantRevision = async (): Promise<string> => {
      const { participants } = await json<{ participants: { id: string; updatedAt: string }[] }>(
        await page.request.get(`${API_URL}/scenarios/${scenarioId}/participants`),
      );
      const found = participants.find(
        (participant) => participant.id === ownerParticipant.participant.id,
      );
      if (!found) throw new Error("the owner's Scenario participant is no longer listed");
      return found.updatedAt;
    };

    // --- the GM commits -1: a figure the generator cannot produce (the penalty is bounded -4..0
    //     and both reductions give -2, so -1 identifies whose figure survived) ---
    const commitReview = async (value: number) => {
      const encounter = await readEncounter();
      const round = encounter.combatRoundState as CombatRoundState;
      const identity = taskCommandIdentity({
        expectedCommand: "review_modifiers_phase2",
        participantId: OWNER,
        state: round,
      });
      const expectedParticipantRevision = await readOwnerParticipantRevision();
      const declaration = round.participants.find(
        (participant) => participant.participantId === OWNER,
      )!.declaration!;
      const edit = (context: unknown) => {
        const parsed = scenarioParticipantCombatContextSchema.parse(context);
        return {
          ...parsed,
          modifierBuckets: {
            ...parsed.modifierBuckets,
            situationDb: parsed.modifierBuckets.situationDb.map((entry) =>
              entry.id.startsWith(ATTACK_PHASE_ROW_PREFIX) && entry.sourcePhase === "phase2"
                ? restateCanonicalModifierBucketRowValue({ entry, nextValue: value })
                : entry,
            ),
          },
        };
      };
      const response = await page.request.post(
        `${API_URL}/encounters/${encounterId}/combat-declaration`,
        {
          data: {
            actionId: declaration.actionId,
            combatContext: edit(declaration.combatContext),
            executionGroupId: identity.executionGroupId,
            expectedParticipantRevision,
            expectedRevision: encounter.updatedAt,
            movementId: declaration.movementId,
            movementIntent: declaration.movementIntent,
            phaseContexts: {
              phase1: declaration.phaseContexts?.phase1,
              phase2: edit(declaration.phaseContexts?.phase2),
            },
            scenarioParticipantId: ownerParticipant.participant.id,
            taskId: identity.taskId,
          },
        },
      );
      expect(response.ok(), await response.text()).toBe(true);
    };

    const route = `/campaigns/${campaignId}?scenarioId=${scenarioId}&encounterId=${encounterId}&tab=combat`;
    record("route captured on", route);

    /**
     * Loads the GM Combat tab and lets it settle. The settle wait is deliberate: this page
     * autoscrolls to the current task a beat after mount, and a read taken before that reports a
     * position the GM never sees. Nothing here runs inside the atomic read.
     */
    const openInspector = async () => {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: /^Combat inspector — / })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.locator(DETAILS_SELECTOR).first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(3000);
    };

    /**
     * Three reads per state and width, each atomic.
     *
     * - `arrival`, as the GM meets the page after it settles. Its scroll position is **recorded,
     *   not asserted on**: the page autoscrolls to the current task on this machine and did not
     *   in CI, where `scrollY` stayed 0 at every width. An assertion that the card is on screen
     *   at arrival is therefore an assertion about a timing-dependent scroll, not about the
     *   build, and an earlier revision of this spec made exactly that mistake.
     * - `inView`, with the card scrolled to. This is the build property: wherever the GM reaches
     *   it from, the sentence is on screen, complete and unclipped.
     * - `followed`, after pressing the current-task control. Recorded because it is informative:
     *   when the inspector is already on the current task, pressing it returns the page to
     *   `scrollY` 0 and takes the card back off screen.
     */
    const capture = async (stateKey: string, width: number) => {
      await page.setViewportSize({ height: VIEWPORT_HEIGHT, width });
      await openInspector();
      const arrival = await readSurface(page, FORBIDDEN_SUBSTRINGS, SUPERSEDED_SENTENCE);
      record(`${stateKey} arrival @ ${width}`, arrival);
      await shoot(`${stateKey}-arrival-${width}`);

      await page.evaluate(() => {
        const card = [...document.querySelectorAll("section")].find(
          (node) =>
            node.firstElementChild?.tagName === "STRONG" &&
            node.firstElementChild.textContent === "Current action",
        );
        card?.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(800);
      const inView = await readSurface(page, FORBIDDEN_SUBSTRINGS, SUPERSEDED_SENTENCE);
      record(`${stateKey} with the card scrolled to @ ${width}`, inView);
      await shoot(`${stateKey}-inview-${width}`);

      const control = page.getByRole("button", { name: /^(Resume )?current task$/i });
      let followed = arrival;
      if ((await control.count()) > 0) {
        await control.first().click();
        await page.waitForTimeout(2000);
        followed = await readSurface(page, FORBIDDEN_SUBSTRINGS, SUPERSEDED_SENTENCE);
        record(`${stateKey} after following the current-task control @ ${width}`, followed);
        await shoot(`${stateKey}-followed-${width}`);
      }
      return { arrival, followed, inView };
    };

    // ===== the negative control on the same card, before any rule event =====
    // Measured, not assumed: an *un-superseded* `modifier_review` is never the current action in
    // this walk. While the phase-2 review is open the projection ranks the Double Attack phase-2
    // decision first, and the review only becomes the current action once the cancel re-offers it.
    // So the rendered control here is "the same card, same widths, nothing about a supersession",
    // and the controls on the wording itself are the player's card at the same instant (below) and
    // the view-model tests in `currentActionPresentation.test.ts`.
    for (const width of WIDTHS) {
      const { arrival } = await capture("s0-before-commit", width);
      expect
        .soft(arrival.label.cardFound, `the Current action card rendered at ${width}px`)
        .toBe(true);
      expect
        .soft(
          arrival.pageTextHits,
          `nothing on the GM page names a supersession before the cancel at ${width}px (label: ${JSON.stringify(arrival.label.text)})`,
        )
        .toEqual([]);
    }

    await commitReview(-1);
    const committedRound = await readRound();
    const committedDeclaration = committedRound.participants.find(
      (participant) => participant.participantId === OWNER,
    )!.declaration!;
    record("after the GM commits -1", {
      currentStep: committedRound.currentStep,
      modifierReviewOwners: modifierReviewOwners(committedRound),
      phase2Rows: phase2AttackPhaseRows(committedDeclaration.combatContext).map((row) => ({
        id: row.id,
        notes: row.notes,
        value: row.value,
      })),
    });
    expect(
      phase2AttackPhaseRows(committedDeclaration.combatContext).map((row) => row.value),
      "the GM's -1 is the stored phase-2 figure before the cancel",
    ).toEqual([-1]);

    // ================= the cancel: the rule supersedes the GM's figure =================
    const beforeCancelEncounter = await readEncounter();
    const cancelIdentity = taskCommandIdentity({
      expectedCommand: "decide_double_attack_phase2",
      participantId: OWNER,
      state: beforeCancelEncounter.combatRoundState as CombatRoundState,
    });
    const opportunityId =
      cancelIdentity.opportunityId ??
      committedDeclaration.attackOpportunities?.find(
        (opportunity) => opportunity.phase === "phase2",
      )?.id;
    expect(opportunityId, "the phase-2 attack opportunity exists to cancel").toBeTruthy();
    const cancel = await page.request.post(
      `${API_URL}/encounters/${encounterId}/combat-round/double-attack-phase2-decision`,
      {
        data: {
          decision: "cancel",
          executionGroupId: cancelIdentity.executionGroupId,
          expectedRevision: beforeCancelEncounter.updatedAt,
          opportunityId,
          scenarioParticipantId: ownerParticipant.participant.id,
          taskId: cancelIdentity.taskId,
        },
      },
    );
    expect(cancel.ok(), await cancel.text()).toBe(true);
    const cancelledRound = await readRound();
    const cancelledDeclaration = cancelledRound.participants.find(
      (participant) => participant.participantId === OWNER,
    )!.declaration!;
    const markedRows = phase2AttackPhaseRows(cancelledDeclaration.combatContext);
    record("after the cancel", {
      currentStep: cancelledRound.currentStep,
      modifierReviewOwners: modifierReviewOwners(cancelledRound),
      phase2Rows: markedRows.map((row) => ({
        id: row.id,
        notes: row.notes,
        supersededGmFigure: row.supersededGmFigure,
        value: row.value,
      })),
    });
    // Preconditions. Without them, "nothing leaked" and "the label says it" measure nothing.
    expect(
      markedRows.map((row) => row.value),
      "the rule's -2 is the stored phase-2 figure after the cancel",
    ).toEqual(markedRows.map(() => -2));
    expect(
      markedRows.every((row) => row.supersededGmFigure?.value === -1),
      "the GM's -1 is retained on every superseded row",
    ).toBe(true);
    expect(
      markedRows.every((row) => !(row.notes ?? "").includes(SUPERSEDED_GM_FIGURE_NOTE_MARKER)),
      "the stored note carries no supersession text (#931 comment 21255)",
    ).toBe(true);
    expect(
      modifierReviewOwners(cancelledRound),
      "the committed modifier review is re-offered to the row's owner",
    ).toContain(OWNER);

    // ================= PROOF 1: the label, at each usable width =================
    const verdicts: Record<string, unknown> = {};
    for (const width of WIDTHS) {
      const { arrival, followed, inView } = await capture("s2-after-cancel", width);
      // The verdict is taken with the card scrolled to: see `capture`, and the report. Arrival is
      // recorded beside it so the fold question is answered with numbers rather than asserted on.
      const label = inView.label;
      verdicts[`width ${width}`] = {
        afterPressingTheCurrentTaskControl: {
          labelInsideViewportAtThisScroll: followed.label.insideViewportAtThisScroll,
          rectTop: followed.label.rect.top,
          scrollY: followed.label.scrollY,
        },
        arrival: {
          currentTaskControl: arrival.currentTaskControl,
          labelDocumentTop: arrival.label.documentTop,
          labelInsideFirstViewport: arrival.label.insideFirstViewport,
          labelInsideViewportAtThisScroll: arrival.label.insideViewportAtThisScroll,
          scrollY: arrival.label.scrollY,
        },
        detailsCarryForbiddenText: inView.details.flatMap((entry) => entry.carriesForbiddenText),
        detailsValues: inView.details.map((entry) => entry.value),
        label,
        pageTextHits: inView.pageTextHits,
        primaryAction: inView.primaryAction,
      };

      // Soft, so every width is measured and every artefact written even on a negative result.
      expect.soft(label.cardFound, `the Current action card rendered at ${width}px`).toBe(true);
      expect
        .soft(
          label.text,
          `the label at ${width}px leads with the Product Owner's sentence (scrollY ${label.scrollY})`,
        )
        .toBe(`${SUPERSEDED_SENTENCE} ${READY_SENTENCE}`);
      expect
        .soft(
          label.clipped,
          `the label at ${width}px is not clipped (client ${label.clientWidth}x${label.clientHeight}, scroll ${label.scrollWidth}x${label.scrollHeight})`,
        )
        .toBe(false);
      // The fold, answered by properties of the build rather than of a scroll.
      //
      // The card sits below the first viewport on this route at every width, so what has to hold
      // is (a) something in the first viewport takes a GM to it, (b) the sentence is on screen and
      // readable once the card is reached, and (c) it is in the same card as the control that
      // completes the review — so a GM cannot act on the task without being where the sentence is.
      // (c) is the one that does not depend on scrolling at all.
      expect
        .soft(
          arrival.currentTaskControl.found && arrival.currentTaskControl.insideFirstViewport,
          `at ${width}px a current-task control sits in the first ${VIEWPORT_HEIGHT}px (${JSON.stringify(arrival.currentTaskControl)})`,
        )
        .toBe(true);
      expect
        .soft(
          label.insideViewportAtThisScroll,
          `at ${width}px the label is on screen once the card is reached (document top ${label.documentTop}, rect top ${label.rect.top}, bottom ${label.rect.bottom}, viewport ${label.innerHeight}, scrollY ${label.scrollY})`,
        )
        .toBe(true);
      expect
        .soft(
          inView.primaryAction.foundInSameCard &&
            /complete modifier review/i.test(inView.primaryAction.text),
          `at ${width}px the control that completes the review is in the same card as the sentence (${JSON.stringify(inView.primaryAction)})`,
        )
        .toBe(true);
      // And the Details cell carries nothing about it, at any width.
      for (const entry of inView.details) {
        expect
          .soft(
            entry.carriesForbiddenText,
            `the ${entry.ariaLabel} cell at ${width}px carries no supersession text`,
          )
          .toEqual([]);
      }
    }
    record("label verdicts", verdicts);

    // ============ PROOF 2: the player reads, classified by response key ============
    const playerEndpoints = [
      `/scenarios/${scenarioId}`,
      `/scenarios/${scenarioId}/session`,
      `/scenarios/${scenarioId}/player-projection`,
      `/scenarios/${scenarioId}/events`,
      `/scenarios/${scenarioId}/participants`,
      `/scenarios/${scenarioId}/my-participant`,
      `/scenarios/${scenarioId}/encounters`,
      `/scenarios/${scenarioId}/encounter-summaries`,
      `/encounters/${encounterId}`,
      `/encounters/${encounterId}/revision`,
      `/encounters/${encounterId}/items`,
      `/encounters/${encounterId}/combat-history`,
    ];

    const sweep = async (label: string, request: APIRequestContext) => {
      const rows: {
        endpoint: string;
        hits: string[];
        leaves: number;
        rawCarries: string[];
        status: number;
        topLevelKeys: string[];
      }[] = [];
      for (const endpoint of playerEndpoints) {
        const response = await request.get(`${API_URL}${endpoint}`);
        const status = response.status();
        let body: unknown;
        let raw = "";
        try {
          raw = await response.text();
          body = raw.length > 0 ? JSON.parse(raw) : undefined;
        } catch {
          body = raw;
        }
        const classified = classifyResponseKeys(body, FORBIDDEN_SUBSTRINGS);
        rows.push({
          endpoint,
          hits: classified.hits,
          leaves: classified.leaves,
          // A raw-text check beside the key walk: a hit the walk missed is still a leak.
          rawCarries: FORBIDDEN_SUBSTRINGS.filter((needle) =>
            raw.toLowerCase().includes(needle.toLowerCase()),
          ),
          status,
          topLevelKeys:
            body !== null && typeof body === "object" && !Array.isArray(body)
              ? Object.keys(body as Record<string, unknown>)
              : Array.isArray(body)
                ? ["<array>"]
                : [],
        });
      }
      record(`player read: ${label}`, rows);
      return rows;
    };

    // The GM's own sweep first, as the alive instrument: the GM's reads DO carry the field, so an
    // empty player sweep is a projection result rather than an empty fixture.
    const gmRows = await sweep("GM (control: the field is expected here)", page.request);
    const carryingEndpoints = gmRows
      .filter((row) => row.hits.length > 0)
      .map((row) => row.endpoint);
    record("endpoints that carry the superseded figure for the GM", carryingEndpoints);
    expect
      .soft(
        carryingEndpoints.length,
        "the GM's own reads carry the superseded figure, so an empty player sweep is a projection result and not an empty fixture",
      )
      .toBeGreaterThan(0);

    for (const [label, request] of [
      ["the controlling player", playerContext.request],
      ["another player in the same Encounter", otherContext.request],
      ["a player with no access to the Scenario", unrelatedContext.request],
    ] as const) {
      const rows = await sweep(label, request);
      for (const row of rows) {
        expect
          .soft(
            row.hits,
            `${label}: ${row.endpoint} (${row.status}, ${row.leaves} leaves) carries no supersession key or value`,
          )
          .toEqual([]);
        expect
          .soft(row.rawCarries, `${label}: ${row.endpoint} raw body carries nothing`)
          .toEqual([]);
      }
      // The paired control, endpoint by endpoint: on every endpoint that does carry the figure for
      // the GM, this viewer either received a populated body with no hit, or was refused outright.
      // Without this, "no hits" could simply mean "no body".
      for (const endpoint of carryingEndpoints) {
        const row = rows.find((candidate) => candidate.endpoint === endpoint)!;
        expect
          .soft(
            row.leaves > 0 || row.status >= 400,
            `${label}: ${endpoint} either returned a populated body (${row.leaves} leaves) or refused access (status ${row.status})`,
          )
          .toBe(true);
      }
    }

    // And the controlling player's own rendered combat page: the label there is the ordinary one.
    const playerPage = await playerContext.newPage();
    await playerPage.setViewportSize({ height: VIEWPORT_HEIGHT, width: 1440 });
    await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player/combat`);
    await playerPage.waitForTimeout(4000);
    const playerSurface = await readSurface(playerPage, FORBIDDEN_SUBSTRINGS, SUPERSEDED_SENTENCE);
    record("player combat page @ 1440", playerSurface);
    const playerShot = artefact("s5-player-combat-page-1440.png");
    await playerPage.screenshot({ fullPage: true, path: playerShot });
    console.log(`#931 artefact ${playerShot}`);
    expect
      .soft(playerSurface.pageTextHits, "the player's own combat page names no supersession")
      .toEqual([]);
    expect
      .soft(
        playerSurface.label.startsWithSupersededSentence,
        "the player's Current action card does not lead with the GM-only sentence",
      )
      .toBe(false);

    await playerPage.close();
    await playerContext.close();
    await otherContext.close();
    await unrelatedContext.close();

    // --- prove the artefacts: the measurements file is rewritten on every record above ---
    console.log(`#931 artefact ${measurementsPath}`);
    for (const file of artefacts) {
      const stat = fs.existsSync(file) ? fs.statSync(file) : undefined;
      expect(stat?.size ?? 0, `artefact ${file} was written`).toBeGreaterThan(0);
    }
    console.log(`#931 artefact directory ${path.resolve(artefactDir)}`);
    console.log(`#931 artefacts written: ${artefacts.length}`);
  });
});
