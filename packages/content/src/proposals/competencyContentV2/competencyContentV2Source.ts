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
  /**
   * `approved` — the Product Owner has settled this count.
   * `unresolved-source-conflict` — the sources disagree and the conflict is NOT settled here. The
   * proposal then uses the lowest evidenced count so that no content depends on the open question.
   */
  chooseCountStatus: "approved" | "unresolved-source-conflict";
  /** Every count the surviving evidence supports, when they disagree. */
  conflictingChooseCounts?: readonly number[];
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

/**
 * A defining core route: the training a Profession is not that Profession without.
 *
 * This is a data annotation over the Learning Groups and direct Skills that already exist, not a new
 * conceptual layer. A path satisfies its Profession when it contains every group and Skill of at
 * least one applicable core route. A body may declare several core routes, which are alternatives;
 * a track that declares its own core routes refines or replaces its parent's.
 */
export interface V2CoreRoute {
  id: string;
  /** Player-facing statement of what this core route is. */
  label: string;
  /** Learning Groups the core route requires. */
  groupIds: readonly string[];
  /** Directly taught Skills the core route requires, when the core is not entirely a group. */
  skillIds?: readonly string[];
  /** Set when the core route cannot be finally authored yet, with the blocking reference. */
  blockedBy?: string;
}

