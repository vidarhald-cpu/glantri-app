/**
 * #875 — driven proof that the committed initiative order is a record the tracker renders.
 *
 * Question it answers: once the GM commits initiative, does anything other than another commit
 * change the order the tracker shows?
 *
 * How it is driven: entirely through the production domain functions, in process, against no
 * database and no server. It builds an encounter, records declarations and initiative with
 * `recordCombatRoundDeclaration` / `recordCombatRoundInitiative`, commits with
 * `commitCombatRoundPhaseInitiativeResolution`, drives the phase-1 resolution to completion with
 * `skipCombatRoundCurrentPhaseAction` and `completeCombatRoundPhaseResolutionForParticipant`, takes
 * commands back with `undoLatestCombatRoundCommand`, and advances rounds with
 * `advanceCombatRoundStep`. The rendered order is read where the trackers read it:
 * `buildCombatProgressionProjection(...).executionOrder.participantIds`, and through the GM
 * panel's own `getCombatRoundManagerDisplayParticipantIds`.
 *
 * Beside every recorded order it also prints the order the old code would have derived from
 * current state, so a measurement that stopped distinguishing the two would show as two identical
 * columns rather than as a pass.
 *
 * It imports the domain and the GM panel selector by source path rather than by package name,
 * because the repository root has no workspace link; `pnpm build` verifies the emitted packages
 * separately. Run it with `node --import tsx m875-instruments/probe-order-record.ts`.
 *
 * FAIL-CLOSED (docs/process/qa-instruments.md, consequences 1 and 3): M875_OUT must name a
 * writable output file or the probe refuses to start, every figure is also printed to stdout, and
 * the probe exits non-zero when any check failed. Its row is in that register.
 *
 * M875_BREAK selects a deliberate break so the probe can be seen to fail:
 *   derive-order   — render the derived order instead of the record;
 *   insertion      — render raw encounter insertion order;
 *   drop-record    — never write the record.
 */
import fs from "node:fs";

import {
  advanceCombatRoundStep,
  buildCombatProgressionProjection,
  combatRoundStateSchema,
  commitCombatRoundPhaseInitiativeResolution,
  completeCombatRoundPhaseResolutionForParticipant,
  encounterSessionSchema,
  ensureCombatRoundEndReviewPrepared,
  commitCombatRoundEndParticipantReview,
  isCombatRoundEndReviewComplete,
  getCombatRoundInitiativeExecutionGroups,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  skipCombatRoundCurrentPhaseAction,
  sortCombatRoundParticipantsByInitiative,
  undoLatestCombatRoundCommand,
  type CombatRoundState,
  type EncounterParticipant,
  type EncounterSession,
} from "../packages/domain/src/index";
import { getCombatRoundManagerDisplayParticipantIds } from "../apps/web/src/features/combat-round-manager/combatRoundSelection";

const OUT = process.env.M875_OUT;
if (!OUT || OUT.trim() === "") {
  throw new Error(
    "[probe-875] M875_OUT is unset. Refusing to run: a recording probe that defaults its output " +
      "target exits green having measured nothing.",
  );
}
const BREAK = process.env.M875_BREAK ?? "";

const lines: string[] = [];
let failures = 0;

function log(message: string): void {
  console.log(message);
  lines.push(message);
}

function check(name: string, actual: unknown, expected: unknown): void {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  const ok = actualText === expectedText;
  if (!ok) failures += 1;
  log(`${ok ? "PASS" : "FAIL"} ${name}`);
  log(`     expected ${expectedText}`);
  log(`     actual   ${actualText}`);
}

function flush(): void {
  fs.writeFileSync(OUT!, `${lines.join("\n")}\n`);
}

/* ------------------------------------------------------------------ fixture */

function participant(input: { id: string; label: string }): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

/**
 * Round 2, as the domain's own round tests use: round 1 opens on the combat-start Combat
 * Experience gate, which is not what this probe measures.
 */
const START_ROUND = 2;

function encounter(participantIds: string[]): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: START_ROUND,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-875",
    kind: "combat",
    participants: participantIds.map((id) =>
      participant({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }),
    ),
    scenarioId: "scenario-875",
    status: "active",
    title: "#875 order record probe",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

