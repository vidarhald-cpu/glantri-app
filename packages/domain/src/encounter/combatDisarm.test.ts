import { describe, expect, it } from "vitest";

import {
  evaluateCombatDisarmContactGate,
  resolveCombatDisarmAttempt,
  resolveCombatDisarmContactQualityModifier,
  resolveCombatDisarmResult,
} from "./combatDisarm";

describe("combat Disarm source tables and contact gates", () => {
  it("protects every exact result-band boundary", () => {
    expect(resolveCombatDisarmResult(-20).id).toBe("no_effect");
    expect(resolveCombatDisarmResult(0).id).toBe("no_effect");
    expect(resolveCombatDisarmResult(5).id).toBe("no_effect");
    expect(resolveCombatDisarmResult(6).id).toBe("unbalanced");
    expect(resolveCombatDisarmResult(10).id).toBe("unbalanced");
    expect(resolveCombatDisarmResult(11).id).toBe("disarmed");
    expect(resolveCombatDisarmResult(15).id).toBe("disarmed");
    expect(resolveCombatDisarmResult(16).id).toBe("disarmed_unbalanced");
    expect(resolveCombatDisarmAttempt({ actingTotal: 30, resistingTotal: 14 })).toMatchObject({
      difference: 16,
      result: { disarmed: true, unbalanced: true },
    });
  });

  it("protects contact-quality boundaries and +4 cap", () => {
    expect(resolveCombatDisarmContactQualityModifier(0).modifier).toBe(0);
    expect(resolveCombatDisarmContactQualityModifier(5).modifier).toBe(0);
    expect(resolveCombatDisarmContactQualityModifier(6).modifier).toBe(1);
    expect(resolveCombatDisarmContactQualityModifier(10).modifier).toBe(1);
    expect(resolveCombatDisarmContactQualityModifier(11).modifier).toBe(2);
    expect(resolveCombatDisarmContactQualityModifier(15).modifier).toBe(2);
    expect(resolveCombatDisarmContactQualityModifier(16).modifier).toBe(4);
    expect(resolveCombatDisarmContactQualityModifier(100).modifier).toBe(4);
  });

  it("keeps reactive passive without an attack and only Continued Contact skips proactive hit", () => {
    expect(evaluateCombatDisarmContactGate({ method: "reactive_parry", prepared: true })).toEqual({
      contactQualityModifier: 0,
      eligible: false,
      reason: "no_incoming_attack",
    });
    expect(
      evaluateCombatDisarmContactGate({
        incomingAttackResultId: "attack",
        method: "reactive_parry",
        prepared: true,
        successfulParryMargin: 11,
      }),
    ).toEqual({ contactQualityModifier: 2, eligible: true });
    expect(
      evaluateCombatDisarmContactGate({
        activeContinuedContact: false,
        attackHit: false,
        method: "proactive",
      }).eligible,
    ).toBe(false);
    expect(
      evaluateCombatDisarmContactGate({
        activeContinuedContact: true,
        attackHit: false,
        method: "proactive",
      }).eligible,
    ).toBe(true);
  });
});
