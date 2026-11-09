import { describe, expect, it } from "vitest";

import {
  buildPlayerFacing,
  combatRoundAttackRollResultSchema,
  playerFacingCombatRoundAttackRollResultSchema,
  projectPlayerOwnAttackResult,
  type CombatRoundAttackRollResult,
} from "../index";

/**
 * Forgejo #1044 — the one allow-list for a player's own attack result.
 *
 * The fixture populates every field the stored attack result has, the GM-only ones included, so
 * that an omission is testable: a fixture that left `extrapolatedWorkbookAdjustments` empty could
 * not tell an allow-list from the denylist it replaced.
 */
const GM_ONLY_ATTACK_RESULT_FIELDS = [
  "extrapolatedWorkbookAdjustments",
  "rolledByUserId",
  "weaponDmbRoll",
  "weaponModeSourceMetadata",
] as const;

function storedFlaggedAttack(): CombatRoundAttackRollResult {
  return combatRoundAttackRollResultSchema.parse({
    actionId: "attack_parry",
    attackIndex: 1,
    attackModeId: "mode-spear-thrust",
    attackOpportunityId: "opportunity-1",
    attackPhaseDefensivePenalty: {
      activationCutoff: "phase_start",
      application: "percentage",
      attackIndex: 1,
      attackOpportunityId: "opportunity-1",
      attackProcessId: "process-attack",
      commitment: "committed",
      completeness: "complete",
      duration: "phase",
      executionState: "executed",
      id: "penalty-opportunity-1",
      participantId: "aria",
      penalty: -1,
      phase: "phase1",
      reason: "ordinary_committed_attack",
      roundNumber: 1,
      sourceException: "none",
    },
    attackSlot: "attack_1",
    attackType: "melee",
    attackerParticipantId: "aria",
    declarationId: "declaration-aria",
    defenderDb: -11,
    defenderParryModifier: 0,
    defenderParticipantId: "borin",
    extrapolatedWorkbookAdjustments: ["defender_db"],
    grazing: false,
    hit: true,
    kind: "attackRoll",
    lookupTotal: 30,
    marginOverMissThreshold: 20,
    ob: 8,
    openEndedD10s: [],
    phase: "phase1",
    rollD20: 11,
    rollTotal: 11,
    rolledAt: "2026-11-08T10:00:00.000Z",
    rolledByUserId: "SECRET_ROLLER_ACCOUNT",
    tableResult: "C",
    weaponArmorClass: "A",
    weaponCriticalCode: "S",
    weaponDamageClass: "B",
    weaponDmb: 7,
    weaponDmbFormula: { diceCount: 2, diceSides: 6, kind: "dice", raw: "2d6+1" },
    weaponDmbRaw: "2d6+1",
    weaponDmbRoll: {
      diceCount: 2,
      diceSides: 6,
      flatModifier: 1,
      provenance: "SECRET_DMB_SHEET:12:2d6+1",
      rolls: [3, 3],
      total: 7,
    },
    weaponInstanceId: "item-spear",
    weaponModeInitiative: 2,
    weaponModeRange: "melee",
    weaponModeSourceMetadata: {
      rawRow: { A: "SECRET_RAW_ROW_CELL" },
      row: 12,
      sheet: "Weapon2",
      sourceColumns: { name: "A" },
      sourceRange: "A12:Q12",
      workbook: "SECRET_WORKBOOK.xlsx",
    },
    weaponName: "Spear",
    weaponSecondaryCriticalCode: "K",
    weaponSourceId: "item-spear",
    weaponSourceSlot: "primary",
    weaponTemplateId: "weapon-template-spear",
  });
}

const storedShapeKeys = () =>
  Object.keys(combatRoundAttackRollResultSchema.innerType().innerType().shape).sort();

describe("projectPlayerOwnAttackResult (#1044)", () => {
  it("is fed a fixture that carries every stored field, the GM-only ones included", () => {
    const stored = storedFlaggedAttack();
    // `roll` is the legacy alias the stored schema transforms away; every other stored key is set.
    expect(Object.keys(stored).sort()).toEqual(storedShapeKeys().filter((key) => key !== "roll"));
    for (const field of GM_ONLY_ATTACK_RESULT_FIELDS) {
      expect(stored[field], field).toBeDefined();
    }
  });

  it("withholds exactly the GM-only fields and keeps every other stored field unchanged", () => {
    const stored = storedFlaggedAttack();
    const projected = projectPlayerOwnAttackResult(stored) as unknown as Record<string, unknown>;

    expect(Object.keys(projected).sort()).toEqual(
      Object.keys(stored)
        .filter((key) => !(GM_ONLY_ATTACK_RESULT_FIELDS as readonly string[]).includes(key))
        .sort(),
    );
    for (const [key, value] of Object.entries(projected)) {
      expect(value, key).toEqual((stored as unknown as Record<string, unknown>)[key]);
    }
    expect(JSON.stringify(projected)).not.toMatch(
      /extrapolatedWorkbookAdjustments|SECRET_(ROLLER_ACCOUNT|RAW_ROW_CELL|WORKBOOK|DMB_SHEET)/,
    );
    // The player's copy still parses through the stored schema, which the client reads it with.
    expect(() => combatRoundAttackRollResultSchema.parse(projected)).not.toThrow();
  });

  /**
   * The allow-list is a decision about the whole stored shape. A field added to the stored attack
   * result fails this until somebody decides whether players receive it — by naming it in
   * `playerFacingCombatRoundAttackRollResultSchema` or adding it here as withheld.
   */
  it("names every stored field but the four GM-only ones", () => {
    const named = Object.keys(playerFacingCombatRoundAttackRollResultSchema.unwrap().shape).sort();
    expect(storedShapeKeys().filter((key) => !named.includes(key))).toEqual([
      ...GM_ONLY_ATTACK_RESULT_FIELDS,
    ]);
  });

  it("is the allow-list the roll-attack response used, byte for byte", () => {
    const stored = storedFlaggedAttack();
    expect(JSON.stringify(projectPlayerOwnAttackResult(stored))).toBe(
      JSON.stringify(buildPlayerFacing(playerFacingCombatRoundAttackRollResultSchema, stored)),
    );
  });

  it("passes an absent attack through as absent", () => {
    expect(projectPlayerOwnAttackResult(undefined)).toBeUndefined();
  });
});
