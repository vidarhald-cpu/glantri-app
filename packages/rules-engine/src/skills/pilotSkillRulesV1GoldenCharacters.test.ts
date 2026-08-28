import type {
  AccessBand,
  DevelopmentStage,
  PilotSkillEconomicWeight,
  PilotSkillRelationshipStrength,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  calculatePilotSkillBuild,
  evaluatePilotChargenBudget,
  validatePilotSkillFinalization,
  type PilotSkillAcquisition,
  type PilotSkillBuildResult,
  type PilotSkillCompetencyDefinition,
  type PilotSkillLearningGroup,
  type PilotSkillRelationship,
} from "./pilotSkillRulesV1";

interface GoldenCharacterFixture {
  biography: string;
  competencies: readonly PilotSkillCompetencyDefinition[];
  context: {
    accessBand: AccessBand;
    developmentStage: DevelopmentStage;
    professionId: string;
  };
  directAcquisitions: readonly PilotSkillAcquisition[];
  expected: {
    competence: Readonly<Record<string, number>>;
    directAndSpecializationCost: number;
    flexSpent: number;
    groupCost: number;
    totalCost: number;
    weightedUsefulGroupCompetence: number;
  };
  groups: readonly PilotSkillLearningGroup[];
  id: string;
  relationships: readonly PilotSkillRelationship[];
  rolls: readonly {
    competencyId: string;
    linkedStatAverage: number;
    total: number;
  }[];
  title: string;
}

function skill(id: string, weight: PilotSkillEconomicWeight = 2): PilotSkillCompetencyDefinition {
  return { id, kind: "skill", name: id, weight };
}

function specialization(id: string, baseId: string): PilotSkillCompetencyDefinition {
  return {
    id,
    kind: "specialization",
    name: id,
    specialization: {
      acquisitionWeight: 1,
      prerequisites: [{ competencyId: baseId, threshold: 6 }],
    },
  };
}

function relationship(
  id: string,
  sourceCompetencyId: string,
  targetCompetencyId: string,
  strength: PilotSkillRelationshipStrength,
): PilotSkillRelationship {
  return { id, sourceCompetencyId, strength, targetCompetencyId };
}

function spokenLanguage(): PilotSkillCompetencyDefinition {
  return {
    id: "spoken-language:background",
    kind: "spoken-language",
    name: "Background spoken language",
    weight: 2,
  };
}

function calculateGoldenCharacter(fixture: GoldenCharacterFixture): PilotSkillBuildResult {
  return calculatePilotSkillBuild({
    competencies: fixture.competencies,
    directAcquisitions: fixture.directAcquisitions,
    grantedAcquisitions: [
      {
        competencyId: "spoken-language:background",
        ranks: 11,
        sourceId: `society-background:${fixture.id}`,
        sourceKind: "background",
      },
    ],
    groups: fixture.groups,
    professionId: fixture.context.professionId,
    relationships: fixture.relationships,
  });
}

