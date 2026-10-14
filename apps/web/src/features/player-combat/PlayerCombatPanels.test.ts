import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildGroupedFeintModifierDisplays,
  buildPlayerCombatModifierRows,
  formatCombatInitiativeFormula,
  formatCombatModifierDetailsLabel,
  formatCombatModifierDisplayLine,
  formatCombatModifierScopeLabel,
  isMeaningfulCombatModifierEntry,
  sanitizeCombatModifierEntries,
} from "./PlayerCombatPanels";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PlayerCombatPanels.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PlayerCombatPanels", () => {
  it("labels percentage-applied Parry modifier rows as percentages", () => {
    expect(
      formatCombatModifierDisplayLine({
        bucketLabel: "DB/Parry",
        entry: {
          application: "percentage",
          id: "generated:parry:round:db-parry-percentage",
          notes: "Parry: Dodge 17; one fifth, rounded down; Parry +3%",
          scope: "until",
          value: 3,
        },
      }),
    ).toContain("DB/Parry +3%");
  });

  it("formats recorded initiative modifier facts without recalculating current context", () => {
    expect(
      formatCombatInitiativeFormula({
        baseInitiative: 8,
        modifierAdjustment: 2,
        rolls: [4],
        rollTotal: 4,
        total: 14,
      }),
    ).toBe("Main: I 8 + Initiative 2 + roll 4 = 14");
  });

  it("exposes reusable combat modifier rows with the shared player combat buckets", () => {
    const source = readSource();

    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("buildLiveCombatModifierContributionProjection");
    expect(source).not.toContain("mergePersistentCombatEffectModifiers");
    expect(source).toContain("filterCombatModifierEntriesForPhase");
    expect(source).toContain("phaseKey?: EncounterCombatPhaseKey");
    expect(source).toContain("General/Fatigue");
    expect(source).toContain("Initiative");
    expect(source).toContain("Skill/OB");
    expect(source).toContain("DB/Parry");
    expect(source.indexOf('label: "General/Fatigue"')).toBeLessThan(
      source.indexOf('label: "Initiative"'),
    );
    expect(source.indexOf('label: "Initiative"')).toBeLessThan(source.indexOf('label: "Skill/OB"'));
  });

  it("renders the approved relative-position, movement, and facing declaration controls", () => {
    const source = readSource();

    expect(source).toContain("Relative position");
    expect(source).toContain("Keep distance");
    expect(source).toContain("Adjust distance");
    expect(source).toContain("Hold formation");
    expect(source).toContain("Movement and facing");
    expect(source).toContain("Movement direction");
    expect(source).toContain("directionOptions");
    expect(source).toContain("distancePreferenceOptions");
    expect(source).toContain("onDeclarationIntentChange");
    expect(source).toContain("onMovementIntentChange");
    expect(source).not.toContain(">How<");
    expect(source).not.toContain("Expected time");
    expect(source).not.toContain("PLAYER_ENCOUNTER_MOVEMENT_OPTIONS.map");
  });

  it("keeps alternate task outcomes above one primary action", () => {
    const source = readSource();

    expect(source).toContain("preActionControls");
    expect(source).toContain("Alternative outcomes for the same pending");
    expect(source).toContain("task should use preActionControls");
    expect(source).toContain("{preActionControls ? (");
    expect(source).toContain("secondaryButtonLabel");
  });

  it("filters phase-scoped generated modifier rows while keeping manual rows broad", () => {
    const combatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [
          { id: "manual-db", scope: "until" as const, value: -1 },
          {
            generated: true,
            id: "generated:attack-parry:phase1:db-parry",
            notes: "single attack",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:parry-attack:phase2:db-parry",
            notes: "reactive attack",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
        ],
        situationInitiative: [],
        situationObSkill: [
          { id: "manual-ob", scope: "until" as const, value: 2 },
          {
            generated: true,
            id: "generated:double-attack:phase1:ob-skill",
            notes: "double attack",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -1,
          },
          {
            generated: true,
            id: "generated:double-attack:phase2:ob-skill",
            notes: "double attack",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -1,
          },
        ],
      },
    };

    const phase1Rows = buildPlayerCombatModifierRows({
      combatContext,
      phaseKey: "phase1",
    });
    const phase2Rows = buildPlayerCombatModifierRows({
      combatContext,
      phaseKey: "phase2",
    });
    const noPhaseRows = buildPlayerCombatModifierRows({
      combatContext,
    });
    const declarationPreviewRows = buildPlayerCombatModifierRows({
      combatContext,
      includeAllPhases: true,
    });
    const phase1DbRow = phase1Rows.find((row) => row.bucketKey === "situation_db");
    const phase2DbRow = phase2Rows.find((row) => row.bucketKey === "situation_db");
    const phase1ObRow = phase1Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const phase2ObRow = phase2Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const noPhaseDbRow = noPhaseRows.find((row) => row.bucketKey === "situation_db");
    const noPhaseObRow = noPhaseRows.find((row) => row.bucketKey === "situation_ob_skill");
    const previewDbRow = declarationPreviewRows.find((row) => row.bucketKey === "situation_db");
    const previewObRow = declarationPreviewRows.find(
      (row) => row.bucketKey === "situation_ob_skill",
    );

    expect(noPhaseDbRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual(["manual-db"]);
    expect(noPhaseDbRow?.total).toBe(-1);
    expect(noPhaseObRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual(["manual-ob"]);
    expect(noPhaseObRow?.total).toBe(2);
    expect(previewDbRow?.entries.map((entry) => [entry.id, entry.value])).toEqual([
      ["manual-db", -1],
      ["generated:attack-parry:phase1:db-parry", -4],
      ["generated:parry-attack:phase2:db-parry", -4],
    ]);
    expect(previewObRow?.entries.map((entry) => [entry.id, entry.value])).toEqual([
      ["manual-ob", 2],
      ["generated:double-attack:phase1:ob-skill", -1],
      ["generated:double-attack:phase2:ob-skill", -1],
    ]);
    expect(phase1DbRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual([
      "manual-db",
      "single attack",
    ]);
    expect(phase1DbRow?.total).toBe(-5);
    expect(phase2DbRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual([
      "manual-db",
      "reactive attack",
    ]);
    expect(phase2DbRow?.total).toBe(-5);
    expect(phase1ObRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual([
      "manual-ob",
      "double attack",
    ]);
    expect(phase1ObRow?.total).toBe(1);
    expect(phase2ObRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual([
      "manual-ob",
      "double attack",
    ]);
    expect(phase2ObRow?.total).toBe(1);
    const attackParryEntry = phase1DbRow?.entries.find((entry) => entry.notes === "single attack");
    const doubleAttackEntry = phase1ObRow?.entries.find((entry) => entry.notes === "double attack");

    if (!attackParryEntry || !doubleAttackEntry) {
      throw new Error("Expected generated phase modifier entries to be present.");
    }

    expect(
      formatCombatModifierDisplayLine({
        bucketLabel: "DB/Parry",
        entry: attackParryEntry,
      }),
    ).toBe("DB/Parry -4 · P1 · single attack");
    expect(
      formatCombatModifierDisplayLine({
        bucketLabel: "Skill/OB",
        entry: doubleAttackEntry,
      }),
    ).toBe("Skill/OB -1 · P1 · double attack");
  });

  it("shows future Double Attack rows at M1 without applying them to phase-1 totals", () => {
    const combatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [
          {
            id: "double-db-p1",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            id: "double-db-p2",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
        ],
        situationInitiative: [],
        situationObSkill: [
          {
            id: "double-ob-p1",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -1,
          },
          {
            id: "double-ob-p2",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -1,
          },
        ],
      },
    };
    const m1Rows = buildPlayerCombatModifierRows({
      combatContext,
      phaseKey: "phase1",
      visibleAtStep: "review_action_modifiers",
    });
    const m2Rows = buildPlayerCombatModifierRows({
      combatContext,
      phaseKey: "phase2",
      visibleAtStep: "review_phase_2_modifiers",
    });
    const m1Ob = m1Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const m1Db = m1Rows.find((row) => row.bucketKey === "situation_db");
    const m2Ob = m2Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const m2Db = m2Rows.find((row) => row.bucketKey === "situation_db");

    expect(m1Ob?.entries.map((entry) => entry.id)).toEqual(["double-ob-p1", "double-ob-p2"]);
    expect(m1Db?.entries.map((entry) => entry.id)).toEqual(["double-db-p1", "double-db-p2"]);
    expect(m1Ob?.total).toBe(-1);
    expect(m1Db?.total).toBe(-4);
    expect(m2Ob?.entries.map((entry) => entry.id)).toEqual(["double-ob-p2"]);
    expect(m2Db?.entries.map((entry) => entry.id)).toEqual(["double-db-p2"]);
    expect(m2Ob?.total).toBe(-1);
    expect(m2Db?.total).toBe(-4);
  });

  it("shows generated distance modifiers in the phase Skill/OB bucket", () => {
    const combatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [
          {
            generated: true,
            id: "generated:distance:phase1:ob-skill",
            notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            sourceRule: "distance-ob-skill-phase1",
            value: -2,
          },
        ],
      },
    };

    const phase1Rows = buildPlayerCombatModifierRows({
      combatContext,
      phaseKey: "phase1",
    });
    const phase2Rows = buildPlayerCombatModifierRows({
      combatContext,
      phaseKey: "phase2",
    });
    const phase1ObRow = phase1Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const phase2ObRow = phase2Rows.find((row) => row.bucketKey === "situation_ob_skill");

    expect(phase1ObRow).toMatchObject({
      entries: [
        expect.objectContaining({
          id: "generated:distance:phase1:ob-skill",
          notes: expect.stringContaining("Broad sword preferred 2"),
          value: -2,
        }),
      ],
      label: "Skill/OB",
      total: -2,
    });
    expect(phase2ObRow?.entries).toEqual([]);
    expect(phase2ObRow?.total).toBe(0);
    const distanceEntry = phase1ObRow?.entries[0];

    if (!distanceEntry) {
      throw new Error("Expected generated distance modifier entry to be present.");
    }

    expect(
      formatCombatModifierDisplayLine({
        bucketLabel: "Skill/OB",
        entry: distanceEntry,
      }),
    ).toBe("Skill/OB -2 · P1 · long distance");
    expect(formatCombatModifierDetailsLabel(distanceEntry)).toBe("long distance");
    expect(
      formatCombatModifierDetailsLabel({
        ...distanceEntry,
        notes: "distance: Broad sword preferred 3 · actual 2 · nearest 3 · Skill/OB -2",
      }),
    ).toBe("short distance");
  });

  it("uses compact details for generated Reactive initiative rows", () => {
    expect(
      formatCombatModifierDisplayLine({
        bucketLabel: "Initiative",
        entry: {
          durationRounds: 1,
          generated: true,
          id: "generated:parry-attack:phase2:initiative",
          notes: "reactive attack: phase 2 initiative pending phase 1 incoming result",
          scope: "until" as const,
          sourceActionId: "parry_attack",
          sourcePhase: "phase2" as const,
          sourceRule: "parry-attack-phase2-initiative",
          value: 6,
        },
      }),
    ).toBe("Initiative +6 · P2 · reactive attack");
  });

  it("hides meaningless zero situational rows while keeping meaningful zero summaries possible", () => {
    const rows = buildPlayerCombatModifierRows({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [],
          situationInitiative: [
            {
              id: "blank-zero",
              notes: "",
              scope: "until" as const,
              value: 0,
            },
            {
              id: "meaningful-zero",
              notes: "explicit no modifier reminder",
              scope: "until" as const,
              value: 0,
            },
          ],
          situationObSkill: [
            {
              id: "distance",
              notes: "distance: Broad sword preferred 2 · actual 3",
              scope: "until" as const,
              sourcePhase: "phase1" as const,
              value: -2,
            },
          ],
        },
      },
      phaseKey: "phase1",
    });
    const initiativeRow = rows.find((row) => row.bucketKey === "situation_initiative");
    const obRow = rows.find((row) => row.bucketKey === "situation_ob_skill");

    expect(isMeaningfulCombatModifierEntry({ id: "blank", scope: "until", value: 0 })).toBe(false);
    expect(
      sanitizeCombatModifierEntries([
        { id: "blank", scope: "until", value: 0 },
        { id: "actual", scope: "until", value: -2 },
      ]).map((entry) => entry.id),
    ).toEqual(["actual"]);
    expect(initiativeRow?.entries.map((entry) => entry.id)).toEqual(["meaningful-zero"]);
    expect(initiativeRow?.total).toBe(0);
    expect(obRow?.entries.map((entry) => entry.id)).toEqual(["distance"]);
    expect(obRow?.total).toBe(-2);
  });

  it("labels character-state and situational modifier sources without changing totals", () => {
    const rows = buildPlayerCombatModifierRows({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              generated: true,
              id: "generated:attack-parry:phase1:db-parry",
              notes: "single attack",
              scope: "until" as const,
              sourcePhase: "phase1" as const,
              value: -4,
            },
          ],
          situationInitiative: [],
          situationObSkill: [],
        },
      },
      combatEffects: {
        effects: [
          {
            combatModifierBucket: "general",
            createdAt: "2026-01-01T00:00:00.000Z",
            damage: 0,
            duration: "2 rounds",
            effectGroup: "general",
            generalDamage: 0,
            id: "ce-effect",
            modifierValue: -1,
            sourceEventId: "ce-event",
            status: "active",
            targetParticipantId: "scenario-1",
            type: "general_modifier",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        events: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            description: "Combat Experience: Active",
            id: "ce-event",
            sourceLabel: "Combat Experience",
            sourceType: "skill_roll",
            targetParticipantId: "scenario-1",
          },
        ],
      },
      phaseKey: "phase1",
    });
    const generalRow = rows.find((row) => row.bucketKey === "general");
    const dbRow = rows.find((row) => row.bucketKey === "situation_db");

    expect(generalRow?.entries).toEqual([
      expect.objectContaining({
        imported: true,
        notes: "Combat Experience",
        readOnly: true,
        sourceDuration: "2 rounds",
        sourceType: "character_effect",
        value: -1,
      }),
    ]);
    expect(dbRow?.entries[0]).toMatchObject({
      generated: true,
      notes: "single attack",
      value: -4,
    });
    const dbEntry = dbRow?.entries[0];

    if (!dbEntry) {
      throw new Error("Expected generated DB/Parry entry to be present.");
    }

    expect(formatCombatModifierScopeLabel(dbEntry)).toBe("P1");
  });

  it("keeps linked equal Feint OB and DB rows independently identifiable", () => {
    const rows = buildPlayerCombatModifierRows({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              id: "generated:feint:proposal:target:phase2:db-parry",
              resultGroupId: "proposal",
              resultGroupKind: "ob_db" as const,
              scope: "until" as const,
              sourcePhase: "phase2" as const,
              sourceType: "feint" as const,
              value: -4,
            },
          ],
          situationInitiative: [],
          situationObSkill: [
            {
              id: "generated:feint:proposal:target:phase2:ob-skill",
              resultGroupId: "proposal",
              resultGroupKind: "ob_db" as const,
              scope: "until" as const,
              sourcePhase: "phase2" as const,
              sourceType: "feint" as const,
              value: -4,
            },
          ],
        },
      },
      phaseKey: "phase2",
    });

    expect(buildGroupedFeintModifierDisplays(rows)).toEqual([]);
    expect(rows.find((row) => row.bucketKey === "situation_ob_skill")?.total).toBe(-4);
    expect(rows.find((row) => row.bucketKey === "situation_db")?.total).toBe(-4);
  });

  it("keeps adjusted Feint OB and DB rows visually separate when their values differ", () => {
    const rows = buildPlayerCombatModifierRows({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [
            {
              id: "generated:feint:proposal:target:phase2:db-parry",
              resultGroupId: "proposal",
              resultGroupKind: "ob_db" as const,
              scope: "until" as const,
              sourcePhase: "phase2" as const,
              sourceType: "feint" as const,
              value: -2,
            },
          ],
          situationInitiative: [],
          situationObSkill: [
            {
              id: "generated:feint:proposal:target:phase2:ob-skill",
              resultGroupId: "proposal",
              resultGroupKind: "ob_db" as const,
              scope: "until" as const,
              sourcePhase: "phase2" as const,
              sourceType: "feint" as const,
              value: -4,
            },
          ],
        },
      },
      phaseKey: "phase2",
    });

    expect(buildGroupedFeintModifierDisplays(rows)).toEqual([]);
  });

  it("includes target-aware contributions exactly once in category totals and rows", () => {
    const rows = buildPlayerCombatModifierRows({
      combatContext: {
        modifierBuckets: {
          general: [],
          situationDb: [{ id: "base-db", scope: "until", value: -1 }],
          situationInitiative: [],
          situationObSkill: [{ id: "base-ob", scope: "until", value: 2 }],
        },
      },
      liveModifiers: {
        dbRaw: 2,
        generalFatigueRaw: 0,
        initiativeRaw: 0,
        modifierNoteLabels: [],
        obSkillRaw: 5,
        opponentLabel: "Target B",
        opponentSpecificContributions: [
          {
            applicability: {
              opponentParticipantId: "participant-b",
              participantId: "participant-a",
            },
            bucket: "skill_ob",
            editPolicy: "source_only",
            id: "observe:a:b:modifier:skill_ob",
            label: "Observe Opponent",
            lifetime: { kind: "encounter", status: "active" },
            ownerParticipantId: "participant-a",
            readOnly: true,
            schemaVersion: 1,
            sourceId: "observe:a:b",
            sourceKind: "system_derived",
            value: 3,
          },
          {
            applicability: {
              opponentParticipantId: "participant-b",
              participantId: "participant-a",
            },
            bucket: "db_parry",
            editPolicy: "source_only",
            id: "observe:a:b:modifier:db_parry",
            label: "Observe Opponent",
            lifetime: { kind: "encounter", status: "active" },
            ownerParticipantId: "participant-a",
            readOnly: true,
            schemaVersion: 1,
            sourceId: "observe:a:b",
            sourceKind: "system_derived",
            value: 3,
          },
        ],
      },
      ownerParticipantId: "participant-a",
    });
    const skillOb = rows.find((row) => row.bucketKey === "situation_ob_skill");
    const dbParry = rows.find((row) => row.bucketKey === "situation_db");

    expect(skillOb?.total).toBe(5);
    expect(skillOb?.derivedEntries).toEqual([
      expect.objectContaining({
        id: "observe:a:b:modifier:skill_ob",
        sourceLabel: "Observe Opponent · Target B",
        value: 3,
      }),
    ]);
    expect(dbParry?.total).toBe(2);
    expect(dbParry?.derivedEntries).toHaveLength(1);
  });

  it("keeps player combat modifiers editable while allowing read-only inspector use", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("readOnly");
    expect(source).toContain("sourceLabel");
    expect(source).toContain("PanelTitleWithSource");
    expect(source).toContain("panelSourceMarkerStyle");
    expect(source).toContain("onAddEntry");
    expect(source).toContain("onRemoveEntry");
    expect(source).toContain("onUpdateEntry");
    expect(source).toContain("disabled={controlsDisabled}");
    expect(source).toContain("row.locked");
    expect(source).toContain("compactModifierGroupHeaderStyle");
    expect(source).toContain("compactModifierMiniTableStyle");
    expect(source).toContain("compactModifierMiniTableHeaderStyle");
    expect(source).toContain("compactModifierMiniTableEntryRowStyle");
    expect(source).toContain("compactModifierEntryTopRowStyle");
    expect(source).toContain("compactModifierTopRowColumns");
    expect(source).toContain("compactModifierDisplayTopRowStyle");
    expect(source).toContain("compactModifierDetailsRowStyle");
    expect(source).toContain("compactModifierEditableDetailsRowStyle");
    expect(source).not.toContain("compactModifierMiniTableDraftRowStyle");
    expect(source).toContain(
      'const compactModifierTopRowColumns = "minmax(7rem, 1fr) 3.75rem 4.25rem"',
    );
    expect(source).toContain('gridTemplateColumns: "4.25rem minmax(0, 1fr)"');
    expect(source).toContain('gridTemplateColumns: "4.25rem minmax(0, 1fr) auto"');
    expect(source).toContain('["Source/scope", "Mod", "Dur"].map');
    expect(source).not.toContain('["Source", "Mod", "Dur", "Details", "Remove"].map');
    expect(source).toContain("characterStateEntries");
    expect(source).toContain("Character/state");
    expect(source).toContain("Situational");
    expect(source).toContain('entry.sourceActionId === "parry" ? "Parry" : "Situational"');
    expect(source).toContain("{entry.sourceActionId ===");
    expect(source).toContain("ModifierDisplayEntryRow");
    expect(source).toContain("ModifierEditableEntryRow");
    expect(source).toContain("createModifierEntryDraft");
    expect(source).toContain("isMeaningfulCombatModifierEntry");
    expect(source).toContain("sanitizeCombatModifierEntries");
    expect(source).toContain("sanitizePlayerCombatModifierContext");
    expect(source).not.toContain("createModifierEntryFromDraft");
    expect(source).not.toContain("updateEntryDraft");
    expect(source).not.toContain("addEntryFromDraft");
    expect(source).toContain("setDraftEntry(row.bucketKey, createModifierEntryDraft())");
    expect(source).toContain("onAddEntry(row.bucketKey, nextEntry)");
    expect(source).toContain("compactModifierNumberInputStyle");
    expect(source).toContain("compactModifierDetailsInputStyle");
    expect(source).toContain("compactModifierRemoveButtonStyle");
    expect(source).toContain('width: "100%"');
    expect(source).toContain('boxSizing: "border-box"');
    expect(source).toContain("hasVisibleRows");
    expect(source).toContain("aria-label={`${bucketLabel} modifier value`}");
    expect(source).not.toContain("aria-label={`${row.label} new modifier value`}");
    expect(source).toContain("aria-label={`${bucketLabel} modifier details`}");
    expect(source).not.toContain("aria-label={`${row.label} new modifier details`}");
    expect(source).toContain('"durationRounds"');
    expect(source).toContain('value={entry.durationRounds ?? ""}');
    expect(source).not.toContain('value={getEntryDraft(row.bucketKey).durationRounds ?? ""}');
    expect(source).not.toContain("value={getEntryDraft(row.bucketKey).notes}");
    expect(source).toContain(
      "onClick={() => setDraftEntry(row.bucketKey, createModifierEntryDraft())}",
    );
    expect(source).toContain("onRemove={() => onRemoveEntry(row.bucketKey, entry.id)}");
    expect(source).toContain('aria-label="Remove modifier"');
    expect(source).toContain('title="Remove modifier"');
    expect(source).toMatch(/>\s*-\s*<\/button>/);
    expect(source).not.toContain(">Remove</button>");
    expect(source).toContain("formatCombatModifierScopeLabel");
    expect(source).toContain("formatCombatModifierDisplayLine");
    expect(source).toContain("<span>{entry.sourceLabel}</span>");
    expect(source).toContain("<span>{entry.scopeLabel}</span>");
    expect(source).not.toContain('<option value="until">Until</option>');
    expect(source).not.toContain('<option value="save">Save</option>');
  });

  it("renders reusable phase panels for Phase 1 and Phase 2 combat summaries", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatPhasePanel");
    expect(source).toContain("phaseCard.phaseLabel");
    expect(source).toContain("phaseCard.title");
    expect(source).toContain("phaseCard.description");
    expect(source).toContain("phaseCard.stats");
    expect(source).toContain("playerCombatTopPanelRowStyle");
    expect(source).toContain(
      'gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))"',
    );
    expect(source).toContain("gridTemplateColumns: playerCombatPanelRowStyle.gridTemplateColumns");
    expect(source).toContain("PlayerCombatAttackStatsTable");
    expect(source).toContain("PlayerCombatDefenseStatsTable");
    expect(source).toContain("PlayerCombatAttackTargetSelector");
    expect(source).toContain("PlayerCombatAttackLocationSelector");
    expect(source).toContain("PlayerCombatAttackModeSelector");
    expect(source).toContain("distanceLabel?: string");
    expect(source).toContain("distanceLabel");
    expect(source).toContain("compactPhaseTargetRowStyle");
    expect(source).toContain("compactPhaseTargetMetaStyle");
    expect(source).toContain('gridTemplateColumns: "6.5rem minmax(7rem, 1fr) max-content"');
    expect(source).toContain('className="combatPhaseTargetRow"');
    expect(source).toContain('className="combatPhaseTargetMeta"');
    expect(source).toContain('justifySelf: "end"');
    expect(source).toContain('justifyItems: "end"');
    expect(source.indexOf("export function PlayerCombatAttackTargetSelector")).toBeLessThan(
      source.indexOf("export function PlayerCombatAttackLocationSelector"),
    );
    expect(source.indexOf("export function PlayerCombatAttackLocationSelector")).toBeLessThan(
      source.indexOf("function ParryDirectionSelector"),
    );
    expect(source).toContain("Target");
    expect(source).toContain("targetOptions.map");
    expect(source).toContain("selectedTargetUnavailable");
    expect(source).toContain("if (readOnly)");
    expect(source).toContain('selectedTarget?.displayName ?? "Target unavailable"');
    expect(source).toContain('value={combatContext.targetParticipantId ?? ""}');
    expect(source).toContain("targetParticipantId: event.target.value || undefined");
    expect(source).toContain("{distanceLabel}");
    expect(source).toContain('whiteSpace: "nowrap"');
    expect(source).toContain("Attack location");
    expect(source).toContain("Attack mode");
    expect(source).toContain("No target");
    expect(source).toContain("HIT_LOCATIONS.map");
    expect(source).toContain("getHitLocationFullLabel(location)");
    expect(source).toContain('value={combatContext.targetLocation ?? "none"}');
    expect(source).toContain(
      'targetLocation: targetLocation === "none" ? undefined : targetLocation',
    );
    expect(source).toContain("compactPhaseContextSelectorColumns");
    // Every track is shrinkable, so the row cannot grow past its own phase card. A fixed track
    // pushed the coverage label outside the card, where the next card's opaque background painted
    // over it, and a hard 7rem select clipped its own "Select attack source" placeholder (#607).
    expect(source).toContain(
      'const compactPhaseContextSelectorColumns = "minmax(0, 6.5rem) minmax(0, 8rem) minmax(0, auto)"',
    );
    expect(source).not.toContain('const compactPhaseContextSelectorColumns = "6.5rem 7rem auto"');
    expect(source).toContain(
      'const compactPhaseContextSelectStyle = { maxWidth: "100%", width: "8rem" }',
    );
    expect(source).toContain("style={compactPhaseContextSelectStyle}");
    expect(source).toContain("compactStatsRowStyle");
    expect(source).toContain('gridTemplateColumns: "minmax(6rem, 0.8fr) 1fr"');
    expect(source).toContain("compactStatsTableStyle");
    expect(source).toContain("I");
    expect(source).toContain("OB");
    expect(source).toContain("DMB");
    expect(source).toContain("AM");
    expect(source).toContain("MC");
    expect(source).toContain("DB");
    expect(source).toContain("DM");
    expect(source).toContain("P");
  });

  it("exposes the canonical combat action selector and declaration panels", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatActionSelectorPanel");
    expect(source).toContain("sourceLabel");
    expect(source).toContain("PanelTitleWithSource");
    expect(source).toContain("Action selector");
    expect(source).toContain("Secondary action");
    expect(source).toContain("Movement");
    expect(source).toContain("Description");
    expect(source).not.toContain("<span>Additional</span>");
    expect(source).toContain("roundNumber");
    expect(source).toContain("PlayerCombatParryContextPanel");
    expect(source).toContain("Parry context");
    expect(source).toContain("PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS");
    expect(source).toContain('itemLabel="Main hand"');
    expect(source).toContain('itemLabel="Off hand"');
    expect(source).not.toContain('gridTemplateColumns: "4.75rem 7rem auto"');
    expect(source).not.toContain('style={{ width: "7rem" }}');
    expect(source).toContain("to ${getPlayerEncounterParryDirectionLabel(coverageDirection)}");
    // The parry coverage label must stay wrappable. Pinned to one line it overflowed the phase
    // card and the neighbouring card painted over it at normal desktop widths (#607).
    expect(source).not.toContain(
      'style={{ color: "#5e5a50", fontSize: "0.82rem", whiteSpace: "nowrap" }}',
    );
    expect(source).not.toContain('itemLabel={mainHandItemLabel || "Unarmed"}');
    expect(source).not.toContain('itemLabel={offHandItemLabel || "Unarmed"}');
    expect(source).not.toContain("PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS");
    expect(source).toContain("PlayerCombatOpponentSelector");
    expect(source).toContain("Opponent to counter");
    expect(source).toContain("Choose opponent");
    expect(source).toContain("selectedOpponentId");
    expect(source).toContain("onSelectedOpponentChange");
    expect(source).toContain("PlayerCombatActionButtonPanel");
    expect(source).toContain("Current action");
    expect(source).not.toContain("Action button");
    expect(source).toContain("validationMessage");
    expect(source).toContain("getPlayerCombatActionButtonLabel");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("getGmCombatStepActionLabel");
    expect(source).toContain("Declare action");
    expect(source).toContain("Review modifiers");
    expect(source).toContain("Phase 1 initiative");
    expect(source).not.toContain("Declare action — DE");
    expect(source).toContain("Waiting for GM");
    expect(source).toContain("Declare modifiers");
    expect(source).not.toContain("Set/Roll");
    expect(source).toContain("Roll phase 1 initiative");
    expect(source).toContain("Roll phase 2 initiative");
    expect(source).toContain("Roll phase 1 attack");
    expect(source).toContain("Roll phase 2 attack");
    expect(source).toContain("Declare phase 2 modifiers");
    expect(source).toContain('textAlign: "center"');
    expect(source).toContain('width: "80%"');
    expect(source).toContain('justifySelf: "center"');
    expect(source).toContain("PlayerCombatActionResultPanel");
    expect(source).toContain("formatCombatInitiativeRoll");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).toContain(
      "Main: I ${baseInitiative} + Initiative ${modifierAdjustment} + roll ${rollTotal} = ${initiative.total}",
    );
    expect(source).toContain("rankLabel");
    expect(source).toContain("resultLabel");
    expect(source).toContain("interface PlayerCombatActionResultSection");
    expect(source).toContain("sections?: readonly PlayerCombatActionResultSection[]");
    expect(source).toContain("result?.sections?.length");
    expect(source).toContain("section.calculations.map");
    expect(source).toContain("<CombatCalculationPanel");
    expect(source).toContain("<strong>{section.resultLine}</strong>");
    expect(source).toContain("fontWeight: 400");
    expect(source.indexOf("result.rankLabel")).toBeLessThan(
      source.indexOf("result.interpretedResult"),
    );
    expect(source.indexOf("result.interpretedResult")).toBeLessThan(
      source.indexOf("result.resultLabel"),
    );
    expect(source).toContain('background: "#f6f5ef"');
    expect(source).toContain('boxSizing: "border-box"');
    expect(source).toContain('display: "grid"');
    expect(source).toContain("minHeight: 58");
    expect(source).toContain('width: "100%"');
    expect(source).not.toContain('height: "100%"');
    expect(source).not.toContain("minHeight: 104");
    expect(source).not.toContain("{result?.value ??");
    expect(source).not.toContain("result?.phaseLabel");
    expect(source).not.toContain("No result recorded.");
    expect(source).not.toContain("Description: {detailText}");
    expect(source).not.toContain("<span>Movement:</span>");
    expect(source).toContain("Mod");
    expect(source).toContain("Dur");
    expect(source).toContain("Details");
    expect(source).not.toContain("General/Fatigue {generalTotal}");
  });
});
