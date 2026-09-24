import { LocalCharacterRepository } from "../../lib/offline/repositories/localCharacterRepository";
import { localDb } from "../../lib/offline/glantriDexie";
import { characterBuildSchema } from "@glantri/domain";
import { describe, expect, it } from "vitest";
import { defaultCanonicalContent, getApprovedV2RuntimeContent } from "@glantri/content";
import {
  allocateChargenPoint,
  createChargenProgression,
  buildCharacterSheetSummary,
  finalizeChargenDraft,
} from "@glantri/rules-engine";
import { characterPayload } from "../../../e2e/character-fixture";
import { ChargenSessionRepository } from "../../lib/offline/repositories/chargenSessionRepository";
import { buildCharacterSheetSkillRows } from "../../lib/characters/characterSheet";

describe("synthetic target and historical Chargen drafts", () => {
  it("round-trips target selection/spend and preserves a non-equivalent historical draft", async () => {
    const repository = new ChargenSessionRepository();
    const targetOwnerId = "issue206-synthetic-target-owner";
    const legacyOwnerId = "issue206-synthetic-historical-owner";
    const targetId = "issue206-synthetic-target-character";
    const legacyId = "issue206-synthetic-historical-character";
    const legacy = characterBuildSchema.parse(
      characterPayload(legacyId, "Historical synthetic").build,
    );
    const content = getApprovedV2RuntimeContent();
    const bought = allocateChargenPoint({
      content,
      professionId: "profession:soldier",
      societyId: "pastoral_clan_nomadic",
      societyLevel: 1,
      progression: createChargenProgression(),
      targetType: "group",
      targetId: "F41",
    });
    expect(bought.error).toBeUndefined();
    const finalized = finalizeChargenDraft({
      content,
      professionId: "profession:soldier",
      societyId: "pastoral_clan_nomadic",
      societyLevel: 1,
      profile: legacy.profile,
      progression: bought.progression,
      name: "Synthetic soldier",
    });
    expect(finalized.errors).toEqual([]);
    expect(finalized.build?.targetChargen?.sourceDigest).toBe(
      content.chargenCatalogue?.professionSourceDigest,
    );
    try {
      await repository.save({
        ownerId: targetOwnerId,
        characterName: "Synthetic archer",
        selectedProfile: legacy.profile,
        rolledProfiles: [legacy.profile],
        selectedProfessionId: "profession:soldier",
        progression: bought.progression,
      });
      const characters = new LocalCharacterRepository();
      const targetBuild = { ...finalized.build!, id: targetId };
      await characters.save({ build: targetBuild });
      await expect(
        characters.save({ build: { ...targetBuild, professionId: "profession:soldier:forged" } }),
      ).rejects.toThrow("Unknown target Profession");
      await expect(
        characters.save({
          build: { ...targetBuild, progression: { ...bought.progression, primaryPoolSpent: 0 } },
        }),
      ).rejects.toThrow("authoritative purchase prices");
      expect((await characters.get(targetId))?.build.progression).toEqual(targetBuild.progression);
      const loaded = await repository.getForOwner(targetOwnerId);
      expect(loaded?.selectedProfessionId).toBe("profession:soldier");
      expect(loaded?.progression).toEqual(bought.progression);
      expect(loaded?.progression.skillGroups[0].targetDefinition?.name).toBe(
        "Longbow hunting apprenticeship",
      );
      const group = defaultCanonicalContent.skillGroups.find(
        (g) => !content.chargenCatalogue!.groupIds!.includes(g.id),
      )!;
      const progression = {
        ...legacy.progression,
        primaryPoolSpent: 17,
        secondaryPoolSpent: 9,
        skillGroups: [
          {
            groupId: group.id,
            ranks: 3,
            primaryRanks: 3,
            secondaryRanks: 0,
            grantedRanks: 0,
            gms: 0,
          },
        ],
      };
      await repository.save({
        ownerId: legacyOwnerId,
        selectedProfile: legacy.profile,
        selectedProfessionId: defaultCanonicalContent.professions[0].id,
        progression,
      });
      const historical = await repository.getForOwner(legacyOwnerId);
      expect(historical?.progression).toEqual(progression);
      expect(content.skillGroups.some((g) => g.id === group.id)).toBe(false);
      expect(
        defaultCanonicalContent.skillGroups.find(
          (g) => g.id === historical?.progression.skillGroups[0].groupId,
        )?.name,
      ).toBe(group.name);
      const before = JSON.stringify(legacy);
      buildCharacterSheetSkillRows({
        build: legacy,
        content: defaultCanonicalContent,
        sheetSummary: buildCharacterSheetSummary({
          build: legacy,
          content: defaultCanonicalContent,
        }),
      });
      expect(JSON.stringify(legacy)).toBe(before);
    } finally {
      await localDb.localCharacters.delete(targetId);
      await repository.deleteForOwner(targetOwnerId);
      await repository.deleteForOwner(legacyOwnerId);
    }
  });
});
