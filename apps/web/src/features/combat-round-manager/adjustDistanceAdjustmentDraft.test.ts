import { describe, expect, it } from "vitest";

import { buildAdjustDistanceGmAdjustmentRequest } from "./adjustDistanceAdjustmentDraft";

describe("buildAdjustDistanceGmAdjustmentRequest", () => {
  it("submits the current +1 draft without reading a previous canonical value", () => {
    expect(
      buildAdjustDistanceGmAdjustmentRequest({
        note: "open footing",
        participantId: "defender-1",
        value: "1",
      }),
    ).toEqual({
      notes: "open footing",
      participantId: "defender-1",
      value: 1,
    });
  });

  it("submits the current value after an undo and second edit", () => {
    const first = buildAdjustDistanceGmAdjustmentRequest({
      note: "first attempt",
      participantId: "attacker-1",
      value: "1",
    });
    const second = buildAdjustDistanceGmAdjustmentRequest({
      note: "second attempt",
      participantId: "attacker-1",
      value: "2",
    });

    expect(first.value).toBe(1);
    expect(second.value).toBe(2);
  });

  it("uses the current target and preserves an optional note", () => {
    expect(
      buildAdjustDistanceGmAdjustmentRequest({
        note: "",
        participantId: "attacker-1",
        value: "-10",
      }),
    ).toEqual({ notes: undefined, participantId: "attacker-1", value: -10 });
  });

  it("leaves blank and decimal values for server-side validation", () => {
    expect(
      Number.isNaN(
        buildAdjustDistanceGmAdjustmentRequest({
          note: "",
          participantId: "",
          value: "",
        }).value,
      ),
    ).toBe(true);
    expect(
      buildAdjustDistanceGmAdjustmentRequest({
        note: "",
        participantId: "",
        value: "1.5",
      }).value,
    ).toBe(1.5);
  });
});
