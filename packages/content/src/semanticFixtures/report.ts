import type { SkillSemanticValidationResult } from "./validator";

export function renderSkillSemanticReport(result: SkillSemanticValidationResult): string {
  const lines = [
    "Skill semantic conformance report",
    "=================================",
    `Result: ${result.valid ? "PASS" : "FAIL"}`,
    `Fixtures: ${result.fixtures.length} (${result.fixtures.filter((fixture) => fixture.valid).length} passed, ${result.fixtures.filter((fixture) => !fixture.valid).length} failed)`,
    `Errors: ${result.diagnostics.length}`,
    `Policy gaps: ${result.policyGaps.length}`,
    "",
    "Fixtures",
    "--------",
    ...result.fixtures.map(
      (fixture) =>
        `- ${fixture.fixtureId}: ${fixture.valid ? "PASS" : `FAIL (${fixture.diagnostics.length} error${fixture.diagnostics.length === 1 ? "" : "s"})`} — ${fixture.title}`,
    ),
  ];

  if (result.diagnostics.length > 0) {
    lines.push(
      "",
      "Diagnostics",
      "-----------",
      ...result.diagnostics.map(
        (diagnostic) =>
          `- [${diagnostic.code}] ${diagnostic.fixtureId}.${diagnostic.path}: ${diagnostic.message}`,
      ),
    );
  }

  lines.push(
    "",
    "Policy gaps (flagged, not decided)",
    "----------------------------------",
    ...result.policyGaps.map((gap) => `- [${gap.code}] ${gap.detail}`),
  );

  return `${lines.join("\n")}\n`;
}
