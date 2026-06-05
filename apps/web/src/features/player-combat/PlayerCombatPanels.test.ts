import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildPlayerCombatModifierRows } from "./PlayerCombatPanels";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PlayerCombatPanels.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PlayerCombatPanels", () => {
  it("exposes reusable combat modifier rows with the shared player combat buckets", () => {
    const source = readSource();

    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("getPlayerEncounterCombatModifierTotals");
    expect(source).toContain("filterCombatModifierEntriesForPhase");
    expect(source).toContain("phaseKey?: EncounterCombatPhaseKey");
    expect(source).toContain("General/Fatigue");
    expect(source).toContain("liveModifiers?.generalFatigueRaw");
    expect(source).toContain("Initiative");
    expect(source).toContain("liveModifiers?.initiativeRaw");
    expect(source).toContain("Skill/OB");
    expect(source).toContain("DB/Parry");
    expect(source.indexOf('label: "General/Fatigue"')).toBeLessThan(
      source.indexOf('label: "Initiative"'),
    );
    expect(source.indexOf('label: "Initiative"')).toBeLessThan(source.indexOf('label: "Skill/OB"'));
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
            notes: "attack parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:parry-attack:phase2:db-parry",
            notes: "parry attack",
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
    const phase1DbRow = phase1Rows.find((row) => row.bucketKey === "situation_db");
    const phase2DbRow = phase2Rows.find((row) => row.bucketKey === "situation_db");
    const phase1ObRow = phase1Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const phase2ObRow = phase2Rows.find((row) => row.bucketKey === "situation_ob_skill");
    const noPhaseDbRow = noPhaseRows.find((row) => row.bucketKey === "situation_db");
    const noPhaseObRow = noPhaseRows.find((row) => row.bucketKey === "situation_ob_skill");

    expect(noPhaseDbRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual(["manual-db"]);
    expect(noPhaseDbRow?.total).toBe(-1);
    expect(noPhaseObRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual(["manual-ob"]);
    expect(noPhaseObRow?.total).toBe(2);
    expect(phase1DbRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual([
      "manual-db",
      "attack parry",
    ]);
    expect(phase1DbRow?.total).toBe(-5);
    expect(phase2DbRow?.entries.map((entry) => entry.notes ?? entry.id)).toEqual([
      "manual-db",
      "parry attack",
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
  });

  it("keeps player combat modifiers editable while allowing read-only inspector use", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("readOnly");
    expect(source).toContain("onAddEntry");
    expect(source).toContain("onRemoveEntry");
    expect(source).toContain("onUpdateEntry");
    expect(source).toContain("disabled={controlsDisabled}");
    expect(source).toContain("row.locked");
    expect(source).toContain("compactModifierGroupHeaderStyle");
    expect(source).toContain("compactModifierMiniTableStyle");
    expect(source).toContain("compactModifierMiniTableHeaderStyle");
    expect(source).toContain("compactModifierMiniTableEntryRowStyle");
    expect(source).not.toContain("compactModifierMiniTableDraftRowStyle");
    expect(source).toContain('gridTemplateColumns: "4.5rem 4.5rem minmax(0, 1fr) 1.75rem"');
    expect(source).toContain('["Mod", "Dur", "Details"].map');
    expect(source).not.toContain('["Mod", "Dur", "Details", "Remove"].map');
    expect(source).toContain("createModifierEntryDraft");
    expect(source).not.toContain("createModifierEntryFromDraft");
    expect(source).not.toContain("updateEntryDraft");
    expect(source).not.toContain("addEntryFromDraft");
    expect(source).toContain("onAddEntry(row.bucketKey, createModifierEntryDraft())");
    expect(source).toContain("compactModifierNumberInputStyle");
    expect(source).toContain("compactModifierDetailsInputStyle");
    expect(source).toContain("compactModifierRemoveButtonStyle");
    expect(source).toContain('width: "5.5ch"');
    expect(source).toContain('boxSizing: "border-box"');
    expect(source).toContain("row.entries.length > 0");
    expect(source).toContain("aria-label={`${row.label} modifier value`}");
    expect(source).not.toContain("aria-label={`${row.label} new modifier value`}");
    expect(source).toContain("aria-label={`${row.label} modifier details`}");
    expect(source).not.toContain("aria-label={`${row.label} new modifier details`}");
    expect(source).toContain('"durationRounds"');
    expect(source).toContain('value={entry.durationRounds ?? ""}');
    expect(source).not.toContain('value={getEntryDraft(row.bucketKey).durationRounds ?? ""}');
    expect(source).not.toContain("value={getEntryDraft(row.bucketKey).notes}");
    expect(source).toContain(
      "onClick={() => onAddEntry(row.bucketKey, createModifierEntryDraft())}",
    );
    expect(source).toContain("onClick={() => onRemoveEntry(row.bucketKey, entry.id)}");
    expect(source).toContain('aria-label="Remove modifier"');
    expect(source).toContain('title="Remove modifier"');
    expect(source).toMatch(/>\s*-\s*<\/button>/);
    expect(source).not.toContain(">Remove</button>");
    expect(source).toContain('<span aria-hidden="true" />');
    expect(source).toContain("formatModifierDuration");
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
      'gridTemplateColumns: "minmax(12rem, 0.7fr) minmax(14rem, 1fr) minmax(14rem, 1fr)"',
    );
    expect(source).toContain("gridTemplateColumns: playerCombatPanelRowStyle.gridTemplateColumns");
    expect(source).toContain("PlayerCombatAttackStatsTable");
    expect(source).toContain("PlayerCombatDefenseStatsTable");
    expect(source).toContain("PlayerCombatAttackTargetSelector");
    expect(source).toContain("PlayerCombatAttackLocationSelector");
    expect(source.indexOf("export function PlayerCombatAttackTargetSelector")).toBeLessThan(
      source.indexOf("export function PlayerCombatAttackLocationSelector"),
    );
    expect(source.indexOf("export function PlayerCombatAttackLocationSelector")).toBeLessThan(
      source.indexOf("function ParryDirectionSelector"),
    );
    expect(source).toContain("Target");
    expect(source).toContain("targetOptions.map");
    expect(source).toContain("selectedTargetUnavailable");
    expect(source).toContain('value={combatContext.targetParticipantId ?? ""}');
    expect(source).toContain("targetParticipantId: event.target.value || undefined");
    expect(source).toContain("Attack location");
    expect(source).toContain("No target");
    expect(source).toContain("HIT_LOCATIONS.map");
    expect(source).toContain("getHitLocationFullLabel(location)");
    expect(source).toContain('value={combatContext.targetLocation ?? "none"}');
    expect(source).toContain('targetLocation: targetLocation === "none" ? undefined : targetLocation');
    expect(source).toContain("compactPhaseContextSelectorColumns");
    expect(source).toContain('const compactPhaseContextSelectorColumns = "6.5rem 7rem auto"');
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
    expect(source).not.toContain('itemLabel={mainHandItemLabel || "Unarmed"}');
    expect(source).not.toContain('itemLabel={offHandItemLabel || "Unarmed"}');
    expect(source).not.toContain("PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS");
    expect(source).not.toContain("Choose opponent");
    expect(source).not.toContain("selectedOpponentId");
    expect(source).toContain("PlayerCombatActionButtonPanel");
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
      "Main: I ${baseInitiative} + [Gen/Fatigue + Initiative] ${modifierAdjustment} + roll ${rollTotal} = ${initiative.total}",
    );
    expect(source).toContain("rankLabel");
    expect(source).toContain("resultLabel");
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
    expect(source).not.toContain("Movement:");
    expect(source).toContain("Mod");
    expect(source).toContain("Dur");
    expect(source).toContain("Details");
    expect(source).not.toContain("General/Fatigue {generalTotal}");
  });
});
