import { describe, expect, it } from "vitest";

import { CharacterRecoveryAttemptChangedError } from "../offline/repositories/characterRecoveryRepository";
import {
  formatCharacterRecoveryCompetition,
  resolveCharacterRecoverySaveFailure,
} from "./characterRecoverySaveFailure";

describe("Character recovery save failure presentation", () => {
  it.each([
    ["Character Edit", { name: "Entered edit" }, { name: "Canonical edit" }],
    ["Character Progression", { points: 4 }, { points: 0 }],
    ["Character Inventory", "Entered inventory notes", "Canonical inventory notes"],
  ])("keeps the entered %s value when another recovery attempt wins", (_, entered, canonical) => {
    expect(
      resolveCharacterRecoverySaveFailure(
        new CharacterRecoveryAttemptChangedError(),
        entered,
        canonical,
      ),
    ).toEqual({ competingAttempt: true, displayedValue: entered });
  });

  it("retains the established canonical fallback for ordinary save failures", () => {
    expect(
      resolveCharacterRecoverySaveFailure(new Error("Network"), "entered", "canonical"),
    ).toEqual({ competingAttempt: false, displayedValue: "canonical" });
  });

  it("distinguishes a retained competing attempt from recovery that disappeared", () => {
    expect(formatCharacterRecoveryCompetition(true)).toContain(
      "Another recovery attempt for this Character won in another tab",
    );
    expect(formatCharacterRecoveryCompetition(false)).toContain(
      "Character recovery changed in another tab",
    );
  });
});
