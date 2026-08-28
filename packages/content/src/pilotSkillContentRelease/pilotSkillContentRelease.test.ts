import { createHash } from "node:crypto";

import type { PilotSkillContentRelease } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { pilotSkillContentReleaseV1 } from "./release";
import {
  serializePilotSkillContentReleasePayload,
  validatePilotSkillContentRelease,
} from "./validator";

function resignPilotRelease(release: PilotSkillContentRelease): void {
  const digest = createHash("sha256")
    .update(serializePilotSkillContentReleasePayload(release))
    .digest("hex");
  Object.assign(release.manifest, { payloadDigest: `sha256:${digest}` });
}

describe("canonical bounded pilot Skill content release", () => {
  it("has one stable, versioned identity and a byte-reproducible payload digest", () => {
    expect(pilotSkillContentReleaseV1).toMatchObject({
      contentVersion: "pilot-skills-content/1.0.1",
      id: "content-release:pilot-skills:1",
      rulesVersion: "pilot-skill-rules/v1",
      schemaVersion: "pilot-skill-content-release/v1",
      status: "canonical-bounded-pilot",
    });
    const digest = createHash("sha256")
      .update(serializePilotSkillContentReleasePayload(pilotSkillContentReleaseV1))
      .digest("hex");
    expect(pilotSkillContentReleaseV1.manifest.payloadDigest).toBe(`sha256:${digest}`);
    expect(validatePilotSkillContentRelease(pilotSkillContentReleaseV1)).toEqual({
      diagnostics: [],
      releaseId: pilotSkillContentReleaseV1.id,
      valid: true,
    });
  });

  it("contains exactly the accepted bounded inventory and no synthetic Gate A fixture", () => {
    expect(pilotSkillContentReleaseV1.manifest.counts).toEqual({
      accessExceptions: 4,
      backgrounds: 8,
      characters: 8,
      competencies: 53,
      histories: 17,
      professions: 8,
      profiles: 7,
      relationships: 15,
      specializations: 8,
    });
    expect(pilotSkillContentReleaseV1.characters.map(({ concept }) => concept)).toEqual([
      "Glantrian household-retainer veteran",
      "Mogrebi temple physician",
      "Iest dockside informant and entry investigator",
      "Olog princely-chancery clerk",
      "Lankhmar merchant-house weaponsmith factor",
      "Lankhmar coastal pilot",
      "N'Kolian caravan scout-militia hybrid",
      "Scythian mounted envoy after Olog fosterage",
    ]);
    expect(JSON.stringify(pilotSkillContentReleaseV1)).not.toContain("golden:");
    expect(JSON.stringify(pilotSkillContentReleaseV1)).not.toContain("optimizer");
  });

  it("preserves exact weights, directional edges, specialization declarations, and inert professions", () => {
    const weights = Object.fromEntries(
      pilotSkillContentReleaseV1.competencies.map(({ id, weight }) => [id, weight]),
    );
    expect(weights).toMatchObject({
      "skill:first-aid": 1,
      "skill:dodge": 1,
      "skill:medicine": 3,
      "skill:surgery": 3,
      "skill:dead-reckoning": 3,
      "skill:chart-navigation": 3,
      "skill:administration": 2,
      "skill:pilotage": 2,
      "spoken:scythian": 2,
      "written:ologian:church-ologian": 2,
    });
    expect(
      pilotSkillContentReleaseV1.relationships.map(
        ({ sourceCompetencyId, strength, targetCompetencyId }) =>
          `${sourceCompetencyId}->${targetCompetencyId}:${strength}`,
      ),
    ).toContain("skill:medicine->skill:first-aid:100");
    expect(pilotSkillContentReleaseV1.relationships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceCompetencyId: "skill:first-aid",
          targetCompetencyId: "skill:medicine",
        }),
      ]),
    );
    expect(
      pilotSkillContentReleaseV1.specializations
        .filter(({ transfer }) => transfer.kind === "zero-transfer")
        .map(({ id }) => id),
    ).toEqual(["spec:household-guard-sword-shield-drill", "spec:steppe-remount-training"]);
    expect(
      pilotSkillContentReleaseV1.professions.every(({ mechanics }) => mechanics === "none"),
    ).toBe(true);
  });

  it("keeps history overlap authored and resolves every accepted choice explicitly", () => {
    const hybrid = pilotSkillContentReleaseV1.characters.find(({ id }) =>
      id.endsWith("nkolian-caravan-scout"),
    )!;
    expect(hybrid.histories).toEqual([
      { historyId: "hist:nkolo-frontier-levy", level: 3, selectedCompetencyIds: [] },
      {
        historyId: "hist:nkolo-caravan-factor",
        level: 3,
        selectedCompetencyIds: ["skill:bargaining"],
      },
      { historyId: "hist:nkolo-scout-journeys", level: 2, selectedCompetencyIds: [] },
    ]);
    const memberships = hybrid.histories.flatMap(
      ({ historyId }) =>
        pilotSkillContentReleaseV1.histories.find(({ id }) => id === historyId)!.fixedCompetencyIds,
    );
    expect(memberships.filter((id) => id === "skill:wayfinding")).toHaveLength(2);
    expect(memberships.filter((id) => id === "skill:perception")).toHaveLength(2);
    expect(memberships.filter((id) => id === "skill:survival")).toHaveLength(2);
  });

  it("keeps access exceptions at zero competence and spoken/written identities separate", () => {
    expect(
      pilotSkillContentReleaseV1.accessExceptions.every(
        ({ grantsCompetence }) => grantsCompetence === 0,
      ),
    ).toBe(true);
    const fosterage = pilotSkillContentReleaseV1.accessExceptions.find(({ id }) =>
      id.includes("house-vorodin"),
    )!;
    expect(fosterage.competencyIds).toEqual([
      "spoken:ologian",
      "written:ologian:church-ologian",
      "skill:customs",
      "skill:insight",
      "skill:administration",
    ]);
    expect(fosterage.competencyIds).not.toContain("skill:law:olog-princely");
    expect(fosterage.competencyIds).not.toContain("spec:court-administration");
    expect(
      pilotSkillContentReleaseV1.backgrounds.every(({ startingSpokenLanguageId }) =>
        startingSpokenLanguageId.startsWith("spoken:"),
      ),
    ).toBe(true);
    expect(
      pilotSkillContentReleaseV1.backgrounds.some(({ startingSpokenLanguageId }) =>
        startingSpokenLanguageId.startsWith("written:"),
      ),
    ).toBe(false);
  });

  it("retains the accepted Mogreb, Iest, Olog, N'Kolo, and Scythian DS/AB facts exactly", () => {
    const profile = (id: string) =>
      pilotSkillContentReleaseV1.profiles.find((entry) => entry.id === id)!;
    const route = (profileId: string, routeId: string) =>
      profile(profileId).normalRoutes.find((entry) => entry.id === routeId)!;

    expect(route("profile:mogreb-temple-state", "route:mogreb-household-first-aid")).toEqual(
      expect.objectContaining({ accessBand: "AB1", competencyIds: ["skill:first-aid"] }),
    );
    expect(route("profile:mogreb-temple-state", "route:mogreb-temple").accessBand).toBe("AB3");

    expect(route("profile:iest-commercial-city", "route:iest-street")).toEqual(
      expect.objectContaining({ accessBand: "AB1" }),
    );
    expect(route("profile:iest-commercial-city", "route:iest-ordinary-trade-craft")).toEqual(
      expect.objectContaining({
        accessBand: "AB2",
        competencyIds: ["skill:trade", "skill:smithing"],
      }),
    );

    expect(route("profile:olog-court-bureaucratic", "route:olog-routine-office")).toEqual(
      expect.objectContaining({
        accessBand: "AB2",
        competencyIds: expect.arrayContaining([
          "skill:administration",
          "skill:law:olog-princely",
          "written:ologian:church-ologian",
        ]),
      }),
    );
    expect(route("profile:olog-court-bureaucratic", "route:olog-princely-chancery")).toEqual(
      expect.objectContaining({
        accessBand: "AB3",
        competencyIds: expect.arrayContaining(["spec:court-administration"]),
      }),
    );

    expect(
      profile("profile:nkolo-imperial-road").normalRoutes.map(({ accessBand }) => accessBand),
    ).toEqual(["AB1", "AB1", "AB2", "AB2"]);
    expect(route("profile:nkolo-imperial-road", "route:nkolo-desert-tradition")).toEqual(
      expect.objectContaining({
        accessBand: "AB2",
        competencyIds: ["spec:desert-wayfinding"],
      }),
    );

    const scythianUnavailable = profile("profile:scythian-pastoral-clan").overrides.find(
      ({ availability }) => availability === "unavailable",
    )!;
    expect(scythianUnavailable.competencyIds).toEqual(
      expect.arrayContaining([
        "written:ologian:church-ologian",
        "skill:administration",
        "skill:law:olog-princely",
        "spec:court-administration",
      ]),
    );
    expect(
      pilotSkillContentReleaseV1.accessExceptions.every(
        ({ grantsCompetence }) => grantsCompetence === 0,
      ),
    ).toBe(true);
    expect(pilotSkillContentReleaseV1.policies.accessGrantsCompetence).toBe(0);
  });

  it("rejects every prior QA enum and access mutation without throwing or mutating input", () => {
    const cases: Array<[string, (release: PilotSkillContentRelease) => void]> = [
      [
        "relationship strength",
        (release) => Object.assign(release.relationships[0]!, { strength: 60 }),
      ],
      [
        "profile access band",
        (release) => Object.assign(release.profiles[0]!, { accessBand: "AB9" }),
      ],
      [
        "route access band",
        (release) => Object.assign(release.profiles[0]!.normalRoutes[0]!, { accessBand: "AB9" }),
      ],
      [
        "development stage",
        (release) => Object.assign(release.profiles[0]!, { developmentStage: "DS9" }),
      ],
      [
        "override availability",
        (release) =>
          Object.assign(release.profiles[1]!.overrides[0]!, { availability: "sometimes" }),
      ],
      [
        "exception basis",
        (release) => Object.assign(release.accessExceptions[0]!, { basis: "travel" }),
      ],
      ["competency weight", (release) => Object.assign(release.competencies[0]!, { weight: 4 })],
      [
        "specialization weight",
        (release) => Object.assign(release.specializations[0]!, { acquisitionWeight: 3 }),
      ],
      [
        "transfer kind",
        (release) => Object.assign(release.specializations[0]!.transfer, { kind: "recursive" }),
      ],
      [
        "relationship direction",
        (release) => Object.assign(release.relationships[0]!, { direction: "bidirectional" }),
      ],
      [
        "relationship reverse edge",
        (release) => Object.assign(release.relationships[0]!, { reverseEdge: "inferred" }),
      ],
      [
        "relationship rules version",
        (release) =>
          Object.assign(release.relationships[0]!, { rulesVersion: "pilot-skill-rules/v2" }),
      ],
      [
        "competency kind",
        (release) => Object.assign(release.competencies[0]!, { kind: "category" }),
      ],
      [
        "exception competence",
        (release) => Object.assign(release.accessExceptions[0]!, { grantsCompetence: 1 }),
      ],
      [
        "language grant rule",
        (release) =>
          Object.assign(release.backgrounds[0]!, { startingSpokenLanguageRule: "education" }),
      ],
      ["policy", (release) => Object.assign(release.policies, { professionMechanics: "grants" })],
      ["release status", (release) => Object.assign(release, { status: "draft" })],
      [
        "manifest serialization",
        (release) => Object.assign(release.manifest, { serialization: "json" }),
      ],
    ];

    for (const [name, mutate] of cases) {
      const invalid = structuredClone(pilotSkillContentReleaseV1) as PilotSkillContentRelease;
      mutate(invalid);
      const before = JSON.stringify(invalid);
      expect(() => validatePilotSkillContentRelease(invalid), name).not.toThrow();
      const first = validatePilotSkillContentRelease(invalid);
      expect(first.valid, name).toBe(false);
      expect(first, name).toEqual(validatePilotSkillContentRelease(invalid));
      expect(JSON.stringify(invalid), name).toBe(before);
    }
  });

  it("returns sorted deterministic shape diagnostics for null collections and entries", () => {
    const collectionNames = [
      "accessExceptions",
      "backgrounds",
      "characters",
      "competencies",
      "histories",
      "professions",
      "profiles",
      "relationships",
      "specializations",
    ] as const;
    const invalidInputs: unknown[] = [null];
    for (const collectionName of collectionNames) {
      const nullCollection = structuredClone(pilotSkillContentReleaseV1);
      Object.assign(nullCollection, { [collectionName]: null });
      invalidInputs.push(nullCollection);
      const nonArrayCollection = structuredClone(pilotSkillContentReleaseV1);
      Object.assign(nonArrayCollection, { [collectionName]: {} });
      invalidInputs.push(nonArrayCollection);
      const nullEntry = structuredClone(pilotSkillContentReleaseV1);
      Object.assign(nullEntry, { [collectionName]: [null] });
      invalidInputs.push(nullEntry);
    }

    for (const invalid of invalidInputs) {
      const before = JSON.stringify(invalid);
      expect(() => validatePilotSkillContentRelease(invalid)).not.toThrow();
      const first = validatePilotSkillContentRelease(invalid);
      expect(first.valid).toBe(false);
      expect(first).toEqual(validatePilotSkillContentRelease(invalid));
      expect(first.diagnostics).toEqual(
        [...first.diagnostics].sort(
          (left, right) =>
            left.code.localeCompare(right.code) ||
            left.path.localeCompare(right.path) ||
            left.message.localeCompare(right.message),
        ),
      );
      expect(JSON.stringify(invalid)).toBe(before);
    }
  });

  it("binds the manifest digest to every canonical payload field", () => {
    const invalid = structuredClone(pilotSkillContentReleaseV1) as PilotSkillContentRelease;
    Object.assign(invalid.competencies[0]!, { description: "Mutated while retaining old digest." });
    const before = JSON.stringify(invalid);
    const result = validatePilotSkillContentRelease(invalid);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "PILOT_CONTENT_DIGEST_MISMATCH" })]),
    );
    expect(JSON.stringify(invalid)).toBe(before);
  });

  it("rejects re-signed invalid attribution sources and duplicate semantic targets", () => {
    const cases: Array<{
      code: string;
      mutate: (release: PilotSkillContentRelease) => void;
      name: string;
    }> = [
      {
        code: "PILOT_CONTENT_INVALID_SHAPE",
        mutate: (release) =>
          Object.assign(release.profiles[1]!.overrides[0]!, { attributionId: "not stable" }),
        name: "invalid attribution stable-ID grammar",
      },
      {
        code: "PILOT_CONTENT_INVALID_ATTRIBUTION_SOURCE",
        mutate: (release) =>
          Object.assign(release.profiles[1]!.overrides[0]!, {
            attributionId: "access:unknown-source",
          }),
        name: "unknown stable attribution source",
      },
      {
        code: "PILOT_CONTENT_INVALID_ATTRIBUTION_SOURCE",
        mutate: (release) =>
          Object.assign(release.profiles[1]!.overrides[0]!, {
            attributionId: "access:lankhmar-master-hanno",
          }),
        name: "known attribution source for the wrong profile",
      },
      {
        code: "PILOT_CONTENT_INVALID_SHAPE",
        mutate: (release) =>
          Object.assign(release.relationships[0]!, { sourceCompetencyId: "not stable" }),
        name: "invalid relationship source stable-ID grammar",
      },
      {
        code: "PILOT_CONTENT_UNKNOWN_RELATIONSHIP_ENDPOINT",
        mutate: (release) =>
          Object.assign(release.relationships[0]!, { sourceCompetencyId: "skill:missing" }),
        name: "unknown stable relationship source",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_RELATIONSHIP_EDGE",
        mutate: (release) =>
          Object.assign(release.relationships[1]!, {
            sourceCompetencyId: release.relationships[0]!.sourceCompetencyId,
            targetCompetencyId: release.relationships[0]!.targetCompetencyId,
          }),
        name: "duplicate relationship source-target edge",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_TARGET",
        mutate: (release) =>
          Object.assign(release.characters[0]!.directAcquisitions[1]!, {
            competencyId: release.characters[0]!.directAcquisitions[0]!.competencyId,
          }),
        name: "duplicate direct-acquisition competency target",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_TARGET",
        mutate: (release) => {
          const acquisition = release.characters[0]!.specializationAcquisitions[0]!;
          (release.characters[0]!.specializationAcquisitions as Array<typeof acquisition>).push({
            ...acquisition,
          });
        },
        name: "duplicate specialization-acquisition competency target",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_TARGET",
        mutate: (release) => {
          const targets = release.profiles[0]!.normalRoutes[0]!.competencyIds as string[];
          targets.push(targets[0]!);
        },
        name: "duplicate normal-route competency target",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_TARGET",
        mutate: (release) => {
          const targets = release.profiles[1]!.overrides[0]!.competencyIds as string[];
          targets.push(targets[0]!);
        },
        name: "duplicate restricted-access competency target",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_TARGET",
        mutate: (release) => {
          const targets = release.accessExceptions[0]!.competencyIds as string[];
          targets.push(targets[0]!);
        },
        name: "duplicate access-exception competency target",
      },
      {
        code: "PILOT_CONTENT_DUPLICATE_TARGET",
        mutate: (release) => {
          const selected = release.characters[0]!.histories[0]!.selectedCompetencyIds as string[];
          selected.push(selected[0]!);
        },
        name: "duplicate resolved choice target",
      },
    ];

    for (const { code, mutate, name } of cases) {
      const invalid = structuredClone(pilotSkillContentReleaseV1) as PilotSkillContentRelease;
      mutate(invalid);
      resignPilotRelease(invalid);
      const before = JSON.stringify(invalid);
      const expectedDigest = `sha256:${createHash("sha256")
        .update(serializePilotSkillContentReleasePayload(invalid))
        .digest("hex")}`;
      expect(invalid.manifest.payloadDigest, name).toBe(expectedDigest);
      expect(() => validatePilotSkillContentRelease(invalid), name).not.toThrow();
      const first = validatePilotSkillContentRelease(invalid);
      expect(first.valid, name).toBe(false);
      expect(first.diagnostics, name).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
      expect(first.diagnostics, name).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "PILOT_CONTENT_DIGEST_MISMATCH" }),
        ]),
      );
      expect(first, name).toEqual(validatePilotSkillContentRelease(invalid));
      expect(first.diagnostics, name).toEqual(
        [...first.diagnostics].sort(
          (left, right) =>
            left.code.localeCompare(right.code) ||
            left.path.localeCompare(right.path) ||
            left.message.localeCompare(right.message),
        ),
      );
      expect(JSON.stringify(invalid), name).toBe(before);
    }
  });

  it("returns deterministic diagnostics without mutating an invalid release", () => {
    const invalid = structuredClone(
      pilotSkillContentReleaseV1,
    ) as unknown as PilotSkillContentRelease;
    (invalid.characters[0] as { professionId: string }).professionId = "profession:missing";
    Object.assign(invalid.competencies[1]!, { id: invalid.competencies[0]!.id });
    Object.assign(invalid.relationships[0]!, { targetCompetencyId: "skill:missing" });
    const before = JSON.stringify(invalid);
    const first = validatePilotSkillContentRelease(invalid);
    const second = validatePilotSkillContentRelease(invalid);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ valid: false });
    expect(first.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PILOT_CONTENT_CHARACTER_CONTEXT_UNKNOWN" }),
        expect.objectContaining({ code: "PILOT_CONTENT_DIGEST_MISMATCH" }),
        expect.objectContaining({ code: "PILOT_CONTENT_DUPLICATE_ID" }),
        expect.objectContaining({ code: "PILOT_CONTENT_UNKNOWN_RELATIONSHIP_ENDPOINT" }),
      ]),
    );
    expect(JSON.stringify(invalid)).toBe(before);
  });
});
