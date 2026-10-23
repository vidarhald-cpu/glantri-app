import { withCompetencyContentV2 } from "./competencyV2Runtime";
import { catalogueIntegrityKey, validateTargetProgressionMetadata } from "@glantri/domain";
import { defaultCanonicalContent } from "./seeds/defaultContent";
import type { CharacterProgression } from "@glantri/domain";
import type { CanonicalContent } from "./types";
import {
  fullSkillCatalogueProposal,
  type FullSkillCatalogueEntry,
} from "./full-skill-catalogue-proposal";
import {
  chargenTargetSkillDefinitionSchema,
  targetRuntimeSkillDefinitionSchema,
  targetRuntimeSpecializationSchema,
  skillSpecializationSchema,
  type ChargenTargetSkillDefinition,
  type SkillDefinition,
  type SkillSpecialization,
} from "@glantri/domain";

// Approved issue168 comment5074, with the PO Campaign Strategy amendment.
const approvedLinkedStats: Readonly<Record<string, readonly string[]>> = {
  "skill:interrogation": ["int", "cha"],
  "skill:intimidation": ["cha", "pow"],
  "skill:teaching": ["int", "cha"],
  "skill:document-forgery": ["dex", "int"],
  "skill:palaeography-decipherment": ["int", "int"],
  "skill:translation-interpretation": ["int", "int"],
  "skill:fibre-working": ["dex", "int"],
  "skill:locksmithing": ["dex", "int"],
  "skill:sailmaking": ["dex", "int"],
  "skill:smelting": ["int", "dex"],
  "skill:architecture": ["int", "int"],
  "skill:shipbuilding": ["int", "dex"],
  "skill:siege-engineering": ["int", "int"],
  "skill:veterinary-medicine": ["int", "dex"],
  "skill:cartography": ["int", "dex"],
  "skill:firearms": ["dex", "dex"],
  "skill:campaign-strategy": ["int", "int"],
  "skill:military-logistics": ["int", "int"],
  "skill:military-reconnaissance": ["int", "pow"],
  "skill:siege-engine-operation": ["dex", "int"],
  "skill:animal-lore": ["int", "int"],
  "skill:weather-lore": ["int", "pow"],
  "skill:fishing": ["dex", "int"],
  "skill:hunting": ["int", "dex"],
  "skill:survival": ["int", "dex"],
  "skill:tracking": ["int", "pow"],
  "skill:geography": ["int", "int"],
  "skill:farming": ["int", "dex"],
  "skill:visual-art": ["dex", "int"],
  "skill:deception": ["int", "cha"],
  "skill:leadership": ["cha", "pow"],
  "skill:mnemonics": ["int", "pow"],
  "skill:research": ["int", "int"],
  "skill:armoring": ["dex", "int"],
  "skill:cooking": ["dex", "int"],
  "skill:distilling": ["int", "dex"],
  "skill:masonry": ["dex", "int"],
  "skill:winemaking": ["dex", "int"],
  "skill:mining": ["int", "dex"],
  "skill:surgery": ["int", "dex"],
  "skill:celestial-navigation": ["int", "int"],
  "skill:chart-navigation": ["int", "int"],
  "skill:dead-reckoning": ["int", "int"],
  "skill:pilotage": ["dex", "int"],
  "skill:seamanship": ["dex", "int"],
  "skill:wayfinding": ["int", "pow"],
  "skill:trapping": ["int", "dex"],
  "skill:athletics": ["dex", "str"],
  "skill:sleight-of-hand": ["dex", "int"],
  "skill:trapmaking": ["dex", "int"],
  "skill:politics": ["int", "int"],
  "skill:religion": ["int", "int"],
  "skill:streetwise": ["int", "cha"],
  "skill:underworld": ["int", "cha"],
  "skill:animal-handling": ["dex", "int"],
  "skill:animal-husbandry": ["dex", "int"],
  "skill:poetry-literary-composition": ["int", "cha"],
  "skill:sculpture": ["dex", "int"],
  "written:mogrebi:sacred-mogrebi": ["int", "int"],
  "written:ologian:church-ologian": ["int", "int"],
  "written:phoenician:phoenician": ["int", "int"],
};

