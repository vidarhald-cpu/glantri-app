import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildPlayerFacingCombatContext,
  buildPlayerFacingScenarioParticipant,
  mergePlayerSubmittedScenarioParticipantState,
  withoutWorkbookImportProvenance,
  type PlayerFacingScenarioParticipant,
} from "../campaign/playerFacingScenarioParticipant";
import {
  armorComponentKey,
  resolveEffectiveItemTemplate,
  type ItemMechanicalOverride,
} from "../equipment/itemOverrides";
import type { EquipmentTemplate } from "../equipment/types";
import * as domain from "../index";
import {
  scenarioParticipantCombatContextSchema,
  scenarioParticipantSchema,
  scenarioParticipantStateSchema,
  type ScenarioParticipant,
} from "../campaign/scenario";
import { combatRoundCommandSchema, type CombatRoundCommand } from "./combatRoundManager";
import {
  canonicalCombatModifierEffectSchema,
  transitionCanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";
import { buildCanonicalCombatModifierReviewFromDraft } from "./combatModifierReviewProjection";
import {
  buildPlayerFacingCombatRoundCommand,
  type PlayerFacingCombatRoundCommand,
} from "./playerFacingCombatRoundCommand";
import {
  buildPlayerFacingEncounterSession,
  type PlayerFacingEncounterSession,
} from "./playerFacingEncounterSession";
import { encounterSessionSchema, type EncounterSession } from "./session";

/**
 * Forgejo #502 (privacy hardening, Tier 1): the declared player-facing types.
 *
 * The first block is a compile-time proof. Each `@ts-expect-error` asserts that a stored value is
 * NOT assignable to its player-facing type; if it ever became assignable, the directive would be
 * unused and `tsc` (run over test files by `pnpm typecheck`) would fail.
 */
const NAMED_PRIVATE_KEYS = [
  "canonicalTransitions",
  "canonicalLifecycle",
  "gmOverride",
  "privateDiagnostic",
  "createdByUserId",
  "nextEffect",
  "previousEffect",
] as const;

function keysAnywhere(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysAnywhere(entry, found);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) found.add(key);
      keysAnywhere(nested, found);
    }
  }
  return found;
}

function storedCommand(): CombatRoundCommand {
  return combatRoundCommandSchema.parse({
    afterCursor: { participantId: "guard", roundNumber: 3, step: "A1" },
    beforeCursor: { participantId: "hero", roundNumber: 3, step: "A1" },
    createdAt: "2026-10-04T10:00:00.000Z",
    createdByUserId: "SECRET_ACTOR_USER",
    facts: { nextEffect: { id: "SECRET_NEXT" }, previousEffect: { id: "SECRET_PREVIOUS" } },
    id: "command-1",
    participantId: "hero",
    phase: "phase1",
    roundNumber: 3,
    step: "A1",
    type: "skip_phase_action",
  });
}

/** A canonical lifecycle and transition, built by the real engine, with private fields set. */
function canonicalLifecycleWithPrivateMaterial() {
  const context = (rows: unknown[]) =>
    scenarioParticipantCombatContextSchema.parse({
      modifierBuckets: {
        general: rows,
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    });
  const transaction = buildCanonicalCombatModifierReviewFromDraft({
    canonicalCutoff: 5,
    commandId: "command-review",
    createdAt: "2026-10-04T09:00:00.000Z",
    currentContext: context([]),
    draftContext: context([{ durationRounds: 2, id: "row-new", scope: "until", value: -10 }]),
    encounterId: "encounter-1",
    participantState: scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    }),
    phase: "M1",
    revision: "2026-10-04T09:00:00.000Z",
    roundNumber: 3,
    scenarioParticipantId: "participant-1",
  });
  const effect = transaction.outputEffects.find((candidate) => candidate.id === "row-new");
  if (!effect) throw new Error("Expected a canonical effect from the review engine.");
  const transitioned = transitionCanonicalCombatModifierEffect({
    acceptedRevision: "2026-10-04T09:30:00.000Z",
    acceptedSequence: 6,
    effect,
    gmOverride: { reasonCode: "SECRET_GM_OVERRIDE_REASON", userId: "SECRET_GM_USER" },
    nextState: effect.lifecycle.state,
    privateDiagnostic: { code: "SECRET_TRANSITION_DIAGNOSTIC" },
    reason: "duration_decremented",
    transitionId: "transition-1",
    transitionType: "update",
  });
  return {
    lifecycle: canonicalCombatModifierEffectSchema.parse({
      ...transitioned.effect,
      privateDiagnostic: { code: "SECRET_LIFECYCLE_DIAGNOSTIC" },
    }),
    transition: transitioned.transition,
  };
}

