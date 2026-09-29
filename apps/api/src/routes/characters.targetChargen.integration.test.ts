import { afterAll, describe, expect, it } from "vitest";
import { AuthService, prisma } from "@glantri/database";
import { createTestCharacter, createTestUser } from "@glantri/database/testing";
import { getApprovedV2RuntimeContent } from "@glantri/content";
import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";
import {
  allocateChargenPoint,
  createChargenProgression,
  finalizeChargenDraft,
  validateTargetChargenBuild,
} from "@glantri/rules-engine";
import { buildApiServer } from "../app";
import { SESSION_COOKIE_NAME } from "../lib/sessionAuth";

/*
 * Forgejo #404. Two rules govern this file.
 *
 * 1. It reads the canonical V2 runtime projection `getApprovedV2RuntimeContent()` — 95 Learning
 *    Groups, 86 Profession paths — because that is the catalogue `CharacterService` validates
 *    submitted builds against. The legacy 59-group projection, whose accessor was retired in
 *    Forgejo #387, and the `profession:soldier:military-archer` / `F38` fixture that lived only in
 *    it, must never come back here: that Profession path does not exist in the projection the
 *    product serves, so the fixture could not round-trip even with a database.
 * 2. It never disappears silently. The catalogue-bound half runs in the ordinary suite with no
 *    database at all, so drift in the V2 projection fails `pnpm test`. The database-backed half
 *    needs a disposable task database; when it cannot run it says so by name in the reporter and
 *    on the console, and a half-configured task environment is a reported failure, not a skip.
 */

const content = getApprovedV2RuntimeContent();

/** The V2 successor of the retired legacy archer fixture: Soldier on the issued-missile route. */
const ARCHER = {
  coreRouteId: "profession:soldier:core:missile",
  directSkillId: "bow",
  groupId: "M04",
  groupName: "Military missile and formation practice",
  professionId: "profession:soldier",
  /** `crossbow` receives a derived relationship grant once `bow` is purchased directly. */
  relationshipSkillId: "crossbow",
  slotId: "missile-family",
  slots: [{ groupId: "M04", selectedSkillIds: ["bow"], slotId: "missile-family" }],
  societyId: "pastoral_clan_nomadic",
};

/**
 * The V2 projection carries no `exclusiveLearningGroupPairs`: mutually alternative Profession
 * training is expressed as core routes, and `profession:soldier` and `profession:courier` are the
 * only paths offering more than one. Submitting two routes' Learning Groups while recording a
 * single route's price is the forgery the retired catalogue expressed as an exclusive pair.
 */
const MULTI_ROUTE_PROFESSIONS = [
  {
    professionId: "profession:soldier",
    routes: [
      {
        coreRouteId: "profession:soldier:core:missile",
        groupId: "M04",
        slots: [{ groupId: "M04", selectedSkillIds: ["bow"], slotId: "missile-family" }],
      },
      {
        coreRouteId: "profession:soldier:core:formation",
        groupId: "M03",
        slots: [
          {
            groupId: "M03",
            selectedSkillIds: ["one_handed_edged", "polearms"],
            slotId: "formation-arms",
          },
        ],
      },
    ],
  },
  {
    professionId: "profession:courier",
    routes: [
      { coreRouteId: "profession:courier:core:foot", groupId: "F04", slots: [] },
      { coreRouteId: "profession:courier:core:mounted", groupId: "G05", slots: [] },
    ],
  },
];

const FORGED_GROUP_ID = "M03";

/** Forgeries of trusted metadata and recorded cost, with the server error each one must raise. */
const FORGERIES: Array<{
  expected: string;
  mutate: (build: CharacterBuild) => void;
  name: string;
}> = [
  {
    expected: "Profession family, track or source metadata does not match the approved package.",
    mutate: (b) => {
      b.targetChargen!.familyId = "profession:hunter-trapper";
    },
    name: "forged Profession family",
  },
  {
    expected: "Unknown target Profession or track.",
    mutate: (b) => {
      b.professionId = "profession:soldier:invented";
    },
    name: "invented Profession path",
  },
  {
    expected: "Recorded Chargen spending does not match authoritative purchase prices.",
    mutate: (b) => {
      b.progression.primaryPoolSpent = 0;
    },
    name: "understated primary spend",
  },
  {
    expected: `Forged Learning Group metadata: ${FORGED_GROUP_ID}.`,
    mutate: (b) => {
      b.progression.skillGroups[0].groupId = FORGED_GROUP_ID;
    },
    name: "Learning Group identity swapped under approved metadata",
  },
  {
    expected: `Forged Learning Group metadata: ${ARCHER.groupId}.`,
    mutate: (b) => {
      b.progression.skillGroups[0].targetDefinition!.skillMemberships = [];
    },
    name: "emptied Learning Group memberships",
  },
];

