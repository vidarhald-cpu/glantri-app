import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "ScenarioPlayerPageContent.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("ScenarioPlayerPageContent Scenario session", () => {
  it("uses the privacy-safe session view with reconnect and stale-response protection", () => {
    const source = readSource();

    expect(source).toContain("loadScenarioSession");
    expect(source).toContain("ScenarioSessionPanel");
    expect(source).toContain("pickUpScenarioAvailableItemOnServer");
    expect(source).toContain("shouldAcceptScenarioSessionResponse");
    expect(source).toContain('window.addEventListener("focus"');
    expect(source).toContain("window.setInterval");
    expect(source).not.toContain("loadScenarioParticipants");
    expect(source).not.toContain("loadScenarioPlayerProjection");
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
