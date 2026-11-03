/**
 * #875 — stack proof that the real commit route writes the order record, that PostgreSQL stores
 * it, and that a player never receives it.
 *
 * Questions it answers, which the in-process probe cannot:
 *   S1  does the real `POST /combat-round/commit-phase-initiative-resolution` route write a record?
 *   S2  is that record in the row PostgreSQL actually holds, read with psql rather than through the
 *       API's own parse of its own write?
 *   S3  does the GM's progression, as the API projects it, render the recorded order?
 *   S4  does the player-facing encounter response carry the records? It must not.
 *   S5  does an archived round carry the record after the round boundary?
 *
 * How it is driven: through the real HTTP API for every mutation that has a route, and through the
 * domain's own commands for the committed starting state, which is then PUT as the encounter's
 * `combatRoundState` — the same technique as `m884-instruments/probe-m1.mts`. The initiative
 * commit itself is driven through the route, because that is the thing under test.
 *
 * Setup it assumes (handed over, not inferable):
 *   - run inside `pnpm db:task:exec`, which supplies the owned `DATABASE_URL`, `GLANTRI_DB_CONTAINER`
 *     and the derived `PLAYWRIGHT_API_URL`;
 *   - run behind `m875-instruments/stack.sh`, which starts this worktree's API on the derived port
 *     and stops it by exact PID;
 *   - `M875_STACK_OUT` must name a writable output file.
 *
 * FAIL-CLOSED (docs/process/qa-instruments.md, consequences 1 and 3): it refuses to start without
 * `M875_STACK_OUT`, prints every figure to stdout as well, and exits non-zero on any failed check.
 *
 * M875_STACK_BREAK=expect-insertion asserts the rendered order is encounter insertion order
 * instead of the recorded order, so the probe can be seen to fail.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import {
  buildCombatProgressionProjection,
  buildCombatRoundDeclarationId,
  buildCombatRoundDeclaredAttackOpportunities,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type CombatRoundState,
} from "../packages/domain/src/index";

const OUT = process.env.M875_STACK_OUT;
if (!OUT || OUT.trim() === "") {
  throw new Error(
    "[probe-875-stack] M875_STACK_OUT is unset. Refusing to run: a recording probe that defaults " +
      "its output target exits green having measured nothing.",
  );
}
const API =
  process.env.PLAYWRIGHT_API_URL ?? `http://${process.env.API_HOST}:${process.env.API_PORT}`;
const CONTAINER = process.env.GLANTRI_DB_CONTAINER;
if (!CONTAINER) throw new Error("[probe-875-stack] GLANTRI_DB_CONTAINER is unset.");
const DB_NAME = (process.env.DATABASE_URL ?? "").split("/").pop()?.split("?")[0];
if (!DB_NAME) throw new Error("[probe-875-stack] cannot derive the database name.");
if (DB_NAME === "glantri") throw new Error("[probe-875-stack] refusing the protected database.");
const BREAK = process.env.M875_STACK_BREAK ?? "";

const lines: string[] = [];
let failures = 0;
function log(message: string): void {
  console.log(message);
  lines.push(message);
}
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures += 1;
  log(`${a === e ? "PASS" : "FAIL"} ${name}`);
  log(`     expected ${e}`);
  log(`     actual   ${a}`);
}
function flush(): void {
  fs.writeFileSync(OUT!, `${lines.join("\n")}\n`);
}

const SUFFIX = process.env.M875_SUFFIX ?? String(Date.now());
const PASSWORD = "m875probe123";
let cookie = "";

async function call<T>(
  method: string,
  path: string,
  bodyInput?: unknown,
  asCookie?: string,
): Promise<T> {
  const body = bodyInput === undefined && method !== "GET" ? {} : bodyInput;
  const sent = asCookie ?? cookie;
  const response = await fetch(`${API}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(sent ? { Cookie: sent } : {}) },
    method,
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${method} ${path} -> ${response.status}: ${text.slice(0, 600)}`);
  const setCookie = response.headers.get("set-cookie");
  if (setCookie && !asCookie) cookie = (setCookie.split(";")[0] ?? "").trim();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function callRaw(
  method: string,
  path: string,
  bodyInput?: unknown,
): Promise<{ status: number; text: string }> {
  const response = await fetch(`${API}${path}`, {
    body: bodyInput === undefined ? undefined : JSON.stringify(bodyInput),
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    method,
  });
  return { status: response.status, text: await response.text() };
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", CONTAINER!, "psql", "-U", "postgres", "-d", DB_NAME!, "-t", "-A", "-c", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

function characterPayload(id: string, name: string) {
  const stats = {
    cha: 10,
    com: 10,
    con: 10,
    dex: 10,
    health: 10,
    int: 10,
    lck: 10,
    pow: 10,
    siz: 10,
    str: 12,
    will: 10,
  };
  return {
    build: {
      currentStatModifiers: {},
      developedStatModifiers: {},
      equipment: { items: [] },
      id,
      name,
      profile: {
        description: "",
        distractionLevel: 3,
        id: `profile-${id}`,
        label: "Profile",
        resolvedStats: stats,
        rolledStats: stats,
        societyLevel: 0,
        statLayerVersion: 1,
      },
      progression: {
        chargenMode: "standard",
        educationPoints: 0,
        flexiblePointFactor: 1,
        level: 1,
        primaryPoolSpent: 0,
        primaryPoolTotal: 60,
        secondaryPoolSpent: 0,
        secondaryPoolTotal: 400,
        skillGroups: [],
        skills: [
          {
            category: "secondary",
            categoryId: "combat",
            groupId: "basic_melee_training",
            secondaryRanks: 40,
            skillId: "brawling",
          },
          {
            category: "secondary",
            categoryId: "combat",
            groupId: "basic_melee_training",
            secondaryRanks: 10,
            skillId: "dodge",
          },
        ],
        specializations: [],
      },
      progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
    },
  };
}

const PUNCH_TEMPLATE = "virtual-weapon-template-punch";
const PUNCH_MODE = "mode-1";
const PUNCH_SOURCE = `unarmed:${PUNCH_TEMPLATE}`;

interface Side {
  characterId: string;
  combatantId: string;
  name: string;
  scenarioParticipantId: string;
}

function findCommitTask(state: CombatRoundState) {
  const projection = buildCombatProgressionProjection(state);
  for (const process_ of projection.boundary.processes) {
    for (const stage of process_.stages) {
      for (const task of stage.tasks) {
        if (task.expectedCommand === "commit_phase_initiative_resolution") {
          return {
            executionGroupId: task.executionGroupId,
            initiativeGroupId: task.identity?.initiativeGroupId,
            initiativeValue: task.identity?.initiativeValue,
            taskId: task.id,
          };
        }
      }
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  log(
    "#875 stack proof — the real route writes the record, PostgreSQL stores it, players do not get it",
  );
  log(`break: ${BREAK === "" ? "(none)" : BREAK}`);
  log(`api=${API} database=${DB_NAME} container=${CONTAINER} suffix=${SUFFIX}`);
  log("");

  // ---- GM and a real player account ----
  try {
    await call("POST", "/auth/register", {
      displayName: "M875 GM",
      email: "m875-gm@test.local",
      password: PASSWORD,
    });
    await call("POST", "/auth/bootstrap-gm", {});
  } catch {
    await call("POST", "/auth/login", { email: "m875-gm@test.local", password: PASSWORD });
  }
  const gm = await call<{ user: { id: string } }>("GET", "/auth/me");
  const gmCookie = cookie;

  let playerCookie = "";
  try {
    await call("POST", "/auth/register", {
      displayName: "M875 Player",
      email: "m875-player@test.local",
      password: PASSWORD,
    });
    playerCookie = cookie;
  } catch {
    await call("POST", "/auth/login", { email: "m875-player@test.local", password: PASSWORD });
    playerCookie = cookie;
  }
  const player = await call<{ user: { id: string } }>("GET", "/auth/me", undefined, playerCookie);
  cookie = gmCookie;
  log(`gm=${gm.user.id} player=${player.user.id}`);

  const campaignId = (
    await call<{ campaign: { id: string } }>("POST", "/campaigns", {
      name: `M875 Campaign ${SUFFIX}`,
      status: "active",
    })
  ).campaign.id;

  // alpha is created FIRST, so encounter insertion order is [alpha, beta]. beta then rolls the
  // higher initiative, so the committed order is [beta, alpha] and cannot be insertion order.
  const sides: Side[] = [];
  for (const letter of ["alpha", "beta"] as const) {
    const characterId = `m875-${letter}-${SUFFIX}`;
    const name = `M875 ${letter} ${SUFFIX}`;
    const owner = letter === "alpha" ? playerCookie : gmCookie;
    await call("POST", "/characters", characterPayload(characterId, name), owner);
    await call("POST", `/campaigns/${campaignId}/roster`, {
      category: "pc",
      sourceId: characterId,
      sourceType: "character",
    });
    sides.push({
      characterId,
      combatantId: `m875-combatant-${letter}-${SUFFIX}`,
      name,
      scenarioParticipantId: "",
    });
  }

  const scenarioId = (
    await call<{ scenario: { id: string } }>("POST", `/campaigns/${campaignId}/scenarios`, {
      name: `M875 Scenario ${SUFFIX}`,
      status: "live",
    })
  ).scenario.id;

  const existing = await call<{ participants: { characterId?: string; id: string }[] }>(
    "GET",
    `/scenarios/${scenarioId}/participants`,
  );
  for (const side of sides) {
    const already = existing.participants.find((entry) => entry.characterId === side.characterId);
    if (already) {
      side.scenarioParticipantId = already.id;
    } else {
      side.scenarioParticipantId = (
        await call<{ participant: { id: string } }>(
          "POST",
          `/scenarios/${scenarioId}/participants/character`,
          {
            characterId: side.characterId,
            controlledByUserId: side.characterId.includes("alpha") ? player.user.id : gm.user.id,
          },
        )
      ).participant.id;
    }
  }

  const now = new Date().toISOString();
  const encounterId = `m875-encounter-${SUFFIX}`;
  await call("POST", `/scenarios/${scenarioId}/encounters`, {
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
      title: `M875 Combat ${SUFFIX}`,
      updatedAt: now,
    },
  });
  const fetched = await call<{ encounter: { updatedAt: string } }>(
    "GET",
    `/encounters/${encounterId}`,
  );
  await call("PATCH", `/encounters/${encounterId}/status`, {
    expectedRevision: fetched.encounter.updatedAt,
    status: "active",
  });

  // ---- the committed starting state, through the domain's own commands ----
  const active = await call<{ encounter: Record<string, unknown> & { updatedAt: string } }>(
    "GET",
    `/encounters/${encounterId}`,
  );
  let state: CombatRoundState = setCombatRoundCombatExperienceDifficulty({
    difficulty: 1,
    state: initializeCombatRoundState({ encounter: active.encounter as never }),
  });
  sides.forEach((side, index) => {
    state = rollCombatRoundCombatExperience({
      command: { createdAt: new Date(Date.now() + index).toISOString() },
      participantId: side.combatantId,
      rng: () => 0.6,
      skillTotal: 26,
      state,
    }).state;
  });
  sides.forEach((side, index) => {
    const opponent = sides[1 - index]!;
    const phaseContexts = {
      phase1: { targetParticipantId: opponent.combatantId },
      phase2: { targetParticipantId: opponent.combatantId },
    };
    state = recordCombatRoundDeclaration({
      command: {
        createdAt: new Date(Date.now() + 10 + index).toISOString(),
        createdByUserId: gm.user.id,
      },
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
          actionId: "attack_parry",
          participantId: side.combatantId,
          phaseContexts: phaseContexts as never,
          roundNumber: 1,
          sources: {
            phase1: {
              attackModeId: PUNCH_MODE,
              attackType: "melee",
              sourceKind: "unarmed",
              weaponSourceId: PUNCH_SOURCE,
              weaponSourceSlot: "virtual",
              weaponTemplateId: PUNCH_TEMPLATE,
            },
          } as never,
        }),
        id: buildCombatRoundDeclarationId({ participantId: side.combatantId, roundNumber: 1 }),
        phaseContexts: phaseContexts as never,
        roundNumber: 1,
      } as never,
      participantId: side.combatantId,
      state,
      submittedBy: "gm",
    });
  });
  // alpha 4, beta 9 — so the committed order is the reverse of insertion order.
  const TOTALS: Record<string, number> = { alpha: 4, beta: 9 };
  sides.forEach((side, index) => {
    const total = side.characterId.includes("alpha") ? TOTALS.alpha! : TOTALS.beta!;
    const rolls: number[] = [];
    let remaining = total;
    while (remaining > 6) {
      rolls.push(6);
      remaining -= 6;
    }
    rolls.push(remaining);
    state = recordCombatRoundInitiative({
      command: {
        createdAt: new Date(Date.now() + 20 + index).toISOString(),
        createdByUserId: gm.user.id,
      },
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls, rollTotal: total, total },
      participantId: side.combatantId,
      phase: "phase1",
      state,
      submittedBy: "gm",
    });
  });

  await call("PUT", `/encounters/${encounterId}`, {
    expectedRevision: active.encounter.updatedAt,
    session: { ...active.encounter, combatRoundState: state, currentRound: 1, status: "active" },
  });

  const insertionOrder = sides.map((side) => side.combatantId);
  const committedOrder = [sides[1]!.combatantId, sides[0]!.combatantId];
  log(`insertion order  ${JSON.stringify(insertionOrder)}`);
  log(`expected record  ${JSON.stringify(committedOrder)}`);

  // ---- precondition: nothing is recorded before the route is called ----
  const before = await call<{
    encounter: { combatRoundState: CombatRoundState; updatedAt: string };
  }>("GET", `/encounters/${encounterId}`);
  log("");
  log("--- S0: before the commit route is called ---");
  log(
    `records in the API response  ${JSON.stringify(before.encounter.combatRoundState.committedInitiativeOrders)}`,
  );
  check(
    "S0 no record exists before the commit",
    before.encounter.combatRoundState.committedInitiativeOrders,
    [],
  );

  // Where the state lives before the first command route runs is measured, not assumed: a freshly
  // PUT encounter may still be in legacy single-blob storage, with no split active-combat row yet.
  const beforeStorage = psql(
    `select "combatStorageMode" || ' | split-rows=' || (select count(*) from "EncounterActiveCombatState" a where a."encounterId" = e.id) ` +
      `|| ' | session-records=' || coalesce(jsonb_array_length("sessionJson" -> 'combatRoundState' -> 'committedInitiativeOrders')::text, 'absent') ` +
      `from "Encounter" e where e.id = '${encounterId}';`,
  );
  log(`stored state before commit   ${beforeStorage}`);
  check(
    "S0 the stored state carries no record before the commit, wherever it lives",
    beforeStorage.includes("session-records=0") || beforeStorage.includes("session-records=absent"),
    true,
  );

  // ---- S1: the real route writes the record ----
  const task = findCommitTask(before.encounter.combatRoundState);
  if (!task) throw new Error("[probe-875-stack] no commit_phase_initiative_resolution task.");
  const committed = await callRaw(
    "POST",
    `/encounters/${encounterId}/combat-round/commit-phase-initiative-resolution`,
    {
      executionGroupId: task.executionGroupId,
      expectedRevision: before.encounter.updatedAt,
      initiativeGroupId: task.initiativeGroupId,
      initiativeValue: task.initiativeValue,
      phase: "phase1",
      taskId: task.taskId,
    },
  );
  log("");
  log("--- S1: POST /combat-round/commit-phase-initiative-resolution ---");
  log(`status  ${committed.status}`);
  check("S1 the commit route returned 200", committed.status, 200);
  if (committed.status !== 200) log(`     body ${committed.text.slice(0, 600)}`);

  const after = await call<{ encounter: { combatRoundState: CombatRoundState } }>(
    "GET",
    `/encounters/${encounterId}`,
  );
  const record = after.encounter.combatRoundState.committedInitiativeOrders.at(-1);
  log(`record  ${JSON.stringify(record)}`);
  check(
    "S1 the route wrote one record, with the sequence, totals and publication state",
    record?.entries.map((entry) => ({
      participantId: entry.participantId,
      published: entry.initiativePublished,
      total: entry.initiativeResult?.total ?? null,
    })),
    [
      { participantId: sides[1]!.combatantId, published: true, total: 9 },
      { participantId: sides[0]!.combatantId, published: true, total: 4 },
    ],
  );
  check(
    "S1 the record names the phase and round it was committed in",
    [record?.phase, record?.roundNumber],
    ["phase1", 1],
  );

  // ---- S2: PostgreSQL holds it ----
  log("");
  log("--- S2: the row PostgreSQL actually holds ---");
  const storedOrder = psql(
    `select jsonb_agg(entry -> 'participantId') from "EncounterActiveCombatState", ` +
      `jsonb_array_elements(("stateJson" -> 'committedInitiativeOrders' -> -1) -> 'entries') as entry ` +
      `where "encounterId" = '${encounterId}';`,
  );
  const storedCount = psql(
    `select jsonb_array_length("stateJson" -> 'committedInitiativeOrders') from "EncounterActiveCombatState" where "encounterId" = '${encounterId}';`,
  );
  log(`stored record count  ${storedCount}`);
  log(`stored sequence      ${storedOrder}`);
  check("S2 PostgreSQL holds exactly one record", storedCount, "1");
  check(
    "S2 PostgreSQL holds the committed sequence",
    JSON.parse(storedOrder || "null"),
    committedOrder,
  );
  const storedPublished = psql(
    `select jsonb_agg(entry -> 'initiativePublished') from "EncounterActiveCombatState", ` +
      `jsonb_array_elements(("stateJson" -> 'committedInitiativeOrders' -> -1) -> 'entries') as entry ` +
      `where "encounterId" = '${encounterId}';`,
  );
  log(`stored publication   ${storedPublished}`);
  check("S2 PostgreSQL holds the publication state", JSON.parse(storedPublished || "null"), [
    true,
    true,
  ]);

  // ---- S3: the GM's rendered order ----
  log("");
  log("--- S3: the order the GM's progression renders ---");
  const renderedOrder = buildCombatProgressionProjection(after.encounter.combatRoundState)
    .executionOrder?.participantIds;
  log(`rendered order  ${JSON.stringify(renderedOrder)}`);
  check(
    "S3 the GM's progression renders the recorded order",
    [...(renderedOrder ?? [])],
    BREAK === "expect-insertion" ? insertionOrder : committedOrder,
  );

  // ---- S4: the player must not receive the records ----
  log("");
  log("--- S4: the player-facing encounter response ---");
  const playerEncounter = await call<Record<string, unknown>>(
    "GET",
    `/encounters/${encounterId}`,
    undefined,
    playerCookie,
  );
  const playerRoundState = ((playerEncounter.encounter as Record<string, unknown> | undefined)
    ?.combatRoundState ?? {}) as Record<string, unknown>;
  const playerKeys = Object.keys(playerRoundState).sort();
  log(
    `player round-state keys include committedInitiativeOrders: ${playerKeys.includes("committedInitiativeOrders")}`,
  );
  log(
    `raw body contains the field name: ${JSON.stringify(playerEncounter).includes("committedInitiativeOrders")}`,
  );
  check(
    "S4 the player's round state has no committedInitiativeOrders key",
    playerKeys.includes("committedInitiativeOrders"),
    false,
  );
  check(
    "S4 the whole player response body never mentions the field",
    JSON.stringify(playerEncounter).includes("committedInitiativeOrders"),
    false,
  );
  check(
    "S4 the player response really is a round state (so the check above is not vacuous)",
    playerKeys.includes("participants") && playerKeys.includes("roundNumber"),
    true,
  );

  // ---- S5: the record survives into the archived round ----
  log("");
  log("--- S5: the archived round after the round boundary ---");
  const archived = psql(
    `select count(*) from "EncounterArchivedCombatRound" where "encounterId" = '${encounterId}';`,
  );
  const storageAfter = psql(
    `select "combatStorageMode" from "Encounter" where id = '${encounterId}';`,
  );
  log(`storage mode after commit  ${storageAfter}`);
  log(
    `archived rounds so far     ${archived} (this probe does not drive a round boundary over HTTP)`,
  );
  log("S5 NOT MEASURED HERE. The archived-round carry is covered only by the in-process probe.");

  log("");
  log(`checks failed: ${failures}`);
  log(failures === 0 ? "VERDICT: all checks passed" : "VERDICT: FAILED");
}

main()
  .then(() => {
    flush();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((error) => {
    log(`ERROR ${String(error)}`);
    flush();
    process.exit(1);
  });
