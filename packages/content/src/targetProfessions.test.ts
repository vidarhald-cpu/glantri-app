import { describe, expect, it } from "vitest";
import { targetProfessionSource } from "./targetProfessionSource";
import { readFileSync } from "node:fs";
import {
  targetProfessionCatalogue,
  TARGET_PROFESSION_SOURCE_DIGEST,
  withTargetLearningGroupsAndProfessions,
} from "./targetProfessions";
import { sha256 } from "./integrity/canonicalSha256";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyProjectionSource,
  getTargetProgressionValidationErrors,
} from "./targetCompetencies";
import { defaultCanonicalContent } from "./seeds/defaultContent";
import { characterProgressionSchema } from "@glantri/domain";
describe("approved target Profession projection", () => {
  it("verifies the exact source, inventories and all public foreign keys", () => {
    const root = new URL("../../../docs/source/professions/", import.meta.url);
    const provenance = JSON.parse(
      readFileSync(new URL("profession-source-provenance.json", root), "utf8"),
    );
    const original = Buffer.from(
      readFileSync(new URL(provenance.archiveFile, root), "utf8"),
      "base64",
    );
    const normalized = readFileSync(new URL(provenance.readableFile, root), "utf8");
    expect(original.equals(Buffer.from(targetProfessionSource, "utf8"))).toBe(true);
    expect(sha256(original.toString("utf8"))).toBe(TARGET_PROFESSION_SOURCE_DIGEST);
    expect(provenance.originalSha256).toBe(TARGET_PROFESSION_SOURCE_DIGEST);
    expect(sha256(normalized)).toBe(provenance.normalizedSha256);
    expect(normalized).toBe(targetProfessionSource.replace(/[ \t]+$/gm, ""));
    expect(targetProfessionCatalogue.families).toHaveLength(84);
    expect(targetProfessionCatalogue.opportunities).toHaveLength(203);
    expect(targetProfessionCatalogue.families.flatMap((f) => f.tracks)).toHaveLength(21);
    const content = withTargetLearningGroupsAndProfessions(
      buildTargetRuntimeContent(createTargetCompetencyProjectionSource(defaultCanonicalContent)),
    );
    expect(content.skillGroups).toHaveLength(59);
    expect(content.skillGroups.flatMap((g) => g.skillMemberships ?? [])).toHaveLength(151);
    expect(content.skillGroups.flatMap((g) => g.specializationIds ?? [])).toHaveLength(9);
    expect(targetProfessionCatalogue.manifest.digest).toBe(
      "sha256:11fb66385c82db84ca1097ee8be63638d5bf64470795e100f8eb93040e648a48",
    );
  });
  it("retains additive P01 and distinct archer and longbow packages", () => {
    const hunter = targetProfessionCatalogue.families.find((f) => f.code === "P01")!;
    expect(hunter.tracks).toHaveLength(0);
    expect(hunter.opportunities).toHaveLength(5);
    const soldier = targetProfessionCatalogue.families.find((f) => f.code === "P22")!;
    const archer = soldier.tracks.find((t) => t.name === "Military archer")!;
    expect(archer.opportunityIds).toEqual([
      "P22-LG-F36",
      "P22-LG-F38",
      "P22-D-combat_experience",
      "P22-D-battlefield_awareness",
    ]);
    expect(
      soldier.tracks.find((t) => t.name === "Military longbow specialist")!.opportunityIds,
    ).toContain("P22-D-longbow");
  });
  it("keeps both authenticated competency metadata generations readable", () => {
    const old = buildTargetRuntimeContent(
      createTargetCompetencyProjectionSource(defaultCanonicalContent),
    );
    const current = withTargetLearningGroupsAndProfessions(old);
    for (const c of [old, current]) {
      const s = c.skills.find((s) => s.id === "bow")!;
      const p = characterProgressionSchema.parse({
        skills: [{ skillId: s.id, targetDefinition: s, groupId: s.groupId, groupIds: s.groupIds }],
      });
      expect(getTargetProgressionValidationErrors(p)).toEqual([]);
    }
  });
});
