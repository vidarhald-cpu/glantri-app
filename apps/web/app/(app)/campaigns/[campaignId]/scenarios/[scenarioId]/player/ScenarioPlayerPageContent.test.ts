import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "ScenarioPlayerPageContent.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("ScenarioPlayerPageContent player-facing cleanup", () => {
  it("shows only scenario briefing and actionable encounter access", () => {
    const source = readSource();

    expect(source).toContain("Open encounter");
    expect(source).toContain("You are not assigned to this encounter.");
    expect(source).toContain("No active encounter is currently available.");
    expect(source).toContain("isUserAssignedToEffectiveEncounter");
    expect(source).not.toContain("Combat status:");
    expect(source).not.toContain("Round:");
    expect(source).not.toContain("Phase:");
    expect(source).not.toContain("Visibility model:");
    expect(source).not.toContain("Participants:");
    expect(source).not.toContain("Actions coming next");
    expect(source).not.toContain("Future phases will");
    expect(source).not.toContain("formatEncounterParticipantCountLabel");
  });
});
