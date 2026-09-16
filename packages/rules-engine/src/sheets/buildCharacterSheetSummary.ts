import {
  deriveCharacterStatLayers,
  type CharacterBuild,
  type CharacterStatLayers,
  type ProfessionFamilyDefinition,
  type ProfessionDefinition,
  type ProfessionSkillMap,
  type SkillDefinition,
  type SkillGroupDefinition,
  type SkillSpecialization,
  type SocietyLevelAccess,
} from "@glantri/domain";

import { buildChargenDraftView, type ChargenDraftView } from "../chargen/primaryAllocation";
import {
  buildCharacterEquipmentLoadoutSummary,
  calculateEquipmentDrivenDodge,
  type CharacterEquipmentLoadoutSummary,
} from "../equipment/manageCharacterEquipment";

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
  /** @deprecated Use statLayers.current. Retained for compatible consumers. */
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
  skillPoints: {
    current: number;
    original: number;
    successfulProgressionGains: number;
  };
  statLayers?: CharacterStatLayers;
  totalSkillPointsInvested: number;
}

const MARTIAL_GROUP_ID = "martial";

function getProfessionName(
  content: CanonicalContentShape,
  professionId: string | undefined,
): string | undefined {
  if (!professionId) {
    return undefined;
  }

  return content.professions.find((profession) => profession.id === professionId)?.name;
}

function getSocietyLabel(
  content: CanonicalContentShape,
  societyId: string | undefined,
  societyLevel: number | undefined,
): string | undefined {
  if (societyId === undefined && societyLevel === undefined) {
    return undefined;
  }

  return content.societyLevels.find(
    (society) =>
      (societyId === undefined || society.societyId === societyId) &&
      (societyLevel === undefined || society.societyLevel === societyLevel),
  )?.societyName;
}

export function buildCharacterSheetSummary(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  additionalCurrentStatModifiers?: Record<string, number>;
}): CharacterSheetSummary {
  // Retained target snapshots are validated by the service boundary. Historical builds
  // keep their own definitions and spend; no successor mapping or repricing occurs here.
  if (input.build.targetChargen) {
    const merge = <T extends { id: string }>(base: T[], snapshots: T[]) => [
      ...snapshots,
      ...base.filter((item) => !snapshots.some((s) => s.id === item.id)),
    ];
    const identity = input.build.targetChargen;
    input = {
      ...input,
      content: {
        ...input.content,
        professions: merge(input.content.professions, [
          {
            id: input.build.professionId!,
            familyId: identity.familyId,
            name: identity.professionName,
            subtypeName: identity.professionName,
          },
        ]),
        professionFamilies: merge(input.content.professionFamilies, [
          { id: identity.familyId, name: identity.professionName },
        ]),
        skillGroups: merge(
          input.content.skillGroups,
          input.build.progression.skillGroups.flatMap((g) =>
            g.targetDefinition ? [g.targetDefinition] : [],
          ),
        ),
        skills: merge(
          input.content.skills,
          input.build.progression.skills.flatMap((s) =>
            s.targetDefinition ? [s.targetDefinition] : [],
          ),
        ),
        specializations: merge(
          input.content.specializations,
          input.build.progression.specializations.flatMap((s) =>
            s.targetDefinition ? [s.targetDefinition] : [],
          ),
        ),
      },
    };
  }
  const statLayers = deriveCharacterStatLayers(input.build, input.additionalCurrentStatModifiers);
  const draftView = buildChargenDraftView({
    content: input.content,
    professionId: input.build.professionId,
    civilizationId: input.build.civilizationId,
    profile: input.build.profile,
    progression: input.build.progression,
    skillLinkedStats: statLayers.current,
    societyId: input.build.societyId,
    societyLevel: input.build.societyLevel,
  });
  const adjustedStats = statLayers.current;
  const equipment = buildCharacterEquipmentLoadoutSummary({
    build: input.build,
    content: input.content,
    skillLinkedStats: statLayers.current,
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
      totalSkill: weapon.skillTotal ?? 0,
    };
  });
  const totalGms = input.build.progression.skillGroups.reduce(
    (sum, group) => sum + (group.gms ?? 0),
    0,
  );
  const successfulProgressionGains =
    input.build.progressionState?.history.reduce(
      (sum, entry) => sum + (entry.success ? entry.cost : 0),
      0,
    ) ?? 0;
  const originalSkillPoints = draftView.totalSkillPointsInvested;
  const currentSkillPoints = originalSkillPoints + successfulProgressionGains;

  return {
    adjustedStats,
    combat: {
      combatGroups,
      dodge: calculateEquipmentDrivenDodge({
        dex: adjustedStats.dex ?? 0,
        shieldBonus: equipment.shieldBonus,
      }),
      hasShield: equipment.hasEquippedShield,
      parry: Math.max(0, ...weaponSkills.map((skill) => skill.parryValue)),
      weaponSkills,
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
          name: group.name,
        })),
      total: totalGms,
    },
    professionName: getProfessionName(input.content, input.build.professionId),
    societyLabel: getSocietyLabel(input.content, input.build.societyId, input.build.societyLevel),
    seniority: currentSkillPoints,
    skillPoints: {
      current: currentSkillPoints,
      original: originalSkillPoints,
      successfulProgressionGains,
    },
    statLayers,
    totalSkillPointsInvested: currentSkillPoints,
  };
}
