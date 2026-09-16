import { afterAll, describe, expect, it } from "vitest";
import { AuthService, prisma } from "@glantri/database";
import { createTestCharacter, createTestUser } from "@glantri/database/testing";
import { createPrismaCharacterRepository } from "@glantri/database/repositories/characterRepository";
import { getApprovedTargetDefinitions } from "@glantri/content";
import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";
import { buildApiServer } from "../app";
import { SESSION_COOKIE_NAME } from "../lib/sessionAuth";

const enabled = Boolean(
  process.env.DATABASE_URL_TEST &&
  process.env.DATABASE_URL &&
  (process.env.GLANTRI_DB_MODE === "task" ||
    process.env.DATABASE_URL === process.env.DATABASE_URL_TEST),
);
const ownedUserIds: string[] = [];
afterAll(async () => {
  if (!enabled) return;
  await prisma.character.deleteMany({ where: { ownerId: { in: ownedUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ownedUserIds } } });
});

describe.skipIf(!enabled)("approved target metadata API/PG boundary", () => {
  it("rejects consistently forged POST/PUT definitions, protects repository reads, and preserves valid and legacy builds", async () => {
    const owner = await createTestUser(prisma);
    ownedUserIds.push(owner.id);
    const seed = await createTestCharacter(prisma, owner.id);
    const base = characterBuildSchema.parse(
      (await prisma.character.findUniqueOrThrow({ where: { id: seed.id } })).build,
    );
    const definitions = getApprovedTargetDefinitions();
    const surgery = definitions.skills.find(({ id }) => id === "skill:surgery")!;
    const spoken = definitions.skills.find(
      (skill) => "competencyType" in skill && skill.competencyType === "spoken-language",
    )!;
    const written = definitions.skills.find(
      (skill) => "competencyType" in skill && skill.competencyType === "written-tradition",
    )!;
    const training = definitions.specializations.find(({ id }) => id === "spec:animal-training")!;
    const build = characterBuildSchema.parse({
      ...base,
      id: crypto.randomUUID(),
      progression: {
        ...base.progression,
        skills: [surgery, spoken, written].map((definition) => ({
          skillId: definition.id,
          targetDefinition: definition,
          secondaryRanks: 1,
          ranks: 1,
        })),
        specializations: [
          {
            specializationId: training.id,
            skillId: training.skillId,
            targetDefinition: training,
            secondaryRanks: 1,
            ranks: 1,
          },
        ],
      },
    });
    const cookie = `${SESSION_COOKIE_NAME}=${(await new AuthService().createSessionForUser(owner.id)).token}`;
    const app = buildApiServer();
    const repository = createPrismaCharacterRepository(prisma);
    try {
      const valid = await app.inject({
        method: "POST",
        url: "/characters/",
        headers: { cookie },
        payload: { build },
      });
      expect(valid.statusCode).toBe(200);
      expect((await repository.findOwnedById(owner.id, build.id))?.build).toEqual(build);
      expect(
        (await app.inject({ method: "GET", url: `/characters/${seed.id}`, headers: { cookie } }))
          .statusCode,
      ).toBe(200);
      const revision = valid.json().character.updatedAt;
      const mutations: Array<[string, (candidate: CharacterBuild) => void]> = [
        [
          "legacy Literacy",
          (b) => {
            b.progression.skills[0].skillId = "literacy";
            b.progression.skills[0].targetDefinition!.id = "literacy";
          },
        ],
        [
          "unknown identity",
          (b) => {
            b.progression.skills[0].skillId = "invented-competency";
            b.progression.skills[0].targetDefinition!.id = "invented-competency";
          },
        ],
        [
          "type",
          (b) => {
            b.progression.skills[0].targetDefinition!.competencyType = "written-tradition";
          },
        ],
        [
          "stats",
          (b) => {
            b.progression.skills[0].targetDefinition!.linkedStats = ["str", "str"];
          },
        ],
        [
          "name",
          (b) => {
            b.progression.skills[0].targetDefinition!.name = "Caller supplied";
          },
        ],
        [
          "parent",
          (b) => {
            b.progression.specializations[0].skillId = surgery.id;
            b.progression.specializations[0].targetDefinition!.skillId = surgery.id;
          },
        ],
        [
          "threshold",
          (b) => {
            b.progression.specializations[0].targetDefinition!.minimumParentLevel = 0;
          },
        ],
        [
          "specialization stats",
          (b) => {
            b.progression.specializations[0].targetDefinition!.linkedStats = ["str", "str"];
          },
        ],
      ];
      for (const [label, mutate] of mutations) {
        const forged = structuredClone(build);
        mutate(forged);
        forged.id = crypto.randomUUID();
        const post = await app.inject({
          method: "POST",
          url: "/characters/",
          headers: { cookie },
          payload: { build: forged },
        });
        expect(post.statusCode, label).toBe(400);
        expect(await prisma.character.findUnique({ where: { id: forged.id } }), label).toBeNull();
        await expect(
          repository.createOwned({
            id: forged.id,
            name: forged.name,
            ownerId: owner.id,
            build: forged,
          }),
          label,
        ).rejects.toThrow("approved target");
        forged.id = build.id;
        const put = await app.inject({
          method: "PUT",
          url: `/characters/${build.id}`,
          headers: { cookie },
          payload: { build: forged, expectedUpdatedAt: revision },
        });
        expect(put.statusCode, label).toBe(400);
        expect((await repository.findById(build.id))?.build, label).toEqual(build);
      }
      // Simulate pre-existing malformed persisted data; readers fail closed, without repair.
      const forged = structuredClone(build);
      forged.progression.skills[0].targetDefinition!.linkedStats = ["str", "str"];
      await prisma.character.update({
        where: { id: build.id },
        data: { build: JSON.parse(JSON.stringify(forged)) },
      });
      await expect(repository.findById(build.id)).rejects.toThrow("approved target");
      const corruptRead = await app.inject({
        method: "GET",
        url: `/characters/${build.id}`,
        headers: { cookie },
      });
      expect(corruptRead.statusCode).toBe(500);
      expect(corruptRead.body).not.toContain("targetDefinition");
    } finally {
      await app.close();
    }
  });
});