function storedParticipantWithPrivateMaterial(): ScenarioParticipant {
  const { lifecycle, transition } = canonicalLifecycleWithPrivateMaterial();
  const modifierEntry = {
    canonicalLifecycle: lifecycle,
    canonicalTransitions: [transition],
    id: lifecycle.id,
    scope: "until",
    value: -10,
  };
  return scenarioParticipantSchema.parse({
    controlledByUserId: "player-1",
    createdAt: "2026-10-04T08:00:00.000Z",
    id: "participant-1",
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: "Hero" },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [modifierEntry],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        declarationSubmittedByUserId: "SECRET_DECLARING_USER",
      },
      combatEffects: {
        effects: [
          {
            canonicalLifecycle: lifecycle,
            canonicalTransitions: [transition],
            createdAt: "2026-10-04T09:00:00.000Z",
            effectGroup: "general",
            id: lifecycle.id,
            sourceEventId: "effect-event-1",
            targetParticipantId: lifecycle.ownerParticipantId,
            type: "general_modifier",
            updatedAt: "2026-10-04T09:30:00.000Z",
          },
        ],
        events: [
          {
            createdAt: "2026-10-04T09:00:00.000Z",
            createdByUserId: "SECRET_EFFECT_AUTHOR",
            id: "effect-event-1",
            targetParticipantId: lifecycle.ownerParticipantId,
          },
        ],
      },
      equipment: {},
      health: {},
      resources: {},
    },
    updatedAt: "2026-10-04T09:30:00.000Z",
  });
}

function storedEncounter(): EncounterSession {
  return encounterSessionSchema.parse({
    createdAt: "2026-10-04T08:00:00.000Z",
    gmPrivateClosingNote: "SECRET_CLOSING_NOTE",
    id: "encounter-1",
    title: "Bridge",
    updatedAt: "2026-10-04T09:00:00.000Z",
  });
}

describe("#502 player-facing types: non-assignability from internal types", () => {
  it("rejects a stored command, participant, and encounter at compile time", () => {
    const command = storedCommand();
    const participant = storedParticipantWithPrivateMaterial();
    const encounter = storedEncounter();

    // @ts-expect-error A stored command is not a player command.
    const rawCommand: PlayerFacingCombatRoundCommand = command;
    // @ts-expect-error A stored participant is not a player participant.
    const rawParticipant: PlayerFacingScenarioParticipant = participant;
    // @ts-expect-error A stored encounter is not a player encounter.
    const rawEncounter: PlayerFacingEncounterSession = encounter;

    expect([rawCommand, rawParticipant, rawEncounter]).toHaveLength(3);
  });

  it("rejects a stored command even when it is field-for-field the player shape", () => {
    // Without the brand this would be assignable: every remaining field exists on both types.
    const { createdByUserId: _actor, ...sameShape } = storedCommand();

    // @ts-expect-error Structural identity is not enough; only the builder produces the type.
    const rawCommand: PlayerFacingCombatRoundCommand = sameShape;

    expect(rawCommand).toBeDefined();
  });

  it("accepts the values the player-facing builders produce", () => {
    const command: PlayerFacingCombatRoundCommand = buildPlayerFacingCombatRoundCommand({
      command: storedCommand(),
      facts: {},
    });
    const participant: PlayerFacingScenarioParticipant = buildPlayerFacingScenarioParticipant(
      storedParticipantWithPrivateMaterial(),
    );
    const encounter: PlayerFacingEncounterSession = buildPlayerFacingEncounterSession({
      combatRoundState: undefined,
      encounter: storedEncounter(),
      itemReferences: undefined,
      participants: [],
      roleplayState: undefined,
    });

    expect([command, participant, encounter]).toHaveLength(3);
  });
});

