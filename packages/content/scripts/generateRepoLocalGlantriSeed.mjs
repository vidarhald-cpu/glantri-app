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

const PLAYER_FACING_SKILL_CATEGORY_BY_GROUP_ID = {
  advanced_melee_training: "combat",
  advanced_missile_training: "combat",
  animal_handling: "fieldcraft",
  animal_husbandry: "fieldcraft",
  athletic_conditioning: "physical",
  athletics: "physical",
  basic_melee_training: "combat",
  basic_missile_training: "combat",
  civic_learning: "knowledge",
  combat_group: "combat",
  commercial_administration: "trade",
  courtly_formation: "court-social",
  covert_entry: "covert",
  craft_group: "craft",
  defensive_soldiering: "military",
  field_soldiering: "military",
  fieldcraft_stealth: "fieldcraft",
  formal_performance: "court-social",
  healing_practice: "healing",
  herb_and_remedy_craft: "healing",
  humanities: "knowledge",
  learned_natural_inquiry: "knowledge",
  literate_foundation: "knowledge",
  maritime_crew_training: "maritime",
  maritime_navigation: "maritime",
  medicine_group: "healing",
  mental_discipline: "mental",
  mental_group: "mental",
  mercantile_practice: "trade",
  military_group: "military",
  mounted_service: "fieldcraft",
  mounted_warrior_training: "combat",
  mystical_group: "mystical",
  officer_training: "leadership",
  omen_and_ritual_practice: "mystical",
  operations: "military",
  performance_basics: "court-social",
  physical_science: "knowledge",
  political_acumen: "leadership",
  sacred_learning: "knowledge",
  security: "covert",
  social_reading: "court-social",
  stealth_group: "covert",
  street_theft: "covert",
  technical_measurement: "knowledge",
  transport_and_caravan_work: "trade",
  trap_and_intrusion_work: "covert",
  veteran_leadership: "leadership",
  veteran_soldiering: "military",
  wilderness_group: "fieldcraft"
};

const MELEE_WEAPON_SKILL_IDS = [
  "one_handed_edged",
  "one_handed_concussion_axe",
  "polearms",
  "lance",
  "two_handed_edged",
  "two_handed_concussion_axe"
];

const MISSILE_WEAPON_SKILL_IDS = [
  "throwing",
  "sling",
  "bow",
  "longbow",
  "crossbow"
];

const SKILL_GROUP_SELECTION_SLOTS_BY_ID = {
  basic_melee_training: [
    {
      candidateSkillIds: MELEE_WEAPON_SKILL_IDS,
      chooseCount: 1,
      id: "melee_weapon_choice",
      label: "Choose one melee weapon skill",
      required: true
    }
  ],
  advanced_melee_training: [
    {
      candidateSkillIds: MELEE_WEAPON_SKILL_IDS,
      chooseCount: 3,
      id: "advanced_melee_weapon_choices",
      label: "Choose three melee weapon skills",
      required: true
    }
  ],
  basic_missile_training: [
    {
      candidateSkillIds: MISSILE_WEAPON_SKILL_IDS,
      chooseCount: 1,
      id: "missile_weapon_choice",
      label: "Choose one missile weapon skill",
      required: true
    }
  ],
  advanced_missile_training: [
    {
      candidateSkillIds: MISSILE_WEAPON_SKILL_IDS,
      chooseCount: 3,
      id: "advanced_missile_weapon_choices",
      label: "Choose three missile weapon skills",
      required: true
    }
  ]
};

const FIXED_SKILL_MEMBERSHIPS_BY_GROUP_ID = {
  basic_melee_training: ["dodge", "parry", "brawling"],
  advanced_melee_training: ["dodge", "parry", "brawling"],
  basic_missile_training: [],
  advanced_missile_training: []
};

const GROUP_DESCRIPTION_OVERRIDES = {
  basic_melee_training: "Dodge, parry, and brawling plus one required melee weapon skill.",
  advanced_melee_training: "Dodge, parry, and brawling plus three required melee weapon skills.",
  basic_missile_training: "One required missile weapon skill.",
  advanced_missile_training: "Three required missile weapon skills."
};