function routeProgression(route: { coreRouteId: string; slots: unknown[] }) {
  return {
    ...createChargenProgression(),
    chargenSelections: {
      selectedCoreRouteId: route.coreRouteId,
      selectedGroupSlots: structuredClone(route.slots),
      selectedLanguageIds: [],
      selectedSkillIds: [],
    },
  } as ReturnType<typeof createChargenProgression>;
}

function purchaseRoute(
  professionId: string,
  route: { coreRouteId: string; groupId: string; slots: unknown[] },
) {
  return allocateChargenPoint({
    content,
    professionId,
    progression: routeProgression(route),
    societyId: ARCHER.societyId,
    societyLevel: 1,
    targetId: route.groupId,
    targetType: "group",
  });
}

/** The approved archer purchase and its finalized build. */
function buildArcherFixture(profile: CharacterBuild["profile"]) {
  const context = {
    content,
    professionId: ARCHER.professionId,
    profile,
    societyId: ARCHER.societyId,
    societyLevel: 1,
  };
  const purchase = purchaseRoute(ARCHER.professionId, ARCHER);
  expect(purchase.error).toBeUndefined();
  const result = finalizeChargenDraft({
    ...context,
    name: "Synthetic target archer",
    progression: purchase.progression,
  });
  expect(result.errors).toEqual([]);
  return { build: result.build!, context, purchase };
}

const SYNTHETIC_PROFILE = {
  distractionLevel: 2,
  id: "issue404-synthetic",
  label: "Synthetic",
  rolledStats: {
    cha: 10,
    com: 10,
    con: 10,
    dex: 10,
    health: 10,
    int: 10,
    lck: 10,
    pow: 10,
    siz: 10,
    str: 10,
    will: 10,
  },
} as unknown as CharacterBuild["profile"];

const databaseUrlTest = process.env.DATABASE_URL_TEST;
const taskMode = process.env.GLANTRI_DB_MODE === "task";
const enabled = Boolean(databaseUrlTest && taskMode);
const partialConfiguration =
  !enabled && (databaseUrlTest || taskMode)
    ? `Half-configured task database: DATABASE_URL_TEST is ${databaseUrlTest ? "set" : "absent"}, GLANTRI_DB_MODE=task is ${taskMode ? "set" : "absent"}.`
    : "coherent";
const SKIP_REASON =
  "requires a disposable task database (pnpm db:task:setup; pnpm db:task:migrate; pnpm db:task:exec -- pnpm --filter @glantri/api test)";

