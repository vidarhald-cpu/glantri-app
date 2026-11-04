import { describe, expect, it } from "vitest";

import {
  scenarioParticipantStateSchema,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantState,
} from "../campaign/scenario";
import { applyCombatActionGeneratedModifiers } from "./combatActionModifiers";
import type { CombatEffect, CombatEffectsState } from "./combatEffects";
import {
  resolveCombatModifierContributions,
  type CombatCalculationContext,
} from "./combatModifierContributions";
import {
  getMergedCombatDbParryModifierTotal,
  getMergedCombatInitiativeModifierTotal,
  getMergedCombatModifierTotals,
  getMergedCombatSkillObModifierTotal,
  buildLiveCombatModifierContributionProjection,
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
  it("projects one source-linked Critical Stun into all three channels without duplicating the source", () => {
    const stun = effect({
      combatModifierBucket: undefined,
      criticalRuntime: {
        criticalKey: "blunt|arm|12",
        fixtureVersion: "c1-2026-08-28",
        kind: "stun",
        stun: {
          channels: ["ob_skill", "db_parry", "initiative"],
          duration: { kind: "gm_managed", text: "collapse" },
          modifier: -8,
          onset: "immediate",
          severity: 4,
          sourceEffectKey: "blunt|arm|12|02",
        },
      },
      effectGroup: "special",
      effectiveAfterInitiativeGroupId: "round:2:phase:phase1:initiative:7",
      id: "critical-stun-source",
      modifierValue: -8,
      status: "pending",
      type: "stun",
    });

    const sameGroup = projectPersistentCombatEffectModifiers({
      combatEffects: effects(stun),
      currentInitiativeGroupId: "round:2:phase:phase1:initiative:7",
    });
    expect(sameGroup.pendingModifierEntries).toHaveLength(3);
    expect(sameGroup.importedEffectIds).toEqual([]);

    const projection = projectPersistentCombatEffectModifiers({
      combatEffects: effects(stun),
      currentInitiativeGroupId: "round:2:phase:phase1:initiative:4",
    });

    expect(projection.importedEffectIds).toEqual(["critical-stun-source"]);
    expect(projection.modifierBuckets.situationObSkill).toHaveLength(1);
    expect(projection.modifierBuckets.situationDb).toHaveLength(1);
    expect(projection.modifierBuckets.situationInitiative).toHaveLength(1);
    expect(
      [
        ...projection.modifierBuckets.situationObSkill,
        ...projection.modifierBuckets.situationDb,
        ...projection.modifierBuckets.situationInitiative,
      ].every((entry) => entry.sourceEffectId === "critical-stun-source" && entry.value === -8),
    ).toBe(true);
  });

  it("adds separate Critical Stun sources and removes only the resolved source", () => {
    const criticalStun = (id: string, modifier: -1 | -8) =>
      effect({
        combatModifierBucket: undefined,
        criticalRuntime: {
          criticalKey: `${id}|critical`,
          fixtureVersion: "c1-2026-08-28",
          kind: "stun",
          stun: {
            channels: ["ob_skill", "db_parry", "initiative"],
            duration: { kind: "gm_managed", text: "until resolved" },
            modifier,
            onset: "immediate",
            severity: modifier === -8 ? 4 : 1,
            sourceEffectKey: `${id}|stun`,
          },
        },
        effectGroup: "special",
        id,
        modifierValue: modifier,
        type: "stun",
      });
    const mild = criticalStun("mild-source", -1);
    const severe = criticalStun("severe-source", -8);
    const both = getMergedCombatModifierTotals({
      modifierBuckets: projectPersistentCombatEffectModifiers({
        combatEffects: effects(mild, severe),
      }).modifierBuckets,
    });
    const reversed = getMergedCombatModifierTotals({
      modifierBuckets: projectPersistentCombatEffectModifiers({
        combatEffects: effects(severe, mild),
      }).modifierBuckets,
    });
    const afterMildResolved = getMergedCombatModifierTotals({
      modifierBuckets: projectPersistentCombatEffectModifiers({
        combatEffects: effects({ ...mild, status: "resolved" }, severe),
      }).modifierBuckets,
    });

    expect(both).toMatchObject({ dbParry: -9, initiative: -9, skillOb: -9 });
    expect(reversed).toEqual(both);
    expect(afterMildResolved).toMatchObject({ dbParry: -8, initiative: -8, skillOb: -8 });
  });

  it("shows a same-group effect as pending, then includes it automatically after the group", () => {
    const pendingEffect = effect({
      createdInInitiativeGroupId: "round:2:phase:phase1:initiative:4",
      effectiveAfterInitiativeGroupId: "round:2:phase:phase1:initiative:4",
      status: "pending",
    });
    const sameGroup = buildLiveCombatModifierContributionProjection({
      combatEffects: effects(pendingEffect),
      currentInitiativeGroupId: "round:2:phase:phase1:initiative:4",
      currentRound: 2,
      ownerParticipantId: "participant-1",
    });
    expect(sameGroup.contributions).toEqual([]);
    expect(sameGroup.pendingModifierEntries).toEqual([
      expect.objectContaining({ sourceEffectId: pendingEffect.id, value: -2 }),
    ]);

    const laterGroup = buildLiveCombatModifierContributionProjection({
      combatEffects: effects(pendingEffect),
      currentInitiativeGroupId: "round:2:phase:phase1:initiative:3",
      currentRound: 2,
      ownerParticipantId: "participant-1",
    });
    expect(laterGroup.pendingModifierEntries).toEqual([]);
    expect(laterGroup.contributions).toEqual([
      expect.objectContaining({ sourceId: pendingEffect.id, value: -2 }),
    ]);
  });

  it("builds one deterministic live contribution projection without mutating sources", () => {
    const combatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [
          {
            id: "manual-general",
            notes: "terrain",
            scope: "until",
            value: 1,
          },
          {
            id: "expired-row",
            expiresAtRound: 1,
            scope: "until",
            value: 9,
          },
        ],
        situationDb: [
          {
            generated: true,
            id: "generated-feint-db",
            notes: "feint",
            scope: "until",
            sourceEncounterId: "encounter-a",
            sourcePhase: "phase2",
            value: -2,
          },
        ],
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const combatEffects = effects(
      effect({
        combatModifierBucket: "general",
        id: "persistent-general",
        modifierValue: -2,
      }),
      effect({
        combatModifierBucket: undefined,
        effectGroup: "special",
        id: "unsupported-special",
        modifierValue: undefined,
        type: "physical_damage",
      }),
      effect({
        combatModifierBucket: "general",
        id: "expired-effect",
        expiresAtRound: 1,
        modifierValue: -8,
      }),
    );
    const input = { combatContext, combatEffects };
    const before = structuredClone(input);

    const projection = buildLiveCombatModifierContributionProjection({
      combatContext,
      combatEffects,
      currentRound: 2,
      encounterId: "encounter-a",
      ownerParticipantId: "participant-1",
    });

    expect(projection.contributions.map((row) => [row.id, row.value])).toEqual([
      ["manual-general", 1],
      ["import:character_effect:persistent-general:general", -2],
      ["generated-feint-db", -2],
    ]);
    expect(
      projection.contributions.every((row) => row.ownerParticipantId === "participant-1"),
    ).toBe(true);
    expect(projection.specialEffectIds).toEqual(["unsupported-special"]);
    expect(projection.specialEffectCount).toBe(1);
    expect(input).toEqual(before);
  });

  it("does not leak rows from another encounter or duplicate imported rows", () => {
    const projection = buildLiveCombatModifierContributionProjection({
      combatContext: {
        modifierBuckets: {
          general: [
            {
              id: "import:character_effect:effect-1:general",
              imported: true,
              readOnly: true,
              scope: "until",
              sourceEffectId: "effect-1",
              sourceType: "character_effect",
              value: -2,
            },
            {
              generated: true,
              id: "generated-old",
              scope: "until",
              sourceEncounterId: "encounter-old",
              value: -5,
            },
          ],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: effects(effect({ id: "effect-1", modifierValue: -2 })),
      encounterId: "encounter-current",
      ownerParticipantId: "participant-1",
    });

    expect(projection.contributions.map((row) => row.id)).toEqual([
      "import:character_effect:effect-1:general",
    ]);
  });

  it("resolves initiative from imported, generated, and manual contributions", () => {
    const combatContext: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [
          { id: "manual-initiative", scope: "until", value: 2 },
          {
            generated: true,
            id: "generated-initiative-phase1",
            scope: "until",
            sourcePhase: "phase1",
            value: 3,
          },
          {
            generated: true,
            id: "generated-initiative-phase2",
            scope: "until",
            sourcePhase: "phase2",
            value: 20,
          },
          {
            id: "expired-initiative",
            expiresAtRound: 1,
            scope: "until",
            value: 50,
          },
        ],
        situationObSkill: [],
      },
    };
    const combatEffects = effects(
      effect({
        combatModifierBucket: "initiative",
        id: "persistent-initiative",
        modifierValue: -1,
      }),
      effect({
        combatModifierBucket: "general",
        id: "unsupported-damage",
        modifierValue: undefined,
        type: "physical_damage",
      }),
    );
    const projection = buildLiveCombatModifierContributionProjection({
      combatContext,
      combatEffects,
      currentRound: 2,
      encounterId: "encounter-1",
      ownerParticipantId: "participant-1",
    });
    const calculationContext: CombatCalculationContext = {
      encounterId: "encounter-1",
      ownerParticipantId: "participant-1",
      phase: "phase1",
      roundNumber: 2,
      step: "initiative_phase_1",
    };
    const resolution = resolveCombatModifierContributions({
      bucket: "initiative",
      context: calculationContext,
      contributions: projection.contributions,
    });

    expect(resolution.rows.map((row) => row.id)).toEqual([
      "manual-initiative",
      "generated-initiative-phase1",
      "import:character_effect:persistent-initiative:initiative",
    ]);
    expect(resolution.total).toBe(4);
    expect(projection.specialEffectIds).toContain("unsupported-damage");
    expect(projection.contributions.some((row) => row.id === "unsupported-damage")).toBe(false);
  });

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
          combatModifierBucket: "general",
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

  it("adapts legacy combat-start CE as combat-wide without broadening phase CE", () => {
    const combatStart = projectPersistentCombatEffectModifiers({
      combatEffects: effects(
        effect({
          combatModifierBucket: "general",
          id: "legacy-combat-start-ce",
          modifierValue: -2,
        }),
      ),
    });
    const phase = projectPersistentCombatEffectModifiers({
      combatEffects: effects(
        effect({
          combatModifierBucket: "general",
          id: "legacy-phase-ce",
          initiativePhase: "phase2",
          modifierValue: -1,
        }),
      ),
    });

    expect(combatStart.modifierBuckets.general[0]?.combatWide).toBe(true);
    expect(phase.modifierBuckets.general[0]?.combatWide).toBeUndefined();
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
            {
              generated: true,
              id: "other-phase",
              scope: "until",
              sourcePhase: "phase2",
              value: 50,
            },
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
        effect({
          combatModifierBucket: "db_parry",
          id: "defense-2",
          modifierValue: -1,
          status: "resolved",
        }),
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
          {
            id: "imported",
            imported: true,
            scope: "until",
            sourceType: "character_effect",
            value: 2,
          },
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

    expect(normalized.modifierBuckets.general).toEqual([
      expect.objectContaining({ id: "imported" }),
    ]);
    expect(normalized.modifierBuckets.situationObSkill).toEqual([]);
    expect(
      normalizeCombatModifierRowsForEncounter({
        combatContext: normalized,
        encounterId: "encounter-b",
        initializingNewEncounter: true,
        roundNumber: 1,
      }),
    ).toEqual(normalized);
  });

  it("repairs legacy Feint rows only when no matching current proposal exists", () => {
    const legacy: ScenarioParticipantCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [
          {
            generated: true,
            id: "generated:feint:proposal-a:defender:phase2:ob-skill",
            scope: "until",
            sourceType: "feint",
            value: -2,
          },
        ],
      },
    };

    expect(
      normalizeCombatModifierRowsForEncounter({
        activeProposalIds: ["proposal-a"],
        combatContext: legacy,
        encounterId: "encounter-a",
        roundNumber: 1,
      }).modifierBuckets.situationObSkill,
    ).toHaveLength(1);
    expect(
      normalizeCombatModifierRowsForEncounter({
        activeProposalIds: [],
        combatContext: legacy,
        encounterId: "encounter-b",
        roundNumber: 1,
      }).modifierBuckets.situationObSkill,
    ).toEqual([]);
  });
});

