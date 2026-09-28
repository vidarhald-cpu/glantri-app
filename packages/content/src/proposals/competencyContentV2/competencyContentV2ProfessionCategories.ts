/**
 * Competency Content V2 — the approved player-facing Profession browsing taxonomy.
 *
 * WHAT THIS IS. The publication layer for the 16-category browsing roster approved by the Product
 * Owner on 2026-09-27 and recorded as
 * `docs/decisions/rules/0012-profession-browsing-taxonomy-approval.md`. The roster itself is
 * authored content in `docs/source/professions/profession-category-taxonomy-v1.md` sections 1-3 and
 * is transcribed here verbatim: category names, their scope statements, and the complete mapping of
 * all 84 canonical Profession family codes.
 *
 * WHY IT IS DATA RATHER THAN A DOCUMENT READ. Source and proposal markdown is never scraped at
 * runtime (`docs/product/chargen-competency-experience-contract.md` section 9.12). Accepted content
 * reaches a player only through the canonical V2 publication layer, which is this module.
 *
 * WHAT IT IS NOT. A category is browsing taxonomy only. Decision 0012 and section 10.3 of the
 * contract both state it grants no competence and creates no relationship, cost, prerequisite or
 * availability effect. Profession family remains structural identity; nothing here renames,
 * replaces or reinterprets it.
 *
 * NOT RE-AUTHORED. The 16 -> 13 fold considered in the source document's section 5 was rejected by
 * the same ruling. No category here is folded, renamed, or re-authored to force a smaller count.
 */

import { competencyContentV2Families } from "./competencyContentV2Source";

/** One approved browsing category, with the scope statements the roster authored for it. */
export interface V2ProfessionCategory {
  /** Stable identifier for filter state. Never shown to a player. */
  id: string;
  /** The reader-facing category name, verbatim from the approved roster. */
  name: string;
  /** The approved "Belongs here" scope statement. */
  belongsHere: string;
  /** The approved "Does not belong here" boundary statement. */
  doesNotBelongHere: string;
}

/** The approved roster, in the order the source document lists it. */
export const competencyContentV2ProfessionCategories: readonly V2ProfessionCategory[] =
  Object.freeze(
    [
      {
        id: "land-and-wilderness",
        name: "Land and Wilderness",
        belongsHere:
          "Livelihoods that take food, game, or raw material directly from land, water, and domestic animals.",
        doesNotBelongHere: "Processing or selling what is taken; treating animals clinically.",
      },
      {
        id: "travel-transport-and-seafaring",
        name: "Travel, Transport and Seafaring",
        belongsHere:
          "Moving people, goods, or messages over road and water, and working a vessel or in water.",
        doesNotBelongHere: "Building the vessel; owning the cargo; military movement.",
      },
      {
        id: "trade-and-money",
        name: "Trade and Money",
        belongsHere:
          "Livelihoods made from exchange, credit, reckoning, and the keeping of accounts.",
        doesNotBelongHere: "Producing the goods; the legal system itself; supplying an army.",
      },
      {
        id: "law-office-and-diplomacy",
        name: "Law, Office and Diplomacy",
        belongsHere:
          "Speaking, negotiating, or acting formally on behalf of a principal, a party, or a community.",
        doesNotBelongHere: "Private commercial dealing; military command; clerical record-keeping.",
      },
      {
        id: "guarding-and-arms-training",
        name: "Guarding and Arms Training",
        belongsHere:
          "Armed civil work — watching, protecting, compelling — and the teaching of a fighting curriculum.",
        doesNotBelongHere: "Service in an organized military force; covert methods.",
      },
      {
        id: "military-service",
        name: "Military Service",
        belongsHere:
          "Roles within an organized military force, from the ranks to command, supply, planning, and siege work.",
        doesNotBelongHere: "Civil guarding; the arms and armour trades.",
      },
      {
        id: "covert-and-illicit-work",
        name: "Covert and Illicit Work",
        belongsHere: "Work whose method depends on concealment, pretence, or evading a controller.",
        doesNotBelongHere: "Lawful advocacy; open armed force; ordinary trade.",
      },
      {
        id: "healing-and-care",
        name: "Healing and Care",
        belongsHere:
          "Treating and caring for the sick, the injured, the birthing, and animals, and preparing remedies.",
        doesNotBelongHere: "Wild gathering of the materials; alchemical inquiry.",
      },
      {
        id: "metal-and-mechanism-crafts",
        name: "Metal and Mechanism Crafts",
        belongsHere:
          "Winning and working metal, and making the fitted mechanisms and fittings that depend on it.",
        doesNotBelongHere: "Timber and stone structures; using a lock or trap covertly.",
      },
      {
        id: "building-and-extraction",
        name: "Building and Extraction",
        belongsHere:
          "Raising, repairing, and designing structures, and extracting the bulk material they need.",
        doesNotBelongHere: "Fine metal fitting; surveying as a knowledge product.",
      },
      {
        id: "textile-leather-and-pottery",
        name: "Textile, Leather and Pottery",
        belongsHere:
          "Shaping soft and plastic materials — fibre, cloth, hide, clay — into finished goods.",
        doesNotBelongHere: "Metal armour; timber or stone construction.",
      },
      {
        id: "food-and-drink",
        name: "Food and Drink",
        belongsHere: "Preparing food and managed fermentation or distillation for consumption.",
        doesNotBelongHere: "Growing or gathering the ingredients; alchemical practice.",
      },
      {
        id: "letters-and-teaching",
        name: "Letters and Teaching",
        belongsHere:
          "Transmitting competence and text — instruction, copying, and moving meaning between languages.",
        doesNotBelongHere: "The subject matter itself; original inquiry into it.",
      },
      {
        id: "learning-and-inquiry",
        name: "Learning and Inquiry",
        belongsHere:
          "Developing and explaining a learned account of the world through study, measurement, and reasoning.",
        doesNotBelongHere: "Teaching it to others; religious or divinatory interpretation.",
      },
      {
        id: "religion-and-divination",
        name: "Religion and Divination",
        belongsHere:
          "Sustaining a religious tradition, or interpreting signs according to a defined tradition.",
        doesNotBelongHere: "Astronomical observation; philosophical argument.",
      },
      {
        id: "performance-and-display",
        name: "Performance and Display",
        belongsHere:
          "Preparing and presenting work for an audience — music, stage, image, narrative, athletic display.",
        doesNotBelongHere: "Teaching performance; games played for stakes.",
      },
    ].map((category) => Object.freeze(category)),
  );

