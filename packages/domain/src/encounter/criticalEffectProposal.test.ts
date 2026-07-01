import { describe, expect, it } from "vitest";

import {
  buildCriticalEffectProposalFromDamageResult,
  getCriticalEffectStoredDurationRounds,
} from "./criticalEffectProposal";
import type { CriticalEffectTemplate } from "./criticalEffectsTable";

describe("critical effect proposal generation", () => {
  it("builds a known critical result summary with title and body text", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalResult).toMatchObject({
      bodyText: expect.stringContaining("severs your opponent's arm"),
      critIndex: 13,
      critKey: "sharp|arm|13",
      family: "sharp",
      location: "arm",
      title: expect.stringContaining("Amputation"),
    });
    expect(proposal.proposedEffects.map((effect) => effect.sourceEffectKey)).toContain(
      "sharp|arm|13|03",
    );
  });

  it("returns a clear warning for unsupported or ambiguous family mapping", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "leftArm",
      weaponCriticalCode: "FS",
    });

    expect(proposal.criticalResult).toBeUndefined();
    expect(proposal.proposedEffects).toEqual([]);
    expect(proposal.warnings.join(" ")).toContain("appears with more than one damage class");
  });

  it("returns a clear warning for unsupported location mapping", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "leftLeg",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalResult).toBeUndefined();
    expect(proposal.warnings.join(" ")).toContain("distinguishes upper_leg and lower_leg");
  });

  it("does not clamp out-of-range final critical rolls", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 17,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalResult).toBeUndefined();
    expect(proposal.criticalIndexStatus).toBe("unsupported_high");
    expect(proposal.warnings.join(" ")).toContain(
      "outside the supported critical table index range",
    );
  });

  it("treats final critical rolls below 1 as no critical effect", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: -4,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalIndexStatus).toBe("no_effect");
    expect(proposal.criticalResult).toBeUndefined();
    expect(proposal.proposedEffects).toEqual([]);
    expect(proposal.warnings).toEqual([]);
  });

  it("rolls app-handled table dice and stores roll reports", () => {
    const rolls = [0.01, 0.74];
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 1,
      finalCriticalRoll: 4,
      rng: () => rolls.shift() ?? 0.01,
      selectedHitLocation: "rightArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalResult?.critKey).toBe("sharp|arm|04");
    expect(proposal.rollReports).toEqual([
      expect.objectContaining({
        effectKey: "sharp|arm|04|02",
        formula: "d4",
        purpose: "duration",
        rolls: [1],
        total: 1,
      }),
      expect.objectContaining({
        effectKey: "sharp|arm|04|03",
        formula: "d4",
        purpose: "duration",
        rolls: [3],
        total: 3,
      }),
    ]);
    expect(
      proposal.proposedEffects.find((effect) => effect.sourceEffectKey === "sharp|arm|04|02")
        ?.durationRounds,
    ).toBe(1);
  });

  it("stores next-round no-action effects with one extra SU countdown tick", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 6,
      selectedHitLocation: "chest",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalResult?.critKey).toBe("sharp|chest|06");
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        durationRounds: 2,
        rowCategory: "no_combat_action",
        sourceEffectKey: "sharp|chest|06|02",
      }),
    );
  });

  it("stores next-round rolled durations with one extra SU countdown tick", () => {
    const effect: CriticalEffectTemplate = {
      critKey: "test|head|01",
      durationMode: "roll",
      durationRaw: "no actions for the next D6 rounds",
      durationRoll: "d6",
      effectKey: "test|head|01|01",
      effectOrder: 1,
      group: "Stun/Action",
      rateMode: "none",
      subtype: "shock_or_action_lock",
      target: "general_action",
      type: "Stun",
      urgency: 1,
    };

    expect(
      getCriticalEffectStoredDurationRounds(effect, [
        {
          effectKey: effect.effectKey,
          formula: "d6",
          purpose: "duration",
          rolls: [3],
          sourceField: "durationRoll",
          total: 3,
        },
      ]),
    ).toBe(4);
  });

  it("stores physical minimum damage floors on the proposal instead of duplicate effect rows", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 13,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });
    const minimumFloor = proposal.proposedEffects.find(
      (effect) => effect.sourceEffectKey === "sharp|arm|13|01",
    );

    expect(proposal.minTotalDamage).toBe(5);
    expect(proposal.minDamageReason).toBe("amputation / severing");
    expect(minimumFloor).toBeUndefined();
  });

  it("maps loss-of-use templates to semantic rows instead of arbitrary modifiers", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 1,
      finalCriticalRoll: 1,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        kind: "special",
        rowCategory: "loss_of_use",
        sourceEffectKey: "sharp|arm|01|01",
      }),
    );
  });

  it("maps bleed and no-action critical templates to typed review rows", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 13,
      rng: () => 0.5,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        kind: "special",
        label: "Unconscious - no combat action possible",
        rowCategory: "no_combat_action",
        sourceEffectKey: "sharp|arm|13|02",
      }),
    );
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        kind: "special",
        label: "Bleed",
        rateValuePerRound: 3,
        rowCategory: "bleed",
        sourceEffectKey: "sharp|arm|13|03",
      }),
    );
    expect(
      proposal.proposedEffects.some((effect) => effect.sourceEffectKey === "sharp|arm|13|05"),
    ).toBe(false);
  });

  it("maps prose-heavy special rows to editable special drafts", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 7,
      selectedHitLocation: "head",
      weaponDamageClass: "edged",
    });

    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        kind: "special",
        label: "vision penalty",
        rowCategory: "special_note",
        sourceEffectKey: "sharp|head|07|02",
      }),
    );
  });
});