describe("#899 one bucket row per combat effect", () => {
  const emptyBuckets = (): ScenarioParticipantCombatContext["modifierBuckets"] => ({
    general: [],
    situationDb: [],
    situationInitiative: [],
    situationObSkill: [],
  });

  const committedLifecycle = {
    applicability: {
      combatWide: true,
      encounterId: "encounter-1",
      rollPurposes: [],
      roundNumber: 1,
    },
    createdAt: "2026-07-12T10:00:00.000Z",
    createdRevision: "2026-07-12T10:00:00.000Z",
    createdSequence: 1,
    id: "modifier-899-db",
    lifecycle: {
      duration: {
        creationRoundCounts: false,
        kind: "rounds" as const,
        remaining: 2,
        startPhase: "phase1" as const,
        startRound: 1,
        startSequence: 1,
        transitionBoundary: "round_boundary" as const,
      },
      state: "active" as const,
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "participant-1",
    payload: {
      category: "db_parry" as const,
      contributionScope: "calculation" as const,
      kind: "numeric" as const,
      unit: "percentage" as const,
      value: -7,
    },
    provenanceCompleteness: "complete" as const,
    publicLabel: "GM cover",
    schemaVersion: 1 as const,
    sourceFamily: "manual" as const,
    sourceReferences: { rowId: "modifier-899-db" },
    version: 1,
    visibility: { audience: "public" as const, sourceIdentity: "public" as const },
  };

  /** The exact pair `applyCanonicalModifierReviewToParticipantState` persists for one added row. */
  function committedReviewState(input: { lifecycleRemaining?: number } = {}) {
    const lifecycle = input.lifecycleRemaining
      ? {
          ...committedLifecycle,
          lifecycle: {
            ...committedLifecycle.lifecycle,
            duration: {
              ...committedLifecycle.lifecycle.duration,
              remaining: input.lifecycleRemaining,
            },
          },
        }
      : committedLifecycle;
    return participantState({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              canonicalLifecycle: committedLifecycle,
              durationRounds: 2,
              id: "modifier-899-db",
              notes: "GM cover",
              scope: "until",
              value: -7,
            },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: {
        effects: [
          {
            canonicalLifecycle: lifecycle,
            canonicalTransitions: [],
            combatModifierBucket: "db_parry",
            combatWide: true,
            createdAt: "2026-07-12T10:00:00.000Z",
            damage: 0,
            description: "GM cover",
            duration: `${lifecycle.lifecycle.duration.remaining} rounds`,
            effectGroup: "db",
            generalDamage: 0,
            id: "modifier-899-db",
            modifierValue: -7,
            sourceEventId: "event-899",
            status: "active",
            targetParticipantId: "participant-1",
            type: "other_modifier",
            updatedAt: "2026-07-12T10:00:00.000Z",
          },
        ],
        events: [
          {
            createdAt: "2026-07-12T10:00:00.000Z",
            description: "GM cover",
            id: "event-899",
            sourceLabel: "GM cover",
            sourceType: "gm_adjustment",
            targetParticipantId: "participant-1",
          },
        ],
      },
    });
  }

  function dbParryTotal(state: ScenarioParticipantState, currentRound: number) {
    const refreshed = refreshScenarioParticipantPersistentCombatModifiers({
      currentRound,
      state,
    });
    return {
      contributions: buildLiveCombatModifierContributionProjection({
        combatContext: refreshed.combat.combatContext,
        combatEffects: refreshed.combatEffects,
        currentRound,
        encounterId: "encounter-1",
        ownerParticipantId: "participant-1",
      }).contributions.filter((contribution) => contribution.bucket === "db_parry"),
      merged: getMergedCombatModifierTotals(refreshed.combat.combatContext).dbParry,
      rows: refreshed.combat.combatContext.modifierBuckets.situationDb,
    };
  }

  it("counts a committed GM modifier once in every reader", () => {
    const { contributions, merged, rows } = dbParryTotal(committedReviewState(), 1);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "modifier-899-db", value: -7 });
    expect(rows[0]?.imported).not.toBe(true);
    expect(contributions.map((contribution) => contribution.value)).toEqual([-7]);
    expect(contributions.reduce((total, contribution) => total + contribution.value, 0)).toBe(-7);
    expect(merged).toBe(-7);
    expect(
      resolveCombatModifierContributions({
        bucket: "db_parry",
        context: { ownerParticipantId: "participant-1", roundNumber: 1 },
        contributions,
      }).total,
    ).toBe(-7);
  });

  it("removes the contribution entirely once the owning effect is gone", () => {
    const state = participantState({
      combatContext: { modifierBuckets: emptyBuckets() },
      combatEffects: { effects: [], events: [] },
    });

    const { contributions, merged, rows } = dbParryTotal(state, 1);
    expect(rows).toEqual([]);
    expect(contributions).toEqual([]);
    expect(merged).toBe(0);
  });

  it("keeps the retained row's duration following its source effect", () => {
    expect(dbParryTotal(committedReviewState(), 1).rows[0]).toMatchObject({
      durationRounds: 2,
      sourceDuration: "2 rounds",
    });
    // A Round End duration decrement is written to the effect only. The single retained row must
    // still report the effect's remaining duration, which the disposable imported row used to.
    expect(dbParryTotal(committedReviewState({ lifecycleRemaining: 1 }), 2).rows[0]).toMatchObject({
      durationRounds: 1,
      sourceDuration: "1 round",
    });
  });

  it("still projects a persistent effect that owns no bucket row of its own", () => {
    const state = participantState({
      combatContext: { modifierBuckets: emptyBuckets() },
      combatEffects: effects(
        effect({
          combatModifierBucket: "db_parry",
          effectGroup: "db",
          id: "outside-review-effect",
          modifierValue: -5,
          type: "other_modifier",
        }),
      ),
    });

    const { contributions, merged, rows } = dbParryTotal(state, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "import:character_effect:outside-review-effect:db_parry",
      imported: true,
      value: -5,
    });
    expect(contributions.map((contribution) => contribution.value)).toEqual([-5]);
    expect(merged).toBe(-5);
  });

  it("does not fold two distinct effects that share a bucket", () => {
    const state = participantState({
      combatContext: {
        modifierBuckets: {
          ...emptyBuckets(),
          situationDb: [{ id: "unrelated-manual", notes: "manual", scope: "until", value: 2 }],
        },
      },
      combatEffects: effects(
        effect({
          combatModifierBucket: "db_parry",
          effectGroup: "db",
          id: "other-effect",
          modifierValue: -5,
          type: "other_modifier",
        }),
      ),
    });

    const { contributions, merged } = dbParryTotal(state, 1);
    expect(contributions.map((contribution) => contribution.id).sort()).toEqual([
      "import:character_effect:other-effect:db_parry",
      "unrelated-manual",
    ]);
    expect(merged).toBe(-3);
  });
});
