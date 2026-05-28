import { describe, expect, it } from "vitest";

import { scenarioCombatModifierEntrySchema } from "./scenario";

describe("scenario combat modifier entries", () => {
  it("accepts numeric duration rounds while keeping old entries compatible", () => {
    expect(
      scenarioCombatModifierEntrySchema.parse({
        durationRounds: 2,
        id: "modifier-1",
        notes: "High ground",
        value: -1,
      }),
    ).toEqual({
      durationRounds: 2,
      id: "modifier-1",
      notes: "High ground",
      scope: "until",
      value: -1,
    });

    expect(
      scenarioCombatModifierEntrySchema.parse({
        id: "modifier-legacy",
        scope: "save",
        value: 1,
      }),
    ).toEqual({
      id: "modifier-legacy",
      scope: "save",
      value: 1,
    });
  });
});
