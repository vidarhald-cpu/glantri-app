import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format as formatWithPrettier } from "prettier";
import { describe, expect, it } from "vitest";

import {
  buildCriticalEffectConformanceReport,
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
    expect(report.familyCounts.internal_bleed).toBe(82);
    expect(report.statusCounts.mechanically_unmapped).toBeGreaterThan(0);
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
