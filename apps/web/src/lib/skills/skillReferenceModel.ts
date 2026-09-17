import {
  createTargetCompetencyProjectionSource,
  defaultCanonicalContent,
  getApprovedTargetChargenContent,
  targetLearningGroupCatalogue,
  targetProfessionCatalogue,
} from "@glantri/content";
import {
  createChargenProgression,
  getActiveGroupSkillCost,
  getSkillSpendCost,
  getSpecializationSpendCost,
} from "@glantri/rules-engine";

export type SkillReferenceTab = "skills" | "groups" | "professions" | "societies";

export interface SkillReferenceSkill {
  key: string;
  name: string;
  description: string;
  shortDescription: string;
  type: "Skill" | "Specialization" | "Spoken language" | "Written tradition";
  linkedStats: string[];
  ordinaryCost?: number;
  flexibleCost?: number;
  firstCost?: number;
  increaseCost?: number;
  parent?: { key: string; name: string; minimumLevel: number };
  children: { key: string; name: string }[];
  learningGroups: { key: string; name: string }[];
  directProfessionAccess: { key: string; name: string; route: string }[];
  typicalUses: string[];
}

export interface SkillReferenceGroup {
  key: string;
  name: string;
  shortDescription: string;
  description: string;
  equipment?: string;
  price: number;
  skills: { key: string; name: string }[];
  specializations: { key: string; name: string; parentName: string }[];
  professionAccess: { key: string; name: string; route: string }[];
}

export interface SkillReferenceOpportunity {
  key: string;
  kind: "Learning Group" | "Skill" | "Specialization";
  name: string;
  targetKey: string;
  route: string;
  description: string;
  scope: string;
}

export interface SkillReferenceProfession {
  key: string;
  name: string;
  description: string;
  tracks: { name: string }[];
  opportunities: SkillReferenceOpportunity[];
  exclusivityNote?: string;
}

export interface SkillReferenceSociety {
  key: string;
  name: string;
  level: number;
  description: string;
  examples: {
    name: string;
    description: string;
    period: string;
    spokenLanguage: string;
    writtenTradition?: string;
  }[];
}