export interface V2PathBody {
  groups?: readonly V2Route[];
  /**
   * Defining core routes for this body. Every Profession declares at least one at family or track
   * level; a track's list, when present, replaces the family's for that track's paths.
   */
  coreRoutes?: readonly V2CoreRoute[];
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
    fixedSkillIds: ["dodge", "parry"],
    selectionSlots: [
      {
        id: "melee-family",
        label: "Choose one taught melee weapon family",
        chooseCount: 1,
        chooseCountStatus: "approved",
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
      "The focused melee package the ruling describes: Dodge, Parry and one chosen melee weapon family. " +
      "Brawling was removed — a weapon course teaches guard, defence and the weapon, and unarmed fighting " +
      "is a different practice, now offered inside the broad cross-category pools. Restores the historical " +
      "Basic Melee Training choose-one slot and, with it, general 2-h edged access; the approved catalogue " +
      "reached 2-h edged only through F37 on two Soldier tracks.",
  },
  {
    id: "M02",
    name: "Advanced close-combat weapon practice",
    shortDescription: "Sustained instruction across several fighting forms at close quarters.",
    disposition: "new",
    fixedSkillIds: ["dodge", "parry"],
    selectionSlots: [
      {
        id: "advanced-melee-families",
        label: "Choose three taught melee weapon families",
        chooseCount: 3,
        chooseCountStatus: "approved",
        conflictingChooseCounts: [2, 3],
        candidateSkillIds: [
          "one_handed_edged",
          "one_handed_concussion_axe",
          "two_handed_edged",
          "two_handed_concussion_axe",
          "polearms",
          "brawling",
          "throwing",
        ],
        required: true,
      },
    ],
    note:
      "Deliberately larger than the 3-4 centre: a broad combat group whose job is economical breadth across " +
      "close-quarters fighting. The pool now crosses melee, throwing and unarmed, because a close-quarters " +
      "school genuinely teaches the grapple and the thrown weapon alongside the sword. Combat Experience was " +
      "removed: this is instruction, and instruction cannot confer what only real exposure teaches. Overlap " +
      "with M01 and M03 is intentional; Profession breadth is deduplicated. Restores the historical Advanced " +
      "Melee Training choose-three slot, and the recovered import's choose-2 reading is provenance only.",
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
    fixedSkillIds: ["dodge", "parry", "formation_fighting"],
    selectionSlots: [
      {
        id: "formation-arms",
        label: "Choose two taught formation weapon families",
        chooseCount: 2,
        chooseCountStatus: "approved",
        candidateSkillIds: [
          "one_handed_edged",
          "one_handed_concussion_axe",
          "two_handed_edged",
          "two_handed_concussion_axe",
          "polearms",
          "throwing",
          "sling",
        ],
        required: true,
      },
    ],
    note:
      "Deliberately larger than the 3-4 centre: a broad combat group giving economical drilled competence " +
      "in the arms a formation actually carries. The pool crosses melee, throwing and the sling, because a " +
      "close-order unit issues skirmishing arms alongside the line weapon. Merges the three fixed formation " +
      "groups: a soldier is charged for the arms actually issued and drilled, not for every weapon family " +
      "the army fields. Brawling was removed — close-order drill is not an unarmed course.",
  },
  {
    id: "M11",
    name: "Mounted combat practice",
    shortDescription: "Fighting from the saddle, and the horsemanship that makes it possible.",
    disposition: "new",
    fixedSkillIds: ["skill:riding", "mounted_combat"],
    note:
      "The first half of the F32 replacement ruled by the Product Owner. Riding and Mounted Combat are one " +
      "practice: a rider is taught to control the horse and to fight from it in the same course of training.",
  },
  {
    id: "M12",
    name: "Mounted lance and formation drill",
    shortDescription: "The lance, delivered in a formed body of horse.",
    disposition: "new",
    fixedSkillIds: ["lance", "formation_fighting"],
    note:
      "The second half of the F32 replacement ruled by the Product Owner. The lance is a formation weapon; " +
      "it is taught with the drill that keeps a charge together, not as an individual arm.",
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
        chooseCountStatus: "approved",
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
    fixedSkillIds: ["skill:perception", "weapon_maintenance"],
    selectionSlots: [
      {
        id: "advanced-missile-families",
        label: "Choose three taught missile weapon families",
        chooseCount: 3,
        chooseCountStatus: "approved",
        candidateSkillIds: ["bow", "crossbow", "skill:firearms", "sling", "throwing"],
        required: true,
      },
    ],
    note:
      "Deliberately larger than the 3-4 centre: a broad combat group giving economical breadth across the " +
      "missile arms. Combat Experience was removed — a shooting master who has never been shot at has not " +
      "earned it. Restores the historical Advanced Missile Training choose-three slot.",
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
    note:
      "One of exactly two routes to Combat Experience. It is not a course: it is the experiential route, " +
      "taken by Professions whose ordinary working life is campaign service, and it is deliberately not " +
      "available to instruction-only Professions such as the Weapon Instructor.",
  },
  {
    id: "M10",
    name: "Arms instruction practice",
    shortDescription: "Teaching others to fight, and keeping the weapons the school uses.",
    disposition: "new",
    fixedSkillIds: ["skill:teaching", "weapon_maintenance", "skill:athletics"],
    note:
      "Collects what had been the Weapon Instructor's three direct Skill grants into the coherent taught " +
      "practice they always were. It contains no Combat Experience: instructing is not exposure.",
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
    note:
      "The second and only other route to Combat Experience, and an experiential one: habitual real violence " +
      "in someone's service, not a weapon course. It is retained under the ruling precisely because it is " +
      "exposure rather than instruction.",
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
        chooseCountStatus: "approved",
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
        label: "Choose the taught crafts",
        chooseCount: 1,
        chooseCountStatus: "unresolved-source-conflict",
        conflictingChooseCounts: [1, 2, 3],
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
      "Authored exactly as the Product Owner ruled: Appraisal, Bargaining, Teaching and one chosen craft. " +
      "Restores the Advanced Craft Specialty slot. Its count is NOT settled: the executable data says " +
      "choose one, its own prose says two specialties, and the master-artisan reading suggests three. The " +
      "Product Owner has ruled that this conflict must not be resolved by breadth pressure, so the " +
      "proposal counts the lowest evidenced value (1) and leaves the question open.",
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
        chooseCountStatus: "approved",
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
    id: "C10",
    name: "Brewing and preserving practice",
    shortDescription: "Brewing, cooking and keeping what the season gives.",
    disposition: "new",
    fixedSkillIds: ["skill:brewing", "skill:cooking"],
    specializationIds: ["spec:food-preservation"],
    note:
      "Carries the retired F22's Food Preservation route. Brewing and preserving are the same household or " +
      "brewhouse cycle — what is not eaten fresh is brewed, salted or dried — so the practice is one " +
      "curriculum rather than two. Access to Food Preservation is access only: the Specialization is still " +
      "purchased separately, and its parent Cooking is taught here on the same path.",
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
    fixedSkillIds: ["skill:customs", "skill:politics", "heraldry", "skill:administration"],
    specializationIds: ["spec:courtly-protocol", "spec:court-administration"],
    note:
      "Administration is fixed here rather than left to each Profession: it is the daily substance of court " +
      "service, and it is the immediate parent of Court Administration, which this group makes available.",
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
    id: "K22",
    name: "Contemplative discipline practice",
    shortDescription: "Trained stillness, trained memory and the reading of people it sharpens.",
    disposition: "new",
    fixedSkillIds: ["meditation", "skill:mnemonics", "skill:insight"],
    note:
      "Collects a coherent taught cluster that had been direct Profession grants on the Diviner and the " +
      "Religious Practitioner. Contemplative houses teach the discipline, the memorised corpus and the " +
      "attentiveness to people together; none of the three is an occupational exception.",
  },
  {
    id: "K24",
    name: "Watch and guard practice",
    shortDescription: "Standing a watch, knowing the ground, and handling people without a fight.",
    disposition: "new",
    fixedSkillIds: ["skill:perception", "skill:streetwise", "skill:intimidation"],
    note:
      "Collects the Guard's three direct Skill grants into the practice they describe. Watch duty is " +
      "genuinely taught and drilled: what to look for, whose district this is, and how to make someone " +
      "stand down without drawing.",
  },
  {
    id: "K25",
    name: "Street theft practice",
    shortDescription: "Taking what is worth taking, from places it was not meant to be taken from.",
    disposition: "new",
    fixedSkillIds: ["skill:sleight-of-hand", "skill:appraisal", "climb"],
    specializationIds: ["spec:pickpocketing"],
    note:
      "Collects three of the Thief's four direct grants. Knowing what is worth lifting, lifting it, and " +
      "reaching it over a wall are learned together and from the same people. Pickpocketing moves here as " +
      "group-linked access; it is still purchased separately, and its parent Sleight of Hand is taught here.",
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
  {
    id: "F32",
    name: "Mounted lance and troop drill",
    reason:
      "Oversized by Product Owner ruling: a fixed burden of six charged every mounted soldier for the whole " +
      "of mounted warfare at once. Replaced by two small coherent practices plus the general close-combat " +
      "group, so a mounted Profession is charged for horsemanship, for the lance in formation and for its " +
      "sidearm separately.",
    replacedBy: ["M11", "M12", "M01"],
  },
  {
    id: "F22",
    name: "Seasonal kitchen and preservation practice",
    reason:
      "Retired by Product Owner ruling: its effective base-Skill content was one Skill plus access to Food " +
      "Preservation, which is a Specialization-access wrapper rather than a taught practice. The Food " +
      "Preservation route is preserved through C10, whose curriculum genuinely contains it; Cooking is " +
      "taught by C10 and Plant Lore by G02, K12 and the Cook's own occupational route.",
    replacedBy: ["C10"],
  },
  {
    id: "F16",
    name: "Lineage investigation apprenticeship",
    reason:
      "Retired by the group-size review. Its only base Skill was Research, which both users already reach " +
      "elsewhere, so it was a Specialization-access wrapper rather than a taught practice. Genealogy " +
      "becomes a direct Specialization route, and its immediate parent History is supplied by K10.",
    replacedBy: [],
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
    coreRoutes: [
      {
        id: "profession:hunter-trapper:core",
        label: "Ordinary hunting apprenticeship",
        groupIds: ["G03"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:wild-plant-gatherer:core",
        label: "Knowing and preparing what grows wild",
        groupIds: ["G02"],
      },
    ],
    groups: [
      { groupId: "G04", route: "Seasonal collecting rounds" },
      { groupId: "G02", route: "Supplying and preparing for a remedy maker" },
      { groupId: "G12", route: "Selling the season's collection" },
    ],
    directRoute: "Taught directly on the collecting rounds",
    skillIds: ["climb"],
  },
  {
    code: "P03",
    id: "profession:field-guide",
    name: "Field and Caravan Guide",
    coreRoutes: [
      {
        id: "profession:field-guide:core",
        label: "Ordinary guiding service",
        groupIds: ["G04"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:fisher:core",
        label: "Ordinary fishing-boat apprenticeship",
        groupIds: ["F10"],
      },
    ],
    groups: [
      { groupId: "F10", route: "Ordinary fishing-boat apprenticeship" },
      { groupId: "N01", route: "Working the family boat" },
      { groupId: "G12", route: "Selling the catch" },
    ],
  },
  {
    code: "P05",
    id: "profession:farmer",
    name: "Farmer",
    coreRoutes: [
      {
        id: "profession:farmer:core",
        label: "Ordinary holding apprenticeship",
        groupIds: ["F08"],
      },
    ],
    groups: [
      { groupId: "F08", route: "Ordinary holding apprenticeship" },
      { groupId: "F05", route: "Keeping the holding's stock" },
      { groupId: "F06", route: "Carting to market" },
      { groupId: "C10", route: "Household brewing and storing the season" },
    ],
    directRoute: "Taught directly in the working year of the holding",
    skillIds: ["skill:weather-lore"],
  },
  {
    code: "P06",
    id: "profession:herd-keeper",
    name: "Herd Keeper",
    coreRoutes: [
      {
        id: "profession:herd-keeper:core",
        label: "Ordinary stockkeeping apprenticeship",
        groupIds: ["F05"],
      },
    ],
    groups: [
      { groupId: "F05", route: "Ordinary stockkeeping apprenticeship" },
      { groupId: "G05", route: "Mounted herding service" },
      { groupId: "G04", route: "Seasonal movement with the herd" },
      { groupId: "F02", route: "Household fibre and cloth work from the clip" },
    ],
    directRoute: "Taught directly by the herd owner and the older keepers",
    skillIds: ["sling"],
    specializationIds: ["spec:steppe-remount-training"],
  },
  {
    code: "P07",
    id: "profession:animal-trainer",
    name: "Animal Trainer and Falconer",
    coreRoutes: [
      {
        id: "profession:animal-trainer:core",
        label: "Falconry apprenticeship",
        groupIds: ["F07"],
      },
    ],
    groups: [
      { groupId: "F07", route: "Falconry apprenticeship" },
      { groupId: "F05", route: "Keeping the animals in condition" },
      { groupId: "G05", route: "Mounted work with trained animals" },
      { groupId: "K13", route: "Treating the animals in one's charge" },
      { groupId: "G03", route: "Hunting with what one has trained" },
    ],
  },
  {
    code: "P08",
    id: "profession:driver",
    name: "Driver and Teamster",
    coreRoutes: [
      {
        id: "profession:driver:core",
        label: "Ordinary driving apprenticeship",
        groupIds: ["F06"],
      },
    ],
    groups: [
      { groupId: "F06", route: "Ordinary driving apprenticeship" },
      { groupId: "G04", route: "Long-distance caravan service" },
      { groupId: "G05", route: "Riding with the team" },
      { groupId: "G12", route: "Carrying goods on one's own account" },
    ],
  },
  {
    code: "P09",
    id: "profession:sailor",
    name: "Sailor and Boat Worker",
    groups: [{ groupId: "M01", route: "Rough shipboard fighting instruction" }],
    directRoute: "Taught directly by the crew one sails with",
    skillIds: ["skill:swimming"],
    tracks: [
      {
        id: "profession:sailor:small-craft",
        name: "Small-craft boat worker",
        coreRoutes: [
          {
            id: "profession:sailor:small-craft:core",
            label: "Working an open boat under sail and oar",
            groupIds: ["N01"],
          },
        ],
        groups: [{ groupId: "N01", route: "Working a boat" }],
      },
      {
        id: "profession:sailor:rigged-vessel",
        name: "Rigged-vessel deck hand",
        coreRoutes: [
          {
            id: "profession:sailor:rigged-vessel:core",
            label: "Deck service in a rigged vessel",
            groupIds: ["F09"],
          },
        ],
        groups: [{ groupId: "F09", route: "Rigged-vessel deck apprenticeship" }],
      },
    ],
    note: "The two deck practices remain alternatives, as recorded for the approved catalogue's Sailor exclusion pair.",
  },
  {
    code: "P10",
    id: "profession:navigator-pilot",
    name: "Navigator and Pilot",
    coreRoutes: [
      {
        id: "profession:navigator-pilot:core",
        label: "Entrusted coastal passage work",
        groupIds: ["G07"],
      },
    ],
    groups: [
      { groupId: "G07", route: "Entrusted coastal passage work" },
      { groupId: "F11", route: "Charted open-water instruction" },
      { groupId: "N01", route: "Deck grounding before navigation" },
    ],
    directRoute: "Taught directly by the pilot one serves under",
    skillIds: ["skill:cartography", "mathematics"],
  },
  {
    code: "P11",
    id: "profession:shipmaster",
    name: "Shipmaster",
    coreRoutes: [
      {
        id: "profession:shipmaster:core",
        label: "Deck service before command",
        groupIds: ["F09"],
      },
    ],
    groups: [
      { groupId: "F09", route: "Deck service before command" },
      { groupId: "G07", route: "Responsibility for the passage" },
      { groupId: "G12", route: "Trading the voyage" },
    ],
    directRoute: "Taught directly by the master one serves under",
    skillIds: ["skill:leadership"],
  },
  {
    code: "P12",
    id: "profession:courier",
    name: "Courier and Messenger",
    coreRoutes: [
      {
        id: "profession:courier:core",
        label: "Conditioning for the road",
        groupIds: ["F04"],
      },
    ],
    groups: [
      { groupId: "F04", route: "Conditioning for the road" },
      { groupId: "G05", route: "Mounted stage service" },
      { groupId: "G04", route: "Carrying across open country" },
    ],
    directRoute: "Taught directly by the stage or household one carries for",
    skillIds: ["skill:geography"],
  },
  {
    code: "P13",
    id: "profession:trader",
    name: "Trader and Merchant",
    coreRoutes: [
      {
        id: "profession:trader:core",
        label: "Ordinary trading apprenticeship",
        groupIds: ["G12"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:guard-escort:core",
        label: "Ordinary watch and guard instruction",
        groupIds: ["K24"],
      },
    ],
    groups: [
      { groupId: "K24", route: "Ordinary watch and guard instruction" },
      { groupId: "G04", route: "Escort duty away from the town" },
    ],
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
    coreRoutes: [
      {
        id: "profession:enforcer:core",
        label: "Ordinary coercive service",
        groupIds: ["K23"],
      },
    ],
    groups: [
      { groupId: "K23", route: "Ordinary coercive service" },
      { groupId: "M01", route: "Rough-fighting instruction" },
      { groupId: "G14", route: "Knowing the district one works" },
    ],
    directRoute: "Taught directly by the enterprise one works for",
    skillIds: ["conceal_object"],
  },
  {
    code: "P16",
    id: "profession:local-informant",
    name: "Local Informant",
    coreRoutes: [
      {
        id: "profession:local-informant:core",
        label: "Ordinary informant practice",
        groupIds: ["G14"],
      },
    ],
    groups: [
      { groupId: "G14", route: "Ordinary informant practice" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
      { groupId: "G16", route: "Passing unremarked where one does not belong" },
    ],
    directRoute: "Taught directly through the district one works",
    skillIds: ["skill:perception", "skill:customs", "skill:mnemonics"],
  },
  {
    code: "P17",
    id: "profession:investigator",
    name: "Investigator and Intelligence Agent",
    coreRoutes: [
      {
        id: "profession:investigator:core",
        label: "Entrusted inquiry apprenticeship",
        groupIds: ["G17"],
      },
    ],
    groups: [
      { groupId: "G17", route: "Entrusted inquiry apprenticeship" },
      { groupId: "G14", route: "Working local contacts" },
      { groupId: "G16", route: "Approach under another identity" },
    ],
    directRoute: "Taught directly by the mentor conducting the inquiry",
    skillIds: ["skill:stealth", "skill:law"],
  },
  {
    code: "P18",
    id: "profession:thief",
    name: "Thief",
    coreRoutes: [
      {
        id: "profession:thief:core",
        label: "Ordinary covert-entry instruction",
        groupIds: ["G15"],
      },
    ],
    groups: [
      { groupId: "G15", route: "Ordinary covert-entry instruction" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
      { groupId: "K25", route: "Learning the trade from an established thief" },
    ],
    directRoute: "Taught directly by an established thief",
    skillIds: ["skill:disguise"],
  },
  {
    code: "P19",
    id: "profession:confidence-trickster",
    name: "Confidence Trickster",
    coreRoutes: [
      {
        id: "profession:confidence-trickster:core",
        label: "Ordinary impersonation practice",
        groupIds: ["G16"],
      },
    ],
    groups: [
      { groupId: "G16", route: "Ordinary impersonation practice" },
      { groupId: "G14", route: "Finding the mark" },
      { groupId: "K17", route: "Working the gaming tables" },
    ],
    directRoute: "Taught directly by the trickster one works with",
    skillIds: ["skill:customs", "skill:oratory"],
  },
  {
    code: "P20",
    id: "profession:smuggler",
    name: "Smuggler and Illicit Trader",
    coreRoutes: [
      {
        id: "profession:smuggler:core",
        label: "Trading goods that must not be seen, with standing in the milieu that moves them",
        groupIds: ["G12", "K18"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:forger:core",
        label: "Ordinary forging apprenticeship",
        groupIds: ["K16"],
      },
    ],
    groups: [
      { groupId: "K16", route: "Ordinary forging apprenticeship" },
      { groupId: "G11", route: "Service inside a records office" },
      { groupId: "F15", route: "Study of older hands" },
      { groupId: "K18", route: "Placing the work through an illicit milieu" },
    ],
    directRoute: "Taught directly by the forger one trains under",
    skillIds: ["skill:visual-art"],
  },
  {
    code: "P22",
    id: "profession:soldier",
    name: "Soldier",
    coreRoutes: [
      {
        id: "profession:soldier:core",
        label: "Repeated service in the field",
        groupIds: ["M06"],
      },
    ],
    groups: [
      { groupId: "M06", route: "Repeated service in the field" },
      { groupId: "G04", route: "Marching and camping with the force" },
    ],
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
    coreRoutes: [
      {
        id: "profession:mounted-soldier:core",
        label: "Learning to fight from the saddle",
        groupIds: ["M11"],
      },
    ],
    groups: [
      { groupId: "M11", route: "Learning to fight from the saddle" },
      { groupId: "M12", route: "Lance and troop drill" },
      { groupId: "M01", route: "Sidearm and close-combat drill" },
      { groupId: "M06", route: "Repeated service in the field" },
    ],
    directRoute: "Taught directly in the troop lines",
    skillIds: ["skill:animal-handling"],
  },
  {
    code: "P24",
    id: "profession:military-scout",
    name: "Military Scout",
    coreRoutes: [
      {
        id: "profession:military-scout:core",
        label: "Reconnaissance instruction",
        groupIds: ["F33"],
      },
    ],
    groups: [
      { groupId: "F33", route: "Reconnaissance instruction" },
      { groupId: "G04", route: "Working alone forward of the force" },
      { groupId: "M01", route: "Fighting instruction for a scout" },
      { groupId: "M06", route: "Repeated service forward of the force" },
    ],
    directRoute: "Taught directly by the scouts one serves with",
    skillIds: ["skill:tracking"],
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
    coreRoutes: [
      {
        id: "profession:military-commander:core",
        label: "Mentored unit command",
        groupIds: ["G09"],
      },
    ],
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
        groups: [
          { groupId: "M11", route: "Commanding from the saddle" },
          { groupId: "M12", route: "Lance and troop drill with the command" },
          { groupId: "M01", route: "Sidearm and close-combat drill" },
        ],
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
    coreRoutes: [
      {
        id: "profession:military-quartermaster:core",
        label: "Keeping a campaign supplied and recorded",
        groupIds: ["M07"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:campaign-planner:core",
        label: "Planning a campaign on a commander's staff",
        groupIds: ["M07"],
      },
    ],
    groups: [
      { groupId: "G09", route: "Service beside a commander" },
      { groupId: "M07", route: "Ordinary campaign staff service" },
      { groupId: "K09", route: "Studying the theatre" },
    ],
    directRoute: "Taught directly on the staff one serves",
    skillIds: ["mathematics"],
  },
  {
    code: "P28",
    id: "profession:siege-engineer",
    name: "Siege Engineer",
    coreRoutes: [
      {
        id: "profession:siege-engineer:core",
        label: "Ordinary siege-works apprenticeship",
        groupIds: ["M08"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:siege-engine-crew:core",
        label: "Ordinary engine-crew instruction",
        groupIds: ["M09"],
      },
    ],
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
    coreRoutes: [
      {
        id: "profession:physician:core",
        label: "Ordinary clinical apprenticeship",
        groupIds: ["G01"],
      },
    ],
    groups: [
      { groupId: "G01", route: "Ordinary clinical apprenticeship" },
      { groupId: "G02", route: "Preparing what one prescribes" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the practitioner one attends",
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
    skillIds: ["skill:pharmacy"],
    tracks: [
      {
        id: "profession:surgeon:civil",
        name: "Civil operative surgeon",
        coreRoutes: [
          {
            id: "profession:surgeon:civil:core",
            label: "Operating under a civil master surgeon",
            groupIds: ["G18"],
          },
        ],
        groups: [{ groupId: "G18", route: "Operative care practice" }],
      },
      {
        id: "profession:surgeon:field",
        name: "Field surgeon",
        coreRoutes: [
          {
            id: "profession:surgeon:field:core",
            label: "Operating with a force in the field",
            groupIds: ["F29"],
          },
        ],
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
    coreRoutes: [
      {
        id: "profession:nurse:core",
        label: "Ordinary attendance apprenticeship",
        groupIds: ["K14"],
      },
    ],
    groups: [
      { groupId: "K14", route: "Ordinary attendance apprenticeship" },
      { groupId: "G01", route: "Attendance under a practitioner" },
      { groupId: "G02", route: "Preparing what the patient is given" },
      { groupId: "C10", route: "Feeding and dosing the sick household" },
    ],
    directRoute: "Taught directly at the bedside",
    skillIds: ["skill:insight"],
  },
  {
    code: "P33",
    id: "profession:birth-attendant",
    name: "Birth Attendant and Midwife",
    coreRoutes: [
      {
        id: "profession:birth-attendant:core",
        label: "Ordinary birth-attendance apprenticeship",
        groupIds: ["K15"],
      },
    ],
    groups: [
      { groupId: "K15", route: "Ordinary birth-attendance apprenticeship" },
      { groupId: "G02", route: "Preparing remedies for mother and child" },
      { groupId: "K14", route: "Continuing attendance after the birth" },
    ],
    directRoute: "Taught directly by the attendant one accompanies",
    skillIds: ["skill:insight", "skill:religion"],
    note:
      "Closes the approved catalogue's only zero-base-Skill package and applies the approved " +
      "Medicine -> Obstetrics correction (#231) by supplying the immediate parent inside the same practice.",
  },
  {
    code: "P34",
    id: "profession:veterinary-practitioner",
    name: "Veterinary Practitioner",
    coreRoutes: [
      {
        id: "profession:veterinary-practitioner:core",
        label: "Ordinary stock-medicine apprenticeship",
        groupIds: ["K13"],
      },
    ],
    groups: [
      { groupId: "K13", route: "Ordinary stock-medicine apprenticeship" },
      { groupId: "G02", route: "Preparing animal remedies" },
      { groupId: "F05", route: "Working among kept stock" },
    ],
    directRoute: "Taught directly among the stock one treats",
    skillIds: ["skill:animal-lore"],
  },
  {
    code: "P35",
    id: "profession:remedy-maker",
    name: "Herbalist and Remedy Maker",
    coreRoutes: [
      {
        id: "profession:remedy-maker:core",
        label: "Ordinary plant-remedy apprenticeship",
        groupIds: ["G02"],
      },
    ],
    groups: [
      { groupId: "G02", route: "Ordinary plant-remedy apprenticeship" },
      { groupId: "F23", route: "Still-room practice" },
      { groupId: "K12", route: "Comparing what is collected" },
    ],
    directRoute: "Taught directly in the remedy maker's shop",
    skillIds: ["skill:first-aid", "skill:survival"],
  },
  {
    code: "P36",
    id: "profession:smith",
    name: "Smith and Weaponsmith",
    coreRoutes: [
      {
        id: "profession:smith:core",
        label: "Ironmaking and forge apprenticeship",
        groupIds: ["F24"],
      },
    ],
    groups: [
      { groupId: "F24", route: "Ironmaking and forge apprenticeship" },
      { groupId: "F25", route: "Weapon-forge and servicing apprenticeship" },
      { groupId: "F26", route: "Armor workshop practice" },
      { groupId: "C02", route: "Master's shop with apprentices" },
    ],
  },
  {
    code: "P37",
    id: "profession:smelter",
    name: "Smelter",
    coreRoutes: [
      {
        id: "profession:smelter:core",
        label: "Ordinary furnace apprenticeship",
        groupIds: ["F24"],
      },
    ],
    groups: [
      { groupId: "F24", route: "Ordinary furnace apprenticeship" },
      { groupId: "C07", route: "Working with the extraction face" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
  },
  {
    code: "P38",
    id: "profession:armorer",
    name: "Armorer",
    coreRoutes: [
      {
        id: "profession:armorer:core",
        label: "Ordinary armor workshop apprenticeship",
        groupIds: ["F26"],
      },
    ],
    groups: [
      { groupId: "F26", route: "Ordinary armor workshop apprenticeship" },
      { groupId: "F25", route: "Weapon-forge and servicing work" },
      { groupId: "C04", route: "Hide and strap work for fittings" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
  },
  {
    code: "P39",
    id: "profession:carpenter",
    name: "Carpenter",
    coreRoutes: [
      {
        id: "profession:carpenter:core",
        label: "Ordinary timber apprenticeship",
        groupIds: ["F27"],
      },
    ],
    groups: [
      { groupId: "F27", route: "Ordinary timber apprenticeship" },
      { groupId: "C03", route: "Working on building sites" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
  },
  {
    code: "P40",
    id: "profession:shipbuilder",
    name: "Shipbuilder",
    coreRoutes: [
      {
        id: "profession:shipbuilder:core",
        label: "Ordinary yard apprenticeship",
        groupIds: ["F03"],
      },
    ],
    groups: [
      { groupId: "F03", route: "Ordinary yard apprenticeship" },
      { groupId: "F27", route: "Timber mechanism work in the yard" },
      { groupId: "C03", route: "Setting out and running the yard" },
    ],
    directRoute: "Taught directly in the yard",
    skillIds: ["ropework", "skill:appraisal"],
  },
  {
    code: "P41",
    id: "profession:sailmaker",
    name: "Sailmaker",
    coreRoutes: [
      {
        id: "profession:sailmaker:core",
        label: "Ordinary sail-loft apprenticeship",
        groupIds: ["C09"],
      },
    ],
    groups: [
      { groupId: "C09", route: "Ordinary sail-loft apprenticeship" },
      { groupId: "F02", route: "Cloth work behind the canvas" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
  },
  {
    code: "P42",
    id: "profession:spinner-weaver",
    name: "Spinner and Weaver",
    coreRoutes: [
      {
        id: "profession:spinner-weaver:core",
        label: "Ordinary fibre-to-cloth apprenticeship",
        groupIds: ["F02"],
      },
    ],
    groups: [
      { groupId: "F02", route: "Ordinary fibre-to-cloth apprenticeship" },
      { groupId: "C05", route: "Making up what is woven" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the wheel and the loom",
    skillIds: ["ropework"],
    specializationIds: ["spec:cordage-ropemaking"],
  },
  {
    code: "P43",
    id: "profession:tailor",
    name: "Tailor",
    coreRoutes: [
      {
        id: "profession:tailor:core",
        label: "Ordinary garment apprenticeship",
        groupIds: ["C05"],
      },
    ],
    groups: [
      { groupId: "C05", route: "Ordinary garment apprenticeship" },
      { groupId: "F02", route: "Cloth work behind the garment" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the cutting shop",
    skillIds: ["skill:customs"],
  },
  {
    code: "P44",
    id: "profession:leatherworker",
    name: "Leatherworker",
    coreRoutes: [
      {
        id: "profession:leatherworker:core",
        label: "Ordinary leather apprenticeship",
        groupIds: ["C04"],
      },
    ],
    groups: [
      { groupId: "C04", route: "Ordinary leather apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the bench",
    skillIds: ["tailoring", "skill:armoring"],
  },
  {
    code: "P45",
    id: "profession:potter",
    name: "Potter",
    coreRoutes: [
      {
        id: "profession:potter:core",
        label: "Ordinary ceramic apprenticeship",
        groupIds: ["F21"],
      },
    ],
    groups: [
      { groupId: "F21", route: "Ordinary ceramic apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the wheel and the kiln",
    skillIds: ["skill:visual-art", "skill:masonry"],
  },
  {
    code: "P46",
    id: "profession:mason",
    name: "Mason",
    coreRoutes: [
      {
        id: "profession:mason:core",
        label: "Ordinary stone apprenticeship",
        groupIds: ["C06"],
      },
    ],
    groups: [
      { groupId: "C06", route: "Ordinary stone apprenticeship" },
      { groupId: "C03", route: "Running the trades on site" },
      { groupId: "F28", route: "Setting out a building" },
    ],
    directRoute: "Taught directly on the site and at the banker",
    skillIds: ["skill:appraisal"],
  },
  {
    code: "P47",
    id: "profession:miner",
    name: "Miner and Quarry Worker",
    coreRoutes: [
      {
        id: "profession:miner:core",
        label: "Ordinary extraction apprenticeship",
        groupIds: ["C07"],
      },
    ],
    groups: [
      { groupId: "C07", route: "Ordinary extraction apprenticeship" },
      { groupId: "F24", route: "Feeding the furnace" },
    ],
    directRoute: "Taught directly at the face",
    skillIds: ["ropework", "skill:appraisal"],
  },
  {
    code: "P48",
    id: "profession:millwright",
    name: "Millwright and Mechanician",
    coreRoutes: [
      {
        id: "profession:millwright:core",
        label: "Ordinary millwright apprenticeship",
        groupIds: ["F27"],
      },
    ],
    groups: [
      { groupId: "F27", route: "Ordinary millwright apprenticeship" },
      { groupId: "C03", route: "Installing on site" },
    ],
    directRoute: "Taught directly at the mill and on installation",
    skillIds: ["mathematics", "ropework"],
  },
  {
    code: "P49",
    id: "profession:building-designer",
    name: "Building Designer",
    coreRoutes: [
      {
        id: "profession:building-designer:core",
        label: "Ordinary design apprenticeship",
        groupIds: ["F28"],
      },
    ],
    groups: [
      { groupId: "F28", route: "Ordinary design apprenticeship" },
      { groupId: "C03", route: "Running the trades on site" },
      { groupId: "F01", route: "Measuring and drawing the site oneself" },
    ],
    directRoute: "Taught directly in the design office and on site",
    skillIds: ["mathematics", "skill:administration"],
    specializationIds: ["spec:fortification"],
  },
  {
    code: "P50",
    id: "profession:surveyor-mapmaker",
    name: "Surveyor and Mapmaker",
    coreRoutes: [
      {
        id: "profession:surveyor-mapmaker:core",
        label: "Ordinary surveying apprenticeship",
        groupIds: ["F01"],
      },
    ],
    groups: [
      { groupId: "F01", route: "Ordinary surveying apprenticeship" },
      { groupId: "K09", route: "Assembling what is known of the country" },
      { groupId: "G04", route: "Working away from settlement" },
    ],
    directRoute: "Taught directly in the field and at the drawing table",
    skillIds: ["mathematics", "astronomy"],
  },
  {
    code: "P51",
    id: "profession:locksmith",
    name: "Locksmith",
    coreRoutes: [
      {
        id: "profession:locksmith:core",
        label: "Ordinary locksmith apprenticeship",
        groupIds: ["C13"],
      },
    ],
    groups: [
      { groupId: "C13", route: "Ordinary locksmith apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly at the bench",
    skillIds: ["skill:lockpicking"],
  },
  {
    code: "P52",
    id: "profession:trapmaker",
    name: "Trapmaker",
    coreRoutes: [
      {
        id: "profession:trapmaker:core",
        label: "Ordinary trapmaking apprenticeship",
        groupIds: ["C14"],
      },
    ],
    groups: [
      { groupId: "C14", route: "Ordinary trapmaking apprenticeship" },
      { groupId: "C13", route: "Mechanism workshop practice" },
    ],
    directRoute: "Taught directly at the bench and on the line",
    skillIds: ["carpentry", "ropework", "skill:animal-lore"],
  },
  {
    code: "P53",
    id: "profession:cook",
    name: "Cook",
    coreRoutes: [
      {
        id: "profession:cook:core",
        label: "Ordinary kitchen and brewhouse apprenticeship",
        groupIds: ["C10"],
      },
    ],
    groups: [
      { groupId: "C10", route: "Ordinary kitchen and brewhouse apprenticeship" },
      { groupId: "C01", route: "Buying for the kitchen as a trained trade" },
    ],
    directRoute: "Taught directly in the kitchen it serves",
    skillIds: ["skill:customs", "skill:plant-lore"],
    specializationIds: ["spec:baking", "spec:court-cookery"],
  },
  {
    code: "P54",
    id: "profession:brewer",
    name: "Brewer",
    coreRoutes: [
      {
        id: "profession:brewer:core",
        label: "Ordinary brewhouse apprenticeship",
        groupIds: ["C10"],
      },
    ],
    groups: [
      { groupId: "C10", route: "Ordinary brewhouse apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the brewhouse",
    skillIds: ["skill:farming", "skill:plant-lore"],
  },
  {
    code: "P55",
    id: "profession:vintner",
    name: "Vintner",
    coreRoutes: [
      {
        id: "profession:vintner:core",
        label: "Ordinary vineyard apprenticeship",
        groupIds: ["C11"],
      },
    ],
    groups: [
      { groupId: "C11", route: "Ordinary vineyard apprenticeship" },
      { groupId: "C01", route: "Workshop apprenticeship" },
    ],
    directRoute: "Taught directly in the vineyard and the cellar",
    skillIds: ["skill:plant-lore", "skill:weather-lore"],
  },
  {
    code: "P56",
    id: "profession:distiller",
    name: "Distiller",
    coreRoutes: [
      {
        id: "profession:distiller:core",
        label: "Ordinary still-room apprenticeship",
        groupIds: ["F23"],
      },
    ],
    groups: [
      { groupId: "F23", route: "Ordinary still-room apprenticeship" },
      { groupId: "C10", route: "Brewhouse work behind the still" },
      { groupId: "C15", route: "Service in an alchemical workshop" },
    ],
    directRoute: "Taught directly at the still",
    skillIds: ["skill:plant-lore", "mechanics"],
  },
  {
    code: "P57",
    id: "profession:alchemist",
    name: "Alchemist",
    coreRoutes: [
      {
        id: "profession:alchemist:core",
        label: "Ordinary alchemical apprenticeship",
        groupIds: ["C15"],
      },
    ],
    groups: [
      { groupId: "C15", route: "Ordinary alchemical apprenticeship" },
      { groupId: "K01", route: "Learned study of the tradition" },
      { groupId: "K02", route: "Argument about the nature of matter" },
    ],
    directRoute: "Taught directly in the alchemist's workshop",
    skillIds: ["skill:plant-lore", "skill:smelting"],
  },
  {
    code: "P58",
    id: "profession:clerk-steward",
    name: "Clerk and Steward",
    coreRoutes: [
      {
        id: "profession:clerk-steward:core",
        label: "Ordinary records-office service",
        groupIds: ["G11"],
      },
    ],
    groups: [
      { groupId: "G11", route: "Ordinary records-office service" },
      { groupId: "K11", route: "Service inside a court or great household" },
      { groupId: "K21", route: "Accounts, measures and the estate" },
    ],
    directRoute: "Taught directly in the establishment one serves",
    skillIds: ["skill:law", "skill:appraisal"],
    specializationIds: ["spec:court-administration"],
  },
  {
    code: "P59",
    id: "profession:legal-practitioner",
    name: "Legal Practitioner and Advocate",
    coreRoutes: [
      {
        id: "profession:legal-practitioner:core",
        label: "Ordinary legal apprenticeship",
        groupIds: ["F13"],
      },
    ],
    groups: [
      { groupId: "F13", route: "Ordinary legal apprenticeship" },
      { groupId: "G11", route: "Service in a records office" },
      { groupId: "F15", route: "Study of the older record" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the advocate one reads with",
    skillIds: ["skill:customs", "skill:insight"],
  },
  {
    code: "P60",
    id: "profession:envoy",
    name: "Envoy",
    coreRoutes: [
      {
        id: "profession:envoy:core",
        label: "Ordinary negotiation apprenticeship",
        groupIds: ["G10"],
      },
    ],
    groups: [
      { groupId: "G10", route: "Ordinary negotiation apprenticeship" },
      { groupId: "K11", route: "Service inside a court" },
      { groupId: "G05", route: "Travelling to the other party" },
    ],
    directRoute: "Taught directly in the service one is entrusted with",
    skillIds: ["skill:law"],
    specializationIds: ["spec:courtly-protocol"],
  },
  {
    code: "P61",
    id: "profession:mediator",
    name: "Mediator and Community Convenor",
    coreRoutes: [
      {
        id: "profession:mediator:core",
        label: "Ordinary convening practice",
        groupIds: ["G10"],
      },
    ],
    groups: [
      { groupId: "G10", route: "Ordinary convening practice" },
      { groupId: "F14", route: "Speaking from memory before the community" },
      { groupId: "K07", route: "Instructing those who will convene after" },
    ],
    directRoute: "Taught directly in the community one convenes",
    skillIds: ["skill:law"],
  },
  {
    code: "P62",
    id: "profession:credit-practitioner",
    name: "Banker and Credit Practitioner",
    coreRoutes: [
      {
        id: "profession:credit-practitioner:core",
        label: "Ordinary credit-house apprenticeship",
        groupIds: ["F12"],
      },
    ],
    groups: [
      { groupId: "F12", route: "Ordinary credit-house apprenticeship" },
      { groupId: "G12", route: "Trading alongside lending" },
      { groupId: "G11", route: "Keeping the house's records" },
    ],
    directRoute: "Taught directly in the credit house",
    skillIds: ["skill:law", "mathematics"],
  },
  {
    code: "P63",
    id: "profession:political-agent",
    name: "Political Agent and Council Representative",
    coreRoutes: [
      {
        id: "profession:political-agent:core",
        label: "Ordinary council practice",
        groupIds: ["G10"],
      },
    ],
    groups: [
      { groupId: "G10", route: "Ordinary council practice" },
      { groupId: "K11", route: "Service among those who decide" },
      { groupId: "G14", route: "Working the district for support" },
    ],
    directRoute: "Taught directly in the council one serves",
    skillIds: ["skill:law"],
  },
  {
    code: "P64",
    id: "profession:teacher",
    name: "Teacher",
    coreRoutes: [
      {
        id: "profession:teacher:core",
        label: "Ordinary instruction apprenticeship",
        groupIds: ["K07"],
      },
    ],
    groups: [
      { groupId: "K07", route: "Ordinary instruction apprenticeship" },
      { groupId: "K01", route: "Learned study of what is taught" },
      { groupId: "F14", route: "Delivering from memory" },
    ],
    directRoute: "Taught directly by the master one assists",
    skillIds: ["history", "philosophy"],
  },
  {
    code: "P65",
    id: "profession:scribe",
    name: "Scribe and Copyist",
    coreRoutes: [
      {
        id: "profession:scribe:core",
        label: "Ordinary records-office service",
        groupIds: ["G11"],
        blockedBy:
          "#113 — the defining Written Tradition core cannot be authored until contextual written-tradition availability is resolved",
      },
    ],
    groups: [
      { groupId: "G11", route: "Ordinary records-office service" },
      { groupId: "F15", route: "Reading and copying older hands" },
      { groupId: "K01", route: "Learned study behind the copying" },
    ],
    directRoute: "Taught directly in the writing room",
    skillIds: ["skill:visual-art"],
    note:
      "BLOCKED DEPENDENCY: the defining Written Tradition core remains unresolved under #113 and is " +
      "deliberately not supplied here. This package must not be presented as universal literacy.",
  },
  {
    code: "P66",
    id: "profession:translator-interpreter",
    name: "Translator and Interpreter",
    coreRoutes: [
      {
        id: "profession:translator-interpreter:core",
        label: "Ordinary interpreting apprenticeship",
        groupIds: ["K08"],
      },
    ],
    groups: [
      { groupId: "K08", route: "Ordinary interpreting apprenticeship" },
      { groupId: "F15", route: "Working from written originals" },
      { groupId: "K01", route: "Learned study of the languages' matter" },
    ],
    directRoute: "Taught directly in the service one interprets for",
    skillIds: ["skill:oratory"],
    note: "The spoken languages themselves remain separate contextual competencies and are not granted here.",
  },
  {
    code: "P67",
    id: "profession:historian",
    name: "Historian and Genealogist",
    coreRoutes: [
      {
        id: "profession:historian:core",
        label: "Ordinary historical study",
        groupIds: ["F15"],
      },
    ],
    groups: [
      { groupId: "F15", route: "Ordinary historical study" },
      { groupId: "K10", route: "Service in a heraldic office" },
      { groupId: "K01", route: "Learned study of the art" },
    ],
    directRoute: "Taught directly by the scholar one reads with",
    skillIds: ["skill:research"],
    specializationIds: ["spec:genealogy"],
  },
  {
    code: "P68",
    id: "profession:mathematical-practitioner",
    name: "Mathematical Practitioner",
    coreRoutes: [
      {
        id: "profession:mathematical-practitioner:core",
        label: "Ordinary applied-calculation apprenticeship",
        groupIds: ["K21"],
      },
    ],
    groups: [
      { groupId: "K21", route: "Ordinary applied-calculation apprenticeship" },
      { groupId: "K01", route: "Learned study of method" },
      { groupId: "K03", route: "Calculation applied to the sky" },
    ],
  },
  {
    code: "P69",
    id: "profession:philosopher",
    name: "Philosopher",
    coreRoutes: [
      {
        id: "profession:philosopher:core",
        label: "Ordinary philosophical study",
        groupIds: ["K02"],
      },
    ],
    groups: [
      { groupId: "K02", route: "Ordinary philosophical study" },
      { groupId: "K01", route: "Learned study of the tradition" },
      { groupId: "K07", route: "Teaching within a school" },
    ],
    directRoute: "Taught directly within the school",
    skillIds: ["history"],
  },
  {
    code: "P70",
    id: "profession:astronomer",
    name: "Astronomer",
    coreRoutes: [
      {
        id: "profession:astronomer:core",
        label: "Ordinary observational apprenticeship",
        groupIds: ["K03"],
      },
    ],
    groups: [
      { groupId: "K03", route: "Ordinary observational apprenticeship" },
      { groupId: "K01", route: "Learned study of the record" },
      { groupId: "K02", route: "Argument about what is observed" },
    ],
    directRoute: "Taught directly at the instrument and the record",
    skillIds: ["skill:celestial-navigation"],
  },
  {
    code: "P71",
    id: "profession:astrologer",
    name: "Astrologer",
    coreRoutes: [
      {
        id: "profession:astrologer:core",
        label: "Ordinary astrological apprenticeship",
        groupIds: ["K04"],
      },
    ],
    groups: [
      { groupId: "K04", route: "Ordinary astrological apprenticeship" },
      { groupId: "K03", route: "Observation behind the reading" },
      { groupId: "K01", route: "Learned study of the tradition" },
    ],
    directRoute: "Taught directly by the astrologer one reads with",
    skillIds: ["divination", "skill:insight"],
  },
  {
    code: "P72",
    id: "profession:naturalist",
    name: "Naturalist",
    coreRoutes: [
      {
        id: "profession:naturalist:core",
        label: "Ordinary field-study apprenticeship",
        groupIds: ["K12"],
      },
    ],
    groups: [
      { groupId: "K12", route: "Ordinary field-study apprenticeship" },
      { groupId: "G04", route: "Working away from settlement" },
      { groupId: "K01", route: "Learned study of the record" },
    ],
    directRoute: "Taught directly in the field and the collection",
    skillIds: ["skill:geography", "skill:visual-art"],
  },
  {
    code: "P73",
    id: "profession:geographer",
    name: "Geographer",
    coreRoutes: [
      {
        id: "profession:geographer:core",
        label: "Ordinary chorographic study",
        groupIds: ["K09"],
      },
    ],
    groups: [
      { groupId: "K09", route: "Ordinary chorographic study" },
      { groupId: "F01", route: "Measuring the ground oneself" },
      { groupId: "G04", route: "Travelling what one describes" },
    ],
    directRoute: "Taught directly by the geographer one works with",
    skillIds: ["astronomy", "skill:customs"],
  },
  {
    code: "P74",
    id: "profession:religious-practitioner",
    name: "Religious Practitioner",
    coreRoutes: [
      {
        id: "profession:religious-practitioner:core",
        label: "Ordinary vocation apprenticeship",
        groupIds: ["K06"],
      },
    ],
    groups: [
      { groupId: "K06", route: "Ordinary vocation apprenticeship" },
      { groupId: "K01", route: "Learned study of the tradition" },
      { groupId: "F14", route: "Delivering before the congregation" },
      { groupId: "K22", route: "Contemplative discipline within the vocation" },
    ],
  },
  {
    code: "P75",
    id: "profession:diviner",
    name: "Diviner",
    coreRoutes: [
      {
        id: "profession:diviner:core",
        label: "Ordinary divinatory apprenticeship",
        groupIds: ["K05"],
      },
    ],
    groups: [
      { groupId: "K05", route: "Ordinary divinatory apprenticeship" },
      { groupId: "K04", route: "Celestial method within the practice" },
      { groupId: "K22", route: "Contemplative discipline of the practice" },
    ],
  },
  {
    code: "P76",
    id: "profession:herald",
    name: "Herald",
    coreRoutes: [
      {
        id: "profession:herald:core",
        label: "Ordinary heraldic office apprenticeship",
        groupIds: ["K10"],
      },
    ],
    groups: [
      { groupId: "K10", route: "Ordinary heraldic office apprenticeship" },
      { groupId: "F14", route: "Proclamation from memory" },
      { groupId: "K11", route: "Service inside the court" },
    ],
    directRoute: "Taught directly in the heraldic office",
    skillIds: ["skill:visual-art"],
    specializationIds: ["spec:genealogy"],
    note:
      "Closes the recorded Herald parent-access gaps: History for Genealogy and Customs for Courtly " +
      "Protocol are supplied by K10 inside the family's own envelope.",
  },
  {
    code: "P77",
    id: "profession:musician",
    name: "Musician and Singer",
    coreRoutes: [
      {
        id: "profession:musician:core",
        label: "Ordinary song apprenticeship",
        groupIds: ["F17"],
      },
    ],
    groups: [
      { groupId: "F17", route: "Ordinary song apprenticeship" },
      { groupId: "F19", route: "Composing the matter one performs" },
      { groupId: "F18", route: "Performing with players and dancers" },
    ],
    directRoute: "Taught directly by the players one performs with",
    skillIds: ["skill:mnemonics"],
    specializationIds: ["spec:music-composition"],
  },
  {
    code: "P78",
    id: "profession:stage-performer",
    name: "Actor and Dancer",
    coreRoutes: [
      {
        id: "profession:stage-performer:core",
        label: "Ordinary company apprenticeship",
        groupIds: ["F18"],
      },
    ],
    groups: [
      { groupId: "F18", route: "Ordinary company apprenticeship" },
      { groupId: "F17", route: "Music and song in the company" },
      { groupId: "F19", route: "The matter the company performs" },
    ],
    directRoute: "Taught directly by the company",
    skillIds: ["skill:athletics", "skill:mnemonics"],
  },
  {
    code: "P79",
    id: "profession:visual-artist",
    name: "Visual Artist and Sculptor",
    coreRoutes: [
      {
        id: "profession:visual-artist:core",
        label: "Ordinary workshop apprenticeship",
        groupIds: ["F20"],
      },
    ],
    groups: [
      { groupId: "F20", route: "Ordinary workshop apprenticeship" },
      { groupId: "F21", route: "Modelling and firing" },
      { groupId: "C01", route: "Workshop trade practice" },
    ],
    directRoute: "Taught directly in the workshop",
    skillIds: ["skill:masonry"],
  },
  {
    code: "P80",
    id: "profession:storyteller",
    name: "Storyteller and Poet",
    coreRoutes: [
      {
        id: "profession:storyteller:core",
        label: "Ordinary oral composition apprenticeship",
        groupIds: ["F19"],
      },
    ],
    groups: [
      { groupId: "F19", route: "Ordinary oral composition apprenticeship" },
      { groupId: "F14", route: "Holding and delivering the matter" },
      { groupId: "F17", route: "Singing what one composes" },
    ],
    directRoute: "Taught directly by the teller one learns from",
    skillIds: ["history"],
  },
  {
    code: "P81",
    id: "profession:athlete",
    name: "Athlete and Physical Performer",
    coreRoutes: [
      {
        id: "profession:athlete:core",
        label: "Ordinary athletic training",
        groupIds: ["F04"],
      },
    ],
    groups: [
      { groupId: "F04", route: "Ordinary athletic training" },
      { groupId: "F18", route: "Performing before an audience" },
    ],
    directRoute: "Taught directly by the trainer one works under",
    skillIds: ["brawling"],
  },
  {
    code: "P82",
    id: "profession:weapon-instructor",
    name: "Weapon Instructor",
    coreRoutes: [
      {
        id: "profession:weapon-instructor:core",
        label: "Ordinary arms-instruction apprenticeship",
        groupIds: ["M10"],
      },
    ],
    groups: [{ groupId: "M10", route: "Ordinary arms-instruction apprenticeship" }],
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
    coreRoutes: [
      {
        id: "profession:gambler:core",
        label: "Ordinary gaming-house practice",
        groupIds: ["K17"],
      },
    ],
    groups: [
      { groupId: "K17", route: "Ordinary gaming-house practice" },
      { groupId: "G14", route: "Knowing the house and the players" },
      { groupId: "K18", route: "Standing in an illicit milieu" },
      { groupId: "G16", route: "Passing as what one is not" },
    ],
    directRoute: "Taught directly at the tables",
    skillIds: ["mathematics"],
  },
  {
    code: "P84",
    id: "profession:diver",
    name: "Diver and Water Worker",
    coreRoutes: [
      {
        id: "profession:diver:core",
        label: "Ordinary diving apprenticeship",
        groupIds: ["K20"],
      },
    ],
    groups: [
      { groupId: "K20", route: "Ordinary diving apprenticeship" },
      { groupId: "N01", route: "Working from a boat" },
    ],
    directRoute: "Taught directly on the working line",
    skillIds: ["skill:athletics", "skill:appraisal"],
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
 * Every canonical Civilization gets a rollable spoken competency, and a rollable written one unless
 * it is explicitly authored as having no writing; written competence is what a reading roll is made
 * against.
 *
 * Product Owner naming ruling: use the canonical Glantri name where one is established, and the
 * appropriate historical name where none is. Do not invent Glantri names, and do not assert
 * linguistic descent. The previous revision's invented names — Kethran, Old Latian, Palace Scyrian,
 * Kaldan, Aspardic, and the Harbour, Hill, Palace, Wedge and Chancery scripts — are withdrawn.
 */
export const competencyContentV2CivilizationLanguages: readonly V2CivilizationLanguage[] = [
  {
    civilizationId: "scandia",
    civilizationName: "Scandia",
    spokenName: "Spoken Scandian",
    existingSpokenCompetencyId: "spoken:scandian",
    writtenName: "Written Scandian in runes",
    requiresProductOwnerNamingRuling: false,
    note: "Both names are already Glantri names. Only the missing written competency is added.",
  },
  {
    civilizationId: "iest",
    civilizationName: "Iest",
    spokenName: "Spoken Common",
    existingSpokenCompetencyId: "spoken:common",
    writtenName: "Written Common",
    requiresProductOwnerNamingRuling: true,
    note:
      "Common is an established Glantri name, so the written competency takes it directly and no script " +
      "name is invented. The script, register and conventions of the Common written tradition remain an " +
      "open case in the approved gap report.",
  },
  {
    civilizationId: "thyatis",
    civilizationName: "Thyatis",
    spokenName: "Spoken Common",
    existingSpokenCompetencyId: "spoken:common",
    writtenName: "Written Common",
    requiresProductOwnerNamingRuling: true,
    note: "Shares the Common written tradition; the same open case applies.",
  },
  {
    civilizationId: "glantri",
    civilizationName: "Glantri",
    spokenName: "Spoken Common",
    existingSpokenCompetencyId: "spoken:common",
    writtenName: "Written Common",
    requiresProductOwnerNamingRuling: true,
    note: "Shares the Common written tradition; Old Common remains an authored optional second tongue.",
  },
  {
    civilizationId: "scyria",
    civilizationName: "Scyria",
    spokenName: "Spoken Old Common",
    existingSpokenCompetencyId: "spoken:old-common",
    writtenName: "Written Old Common",
    requiresProductOwnerNamingRuling: true,
    note:
      "Old Common is an established Glantri name and no script name is invented. The Old Common written " +
      "identity must still be defined without inferring equivalence with Common.",
  },
  {
    civilizationId: "byzantine_empire",
    civilizationName: "Byzantine Empire",
    spokenName: "Spoken Old Common",
    existingSpokenCompetencyId: "spoken:old-common",
    writtenName: "Written Old Common",
    requiresProductOwnerNamingRuling: true,
    note: "The Civilization name itself is a real-world analogue; renaming it is outside this task's scope.",
  },
  {
    civilizationId: "lankhmar",
    civilizationName: "Lankhmar",
    spokenName: "Spoken Lankhmaran",
    existingSpokenCompetencyId: "spoken:phoenician",
    writtenName: "Written Lankhmaran in the Phoenician script",
    existingWrittenCompetencyId: "written:phoenician:phoenician",
    replacesAnalogueSpokenName: "Spoken Phoenician",
    requiresProductOwnerNamingRuling: false,
    note:
      "Lankhmar is an established Glantri name, so the spoken language takes it directly. The script has " +
      "no established Glantri name, so it keeps its historical one; the invented Harbour Hand is withdrawn.",
  },
  {
    civilizationId: "olog",
    civilizationName: "Olog",
    spokenName: "Spoken Ologian",
    existingSpokenCompetencyId: "spoken:ologian",
    writtenName: "Written Ologian in Church Ologian",
    existingWrittenCompetencyId: "written:ologian:church-ologian",
    requiresProductOwnerNamingRuling: false,
    note:
      "Names already complete in the approved catalogue and carried forward unchanged. FLAGGED FOR LATER " +
      "CORRECTION, deliberately not corrected here: Olog appears modelled from a historical stage somewhat " +
      "later and more advanced than the intended Glantri Olog society. That is a separate follow-up.",
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
    writtenName: "Written N'kolian",
    requiresProductOwnerNamingRuling: true,
    note:
      "N'kolian is an established Glantri name, so the written competency takes it directly and the " +
      "invented Royal N'kolian register is withdrawn. Register and script support remain an open case.",
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
    spokenName: "Spoken Scythian",
    existingSpokenCompetencyId: "spoken:scythian",
    writtenName: null,
    requiresProductOwnerNamingRuling: false,
    note:
      "No established Glantri name exists, so the historical name stands. The invented Kethran is withdrawn. " +
      "Authored as having no written tradition.",
  },
  {
    civilizationId: "latial_chiefdoms",
    civilizationName: "Latial Chiefdoms",
    spokenName: "Spoken Old Latin",
    existingSpokenCompetencyId: "spoken:old-latin",
    writtenName: "Written Old Latin in the Old Italic script",
    requiresProductOwnerNamingRuling: false,
    note:
      "Historical names stand; the invented Old Latian and Hill Script are withdrawn. The written " +
      "competency is newly added so that a reading roll has something to roll against.",
  },
  {
    civilizationId: "mycenaean_greece",
    civilizationName: "Mycenaean Greece",
    spokenName: "Spoken Mycenaean Greek",
    existingSpokenCompetencyId: "spoken:mycenaean-greek",
    writtenName: "Written Mycenaean Greek in Linear B",
    requiresProductOwnerNamingRuling: false,
    note:
      "Historical names stand. The invented Palace Scyrian is withdrawn, and with it the implied descent " +
      "from Scyria, which was never an established Glantri fact.",
  },
  {
    civilizationId: "sumer",
    civilizationName: "Sumer",
    spokenName: "Spoken Sumerian",
    existingSpokenCompetencyId: "spoken:sumerian",
    writtenName: "Written Sumerian in Cuneiform",
    requiresProductOwnerNamingRuling: false,
    note:
      "Historical names stand; the invented Kaldan and Wedge Script are withdrawn. The written competency " +
      "is Sumerian written in Cuneiform specifically — the approved gap report's refusal of a universal " +
      "Cuneiform competence is respected, because the competency is tied to one language.",
  },
  {
    civilizationId: "achaemenid_persia",
    civilizationName: "Achaemenid Persia",
    spokenName: "Spoken Old Persian",
    existingSpokenCompetencyId: "spoken:old-persian",
    writtenName: "Written Imperial Aramaic",
    requiresProductOwnerNamingRuling: false,
    note:
      "Historical names stand; the invented Aspardic and Chancery Script are withdrawn. The spoken tongue " +
      "and the chancery written tradition are deliberately different languages here, which is what the " +
      "approved gap report asks for: the written competency is not a way of writing the spoken one.",
  },
];

/* ------------------------------------------------------------------------------------------ */
/* Direct-grant review (Product Owner revision)                                                 */
/* ------------------------------------------------------------------------------------------ */

/**
 * The first draft of this proposal was authored under breadth pressure: every ordinary path was
 * pushed to at least ten. The Product Owner has inverted that pressure — author coherent
 * occupational training first, then read breadth as a diagnostic. This record is the honest
 * accounting of which direct Profession Skill grants were added to reach a number and have now been
 * withdrawn, and which were kept because the Skill is genuinely part of the occupation.
 */
export interface V2DirectGrantDecision {
  skillId: string;
  /** Profession codes the grant was withdrawn from. */
  removedFrom: readonly string[];
  /** Profession codes that keep it, because it is genuinely taught there. */
  retainedIn: readonly string[];
  rationale: string;
}

export const competencyContentV2DirectGrantPolicy: readonly string[] = [
  "R1 — no generic instruction grant. Teaching is withdrawn wherever instructing others is not part of the occupation's own definition. Master artisans still reach it through C02, and Teachers through K07.",
  "R2 — no generic commerce top-up. Trade, Appraisal and Bargaining are withdrawn wherever a Learning Group already supplies the family's commercial practice, or where selling one's output is not itself a taught practice.",
  "R3 — no generic social polish. Customs is withdrawn wherever the curriculum has no social, ceremonial, courtly or cross-cultural element beyond ordinary life.",
  "R4 — no generic learned top-up. History, Philosophy, Politics, Religion, Geography, Mathematics, Mnemonics and Insight are withdrawn wherever a learned group already supplies the grounding and the Skill is not the family's own subject matter.",
  "R5 — no workshop garnish. Carpentry, Ropework, Mechanics and similar adjacent trades are withdrawn where they were decoration rather than taught craft, and kept where the material genuinely is the craft.",
  "R7 — a coherent cluster belongs in a Learning Group. Where a family's direct grants described a practice that is genuinely taught and practised together, they were moved into a group rather than left as exceptional routes: the Guard's watch duty into K24, the Thief's street theft into K25, the Diviner's and Religious Practitioner's contemplative discipline into K22, and the Weapon Instructor's salle into M10. Direct grants are exceptional occupational routes, not a breadth mechanism.",
  "R6 — a grant survives on coherence, never on arithmetic. Several retained grants leave their path at 7 or 8; that is an accepted outcome, not a defect to be corrected.",
];

export const competencyContentV2DirectGrantDecisions: readonly V2DirectGrantDecision[] = [
  {
    skillId: "skill:streetwise",
    removedFrom: ["P14"],
    retainedIn: [],
    rationale:
      "R7. Knowing whose district this is was never an exception for a guard; it is the substance of watch " +
      "duty, and it moved into K24 with the rest of it.",
  },
  {
    skillId: "skill:intimidation",
    removedFrom: ["P14"],
    retainedIn: [],
    rationale:
      "R7. Making someone stand down without drawing is taught on watch, not granted. Moved into K24. The " +
      "Enforcer keeps it through K23, where it is coercion rather than keeping order.",
  },
  {
    skillId: "skill:sleight-of-hand",
    removedFrom: ["P18"],
    retainedIn: [],
    rationale:
      "R7. The thief's hands are the trade, not an exception to it. Moved into K25 with Appraisal and " +
      "Climbing, and it is the immediate parent of the Pickpocketing access K25 now carries.",
  },
  {
    skillId: "meditation",
    removedFrom: ["P74", "P75"],
    retainedIn: [],
    rationale:
      "R7. Contemplative discipline is taught in houses and lineages that teach it alongside the memorised " +
      "corpus and the reading of people. That is K22, not two separate direct grants.",
  },
  {
    skillId: "weapon_maintenance",
    removedFrom: ["P82"],
    retainedIn: [],
    rationale: "R7. Keeping the salle's weapons is part of instructing in them. Moved into M10.",
  },
  {
    skillId: "battlefield_awareness",
    removedFrom: ["P24"],
    retainedIn: [],
    rationale:
      "R7. The scout now takes M06 outright. Reading a field is experiential, and the scout's working life " +
      "is exactly the repeated forward service M06 describes, so the route states what the grant asserted.",
  },
  {
    skillId: "skill:farming",
    removedFrom: ["P53"],
    retainedIn: ["P54"],
    rationale:
      "R5. Withdrawn from the cook: a kitchen buys its produce, it does not grow it. Retained for the " +
      "brewer, whose grain supply genuinely is part of the brewhouse year.",
  },
  {
    skillId: "skill:smithing",
    removedFrom: ["P48"],
    retainedIn: [],
    rationale:
      "R5. The millwright's ironwork is real but it is one of the trades C03 already offers on site, so " +
      "the route supplies it rather than a standing grant.",
  },
  {
    skillId: "skill:visual-art",
    removedFrom: ["P50"],
    retainedIn: ["P21", "P65", "P76"],
    rationale:
      "R5. Retained where the drawn or lettered hand is the occupation: the forger, the copyist and the " +
      "herald. The surveyor's draughtsmanship is Cartography, which F01 and K09 already teach.",
  },
  {
    skillId: "skill:teaching",
    removedFrom: [
      "P30",
      "P31",
      "P32",
      "P33",
      "P39",
      "P40",
      "P42",
      "P43",
      "P44",
      "P45",
      "P46",
      "P48",
      "P51",
      "P53",
      "P54",
      "P55",
      "P56",
      "P68",
      "P70",
      "P72",
      "P74",
      "P77",
      "P79",
      "P81",
      "P82",
    ],
    retainedIn: [],
    rationale:
      "R1/R7. Twenty-four families were told they taught apprentices purely to add a Skill. Instruction is " +
      "constitutive only for the Weapon Instructor, and that case is now the M10 arms-instruction practice " +
      "rather than a direct grant. The master artisan reaches it through C02 and the Teacher through K07.",
  },
  {
    skillId: "skill:trade",
    removedFrom: [
      "P37",
      "P38",
      "P39",
      "P41",
      "P42",
      "P43",
      "P44",
      "P45",
      "P51",
      "P53",
      "P54",
      "P55",
      "P56",
      "P58",
    ],
    retainedIn: [],
    rationale:
      "R2. Every occurrence was a craft Profession being told it also ran a trading business. Workshop " +
      "commerce is already the fixed content of C01 and C02, and the merchant Professions reach Trade " +
      "through G12.",
  },
  {
    skillId: "skill:customs",
    removedFrom: [
      "P12",
      "P21",
      "P30",
      "P35",
      "P64",
      "P65",
      "P77",
      "P78",
      "P79",
      "P80",
      "P81",
      "P82",
      "P83",
    ],
    retainedIn: ["P13", "P16", "P19", "P43", "P53", "P59", "P73"],
    rationale:
      "R3. Retained where convention is the subject: the travelling merchant and the geographer meet " +
      "other peoples' custom, the informant and the trickster work it, the tailor and the cook are judged " +
      "by what is proper to serve or to wear, and legal custom is the advocate's material.",
  },
  {
    skillId: "skill:appraisal",
    removedFrom: ["P05", "P19", "P34", "P35", "P52", "P56", "P57", "P65", "P18", "P53"],
    retainedIn: ["P40", "P46", "P47", "P58", "P84"],
    rationale:
      "R2/R7. Retained where judging worth is the work itself: the shipwright's and mason's material " +
      "selection, the miner's ore, the steward's estate, the diver's salvage. The thief's eye for loot " +
      "moved into K25 and the cook's buying into C01, in both cases as taught practice rather than a grant.",
  },
  {
    skillId: "skill:bargaining",
    removedFrom: ["P05", "P16", "P19", "P35", "P49", "P83", "P53"],
    retainedIn: [],
    rationale:
      "R2. No family now takes Bargaining directly. The cook's buying at market is real, but it is the " +
      "ordinary trained commerce C01 already teaches, so the cook takes the route rather than the grant.",
  },
  {
    skillId: "skill:administration",
    removedFrom: ["P50", "P60", "P61", "P63", "P64", "P66", "P76"],
    retainedIn: ["P49"],
    rationale:
      "R4. The court families now reach Administration through K11, where it belongs as daily court " +
      "service. Retained directly only for the building designer's site office.",
  },
  {
    skillId: "history",
    removedFrom: ["P61", "P63", "P66", "P71", "P73", "P74", "P77"],
    retainedIn: ["P64", "P69", "P80"],
    rationale:
      "R4. Retained where the past is the matter handled: what the teacher teaches, what the philosopher " +
      "argues from, what the storyteller tells.",
  },
  {
    skillId: "skill:politics",
    removedFrom: ["P27", "P59", "P62", "P67", "P69"],
    retainedIn: [],
    rationale:
      "R4. Political knowledge is reached through K11 where it is genuinely part of the service.",
  },
  {
    skillId: "skill:religion",
    removedFrom: ["P61", "P67", "P69", "P71", "P80"],
    retainedIn: ["P33"],
    rationale:
      "R4. Retained only for the birth attendant, where rite around birth is an attested part of the " +
      "practice rather than background knowledge.",
  },
  {
    skillId: "skill:geography",
    removedFrom: ["P10", "P60", "P66", "P67", "P70", "P80"],
    retainedIn: ["P03", "P12", "P72"],
    rationale:
      "R4. Retained where knowing the country is the service sold: the caravan guide, the courier, and the " +
      "naturalist's account of where things live.",
  },
  {
    skillId: "skill:mnemonics",
    removedFrom: ["P17", "P27", "P32", "P33", "P60", "P75"],
    retainedIn: ["P16", "P77", "P78"],
    rationale:
      "R4/R7. Retained where holding material without writing is the practice: the informant's ear, the " +
      "musician's and the player's repertoire. The diviner's trained memory moved into K22, where it sits " +
      "with the discipline that produces it.",
  },
  {
    skillId: "skill:insight",
    removedFrom: ["P62", "P64", "P74", "P80", "P75"],
    retainedIn: ["P32", "P33", "P59", "P71"],
    rationale:
      "R4/R7. Retained where reading the person in front of you is the work: the attendant, the midwife, " +
      "the advocate and the astrologer. The diviner reaches it through K22 instead.",
  },
  {
    skillId: "skill:animal-lore",
    removedFrom: ["P02", "P04", "P06", "P07", "P75"],
    retainedIn: ["P01", "P34", "P52"],
    rationale:
      "R4. Retained where the animal's behaviour is the subject: the hunter's quarry, the veterinary " +
      "practitioner's patient, the trapmaker's target.",
  },
  {
    skillId: "mechanics",
    removedFrom: ["P36", "P37", "P38", "P46", "P47"],
    retainedIn: ["P56"],
    rationale:
      "R5. Retained only for the distiller, whose apparatus is a mechanism they build and keep.",
  },
  {
    skillId: "carpentry",
    removedFrom: ["P08", "P49", "P51", "P54", "P55", "P79"],
    retainedIn: ["P29", "P52"],
    rationale:
      "R5. Retained where timber is the material worked: siege-engine carriages and constructed traps. " +
      "Withdrawn where it stood in for 'repairs things made of wood'.",
  },
  {
    skillId: "ropework",
    removedFrom: ["P39"],
    retainedIn: ["P29", "P40", "P42", "P47", "P48", "P52"],
    rationale:
      "R5. Cordage genuinely belongs to engine crews, yards, spinners, shafts, mill hoists and traps; it " +
      "was garnish on the carpenter.",
  },
  {
    skillId: "skill:plant-lore",
    removedFrom: ["P05", "P31", "P42"],
    retainedIn: ["P54", "P55", "P56", "P57", "P53"],
    rationale:
      "R4. Retained where the plant is the raw material of the process, and restored to the cook when F22 " +
      "was retired: a kitchen genuinely teaches what is available when. The farmer reaches it through the " +
      "holding's own year, and the surgeon and weaver did not need it.",
  },
  {
    skillId: "skill:first-aid",
    removedFrom: ["P34", "P74", "P81", "P82"],
    retainedIn: ["P35"],
    rationale:
      "R4. Retained only for the remedy maker, who treats the people who come to the shop. Veterinary, " +
      "religious, athletic and instructional first aid were all arithmetic.",
  },
  {
    skillId: "skill:perception",
    removedFrom: ["P09", "P15", "P51", "P14"],
    retainedIn: ["P16"],
    rationale:
      "R4/R7. Retained for the informant, whose eye is his own stock in trade. The guard's watching moved " +
      "into K24 with the rest of watch duty.",
  },
  {
    skillId: "skill:cartography",
    removedFrom: ["P49", "P68", "P70"],
    retainedIn: ["P10"],
    rationale: "R4. Retained for the navigator, who works from and corrects charts.",
  },
  {
    skillId: "mathematics",
    removedFrom: ["P73"],
    retainedIn: ["P10", "P13", "P26", "P27", "P28", "P48", "P49", "P50", "P62", "P83"],
    rationale:
      "R4. Reckoning is genuinely taught in navigation, trade, supply, planning, engineering, design, " +
      "survey, credit and play. The geographer reaches what he needs through K09 and F01.",
  },
  {
    skillId: "philosophy",
    removedFrom: ["P68", "P72"],
    retainedIn: ["P64"],
    rationale: "R4. Retained only where the teacher's subject includes it.",
  },
  {
    skillId: "skill:law",
    removedFrom: ["P65", "P76"],
    retainedIn: ["P17", "P58", "P60", "P61", "P62", "P63"],
    rationale:
      "R4. Retained where obligation and jurisdiction are handled in the work. The scribe copies " +
      "documents without pleading them, and the herald proclaims without adjudicating.",
  },
  {
    skillId: "skill:animal-husbandry",
    removedFrom: ["P23", "P44", "P53"],
    retainedIn: [],
    rationale: "R5. Keeping stock is reached through F05 and F08 where it is genuinely taught.",
  },
  {
    skillId: "combat_experience",
    removedFrom: ["P14", "P82"],
    retainedIn: [],
    rationale:
      "R6. Both already reach it where it is earned: the guard through service, the instructor through " +
      "M02 and M05.",
  },
  {
    skillId: "skill:architecture",
    removedFrom: ["P48", "P68"],
    retainedIn: [],
    rationale:
      "R5. Design of buildings is the building designer's and siege engineer's practice, not the millwright's or the calculator's.",
  },
  {
    skillId: "skill:bookkeeping",
    removedFrom: ["P11", "P55"],
    retainedIn: [],
    rationale: "R2. Reached through G11, F12 and K21 where accounts are genuinely kept.",
  },
  {
    skillId: "climb",
    removedFrom: ["P09", "P84", "P18"],
    retainedIn: ["P02"],
    rationale:
      "R5/R7. Retained for the cliff-and-tree collector. The thief's climbing moved into K25, where it is " +
      "taught with what it is for. The rigged-vessel sailor reaches it through F09, and the diver works on " +
      "a line rather than a face.",
  },
  {
    skillId: "skill:survival",
    removedFrom: ["P04", "P84"],
    retainedIn: ["P35"],
    rationale:
      "R4. Retained for the remedy maker's collecting trips; the fisher and diver work from a boat.",
  },
  {
    skillId: "skill:athletics",
    removedFrom: ["P22", "P82"],
    retainedIn: ["P78", "P84"],
    rationale:
      "R6/R7. Marching is already what G04 and M06 describe. Stage movement and the diver's breath work are " +
      "genuinely taught; the instructor's salle conditioning moved into M10 with the rest of that cluster.",
  },
  {
    skillId: "tailoring",
    removedFrom: ["P41"],
    retainedIn: ["P44"],
    rationale: "R5. Retained for leather garments; the sailmaker's canvas is not tailoring.",
  },
  {
    skillId: "skill:masonry",
    removedFrom: ["P49"],
    retainedIn: ["P45", "P79"],
    rationale:
      "R5. Withdrawn from the designer, whose C03 slot already offers it. Newly granted to the potter, " +
      "whose kiln is built masonry, and retained for the sculptor working stone.",
  },
  {
    skillId: "skill:disguise",
    removedFrom: ["P78"],
    retainedIn: ["P18"],
    rationale: "R3. Costume is not disguise; the thief's is.",
  },
  {
    skillId: "skill:oratory",
    removedFrom: ["P75"],
    retainedIn: ["P19", "P25", "P66"],
    rationale:
      "R4. Retained where public speech carries the work: the con, the command, the rendering aloud.",
  },
  {
    skillId: "skill:weather-lore",
    removedFrom: ["P75"],
    retainedIn: ["P05", "P55"],
    rationale: "R4. Retained for the farmer and the vintner, whose year turns on it.",
  },
  {
    skillId: "skill:riding",
    removedFrom: ["P34"],
    retainedIn: [],
    rationale:
      "R5. Travelling to a patient is not a taught competence; G05 supplies it where it is one.",
  },
  {
    skillId: "skill:sailmaking",
    removedFrom: ["P40"],
    retainedIn: [],
    rationale: "R5. Canvas is the sailmaker's separate trade, not the shipwright's.",
  },
  {
    skillId: "skill:seamanship",
    removedFrom: ["P41"],
    retainedIn: [],
    rationale: "R5. Fitting a sail aboard does not make the sailmaker a seaman.",
  },
  {
    skillId: "leatherworking",
    removedFrom: ["P43"],
    retainedIn: [],
    rationale: "R5. The tailor's C01 slot already offers it where a shop genuinely works leather.",
  },
  {
    skillId: "skill:hunting",
    removedFrom: ["P52"],
    retainedIn: [],
    rationale: "R5. Building a trap is not hunting with it; C14 supplies Trapping.",
  },
  {
    skillId: "skill:fishing",
    removedFrom: ["P84"],
    retainedIn: [],
    rationale: "R5. Working underwater is not fishing.",
  },
  {
    skillId: "heraldry",
    removedFrom: ["P79"],
    retainedIn: [],
    rationale: "R4. Painting arms to order does not teach the heraldic system; K10 and K11 do.",
  },
  {
    skillId: "skill:research",
    removedFrom: [],
    retainedIn: ["P67"],
    rationale:
      "Restored to the historian as a direct route after the group-size review retired F16, whose only " +
      "base Skill was Research.",
  },
];
