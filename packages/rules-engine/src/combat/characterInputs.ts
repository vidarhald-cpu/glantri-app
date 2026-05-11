import { getWorkbookStatGm } from "./workbookCombatMath";
import type { CharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";

export interface CombatStateCharacterInputs {
  constitution: number | null;
  dexterityGm: number | null;
  dexterity: number | null;
  // Canonical workbook-equivalent combat skill XP used by combat calculations.
  // This is effectiveSkillNumber: best group contribution + direct skill ranks.
  combatSkillXpByName: Record<string, number>;
  dodgeCombatSkillXp: number | null;
  parryCombatSkillXp: number | null;
  brawlingCombatSkillXp: number | null;
  size: number | null;
  sizeGm: number | null;
  strengthGm: number | null;
  strength: number | null;
}

export function buildCombatStateCharacterInputs(
  sheet: CharacterSheetSummary,
): CombatStateCharacterInputs {
  const combatSkillXpByName = Object.fromEntries(
    sheet.draftView.skills.map((skill) => [
      skill.name,
      skill.effectiveSkillNumber,
    ]),
  );
  const strength = sheet.adjustedStats.str ?? null;
  const constitution = sheet.adjustedStats.con ?? null;
  const dexterity = sheet.adjustedStats.dex ?? null;
  const size = sheet.adjustedStats.siz ?? null;

  return {
    brawlingCombatSkillXp: combatSkillXpByName["Brawling"] ?? null,
    combatSkillXpByName,
    constitution,
    dexterity,
    dexterityGm: getWorkbookStatGm(dexterity),
    dodgeCombatSkillXp: combatSkillXpByName["Dodge"] ?? null,
    parryCombatSkillXp: combatSkillXpByName["Parry"] ?? null,
    size,
    sizeGm: getWorkbookStatGm(size),
    strength,
    strengthGm: getWorkbookStatGm(strength),
  };
}
