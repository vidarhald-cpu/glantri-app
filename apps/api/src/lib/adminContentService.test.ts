import { describe, expect, it } from "vitest";

import { CanonicalContentService } from "./adminContentService";

describe("admin content service", () => {
  it("projects reference data as canonical-only for admin Skill Reference", async () => {
    const service = new CanonicalContentService();
    const snapshot = await service.getSkillReference();

    expect(snapshot.candidate).toBeNull();
    expect(snapshot.canonical.status).toBe("canonical");
    expect(snapshot.canonical.records.competencies.length).toBeGreaterThan(0);
    expect(snapshot.canonical.records.scripts.length).toBeGreaterThan(0);
    expect(snapshot.canonical.records.relationships.length).toBeGreaterThan(0);
    expect(snapshot.canonical.records.domains.length).toBeGreaterThan(0);
  });

  it("emits immutable canonical projection metadata for provenance and digest review", async () => {
    const service = new CanonicalContentService();
    const snapshot = await service.getSkillReference();

    expect(snapshot.canonical.title.toLowerCase()).toContain("pilot");
    expect(snapshot.canonical.compatibility.characterMigrationReviewRequired).toBe(false);
    expect(snapshot.canonical.compatibility.classification).toBe("presentation-only");
    expect(snapshot.canonical.manifest.packageDigest).toContain("sha256:");
    expect(snapshot.canonical.provenance.length).toBeGreaterThan(0);
    expect(snapshot.canonical.provenance[0]).toContain("http");
  });
});
