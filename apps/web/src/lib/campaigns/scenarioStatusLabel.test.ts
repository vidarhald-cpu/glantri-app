import { describe, expect, it } from "vitest";

import { formatScenarioStatus } from "./scenarioStatusLabel";

describe("formatScenarioStatus", () => {
  it("never exposes the raw lifecycle enum", () => {
    expect(formatScenarioStatus("live")).toBe("Active");
    expect(formatScenarioStatus("completed")).toBe("Closed");
    expect(formatScenarioStatus("draft")).toBe("Draft");
    expect(formatScenarioStatus("archived")).toBe("Archived");
  });

  it("renders every Campaign status as its decided label", () => {
    expect(formatScenarioStatus("draft")).toBe("Draft");
    expect(formatScenarioStatus("active")).toBe("Active");
    expect(formatScenarioStatus("archived")).toBe("Archived");
  });

  it("renders every Encounter status as its decided label", () => {
    expect(
      ["draft", "active", "paused", "completed", "archived"].map(formatScenarioStatus),
    ).toEqual(["Draft", "Active", "Paused", "Closed", "Archived"]);
  });
});
