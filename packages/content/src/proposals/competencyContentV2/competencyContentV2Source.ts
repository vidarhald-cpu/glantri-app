/**
 * Competency Content V2 — NON-CANONICAL Product Owner proposal (Forgejo #250, umbrella #249).
 *
 * This module is proposal content only. It is deliberately NOT exported from the package
 * entry point, NOT projected into `CanonicalContent`, and NOT reachable from Chargen or any
 * other runtime path. The approved catalogues in `targetProfessions.ts`,
 * `skillContentPlatform/targetLearningGroups.ts` and `skillContentPlatform/fullSkillCatalogueProposal.ts`
 * remain the controlling content until the Product Owner accepts or rejects this proposal.
 *
 * Every identifier used below must resolve against those approved catalogues; the proposal
 * adds no Skill and renames no Skill. It redesigns Learning Groups and Profession curricula,
 * restores first-class `pick N` choice slots, and proposes player-facing category and
 * language corrections.
 */

export const COMPETENCY_CONTENT_V2_SCHEMA_VERSION = "competency-content-v2/proposal" as const;
export const COMPETENCY_CONTENT_V2_STATUS = "non-canonical-product-owner-proposal" as const;

export interface V2SelectionSlot {
  /** Stable slot id, unique inside its Learning Group. */
  id: string;
  label: string;
  /** Number of candidates the learner actually selects. Only this many count toward breadth or cost. */
  chooseCount: number;
  /** Approved base-Skill ids. Unselected candidates grant nothing, cost nothing, add no breadth. */
  candidateSkillIds: readonly string[];
  required: boolean;
}

export type V2GroupDisposition = "retained" | "revised" | "new";

export interface V2LearningGroup {
  id: string;
  name: string;
  shortDescription: string;
  disposition: V2GroupDisposition;
  /** Approved 59-catalogue group ids merged into, or replaced by, this proposed group. */
  supersedes?: readonly string[];
  /** Base Skills every learner of this practice is taught. */
  fixedSkillIds: readonly string[];
  /** Explicit Specializations. Immediate-parent eligibility still applies; never counted as base breadth. */
  specializationIds?: readonly string[];
  selectionSlots?: readonly V2SelectionSlot[];
  note?: string;
}

/** Approved 59-catalogue group ids that this proposal removes outright, with their disposition. */
export interface V2RemovedGroup {
  id: string;
  name: string;
  reason: string;
  /** Proposed group(s) that carry the practice forward. */
  replacedBy: readonly string[];
}

export interface V2Route {
  /** Proposed Learning Group id. */
  groupId: string;
  /** Game-facing route label: how this Profession supplies the practice. */
  route: string;
}

export interface V2PathBody {
  groups?: readonly V2Route[];
  skillIds?: readonly string[];
  specializationIds?: readonly string[];
  /**
   * Game-facing route label covering this body's direct Skill and Specialization opportunities.
   * Required whenever `skillIds` or `specializationIds` is non-empty: a direct competency without a
   * stated route is an unexplained grant, not a training opportunity.
   */
  directRoute?: string;
}

export interface V2Track extends V2PathBody {
  id: string;
  name: string;
}

export interface V2Family extends V2PathBody {
  code: string;
  id: string;
  name: string;
  /**
   * Tracks are mutually exclusive forms of the occupation and are evaluated separately.
   * An empty list means the family has exactly one ordinary valid path.
   */
  tracks?: readonly V2Track[];
  /** Deliberately narrow specialist path; excluded from the "thin package" finding, not from the analysis. */
  narrowByDesign?: boolean;
  note?: string;
}

/* ------------------------------------------------------------------------------------------ */
/* Proposed Learning Group catalogue                                                            */
/* ------------------------------------------------------------------------------------------ */

