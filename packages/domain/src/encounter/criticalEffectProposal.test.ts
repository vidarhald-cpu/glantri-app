import { describe, expect, it } from "vitest";

import {
  buildCriticalEffectProposalFromDamageResult,
  getCriticalEffectStoredDurationRounds,
} from "./criticalEffectProposal";
import { getCriticalResultWithEffects, type CriticalEffectTemplate } from "./criticalEffectsTable";

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
    expect(proposal.warnings.join(" ")).toContain("legacy whole leg");
    expect(proposal.warnings.join(" ")).toContain("distinguishes upper_leg and lower_leg");
  });

  it("builds critical proposals for upper and lower leg hit locations", () => {
    const upperRightProposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "upperRightLeg",
      weaponDamageClass: "edged",
    });
    const upperLeftProposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "upperLeftLeg",
      weaponDamageClass: "edged",
    });
    const lowerRightProposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "lowerRightLeg",
      weaponDamageClass: "edged",
    });
    const lowerLeftProposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 5,
      finalCriticalRoll: 13,
      selectedHitLocation: "lowerLeftLeg",
      weaponDamageClass: "edged",
    });

    expect(upperRightProposal.criticalResult).toMatchObject({
      critKey: "sharp|upper_leg|13",
      location: "upper_leg",
    });
    expect(upperLeftProposal.criticalResult).toMatchObject({
      critKey: "sharp|upper_leg|13",
      location: "upper_leg",
    });
    expect(lowerRightProposal.criticalResult).toMatchObject({
      critKey: "sharp|lower_leg|13",
      location: "lower_leg",
    });
    expect(lowerLeftProposal.criticalResult).toMatchObject({
      critKey: "sharp|lower_leg|13",
      location: "lower_leg",
    });
    expect(upperRightProposal.warnings).toEqual([]);
    expect(lowerRightProposal.warnings).toEqual([]);
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
    expect(proposal.minDamageSourceEffectKey).toBe("sharp|arm|13|01");
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
        rateValuePerRound: 30,
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
        accepted: false,
        kind: "special",
        label: "vision penalty",
        rowCategory: "special_note",
        sourceEffectKey: "sharp|head|07|02",
      }),
    );
  });

  it("maps the blunt arm 12 golden with an exact half-HP rate and inactive unsupported notes", () => {
    // AppFacing_Crits!A109:X109; AppFacing_Effects!A340:AE345.
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 12,
      selectedHitLocation: "rightArm",
      weaponDamageClass: "blunt",
    });

    expect(proposal.criticalResult?.critKey).toBe("blunt|arm|12");
    expect(proposal).toMatchObject({
      minDamageSourceEffectKey: "blunt|arm|12|01",
      minTotalDamage: 5,
    });
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        accepted: true,
        rateValuePerRound: 5,
        rowCategory: "bleed",
        sourceCritKey: "blunt|arm|12",
        sourceEffectKey: "blunt|arm|12|03",
      }),
    );
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        accepted: false,
        rowCategory: "special_note",
        sourceEffectKey: "blunt|arm|12|06",
      }),
    );
    expect(
      getCriticalResultWithEffects("blunt", "arm", 12)?.effects.find(
        (effect) => effect.effectKey === "blunt|arm|12|03",
      ),
    ).toMatchObject({
      durationMode: "ongoing",
      durationRaw: "collapse / arm useless until treated",
      endTrigger: "staunched_or_resolved",
      rateMode: "fixed_fraction",
      rateRaw: "1 HP / 2 rounds",
      sourceField: "ext_bleed_rate",
      sourceValue: "1 HP / 2 rounds",
      target: "arm",
      type: "Bleed",
    });
  });

  it("maps the edged arm 12 golden by rolling HP once and storing exact tenths", () => {
    // AppFacing_Crits!A13:X13; AppFacing_Effects!A36:AE42.
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 12,
      rng: () => 0.5,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.criticalResult?.critKey).toBe("sharp|arm|12");
    expect(proposal.minDamageSourceEffectKey).toBe("sharp|arm|12|01");
    expect(proposal.minTotalDamage).toBe(5);
    expect(proposal.rollReports).toContainEqual(
      expect.objectContaining({
        effectKey: "sharp|arm|12|03",
        formula: "d4",
        purpose: "rate",
        rolls: [3],
        total: 3,
      }),
    );
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        accepted: true,
        rateValuePerRound: 30,
        rowCategory: "bleed",
        sourceEffectKey: "sharp|arm|12|03",
      }),
    );
    expect(
      proposal.proposedEffects.filter((effect) => effect.rowCategory === "special_note"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accepted: false, sourceEffectKey: "sharp|arm|12|06" }),
        expect.objectContaining({ accepted: false, sourceEffectKey: "sharp|arm|12|07" }),
      ]),
    );
    expect(
      getCriticalResultWithEffects("sharp", "arm", 12)?.effects.find(
        (effect) => effect.effectKey === "sharp|arm|12|03",
      ),
    ).toMatchObject({
      durationMode: "ongoing",
      durationRaw: "collapse; fading if uncontrolled",
      endTrigger: "staunched_or_resolved",
      rateMode: "roll_once_per_round_rate",
      rateRaw: "1D4 HP / round",
      rateRollFormula: "1d4",
      sourceField: "ext_bleed_rate",
      sourceValue: "1D4 HP / round",
      target: "arm",
      type: "Bleed",
    });
  });

  it("maps the pointed arm 10 golden without inventing Stun penalty mechanics", () => {
    // AppFacing_Crits!A523:X523; AppFacing_Effects!A1775:AE1778.
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 10,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "pointed",
    });

    expect(proposal.criticalResult?.critKey).toBe("pointed_weapons|arm|10");
    expect(proposal).toMatchObject({
      minDamageSourceEffectKey: "pointed_weapons|arm|10|01",
      minTotalDamage: 5,
    });
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        accepted: false,
        modifierValue: undefined,
        rowCategory: "special_note",
        sourceEffectKey: "pointed_weapons|arm|10|02",
      }),
    );
    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        accepted: true,
        rateValuePerRound: 10,
        rowCategory: "bleed",
        sourceEffectKey: "pointed_weapons|arm|10|03",
      }),
    );
    expect(
      getCriticalResultWithEffects("pointed_weapons", "arm", 10)?.effects.find(
        (effect) => effect.effectKey === "pointed_weapons|arm|10|03",
      ),
    ).toMatchObject({
      durationMode: "ongoing",
      durationRaw: "until staunched",
      endTrigger: "staunched_or_resolved",
      rateMode: "fixed_fraction",
      rateRaw: "1 HP / round",
      sourceField: "ext_bleed_rate",
      sourceValue: "1 HP / round",
      target: "arm",
      type: "Bleed",
    });
    expect(proposal.warnings.join(" ")).toContain("Stun penalty interpretation is unresolved");
  });

  it("keeps non-tenth bleed fractions as inactive source-linked notes", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 5,
      selectedHitLocation: "abdomen",
      weaponDamageClass: "pointed",
    });
    const unsupportedBleed = proposal.proposedEffects.find(
      (effect) => effect.sourceEffectKey === "pointed_weapons|abdomen|05|03",
    );

    expect(unsupportedBleed).toMatchObject({
      accepted: false,
      kind: "note",
      rowCategory: "special_note",
      sourceCritKey: "pointed_weapons|abdomen|05",
    });
    expect(unsupportedBleed).not.toHaveProperty("rateValuePerRound");
    expect(proposal.warnings.join(" ")).toContain(
      "cannot be represented exactly as integer tenths per round",
    );
  });
});