const EXTRA_GROUP_IDS_BY_SKILL_ID = (() => {
  const result = {};

  for (const [groupId, slots] of Object.entries(SKILL_GROUP_SELECTION_SLOTS_BY_ID)) {
    for (const slot of slots) {
      for (const skillId of slot.candidateSkillIds) {
        const existingGroupIds = result[skillId] ?? [];

        if (!existingGroupIds.includes(groupId)) {
          result[skillId] = [...existingGroupIds, groupId];
        }
      }
    }
  }

  for (const [groupId, skillIds] of Object.entries(FIXED_SKILL_MEMBERSHIPS_BY_GROUP_ID)) {
    for (const skillId of skillIds) {
      const existingGroupIds = result[skillId] ?? [];

      if (!existingGroupIds.includes(groupId)) {
        result[skillId] = [...existingGroupIds, groupId];
      }
    }
  }

  return result;
})();

const CIVILIZATION_SEED_DEFINITIONS = [
  {
    historicalAnalogue: "Early medieval Scandinavia / Norse jarldoms",
    id: "scandia",
    linkedSocietyId: "feudal_manorial_kingdom",
    motherTongueLanguageName: "Scandian",
    name: "Scandia",
    notes: "Glantri-facing northern culture analogue with sea raiding, thing-style assemblies, and carved runic literacy.",
    optionalLanguageNames: [],
    period: "c. 800-1000 CE",
    shortDescription:
      "Sea-going northern kingdom culture of jarls, oath-bands, and coastal trade.",
    spokenLanguageName: "Scandian",
    writtenLanguageName: "Runic Scandian"
  },
  {
    historicalAnalogue: "Italian Renaissance city-states",
    id: "iest",
    linkedSocietyId: "renaissance_city_state",
    motherTongueLanguageName: "Common",
    name: "Iest",
    notes: "Glantri-facing mercantile principality analogue centered on guild money, diplomacy, and urban courts.",
    optionalLanguageNames: [],
    period: "c. 1300-1500 CE",
    shortDescription:
      "Merchant-principality culture of bankers, guild captains, and walled-city politics.",
    spokenLanguageName: "Common",
    writtenLanguageName: "Common"
  },
  {
    historicalAnalogue: "Roman imperial high civilization",
    id: "thyatis",
    linkedSocietyId: "imperial_classical_high_civ",
    motherTongueLanguageName: "Common",
    name: "Thyatis",
    notes: "Glantri-facing Roman analogue where Common is the everyday imperial language of administration and soldiery.",
    optionalLanguageNames: [],
    period: "c. 100 BCE-200 CE",
    shortDescription:
      "Imperial civic culture of roads, legions, bureaucracy, and metropolitan law.",
    spokenLanguageName: "Common",
    writtenLanguageName: "Common"
  },
  {
    historicalAnalogue: "Classical Greek polis culture",
    id: "scyria",
    linkedSocietyId: "classical_polis_city_state",
    motherTongueLanguageName: "Old Common",
    name: "Scyria",
    notes: "Glantri-facing Greek city-state analogue with rhetoric, civic competition, and maritime urbanism.",
    optionalLanguageNames: [],
    period: "c. 500-250 BCE",
    shortDescription:
      "Urban polis culture of debate, hoplite citizenship, and maritime trade.",
    spokenLanguageName: "Old Common",
    writtenLanguageName: "Old Common"
  },
  {
    historicalAnalogue: "Feudal western and central Europe",
    id: "glantri",
    linkedSocietyId: "feudal_manorial_kingdom",
    motherTongueLanguageName: "Common",
    name: "Glantri",
    notes: "Glantri-facing core feudal analogue with knightly households, castles, and landed obligations.",
    optionalLanguageNames: ["Old Common"],
    period: "c. 800-1100 CE",
    shortDescription:
      "Feudal landed culture of noble households, retainers, and local obligations.",
    spokenLanguageName: "Common",
    writtenLanguageName: "Common"
  },
  {
    historicalAnalogue: "Ancient Carthage",
    id: "lankhmar",
    linkedSocietyId: "imperial_classical_high_civ",
    motherTongueLanguageName: "Phoenician",
    name: "Lankhmar",
    notes:
      "Glantri-facing Carthaginian analogue centered on maritime commerce, urban oligarchy, and literate Mediterranean trade networks.",
    optionalLanguageNames: [],
    period: "c. 600-146 BCE",
    shortDescription:
      "Maritime mercantile high civilization of harbor cities, merchant houses, and overseas commercial reach.",
    spokenLanguageName: "Phoenician",
    writtenLanguageName: "Phoenician"
  },
  {
    historicalAnalogue: "Medieval Rus and eastern Christian principalities",
    id: "olog",
    linkedSocietyId: "court_bureaucratic_empire",
    motherTongueLanguageName: "Ologian",
    name: "Olog",
    notes: "Glantri-facing eastern court culture analogue with princely service hierarchies and scribal religion.",
    optionalLanguageNames: [],
    period: "c. 1100-1300 CE",
    shortDescription:
      "Eastern court culture of princely households, tribute, and church-backed literacy.",
    spokenLanguageName: "Ologian",
    writtenLanguageName: "Church Ologian"
  },
  {
    historicalAnalogue: "Pre-Hellenistic Egypt",
    id: "mogreb",
    linkedSocietyId: "temple_state_literate",
    motherTongueLanguageName: "Mogrebi",
    name: "Mogreb",
    notes: "Glantri-facing Nile temple culture analogue built on sacred estates, scribes, and river administration.",
    optionalLanguageNames: [],
    period: "c. 1500-400 BCE",
    shortDescription:
      "River-valley temple civilization with sacred estates, priests, and early recordkeeping.",
    spokenLanguageName: "Mogrebi",
    writtenLanguageName: "Sacred Mogrebi"
  },
  {
    historicalAnalogue: "Sub-Saharan court kingdom",
    id: "nkolo",
    linkedSocietyId: "imperial_agrarian_bureaucracy",
    motherTongueLanguageName: "N'kolian",
    name: "N'Kolo",
    notes: "Glantri-facing sub-Saharan royal culture analogue with court hierarchy, trade routes, and dynastic authority.",
    optionalLanguageNames: [],
    period: "c. 900-1100 CE",
    shortDescription:
      "Court kingdom culture of royal households, regional trade, and sacred kingship.",
    spokenLanguageName: "N'kolian",
    writtenLanguageName: "Royal N'kolian"
  },
  {
    historicalAnalogue: "Southern African San forager bands",
    id: "san_forager_bands",
    linkedSocietyId: "forager_ritual_tribal",
    motherTongueLanguageName: "Tuu",
    name: "San Forager Bands",
    optionalLanguageNames: [],
    period: "Pre-state to early modern continuity",
    shortDescription:
      "Ritual-forager culture of small kin bands, seasonal movement, and oral spiritual practice.",
    spokenLanguageName: "Tuu",
    writtenLanguageName: null
  },
  {
    historicalAnalogue: "Scythian and related steppe nomads",
    id: "scythians",
    linkedSocietyId: "pastoral_clan_nomadic",
    motherTongueLanguageName: "Scythian",
    name: "Scythians",
    optionalLanguageNames: [],
    period: "c. 700-200 BCE",
    shortDescription:
      "Mounted pastoral-warrior culture organized through clans, mobile camps, and raiding confederations.",
    spokenLanguageName: "Scythian",
    writtenLanguageName: null
  },
  {
    historicalAnalogue: "Latial and early Italic chiefdoms",
    id: "latial_chiefdoms",
    linkedSocietyId: "early_agrarian_proto_state",
    motherTongueLanguageName: "Old Latin",
    name: "Latial Chiefdoms",
    optionalLanguageNames: [],
    period: "c. 900-600 BCE",
    shortDescription:
      "Early agrarian hill-and-valley chiefdom culture with clan elites, fortified villages, and emerging civic centers.",
    spokenLanguageName: "Old Latin",
    writtenLanguageName: "Old Italic"
  },
  {
    historicalAnalogue: "Mycenaean Greece",
    id: "mycenaean_greece",
    linkedSocietyId: "bronze_age_palace_state",
    motherTongueLanguageName: "Mycenaean Greek",
    name: "Mycenaean Greece",
    optionalLanguageNames: [],
    period: "c. 1600-1100 BCE",
    shortDescription:
      "Palace-centered bronze age culture with elite households, redistribution, and fortified royal seats.",
    spokenLanguageName: "Mycenaean Greek",
    writtenLanguageName: "Linear B"
  },
  {
    historicalAnalogue: "Sumerian city-states",
    id: "sumer",
    linkedSocietyId: "temple_state_literate",
    motherTongueLanguageName: "Sumerian",
    name: "Sumer",
    optionalLanguageNames: [],
    period: "c. 3000-2000 BCE",
    shortDescription:
      "Temple-centered literate agrarian civilization with scribes, canal management, and sacred urban estates.",
    spokenLanguageName: "Sumerian",
    writtenLanguageName: "Cuneiform"
  },
  {
    historicalAnalogue: "Achaemenid Persian imperial administration",
    id: "achaemenid_persia",
    linkedSocietyId: "imperial_agrarian_bureaucracy",
    motherTongueLanguageName: "Old Persian",
    name: "Achaemenid Persia",
    optionalLanguageNames: [],
    period: "c. 550-330 BCE",
    shortDescription:
      "Imperial agrarian bureaucracy with satrapies, royal roads, scribal governance, and layered provincial rule.",
    spokenLanguageName: "Old Persian",
    writtenLanguageName: "Imperial Aramaic"
  },
  {
    historicalAnalogue: "Byzantine Empire",
    id: "byzantine_empire",
    linkedSocietyId: "court_bureaucratic_empire",
    motherTongueLanguageName: "Old Common",
    name: "Byzantine Empire",
    optionalLanguageNames: [],
    period: "c. 700-1200 CE",
    shortDescription:
      "Court-bureaucratic imperial culture of palace service, provincial administration, and orthodox scribal institutions.",
    spokenLanguageName: "Old Common",
    writtenLanguageName: "Old Common"
  }
];

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

