import type {
  ProvisionalSkillEconomicWeight,
  SkillCatalogueAuthoringDocument,
  SkillCatalogueRecordMetadata,
  SkillTaskEnvelope,
} from "@glantri/domain";

const ISSUE_365_REFERENCE = "https://github.com/vidarhald-cpu/glantri-app/issues/365";
const HEALING_RULING_REFERENCE =
  "https://github.com/vidarhald-cpu/glantri-app/issues/258#issuecomment-5402082898";
const LANGUAGE_RULING_REFERENCE =
  "https://github.com/vidarhald-cpu/glantri-app/issues/258#issuecomment-5396400536";

function metadata(
  status: SkillCatalogueRecordMetadata["status"] = "proposal",
  reference = ISSUE_365_REFERENCE,
): SkillCatalogueRecordMetadata {
  return {
    recordVersion: "1",
    status,
    provenance: {
      kind: status === "canonical" ? "decision" : status === "evidence" ? "evidence" : status,
      reference,
    },
  };
}

function economicWeight(
  relativeScope: ProvisionalSkillEconomicWeight["relativeScope"],
  rationale: string,
): ProvisionalSkillEconomicWeight {
  return {
    pricingAuthority: "none",
    rationale,
    relativeScope,
    status: "provisional",
  };
}

function taskEnvelope(input: SkillTaskEnvelope): SkillTaskEnvelope {
  return input;
}

/**
 * Deliberately small, proposal-only semantic data for #365. It is not imported by
 * CanonicalContent, loaders, rules-engine, chargen, persistence, or application code.
 */