/** An initiative result whose rolls are legal d6 values summing to `total`. */
function initiativeOf(total: number): {
  baseInitiative: number;
  modifierAdjustment: number;
  rolls: number[];
  rollTotal: number;
  total: number;
} {
  const rolls: number[] = [];
  let remaining = total;
  while (remaining > 6) {
    rolls.push(6);
    remaining -= 6;
  }
  rolls.push(remaining);
  return { baseInitiative: 0, modifierAdjustment: 0, rolls, rollTotal: total, total };
}

/** The order the tracker renders, read where the GM panel reads it. */
function renderedOrder(state: CombatRoundState): string[] {
  const projection = buildCombatProgressionProjection(state);
  const fromProjection = projection.executionOrder?.participantIds;
  if (BREAK === "insertion") {
    return state.participants.map((entry) => entry.participantId);
  }
  if (BREAK === "derive-order") {
    return sortCombatRoundParticipantsByInitiative({ phase: "phase1", state }).map(
      (entry) => entry.participantId,
    );
  }
  const fromPanel = getCombatRoundManagerDisplayParticipantIds(state);
  if (fromProjection && JSON.stringify([...fromProjection]) !== JSON.stringify(fromPanel)) {
    log(
      `NOTE projection order ${JSON.stringify([...fromProjection])} and GM panel order ` +
        `${JSON.stringify(fromPanel)} differ (the panel appends participants the record does not name)`,
    );
  }
  return fromPanel;
}

/** What the old code derived from current state: initiative sort, and the execution groups. */
function derivedOrder(state: CombatRoundState, phase: "phase1" | "phase2"): string[] {
  return sortCombatRoundParticipantsByInitiative({ phase, state }).map(
    (entry) => entry.participantId,
  );
}

function derivedGroupOrder(state: CombatRoundState, phase: "phase1" | "phase2"): string[] {
  return getCombatRoundInitiativeExecutionGroups({ phase, state }).flatMap(
    (group) => group.participantIds,
  );
}

/** The derived groups with their statuses: the current-state value that does move. */
function derivedGroupStatuses(state: CombatRoundState, phase: "phase1" | "phase2") {
  return getCombatRoundInitiativeExecutionGroups({ phase, state }).map((group) => ({
    initiativeValue: group.initiativeValue,
    participantIds: group.participantIds,
    status: group.status,
  }));
}

function recordOf(state: CombatRoundState) {
  const record = state.committedInitiativeOrders.at(-1);
  return record
    ? {
        commandId: record.commandId,
        entries: record.entries.map((entry) => ({
          initiativePublished: entry.initiativePublished,
          participantId: entry.participantId,
          total: entry.initiativeResult?.total ?? null,
        })),
        phase: record.phase,
        roundNumber: record.roundNumber,
      }
    : null;
}

function stripRecords(state: CombatRoundState): CombatRoundState {
  const { committedInitiativeOrders: _dropped, ...withoutRecords } = state;
  return combatRoundStateSchema.parse(withoutRecords);
}

/* --------------------------------------------------------------------- drive */

log("#875 driven proof — committed initiative order is a record, rendered, not recomputed");
log(`break: ${BREAK === "" ? "(none)" : BREAK}`);
log("");

// alpha, beta, gamma in encounter insertion order. gamma never rolls initiative.
const INSERTION = ["alpha", "beta", "gamma"];
const base = initializeCombatRoundState({ encounter: encounter(INSERTION) });
log(`insertion order: ${JSON.stringify(INSERTION)}`);

// Declarations: alpha and beta attack each other; gamma passes, so it has no attack to resolve.
let state: CombatRoundState = base;
for (const [participantId, actionId, target] of [
  ["alpha", "attack_parry", "scenario-beta"],
  ["beta", "attack_parry", "scenario-alpha"],
  ["gamma", "pass", undefined],
] as const) {
  const phaseContext = {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId: target,
  };
  state = recordCombatRoundDeclaration({
    command: { createdAt: "2026-01-01T00:01:00.000Z", createdByUserId: "gm-875" },
    declaration: {
      actionId,
      ...(target ? { phaseContexts: { phase1: phaseContext, phase2: phaseContext } } : {}),
      roundNumber: state.roundNumber,
    },
    participantId,
    state,
    submittedBy: "gm",
  });
}