describe("#502 player-facing types: additive construction", () => {
  it("builds a player command from named envelope fields without the actor identity", () => {
    const command = buildPlayerFacingCombatRoundCommand({
      command: { ...storedCommand(), futureInternalField: "SECRET_FUTURE" } as CombatRoundCommand,
      facts: { choice: "back_out" },
    });

    expect(Object.keys(command)).toEqual([
      "afterCursor",
      "beforeCursor",
      "createdAt",
      "facts",
      "id",
      "participantId",
      "phase",
      "roundNumber",
      "step",
      "type",
    ]);
    expect(command.facts).toEqual({ choice: "back_out" });
    expect(JSON.stringify(command)).not.toContain("SECRET");
  });

  it("keeps every named private key out of the player participant although each is populated", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const storedKeys = keysAnywhere(stored);
    for (const key of NAMED_PRIVATE_KEYS.filter((key) => !key.endsWith("Effect"))) {
      expect(storedKeys.has(key), `fixture must populate ${key}`).toBe(true);
    }

    const player = buildPlayerFacingScenarioParticipant(stored);

    const playerKeys = keysAnywhere(player);
    for (const key of NAMED_PRIVATE_KEYS) expect(playerKeys.has(key)).toBe(false);
    expect(playerKeys.has("declarationSubmittedByUserId")).toBe(false);
    expect(JSON.stringify(player)).not.toContain("SECRET");
    expect(player.state.combatEffects?.effects[0]?.id).toBe(
      stored.state.combatEffects?.effects[0]?.id,
    );
    expect(player.state.combat.combatContext.modifierBuckets.general[0]?.value).toBe(-10);
  });

  // Covers the structures the player-facing participant enumerates. A field added to a canonical
  // field schema it reuses (the build, equipment, health and similar) would be carried.
  it("does not carry an unknown key in a participant structure the player-facing type enumerates", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const effect = stored.state.combatEffects!.effects[0]!;
    const withFutureFields = {
      ...stored,
      futureParticipantField: "SECRET_FUTURE_PARTICIPANT",
      snapshot: { ...stored.snapshot, futureSnapshotField: "SECRET_FUTURE_SNAPSHOT" },
      state: {
        ...stored.state,
        combat: {
          ...stored.state.combat,
          combatContext: {
            ...stored.state.combat.combatContext,
            futureContextField: "SECRET_FUTURE_CONTEXT",
            modifierBuckets: {
              ...stored.state.combat.combatContext.modifierBuckets,
              general: [
                {
                  ...stored.state.combat.combatContext.modifierBuckets.general[0]!,
                  futureEntryField: "SECRET_FUTURE_ENTRY",
                },
              ],
            },
          },
          futureCombatField: "SECRET_FUTURE_COMBAT",
        },
        combatEffects: {
          ...stored.state.combatEffects!,
          effects: [{ ...effect, futureEffectField: "SECRET_FUTURE_EFFECT" }],
          events: [
            {
              ...stored.state.combatEffects!.events[0]!,
              futureEventField: "SECRET_FUTURE_EVENT",
            },
          ],
        },
        futureStateField: "SECRET_FUTURE_STATE",
      },
    } as unknown as ScenarioParticipant;

    expect(JSON.stringify(buildPlayerFacingScenarioParticipant(withFutureFields))).not.toContain(
      "SECRET",
    );
  });

  it("still satisfies the participant contract the active combat response validates", () => {
    const player = buildPlayerFacingScenarioParticipant(storedParticipantWithPrivateMaterial());

    const reparsed = scenarioParticipantSchema.parse(player);

    const reparsedKeys = keysAnywhere(reparsed);
    for (const key of NAMED_PRIVATE_KEYS) expect(reparsedKeys.has(key)).toBe(false);
  });

  it("drops the canonical lifecycle from a projected combat context", () => {
    const stored = storedParticipantWithPrivateMaterial();

    const context = buildPlayerFacingCombatContext(stored.state.combat.combatContext);

    expect(keysAnywhere(context).has("canonicalLifecycle")).toBe(false);
    expect(keysAnywhere(context).has("canonicalTransitions")).toBe(false);
  });

  it("removes the workbook import provenance from the equipment snapshot and keeps the rest (#517 ruling E2)", () => {
    const weaponProvenance = {
      rawRow: { A: "T. Javelin" },
      row: 17,
      sheet: "Weapon2",
      sourceColumns: { name: "A" },
      sourceRange: "A17:K17",
      workbook: "SECRET_WORKBOOK.xlsx",
    };
    const armorProvenance = {
      finishedRow: 5,
      rawRows: { "5": { A: "Mail" } },
      sheet: "Armour",
      sourceColumns: { name: "A" },
      sourceRange: "A5:P5",
      workbook: "SECRET_WORKBOOK.xlsx",
    };
    const shieldProvenance = {
      rawRow: { A: "Round shield" },
      row: 37,
      sheet: "Weapon1",
      sourceColumns: { name: "A" },
      sourceRange: "Weapon1!A37:Q37",
      workbook: "SECRET_WORKBOOK.xlsx",
    };
    const templatesById = {
      "armor-template-mail": {
        category: "armor",
        componentProfiles: [{ name: "Mail", sourceMetadata: armorProvenance }],
        id: "armor-template-mail",
        name: "Mail",
        sourceMetadata: armorProvenance,
      },
      "weapon-template-javelin": {
        attackModes: [
          { id: "mode-1", ob: 10, provenance: "imported", sourceMetadata: weaponProvenance },
        ],
        category: "weapon",
        id: "weapon-template-javelin",
        name: "Javelin",
        sourceMetadata: weaponProvenance,
      },
      // A shield carries the same import provenance under two other names (QA F1).
      "shield-template-round": {
        attackModes: [
          { id: "mode-1", ob: 2, provenance: "imported", sourceMetadata: weaponProvenance },
        ],
        category: "shield",
        defensiveSourceMetadata: shieldProvenance,
        defensiveValue: 3,
        id: "shield-template-round",
        name: "Round shield",
        offensiveSourceMetadata: shieldProvenance,
        shieldBonus: 15,
      },
    };
    const stored = storedParticipantWithPrivateMaterial();
    const withEquipment = scenarioParticipantSchema.parse({
      ...stored,
      snapshot: {
        ...stored.snapshot,
        equipmentState: { itemsById: {}, templates: { templatesById }, templatesById },
      },
    });

    const player = buildPlayerFacingScenarioParticipant(withEquipment);

    const playerKeys = keysAnywhere(player);
    for (const key of ["sourceMetadata", "offensiveSourceMetadata", "defensiveSourceMetadata"]) {
      expect(playerKeys.has(key), key).toBe(false);
    }
    expect(JSON.stringify(player)).not.toContain("SECRET");
    expect(JSON.stringify(player)).not.toContain("A17:K17");
    expect(JSON.stringify(player)).not.toContain("A37:Q37");
    const equipment = player.snapshot.equipmentState as {
      templates: { templatesById: Record<string, Record<string, unknown>> };
      templatesById: Record<string, Record<string, unknown>>;
    };
    for (const playerTemplates of [equipment.templatesById, equipment.templates.templatesById]) {
      expect(playerTemplates["weapon-template-javelin"]).toEqual({
        attackModes: [{ id: "mode-1", ob: 10, provenance: "imported" }],
        category: "weapon",
        id: "weapon-template-javelin",
        name: "Javelin",
      });
      expect(playerTemplates["armor-template-mail"]).toEqual({
        category: "armor",
        componentProfiles: [{ name: "Mail" }],
        id: "armor-template-mail",
        name: "Mail",
      });
      expect(playerTemplates["shield-template-round"]).toEqual({
        attackModes: [{ id: "mode-1", ob: 2, provenance: "imported" }],
        category: "shield",
        defensiveValue: 3,
        id: "shield-template-round",
        name: "Round shield",
        shieldBonus: 15,
      });
    }
    // The stored participant, which the GM path reads, keeps every one of them.
    const storedKeys = keysAnywhere(withEquipment);
    for (const key of ["sourceMetadata", "offensiveSourceMetadata", "defensiveSourceMetadata"]) {
      expect(storedKeys.has(key), key).toBe(true);
    }
  });

  /**
   * QA run 2, F-A and F-B: an armor component's identity (`armorComponentKey`) is derived from the
   * `sourceMetadata` the strip removes, so an override revealed to the holder no longer found its
   * component, and resolving the effective template threw "This Equipment input cannot be
   * overridden." on the player combat page. The component a revealed override targets now keeps
   * that identity as `componentKey`, and no other component carries one (rulings 2026-10-07).
   */
  it("keeps an armor component's identity only where a revealed override targets it, and the override resolves (#517 F-A, F-B)", () => {
    const componentSource = (finishedRow: number) => ({
      finishedRow,
      rawRows: { [String(finishedRow)]: { A: "SECRET_RAW_ROW" } },
      sheet: "Armor",
      sourceColumns: { name: "A" },
      sourceRange: `A${finishedRow}:P${finishedRow}`,
      workbook: "SECRET_WORKBOOK.xlsx",
    });
    const storedJerkin = {
      category: "armor",
      componentProfiles: [
        {
          encumbranceFactor: 1,
          locationValues: { chest: 2 },
          name: "Jerkin",
          sourceMetadata: componentSource(5),
        },
        {
          encumbranceFactor: 0.25,
          locationValues: { frontArm: 1 },
          name: "Gauntlets",
          sourceMetadata: componentSource(6),
        },
        // A component that already carries an identity no revealed override targets (none is
        // stored today) does not pass it on either.
        {
          componentKey: "SECRET_CARRIED_IDENTITY",
          encumbranceFactor: 0.5,
          locationValues: { frontFoot: 1 },
          name: "Boots",
          sourceMetadata: componentSource(7),
        },
      ],
      id: "armor-template-jerkin",
      name: "Leather Jerkin",
      sourceMetadata: componentSource(5),
    };
    const revealedKey = armorComponentKey(storedJerkin.componentProfiles[0]!);
    const gmOnlyKey = armorComponentKey(storedJerkin.componentProfiles[1]!);
    expect(revealedKey).toBe("SECRET_WORKBOOK.xlsx:Armor:5");
    const overrides: ItemMechanicalOverride[] = [
      {
        componentKey: revealedKey,
        kind: "armor",
        property: "encumbranceFactor",
        value: 0.5,
        visibility: "revealed",
      },
      {
        componentKey: gmOnlyKey,
        kind: "armor",
        property: "frontArm",
        value: 3,
        visibility: "gm_only",
      },
    ];
    const item = {
      displayName: "Leather jerkin",
      id: "item-jerkin",
      mechanicalOverrides: overrides,
      templateId: "armor-template-jerkin",
    };
    const stored = storedParticipantWithPrivateMaterial();
    const withEquipment = scenarioParticipantSchema.parse({
      ...stored,
      snapshot: {
        ...stored.snapshot,
        equipmentState: {
          itemsById: { "item-jerkin": item },
          templates: { templatesById: { "armor-template-jerkin": storedJerkin } },
        },
      },
    });
    const storedBefore = structuredClone(withEquipment);

    const player = buildPlayerFacingScenarioParticipant(withEquipment);

    const equipment = player.snapshot.equipmentState as {
      itemsById: Record<string, typeof item>;
      templates: { templatesById: Record<string, EquipmentTemplate> };
    };
    expect(equipment.templates.templatesById["armor-template-jerkin"]).toEqual({
      category: "armor",
      componentProfiles: [
        {
          componentKey: revealedKey,
          encumbranceFactor: 1,
          locationValues: { chest: 2 },
          name: "Jerkin",
        },
        { encumbranceFactor: 0.25, locationValues: { frontArm: 1 }, name: "Gauntlets" },
        { encumbranceFactor: 0.5, locationValues: { frontFoot: 1 }, name: "Boots" },
      ],
      id: "armor-template-jerkin",
      name: "Leather Jerkin",
    });
    const playerItem = equipment.itemsById["item-jerkin"]!;
    expect(playerItem.mechanicalOverrides).toEqual([overrides[0]]);
    // The only identity strings the player receives are those its revealed overrides carry.
    const serialized = JSON.stringify(player);
    expect(serialized.match(/SECRET_WORKBOOK\.xlsx:Armor:\d+/g)).toEqual([
      revealedKey,
      revealedKey,
    ]);
    expect(serialized).not.toContain(gmOnlyKey);
    expect(serialized).not.toContain("SECRET_CARRIED_IDENTITY");
    expect(serialized).not.toContain("SECRET_RAW_ROW");
    expect(keysAnywhere(player).has("sourceMetadata")).toBe(false);

    // The revealed override resolves on the player's snapshot, as it does for the GM.
    const playerEffective = resolveEffectiveItemTemplate(
      playerItem,
      equipment.templates.templatesById,
    );
    const gmEffective = resolveEffectiveItemTemplate(
      { ...item, mechanicalOverrides: [overrides[0]!] },
      { "armor-template-jerkin": storedJerkin as unknown as EquipmentTemplate },
    );
    if (playerEffective?.category !== "armor" || gmEffective?.category !== "armor") {
      throw new Error("Expected effective armor templates.");
    }
    expect(playerEffective.componentProfiles?.[0]?.encumbranceFactor).toBe(0.5);
    expect(playerEffective.encumbranceFactor).toBe(1.25);
    expect(playerEffective.encumbranceFactor).toBe(gmEffective.encumbranceFactor);

    // The stored participant, which the GM path reads, is unchanged: no identity added.
    expect(withEquipment).toEqual(storedBefore);
  });

  /**
   * The import records the domain's schemas declare today, found by shape, each removed by the
   * snapshot strip (QA run 1, F1). What this proves, and no more (QA run 2, F-C):
   *
   * - every exported zod schema is walked, and a field counts as an import record when its own
   *   schema, after `optional` and `nullable`, is an object with `workbook`, `sheet`, `sourceRange`
   *   and `sourceColumns`, which only the three `Imported…SourceMetadata` schemas have;
   * - the field names found are pinned exactly, so a new field of that kind fails here, whatever its
   *   name, and the strip must remove every field found.
   *
   * It does NOT find an import record inside an array, record, union, default or lazy schema, a
   * provenance object of another shape, or provenance encoded in a string: QA run 2 showed six such
   * variants stay green. The carriers of those kinds today have tests of their own: the armor
   * component identity (above) and the missile `weaponDmbRoll`
   * (`playerFacingCombatRoundParticipant.test.ts`, `combatHistoryProjection.test.ts`).
   */
  it("pins the import-record fields the domain's schemas declare directly, and removes each one", () => {
    const provenanceFields = new Set<string>();
    const seen = new Set<z.ZodTypeAny>();
    const isImportRecord = (schema: z.ZodTypeAny): boolean => {
      let inner = schema;
      while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable)
        inner = inner.unwrap();
      return (
        inner instanceof z.ZodObject &&
        ["workbook", "sheet", "sourceRange", "sourceColumns"].every((key) => key in inner.shape)
      );
    };
    const walk = (schema: z.ZodTypeAny): void => {
      if (seen.has(schema)) return;
      seen.add(schema);
      const def = schema._def as Record<string, unknown> & { typeName?: string };
      if (schema instanceof z.ZodObject) {
        for (const [field, fieldSchema] of Object.entries(schema.shape as z.ZodRawShape)) {
          if (isImportRecord(fieldSchema)) provenanceFields.add(field);
          walk(fieldSchema);
        }
        return;
      }
      if (schema instanceof z.ZodLazy) return walk(schema.schema);
      if (schema instanceof z.ZodRecord) return walk(schema.valueSchema);
      if (schema instanceof z.ZodMap) return walk(schema._def.valueType);
      for (const key of [
        "innerType",
        "schema",
        "type",
        "in",
        "out",
        "left",
        "right",
        "valueType",
      ]) {
        if (def[key] instanceof z.ZodType) walk(def[key] as z.ZodTypeAny);
      }
      for (const key of ["options", "items"]) {
        const value = def[key];
        const entries =
          value instanceof Map ? [...value.values()] : Array.isArray(value) ? value : [];
        for (const entry of entries) if (entry instanceof z.ZodType) walk(entry);
      }
      if (schema instanceof z.ZodArray) walk(schema.element);
    };
    for (const exported of Object.values(domain)) {
      if (exported instanceof z.ZodType) walk(exported);
    }

    // Non-vacuous and exact: the fields that hold an import record directly today.
    expect([...provenanceFields].sort()).toEqual([
      "defensiveSourceMetadata",
      "offensiveSourceMetadata",
      "sourceMetadata",
      "weaponModeSourceMetadata",
    ]);
    const importRecord = {
      rawRow: { A: "x" },
      row: 1,
      sheet: "Sheet",
      sourceColumns: { name: "A" },
      sourceRange: "SECRET_RANGE",
      workbook: "SECRET_WORKBOOK.xlsx",
    };
    for (const field of provenanceFields) {
      const stripped = withoutWorkbookImportProvenance({
        templatesById: { template: { [field]: importRecord, name: "kept" } },
      });
      expect(stripped, field).toEqual({ templatesById: { template: { name: "kept" } } });
    }
  });

  it("copies only the named top-level encounter fields", () => {
    const encounter = buildPlayerFacingEncounterSession({
      combatRoundState: undefined,
      encounter: {
        ...storedEncounter(),
        futureEncounterField: "SECRET_FUTURE_ENCOUNTER",
      } as unknown as EncounterSession,
      itemReferences: undefined,
      participants: [],
      roleplayState: undefined,
    });

    expect(JSON.stringify(encounter)).not.toContain("SECRET");
    expect(encounter).not.toHaveProperty("gmPrivateClosingNote");
    expect(encounter.title).toBe("Bridge");
  });
});

