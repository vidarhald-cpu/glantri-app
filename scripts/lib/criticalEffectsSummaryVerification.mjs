const SUMMARY_NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  useGrouping: false,
});

function countBy(values, getKey) {
  const counts = new Map();

  for (const value of values) {
    const key = getKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function summaryKey(section, bucket) {
  return `${section}|${bucket}`;
}

export function buildCriticalEffectsSummaryExpectations(results, effects) {
  const expectations = new Map([
    [summaryKey("Crits", "Total crit rows"), results.length],
    [summaryKey("Effects", "Total effect rows"), effects.length],
    [
      summaryKey("Effects", "Average effect rows per crit"),
      Number((effects.length / results.length).toFixed(2)),
    ],
  ]);
  const breakdowns = [
    ["Type", countBy(effects, (effect) => effect.type)],
    ["Group", countBy(effects, (effect) => effect.group)],
    ["Type+Group", countBy(effects, (effect) => `${effect.type} / ${effect.group}`)],
    ["Duration mode", countBy(effects, (effect) => effect.durationMode)],
    ["Rate mode", countBy(effects, (effect) => effect.rateMode)],
  ];

  for (const [section, counts] of breakdowns) {
    for (const [bucket, count] of counts) {
      expectations.set(summaryKey(section, bucket), count);
    }
  }

  return expectations;
}

export function verifyCriticalEffectsSummaryBreakdowns(input) {
  const expectations = buildCriticalEffectsSummaryExpectations(input.results, input.effects);
  const seen = new Set();
  const comparisons = input.summaryRows.map((record) => {
    const section = String(record.values.Section ?? "");
    const bucket = String(record.values.Bucket ?? "");
    const key = summaryKey(section, bucket);
    const sourceCell = `AppFacing_Summary!C${record.rowNumber}`;

    if (seen.has(key)) {
      throw new Error(
        `${sourceCell} duplicates declared summary breakdown '${section}' / '${bucket}'.`,
      );
    }
    seen.add(key);

    const expected = expectations.get(key);
    if (expected === undefined) {
      throw new Error(
        `${sourceCell} declares unsupported summary breakdown '${section}' / '${bucket}'.`,
      );
    }

    const actual = record.values.Count;

    return {
      actual,
      bucket,
      expected,
      matches: actual === expected,
      section,
      sourceCell,
    };
  });
  const missingDeclaredBreakdowns = [...expectations.keys()].filter((key) => !seen.has(key));

  if (missingDeclaredBreakdowns.length > 0) {
    throw new Error(
      `AppFacing_Summary is missing generated-payload breakdowns: ${missingDeclaredBreakdowns.join(
        ", ",
      )}.`,
    );
  }

  return {
    comparisons,
    declaredBreakdowns: comparisons.length,
    discrepancies: comparisons.filter((comparison) => !comparison.matches),
    matchesPayload: comparisons.every((comparison) => comparison.matches),
  };
}

export function formatCriticalEffectsSummaryDiscrepancies(verification) {
  if (verification.discrepancies.length === 0) {
    return "AppFacing_Summary matches all generated-payload breakdowns.";
  }

  return [
    `AppFacing_Summary has ${verification.discrepancies.length} generated-payload discrepancy(ies):`,
    ...verification.discrepancies.map(
      (entry) =>
        `- ${entry.sourceCell} ${entry.section} / ${entry.bucket}: expected ${SUMMARY_NUMBER_FORMAT.format(
          entry.expected,
        )}, actual ${SUMMARY_NUMBER_FORMAT.format(entry.actual)}.`,
    ),
  ].join("\n");
}

export function assertCriticalEffectsSummaryMatches(verification) {
  if (!verification.matchesPayload) {
    throw new Error(formatCriticalEffectsSummaryDiscrepancies(verification));
  }
}