/**
 * The complete approved mapping: every canonical Profession family `code` to exactly one category
 * id. Transcribed from section 3 of the approved roster; no code is folded, merged or reassigned.
 */
export const competencyContentV2ProfessionCategoryByFamilyCode: Readonly<Record<string, string>> =
  Object.freeze({
    P01: "land-and-wilderness",
    P02: "land-and-wilderness",
    P03: "travel-transport-and-seafaring",
    P04: "land-and-wilderness",
    P05: "land-and-wilderness",
    P06: "land-and-wilderness",
    P07: "land-and-wilderness",
    P08: "travel-transport-and-seafaring",
    P09: "travel-transport-and-seafaring",
    P10: "travel-transport-and-seafaring",
    P11: "travel-transport-and-seafaring",
    P12: "travel-transport-and-seafaring",
    P13: "trade-and-money",
    P14: "guarding-and-arms-training",
    P15: "guarding-and-arms-training",
    P16: "covert-and-illicit-work",
    P17: "covert-and-illicit-work",
    P18: "covert-and-illicit-work",
    P19: "covert-and-illicit-work",
    P20: "covert-and-illicit-work",
    P21: "covert-and-illicit-work",
    P22: "military-service",
    P23: "military-service",
    P24: "military-service",
    P25: "military-service",
    P26: "military-service",
    P27: "military-service",
    P28: "military-service",
    P29: "military-service",
    P30: "healing-and-care",
    P31: "healing-and-care",
    P32: "healing-and-care",
    P33: "healing-and-care",
    P34: "healing-and-care",
    P35: "healing-and-care",
    P36: "metal-and-mechanism-crafts",
    P37: "metal-and-mechanism-crafts",
    P38: "metal-and-mechanism-crafts",
    P39: "building-and-extraction",
    P40: "building-and-extraction",
    P41: "textile-leather-and-pottery",
    P42: "textile-leather-and-pottery",
    P43: "textile-leather-and-pottery",
    P44: "textile-leather-and-pottery",
    P45: "textile-leather-and-pottery",
    P46: "building-and-extraction",
    P47: "building-and-extraction",
    P48: "building-and-extraction",
    P49: "building-and-extraction",
    P50: "learning-and-inquiry",
    P51: "metal-and-mechanism-crafts",
    P52: "metal-and-mechanism-crafts",
    P53: "food-and-drink",
    P54: "food-and-drink",
    P55: "food-and-drink",
    P56: "food-and-drink",
    P57: "learning-and-inquiry",
    P58: "trade-and-money",
    P59: "law-office-and-diplomacy",
    P60: "law-office-and-diplomacy",
    P61: "law-office-and-diplomacy",
    P62: "trade-and-money",
    P63: "law-office-and-diplomacy",
    P64: "letters-and-teaching",
    P65: "letters-and-teaching",
    P66: "letters-and-teaching",
    P67: "learning-and-inquiry",
    P68: "learning-and-inquiry",
    P69: "learning-and-inquiry",
    P70: "learning-and-inquiry",
    P71: "religion-and-divination",
    P72: "learning-and-inquiry",
    P73: "learning-and-inquiry",
    P74: "religion-and-divination",
    P75: "religion-and-divination",
    P76: "law-office-and-diplomacy",
    P77: "performance-and-display",
    P78: "performance-and-display",
    P79: "performance-and-display",
    P80: "performance-and-display",
    P81: "performance-and-display",
    P82: "guarding-and-arms-training",
    P83: "trade-and-money",
    P84: "travel-transport-and-seafaring",
  });

/* The mapping is approved against the canonical 84-family roster, so a canonical family with no
   category, or a category id the roster does not define, is a publication defect and fails here
   rather than reaching a player as a silently missing filter option. */
const categoryIds = new Set(competencyContentV2ProfessionCategories.map(({ id }) => id));
const mappedCodes = Object.keys(competencyContentV2ProfessionCategoryByFamilyCode);
for (const [code, categoryId] of Object.entries(competencyContentV2ProfessionCategoryByFamilyCode))
  if (!categoryIds.has(categoryId))
    throw new Error(`Profession family ${code} maps to unknown browsing category ${categoryId}.`);
for (const family of competencyContentV2Families)
  if (!competencyContentV2ProfessionCategoryByFamilyCode[family.code])
    throw new Error(`Canonical Profession family ${family.code} has no browsing category.`);
if (mappedCodes.length !== competencyContentV2Families.length)
  throw new Error(
    `The browsing taxonomy maps ${mappedCodes.length} Profession families; the canonical roster has ${competencyContentV2Families.length}.`,
  );

/** The approved browsing category for a canonical Profession family `code`. */
export function competencyV2ProfessionCategory(
  familyCode: string,
): V2ProfessionCategory | undefined {
  const id = competencyContentV2ProfessionCategoryByFamilyCode[familyCode];
  return competencyContentV2ProfessionCategories.find((category) => category.id === id);
}