type TargetSkillType = "base-skill" | "spoken-language" | "written-tradition";

export type TargetLinkedStats =
  | { status: "pending-linked-stats" }
  | { status: "approved"; linkedStats: readonly string[] }
  | {
      status: "legacy-counterpart";
      legacySkillId: string;
      linkedStats: readonly string[];
    };

export type TargetCompetency =
  | (FullSkillCatalogueEntry & {
      competencyType: TargetSkillType;
      linkedStats: TargetLinkedStats;
    })
  | (FullSkillCatalogueEntry & {
      competencyType: "specialization";
      parent: NonNullable<FullSkillCatalogueEntry["parent"]>;
      minimumParentLevel: number;
    });

export interface TargetCompetencyCatalogue {
  entries: readonly TargetCompetency[];
  sourceDigest: string;
}

export interface TargetCompetencyProjectionSource {
  catalogue: { content: TargetCompetencyCatalogue };
  compatibilityContent: CanonicalContent;
}

function findCounterpart<T extends { id: string; name: string }>(
  entry: FullSkillCatalogueEntry,
  definitions: readonly T[],
): T | undefined {
  const exact = definitions.find(({ id }) => id === entry.id);
  if (exact) return exact;

  const matches = definitions.filter(({ name }) => name.toLowerCase() === entry.name.toLowerCase());
  return matches.length === 1 ? matches[0] : undefined;
}

function resolveLinkedStats(
  entry: FullSkillCatalogueEntry,
  content: CanonicalContent,
): TargetLinkedStats {
  // The existing concrete Language(name) rows all use this spoken-language metadata.
  // Written traditions deliberately cannot reuse generic Literacy or Language.
  if (approvedLinkedStats[entry.id])
    return { status: "approved", linkedStats: [...approvedLinkedStats[entry.id]] };
  const counterpart: SkillDefinition | undefined =
    entry.competencyType === "spoken-language"
      ? content.skills.find(({ id }) => id === "language")
      : entry.competencyType === "written-tradition"
        ? undefined
        : legacyStatCounterpartIds[entry.id]
          ? content.skills.find(({ id }) => id === legacyStatCounterpartIds[entry.id])
          : findCounterpart(entry, content.skills);

  if (!counterpart || counterpart.linkedStats.length === 0) {
    return { status: "pending-linked-stats" };
  }

  return {
    status: "legacy-counterpart",
    legacySkillId: counterpart.id,
    linkedStats: [...counterpart.linkedStats],
  };
}

// Linked-stat inheritance only: checked against the final descriptions and current legacy
// definitions. These names are equivalent for metadata purposes; this map grants neither
// legacy Group/Profession access nor migration, transfer, or contextual binding.
const legacyStatCounterpartIds: Readonly<Record<string, string>> = {
  "skill:poisons": "poison_lore",
  "skill:trade": "trading",
  "skill:plant-lore": "herb_lore",
  "skill:running": "run",
  "skill:swimming": "swim",
  "skill:lockpicking": "lockpicking",
  "skill:customs": "etiquette",
  "skill:cart-driving": "teamstering",
};

/**
 * Projects the approved acquisition catalogue, not its support records or group annotations.
 * Pending linked stats are explicit authoring dependencies, never fabricated runtime metadata.
 * No projection entry alone grants access, a rank, or a language/writing relationship.
 */
export function createTargetCompetencyProjectionSource(
  compatibilityContent: CanonicalContent,
): TargetCompetencyProjectionSource {
  const entries = fullSkillCatalogueProposal.entries.map((entry): TargetCompetency => {
    if (entry.competencyType !== "specialization") {
      return {
        ...entry,
        competencyType: entry.competencyType,
        linkedStats: resolveLinkedStats(entry, compatibilityContent),
      };
    }

    if (!entry.parent) throw new Error(`Missing approved parent for ${entry.id}.`);
    const counterpart = findCounterpart(entry, compatibilityContent.specializations);
    // Preserve an existing counterpart's threshold; otherwise use the existing Chargen
    // schema threshold under issue168's immediate-parent ruling. No Pilot threshold guess.
    const minimumParentLevel =
      counterpart?.minimumParentLevel ??
      skillSpecializationSchema.parse({
        id: entry.id,
        name: entry.name,
        skillId: entry.parent.id,
      }).minimumParentLevel;

    return {
      ...entry,
      competencyType: "specialization",
      parent: { ...entry.parent },
      minimumParentLevel,
    };
  });

  return {
    catalogue: {
      content: { entries, sourceDigest: fullSkillCatalogueProposal.manifest.proposalDigest },
    },
    compatibilityContent,
  };
}

