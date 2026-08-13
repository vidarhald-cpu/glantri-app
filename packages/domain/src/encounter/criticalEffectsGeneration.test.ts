import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
  });

  it("records deterministic source coordinates, transformations, and digests", () => {
    const manifest = readManifest();

    expect(manifest.generator).toMatchObject({
      generationTimestampPolicy: { mode: "omitted-for-byte-stability" },
      path: "scripts/generateCriticalEffectsTable.mjs",
      version: "1.0.0",
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
  });
});