function inferPlayerFacingSkillCategoryId(groupIds) {
  for (const groupId of groupIds) {
    const mapped = PLAYER_FACING_SKILL_CATEGORY_BY_GROUP_ID[groupId];
    if (mapped) {
      return mapped;
    }
  }

  return "special-access";
}

function orderCanonicalSkillGroupIds(skillId, groupIds) {
  if (
    skillId === "one_handed_edged" &&
    groupIds.includes("combat_group") &&
    groupIds.includes("mounted_warrior_training")
  ) {
    return [
      "combat_group",
      ...groupIds.filter((groupId) => groupId !== "combat_group")
    ];
  }

  return groupIds;
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
    const groupIds = orderCanonicalSkillGroupIds(
      skill.skillId,
      [
        ...new Set([
          ...trainingGroupIds,
          ...taxonomyGroupIds,
          ...(EXTRA_GROUP_IDS_BY_SKILL_ID[skill.skillId] ?? [])
        ])
      ]
    );
    const dependencies = parseJsonLike(skill.dependencyRules).map((dependency) => ({
      skillId: dependency.skillId,
      strength: dependency.strength ?? "required"
    }));
    const linkedStats = getLinkedStats(skill);

    return {
      allowsSpecializations: specializationParentIds.has(skill.skillId),
      category: skill.tier === "secondary" ? "secondary" : "ordinary",
      categoryId: inferPlayerFacingSkillCategoryId(groupIds),
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
  description: GROUP_DESCRIPTION_OVERRIDES[group.id] ?? group.description,
  id: group.id,
  name: group.name,
  skillMemberships: (FIXED_SKILL_MEMBERSHIPS_BY_GROUP_ID[group.id] ?? group.skillIds)
    .filter((skillId) => skillsById.has(skillId))
    .map((skillId) => ({
      relevance: skillsById.get(skillId)?.groupId === group.id ? "core" : "optional",
      skillId
    })),
  selectionSlots: (SKILL_GROUP_SELECTION_SLOTS_BY_ID[group.id] ?? []).map((slot) => ({
    ...slot,
    candidateSkillIds: slot.candidateSkillIds.filter((skillId) => skillsById.has(skillId))
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

const societyLevelById = new Map(
  societies.map((society) => [society.id, society.societyLevel])
);

const civilizations = CIVILIZATION_SEED_DEFINITIONS.map((civilization) => ({
  ...civilization,
  linkedSocietyLevel: societyLevelById.get(civilization.linkedSocietyId) ?? 1
}));

const literacyBandsBySocietyLevel = new Map([
  [3, [4]],
  [4, [3, 4]],
  [5, [2, 3, 4]],
  [6, [1, 2, 3, 4]]
]);

const societyBandSkillAccess = societies.flatMap((society) =>
  (literacyBandsBySocietyLevel.get(society.societyLevel) ?? []).map((socialBand) => ({
    linkedSocietyLevel: society.societyLevel,
    notes:
      "Foundational access only: Literacy is available for main skill-point spending from this society-band slot, not granted for free.",
    skillId: "literacy",
    socialBand,
    societyId: society.id,
    societyName: society.name
  }))
);

const seed = {
  civilizations,
  languages,
  skillGroups,
  skills,
  specializations,
  professionFamilies,
  professions,
  professionSkills,
  societyBandSkillAccess,
  societies,
  societyLevels
};

const fileContents = `// Generated from data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json\n// Do not hand-edit unless you are intentionally changing the repo-local import mapping.\n\nexport const generatedRepoLocalGlantriSeed = ${JSON.stringify(seed, null, 2)} as const;\n`;

fs.writeFileSync(outputPath, fileContents);

console.log(
  `Generated ${path.relative(repoRoot, outputPath)} from ${path.relative(repoRoot, sourcePath)}`
);