/** Fail closed until all linked-stat mappings in the complete source are approved. */
export function getTargetCompetencyActivationBlockers(
  source: TargetCompetencyProjectionSource,
): readonly string[] {
  return source.catalogue.content.entries
    .filter(
      (entry) =>
        entry.competencyType !== "specialization" &&
        entry.linkedStats.status === "pending-linked-stats",
    )
    .map(({ id }) => id);
}

/**
 * Produces only the complete resolved target set and rejects missing linked-stat mappings.
 */
export function buildTargetChargenDefinitions(source: TargetCompetencyProjectionSource): {
  skills: ChargenTargetSkillDefinition[];
  specializations: SkillSpecialization[];
} {
  const entries = source.catalogue.content.entries;
  if (
    entries.length !== fullSkillCatalogueProposal.entries.length ||
    entries.some((entry, index) => {
      const approved = fullSkillCatalogueProposal.entries[index];
      return (
        entry.id !== approved.id ||
        entry.competencyType !== approved.competencyType ||
        entry.parent?.id !== approved.parent?.id
      );
    })
  ) {
    throw new Error(
      "Target definitions require the complete approved competency identities and parents.",
    );
  }
  const blockers = getTargetCompetencyActivationBlockers(source);
  if (blockers.length > 0) {
    throw new Error(`Target linked stats await approval: ${blockers.join(", ")}.`);
  }

  const skills: ChargenTargetSkillDefinition[] = [];
  const specializations: SkillSpecialization[] = [];
  for (const entry of entries) {
    if (entry.competencyType === "specialization") {
      specializations.push(
        skillSpecializationSchema.parse({
          id: entry.id,
          name: entry.name,
          description: entry.description,
          skillId: entry.parent.id,
          minimumParentLevel: entry.minimumParentLevel,
        }),
      );
    } else if (entry.linkedStats.status !== "pending-linked-stats") {
      skills.push(
        chargenTargetSkillDefinitionSchema.parse({
          competencyType: entry.competencyType,
          id: entry.id,
          name: entry.name,
          description: entry.description,
          shortDescription: entry.shortDescription,
          linkedStats: [...entry.linkedStats.linkedStats],
          legacySkillId:
            entry.linkedStats.status === "legacy-counterpart"
              ? entry.linkedStats.legacySkillId
              : undefined,
        }),
      );
    }
  }
  return { skills, specializations };
}

