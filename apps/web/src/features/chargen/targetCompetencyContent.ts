import type { CanonicalContent } from "@glantri/content";
import {
  fullSkillCatalogueProposal,
  type FullSkillCatalogueEntry,
} from "@glantri/content/full-skill-catalogue-proposal";
import {
  chargenTargetSkillDefinitionSchema,
  skillSpecializationSchema,
  type ChargenTargetSkillDefinition,
  type SkillDefinition,
  type SkillSpecialization,
} from "@glantri/domain";

import {
  type ChargenContentContextSource,
  UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT,
} from "./chargenContentContextSource";

type TargetSkillType = "base-skill" | "spoken-language" | "written-tradition";

export type TargetLinkedStats =
  | { status: "pending-linked-stats" }
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

export interface TargetCompetencyChargenSource extends ChargenContentContextSource<TargetCompetencyCatalogue> {
  acquisitionContext: typeof UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT;
  /** Read-only input for existing Profession calculations and persisted legacy identities. */
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
export function createTargetCompetencyChargenSource(
  compatibilityContent: CanonicalContent,
): TargetCompetencyChargenSource {
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
    acquisitionContext: UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT,
    catalogue: {
      content: { entries, sourceDigest: fullSkillCatalogueProposal.manifest.proposalDigest },
      identity: { projectionVersion: 1, sourceId: "full-target-competencies" },
    },
    compatibilityContent,
  };
}

/** Fail closed until all linked-stat mappings in the complete source are approved. */
export function getTargetCompetencyActivationBlockers(
  source: TargetCompetencyChargenSource,
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
 * Produces only the complete resolved target set. The existing wizard is not switched to
 * these definitions while any source entry is awaiting an approved linked-stat mapping.
 */
export function buildTargetChargenDefinitions(source: TargetCompetencyChargenSource): {
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
    } else if (entry.linkedStats.status === "legacy-counterpart") {
      skills.push(
        chargenTargetSkillDefinitionSchema.parse({
          competencyType: entry.competencyType,
          id: entry.id,
          name: entry.name,
          description: entry.description,
          shortDescription: entry.shortDescription,
          linkedStats: [...entry.linkedStats.linkedStats],
          legacySkillId: entry.linkedStats.legacySkillId,
        }),
      );
    }
  }
  return { skills, specializations };
}
