import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format as formatWithPrettier } from "prettier";
import { describe, expect, it } from "vitest";

import {
  buildCriticalEffectConformanceReport,
  classifyCriticalEffectConformance,
  CRITICAL_EFFECT_MAPPING_STATUSES,
} from "./criticalEffectConformance";
import { renderCriticalEffectConformanceReport } from "./criticalEffectConformanceReport";
import { CRITICAL_EFFECTS_TABLE } from "./criticalEffectsTable";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const manifestPath = resolve(
  repoRoot,
  "packages/domain/src/encounter/criticalEffectsTableManifest.json",
);
const reportPath = resolve(repoRoot, "docs/audits/critical-effects-conformance.md");

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

describe("Critical effect source/conformance inventory", () => {
  it("classifies every one of the 2,179 source effect keys exactly once", () => {
    const report = buildCriticalEffectConformanceReport();

    expect(report.resultCount).toBe(608);
    expect(report.effectEntries).toHaveLength(2179);
    expect(report.uniqueEffectCount).toBe(2179);
    expect(report.duplicateEffectKeys).toEqual([]);
    expect(report.completeEffectInventory).toBe(true);
    expect(Object.keys(report.statusCounts)).toEqual(CRITICAL_EFFECT_MAPPING_STATUSES);
    expect(Object.values(report.statusCounts).reduce((sum, count) => sum + count, 0)).toBe(2179);
  });

  it("reconciles every declared result flag to effect-level source evidence", () => {
    const reconciliation = buildCriticalEffectConformanceReport().resultFlagReconciliation;

    expect(reconciliation).toEqual([
      {
        evidenceBasis: "balance_penalty effect rows",
        effectRows: 183,
        evidencedResults: 183,
        flag: "hasBalance",
        flaggedResults: 183,
        mismatchedCritKeys: [],
      },
      {
        evidenceBasis: "Stun effect rows",
        effectRows: 368,
        evidencedResults: 368,
        flag: "hasStun",
        flaggedResults: 368,
        mismatchedCritKeys: [],
      },
      {
        evidenceBasis: "external Bleed effect rows",
        effectRows: 138,
        evidencedResults: 138,
        flag: "hasExternalBleed",
        flaggedResults: 138,
        mismatchedCritKeys: [],
      },
      {
        evidenceBasis: "Internal bleed effect rows",
        effectRows: 82,
        evidencedResults: 82,
        flag: "hasInternalBleed",
        flaggedResults: 82,
        mismatchedCritKeys: [],
      },
      {
        evidenceBasis: "loss_of_use effect rows",
        effectRows: 307,
        evidencedResults: 307,
        flag: "hasLossOfUse",
        flaggedResults: 307,
        mismatchedCritKeys: [],
      },
      {
        evidenceBasis: "special_tags effect rows or preserved result sourceSpecialTags",
        effectRows: 546,
        evidencedResults: 444,
        flag: "hasSpecial",
        flaggedResults: 444,
        mismatchedCritKeys: [],
      },
    ]);
  });

  it("retains all authored Stun penalty, action-state, and duration facts without resolving them", () => {
    const stunEntries = buildCriticalEffectConformanceReport().effectEntries.filter(
      (entry) => entry.type === "Stun",
    );

    expect(stunEntries).toHaveLength(368);
    expect(new Set(stunEntries.map((entry) => entry.numericPenalty))).toEqual(
      new Set([-1, -2, -4, -8, undefined]),
    );
    expect(stunEntries.every((entry) => entry.actionState !== undefined)).toBe(true);
    expect(stunEntries.every((entry) => entry.durationMode.length > 0)).toBe(true);
    expect(stunEntries.every((entry) => entry.mappingStatus === "deferred_rule_decision")).toBe(
      true,
    );
  });

  it("surfaces generic special/note degradation as extension-required conformance gaps", () => {
    const report = buildCriticalEffectConformanceReport();
    const visionGap = report.effectEntries.find((entry) => entry.effectKey === "sharp|head|07|02");
    const floor = report.effectEntries.find((entry) => entry.effectKey === "sharp|arm|13|01");
    const terminal = report.effectEntries.find((entry) => entry.effectKey === "blunt|head|16|02");

    expect(visionGap).toMatchObject({
      mappingStatus: "mechanically_unmapped",
      proposalProjection: "review_effect:special_note",
      requiresExtension: true,
    });
    expect(floor).toMatchObject({
      mappingStatus: "provenance_only",
      proposalProjection: "proposal_summary:physical_damage",
      requiresExtension: false,
    });
    expect(terminal).toMatchObject({
      consequenceFamilies: expect.arrayContaining(["terminal_marker"]),
      mappingStatus: "deferred_rule_decision",
      requiresExtension: false,
    });
    expect(report.familyCounts.loss_of_use).toBe(307);
    expect(report.familyCounts.external_bleed).toBe(138);
    expect(report.familyCounts.internal_bleed).toBe(85);
    expect(report.statusCounts.mechanically_unmapped).toBeGreaterThan(0);
  });

  it("activates only bleed rates that convert exactly to the existing tenths consumer", () => {
    const entries = buildCriticalEffectConformanceReport().effectEntries;
    const halfHp = entries.find(({ effectKey }) => effectKey === "blunt|arm|12|03");
    const oneHp = entries.find(({ effectKey }) => effectKey === "pointed_weapons|arm|10|03");
    const rolledHp = entries.find(({ effectKey }) => effectKey === "sharp|arm|12|03");
    const quarterHp = entries.find(
      ({ effectKey }) => effectKey === "pointed_weapons|abdomen|05|03",
    );

    expect(halfHp).toMatchObject({
      mappingStatus: "mapped",
      proposalProjection: "review_effect:bleed",
      requiresExtension: false,
    });
    expect(halfHp?.diagnostic).toContain("5/10 HP per round");
    expect(oneHp?.diagnostic).toContain("10/10 HP per round");
    expect(rolledHp).toMatchObject({
      mappingStatus: "mapped",
      proposalProjection: "review_effect:bleed",
      requiresExtension: false,
    });
    expect(quarterHp).toMatchObject({
      mappingStatus: "mechanically_unmapped",
      proposalProjection: "review_effect:special_note",
      requiresExtension: true,
    });
    expect(quarterHp?.diagnostic).toContain("inactive source-linked note");
  });

  it("keeps the blunt arm 12 unconsciousness source conflict inactive and source-linked", () => {
    const conflict = buildCriticalEffectConformanceReport().effectEntries.find(
      ({ effectKey }) => effectKey === "blunt|arm|12|02",
    );

    expect(conflict).toMatchObject({
      critKey: "blunt|arm|12",
      mappingStatus: "deferred_rule_decision",
      proposalProjection: "review_effect:special_note",
      requiresExtension: false,
      sourceField: "shock_penalty",
      sourceValue: "-8",
    });
    expect(conflict?.diagnostic).toContain("AppFacing_Crits!A109:X109");
    expect(conflict?.diagnostic).toContain("AppFacing_Effects!A341:AE341");
    expect(conflict?.diagnostic).toContain("no unconsciousness or combat-action blocking");
  });

  it("does not let a mapped numeric facet suppress an independent mobility extension gap", () => {
    const entries = buildCriticalEffectConformanceReport().effectEntries;
    const numericMobilityEntries = entries.filter(
      ({ consequenceFamilies, proposalProjection }) =>
        consequenceFamilies.includes("mobility") &&
        proposalProjection === "review_effect:db_parry_modifier",
    );
    const entry = numericMobilityEntries.find(
      ({ effectKey }) => effectKey === "arrows_bolts|abdomen|03|02",
    );

    expect(numericMobilityEntries).toHaveLength(122);
    expect(
      numericMobilityEntries.filter(
        ({ consequenceFamilies }) => !consequenceFamilies.includes("terminal_marker"),
      ),
    ).toHaveLength(120);
    expect(
      numericMobilityEntries.every(
        ({ mappingStatus, requiresExtension }) =>
          mappingStatus === "projection_only" && requiresExtension,
      ),
    ).toBe(true);
    expect(entry).toMatchObject({
      consequenceFamilies: expect.arrayContaining(["mobility"]),
      mappingStatus: "projection_only",
      proposalProjection: "review_effect:db_parry_modifier",
      requiresExtension: true,
    });
    expect(entry?.diagnostic).toContain("independent mobility/stance fact");
    expect(entry?.diagnostic).toContain("durable consumer extension");
  });

  it("classifies terminal companion gaps without assigning terminal mechanics", () => {
    const entries = buildCriticalEffectConformanceReport().effectEntries;
    const terminalMobility = entries.find(
      ({ effectKey }) => effectKey === "fire_energy|whole_body|14|02",
    );
    const terminalNumericMobility = entries.find(
      ({ effectKey }) => effectKey === "sharp|arm|16|02",
    );
    const terminalLossOfUse = entries.find(
      ({ effectKey }) => effectKey === "pointed_weapons|head|14|03",
    );
    const terminalStructural = entries.find(
      ({ effectKey }) => effectKey === "pointed_weapons|head|12|05",
    );

    expect(terminalMobility).toMatchObject({
      consequenceFamilies: expect.arrayContaining(["mobility", "terminal_marker"]),
      mappingStatus: "mechanically_unmapped",
      requiresExtension: true,
    });
    expect(terminalMobility?.diagnostic).toContain("mobility");
    expect(terminalMobility?.diagnostic).toContain("terminal/death marker remains source evidence");

    expect(terminalNumericMobility).toMatchObject({
      consequenceFamilies: expect.arrayContaining(["mobility", "terminal_marker"]),
      mappingStatus: "projection_only",
      proposalProjection: "review_effect:db_parry_modifier",
      requiresExtension: true,
    });
    expect(terminalNumericMobility?.diagnostic).toContain("independent mobility/stance fact");
    expect(terminalNumericMobility?.diagnostic).toContain(
      "terminal/death marker remains source evidence",
    );

    expect(terminalLossOfUse).toMatchObject({
      consequenceFamilies: expect.arrayContaining(["loss_of_use", "terminal_marker"]),
      mappingStatus: "projection_only",
      requiresExtension: true,
    });
    expect(terminalLossOfUse?.diagnostic).toContain("loss-of-use");
    expect(terminalLossOfUse?.diagnostic).toContain(
      "terminal/death marker remains source evidence",
    );

    expect(terminalStructural).toMatchObject({
      consequenceFamilies: expect.arrayContaining(["structural_anatomical", "terminal_marker"]),
      mappingStatus: "mechanically_unmapped",
      requiresExtension: true,
    });
    expect(terminalStructural?.diagnostic).toContain("structural/anatomical");
    expect(terminalStructural?.diagnostic).toContain(
      "terminal/death marker remains source evidence",
    );
  });

  it.each([
    {
      effectKey: "blunt|abdomen|15|03",
      expectedFamilies: ["internal_bleed"],
      specialFlag: "internal_bleeding",
    },
    {
      effectKey: "blunt|head|12|04",
      expectedFamilies: ["internal_bleed", "structural_anatomical"],
      specialFlag: "brain_haemorrhage",
    },
    {
      effectKey: "blunt|upper_leg|12|05",
      expectedFamilies: ["internal_bleed"],
      specialFlag: "hidden_blood_loss",
    },
  ])("classifies authored $specialFlag as internal bleed", ({ effectKey, expectedFamilies }) => {
    const effect = CRITICAL_EFFECTS_TABLE.effectTemplates.find(
      (candidate) => candidate.effectKey === effectKey,
    );

    expect(effect).toBeDefined();
    expect(classifyCriticalEffectConformance(effect!).consequenceFamilies).toEqual(
      expectedFamilies,
    );
  });

  it("reports the compositional mapping and extension counts", () => {
    const report = buildCriticalEffectConformanceReport();

    expect(report.statusCounts).toEqual({
      mapped: 174,
      projection_only: 523,
      mechanically_unmapped: 403,
      deferred_rule_decision: 524,
      provenance_only: 555,
    });
    expect(report.effectEntries.filter((entry) => entry.requiresExtension)).toHaveLength(926);
  });

  it("renders the checked-in exhaustive report byte-for-byte deterministically", async () => {
    const manifest = readManifest();
    const first = renderCriticalEffectConformanceReport({
      sourceSha256: manifest.source.sha256,
      summaryVerification: manifest.validation.workbookSummary,
    });
    const second = renderCriticalEffectConformanceReport({
      sourceSha256: manifest.source.sha256,
      summaryVerification: manifest.validation.workbookSummary,
    });
    const formattedFirst = await formatWithPrettier(first, {
      filepath: reportPath,
      parser: "markdown",
    });
    const formattedSecond = await formatWithPrettier(second, {
      filepath: reportPath,
      parser: "markdown",
    });
    const checkedIn = readFileSync(reportPath, "utf8");

    expect(formattedFirst).toBe(formattedSecond);
    expect(formattedFirst).toBe(checkedIn);
    for (const effect of CRITICAL_EFFECTS_TABLE.effectTemplates) {
      expect(formattedFirst.split(effect.effectKey)).toHaveLength(2);
    }
  });
});
