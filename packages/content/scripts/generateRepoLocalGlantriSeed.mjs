import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const sourcePath = path.join(
  repoRoot,
  "data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json"
);
const outputPath = path.join(
  repoRoot,
  "packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts"
);

const rawBundle = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const BAND_METADATA = [
  {
    baseEducation: 0,
    label: "Common Folk",
    threshold: 1
  },
  {
    baseEducation: 1,
    label: "Trades and Guilds",
    threshold: 2
  },
  {
    baseEducation: 2,
    label: "Established Households",
    threshold: 3
  },
  {
    baseEducation: 3,
    label: "Court and Elite",
    threshold: 6
  }
];

const DEFAULT_LINKED_STATS_BY_TYPE = {
  awareness: ["int", "pow"],
  combat: ["str", "dex"],
  craft: ["dex", "int"],
  knowledge: ["int", "int"],
  mental: ["int", "pow"],
  military: ["int", "pow"],
  mystical: ["pow", "int"],
  physical: ["dex", "str"],
  profession: ["int", "dex"],
  social: ["cha", "int"],
  subterfuge: ["dex", "int"],
  wilderness: ["dex", "int"]
};

function parseJsonLike(value, fallback = []) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return fallback;
    }

    return JSON.parse(trimmed);
  }

  return fallback;
}

function normalizeText(...values) {
  return values
    .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .join(" ");
}

function getLinkedStats(skill) {
  const note = typeof skill.notes === "string" ? skill.notes : "";
  const match = note.match(/source stats\s+([A-Za-z]+)\s*\/\s*([A-Za-z]+)/i);

  if (match) {
    return [match[1], match[2]].map((value) => value.toLowerCase());
  }

  return DEFAULT_LINKED_STATS_BY_TYPE[skill.skillType] ?? ["int", "int"];
}

function getLiteracyRequirement(dependencies) {
  const literacyDependency = dependencies.find((dependency) => dependency.skillId === "literacy");

  if (!literacyDependency) {
    return "no";
  }

  if (literacyDependency.strength === "required") {
    return "required";
  }

  if (literacyDependency.strength === "recommended") {
    return "recommended";
  }

  return "no";
}

const trainingGroupSources = rawBundle.trainingGroups.map((group, index) => ({
  description: group.shortDescription || undefined,
  id: group.trainingGroupId,
  name: group.name,
  skillIds: parseJsonLike(group.skillIds),
  sortOrder: index + 1
}));

const taxonomyGroupSources = rawBundle.taxonomyGroups.map((group, index) => ({
  description: group.shortDescription || undefined,
  id: group.groupId,
  name: group.name,
  skillIds: parseJsonLike(group.skillIds),
  sortOrder: trainingGroupSources.length + index + 1
}));
const skillGroupSources = [...trainingGroupSources, ...taxonomyGroupSources];
const specializationRows = rawBundle.skills.filter((skill) => skill.tier === "specialization");
const specializationParentIds = new Set(
  specializationRows
    .map((skill) => skill.specializationOfSkillId)
    .filter((skillId) => typeof skillId === "string" && skillId.length > 0)
);

const skills = rawBundle.skills
  .filter((skill) => skill.tier !== "specialization")
  .map((skill) => {
    const trainingGroupIds = parseJsonLike(skill.trainingGroupIds);
    const taxonomyGroupIds = parseJsonLike(skill.taxonomyGroupIds);
    const groupIds = [...new Set([...trainingGroupIds, ...taxonomyGroupIds])];
    const dependencies = parseJsonLike(skill.dependencyRules).map((dependency) => ({
      skillId: dependency.skillId,
      strength: dependency.strength ?? "required"
    }));
    const linkedStats = getLinkedStats(skill);

    return {
      allowsSpecializations: specializationParentIds.has(skill.skillId),
      category: skill.tier === "secondary" ? "secondary" : "ordinary",
      dependencies,
      dependencySkillIds: dependencies
        .filter((dependency) => dependency.strength === "required")
        .map((dependency) => dependency.skillId),
      description: normalizeText(
        skill.verbatimDescription,
        skill.shortDescription,
        skill.contextNotes
      ),
      groupId: groupIds[0],
      groupIds,
      id: skill.skillId,
      isTheoretical: Boolean(skill.isTheoretical),
      linkedStats,
      name: skill.name,
      requiresLiteracy: getLiteracyRequirement(dependencies),
      secondaryOfSkillId: skill.secondaryOfSkillId || undefined,
      shortDescription: skill.shortDescription || undefined,
      societyLevel: Math.max(1, Math.min(6, Number(skill.minimumSocietyLevel || 1))),
      sortOrder: Number(skill.sortOrder || 0)
    };
  });

