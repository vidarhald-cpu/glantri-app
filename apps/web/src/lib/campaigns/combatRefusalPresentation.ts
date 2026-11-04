import { ApiRequestError } from "@/lib/api/apiClient";

/**
 * The combat refusals a reload cannot repair, and the sentence the server already wrote for each
 * (#922 repair cycle 1, finding 3).
 *
 * #690 established that telling a solo GM to refresh and retry a refusal reloading cannot repair
 * sends them round a loop with nothing to show for it, and split the two refusals of that kind out
 * with their own sentences. #694 did the same for the missile defence. #922 then added two more
 * — a defence the rule has no reading of, and an attack OB the same — and **neither reached a
 * screen**: the GM panel turns every coded `409` into its own sentence for a short list of codes
 * and the refresh-and-retry fallback for everything else, which is where both new codes landed;
 * one of them even matched the panel's `code.includes("modifier")` branch and was told to refresh.
 *
 * The list lives here, once, because the two consumers of these refusals are different files and
 * the first attempt at this drifted between them. The server authors the sentence, because the
 * server is where the cause is known: a client restatement cannot distinguish a defence below zero
 * from a defender with no Dodge, and three of these codes already carried a client copy of the
 * server's own words that had to be kept in step by hand.
 */
export const COMBAT_REFUSAL_CODES_RELOAD_CANNOT_REPAIR = [
  // #690: the attacker has no weapon or combat skill this attack can use.
  "attack_context_unavailable",
  // #690: the defender genuinely has no defensive skill.
  "attack_defender_defense_unavailable",
  // #922: this attack's OB works out to a value the calculation has no reading for.
  "attacker_modifier_out_of_range",
  // #694, extended to melee by #922: the cause-aware defence refusal, including a defence value
  // the rule has no reading of.
  "defense_context_unavailable",
] as const;

export type CombatRefusalReloadCannotRepairCode =
  (typeof COMBAT_REFUSAL_CODES_RELOAD_CANNOT_REPAIR)[number];

export function isCombatRefusalReloadCannotRepair(
  code: string,
): code is CombatRefusalReloadCannotRepairCode {
  return (COMBAT_REFUSAL_CODES_RELOAD_CANNOT_REPAIR as readonly string[]).includes(code);
}

export interface CombatRefusalPayload {
  code: string;
  serverMessage?: string;
}

/**
 * The `code` and the server's own sentence from a refused combat mutation, or `undefined` when the
 * error is not a coded `409`.
 */
export function readCombatRefusalPayload(error: unknown): CombatRefusalPayload | undefined {
  if (
    !(error instanceof ApiRequestError) ||
    error.status !== 409 ||
    !error.payload ||
    typeof error.payload !== "object" ||
    !("code" in error.payload) ||
    typeof error.payload.code !== "string"
  ) {
    return undefined;
  }

  const payload = error.payload as { code: string; error?: unknown };
  return {
    code: payload.code,
    serverMessage:
      typeof payload.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : undefined,
  };
}

/**
 * The sentence to show for a refusal reloading cannot repair: the server's, which names the cause
 * the server established. `undefined` for every other refusal, which leaves the caller's own
 * refresh-and-retry handling in place, and `undefined` when a refusal of this kind arrives without
 * a sentence, which leaves the caller its existing fallback copy for that code.
 */
export function getCombatRefusalSentence(refusal: CombatRefusalPayload): string | undefined {
  if (!isCombatRefusalReloadCannotRepair(refusal.code)) {
    return undefined;
  }
  // Checked here as well as where the payload is read, because a caller may build the payload
  // itself: a blank sentence must leave the caller its own fallback, never blank the message.
  return refusal.serverMessage && refusal.serverMessage.trim().length > 0
    ? refusal.serverMessage
    : undefined;
}
