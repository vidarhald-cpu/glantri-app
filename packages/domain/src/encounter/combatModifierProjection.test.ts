import { describe, expect, it } from "vitest";

import type { ScenarioParticipantCombatContext } from "../campaign/scenario";
import type { CombatEffect, CombatEffectsState } from "./combatEffects";
import {
  getMergedCombatModifierTotals,
  mergePersistentCombatEffectModifiers,
  projectPersistentCombatEffectModifiers,
} from "./combatModifierProjection";

function effect(overrides: Partial<CombatEffect> = {}): CombatEffect {
  return {
    combatModifierBucket: "general",
    createdAt: "2026-07-12T10:00:00.000Z",
    damage: 0,
    effectGroup: "general",
    generalDamage: 0,
    id: "effect-1",
    modifierValue: -2,
    sourceEventId: "event-1",
    status: "active",
    targetParticipantId: "participant-1",
    type: "general_modifier",
    updatedAt: "2026-07-12T10:00:00.000Z",
    ...overrides,
  };
}

function effects(...rows: CombatEffect[]): CombatEffectsState {
  return {
    effects: rows,
    events: [
      {
        createdAt: "2026-07-12T10:00:00.000Z",
        description: "Persistent source",
        id: "event-1",
        sourceLabel: "Combat Experience",
        sourceType: "skill_roll",
        targetParticipantId: "participant-1",
      },
    ],
  };
}

function context(): ScenarioParticipantCombatContext {
  return {
    modifierBuckets: {
      general: [{ id: "manual-general", notes: "manual", scope: "until", value: 1 }],
      situationDb: [
        {
          generated: true,
          id: "generated:attack-parry:phase1:db-parry",
          notes: "single attack",
          scope: "until",
          sourcePhase: "phase1",
          value: -4,
        },
      ],
      situationInitiative: [
        {
          generated: true,
          id: "generated:reactive-attack:phase2:initiative",
          notes: "reactive attack",
          scope: "until",
          sourcePhase: "phase2",
          value: 6,
        },
      ],
      situationObSkill: [
        {
          generated: true,
          id: "generated:distance:phase1:ob-skill",
          notes: "long distance",
          scope: "until",
          sourcePhase: "phase1",
          value: -1,
        },
      ],
    },
  };
}

describe("persistent combat modifier projection", () => {
  it.each([
    ["general", "general"],
    ["initiative", "situationInitiative"],
    ["skill_ob", "situationObSkill"],
    ["db_parry", "situationDb"],
  ] as const)("imports an explicit %s modifier", (combatModifierBucket, bucketKey) => {
    const projection = projectPersistentCombatEffectModifiers({
      combatEffects: effects(effect({ combatModifierBucket, modifierValue: 0 })),
    });

    expect(projection.modifierBuckets[bucketKey]).toEqual([
      expect.objectContaining({
        generated: false,
        id: `import:character_effect:effect-1:${combatModifierBucket}`,
        imported: true,
        readOnly: true,
        sourceEffectId: "effect-1",
        sourceType: "character_effect",
        value: 0,
      }),
    ]);
  });

  it.each(["resolved", "expired", "superseded"] as const)(
    "does not import %s effects",
    (status) => {
      const projection = projectPersistentCombatEffectModifiers({
        combatEffects: effects(effect({ status })),
      });

      expect(projection.importedEffectIds).toEqual([]);
      expect(projection.specialEffectCount).toBe(0);
    },
  );

  it("does not import an effect whose explicit expiry round has passed", () => {
    const projection = projectPersistentCombatEffectModifiers({
      combatEffects: effects(effect({ expiresAtRound: 2 })),
      currentRound: 3,
    });

    expect(projection.importedEffectIds).toEqual([]);
  });

  it("requires explicit bucket and modifier value without damage fallbacks", () => {
    const projection = projectPersistentCombatEffectModifiers({
      combatEffects: effects(
        effect({ combatModifierBucket: undefined, id: "missing-bucket" }),
        effect({ id: "missing-value", modifierValue: undefined }),
        effect({
          combatModifierBucket: undefined,
          damage: 12,
          generalDamage: 8,
          id: "damage",
          modifierValue: undefined,
          type: "physical_damage",
        }),
      ),
    });

    expect(projection.importedEffectIds).toEqual([]);
    expect(projection.specialEffectIds).toEqual(["damage", "missing-bucket", "missing-value"]);
    expect(projection.specialEffectCount).toBe(3);
  });

  it("counts active unsupported effects deterministically and excludes inactive effects", () => {
    const projection = projectPersistentCombatEffectModifiers({
      combatEffects: effects(
        effect({ id: "supported" }),
        effect({ combatModifierBucket: undefined, id: "special", type: "special" }),
        effect({ combatModifierBucket: undefined, id: "bleed", type: "bleed" }),
        effect({ combatModifierBucket: undefined, id: "inactive", status: "resolved" }),
      ),
    });

    expect(projection.importedEffectIds).toEqual(["supported"]);
    expect(projection.specialEffectIds).toEqual(["bleed", "special"]);
    expect(projection.specialEffectCount).toBe(2);
  });

  it("replaces only imported rows and is idempotent", () => {
    const first = mergePersistentCombatEffectModifiers({
      combatContext: context(),
      combatEffects: effects(effect({ modifierValue: -2 })),
    });
    const second = mergePersistentCombatEffectModifiers({
      combatContext: first,
      combatEffects: effects(effect({ modifierValue: -2 })),
    });
    const changed = mergePersistentCombatEffectModifiers({
      combatContext: second,
      combatEffects: effects(effect({ modifierValue: -5 })),
    });
    const removed = mergePersistentCombatEffectModifiers({
      combatContext: changed,
      combatEffects: effects(),
    });

    expect(second).toEqual(first);
    expect(changed.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general", value: 1 }),
      expect.objectContaining({ sourceEffectId: "effect-1", value: -5 }),
    ]);
    expect(removed).toEqual(context());
    expect(removed.modifierBuckets.situationDb[0]?.generated).toBe(true);
    expect(removed.modifierBuckets.situationInitiative[0]?.generated).toBe(true);
    expect(removed.modifierBuckets.situationObSkill[0]?.generated).toBe(true);
  });

  it("keeps equal labels and values from different sources distinct", () => {
    const merged = mergePersistentCombatEffectModifiers({
      combatContext: {
        modifierBuckets: {
          general: [{ id: "manual", notes: "same", scope: "until", value: -2 }],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: effects(effect({ description: "same", modifierValue: -2 })),
    });

    expect(merged.modifierBuckets.general).toHaveLength(2);
  });

  it("sums imported, generated, and manual rows exactly once", () => {
    const merged = mergePersistentCombatEffectModifiers({
      combatContext: context(),
      combatEffects: effects(
        effect({ combatModifierBucket: "general", id: "general", modifierValue: -2 }),
        effect({ combatModifierBucket: "initiative", id: "initiative", modifierValue: 3 }),
        effect({ combatModifierBucket: "skill_ob", id: "skill", modifierValue: 2 }),
        effect({ combatModifierBucket: "db_parry", id: "db", modifierValue: -1 }),
      ),
    });

    expect(getMergedCombatModifierTotals(merged)).toEqual({
      dbParry: -5,
      generalFatigue: -1,
      initiative: 9,
      skillOb: 1,
    });
  });
});
