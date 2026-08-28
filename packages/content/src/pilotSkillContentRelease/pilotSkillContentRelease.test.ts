import { createHash } from "node:crypto";

import type { PilotSkillContentRelease } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { pilotSkillContentReleaseV1 } from "./release";
import {
  serializePilotSkillContentReleasePayload,
  validatePilotSkillContentRelease,
} from "./validator";

describe("canonical bounded pilot Skill content release", () => {
  it("has one stable, versioned identity and a byte-reproducible payload digest", () => {
    expect(pilotSkillContentReleaseV1).toMatchObject({
      contentVersion: "pilot-skills-content/1.0.0",
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

  it("returns deterministic diagnostics without mutating an invalid release", () => {
    const invalid = structuredClone(
      pilotSkillContentReleaseV1,
    ) as unknown as PilotSkillContentRelease;
    (invalid.characters[0] as { professionId: string }).professionId = "profession:missing";
    const before = JSON.stringify(invalid);
    const first = validatePilotSkillContentRelease(invalid);
    const second = validatePilotSkillContentRelease(invalid);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ valid: false });
    expect(first.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PILOT_CONTENT_CHARACTER_CONTEXT_UNKNOWN" }),
      ]),
    );
    expect(JSON.stringify(invalid)).toBe(before);
  });
});