const skillsById = new Map(skills.map((skill) => [skill.id, skill]));

for (const skill of skills) {
  skill.dependencies = skill.dependencies.filter((dependency) => {
    const targetSkill = skillsById.get(dependency.skillId);
    const reciprocalDependency = targetSkill?.dependencies.find(
      (candidate) => candidate.skillId === skill.id
    );

    if (
      !targetSkill ||
      !reciprocalDependency ||
      dependency.strength !== "helpful" ||
      reciprocalDependency.strength !== "helpful"
    ) {
      return true;
    }

    if (targetSkill.sortOrder !== skill.sortOrder) {
      return skill.sortOrder < targetSkill.sortOrder;
    }

    return skill.id < targetSkill.id;
  });
  skill.dependencySkillIds = skill.dependencies
    .filter((dependency) => dependency.strength === "required")
    .map((dependency) => dependency.skillId);
  skill.requiresLiteracy = getLiteracyRequirement(skill.dependencies);
}
const specializations = specializationRows
  .filter((skill) => typeof skill.specializationOfSkillId === "string" && skill.specializationOfSkillId)
  .map((skill) => ({
    description: normalizeText(
      skill.verbatimDescription,
      skill.shortDescription,
      skill.contextNotes
    ),
    id: skill.skillId,
    minimumGroupLevel: Number(skill.specializationMinimumParentLevel || 11),
    minimumParentLevel: Number(skill.specializationMinimumParentLevel || 11),
    name: skill.name,
    skillId: skill.specializationOfSkillId,
    sortOrder: Number(skill.sortOrder || 0)
  }));
const specializationIds = new Set(specializations.map((specialization) => specialization.id));

const professionFamilies = rawBundle.professionFamilies.map((family) => ({
  description: normalizeText(family.shortDescription, family.contextNotes) || undefined,
  id: family.professionFamilyId,
  name: family.name
}));

const professions = rawBundle.professionSubtypes.map((subtype) => ({
  description: normalizeText(subtype.shortDescription, subtype.contextNotes) || undefined,
  familyId: subtype.professionFamilyId,
  id: subtype.professionSubtypeId,
  name: subtype.name,
  subtypeName: subtype.name
}));

function createSkillGrant(skillId, professionId, scope, isCore) {
  const skill = skillsById.get(skillId);

  if (!skill || specializationIds.has(skillId)) {
    return null;
  }

  return {
    grantType: skill.category === "secondary" ? "secondary-skill" : "ordinary-skill",
    isCore,
    professionId,
    ranks: 0,
    scope,
    skillId
  };
}

const professionSkills = [
  ...rawBundle.professionFamilies.flatMap((family) => [
    ...parseJsonLike(family.coreTrainingGroupIds).map((groupId) => ({
      grantType: "group",
      isCore: true,
      professionId: family.professionFamilyId,
      ranks: 0,
      scope: "family",
      skillGroupId: groupId
    })),
    ...parseJsonLike(family.coreSkillIds)
      .map((skillId) => createSkillGrant(skillId, family.professionFamilyId, "family", true))
      .filter(Boolean),
    ...parseJsonLike(family.favoredTrainingGroupIds).map((groupId) => ({
      grantType: "group",
      isCore: false,
      professionId: family.professionFamilyId,
      ranks: 0,
      scope: "family",
      skillGroupId: groupId
    })),
    ...parseJsonLike(family.favoredSkillIds)
      .map((skillId) => createSkillGrant(skillId, family.professionFamilyId, "family", false))
      .filter(Boolean)
  ]),
  ...rawBundle.professionSubtypes.flatMap((subtype) => [
    ...parseJsonLike(subtype.addedCoreTrainingGroupIds).map((groupId) => ({
      grantType: "group",
      isCore: true,
      professionId: subtype.professionSubtypeId,
      ranks: 0,
      scope: "profession",
      skillGroupId: groupId
    })),
    ...parseJsonLike(subtype.addedCoreSkillIds)
      .map((skillId) => createSkillGrant(skillId, subtype.professionSubtypeId, "profession", true))
      .filter(Boolean),
    ...parseJsonLike(subtype.addedFavoredTrainingGroupIds).map((groupId) => ({
      grantType: "group",
      isCore: false,
      professionId: subtype.professionSubtypeId,
      ranks: 0,
      scope: "profession",
      skillGroupId: groupId
    })),
    ...parseJsonLike(subtype.addedFavoredSkillIds)
      .map((skillId) => createSkillGrant(skillId, subtype.professionSubtypeId, "profession", false))
      .filter(Boolean)
  ])
];

