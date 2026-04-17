import type { CanonicalContent } from "@glantri/content";
import type {
  GlantriCharacteristicBlock,
  ProfessionDefinition,
  ReusableEntity,
  SkillDefinition
} from "@glantri/domain";
import { getSkillGroupIds, glantriCharacteristicOrder } from "@glantri/domain";
import { resolveGlantriCharacterStats } from "@glantri/rules-engine";
import type { EquipmentTemplate } from "@glantri/domain/equipment";

export interface SocietyOption {
  professionIds: string[];
  skillGroupIds: string[];
  skillIds: string[];
  shortDescription?: string;
  socialClasses: string[];
  societyId: string;
  societyLevel?: number;
  societyName: string;
}

export interface NpcArchetypeSkillSelection {
  skillId: string;
  targetLevel: number;
}

export type NpcArchetypeSeniority =
  | "unskilled"
  | "basic"
  | "under_training"
  | "fully_trained"
  | "veteran"
  | "expert";

export type NpcArchetypeSkillRelevance = "core" | "optional" | "other";

export interface NpcArchetypeVariability {
  gearSubstitutionNotes?: string;
  notes?: string;
  skillVariance: number;
  statVariance: number;
}

export interface HumanoidNpcArchetypeDraft {
  description: string;
  gearNotes: string;
  name: string;
  professionId: string;
  roleLabel: string;
  seniority: NpcArchetypeSeniority;
  selectedGearTemplateIds: string[];
  selectedSkillGroupIds: string[];
  skillSelections: NpcArchetypeSkillSelection[];
  societyId: string;
  stats: GlantriCharacteristicBlock;
  tags: string;
  variability: NpcArchetypeVariability;
}

export interface HumanoidNpcArchetypeSnapshot {
  generationHints: {
    competencyBands: Array<{ label: string; max: number; min: number }>;
    suitabilityScale: Array<{ bonus: number; label: string }>;
  };
  gear: {
    notes?: string;
    templateIds: string[];
    templateNames: string[];
  };
  profession: {
    familyId?: string;
    familyName?: string;
    id: string;
    name: string;
  };
  schemaVersion: 1;
  skillGroupIds: string[];
  skills: Array<{ skillId: string; skillName: string; targetLevel: number }>;
  seniority: NpcArchetypeSeniority;
  society: {
    societyId: string;
    societyName: string;
  };
  stats: {
    base: GlantriCharacteristicBlock;
    final: GlantriCharacteristicBlock;
  };
  variability: NpcArchetypeVariability;
}

export interface ParsedHumanoidNpcTemplateSummary {
  actorClass: "template";
  equipmentProfile?: string;
  gearNames: string[];
  isHumanoidNpcArchetype: boolean;
  profession?: string;
  roleLabel?: string;
  seniority?: NpcArchetypeSeniority;
  skillCount: number;
  skillGroupCount: number;
  societyName?: string;
  stats?: {
    base: GlantriCharacteristicBlock;
    final: GlantriCharacteristicBlock;
  };
  tags?: string[];
  variability?: NpcArchetypeVariability;
}

export interface LoadedHumanoidNpcArchetypeDraft {
  draft: HumanoidNpcArchetypeDraft;
  isHumanoidNpcArchetype: boolean;
}

const DEFAULT_BASE_STAT = 10;
const DEFAULT_SENIORITY: NpcArchetypeSeniority = "fully_trained";

export const NPC_ARCHETYPE_SENIORITY_OPTIONS: Array<{
  defaultSkillLevel: number;
  id: NpcArchetypeSeniority;
  label: string;
  rangeLabel: string;
}> = [
  { defaultSkillLevel: 0, id: "unskilled", label: "Unskilled", rangeLabel: "0" },
  { defaultSkillLevel: 3, id: "basic", label: "Basic", rangeLabel: "1-5" },
  { defaultSkillLevel: 8, id: "under_training", label: "Under training", rangeLabel: "6-10" },
  { defaultSkillLevel: 13, id: "fully_trained", label: "Fully trained", rangeLabel: "11-15" },
  { defaultSkillLevel: 17, id: "veteran", label: "Veteran / Senior", rangeLabel: "16-19" },
  { defaultSkillLevel: 21, id: "expert", label: "Expert / Guru", rangeLabel: "20+" }
];