const goldenCharacters: GoldenCharacterFixture[] = [
  {
    biography: "Four-intensity City Watch service followed by a two-intensity veteran campaign.",
    competencies: [
      skill("sword"),
      skill("shield"),
      skill("perception"),
      skill("athletics"),
      skill("battle-tactics", 3),
      skill("survival"),
      skill("first-aid", 1),
      skill("dodge", 1),
      skill("leadership"),
      skill("knife-dagger"),
      specialization("watch-sword-shield-drill", "sword"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB2",
      developmentStage: "DS3",
      professionId: "city-watch",
    },
    directAcquisitions: [
      { competencyId: "sword", ranks: 2 },
      { competencyId: "dodge", ranks: 3 },
      { competencyId: "leadership", ranks: 2 },
      { competencyId: "watch-sword-shield-drill", ranks: 2 },
    ],
    expected: {
      competence: {
        athletics: 4,
        "battle-tactics": 2,
        dodge: 3,
        "first-aid": 2,
        "knife-dagger": 3,
        leadership: 2,
        perception: 4,
        shield: 4,
        survival: 2,
        sword: 6,
        "watch-sword-shield-drill": 2,
      },
      directAndSpecializationCost: 15,
      flexSpent: 0,
      groupCost: 30,
      totalCost: 45,
      weightedUsefulGroupCompetence: 44,
    },
    groups: [
      {
        competencyIds: ["sword", "shield", "perception", "athletics"],
        id: "city-watch-service",
        level: 4,
        name: "City Watch Service",
      },
      {
        competencyIds: ["sword", "battle-tactics", "survival", "first-aid"],
        id: "veteran-campaign",
        level: 2,
        name: "Veteran Campaign",
      },
    ],
    id: "guard-veteran",
    relationships: [relationship("sword-to-knife", "sword", "knife-dagger", 50)],
    rolls: [
      { competencyId: "sword", linkedStatAverage: 15, total: 31 },
      { competencyId: "perception", linkedStatAverage: 14, total: 28 },
    ],
    title: "Martial guard / veteran",
  },
  {
    biography: "Four-intensity infirmary training plus two-intensity scholarly study.",
    competencies: [
      skill("medicine", 3),
      skill("first-aid", 1),
      skill("pharmacy"),
      skill("research", 3),
      skill("written-tradition"),
      skill("surgery", 3),
      skill("plant-lore"),
      specialization("diagnostic-medicine", "medicine"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB3",
      developmentStage: "DS4",
      professionId: "physician-scholar",
    },
    directAcquisitions: [
      { competencyId: "medicine", ranks: 2 },
      { competencyId: "surgery", ranks: 2 },
      { competencyId: "plant-lore", ranks: 2 },
      { competencyId: "diagnostic-medicine", ranks: 2 },
    ],
    expected: {
      competence: {
        "diagnostic-medicine": 3,
        "first-aid": 6,
        medicine: 6,
        pharmacy: 4,
        "plant-lore": 2,
        research: 2,
        surgery: 2,
        "written-tradition": 2,
      },
      directAndSpecializationCost: 20,
      flexSpent: 0,
      groupCost: 20,
      totalCost: 40,
      weightedUsefulGroupCompetence: 30,
    },
    groups: [
      {
        competencyIds: ["medicine", "first-aid", "pharmacy"],
        id: "infirmary-training",
        level: 4,
        name: "Infirmary Training",
      },
      {
        competencyIds: ["research", "written-tradition", "medicine"],
        id: "scholarly-study",
        level: 2,
        name: "Scholarly Study",
      },
    ],
    id: "physician-scholar",
    relationships: [
      relationship("medicine-includes-first-aid", "medicine", "first-aid", 100),
      relationship("medicine-to-surgery", "medicine", "surgery", 25),
      relationship("medicine-to-diagnostics", "medicine", "diagnostic-medicine", 50),
    ],
    rolls: [
      { competencyId: "medicine", linkedStatAverage: 16, total: 32 },
      { competencyId: "first-aid", linkedStatAverage: 14, total: 30 },
      { competencyId: "surgery", linkedStatAverage: 14, total: 26 },
    ],
    title: "Practical healer / physician-scholar",
  },
  {
    biography: "Street-network upbringing at four plus a burglary crew at three.",
    competencies: [
      skill("streetwise"),
      skill("underworld"),
      skill("deception"),
      skill("stealth"),
      skill("lockpicking"),
      skill("perception"),
      skill("sleight-of-hand"),
      skill("insight"),
      skill("disguise"),
      specialization("fine-mechanisms-lock-work", "lockpicking"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB1",
      developmentStage: "DS3",
      professionId: "burglar-investigator",
    },
    directAcquisitions: [
      { competencyId: "insight", ranks: 3 },
      { competencyId: "perception", ranks: 2 },
      { competencyId: "disguise", ranks: 2 },
      { competencyId: "lockpicking", ranks: 3 },
      { competencyId: "fine-mechanisms-lock-work", ranks: 2 },
    ],
    expected: {
      competence: {
        deception: 4,
        disguise: 2,
        "fine-mechanisms-lock-work": 3,
        insight: 3,
        lockpicking: 6,
        perception: 5,
        "sleight-of-hand": 3,
        stealth: 3,
        streetwise: 4,
        underworld: 4,
      },
      directAndSpecializationCost: 24,
      flexSpent: 0,
      groupCost: 32,
      totalCost: 56,
      weightedUsefulGroupCompetence: 48,
    },
    groups: [
      {
        competencyIds: ["streetwise", "underworld", "deception"],
        id: "street-network",
        level: 4,
        name: "Street Network",
      },
      {
        competencyIds: ["stealth", "lockpicking", "perception", "sleight-of-hand"],
        id: "burglary-crew",
        level: 3,
        name: "Burglary Crew",
      },
    ],
    id: "covert-investigator",
    relationships: [
      relationship(
        "lockpicking-to-fine-mechanisms",
        "lockpicking",
        "fine-mechanisms-lock-work",
        50,
      ),
    ],
    rolls: [
      { competencyId: "lockpicking", linkedStatAverage: 15, total: 31 },
      { competencyId: "streetwise", linkedStatAverage: 14, total: 28 },
    ],
    title: "Covert / street investigator",
  },
  {
    biography: "Court office at four plus clerk schooling at three.",
    competencies: [
      skill("administration"),
      skill("written-tradition"),
      skill("customs"),
      skill("oratory"),
      skill("research", 3),
      skill("bookkeeping"),
      skill("law", 3),
      skill("insight"),
      specialization("court-administration", "administration"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB3",
      developmentStage: "DS4",
      professionId: "court-official",
    },
    directAcquisitions: [
      { competencyId: "law", ranks: 3 },
      { competencyId: "administration", ranks: 2 },
      { competencyId: "insight", ranks: 2 },
      { competencyId: "court-administration", ranks: 2 },
    ],
    expected: {
      competence: {
        administration: 6,
        bookkeeping: 3,
        "court-administration": 3,
        customs: 4,
        insight: 2,
        law: 3,
        oratory: 4,
        research: 3,
        "written-tradition": 4,
      },
      directAndSpecializationCost: 21,
      flexSpent: 0,
      groupCost: 30,
      totalCost: 51,
      weightedUsefulGroupCompetence: 45,
    },
    groups: [
      {
        competencyIds: ["administration", "written-tradition", "customs", "oratory"],
        id: "court-office",
        level: 4,
        name: "Court Office",
      },
      {
        competencyIds: ["research", "bookkeeping", "written-tradition"],
        id: "clerk-school",
        level: 3,
        name: "Clerk School",
      },
    ],
    id: "court-official",
    relationships: [
      relationship("administration-to-bookkeeping", "administration", "bookkeeping", 25),
      relationship(
        "administration-to-court-specialization",
        "administration",
        "court-administration",
        50,
      ),
    ],
    rolls: [
      { competencyId: "administration", linkedStatAverage: 15, total: 31 },
      { competencyId: "law", linkedStatAverage: 16, total: 29 },
    ],
    title: "Court / administration / literate official",
  },
  {
    biography: "Market stall at four plus smith apprenticeship at three.",
    competencies: [
      skill("trade"),
      skill("bargaining"),
      skill("appraisal"),
      skill("bookkeeping"),
      skill("smithing"),
      skill("athletics"),
      skill("perception"),
      specialization("weaponsmithing", "smithing"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB2",
      developmentStage: "DS3",
      professionId: "merchant-smith",
    },
    directAcquisitions: [
      { competencyId: "smithing", ranks: 3 },
      { competencyId: "trade", ranks: 2 },
      { competencyId: "perception", ranks: 2 },
      { competencyId: "weaponsmithing", ranks: 2 },
    ],
    expected: {
      competence: {
        appraisal: 4,
        athletics: 3,
        bargaining: 4,
        bookkeeping: 4,
        perception: 2,
        smithing: 6,
        trade: 6,
        weaponsmithing: 3,
      },
      directAndSpecializationCost: 18,
      flexSpent: 0,
      groupCost: 27,
      totalCost: 45,
      weightedUsefulGroupCompetence: 40,
    },
    groups: [
      {
        competencyIds: ["trade", "bargaining", "appraisal", "bookkeeping"],
        id: "market-stall",
        level: 4,
        name: "Market Stall",
      },
      {
        competencyIds: ["smithing", "appraisal", "athletics"],
        id: "smith-apprenticeship",
        level: 3,
        name: "Smith Apprenticeship",
      },
    ],
    id: "merchant-smith",
    relationships: [
      relationship("trade-to-bargaining", "trade", "bargaining", 50),
      relationship("smithing-to-weaponsmithing", "smithing", "weaponsmithing", 50),
    ],
    rolls: [
      { competencyId: "smithing", linkedStatAverage: 15, total: 31 },
      { competencyId: "trade", linkedStatAverage: 14, total: 30 },
      { competencyId: "appraisal", linkedStatAverage: 14, total: 28 },
    ],
    title: "Merchant / craft specialist",
  },
  {
    biography: "Vessel crew at four plus coastal navigation training at three.",
    competencies: [
      skill("seamanship"),
      skill("pilotage"),
      skill("swimming"),
      skill("weather-lore"),
      skill("wayfinding"),
      skill("dead-reckoning", 3),
      skill("chart-navigation", 3),
      skill("perception"),
      specialization("home-coast-pilotage", "pilotage"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB2",
      developmentStage: "DS3",
      professionId: "coastal-navigator",
    },
    directAcquisitions: [
      { competencyId: "wayfinding", ranks: 3 },
      { competencyId: "pilotage", ranks: 2 },
      { competencyId: "perception", ranks: 2 },
      { competencyId: "home-coast-pilotage", ranks: 2 },
    ],
    expected: {
      competence: {
        "chart-navigation": 3,
        "dead-reckoning": 3,
        "home-coast-pilotage": 3,
        perception: 2,
        pilotage: 6,
        seamanship: 4,
        swimming: 4,
        wayfinding: 6,
        "weather-lore": 4,
      },
      directAndSpecializationCost: 18,
      flexSpent: 0,
      groupCost: 36,
      totalCost: 54,
      weightedUsefulGroupCompetence: 54,
    },
    groups: [
      {
        competencyIds: ["seamanship", "pilotage", "swimming", "weather-lore"],
        id: "vessel-crew",
        level: 4,
        name: "Vessel Crew",
      },
      {
        competencyIds: ["wayfinding", "pilotage", "dead-reckoning", "chart-navigation"],
        id: "coastal-navigation-training",
        level: 3,
        name: "Coastal Navigation Training",
      },
    ],
    id: "coastal-navigator",
    relationships: [
      relationship("seamanship-to-pilotage", "seamanship", "pilotage", 25),
      relationship("wayfinding-to-pilotage", "wayfinding", "pilotage", 25),
      relationship("pilotage-to-home-coast", "pilotage", "home-coast-pilotage", 50),
    ],
    rolls: [
      { competencyId: "pilotage", linkedStatAverage: 15, total: 31 },
      { competencyId: "chart-navigation", linkedStatAverage: 16, total: 29 },
    ],
    title: "Maritime / navigation / outdoor specialist",
  },
  {
    biography: "Frontier militia and caravan factor at three, plus scout journeys at two.",
    competencies: [
      skill("spear"),
      skill("perception"),
      skill("survival"),
      skill("first-aid", 1),
      skill("trade"),
      skill("bargaining"),
      skill("wayfinding"),
      skill("animal-handling"),
      skill("tracking"),
      skill("hunting"),
      skill("pilotage"),
      specialization("desert-wayfinding", "wayfinding"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB2",
      developmentStage: "DS2",
      professionId: "caravan-scout-militia",
    },
    directAcquisitions: [
      { competencyId: "perception", ranks: 2 },
      { competencyId: "trade", ranks: 2 },
      { competencyId: "spear", ranks: 2 },
      { competencyId: "wayfinding", ranks: 3 },
      { competencyId: "desert-wayfinding", ranks: 2 },
    ],
    expected: {
      competence: {
        "animal-handling": 3,
        bargaining: 3,
        "desert-wayfinding": 3,
        "first-aid": 3,
        hunting: 1,
        perception: 5,
        pilotage: 1,
        spear: 5,
        survival: 3,
        tracking: 2,
        trade: 5,
        wayfinding: 6,
      },
      directAndSpecializationCost: 22,
      flexSpent: 0,
      groupCost: 32,
      totalCost: 54,
      weightedUsefulGroupCompetence: 47,
    },
    groups: [
      {
        competencyIds: ["spear", "perception", "survival", "first-aid"],
        id: "frontier-militia",
        level: 3,
        name: "Frontier Militia",
      },
      {
        competencyIds: ["trade", "bargaining", "wayfinding", "animal-handling"],
        id: "caravan-factor",
        level: 3,
        name: "Caravan Factor",
      },
      {
        competencyIds: ["wayfinding", "tracking", "perception", "survival"],
        id: "scout-journeys",
        level: 2,
        name: "Scout Journeys",
      },
    ],
    id: "caravan-militia-hybrid",
    relationships: [
      relationship("trade-to-bargaining", "trade", "bargaining", 50),
      relationship("tracking-to-hunting", "tracking", "hunting", 50),
      relationship("wayfinding-to-pilotage", "wayfinding", "pilotage", 25),
      relationship("wayfinding-to-desert", "wayfinding", "desert-wayfinding", 50),
    ],
    rolls: [
      { competencyId: "wayfinding", linkedStatAverage: 14, total: 30 },
      { competencyId: "spear", linkedStatAverage: 15, total: 30 },
    ],
    title: "Legitimate overlapping hybrid",
  },
  {
    biography:
      "Three four-intensity histories chosen to advertise Perception/Stealth synergy, with distinct chronology still required.",
    competencies: [
      skill("perception"),
      skill("stealth"),
      skill("athletics"),
      skill("lockpicking"),
      skill("tracking"),
      skill("hunting"),
      specialization("lock-mastery", "lockpicking"),
      spokenLanguage(),
    ],
    context: {
      accessBand: "AB2",
      developmentStage: "DS3",
      professionId: "optimization-probe",
    },
    directAcquisitions: [
      { competencyId: "perception", ranks: 6 },
      { competencyId: "stealth", ranks: 6 },
      { competencyId: "lockpicking", ranks: 2 },
      { competencyId: "lock-mastery", ranks: 2 },
    ],
    expected: {
      competence: {
        athletics: 4,
        hunting: 4,
        lockpicking: 6,
        "lock-mastery": 3,
        perception: 10,
        stealth: 10,
        tracking: 4,
      },
      directAndSpecializationCost: 32,
      flexSpent: 2,
      groupCost: 30,
      totalCost: 62,
      weightedUsefulGroupCompetence: 44,
    },
    groups: [
      {
        competencyIds: ["perception", "stealth", "athletics"],
        id: "watch-scout",
        level: 4,
        name: "Watch Scout",
      },
      {
        competencyIds: ["perception", "stealth", "lockpicking"],
        id: "burglar-lookout",
        level: 4,
        name: "Burglar Lookout",
      },
      {
        competencyIds: ["perception", "stealth", "tracking", "hunting"],
        id: "wilderness-stalker",
        level: 4,
        name: "Wilderness Stalker",
      },
    ],
    id: "deliberate-optimizer",
    relationships: [
      relationship("tracking-to-hunting", "tracking", "hunting", 50),
      relationship("lockpicking-to-mastery", "lockpicking", "lock-mastery", 50),
    ],
    rolls: [
      { competencyId: "stealth", linkedStatAverage: 15, total: 35 },
      { competencyId: "perception", linkedStatAverage: 14, total: 34 },
      { competencyId: "lockpicking", linkedStatAverage: 15, total: 31 },
    ],
    title: "Deliberate optimizer / edge case",
  },
];

describe("Pilot Skill Rules v1 Gate A golden Characters", () => {
  it("pins all eight accepted biography-first fixtures", () => {
    expect(goldenCharacters.map((fixture) => fixture.id)).toEqual([
      "guard-veteran",
      "physician-scholar",
      "covert-investigator",
      "court-official",
      "merchant-smith",
      "coastal-navigator",
      "caravan-militia-hybrid",
      "deliberate-optimizer",
    ]);
    expect(
      goldenCharacters.every(
        (fixture) =>
          fixture.biography.length > 20 &&
          fixture.context.professionId.length > 0 &&
          fixture.context.accessBand.startsWith("AB") &&
          fixture.context.developmentStage.startsWith("DS"),
      ),
    ).toBe(true);
  });

  it.each(goldenCharacters)(
    "$id produces exact accepted cost, competence, roll, budget, and language results",
    (fixture) => {
      const result = calculateGoldenCharacter(fixture);
      const budget = evaluatePilotChargenBudget({
        configuration: { flexBudget: 26, formationBudget: 60 },
        purchases: [
          {
            access: "available",
            cost: result.totalCost,
            formationEligible: true,
            id: fixture.id,
          },
        ],
      });

      expect(result.groupBundle.weightedUsefulIncrement).toBe(
        fixture.expected.weightedUsefulGroupCompetence,
      );
      expect(result.groupBundle.bundleCost).toBe(fixture.expected.groupCost);
      expect(result.directCost + result.specializationCost).toBe(
        fixture.expected.directAndSpecializationCost,
      );
      expect(result.totalCost).toBe(fixture.expected.totalCost);
      expect(budget).toMatchObject({
        flexSpent: fixture.expected.flexSpent,
        formationSpent: Math.min(60, fixture.expected.totalCost),
        valid: true,
      });

      for (const [competencyId, competence] of Object.entries(fixture.expected.competence)) {
        expect(result.byCompetencyId[competencyId]?.effectiveCompetence).toBe(competence);
      }

      for (const roll of fixture.rolls) {
        expect(
          roll.linkedStatAverage +
            result.byCompetencyId[roll.competencyId]!.effectiveCompetence +
            10,
        ).toBe(roll.total);
      }

      expect(
        validatePilotSkillFinalization({
          build: result,
          competencies: fixture.competencies,
        }),
      ).toEqual({ errors: [], valid: true });
    },
  );

  it.each(goldenCharacters)("$id is neutral to group selection permutation", (fixture) => {
    const forward = calculateGoldenCharacter(fixture);
    const reversed = calculatePilotSkillBuild({
      competencies: fixture.competencies,
      directAcquisitions: fixture.directAcquisitions,
      grantedAcquisitions: [
        {
          competencyId: "spoken-language:background",
          ranks: 11,
          sourceId: `society-background:${fixture.id}`,
          sourceKind: "background",
        },
      ],
      groups: [...fixture.groups]
        .reverse()
        .map((group) => ({ ...group, competencyIds: [...group.competencyIds].reverse() })),
      professionId: fixture.context.professionId,
      relationships: [...fixture.relationships].reverse(),
    });

    expect(reversed).toEqual(forward);
  });
});
