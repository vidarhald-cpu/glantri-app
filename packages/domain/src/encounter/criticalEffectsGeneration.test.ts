import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assertCriticalEffectsSummaryMatches,
  buildCriticalEffectsSummaryExpectations,
  verifyCriticalEffectsSummaryBreakdowns,
} from "../../../../scripts/lib/criticalEffectsSummaryVerification.mjs";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const generatorPath = resolve(repoRoot, "scripts/generateCriticalEffectsTable.mjs");
const manifestPath = resolve(
  repoRoot,
  "packages/domain/src/encounter/criticalEffectsTableManifest.json",
);

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

describe("Critical workbook generation", () => {
  it("reproduces the committed table data and provenance manifest byte-for-byte", () => {
    const output = execFileSync(process.execPath, [generatorPath, "--verify"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("Critical table verification passed: 608 results, 2179 effects");
    expect(output).toContain(
      "Preserved warnings: 76 fractional rates, 757 unresolved special/stateful mappings, 79 roll-once rates, 5 death timers.",
    );
    expect(output).toContain("AppFacing_Summary!C7 Type / Physical: expected 1045, actual 1517.");
    expect(output).toContain("AppFacing_Summary!C16 Group / Special: expected 546, actual 1035.");
  });

  it("records deterministic source coordinates, transformations, and digests", () => {
    const manifest = readManifest();

    expect(manifest.manifestVersion).toBe(2);
    expect(manifest.generator).toMatchObject({
      generationTimestampPolicy: { mode: "omitted-for-byte-stability" },
      path: "scripts/generateCriticalEffectsTable.mjs",
      version: "1.1.0",
    });
    expect(manifest.source).toMatchObject({
      sha256: "47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f",
      tables: {
        criticalResults: {
          dataRange: "AppFacing_Crits!A2:X609",
          range: "A1:X609",
          rowCount: 608,
        },
        effectTemplates: {
          dataRange: "AppFacing_Effects!A2:AE2180",
          range: "A1:AE2180",
          rowCount: 2179,
        },
      },
      workbook: "docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx",
    });
    expect(manifest.output).toMatchObject({
      criticalResultsCount: 608,
      effectTemplatesCount: 2179,
      file: "packages/domain/src/encounter/criticalEffectsTableData.ts",
      fileSha256: "63bb12c2ae0765acd64c70ba4abcc8ebf5d89a71026f70ca2199dd56de0f1673",
    });
    expect(manifest.transformations).toContain(
      "No bleed unit, duration, dice formula, Special flag, treatment gate, or stateful mapping is inferred or normalized.",
    );
  });

  it("exposes fractional rates and unresolved Special/stateful mappings with source cells", () => {
    const manifest = readManifest();

    expect(manifest.warnings.summary).toEqual({
      deathTimerMappings: 5,
      fractionalRatesPreserved: 76,
      rollOnceRateMappings: 79,
      unresolvedSpecialOrStatefulMappings: 757,
      workbookWarnings: 9,
    });
    expect(manifest.warnings.fractionalRates).toContainEqual(
      expect.objectContaining({
        effectKey: "sharp|chest|09|03",
        rateRaw: "1 HP / 2 rounds",
        rateValuePerRound: 0.5,
        sourceCells: expect.arrayContaining(["AppFacing_Effects!Q129:T129"]),
      }),
    );
    expect(manifest.warnings.unresolvedSpecialOrStatefulMappings).toContainEqual(
      expect.objectContaining({
        durationMode: "special",
        effectKey: "blunt|lower_leg|01|01",
        sourceCells: expect.arrayContaining([
          "AppFacing_Effects!K547:P547",
          "AppFacing_Effects!AC547:AD547",
        ]),
      }),
    );
    expect(manifest.validation.representativeCases).toEqual([
      "sharp|arm|13",
      "blunt|head|16",
      "blunt|lower_leg|01",
      "fire_energy|whole_body|08",
    ]);
    expect(manifest.validation.workbookSummary).toEqual({
      declaredBreakdowns: 39,
      discrepancies: [
        {
          actual: 1517,
          bucket: "Physical",
          expected: 1045,
          matches: false,
          section: "Type",
          sourceCell: "AppFacing_Summary!C7",
        },
        {
          actual: 563,
          bucket: "Special",
          expected: 546,
          matches: false,
          section: "Type",
          sourceCell: "AppFacing_Summary!C8",
        },
        {
          actual: 42,
          bucket: "DB",
          expected: 122,
          matches: false,
          section: "Group",
          sourceCell: "AppFacing_Summary!C11",
        },
        {
          actual: 295,
          bucket: "Mobility",
          expected: 215,
          matches: false,
          section: "Group",
          sourceCell: "AppFacing_Summary!C13",
        },
        {
          actual: 1035,
          bucket: "Special",
          expected: 546,
          matches: false,
          section: "Group",
          sourceCell: "AppFacing_Summary!C16",
        },
      ],
      matchesPayload: false,
      verifiedAgainstGeneratedPayload: true,
    });
    expect(manifest.validation.complete).toBe(false);
  });

  it("fails a stale summary fixture with exact expected and actual diagnostics", () => {
    const results = [{}];
    const effects = [
      {
        durationMode: "instant",
        group: "DB",
        rateMode: "none",
        type: "Physical",
      },
    ];
    const expectations = buildCriticalEffectsSummaryExpectations(results, effects);
    const summaryRows = [...expectations.entries()].map(([key, expected], index) => {
      const separator = key.indexOf("|");
      const section = key.slice(0, separator);
      const bucket = key.slice(separator + 1);

      return {
        rowNumber: index + 2,
        values: {
          Bucket: bucket,
          Count: section === "Type" && bucket === "Physical" ? 9 : expected,
          Section: section,
        },
      };
    });
    const verification = verifyCriticalEffectsSummaryBreakdowns({
      effects,
      results,
      summaryRows,
    });

    expect(() => assertCriticalEffectsSummaryMatches(verification)).toThrowError(
      "AppFacing_Summary has 1 generated-payload discrepancy(ies):\n" +
        "- AppFacing_Summary!C5 Type / Physical: expected 1, actual 9.",
    );
  });
});
