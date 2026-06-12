import { describe, expect, it } from "vitest";

import { buildCriticalEffectProposalFromDamageResult } from "./criticalEffectProposal";

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
    expect(proposal.warnings.join(" ")).toContain("outside the supported critical table index range");
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

  it("keeps physical minimum damage floors as notes instead of duplicate damage rows", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 2,
      finalCriticalRoll: 13,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });
    const minimumFloor = proposal.proposedEffects.find(
      (effect) => effect.sourceEffectKey === "sharp|arm|13|01",
    );

    expect(minimumFloor).toMatchObject({
      kind: "note",
      label: "Minimum damage floor 5",
      sourceCritKey: "sharp|arm|13",
      sourceKind: "critical_table",
    });
    expect(minimumFloor?.notes).toContain("GM may add 3 damage");
  });

  it("maps structured numeric modifier templates to editable modifier drafts", () => {
    const proposal = buildCriticalEffectProposalFromDamageResult({
      existingCommittedDamageAmount: 1,
      finalCriticalRoll: 1,
      selectedHitLocation: "leftArm",
      weaponDamageClass: "edged",
    });

    expect(proposal.proposedEffects).toContainEqual(
      expect.objectContaining({
        kind: "modifier",
        modifierBucket: "obSkill",
        modifierValue: -1,
        sourceEffectKey: "sharp|arm|01|01",
      }),
    );
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
        label: "vision_penalty",
        sourceEffectKey: "sharp|head|07|02",
      }),
    );
  });
});
