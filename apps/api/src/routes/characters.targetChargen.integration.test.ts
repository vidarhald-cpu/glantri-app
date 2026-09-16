import { afterAll, describe, expect, it } from "vitest";
import { AuthService, prisma } from "@glantri/database";
import { createTestCharacter, createTestUser } from "@glantri/database/testing";
import { getApprovedTargetChargenContent } from "@glantri/content";
import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";
import {
  allocateChargenPoint,
  createChargenProgression,
  finalizeChargenDraft,
} from "@glantri/rules-engine";
import { buildApiServer } from "../app";
import { SESSION_COOKIE_NAME } from "../lib/sessionAuth";
const enabled = Boolean(process.env.DATABASE_URL_TEST && process.env.GLANTRI_DB_MODE === "task");
const users: string[] = [];
afterAll(async () => {
  if (!enabled) return;
  await prisma.character.deleteMany({ where: { ownerId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});
describe.skipIf(!enabled)("combined target Chargen API authority", () => {
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
    const content = getApprovedTargetChargenContent();
    const context = {
      content,
      professionId: "profession:soldier:military-archer",
      societyLevel: 1,
      profile: base.profile,
    };
    const purchase = allocateChargenPoint({
      ...context,
      progression: createChargenProgression(),
      targetId: "F38",
      targetType: "group",
    });
    expect(purchase.error).toBeUndefined();
    const result = finalizeChargenDraft({
      ...context,
      progression: purchase.progression,
      name: "Synthetic target archer",
    });
    expect(result.errors).toEqual([]);
    const build = result.build!;
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
        "Military bow and formation practice",
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
      const mutations: Array<(b: CharacterBuild) => void> = [
        (b) => {
          b.targetChargen!.familyId = "profession:hunter-trapper";
        },
        (b) => {
          b.professionId = "profession:soldier:invented";
        },
        (b) => {
          b.progression.primaryPoolSpent = 0;
        },
        (b) => {
          b.progression.skillGroups[0].groupId = "F39";
        },
        (b) => {
          b.progression.skillGroups[0].targetDefinition!.skillMemberships = [];
        },
      ];
      for (const mutate of mutations) {
        const b = structuredClone(build);
        b.id = crypto.randomUUID();
        mutate(b);
        const bad = await app.inject({
          method: "POST",
          url: "/characters/",
          headers: { cookie },
          payload: { build: b },
        });
        expect(bad.statusCode, bad.body).toBe(400);
        expect(await prisma.character.findUnique({ where: { id: b.id } })).toBeNull();
      }
      for (const [professionId, a, b] of [
        ["profession:sailor", "F09", "G06"],
        ["profession:guard-escort", "F30", "G08"],
      ]) {
        const routeContext = { ...context, professionId };
        const routes = [a, b].map((targetId) =>
          allocateChargenPoint({
            ...routeContext,
            progression: createChargenProgression(),
            targetId,
            targetType: "group",
          }),
        );
        for (const route of routes) {
          const individual = finalizeChargenDraft({
            ...routeContext,
            progression: route.progression,
            name: "Synthetic individual route",
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
        for (const ordered of [routes, [...routes].reverse()]) {
          const forged = characterBuildSchema.parse({
            ...base,
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
          expect(response.body).toContain("alternative training routes");
          expect(await prisma.character.findUnique({ where: { id: forged.id } })).toBeNull();
        }
      }
      const directBow = allocateChargenPoint({
        ...context,
        progression: purchase.progression,
        targetId: "bow",
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
      const crossbow = excessive.progression.skills.find((s) => s.skillId === "crossbow")!;
      expect(crossbow.relationshipGrantedRanks).toBe(1);
      crossbow.relationshipGrantedRanks = 99;
      crossbow.ranks = 99;
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
});
