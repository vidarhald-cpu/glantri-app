import {
  buildCriticalEffectConformanceReport,
  CRITICAL_CONSEQUENCE_FAMILIES,
  CRITICAL_EFFECT_MAPPING_STATUSES,
  type CriticalEffectConformanceEntry,
} from "./criticalEffectConformance";

export interface CriticalWorkbookSummaryDiscrepancy {
  actual: unknown;
  bucket: string;
  expected: number;
  matches: boolean;
  section: string;
  sourceCell: string;
}

export interface CriticalWorkbookSummaryVerification {
  declaredBreakdowns: number;
  discrepancies: readonly CriticalWorkbookSummaryDiscrepancy[];
  matchesPayload: boolean;
  verifiedAgainstGeneratedPayload: boolean;
}

function reportCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  return String(value)
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

function countBy(
  entries: readonly CriticalEffectConformanceEntry[],
  getValue: (entry: CriticalEffectConformanceEntry) => unknown,
): readonly [string, number][] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const value = reportCell(getValue(entry));
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function renderDistribution(
  label: string,
  entries: readonly CriticalEffectConformanceEntry[],
  getValue: (entry: CriticalEffectConformanceEntry) => unknown,
): string {
  return [
    `### ${label}`,
    "",
    "| Source value | Rows |",
    "| --- | ---: |",
    ...countBy(entries, getValue).map(([value, count]) => `| ${value} | ${count} |`),
  ].join("\n");
}

export function renderCriticalEffectConformanceReport(input: {
  sourceSha256: string;
  summaryVerification: CriticalWorkbookSummaryVerification;
}): string {
  const report = buildCriticalEffectConformanceReport();
  const stunEntries = report.effectEntries.filter((entry) => entry.type === "Stun");
  const summaryDiscrepancies = input.summaryVerification.discrepancies;
  const lines = [
    "# Critical Effects Source and Conformance Report",
    "",
    "This deterministic report inventories the checked-in Critical source payload without changing live Combat behavior or assigning unresolved game rules.",
    "",
    "## Provenance and reconciliation",
    "",
    "- Workbook: `docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx`",
    "- Critical results: `AppFacing_Crits!A1:X609`",
    "- Effect templates: `AppFacing_Effects!A1:AE2180`",
    `- Workbook SHA-256: \`${input.sourceSha256}\``,
    `- Generated payload: ${report.resultCount} results / ${report.uniqueEffectCount} unique effects`,
    `- Exhaustive effect inventory: ${report.completeEffectInventory ? "PASS" : "FAIL"}`,
    `- Workbook summary breakdowns checked: ${input.summaryVerification.declaredBreakdowns}`,
    `- Workbook summary matches generated payload: ${input.summaryVerification.matchesPayload ? "yes" : "no"}`,
    "",
    "The workbook summary is provenance evidence, not runtime authority. Known stale summary cells are reported below; the generated result/effect payload remains the source of expected counts.",
    "",
    "### Result-flag reconciliation",
    "",
    "| Result flag | Evidence basis | Flagged results | Results with evidence | Effect rows | Mismatches |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...report.resultFlagReconciliation.map(
      (entry) =>
        `| ${entry.flag} | ${entry.evidenceBasis} | ${entry.flaggedResults} | ${entry.evidencedResults} | ${entry.effectRows} | ${entry.mismatchedCritKeys.length} |`,
    ),
    "",
    "### Workbook summary discrepancies",
    "",
    ...(summaryDiscrepancies.length === 0
      ? ["None."]
      : [
          "| Source cell | Section | Bucket | Expected from payload | Workbook value |",
          "| --- | --- | --- | ---: | ---: |",
          ...summaryDiscrepancies.map(
            (entry) =>
              `| ${entry.sourceCell} | ${entry.section} | ${entry.bucket} | ${entry.expected} | ${reportCell(entry.actual)} |`,
          ),
        ]),
    "",
    "## Mapping status vocabulary",
    "",
    "- `mapped`: the current proposal/runtime path preserves the typed numeric or rate fact.",
    "- `projection_only`: the fact reaches a review/visible projection, but a general durable consumer is still required.",
    "- `mechanically_unmapped`: a meaningful fact currently degrades to a generic special/note representation and requires an explicit model/consumer extension.",
    "- `deferred_rule_decision`: source facts are retained, but implementation depends on an expressly unresolved product/rule decision.",
    "- `provenance_only`: a non-duplicated source row is preserved through aggregate proposal provenance rather than as a separate effect row.",
    "",
    "### Status counts",
    "",
    "| Mapping status | Rows |",
    "| --- | ---: |",
    ...CRITICAL_EFFECT_MAPPING_STATUSES.map(
      (status) => `| ${status} | ${report.statusCounts[status]} |`,
    ),
    "",
    "### Consequence-family counts",
    "",
    "Family counts may overlap because one authored row can carry more than one consequence fact.",
    "",
    "| Consequence family | Rows |",
    "| --- | ---: |",
    ...CRITICAL_CONSEQUENCE_FAMILIES.map(
      (family) => `| ${family} | ${report.familyCounts[family]} |`,
    ),
    "",
    "## Stun source facts",
    "",
    `All ${stunEntries.length} authored Stun rows remain listed individually in the exhaustive inventory. The distributions below report source facts only; they do not decide how authored penalties combine with the standard tactical Stunned bundle.`,
    "",
    renderDistribution(
      "Authored Stun numeric penalties",
      stunEntries,
      (entry) => entry.numericPenalty,
    ),
    "",
    renderDistribution("Authored Stun action states", stunEntries, (entry) => entry.actionState),
    "",
    renderDistribution("Authored Stun duration modes", stunEntries, (entry) => entry.durationMode),
    "",
    "## Exhaustive effect inventory",
    "",
    "The tab-separated block contains every source effect key exactly once. `extension_required=yes` identifies current model/consumer work; `deferred_rule_decision` rows remain evidence rather than guessed mechanics.",
    "",
    "```tsv",
    [
      "effect_key",
      "crit_key",
      "type",
      "group",
      "subtype",
      "target",
      "action_state",
      "numeric_penalty",
      "duration_mode",
      "duration_value",
      "duration_unit",
      "duration_roll",
      "end_trigger",
      "duration_raw",
      "rate_mode",
      "rate_value_per_round",
      "rate_roll_formula",
      "rate_raw",
      "special_flag",
      "source_field",
      "source_value",
      "implementation_note",
      "consequence_families",
      "proposal_projection",
      "mapping_status",
      "extension_required",
      "diagnostic",
    ].join("\t"),
    ...report.effectEntries.map((entry) =>
      [
        entry.effectKey,
        entry.critKey,
        entry.type,
        entry.group,
        entry.subtype,
        entry.target,
        entry.actionState,
        entry.numericPenalty,
        entry.durationMode,
        entry.durationValue,
        entry.durationUnit,
        entry.durationRoll,
        entry.endTrigger,
        entry.durationRaw,
        entry.rateMode,
        entry.rateValuePerRound,
        entry.rateRollFormula,
        entry.rateRaw,
        entry.specialFlag,
        entry.sourceField,
        entry.sourceValue,
        entry.implementationNote,
        entry.consequenceFamilies.join(","),
        entry.proposalProjection,
        entry.mappingStatus,
        entry.requiresExtension ? "yes" : "no",
        entry.diagnostic,
      ]
        .map(reportCell)
        .join("\t"),
    ),
    "```",
    "",
  ];

  return `${lines.join("\n")}\n`;
}
