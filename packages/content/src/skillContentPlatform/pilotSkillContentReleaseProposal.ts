import { SKILL_CONTENT_RELEASE_SCHEMA_VERSION } from "@glantri/domain";
import type {
  PilotSkillContentCompetencyRecord,
  PilotSkillContentSpecializationRecord,
  SkillContentCompetencyRecord,
  SkillContentDomainRecord,
  SkillContentLearningHistoryRecord,
  SkillContentRelease,
  SkillContentScriptRecord,
  SkillContentSkillRecord,
  SkillContentSpokenLanguageRecord,
  SkillContentSpecializationRecord,
  SkillContentWrittenTraditionRecord,
  SkillTaskEnvelope,
} from "@glantri/domain";

import { pilotSkillContentReleaseV1 } from "../pilotSkillContentRelease";

const proposalMetadata = {
  provenance: {
    kind: "proposal" as const,
    reference: "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25",
  },
  recordVersion: "1",
  status: "proposal" as const,
};

const forgejoRepoSourceUrl = "http://127.0.0.1:3001/recovery-admin/glantri-app/src/branch/dev/";

const recordSourceByKind: Record<string, string> = {
  accessExceptions: "packages/content/src/pilotSkillContentRelease/release.ts",
  competency: "packages/content/src/pilotSkillContentRelease/release.ts",
  domain: "packages/content/src/skillContentPlatform/pilotSkillContentReleaseProposal.ts",
  history: "packages/content/src/pilotSkillContentRelease/release.ts",
  profile: "packages/content/src/pilotSkillContentRelease/release.ts",
  profiles: "packages/content/src/pilotSkillContentRelease/release.ts",
  relationship: "packages/content/src/pilotSkillContentRelease/release.ts",
  route: "packages/content/src/pilotSkillContentRelease/release.ts",
  script: "packages/content/src/skillContentPlatform/pilotSkillContentReleaseProposal.ts",
  specialization: "packages/content/src/pilotSkillContentRelease/release.ts",
};

const proposalMetadataReference = [
  "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25",
  "http://127.0.0.1:3001/recovery-admin/glantri-app/pulls/64",
  "docs/process/task-contract.md",
  "docs/decisions/rules/0002-skill-catalogue-qualitative-architecture.md",
  "docs/decisions/rules/0003-skill-documentation-and-release-integrity.md",
  "docs/rules/pilot-skill-rules-v1.md",
  "docs/rules/pilot-skill-content-release-v1.md",
];

