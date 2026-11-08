import type { CombatRoundAttackRollResult } from "./combatRoundManager";
import {
  playerFacingCombatRoundAttackRollResultSchema,
  type PlayerFacingCombatRoundAttackRollResult,
} from "./playerFacingCombatRoundParticipant";
import { buildPlayerFacing } from "./playerFacingSchema";

/**
 * A stored attack result as the player who owns it receives it (Forgejo #1044).
 *
 * This is the one allow-list for a player's own attack result outside the player-facing round
 * state. It is built from `playerFacingCombatRoundAttackRollResultSchema`, which **names** every
 * field a player receives, so a field added to the stored attack result later is absent from
 * player output until somebody names it there. The fields the stored result carries and this does
 * not are the roller's account identity (`rolledByUserId`), the workbook import provenance
 * (`weaponModeSourceMetadata`, `weaponDmbRoll` — control-plane ruling E2, #517) and the
 * extrapolation flag (`extrapolatedWorkbookAdjustments`), which #922 declared GM-only and the
 * Product Owner confirmed GM-only on 2026-11-08 (#1002 comment 23577).
 *
 * Two player outputs read it:
 *
 * - the roll-attack response's `attackResult` (and, through it, the compact contract's
 *   `mutationPresentation`), where #922 repair cycle 1 (`02adfbd5`) first introduced this
 *   allow-list as a route-local helper;
 * - the combat history's snapshot panel `panels.actionResult.attackResult`, which copied the whole
 *   stored result and removed only `rolledByUserId`, so the extrapolation flag and the import
 *   provenance reached the rolling player through `GET /encounters/:id/combat-history` (#1044).
 *
 * A GM's output does not go through this; a GM receives the stored value.
 */
export function projectPlayerOwnAttackResult(
  attack: CombatRoundAttackRollResult,
): PlayerFacingCombatRoundAttackRollResult;
export function projectPlayerOwnAttackResult(
  attack: CombatRoundAttackRollResult | undefined,
): PlayerFacingCombatRoundAttackRollResult | undefined;
export function projectPlayerOwnAttackResult(
  attack: CombatRoundAttackRollResult | undefined,
): PlayerFacingCombatRoundAttackRollResult | undefined {
  return attack && buildPlayerFacing(playerFacingCombatRoundAttackRollResultSchema, attack);
}
