import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "combatRoundManager.ts"), "utf8");

describe("initiative commit undo source conformance", () => {
  it("never persists the normalized combat round as new initiative undo facts", () => {
    const commitStart = source.indexOf(
      "export function commitCombatRoundPhaseInitiativeResolution",
    );
    const commitEnd = source.indexOf(
      "export function restoreCombatRoundPhaseInitiativeResolutionCombatContextModifiers",
      commitStart,
    );
    const commitSource = source.slice(commitStart, commitEnd);

    expect(commitStart).toBeGreaterThanOrEqual(0);
    expect(commitEnd).toBeGreaterThan(commitStart);
    expect(commitSource).not.toContain("previousState:");
    expect(commitSource).not.toContain("previousState: normalized");
    expect(commitSource).toContain("initiativeCommitUndo");
  });

  it("keeps legacy previousState parsing isolated to the undo compatibility path", () => {
    expect(source.match(/facts\.previousState/g)).toHaveLength(1);
    expect(source).toContain(
      "const previousState = combatRoundStateSchema.safeParse(command.facts.previousState);",
    );
  });
});
