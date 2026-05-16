import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PhysicalStateSection.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PhysicalStateSection", () => {
  it("renders hitpoints, damage by type, and hit log scaffolds", () => {
    const source = readSource();

    expect(source).toContain("Physical state");
    expect(source).toContain("Hitpoints");
    expect(source).toContain("Damage by type");
    expect(source).toContain("Log of hits");
    expect(source).toContain("General hitpoints");
    expect(source).toContain("No hits recorded.");
  });

  it("renders the hit log and damage table columns", () => {
    const source = readSource();

    expect(source).toContain("Location");
    expect(source).toContain("Original");
    expect(source).toContain("Current");
    expect(source).toContain("Source");
    expect(source).toContain("General damage");
    expect(source).toContain("Special effects");
    expect(source).toContain("Current effect");
  });
});
