import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PlayerCombatPanels.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PlayerCombatPanels", () => {
  it("exposes reusable combat modifier rows with the shared player combat buckets", () => {
    const source = readSource();

    expect(source).toContain("buildPlayerCombatModifierRows");
    expect(source).toContain("getPlayerEncounterCombatModifierTotals");
    expect(source).toContain("General/Fatigue");
    expect(source).toContain("liveModifiers?.generalFatigueRaw");
    expect(source).toContain("Skill/OB");
    expect(source).toContain("DB");
  });

  it("keeps player combat modifiers editable while allowing read-only inspector use", () => {
    const source = readSource();

    expect(source).toContain("PlayerCombatModifierPanel");
    expect(source).toContain("useState");
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
    expect(source).toContain("compactModifierMiniTableDraftRowStyle");
    expect(source).toContain('gridTemplateColumns: "2.5rem 2.5rem minmax(0, 1fr)"');
    expect(source).toContain('gridTemplateColumns: "2.5rem 2.5rem minmax(0, 1fr) 1.5rem"');
    expect(source).toContain('["Mod", "Dur", "Details"].map');
    expect(source).not.toContain('["Mod", "Dur", "Details", "Remove"].map');
    expect(source).toContain("createModifierEntryFromDraft");
    expect(source).toContain("updateEntryDraft");
    expect(source).toContain("addEntryFromDraft");
    expect(source).toContain("onAddEntry(bucketKey, createModifierEntryFromDraft");
    expect(source).toContain("compactModifierNumberInputStyle");
    expect(source).toContain("compactModifierDetailsInputStyle");
    expect(source).toContain("compactModifierRemoveButtonStyle");
    expect(source).toContain('width: "3.5ch"');
    expect(source).toContain('boxSizing: "border-box"');
    expect(source).toContain("aria-label={`${row.label} modifier value`}");
    expect(source).toContain("aria-label={`${row.label} new modifier value`}");
    expect(source).toContain("aria-label={`${row.label} modifier details`}");
    expect(source).toContain("aria-label={`${row.label} new modifier details`}");
    expect(source).toContain('"durationRounds"');
    expect(source).toContain('value={entry.durationRounds ?? ""}');
    expect(source).toContain('value={getEntryDraft(row.bucketKey).durationRounds ?? ""}');
    expect(source).toContain("value={getEntryDraft(row.bucketKey).notes}");
    expect(source).toContain("onClick={() => addEntryFromDraft(row.bucketKey)}");
    expect(source).toContain("onClick={() => onRemoveEntry(row.bucketKey, entry.id)}");
    expect(source).toContain('aria-label="Remove modifier"');
    expect(source).toContain('title="Remove modifier"');
    expect(source).toMatch(/>\s*-\s*<\/button>/);
    expect(source).not.toContain(">Remove</button>");
    expect(source).not.toContain('<span aria-hidden="true" />');
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
    expect(source).toContain('gridTemplateColumns: "4.75rem 7rem auto"');
    expect(source).toContain('style={{ width: "7rem" }}');
    expect(source).toContain("to ${getPlayerEncounterParryDirectionLabel(coverageDirection)}");
    expect(source).not.toContain('itemLabel={mainHandItemLabel || "Unarmed"}');
    expect(source).not.toContain('itemLabel={offHandItemLabel || "Unarmed"}');
    expect(source).not.toContain("PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS");
    expect(source).not.toContain("Choose opponent");
    expect(source).not.toContain("selectedOpponentId");
    expect(source).toContain("PlayerCombatActionButtonPanel");
    expect(source).toContain("getPlayerCombatActionButtonLabel");
    expect(source).toContain("getPlayerCombatStepLabel");
    expect(source).toContain("getGmCombatStepActionLabel");
    expect(source).toContain("Declare action");
    expect(source).toContain("Review modifiers");
    expect(source).toContain("Phase 1 initiative");
    expect(source).not.toContain("Declare action — DE");
    expect(source).toContain("Waiting for GM");
    expect(source).toContain("Declare modifiers");
    expect(source).toContain("Set/Roll phase 1 initiative");
    expect(source).toContain("Set/Roll phase 2 initiative");
    expect(source).toContain("PlayerCombatActionResultPanel");
    expect(source).toContain("formatCombatInitiativeRoll");
    expect(source).toContain("formatCombatInitiativeFormula");
    expect(source).toContain(
      "Main: I ${baseInitiative} + [ ] 0 + roll ${rollTotal} = ${initiative.total}",
    );
    expect(source).toContain("rankLabel");
    expect(source).not.toContain("Movement:");
    expect(source).toContain("Mod");
    expect(source).toContain("Dur");
    expect(source).toContain("Details");
    expect(source).not.toContain("General/Fatigue {generalTotal}");
  });
});
