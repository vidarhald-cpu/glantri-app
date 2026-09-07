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
    reference:
      "http://127.0.0.1:3001/recovery-admin/glantri-app/src/commit/" +
      "0000000000000000000000000000000000000000" +
      "/packages/content/src/skillContentPlatform/pilotSkillContentReleaseProposal.ts#L1",
  },
  recordVersion: "1",
  status: "proposal" as const,
};

type ProposalMetadataRecordKind =
  | "accessExceptions"
  | "competency"
  | "domain"
  | "history"
  | "profile"
  | "profiles"
  | "relationship"
  | "route"
  | "script"
  | "specialization";

const proposalMetadataReference = [
  "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25",
  "http://127.0.0.1:3001/recovery-admin/glantri-app/pulls/64",
  "docs/process/task-contract.md",
  "docs/decisions/rules/0002-skill-catalogue-qualitative-architecture.md",
  "docs/decisions/rules/0003-skill-documentation-and-release-integrity.md",
  "docs/rules/pilot-skill-rules-v1.md",
  "docs/rules/pilot-skill-content-release-v1.md",
];

function cloneMetadata(recordId: string, kind: ProposalMetadataRecordKind) {
  if (!recordId) {
    throw new Error(`Expected record id for provenance metadata (${kind}).`);
  }
  const clone = structuredClone(proposalMetadata);
  clone.provenance.reference = `${proposalMetadata.provenance.reference}/${kind}/${recordId}`;
  return clone;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shortLabel(value: string): string {
  return normalizeWhitespace(value);
}

interface AuthoredCompetencyDocumentation {
  description: string;
  shortDescription: string;
  shortLabel?: string;
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

const authoredTaskEnvelopeByCompetencyId: Record<string, SkillTaskEnvelope> = {
  "skill:first-aid": {
    coreTasks: [
      "Run immediate-life support in order: airway, hemorrhage control, and safe movement handoff.",
    ],
    limits: [
      "Confine this record to stabilization, transport prep, and urgent handoff planning only.",
      "Do not convert triage actions into long-form treatment decisions.",
    ],
    methods: [
      "Perform scene isolation, immediate vital check, and short-cycle reassessment before any handoff step.",
      "Failure mode: skipping reassessment or transport constraints creates preventable deterioration; recover with a fresh stabilization loop.",
    ],
    useGuidance:
      "Use this envelope when the target is unstable and no specialist context is yet available.",
  },
  "skill:dodge": {
    coreTasks: [
      "Track incoming force, pivot weight, and distance with incremental timing adjustments.",
    ],
    limits: [
      "Do not pair dodge sequencing with commitments requiring aggressive follow-through.",
      "Avoid forcing body repositioning beyond the current balance margin and terrain friction.",
    ],
    methods: [
      "Stabilize stance first, then execute micro-adjustments and reset momentum before counters.",
      "Failure mode: over-correcting foot placement amplifies exposure; reset through breath, spine, and guard alignment.",
    ],
    useGuidance:
      "Treat dodge as a preservation tactic, not a replacement for movement-intensive attack planning.",
  },
  "skill:battle-tactics": {
    coreTasks: ["Define battle state, risk band, and fallback posture before issuing commands."],
    limits: [
      "Keep tactics within visible team competencies and active formation knowledge.",
      "Do not invent command authority outside profile-supported routes.",
    ],
    methods: [
      "Sequence observation, timing, fallback, and communications with explicit contingency triggers.",
      "Failure mode: issuing command without shared state can cascade conflicting maneuvers; recover with a synchronized check-in.",
    ],
    useGuidance:
      "Preserve command clarity by anchoring every plan to shared profile and route assumptions.",
  },
  "skill:medicine": {
    coreTasks: [
      "Apply assessment, differential framing, and treatment ranking in controlled order.",
    ],
    limits: [
      "Keep this record within non-operative intervention and referral obligations.",
      "Do not begin invasive procedures without the explicit surgical competency context.",
    ],
    methods: [
      "Collect symptom evidence, separate certainty tiers, and document treatment rationale.",
      "Failure mode: treating uncertain signs as confirmed cases creates avoidable compounding; revert to observation and reassessment first.",
    ],
    useGuidance:
      "Use medicine tasks to stabilize and plan progression before specialist handoff when available.",
  },
  "skill:surgery": {
    coreTasks: [
      "Run sterilized pre-op checklist, controlled incision timing, and post-op observation protocol.",
    ],
    limits: [
      "Do not perform when environment risk exceeds sterilization and monitoring requirements.",
      "Do not carry this into broad nonoperative response without explicit permission.",
    ],
    methods: [
      "Verify preparation gates, then execute only within defined procedural milestones.",
      "Failure mode: violating sequencing can create irreversible harm; reset by halting and reversing to clean-room controls.",
    ],
    useGuidance:
      "Treat surgical actions as constrained procedures with strict completion criteria.",
  },
  "skill:research": {
    coreTasks: [
      "Gather corroborating sources, map claim dependencies, and compare contradictory testimonies.",
    ],
    limits: [
      "Do not treat a single source as sufficient authority.",
      "Do not present unsupported inference as settled doctrine.",
    ],
    methods: [
      "Triangulate evidence, classify confidence, and archive rationale for each conclusion.",
      "Failure mode: confirmation bias from one source produces false certainty; recover by adding one independent corroborant.",
    ],
    useGuidance:
      "Apply this envelope whenever claims affect long-lived profile or history attribution.",
  },
  "skill:law:olog-princely": {
    coreTasks: [
      "Resolve legal posture by applying court precedent chain and enforcement precedence.",
    ],
    limits: [
      "Confine recommendations to explicit court-channel authority and procedural scope.",
      "Do not extrapolate legal authority into unrelated social customs.",
    ],
    methods: [
      "Check authority, document evidentiary basis, and route exceptions through recorded channels.",
      "Failure mode: conflating custom and decree produces invalid rulings; recover by separating jurisdictional anchors.",
    ],
    useGuidance:
      "Keep this skill active only where Olog legal channels and compatible histories are present.",
  },
  "skill:dead-reckoning": {
    coreTasks: [
      "Update movement estimate from speed, time, and bearing anchors each decision turn.",
    ],
    limits: [
      "Do not trust long-range estimates without cross-check points.",
      "Do not extend a route estimate across abrupt hazard shifts.",
    ],
    methods: [
      "Set a baseline vector, apply uncertainty buffers, and revise after each observed check.",
      "Failure mode: stale vector assumptions drift rapidly; recover by resetting baseline reference points.",
    ],
    useGuidance:
      "Use dead-reckoning as backup or primary travel estimation when landmarks are sparse.",
  },
  "skill:chart-navigation": {
    coreTasks: [
      "Interpret chart symbols, lanes, hazards, and route annotations before committing the turn.",
    ],
    limits: [
      "Do not infer safety from incomplete symbol interpretation.",
      "Do not bypass written channel notes in favor of memory only.",
    ],
    methods: [
      "Parse hazard flags, cross-reference waypoint sequence, and confirm depth of approach windows.",
      "Failure mode: skipping chart annotations risks hidden hazards; recover with a chart+terrain re-parse.",
    ],
    useGuidance:
      "Use this envelope for route planning, not ad hoc improvisation at approach points.",
  },
  "spoken:common": {
    coreTasks: ["Align phrasing with civic and field registers before making requests or updates."],
    limits: [
      "Do not assume fluent nuance in emergency jargon.",
      "Avoid replacing shared civic norms with private idiom.",
    ],
    methods: [
      "Open with role and intent, then confirm comprehension via short checkpoints.",
      "Failure mode: unsupported jargon misroutes instructions; recover with a plain-language restatement.",
    ],
    useGuidance:
      "Use Common speech for coordination loops where broad audience comprehension is mandatory.",
  },
  "spoken:mogrebi": {
    coreTasks: [
      "Use institutional Mogrebi terms when acting across clinics, temple records, and civic filing.",
    ],
    limits: [
      "Restrict usage to contexts with recognized institutional conventions.",
      "Do not use ritual phrasing in purely commercial channels.",
    ],
    methods: [
      "Set register by location first, then map each phrase to the required institutional purpose.",
      "Failure mode: mixed register causes procedural rejection; recover with explicit register correction.",
    ],
    useGuidance: "Prefer this when documentation boundaries require Mogrebi technical vocabulary.",
  },
  "spoken:ologian": {
    coreTasks: [
      "Render testimony and testimony-adjacent language for court-facing and clerical recipients.",
    ],
    limits: [
      "Do not collapse legal formality into casual narration.",
      "Avoid asserting authority without procedural basis.",
    ],
    methods: [
      "Separate observed fact from interpretation and avoid overstatement.",
      "Failure mode: wording drift creates evidentiary damage; recover by re-alignment to formal format.",
    ],
    useGuidance:
      "Use Ologian speech when the audience is constrained by court or record expectations.",
  },
  "spoken:phoenician": {
    coreTasks: [
      "Convey trade intent using historically aligned commercial conventions and signal timing.",
    ],
    limits: [
      "Avoid mixing casual shorthand with maritime negotiation channels.",
      "Do not omit route or payment obligations.",
    ],
    methods: [
      "Translate terms into stable commercial units and confirm terms before closure.",
      "Failure mode: omitted terms creates claim disputes; recover through explicit term revalidation.",
    ],
    useGuidance:
      "Use this envelope for trade and harbor correspondence where historical commercial language is expected.",
  },
  "spoken:nkolian": {
    coreTasks: [
      "Transmit settlement movement instructions through frontier-appropriate cadence and honor forms.",
    ],
    limits: [
      "Avoid introducing urban legal wording into caravan administration.",
      "Keep sentence length and reference scope compact.",
    ],
    methods: [
      "Match speaker role and caravan context before issuing movement or delivery instructions.",
      "Failure mode: context mismatch creates travel delays; recover by restating role and destination clearly.",
    ],
    useGuidance: "Use N'kolian for caravan and frontier mobility coordination routines.",
  },
  "spoken:scythian": {
    coreTasks: [
      "Use oral convention for clan and home-region negotiation with explicit audience alignment.",
    ],
    limits: [
      "Do not extend scythian assumptions outside local oral-law scopes.",
      "Avoid replacing required written traces with only verbal commitments.",
    ],
    methods: [
      "Establish social footing, then state expectation and consequence in one pass.",
      "Failure mode: oral ambiguity causes attribution disputes; recover by restating obligations.",
    ],
    useGuidance:
      "Use Scythian language where social-clan oral channels are the explicit authority surface.",
  },
  "written:mogrebi:sacred-mogrebi": {
    coreTasks: [
      "Decode sacred-format entries into actionable references for clinical or devotional records.",
    ],
    limits: [
      "Do not infer spoken nuance from script forms.",
      "Do not bypass line-specific reading for summary claims.",
    ],
    methods: [
      "Anchor each interpretation to line context and preserve symbol/translation boundaries.",
      "Failure mode: transcription drift causes mis-citation; recover through source-line verification.",
    ],
    useGuidance: "Use this envelope for written sacred material where exact citation is required.",
  },
  "written:ologian:church-ologian": {
    coreTasks: ["Decode clerical notation into procedural, legal, and instructional intent."],
    limits: [
      "Do not blend legal conclusions with undocumented assumptions.",
      "Separate copy-level transcription from adjudicated meaning.",
    ],
    methods: [
      "Cross-check phrase intent against nearby records before applying operationally.",
      "Failure mode: over-reading a copied phrase causes legal mismatch; recover through conservative interpretation.",
    ],
    useGuidance: "Use in court and clerical contexts requiring traceable written authority.",
  },
  "written:phoenician:phoenician": {
    coreTasks: [
      "Interpret trade-oriented notation for obligations, routes, and commercial memory.",
    ],
    limits: [
      "Do not apply maritime shorthand out of route context.",
      "Avoid substituting reconstructed values for explicit symbols.",
    ],
    methods: [
      "Parse columns/annotations, then map terms to contract intent and route expectations.",
      "Failure mode: misread symbols alter value and payment outcome; recover by re-parsing annotation keys.",
    ],
    useGuidance:
      "Use this envelope before making historical trade assertions from Phoenician records.",
  },
  "spec:household-guard-sword-shield-drill": {
    coreTasks: [
      "Escalate from shared weapon baseline into paired drill procedures with explicit thresholds.",
    ],
    limits: [
      "Keep this specialization tied to paired household-guard practice only.",
      "Do not blend with unrelated weapon specialization without parent transfer checks.",
    ],
    methods: [
      "Run synchronized guard transitions, spacing controls, and recovery commands.",
      "Failure mode: ignoring threshold gates dilutes practice quality; recover by retraining from parent sword/shield records.",
    ],
    useGuidance:
      "Use only after household guard competency context exists and prerequisites are met.",
  },
  "spec:diagnostic-medicine": {
    coreTasks: [
      "Apply differential case comparison using medicine and pharmacy context before specialist escalation.",
    ],
    limits: [
      "Do not replace diagnostic review with treatment-only assumptions.",
      "Avoid widening scope beyond medicine-derived facts.",
    ],
    methods: [
      "Build symptom pattern maps, then challenge each hypothesis against objective signs.",
      "Failure mode: early closure on one diagnosis hides differential risks; recover by reopening compare-and-contrast loop.",
    ],
    useGuidance:
      "This specialization is an authored extension for high-certainty clinical reasoning.",
  },
  "spec:warded-lock-entry": {
    coreTasks: ["Use warded-entry sequencing without introducing irreversible lock modifications."],
    limits: [
      "Do not apply warded methods to non-warded mechanisms.",
      "Do not claim ownership changes outside explicit transfer support.",
    ],
    methods: [
      "Verify mechanism family, test pressure points, and apply controlled tactile mapping.",
      "Failure mode: over-pressing a warded device causes lock-state collapse; recover with recovery timing and exit.",
    ],
    useGuidance:
      "Apply this specialization only when the base lockpicking route and profile context are active.",
  },
  "spec:court-administration": {
    coreTasks: ["Coordinate petitions, precedence, and reporting obligations in court workflows."],
    limits: [
      "Do not infer court authority from household or trade experience alone.",
      "Keep ceremonial obligations explicit in every transition.",
    ],
    methods: [
      "Track dossier requirements, then route each decision through documented channels.",
      "Failure mode: missing a filing step invalidates the action; recover by replaying sequence against the procedure checklist.",
    ],
    useGuidance: "Use this specialization only within explicit court-administration pathways.",
  },
  "spec:weaponsmithing": {
    coreTasks: [
      "Forge and inspect weapon components using explicit craft thresholds and quality checkpoints.",
    ],
    limits: [
      "Keep inspection and safety controls separate from operational weapon use.",
      "Do not bypass heat-treatment and fit checks.",
    ],
    methods: [
      "Apply cycle-by-cycle forging control, then document balance and edge consistency.",
      "Failure mode: skipping inspections causes cumulative defect drift; recover through full reforge validation.",
    ],
    useGuidance:
      "Use this specialization when smithing context directly feeds weapon quality outcomes.",
  },
  "spec:home-coast-pilotage": {
    coreTasks: [
      "Apply local-water navigation through tide-aware micro-routes and familiar channel behavior.",
    ],
    limits: [
      "Do not project home-coast assumptions onto open-water operations.",
      "Do not ignore local exceptions and seasonal route notes.",
    ],
    methods: [
      "Validate route set against coastal references and weather overlays each transit segment.",
      "Failure mode: stale coastal memory causes grounding; recover by returning to pilotage baseline checks.",
    ],
    useGuidance: "Specialized for named Lankhmar coastal waters and related transfer requirements.",
  },
  "spec:desert-wayfinding": {
    coreTasks: [
      "Blend terrain memory, water-risk, and signs into long-distance arid-route planning.",
    ],
    limits: [
      "Do not ignore heat stress and exposure constraints.",
      "Avoid open-route commitment without water margin confirmation.",
    ],
    methods: [
      "Mark waypoints by scarcity logic, then verify each segment before continuing.",
      "Failure mode: route confidence without resource audit causes stranded movement; recover by halting and recalibrating.",
    ],
    useGuidance: "Use this specialization only when desert-route context is explicitly available.",
  },
  "spec:steppe-remount-training": {
    coreTasks: ["Cycle remount readiness, recovery windows, and rapid redeployment habits."],
    limits: [
      "Do not generalize Steppe cadence to unrelated mounted doctrine.",
      "Do not overload remount rotation without recovery checks.",
    ],
    methods: [
      "Assign animal load, rest spacing, and handler response per leg in fixed rotation.",
      "Failure mode: ignoring recovery leads to remount fatigue; recover by rebalancing rotation.",
    ],
    useGuidance: "Apply for clan horse movement where remount availability is central.",
  },
  "skill:sword": {
    coreTasks: ["Execute controlled guards, cut angles, and parry timing in close combat loops."],
    limits: [
      "Do not overcommit when distance collapses unexpectedly.",
      "Avoid fixed timing without visual recalibration.",
    ],
    methods: [
      "Set entry distance, choose angle, and finish with secure reset posture.",
      "Failure mode: predictable cadence exposes counters; recover with distance reset and angle pivot.",
    ],
    useGuidance: "This envelope applies to direct sword-and-shield or paired routines when active.",
  },
  "skill:shield": {
    coreTasks: ["Align shield plane, angle, and stepping to absorb and redirect pressure."],
    limits: [
      "Do not treat shield hold as static posture under all threats.",
      "Avoid long-duration blocks without mobility resets.",
    ],
    methods: [
      "Pair coverage with short pivots and pressure redirection checks.",
      "Failure mode: locked frame locks body into follow-on harm; recover through guarded footwork.",
    ],
    useGuidance: "Use shield control as a sustained protective framework within close distance.",
  },
  "skill:knife-dagger": {
    coreTasks: [
      "Keep compact arcs, retention paths, and fast transitions within protected spacing.",
    ],
    limits: [
      "Do not operate in broad-range assumptions for short-weapon work.",
      "Do not trade reach for tempo without compensating body position.",
    ],
    methods: [
      "Anchor grip, choose target micro-zones, and sequence retention exits.",
      "Failure mode: poor retention produces accidental loss; recover through reset-to-grip drill.",
    ],
    useGuidance:
      "This envelope supports close-range manipulative movement under constrained angles.",
  },
  "skill:spear": {
    coreTasks: ["Maintain distance, drive thrust vectors, and recover at safe extension points."],
    limits: [
      "Do not overstep into unsupported lunging sequences.",
      "Avoid overextending beyond recoverable foot geometry.",
    ],
    methods: [
      "Alternate extension, binding, and foot recovery while reading opponent pressure.",
      "Failure mode: overreach breaks distance control; recover with retraction and guard reset.",
    ],
    useGuidance: "Use spear posture where distance and engagement rhythm are primary.",
  },
  "skill:perception": {
    coreTasks: [
      "Scan social, tactical, and environmental cues before committing any immediate action.",
    ],
    limits: [
      "Do not treat one cue as complete certainty.",
      "Separate suspicious signal from confirmed evidence.",
    ],
    methods: [
      "Record observations, rank confidence, and test for repeatability.",
      "Failure mode: cue fixation causes premature conclusions; recover by widening the cue set.",
    ],
    useGuidance: "Use perception when risk is present and assumptions need early validation.",
  },
  "skill:athletics": {
    coreTasks: [
      "Build movement sequences around load, acceleration, and sustainable exertion envelopes.",
    ],
    limits: [
      "Do not force sprint profiles without readiness checks.",
      "Avoid repeating maximal loads with no recovery.",
    ],
    methods: [
      "Warm, execute, and cool down with explicit condition checkpoints.",
      "Failure mode: fatigue masking leads to avoidable collapse; recover with pacing reset and technique review.",
    ],
    useGuidance: "Use this for controlled locomotion and sustained physical demand routines.",
  },
  "skill:survival": {
    coreTasks: ["Prioritize shelter, hydration, and decision control in adverse field states."],
    limits: [
      "Do not expose group to prolonged exposure to avoidable hazards.",
      "Do not substitute optimism for risk mitigation.",
    ],
    methods: [
      "Establish hazard map, conserve resources, and enforce route patience.",
      "Failure mode: unscheduled exertion collapses readiness; recover through immediate risk triage.",
    ],
    useGuidance: "Apply when environmental pressure dominates tactical or social options.",
  },
  "skill:leadership": {
    coreTasks: ["Set intent, monitor morale pressure, and assign role-aligned responsibilities."],
    limits: [
      "Do not over-centralize without relay channels.",
      "Avoid silent assumption of consensus.",
    ],
    methods: [
      "Brief clearly, assign timing windows, and request confirmation checkpoints.",
      "Failure mode: ambiguity degrades alignment; recover by narrowing priorities and re-issuing orders.",
    ],
    useGuidance: "Use this envelope for mixed-unit coordination under moderate to high pressure.",
  },
  "skill:pharmacy": {
    coreTasks: [
      "Compose remedies by dose windows, ingredient interactions, and monitoring obligations.",
    ],
    limits: [
      "Do not mix compounds without compatibility checks.",
      "Avoid blind scaling of dosage by gut feeling.",
    ],
    methods: [
      "Prepare compounds, verify potency bands, and track response intervals.",
      "Failure mode: dosing assumptions cause adverse effects; recover with immediate intake pause and reassessment.",
    ],
    useGuidance: "Use pharmacy when treatment planning needs measurable preparation and follow-up.",
  },
  "skill:plant-lore": {
    coreTasks: ["Identify plant state, season, and utility before recommending extraction or use."],
    limits: [
      "Do not apply static use rules across seasonal cycles.",
      "Avoid assuming availability from memory alone.",
    ],
    methods: [
      "Verify morphology cues, then cross-check usage patterns.",
      "Failure mode: misidentification causes failed outcomes; recover by isolating specimen and rechecking markers.",
    ],
    useGuidance:
      "Use this envelope for practical botany under healing, ritual, and logistical contexts.",
  },
  "skill:streetwise": {
    coreTasks: [
      "Map rumor flows, sentiment signals, and likely social pressure before approaching actors.",
    ],
    limits: [
      "Do not treat rumor as fact.",
      "Avoid exposing objectives before trust checks complete.",
    ],
    methods: [
      "Trace influence lines, confirm source reliability, and preserve exit options.",
      "Failure mode: unverified chatter triggers preventable exposure; recover through channel narrowing.",
    ],
    useGuidance:
      "Use for monitoring civic pressure, rumor vectors, and social exposure before any sensitive approach or information contact.",
  },
  "skill:underworld": {
    coreTasks: ["Track illicit intermediaries and incentive chains across hidden exchanges."],
    limits: [
      "Do not commit to inferred motives without corroboration.",
      "Avoid escalating covert assumptions into open action.",
    ],
    methods: [
      "Follow transaction echoes, record trust markers, and test contradictions.",
      "Failure mode: trusting false intermediaries compounds risk; recover by dropping chain and re-verifying links.",
    ],
    useGuidance:
      "Use underworld skill only for structured network analysis under proper profile constraints.",
  },
  "skill:deception": {
    coreTasks: [
      "Construct credible narratives with bounded scope, timing, and plausible deniability.",
    ],
    limits: [
      "Do not sustain deception beyond planned exit criteria.",
      "Do not replace social reading with scripted certainty.",
    ],
    methods: [
      "Control body language, reveal cadence, and rehearse fallback explanations.",
      "Failure mode: narrative drift collapses the cover; recover with immediate controlled disclosure strategy.",
    ],
    useGuidance: "Use only in scenarios that explicitly permit staged social influence.",
  },
  "skill:stealth": {
    coreTasks: ["Reduce signature through movement cadence, timing, and environmental masking."],
    limits: [
      "Do not ignore light and sound signatures when conditions shift.",
      "Avoid prolonged stillness in high-reactivity zones.",
    ],
    methods: [
      "Plan ingress window, anchor route noise profile, and monitor watch cycles.",
      "Failure mode: predictable movement creates visual lock; recover with route and tempo pivot.",
    ],
    useGuidance: "Use stealth for threat minimization, not for bypassing explicit prohibitions.",
  },
  "skill:lockpicking": {
    coreTasks: ["Map ward geometry, tension behavior, and tactile feedback in controlled order."],
    limits: [
      "Do not force mechanisms beyond material tolerance.",
      "Do not claim completion until full closure is confirmed.",
    ],
    methods: [
      "Set tactile baseline, probe incremental movement, and stop on abnormal resistance.",
      "Failure mode: excessive force damages trust context; recover by withdrawing and reset inspection.",
    ],
    useGuidance:
      "Use this only when lawful entry authority and profile route constraints are already satisfied before attempting any warded-entry operation.",
  },
  "skill:sleight-of-hand": {
    coreTasks: ["Coordinate hand choreography with composure control and misdirection rhythm."],
    limits: [
      "Do not attempt concealment beyond practiced body pathways.",
      "Avoid repeated gesture patterns that become detectable.",
    ],
    methods: [
      "Segment action into preload, swap, and post-motion confirmation.",
      "Failure mode: timing drift causes obvious tells; recover by reducing complexity and replaying choreography.",
    ],
    useGuidance: "Apply for subtle transfer operations where social scrutiny is sustained.",
  },
  "skill:insight": {
    coreTasks: ["Infer intent through verbal, behavioral, and contradiction signals in sequence."],
    limits: [
      "Do not over-index on a single signal type.",
      "Do not ignore contextual contradiction after a consistent read.",
    ],
    methods: [
      "Score cue clusters, compare with prior patterns, and mark confidence bands.",
      "Failure mode: one false signal flips conclusion; recover by requesting another independent cue set.",
    ],
    useGuidance: "Use insight to gate high-stakes social commitments and negotiations.",
  },
  "skill:disguise": {
    coreTasks: [
      "Build and preserve a sustained role profile through speech, posture, and routine behavior.",
    ],
    limits: [
      "Do not stretch role consistency across repeated high-frequency checkpoints.",
      "Do not change appearance without intent alignment.",
    ],
    methods: [
      "Maintain behavioral loop, manage contact windows, and pre-plan exit statements.",
      "Failure mode: inconsistent details expose the disguise; recover through controlled reset and role correction.",
    ],
    useGuidance:
      "Use this envelope for recurrent social entry when repeated recognition risk exists.",
  },
  "skill:administration": {
    coreTasks: [
      "Sequence routing, intake, and approvals through institutional expectation chains.",
    ],
    limits: [
      "Do not bypass documented routing requirements.",
      "Do not compress deadlines without authority scope.",
    ],
    methods: [
      "Create request ledger, confirm routing owner, and execute handoff only on explicit completion points.",
      "Failure mode: skipping routing nodes returns requests to dead-ends; recover with route recovery checklist.",
    ],
    useGuidance: "Use administration for process-heavy obligations where traceability is required.",
  },
  "skill:customs": {
    coreTasks: [
      "Interpret local custom law and expected conduct before action in sensitive institutions.",
    ],
    limits: [
      "Do not project one household norm into another legal environment.",
      "Avoid dismissing inherited obligations in negotiation contexts.",
    ],
    methods: [
      "Check etiquette, hierarchy, and consequence matrix before engagement.",
      "Failure mode: norm mismatch creates social penalties; recover by re-aligning to host custom.",
    ],
    useGuidance: "Use this for cultural interfaces where expectations carry real consequences.",
  },
  "skill:oratory": {
    coreTasks: [
      "Structure message for audience authority, urgency, and acceptable persuasive channel.",
    ],
    limits: [
      "Do not over-amplify when procedural authority is stronger than rhetoric.",
      "Avoid overpromising under incomplete facts.",
    ],
    methods: [
      "Frame premise, evidence, and requested outcome with clear escalation order.",
      "Failure mode: emotional overreach erodes credibility; recover with concise evidence-first revision.",
    ],
    useGuidance: "Use oratory where influence outcomes depend on controlled audience framing.",
  },
  "skill:bookkeeping": {
    coreTasks: [
      "Reconcile obligations, ledgers, and recurring account obligations with audit points.",
    ],
    limits: [
      "Do not leave transactions unbalanced beyond check windows.",
      "Do not omit source references for reconciliations.",
    ],
    methods: [
      "Validate balances, trace source documents, and document adjustment rationale.",
      "Failure mode: skipped verification compounds later disputes; recover with full ledger rewind and correction.",
    ],
    useGuidance: "Apply bookkeeping when financial continuity and accountability are binding.",
  },
  "skill:trade": {
    coreTasks: [
      "Negotiate commodity value, payment terms, and settlement structure before agreement.",
    ],
    limits: [
      "Do not ignore margin, duty, or collateral obligations.",
      "Do not treat one bid as final without mutual commitment.",
    ],
    methods: [
      "Model valuation options, confirm constraints, and stage closing language.",
      "Failure mode: rushed settlement triggers unfavorable reversals; recover by re-opening valuation steps.",
    ],
    useGuidance: "Use trade envelopes where negotiation and settlement obligations intersect.",
  },
  "skill:bargaining": {
    coreTasks: ["Sequence concession windows while preserving long-form leverage."],
    limits: [
      "Do not concede key terms before fallback terms are secured.",
      "Avoid escalating pressure when leverage is already below baseline.",
    ],
    methods: [
      "Set non-negotiables, release concessions incrementally, and monitor countersignals.",
      "Failure mode: premature concessions erase leverage; recover by reasserting priorities and stepping back.",
    ],
    useGuidance: "Use bargaining as the constrained exchange envelope for negotiation.",
  },
  "skill:appraisal": {
    coreTasks: ["Evaluate provenance, condition, and hidden defects before assigning value."],
    limits: [
      "Do not conflate appearance with craftsmanship.",
      "Avoid transferring uncertain valuation into binding commitments.",
    ],
    methods: [
      "Inspect structure, verify provenance, and note defect risk alongside context.",
      "Failure mode: undiscovered defects cause avoidable transfer losses; recover through deeper inspection pass.",
    ],
    useGuidance: "Use appraisal when material decisions carry medium-to-high exchange risk.",
  },
  "skill:smithing": {
    coreTasks: ["Run forge cycles with heat control, shaping, and structural quality checks."],
    limits: [
      "Do not skip cooldown and stress-relief checkpoints.",
      "Do not ignore microfracture cues in inspection.",
    ],
    methods: [
      "Apply repeatable shaping passes and inspect each load-bearing edge.",
      "Failure mode: rushed forge cycles produce brittle outcomes; recover with rework and structural retest.",
    ],
    useGuidance: "Use smithing for stable production and quality assurance routines.",
  },
  "skill:seamanship": {
    coreTasks: ["Coordinate deck movement, cargo balance, and safety under tide and load demands."],
    limits: [
      "Do not ignore weather and load interactions.",
      "Do not proceed with channel changes without command confirmation.",
    ],
    methods: [
      "Set operational rhythm, secure routes, and execute with load-aware commands.",
      "Failure mode: poor timing with tides creates avoidable hazard; recover with immediate stand-down and drift check.",
    ],
    useGuidance:
      "Apply seamanship to vessel command where timing and environmental coupling are critical.",
  },
  "skill:pilotage": {
    coreTasks: ["Run local-water movement through obstacle memory and approach sequencing."],
    limits: [
      "Do not assume open-water rules in narrow ports.",
      "Avoid channel entry without verified markers.",
    ],
    methods: [
      "Track approach vectors, local notes, and tide windows before committing route.",
      "Failure mode: anchor mismatch causes missed approaches; recover by resetting to known waypoints.",
    ],
    useGuidance:
      "Use pilotage for near-shore movement where channel restrictions, local notes, and tide windows remain explicit gate conditions.",
  },
  "skill:swimming": {
    coreTasks: ["Maintain buoyancy, propulsion, and controlled return under load and fatigue."],
    limits: [
      "Do not push distance planning over recovery and visibility.",
      "Do not enter surf zones without contingency route.",
    ],
    methods: [
      "Monitor breath cadence, stroke economy, and exhaustion margin.",
      "Failure mode: fatigue-induced loss of orientation; recover through immediate safe return and recalibration.",
    ],
    useGuidance: "Use this envelope for water movement requiring controlled exertion and recovery.",
  },
  "skill:weather-lore": {
    coreTasks: ["Identify short-range weather transitions from pressure, wind, and cue arrays."],
    limits: [
      "Do not rely on one cue family alone.",
      "Avoid route commitments before hazard confirmation.",
    ],
    methods: [
      "Cross-check atmospheric signals and assign confidence to each weather window.",
      "Failure mode: stale forecasting creates route entrapment; recover via local cue re-sampling.",
    ],
    useGuidance:
      "Use weather-lore as the primary pre-route envelope whenever wind, pressure, and cloud shifts can change hazard windows or safe scheduling.",
  },
  "skill:wayfinding": {
    coreTasks: ["Select route with terrain memory, sightline control, and uncertainty budgets."],
    limits: [
      "Do not commit to memory-only routing without landmark confirmation.",
      "Do not skip fallback route planning.",
    ],
    methods: [
      "Verify next node, preserve fallback options, and monitor drift from planned corridor.",
      "Failure mode: orientation loop from weak landmarks; recover by forcing reorientation check.",
    ],
    useGuidance: "Use wayfinding whenever local travel requires repeatable route justification.",
  },
  "skill:animal-handling": {
    coreTasks: ["Condition mounts through cues, pace control, and responsive rein management."],
    limits: [
      "Do not ignore stress indicators from animals.",
      "Avoid forcing pace changes without adaptation windows.",
    ],
    methods: [
      "Assess readiness, then execute transitions with incremental control shifts.",
      "Failure mode: rushed handling destabilizes mount and rider; recover with grounding and calm reset.",
    ],
    useGuidance: "Use this envelope for sustained mounted reliability in operational travel.",
  },
  "skill:tracking": {
    coreTasks: ["Translate signs into probable paths and repeatable movement hypotheses."],
    limits: [
      "Do not overfit one set of signs to many outcomes.",
      "Do not assume continuity without confirmation signatures.",
    ],
    methods: [
      "Collect footprint, disturbance, and environmental context before declaring direction.",
      "Failure mode: sign misattribution misdirects pursuit; recover by adding temporal spacing and terrain sampling.",
    ],
    useGuidance: "Use tracking when route inference affects pursuit, escort, or search outcomes.",
  },
  "skill:hunting": {
    coreTasks: [
      "Conceal approach, read prey movement, and select acquisition timing with low noise.",
    ],
    limits: [
      "Do not increase noise at high-value edges.",
      "Avoid pursuit extension once risk exceeds threshold.",
    ],
    methods: [
      "Map scent and trail, set approach geometry, and execute low-signature engagement.",
      "Failure mode: overpursuit wastes effort and increases risk; recover by break-contact and reassessment.",
    ],
    useGuidance:
      "Apply hunting as controlled acquisition when sign quality and concealment matter.",
  },
  "skill:riding": {
    coreTasks: ["Transition gaits and terrain posture to keep mounted endurance and control."],
    limits: [
      "Do not force mounts past recovery pacing windows.",
      "Do not rely on short gains for long-route completion.",
    ],
    methods: [
      "Stabilize seat position, map distance pacing, and confirm horse feedback at each leg.",
      "Failure mode: sustained imbalance damages rider and mount; recover through gait reset.",
    ],
    useGuidance:
      "Use riding for mounted movement requiring route endurance and command consistency.",
  },
};

const authoredCompetencyDocumentationIds = Object.keys(authoredCompetencyDocumentation);
for (const id of authoredCompetencyDocumentationIds) {
  if (!Object.hasOwn(authoredTaskEnvelopeByCompetencyId, id)) {
    throw new Error(`Missing task envelope entry for authored competency ${id}`);
  }
}
for (const id of Object.keys(authoredTaskEnvelopeByCompetencyId)) {
  if (!Object.hasOwn(authoredCompetencyDocumentation, id)) {
    throw new Error(`Task envelope has no matching authored competency entry for ${id}`);
  }
}

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
  const taskEnvelope =
    authoredTaskEnvelopeByCompetencyId[record.id] ??
    (() => {
      throw new Error(`Missing explicit task envelope for ${record.id}`);
    })();

  return {
    description: normalizedDescription,
    shortLabel: shortLabel(authored?.shortLabel ?? record.name),
    shortDescription: normalizedShortDescription,
    taskEnvelope,
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
    taskEnvelope:
      authoredTaskEnvelopeByCompetencyId[specialization.id] ??
      (() => {
        throw new Error(`Missing specialization task envelope for ${specialization.id}`);
      })(),
    shortLabel: shortLabel(specialization.name),
    shortDescription: normalizeWhitespace(specialization.description),
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
