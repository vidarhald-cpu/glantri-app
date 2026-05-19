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
    expect(source).toContain("Rows are participants. Columns are round timeline cells.");
    expect(source).toContain("Commit");
    expect(source).toContain("and advance to");
    expect(source).toContain("Step controller");
  });

  it("renders participants as rows and round steps as timeline columns", () => {
    const source = readSource();

    expect(source).toContain("Combat round timeline grid");
    expect(source).toContain("timelineRoundNumbers");
    expect(source).toContain("Round {roundNumber}");
    expect(source).toContain("COMBAT_ROUND_STEPS.map");
    expect(source).toContain("COMBAT_ROUND_STEP_ABBREVIATIONS[step]");
    expect(source).toContain("COMBAT_ROUND_STEP_LABELS[step]");
    expect(source).toContain("Participant");
    expect(source).toContain("activeParticipantId");
    expect(source).toContain("Set active");
    expect(source).toContain("getStatusMarker");
    expect(source).toContain("participant.stepStatuses[step]");
    expect(source).toContain("step === roundState.currentStep");
    expect(source).toContain('overflowX: "auto"');
  });

  it("renders inspector details for the selected participant and step", () => {
    const source = readSource();

    expect(source).toContain("Combat round inspector");
    expect(source).toContain("Combat inspector");
    expect(source).toContain("Selected cell:");
    expect(source).toContain("This is the current step. Advance commits this step");
    expect(source).toContain("buildCombatRoundInspector");
    expect(source).toContain("Phase 1 initiative:");
    expect(source).toContain("Phase 2 initiative:");
    expect(source).toContain("No data recorded for this step.");
    expect(source).toContain("Previous participant");
    expect(source).toContain("Next participant");
    expect(source).toContain("Previous step");
    expect(source).toContain("Next step");
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