const skillGroups = skillGroupSources.map((group) => ({
  description: group.description,
  id: group.id,
  name: group.name,
  skillMemberships: group.skillIds
    .filter((skillId) => skillsById.has(skillId))
    .map((skillId) => ({
      relevance: skillsById.get(skillId)?.groupId === group.id ? "core" : "optional",
      skillId
    })),
  sortOrder: group.sortOrder
}));

const groupMinSocietyLevel = new Map();

for (const group of trainingGroupSources) {
  const skillIds = group.skillIds;
  const minLevel = skillIds
    .map((skillId) => skillsById.get(skillId)?.societyLevel ?? 6)
    .reduce((lowest, level) => Math.min(lowest, level), 6);

  groupMinSocietyLevel.set(group.id, minLevel);
}

for (const group of taxonomyGroupSources) {
  const skillIds = group.skillIds;
  const minLevel = skillIds
    .map((skillId) => {
      const skill = skillsById.get(skillId);
      const specialization = specializations.find((candidate) => candidate.id === skillId);
      return skill?.societyLevel ?? (specialization ? 6 : 6);
    })
    .reduce((lowest, level) => Math.min(lowest, level), 6);

  groupMinSocietyLevel.set(group.id, minLevel);
}

const societyLevels = rawBundle.societyTypes.flatMap((society) =>
  BAND_METADATA.map((band, index) => {
    const effectiveAccessLevel = Math.min(Number(society.level || 1), band.threshold);

    return {
      baseEducation: band.baseEducation,
      classRollTableId: `${society.societyTypeId}_social_band_v1`,
      notes: normalizeText(
        society.shortDescription,
        society.historicalReference ? `Historical reference: ${society.historicalReference}.` : "",
        society.glantriExamples ? `Glantri examples: ${society.glantriExamples}.` : "",
        society.notes
      ),
      professionIds: professions
        .filter((profession) => {
          const sourceProfession = rawBundle.professionSubtypes.find(
            (candidate) => candidate.professionSubtypeId === profession.id
          );

          return Number(sourceProfession?.minimumSocietyLevel || 1) <= effectiveAccessLevel;
        })
        .map((profession) => profession.id),
      skillGroupIds: skillGroups
        .filter((group) => (groupMinSocietyLevel.get(group.id) ?? 6) <= effectiveAccessLevel)
        .map((group) => group.id),
      skillIds: [],
      socialClass: band.label,
      societyId: society.societyTypeId,
      societyLevel: index + 1,
      societyName: society.name
    };
  })
);

const languages = rawBundle.societyTypes.map((society) => ({
  id: `${society.societyTypeId}_language`,
  name: society.name,
  notes:
    "Provisional baseline language derived from the current society source. Replace with dedicated language content when the language system expands.",
  sourceSocietyId: society.societyTypeId
}));

const societies = rawBundle.societyTypes.map((society) => ({
  baselineLanguageIds: [`${society.societyTypeId}_language`],
  glantriExamples: society.glantriExamples || undefined,
  historicalReference: society.historicalReference || undefined,
  id: society.societyTypeId,
  name: society.name,
  notes: society.notes || undefined,
  shortDescription: society.shortDescription,
  societyLevel: Math.max(1, Math.min(6, Number(society.level || 1)))
}));

const seed = {
  languages,
  skillGroups,
  skills,
  specializations,
  professionFamilies,
  professions,
  professionSkills,
  societies,
  societyLevels
};

const fileContents = `// Generated from data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json\n// Do not hand-edit unless you are intentionally changing the repo-local import mapping.\n\nexport const generatedRepoLocalGlantriSeed = ${JSON.stringify(seed, null, 2)} as const;\n`;

fs.writeFileSync(outputPath, fileContents);

console.log(
  `Generated ${path.relative(repoRoot, outputPath)} from ${path.relative(repoRoot, sourcePath)}`
);