export const competencyContentV2LearningGroups: readonly V2LearningGroup[] = [
  /* --- Care, remedy and animal practice --------------------------------------------------- */
  {
    id: "G01",
    name: "Patient care",
    shortDescription:
      "Assessment, immediate help and continuing care under an experienced practitioner.",
    disposition: "retained",
    fixedSkillIds: ["skill:first-aid", "skill:medicine", "nursing"],
  },
  {
    id: "G02",
    name: "Plant and remedy preparation",
    shortDescription: "Recognising medicinal material and turning it into dependable preparations.",
    disposition: "retained",
    fixedSkillIds: ["skill:plant-lore", "skill:pharmacy"],
  },
  {
    id: "G18",
    name: "Operative care practice",
    shortDescription: "Deliberate operative instruction with the immediate care that surrounds it.",
    disposition: "retained",
    fixedSkillIds: ["skill:surgery", "skill:first-aid"],
  },
  {
    id: "F29",
    name: "Field surgical apprenticeship",
    shortDescription: "Operative care learned where casualties arrive from fighting.",
    disposition: "retained",
    fixedSkillIds: ["skill:first-aid", "skill:surgery"],
    specializationIds: ["battlefield_surgery"],
  },
  {
    id: "F23",
    name: "Distilling remedy workshop",
    shortDescription: "Preparation and dispensing that depends on a still.",
    disposition: "retained",
    fixedSkillIds: ["skill:pharmacy", "skill:distilling"],
  },
  {
    id: "K14",
    name: "Bedside attendance practice",
    shortDescription:
      "Sustained attendance, observation, reporting and the household conduct it requires.",
    disposition: "new",
    fixedSkillIds: ["nursing", "skill:first-aid", "skill:customs"],
    note: "Answers the previously zero-Skill attendant package without borrowing the physician's curriculum.",
  },
  {
    id: "K15",
    name: "Birth-attendance practice",
    shortDescription:
      "Specialist birth care taught together with the medical grounding it requires.",
    disposition: "new",
    fixedSkillIds: ["skill:medicine", "nursing", "skill:first-aid"],
    specializationIds: ["obstetrics"],
    note: "Implements the approved Medicine -> Obstetrics correction (#231): the immediate parent is now supplied by the same practice.",
  },
  {
    id: "K13",
    name: "Stock medicine practice",
    shortDescription: "Differentiated animal clinical instruction supported by recurring cases.",
    disposition: "new",
    fixedSkillIds: ["skill:veterinary-medicine", "skill:animal-husbandry", "skill:animal-handling"],
  },
  {
    id: "K12",
    name: "Naturalist field study",
    shortDescription:
      "Comparing living things in the field and recording what the comparison shows.",
    disposition: "new",
    fixedSkillIds: ["skill:animal-lore", "skill:plant-lore", "skill:research"],
  },

  /* --- Field, travel and husbandry practice ------------------------------------------------ */
  {
    id: "G03",
    name: "Tracking and hunting practice",
    shortDescription: "Reading sign, approaching quarry unseen and taking it.",
    disposition: "retained",
    fixedSkillIds: ["skill:tracking", "skill:hunting", "skill:stealth", "skill:perception"],
  },
  {
    id: "G04",
    name: "Field travel and camp practice",
    shortDescription: "Moving, routing and living away from settlement.",
    disposition: "retained",
    fixedSkillIds: ["skill:survival", "skill:wayfinding", "skill:weather-lore"],
  },
  {
    id: "G05",
    name: "Mounted travel and animal care",
    shortDescription: "Riding and the daily care the animal needs.",
    disposition: "retained",
    fixedSkillIds: ["skill:animal-handling", "skill:riding"],
  },
  {
    id: "F34",
    name: "Trapline and trail practice",
    shortDescription: "Setting, running and reading a trapline.",
    disposition: "retained",
    fixedSkillIds: ["skill:tracking", "skill:trapping"],
  },
  {
    id: "F05",
    name: "Pastoral stockkeeping apprenticeship",
    shortDescription: "Keeping and moving stock across the season.",
    disposition: "retained",
    fixedSkillIds: ["skill:animal-handling", "skill:animal-husbandry", "herding"],
  },
  {
    id: "F06",
    name: "Draught-team and vehicle practice",
    shortDescription: "Team handling and vehicle control on repeated journeys.",
    disposition: "retained",
    fixedSkillIds: ["skill:animal-handling", "skill:cart-driving"],
  },
  {
    id: "F07",
    name: "Falconry apprenticeship",
    shortDescription: "Training and hunting with a trained bird.",
    disposition: "retained",
    fixedSkillIds: ["skill:animal-handling", "skill:hunting"],
    specializationIds: ["spec:animal-training", "spec:falconry"],
  },
  {
    id: "F08",
    name: "Mixed crop-and-stock household practice",
    shortDescription: "Working a holding that carries both crops and animals.",
    disposition: "retained",
    fixedSkillIds: ["skill:farming", "skill:animal-husbandry"],
  },
  {
    id: "F04",
    name: "Running and athletic field practice",
    shortDescription: "Conditioned movement over distance, height and water.",
    disposition: "revised",
    fixedSkillIds: ["skill:running", "skill:athletics", "skill:swimming", "climb"],
    note: "Revised: Swimming and Climbing added so conditioned movement is taught as one practice.",
  },
  {
    id: "K20",
    name: "Diving and underwater work practice",
    shortDescription: "Working below the surface on a line, and seeing what is down there.",
    disposition: "new",
    fixedSkillIds: ["skill:swimming", "ropework", "skill:perception"],
  },

  /* --- Maritime practice -------------------------------------------------------------------- */
  {
    id: "N01",
    name: "Small-craft boat working",
    shortDescription: "Working an open boat: handling, lines, water and weather.",
    disposition: "new",
    supersedes: ["G06"],
    fixedSkillIds: ["skill:seamanship", "ropework", "skill:swimming", "skill:weather-lore"],
    note: "Replaces the one-Skill group G06 'Working a boat', whose taught practice was never only Seamanship.",
  },
  {
    id: "F09",
    name: "Rigged-vessel deck apprenticeship",
    shortDescription: "Deck and rigging work on a rigged vessel.",
    disposition: "revised",
    fixedSkillIds: ["skill:seamanship", "ropework", "climb", "skill:weather-lore"],
    note: "Revised: aloft work and weather judgement are part of the same taught deck practice.",
  },
  {
    id: "F10",
    name: "Fishing-boat apprenticeship",
    shortDescription: "Working a fishing boat and taking fish from it.",
    disposition: "retained",
    fixedSkillIds: ["skill:seamanship", "skill:fishing"],
  },
  {
    id: "G07",
    name: "Passage navigation",
    shortDescription: "Bringing a vessel along a known passage.",
    disposition: "retained",
    fixedSkillIds: ["skill:dead-reckoning", "skill:wayfinding", "skill:pilotage"],
  },
  {
    id: "F11",
    name: "Charted open-water navigation practice",
    shortDescription: "Open-water navigation by chart and sky.",
    disposition: "retained",
    fixedSkillIds: ["skill:dead-reckoning", "skill:chart-navigation", "skill:celestial-navigation"],
  },

  /* --- Close combat, formation and missile practice (choice slots restored) ------------------ */
  {
    id: "M01",
    name: "Close-combat weapon practice",
    shortDescription: "Guard, defence and one actually taught weapon family.",
    disposition: "new",
    supersedes: ["G08", "F35"],
    fixedSkillIds: ["dodge", "parry", "brawling"],
    selectionSlots: [
      {
        id: "melee-family",
        label: "Choose one taught melee weapon family",
        chooseCount: 1,
        candidateSkillIds: [
          "one_handed_edged",
          "one_handed_concussion_axe",
          "two_handed_edged",
          "two_handed_concussion_axe",
          "polearms",
        ],
        required: true,
      },
    ],
    note:
      "Restores the historical Basic Melee Training choose-one slot and, with it, general 2-h edged access. " +
      "The approved catalogue reached 2-h edged only through F37 on two Soldier tracks.",
  },
  {
    id: "M02",
    name: "Advanced close-combat weapon practice",
    shortDescription: "Sustained instruction across several weapon families.",
    disposition: "new",
    fixedSkillIds: ["dodge", "parry", "brawling", "combat_experience"],
    selectionSlots: [
      {
        id: "advanced-melee-families",
        label: "Choose three taught melee weapon families",
        chooseCount: 3,
        candidateSkillIds: [
          "one_handed_edged",
          "one_handed_concussion_axe",
          "two_handed_edged",
          "two_handed_concussion_axe",
          "polearms",
        ],
        required: true,
      },
    ],
    note:
      "Restores the historical Advanced Melee Training choose-three slot. The recovered import's choose-2 " +
      "reading is recorded as an unresolved source conflict and is not silently adopted.",
  },
  {
    id: "F30",
    name: "Swashbuckling fencing instruction",
    shortDescription: "A named one-handed edged fencing tradition.",
    disposition: "retained",
    fixedSkillIds: ["one_handed_edged", "dodge", "parry"],
    specializationIds: ["fencing"],
    note: "Kept without a slot: the tradition is defined by its weapon, so an alternative family would not be the same practice.",
  },
  {
    id: "M03",
    name: "Formation arms drill",
    shortDescription: "Close-order drill with the arms the formation actually carries.",
    disposition: "new",
    supersedes: ["F31", "F36", "F37"],
    fixedSkillIds: ["dodge", "parry", "brawling", "formation_fighting"],
    selectionSlots: [
      {
        id: "formation-arms",
        label: "Choose two taught formation weapon families",
        chooseCount: 2,
        candidateSkillIds: [
          "one_handed_edged",
          "one_handed_concussion_axe",
          "two_handed_edged",
          "two_handed_concussion_axe",
          "polearms",
          "throwing",
        ],
        required: true,
      },
    ],
    note:
      "Merges the three fixed formation groups. A soldier is charged for the arms actually issued and drilled, " +
      "not for every weapon family the army fields.",
  },
  {
    id: "F32",
    name: "Mounted lance and troop drill",
    shortDescription: "Troop drill from horseback with lance and a sidearm.",
    disposition: "revised",
    fixedSkillIds: [
      "lance",
      "mounted_combat",
      "skill:riding",
      "dodge",
      "parry",
      "brawling",
      "formation_fighting",
    ],
    selectionSlots: [
      {
        id: "mounted-sidearm",
        label: "Choose one taught mounted sidearm family",
        chooseCount: 1,
        candidateSkillIds: ["one_handed_edged", "one_handed_concussion_axe"],
        required: true,
      },
    ],
    note: "Revised: Riding made explicit, and the sidearm becomes a slot instead of a fixed 1-h edged charge.",
  },
  {
    id: "M04",
    name: "Military missile and formation practice",
    shortDescription: "Shooting in formation with the missile arm the unit is issued.",
    disposition: "new",
    supersedes: ["F38", "F39", "F40"],
    fixedSkillIds: ["formation_fighting", "weapon_maintenance", "skill:perception"],
    selectionSlots: [
      {
        id: "missile-family",
        label: "Choose one taught missile weapon family",
        chooseCount: 1,
        candidateSkillIds: ["bow", "crossbow", "skill:firearms", "sling", "throwing"],
        required: true,
      },
    ],
    note: "Restores the historical Basic Missile Training choose-one slot and merges the three one-weapon military ranged groups.",
  },
  {
    id: "M05",
    name: "Advanced missile practice",
    shortDescription: "Sustained instruction across several missile families.",
    disposition: "new",
    fixedSkillIds: ["skill:perception", "weapon_maintenance", "combat_experience"],
    selectionSlots: [
      {
        id: "advanced-missile-families",
        label: "Choose three taught missile weapon families",
        chooseCount: 3,
        candidateSkillIds: ["bow", "crossbow", "skill:firearms", "sling", "throwing"],
        required: true,
      },
    ],
    note: "Restores the historical Advanced Missile Training choose-three slot.",
  },
  {
    id: "F41",
    name: "Longbow hunting apprenticeship",
    shortDescription: "Hunting with the longbow as a taught tradition.",
    disposition: "retained",
    fixedSkillIds: ["bow", "skill:hunting"],
    specializationIds: ["longbow"],
  },
  {
    id: "M06",
    name: "Campaign service experience",
    shortDescription: "What repeated service in the field teaches that drill does not.",
    disposition: "new",
    fixedSkillIds: ["combat_experience", "battlefield_awareness", "skill:survival"],
  },
  {
    id: "F33",
    name: "Concealed field reconnaissance practice",
    shortDescription: "Observing an enemy without being observed.",
    disposition: "retained",
    fixedSkillIds: [
      "skill:military-reconnaissance",
      "skill:perception",
      "skill:stealth",
      "camouflage",
    ],
  },
  {
    id: "G09",
    name: "Unit coordination and command practice",
    shortDescription: "Handling a body of fighters under a responsible commander.",
    disposition: "retained",
    fixedSkillIds: ["tactics", "skill:leadership", "captaincy"],
  },
  {
    id: "M07",
    name: "Campaign staff practice",
    shortDescription: "Planning, supplying and recording a campaign rather than fighting it.",
    disposition: "new",
    fixedSkillIds: [
      "skill:campaign-strategy",
      "skill:military-logistics",
      "tactics",
      "skill:administration",
    ],
  },
  {
    id: "M08",
    name: "Siege works practice",
    shortDescription: "Designing and building the works a siege needs.",
    disposition: "new",
    fixedSkillIds: ["skill:siege-engineering", "skill:architecture", "mechanics"],
    specializationIds: ["spec:fortification"],
  },
  {
    id: "M09",
    name: "Siege engine crew practice",
    shortDescription: "Serving, laying and keeping a siege engine with its crew.",
    disposition: "new",
    fixedSkillIds: [
      "skill:siege-engine-operation",
      "mechanics",
      "formation_fighting",
      "weapon_maintenance",
    ],
  },
  {
    id: "K23",
    name: "Coercive service practice",
    shortDescription: "Applying pressure on behalf of someone who pays for it.",
    disposition: "new",
    fixedSkillIds: ["skill:intimidation", "combat_experience", "skill:underworld"],
  },

  /* --- Craft, workshop and construction practice (choice slots restored) --------------------- */
  {
    id: "C01",
    name: "General artisan apprenticeship",
    shortDescription: "An ordinary workshop apprenticeship in one actually taught craft.",
    disposition: "new",
    fixedSkillIds: ["skill:appraisal", "skill:bargaining"],
    selectionSlots: [
      {
        id: "craft-specialty",
        label: "Choose one taught craft",
        chooseCount: 1,
        candidateSkillIds: [
          "pottery",
          "weaving",
          "skill:fibre-working",
          "leatherworking",
          "carpentry",
          "tailoring",
          "skill:brewing",
          "skill:masonry",
          "skill:smithing",
          "ropework",
          "skill:sailmaking",
        ],
        required: true,
      },
    ],
    note:
      "Restores the historical Craft Specialty choose-one slot. The fixed members are the workshop conduct " +
      "every apprenticeship teaches alongside the craft, not a second craft.",
  },
  {
    id: "C02",
    name: "Master artisan practice",
    shortDescription:
      "Guild- or master-level practice across several crafts, with apprentices of one's own.",
    disposition: "new",
    fixedSkillIds: ["skill:appraisal", "skill:bargaining", "skill:teaching"],
    selectionSlots: [
      {
        id: "advanced-craft-specialties",
        label: "Choose three taught crafts",
        chooseCount: 3,
        candidateSkillIds: [
          "pottery",
          "weaving",
          "skill:fibre-working",
          "leatherworking",
          "carpentry",
          "tailoring",
          "skill:brewing",
          "skill:masonry",
          "skill:smithing",
          "ropework",
          "skill:sailmaking",
        ],
        required: true,
      },
    ],
    note:
      "Restores the Advanced Craft Specialty slot. The approved data's choose-one and its choose-two prose " +
      "disagree; the proposal states choose-three explicitly and flags the conflict for ruling.",
  },
  {
    id: "C03",
    name: "Construction site practice",
    shortDescription:
      "Setting out and running a building site with the trades it actually employs.",
    disposition: "new",
    fixedSkillIds: ["surveying"],
    selectionSlots: [
      {
        id: "construction-specialties",
        label: "Choose two taught construction trades",
        chooseCount: 2,
        candidateSkillIds: ["skill:masonry", "carpentry", "skill:smithing", "mechanics"],
        required: true,
      },
    ],
    note: "Restores the historical Construction Specialty choose-two slot.",
  },
  {
    id: "F02",
    name: "Fibre-to-cloth workshop practice",
    shortDescription: "Turning raw fibre into finished cloth.",
    disposition: "retained",
    fixedSkillIds: ["skill:fibre-working", "weaving"],
  },
  {
    id: "C04",
    name: "Leather and hide workshop",
    shortDescription: "Turning hide into usable material and finished goods.",
    disposition: "new",
    fixedSkillIds: ["leatherworking", "skill:fibre-working", "skill:appraisal"],
  },
  {
    id: "C05",
    name: "Garment workshop practice",
    shortDescription: "Cutting and making up cloth into fitted garments.",
    disposition: "new",
    fixedSkillIds: ["tailoring", "weaving", "skill:appraisal"],
  },
  {
    id: "C09",
    name: "Sail and canvas workshop",
    shortDescription: "Cutting, seaming and roping heavy canvas.",
    disposition: "new",
    fixedSkillIds: ["skill:sailmaking", "skill:fibre-working", "ropework"],
  },
  {
    id: "F03",
    name: "Timber vessel construction",
    shortDescription: "Building a timber hull from frame to finish.",
    disposition: "retained",
    fixedSkillIds: ["carpentry", "skill:shipbuilding"],
  },
  {
    id: "F27",
    name: "Timber millwright apprenticeship",
    shortDescription: "Building and setting up working timber mechanisms.",
    disposition: "retained",
    fixedSkillIds: ["carpentry", "mechanics"],
  },
  {
    id: "F28",
    name: "Building design and site surveying",
    shortDescription: "Designing a building and setting it out on its site.",
    disposition: "retained",
    fixedSkillIds: ["skill:architecture", "surveying"],
  },
  {
    id: "C06",
    name: "Stone workshop and quarry practice",
    shortDescription: "Winning stone and working it to a finished face.",
    disposition: "new",
    fixedSkillIds: ["skill:masonry", "skill:mining", "skill:sculpture"],
  },
  {
    id: "C07",
    name: "Mine and quarry apprenticeship",
    shortDescription: "Working an extraction face and getting in and out of it.",
    disposition: "new",
    fixedSkillIds: ["skill:mining", "climb", "skill:survival"],
  },
  {
    id: "F24",
    name: "Ironmaking and forge apprenticeship",
    shortDescription: "Winning metal from ore and forging it.",
    disposition: "retained",
    fixedSkillIds: ["skill:smelting", "skill:smithing"],
  },
  {
    id: "F25",
    name: "Weapon-forge and servicing apprenticeship",
    shortDescription: "Making and maintaining weapons at the forge.",
    disposition: "retained",
    fixedSkillIds: ["skill:smithing", "weapon_maintenance"],
    specializationIds: ["spec:weaponsmithing"],
  },
  {
    id: "F26",
    name: "Forged-metal armor workshop",
    shortDescription: "Making and fitting forged protective equipment.",
    disposition: "retained",
    fixedSkillIds: ["skill:smithing", "skill:armoring"],
  },
  {
    id: "C13",
    name: "Lock and mechanism workshop",
    shortDescription: "Making, fitting and repairing locks and small mechanisms.",
    disposition: "new",
    fixedSkillIds: ["skill:locksmithing", "mechanics", "skill:smithing"],
  },
  {
    id: "C14",
    name: "Trap and device workshop",
    shortDescription: "Building constructed traps and setting them where they work.",
    disposition: "new",
    fixedSkillIds: ["skill:trapmaking", "mechanics", "skill:trapping"],
  },
  {
    id: "F21",
    name: "Modelled ceramic workshop",
    shortDescription: "Forming, modelling and firing ceramic.",
    disposition: "retained",
    fixedSkillIds: ["pottery", "skill:sculpture"],
  },
  {
    id: "F22",
    name: "Seasonal kitchen and preservation practice",
    shortDescription: "Cooking through the season and keeping what the season gives.",
    disposition: "retained",
    fixedSkillIds: ["skill:cooking"],
    specializationIds: ["spec:food-preservation"],
  },
  {
    id: "C10",
    name: "Brewhouse practice",
    shortDescription: "Running a brewhouse and the kitchen work that goes with it.",
    disposition: "new",
    fixedSkillIds: ["skill:brewing", "skill:cooking"],
    specializationIds: ["spec:food-preservation"],
  },
  {
    id: "C11",
    name: "Vineyard and winemaking practice",
    shortDescription: "Growing the fruit and making the wine from it.",
    disposition: "new",
    fixedSkillIds: ["skill:winemaking", "skill:farming"],
    note:
      "Food Preservation is deliberately NOT attached here: its immediate parent, Cooking, is not part of " +
      "this practice, and an explicit membership must never waive immediate-parent eligibility.",
  },
  {
    id: "C15",
    name: "Alchemical workshop practice",
    shortDescription: "Sustained alchemical operation with the apparatus it needs.",
    disposition: "new",
    fixedSkillIds: ["alchemy", "skill:distilling", "skill:pharmacy"],
  },

  /* --- Records, trade, law and council practice --------------------------------------------- */
  {
    id: "G11",
    name: "Records-office practice",
    shortDescription: "Keeping an establishment's records and accounts.",
    disposition: "retained",
    fixedSkillIds: ["skill:administration", "skill:bookkeeping"],
  },
  {
    id: "G12",
    name: "Trading practice",
    shortDescription: "Buying, selling and judging what a thing is worth.",
    disposition: "retained",
    fixedSkillIds: ["skill:trade", "skill:bargaining", "skill:appraisal"],
  },
  {
    id: "F12",
    name: "Credit-house accounts and obligations",
    shortDescription: "Lending, obligation and the accounts that record them.",
    disposition: "retained",
    fixedSkillIds: ["banking", "skill:bookkeeping"],
  },
  {
    id: "F13",
    name: "Legal study and pleading practice",
    shortDescription: "Learning law and pleading it in its forum.",
    disposition: "retained",
    fixedSkillIds: ["skill:law", "skill:oratory"],
    specializationIds: ["spec:court-advocacy"],
  },
  {
    id: "G10",
    name: "Council and mediation practice",
    shortDescription: "Speaking, reading and settling among people who must go on living together.",
    disposition: "retained",
    fixedSkillIds: ["skill:oratory", "skill:insight", "skill:customs", "skill:bargaining"],
  },
  {
    id: "K11",
    name: "Court service practice",
    shortDescription: "Serving in a court and knowing how it is actually organised.",
    disposition: "new",
    fixedSkillIds: ["skill:customs", "skill:politics", "heraldry"],
    specializationIds: ["spec:courtly-protocol", "spec:court-administration"],
  },
  {
    id: "K10",
    name: "Heraldic office practice",
    shortDescription: "Arms, descent and the ceremony that uses them.",
    disposition: "new",
    fixedSkillIds: ["heraldry", "skill:customs", "history"],
    specializationIds: ["spec:courtly-protocol"],
    note:
      "Closes the recorded Herald parent-access gaps: History (parent of Genealogy) and Customs " +
      "(parent of Courtly Protocol) are now supplied inside the Herald's own envelope.",
  },
  {
    id: "K21",
    name: "Applied calculation practice",
    shortDescription: "Calculation put to work on accounts, measures and ground.",
    disposition: "new",
    fixedSkillIds: ["mathematics", "skill:bookkeeping", "surveying"],
  },

  /* --- Covert, street and gaming practice ---------------------------------------------------- */
  {
    id: "G14",
    name: "Local contacts and information gathering",
    shortDescription: "Knowing who to ask and reading the answer.",
    disposition: "retained",
    fixedSkillIds: ["skill:streetwise", "skill:insight"],
  },
  {
    id: "G15",
    name: "Covert entry practice",
    shortDescription: "Getting in unnoticed and past what is locked.",
    disposition: "retained",
    fixedSkillIds: ["skill:stealth", "skill:perception", "skill:lockpicking"],
  },
  {
    id: "G16",
    name: "Impersonation and distraction practice",
    shortDescription: "Appearing to be someone else and keeping the account standing up.",
    disposition: "retained",
    fixedSkillIds: ["skill:deception", "skill:disguise"],
  },
  {
    id: "G17",
    name: "Interview and evidence practice",
    shortDescription: "Questioning people and testing what they say against the evidence.",
    disposition: "retained",
    fixedSkillIds: ["skill:research", "skill:insight", "skill:perception", "skill:interrogation"],
  },
  {
    id: "K18",
    name: "Underworld association practice",
    shortDescription: "Moving inside an illicit milieu without being handed over.",
    disposition: "new",
    fixedSkillIds: ["skill:underworld", "skill:streetwise", "conceal_object"],
  },
  {
    id: "K17",
    name: "Gaming-house practice",
    shortDescription: "The games, the odds, the players and the hands.",
    disposition: "new",
    fixedSkillIds: ["gambling", "skill:insight", "skill:sleight-of-hand"],
  },
  {
    id: "K16",
    name: "Documentary hand practice",
    shortDescription: "Reproducing a documentary hand convincingly enough to pass.",
    disposition: "new",
    fixedSkillIds: ["skill:document-forgery", "skill:palaeography-decipherment", "skill:appraisal"],
  },

  /* --- Learned, religious and performing practice -------------------------------------------- */
  {
    id: "K01",
    name: "Scholarly study practice",
    shortDescription: "Finding, holding and checking what is already known.",
    disposition: "new",
    fixedSkillIds: ["skill:research", "skill:mnemonics", "mathematics"],
  },
  {
    id: "K02",
    name: "Natural philosophy practice",
    shortDescription: "Arguing about what the world is, against what can be observed of it.",
    disposition: "new",
    fixedSkillIds: ["philosophy", "skill:research", "astronomy"],
  },
  {
    id: "K03",
    name: "Celestial observation practice",
    shortDescription: "Watching the sky methodically and calculating from it.",
    disposition: "new",
    fixedSkillIds: ["astronomy", "mathematics", "skill:weather-lore"],
  },
  {
    id: "K04",
    name: "Astrological reading practice",
    shortDescription: "Reading the sky for people, in a tradition that says how.",
    disposition: "new",
    fixedSkillIds: ["astrology", "astronomy", "skill:customs"],
    specializationIds: ["spec:omen-reading"],
  },
  {
    id: "K05",
    name: "Divinatory practice",
    shortDescription: "A maintained and reproducibly taught method of divination.",
    disposition: "new",
    fixedSkillIds: ["divination", "skill:religion"],
    specializationIds: ["spec:omen-reading"],
  },
  {
    id: "K06",
    name: "Religious service practice",
    shortDescription: "Serving a religion in front of the people who practise it.",
    disposition: "new",
    fixedSkillIds: ["skill:religion", "skill:customs", "skill:oratory"],
    specializationIds: ["spec:theology"],
  },
  {
    id: "K07",
    name: "Instruction and schooling practice",
    shortDescription: "Teaching deliberately, and being corrected on the teaching.",
    disposition: "new",
    fixedSkillIds: ["skill:teaching", "skill:mnemonics", "skill:oratory"],
  },
  {
    id: "K08",
    name: "Interpreting and language mediation practice",
    shortDescription: "Standing between two parties who do not share a language.",
    disposition: "new",
    fixedSkillIds: ["skill:translation-interpretation", "skill:customs", "skill:insight"],
    note:
      "The actual spoken languages remain separate contextual competencies. This group teaches the " +
      "mediation practice, never a language.",
  },
  {
    id: "K09",
    name: "Chorographic and geographic study",
    shortDescription: "Assembling what is known about places and setting it down.",
    disposition: "new",
    fixedSkillIds: ["skill:geography", "skill:cartography", "skill:research"],
  },
  {
    id: "F01",
    name: "Field surveying and map production",
    shortDescription: "Measuring ground and producing a map from the measurement.",
    disposition: "retained",
    fixedSkillIds: ["surveying", "skill:cartography"],
  },
  {
    id: "F14",
    name: "Speech and memory practice",
    shortDescription: "Composing and delivering from memory.",
    disposition: "retained",
    fixedSkillIds: ["skill:oratory", "skill:mnemonics"],
  },
  {
    id: "F15",
    name: "Historical text investigation",
    shortDescription: "Reading older hands and arguing from what they say.",
    disposition: "retained",
    fixedSkillIds: ["skill:research", "skill:palaeography-decipherment"],
  },
  {
    id: "F16",
    name: "Lineage investigation apprenticeship",
    shortDescription: "Establishing descent from the evidence that survives.",
    disposition: "retained",
    fixedSkillIds: ["skill:research"],
    specializationIds: ["spec:genealogy"],
  },
  {
    id: "F17",
    name: "Self-accompanied song practice",
    shortDescription: "Singing to one's own accompaniment.",
    disposition: "retained",
    fixedSkillIds: ["music", "singing"],
  },
  {
    id: "F18",
    name: "Dramatic acting and dance practice",
    shortDescription: "Playing a part and moving to time in front of an audience.",
    disposition: "retained",
    fixedSkillIds: ["acting", "dancing"],
  },
  {
    id: "F19",
    name: "Oral narrative composition and performance",
    shortDescription: "Composing and telling at length.",
    disposition: "retained",
    fixedSkillIds: ["storytelling", "skill:poetry-literary-composition"],
  },
  {
    id: "F20",
    name: "Drawing and modelling workshop",
    shortDescription: "Drawing, painting and modelling under correction.",
    disposition: "retained",
    fixedSkillIds: ["skill:visual-art", "skill:sculpture"],
  },
];