describe("combined target Chargen authority against the V2 runtime projection", () => {
  it("states explicitly whether the database-backed half runs, and never half-configures it", () => {
    expect(partialConfiguration).toBe("coherent");
    if (!enabled)
      console.warn(
        `[#404] NOT RUN: the database-backed combined target Chargen API authority suite ${SKIP_REASON}. The catalogue-bound assertions in this file did run.`,
      );
  });

  it("pins the fixture to identifiers the V2 runtime projection actually contains", () => {
    const path = content.competencyV2!.paths.find((row) => row.id === ARCHER.professionId);
    expect(path, ARCHER.professionId).toBeDefined();
    expect(path!.coreRoutes.map((route) => route.id)).toContain(ARCHER.coreRouteId);
    const group = content.skillGroups.find((row) => row.id === ARCHER.groupId);
    expect(group, ARCHER.groupId).toBeDefined();
    expect(group!.name).toBe(ARCHER.groupName);
    expect(
      group!.selectionSlots?.find((slot) => slot.id === ARCHER.slotId)?.candidateSkillIds,
    ).toContain(ARCHER.directSkillId);
    // The retired legacy fixture must not creep back in through the V2 accessor.
    expect(content.professions.map((row) => row.id)).not.toContain(
      "profession:soldier:military-archer",
    );
    expect(content.skillGroups.map((row) => row.id)).not.toContain("F38");
    for (const { professionId, routes } of MULTI_ROUTE_PROFESSIONS) {
      const multi = content.competencyV2!.paths.find((row) => row.id === professionId)!;
      expect(multi, professionId).toBeDefined();
      expect(multi.coreRoutes.length, professionId).toBeGreaterThan(1);
      for (const route of routes)
        expect(
          multi.coreRoutes.map((row) => row.id),
          professionId,
        ).toContain(route.coreRouteId);
    }
  });

  it("accepts the approved archer build and refuses every forged progression without a database", () => {
    const { build } = buildArcherFixture(SYNTHETIC_PROFILE);
    expect(build.progression.skillGroups[0].targetDefinition!.name).toBe(ARCHER.groupName);
    expect(validateTargetChargenBuild(build, content)).toEqual([]);
    for (const { expected, mutate, name } of FORGERIES) {
      const forged = structuredClone(build);
      forged.id = crypto.randomUUID();
      mutate(forged);
      expect(validateTargetChargenBuild(forged, content), name).toContain(expected);
    }
    for (const { professionId, routes } of MULTI_ROUTE_PROFESSIONS) {
      const purchases = routes.map((route) => {
        const purchase = purchaseRoute(professionId, route);
        expect(purchase.error, `${professionId}/${route.groupId}`).toBeUndefined();
        return purchase;
      });
      for (const ordered of [purchases, [...purchases].reverse()]) {
        const forged = characterBuildSchema.parse({
          ...build,
          id: crypto.randomUUID(),
          professionId,
          progression: {
            ...ordered[0].progression,
            primaryPoolSpent:
              ordered[0].progression.primaryPoolSpent + ordered[1].progression.primaryPoolSpent,
            skillGroups: ordered.flatMap((route) => route.progression.skillGroups),
          },
        });
        expect(validateTargetChargenBuild(forged, content), professionId).toContain(
          "Recorded Chargen spending does not match authoritative purchase prices.",
        );
      }
    }
  });
});

