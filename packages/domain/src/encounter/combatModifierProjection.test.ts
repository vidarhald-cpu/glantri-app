import { describe, expect, it } from "vitest";

import {
  scenarioParticipantStateSchema,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantState,
} from "../campaign/scenario";
import { applyCombatActionGeneratedModifiers } from "./combatActionModifiers";
import type { CombatEffect, CombatEffectsState } from "./combatEffects";
import {
  getMergedCombatDbParryModifierTotal,
  getMergedCombatInitiativeModifierTotal,
  getMergedCombatModifierTotals,
  getMergedCombatSkillObModifierTotal,
  mergePersistentCombatEffectModifiers,
  normalizeCombatModifierRowsForEncounter,
  projectPersistentCombatEffectModifiers,
  refreshScenarioParticipantPersistentCombatModifiers,
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

function participantState(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
}): ScenarioParticipantState {
  return scenarioParticipantStateSchema.parse({
    combat: { combatContext: input.combatContext ?? context() },
    combatEffects: input.combatEffects,
    equipment: {},
    health: {},
    resources: {},
  });
}

function refresh(input: {
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  currentRound?: number;
}): ScenarioParticipantState {
  return refreshScenarioParticipantPersistentCombatModifiers({
    currentRound: input.currentRound,
    state: participantState(input),
  });
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

describe("persistent combat modifier refresh lifecycle", () => {
  it("adds one deterministic row and remains idempotent", () => {
    const first = refresh({ combatEffects: effects(effect()) });
    const second = refresh({
      combatContext: first.combat.combatContext,
      combatEffects: first.combatEffects,
    });

    expect(first.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({
        id: "manual-general",
      }),
      expect.objectContaining({
        id: "import:character_effect:effect-1:general",
        sourceEffectId: "effect-1",
      }),
    ]);
    expect(second).toEqual(first);
  });

  it("updates source fields without duplicating the imported row", () => {
    const initial = refresh({
      combatEffects: effects(effect({ duration: "2 rounds", expiresAtRound: 3 })),
    });
    const changedEffects = effects(
      effect({
        description: "Changed details",
        duration: "1 round",
        expiresAtRound: 4,
        modifierValue: -5,
      }),
    );
    changedEffects.events[0] = {
      ...changedEffects.events[0]!,
      sourceLabel: "Changed source",
    };
    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: changedEffects,
    });
    const imported = changed.combat.combatContext.modifierBuckets.general.filter(
      (entry) => entry.sourceEffectId === "effect-1",
    );

    expect(imported).toEqual([
      expect.objectContaining({
        expiresAtRound: 4,
        id: "import:character_effect:effect-1:general",
        notes: "Changed source",
        sourceDuration: "1 round",
        value: -5,
      }),
    ]);
  });

  it("moves a changed explicit bucket and removes the old deterministic row", () => {
    const initial = refresh({ combatEffects: effects(effect()) });
    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(effect({ combatModifierBucket: "initiative" })),
    });

    expect(changed.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general" }),
    ]);
    expect(changed.combat.combatContext.modifierBuckets.situationInitiative).toEqual([
      expect.objectContaining({
        id: "generated:reactive-attack:phase2:initiative",
      }),
      expect.objectContaining({
        id: "import:character_effect:effect-1:initiative",
      }),
    ]);
  });

  it.each([
    ["explicit bucket removed", effect({ combatModifierBucket: undefined })],
    ["effect resolved", effect({ status: "resolved" })],
    ["effect expired", effect({ status: "expired" })],
    ["effect removed", undefined],
  ] as const)("removes a stale imported row when the %s", (_label, nextEffect) => {
    const initial = refresh({ combatEffects: effects(effect()) });
    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(...(nextEffect ? [nextEffect] : [])),
    });

    expect(changed.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general" }),
    ]);
  });

  it("replaces a superseded effect with its active successor", () => {
    const initial = refresh({ combatEffects: effects(effect()) });
    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(
        effect({ status: "superseded" }),
        effect({ id: "effect-2", modifierValue: -3 }),
      ),
    });

    expect(changed.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general" }),
      expect.objectContaining({
        id: "import:character_effect:effect-2:general",
        value: -3,
      }),
    ]);
  });

  it("drops an active effect when its explicit expiry round passes", () => {
    const initial = refresh({
      combatEffects: effects(effect({ expiresAtRound: 2 })),
      currentRound: 2,
    });
    const expired = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: initial.combatEffects,
      currentRound: 3,
    });

    expect(expired.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general" }),
    ]);
  });

  it("preserves generated, manual, unknown, and legacy non-imported rows", () => {
    const legacyContext = context();
    legacyContext.modifierBuckets.general.push({
      id: "legacy-general",
      notes: "legacy",
      scope: "until",
      value: 2,
    });
    const refreshed = refresh({
      combatContext: legacyContext,
      combatEffects: effects(effect()),
    });

    expect(refreshed.combat.combatContext.modifierBuckets.general).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "manual-general" }),
        expect.objectContaining({ id: "legacy-general" }),
        expect.objectContaining({ id: "import:character_effect:effect-1:general" }),
      ]),
    );
    expect(refreshed.combat.combatContext.modifierBuckets.situationDb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "generated:attack-parry:phase1:db-parry" }),
      ]),
    );
  });

  it("preserves imported and generated rows in either recomputation order", () => {
    const generatedFirst = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantStateSchema.parse(
        participantState({ combatContext: undefined }),
      ).combat.combatContext,
    });
    const refreshedAfterGenerated = refresh({
      combatContext: generatedFirst,
      combatEffects: effects(effect({ combatModifierBucket: "db_parry" })),
    });
    const refreshedFirst = refresh({
      combatContext: scenarioParticipantStateSchema.parse(
        participantState({ combatContext: undefined }),
      ).combat.combatContext,
      combatEffects: effects(effect({ combatModifierBucket: "db_parry" })),
    });
    const generatedAfterRefresh = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: refreshedFirst.combat.combatContext,
    });

    for (const combatContext of [
      refreshedAfterGenerated.combat.combatContext,
      generatedAfterRefresh,
    ]) {
      expect(combatContext.modifierBuckets.situationDb).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "generated:attack-parry:phase1:db-parry" }),
          expect.objectContaining({ id: "import:character_effect:effect-1:db_parry" }),
        ]),
      );
    }
  });

  it("imports explicit Combat Experience and committed critical modifier effects", () => {
    const refreshed = refresh({
      combatEffects: effects(
        effect({
          combatModifierBucket: "general",
          id: "combat-experience",
          modifierValue: -2,
          type: "general_modifier",
        }),
        effect({
          combatModifierBucket: "db_parry",
          effectGroup: "db",
          id: "critical-defense",
          modifierValue: -4,
          type: "db_modifier",
        }),
      ),
    });

    expect(refreshed.combat.combatContext.modifierBuckets.general).toContainEqual(
      expect.objectContaining({ sourceEffectId: "combat-experience", value: -2 }),
    );
    expect(refreshed.combat.combatContext.modifierBuckets.situationDb).toContainEqual(
      expect.objectContaining({ sourceEffectId: "critical-defense", value: -4 }),
    );
  });

  it("restores imported rows when undo restores effects and removes them for creation undo", () => {
    const before = refresh({ combatEffects: effects(effect()) });
    const afterCreationUndo = refresh({
      combatContext: before.combat.combatContext,
      combatEffects: effects(),
    });
    const afterRestoreUndo = refresh({
      combatContext: afterCreationUndo.combat.combatContext,
      combatEffects: before.combatEffects,
    });

    expect(afterCreationUndo.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general" }),
    ]);
    expect(afterRestoreUndo.combat.combatContext.modifierBuckets.general).toContainEqual(
      expect.objectContaining({ id: "import:character_effect:effect-1:general" }),
    );
  });

  it("classifies unsupported active effects without a row and removes a formerly supported row", () => {
    const initial = refresh({ combatEffects: effects(effect()) });
    const unsupportedEffects = effects(
      effect({ combatModifierBucket: undefined, modifierValue: undefined, type: "special" }),
    );
    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: unsupportedEffects,
    });
    const projection = projectPersistentCombatEffectModifiers({
      combatEffects: unsupportedEffects,
    });

    expect(projection.specialEffectIds).toEqual(["effect-1"]);
    expect(changed.combat.combatContext.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "manual-general" }),
    ]);
  });

  it("does not rewrite previously captured historical modifier rows", () => {
    const historicalRows = structuredClone(context().modifierBuckets);
    const initial = refresh({ combatEffects: effects(effect({ modifierValue: -2 })) });
    refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(effect({ modifierValue: -8 })),
    });

    expect(historicalRows).toEqual(context().modifierBuckets);
  });

  it("provides the phase-aware canonical initiative total after source changes", () => {
    const initial = refresh({
      combatEffects: effects(
        effect({ combatModifierBucket: "initiative", id: "initiative-1", modifierValue: 2 }),
        effect({ combatModifierBucket: "initiative", id: "initiative-2", modifierValue: 3 }),
        effect({ combatModifierBucket: "general", id: "general", modifierValue: 99 }),
        effect({ combatModifierBucket: undefined, id: "legacy", modifierValue: 50 }),
      ),
    });

    expect(
      getMergedCombatInitiativeModifierTotal({
        combatContext: initial.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(5);

    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(
        effect({ combatModifierBucket: "initiative", id: "initiative-1", modifierValue: 4 }),
        effect({
          combatModifierBucket: "initiative",
          id: "initiative-2",
          modifierValue: 3,
          status: "resolved",
        }),
        effect({ combatModifierBucket: "general", id: "general", modifierValue: 99 }),
      ),
    });

    expect(
      getMergedCombatInitiativeModifierTotal({
        combatContext: changed.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(4);

    const moved = refresh({
      combatContext: changed.combat.combatContext,
      combatEffects: effects(
        effect({ combatModifierBucket: "skill_ob", id: "initiative-1", modifierValue: 4 }),
      ),
    });

    expect(
      getMergedCombatInitiativeModifierTotal({
        combatContext: moved.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(0);
  });

  it("provides the phase-aware canonical Skill/OB total after source changes", () => {
    const initial = refresh({
      combatEffects: effects(
        effect({ combatModifierBucket: "skill_ob", id: "skill-1", modifierValue: 2 }),
        effect({ combatModifierBucket: "skill_ob", id: "skill-2", modifierValue: 3 }),
        effect({ combatModifierBucket: "general", id: "general", modifierValue: 99 }),
        effect({ combatModifierBucket: undefined, id: "legacy-effect", modifierValue: 50 }),
      ),
    });

    expect(
      getMergedCombatSkillObModifierTotal({
        combatContext: initial.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(4);

    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(
        effect({ combatModifierBucket: "skill_ob", id: "skill-1", modifierValue: 4 }),
        effect({
          combatModifierBucket: "skill_ob",
          id: "skill-2",
          modifierValue: 3,
          status: "resolved",
        }),
      ),
    });

    expect(
      getMergedCombatSkillObModifierTotal({
        combatContext: changed.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(3);

    const moved = refresh({
      combatContext: changed.combat.combatContext,
      combatEffects: effects(
        effect({ combatModifierBucket: "db_parry", id: "skill-1", modifierValue: 4 }),
      ),
    });

    expect(
      getMergedCombatSkillObModifierTotal({
        combatContext: moved.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(-1);
  });

  it("provides the phase-aware canonical DB/Parry total without General/Fatigue", () => {
    const initial = refresh({
      combatContext: {
        modifierBuckets: {
          general: [{ id: "general-not-defense", scope: "until", value: 99 }],
          situationDb: [
            { generated: true, id: "generated", scope: "until", sourcePhase: "phase1", value: -2 },
            { id: "manual", scope: "until", value: 1 },
            { id: "legacy", scope: "until", value: 3 },
            { generated: true, id: "other-phase", scope: "until", sourcePhase: "phase2", value: 50 },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: effects(
        effect({ combatModifierBucket: "db_parry", id: "defense-1", modifierValue: 2 }),
        effect({ combatModifierBucket: "db_parry", id: "defense-2", modifierValue: -1 }),
        effect({ combatModifierBucket: undefined, id: "legacy-effect", modifierValue: 50 }),
      ),
    });

    expect(
      getMergedCombatDbParryModifierTotal({
        combatContext: initial.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(3);
    expect(
      getMergedCombatDbParryModifierTotal({
        combatContext: initial.combat.combatContext,
        phase: "phase2",
      }),
    ).toBe(55);

    const changed = refresh({
      combatContext: initial.combat.combatContext,
      combatEffects: effects(
        effect({ combatModifierBucket: "db_parry", id: "defense-1", modifierValue: 4 }),
        effect({ combatModifierBucket: "db_parry", id: "defense-2", modifierValue: -1, status: "resolved" }),
      ),
    });

    expect(
      getMergedCombatDbParryModifierTotal({
        combatContext: changed.combat.combatContext,
        phase: "phase1",
      }),
    ).toBe(6);
  });

  it("isolates temporary rows by encounter while retaining imported effects", () => {
    const context: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [
          { id: "imported", imported: true, scope: "until", sourceType: "character_effect", value: 2 },
          { id: "manual-old", scope: "until", value: -1 },
        ],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [
          {
            generated: true,
            id: "generated:feint:proposal-a:defender:phase2:ob-skill",
            scope: "until",
            sourceEncounterId: "encounter-a",
            sourceProposalId: "proposal-a",
            sourceRoundNumber: 1,
            sourceType: "feint",
            value: -2,
          },
        ],
      },
    };

    const normalized = normalizeCombatModifierRowsForEncounter({
      combatContext: context,
      encounterId: "encounter-b",
      initializingNewEncounter: true,
      roundNumber: 1,
    });

    expect(normalized.modifierBuckets.general).toEqual([expect.objectContaining({ id: "imported" })]);
    expect(normalized.modifierBuckets.situationObSkill).toEqual([]);
    expect(normalizeCombatModifierRowsForEncounter({
      combatContext: normalized,
      encounterId: "encounter-b",
      initializingNewEncounter: true,
      roundNumber: 1,
    })).toEqual(normalized);
  });

  it("repairs legacy Feint rows only when no matching current proposal exists", () => {
    const legacy: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [{
          generated: true,
          id: "generated:feint:proposal-a:defender:phase2:ob-skill",
          scope: "until",
          sourceType: "feint",
          value: -2,
        }],
      },
    };

    expect(normalizeCombatModifierRowsForEncounter({
      activeProposalIds: ["proposal-a"],
      combatContext: legacy,
      encounterId: "encounter-a",
      roundNumber: 1,
    }).modifierBuckets.situationObSkill).toHaveLength(1);
    expect(normalizeCombatModifierRowsForEncounter({
      activeProposalIds: [],
      combatContext: legacy,
      encounterId: "encounter-b",
      roundNumber: 1,
    }).modifierBuckets.situationObSkill).toEqual([]);
  });
});
