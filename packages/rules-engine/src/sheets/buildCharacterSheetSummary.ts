import type {
  CharacterBuild,
  ProfessionFamilyDefinition,
  ProfessionDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";

import { buildChargenDraftView, type ChargenDraftView } from "../chargen/primaryAllocation";
import {
  buildCharacterEquipmentLoadoutSummary,
  calculateEquipmentDrivenDodge,
  type CharacterEquipmentLoadoutSummary
} from "../equipment/manageCharacterEquipment";
import { calculateAdjustedStats } from "../stats/calculateAdjustedStats";

interface CanonicalContentShape {
  professionFamilies: ProfessionFamilyDefinition[];
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface CharacterSheetCombatSkillSummary {
  baseOb: number;
  // Canonical workbook-equivalent combat skill XP propagated from chargen.
  // This is the skill value combat math should consume before linked stats.
  effectiveSkillNumber: number;
  name: string;
  parryValue: number;
  skillId: string;
  specializationNames: string[];
  totalSkill: number;
}

export interface CharacterSheetSummary {
  adjustedStats: Record<string, number>;
  combat: {
    combatGroups: ChargenDraftView["groups"];
    dodge: number;
    hasShield: boolean;
    parry: number;
    weaponSkills: CharacterSheetCombatSkillSummary[];
  };
  distractionLevel: number;
  draftView: ChargenDraftView;
  equipment: CharacterEquipmentLoadoutSummary;
  gms: {
    byGroup: Array<{
      gms: number;
      groupId: string;
      name: string;
    }>;
    total: number;
  };
  professionName?: string;
  societyLabel?: string;
  seniority: number;
  totalSkillPointsInvested: number;
}

const MARTIAL_GROUP_ID = "martial";

function getProfessionName(
  content: CanonicalContentShape,
  professionId: string | undefined
): string | undefined {
  if (!professionId) {
    return undefined;
  }

  return content.professions.find((profession) => profession.id === professionId)?.name;
}

function getSocietyLabel(
  content: CanonicalContentShape,
  societyId: string | undefined,
  societyLevel: number | undefined
): string | undefined {
  if (societyId === undefined && societyLevel === undefined) {
    return undefined;
  }

  return content.societyLevels.find(
    (society) =>
      (societyId === undefined || society.societyId === societyId) &&
      (societyLevel === undefined || society.societyLevel === societyLevel)
  )?.societyName;
}

export function buildCharacterSheetSummary(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  statModifiers?: Record<string, number>;
}): CharacterSheetSummary {
  const draftView = buildChargenDraftView({
    content: input.content,
    professionId: input.build.professionId,
    profile: input.build.profile,
    progression: input.build.progression,
    societyId: input.build.societyId,
    societyLevel: input.build.societyLevel
  });
  const adjustedStats = calculateAdjustedStats({
    baseStats: input.build.profile.rolledStats,
    modifiers: {
      ...(input.build.statModifiers ?? {}),
      ...(input.statModifiers ?? {})
    }
  });
  const equipment = buildCharacterEquipmentLoadoutSummary({
    build: input.build,
    content: input.content
  });
  const combatGroups = draftView.groups.filter((group) => group.groupId === MARTIAL_GROUP_ID);
  const weaponSkills = equipment.equippedWeapons.map((weapon) => {
    const skill = weapon.skillName
      ? draftView.skills.find((candidate) => candidate.name === weapon.skillName)
      : undefined;

    return {
      baseOb: weapon.baseOb,
      effectiveSkillNumber: skill?.effectiveSkillNumber ?? 0,
      name: weapon.name,
      parryValue: weapon.parryValue,
      skillId: weapon.skillName ?? weapon.id,
      specializationNames: weapon.specializationNames,
      totalSkill: weapon.skillTotal ?? 0
    };
  });
  const totalGms = input.build.progression.skillGroups.reduce(
    (sum, group) => sum + (group.gms ?? 0),
    0
  );

  return {
    adjustedStats,
    combat: {
      combatGroups,
      dodge: calculateEquipmentDrivenDodge({
        dex: adjustedStats.dex ?? 0,
        shieldBonus: equipment.shieldBonus
      }),
      hasShield: equipment.hasEquippedShield,
      parry: Math.max(0, ...weaponSkills.map((skill) => skill.parryValue)),
      weaponSkills
    },
    distractionLevel: input.build.profile.distractionLevel,
    draftView,
    equipment,
    gms: {
      byGroup: draftView.groups
        .filter((group) => group.gms > 0)
        .map((group) => ({
          gms: group.gms,
          groupId: group.groupId,
          name: group.name
        })),
      total: totalGms
    },
    professionName: getProfessionName(input.content, input.build.professionId),
    societyLabel: getSocietyLabel(input.content, input.build.societyId, input.build.societyLevel),
    seniority: draftView.totalSkillPointsInvested,
    totalSkillPointsInvested: draftView.totalSkillPointsInvested
  };
}
