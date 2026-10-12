import { describe, expect, it } from "vitest";

import { formatScenarioStatus } from "./scenarioStatusLabel";

describe("formatScenarioStatus", () => {
  it("never exposes the raw lifecycle enum", () => {
    expect(formatScenarioStatus("live")).toBe("Active");
    expect(formatScenarioStatus("completed")).toBe("Closed");
    expect(formatScenarioStatus("draft")).toBe("Draft");
    expect(formatScenarioStatus("archived")).toBe("Archived");
  });
});
