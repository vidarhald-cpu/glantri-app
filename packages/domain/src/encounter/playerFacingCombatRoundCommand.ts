import { z } from "zod";

import {
  combatRoundCommandSchema,
  combatRoundCursorSchema,
  type CombatRoundCommand,
} from "./combatRoundManager";
import { LEAF, playerFacingObject, TIER_4_OPEN_COMMAND_FACTS } from "./playerFacingSchema";

/**
 * The player-facing combat-round command, Forgejo issue #502 (privacy hardening, Tier 1).
 *
 * Any command reaching a non-GM actor is an instance of this type. Its fields are enumerated
 * additively below: a player command is built from named envelope fields plus an explicitly
 * enumerated `facts` object, never by spreading or deleting from a stored `CombatRoundCommand`.
 * Adding a field to `combatRoundCommandSchema` therefore changes nothing a player can see.
 *
 * There is deliberately no actor identity (`createdByUserId`): it is stripped by construction
 * rather than per projection branch.
 *
 * The type is branded. Every field of this shape also exists on `CombatRoundCommand`, so without
 * the brand a stored command would be structurally assignable to it and the compiler could not
 * tell a raw command from a projected one. The brand makes `buildPlayerFacingCombatRoundCommand`
 * the only way to produce a value of this type.
 *
 * `facts` remains an open record at the type level (`TIER_4_OPEN_COMMAND_FACTS`, the one open value
 * the Tier 3 whole-path check admits). Facts-level allow-lists for every command type are Tier 4;
 * each projection enumerates its facts by name at runtime. The cursors are player-facing objects
 * (#517 Tier 3), parsed from the stored cursors so only their three named fields remain.
 */
export const playerFacingCombatRoundCursorSchema = playerFacingObject(
  "PlayerFacingCombatRoundCursor",
  combatRoundCursorSchema,
  { participantId: LEAF, roundNumber: LEAF, step: LEAF },
);
export type PlayerFacingCombatRoundCursor = z.infer<typeof playerFacingCombatRoundCursorSchema>;

export const playerFacingCombatRoundCommandSchema = playerFacingObject(
  "PlayerFacingCombatRoundCommand",
  combatRoundCommandSchema,
  {
    afterCursor: playerFacingCombatRoundCursorSchema,
    beforeCursor: playerFacingCombatRoundCursorSchema,
    createdAt: LEAF,
    facts: TIER_4_OPEN_COMMAND_FACTS,
    id: LEAF,
    participantId: LEAF,
    phase: LEAF,
    roundNumber: LEAF,
    step: LEAF,
    type: LEAF,
  },
);
export type PlayerFacingCombatRoundCommand = z.infer<typeof playerFacingCombatRoundCommandSchema>;

/**
 * Builds a player command from the named envelope fields of a stored command and a facts object
 * the caller has already enumerated field by field. The key order matches
 * `combatRoundCommandSchema`, so a projection that previously spread the stored command
 * serializes identically apart from the actor identity this type never carries.
 */
export function buildPlayerFacingCombatRoundCommand(input: {
  command: CombatRoundCommand;
  facts: Record<string, unknown>;
}): PlayerFacingCombatRoundCommand {
  return playerFacingCombatRoundCommandSchema.parse({
    afterCursor: input.command.afterCursor,
    beforeCursor: input.command.beforeCursor,
    createdAt: input.command.createdAt,
    facts: input.facts,
    id: input.command.id,
    participantId: input.command.participantId,
    phase: input.command.phase,
    roundNumber: input.command.roundNumber,
    step: input.command.step,
    type: input.command.type,
  });
}
