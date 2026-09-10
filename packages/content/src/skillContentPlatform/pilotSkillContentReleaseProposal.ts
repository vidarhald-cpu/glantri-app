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
  recordVersion: "4",
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
  "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/83",
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
      "This spoken-language skill covers understanding everyday speech, taking part in conversation, and making questions or explanations clear to a listener. Competence includes attentive listening, intelligible pronunciation, suitable word choice, and recognizing when unfamiliar expressions require clarification.",
    shortDescription:
      "Follow everyday speech and take part in conversation with clear questions, answers, and explanations.",
  },
  "spoken:ologian": {
    description:
      "This spoken-language skill covers sustaining dialogue and conveying precise meaning when a subject becomes detailed or unfamiliar. Competence includes clear pronunciation, growing vocabulary, recognition of idiom and tone, and asking for or giving clarification when meaning is uncertain.",
    shortDescription:
      "Sustain spoken dialogue, convey precise meaning, and clarify unfamiliar words or expressions.",
  },
  "spoken:phoenician": {
    description:
      "This spoken-language skill covers following spoken instructions and accounts, responding appropriately, and explaining a sequence of events or ideas. Competence includes careful listening, coherent phrasing, accurate word choice, and adapting an explanation when the listener has misunderstood.",
    shortDescription:
      "Understand spoken instructions and accounts, then respond or explain ideas in a coherent sequence.",
  },
  "spoken:nkolian": {
    description:
      "This spoken-language skill covers joining discussion, expressing intent and nuance, and adjusting speech to the listener and situation. Competence includes listening for implication, selecting suitable vocabulary and pace, pronouncing words clearly, and checking that an important point was understood.",
    shortDescription:
      "Join discussions, express intent and nuance, and adapt speech to the listener and situation.",
  },
  "spoken:scythian": {
    description:
      "This spoken-language skill covers understanding questions and descriptions, giving a coherent account, and resolving misunderstandings during conversation. Competence includes attentive listening, clear pronunciation, flexible vocabulary, and restating or checking meaning when an exchange becomes unclear.",
    shortDescription:
      "Understand questions and descriptions, give coherent spoken accounts, and resolve misunderstandings in conversation.",
  },
  "written:mogrebi:sacred-mogrebi": {
    description:
      "This written tradition covers reading extended passages and composing accurate text in its associated language and script. Competence includes recognizing letter forms, applying spelling and grammar, organizing material for its purpose, and checking a finished passage for omissions or ambiguity.",
    shortDescription:
      "Read extended passages and compose accurate text in the associated language and script tradition.",
  },
  "written:ologian:church-ologian": {
    description:
      "This written tradition covers interpreting written statements and composing clear material for a particular purpose and reader. Competence includes fluent recognition of its script, control of spelling and grammar, orderly structure, and selecting an appropriate level of formality.",
    shortDescription:
      "Interpret written statements and compose clear, orderly text for a particular purpose and reader.",
  },
  "written:phoenician:phoenician": {
    description:
      "This written tradition covers reading, transcribing, and composing text with consistent use of its language, script, and layout conventions. Competence includes accurate character recognition, spelling and grammar, faithful copying, and arranging information so another reader can follow it.",
    shortDescription:
      "Read, transcribe, and compose text using consistent script, spelling, grammar, and layout.",
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

interface Candidate4AuthoredCompetencyDocumentation extends AuthoredCompetencyDocumentation {
  boundaries: readonly string[];
  typicalUses: readonly string[];
}

export const pilotSkillContentReleaseCandidate4AuthoritativeSourceSha256 =
  "e9d5e6800dde213bfd3f8cb42e626791863b0144f90ec52bcd76557758f3a10c";

export const pilotSkillContentReleaseCandidate4ExceptionCompetencyIds = [
  "skill:law:olog-princely",
  "spoken:mogrebi",
  "spoken:ologian",
  "spoken:phoenician",
  "spoken:nkolian",
  "spoken:scythian",
  "written:mogrebi:sacred-mogrebi",
  "written:ologian:church-ologian",
  "written:phoenician:phoenician",
  "spec:household-guard-sword-shield-drill",
  "spec:steppe-remount-training",
] as const;

export const pilotSkillContentReleaseCandidate4ExceptionNotes = {
  "skill:law:olog-princely":
    "named legal body; recommend removal from the generic catalogue or movement to setting-specific material.",
  "spoken:mogrebi": "named setting language; move to setting-specific language material.",
  "spoken:ologian": "named setting language; move to setting-specific language material.",
  "spoken:phoenician": "named setting language; move to setting-specific language material.",
  "spoken:nkolian": "named setting language; move to setting-specific language material.",
  "spoken:scythian": "named setting language; move to setting-specific language material.",
  "written:mogrebi:sacred-mogrebi":
    "named setting language and script tradition; move to setting-specific language material.",
  "written:ologian:church-ologian":
    "named setting language and script tradition; move to setting-specific language material.",
  "written:phoenician:phoenician":
    "named setting language and script; move to setting-specific language material.",
  "spec:household-guard-sword-shield-drill":
    "the “household guard” identity is setting- or institution-specific; move to setting-specific material unless that identity is intentionally generic in the wider catalogue.",
  "spec:steppe-remount-training":
    "the named regional-cultural identity is not cleanly campaign-agnostic; move to setting-specific material unless it is deliberately retained as a generic environmental specialism.",
} as const satisfies Record<
  (typeof pilotSkillContentReleaseCandidate4ExceptionCompetencyIds)[number],
  string
>;

export const pilotSkillContentReleaseCandidate4AuthoredDocumentation: Record<
  string,
  Candidate4AuthoredCompetencyDocumentation
> = {
  "skill:first-aid": {
    boundaries: [
      "Does not replace Medicine, Surgery, or Pharmacy.",
      "Does not establish the full cause of an illness.",
      "Does not make dangerous travel or treatment safe.",
    ],
    description:
      "First aid is the prompt assessment and care of someone who has been injured or has suddenly become ill. A capable practitioner first makes the scene safe, checks the person’s condition, supports breathing, controls serious bleeding, prevents further harm, and seeks appropriate assistance. It is immediate and limited care, guided by priorities and safety rather than prolonged treatment or diagnosis.",
    shortDescription:
      "Give immediate, practical care after injury or sudden illness until further help is available.",
    typicalUses: [
      "Control bleeding after an accident.",
      "Keep an injured companion warm, still, and monitored.",
      "Assess whether an unconscious person is breathing.",
      "Make an injury safe enough for transport or further care.",
    ],
  },
  "skill:dodge": {
    boundaries: [
      "Avoids an attack rather than intercepting it.",
      "Weapon and shield defence belong to their relevant competences.",
      "Cannot create room to move where none exists.",
    ],
    description:
      "Dodge is the ability to avoid being struck, caught, or intercepted by moving clear at the right moment. It depends on awareness, reaction, balance, timing, and enough room to move. A capable practitioner reads an opponent’s line of movement, keeps a stable stance, and recovers quickly after evasion rather than merely throwing themselves aside.",
    shortDescription:
      "Avoid an attack or interception through movement, timing, and body position.",
    typicalUses: [
      "Step clear of a blow or thrust.",
      "Avoid a charging person or animal.",
      "Escape a grasp in a crowded or confined space.",
      "Move through immediate danger without losing balance.",
    ],
  },
  "skill:battle-tactics": {
    boundaries: [
      "Does not make someone personally skilled with a weapon.",
      "Does not replace Leadership’s broader management of people.",
      "Concerns an engagement, not long-term military strategy.",
    ],
    description:
      "Battle tactics is the practical conduct of a particular armed engagement. A capable tactician reads terrain, visibility, formations, morale, movement, and the opponent’s likely intentions; then gives workable instructions that people can act on under pressure. It concerns immediate decisions during a fight: where to hold, when to move, whom to protect, and how to respond when a plan begins to fail.",
    shortDescription:
      "Direct people during an armed engagement by coordinating position, timing, and response.",
    typicalUses: [
      "Place defenders at a choke point or strong position.",
      "Coordinate a withdrawal or counterattack.",
      "Assign scouts, reserves, or rearguard duties.",
      "Adapt a plan when visibility, terrain, or casualties change.",
    ],
  },
  "skill:medicine": {
    boundaries: [
      "Surgery concerns operative intervention.",
      "Pharmacy concerns preparing and managing medicines.",
      "Does not guarantee a certain diagnosis.",
    ],
    description:
      "Medicine is the assessment and non-operative treatment of illness and injury. A capable practitioner gathers a history, examines the patient, weighs possible causes, chooses proportionate treatment, and observes whether the patient improves or worsens. Good medicine includes recognizing uncertainty and knowing when a condition requires more specialised care.",
    shortDescription:
      "Assess illness and injury, provide non-operative treatment, and follow recovery.",
    typicalUses: [
      "Examine a fever, infection, wound, or persistent pain.",
      "Decide how to rest, feed, protect, or monitor a patient.",
      "Recognise signs that an injury needs surgery.",
      "Follow recovery and alter treatment when it fails.",
    ],
  },
  "skill:surgery": {
    boundaries: [
      "Does not replace general diagnosis or long-term medical care.",
      "Does not prepare medicines.",
      "Does not make a hazardous operation certain to succeed.",
    ],
    description:
      "Surgery treats injury or disease by deliberate physical intervention. A capable surgeon plans the procedure, prepares instruments and the patient, controls bleeding and contamination, works accurately around vulnerable structures, and manages closure and immediate recovery. Surgery has always depended on anatomy, dexterity, cleanliness, and judgment about whether an operation is justified at all.",
    shortDescription:
      "Treat injury or disease through planned operative intervention and careful perioperative care.",
    typicalUses: [
      "Remove damaged or diseased tissue.",
      "Repair a serious wound.",
      "Set or treat an injury requiring operative work.",
      "Manage bleeding and closure during an operation.",
    ],
  },
  "skill:research": {
    boundaries: [
      "Does not make incomplete evidence complete.",
      "Does not guarantee access to records or witnesses.",
      "Perception notices immediate details; Research develops an answer from evidence.",
    ],
    description:
      "Research is the systematic search for a reliable answer through records, testimony, observation, experiment, or comparison. A capable researcher frames a clear question, finds relevant material, checks its origin and limitations, compares conflicting accounts, and distinguishes evidence from inference. Its result may be a firm conclusion, a useful lead, or an honest account of what remains uncertain.",
    shortDescription:
      "Find, compare, and evaluate evidence in order to reach a supportable conclusion.",
    typicalUses: [
      "Trace the history or ownership of an object.",
      "Compare accounts of an event.",
      "Identify relevant laws, records, or technical writings.",
      "Test whether a rumour has credible support.",
    ],
  },
  "skill:dead-reckoning": {
    boundaries: [
      "Chart Navigation uses prepared maps or charts.",
      "It is an estimate, not a direct observation of position.",
      "Does not supply local knowledge of hazards.",
    ],
    description:
      "Dead reckoning estimates present position by carrying forward a route from a known point. A capable navigator records each leg, estimates course and distance, allows for drift or obstacles where possible, and corrects the estimate when a reliable observation becomes available. It is useful at sea, in open country, or whenever landmarks are poor, but small errors accumulate steadily.",
    shortDescription:
      "Estimate current position from a known start, direction, speed, and elapsed travel time.",
    typicalUses: [
      "Estimate a vessel’s position between sightings.",
      "Keep track of distance travelled in fog or darkness.",
      "Reconstruct a route after losing sight of landmarks.",
      "Compare an estimated position with a later observation.",
    ],
  },
  "skill:chart-navigation": {
    boundaries: [
      "Does not guarantee that a chart is current or accurate.",
      "Pilotage concerns close navigation where immediate local hazards dominate.",
      "Does not replace observation of weather, water, or terrain.",
    ],
    description:
      "Chart navigation uses maps, charts, and their conventions to plan and follow a route. A capable navigator understands scale, symbols, bearings, elevations or depths, plots positions and waypoints, and compares the planned route with terrain and present conditions. It is a disciplined way to use recorded geographic information, not a substitute for looking outside.",
    shortDescription:
      "Use maps or charts to plan and follow routes while accounting for recorded hazards.",
    typicalUses: [
      "Plot a sea passage, road journey, or mountain route.",
      "Identify recorded shoals, crossings, passes, and settlements.",
      "Measure bearing and distance between known points.",
      "Check a route against a current position.",
    ],
  },
  "skill:sword": {
    boundaries: [
      "Does not make other weapon types interchangeable.",
      "Shield use is separate.",
      "Does not provide tactical command.",
    ],
    description:
      "Sword skill is controlled use of a sword in combat. A capable fighter manages range and footwork, uses cuts or thrusts appropriately, maintains guard, and recovers after an action without leaving an easy opening. The details vary with the sword’s shape and balance, but the central competence is making its reach and edge serve deliberate movement.",
    shortDescription:
      "Fight with a sword by controlling distance, guard, timing, attack, defence, and recovery.",
    typicalUses: [
      "Deliver a controlled cut or thrust.",
      "Maintain distance against another armed opponent.",
      "Defend and recover from an exchange.",
      "Fight effectively while moving over uneven ground.",
    ],
  },
  "skill:shield": {
    boundaries: [
      "Does not replace moving clear of danger.",
      "Does not grant sword or other weapon skill.",
      "Cannot protect every angle at once.",
    ],
    description:
      "Shield skill is the active use of a shield to protect the body, close lines of attack, and create safer movement. A capable user positions, angles, and moves the shield without obscuring vision, losing balance, or preventing action with the other hand. A shield is not passive cover: it must be brought into the right place at the right time.",
    shortDescription:
      "Intercept attacks and control openings with a shield while preserving sight, balance, and movement.",
    typicalUses: [
      "Intercept a blow, missile, or thrust.",
      "Advance while protecting an exposed side.",
      "Cover a companion during withdrawal.",
      "Control the space between two opponents.",
    ],
  },
  "skill:knife-dagger": {
    boundaries: [
      "Does not provide the reach of a sword or spear.",
      "Does not cover general tool use with a knife.",
      "Close range remains dangerous even for a skilled user.",
    ],
    description:
      "Knife and dagger skill covers attack, defence, retention, and control with short blades. A capable fighter uses compact movement, accurate point or edge placement, and careful body position while recognising the danger of operating within an opponent’s reach. Short blades are portable and quick at close quarters, but lack the reach and leverage of longer weapons.",
    shortDescription: "Use and retain a short blade in close-range fighting.",
    typicalUses: [
      "Fight in a cramped room or alley.",
      "Retain a blade during a close struggle.",
      "Use a short blade where a longer weapon cannot be moved freely.",
      "Defend at very short range.",
    ],
  },
  "skill:spear": {
    boundaries: [
      "Loses much of its advantage when distance closes.",
      "Does not make other polearms or swords interchangeable.",
      "Does not replace battle tactics.",
    ],
    description:
      "Spear skill is the use of a hafted thrusting weapon for attack and defence. A capable fighter preserves useful distance, controls the point, uses leverage and footwork, and recovers before an overextended thrust becomes a liability. Its central advantage is reach; good practice is therefore as much about preserving space as striking.",
    shortDescription:
      "Fight with a spear by controlling reach, point, leverage, footwork, and recovery.",
    typicalUses: [
      "Hold an opponent beyond close striking distance.",
      "Defend a narrow approach.",
      "Threaten a mounted or charging opponent.",
      "Fight in a line with others.",
    ],
  },
  "skill:perception": {
    boundaries: [
      "Does not reveal hidden facts beyond the senses.",
      "Does not prove why a detail is significant.",
      "Insight concerns people’s likely motives and feelings.",
    ],
    description:
      "Perception is deliberate observation through sight, hearing, smell, touch, and other available senses. A capable observer scans methodically, notices changes and inconsistencies, separates what was observed from what was assumed, and directs attention to details worth checking. It produces information from what can be sensed; interpretation can still be mistaken.",
    shortDescription: "Notice relevant sensory details and judge what they may indicate.",
    typicalUses: [
      "Notice movement, a faint sound, or a disturbed surface.",
      "Spot a concealed object or unusual detail.",
      "Detect changes in a room, route, or person’s surroundings.",
      "Compare what is present with what should be present.",
    ],
  },
  "skill:athletics": {
    boundaries: [
      "Swimming and Riding are distinct competences.",
      "Does not make impossible lifts or jumps safe.",
      "Specialised acrobatics may require separate training.",
    ],
    description:
      "Athletics is trained whole-body movement: running, jumping, climbing, lifting, carrying, and similar exertion. A capable athlete uses efficient technique, manages momentum and balance, and understands how fatigue, load, injury, or poor footing changes what is possible. It is broad physical competence rather than mastery of every specialised movement.",
    shortDescription:
      "Perform demanding physical movement with trained strength, balance, speed, endurance, and control.",
    typicalUses: [
      "Climb a wall, rope, or steep surface.",
      "Jump a gap or obstacle.",
      "Carry a heavy load over distance.",
      "Sprint, scramble, or keep balance on difficult ground.",
    ],
  },
  "skill:survival": {
    boundaries: [
      "Does not replace Medicine, Hunting, Tracking, or Navigation.",
      "Does not make unsafe food or water safe.",
      "Does not guarantee survival in extreme conditions.",
    ],
    description:
      "Survival is practical judgment in conditions where water, warmth, food, shelter, rescue, or safe travel cannot be assumed. A capable practitioner sets priorities, protects against exposure, conserves strength and supplies, finds or makes shelter, and avoids turning discomfort into a crisis. It concerns staying alive and capable, not proving toughness through avoidable danger.",
    shortDescription:
      "Keep people alive and functional when ordinary shelter, supplies, and help are unavailable.",
    typicalUses: [
      "Make shelter before dangerous weather arrives.",
      "Locate or conserve safe water.",
      "Manage cold, heat, fatigue, and limited supplies.",
      "Keep a group functional while awaiting rescue.",
    ],
  },
  "skill:leadership": {
    boundaries: [
      "Does not supply the technical competence being directed.",
      "Does not guarantee obedience or loyalty.",
      "Battle Tactics concerns armed engagements specifically.",
    ],
    description:
      "Leadership is the ability to organise people around a purpose. A capable leader gives clear instructions, assigns responsibilities, resolves uncertainty, maintains discipline and morale, and adapts direction when conditions change. Leadership can rest on formal authority, reputation, persuasion, example, experience, or accepted hierarchy. It applies equally to crews, expeditions, households, work parties, offices, and military groups.",
    shortDescription:
      "Direct and coordinate people toward a shared objective while maintaining order, morale, and cooperation.",
    typicalUses: [
      "Organise a group during danger or confusion.",
      "Assign roles for a journey or difficult task.",
      "Maintain cooperation during a long effort.",
      "Give practical direction when a plan changes.",
    ],
  },
  "skill:pharmacy": {
    boundaries: [
      "Does not diagnose a patient’s condition.",
      "Does not perform surgery.",
      "Plant Lore identifies plants more broadly; Pharmacy concerns medicinal preparation.",
    ],
    description:
      "Pharmacy concerns medicinal substances and their safe preparation and use. A capable practitioner identifies materials, measures ingredients and doses, prevents contamination, stores preparations correctly, recognises important incompatibilities, and gives clear instructions for use. Historically, pharmacy developed from practical knowledge of plants, minerals, preparations, preservation, and dose.",
    shortDescription: "Identify, prepare, preserve, measure, and dispense medicines safely.",
    typicalUses: [
      "Prepare a measured medicinal remedy.",
      "Store medicines without spoilage or contamination.",
      "Identify an unsafe mixture or dose.",
      "Label and dispense a preparation clearly.",
    ],
  },
  "skill:plant-lore": {
    boundaries: [
      "Does not by itself prepare medicines safely.",
      "Does not make an uncertain identification reliable.",
      "Does not replace Agriculture or horticultural practice.",
    ],
    description:
      "Plant lore is practical knowledge of plants in their natural settings. A capable practitioner identifies specimens from several features, understands season and habitat, distinguishes useful plants from harmful lookalikes, and treats uncertain identification as a real danger. It can support gathering food, fibre, dyes, medicines, or materials, but careful identification remains essential.",
    shortDescription:
      "Recognise plants, their habitats, seasons, useful properties, dangers, and lookalikes.",
    typicalUses: [
      "Identify edible, poisonous, medicinal, or useful plants.",
      "Find plants in their likely habitat and season.",
      "Avoid dangerous lookalikes.",
      "Gather plant material without ruining the source.",
    ],
  },
  "skill:streetwise": {
    boundaries: [
      "Does not guarantee criminal contacts or protection.",
      "Customs concerns social expectations; Streetwise concerns practical urban judgment.",
      "Rumour remains uncertain evidence.",
    ],
    description:
      "Streetwise is practical judgment about how an unfamiliar town or city works at ground level. A capable practitioner reads local behaviour, finds services and information, notices likely scams or dangerous situations, and approaches people without treating rumour as fact. It is knowledge of everyday urban life: what is normal, what is risky, and where useful help may be found.",
    shortDescription:
      "Navigate urban life by reading local behaviour, finding ordinary resources, and recognising common risks.",
    typicalUses: [
      "Find lodging, food, transport, or ordinary services.",
      "Learn which areas are unsafe after dark.",
      "Recognise a common scam or pressure tactic.",
      "Find a reliable local source of information.",
    ],
  },
  "skill:underworld": {
    boundaries: [
      "Does not guarantee access, trust, protection, or loyalty.",
      "Does not replace Deception, Stealth, or Lockpicking.",
      "Reputation and rumour are not proof.",
    ],
    description:
      "Underworld is knowledge of concealed and illicit activity: its markets, roles, intermediaries, codes, risks, and reputations. A capable practitioner recognises likely points of contact and warning signs, seeks information cautiously, and understands that claims of influence or loyalty may be false. It is knowledge of such networks, not membership in them.",
    shortDescription:
      "Understand illicit networks, hidden markets, intermediaries, customs, reputations, and warning signs.",
    typicalUses: [
      "Identify a likely intermediary or fence.",
      "Recognise the signs of an illicit market or arrangement.",
      "Ask cautiously about a concealed service or person.",
      "Judge whether a supposed contact is probably dangerous.",
    ],
  },
  "skill:deception": {
    boundaries: [
      "Does not alter facts or erase evidence.",
      "Disguise changes appearance; Deception manages belief.",
      "Insight may form an informed suspicion but does not prove a lie.",
    ],
    description:
      "Deception is the deliberate shaping of another person’s belief through false statements, misleading conduct, omission, or arranged appearances. A capable deceiver keeps a claim plausible, limits details that can be checked, notices the audience’s reactions, and maintains consistency when questioned. It works on belief and interpretation, not on reality itself.",
    shortDescription:
      "Create and maintain a plausible false impression through words, behaviour, omission, or staged evidence.",
    typicalUses: [
      "Give a plausible false explanation.",
      "Conceal a relevant fact by omission.",
      "Support an assumed role with credible behaviour.",
      "Mislead an observer about what has occurred.",
    ],
  },
  "skill:stealth": {
    boundaries: [
      "Does not make invisibility possible.",
      "Disguise concerns a false appearance; Stealth concerns avoiding notice.",
      "Does not overcome barriers or locks.",
    ],
    description:
      "Stealth is reducing the chance of being noticed. A capable practitioner uses cover, light, sound, pace, timing, and observation to avoid drawing attention or leaving obvious signs of passage. It is always conditional: bare ground, bright light, noise, confinement, or alert observers may make concealment impractical.",
    shortDescription:
      "Move or remain present without notice by controlling visibility, sound, timing, and signs of passage.",
    typicalUses: [
      "Cross a guarded or occupied area quietly.",
      "Remain hidden while observing.",
      "Avoid disturbing a sleeping person or animal.",
      "Leave an area without attracting notice.",
    ],
  },
  "skill:lockpicking": {
    boundaries: [
      "Does not overcome bars, seals, traps, or unrelated barriers.",
      "Does not guarantee quiet or undetectable entry.",
      "Warded-Lock Entry concerns a specific class of mechanism.",
    ],
    description:
      "Lockpicking is the careful opening of a mechanical lock without its intended key. A capable practitioner understands feedback from the mechanism, applies delicate pressure with suitable tools, and avoids damage that could jam the lock or reveal the attempt. Different mechanisms demand different knowledge and techniques.",
    shortDescription:
      "Open a mechanical lock without its intended key by sensing and manipulating its internal parts.",
    typicalUses: [
      "Open a locked door, chest, or cabinet.",
      "Assess whether a lock has been tampered with.",
      "Open a lock while limiting visible damage.",
      "Decide when a particular mechanism is beyond available tools or knowledge.",
    ],
  },
  "skill:sleight-of-hand": {
    boundaries: [
      "Does not make a large or implausible action unnoticeable.",
      "Does not make a missing object impossible to discover later.",
      "Does not replace Stealth or Lockpicking.",
    ],
    description:
      "Sleight of hand is concealed or misleading manipulation of small objects. A capable practitioner coordinates hands, posture, timing, and an observer’s attention so movements appear ordinary and the object’s location is misunderstood. It is commonly associated with performance, cheating, concealment, and subtle exchanges.",
    shortDescription:
      "Conceal or manipulate small objects through dexterity, timing, and control of attention.",
    typicalUses: [
      "Conceal a small object on one’s person.",
      "Exchange, palm, or produce a small item discreetly.",
      "Perform a convincing close-hand demonstration.",
      "Move an object while an observer is distracted.",
    ],
  },
  "skill:insight": {
    boundaries: [
      "Does not read minds.",
      "Does not reveal concealed facts.",
      "Does not prove deception.",
    ],
    description:
      "Insight is the interpretation of another person’s emotions, motives, and likely intentions from speech, conduct, and context. A capable observer notices changes of manner, tensions between words and behaviour, and signs of fear, confidence, hostility, uncertainty, sincerity, or evasion. Its conclusions are informed judgments, not direct access to another person’s thoughts.",
    shortDescription:
      "Judge likely emotions, motives, and intentions from what a person says and does.",
    typicalUses: [
      "Judge whether someone is anxious, angry, guarded, or receptive.",
      "Notice that an explanation does not fit a speaker’s behaviour.",
      "Decide how to frame a difficult conversation.",
      "Distinguish confidence from uncertainty or bluffing.",
    ],
  },
  "skill:disguise": {
    boundaries: [
      "Does not supply knowledge needed to sustain a detailed false identity.",
      "Deception concerns false claims; Disguise concerns presentation.",
      "Close scrutiny can expose inconsistencies.",
    ],
    description:
      "Disguise is the deliberate alteration of appearance and behaviour so that someone is mistaken for another person, accepted in a role, or overlooked as ordinary. A capable practitioner coordinates clothing, grooming, posture, voice, manner, and plausible conduct. Good disguise is as much about avoiding inconsistent details as changing outward appearance.",
    shortDescription:
      "Alter appearance, voice, posture, and conduct to support a plausible identity or avoid recognition.",
    typicalUses: [
      "Avoid recognition by people who know the subject.",
      "Pass briefly as a worker, traveller, or other ordinary figure.",
      "Support an assumed identity in public.",
      "Alter appearance before leaving a watched area.",
    ],
  },
  "skill:administration": {
    boundaries: [
      "Does not replace legal judgment, accounting, or specialist expertise.",
      "Does not grant authority that the practitioner does not possess.",
      "Court Administration concerns a particular institutional setting.",
    ],
    description:
      "Administration is the practical management of an institution’s routine affairs. A capable administrator maintains records and correspondence, follows procedures, coordinates people and resources, processes requests and decisions, and understands how duties and authority are distributed. Administrative competence developed alongside courts, taxation, military establishments, religious institutions, commercial houses, and governments. It keeps an organisation functioning from day to day.",
    shortDescription:
      "Organise and carry out the records, procedures, and routine business of an institution or organised group.",
    typicalUses: [
      "Maintain records, files, schedules, and correspondence.",
      "Route a request to the proper person or office.",
      "Organise supplies, personnel, or routine work.",
      "Trace responsibility for a decision or task.",
    ],
  },
  "skill:customs": {
    boundaries: [
      "Does not establish legal rights or obligations.",
      "One community’s customs may not apply elsewhere.",
      "Does not guarantee approval from everyone present.",
    ],
    description:
      "Customs is knowledge of unwritten conventions that shape ordinary social conduct. A capable practitioner recognises expectations around greeting, hospitality, status, exchange, mourning, gift-giving, dress, and offence, while distinguishing local practice from formal law. Customs often matter most when no one states the rule aloud.",
    shortDescription:
      "Know and follow expected social conduct in a particular society, community, or occasion.",
    typicalUses: [
      "Greet a host or dignitary appropriately.",
      "Avoid giving offence in a formal gathering.",
      "Understand expectations around gifts, meals, or hospitality.",
      "Recognise when a social breach is deliberate.",
    ],
  },
  "skill:oratory": {
    boundaries: [
      "Does not guarantee agreement.",
      "Does not replace evidence, authority, or private negotiation.",
      "Leadership concerns sustained direction of people.",
    ],
    description:
      "Oratory is purposeful public speaking. A capable speaker structures an argument, selects language suited to the audience, reads the room, uses voice and pace deliberately, and makes essential points understandable and memorable. Good delivery strengthens an argument, but cannot turn weak evidence into proof.",
    shortDescription:
      "Inform or persuade an audience through clear structure, suitable language, memorable points, and deliberate delivery.",
    typicalUses: [
      "Address a crowd, assembly, jury, crew, or gathering.",
      "Explain a difficult proposal clearly.",
      "Argue for a course of action.",
      "Rally or reassure a group under pressure.",
    ],
  },
  "skill:bookkeeping": {
    boundaries: [
      "Does not by itself explain why a discrepancy occurred.",
      "Does not establish market value.",
      "Trade concerns exchange; Bookkeeping records it.",
    ],
    description:
      "Bookkeeping is the systematic recording of transactions and obligations. A capable bookkeeper classifies entries, keeps ledgers in order, compares totals with receipts or inventories, and notices omissions, inconsistencies, or unexplained discrepancies. It provides reliable records from which decisions and investigations can proceed.",
    shortDescription:
      "Maintain and check records of money, goods, debts, payments, and supporting evidence.",
    typicalUses: [
      "Record sales, purchases, debts, wages, and payments.",
      "Reconcile a ledger with cash, goods, or receipts.",
      "Find a missing or duplicated entry.",
      "Prepare clear records for another person to inspect.",
    ],
  },
  "skill:trade": {
    boundaries: [
      "Bargaining concerns negotiating particular terms.",
      "Appraisal concerns judging a specific object.",
      "Does not guarantee profit or fair dealing.",
    ],
    description:
      "Trade is the practical conduct of buying, selling, moving, and settling exchanges across a market. A capable trader judges quality, supply, demand, transport, storage, risk, credit, and terms, and understands whether a proposed transaction is workable. It is broader than a single negotiation: it includes the conditions that make an exchange possible and worthwhile.",
    shortDescription:
      "Conduct exchanges of goods or services by judging markets, quality, costs, transport, terms, and settlement.",
    typicalUses: [
      "Source goods in one place for sale in another.",
      "Judge transport, storage, and settlement costs.",
      "Assess whether demand justifies a journey or purchase.",
      "Organise a routine exchange of goods or services.",
    ],
  },
  "skill:bargaining": {
    boundaries: [
      "Does not create goods, authority, credit, or alternatives that do not exist.",
      "Does not establish a thing’s actual value.",
      "Does not replace broad market knowledge.",
    ],
    description:
      "Bargaining is the focused negotiation of an exchange. A capable bargainer listens for what each side values, makes deliberate offers, manages concessions, recognises leverage, and knows when pressure is likely to end the discussion rather than improve the result. It is useful wherever terms are open to discussion, whether the exchange involves money, goods, service, time, or access.",
    shortDescription:
      "Improve the terms of an exchange by negotiating priorities, offers, concessions, and alternatives.",
    typicalUses: [
      "Negotiate price, delivery, payment, or service.",
      "Trade one concession for another.",
      "Test whether the other side has alternatives.",
      "Reach workable terms without needlessly damaging a relationship.",
    ],
  },
  "skill:appraisal": {
    boundaries: [
      "Does not guarantee authenticity or expose every hidden defect.",
      "Does not negotiate the eventual sale.",
      "An unfamiliar market can limit confidence.",
    ],
    description:
      "Appraisal is the informed estimation of what an object is, what condition it is in, and what it is likely to be worth in a relevant market. A capable appraiser examines materials, workmanship, marks, condition, provenance, and comparable objects, then explains the uncertainty of the valuation. A useful appraisal is not merely a price; it states what supports that judgment.",
    shortDescription:
      "Judge an object’s identity, condition, quality, and likely value through inspection, provenance, and comparison.",
    typicalUses: [
      "Judge the quality and likely value of an item for sale.",
      "Notice signs of repair, damage, imitation, or alteration.",
      "Compare similar objects in different conditions.",
      "Assess whether claimed provenance deserves further inquiry.",
    ],
  },
  "skill:smithing": {
    boundaries: [
      "Does not grant skill in using every object made.",
      "Weaponsmithing is a more specific application.",
      "Does not replace work in unrelated materials.",
    ],
    description:
      "Smithing is the shaping and joining of metal by controlled heat, force, cutting, and finishing. A capable smith selects suitable stock, manages temperature and strain, forms an object accurately, joins or repairs it securely, and inspects the result for weakness or poor fit. It is a practical craft grounded in the changing properties of heated and worked metal.",
    shortDescription:
      "Make and repair metal objects through controlled heating, shaping, joining, finishing, and inspection.",
    typicalUses: [
      "Make or repair tools, fittings, fastenings, and metal household goods.",
      "Shape a replacement part to fit an existing object.",
      "Repair bent, cracked, or worn metalwork.",
      "Inspect a metal object for obvious structural weakness.",
    ],
  },
  "skill:seamanship": {
    boundaries: [
      "Navigation and Pilotage concern choosing and following routes.",
      "Does not provide local knowledge of a coast or harbour.",
      "Does not eliminate the dangers of weather or a damaged vessel.",
    ],
    description:
      "Seamanship is the practical operation and care of a vessel and its equipment. A capable sailor handles lines, sails or other controls, secures people and cargo, follows orders, manages routine work on a moving deck, and responds safely to immediate conditions. It is the craft of keeping a vessel and its people functioning, not simply knowing where to go.",
    shortDescription:
      "Work safely aboard a vessel by handling equipment, cargo, routine operations, and changing conditions.",
    typicalUses: [
      "Handle lines, sails, anchors, and deck equipment.",
      "Secure cargo before rough conditions.",
      "Work safely during docking, departure, or heavy weather.",
      "Carry out routine watch and maintenance duties.",
    ],
  },
  "skill:pilotage": {
    boundaries: [
      "Does not grant universal knowledge of every coast or harbour.",
      "Seamanship concerns working the vessel itself.",
      "A chart alone does not replace present observation.",
    ],
    description:
      "Pilotage is close navigation where shoals, channels, tides, currents, markers, traffic, and changing depth matter. A capable pilot combines charts with immediate observation, soundings, local knowledge, and continual checks that the vessel is where it is believed to be. It is especially important near coasts, harbours, rivers, and narrow waterways.",
    shortDescription:
      "Guide a vessel through confined or coastal waters using observation, charts, local conditions, and continual position checks.",
    typicalUses: [
      "Enter or leave a harbour safely.",
      "Follow a narrow channel or river.",
      "Account for tide and current near shore.",
      "Verify a route through waters with local hazards.",
    ],
  },
  "skill:swimming": {
    boundaries: [
      "Does not make severe conditions safe.",
      "Does not replace seamanship or water rescue expertise.",
      "Carried weight and injury may sharply limit ability.",
    ],
    description:
      "Swimming is controlled movement and survival in water. A capable swimmer manages breathing, buoyancy, direction, propulsion, clothing or load, fatigue, and the choice of a safe exit. Water conditions matter greatly: current, cold, waves, injury, exhaustion, and heavy clothing can overwhelm ordinary ability.",
    shortDescription:
      "Travel or remain safe in water by managing breathing, buoyancy, propulsion, direction, load, and fatigue.",
    typicalUses: [
      "Cross still or moving water.",
      "Remain afloat until help or a safe exit is available.",
      "Recover after falling from a vessel or bank.",
      "Assist another person without immediately creating a second casualty.",
    ],
  },
  "skill:weather-lore": {
    boundaries: [
      "Supports a forecast rather than certainty.",
      "Does not control weather.",
      "One sign alone may be misleading.",
    ],
    description:
      "Weather lore is practical forecasting from observable atmospheric signs. A capable observer compares clouds, wind direction and force, temperature, moisture, pressure where available, and familiar local patterns; then revises the forecast as conditions change. It is grounded in real recurring relationships in the atmosphere, but weather remains variable and local.",
    shortDescription:
      "Forecast near-term weather from clouds, wind, pressure, temperature, moisture, and recurring local patterns.",
    typicalUses: [
      "Judge whether rain, wind, frost, fog, or a storm is likely soon.",
      "Decide when to travel, sail, harvest, or seek shelter.",
      "Recognise signs of changing conditions.",
      "Compare a familiar local pattern with current observations.",
    ],
  },
  "skill:wayfinding": {
    boundaries: [
      "Does not replace chart use where charts are available.",
      "Desert Wayfinding concerns a particular environment.",
      "Does not provide food, shelter, or medical care.",
    ],
    description:
      "Wayfinding is practical orientation and route choice in terrain. A capable traveller uses landmarks, direction, distance, terrain shape, memory, repeated checks, and sensible fallback points to maintain a route when no prepared chart is available or sufficient. It is the ordinary human craft of not becoming lost and of recovering when uncertainty arises.",
    shortDescription:
      "Find and follow a route without a prepared chart by using landmarks, direction, distance, terrain, and memory.",
    typicalUses: [
      "Travel across unfamiliar countryside.",
      "Return to a camp, road, river, or landmark.",
      "Choose a passable route through broken terrain.",
      "Recover direction after fog, darkness, or a detour.",
    ],
  },
  "skill:animal-handling": {
    boundaries: [
      "Does not replace Riding.",
      "Does not diagnose or treat animal illness.",
      "A method suitable for one species may be unsafe for another.",
    ],
    description:
      "Animal handling is the practical care and direction of animals accustomed to human management. A capable handler reads stress, fear, fatigue, and attention; uses appropriate restraint and consistent cues; and adapts methods to the species and individual. Effective handling depends more on timing and understanding than force alone.",
    shortDescription:
      "Care for and direct domesticated or trained animals by reading behaviour and using safe, consistent cues.",
    typicalUses: [
      "Lead, restrain, calm, load, or move an animal safely.",
      "Recognise signs of fear, distress, or exhaustion.",
      "Establish routine cues for a working animal.",
      "Manage animals around unfamiliar people, noise, or transport.",
    ],
  },
  "skill:tracking": {
    boundaries: [
      "Does not prove the quarry’s identity or intention.",
      "Does not replace Hunting or Wayfinding.",
      "Weather and traffic can destroy or distort signs.",
    ],
    description:
      "Tracking is the reading of physical traces left by movement. A capable tracker compares prints, disturbed ground, vegetation, scent, weather, timing, and direction to infer a likely route, then revises that judgment when the signs do not fit. It is a disciplined interpretation of traces, not certain knowledge of the unseen traveller.",
    shortDescription:
      "Infer and follow a person’s or animal’s route from physical signs of passage.",
    typicalUses: [
      "Follow a person or animal through terrain.",
      "Estimate how recently a trail was made.",
      "Distinguish one route from another.",
      "Notice whether a trail has been concealed, interrupted, or confused.",
    ],
  },
  "skill:hunting": {
    boundaries: [
      "Does not replace general Survival.",
      "Does not provide animal training or care.",
      "Does not guarantee game will be found.",
    ],
    description:
      "Hunting is the practical pursuit and taking of wild game. A capable hunter reads habitat and sign, controls noise and scent, judges distance and opportunity, uses suitable tools, recovers the quarry, and handles it without avoidable waste. It combines patience, fieldcraft, and sound judgment about whether a shot, trap, or pursuit is appropriate.",
    shortDescription:
      "Locate, approach, take, and recover wild game by reading habitat and sign while limiting noise and waste.",
    typicalUses: [
      "Locate game in suitable habitat.",
      "Approach without alarming it.",
      "Select a practical opportunity to take game.",
      "Recover and prepare a quarry for food or transport.",
    ],
  },
  "skill:riding": {
    boundaries: [
      "Does not replace Animal Handling or veterinary care.",
      "Does not automatically train a mount.",
      "Does not make an unsuitable or exhausted animal safe to ride.",
    ],
    description:
      "Riding is directing a mount while maintaining an effective seat. A capable rider controls pace and direction, uses tack correctly, adapts to terrain and the animal’s condition, and avoids exhausting or injuring the mount through poor balance or excessive demands. It is a partnership between rider and animal, especially at speed or over difficult ground.",
    shortDescription:
      "Control a mount’s direction and pace while maintaining balance and adapting to terrain and fatigue.",
    typicalUses: [
      "Travel efficiently on a trained mount.",
      "Maintain control over uneven ground.",
      "Manage pace on a long journey.",
      "Ride safely through crowds, obstacles, or changing terrain.",
    ],
  },
  "spoken:common": {
    boundaries: [
      "Does not imply literacy.",
      "Does not guarantee specialist vocabulary.",
      "Does not provide knowledge of local customs or law.",
    ],
    description:
      "Spoken Common is the ability to understand and express meaning in a widely shared language. A capable speaker handles ordinary conversation, follows instructions and accounts, pronounces words intelligibly, understands common idiom, and asks for clarification when needed. Fluency develops through vocabulary, listening, social use, and the ability to adjust speech to a listener.",
    shortDescription: "Communicate by speaking and listening in a widely shared language.",
    typicalUses: [
      "Ask for directions, lodging, food, or assistance.",
      "Take part in ordinary conversation.",
      "Explain events or instructions clearly.",
      "Understand warnings, requests, and routine agreements.",
    ],
  },
  "spec:diagnostic-medicine": {
    boundaries: [
      "Identifying a likely cause is not the same as treating it.",
      "Does not replace Surgery or Pharmacy.",
      "Does not guarantee certainty.",
    ],
    description:
      "Diagnostic medicine focuses on determining what condition most likely explains a patient’s symptoms. A capable diagnostician takes a careful history, examines the patient, compares plausible alternatives, uses available tests or observations, and revises conclusions when new evidence appears. It is especially valuable where several conditions resemble one another or where treatment carries risk.",
    shortDescription:
      "Determine the likely cause of illness by comparing symptoms, history, examination, and other evidence.",
    typicalUses: [
      "Distinguish between likely causes of fever or pain.",
      "Assess whether symptoms point to injury, infection, poisoning, or another condition.",
      "Decide what further examination or observation is needed.",
      "Recognise when the available evidence remains inconclusive.",
    ],
  },
  "spec:warded-lock-entry": {
    boundaries: [
      "Does not apply to every lock design.",
      "Does not bypass bars, seals, traps, or guards.",
      "Does not guarantee undetectable entry.",
    ],
    description:
      "Warded-lock entry is the opening of locks whose internal wards obstruct an incorrect key or tool. A capable practitioner identifies the likely ward pattern, chooses a suitably shaped tool, manipulates it with care, and avoids damage that could jam the mechanism or reveal the attempt. It is a specialised form of mechanical lock work rather than a universal solution to secured entry.",
    shortDescription:
      "Open warded locks by identifying internal obstructions and manipulating suitable tools.",
    typicalUses: [
      "Examine whether a lock is warded.",
      "Select or shape a suitable entry tool.",
      "Open a warded lock while limiting damage.",
      "Recognise when a mechanism is not of the expected type.",
    ],
  },
  "spec:court-administration": {
    boundaries: [
      "Does not decide law or facts.",
      "Does not argue a case for a party.",
      "Does not confer judicial authority.",
    ],
    description:
      "Court administration is the practical handling of a court’s records and procedures. A capable administrator receives and files documents, maintains schedules and notices, keeps matters traceable, and makes sure that routine procedural steps occur in the right order. It serves the orderly operation of a legal institution without deciding the merits of a case.",
    shortDescription:
      "Manage court filings, schedules, notices, records, and procedural steps accurately.",
    typicalUses: [
      "File a petition, record, notice, or response.",
      "Track a matter’s deadlines and scheduled appearances.",
      "Locate the correct court record or procedural form.",
      "Ensure that parties receive appropriate notices.",
    ],
  },
  "spec:weaponsmithing": {
    boundaries: [
      "Does not grant fighting competence.",
      "Does not make every metal object a weapon.",
      "General Smithing covers wider metalworking.",
    ],
    description:
      "Weaponsmithing applies metalworking to objects that must hold an effective form while surviving repeated impact, strain, and wear. A capable weaponsmith selects suitable material, controls heat and shaping, balances the finished weapon, forms working surfaces correctly, and inspects for dangerous flaws. It combines craft skill with an understanding of how a weapon will be stressed in use.",
    shortDescription:
      "Forge, finish, balance, and inspect metal weapons for safe and reliable use.",
    typicalUses: [
      "Forge or repair a blade, spearhead, or other metal weapon part.",
      "Balance and finish a weapon for reliable handling.",
      "Inspect a weapon for cracks, poor fit, or weakness.",
      "Replace worn or damaged metal fittings.",
    ],
  },
  "spec:home-coast-pilotage": {
    boundaries: [
      "Does not automatically apply to unfamiliar waters.",
      "Does not replace present observation.",
      "Does not replace the vessel-handling of Seamanship.",
    ],
    description:
      "Home-coast pilotage is close navigation in coastal waters known through repeated experience. A capable pilot recognises channels, landmarks, tides, currents, local traffic patterns, and recurring hazards, while checking that remembered conditions still agree with what is observed. Familiarity can greatly improve judgment, but coastlines and water conditions are never entirely static.",
    shortDescription:
      "Navigate familiar coastal waters through detailed knowledge of channels, landmarks, tides, currents, and hazards.",
    typicalUses: [
      "Use a familiar channel safely in changing tide or light.",
      "Recognise a local landmark sequence or hazard.",
      "Choose a sheltered route in expected conditions.",
      "Notice when a familiar passage no longer appears safe.",
    ],
  },
  "spec:desert-wayfinding": {
    boundaries: [
      "Does not replace Survival’s wider emergency priorities.",
      "Does not guarantee water or a safe route.",
      "Applies to arid terrain, not all environments.",
    ],
    description:
      "Desert wayfinding is orientation and route selection in arid terrain, where reliable landmarks, water, shade, and easy bearings may be scarce. A capable traveller estimates direction and distance, recognises terrain patterns, plans travel around heat and visibility, and keeps safe fallback points in mind. It reflects the particular difficulties of open, dry country rather than all wilderness travel.",
    shortDescription:
      "Find and follow routes across arid terrain while managing sparse landmarks, heat, water, and visibility.",
    typicalUses: [
      "Maintain direction across sparse or shifting terrain.",
      "Choose travel times that limit heat exposure.",
      "Find likely routes between water, shade, or known landmarks.",
      "Recover orientation after wind, dust, darkness, or a detour.",
    ],
  },
};

const candidate3ShortDescriptionByCompetencyId: Record<string, string> = {
  "skill:first-aid":
    "Stabilize an injured or suddenly ill person and keep them safe until further help is available.",
  "skill:dodge": "Avoid attacks through movement, timing, and body positioning.",
  "skill:battle-tactics":
    "Direct people during a battle by reading the situation and coordinating positions, timing, and responses.",
  "skill:medicine":
    "Diagnose illness and injury, choose non-operative treatment, and follow the patient's recovery.",
  "skill:surgery":
    "Treat injury or disease through planned operations and careful care before and after the procedure.",
  "skill:research":
    "Find, compare, and evaluate evidence to answer a question with a supportable conclusion.",
  "skill:law:olog-princely":
    "Interpret and apply a particular body of law through its proper procedures.",
  "skill:dead-reckoning":
    "Estimate present position from a known start, direction, speed, and time travelled.",
  "skill:chart-navigation":
    "Use maps or charts to plan and follow a route while avoiding known hazards.",
  "spoken:common": "Communicate by speaking and listening in a widely shared language.",
  "spoken:mogrebi":
    "Follow everyday speech and take part in conversation with clear questions, answers, and explanations.",
  "spoken:ologian":
    "Sustain spoken dialogue, convey precise meaning, and clarify unfamiliar words or expressions.",
  "spoken:phoenician":
    "Understand spoken instructions and accounts, then respond or explain ideas in a coherent sequence.",
  "spoken:nkolian":
    "Join discussions, express intent and nuance, and adapt speech to the listener and situation.",
  "spoken:scythian":
    "Understand questions and descriptions, give coherent spoken accounts, and resolve misunderstandings in conversation.",
  "written:mogrebi:sacred-mogrebi":
    "Read extended passages and compose accurate text in the associated language and script tradition.",
  "written:ologian:church-ologian":
    "Interpret written statements and compose clear, orderly text for a particular purpose and reader.",
  "written:phoenician:phoenician":
    "Read, transcribe, and compose text using consistent script, spelling, grammar, and layout.",
  "spec:household-guard-sword-shield-drill":
    "Fight with sword and shield as one coordinated method of attack and defence.",
  "spec:diagnostic-medicine":
    "Determine the likely cause of illness by comparing symptoms, history, examination, and other evidence.",
  "spec:warded-lock-entry":
    "Open warded locks by identifying their internal obstructions and manipulating suitable tools.",
  "spec:court-administration":
    "Manage court filings, schedules, notices, records, and procedural steps accurately.",
  "spec:weaponsmithing":
    "Forge, finish, balance, and inspect metal weapons for safe and reliable use.",
  "spec:home-coast-pilotage":
    "Navigate familiar coastal waters by using detailed knowledge of channels, landmarks, tides, currents, and hazards.",
  "spec:desert-wayfinding":
    "Find and follow routes across arid terrain while managing heat, water, and sparse landmarks.",
  "spec:steppe-remount-training": "Train and rotate spare riding animals to sustain long journeys.",
  "skill:sword":
    "Fight with a sword by controlling distance, guard, timing, attacks, and defensive movements.",
  "skill:shield":
    "Intercept attacks and control openings with a shield while retaining balance, sight, and freedom to act.",
  "skill:knife-dagger":
    "Attack, defend, and retain a knife or dagger while fighting at close range.",
  "skill:spear":
    "Attack and defend with a spear by controlling its reach, point, leverage, footwork, and recovery.",
  "skill:perception":
    "Notice relevant sights, sounds, and other sensory details, then interpret what they may mean.",
  "skill:athletics":
    "Perform demanding physical movement such as running, jumping, climbing, and lifting with trained control.",
  "skill:survival":
    "Find water, shelter, warmth, food, and a safe route when ordinary support is unavailable.",
  "skill:leadership":
    "Direct and coordinate people toward a shared objective, maintaining order, morale, and cooperation.",
  "skill:pharmacy":
    "Identify, prepare, preserve, measure, and dispense medicines while avoiding contamination and unsafe doses.",
  "skill:plant-lore":
    "Recognize plants and their habitats, seasons, useful properties, dangers, and misleading lookalikes.",
  "skill:streetwise":
    "Find information, services, and safe ways through urban life by reading local behaviour.",
  "skill:underworld":
    "Understand illicit networks, hidden markets, intermediaries, customs, reputations, and warning signs.",
  "skill:deception":
    "Create and maintain a plausible false impression through words, behaviour, omission, or staged evidence.",
  "skill:stealth":
    "Move or remain present without notice by controlling sound, visibility, timing, and signs of passage.",
  "skill:lockpicking":
    "Open a mechanical lock without its key by sensing and manipulating its internal parts.",
  "skill:sleight-of-hand":
    "Manipulate or conceal small objects through dexterity, timing, and control of attention.",
  "skill:insight":
    "Judge another person's likely emotions, motives, and intentions from what they say and do.",
  "skill:disguise":
    "Change appearance, voice, posture, and conduct to support a plausible identity or escape notice.",
  "skill:administration":
    "Organize and carry out the procedures, records, and routine business of an institution or organization.",
  "skill:customs": "Know and follow expected social conduct in a particular society or community.",
  "skill:oratory":
    "Persuade or inform an audience through a clear argument, suitable language, memorable points, and deliberate delivery.",
  "skill:bookkeeping":
    "Maintain and check ledgers that record money, goods, debts, payments, and supporting evidence.",
  "skill:trade":
    "Conduct exchanges of goods or services by judging markets, quality, costs, transport, terms, and settlement.",
  "skill:bargaining":
    "Improve the terms of an exchange by negotiating priorities, offers, concessions, and alternatives.",
  "skill:appraisal":
    "Judge an object's identity, condition, quality, and likely value from inspection, provenance, and comparison.",
  "skill:smithing":
    "Make and repair metal objects by controlling heat, shaping, joining, finishing, and inspection.",
  "skill:seamanship":
    "Work safely aboard a vessel by handling its equipment, cargo, routine operations, and changing conditions.",
  "skill:pilotage":
    "Navigate confined or coastal waters by combining observations, charts, local knowledge, tides, currents, and soundings.",
  "skill:swimming":
    "Travel or survive in water by managing breathing, buoyancy, propulsion, direction, carried load, and fatigue.",
  "skill:weather-lore":
    "Predict near-term weather from clouds, wind, pressure, temperature, moisture, and recurring patterns.",
  "skill:wayfinding":
    "Find and follow a route without a prepared chart by using landmarks, direction, distance, terrain, and memory.",
  "skill:animal-handling":
    "Care for and direct trained animals by reading their behaviour and using safe, consistent cues.",
  "skill:tracking":
    "Infer and follow a person or animal's route from prints and other physical signs of passage.",
  "skill:hunting":
    "Find, approach, take, and recover wild game by reading habitat and sign while limiting noise and waste.",
  "skill:riding":
    "Control a mount's direction and pace while keeping a balanced seat and adapting to terrain and fatigue.",
};

const candidate3FullDescriptionBoundaryByCompetencyId: Record<string, string> = {
  "skill:first-aid": "It is immediate care, not diagnosis, prolonged treatment, or surgery.",
  "skill:battle-tactics":
    "It concerns the conduct of a particular engagement rather than personal weapon use or long-term strategy.",
  "skill:medicine":
    "Operative treatment belongs to Surgery, while preparing medicines belongs to Pharmacy.",
  "skill:surgery":
    "The operation does not replace diagnosis, general treatment, or later medical care.",
  "skill:research":
    "Research can support a conclusion, but incomplete or conflicting evidence may leave the answer uncertain.",
  "skill:law:olog-princely":
    "The Skill concerns legal rules and procedure, not unwritten custom or personal influence.",
  "skill:dead-reckoning":
    "Because small errors accumulate, a navigator should correct the estimate when a reliable observation becomes available.",
  "skill:chart-navigation":
    "A chart can show recorded hazards and routes, but it does not replace observation of present conditions.",
  "spoken:common": "Spoken fluency does not imply literacy or command of specialist vocabulary.",
  "spoken:mogrebi": "Spoken fluency does not imply literacy or command of specialist vocabulary.",
  "spoken:ologian": "Spoken fluency does not imply literacy or command of specialist vocabulary.",
  "spoken:phoenician":
    "Spoken fluency does not imply literacy or command of specialist vocabulary.",
  "spoken:nkolian": "Spoken fluency does not imply literacy or command of specialist vocabulary.",
  "spoken:scythian": "Spoken fluency does not imply literacy or command of specialist vocabulary.",
  "written:mogrebi:sacred-mogrebi":
    "Written competence is distinct from speaking and applies only to the linked language and script tradition.",
  "written:ologian:church-ologian":
    "Written competence is distinct from speaking and applies only to the linked language and script tradition.",
  "written:phoenician:phoenician":
    "Written competence is distinct from speaking and applies only to the linked language and script tradition.",
  "spec:household-guard-sword-shield-drill":
    "It does not replace the separate competence needed to use either weapon outside the coordinated drill.",
  "spec:diagnostic-medicine":
    "It identifies a likely cause; treatment still requires the appropriate medical or surgical competence.",
  "spec:warded-lock-entry": "It applies to warded mechanisms and does not cover every lock design.",
  "spec:court-administration":
    "It handles court procedure and records rather than deciding law or arguing a case.",
  "spec:weaponsmithing":
    "It concerns making weapons and does not grant skill in fighting with them.",
  "spec:home-coast-pilotage":
    "Detailed knowledge of one coast does not automatically apply to unfamiliar waters.",
  "spec:desert-wayfinding":
    "It concerns route finding in arid terrain, not every task involved in surviving there.",
  "spec:steppe-remount-training":
    "It concerns preparing and rotating remounts rather than general riding or the care of every animal.",
  "skill:sword":
    "The Skill applies to swords and does not make other weapon types interchangeable.",
  "skill:shield":
    "A shield can intercept and control attacks, but it is not a substitute for moving clear of them.",
  "skill:knife-dagger":
    "Short blades demand close distance and do not offer the reach or handling of longer weapons.",
  "skill:spear":
    "A spear loses many of its advantages when the wielder cannot preserve room to use its reach.",
  "skill:perception":
    "It reveals what can be sensed, not hidden facts or certain explanations for what was noticed.",
  "skill:athletics":
    "It covers general physical movement, while specialized techniques may require a more specific Skill.",
  "skill:survival":
    "It keeps people alive and moving in difficult conditions, but it does not replace specialist navigation, hunting, or medicine.",
  "skill:pharmacy":
    "It covers medicinal substances, not diagnosis, surgery, or the independent practice of medicine.",
  "skill:plant-lore":
    "An uncertain identification should not be treated as proof that a plant is safe or useful.",
  "skill:streetwise": "Local rumour and reputation can guide inquiry, but they are not proof.",
  "skill:underworld":
    "Knowledge of illicit networks does not guarantee access, loyalty, or safety.",
  "skill:deception":
    "A plausible story can still fail when evidence is checked, and the Skill does not alter facts.",
  "skill:stealth":
    "It reduces the chance of notice but cannot make concealment possible in every place or against every observer.",
  "skill:lockpicking":
    "It covers mechanical locks and does not by itself overcome traps, bars, seals, or unrelated barriers.",
  "skill:sleight-of-hand":
    "It conceals the manipulation itself rather than making an implausible action or missing object impossible to notice later.",
  "skill:disguise":
    "A disguise supports a false appearance or role, but close scrutiny and inconsistent knowledge can expose it.",
  "skill:customs":
    "Customs describes social expectations, not substantive legal knowledge, and one society's customs do not automatically apply to another.",
  "skill:oratory":
    "It addresses an audience and does not guarantee agreement or replace evidence, authority, or private negotiation.",
  "skill:bookkeeping":
    "Accurate records can reveal a discrepancy, but they do not by themselves prove why it occurred.",
  "skill:trade":
    "Trade covers the wider conduct of exchange, while Bargaining focuses on negotiating particular terms.",
  "skill:bargaining":
    "It negotiates terms but does not create goods, credit, authority, or alternatives that do not exist.",
  "skill:appraisal":
    "Hidden damage, false provenance, or an unfamiliar market may limit the certainty of any valuation.",
  "skill:smithing":
    "It covers metalworking rather than the separate use of every object a smith can make.",
  "skill:seamanship":
    "It covers working and keeping safe aboard a vessel, while choosing a route belongs to navigation or pilotage.",
  "skill:pilotage":
    "It relies on local waters and present observations rather than granting universal knowledge of every coast or harbour.",
  "skill:swimming":
    "Difficult water, injury, clothing, carried weight, and fatigue can place a crossing beyond a swimmer's safe ability.",
  "skill:weather-lore":
    "It supports a forecast rather than certainty, especially when signs conflict or conditions change rapidly.",
  "skill:wayfinding":
    "It concerns choosing and maintaining a route, not every survival task encountered along it.",
  "skill:animal-handling":
    "Methods suitable for one species or individual may be unsafe or ineffective for another.",
  "skill:tracking":
    "Tracks support a likely route and estimate, not certain knowledge of the quarry's identity or intention.",
  "skill:hunting":
    "It concerns finding and taking game rather than general wilderness survival or animal care.",
  "skill:riding":
    "Riding competence does not replace the separate care, training, or treatment of the mount.",
};

const candidate3FullDescriptionOverrideByCompetencyId: Record<string, string> = {
  "skill:dodge":
    "Dodge is the ability to avoid being struck, caught, or intercepted by moving out of the path of an attack or opponent. It relies on awareness, reaction, timing, positioning, and freedom to move. Dodge avoids an attack rather than blocking it; defending with a weapon or shield belongs to the appropriate parry or weapon Skill.",
  "skill:insight":
    "Insight is the interpretation of another person's emotions, motives, and likely intentions from their words, behaviour, and surrounding context. A skilled observer notices inconsistencies and changes in behaviour and can form informed judgments about states such as fear, hostility, uncertainty, sincerity, or deception. Insight does not read thoughts or reveal hidden facts; its conclusions remain interpretations rather than proof.",
  "skill:leadership":
    "Leadership is the ability to direct, coordinate, and motivate other people toward a shared objective. It includes giving clear instructions, assigning responsibilities, maintaining discipline and morale, resolving uncertainty, and keeping a group acting together. Leadership may rest on formal authority, reputation, persuasion, example, or hierarchy and applies to military units, ships, expeditions, households, work crews, offices, and other organized groups. It does not replace the technical skills required for the work being led.",
  "skill:administration":
    "Administration is the organization and management of the routine affairs of an institution, office, government body, military organization, household, or other structured organization. It includes maintaining records and correspondence, following and applying procedures, coordinating people and resources, processing requests and decisions, and understanding how responsibilities and authority are distributed. Historically, administrative skills developed alongside formal bureaucracies, taxation, legal systems, military establishments, and large commercial or religious institutions. Administration concerns practical operation; specialist law, accounting, or institutional customs may require other Skills.",
};

const customsTypicalUses = [
  "Know expected greetings, hospitality, status behaviour, exchange, and etiquette in a particular society.",
  "Recognize behaviour likely to cause offence or signal disrespect.",
  "Distinguish local custom from formal law.",
] as const;

function sentences(value: string): string[] {
  return value.match(/[^.!?]+[.!?]/g)?.map((sentence) => sentence.trim()) ?? [value];
}

function candidate3TaskEnvelope(
  record: PilotSkillContentCompetencyRecord | PilotSkillContentSpecializationRecord,
  description: string,
  shortDescription: string,
): SkillTaskEnvelope {
  const descriptionSentences = sentences(description);
  const lastSentence = descriptionSentences.at(-1) ?? description;
  const skilledPractice = descriptionSentences[1] ?? descriptionSentences[0] ?? description;

  if (record.id === "skill:customs") {
    return {
      coreTasks: [customsTypicalUses[0]],
      limits: [
        "Customs describes social expectations, not substantive legal knowledge.",
        "Customs specific to one society does not automatically apply to another.",
      ],
      methods: customsTypicalUses.slice(1),
      useGuidance:
        "Roll Customs when a character must recall or follow a society's expectations and a mistake could cause offence or misunderstanding.",
    };
  }

  return {
    coreTasks: [shortDescription],
    limits: [lastSentence],
    methods: [skilledPractice],
    useGuidance: `Roll ${record.name} when the outcome is uncertain and this competence is the main factor in whether the attempted task succeeds.`,
  };
}

export const pilotSkillContentReleaseCandidate3ReviewGaps = {
  opposedChecks: [
    "Review whether Insight and Deception should form an authoritative opposed check; Candidate 3 does not encode that pairing.",
  ],
  relationships: [
    "Review Culture as a possible relationship hub for social, professional, and institutional Skills.",
    "Decide which incoming Culture relationships, if any, are mechanically justified before assigning any edge or percentage.",
  ],
} as const;

export const pilotSkillContentReleaseCandidate4ReviewGaps = {
  ...pilotSkillContentReleaseCandidate3ReviewGaps,
  exceptions: pilotSkillContentReleaseCandidate4ExceptionNotes,
} as const;

const authoredCompetencyDocumentationIds = Object.keys(authoredCompetencyDocumentation);
for (const id of authoredCompetencyDocumentationIds) {
  if (!Object.hasOwn(candidate3ShortDescriptionByCompetencyId, id)) {
    throw new Error(`Missing Candidate 3 short description for authored competency ${id}`);
  }
  if (
    !Object.hasOwn(candidate3FullDescriptionBoundaryByCompetencyId, id) &&
    !Object.hasOwn(candidate3FullDescriptionOverrideByCompetencyId, id)
  ) {
    throw new Error(`Missing Candidate 3 full-description boundary for authored competency ${id}`);
  }
}
for (const id of Object.keys(candidate3ShortDescriptionByCompetencyId)) {
  if (!Object.hasOwn(authoredCompetencyDocumentation, id)) {
    throw new Error(`Candidate 3 short description has no authored competency for ${id}`);
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
  const baseDescription = authored?.description ?? record.description;
  const boundary = candidate3FullDescriptionBoundaryByCompetencyId[record.id];
  const candidate3Description = normalizeWhitespace(
    candidate3FullDescriptionOverrideByCompetencyId[record.id] ??
      (boundary ? `${baseDescription} ${boundary}` : baseDescription),
  );
  const candidate3ShortDescription = normalizeWhitespace(
    candidate3ShortDescriptionByCompetencyId[record.id] ??
      authored?.shortDescription ??
      record.description,
  );
  const candidate3Envelope = candidate3TaskEnvelope(
    record,
    candidate3Description,
    candidate3ShortDescription,
  );
  const candidate4Authored = pilotSkillContentReleaseCandidate4AuthoredDocumentation[record.id];

  if (candidate4Authored) {
    return {
      description: normalizeWhitespace(candidate4Authored.description),
      shortLabel: shortLabel(authored?.shortLabel ?? record.name),
      shortDescription: normalizeWhitespace(candidate4Authored.shortDescription),
      taskEnvelope: {
        ...candidate3Envelope,
        coreTasks: candidate4Authored.typicalUses.map(normalizeWhitespace),
        limits: candidate4Authored.boundaries.map(normalizeWhitespace),
      },
    };
  }

  return {
    description: candidate3Description,
    shortLabel: shortLabel(authored?.shortLabel ?? record.name),
    shortDescription: candidate3ShortDescription,
    taskEnvelope: candidate3Envelope,
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

export const pilotSkillContentReleaseCandidate4Input = {
  accessExceptions,
  compatibility: {
    characterMigrationReviewRequired: false,
    classification: "presentation-only",
    rationale:
      "Candidate 4 transcribes Product Owner-supplied descriptions, Typical uses, and Boundaries while preserving accepted mechanics, identities, mappings, access semantics, and compatibility classification.",
  },
  competencies,
  contentVersion: "pilot-skills-content/2.0.0-candidate.4",
  domains,
  histories,
  id: "content-release:pilot-skills:2-candidate-4",
  profiles,
  provenance: [...proposalMetadataReference],
  relationships,
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
  scripts,
  status: "proposal",
  title: "Player-facing Pilot Skill v2 candidate 4",
} satisfies Omit<SkillContentRelease, "manifest">;

export const pilotSkillContentReleaseProposalInput = pilotSkillContentReleaseCandidate4Input;
