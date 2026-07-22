import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "encounterRoutes.ts"), "utf8");

describe("combat route canonical-conformance guards", () => {
  it("does not expose the removed cursor-authorized GM mutation routes", () => {
    for (const route of [
      "combat-round/feint-feasibility",
      "combat-round/skip-current-action",
      "combat-round/advance-current-phase-resolution",
      "combat-round/complete-current-phase-resolution",
    ]) {
      expect(source).not.toContain(route);
    }
  });

  it("does not shadow projected attack authorization with the compatibility roll cursor", () => {
    expect(source).not.toContain("getPlayerCombatCurrentRollAction");
  });

  it("requires the boundary command execution group and command type", () => {
    expect(source).toContain("expectedCommandType: body.commandType");
    expect(source).toContain("expectedExecutionGroupId: body.executionGroupId");
    expect(source).toContain("expectedTaskId: body.taskId");
  });
});
