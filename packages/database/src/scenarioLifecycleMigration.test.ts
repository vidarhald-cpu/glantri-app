import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260819143000_add_scenario_lifecycle_kernel/migration.sql",
  ),
  "utf8",
);

describe("Scenario lifecycle migration compatibility", () => {
  it("maps every legacy status without dropping Scenario rows", () => {
    expect(migration).toContain("WHEN 'prepared' THEN 'draft'");
    expect(migration).toContain("WHEN 'completed' THEN 'closed'");
    expect(migration).toContain('ELSE "status"::text');
    expect(migration).not.toMatch(/DELETE\s+FROM\s+"Scenario"/i);
  });

  it("preserves deterministic played evidence for archived restoration", () => {
    expect(migration).toContain("\"liveStateJson\"->>'startedAt' IS NOT NULL");
    expect(migration).toContain('ADD COLUMN "lifecycleCycle" INTEGER NOT NULL DEFAULT 0');
  });
});