/** Active target source, with legacy inputs retained solely for compatibility calculations. */
export function buildTargetRuntimeContent(
  source: TargetCompetencyProjectionSource,
): CanonicalContent {
  const definitions = buildTargetChargenDefinitions(source);
  const legacy = source.compatibilityContent;
  const skills = definitions.skills.map((definition, sortOrder) => {
    // Only unchanged identities retain their existing Group membership/access. A stat
    // counterpart is not a grant of that counterpart's Profession or Group routes.
    const sameIdentity = legacy.skills.find(({ id }) => id === definition.id);
    return targetRuntimeSkillDefinitionSchema.parse({
      ...(sameIdentity ?? {}),
      ...definition,
      catalogueSource: "full-target-competencies",
      groupId: sameIdentity?.groupId,
      groupIds: sameIdentity?.groupIds ?? [],
      category: sameIdentity?.category ?? "secondary",
      dependencies: sameIdentity?.dependencies ?? [],
      dependencySkillIds: sameIdentity?.dependencySkillIds ?? [],
      allowsSpecializations: definitions.specializations.some(
        ({ skillId }) => skillId === definition.id,
      ),
      sortOrder,
    });
  });
  const statsById = new Map(skills.map((skill) => [skill.id, skill.linkedStats]));
  function parentStats(id: string, visited = new Set<string>()): string[] {
    const known = statsById.get(id);
    if (known) return known;
    if (visited.has(id)) throw new Error(`Cyclic target parent: ${id}`);
    visited.add(id);
    const parent = definitions.specializations.find((specialization) => specialization.id === id);
    if (!parent) throw new Error(`Missing target parent: ${id}`);
    return parentStats(parent.skillId, visited);
  }
  const specializations = definitions.specializations.map((definition, sortOrder) =>
    targetRuntimeSpecializationSchema.parse({
      ...definition,
      catalogueSource: "full-target-competencies",
      competencyType: "specialization",
      linkedStats: parentStats(definition.skillId),
      sortOrder,
    }),
  );
  const targetIds = new Set([...skills, ...specializations].map(({ id }) => id));
  return {
    ...legacy,
    skills: [...skills, ...legacy.skills.filter(({ id }) => !targetIds.has(id))],
    specializations: [
      ...specializations,
      ...legacy.specializations.filter(({ id }) => !targetIds.has(id)),
    ],
    chargenCatalogue: {
      sourceId: "full-target-competencies",
      skillIds: skills.map(({ id }) => id),
      specializationIds: specializations.map(({ id }) => id),
    },
    compatibilityContent: legacy,
  };
}

// Authoritative metadata never derives from a caller's snapshot or supplied content.
let approvedContent: CanonicalContent | undefined;
function trustedContent(): CanonicalContent {
  return (approvedContent ??= buildTargetRuntimeContent(
    createTargetCompetencyProjectionSource(defaultCanonicalContent),
  ));
}
let approvedV2Content: CanonicalContent | undefined;
export function getApprovedV2RuntimeContent(): CanonicalContent {
  return (approvedV2Content ??= withCompetencyContentV2(trustedContent()));
}
export function getApprovedTargetSkillDefinition(id: string) {
  const definition = getApprovedV2RuntimeContent().skills.find(
    (skill) => skill.id === id && "catalogueSource" in skill,
  );
  return definition ? structuredClone(definition) : undefined;
}
export function getApprovedTargetSpecializationDefinition(id: string) {
  const definition = getApprovedV2RuntimeContent().specializations.find(
    (spec) => spec.id === id && "catalogueSource" in spec,
  );
  return definition ? structuredClone(definition) : undefined;
}
export function getTargetProgressionValidationErrors(progression: CharacterProgression): string[] {
  const errors = validateTargetProgressionMetadata(
    progression,
    getApprovedV2RuntimeContent().skills,
    getApprovedV2RuntimeContent().specializations,
  );
  const groups = getApprovedV2RuntimeContent().skillGroups;
  for (const row of progression.skillGroups) {
    if (!row.targetDefinition) continue;
    // Forgejo #764. This comparison was the only one with no normalizing parse in front of
    // it, so a `jsonb` key reordering reached it raw; and it compared authored prose, so an
    // editorial re-wording retroactively invalidated every older Character.
    // `catalogueIntegrityKey` removes both without weakening the mechanical comparison.
    const approved = groups.find((group) => group.id === row.groupId);
    if (
      !approved ||
      catalogueIntegrityKey(row.targetDefinition) !== catalogueIntegrityKey(approved)
    )
      errors.push(`Learning Group ${row.groupId} does not match the approved target definition.`);
  }
  return errors;
}
export function getApprovedTargetDefinitions() {
  const content = getApprovedV2RuntimeContent();
  return {
    skills: structuredClone(content.skills.filter((skill) => "catalogueSource" in skill)),
    specializations: structuredClone(
      content.specializations.filter((spec) => "catalogueSource" in spec),
    ),
  };
}
export function assertApprovedTargetProgression(progression: CharacterProgression): void {
  const errors = getTargetProgressionValidationErrors(progression);
  if (errors.length) throw new Error(errors.join(" "));
}
