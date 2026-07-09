import { describe, expect, it } from "vitest";

import { getPlayerCombatModifierDisplayPhase } from "./playerCombatModifierPhase";

describe("getPlayerCombatModifierDisplayPhase", () => {
  it("previews Reactive attack phase 2 modifiers during declaration and phase 1 review", () => {
    expect(
      getPlayerCombatModifierDisplayPhase({
        actionId: "parry_attack",
        step: "select_actions",
      }),
    ).toBe("phase2");
    expect(
      getPlayerCombatModifierDisplayPhase({
        actionId: "parry_attack",
        step: "review_action_modifiers",
      }),
    ).toBe("phase2");
  });

  it("keeps Single attack on the current step phase", () => {
    expect(
      getPlayerCombatModifierDisplayPhase({
        actionId: "attack_parry",
        step: "select_actions",
      }),
    ).toBe("phase1");
    expect(
      getPlayerCombatModifierDisplayPhase({
        actionId: "attack_parry",
        step: "review_action_modifiers",
      }),
    ).toBe("phase1");
    expect(
      getPlayerCombatModifierDisplayPhase({
        actionId: "attack_parry",
        step: "review_phase_2_modifiers",
      }),
    ).toBe("phase2");
  });
});