// Advance to the phase-1 initiative step.
for (let guard = 0; guard < 50 && state.currentStep !== "initiative_phase_1"; guard += 1) {
  state = advanceCombatRoundStep(state);
}
if (state.currentStep !== "initiative_phase_1") {
  throw new Error(
    `[probe-875] could not reach initiative_phase_1, stopped at ${state.currentStep}`,
  );
}

// Record initiative so the committed order differs from insertion order: beta 9, alpha 4.
// gamma rolls nothing at all.
for (const [participantId, total] of [
  ["alpha", 4],
  ["beta", 9],
] as const) {
  state = recordCombatRoundInitiative({
    command: { createdAt: "2026-01-01T00:02:00.000Z", createdByUserId: "gm-875" },
    initiative: initiativeOf(total),
    participantId,
    phase: "phase1",
    state,
    submittedBy: "gm",
  });
}

const beforeCommit = state;
log("");
log("--- before the first commit of round 1 (nothing has ever been committed) ---");
log(`rendered order            ${JSON.stringify(renderedOrder(beforeCommit))}`);
log(`record                    ${JSON.stringify(recordOf(beforeCommit))}`);
check("M0 no record exists before any commit", recordOf(beforeCommit), null);

/* ------------------------------------------------- M1: the commit writes it */

const committed = commitCombatRoundPhaseInitiativeResolution({
  command: { createdAt: "2026-01-01T00:03:00.000Z", createdByUserId: "gm-875" },
  // gamma never rolled: the canonical way to commit without fabricating a value for it.
  nonParticipatingParticipantIds: new Set(["gamma"]),
  phase: "phase1",
  state: beforeCommit,
});
state =
  BREAK === "drop-record"
    ? combatRoundStateSchema.parse({ ...committed.state, committedInitiativeOrders: [] })
    : committed.state;

log("");
log("--- M1: committing initiative writes the record ---");
log(`record                    ${JSON.stringify(recordOf(state), null, 0)}`);
check("M1 recorded sequence, totals and publication state", recordOf(state), {
  commandId: committed.command.id,
  entries: [
    { initiativePublished: true, participantId: "beta", total: 9 },
    { initiativePublished: true, participantId: "alpha", total: 4 },
    { initiativePublished: false, participantId: "gamma", total: null },
  ],
  phase: "phase1",
  roundNumber: START_ROUND,
});
check("M1 never-rolled participant is recorded last", recordOf(state)?.entries.at(-1), {
  initiativePublished: false,
  participantId: "gamma",
  total: null,
});

const committedOrder = ["beta", "alpha", "gamma"];
log("");
log("--- M2: the tracker renders the record, not insertion order ---");
log(`rendered order            ${JSON.stringify(renderedOrder(state))}`);
log(`derived initiative sort   ${JSON.stringify(derivedOrder(state, "phase1"))}`);
log(`derived execution groups  ${JSON.stringify(derivedGroupOrder(state, "phase1"))}`);
check("M2 rendered order is the recorded order", renderedOrder(state), committedOrder);
check(
  "M2 rendered order is not encounter insertion order",
  renderedOrder(state) === INSERTION,
  false,
);

/* --------------------- M3: withdrawing an action must not re-sort the tracker */

log("");
log("--- M3: withdrawing the top actor's phase-1 action ---");
const withdrawn = skipCombatRoundCurrentPhaseAction({
  command: { createdAt: "2026-01-01T00:04:00.000Z", createdByUserId: "gm-875" },
  participantId: "beta",
  phase: "phase1",
  reason: "#875 probe: withdraw the action the ruling says must not move the row",
  state,
  submittedBy: "gm",
  updatedAt: "2026-01-01T00:04:00.000Z",
});
const betaActionStatusBefore = state.participants.find((entry) => entry.participantId === "beta")
  ?.stepStatuses.phase_1_actions;
