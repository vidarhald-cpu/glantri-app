import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/lib/api/apiClient";

import {
  COMBAT_REFUSAL_CODES_RELOAD_CANNOT_REPAIR,
  getCombatRefusalSentence,
  isCombatRefusalReloadCannotRepair,
  readCombatRefusalPayload,
} from "./combatRefusalPresentation";

/**
 * #922 repair cycle 1, finding 3 — the honest refusal sentence has to reach a screen.
 *
 * The server grew two cause-aware refusal sentences under #922 and neither reached the GM or the
 * player: the GM panel replaced every unlisted coded `409` with "review it before retrying", the
 * advice #690 established produces a loop for a refusal reloading cannot repair, and the player
 * page had no branch for either. This module is the single list both consumers read, so they
 * cannot drift apart again.
 */
describe("#922 combat refusals a reload cannot repair carry the server's own sentence", () => {
  const WORKBOOK_ADJUSTMENT_REFUSAL =
    "This opponent's defence works out to a value this calculation has no reading for, so the attack cannot be resolved. Nothing was recorded. This is not something the opponent's skills or equipment can repair; report it with the opponent's defence figures.";

  function refusal(payload: unknown, status = 409) {
    return new ApiRequestError("Request failed.", status, payload);
  }

  it("names every refusal #690, #694 and #922 established as unrepairable by reloading", () => {
    expect([...COMBAT_REFUSAL_CODES_RELOAD_CANNOT_REPAIR].sort()).toEqual([
      "attack_context_unavailable",
      "attack_defender_defense_unavailable",
      "attacker_modifier_out_of_range",
      "defense_context_unavailable",
    ]);
    for (const code of COMBAT_REFUSAL_CODES_RELOAD_CANNOT_REPAIR) {
      expect(isCombatRefusalReloadCannotRepair(code), code).toBe(true);
    }
    // A refusal a reload does repair keeps the refresh-and-retry handling.
    for (const code of ["stale_revision", "combat_pair_disengaged", "defense_review_unavailable"]) {
      expect(isCombatRefusalReloadCannotRepair(code), code).toBe(false);
    }
  });

  it("reads the code and the server's sentence off a coded 409", () => {
    expect(
      readCombatRefusalPayload(
        refusal({ code: "defense_context_unavailable", error: WORKBOOK_ADJUSTMENT_REFUSAL }),
      ),
    ).toEqual({
      code: "defense_context_unavailable",
      serverMessage: WORKBOOK_ADJUSTMENT_REFUSAL,
    });
  });

  it("returns the server's sentence for a refusal reloading cannot repair", () => {
    // The #922 negative-base refusal: the sentence the server wrote for it is the sentence shown.
    expect(
      getCombatRefusalSentence({
        code: "defense_context_unavailable",
        serverMessage: WORKBOOK_ADJUSTMENT_REFUSAL,
      }),
    ).toBe(WORKBOOK_ADJUSTMENT_REFUSAL);

    // The other #922 sentence, which the GM panel's `code.includes("modifier")` branch previously
    // answered with the refresh-and-retry advice.
    expect(
      getCombatRefusalSentence({
        code: "attacker_modifier_out_of_range",
        serverMessage:
          "This attack's OB works out to a value this calculation has no reading for, so it cannot be resolved. Nothing was rolled. Report it with the attacker's OB figures.",
      }),
    ).toContain("no reading for");
  });

  it("returns nothing for a refusal reloading does repair, and nothing without a sentence", () => {
    // `stale_revision` is repaired by the refresh the caller already performs, so its own copy wins.
    expect(
      getCombatRefusalSentence({ code: "stale_revision", serverMessage: "Refresh combat." }),
    ).toBeUndefined();
    // A refusal of the unrepairable kind that arrives without a sentence leaves the caller its
    // existing fallback for that code rather than showing an empty message.
    expect(
      getCombatRefusalSentence({ code: "attack_defender_defense_unavailable" }),
    ).toBeUndefined();
    expect(
      getCombatRefusalSentence({ code: "defense_context_unavailable", serverMessage: "   " }),
    ).toBeUndefined();
  });

  it("ignores anything that is not a coded 409", () => {
    expect(readCombatRefusalPayload(new Error("boom"))).toBeUndefined();
    expect(readCombatRefusalPayload(refusal({ code: "stale_revision" }, 400))).toBeUndefined();
    expect(readCombatRefusalPayload(refusal({ error: "No code here." }))).toBeUndefined();
    expect(readCombatRefusalPayload(refusal(undefined))).toBeUndefined();
    expect(readCombatRefusalPayload(refusal({ code: 7 }))).toBeUndefined();
  });

  it("reads the sentence off the payload shape the API client actually builds", () => {
    // `parseResponse` puts the whole JSON body on `payload` and the body's `error` on `message`,
    // so a production refusal carries both. Shaped like a real one rather than asserted in prose.
    const production = new ApiRequestError(WORKBOOK_ADJUSTMENT_REFUSAL, 409, {
      code: "defense_context_unavailable",
      error: WORKBOOK_ADJUSTMENT_REFUSAL,
    });
    const read = readCombatRefusalPayload(production);

    expect(read).toBeDefined();
    expect(getCombatRefusalSentence(read!)).toBe(WORKBOOK_ADJUSTMENT_REFUSAL);
  });
});