export function createEmptyHumanoidNpcArchetypeDraft(): HumanoidNpcArchetypeDraft {
  return {
    description: "",
    gearNotes: "",
    name: "",
    professionId: "",
    roleLabel: "",
    seniority: DEFAULT_SENIORITY,
    selectedGearTemplateIds: [],
    selectedSkillGroupIds: [],
    skillSelections: [],
    societyId: "",
    stats: Object.fromEntries(
      glantriCharacteristicOrder.map((stat) => [stat, DEFAULT_BASE_STAT])
    ) as GlantriCharacteristicBlock,
    tags: "",
    variability: {
      gearSubstitutionNotes: "",
      notes: "",
      skillVariance: 2,
      statVariance: 1
    }
  };
}

export function getDefaultSkillLevelForSeniority(seniority: NpcArchetypeSeniority): number {
  return (
    NPC_ARCHETYPE_SENIORITY_OPTIONS.find((option) => option.id === seniority)?.defaultSkillLevel ?? 0
  );
}

export function getOptionalSkillLevelForSeniority(seniority: NpcArchetypeSeniority): number {
  const index = NPC_ARCHETYPE_SENIORITY_OPTIONS.findIndex((option) => option.id === seniority);

  if (index <= 0) {
    return getDefaultSkillLevelForSeniority("unskilled");
  }

  return NPC_ARCHETYPE_SENIORITY_OPTIONS[index - 1]?.defaultSkillLevel ?? 0;
}

export function getDefaultSkillLevelForRelevance(input: {
  relevance: NpcArchetypeSkillRelevance;
  seniority: NpcArchetypeSeniority;
}): number {
  if (input.relevance === "optional") {
    return getOptionalSkillLevelForSeniority(input.seniority);
  }

  return getDefaultSkillLevelForSeniority(input.seniority);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());

  return entries.length > 0 ? entries : undefined;
}

export function listSocietyOptions(content: CanonicalContent): SocietyOption[] {
  const societyDefinitionsById = new Map(
    (content.societies ?? []).map((society) => [society.id, society])
  );
  const societies = new Map<string, SocietyOption>();

  for (const access of content.societyLevels) {
    const existing = societies.get(access.societyId);
    const societyDefinition = societyDefinitionsById.get(access.societyId);

    if (!existing) {
      societies.set(access.societyId, {
        professionIds: [...access.professionIds],
        skillGroupIds: [...access.skillGroupIds],
        skillIds: [...access.skillIds],
        shortDescription: societyDefinition?.shortDescription,
        socialClasses: access.socialClass ? [access.socialClass] : [],
        societyId: access.societyId,
        societyLevel: societyDefinition?.societyLevel,
        societyName: access.societyName
      });
      continue;
    }

    existing.professionIds = [...new Set([...existing.professionIds, ...access.professionIds])];
    existing.skillGroupIds = [...new Set([...existing.skillGroupIds, ...access.skillGroupIds])];
    existing.skillIds = [...new Set([...existing.skillIds, ...access.skillIds])];
    existing.socialClasses = [
      ...new Set([
        ...existing.socialClasses,
        ...(access.socialClass ? [access.socialClass] : [])
      ])
    ];
  }

  return [...societies.values()].sort((left, right) =>
    left.societyName.localeCompare(right.societyName)
  );
}