const betaActionStatusAfter = withdrawn.participants.find((entry) => entry.participantId === "beta")
  ?.stepStatuses.phase_1_actions;
log(`rendered order            ${JSON.stringify(renderedOrder(withdrawn))}`);
log(`beta phase_1_actions      ${betaActionStatusBefore} -> ${betaActionStatusAfter}`);
log(`derived groups before     ${JSON.stringify(derivedGroupStatuses(state, "phase1"))}`);
log(`derived groups after      ${JSON.stringify(derivedGroupStatuses(withdrawn, "phase1"))}`);
check(
  "M3 the withdrawal really changed current state",
  betaActionStatusBefore !== betaActionStatusAfter,
  true,
);
check(
  "M3 the withdrawal moved the derived current-group boundary (sanctioned, #884)",
  JSON.stringify(derivedGroupStatuses(withdrawn, "phase1")) !==
    JSON.stringify(derivedGroupStatuses(state, "phase1")),
  true,
);
check(
  "M3 withdrawing the action did not change the rendered order",
  renderedOrder(withdrawn),
  committedOrder,
);
check("M3 the record itself is untouched", recordOf(withdrawn), recordOf(state));

/* ------------------- M4: taking that withdrawal back must not re-sort either */

log("");
log("--- M4: taking the withdrawal back ---");
const takenBack = undoLatestCombatRoundCommand({ state: withdrawn });
if (!takenBack) throw new Error("[probe-875] undoLatestCombatRoundCommand returned nothing");
const removedCommandIds = withdrawn.commands
  .map((command) => command.id)
  .filter((id) => !takenBack.commands.some((command) => command.id === id));
log(`commands before/after     ${withdrawn.commands.length} -> ${takenBack.commands.length}`);
log(`command(s) removed        ${JSON.stringify(removedCommandIds)}`);
log(`rendered order            ${JSON.stringify(renderedOrder(takenBack))}`);
log(`derived groups            ${JSON.stringify(derivedGroupOrder(takenBack, "phase1"))}`);
check(
  "M4 the take-back removed the withdrawal, not the initiative commit",
  removedCommandIds.includes(committed.command.id),
  false,
);
check("M4 the take-back did change state back", derivedGroupOrder(takenBack, "phase1"), [
  "beta",
  "alpha",
]);
check(
  "M4 the take-back did not change the rendered order",
  renderedOrder(takenBack),
  committedOrder,
);
check("M4 the take-back did not change the record", recordOf(takenBack), recordOf(state));

/* ------------- M4b: taking the initiative commit itself back drops its record */

log("");
log("--- M4b: taking the initiative commit itself back ---");
const commitUndone = undoLatestCombatRoundCommand({ state: takenBack });
if (!commitUndone) throw new Error("[probe-875] the commit could not be taken back");
log(
  `command(s) removed        ${JSON.stringify(
    takenBack.commands
      .map((command) => command.id)
      .filter((id) => !commitUndone.commands.some((command) => command.id === id)),
  )}`,
);
log(`records left              ${commitUndone.committedInitiativeOrders.length}`);
log(`rendered order            ${JSON.stringify(renderedOrder(commitUndone))}`);
check(
  "M4b undoing the commit removed the commit command",
  commitUndone.commands.some((command) => command.id === committed.command.id),
  false,
);
check(
  "M4b the record it wrote left with it, so no record stands for a commit that is gone",
  commitUndone.committedInitiativeOrders.length,
  0,
);
check(
  "M4b with no earlier record the tracker falls back, as it did before #875",
  renderedOrder(commitUndone),
  INSERTION,
);

/* ---------------------------- M3b: resolution to completion must not re-sort */