/** Approved 59-catalogue groups this proposal removes, and where their practice goes. */
export const competencyContentV2RemovedGroups: readonly V2RemovedGroup[] = [
  {
    id: "G06",
    name: "Working a boat",
    reason: "A one-Skill group that did not describe the practice actually taught in an open boat.",
    replacedBy: ["N01"],
  },
  {
    id: "G08",
    name: "One-handed edged close-combat practice",
    reason: "A fixed single weapon family where the taught family varies by teacher and tradition.",
    replacedBy: ["M01"],
  },
  {
    id: "G13",
    name: "Metalworking apprenticeship",
    reason: "A one-Skill group fully covered by the forge groups and the artisan choice slots.",
    replacedBy: ["F24", "F25", "F26", "C01", "C02"],
  },
  {
    id: "F31",
    name: "Spear, sidearm and throwing formation drill",
    reason:
      "One fixed arms combination among several; charging for all of them overstated the curriculum.",
    replacedBy: ["M03"],
  },
  {
    id: "F35",
    name: "Guard and rough-fighting drill",
    reason:
      "A fixed 1-h concussion/axe drill that is one selection of the same close-combat practice.",
    replacedBy: ["M01"],
  },
  {
    id: "F36",
    name: "One-handed arms and formation drill",
    reason: "A fixed two-family formation drill now expressed as a choice slot.",
    replacedBy: ["M03"],
  },
  {
    id: "F37",
    name: "Two-handed military weapon practice",
    reason:
      "The only approved route to 2-h edged, reachable on two Soldier tracks only. The slot restores general access.",
    replacedBy: ["M01", "M02", "M03"],
  },
  {
    id: "F38",
    name: "Military bow and formation practice",
    reason: "One issued missile arm among several.",
    replacedBy: ["M04"],
  },
  {
    id: "F39",
    name: "Military crossbow and formation practice",
    reason: "One issued missile arm among several.",
    replacedBy: ["M04"],
  },
  {
    id: "F40",
    name: "Military firearms and formation practice",
    reason: "One issued missile arm among several.",
    replacedBy: ["M04"],
  },
];

