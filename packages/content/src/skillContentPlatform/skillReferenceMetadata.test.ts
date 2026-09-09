import { describe, expect, it } from "vitest";

import type {
  SkillReferenceHistoricalAvailability,
  SkillReferenceSocialBand,
  SkillReferenceSocietyLevel,
} from "@glantri/domain";

import {
  buildSocietyLevelBandMatrix,
  buildSkillReferenceMetadata,
  validateSkillReferenceMetadata,
} from "./skillReferenceMetadata";
import { buildSkillContentRelease } from ".";
import { pilotSkillContentReleaseCandidate4Input } from "./pilotSkillContentReleaseProposal";

const levels: readonly SkillReferenceSocietyLevel[] = [
  { level: 1, label: "Level one" },
  { level: 2, label: "Level two" },
];
const bands: readonly SkillReferenceSocialBand[] = [
  { id: "L1", label: "Band one" },
  { id: "L2", label: "Band two" },
];

describe("Skill Reference metadata foundation", () => {
  it("projects explicit navigation, history, and profession facts as separate records", () => {
    const release = buildSkillContentRelease(pilotSkillContentReleaseCandidate4Input);
    const metadata = buildSkillReferenceMetadata(release);

    expect(metadata.archSkills.length).toBe(release.domains.length);
    expect(metadata.archSkills.flatMap(({ skillMemberships }) => skillMemberships)).toEqual(
      expect.arrayContaining([{ placement: "primary", skillId: "skill:medicine" }]),
    );
    expect(metadata.learningGroups).toEqual([]);
    expect(metadata.learningHistories.length).toBe(release.histories.length);
    expect(metadata.professionReferences.length).toBeGreaterThan(0);
    expect(metadata.professionReferences[0]).toHaveProperty("learningHistoryIds");
    expect(metadata.professionReferences[0]).toHaveProperty("suggestedSkillIds");
    expect(validateSkillReferenceMetadata(metadata)).toEqual([]);
  });

  it("renders all supplied matrix combinations without assuming a roster size", () => {
    const historicalAvailability: readonly SkillReferenceHistoricalAvailability[] = [
      {
        archSocietyId: "arch-society:one",
        explanation: "A supplied historical note.",
        id: "availability:one",
        metadata: {
          recordVersion: "1",
          status: "proposal",
          provenance: { kind: "proposal", reference: "test" },
        },
        skillId: "skill:medicine",
        socialBand: "L2",
        societyLevel: 2,
        status: "review-required",
      },
    ];
    const matrix = buildSocietyLevelBandMatrix(historicalAvailability, levels, bands);

    expect(matrix.cells).toHaveLength(4);
    expect(
      matrix.cells.find((cell) => cell.societyLevel === 2 && cell.socialBand === "L2"),
    ).toMatchObject({
      historicalAvailabilityIds: ["availability:one"],
      status: "unresolved",
    });
    expect(matrix.cells.filter((cell) => cell.status === "unresolved")).toHaveLength(4);

    const mixedMatrix = buildSocietyLevelBandMatrix(
      [
        { ...historicalAvailability[0], id: "availability:restricted", status: "restricted" },
        { ...historicalAvailability[0], id: "availability:available", status: "available" },
      ],
      levels,
      bands,
    );
    expect(
      mixedMatrix.cells.find((cell) => cell.societyLevel === 2 && cell.socialBand === "L2"),
    ).toMatchObject({
      historicalAvailabilityIds: ["availability:restricted", "availability:available"],
      status: "context-dependent",
    });
  });

  it("keeps an empty matrix explicit and validates duplicate identities", () => {
    const matrix = buildSocietyLevelBandMatrix([], [], []);
    expect(matrix.cells).toEqual([]);
    expect(
      validateSkillReferenceMetadata({
        archSkills: [
          {
            description: "One.",
            id: "arch-skill:one",
            metadata: {
              recordVersion: "1",
              status: "proposal",
              provenance: { kind: "proposal", reference: "test" },
            },
            name: "One",
            skillMemberships: [],
          },
          {
            description: "Two.",
            id: "arch-skill:one",
            metadata: {
              recordVersion: "1",
              status: "proposal",
              provenance: { kind: "proposal", reference: "test" },
            },
            name: "Two",
            skillMemberships: [],
          },
        ],
        archSocieties: [],
        historicalAvailability: [],
        skillSocietyFloors: [],
        societyApplicability: [],
        learningGroups: [],
        manifestations: [],
        schemaVersion: "skill-reference-metadata/v1",
      }),
    ).toEqual([expect.stringContaining("Duplicate reference identity")]);
  });
});