export interface SkillReferenceModel {
  skills: SkillReferenceSkill[];
  learningGroups: SkillReferenceGroup[];
  professions: SkillReferenceProfession[];
  societies: SkillReferenceSociety[];
  grouplessSkills: { key: string; name: string }[];
  guide: {
    ordinaryPointTotal: number;
    individualOrdinaryCost: number;
    individualFlexibleCost: number;
    specializationFirstCost: number;
    specializationIncreaseCost: number;
  };
  inventory: {
    competencies: number;
    baseSkills: number;
    specializations: number;
    spokenLanguages: number;
    writtenTraditions: number;
    learningGroups: number;
    baseMemberships: number;
    specializationMemberships: number;
    grouplessBaseSkills: number;
    professionFamilies: number;
    explicitTracks: number;
    groupOpportunities: number;
    directOpportunities: number;
    societyModels: number;
    civilizationExamples: number;
  };
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function publicKeys(values: readonly { id: string; name: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  return new Map(
    values.map((value) => {
      const base = slug(value.name) || "entry";
      const next = (counts.get(base) ?? 0) + 1;
      counts.set(base, next);
      return [value.id, next === 1 ? base : `${base}-${next}`];
    }),
  );
}

function byName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

function competencyTypeLabel(
  value: "base-skill" | "specialization" | "spoken-language" | "written-tradition",
): SkillReferenceSkill["type"] {
  if (value === "base-skill") return "Skill";
  if (value === "spoken-language") return "Spoken language";
  if (value === "written-tradition") return "Written tradition";
  return "Specialization";
}

function readerFacingText(value: string, groupNames?: ReadonlyMap<string, string>): string {
  let result = value.replace(/\*\*/g, "");
  for (const [code, name] of groupNames ?? []) {
    result = result.replace(new RegExp(`\\b${code}\\b`, "g"), name);
  }
  return result
    .replace(/\bproposals\b/gi, "offers")
    .replace(/\bproposal\b/gi, "plan")
    .replace(/\bcandidates\b/gi, "options")
    .replace(/\bcandidate\b/gi, "option")
    .replace(/\bprovenance\b/gi, "history")
    .replace(/\bmigration\b/gi, "transition")
    .replace(/\baudit\b/gi, "review")
    .replace(/\bdigest\b/gi, "summary");
}

function professionProviderNames(input: {
  family: (typeof targetProfessionCatalogue.families)[number];
  opportunityId: string;
}): string[] {
  if (input.family.tracks.length === 0) return [input.family.name];
  const tracks = input.family.tracks.filter((track) =>
    track.opportunityIds.includes(input.opportunityId),
  );
  if (tracks.length === input.family.tracks.length) return [`${input.family.name} — all tracks`];
  return tracks.length > 0
    ? tracks.map((track) => `${input.family.name} — ${track.name}`)
    : [`${input.family.name} — family opportunity`];
}

export function buildSkillReferenceModel(): SkillReferenceModel {
  const competencies =
    createTargetCompetencyProjectionSource(defaultCanonicalContent).catalogue.content.entries;
  const groups = targetLearningGroupCatalogue.groups;
  const families = targetProfessionCatalogue.families;
  const chargenContent = getApprovedTargetChargenContent();
  const progression = createChargenProgression();

  const competencyKeys = publicKeys(competencies);
  const groupKeys = publicKeys(groups);
  const professionKeys = publicKeys(families);
  const societyKeys = publicKeys(defaultCanonicalContent.societies);
  const competencyNames = new Map(competencies.map((entry) => [entry.id, entry.name]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const competencyById = new Map(competencies.map((entry) => [entry.id, entry]));
  const runtimeSkills = new Map(chargenContent.skills.map((skill) => [skill.id, skill]));
  const runtimeSpecializations = new Map(
    chargenContent.specializations.map((specialization) => [specialization.id, specialization]),
  );
  function linkedStatsForCompetency(id: string, visited = new Set<string>()): string[] {
    const skill = runtimeSkills.get(id);
    if (skill) return skill.linkedStats.map((stat) => stat.toUpperCase());
    if (visited.has(id)) throw new Error("A Specialization parent cycle prevents display.");
    visited.add(id);
    const specialization = runtimeSpecializations.get(id);
    if (!specialization) throw new Error("A Specialization parent is unavailable.");
    return linkedStatsForCompetency(specialization.skillId, visited);
  }

  const directProfessionAccess = new Map<string, { key: string; name: string; route: string }[]>();
  const groupProfessionAccess = new Map<string, { key: string; name: string; route: string }[]>();
  for (const family of families) {
    for (const opportunity of family.opportunities) {
      const destination =
        opportunity.kind === "group" ? groupProfessionAccess : directProfessionAccess;
      const providers = professionProviderNames({ family, opportunityId: opportunity.id });
      const existing = destination.get(opportunity.targetId) ?? [];
      existing.push(
        ...providers.map((name) => ({
          key: professionKeys.get(family.id)!,
          name,
          route: readerFacingText(opportunity.route, groupNames),
        })),
      );
      destination.set(opportunity.targetId, existing);
    }
  }

  const skillModels = competencies
    .map((entry): SkillReferenceSkill => {
      const key = competencyKeys.get(entry.id)!;
      const memberships = groups
        .filter((group) => group.members.some((member) => member.competencyId === entry.id))
        .map((group) => ({ key: groupKeys.get(group.id)!, name: group.name }))
        .sort(byName);
      const children = competencies
        .filter((candidate) => candidate.parent?.id === entry.id)
        .map((candidate) => ({ key: competencyKeys.get(candidate.id)!, name: candidate.name }))
        .sort(byName);

      if (entry.competencyType === "specialization") {
        const runtime = runtimeSpecializations.get(entry.id);
        if (!runtime)
          throw new Error(`Missing current Specialization definition for ${entry.name}.`);
        return {
          key,
          name: entry.name,
          description: readerFacingText(entry.description),
          shortDescription: readerFacingText(entry.shortDescription),
          type: "Specialization",
          linkedStats: linkedStatsForCompetency(entry.id),
          firstCost: getSpecializationSpendCost(false),
          increaseCost: getSpecializationSpendCost(true),
          parent: {
            key: competencyKeys.get(entry.parent.id)!,
            name: entry.parent.name,
            minimumLevel: entry.minimumParentLevel,
          },
          children,
          learningGroups: memberships,
          directProfessionAccess: (directProfessionAccess.get(entry.id) ?? []).sort(byName),
          typicalUses: entry.typicalUses.map((value) => readerFacingText(value)),
        };
      }

      const runtime = runtimeSkills.get(entry.id);
      if (!runtime) throw new Error(`Missing current Skill definition for ${entry.name}.`);
      return {
        key,
        name: entry.name,
        description: readerFacingText(entry.description),
        shortDescription: readerFacingText(entry.shortDescription),
        type: competencyTypeLabel(entry.competencyType),
        linkedStats: runtime.linkedStats.map((stat) => stat.toUpperCase()),
        ordinaryCost: getSkillSpendCost(runtime, "ordinary"),
        flexibleCost: getSkillSpendCost(runtime, "flexible"),
        children,
        learningGroups: memberships,
        directProfessionAccess: (directProfessionAccess.get(entry.id) ?? []).sort(byName),
        typicalUses: entry.typicalUses.map((value) => readerFacingText(value)),
      };
    })
    .sort(byName);

  const groupModels = groups
    .map((group): SkillReferenceGroup => {
      const price = getActiveGroupSkillCost({
        content: chargenContent,
        groupId: group.id,
        progression,
      });
      if (price.cost === undefined) {
        throw new Error(`Unable to price ${group.name}: ${price.error ?? "unknown reason"}`);
      }
      return {
        key: groupKeys.get(group.id)!,
        name: group.name,
        shortDescription: readerFacingText(group.shortDescription),
        description: readerFacingText(group.description),
        equipment: group.equipment ? readerFacingText(group.equipment) : undefined,
        price: price.cost,
        skills: group.members
          .filter((member) => member.kind === "base-skill")
          .map((member) => ({
            key: competencyKeys.get(member.competencyId)!,
            name: member.name,
          }))
          .sort(byName),
        specializations: group.members
          .filter((member) => member.kind === "specialization")
          .map((member) => ({
            key: competencyKeys.get(member.competencyId)!,
            name: member.name,
            parentName: competencyNames.get(member.parentId!)!,
          }))
          .sort(byName),
        professionAccess: (groupProfessionAccess.get(group.id) ?? []).sort(byName),
      };
    })
    .sort(byName);

  const professionModels = families
    .map((family): SkillReferenceProfession => {
      const commonOpportunityIds = new Set(
        family.opportunities
          .filter(
            (opportunity) =>
              family.tracks.length === 0 ||
              family.tracks.every((track) => track.opportunityIds.includes(opportunity.id)),
          )
          .map((opportunity) => opportunity.id),
      );
      return {
        key: professionKeys.get(family.id)!,
        name: family.name,
        description: readerFacingText(family.description),
        tracks: family.tracks.map((track) => ({ name: track.name })),
        opportunities: family.opportunities.map((opportunity, index) => {
          const target =
            opportunity.kind === "group"
              ? groupNames.get(opportunity.targetId)
              : competencyNames.get(opportunity.targetId);
          if (!target) throw new Error(`Missing reference destination for ${family.name}.`);
          const trackNames = family.tracks
            .filter((track) => track.opportunityIds.includes(opportunity.id))
            .map((track) => track.name);
          return {
            key: `${slug(`${opportunity.kind}-${target}-${opportunity.route}`)}-${index + 1}`,
            kind:
              opportunity.kind === "group"
                ? "Learning Group"
                : competencyById.get(opportunity.targetId)?.competencyType === "specialization"
                  ? "Specialization"
                  : "Skill",
            name: target,
            targetKey:
              opportunity.kind === "group"
                ? groupKeys.get(opportunity.targetId)!
                : competencyKeys.get(opportunity.targetId)!,
            route: readerFacingText(opportunity.route, groupNames),
            description: readerFacingText(opportunity.description, groupNames),
            scope: commonOpportunityIds.has(opportunity.id)
              ? family.tracks.length > 0
                ? "Every track"
                : "Family-wide"
              : trackNames.length > 0
                ? trackNames.join(", ")
                : "Family opportunity",
          };
        }),
        exclusivityNote:
          family.code === "P09"
            ? "Rigged-vessel deck apprenticeship and Working a boat are alternative training routes here; choosing one replaces the other for this Profession."
            : family.code === "P14"
              ? "Swashbuckling fencing instruction and One-handed edged close-combat practice are mutually exclusive here. This does not prevent One-handed edged close-combat practice from accompanying Guard and rough-fighting drill when both are taught."
              : undefined,
      };
    })
    .sort(byName);

  const societyModels = defaultCanonicalContent.societies
    .map(
      (society): SkillReferenceSociety => ({
        key: societyKeys.get(society.id)!,
        name: society.name,
        level: society.societyLevel,
        description: readerFacingText(society.shortDescription),
        examples: defaultCanonicalContent.civilizations
          .filter((civilization) => civilization.linkedSocietyId === society.id)
          .map((civilization) => ({
            name: civilization.name,
            description: readerFacingText(civilization.shortDescription),
            period: civilization.period,
            spokenLanguage: civilization.spokenLanguageName,
            writtenTradition: civilization.writtenLanguageName ?? undefined,
          }))
          .sort(byName),
      }),
    )
    .sort((left, right) => left.level - right.level || byName(left, right));

  const grouplessSkills = targetLearningGroupCatalogue.grouplessBaseSkillIds
    .map((id) => ({ key: competencyKeys.get(id)!, name: competencyNames.get(id)! }))
    .sort(byName);
  const guideSkill = chargenContent.skills.find((skill) => "catalogueSource" in skill);
  if (!guideSkill) throw new Error("Current Skill costs are unavailable.");

  return {
    skills: skillModels,
    learningGroups: groupModels,
    professions: professionModels,
    societies: societyModels,
    grouplessSkills,
    guide: {
      ordinaryPointTotal: progression.primaryPoolTotal,
      individualOrdinaryCost: getSkillSpendCost(guideSkill, "ordinary"),
      individualFlexibleCost: getSkillSpendCost(guideSkill, "flexible"),
      specializationFirstCost: getSpecializationSpendCost(false),
      specializationIncreaseCost: getSpecializationSpendCost(true),
    },
    inventory: {
      competencies: skillModels.length,
      baseSkills: competencies.filter((entry) => entry.competencyType === "base-skill").length,
      specializations: competencies.filter((entry) => entry.competencyType === "specialization")
        .length,
      spokenLanguages: competencies.filter((entry) => entry.competencyType === "spoken-language")
        .length,
      writtenTraditions: competencies.filter(
        (entry) => entry.competencyType === "written-tradition",
      ).length,
      learningGroups: groupModels.length,
      baseMemberships: groups
        .flatMap((group) => group.members)
        .filter((member) => member.kind === "base-skill").length,
      specializationMemberships: groups
        .flatMap((group) => group.members)
        .filter((member) => member.kind === "specialization").length,
      grouplessBaseSkills: grouplessSkills.length,
      professionFamilies: professionModels.length,
      explicitTracks: families.flatMap((family) => family.tracks).length,
      groupOpportunities: families
        .flatMap((family) => family.opportunities)
        .filter((opportunity) => opportunity.kind === "group").length,
      directOpportunities: families
        .flatMap((family) => family.opportunities)
        .filter((opportunity) => opportunity.kind !== "group").length,
      societyModels: societyModels.length,
      civilizationExamples: societyModels.flatMap((society) => society.examples).length,
    },
  };
}