/* ------------------------------------------------------------------------------------------ */
/* Proposed Profession catalogue — all 84 families                                              */
/* ------------------------------------------------------------------------------------------ */

export const competencyContentV2Families: readonly V2Family[] = [
  {
    code: "P01",
    id: "profession:hunter-trapper",
    name: "Hunter and Trapper",
    groups: [
      { groupId: "G03", route: "Ordinary hunting apprenticeship" },
      { groupId: "F34", route: "Trapline service" },
      { groupId: "G04", route: "Season away from settlement" },
      { groupId: "F41", route: "Longbow hunting tradition" },
    ],
    directRoute: "Taught directly by the hunter one works beside",
    skillIds: ["skill:animal-lore"],
  },
  {
    code: "P02",
    id: "profession:wild-plant-gatherer",
    name: "Wild Plant Gatherer",
    groups: [
      { groupId: "G04", route: "Seasonal collecting rounds" },
      { groupId: "G02", route: "Supplying and preparing for a remedy maker" },
      { groupId: "G12", route: "Selling the season's collection" },
    ],
    directRoute: "Taught directly on the collecting rounds",
    skillIds: ["climb", "skill:animal-lore"],
  },
  {
    code: "P03",
    id: "profession:field-guide",
    name: "Field and Caravan Guide",
    groups: [
      { groupId: "G04", route: "Ordinary guiding service" },
      { groupId: "G05", route: "Mounted route service" },
      { groupId: "F06", route: "Caravan vehicle service" },
      { groupId: "M01", route: "Escort self-defence instruction" },
    ],
    directRoute: "Taught directly by the guide one travels with",
    skillIds: ["skill:geography"],
  },
  {
    code: "P04",
    id: "profession:fisher",
    name: "Fisher",
    groups: [
      { groupId: "F10", route: "Ordinary fishing-boat apprenticeship" },
      { groupId: "N01", route: "Working the family boat" },
      { groupId: "G12", route: "Selling the catch" },
    ],
    directRoute: "Taught directly aboard and on the shore",
    skillIds: ["skill:survival", "skill:animal-lore"],
  },
  {
    code: "P05",
    id: "profession:farmer",
    name: "Farmer",
    groups: [
      { groupId: "F08", route: "Ordinary holding apprenticeship" },
      { groupId: "F05", route: "Keeping the holding's stock" },
      { groupId: "F06", route: "Carting to market" },
      { groupId: "F22", route: "Household kitchen and storing the season" },
    ],
    directRoute: "Taught directly in the working year of the holding",
    skillIds: ["skill:weather-lore", "skill:plant-lore", "skill:appraisal", "skill:bargaining"],
  },
  {
    code: "P06",
    id: "profession:herd-keeper",
    name: "Herd Keeper",
    groups: [
      { groupId: "F05", route: "Ordinary stockkeeping apprenticeship" },
      { groupId: "G05", route: "Mounted herding service" },
      { groupId: "G04", route: "Seasonal movement with the herd" },
      { groupId: "F02", route: "Household fibre and cloth work from the clip" },
    ],
    directRoute: "Taught directly by the herd owner and the older keepers",
    skillIds: ["sling", "skill:animal-lore"],
    specializationIds: ["spec:steppe-remount-training"],
  },
  {
    code: "P07",
    id: "profession:animal-trainer",
    name: "Animal Trainer and Falconer",
    groups: [
      { groupId: "F07", route: "Falconry apprenticeship" },
      { groupId: "F05", route: "Keeping the animals in condition" },
      { groupId: "G05", route: "Mounted work with trained animals" },
      { groupId: "K13", route: "Treating the animals in one's charge" },
      { groupId: "G03", route: "Hunting with what one has trained" },
    ],
    directRoute: "Taught directly in the mews and the yard",
    skillIds: ["skill:animal-lore"],
  },
  {
    code: "P08",
    id: "profession:driver",
    name: "Driver and Teamster",
    groups: [
      { groupId: "F06", route: "Ordinary driving apprenticeship" },
      { groupId: "G04", route: "Long-distance caravan service" },
      { groupId: "G05", route: "Riding with the team" },
      { groupId: "G12", route: "Carrying goods on one's own account" },
    ],
    directRoute: "Taught directly on the road and in the yard",
    skillIds: ["carpentry"],
  },
  {
    code: "P09",
    id: "profession:sailor",
    name: "Sailor and Boat Worker",
    groups: [{ groupId: "M01", route: "Rough shipboard fighting instruction" }],
    directRoute: "Taught directly by the crew one sails with",
    skillIds: ["climb", "skill:perception", "skill:swimming"],
    tracks: [
      {
        id: "profession:sailor:small-craft",
        name: "Small-craft boat worker",
        groups: [{ groupId: "N01", route: "Working a boat" }],
      },
      {
        id: "profession:sailor:rigged-vessel",
        name: "Rigged-vessel deck hand",
        groups: [{ groupId: "F09", route: "Rigged-vessel deck apprenticeship" }],
      },
    ],
    note: "The two deck practices remain alternatives, as recorded for the approved catalogue's Sailor exclusion pair.",
  },
  {
    code: "P10",
    id: "profession:navigator-pilot",
    name: "Navigator and Pilot",
    groups: [
      { groupId: "G07", route: "Entrusted coastal passage work" },
      { groupId: "F11", route: "Charted open-water instruction" },
      { groupId: "N01", route: "Deck grounding before navigation" },
    ],
    directRoute: "Taught directly by the pilot one serves under",
    skillIds: ["skill:cartography", "mathematics", "skill:geography"],
  },
  {
    code: "P11",
    id: "profession:shipmaster",
    name: "Shipmaster",
    groups: [
      { groupId: "F09", route: "Deck service before command" },
      { groupId: "G07", route: "Responsibility for the passage" },
      { groupId: "G12", route: "Trading the voyage" },
    ],
    directRoute: "Taught directly by the master one serves under",
    skillIds: ["skill:leadership", "skill:bookkeeping"],
  },
  {
    code: "P12",
    id: "profession:courier",
    name: "Courier and Messenger",
    groups: [
      { groupId: "F04", route: "Conditioning for the road" },
      { groupId: "G05", route: "Mounted stage service" },
      { groupId: "G04", route: "Carrying across open country" },
    ],
    directRoute: "Taught directly by the stage or household one carries for",
    skillIds: ["skill:geography", "skill:customs"],
  },
  {
    code: "P13",
    id: "profession:trader",
    name: "Trader and Merchant",
    groups: [
      { groupId: "G12", route: "Ordinary trading apprenticeship" },
      { groupId: "G11", route: "Keeping the house's records" },
      { groupId: "G04", route: "Travelling the route personally" },
      { groupId: "F06", route: "Moving one's own goods" },
    ],
    directRoute: "Taught directly in the counting house and on the road",
    skillIds: ["skill:customs", "mathematics"],
  },
  {
    code: "P14",
    id: "profession:guard-escort",
    name: "Guard, Watcher and Escort",
    groups: [{ groupId: "G04", route: "Escort duty away from the town" }],
    directRoute: "Taught directly on watch and on escort",
    skillIds: ["skill:perception", "skill:streetwise", "skill:intimidation", "combat_experience"],
    tracks: [
      {
        id: "profession:guard-escort:rough-fighting",
        name: "Rough-fighting guard",
        groups: [{ groupId: "M01", route: "Guard and rough-fighting drill" }],
      },
      {
        id: "profession:guard-escort:fencing",
        name: "Fencing-trained escort",
        groups: [{ groupId: "F30", route: "Swashbuckling fencing instruction" }],
      },
    ],
    note: "Preserves the approved catalogue's Guard exclusion pair as two explicitly separate valid paths.",
  },
  {
    code: "P15",
    id: "profession:enforcer",
    name: "Enforcer",
    groups: [
      { groupId: "K23", route: "Ordinary coercive service" },
      { groupId: "M01", route: "Rough-fighting instruction" },
      { groupId: "G14", route: "Knowing the district one works" },
    ],
    directRoute: "Taught directly by the enterprise one works for",
    skillIds: ["skill:perception", "conceal_object"],
  },
  {
    code: "P16",
    id: "profession:local-informant",
    name: "Local Informant",
    groups: [
      { groupId: "G14", route: "Ordinary informant practice" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
      { groupId: "G16", route: "Passing unremarked where one does not belong" },
    ],
    directRoute: "Taught directly through the district one works",
    skillIds: ["skill:perception", "skill:customs", "skill:mnemonics", "skill:bargaining"],
  },
  {
    code: "P17",
    id: "profession:investigator",
    name: "Investigator and Intelligence Agent",
    groups: [
      { groupId: "G17", route: "Entrusted inquiry apprenticeship" },
      { groupId: "G14", route: "Working local contacts" },
      { groupId: "G16", route: "Approach under another identity" },
    ],
    directRoute: "Taught directly by the mentor conducting the inquiry",
    skillIds: ["skill:stealth", "skill:law", "skill:mnemonics"],
  },
  {
    code: "P18",
    id: "profession:thief",
    name: "Thief",
    groups: [
      { groupId: "G15", route: "Ordinary covert-entry instruction" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
    ],
    directRoute: "Taught directly by an established thief",
    skillIds: ["skill:sleight-of-hand", "climb", "skill:appraisal", "skill:disguise"],
    specializationIds: ["spec:pickpocketing"],
  },
  {
    code: "P19",
    id: "profession:confidence-trickster",
    name: "Confidence Trickster",
    groups: [
      { groupId: "G16", route: "Ordinary impersonation practice" },
      { groupId: "G14", route: "Finding the mark" },
      { groupId: "K17", route: "Working the gaming tables" },
    ],
    directRoute: "Taught directly by the trickster one works with",
    skillIds: ["skill:customs", "skill:oratory", "skill:appraisal", "skill:bargaining"],
  },
  {
    code: "P20",
    id: "profession:smuggler",
    name: "Smuggler and Illicit Trader",
    groups: [
      { groupId: "G12", route: "Trading what is carried" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
      { groupId: "N01", route: "Running the boat oneself" },
      { groupId: "G04", route: "Overland crossing away from the road" },
    ],
  },
  {
    code: "P21",
    id: "profession:forger",
    name: "Document Forger",
    groups: [
      { groupId: "K16", route: "Ordinary forging apprenticeship" },
      { groupId: "G11", route: "Service inside a records office" },
      { groupId: "F15", route: "Study of older hands" },
      { groupId: "K18", route: "Placing the work through an illicit milieu" },
    ],
    directRoute: "Taught directly by the forger one trains under",
    skillIds: ["skill:visual-art", "skill:customs"],
  },
  {
    code: "P22",
    id: "profession:soldier",
    name: "Soldier",
    groups: [
      { groupId: "M06", route: "Repeated service in the field" },
      { groupId: "G04", route: "Marching and camping with the force" },
    ],
    directRoute: "Taught directly in drill and on the march",
    skillIds: ["skill:athletics"],
    tracks: [
      {
        id: "profession:soldier:communal-contingent",
        name: "Communal/household contingent",
        groups: [{ groupId: "M01", route: "Contingent fighting drill" }],
      },
      {
        id: "profession:soldier:formation-soldier",
        name: "Close-order formation soldier",
        groups: [{ groupId: "M03", route: "Formation arms drill" }],
      },
      {
        id: "profession:soldier:missile-soldier",
        name: "Missile soldier",
        groups: [{ groupId: "M04", route: "Issued missile arm and formation drill" }],
      },
      {
        id: "profession:soldier:longbow-specialist",
        name: "Military longbow specialist",
        groups: [
          { groupId: "M04", route: "Issued missile arm and formation drill" },
          { groupId: "F41", route: "Longbow tradition brought into service" },
        ],
      },
    ],
    note:
      "Nine fixed-weapon tracks collapse to four. Weapon family is now a choice inside the drill, which is " +
      "what the historical Basic/Advanced Melee and Missile slots described.",
  },
  {
    code: "P23",
    id: "profession:mounted-soldier",
    name: "Mounted Soldier and Lancer",
    groups: [
      { groupId: "F32", route: "Mounted troop drill" },
      { groupId: "M06", route: "Repeated service in the field" },
    ],
    directRoute: "Taught directly in the troop lines",
    skillIds: ["skill:animal-handling", "skill:animal-husbandry"],
  },
  {
    code: "P24",
    id: "profession:military-scout",
    name: "Military Scout",
    groups: [
      { groupId: "F33", route: "Reconnaissance instruction" },
      { groupId: "G04", route: "Working alone forward of the force" },
      { groupId: "M01", route: "Fighting instruction for a scout" },
    ],
    directRoute: "Taught directly by the scouts one serves with",
    skillIds: ["battlefield_awareness", "skill:tracking"],
    tracks: [
      { id: "profession:military-scout:foot", name: "Foot military scout" },
      {
        id: "profession:military-scout:mounted",
        name: "Mounted military scout",
        groups: [{ groupId: "G05", route: "Mounted reconnaissance service" }],
      },
    ],
  },
  {
    code: "P25",
    id: "profession:military-commander",
    name: "Military Commander",
    groups: [
      { groupId: "G09", route: "Mentored unit command" },
      { groupId: "M06", route: "Repeated service in the field" },
    ],
    directRoute: "Taught directly by the commander one serves under",
    skillIds: ["skill:oratory"],
    specializationIds: ["spec:siege-operations"],
    tracks: [
      {
        id: "profession:military-commander:foot",
        name: "Foot field commander",
        groups: [{ groupId: "M03", route: "Formation arms drill with the command" }],
      },
      {
        id: "profession:military-commander:mounted",
        name: "Mounted field commander",
        groups: [{ groupId: "F32", route: "Mounted troop drill with the command" }],
      },
      {
        id: "profession:military-commander:communal",
        name: "Communal-force commander",
        groups: [{ groupId: "M01", route: "Contingent fighting drill" }],
      },
    ],
  },
  {
    code: "P26",
    id: "profession:military-quartermaster",
    name: "Military Quartermaster",
    groups: [
      { groupId: "G11", route: "Supply-office records" },
      { groupId: "M07", route: "Campaign staff service" },
      { groupId: "F06", route: "Moving the force's supplies" },
    ],
    directRoute: "Taught directly in the supply office",
    skillIds: ["mathematics"],
    tracks: [
      {
        id: "profession:military-quartermaster:supply-office",
        name: "Supply-office quartermaster",
        groups: [{ groupId: "G12", route: "Buying for the force" }],
      },
      {
        id: "profession:military-quartermaster:fighting-service",
        name: "Fighting-service quartermaster",
        groups: [{ groupId: "M01", route: "Fighting drill alongside supply duties" }],
      },
    ],
  },
  {
    code: "P27",
    id: "profession:campaign-planner",
    name: "Campaign Planner",
    groups: [
      { groupId: "G09", route: "Service beside a commander" },
      { groupId: "M07", route: "Ordinary campaign staff service" },
      { groupId: "K09", route: "Studying the theatre" },
    ],
    directRoute: "Taught directly on the staff one serves",
    skillIds: ["skill:politics", "mathematics", "skill:mnemonics"],
  },
  {
    code: "P28",
    id: "profession:siege-engineer",
    name: "Siege Engineer",
    groups: [
      { groupId: "M08", route: "Ordinary siege-works apprenticeship" },
      { groupId: "F28", route: "Design and setting out" },
      { groupId: "F27", route: "Timber mechanism construction" },
      { groupId: "C03", route: "Running the trades on the works" },
      { groupId: "M06", route: "Repeated service with a besieging force" },
    ],
    directRoute: "Taught directly on the works",
    skillIds: ["mathematics", "skill:siege-engine-operation"],
  },
  {
    code: "P29",
    id: "profession:siege-engine-crew",
    name: "Siege Engine Crew Specialist",
    groups: [
      { groupId: "M09", route: "Ordinary engine-crew instruction" },
      { groupId: "M04", route: "Serving in the missile line" },
      { groupId: "M06", route: "Repeated service in the field" },
    ],
    directRoute: "Taught directly by the engine crew",
    skillIds: ["carpentry", "ropework"],
  },
  {
    code: "P30",
    id: "profession:physician",
    name: "Physician",
    groups: [
      { groupId: "G01", route: "Ordinary clinical apprenticeship" },
      { groupId: "G02", route: "Preparing what one prescribes" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the practitioner one attends",
    skillIds: ["skill:customs", "skill:teaching"],
    specializationIds: ["spec:diagnostic-medicine", "poison_treatment", "bone_setting"],
  },
  {
    code: "P31",
    id: "profession:surgeon",
    name: "Surgeon",
    groups: [
      { groupId: "G01", route: "Clinical grounding" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the operator one assists",
    skillIds: ["skill:pharmacy", "skill:teaching", "skill:plant-lore"],
    tracks: [
      {
        id: "profession:surgeon:civil",
        name: "Civil operative surgeon",
        groups: [{ groupId: "G18", route: "Operative care practice" }],
      },
      {
        id: "profession:surgeon:field",
        name: "Field surgeon",
        groups: [
          { groupId: "F29", route: "Field surgical apprenticeship" },
          { groupId: "M06", route: "Repeated service with a force" },
        ],
      },
    ],
  },
  {
    code: "P32",
    id: "profession:nurse",
    name: "Nurse and Patient Attendant",
    groups: [
      { groupId: "K14", route: "Ordinary attendance apprenticeship" },
      { groupId: "G01", route: "Attendance under a practitioner" },
      { groupId: "G02", route: "Preparing what the patient is given" },
      { groupId: "F22", route: "Feeding the sick household" },
    ],
    directRoute: "Taught directly at the bedside",
    skillIds: ["skill:insight", "skill:teaching", "skill:mnemonics"],
  },
  {
    code: "P33",
    id: "profession:birth-attendant",
    name: "Birth Attendant and Midwife",
    groups: [
      { groupId: "K15", route: "Ordinary birth-attendance apprenticeship" },
      { groupId: "G02", route: "Preparing remedies for mother and child" },
      { groupId: "K14", route: "Continuing attendance after the birth" },
    ],
    directRoute: "Taught directly by the attendant one accompanies",
    skillIds: ["skill:insight", "skill:teaching", "skill:religion", "skill:mnemonics"],
    note:
      "Closes the approved catalogue's only zero-base-Skill package and applies the approved " +
      "Medicine -> Obstetrics correction (#231) by supplying the immediate parent inside the same practice.",
  },
  {
    code: "P34",
    id: "profession:veterinary-practitioner",
    name: "Veterinary Practitioner",
    groups: [
      { groupId: "K13", route: "Ordinary stock-medicine apprenticeship" },
      { groupId: "G02", route: "Preparing animal remedies" },
      { groupId: "F05", route: "Working among kept stock" },
    ],
    directRoute: "Taught directly among the stock one treats",
    skillIds: ["skill:animal-lore", "skill:first-aid", "skill:riding", "skill:appraisal"],
  },
  {
    code: "P35",
    id: "profession:remedy-maker",
    name: "Herbalist and Remedy Maker",
    groups: [
      { groupId: "G02", route: "Ordinary plant-remedy apprenticeship" },
      { groupId: "F23", route: "Still-room practice" },
      { groupId: "K12", route: "Comparing what is collected" },
    ],
    directRoute: "Taught directly in the remedy maker's shop",
    skillIds: [
      "skill:first-aid",
      "skill:appraisal",
      "skill:bargaining",
      "skill:customs",
      "skill:survival",
    ],
  },
  {
    code: "P36",
    id: "profession:smith",
    name: "Smith and Weaponsmith",
    groups: [
      { groupId: "F24", route: "Ironmaking and forge apprenticeship" },
      { groupId: "F25", route: "Weapon-forge and servicing apprenticeship" },
      { groupId: "F26", route: "Armor workshop practice" },
      { groupId: "C02", route: "Master's shop with apprentices" },
    ],
    directRoute: "Taught directly at the forge",
    skillIds: ["mechanics"],
  },
  {
    code: "P37",
    id: "profession:smelter",
    name: "Smelter",
    groups: [
      { groupId: "F24", route: "Ordinary furnace apprenticeship" },
      { groupId: "C07", route: "Working with the extraction face" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the furnace",
    skillIds: ["mechanics", "skill:trade"],
  },
  {
    code: "P38",
    id: "profession:armorer",
    name: "Armorer",
    groups: [
      { groupId: "F26", route: "Ordinary armor workshop apprenticeship" },
      { groupId: "F25", route: "Weapon-forge and servicing work" },
      { groupId: "C04", route: "Hide and strap work for fittings" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the armor shop",
    skillIds: ["mechanics", "skill:trade"],
  },
  {
    code: "P39",
    id: "profession:carpenter",
    name: "Carpenter",
    groups: [
      { groupId: "F27", route: "Ordinary timber apprenticeship" },
      { groupId: "C03", route: "Working on building sites" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the timber shop",
    skillIds: ["ropework", "skill:teaching", "skill:trade"],
  },
  {
    code: "P40",
    id: "profession:shipbuilder",
    name: "Shipbuilder",
    groups: [
      { groupId: "F03", route: "Ordinary yard apprenticeship" },
      { groupId: "F27", route: "Timber mechanism work in the yard" },
      { groupId: "C03", route: "Setting out and running the yard" },
    ],
    directRoute: "Taught directly in the yard",
    skillIds: ["ropework", "skill:sailmaking", "skill:appraisal", "skill:teaching"],
  },
  {
    code: "P41",
    id: "profession:sailmaker",
    name: "Sailmaker",
    groups: [
      { groupId: "C09", route: "Ordinary sail-loft apprenticeship" },
      { groupId: "F02", route: "Cloth work behind the canvas" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the sail loft",
    skillIds: ["skill:seamanship", "tailoring", "skill:trade"],
  },
  {
    code: "P42",
    id: "profession:spinner-weaver",
    name: "Spinner and Weaver",
    groups: [
      { groupId: "F02", route: "Ordinary fibre-to-cloth apprenticeship" },
      { groupId: "C05", route: "Making up what is woven" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the wheel and the loom",
    skillIds: ["ropework", "skill:trade", "skill:teaching", "skill:plant-lore"],
    specializationIds: ["spec:cordage-ropemaking"],
  },
  {
    code: "P43",
    id: "profession:tailor",
    name: "Tailor",
    groups: [
      { groupId: "C05", route: "Ordinary garment apprenticeship" },
      { groupId: "F02", route: "Cloth work behind the garment" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the cutting shop",
    skillIds: ["leatherworking", "skill:trade", "skill:customs", "skill:teaching"],
  },
  {
    code: "P44",
    id: "profession:leatherworker",
    name: "Leatherworker",
    groups: [
      { groupId: "C04", route: "Ordinary leather apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the bench",
    skillIds: [
      "tailoring",
      "skill:animal-husbandry",
      "skill:trade",
      "skill:teaching",
      "skill:armoring",
    ],
  },
  {
    code: "P45",
    id: "profession:potter",
    name: "Potter",
    groups: [
      { groupId: "F21", route: "Ordinary ceramic apprenticeship" },
      { groupId: "C06", route: "Winning and preparing the material" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the wheel and the kiln",
    skillIds: ["skill:visual-art", "skill:trade", "skill:teaching"],
  },
  {
    code: "P46",
    id: "profession:mason",
    name: "Mason",
    groups: [
      { groupId: "C06", route: "Ordinary stone apprenticeship" },
      { groupId: "C03", route: "Running the trades on site" },
      { groupId: "F28", route: "Setting out a building" },
    ],
    directRoute: "Taught directly on the site and at the banker",
    skillIds: ["skill:appraisal", "skill:teaching", "mechanics"],
  },
  {
    code: "P47",
    id: "profession:miner",
    name: "Miner and Quarry Worker",
    groups: [
      { groupId: "C07", route: "Ordinary extraction apprenticeship" },
      { groupId: "C06", route: "Dressing what is won" },
      { groupId: "F24", route: "Feeding the furnace" },
    ],
    directRoute: "Taught directly at the face",
    skillIds: ["mechanics", "skill:appraisal", "ropework"],
  },
  {
    code: "P48",
    id: "profession:millwright",
    name: "Millwright and Mechanician",
    groups: [
      { groupId: "F27", route: "Ordinary millwright apprenticeship" },
      { groupId: "C03", route: "Installing on site" },
    ],
    directRoute: "Taught directly at the mill and on installation",
    skillIds: ["skill:smithing", "mathematics", "skill:architecture", "ropework", "skill:teaching"],
  },
  {
    code: "P49",
    id: "profession:building-designer",
    name: "Building Designer",
    groups: [
      { groupId: "F28", route: "Ordinary design apprenticeship" },
      { groupId: "C03", route: "Running the trades on site" },
    ],
    directRoute: "Taught directly in the design office and on site",
    skillIds: [
      "mathematics",
      "skill:masonry",
      "carpentry",
      "skill:cartography",
      "skill:administration",
      "skill:bargaining",
    ],
    specializationIds: ["spec:fortification"],
  },
  {
    code: "P50",
    id: "profession:surveyor-mapmaker",
    name: "Surveyor and Mapmaker",
    groups: [
      { groupId: "F01", route: "Ordinary surveying apprenticeship" },
      { groupId: "K09", route: "Assembling what is known of the country" },
      { groupId: "G04", route: "Working away from settlement" },
    ],
    directRoute: "Taught directly in the field and at the drawing table",
    skillIds: ["mathematics", "astronomy", "skill:visual-art", "skill:administration"],
  },
  {
    code: "P51",
    id: "profession:locksmith",
    name: "Locksmith",
    groups: [
      { groupId: "C13", route: "Ordinary locksmith apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the bench",
    skillIds: [
      "skill:lockpicking",
      "skill:trade",
      "skill:teaching",
      "carpentry",
      "skill:perception",
    ],
  },
  {
    code: "P52",
    id: "profession:trapmaker",
    name: "Trapmaker",
    groups: [
      { groupId: "C14", route: "Ordinary trapmaking apprenticeship" },
      { groupId: "C13", route: "Mechanism workshop practice" },
    ],
    directRoute: "Taught directly at the bench and on the line",
    skillIds: ["carpentry", "ropework", "skill:animal-lore", "skill:hunting", "skill:appraisal"],
  },
  {
    code: "P53",
    id: "profession:cook",
    name: "Cook",
    groups: [
      { groupId: "F22", route: "Ordinary kitchen apprenticeship" },
      { groupId: "C10", route: "Brewhouse attached to the kitchen" },
    ],
    directRoute: "Taught directly in the kitchen it serves",
    skillIds: [
      "skill:appraisal",
      "skill:bargaining",
      "skill:plant-lore",
      "skill:customs",
      "skill:trade",
      "skill:teaching",
      "skill:farming",
      "skill:animal-husbandry",
    ],
    specializationIds: ["spec:baking", "spec:court-cookery"],
  },
  {
    code: "P54",
    id: "profession:brewer",
    name: "Brewer",
    groups: [
      { groupId: "C10", route: "Ordinary brewhouse apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the brewhouse",
    skillIds: ["skill:farming", "skill:plant-lore", "skill:trade", "skill:teaching", "carpentry"],
  },
  {
    code: "P55",
    id: "profession:vintner",
    name: "Vintner",
    groups: [
      { groupId: "C11", route: "Ordinary vineyard apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the vineyard and the cellar",
    skillIds: [
      "skill:plant-lore",
      "skill:weather-lore",
      "skill:trade",
      "skill:teaching",
      "carpentry",
      "skill:bookkeeping",
    ],
  },
  {
    code: "P56",
    id: "profession:distiller",
    name: "Distiller",
    groups: [
      { groupId: "F23", route: "Ordinary still-room apprenticeship" },
      { groupId: "C10", route: "Brewhouse work behind the still" },
      { groupId: "C15", route: "Service in an alchemical workshop" },
    ],
    directRoute: "Taught directly at the still",
    skillIds: ["skill:plant-lore", "skill:appraisal", "skill:trade", "mechanics", "skill:teaching"],
  },
  {
    code: "P57",
    id: "profession:alchemist",
    name: "Alchemist",
    groups: [
      { groupId: "C15", route: "Ordinary alchemical apprenticeship" },
      { groupId: "K01", route: "Learned study of the tradition" },
      { groupId: "K02", route: "Argument about the nature of matter" },
    ],
    directRoute: "Taught directly in the alchemist's workshop",
    skillIds: ["skill:plant-lore", "skill:smelting", "skill:appraisal"],
  },
  {
    code: "P58",
    id: "profession:clerk-steward",
    name: "Clerk and Steward",
    groups: [
      { groupId: "G11", route: "Ordinary records-office service" },
      { groupId: "K11", route: "Service inside a court or great household" },
      { groupId: "K21", route: "Accounts, measures and the estate" },
    ],
    directRoute: "Taught directly in the establishment one serves",
    skillIds: ["skill:law", "skill:appraisal", "skill:trade"],
    specializationIds: ["spec:court-administration"],
  },
  {
    code: "P59",
    id: "profession:legal-practitioner",
    name: "Legal Practitioner and Advocate",
    groups: [
      { groupId: "F13", route: "Ordinary legal apprenticeship" },
      { groupId: "G11", route: "Service in a records office" },
      { groupId: "F15", route: "Study of the older record" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the advocate one reads with",
    skillIds: ["skill:customs", "skill:politics", "skill:insight"],
  },
  {
    code: "P60",
    id: "profession:envoy",
    name: "Envoy",
    groups: [
      { groupId: "G10", route: "Ordinary negotiation apprenticeship" },
      { groupId: "K11", route: "Service inside a court" },
      { groupId: "G05", route: "Travelling to the other party" },
    ],
    directRoute: "Taught directly in the service one is entrusted with",
    skillIds: ["skill:law", "skill:geography", "skill:mnemonics", "skill:administration"],
    specializationIds: ["spec:courtly-protocol"],
  },
  {
    code: "P61",
    id: "profession:mediator",
    name: "Mediator and Community Convenor",
    groups: [
      { groupId: "G10", route: "Ordinary convening practice" },
      { groupId: "F14", route: "Speaking from memory before the community" },
      { groupId: "K07", route: "Instructing those who will convene after" },
    ],
    directRoute: "Taught directly in the community one convenes",
    skillIds: ["skill:law", "skill:religion", "history", "skill:administration"],
  },
  {
    code: "P62",
    id: "profession:credit-practitioner",
    name: "Banker and Credit Practitioner",
    groups: [
      { groupId: "F12", route: "Ordinary credit-house apprenticeship" },
      { groupId: "G12", route: "Trading alongside lending" },
      { groupId: "G11", route: "Keeping the house's records" },
    ],
    directRoute: "Taught directly in the credit house",
    skillIds: ["skill:law", "skill:insight", "skill:politics", "mathematics"],
  },
  {
    code: "P63",
    id: "profession:political-agent",
    name: "Political Agent and Council Representative",
    groups: [
      { groupId: "G10", route: "Ordinary council practice" },
      { groupId: "K11", route: "Service among those who decide" },
      { groupId: "G14", route: "Working the district for support" },
    ],
    directRoute: "Taught directly in the council one serves",
    skillIds: ["skill:law", "history", "skill:administration"],
  },
  {
    code: "P64",
    id: "profession:teacher",
    name: "Teacher",
    groups: [
      { groupId: "K07", route: "Ordinary instruction apprenticeship" },
      { groupId: "K01", route: "Learned study of what is taught" },
      { groupId: "F14", route: "Delivering from memory" },
    ],
    directRoute: "Taught directly by the master one assists",
    skillIds: ["history", "philosophy", "skill:customs", "skill:administration", "skill:insight"],
  },
  {
    code: "P65",
    id: "profession:scribe",
    name: "Scribe and Copyist",
    groups: [
      { groupId: "G11", route: "Ordinary records-office service" },
      { groupId: "F15", route: "Reading and copying older hands" },
      { groupId: "K01", route: "Learned study behind the copying" },
    ],
    directRoute: "Taught directly in the writing room",
    skillIds: ["skill:visual-art", "skill:law", "skill:customs", "skill:appraisal"],
    note:
      "BLOCKED DEPENDENCY: the defining Written Tradition core remains unresolved under #113 and is " +
      "deliberately not supplied here. This package must not be presented as universal literacy.",
  },
  {
    code: "P66",
    id: "profession:translator-interpreter",
    name: "Translator and Interpreter",
    groups: [
      { groupId: "K08", route: "Ordinary interpreting apprenticeship" },
      { groupId: "F15", route: "Working from written originals" },
      { groupId: "K01", route: "Learned study of the languages' matter" },
    ],
    directRoute: "Taught directly in the service one interprets for",
    skillIds: ["skill:oratory", "skill:geography", "history", "skill:administration"],
    note: "The spoken languages themselves remain separate contextual competencies and are not granted here.",
  },
  {
    code: "P67",
    id: "profession:historian",
    name: "Historian and Genealogist",
    groups: [
      { groupId: "F15", route: "Ordinary historical study" },
      { groupId: "F16", route: "Lineage investigation apprenticeship" },
      { groupId: "K10", route: "Service in a heraldic office" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the scholar one reads with",
    skillIds: ["skill:geography", "skill:politics", "skill:religion"],
  },
  {
    code: "P68",
    id: "profession:mathematical-practitioner",
    name: "Mathematical Practitioner",
    groups: [
      { groupId: "K21", route: "Ordinary applied-calculation apprenticeship" },
      { groupId: "K01", route: "Learned study of method" },
      { groupId: "K03", route: "Calculation applied to the sky" },
    ],
    directRoute: "Taught directly by the practitioner one calculates for",
    skillIds: ["skill:architecture", "skill:teaching", "skill:cartography", "philosophy"],
  },
  {
    code: "P69",
    id: "profession:philosopher",
    name: "Philosopher",
    groups: [
      { groupId: "K02", route: "Ordinary philosophical study" },
      { groupId: "K01", route: "Learned study of the tradition" },
      { groupId: "K07", route: "Teaching within a school" },
    ],
    directRoute: "Taught directly within the school",
    skillIds: ["skill:religion", "history", "skill:politics"],
  },
  {
    code: "P70",
    id: "profession:astronomer",
    name: "Astronomer",
    groups: [
      { groupId: "K03", route: "Ordinary observational apprenticeship" },
      { groupId: "K01", route: "Learned study of the record" },
      { groupId: "K02", route: "Argument about what is observed" },
    ],
    directRoute: "Taught directly at the instrument and the record",
    skillIds: [
      "skill:celestial-navigation",
      "skill:cartography",
      "skill:geography",
      "skill:teaching",
    ],
  },
  {
    code: "P71",
    id: "profession:astrologer",
    name: "Astrologer",
    groups: [
      { groupId: "K04", route: "Ordinary astrological apprenticeship" },
      { groupId: "K03", route: "Observation behind the reading" },
      { groupId: "K01", route: "Learned study of the tradition" },
    ],
    directRoute: "Taught directly by the astrologer one reads with",
    skillIds: ["skill:religion", "divination", "skill:insight", "history"],
  },
  {
    code: "P72",
    id: "profession:naturalist",
    name: "Naturalist",
    groups: [
      { groupId: "K12", route: "Ordinary field-study apprenticeship" },
      { groupId: "G04", route: "Working away from settlement" },
      { groupId: "K01", route: "Learned study of the record" },
    ],
    directRoute: "Taught directly in the field and the collection",
    skillIds: ["skill:geography", "skill:visual-art", "skill:teaching", "philosophy"],
  },
  {
    code: "P73",
    id: "profession:geographer",
    name: "Geographer",
    groups: [
      { groupId: "K09", route: "Ordinary chorographic study" },
      { groupId: "F01", route: "Measuring the ground oneself" },
      { groupId: "G04", route: "Travelling what one describes" },
    ],
    directRoute: "Taught directly by the geographer one works with",
    skillIds: ["astronomy", "skill:customs", "history", "mathematics"],
  },
  {
    code: "P74",
    id: "profession:religious-practitioner",
    name: "Religious Practitioner",
    groups: [
      { groupId: "K06", route: "Ordinary vocation apprenticeship" },
      { groupId: "K01", route: "Learned study of the tradition" },
      { groupId: "F14", route: "Delivering before the congregation" },
    ],
    directRoute: "Taught directly within the vocation",
    skillIds: ["meditation", "history", "skill:teaching", "skill:first-aid", "skill:insight"],
  },
  {
    code: "P75",
    id: "profession:diviner",
    name: "Diviner",
    groups: [
      { groupId: "K05", route: "Ordinary divinatory apprenticeship" },
      { groupId: "K04", route: "Celestial method within the practice" },
    ],
    directRoute: "Taught directly by the diviner one serves",
    skillIds: [
      "meditation",
      "skill:insight",
      "skill:animal-lore",
      "skill:weather-lore",
      "skill:mnemonics",
      "skill:oratory",
    ],
  },
  {
    code: "P76",
    id: "profession:herald",
    name: "Herald",
    groups: [
      { groupId: "K10", route: "Ordinary heraldic office apprenticeship" },
      { groupId: "F16", route: "Lineage investigation" },
      { groupId: "F14", route: "Proclamation from memory" },
      { groupId: "K11", route: "Service inside the court" },
    ],
    directRoute: "Taught directly in the heraldic office",
    skillIds: ["skill:administration", "skill:visual-art", "skill:law"],
    note:
      "Closes the recorded Herald parent-access gaps: History for Genealogy and Customs for Courtly " +
      "Protocol are supplied by K10 inside the family's own envelope.",
  },
  {
    code: "P77",
    id: "profession:musician",
    name: "Musician and Singer",
    groups: [
      { groupId: "F17", route: "Ordinary song apprenticeship" },
      { groupId: "F19", route: "Composing the matter one performs" },
      { groupId: "F18", route: "Performing with players and dancers" },
    ],
    directRoute: "Taught directly by the players one performs with",
    skillIds: ["skill:customs", "skill:teaching", "skill:mnemonics", "history"],
    specializationIds: ["spec:music-composition"],
  },
  {
    code: "P78",
    id: "profession:stage-performer",
    name: "Actor and Dancer",
    groups: [
      { groupId: "F18", route: "Ordinary company apprenticeship" },
      { groupId: "F17", route: "Music and song in the company" },
      { groupId: "F19", route: "The matter the company performs" },
    ],
    directRoute: "Taught directly by the company",
    skillIds: ["skill:customs", "skill:athletics", "skill:disguise", "skill:mnemonics"],
  },
  {
    code: "P79",
    id: "profession:visual-artist",
    name: "Visual Artist and Sculptor",
    groups: [
      { groupId: "F20", route: "Ordinary workshop apprenticeship" },
      { groupId: "F21", route: "Modelling and firing" },
      { groupId: "C01", route: "Workshop trade practice" },
    ],
    directRoute: "Taught directly in the workshop",
    skillIds: ["skill:masonry", "carpentry", "skill:customs", "skill:teaching", "heraldry"],
  },
  {
    code: "P80",
    id: "profession:storyteller",
    name: "Storyteller and Poet",
    groups: [
      { groupId: "F19", route: "Ordinary oral composition apprenticeship" },
      { groupId: "F14", route: "Holding and delivering the matter" },
      { groupId: "F17", route: "Singing what one composes" },
    ],
    directRoute: "Taught directly by the teller one learns from",
    skillIds: ["skill:customs", "history", "skill:religion", "skill:geography", "skill:insight"],
  },
  {
    code: "P81",
    id: "profession:athlete",
    name: "Athlete and Physical Performer",
    groups: [
      { groupId: "F04", route: "Ordinary athletic training" },
      { groupId: "F18", route: "Performing before an audience" },
    ],
    directRoute: "Taught directly by the trainer one works under",
    skillIds: ["brawling", "skill:teaching", "skill:customs", "skill:first-aid"],
  },
  {
    code: "P82",
    id: "profession:weapon-instructor",
    name: "Weapon Instructor",
    groups: [],
    directRoute: "Taught directly in the salle one instructs in",
    skillIds: [
      "skill:teaching",
      "combat_experience",
      "weapon_maintenance",
      "skill:athletics",
      "skill:first-aid",
      "skill:customs",
    ],
    tracks: [
      {
        id: "profession:weapon-instructor:close-combat",
        name: "Close-combat weapon master",
        groups: [{ groupId: "M02", route: "Advanced close-combat instruction" }],
      },
      {
        id: "profession:weapon-instructor:fencing",
        name: "Fencing master",
        groups: [{ groupId: "F30", route: "Swashbuckling fencing instruction" }],
      },
      {
        id: "profession:weapon-instructor:missile",
        name: "Missile weapon master",
        groups: [{ groupId: "M05", route: "Advanced missile instruction" }],
      },
    ],
    narrowByDesign: true,
    note: "The fencing-master path is deliberately narrow: a single named tradition is the whole occupation.",
  },
  {
    code: "P83",
    id: "profession:gambler",
    name: "Gambler",
    groups: [
      { groupId: "K17", route: "Ordinary gaming-house practice" },
      { groupId: "G14", route: "Knowing the house and the players" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
      { groupId: "G16", route: "Passing as what one is not" },
    ],
    directRoute: "Taught directly at the tables",
    skillIds: ["mathematics", "skill:customs", "skill:bargaining"],
  },
  {
    code: "P84",
    id: "profession:diver",
    name: "Diver and Water Worker",
    groups: [
      { groupId: "K20", route: "Ordinary diving apprenticeship" },
      { groupId: "N01", route: "Working from a boat" },
    ],
    directRoute: "Taught directly on the working line",
    skillIds: ["skill:athletics", "climb", "skill:fishing", "skill:survival", "skill:appraisal"],
  },
];

/* ------------------------------------------------------------------------------------------ */
/* Proposed player-facing Skill categories                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * `special-access` is access provenance, not a player-facing category. A Skill reached through a
 * direct Profession route belongs to the same category as the same Skill reached through a
 * Learning Group; only the access label differs. The proposal therefore assigns every competency a
 * real category and proposes that the `special-access` bucket be retired.
 *
 * Applying this to the runtime enum, `chargenBrowse.ts` and
 * `getPlayerFacingSkillCategoryId({ preferDirectProfession })` is deliberately OUT OF SCOPE here
 * and belongs to a separate authorized implementation task.
 */
export const COMPETENCY_CONTENT_V2_RETIRED_CATEGORY_ID = "special-access" as const;

export type V2PlayerFacingCategoryId =
  | "combat"
  | "military"
  | "fieldcraft"
  | "maritime"
  | "healing"
  | "trade"
  | "high-society"
  | "performance"
  | "social"
  | "covert"
  | "language"
  | "knowledge"
  | "mental"
  | "mystical"
  | "craft"
  | "physical";

/** Default category for each approved catalogue domain. */
export const competencyContentV2CategoryByDomain: Readonly<
  Record<string, V2PlayerFacingCategoryId>
> = {
  "Agriculture & Husbandry": "trade",
  "Arts & Performance": "performance",
  "Athletics & Movement": "physical",
  "Awareness & Investigation": "fieldcraft",
  "Construction & Engineering": "craft",
  "Covert Entry & Infiltration": "covert",
  "Craft & Making": "craft",
  "Culture & Society": "knowledge",
  Healing: "healing",
  "Languages & Textual Practice": "knowledge",
  "Law & Administration": "trade",
  "Natural Knowledge": "fieldcraft",
  Navigation: "maritime",
  "Outdoor & Survival": "fieldcraft",
  Scholarship: "knowledge",
  "Social Interaction": "social",
  "Trade & Finance": "trade",
  Warfare: "military",
  "Weapon Practice": "combat",
};

/**
 * Explicit per-competency overrides. Where the competency also exists in the current runtime
 * catalogue, the override preserves that catalogue's existing player-facing category so the
 * proposal does not silently re-bucket Skills players already see.
 */
export const competencyContentV2CategoryOverrides: Readonly<
  Record<string, V2PlayerFacingCategoryId>
> = {
  alchemy: "knowledge",
  astrology: "mystical",
  astronomy: "knowledge",
  camouflage: "fieldcraft",
  divination: "mystical",
  gambling: "social",
  heraldry: "high-society",
  herding: "fieldcraft",
  history: "knowledge",
  mechanics: "knowledge",
  meditation: "mental",
  mounted_combat: "combat",
  ropework: "maritime",
  surveying: "knowledge",
  "skill:animal-handling": "fieldcraft",
  "skill:animal-lore": "fieldcraft",
  "skill:cartography": "knowledge",
  "skill:document-forgery": "covert",
  "skill:geography": "knowledge",
  "skill:law": "knowledge",
  "skill:mnemonics": "mental",
  "skill:poisons": "covert",
  "skill:politics": "high-society",
  "skill:religion": "mystical",
  "skill:sculpture": "craft",
  "skill:siege-engineering": "military",
  "skill:streetwise": "covert",
  "skill:teaching": "knowledge",
  "skill:underworld": "covert",
  "skill:visual-art": "craft",
  "skill:wayfinding": "fieldcraft",
  "spec:court-administration": "trade",
  "spec:court-advocacy": "knowledge",
  "spec:courtly-protocol": "high-society",
  "spec:fortification": "military",
  "spec:genealogy": "knowledge",
  "spec:omen-reading": "mystical",
  "spec:siege-operations": "military",
  "spec:theology": "mystical",
  "spec:warded-lock-entry": "covert",
};

/* ------------------------------------------------------------------------------------------ */
/* Proposed Civilization language competencies                                                  */
/* ------------------------------------------------------------------------------------------ */

export interface V2CivilizationLanguage {
  civilizationId: string;
  civilizationName: string;
  /** Proposed Glantri spoken-language competency name. */
  spokenName: string;
  /** Current approved competency id, when one already exists. */
  existingSpokenCompetencyId?: string;
  /** Proposed Glantri written-tradition competency name, or null when authored as having no writing. */
  writtenName: string | null;
  existingWrittenCompetencyId?: string;
  /** Real-world analogue name this proposal replaces, if any. */
  replacesAnalogueSpokenName?: string;
  replacesAnalogueWrittenName?: string;
  /** True when the proposed name cannot be settled without a Product Owner ruling. */
  requiresProductOwnerNamingRuling: boolean;
  note: string;
}

/**
 * Every canonical Civilization gets a spoken competency, and a written one unless it is explicitly
 * authored as having no writing. Names are proposed in Glantri terms; where the Civilization's own
 * name is still a real-world analogue, the language name inherits that problem and is flagged.
 */
export const competencyContentV2CivilizationLanguages: readonly V2CivilizationLanguage[] = [
  {
    civilizationId: "scandia",
    civilizationName: "Scandia",
    spokenName: "Spoken Scandian",
    existingSpokenCompetencyId: "spoken:scandian",
    writtenName: "Written Scandian in Runic Scandian",
    requiresProductOwnerNamingRuling: false,
    note: "Both names are already Glantri names. Only the missing written competency is added.",
  },
  {
    civilizationId: "iest",
    civilizationName: "Iest",
    spokenName: "Spoken Common",
    existingSpokenCompetencyId: "spoken:common",
    writtenName: "Written Common in the Common Hand",
    requiresProductOwnerNamingRuling: true,
    note: "The script, register and conventions of the Common written tradition remain an open case in the approved gap report.",
  },
  {
    civilizationId: "thyatis",
    civilizationName: "Thyatis",
    spokenName: "Spoken Common",
    existingSpokenCompetencyId: "spoken:common",
    writtenName: "Written Common in the Common Hand",
    requiresProductOwnerNamingRuling: true,
    note: "Shares the Common written tradition; the same open case applies.",
  },
  {
    civilizationId: "glantri",
    civilizationName: "Glantri",
    spokenName: "Spoken Common",
    existingSpokenCompetencyId: "spoken:common",
    writtenName: "Written Common in the Common Hand",
    requiresProductOwnerNamingRuling: true,
    note: "Shares the Common written tradition; Old Common remains an authored optional second tongue.",
  },
  {
    civilizationId: "scyria",
    civilizationName: "Scyria",
    spokenName: "Spoken Old Common",
    existingSpokenCompetencyId: "spoken:old-common",
    writtenName: "Written Old Common in the Old Common Hand",
    requiresProductOwnerNamingRuling: true,
    note: "The Old Common written identity must be defined without inferring equivalence with Common.",
  },
  {
    civilizationId: "byzantine_empire",
    civilizationName: "Byzantine Empire",
    spokenName: "Spoken Old Common",
    existingSpokenCompetencyId: "spoken:old-common",
    writtenName: "Written Old Common in the Old Common Hand",
    requiresProductOwnerNamingRuling: true,
    note: "The Civilization name itself is a real-world analogue; renaming it is outside this task's scope.",
  },
  {
    civilizationId: "lankhmar",
    civilizationName: "Lankhmar",
    spokenName: "Spoken Lankhmaran",
    existingSpokenCompetencyId: "spoken:phoenician",
    writtenName: "Written Lankhmaran in the Harbour Hand",
    existingWrittenCompetencyId: "written:phoenician:phoenician",
    replacesAnalogueSpokenName: "Spoken Phoenician",
    replacesAnalogueWrittenName: "Written Phoenician in Phoenician script",
    requiresProductOwnerNamingRuling: false,
    note: "Clear correction: the Civilization is already a Glantri name, so the language takes it directly.",
  },
  {
    civilizationId: "olog",
    civilizationName: "Olog",
    spokenName: "Spoken Ologian",
    existingSpokenCompetencyId: "spoken:ologian",
    writtenName: "Written Ologian in Church Ologian",
    existingWrittenCompetencyId: "written:ologian:church-ologian",
    requiresProductOwnerNamingRuling: false,
    note: "Already complete in the approved catalogue; carried forward unchanged.",
  },
  {
    civilizationId: "mogreb",
    civilizationName: "Mogreb",
    spokenName: "Spoken Mogrebi",
    existingSpokenCompetencyId: "spoken:mogrebi",
    writtenName: "Written Mogrebi in Sacred Mogrebi",
    existingWrittenCompetencyId: "written:mogrebi:sacred-mogrebi",
    requiresProductOwnerNamingRuling: false,
    note: "Already complete in the approved catalogue; carried forward unchanged.",
  },
  {
    civilizationId: "nkolo",
    civilizationName: "N'Kolo",
    spokenName: "Spoken N'kolian",
    existingSpokenCompetencyId: "spoken:nkolian",
    writtenName: "Written N'kolian in Royal N'kolian",
    requiresProductOwnerNamingRuling: true,
    note: "Glantri names already; the written tradition's register and script support remain an open case.",
  },
  {
    civilizationId: "san_forager_bands",
    civilizationName: "San Forager Bands",
    spokenName: "Spoken Tuu",
    writtenName: null,
    requiresProductOwnerNamingRuling: true,
    note:
      "No spoken competency exists for this Civilization today; one is added. The Civilization is explicitly " +
      "authored as having no written tradition. The approved gap report still asks for a precise Tuu identity.",
  },
  {
    civilizationId: "scythians",
    civilizationName: "Scythians",
    spokenName: "Spoken Kethran",
    existingSpokenCompetencyId: "spoken:scythian",
    writtenName: null,
    replacesAnalogueSpokenName: "Spoken Scythian",
    requiresProductOwnerNamingRuling: true,
    note:
      "Candidate name only. The Civilization name is itself a real-world analogue, so the language cannot be " +
      "finally named until the Civilization is. Authored as having no written tradition.",
  },
  {
    civilizationId: "latial_chiefdoms",
    civilizationName: "Latial Chiefdoms",
    spokenName: "Spoken Old Latian",
    existingSpokenCompetencyId: "spoken:old-latin",
    writtenName: "Written Old Latian in the Hill Script",
    replacesAnalogueSpokenName: "Spoken Old Latin",
    replacesAnalogueWrittenName: "Old Italic",
    requiresProductOwnerNamingRuling: true,
    note: "Candidate names only; the Civilization name is itself a real-world analogue.",
  },
  {
    civilizationId: "mycenaean_greece",
    civilizationName: "Mycenaean Greece",
    spokenName: "Spoken Palace Scyrian",
    existingSpokenCompetencyId: "spoken:mycenaean-greek",
    writtenName: "Written Palace Scyrian in the Palace Syllabary",
    replacesAnalogueSpokenName: "Spoken Mycenaean Greek",
    replacesAnalogueWrittenName: "Linear B",
    requiresProductOwnerNamingRuling: true,
    note:
      "Candidate names only. The proposed tie to Scyria is a suggestion about descent, not an established " +
      "Glantri fact, and needs a ruling.",
  },
  {
    civilizationId: "sumer",
    civilizationName: "Sumer",
    spokenName: "Spoken Kaldan",
    existingSpokenCompetencyId: "spoken:sumerian",
    writtenName: "Written Kaldan in the Wedge Script",
    replacesAnalogueSpokenName: "Spoken Sumerian",
    replacesAnalogueWrittenName: "Cuneiform",
    requiresProductOwnerNamingRuling: true,
    note:
      "Candidate names only. The approved gap report explicitly refuses a universal Cuneiform competence; " +
      "the language and tradition behind the script still need authoring.",
  },
  {
    civilizationId: "achaemenid_persia",
    civilizationName: "Achaemenid Persia",
    spokenName: "Spoken Aspardic",
    existingSpokenCompetencyId: "spoken:old-persian",
    writtenName: "Written Aspardic in the Chancery Script",
    replacesAnalogueSpokenName: "Spoken Old Persian",
    replacesAnalogueWrittenName: "Imperial Aramaic",
    requiresProductOwnerNamingRuling: true,
    note:
      "Candidate names only. Language, script and administrative written tradition must still be separated " +
      "with explicit evidence, as the approved gap report requires.",
  },
];