export const representativeSkillCatalogueAuthoringDocument: SkillCatalogueAuthoringDocument = {
  id: "catalogue:proposal:issue-365",
  kind: "skill-catalogue-authoring",
  schemaVersion: "skill-catalogue-authoring/v1",
  catalogueVersion: "issue-365-representative-v1",
  title: "Representative Skill Catalogue authoring semantics",
  runtimeIntegration: "none",
  policies: {
    categoryAndFamilyMechanics: "none",
    inclusionSemantics: "explicit-directed-100-percent",
    relationshipArithmetic: "unresolved-except-inclusion",
    relationshipInference: "explicit-edges-only",
    relationshipSourceCombination: "non-stacking",
    reverseRelationships: "not-inferred",
    runtimeEligibility: "not-implemented",
    runtimePricing: "not-implemented",
  },
  domains: [
    {
      id: "domain:proposal:healing",
      kind: "domain",
      name: "Healing",
      description: "Practices for recognizing illness or injury and preserving life or function.",
      mechanics: "none",
      purchasable: false,
      xpBearing: false,
      metadata: metadata("proposal", HEALING_RULING_REFERENCE),
    },
    {
      id: "domain:proposal:language-text",
      kind: "domain",
      name: "Language and Text",
      description: "Spoken communication and culturally situated written traditions.",
      mechanics: "none",
      purchasable: false,
      xpBearing: false,
      metadata: metadata(),
    },
  ],
  categories: [
    {
      id: "category:proposal:healing-practices",
      kind: "category",
      name: "Healing Practices",
      description: "Navigation for concrete diagnostic, urgent-care, operative, and remedy skills.",
      domainIds: ["domain:proposal:healing"],
      mechanics: "none",
      membershipMeaning: "navigation-only",
      purchasable: false,
      xpBearing: false,
      metadata: metadata(),
    },
    {
      id: "category:proposal:languages-and-scripts",
      kind: "category",
      name: "Languages and Scripts",
      description: "Navigation for spoken languages and language-plus-script written traditions.",
      domainIds: ["domain:proposal:language-text"],
      mechanics: "none",
      membershipMeaning: "navigation-only",
      purchasable: false,
      xpBearing: false,
      metadata: metadata(),
    },
  ],
  skills: [
    {
      id: "skill:proposal:wayfarers-physic",
      kind: "skill",
      name: "Wayfarer's Physic",
      description:
        "An oral healer's practice for familiar travel, household, and seasonal ailments using observation, rest, diet, and known local remedies.",
      domainId: "domain:proposal:healing",
      categoryIds: ["category:proposal:healing-practices"],
      economicWeight: economicWeight(
        "broad",
        "Proposal evidence for a broad local practice; no price follows from this label.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: [
          "Recognize familiar illness and injury patterns in the practitioner's community.",
          "Choose rest, diet, travel, and locally known non-operative remedies.",
        ],
        methods: ["Oral case memory, direct observation, household practice, and seasonal lore."],
        limits: [
          "Does not cover unfamiliar scholarly disease systems or a distinct operative tradition.",
        ],
        useGuidance:
          "Use for problems within the named community tradition; unfamiliar causes require another practice or outside help.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
    {
      id: "skill:proposal:collegiate-medicine",
      kind: "skill",
      name: "Collegiate Medicine",
      description:
        "A late-medieval or Renaissance-style learned practice joining structured case histories, prognosis, non-operative treatment, and complete ordinary First Aid.",
      domainId: "domain:proposal:healing",
      categoryIds: ["category:proposal:healing-practices"],
      economicWeight: economicWeight(
        "broad",
        "Proposal evidence for a broad learned practice; no price follows from this label.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: [
          "Take a structured history, compare signs, form a prognosis, and manage non-operative treatment.",
          "Perform every core First Aid task: control bleeding, protect wounds, immobilize injuries, keep the patient warm, and arrange safe handoff.",
        ],
        methods: [
          "Examining signs, consulting a named textual tradition, diet and regimen, compounded remedies, and referral to an operative practitioner.",
        ],
        limits: [
          "Does not itself teach invasive procedures, every local remedy tradition, or later industrial and modern clinical systems.",
        ],
        useGuidance:
          "Use for learned diagnosis and non-operative care in a profile that reproduces this institution; use Surgery for invasive intervention.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
    {
      id: "skill:proposal:first-aid",
      kind: "skill",
      name: "First Aid",
      description:
        "Immediate stabilization and safe short-term care for common injuries until recovery or handoff is possible.",
      domainId: "domain:proposal:healing",
      categoryIds: ["category:proposal:healing-practices"],
      economicWeight: economicWeight(
        "narrow",
        "This deliberately small urgent-care envelope is provisionally lower in relative scope than broad Medicine.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: [
          "Control bleeding, protect wounds, immobilize injuries, keep a casualty warm, and organize safe movement or handoff.",
        ],
        methods: ["Rapid observation, binding, splinting, positioning, warmth, and simple triage."],
        limits: ["Does not provide broad diagnosis, long-term treatment, or operative competence."],
        useGuidance:
          "Use when immediate stabilization is the whole question, including outside a medical institution.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
    {
      id: "skill:proposal:surgery",
      kind: "skill",
      name: "Surgery",
      description:
        "A distinct operative practice using manual or invasive procedures, dedicated tools, and separately learned risk control.",
      domainId: "domain:proposal:healing",
      categoryIds: ["category:proposal:healing-practices"],
      economicWeight: economicWeight(
        "ordinary",
        "Surgery is a full concrete practice; its actual cost remains unresolved.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: [
          "Perform authored invasive procedures and manage their immediate operative risks.",
        ],
        methods: [
          "Incision, extraction, reduction, suturing, cautery, or other profile-authored methods.",
        ],
        limits: [
          "Does not automatically provide broad diagnosis, First Aid, or every procedure family.",
        ],
        useGuidance:
          "Use only for procedures inside the society profile's named operative tradition and available tools.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
    {
      id: "skill:legacy:broad-healing",
      kind: "skill",
      name: "Legacy Broad Healing",
      description:
        "Evidence that an older content version combined several healing meanings; retained only to test explicit legacy status.",
      domainId: "domain:proposal:healing",
      categoryIds: ["category:proposal:healing-practices"],
      economicWeight: economicWeight(
        "broad",
        "Historical compatibility evidence only; it supplies no migration or price decision.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: ["Describe the broad task envelope recorded by the legacy content version."],
        methods: ["Legacy source interpretation only."],
        limits: ["Must not become current canonical content or trigger Character conversion."],
        useGuidance: "Use only as migration and catalogue-review evidence.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(
        "legacy",
        "data/import/glantri_content_pack_full_2026-03-30_norm7/skills.csv",
      ),
    },
  ],
  specializations: [
    {
      id: "specialization:proposal:campaign-wound-surgery",
      kind: "specialization",
      name: "Campaign Wound Surgery",
      description:
        "A narrower Surgery practice for constrained field conditions, rapid wound operations, and scarce assistance.",
      domainId: "domain:proposal:healing",
      categoryIds: ["category:proposal:healing-practices"],
      economicWeight: economicWeight(
        "specialist",
        "Specialist scope is editorial evidence only; threshold and price are unresolved.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: ["Perform the authored wound procedures of Surgery under campaign constraints."],
        methods: [
          "Field preparation, rapid operative judgment, limited tools, and casualty prioritization.",
        ],
        limits: [
          "Does not include every surgical procedure or broad campaign command and logistics.",
        ],
        useGuidance:
          "Use after the separately authored Surgery prerequisite is met; transfer remains a separate edge.",
      }),
      basePrerequisiteEdgeIds: ["relationship:proposal:surgery-prerequisite-campaign"],
      transferEdgeIds: ["relationship:proposal:surgery-transfer-campaign"],
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
  ],
  spokenLanguages: [
    {
      id: "language:proposal:old-serevan",
      kind: "spoken-language",
      name: "Old Serevan",
      description: "A proposal spoken language used in the representative river-valley fixture.",
      domainId: "domain:proposal:language-text",
      categoryIds: ["category:proposal:languages-and-scripts"],
      familyIds: ["language-family:evidence:serevan"],
      economicWeight: economicWeight(
        "ordinary",
        "One spoken-language competence is an ordinary comparison unit only.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: ["Understand and produce ordinary spoken Old Serevan."],
        methods: ["Listening and speech within authored registers and communities."],
        limits: ["Grants no written competence and no automatic competence in related languages."],
        useGuidance:
          "Use for spoken communication; use a written tradition for reading or writing.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
    {
      id: "language:proposal:harbor-serevan",
      kind: "spoken-language",
      name: "Harbor Serevan",
      description:
        "A related proposal spoken language used to prove that family membership is inert.",
      domainId: "domain:proposal:language-text",
      categoryIds: ["category:proposal:languages-and-scripts"],
      familyIds: ["language-family:evidence:serevan"],
      economicWeight: economicWeight(
        "ordinary",
        "One spoken-language competence is an ordinary comparison unit only.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: ["Understand and produce ordinary spoken Harbor Serevan."],
        methods: ["Listening and speech within harbor communities and trade registers."],
        limits: ["Family membership and shared writing signs grant no automatic comprehension."],
        useGuidance: "Use for spoken Harbor Serevan, not Old Serevan or written text by inference.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
  ],
  scripts: [
    {
      id: "script:proposal:temple-hand",
      kind: "script",
      name: "Temple Hand",
      description: "A proposal script identity shared by two written traditions.",
      familyIds: ["script-family:evidence:river-hands"],
      mechanics: "none",
      purchasable: false,
      xpBearing: false,
      metadata: metadata(),
    },
  ],
  writtenTraditions: [
    {
      id: "written-tradition:proposal:old-serevan-temple-hand",
      kind: "written-tradition",
      name: "Old Serevan Temple Hand",
      description:
        "The Old Serevan language as written in Temple Hand with its own conventions and registers.",
      spokenLanguageId: "language:proposal:old-serevan",
      scriptId: "script:proposal:temple-hand",
      domainId: "domain:proposal:language-text",
      categoryIds: ["category:proposal:languages-and-scripts"],
      economicWeight: economicWeight(
        "ordinary",
        "A written tradition is a concrete language-plus-script competence, not a script price.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: ["Read and compose ordinary Old Serevan texts in Temple Hand."],
        methods: [
          "Language-specific signs, spelling, formulae, register, reading, and composition.",
        ],
        limits: [
          "Does not grant Harbor Serevan meaning merely because that tradition shares the script.",
        ],
        useGuidance:
          "Use for Old Serevan texts in Temple Hand only unless an edge is explicitly authored.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
    {
      id: "written-tradition:proposal:harbor-serevan-temple-hand",
      kind: "written-tradition",
      name: "Harbor Serevan Temple Hand",
      description:
        "The Harbor Serevan language as written in the shared Temple Hand script and its own registers.",
      spokenLanguageId: "language:proposal:harbor-serevan",
      scriptId: "script:proposal:temple-hand",
      domainId: "domain:proposal:language-text",
      categoryIds: ["category:proposal:languages-and-scripts"],
      economicWeight: economicWeight(
        "ordinary",
        "A shared script creates no automatic semantic competence or price relation.",
      ),
      taskEnvelope: taskEnvelope({
        coreTasks: ["Read and compose ordinary Harbor Serevan texts in Temple Hand."],
        methods: [
          "Language-specific signs, spelling, formulae, register, reading, and composition.",
        ],
        limits: [
          "Does not grant Old Serevan meaning merely because that tradition shares the script.",
        ],
        useGuidance:
          "Use for Harbor Serevan texts in Temple Hand only unless an edge is explicitly authored.",
      }),
      purchasable: true,
      xpBearing: true,
      metadata: metadata(),
    },
  ],
  families: [
    {
      id: "language-family:evidence:serevan",
      kind: "language-family",
      name: "Serevan Language Family",
      description: "Proposal grouping evidence for related spoken-language identities.",
      memberIds: ["language:proposal:old-serevan", "language:proposal:harbor-serevan"],
      mechanics: "none",
      membershipMeaning: "authoring-only",
      purchasable: false,
      xpBearing: false,
      metadata: metadata("evidence", LANGUAGE_RULING_REFERENCE),
    },
    {
      id: "script-family:evidence:river-hands",
      kind: "script-family",
      name: "River Hands",
      description: "Proposal grouping evidence for scripts with related graphic histories.",
      memberIds: ["script:proposal:temple-hand"],
      mechanics: "none",
      membershipMeaning: "authoring-only",
      purchasable: false,
      xpBearing: false,
      metadata: metadata("evidence", LANGUAGE_RULING_REFERENCE),
    },
  ],
  learningGroups: [
    {
      id: "learning-group:proposal:temple-infirmary-service",
      kind: "learning-group",
      name: "Temple Infirmary Service",
      context: {
        kind: "institution",
        description:
          "Supervised care, record reading, and patient handoff learned during service in one named temple infirmary.",
      },
      fixedCompetencyIds: [
        "skill:proposal:collegiate-medicine",
        "skill:proposal:first-aid",
        "written-tradition:proposal:old-serevan-temple-hand",
      ],
      selectedMemberships: [
        {
          id: "slot:proposal:temple-local-practice",
          label: "One locally taught supporting practice",
          chooseCount: 1,
          candidateCompetencyIds: [
            "skill:proposal:wayfarers-physic",
            "language:proposal:old-serevan",
          ],
        },
      ],
      metadata: metadata(),
    },
    {
      id: "learning-group:proposal:campaign-dressing-crew",
      kind: "learning-group",
      name: "Campaign Dressing Crew",
      context: {
        kind: "campaign",
        description:
          "Urgent stabilization and constrained operative work learned together during one attributed military campaign.",
      },
      fixedCompetencyIds: [
        "skill:proposal:first-aid",
        "skill:proposal:surgery",
        "specialization:proposal:campaign-wound-surgery",
      ],
      selectedMemberships: [],
      metadata: metadata(),
    },
  ],
  relationships: [
    {
      id: "relationship:proposal:medicine-includes-first-aid",
      kind: "inclusion",
      name: "Collegiate Medicine includes First Aid",
      sourceCompetencyId: "skill:proposal:collegiate-medicine",
      targetCompetencyId: "skill:proposal:first-aid",
      direction: "source-to-target",
      reverseEdge: "not-inferred",
      includedCorePercent: 100,
      semantics: "complete-core-task-envelope",
      metadata: metadata("proposal", HEALING_RULING_REFERENCE),
    },
    {
      id: "relationship:proposal:wayfarers-to-collegiate",
      kind: "related",
      name: "Wayfarer's Physic to Collegiate Medicine",
      sourceCompetencyId: "skill:proposal:wayfarers-physic",
      targetCompetencyId: "skill:proposal:collegiate-medicine",
      direction: "source-to-target",
      reverseEdge: "not-inferred",
      effect: "familiarity",
      calibration: "unresolved",
      metadata: metadata(),
    },
    {
      id: "relationship:proposal:collegiate-to-wayfarers",
      kind: "related",
      name: "Collegiate Medicine to Wayfarer's Physic",
      sourceCompetencyId: "skill:proposal:collegiate-medicine",
      targetCompetencyId: "skill:proposal:wayfarers-physic",
      direction: "source-to-target",
      reverseEdge: "not-inferred",
      effect: "learning-advantage",
      calibration: "unresolved",
      metadata: metadata(),
    },
    {
      id: "relationship:proposal:surgery-prerequisite-campaign",
      kind: "prerequisite",
      name: "Surgery prerequisite for Campaign Wound Surgery",
      sourceCompetencyId: "skill:proposal:surgery",
      targetCompetencyId: "specialization:proposal:campaign-wound-surgery",
      direction: "source-to-target",
      reverseEdge: "not-inferred",
      enforcement: "not-implemented",
      threshold: {
        status: "placeholder",
        label: "minimum Surgery competence to be calibrated",
      },
      metadata: metadata(),
    },
    {
      id: "relationship:proposal:surgery-transfer-campaign",
      kind: "related",
      name: "Surgery transfer to Campaign Wound Surgery",
      sourceCompetencyId: "skill:proposal:surgery",
      targetCompetencyId: "specialization:proposal:campaign-wound-surgery",
      direction: "source-to-target",
      reverseEdge: "not-inferred",
      effect: "transfer",
      calibration: "unresolved",
      metadata: metadata(),
    },
  ],
  applicabilityProfiles: [
    {
      id: "applicability-profile:proposal:river-clans",
      kind: "applicability-profile",
      name: "River Clans healing routes",
      developmentStage: "DS2",
      eligibilityEnforcement: "not-implemented",
      defaults: [
        {
          competencyId: "skill:proposal:wayfarers-physic",
          availability: "available",
          note: "The profile normally reproduces this local oral practice.",
        },
        {
          competencyId: "skill:proposal:first-aid",
          availability: "available",
          note: "Households normally teach ordinary stabilization tasks.",
        },
      ],
      accessBandDefaults: [
        {
          accessBand: "AB1",
          routeDescription: "Household and seasonal travel instruction.",
          competencyIds: ["skill:proposal:wayfarers-physic", "skill:proposal:first-aid"],
        },
        {
          accessBand: "AB2",
          routeDescription: "A recognized healer or operative apprenticeship.",
          competencyIds: ["skill:proposal:surgery"],
        },
      ],
      overrides: [
        {
          basis: "teacher",
          attributionId: "teacher:proposal:scarred-operator",
          competencyId: "skill:proposal:surgery",
          availability: "available",
          explanation: "A named traveling operator teaches a distinct narrow surgical tradition.",
        },
      ],
      metadata: metadata(),
    },
    {
      id: "applicability-profile:proposal:serevan-river-city",
      kind: "applicability-profile",
      name: "Serevan River City learning routes",
      developmentStage: "DS6",
      eligibilityEnforcement: "not-implemented",
      defaults: [
        {
          competencyId: "skill:proposal:collegiate-medicine",
          availability: "available",
          note: "A collegiate medical institution is part of this proposal profile.",
        },
        {
          competencyId: "written-tradition:proposal:old-serevan-temple-hand",
          availability: "restricted",
          note: "The written tradition normally requires institutional access.",
        },
      ],
      accessBandDefaults: [
        {
          accessBand: "AB2",
          routeDescription: "Recognized infirmary service and craft apprenticeship.",
          competencyIds: ["skill:proposal:first-aid"],
        },
        {
          accessBand: "AB3",
          routeDescription: "Temple college, archive, and licensed operative training.",
          competencyIds: [
            "skill:proposal:collegiate-medicine",
            "skill:proposal:surgery",
            "written-tradition:proposal:old-serevan-temple-hand",
          ],
        },
      ],
      overrides: [
        {
          basis: "profile",
          attributionId: "profile-trait:proposal:river-city-operative-college",
          competencyId: "specialization:proposal:campaign-wound-surgery",
          availability: "restricted",
          explanation: "This profile unusually retains a campaign operative college.",
        },
        {
          basis: "contact",
          attributionId: "contact:proposal:harbor-scribe",
          competencyId: "written-tradition:proposal:harbor-serevan-temple-hand",
          availability: "available",
          explanation: "A named harbor contact supplies a route outside the profile default.",
        },
        {
          basis: "teacher",
          attributionId: "teacher:proposal:campaign-surgeon",
          competencyId: "specialization:proposal:campaign-wound-surgery",
          availability: "available",
          explanation: "A named teacher supplies specialized training; no competence is granted.",
        },
      ],
      metadata: metadata(),
    },
  ],
};