log("");
log("--- M3b: driving the phase-1 resolution to completion ---");
let resolved = state;
for (const participantId of ["beta", "alpha", "gamma"]) {
  resolved = completeCombatRoundPhaseResolutionForParticipant({
    participantId,
    phase: "phase1",
    state: resolved,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  log(
    `after ${participantId.padEnd(6)} resolved: rendered ${JSON.stringify(
      renderedOrder(resolved),
    )}  derived groups ${JSON.stringify(derivedGroupOrder(resolved, "phase1"))}`,
  );
}
check(
  "M3b completing every resolution did not change the rendered order",
  renderedOrder(resolved),
  committedOrder,
);
log(`derived groups before     ${JSON.stringify(derivedGroupStatuses(state, "phase1"))}`);
log(`derived groups after      ${JSON.stringify(derivedGroupStatuses(resolved, "phase1"))}`);
check(
  "M3b the derived groups DID change as resolutions completed (so the measurement is live)",
  JSON.stringify(derivedGroupStatuses(resolved, "phase1")) !==
    JSON.stringify(derivedGroupStatuses(state, "phase1")),
  true,
);
check("M3b the record itself is untouched", recordOf(resolved), recordOf(state));

/* ------------- M5: a round before its first commit shows the previous commit */

log("");
log("--- M5: the next round, before its own first initiative commit ---");
let roundTwo = resolved;
for (let guard = 0; guard < 120 && roundTwo.roundNumber === START_ROUND; guard += 1) {
  if (roundTwo.currentStep === "round_summary" && !isCombatRoundEndReviewComplete(roundTwo)) {
    roundTwo = ensureCombatRoundEndReviewPrepared({
      command: { createdAt: "2026-01-01T00:08:00.000Z", createdByUserId: "gm-875" },
      state: roundTwo,
    });
    for (const entry of roundTwo.participants) {
      if (roundTwo.roundEndReview?.participantReviews[entry.participantId]?.status === "complete") {
        continue;
      }
      roundTwo = commitCombatRoundEndParticipantReview({
        command: { createdAt: "2026-01-01T00:08:30.000Z", createdByUserId: "gm-875" },
        participantId: entry.participantId,
        scenarioParticipantId: entry.scenarioParticipantId ?? `scenario-${entry.participantId}`,
        state: roundTwo,
      }).state;
    }
    continue;
  }
  roundTwo = advanceCombatRoundStep(roundTwo);
}
if (roundTwo.roundNumber !== START_ROUND + 1) {
  throw new Error(
    `[probe-875] could not reach the next round, stopped in round ${roundTwo.roundNumber}`,
  );
}
log(`round / step              ${roundTwo.roundNumber} / ${roundTwo.currentStep}`);
log(
  `initiatives now           ${JSON.stringify(
    roundTwo.participants.map((entry) => [
      entry.participantId,
      entry.initiatives.phase1?.total ?? null,
    ]),
  )}`,
);
log(`rendered order            ${JSON.stringify(renderedOrder(roundTwo))}`);
log(`derived initiative sort   ${JSON.stringify(derivedOrder(roundTwo, "phase1"))}`);
check(
  "M5 the new round cleared every current initiative",
  roundTwo.participants.every((entry) => entry.initiatives.phase1 === undefined),
  true,
);
check(
  "M5 before the new round's first commit the tracker shows the previous commit's order",
  renderedOrder(roundTwo),
  committedOrder,
);
check(
  "M5 no current state could produce that order: the derived sort now gives insertion order",
  derivedOrder(roundTwo, "phase1"),
  INSERTION,
);

/* ------------------------------- M6: a new participant appears after the rest */

log("");
log("--- M6: a participant joins after the last commit ---");
const withDelta = initializeCombatRoundState({
  encounter: {
    ...encounter([...INSERTION, "delta"]),
    combatRoundState: roundTwo,
    currentRound: roundTwo.roundNumber,
  },
});
log(`rendered order            ${JSON.stringify(renderedOrder(withDelta))}`);
check(
  "M6 the new participant appears after the recorded order, behind the never-rolled one",
  renderedOrder(withDelta),
  [...committedOrder, "delta"],
);
check(
  "M6 the record did not gain the new participant",
  recordOf(withDelta)?.entries.map((entry) => entry.participantId),
  committedOrder,
);

/* ---------------------- M7: a stored state with no record renders, soft-fails */

log("");
log("--- M7: a round state stored before the record existed ---");
const legacyRaw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
delete legacyRaw.committedInitiativeOrders;
check(
  "M7 the key really is absent from the stored shape",
  Object.hasOwn(legacyRaw, "committedInitiativeOrders"),
  false,
);
let legacy: CombatRoundState;
try {
  legacy = combatRoundStateSchema.parse(legacyRaw);
} catch (error) {
  failures += 1;
  log(`FAIL M7 parsing a state without the key threw: ${String(error)}`);
  flush();
  process.exit(1);
}
check("M7 it parses to an empty record list, not a throw", legacy.committedInitiativeOrders, []);
let legacyRendered: string[] = [];
try {
  legacyRendered = renderedOrder(legacy);
  log(`rendered order            ${JSON.stringify(legacyRendered)}`);
} catch (error) {
  failures += 1;
  log(`FAIL M7 rendering a state without a record threw: ${String(error)}`);
}
check(
  "M7 a state with no record renders without throwing",
  Array.isArray(legacyRendered) && legacyRendered.length === state.participants.length,
  true,
);
const strippedAtInitiative = stripRecords(beforeCommit);
log(
  `no-record order at i1     ${JSON.stringify(renderedOrder(strippedAtInitiative))} ` +
    `(pre-#875 behaviour: encounter insertion order, deliberately unchanged)`,
);
check(
  "M7 with no record the pre-#875 fallback is unchanged",
  renderedOrder(strippedAtInitiative),
  INSERTION,
);

/* --------------------------- M8: a second commit is the only thing that re-sorts */

log("");
log("--- M8: a second commit re-sorts, and only a commit does ---");
let phaseTwo = state;
for (let guard = 0; guard < 80 && phaseTwo.currentStep !== "initiative_phase_2"; guard += 1) {
  phaseTwo = advanceCombatRoundStep(phaseTwo);
}
if (phaseTwo.currentStep !== "initiative_phase_2") {
  throw new Error(
    `[probe-875] could not reach initiative_phase_2, stopped at ${phaseTwo.currentStep}`,
  );
}
log(`at ${phaseTwo.currentStep}: rendered ${JSON.stringify(renderedOrder(phaseTwo))}`);
check(
  "M8 standing on phase-2 initiative, before its commit, still shows the phase-1 commit",
  renderedOrder(phaseTwo),
  committedOrder,
);
for (const [participantId, total] of [
  ["alpha", 11],
  ["beta", 2],
  ["gamma", 7],
] as const) {
  phaseTwo = recordCombatRoundInitiative({
    command: { createdAt: "2026-01-01T00:06:00.000Z", createdByUserId: "gm-875" },
    initiative: initiativeOf(total),
    participantId,
    phase: "phase2",
    state: phaseTwo,
    submittedBy: "gm",
  });
}
const secondCommit = commitCombatRoundPhaseInitiativeResolution({
  command: { createdAt: "2026-01-01T00:07:00.000Z", createdByUserId: "gm-875" },
  phase: "phase2",
  state: phaseTwo,
});
const afterSecond =
  BREAK === "drop-record"
    ? combatRoundStateSchema.parse({ ...secondCommit.state, committedInitiativeOrders: [] })
    : secondCommit.state;
log(
  `record count              ${state.committedInitiativeOrders.length} -> ${afterSecond.committedInitiativeOrders.length}`,
);
log(`record                    ${JSON.stringify(recordOf(afterSecond))}`);
log(`rendered order            ${JSON.stringify(renderedOrder(afterSecond))}`);
check(
  "M8 the phase-2 commit appended a second record rather than replacing the first",
  afterSecond.committedInitiativeOrders.length,
  state.committedInitiativeOrders.length + 1,
);
check("M8 the phase-2 commit re-sorted the tracker", renderedOrder(afterSecond), [
  "alpha",
  "gamma",
  "beta",
]);
check(
  "M8 the first record is still there to return to",
  afterSecond.committedInitiativeOrders[0]?.entries.map((entry) => entry.participantId),
  committedOrder,
);

/* ------------------------------------------------------------------- verdict */

log("");
log(`checks failed: ${failures}`);
log(failures === 0 ? "VERDICT: all checks passed" : "VERDICT: FAILED");
flush();
process.exit(failures === 0 ? 0 : 1);