function cloneMetadata(recordId: string, kind: keyof typeof recordSourceByKind) {
  const sourcePath = recordSourceByKind[kind];
  if (!sourcePath) {
    throw new Error(`Unknown record kind ${kind} for provenance source mapping.`);
  }
  const clone = structuredClone(proposalMetadata);
  clone.provenance.reference = `${forgejoRepoSourceUrl}${sourcePath}#${encodeURIComponent(recordId)}`;
  return clone;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shortLabel(value: string): string {
  return normalizeWhitespace(value);
}

function buildRecordTaskEnvelope(
  record: { description: string; id: string; name: string; kind: string },
  domainId: string,
): SkillTaskEnvelope {
  const scope = domainDefinitions[domainId]?.name ?? "Pilot Skill";
  const authored = authoredCompetencyDocumentation[record.id];
  const authoredDescription = normalizeWhitespace(
    authored?.description ?? record.description,
  ).toLowerCase();
  const domainContext = scope.toLowerCase();
  return {
    coreTasks: [`${record.name} in ${scope} applies this sequence: ${authoredDescription}.`],
    limits: [
      `Limit ${record.name} to explicitly listed routes, histories, and prerequisites that remain in the current authored ${domainContext} chain.`,
      `Do not carry ${record.name} across unrelated ${domainContext} or cross-profile rules outside this release metadata surface.`,
    ],
    methods: [
      `Apply ${record.name} by validating provenance, access, and prerequisite structure before assignment.`,
      `Failure mode: using ${record.name} without explicit route and history checks can create non-deterministic access. Resolve through the authored ${domainContext} attribution chain and precedence rules before replaying.`,
    ],
    useGuidance: `${record.name} resolves through explicit profile, history, and relationship edges for this record; prefer inherited graph edits over narrative inference.`,
  };
}

interface AuthoredCompetencyDocumentation {
  description: string;
  shortDescription: string;
  shortLabel?: string;
  taskEnvelope?: SkillTaskEnvelope;
}

const authoredCompetencyDocumentation: Record<string, AuthoredCompetencyDocumentation> = {
  "skill:first-aid": {
    description:
      "Perform immediate stabilization, triage tagging, and safe transfer procedures without substituting long-form diagnosis.",
    shortDescription: "Stabilize urgent wounds with safe immediate response sequencing.",
  },
  "skill:dodge": {
    description:
      "Recover balance against unexpected force vectors and preserve spacing in close engagements without escalating commitment.",
    shortDescription: "Preserve life and mobility under direct physical pressure.",
  },
  "skill:battle-tactics": {
    description:
      "Coordinate small-unit posture, command timing, and fallback options while preserving formation intent.",
    shortDescription: "Coordinate engagements through timing, formation, and fallback posture.",
  },
  "skill:medicine": {
    description:
      "Assess symptoms, prognosis windows, and treatment priorities while keeping intervention risk explicit.",
    shortDescription: "Run structured medical assessment and treatment pathway triage.",
  },
  "skill:surgery": {
    description:
      "Operate with explicit pre-op checks, sterile sequencing, and post-op recovery obligations.",
    shortDescription: "Run operative intervention with strict procedural controls.",
  },
  "skill:research": {
    description:
      "Locate corroborating records and test claims before adopting conclusions across domains.",
    shortDescription: "Validate source material through cross-checked research procedures.",
  },
  "skill:law:olog-princely": {
    description:
      "Apply princely Olog legal reasoning where court channels authorize scope and enforcement outcomes.",
    shortDescription:
      "Use olog-princely legal authority within explicit court-channel constraints.",
  },
  "skill:dead-reckoning": {
    description:
      "Project travel position from distance, speed, and course assumptions under uncertainty.",
    shortDescription: "Track movement state when external cues are missing.",
  },
  "skill:chart-navigation": {
    description:
      "Read map and chart systems for bearing, waypoint logic, and safe hazard interpretation.",
    shortDescription: "Convert chart data into safe, reproducible navigation outcomes.",
  },
  "spoken:common": {
    description:
      "Use Common speech for civic and field coordination with conventions shared across multiple regional contexts.",
    shortDescription: "Coordinate through Common-language communication and negotiation.",
  },
  "spoken:mogrebi": {
    description:
      "Communicate in Mogrebi with institutional terminology suitable for clinics, temple environments, and civic records.",
    shortDescription: "Use Mogrebi for context-specific medical and civic talk.",
  },
  "spoken:ologian": {
    description:
      "Apply Ologian speech with court and clerical conventions, especially when handling legal testimony and records.",
    shortDescription: "Use Ologian speech for court-facing and clerical discourse.",
  },
  "spoken:phoenician": {
    description:
      "Use Phoenician for trade correspondence and maritime commercial signaling where historical convention defines meaning.",
    shortDescription: "Handle Phoenician language in trade and seafaring communication.",
  },
  "spoken:nkolian": {
    description:
      "Use N'kolian language for frontier caravan and frontier-administrative movement channels.",
    shortDescription: "Convey caravan and settlement coordination through N'kolian speech.",
  },
  "spoken:scythian": {
    description:
      "Use Scythian speech for home-region negotiation and oral tradition exchange where oral law applies.",
    shortDescription: "Coordinate social and clan context with Scythian oral language.",
  },
  "written:mogrebi:sacred-mogrebi": {
    description:
      "Read and apply written Sacred Mogrebi conventions for medical and devotional records while avoiding spoken substitution.",
    shortDescription: "Use Sacred Mogrebi text conventions for documented references.",
  },
  "written:ologian:church-ologian": {
    description:
      "Interpret Church Ologian written conventions in legal, clerical, and instructional records.",
    shortDescription: "Use Church Ologian writing for court and clerical documentation.",
  },
  "written:phoenician:phoenician": {
    description:
      "Handle Phoenician script text conventions for trade and maritime archival documentation.",
    shortDescription: "Use Phoenician writing for trade-route archival interpretation.",
  },
  "spec:household-guard-sword-shield-drill": {
    description:
      "Advance from household retainer training into paired sword-shield doctrine with dual proficiency thresholds.",
    shortDescription: "Progress weapon doctrine from household drill to paired progression.",
  },
  "spec:diagnostic-medicine": {
    description:
      "Apply advanced diagnostic practice once baseline medical and pharmacy competencies are established.",
    shortDescription: "Advance medicine through explicit diagnostic specialization thresholds.",
  },
  "spec:warded-lock-entry": {
    description:
      "Specialize lock-entry method under warded systems where baseline deception and covert-entry knowledge is already active.",
    shortDescription: "Refine lock-entry through warded systems with explicit thresholds.",
  },
  "spec:court-administration": {
    description:
      "Handle court-administration routines where legal, procedural, and reporting obligations converge.",
    shortDescription: "Run court-level administrative progression after baseline legal training.",
  },
  "spec:weaponsmithing": {
    description:
      "Develop specialist forging and inspection discipline building directly on smithing foundations.",
    shortDescription: "Progress to weaponsmithing-specific crafting rules and inspections.",
  },
  "spec:home-coast-pilotage": {
    description:
      "Apply home-coast pilotage patterns after seamanship, navigation, and route exposure foundations.",
    shortDescription: "Specialize pilotage for coastal conditions and transfer routing.",
  },
  "spec:desert-wayfinding": {
    description:
      "Extend wayfinding with arid-route heuristics and long-distance orientation constraints.",
    shortDescription: "Specialize wayfinding for desert distances and route risk.",
  },
  "spec:steppe-remount-training": {
    description:
      "Advance mounted remount and recovery discipline for steppe travel and rapid redeployment.",
    shortDescription: "Specialize remount handling and mounted sustainability.",
  },
  "skill:sword": {
    description:
      "Practice directed weapon-motion control in close quarters, including guard transitions, timing, and controlled parries for sword and shield pairings.",
    shortDescription: "Close-quarters defense and offense with guard transitions.",
  },
  "skill:shield": {
    description:
      "Develop reliable parry structures and body alignment that reduce incoming pressure while preserving mobility and counter-readiness.",
    shortDescription: "Maintain cover and pressure control through shield posture.",
  },
  "skill:knife-dagger": {
    description:
      "Use precise short-weapon movement with narrow spacing discipline, including retention and rapid edge transition under tight contact.",
    shortDescription: "Short-weapon handling with compact range and controlled transitions.",
  },
  "skill:spear": {
    description:
      "Project distance management and binding pressure with thrust lines, footwork timing, and anti-overextension recovery.",
    shortDescription: "Extended-distance thrust and distance management discipline.",
  },
  "skill:perception": {
    description:
      "Track anomalies and cues across social, tactical, and environmental layers before acting on any immediate assumption.",
    shortDescription: "Detect and triage unusual sensory, social, and tactical signals.",
  },
  "skill:athletics": {
    description:
      "Apply conditioned body movement for load carriage, acceleration changes, and sustained exertion under time pressure.",
    shortDescription: "Conditioned movement, balance, and exertion control.",
  },
  "skill:survival": {
    description:
      "Sustain movement and decision quality in adverse terrain with heat, weather, and deprivation-aware routines.",
    shortDescription: "Terrain survival planning under adverse field conditions.",
  },
  "skill:leadership": {
    description:
      "Coordinate role alignment and timing pressure in mixed units with clear command, morale, and response pacing.",
    shortDescription: "Coordinate team response with authority and pacing control.",
  },
  "skill:pharmacy": {
    description:
      "Prepare and evaluate remedies, herb balances, and administration timing using controlled dosing and observability rules.",
    shortDescription: "Prepare and sequence pharmaceutical support safely.",
  },
  "skill:plant-lore": {
    description:
      "Identify practical botanical sources and seasonal behaviors relevant to medicine, ritual use, and travel preparation.",
    shortDescription: "Identify practical uses of plants by season and behavior.",
  },
  "skill:streetwise": {
    description:
      "Assess crowd sentiment, civic risk, and rumor pathways before committing to social or investigative moves.",
    shortDescription: "Navigate streets, rumor networks, and practical city behavior.",
  },
  "skill:underworld": {
    description:
      "Track illicit channels, hidden intermediaries, and illicit trust relationships without mistaking intent for certainty.",
    shortDescription: "Map underground exchanges and risk-laden intermediaries.",
  },
  "skill:deception": {
    description:
      "Construct and sustain deceptive presentations with timing, social cues, and fallback exits for plausible denial.",
    shortDescription: "Build and sustain deliberate false presentations.",
  },
  "skill:stealth": {
    description:
      "Move through social and physical threat zones by minimizing signature, timing movement with ambient distraction, and reducing detection pressure.",
    shortDescription: "Reduce detection via controlled movement and timing.",
  },
  "skill:lockpicking": {
    description:
      "Work precision tactile manipulation of warded components and key geometries with controlled entry risk.",
    shortDescription: "Manipulate locks via precise tactile and structural reading.",
  },
  "skill:sleight-of-hand": {
    description:
      "Transfer small objects and create controlled misdirection without collapsing composure or routine body pattern.",
    shortDescription: "Execute subtle hand-based manipulation and concealment.",
  },
  "skill:insight": {
    description:
      "Read intent cues and trust signals from language, gesture, and routine contradiction patterns.",
    shortDescription: "Infer motive by reading verbal and physical cues.",
  },
  "skill:disguise": {
    description:
      "Create and sustain role-consistent personas that blend behavior, posture, and appearance across repeated contact windows.",
    shortDescription: "Sustain role-consistent disguise across scrutiny loops.",
  },
  "skill:administration": {
    description:
      "Run low-friction administrative sequencing across requests, routing, and institutional expectations under procedural pressure.",
    shortDescription: "Coordinate institutional process and case routing under pressure.",
  },
  "skill:customs": {
    description:
      "Track local custom law, expectation hierarchies, and social consequences when acting across institutions and households.",
    shortDescription: "Track local custom law and institutional expectations.",
  },
  "skill:oratory": {
    description:
      "Deliver formal and informal rhetoric calibrated to audience authority, urgency, and procedural posture.",
    shortDescription: "Use structured rhetoric aligned to audience and procedure.",
  },
  "skill:bookkeeping": {
    description:
      "Balance ledgers, verify records, and reconcile recurring obligations across accounts and obligations with traceable consistency.",
    shortDescription: "Maintain and reconcile records with audit-friendly consistency.",
  },
  "skill:trade": {
    description:
      "Navigate commodity exchange, valuation, and settlement routines with explicit terms, obligations, and margin awareness.",
    shortDescription: "Conduct commercial exchange with valuation and settlement rules.",
  },
  "skill:bargaining": {
    description:
      "Negotiate terms under pressure with incremental tradeoffs while preserving routeable outcomes and future leverage.",
    shortDescription: "Negotiate structured outcomes while preserving leverage.",
  },
  "skill:appraisal": {
    description:
      "Classify and compare material quality, provenance signals, and hidden defects before committing exchange value.",
    shortDescription: "Evaluate item quality, provenance, and defects.",
  },
  "skill:smithing": {
    description:
      "Shape and reinforce materials through repeated forging process control, heat discipline, and structural review.",
    shortDescription: "Forge and finish tools with heat and structural control.",
  },
  "skill:seamanship": {
    description:
      "Coordinate deck discipline, vessel movement, and tide-aware operation with practical load-and-risk management.",
    shortDescription: "Control vessel movement with deck discipline and risk awareness.",
  },
  "skill:pilotage": {
    description:
      "Pilot local waters through tide windows, obstacle memory, and channel-safe approach discipline.",
    shortDescription: "Run local-water movement with channel-safe sequencing.",
  },
  "skill:swimming": {
    description:
      "Sustain buoyancy, propulsion, and controlled return options under surf, load, and fatigue constraints.",
    shortDescription: "Maintain swim control under fatigue, load, and water dynamics.",
  },
  "skill:weather-lore": {
    description:
      "Forecast short-horizon conditions with pressure, cloud, wind, and smell cues for route and hazard decisions.",
    shortDescription: "Read short-horizon weather for route and hazard judgment.",
  },
  "skill:wayfinding": {
    description:
      "Resolve local travel with terrain memory, sightlines, and route selection under uncertainty.",
    shortDescription: "Resolve directional progress with terrain and uncertainty.",
  },
  "skill:animal-handling": {
    description:
      "Condition and direct mount behavior through body-language cues, pace control, and stable handling under stress.",
    shortDescription: "Control mounts with cue discipline and pace management.",
  },
  "skill:tracking": {
    description:
      "Interpret signs, disturbances, and repeatability patterns into likely movement pathways and likely intent.",
    shortDescription: "Trace movement paths from physical signs and repeatability.",
  },
  "skill:hunting": {
    description:
      "Integrate scent, sign, and concealment discipline into acquisition decisions with minimal noise and waste.",
    shortDescription: "Run pursuit routines with concealment and sign discipline.",
  },
  "skill:riding": {
    description:
      "Train gait transitions, terrain adaptation, and endurance pacing for long route coverage with mounted stability.",
    shortDescription: "Manage mounted movement, gaits, and endurance pacing.",
  },
};

const languageFamilyBySpokenId: Record<string, string[]> = {
  "spoken:common": ["language-family:common"],
  "spoken:mogrebi": ["language-family:mogrebi"],
  "spoken:ologian": ["language-family:ologian"],
  "spoken:phoenician": ["language-family:phoenician"],
  "spoken:nkolian": ["language-family:nkolian"],
  "spoken:scythian": ["language-family:scythian"],
};

const domainDefinitions: Record<string, { description: string; name: string }> = {
  "domain:awareness-investigation": {
    description:
      "Perceptional and investigative interpretation used to identify, assess, and confirm facts.",
    name: "Awareness & Investigation",
  },
  "domain:athletics-movement": {
    description: "Conditioned body movement, control, and locomotion techniques.",
    name: "Athletics & Movement",
  },
  "domain:agriculture-husbandry": {
    description:
      "Animal husbandry and practical farm-route maintenance by repeated handling and management.",
    name: "Agriculture & Husbandry",
  },
  "domain:craft-making": {
    description: "Practical craft and forge practices for creating durable objects.",
    name: "Craft & Making",
  },
  "domain:covert-entry-infiltration": {
    description: "Stealthy entry, movement, and manipulation practices in sensitive environments.",
    name: "Covert Entry & Infiltration",
  },
  "domain:culture-society": {
    description: "Cultural institutions, social systems, and local practice recognition.",
    name: "Culture & Society",
  },
  "domain:healing": {
    description: "Stabilization, treatment, and recovery-oriented medical practice.",
    name: "Healing",
  },
  "domain:languages-text": {
    description:
      "Spoken-language and written-text competence for communication and textual practice.",
    name: "Languages & Textual Practice",
  },
  "domain:law-administration": {
    description: "Legal practice, institutional procedures, and organized office knowledge.",
    name: "Law & Administration",
  },
  "domain:navigation": {
    description: "Routefinding, seamanship, and safe transport route practice.",
    name: "Navigation",
  },
  "domain:natural-knowledge": {
    description: "Environmental and practical field knowledge for interpretation and survival.",
    name: "Natural Knowledge",
  },
  "domain:scholarship": {
    description: "Research method, evaluation, and interpretation of retained knowledge.",
    name: "Scholarship",
  },
  "domain:social-interaction": {
    description: "Interpersonal influence, negotiation, and civic engagement practice.",
    name: "Social Interaction",
  },
  "domain:trade-finance": {
    description: "Commerce, valuation, and exchange practice for material and social outcomes.",
    name: "Trade & Finance",
  },
  "domain:outdoor-survival": {
    description: "Field movement, scouting, and wilderness practice.",
    name: "Outdoor & Survival",
  },
  "domain:weapon-practice": {
    description: "Weapon- and combat-practice techniques with direct task scopes.",
    name: "Weapon Practice",
  },
  "domain:warfare": {
    description: "Command and operational tactics for organized conflict practice.",
    name: "Warfare",
  },
};

function documentationForRecord(record: PilotSkillContentCompetencyRecord) {
  const authored = authoredCompetencyDocumentation[record.id];
  const normalizedDescription = normalizeWhitespace(authored?.description ?? record.description);
  const normalizedShortDescription = normalizeWhitespace(
    authored?.shortDescription ?? record.description,
  );

  return {
    description: normalizedDescription,
    shortLabel: shortLabel(authored?.shortLabel ?? record.name),
    shortDescription: normalizedShortDescription,
    taskEnvelope: authored?.taskEnvelope ?? buildRecordTaskEnvelope(record, record.domainId),
  };
}

const v1DomainIds = Array.from(
  new Set(pilotSkillContentReleaseV1.competencies.map(({ domainId }) => domainId)),
).values();

const domains = [...v1DomainIds]
  .map((id) => {
    const definition = domainDefinitions[id];
    if (!definition) {
      throw new Error(`Missing domain definition for ${id}`);
    }
    return {
      ...definition,
      id,
      kind: "domain" as const,
      metadata: cloneMetadata(id, "domain"),
      mechanics: "none" as const,
    } satisfies SkillContentDomainRecord;
  })
  .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

const scripts: SkillContentScriptRecord[] = [
  {
    description: "Sacred Mogrebi script used by clinical and devotional medical learning.",
    familyIds: ["script-family:mogrebi"],
    id: "script:sacred-mogrebi",
    kind: "script",
    metadata: cloneMetadata("script:sacred-mogrebi", "script"),
    name: "Sacred Mogrebi",
  },
  {
    description: "Church Ologian script used for court and clerical record-keeping.",
    familyIds: ["script-family:ologian"],
    id: "script:church-ologian",
    kind: "script",
    metadata: cloneMetadata("script:church-ologian", "script"),
    name: "Church Ologian",
  },
  {
    description: "Phoenician script for maritime and commercial record traditions.",
    familyIds: ["script-family:phoenician"],
    id: "script:phoenician",
    kind: "script",
    metadata: cloneMetadata("script:phoenician", "script"),
    name: "Phoenician",
  },
];

function toSkillRecord(record: PilotSkillContentCompetencyRecord): SkillContentCompetencyRecord {
  const documented = documentationForRecord(record);

  const baseRecord = {
    description: documented.description,
    domainId: record.domainId,
    id: record.id,
    metadata: cloneMetadata(record.id, "competency"),
    name: documented.shortLabel,
    prerequisites: [],
    shortDescription: documented.shortDescription,
    shortLabel: documented.shortLabel,
    taskEnvelope: documented.taskEnvelope,
    weight: record.weight,
  };

  if (record.kind === "skill") {
    return {
      ...baseRecord,
      kind: "skill",
    } as SkillContentSkillRecord;
  }

  if (record.kind === "spoken-language") {
    return {
      ...baseRecord,
      familyIds: languageFamilyBySpokenId[record.id] ?? [],
      kind: "spoken-language",
      weight: record.weight,
    } as SkillContentSpokenLanguageRecord;
  }

  const parsed = /^written:([a-z0-9-]+):([a-z0-9-]+)$/.exec(record.id);
  if (!parsed) {
    throw new Error(`Cannot parse written-tradition id ${record.id}`);
  }
  const writtenLanguage = `spoken:${parsed[1]}`;
  const writtenScript = `script:${parsed[2]}`;

  return {
    ...baseRecord,
    kind: "written-tradition",
    scriptId: writtenScript,
    spokenLanguageId: writtenLanguage,
  } as SkillContentWrittenTraditionRecord;
}

const scythianHomeProfileUnavailableCompetencyIds = [
  "spoken:ologian",
  "written:ologian:church-ologian",
  "skill:customs",
  "skill:insight",
  "skill:administration",
  "skill:law:olog-princely",
  "spec:court-administration",
];

const scythianHomeProfileUnavailabilityRouteId = "route:scythian-olog-unavailable";

function toSpecializationRecord(
  specialization: PilotSkillContentSpecializationRecord,
): SkillContentSpecializationRecord {
  const parentCompetencyId = specialization.prerequisites.find(({ competencyId }) => {
    const prerequisite = pilotSkillContentReleaseV1.competencies.find(
      ({ id }) => id === competencyId,
    );
    return prerequisite?.kind === "skill";
  })?.competencyId;

  if (!parentCompetencyId) {
    throw new Error(`No parent Skill found for specialization ${specialization.id}`);
  }

  const parent = pilotSkillContentReleaseV1.competencies.find(
    ({ id }) => id === parentCompetencyId,
  );
  if (!parent) {
    throw new Error(
      `Parent ${parentCompetencyId} not found for specialization ${specialization.id}`,
    );
  }

  return {
    ...specialization,
    acquisitionWeight: specialization.acquisitionWeight,
    domainId: parent.domainId,
    metadata: cloneMetadata(specialization.id, "specialization"),
    parentCompetencyId,
    shortLabel: shortLabel(specialization.name),
    shortDescription: normalizeWhitespace(specialization.description),
    taskEnvelope: buildRecordTaskEnvelope(
      {
        id: specialization.id,
        kind: "specialization",
        description: specialization.description,
        name: specialization.name,
      },
      parent.domainId,
    ),
    transfer: structuredClone(specialization.transfer),
    weight: specialization.acquisitionWeight,
    prerequisites: structuredClone(specialization.prerequisites),
  } satisfies SkillContentSpecializationRecord;
}

const competencies: SkillContentCompetencyRecord[] = [
  ...pilotSkillContentReleaseV1.competencies.map(toSkillRecord),
  ...pilotSkillContentReleaseV1.specializations.map(toSpecializationRecord),
];

const profiles = pilotSkillContentReleaseV1.profiles.map((profile) => {
  const normalRoutes = profile.normalRoutes.map((route) => ({
    ...route,
    competencyIds: [...route.competencyIds],
    metadata: cloneMetadata(route.id, "route"),
  }));
  if (profile.id === "profile:scythian-pastoral-clan") {
    normalRoutes.push({
      accessBand: "AB1",
      competencyIds: [...scythianHomeProfileUnavailableCompetencyIds],
      description:
        "Olog court, language, and administrative exclusion scope for the home-profile fosterage pathway.",
      id: scythianHomeProfileUnavailabilityRouteId,
      metadata: cloneMetadata(scythianHomeProfileUnavailabilityRouteId, "route"),
    });
  }

  const overrides = profile.overrides.map((override) => {
    const normalizedOverride = {
      ...override,
      competencyIds: [...override.competencyIds],
    };
    if (
      profile.id === "profile:scythian-pastoral-clan" &&
      override.attributionId === "profile:scythian-olog-unavailable"
    ) {
      return {
        ...normalizedOverride,
        attributionId: scythianHomeProfileUnavailabilityRouteId,
        competencyIds: [...scythianHomeProfileUnavailableCompetencyIds],
      };
    }
    if (
      profile.id === "profile:iest-commercial-city" &&
      override.attributionId === "access:iest-contact-copper-latch"
    ) {
      return {
        ...normalizedOverride,
        competencyIds: [],
      };
    }
    return normalizedOverride;
  });

  return {
    accessBand: profile.accessBand,
    developmentStage: profile.developmentStage,
    id: profile.id,
    metadata: cloneMetadata(profile.id, "profile"),
    name: profile.name,
    normalRoutes,
    overrides,
  };
});

const relationships = pilotSkillContentReleaseV1.relationships.map((relationship) => ({
  direction: relationship.direction,
  id: relationship.id,
  metadata: cloneMetadata(relationship.id, "relationship"),
  rationale: relationship.rationale,
  sourceCompetencyId: relationship.sourceCompetencyId,
  strength: relationship.strength,
  targetCompetencyId: relationship.targetCompetencyId,
}));

const accessExceptions = pilotSkillContentReleaseV1.accessExceptions.map((entry) => ({
  ...entry,
  competencyIds: entry.id === "access:iest-contact-copper-latch" ? [] : [...entry.competencyIds],
  historyIds: [...entry.historyIds],
  metadata: cloneMetadata(entry.id, "accessExceptions"),
}));

const histories: readonly SkillContentLearningHistoryRecord[] =
  pilotSkillContentReleaseV1.histories.map((history) => {
    const selectionSlots = history.selectionSlots.map(
      ({ candidateCompetencyIds, chooseCount, id, label }) => ({
        candidateCompetencyIds: [...candidateCompetencyIds],
        chooseCount,
        id,
        label,
      }),
    );

    return {
      context: history.context,
      fixedCompetencyIds: [...history.fixedCompetencyIds],
      id: history.id,
      metadata: cloneMetadata(history.id, "history"),
      name: history.name,
      selectionSlots,
    } satisfies SkillContentLearningHistoryRecord;
  });

export const pilotSkillContentReleaseProposalInput = {
  accessExceptions,
  compatibility: {
    characterMigrationReviewRequired: false,
    classification: "mechanically-compatible",
    rationale:
      "The release repairs authored documentation, task scopes, and access attribution recovery while preserving direct inherited mechanics.",
  },
  competencies,
  contentVersion: "pilot-skills-content/2.0.0-candidate.1",
  domains,
  histories,
  id: "content-release:pilot-skills:2-candidate-1",
  profiles,
  provenance: [...proposalMetadataReference],
  relationships,
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
  scripts,
  status: "proposal",
  title: "Documentation-complete Pilot Skill v2 candidate",
} satisfies Omit<SkillContentRelease, "manifest">;
