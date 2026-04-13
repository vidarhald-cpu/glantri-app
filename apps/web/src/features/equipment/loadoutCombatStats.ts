import type { CharacterSheetSummary } from "@glantri/rules-engine";
import type { SkillDefinition } from "@glantri/domain";

import type { CombatStateTableModel } from "./combatStatePanel";

function getRoundedLinkedStatAverage(
  adjustedStats: Record<string, number>,
  linkedStats: string[],
): number | null {
  if (linkedStats.length === 0) {
    return null;
  }

  const values = linkedStats
    .map((stat) => adjustedStats[stat])
    .filter((value): value is number => typeof value === "number");

  if (values.length !== linkedStats.length) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildSkillRow(input: {
  adjustedStats: Record<string, number>;
  draftSkills: CharacterSheetSummary["draftView"]["skills"];
  fallbackTotal?: number | null;
  skillDefinition?: SkillDefinition;
}): [string, number | string, number | string, number | string] | null {
  if (!input.skillDefinition) {
    return null;
  }

  const skillView = input.draftSkills.find((skill) => skill.skillId === input.skillDefinition?.id);
  if (!skillView) {
    return null;
  }

  const statsValue = getRoundedLinkedStatAverage(
    input.adjustedStats,
    input.skillDefinition.linkedStats,
  );
  const xpValue = skillView.effectiveSkillNumber;
  const totalValue = input.fallbackTotal ?? (statsValue != null ? statsValue + xpValue : null);

  return [
    input.skillDefinition.name,
    statsValue ?? "—",
    xpValue,
    totalValue ?? "—",
  ];
}

export function buildLoadoutCombatStatsTable(input: {
  adjustedStats: CharacterSheetSummary["adjustedStats"];
  draftSkills: CharacterSheetSummary["draftView"]["skills"];
  skills: SkillDefinition[];
  workbookPerceptionValue: number | null;
}): CombatStateTableModel {
  const perceptionDefinition = input.skills.find(
    (skill) => skill.name.toLowerCase() === "perception",
  );
  const combatExperienceDefinition = input.skills.find(
    (skill) => skill.name.toLowerCase() === "combat experience",
  );

  const rows = [
    buildSkillRow({
      adjustedStats: input.adjustedStats,
      draftSkills: input.draftSkills,
      fallbackTotal: input.workbookPerceptionValue,
      skillDefinition: perceptionDefinition,
    }),
    buildSkillRow({
      adjustedStats: input.adjustedStats,
      draftSkills: input.draftSkills,
      skillDefinition: combatExperienceDefinition,
    }),
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    title: "Skills",
    columns: ["Skill", "Stats", "XP", "Total"],
    rows,
  };
}

