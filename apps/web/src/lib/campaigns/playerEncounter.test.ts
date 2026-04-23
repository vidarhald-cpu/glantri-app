import { describe, expect, it } from "vitest";

import {
  buildPlayerEncounterPhaseSummary,
  getPlayerEncounterMovementLabel,
} from "./playerEncounter";

describe("playerEncounter", () => {
  it("maps primary and secondary actions into round phases", () => {
    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "attack",
        secondaryActionId: "parry",
      }),
    ).toEqual({
      phaseOne: "Attack",
      phaseTwo: "Parry",
    });

    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "parry",
        secondaryActionId: "attack",
      }),
    ).toEqual({
      phaseOne: "Parry",
      phaseTwo: "Attack",
    });
  });

  it("leaves an empty second phase open when no secondary action is selected", () => {
    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "attack",
        secondaryActionId: "",
      }),
    ).toEqual({
      phaseOne: "Attack",
      phaseTwo: "Open",
    });
  });

  it("returns a stable movement label fallback", () => {
    expect(getPlayerEncounterMovementLabel("advance")).toBe("Advance");
    expect(getPlayerEncounterMovementLabel("")).toBe("Hold position");
  });
});
