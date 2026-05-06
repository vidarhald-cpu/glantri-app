import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "EncounterDetail.tsx");

function readEncounterDetailSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("EncounterDetail table rendering", () => {
  it("routes roleplay encounters to the GM roleplaying screen", () => {
    const source = readEncounterDetailSource();

    expect(source).toContain("GmRoleplayingEncounterScreen");
    expect(source).toContain('encounter.kind === "roleplay"');
    expect(source).toContain("onPersist={persistEncounter}");
  });

  it("uses stable unique ids for repeated GM encounter header labels", () => {
    const source = readEncounterDetailSource();

    expect(source).toContain('{ id: "selected-action", label: "Action" }');
    expect(source).toContain('{ id: "phase-one-action", label: "Action" }');
    expect(source).toContain('{ id: "phase-two-action", label: "Action" }');
    expect(source).toContain("key={column.id}");
    expect(source).not.toContain("key={label}");
  });
});
