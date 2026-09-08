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
  recordVersion: "3",
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
  "http://127.0.0.1:3001/recovery-admin/glantri-app/issues/79",
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
  "spoken:mogrebi": "Communicate by speaking and listening in the named language.",
  "spoken:ologian": "Communicate by speaking and listening in the named language.",
  "spoken:phoenician": "Communicate by speaking and listening in the named language.",
  "spoken:nkolian": "Communicate by speaking and listening in the named language.",
  "spoken:scythian": "Communicate by speaking and listening in the named language.",
  "written:mogrebi:sacred-mogrebi":
    "Read and compose the named language using its linked script and writing conventions.",
  "written:ologian:church-ologian":
    "Read and compose the named language using its linked script and writing conventions.",
  "written:phoenician:phoenician":
    "Read and compose the named language using its linked script and writing conventions.",
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
  const normalizedDescription = normalizeWhitespace(
    candidate3FullDescriptionOverrideByCompetencyId[record.id] ??
      (boundary ? `${baseDescription} ${boundary}` : baseDescription),
  );
  const normalizedShortDescription = normalizeWhitespace(
    candidate3ShortDescriptionByCompetencyId[record.id] ??
      authored?.shortDescription ??
      record.description,
  );
  const taskEnvelope = candidate3TaskEnvelope(
    record,
    normalizedDescription,
    normalizedShortDescription,
  );

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

export const pilotSkillContentReleaseCandidate3Input = {
  accessExceptions,
  compatibility: {
    characterMigrationReviewRequired: false,
    classification: "presentation-only",
    rationale:
      "Candidate 3 rewrites reader-facing descriptions and task guidance while preserving accepted mechanics, identities, mappings, and access semantics.",
  },
  competencies,
  contentVersion: "pilot-skills-content/2.0.0-candidate.3",
  domains,
  histories,
  id: "content-release:pilot-skills:2-candidate-3",
  profiles,
  provenance: [...proposalMetadataReference],
  relationships,
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: SKILL_CONTENT_RELEASE_SCHEMA_VERSION,
  scripts,
  status: "proposal",
  title: "Player-facing Pilot Skill v2 candidate 3",
} satisfies Omit<SkillContentRelease, "manifest">;

export const pilotSkillContentReleaseProposalInput = pilotSkillContentReleaseCandidate3Input;