const users: string[] = [];
afterAll(async () => {
  if (!enabled) return;
  await prisma.character.deleteMany({ where: { ownerId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe.skipIf(!enabled)(
  enabled
    ? "combined target Chargen API authority"
    : `combined target Chargen API authority — NOT RUN: ${SKIP_REASON}`,
  () => {
    it("round-trips trusted family/track/group metadata, rejects forged access/cost, and protects ownership", async () => {
      const owner = await createTestUser(prisma);
      users.push(owner.id);
      const stranger = await createTestUser(prisma);
      users.push(stranger.id);
      const ordinaryStranger = await createTestUser(prisma);
      users.push(ordinaryStranger.id);
      const adminRole = await prisma.role.upsert({
        where: { name: "admin" },
        create: { name: "admin" },
        update: {},
      });
      await prisma.userRole.create({ data: { userId: stranger.id, roleId: adminRole.id } });
      const seed = await createTestCharacter(prisma, owner.id);
      const base = characterBuildSchema.parse(
        (await prisma.character.findUniqueOrThrow({ where: { id: seed.id } })).build,
      );
      const { build, context, purchase } = buildArcherFixture(base.profile);
      const auth = new AuthService();
      const cookie = `${SESSION_COOKIE_NAME}=${(await auth.createSessionForUser(owner.id)).token}`;
      const ordinaryCookie = `${SESSION_COOKIE_NAME}=${(await auth.createSessionForUser(ordinaryStranger.id)).token}`;
      const unrelated = `${SESSION_COOKIE_NAME}=${(await auth.createSessionForUser(stranger.id)).token}`;
      const app = buildApiServer();
      try {
        const saved = await app.inject({
          method: "POST",
          url: "/characters/",
          headers: { cookie },
          payload: { build },
        });
        expect(saved.statusCode, saved.body).toBe(200);
        const read = await app.inject({
          method: "GET",
          url: `/characters/${build.id}`,
          headers: { cookie },
        });
        expect(read.statusCode).toBe(200);
        expect(read.json().character.build.targetChargen).toEqual(build.targetChargen);
        expect(read.json().character.build.progression.skillGroups[0].targetDefinition.name).toBe(
          ARCHER.groupName,
        );
        const ordinaryDenied = await app.inject({
          method: "GET",
          url: `/characters/${build.id}`,
          headers: { cookie: ordinaryCookie },
        });
        expect([403, 404]).toContain(ordinaryDenied.statusCode);
        expect(ordinaryDenied.body).not.toContain("Synthetic target archer");
        const adminRead = await app.inject({
          method: "GET",
          url: `/characters/${build.id}`,
          headers: { cookie: unrelated },
        });
        for (const { mutate, name } of FORGERIES) {
          const b = structuredClone(build);
          b.id = crypto.randomUUID();
          mutate(b);
          const bad = await app.inject({
            method: "POST",
            url: "/characters/",
            headers: { cookie },
            payload: { build: b },
          });
          expect(bad.statusCode, `${name}: ${bad.body}`).toBe(400);
          expect(await prisma.character.findUnique({ where: { id: b.id } })).toBeNull();
        }
        for (const { professionId, routes } of MULTI_ROUTE_PROFESSIONS) {
          const purchases = routes.map((route) => purchaseRoute(professionId, route));
          for (const route of purchases) {
            const individual = finalizeChargenDraft({
              content,
              name: "Synthetic individual route",
              professionId,
              profile: base.profile,
              progression: route.progression,
              societyId: ARCHER.societyId,
              societyLevel: 1,
            });
            expect(individual.errors).toEqual([]);
            const response = await app.inject({
              method: "POST",
              url: "/characters/",
              headers: { cookie },
              payload: { build: individual.build },
            });
            expect(response.statusCode, response.body).toBe(200);
          }
          for (const ordered of [purchases, [...purchases].reverse()]) {
            const forged = characterBuildSchema.parse({
              ...build,
              id: crypto.randomUUID(),
              professionId,
              progression: {
                ...ordered[0].progression,
                primaryPoolSpent:
                  ordered[0].progression.primaryPoolSpent + ordered[1].progression.primaryPoolSpent,
                skillGroups: ordered.flatMap((r) => r.progression.skillGroups),
              },
            });
            const response = await app.inject({
              method: "POST",
              url: "/characters/",
              headers: { cookie },
              payload: { build: forged },
            });
            expect(response.statusCode, response.body).toBe(400);
            expect(response.body).toContain("authoritative purchase prices");
            expect(await prisma.character.findUnique({ where: { id: forged.id } })).toBeNull();
          }
        }
        const directBow = allocateChargenPoint({
          ...context,
          progression: purchase.progression,
          targetId: ARCHER.directSkillId,
          targetType: "skill",
        });
        const overlap = finalizeChargenDraft({
          ...context,
          progression: directBow.progression,
          name: "Synthetic group and direct overlap",
        });
        expect(overlap.errors).toEqual([]);
        const overlapSave = await app.inject({
          method: "POST",
          url: "/characters/",
          headers: { cookie },
          payload: { build: overlap.build },
        });
        expect(overlapSave.statusCode, overlapSave.body).toBe(200);
        const excessive = structuredClone(overlap.build!);
        excessive.id = crypto.randomUUID();
        const granted = excessive.progression.skills.find(
          (s) => s.skillId === ARCHER.relationshipSkillId,
        )!;
        expect(granted.relationshipGrantedRanks).toBe(1);
        granted.relationshipGrantedRanks = 99;
        granted.ranks = 99;
        const excessiveSave = await app.inject({
          method: "POST",
          url: "/characters/",
          headers: { cookie },
          payload: { build: excessive },
        });
        expect(excessiveSave.statusCode).toBe(400);
        expect(excessiveSave.body).toContain("Invalid derived relationship grant");
        expect(await prisma.character.findUnique({ where: { id: excessive.id } })).toBeNull();
        const headless = { ...build, id: crypto.randomUUID() };
        const headlessResult = await app.inject({
          method: "POST",
          url: "/chargen/headless/finalize",
          headers: { cookie },
          payload: {
            build: headless,
            configuration: { flexBudget: 26, formationBudget: 60, id: "target-206" },
            idempotencyKey: `target-${headless.id}`,
            pilotCharacterId: "character:pilot:glantrian-retainer-veteran",
          },
        });
        expect(headlessResult.statusCode, headlessResult.body).toBe(200);
        expect(
          characterBuildSchema.parse(
            (await prisma.character.findUniqueOrThrow({ where: { id: headless.id } })).build,
          ).targetChargen,
        ).toEqual(build.targetChargen);
        // PO ruling 6073 preserves baseline global Admin reads; #207 owns reconsideration.
        expect(adminRead.statusCode).toBe(200);
        expect(adminRead.json().character.build).toEqual(read.json().character.build);
      } finally {
        await app.close();
      }
    });
  },
);
