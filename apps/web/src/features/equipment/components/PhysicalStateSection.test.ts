import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PhysicalStateSection.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PhysicalStateSection", () => {
  it("renders physical state combat-effect panels", () => {
    const source = readSource();

    expect(source).toContain("Physical state");
    expect(source).toContain("Hitpoints and damage");
    expect(source).toContain("Combat effects by sum");
    expect(source).toContain("Combat effects");
    expect(source).toContain("General hitpoints");
    expect(source).toContain("No combat effects recorded.");
    expect(source).not.toContain("weight");
  });

  it("keeps the summary panels in a responsive two-column row", () => {
    const source = readSource();

    expect(source).toContain('gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))"');
    expect(source).toContain('alignItems: "start"');
  });

  it("renders the combat effects and hitpoint table columns", () => {
    const source = readSource();

    expect(source).toContain("Location");
    expect(source).toContain("Original");
    expect(source).toContain("Current");
    expect(source).toContain("Round #");
    expect(source).toContain("Source");
    expect(source).toContain("General damage");
    expect(source).toContain("Special effects");
    expect(source).toContain("Current effect");
    expect(source).toContain("Save");
    expect(source).toContain("Delete");
  });
});
