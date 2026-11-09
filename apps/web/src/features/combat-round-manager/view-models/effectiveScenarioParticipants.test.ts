import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "@glantri/domain";

import { resolveEffectiveScenarioParticipants } from "./effectiveScenarioParticipants";

function participant(id: string, updatedAt: string, marker = "x"): ScenarioParticipant {
  return { id, marker, updatedAt } as unknown as ScenarioParticipant;
}

describe("resolveEffectiveScenarioParticipants", () => {
  it("uses the fetched row when it is strictly newer than the override", () => {
    const fetched = participant("p1", "2026-11-08T22:49:46.329Z", "fetched");
    const override = participant("p1", "2026-11-08T22:49:30.450Z", "override");

    expect(resolveEffectiveScenarioParticipants([fetched], { p1: override })).toEqual([fetched]);
  });

  it("keeps the override when it is newer than or equal to the fetched row", () => {
    const older = participant("p1", "2026-11-08T22:49:30.450Z", "fetched");
    const newer = participant("p1", "2026-11-08T22:49:46.329Z", "override");
    const equal = participant("p1", "2026-11-08T22:49:30.450Z", "override");

    expect(resolveEffectiveScenarioParticipants([older], { p1: newer })[0]).toBe(newer);
    expect(resolveEffectiveScenarioParticipants([older], { p1: equal })[0]).toBe(equal);
  });

  it("keeps the override when either timestamp does not parse", () => {
    const fetched = participant("p1", "2026-11-08T22:49:46.329Z", "fetched");
    const badOverride = participant("p1", "not-a-date", "override");
    const badFetched = participant("p1", "not-a-date", "fetched");
    const goodOverride = participant("p1", "2026-11-08T22:49:30.450Z", "override");

    expect(resolveEffectiveScenarioParticipants([fetched], { p1: badOverride })[0]).toBe(
      badOverride,
    );
    expect(resolveEffectiveScenarioParticipants([badFetched], { p1: goodOverride })[0]).toBe(
      goodOverride,
    );
  });

  it("returns the fetched row when there is no override", () => {
    const fetched = participant("p1", "2026-11-08T22:49:46.329Z");

    expect(resolveEffectiveScenarioParticipants([fetched], {})).toEqual([fetched]);
  });
});
