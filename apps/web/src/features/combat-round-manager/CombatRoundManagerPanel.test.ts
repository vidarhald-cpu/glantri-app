import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CombatRoundManagerPanel.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CombatRoundManagerPanel", () => {
  it("renders the GM round manager orchestration controls", () => {
    const source = readSource();

    expect(source).toContain("Combat Round Manager");
    expect(source).toContain("Round {roundState.roundNumber}");
    expect(source).toContain("Current step:");
    expect(source).toContain("Advance to");
    expect(source).toContain("Step controller");
  });

  it("renders participant step status table and active marker controls", () => {
    const source = readSource();

    expect(source).toContain("COMBAT_ROUND_STEPS.map");
    expect(source).toContain("Participant");
    expect(source).toContain("Active");
    expect(source).toContain("Set active");
    expect(source).toContain("participant.stepStatuses[step]");
  });

  it("renders inspector details for the selected participant and step", () => {
    const source = readSource();

    expect(source).toContain("Combat round inspector");
    expect(source).toContain("Inspector");
    expect(source).toContain("buildCombatRoundInspector");
    expect(source).toContain("Phase 1 initiative:");
    expect(source).toContain("Phase 2 initiative:");
  });

  it("persists only combat round state through the existing encounter update path", () => {
    const source = readSource();

    expect(source).toContain("updateEncounterOnServer");
    expect(source).toContain("combatRoundState: nextRoundState");
    expect(source).toContain("currentRound: nextRoundState.roundNumber");
    expect(source).not.toContain("combatEffects");
    expect(source).not.toContain("actionLog:");
  });
});