export function listProfessionsForSociety(input: {
  content: CanonicalContent;
  societyId: string;
}): ProfessionDefinition[] {
  const society = listSocietyOptions(input.content).find(
    (option) => option.societyId === input.societyId
  );

  if (!society) {
    return [];
  }

  return input.content.professions
    .filter((profession) => society.professionIds.includes(profession.id))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function listSuggestedSkillGroupIds(input: {
  content: CanonicalContent;
  professionId: string;
  societyId: string;
}): string[] {
  const society = listSocietyOptions(input.content).find(
    (option) => option.societyId === input.societyId
  );
  const profession = input.content.professions.find(
    (candidate) => candidate.id === input.professionId
  );

  const directGroups = input.content.professionSkills
    .filter((entry) => entry.grantType === "group")
    .filter((entry) => {
      if (!profession) {
        return false;
      }

      if (entry.scope === "family") {
        return entry.professionId === profession.familyId;
      }

      return entry.professionId === profession.id;
    })
    .map((entry) => entry.skillGroupId)
    .filter((groupId): groupId is string => typeof groupId === "string");

  return [...new Set([...(society?.skillGroupIds ?? []), ...directGroups])];
}

export function listAvailableSkills(input: {
  content: CanonicalContent;
  professionId: string;
  selectedSkillGroupIds: string[];
  societyId: string;
}): SkillDefinition[] {
  const suggestedSkillGroupIds = new Set(
    listSuggestedSkillGroupIds({
      content: input.content,
      professionId: input.professionId,
      societyId: input.societyId
    })
  );
  const society = listSocietyOptions(input.content).find(
    (option) => option.societyId === input.societyId
  );
  const profession = input.content.professions.find(
    (candidate) => candidate.id === input.professionId
  );
  const directSkillIds = new Set(
    input.content.professionSkills
      .filter((entry) => entry.skillId)
      .filter((entry) => {
        if (!profession) {
          return false;
        }

        if (entry.scope === "family") {
          return entry.professionId === profession.familyId;
        }

        return entry.professionId === profession.id;
      })
      .map((entry) => entry.skillId as string)
  );
  const selectedGroupIds = new Set(input.selectedSkillGroupIds);
  const societySkillIds = new Set(society?.skillIds ?? []);

  return input.content.skills
    .filter((skill) => {
      const skillGroupIds = getSkillGroupIds(skill);

      return (
        skillGroupIds.some((groupId) => selectedGroupIds.has(groupId)) ||
        skillGroupIds.some((groupId) => suggestedSkillGroupIds.has(groupId)) ||
        directSkillIds.has(skill.id) ||
        societySkillIds.has(skill.id)
      );
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function listSuggestedSkills(input: {
  content: CanonicalContent;
  professionId: string;
  selectedSkillGroupIds: string[];
  societyId: string;
}): SkillDefinition[] {
  const society = listSocietyOptions(input.content).find(
    (option) => option.societyId === input.societyId
  );
  const profession = input.content.professions.find(
    (candidate) => candidate.id === input.professionId
  );
  const selectedGroupIds = new Set(input.selectedSkillGroupIds);
  const directSkillIds = new Set(
    input.content.professionSkills
      .filter((entry) => entry.skillId)
      .filter((entry) => {
        if (!profession) {
          return false;
        }

        if (entry.scope === "family") {
          return entry.professionId === profession.familyId;
        }

        return entry.professionId === profession.id;
      })
      .map((entry) => entry.skillId as string)
  );
  const societySkillIds = new Set(society?.skillIds ?? []);
  const suggestedGroupIds = new Set(
    listSuggestedSkillGroupIds({
      content: input.content,
      professionId: input.professionId,
      societyId: input.societyId
    })
  );

  return input.content.skills
    .filter((skill) => {
      const skillGroupIds = getSkillGroupIds(skill);

      return (
        directSkillIds.has(skill.id) ||
        societySkillIds.has(skill.id) ||
        skillGroupIds.some((groupId) => selectedGroupIds.has(groupId)) ||
        skillGroupIds.some((groupId) => suggestedGroupIds.has(groupId))
      );
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildHumanoidNpcArchetypeSnapshot(input: {
  content: CanonicalContent;
  draft: HumanoidNpcArchetypeDraft;
  equipmentTemplates: EquipmentTemplate[];
}): Record<string, unknown> {
  const societies = listSocietyOptions(input.content);
  const society = societies.find((option) => option.societyId === input.draft.societyId);
  const profession = input.content.professions.find(
    (candidate) => candidate.id === input.draft.professionId
  );
  const family = profession
    ? input.content.professionFamilies.find((entry) => entry.id === profession.familyId)
    : undefined;
  const gearTemplates = input.equipmentTemplates.filter((template) =>
    input.draft.selectedGearTemplateIds.includes(template.id)
  );
  const skillRows = input.draft.skillSelections
    .map((selection) => {
      const skill = input.content.skills.find((candidate) => candidate.id === selection.skillId);

      if (!skill) {
        return null;
      }

      return {
        skillId: selection.skillId,
        skillName: skill.name,
        targetLevel: selection.targetLevel
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const tags = input.draft.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const baseStats = input.draft.stats;
  const finalStats = resolveGlantriCharacterStats(baseStats);
  const equipmentProfile =
    gearTemplates.length > 0 ? gearTemplates.map((template) => template.name).join(", ") : undefined;

  const archetype: HumanoidNpcArchetypeSnapshot = {
    generationHints: {
      competencyBands: [
        { label: "unskilled", max: 0, min: 0 },
        { label: "basic", max: 5, min: 1 },
        { label: "under_training", max: 10, min: 6 },
        { label: "fully_trained", max: 15, min: 11 },
        { label: "veteran", max: 19, min: 16 },
        { label: "expert", max: 99, min: 20 }
      ],
      suitabilityScale: [
        { bonus: 0, label: "ordinary" },
        { bonus: 1, label: "suitable" },
        { bonus: 2, label: "gifted" }
      ]
    },
    gear: {
      notes: toNonEmptyString(input.draft.gearNotes),
      templateIds: gearTemplates.map((template) => template.id),
      templateNames: gearTemplates.map((template) => template.name)
    },
    profession: {
      familyId: family?.id,
      familyName: family?.name,
      id: profession?.id ?? input.draft.professionId,
      name: profession?.name ?? input.draft.professionId
    },
    schemaVersion: 1,
    skillGroupIds: input.draft.selectedSkillGroupIds,
    skills: skillRows,
    seniority: input.draft.seniority,
    society: {
      societyId: society?.societyId ?? input.draft.societyId,
      societyName: society?.societyName ?? input.draft.societyId
    },
    stats: {
      base: baseStats,
      final: finalStats
    },
    variability: {
      gearSubstitutionNotes: toNonEmptyString(input.draft.variability.gearSubstitutionNotes),
      notes: toNonEmptyString(input.draft.variability.notes),
      skillVariance: input.draft.variability.skillVariance,
      statVariance: input.draft.variability.statVariance
    }
  };

  return {
    actorClass: "template",
    archetypeType: "humanoid_npc",
    equipmentProfile,
    humanoidNpcArchetype: archetype,
    profession: archetype.profession.name,
    roleLabel: toNonEmptyString(input.draft.roleLabel) ?? archetype.profession.name,
    tags: tags.length > 0 ? tags : undefined,
    templateKind: "humanoid_npc_archetype"
  };
}

export function parseHumanoidNpcArchetypeTemplate(
  entity: ReusableEntity
): ParsedHumanoidNpcTemplateSummary {
  const snapshot = entity.snapshot;

  if (!isObject(snapshot) || !isObject(snapshot.humanoidNpcArchetype)) {
    return {
      actorClass: "template",
      equipmentProfile: toNonEmptyString(isObject(snapshot) ? snapshot.equipmentProfile : undefined),
      gearNames: [],
      isHumanoidNpcArchetype: false,
      profession: toNonEmptyString(isObject(snapshot) ? snapshot.profession : undefined),
      roleLabel: toNonEmptyString(isObject(snapshot) ? snapshot.roleLabel : undefined),
      seniority: DEFAULT_SENIORITY,
      skillCount: 0,
      skillGroupCount: 0,
      tags: parseStringArray(isObject(snapshot) ? snapshot.tags : undefined)
    };
  }

  const archetype = snapshot.humanoidNpcArchetype as Record<string, unknown>;
  const society = isObject(archetype.society) ? archetype.society : undefined;
  const profession = isObject(archetype.profession) ? archetype.profession : undefined;
  const gear = isObject(archetype.gear) ? archetype.gear : undefined;
  const stats = isObject(archetype.stats) ? archetype.stats : undefined;
  const baseStats = isObject(stats?.base) ? (stats?.base as GlantriCharacteristicBlock) : undefined;
  const finalStats = isObject(stats?.final) ? (stats?.final as GlantriCharacteristicBlock) : undefined;
  const skills = Array.isArray(archetype.skills) ? archetype.skills : [];
  const skillGroupIds = parseStringArray(archetype.skillGroupIds) ?? [];
  const variability = isObject(archetype.variability)
    ? {
        gearSubstitutionNotes: toNonEmptyString(archetype.variability.gearSubstitutionNotes),
        notes: toNonEmptyString(archetype.variability.notes),
        skillVariance:
          typeof archetype.variability.skillVariance === "number"
            ? archetype.variability.skillVariance
            : 0,
        statVariance:
          typeof archetype.variability.statVariance === "number"
            ? archetype.variability.statVariance
            : 0
      }
    : undefined;

  return {
    actorClass: "template",
    equipmentProfile: toNonEmptyString(snapshot.equipmentProfile),
    gearNames: parseStringArray(gear?.templateNames) ?? [],
    isHumanoidNpcArchetype: true,
    profession: toNonEmptyString(profession?.name) ?? toNonEmptyString(snapshot.profession),
    roleLabel: toNonEmptyString(snapshot.roleLabel),
    seniority:
      typeof archetype.seniority === "string"
        ? (archetype.seniority as NpcArchetypeSeniority)
        : DEFAULT_SENIORITY,
    skillCount: skills.length,
    skillGroupCount: skillGroupIds.length,
    societyName: toNonEmptyString(society?.societyName),
    stats:
      baseStats && finalStats
        ? {
            base: baseStats,
            final: finalStats
          }
        : undefined,
    tags: parseStringArray(snapshot.tags),
    variability
  };
}

export function loadHumanoidNpcArchetypeDraft(
  entity: ReusableEntity
): LoadedHumanoidNpcArchetypeDraft {
  const emptyDraft = createEmptyHumanoidNpcArchetypeDraft();
  const snapshot = entity.snapshot;

  if (!isObject(snapshot) || !isObject(snapshot.humanoidNpcArchetype)) {
    return {
      draft: {
        ...emptyDraft,
        description: entity.description ?? "",
        name: entity.name,
        roleLabel: toNonEmptyString(isObject(snapshot) ? snapshot.roleLabel : undefined) ?? "",
        tags: (parseStringArray(isObject(snapshot) ? snapshot.tags : undefined) ?? []).join(", ")
      },
      isHumanoidNpcArchetype: false
    };
  }

  const archetype = snapshot.humanoidNpcArchetype as Record<string, unknown>;
  const society = isObject(archetype.society) ? archetype.society : undefined;
  const profession = isObject(archetype.profession) ? archetype.profession : undefined;
  const gear = isObject(archetype.gear) ? archetype.gear : undefined;
  const stats = isObject(archetype.stats) ? archetype.stats : undefined;
  const variability = isObject(archetype.variability) ? archetype.variability : undefined;
  const skills = Array.isArray(archetype.skills) ? archetype.skills : [];

  return {
    draft: {
      description: entity.description ?? "",
      gearNotes: toNonEmptyString(gear?.notes) ?? "",
      name: entity.name,
      professionId: toNonEmptyString(profession?.id) ?? "",
      roleLabel: toNonEmptyString(snapshot.roleLabel) ?? "",
      seniority:
        typeof archetype.seniority === "string"
          ? (archetype.seniority as NpcArchetypeSeniority)
          : DEFAULT_SENIORITY,
      selectedGearTemplateIds: parseStringArray(gear?.templateIds) ?? [],
      selectedSkillGroupIds: parseStringArray(archetype.skillGroupIds) ?? [],
      skillSelections: skills
        .map((entry) => {
          if (!isObject(entry) || typeof entry.skillId !== "string") {
            return null;
          }

          return {
            skillId: entry.skillId,
            targetLevel:
              typeof entry.targetLevel === "number" ? Math.max(0, Math.trunc(entry.targetLevel)) : 0
          };
        })
        .filter((entry): entry is NpcArchetypeSkillSelection => entry !== null),
      societyId: toNonEmptyString(society?.societyId) ?? "",
      stats: isObject(stats?.base) ? (stats?.base as GlantriCharacteristicBlock) : emptyDraft.stats,
      tags: (parseStringArray(snapshot.tags) ?? []).join(", "),
      variability: {
        gearSubstitutionNotes: toNonEmptyString(variability?.gearSubstitutionNotes) ?? "",
        notes: toNonEmptyString(variability?.notes) ?? "",
        skillVariance:
          typeof variability?.skillVariance === "number"
            ? Math.max(0, Math.trunc(variability.skillVariance))
            : emptyDraft.variability.skillVariance,
        statVariance:
          typeof variability?.statVariance === "number"
            ? Math.max(0, Math.trunc(variability.statVariance))
            : emptyDraft.variability.statVariance
      }
    },
    isHumanoidNpcArchetype: true
  };
}