describe("#502 repair: a player saving back the player-facing state", () => {
  /** The state a player now receives, as it comes back in a request body. */
  function receivedState(participant: ScenarioParticipant) {
    return scenarioParticipantStateSchema.parse(
      JSON.parse(JSON.stringify(buildPlayerFacingScenarioParticipant(participant).state)),
    );
  }

  function withEffectChange(
    state: ScenarioParticipant["state"],
    change: Record<string, unknown>,
  ): ScenarioParticipant["state"] {
    const effects = state.combatEffects ?? { effects: [], events: [] };
    return {
      ...state,
      combatEffects: {
        ...effects,
        effects: effects.effects.map((effect) => ({ ...effect, ...change })),
      },
    };
  }

  it("stores exactly the stored state when the received state is saved back unchanged", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const submittedState = receivedState(stored);

    expect(keysAnywhere(submittedState).has("canonicalTransitions")).toBe(false);
    expect(
      mergePlayerSubmittedScenarioParticipantState({ currentState: stored.state, submittedState }),
    ).toEqual(stored.state);
  });

  it("stores exactly the stored state when the stored state is saved back, as before #502", () => {
    const stored = storedParticipantWithPrivateMaterial();

    expect(
      mergePlayerSubmittedScenarioParticipantState({
        currentState: stored.state,
        submittedState: stored.state,
      }),
    ).toEqual(stored.state);
  });

  it("refuses any change to combat effects, visible or not", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const refused = (submittedState: ScenarioParticipant["state"]) =>
      mergePlayerSubmittedScenarioParticipantState({ currentState: stored.state, submittedState });

    expect(refused(withEffectChange(receivedState(stored), { modifierValue: 5 }))).toBeUndefined();
    expect(refused(withEffectChange(stored.state, { modifierValue: 5 }))).toBeUndefined();
    expect(refused(withEffectChange(stored.state, { canonicalTransitions: [] }))).toBeUndefined();
  });

  it("takes the player's visible changes and keeps the correction record of a changed entry", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const submittedState = receivedState(stored);
    submittedState.combat.stance = "defensive";
    submittedState.combat.combatContext.modifierBuckets.general[0]!.value = -5;

    const merged = mergePlayerSubmittedScenarioParticipantState({
      currentState: stored.state,
      submittedState,
    });

    expect(merged?.combat.stance).toBe("defensive");
    expect(merged?.combat.combatContext.modifierBuckets.general).toEqual([
      { ...stored.state.combat.combatContext.modifierBuckets.general[0], value: -5 },
    ]);
    expect(merged?.combat.declarationSubmittedByUserId).toBe("SECRET_DECLARING_USER");
    expect(merged?.combatEffects).toEqual(stored.state.combatEffects);
  });

  // #517 (Tier 3) closes Tier 1 finding F2: matching a stored entry by id across buckets, rather
  // than within the entry's own bucket, failed no test.
  it("keeps each entry's own bucket's correction record when an id occurs in two buckets", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const general = stored.state.combat.combatContext.modifierBuckets.general[0]!;
    const transition = general.canonicalTransitions![0] as {
      gmOverride: Record<string, unknown>;
    };
    const situationDbEntry = {
      ...general,
      canonicalTransitions: [
        { ...transition, gmOverride: { ...transition.gmOverride, reasonCode: "SECRET_DB_REASON" } },
      ],
    };
    const current = {
      ...stored.state,
      combat: {
        ...stored.state.combat,
        combatContext: {
          ...stored.state.combat.combatContext,
          modifierBuckets: {
            ...stored.state.combat.combatContext.modifierBuckets,
            situationDb: [situationDbEntry],
          },
        },
      },
    } as ScenarioParticipant["state"];
    const submittedState = receivedState({ ...stored, state: current });

    const merged = mergePlayerSubmittedScenarioParticipantState({
      currentState: current,
      submittedState,
    });

    expect(merged?.combat.combatContext.modifierBuckets.general).toEqual([general]);
    expect(merged?.combat.combatContext.modifierBuckets.situationDb).toEqual([situationDbEntry]);
  });
});
