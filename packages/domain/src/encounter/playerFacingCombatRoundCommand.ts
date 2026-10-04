import { z } from "zod";

import {
  combatRoundCommandSchema,
  combatRoundCursorSchema,
  type CombatRoundCommand,
  type CombatRoundCursor,
} from "./combatRoundManager";

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
 * `facts` remains an open record at the type level. Facts-level allow-lists for every command
 * type are Tier 4; each projection enumerates its facts by name at runtime.
 */
export const playerFacingCombatRoundCursorSchema = z.object({
  participantId: combatRoundCursorSchema.shape.participantId,
  roundNumber: combatRoundCursorSchema.shape.roundNumber,
  step: combatRoundCursorSchema.shape.step,
});
export type PlayerFacingCombatRoundCursor = z.infer<typeof playerFacingCombatRoundCursorSchema>;

export const playerFacingCombatRoundCommandSchema = z
  .object({
    afterCursor: playerFacingCombatRoundCursorSchema,
    beforeCursor: playerFacingCombatRoundCursorSchema,
    createdAt: combatRoundCommandSchema.shape.createdAt,
    facts: z.record(z.string(), z.unknown()),
    id: combatRoundCommandSchema.shape.id,
    participantId: combatRoundCommandSchema.shape.participantId,
    phase: combatRoundCommandSchema.shape.phase,
    roundNumber: combatRoundCommandSchema.shape.roundNumber,
    step: combatRoundCommandSchema.shape.step,
    type: combatRoundCommandSchema.shape.type,
  })
  .brand<"PlayerFacingCombatRoundCommand">();
export type PlayerFacingCombatRoundCommand = z.infer<typeof playerFacingCombatRoundCommandSchema>;

function buildPlayerFacingCombatRoundCursor(
  cursor: CombatRoundCursor,
): PlayerFacingCombatRoundCursor {
  return {
    participantId: cursor.participantId,
    roundNumber: cursor.roundNumber,
    step: cursor.step,
  };
}

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
    afterCursor: buildPlayerFacingCombatRoundCursor(input.command.afterCursor),
    beforeCursor: buildPlayerFacingCombatRoundCursor(input.command.beforeCursor),
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
