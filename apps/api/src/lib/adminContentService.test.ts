import { describe, expect, it } from "vitest";

import { CanonicalContentService } from "./adminContentService";

describe("admin content service", () => {
  it("projects the integrated authored proposal without fabricating a canonical release", async () => {
    const service = new CanonicalContentService();
    const snapshot = await service.getSkillReference();

    expect(snapshot.canonical).toBeNull();
    expect(snapshot.candidate).toMatchObject({
      contentVersion: "pilot-skills-content/2.0.0-candidate.1",
      id: "content-release:pilot-skills:2-candidate-1",
      schemaVersion: "skill-content-release/v2",
      status: "proposal",
    });
    expect(snapshot.candidate?.records.competencies.length).toBeGreaterThan(0);
    expect(snapshot.candidate?.records.scripts.length).toBeGreaterThan(0);
    expect(snapshot.candidate?.records.relationships.length).toBeGreaterThan(0);
    expect(snapshot.candidate?.records.domains.length).toBeGreaterThan(0);
  });

  it("retains authored envelopes, provenance, and both deterministic proposal digests", async () => {
    const service = new CanonicalContentService();
    const snapshot = await service.getSkillReference();
    const medicine = snapshot.candidate?.records.competencies.find(
      ({ id }) => id === "skill:medicine",
    );

    expect(snapshot.candidate?.compatibility.classification).toBe("mechanically-compatible");
    expect(snapshot.candidate?.manifest.packageDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(snapshot.candidate?.manifest.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(snapshot.candidate?.manifest.packageDigest).not.toBe(
      snapshot.candidate?.manifest.semanticDigest,
    );
    expect(snapshot.candidate?.provenance.length).toBeGreaterThan(0);
    expect(medicine?.taskEnvelope.coreTasks.length).toBeGreaterThan(0);
    expect(medicine?.taskEnvelope.limits.length).toBeGreaterThan(0);
    expect(medicine?.provenance[0]).toContain("pilotSkillContentReleaseProposal.ts");
  });
});
