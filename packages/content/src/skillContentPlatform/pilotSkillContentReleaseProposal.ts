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
  recordVersion: "2",
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
  "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/75",
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
      "First aid is the immediate care given after injury or sudden illness. A competent practitioner checks for danger, supports breathing, controls severe bleeding, prevents further harm, and arranges appropriate help without attempting prolonged treatment.",
    shortDescription:
      "Give immediate care that stabilizes an injured or suddenly ill person until further help is available.",
  },
  "skill:dodge": {
    description:
      "Dodge is the practiced use of balance, timing, and footwork to move clear of an immediate physical threat. It helps a person avoid contact while staying upright and aware, but it does not replace cover, distance, or a sound defensive position.",
    shortDescription:
      "Move out of the path of an immediate physical threat while keeping your balance.",
  },
  "skill:battle-tactics": {
    description:
      "Battle tactics is the practical direction of people during an armed engagement. A competent tactician reads terrain and opposing forces, assigns clear roles, coordinates movement and timing, and prepares workable responses when the situation changes.",
    shortDescription:
      "Direct a group in battle by reading the situation and coordinating positions, timing, and responses.",
  },
  "skill:medicine": {
    description:
      "Medicine is the assessment and non-operative treatment of illness and injury. A competent practitioner gathers symptoms and history, examines the patient, weighs likely causes, chooses proportionate treatment, and monitors recovery while recognizing when specialist care is needed.",
    shortDescription:
      "Assess illness and injury, choose suitable non-operative treatment, and monitor recovery.",
  },
  "skill:surgery": {
    description:
      "Surgery treats injury or disease through deliberate operative intervention. A competent surgeon plans the procedure, controls contamination and bleeding, works precisely around vulnerable structures, and manages closure and recovery; diagnosis and general aftercare remain broader medical work.",
    shortDescription:
      "Treat injury or disease through planned operative procedures and careful recovery care.",
  },
  "skill:research": {
    description:
      "Research is the systematic search for a reliable answer using records, testimony, observation, or experiment. A competent researcher frames a clear question, finds relevant evidence, checks provenance and bias, compares sources, and states conclusions with their remaining uncertainty.",
    shortDescription:
      "Find and evaluate evidence to answer a question with a supportable conclusion.",
  },
  "skill:law:olog-princely": {
    description:
      "This legal skill is the interpretation and application of a defined body of law. A competent practitioner identifies the governing rule, follows the proper forum and procedure, and distinguishes legal judgment from custom or personal influence.",
    shortDescription: "Interpret and apply a defined body of law through its proper procedures.",
  },
  "skill:dead-reckoning": {
    description:
      "Dead reckoning estimates present position from a known starting point, direction, speed, and elapsed time. A competent navigator records each leg, accounts for drift where possible, and updates the estimate when a trustworthy observation becomes available.",
    shortDescription:
      "Estimate your current position from a known start, course, speed, and travel time.",
  },
  "skill:chart-navigation": {
    description:
      "Chart navigation uses maps or charts to plan and follow a route. A competent navigator reads scale, symbols, bearings, depths or elevations, plots positions and waypoints, and checks the route against known hazards and changing conditions.",
    shortDescription: "Read and plot maps or charts to follow a route and avoid known hazards.",
  },
  "spoken:common": {
    description:
      "Spoken Common is the ability to understand and express meaning in a widely shared language. Competence covers ordinary conversation, attentive listening, clear pronunciation, idiom, and an expanding vocabulary across varied topics.",
    shortDescription: "Speak and understand a widely shared language in ordinary conversation.",
  },
  "spoken:mogrebi": {
    description:
      "This spoken-language skill is the ability to understand and express meaning through speech in the named language. Competence covers conversation, attentive listening, clear pronunciation, idiom, and an expanding vocabulary across varied topics.",
    shortDescription: "Speak and understand the named language in ordinary conversation.",
  },
  "spoken:ologian": {
    description:
      "This spoken-language skill is the ability to understand and express meaning through speech in the named language. Competence covers conversation, attentive listening, clear pronunciation, idiom, and an expanding vocabulary across varied topics.",
    shortDescription: "Speak and understand the named language in ordinary conversation.",
  },
  "spoken:phoenician": {
    description:
      "This spoken-language skill is the ability to understand and express meaning through speech in the named language. Competence covers conversation, attentive listening, clear pronunciation, idiom, and an expanding vocabulary across varied topics.",
    shortDescription: "Speak and understand the named language in ordinary conversation.",
  },
  "spoken:nkolian": {
    description:
      "This spoken-language skill is the ability to understand and express meaning through speech in the named language. Competence covers conversation, attentive listening, clear pronunciation, idiom, and an expanding vocabulary across varied topics.",
    shortDescription: "Speak and understand the named language in ordinary conversation.",
  },
  "spoken:scythian": {
    description:
      "This spoken-language skill is the ability to understand and express meaning through speech in the named language. Competence covers conversation, attentive listening, clear pronunciation, idiom, and an expanding vocabulary across varied topics.",
    shortDescription: "Speak and understand the named language in ordinary conversation.",
  },
  "written:mogrebi:sacred-mogrebi": {
    description:
      "This written tradition is the ability to read and compose the named language in its linked script and textual conventions. A competent writer recognizes the script, applies spelling and grammar, and chooses forms suited to the purpose and reader.",
    shortDescription:
      "Read and write the named language using its linked script and textual conventions.",
  },
  "written:ologian:church-ologian": {
    description:
      "This written tradition is the ability to read and compose the named language in its linked script and textual conventions. A competent writer recognizes the script, applies spelling and grammar, and chooses forms suited to the purpose and reader.",
    shortDescription:
      "Read and write the named language using its linked script and textual conventions.",
  },
  "written:phoenician:phoenician": {
    description:
      "This written tradition is the ability to read and compose the named language in its linked script and textual conventions. A competent writer recognizes the script, applies spelling and grammar, and chooses forms suited to the purpose and reader.",
    shortDescription:
      "Read and write the named language using its linked script and textual conventions.",
  },
  "spec:household-guard-sword-shield-drill": {
    description:
      "Sword-and-shield drill is the coordinated use of both weapons as one fighting method. A competent practitioner links guard, footwork, attack, and defence so the shield protects without obstructing the sword and each movement prepares the next.",
    shortDescription: "Fight with sword and shield as a coordinated method of attack and defence.",
  },
  "spec:diagnostic-medicine": {
    description:
      "Diagnostic medicine focuses on determining the likely cause of a patient's condition. A competent diagnostician combines history, examination, comparison of alternatives, and available tests while avoiding false certainty and revising the diagnosis when evidence changes.",
    shortDescription:
      "Identify the likely cause of illness by comparing symptoms, history, examination, and evidence.",
  },
  "spec:warded-lock-entry": {
    description:
      "Warded-lock entry is the opening of locks whose internal wards obstruct an incorrect key or tool. A competent practitioner identifies the ward pattern, selects and manipulates suitable tools, and limits damage that could jam the mechanism or reveal the attempt.",
    shortDescription:
      "Open warded locks by reading their internal obstructions and manipulating suitable tools.",
  },
  "spec:court-administration": {
    description:
      "Court administration is the accurate handling of filings, schedules, notices, records, and procedural steps for a court. A competent administrator keeps matters traceable and timely while distinguishing administrative duties from legal judgment or advocacy.",
    shortDescription:
      "Manage court filings, schedules, notices, and records according to established procedure.",
  },
  "spec:weaponsmithing": {
    description:
      "Weaponsmithing applies metalworking skill to weapons that must survive repeated impact while holding an effective form and edge. A competent weaponsmith selects material, controls heat and shape, balances the finished piece, and inspects it for dangerous flaws.",
    shortDescription: "Forge, finish, balance, and inspect metal weapons for reliable use.",
  },
  "spec:home-coast-pilotage": {
    description:
      "Home-coast pilotage is navigation through familiar coastal waters using detailed local knowledge. A competent pilot recognizes channels, landmarks, tides, currents, and recurring hazards, while checking that remembered conditions still match what is observed.",
    shortDescription:
      "Guide a vessel through familiar coastal waters using detailed local knowledge.",
  },
  "spec:desert-wayfinding": {
    description:
      "Desert wayfinding is route selection and orientation in arid terrain where landmarks, water, shade, and reliable bearings may be scarce. A competent traveller manages direction and distance while planning around heat, visibility, supplies, and safe fallback points.",
    shortDescription:
      "Find and follow routes across arid terrain while accounting for heat, water, and sparse landmarks.",
  },
  "spec:steppe-remount-training": {
    description:
      "Remount training prepares spare riding animals to replace a tired or injured mount during extended travel. A competent handler conditions several animals, transfers tack and riders safely, and rotates effort without exhausting the remounts.",
    shortDescription:
      "Train and rotate spare riding animals to sustain long-distance mounted travel.",
  },
  "skill:sword": {
    description:
      "Sword skill covers controlled attack and defence with a sword. A competent fighter manages distance, guard, timing, footwork, cuts or thrusts, and recovery, adapting technique to the weapon and situation without treating another weapon as interchangeable.",
    shortDescription:
      "Attack and defend with a sword using effective distance, guard, timing, and footwork.",
  },
  "skill:shield": {
    description:
      "Shield skill is the active use of a shield to intercept attacks, control lines of approach, and create safer movement. A competent user positions and angles the shield without losing sight, balance, mobility, or the ability to act with the other hand.",
    shortDescription:
      "Use a shield to intercept attacks, control openings, and move under protection.",
  },
  "skill:knife-dagger": {
    description:
      "Knife and dagger skill covers close-range attack, defence, and weapon retention with short blades. A competent fighter uses compact movement, precise point or edge placement, and careful distance, recognizing the severe risk of fighting within an opponent's reach.",
    shortDescription:
      "Fight at close range with knives or daggers while controlling distance and retaining the weapon.",
  },
  "skill:spear": {
    description:
      "Spear skill covers attack and defence with a hafted thrusting weapon. A competent fighter uses reach, point control, footwork, leverage, and recovery to threaten at distance while avoiding overextension or loss of control when the distance closes.",
    shortDescription:
      "Use a spear's reach and point control to attack, defend, and manage distance.",
  },
  "skill:perception": {
    description:
      "Perception is the deliberate noticing and interpretation of sensory details. A competent observer scans methodically, separates observation from assumption, recognizes changes or inconsistencies, and directs attention without claiming certainty about facts that cannot yet be confirmed.",
    shortDescription:
      "Notice and interpret relevant sensory details before drawing conclusions from them.",
  },
  "skill:athletics": {
    description:
      "Athletics is trained whole-body movement for running, jumping, climbing, lifting, and similar exertion. A competent athlete coordinates strength, balance, speed, and endurance, chooses efficient technique, and recognizes when fatigue or load makes an action unsafe.",
    shortDescription:
      "Run, jump, climb, lift, and sustain demanding movement with trained control.",
  },
  "skill:survival": {
    description:
      "Survival is staying alive and functional when shelter, water, food, warmth, or rescue are uncertain. A competent practitioner sets priorities, conserves resources, makes or finds protection, and manages exposure and travel without confusing endurance with avoidable risk.",
    shortDescription:
      "Secure water, shelter, warmth, food, and safe movement when ordinary support is unavailable.",
  },
  "skill:leadership": {
    description:
      "Leadership is guiding people toward a shared objective under uncertain or demanding conditions. A competent leader communicates intent, assigns understandable responsibilities, listens and adapts, sustains trust and morale, and takes responsibility without replacing the expertise of others.",
    shortDescription:
      "Guide people toward a shared objective through clear direction, trust, and responsible decisions.",
  },
  "skill:pharmacy": {
    description:
      "Pharmacy is the preparation, identification, storage, and safe use of medicinal substances. A competent practitioner measures ingredients and doses, recognizes interactions and contamination, records preparations, and gives clear instructions while leaving diagnosis and operative care to their own disciplines.",
    shortDescription:
      "Prepare, store, measure, and dispense medicinal substances safely and accurately.",
  },
  "skill:plant-lore": {
    description:
      "Plant lore is practical knowledge of plants, their habitats, seasons, and uses. A competent practitioner identifies specimens from several features, distinguishes useful plants from harmful lookalikes, harvests responsibly, and treats uncertain identification as unsafe.",
    shortDescription:
      "Identify plants, understand their practical uses, and avoid harmful lookalikes.",
  },
  "skill:streetwise": {
    description:
      "Streetwise is practical judgment about how unfamiliar urban places work at ground level. A competent practitioner reads local behaviour, finds ordinary services and information, recognizes common dangers or scams, and approaches people without assuming every rumour is true.",
    shortDescription:
      "Navigate urban life by reading local behaviour, finding information, and recognizing common risks.",
  },
  "skill:underworld": {
    description:
      "Underworld is knowledge of concealed and illicit networks, their roles, customs, markets, and risks. A competent practitioner recognizes likely intermediaries and warning signs, seeks information cautiously, and understands that reputation or rumour is not proof of trust.",
    shortDescription:
      "Recognize and navigate illicit networks, hidden markets, intermediaries, and their risks.",
  },
  "skill:deception": {
    description:
      "Deception is the deliberate creation of a false belief through words, behaviour, omission, or staged evidence. A competent deceiver keeps the claim plausible and consistent, reads the audience's reactions, and limits details that can be checked or contradicted.",
    shortDescription:
      "Create and maintain a plausible false impression through words, behaviour, or omission.",
  },
  "skill:stealth": {
    description:
      "Stealth is moving or remaining present without attracting notice. A competent practitioner uses cover, light, sound, timing, pace, and observation to reduce signs of passage, while recognizing that poor terrain or an alert observer can make concealment impossible.",
    shortDescription:
      "Move or remain present without notice by controlling sound, visibility, timing, and signs.",
  },
  "skill:lockpicking": {
    description:
      "Lockpicking is opening a mechanical lock without its intended key by examining and manipulating its internal parts. A competent practitioner identifies the lock's feedback, applies delicate tool pressure, and avoids damage that could jam the mechanism.",
    shortDescription:
      "Open mechanical locks without their keys by sensing and manipulating internal parts.",
  },
  "skill:sleight-of-hand": {
    description:
      "Sleight of hand is the concealed or misleading manipulation of small objects through dexterity, timing, and attention control. A competent practitioner makes movements appear natural, coordinates both hands and posture, and adapts when an observer's attention shifts unexpectedly.",
    shortDescription:
      "Manipulate or conceal small objects through dexterity, timing, and controlled attention.",
  },
  "skill:insight": {
    description:
      "Insight is the reasoned interpretation of another person's motives, emotions, or intentions from behaviour and context. A competent observer notices changes and contradictions, considers alternative explanations, and treats impressions as uncertain rather than as proof.",
    shortDescription:
      "Interpret motives and emotions from behaviour and context without mistaking impressions for proof.",
  },
  "skill:disguise": {
    description:
      "Disguise is altering appearance and behaviour so a person is mistaken for someone else or overlooked as ordinary. A competent practitioner coordinates clothing, grooming, posture, voice, and plausible conduct, and avoids details that close scrutiny would expose.",
    shortDescription:
      "Alter appearance and behaviour to support a plausible identity or pass without notice.",
  },
  "skill:administration": {
    description:
      "Administration is the orderly handling of records, correspondence, schedules, requests, and routine procedures. A competent administrator keeps information accurate and retrievable, follows work through to completion, and recognizes decisions that require separate authority or expertise.",
    shortDescription:
      "Organize records, correspondence, schedules, and routine procedures so work remains accurate and traceable.",
  },
  "skill:customs": {
    description:
      "Customs is knowledge of the unwritten conventions that shape conduct in a particular community or situation. A competent practitioner recognizes expectations around greeting, hospitality, status, exchange, and offence, while distinguishing local practice from formal law.",
    shortDescription:
      "Recognize and follow local social conventions while distinguishing custom from formal law.",
  },
  "skill:oratory": {
    description:
      "Oratory is speaking to an audience with a clear purpose and deliberate structure. A competent speaker organizes an argument, uses language and delivery suited to the listeners, responds to their mood, and makes important points memorable without relying on volume alone.",
    shortDescription:
      "Address an audience persuasively through clear structure, suitable language, and deliberate delivery.",
  },
  "skill:bookkeeping": {
    description:
      "Bookkeeping is the systematic recording of money, goods, debts, and payments. A competent bookkeeper classifies entries, maintains ledgers, reconciles totals against evidence, and identifies omissions or inconsistencies without making unsupported claims about their cause.",
    shortDescription: "Record and reconcile money, goods, debts, and payments in accurate ledgers.",
  },
  "skill:trade": {
    description:
      "Trade is the practical conduct of exchanging goods or services across a market. A competent trader understands supply, demand, quality, costs, terms, transport, and settlement, and can judge whether an exchange is workable without assuming every price is fair.",
    shortDescription:
      "Buy, sell, and exchange goods or services with sound knowledge of markets, costs, and terms.",
  },
  "skill:bargaining": {
    description:
      "Bargaining is negotiating an exchange by testing priorities, offers, concessions, and alternatives. A competent bargainer listens for what matters to each side, makes deliberate proposals, and knows when further pressure is more likely to end the negotiation than improve it.",
    shortDescription:
      "Negotiate an exchange by testing priorities, offers, concessions, and alternatives.",
  },
  "skill:appraisal": {
    description:
      "Appraisal is the informed estimation of an object's identity, condition, quality, and likely value. A competent appraiser examines materials and workmanship, checks provenance where possible, compares relevant examples, and states uncertainty about hidden defects or an unfamiliar market.",
    shortDescription:
      "Estimate an object's identity, condition, quality, and value from evidence and comparison.",
  },
  "skill:smithing": {
    description:
      "Smithing is shaping and joining metal through controlled heating, hammering, cutting, and finishing. A competent smith selects suitable stock, manages temperature and strain, forms the work accurately, and checks the finished object for weakness or poor fit.",
    shortDescription: "Shape, join, finish, and inspect metal using controlled heat and tools.",
  },
  "skill:seamanship": {
    description:
      "Seamanship is the practical operation and care of a vessel and its equipment. A competent sailor handles lines and sails or other controls, secures people and cargo, follows commands, reads immediate conditions, and performs routine work safely on a moving deck.",
    shortDescription:
      "Operate and care for a vessel, its equipment, people, and cargo in changing conditions.",
  },
  "skill:pilotage": {
    description:
      "Pilotage is guiding a vessel through confined or coastal waters where local hazards matter. A competent pilot uses charts, observations, tides, currents, markers, soundings, and local knowledge to choose and continually verify a safe track.",
    shortDescription:
      "Guide a vessel through confined or coastal waters by tracking local hazards and conditions.",
  },
  "skill:swimming": {
    description:
      "Swimming is controlled movement and survival in water. A competent swimmer manages breathing, buoyancy, propulsion, direction, clothing or load, and fatigue, and chooses a safe exit rather than pressing on after control begins to fail.",
    shortDescription:
      "Move and remain safe in water by controlling breathing, buoyancy, direction, and fatigue.",
  },
  "skill:weather-lore": {
    description:
      "Weather lore is practical forecasting from clouds, wind, pressure, temperature, moisture, and recurring local patterns. A competent observer compares several signs, estimates near-term change, and updates the forecast rather than treating one omen or old pattern as certain.",
    shortDescription:
      "Forecast near-term weather by comparing atmospheric signs and recurring local patterns.",
  },
  "skill:wayfinding": {
    description:
      "Wayfinding is choosing and following a route through terrain without depending on a prepared chart. A competent traveller uses landmarks, direction, distance, terrain shape, memory, and repeated position checks, and keeps a fallback when uncertain.",
    shortDescription:
      "Choose and follow a route through terrain using landmarks, direction, distance, and memory.",
  },
  "skill:animal-handling": {
    description:
      "Animal handling is safely directing and caring for domesticated or trained animals. A competent handler reads behaviour and stress, uses consistent cues and restraint, builds cooperation, and adapts to the species and individual rather than relying on force alone.",
    shortDescription:
      "Direct and care for trained animals by reading behaviour and using safe, consistent cues.",
  },
  "skill:tracking": {
    description:
      "Tracking is following a person or animal from the physical signs of passage. A competent tracker compares prints, disturbed ground, broken vegetation, scent, weather, and timing to infer a likely route while revising conclusions when signs conflict.",
    shortDescription:
      "Follow a person or animal by interpreting physical signs of passage and their age.",
  },
  "skill:hunting": {
    description:
      "Hunting is locating, approaching, and taking wild game with suitable tools and minimal waste. A competent hunter reads habitat and sign, controls scent and noise, chooses an ethical and effective opportunity, and can recover and handle the quarry.",
    shortDescription:
      "Locate, approach, take, and recover wild game with suitable tools and minimal waste.",
  },
  "skill:riding": {
    description:
      "Riding is directing a mount while maintaining a balanced, effective seat. A competent rider controls pace and direction, adapts to terrain and the animal's condition, uses tack correctly, and avoids exhausting or injuring the mount through poor balance or demands.",
    shortDescription:
      "Ride and direct a mount with balanced control across changing pace, terrain, and fatigue.",
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

function documentationForRecord(
  record: PilotSkillContentCompetencyRecord | PilotSkillContentSpecializationRecord,
) {
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
  const documented = documentationForRecord(specialization);
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
    description: documented.description,
    domainId: parent.domainId,
    metadata: cloneMetadata(specialization.id, "specialization"),
    parentCompetencyId,
    taskEnvelope: documented.taskEnvelope,
    shortLabel: documented.shortLabel,
    shortDescription: documented.shortDescription,
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

export const pilotSkillContentReleaseCandidate2Input = {
  accessExceptions,
  compatibility: {
    characterMigrationReviewRequired: false,
    classification: "presentation-only",
    rationale:
      "Candidate 2 rewrites reader-facing descriptions while preserving the accepted structured mechanics and task scopes.",
  },
  competencies,
  contentVersion: "pilot-skills-content/2.0.0-candidate.2",
  domains,
  histories,
  id: "content-release:pilot-skills:2-candidate-2",
  profiles,
  provenance: [...proposalMetadataReference],
  relationships,
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
  scripts,
  status: "proposal",
  title: "Reader-facing Pilot Skill v2 candidate 2",
} satisfies Omit<SkillContentRelease, "manifest">;

export const pilotSkillContentReleaseProposalInput = pilotSkillContentReleaseCandidate2Input;
