/**
 * Competency Content V2 — accepted reader prose for Learning Groups and Profession families.
 *
 * WHAT THIS IS. The reader-facing publication layer for canonical Competency Content V2. It carries
 * the prose the accepted Product Owner source documents already author, transcribed verbatim, so the
 * reference experience can present a full description that is genuinely distinct from the one-line
 * `shortDescription` the catalogue already carries.
 *
 * WHY IT IS A SEPARATE MODULE. `competencyContentV2Source.ts` is the mechanics corpus: memberships,
 * routes, cores, availability. Reader prose changes none of that, and keeping it here means the
 * catalogue objects — and therefore `competencyContentV2Catalogue.manifest.digest` and the runtime
 * `groupSourceDigest` — are byte-identical to before publication. Publication is additive by
 * construction rather than by assertion.
 *
 * WHERE IT COMES FROM. Transcribed from the accepted sources recorded in `docs/source/`:
 *
 * - `docs/source/professions/Glantri_Full_Profession_Catalogue_PO_Proposal.md.txt`
 *   (sha256 548a81ec323321609fb7af1a2a78459450556dc32a4df5818965c10b2b48def6) — all 84 families.
 * - `docs/source/learning-groups/Glantri_Full_Catalogue_Learning_Groups_PO_Proposal.md.txt`
 *   (sha256 7452da9e5fb0b324ea74b3eb618472c512d3c3f04288a49f124fa50821790423) — 52 group pages.
 * - `docs/source/learning-groups/Glantri_Learning_Groups_Martial_Revision_PO_Proposal.md.txt`
 *   (sha256 f44447d438fc33f0a37cc3703bb33d711f4423b95c9c0e047691ea4a12004e8a) — 11 group pages, and
 *   the controlling text wherever it restates a page the full catalogue also carries.
 *
 * Nothing here reads `docs/` at run time, or at build time. The prose is embedded, exactly as the
 * approved Skill catalogue embeds its own source string.
 *
 * WHAT IS DELIBERATELY ABSENT. 51 canonical Learning Groups have no published full description:
 * 49 `new` groups the V2 redesign authored after the accepted group documents were written, and the
 * 2 `revised` groups whose accepted page describes a narrower curriculum than canonical now teaches.
 * They are listed in `competencyContentV2GroupsAwaitingReaderProse` and are the subject of Forgejo
 * #365. They are absent rather than filled with their `shortDescription`, because a one-line summary
 * standing in for a full description is exactly the defect this layer exists to remove.
 *
 * FILTERED ON CANONICAL IDENTITY, NOT ON SOURCE COVERAGE. The accepted group documents carry 59
 * pages, but 13 of them describe groups the V2 redesign removed outright — G06, G08, G13, F16, F22,
 * F31, F32, F35, F36, F37, F38, F39 and F40, each recorded in `competencyContentV2RemovedGroups`.
 * They are accepted, digested and prose-complete, which is exactly what makes them a hazard: they
 * look publishable. Every key here resolves against the canonical roster, and the build fails if one
 * does not.
 *
 * A Learning Group's `note` and a Profession family's `note` are authoring provenance, not reader
 * content, and are never a source of prose here.
 */

import {
  competencyContentV2Families,
  competencyContentV2LearningGroups,
} from "./competencyContentV2Source";

/** One published reader-content record. Every field is reader-facing prose. */
export interface V2ReaderProse {
  /** One line, for tables, cards and search results. Never the full description. */
  shortDescription: string;
  /**
   * The full Inspector description: one or more paragraphs, separated by a blank line
   * (`\n\n`). Never a copy of `shortDescription`.
   */
  fullDescription: string;
  /** What a practitioner actually does. Authored for Profession families. */
  typicalActivities?: readonly string[];
  /** What this training does not supply. Authored where the source states it. */
  boundaries?: readonly string[];
  /** Which accepted document this record was transcribed from. */
  source: "profession-catalogue" | "full-catalogue" | "martial-revision";
}

/**
 * Accepted reader prose for canonical V2 Learning Groups, keyed by canonical group id.
 *
 * 44 of the 95 canonical groups: every group whose canonical curriculum the accepted source still
 * describes. See `competencyContentV2GroupsWithSupersededSourceProse` for the two the V2 revision
 * outgrew, and `competencyContentV2GroupsAwaitingReaderProse` for the full returned gap.
 */
export const competencyContentV2GroupReaderProse: Readonly<Record<string, V2ReaderProse>> =
  Object.freeze({
    /* G01 — Patient care */
    G01: {
      shortDescription:
        "Learners assess patients, give immediate help and follow continuing care under an experienced practitioner.",
      fullDescription:
        "Learners accompany a practitioner through repeated cases, discuss what they observe, carry out appropriate care and return to see how the patient changes. The teacher corrects missed signs, mistaken explanations and poorly performed care, rather than merely letting the learner watch.\n\nThis is a practice in which both immediate assistance and considered treatment are taught. Learners also receive sustained instruction in bedside care, observation and reporting. A household practitioner, healer or organized place of care can provide this instruction; the group does not depend on a modern hospital.",
      boundaries: [
        "Surgery requires deliberate operative instruction; observing operations does not supply it.",
        "Pharmacy requires making and dispensing preparations, rather than merely giving a prepared medicine.",
        "Diagnostic Medicine, Bone Setting, Obstetrics and Poison Treatment require their own specialist teaching and are not included automatically.",
      ],
      source: "full-catalogue",
    },
    /* G02 — Plant and remedy preparation */
    G02: {
      shortDescription:
        "Learners identify useful plants and turn medicinal ingredients into dependable preparations under a remedy maker.",
      fullDescription:
        "Teaching follows ingredients from recognition and collection through preparation, preservation and dispensing. Learners compare plants and habitats, distinguish similar materials and explain why a particular ingredient or preparation is suitable. Their teacher checks both the identification and the finished remedy.\n\nThe practice includes wider plant knowledge and the practical preparation of medicines. A workshop that buys all its ingredients and teaches only preparation does not exemplify the whole group, nor does a plant walk that never develops remedies. Instruction may be oral and practical, supported by written recipes where those are used.",
      boundaries: [
        "Medicine concerns assessing and treating illness; making a remedy does not ordinarily teach the complete clinical competence.",
        "Distilling and Alchemy are not included merely because a workshop uses their products.",
        "Poisons is a distinct body of preparation and use, rather than another name for remedy craft.",
      ],
      source: "full-catalogue",
    },
    /* G18 — Operative care practice */
    G18: {
      shortDescription:
        "Learners provide initial care and undertake supervised operative treatment with an experienced surgeon.",
      fullDescription:
        "The teacher guides learners from an injured patient’s immediate needs through preparation for an intervention and the controlled work of the operation. Learners repeatedly practise initial assistance as well as operative judgment and technique, and discuss what must be watched afterward.\n\nThis is a surgical apprenticeship that actually teaches both listed competences. Being a bystander to an operation, handing over instruments or providing only later bedside care does not cover the whole practice. Its methods depend on the operative tradition and circumstances without turning Surgery into a specialization of Medicine.",
      boundaries: [
        "Medicine requires a broader clinical practice than the operative work described here.",
        "Nursing requires sustained bedside-care teaching, beyond brief assistance around an operation.",
        "Battlefield Surgery and other medical specializations require their own narrower instruction.",
      ],
      source: "full-catalogue",
    },
    /* F29 — Field surgical apprenticeship */
    F29: {
      shortDescription:
        "Learners give immediate casualty care and perform operative work under the supervision of an experienced field surgeon.",
      fullDescription:
        "The teacher guides learners through initial injury assessment, operative preparation and the conduct and follow-through of surgery in difficult field conditions. Learners practise the full operative craft as well as adapting priorities, equipment and arrangements when ordinary facilities are absent or overwhelmed.\n\nThe field constraints receive sustained specialist teaching rather than being treated as incidental discomfort. A course confined to carrying casualties or assisting with one task does not teach the whole group. The shared practice is patient care and surgery in the field, not military command or fighting.",
      boundaries: [
        "Medicine and Nursing require broader clinical or sustained bedside-care instruction than is automatically supplied by this apprenticeship.",
        "Military Command, Battle Tactics and Combat Experience are not taught by treating casualties.",
        "Poison Treatment and other medical specializations require their specific casework.",
      ],
      source: "full-catalogue",
    },
    /* F23 — Distilling remedy workshop */
    F23: {
      shortDescription:
        "Learners make and dispense medicines while also learning the workshop’s complete distilling practice.",
      fullDescription:
        "An experienced remedy maker teaches ingredient judgment, preparation, preservation and dispensing alongside the setting up and conduct of distillation. Learners inspect the material and equipment, follow the process, judge the resulting preparation and correct errors in both the remedy work and the distilling itself.\n\nThis describes a medicinal workshop that actually teaches both practices. Using a purchased distilled ingredient does not teach Distilling, and producing a medicinal distillate from a fixed instruction does not alone teach the wider Pharmacy competence. The full apprenticeship requires repeated responsibility for each body of work.",
      boundaries: [
        "Plant Lore requires sustained plant identification and properties instruction, beyond using already identified ingredients.",
        "Alchemy and Poisons are not established by the workshop’s equipment or by potent preparations.",
        "Medicine concerns clinical judgment rather than making the preparation.",
      ],
      source: "full-catalogue",
    },
    /* G03 — Tracking and hunting practice */
    G03: {
      shortDescription:
        "Learners follow quarry, approach it unobtrusively and make hunting decisions under an experienced hunter.",
      fullDescription:
        "Instruction takes place through repeated searches and hunts in which the learner does more than accompany the party. A teacher asks them to locate signs, follow and recover a trail, choose an approach and explain when a hunt should continue or change. Missed observations and noisy or conspicuous movements are revisited and corrected.\n\nObservation and concealment receive their own exercises as well as field practice. This makes the group a body of taught techniques, rather than a list of everything a hunter might find useful. The quarry and methods can differ between traditions without supplying every possible weapon or trapping practice.",
      boundaries: [
        "Weapon-family Skills require their own complete weapon instruction.",
        "Trapping and Trapmaking are not taught by a hunt that does not design, set or tend traps.",
        "Animal Lore and Survival are not established by knowing this quarry or spending time outdoors.",
      ],
      source: "full-catalogue",
    },
    /* G04 — Field travel and camp practice */
    G04: {
      shortDescription:
        "Learners plan routes, judge changing weather and maintain a workable camp through supervised travel.",
      fullDescription:
        "An experienced traveller guides repeated journeys and camps, asking learners to choose a route, explain signs of changing conditions and provide shelter and other immediate necessities. Decisions are reviewed against the ground actually encountered and the condition of the camp and its occupants.\n\nRoute knowledge, weather judgment and practical survival are each taught throughout the experience. Merely travelling with an expedition is insufficient: a passenger or a helper who always follows instructions may learn only part of this practice. Routes and camp methods can be transmitted through demonstration, oral description and remembered landmarks.",
      boundaries: [
        "Athletics, Running, Climbing and Swimming require deliberate practice of their distinct movement techniques.",
        "Hunting, Fishing and Trapping are not included merely because food is needed.",
        "Dead Reckoning requires sustained instruction in estimating progress, beyond recognizing a route.",
      ],
      source: "full-catalogue",
    },
    /* G05 — Mounted travel and animal care */
    G05: {
      shortDescription:
        "Learners handle a mount on the ground and ride it through the demands of ordinary mounted travel.",
      fullDescription:
        "Training alternates between working beside the animal and travelling on it. A teacher corrects approach, restraint, signals and responses to agitation, then works on the rider’s balance, aids, pace and judgment on changing ground. The same learner practises both sides of the partnership.\n\nOrdinary care associated with a mount provides occasions to practise handling alongside riding. Long-term care, breeding and population management belong to the distinct Animal Husbandry competence; tending one mount does not by itself teach that entire body of work.",
      boundaries: [
        "Animal Husbandry requires sustained population-care and breeding instruction, beyond daily attention to a riding animal.",
        "Mounted Combat and Lance require combat training.",
        "Animal Training and Steppe Remount Training are specialist practices and do not follow from learning to ride.",
      ],
      source: "full-catalogue",
    },
    /* F34 — Trapline and trail practice */
    F34: {
      shortDescription:
        "Learners follow animal trails and tend a trapline through repeated supervised field work.",
      fullDescription:
        "The teacher has learners follow connected signs, recover an interrupted trail and use what they learn to choose and maintain animal traps. Repeated rounds include judging sites, setting and inspecting traps, finding changes in animal movement and reviewing why particular placements succeeded or failed.\n\nTracking is deliberately taught beyond recognizing a few signs beside a trap. Trapping is taught beyond following quarry to a place chosen by someone else. This group describes a field apprenticeship that does both; other trapping methods may require little trail work.",
      boundaries: [
        "Hunting concerns conducting the hunt and is not inferred merely from taking an animal in a trap.",
        "Trapmaking concerns the substantial design, construction and technical treatment of constructed traps, not every animal-trap method.",
        "Perception requires its broader direct observational instruction rather than being inferred from noticing a sign.",
      ],
      source: "full-catalogue",
    },
    /* F05 — Pastoral stockkeeping apprenticeship */
    F05: {
      shortDescription:
        "Learners handle animals, move a herd and sustain its condition through a complete pastoral cycle.",
      fullDescription:
        "An experienced keeper supervises daily contact with animals, the movement of the herd between grazing and resting places, and the longer cycle of feed, breeding and care of young. Learners take responsibility for each part and review the results as animals and conditions change.\n\nThe co-training comes from sustained responsibility for the herd, not from merely being near livestock. Learners practise immediate handling, collective movement and population care as separate tasks within the same continuing work. Someone assigned only to watch a boundary or drive animals along a familiar route may learn a narrower practice.",
      boundaries: [
        "Riding is not included merely because some keepers work from mounts.",
        "Veterinary Medicine requires clinical investigation and treatment beyond routine husbandry.",
        "Animal Training is the deliberate establishment of learned behaviours, not every act of control.",
        "Animal Lore extends beyond the practical knowledge of the managed population.",
      ],
      source: "full-catalogue",
    },
    /* F06 — Draught-team and vehicle practice */
    F06: {
      shortDescription:
        "Learners handle draught animals on the ground and drive a working cart or wagon under an experienced driver.",
      fullDescription:
        "Teaching moves between harnessing and controlling the animals beside the vehicle and guiding the loaded team along a route. The instructor corrects signals, team coordination, pace and decisions about turns, slopes and difficult ground. Learners also practise responding when the team becomes confused or unsettled.\n\nThe repeated connection is between immediate animal handling and the behaviour of animals joined to a vehicle. This does not require the learner to be taught herd breeding or the construction of the cart. The means of harness and control vary with animals and vehicles while preserving that shared practice.",
      boundaries: [
        "Animal Husbandry requires sustained population and breeding care, beyond tending a working team.",
        "Riding concerns mounted technique, not driving from a vehicle or alongside it.",
        "Ropework and Carpentry are not taught completely by securing a load or noticing a damaged cart.",
      ],
      source: "full-catalogue",
    },
    /* F07 — Falconry apprenticeship */
    F07: {
      shortDescription:
        "Learners handle and train a hunting bird and conduct hunts with it under an experienced falconer.",
      fullDescription:
        "The apprenticeship joins daily handling, deliberate training of responses and supervised work with quarry. The learner practises approaching and managing the bird, developing reliable learned behaviour and judging when and how to conduct a hunt. The teacher reviews both the animal’s response and the course of the field outing.\n\nThis full apprenticeship includes the hunting decisions; a course confined to displaying or flying a bird does not cover it. The specialist bird practice adds work with flight, return and hunting condition to the underlying training of learned behaviour. These lessons preserve Falconry within Animal Training rather than turning it into another base Skill.",
      boundaries: [
        "Animal Husbandry and Veterinary Medicine are not established by the narrower daily care of a hunting bird.",
        "Tracking is not automatically taught by pursuing quarry with a bird.",
        "No weapon-family Skill is supplied by this hunting method.",
      ],
      source: "full-catalogue",
    },
    /* F08 — Mixed crop-and-stock household practice */
    F08: {
      shortDescription:
        "Learners manage crops and a domestic animal population through the seasonal work of a mixed holding.",
      fullDescription:
        "An experienced household member teaches the learner to establish and tend crops while maintaining feed, shelter, breeding and care for the holding’s animals. Learners follow the consequences of decisions through a complete season and revise their work when growth, feed supplies or animal condition differ from expectations.\n\nBoth branches are deliberately taught to the same learner. The group describes sustained mixed husbandry rather than everything a household does. Dividing duties so one person only works crops and another only tends animals does not by itself demonstrate this combined learning practice.",
      boundaries: [
        "Plant Lore is not established by learning only the crops and weeds encountered in this work.",
        "Animal Handling and Herding require their own complete instruction in direct control or collective movement.",
        "Cooking, Tailoring and other household crafts are not included by household association.",
      ],
      source: "full-catalogue",
    },
    /* F10 — Fishing-boat apprenticeship */
    F10: {
      shortDescription:
        "Learners operate a fishing vessel and carry out the full capture-and-landing practice under experienced fishers.",
      fullDescription:
        "Learners rotate through vessel manoeuvres and the choices and techniques of fishing: preparing an approach, working the fishing equipment, judging conditions and handling the catch. Their teacher corrects both the operation of the craft and decisions affecting the fishing itself.\n\nThe group applies to an apprenticeship that actually teaches both bodies of work. A learner who only sorts a catch or performs one repeated deck task receives a narrower experience. Shore fishing and vessel work without fishing remain coherent practices with different teaching.",
      boundaries: [
        "Pilotage and other navigation methods require separate route and position instruction.",
        "Ropework is not established by the few knots used with a particular fishing implement.",
        "Shipbuilding and Food Preservation require additional making or preservation practice.",
      ],
      source: "full-catalogue",
    },
    /* G07 — Passage navigation */
    G07: {
      shortDescription:
        "Learners estimate progress and relate a passage to landmarks, routes and local waters under a navigator.",
      fullDescription:
        "A navigator teaches learners to keep track of movement, connect their estimated position with recognizable features and work through the local approach to a destination. Learners make their own judgments during a passage, compare them with observations and explain discrepancies before continuing.\n\nThis particular practice includes route finding and local pilotage as well as estimating progress. Its complete teaching is more than simply obeying a helmsman’s directions. Oral sailing directions and remembered coastal features can support it; charts and observations of celestial bodies are additional practices, not assumptions about all seafaring.",
      boundaries: [
        "Chart Navigation and Celestial Navigation require those methods to be deliberately taught.",
        "Seamanship concerns vessel operation and is not supplied by learning to choose a passage.",
        "Cartography and Surveying require making maps and reliable measurements, rather than using local directions.",
      ],
      source: "full-catalogue",
    },
    /* F11 — Charted open-water navigation practice */
    F11: {
      shortDescription:
        "Learners compare estimated progress, navigation charts and celestial observations through a navigator’s integrated instruction.",
      fullDescription:
        "The teacher has learners maintain an account of direction and distance, work through routes and positions on actual navigation charts, and use the sky observations of the navigation tradition. Learners compare the different results, explain disagreement and revise the passage judgment with the uncertainty still visible.\n\nThe complete course deliberately teaches all three methods through repeated problems and observations. It is not inferred from ocean travel, owning a chart or recognizing a star. Instruction may combine a navigator’s demonstrations ashore with supervised practice during passages, using only methods actually present in the tradition.",
      boundaries: [
        "Astronomy and Mathematics are not established by selected observations or calculations used for navigation.",
        "Pilotage requires local-water judgment; it is not automatically taught by open-water method instruction.",
        "Cartography concerns producing maps and charts.",
        "Seamanship concerns operating the vessel.",
      ],
      source: "full-catalogue",
    },
    /* F30 — Swashbuckling fencing instruction */
    F30: {
      shortDescription:
        "Learners are taught the Fencing tradition itself, together with complete avoidance and parrying instruction.",
      fullDescription:
        "An experienced fencer teaches the timing, distance and coordinated exchanges of the swashbuckling tradition alongside deliberate evasion and parrying. Learners repeat and correct defensive decisions as well as the finer blade work; a graceful change of position alone is not treated as complete Dodge instruction.\n\nThe course expressly teaches the specialist sword-and-buckler and main-gauche practice belonging to Fencing. It remains a course in that established tradition, not modern sport fencing. Unarmed rough fighting is not part of the curriculum described here.\n\nFencing is the weapon competence this course teaches, and it is charged once. Ordinary one-handed edged practice is a separate Skill and a separate course; where a Profession offers that instead of this tradition, it is an alternative training route rather than a choice inside this group.",
      boundaries: [
        "Brawling is not inferred from physical contact during fencing; this page does not teach its whole unarmed practice.",
        "No separate Sword & Buckler / Main-Gauche specialization, off-hand Skill or new combat style is introduced.",
        "No additional weapon-family membership is inferred from an item used within the approved tradition.",
        "1-h edged is not taught here: it is the separate ordinary one-handed edged weapon practice.",
        "Formation Fighting, Mounted Combat and Weapon Maintenance remain separate instruction.",
      ],
      source: "martial-revision",
    },
    /* F41 — Longbow hunting apprenticeship */
    F41: {
      shortDescription:
        "Learners hunt with a longbow, receiving sustained correction of longbow technique alongside complete hunting instruction.",
      fullDescription:
        "A hunting teacher alternates longbow lessons with supervised hunts. Learners receive repeated correction in the longbow’s particular handling demands, and in the field they choose an approach, judge when to attempt a shot and review whether continuing the hunt is sensible.\n\nThe same learner is taught the course of the hunt as well as the shooting. This is the civilian and hunting route to the longbow, not every civilian archery lesson. It teaches neither formation participation nor human close-combat fighting.\n\nLongbow is the weapon competence this course teaches, and it is charged once. Ordinary Bow is a separate Skill and is not charged here; the longbow’s relationship to Bow is a qualitative one, with no transfer of competence in either direction. Military longbow training is taught directly by the military missile curricula, so a soldier reaches the longbow without this hunting apprenticeship and without acquiring Hunting.",
      boundaries: [
        "Tracking, Stealth and Perception are not added merely because they are useful to a hunt; this page does not teach those entire competences.",
        "Dodge, Parry and Brawling are not included because this is not a human close-combat curriculum.",
        "Formation Fighting is not taught by hunting with another person.",
        "Bow is not taught here: it is the separate ordinary archery competence.",
        "This is not a new bow type, new specialization or weapon-access rule.",
      ],
      source: "martial-revision",
    },
    /* F33 — Concealed field reconnaissance practice */
    F33: {
      shortDescription:
        "Learners gather and report military information while deliberately practising observation, unnoticed movement and prepared concealment.",
      fullDescription:
        "An experienced scout teaches learners to turn a reconnaissance task into a workable observation plan, carry it out and report what they found and failed to establish. Separate exercises develop careful searching, movement that avoids notice and the preparation and checking of concealed positions.\n\nReview includes the quality of the military information and the actual details that revealed or hid the learner. This is a complete covert field-scouting course, not all reconnaissance: open observation, mounted patrols and other methods may teach a different selection. Camouflage receives its own preparation and inspection work rather than being treated as another name for Stealth.",
      boundaries: [
        "Tracking is not established by searching an area without sustained trail-following instruction.",
        "Wayfinding and Survival may be useful but require their own full route or camp teaching.",
        "Battlefield Awareness concerns the developing fight rather than automatically following from a scouting report.",
        "Research is not established by following a defined reconnaissance task.",
      ],
      source: "full-catalogue",
    },
    /* G09 — Unit coordination and command practice */
    G09: {
      shortDescription:
        "Learners decide a unit’s tactical tasks, issue workable directions and practise leading the people who must carry them out.",
      fullDescription:
        "An experienced commander supervises exercises and service in which learners consider the situation, decide what a unit should do and turn that decision into orders, responsibilities and coordinated action. The teacher reviews both the plan and what actually happened when people tried to carry it out.\n\nProfessional command receives its own sustained instruction. Learners practise maintaining the unit’s organization and command responsibilities as well as motivating people and reasoning about tactical choices. These are related but distinct lessons; participation as an ordinary formation member does not provide the whole practice.",
      boundaries: [
        "Formation Fighting concerns performing effectively within a formation, not exercising command over it.",
        "Campaign Strategy and Military Logistics require sustained instruction beyond the tactical unit exercises described here.",
        "Battlefield Awareness and Combat Experience are not established by discussing plans.",
      ],
      source: "full-catalogue",
    },
    /* F02 — Fibre-to-cloth workshop practice */
    F02: {
      shortDescription:
        "Learners prepare fibres and yarn and weave them into cloth through a complete household or workshop practice.",
      fullDescription:
        "An experienced worker takes the learner through sorting and preparing fibre, making usable yarn and setting up and working a loom. The learner sees how uneven preparation becomes a fault in the fabric and learns to correct problems at the stage where they arise.\n\nBoth parts are taught through repeated production, including preparation, weaving and inspection of the result. A household may sustain the whole practice; a divided workshop may teach the two crafts to different people. The latter arrangement does not establish this combined group for a learner who works in only one part.",
      boundaries: [
        "Tailoring and Sailmaking concern making different finished products, not simply producing cloth.",
        "Cordage / Ropemaking requires deliberate instruction in making substantial cordage.",
        "Ropework concerns using and joining ropes, not preparing fibres or weaving.",
      ],
      source: "full-catalogue",
    },
    /* F03 — Timber vessel construction */
    F03: {
      shortDescription:
        "Learners work timber and build or substantially repair wooden hulls under an experienced vessel builder.",
      fullDescription:
        "The apprentice selects and works timber, makes fitted joints and learns how those pieces contribute to a sound vessel. Repeated construction and substantial repairs teach the learner to connect the quality of individual pieces with the hull’s shape, strength and behaviour in water.\n\nThe teacher corrects both ordinary woodworking and the vessel builder’s decisions. This group describes an apprenticeship that includes substantial carpentry, rather than a narrowly allocated task such as preparing one repeated component. It also requires learning the vessel as a whole, rather than making timber to another person’s instructions without understanding its use.",
      boundaries: [
        "Seamanship concerns operating a vessel and is not taught merely by building it.",
        "Sailmaking and Ropework require their own making or working practices.",
        "Architecture concerns buildings; timber construction alone does not establish its design competence.",
      ],
      source: "full-catalogue",
    },
    /* F27 — Timber millwright apprenticeship */
    F27: {
      shortDescription:
        "Learners make timber machinery and diagnose its working through a millwright’s combined woodworking and mechanical instruction.",
      fullDescription:
        "The apprentice works through substantial timber selection, shaping and joinery while constructing and adjusting machinery. A teacher asks the learner to explain how force and movement pass through the parts, locate the cause of poor operation and alter the construction to put it right.\n\nThe shared practice is building and maintaining working wooden mechanisms, not merely putting together a frame to another person’s design. It teaches complete carpentry and sustained mechanical reasoning within the machinery tradition. A large workshop that assigns woodwork and mechanism design to separate learners does not necessarily provide the combined apprenticeship.",
      boundaries: [
        "Smithing is not established by fitting bought metal components.",
        "Architecture and Surveying require complete building-design or field-measurement instruction.",
        "Mathematics is not supplied by the calculations used for a particular mechanism.",
        "Siege Engine Operation requires operating those machines in their own practice.",
      ],
      source: "full-catalogue",
    },
    /* F28 — Building design and site surveying */
    F28: {
      shortDescription:
        "Learners measure and set out sites and develop workable building designs under a master builder’s instruction.",
      fullDescription:
        "The teacher takes learners through connected measurements and checks of a site, then through decisions about layout, structure and intended use. Learners compare the proposed building with the measured ground, set out work and revise design or measurement when the pieces fail to agree.\n\nThis is a full design-and-surveying apprenticeship. Taking a few dimensions for a building is not enough: the learner receives sustained instruction in establishing and checking reliable measurements as well as architectural judgment. Building the walls or cutting the timber can be taught by other practitioners without becoming members of this group.",
      boundaries: [
        "Masonry and Carpentry require performing their full construction crafts, not specifying the work.",
        "Mechanics concerns mechanisms and forces in a broader distinct practice, not every building calculation.",
        "Fortification requires specialist defensive design instruction.",
        "Cartography is not established by drawing a site plan solely to set out one building.",
      ],
      source: "full-catalogue",
    },
    /* F24 — Ironmaking and forge apprenticeship */
    F24: {
      shortDescription:
        "Learners produce usable iron and make finished metalwork through an apprenticeship spanning furnace and forge.",
      fullDescription:
        "The teacher takes the learner through repeated furnace cycles and the subsequent making and repair of useful objects. Learners judge starting material and the smelting process, then practise the shaping, joining and fitting needed to turn metal into serviceable work.\n\nThe apprenticeship deliberately crosses the two complete crafts. Merely consolidating newly produced metal is not the full Smithing competence, and working bought iron does not teach Smelting. A combined small-scale practice can teach both, while a divided production site may train different workers in each.",
      boundaries: [
        "Mining requires extraction practice rather than judging supplied ore.",
        "Weaponsmithing and Armoring require their further design and construction instruction.",
        "Alchemy is not supplied by controlling a smelting process.",
      ],
      source: "full-catalogue",
    },
    /* F25 — Weapon-forge and servicing apprenticeship */
    F25: {
      shortDescription:
        "Learners make metal weapons and maintain weapons in service through a smith’s combined making-and-repair practice.",
      fullDescription:
        "The apprentice works on ordinary metal objects as well as complete weapons, learning how material, fit and workmanship affect their use. The same workshop gives sustained instruction in inspection, routine servicing and the recognition of faults on weapons brought back after use.\n\nAll three lessons are substantial parts of the apprenticeship. Making a new weapon does not automatically teach the range of maintenance judgment, and sharpening one blade does not establish full Smithing or Weaponsmithing. This group describes the maker who teaches both production and continuing service, within the familiar constructions of the workshop.",
      boundaries: [
        "No weapon-family Skill is supplied by making or maintaining a weapon.",
        "Armoring requires protective fit and construction around a body.",
        "Smelting requires instruction in producing metal from starting material.",
      ],
      source: "full-catalogue",
    },
    /* F26 — Forged-metal armor workshop */
    F26: {
      shortDescription:
        "Learners forge and fit protective metal equipment through a complete armorer’s workshop apprenticeship.",
      fullDescription:
        "An armorer teaches the learner to work metal pieces and to shape protection around a body that must move. The learner repeatedly fits, joins and adjusts parts, checks coverage and movement, and corrects failures of workmanship or protective fit.\n\nThis particular workshop includes substantial Smithing as well as Armoring. An apprenticeship confined to assembling purchased parts, or one using a different material tradition, may teach Armoring without that entire metalworking craft. The group therefore describes a specific making practice rather than all armor work.",
      boundaries: [
        "Tailoring and Leatherwork are not established by attaching a lining or strap.",
        "Weapon Maintenance and weapon-family practice concern different objects and tasks.",
        "Weaponsmithing is not supplied by working protective metal.",
      ],
      source: "full-catalogue",
    },
    /* F21 — Modelled ceramic workshop */
    F21: {
      shortDescription:
        "Learners create sculptural forms in clay and carry them through the full ceramic production process.",
      fullDescription:
        "An experienced ceramic artist teaches the learner to prepare clay, form and revise an original object, manage drying and firing, and inspect the result. Criticism concerns the artistic form as well as faults in the material and firing process that alter or spoil it.\n\nThe learner is taught a complete pottery practice alongside sculptural creation. Pressing a supplied mould or decorating a purchased pot does not cover this group. It can be learned in a small workshop without implying that every pottery worker is a sculptor or every sculptor is a potter.",
      boundaries: [
        "Visual Art is not established merely by applying a limited decoration to a vessel.",
        "Masonry and Mining require different material and construction practices.",
        "Alchemy is not supplied by knowing a particular firing or glaze recipe.",
      ],
      source: "full-catalogue",
    },
    /* G11 — Records-office practice */
    G11: {
      shortDescription:
        "Learners organize recurring office work and maintain accounts through supervised handling of real records.",
      fullDescription:
        "A clerk or administrator teaches learners to receive matters, preserve a usable record, follow work through its stages and keep obligations from being overlooked. Alongside this, learners enter and reconcile accounts rather than merely copying figures prepared by someone else.\n\nThe connection is repeated responsibility for both the work and its record. An office can teach these through practical apprenticeship, dictated instruction and the written conventions it uses. Access to a writing tradition and knowledge of the office’s business remain separate from the two competencies listed here.",
      boundaries: [
        "Research requires inquiry and evaluation of evidence; orderly filing alone does not teach it.",
        "Law and Banking & Credit require their own substantive judgment.",
        "No named Written Tradition is included merely because records are written.",
        "Court Administration is not inherited automatically from Administration.",
      ],
      source: "full-catalogue",
    },
    /* G12 — Trading practice */
    G12: {
      shortDescription:
        "Learners assess goods, negotiate terms and carry transactions through under an experienced trader.",
      fullDescription:
        "Teaching takes place through repeated buying and selling in which the learner examines goods, compares their condition and likely value, discusses terms and follows the transaction to completion. The teacher explains errors in judgment and reviews the result rather than assigning the learner only carrying or copying work.\n\nThe learner is taught the whole practical exchange: commercial decisions, negotiation and appraisal. Markets, travelling trade and fixed shops can provide this practice, but simply being present in a market does not. The goods and trading conventions can vary without making every associated financial or administrative competence a member.",
      boundaries: [
        "Bookkeeping requires systematic accounts rather than remembering individual prices.",
        "Banking & Credit concerns obligations and financial exposure beyond ordinary buying and selling.",
        "Streetwise and Underworld are not supplied by commercial contact with a place or network.",
      ],
      source: "full-catalogue",
    },
    /* F12 — Credit-house accounts and obligations */
    F12: {
      shortDescription:
        "Learners judge credit obligations and maintain the accounts through which a credit business follows them.",
      fullDescription:
        "An experienced practitioner has the learner examine proposed obligations, consider repayment and exposure, record the resulting transactions and reconcile what remains due. Learners review disagreements between their commercial judgment, the written or otherwise maintained accounts and what debtors actually repay.\n\nThe apprenticeship teaches both financial decisions and complete accounting work. Copying a credit ledger without learning how obligations are assessed does not teach Banking & Credit; discussing loans without keeping and checking accounts does not teach Bookkeeping. The practice need not resemble a modern bank.",
      boundaries: [
        "Trade, Bargaining and Appraisal require their own complete exchange, negotiation or valuation instruction.",
        "Administration is not established merely because the business has an office.",
        "Law requires learning the legal system, beyond recognizing the forms used for familiar obligations.",
      ],
      source: "full-catalogue",
    },
    /* F13 — Legal study and pleading practice */
    F13: {
      shortDescription:
        "Learners study a legal system and prepare and deliver formal arguments under an experienced advocate.",
      fullDescription:
        "The teacher works through actual or rehearsed disputes, asking the learner to identify governing rules, distinguish legally relevant facts and prepare a case. Learners deliver their arguments before listeners and revise them after questions, criticism and examination of the procedure followed.\n\nThis apprenticeship includes substantive law, coached public speech and specialist advocacy in a forum that recognizes it. Neither silent legal study nor rehearsing speeches without learning the law covers the whole practice. Instruction can draw on remembered decisions and oral proceedings as well as written material.",
      boundaries: [
        "Research is not supplied by receiving a prepared case or using already assembled authorities.",
        "Customs and Courtly Protocol are not established by learning courtroom procedure.",
        "Mnemonics requires taught memory techniques, rather than memorizing a particular speech.",
      ],
      source: "full-catalogue",
    },
    /* G10 — Council and mediation practice */
    G10: {
      shortDescription:
        "Learners listen to disputes, address a gathering and negotiate workable terms under an experienced convenor.",
      fullDescription:
        "Learners take part in supervised discussions where they must understand the parties, explain a position publicly and explore terms that participants might accept. A teacher corrects misread reactions, poorly framed proposals and breaches of the conventions governing the encounter.\n\nThe practice includes direct teaching of social conventions, speech and negotiation. It can be learned through community deliberation and oral instruction as well as more formal councils. Resolving a dispute is the shared activity; it is not a separate base Mediation Skill and does not establish expertise in every legal system.",
      boundaries: [
        "Law requires instruction in a legal system’s authorities, rules and procedures.",
        "Leadership is useful to a convenor but is not automatically taught to every learner in mediation practice.",
        "Courtly Protocol and Court Advocacy require their narrower specialist instruction.",
      ],
      source: "full-catalogue",
    },
    /* G14 — Local contacts and information gathering */
    G14: {
      shortDescription:
        "Learners build useful local contacts and interpret what people will tell them through guided work in an urban milieu.",
      fullDescription:
        "An experienced local guide or contact teaches learners where to seek information, how to approach people and how to keep a conversation useful without misreading its reception. Learners compare accounts from different encounters and discuss why a contact was forthcoming, guarded or misleading.\n\nThe local network and the interpretation of people are both explicitly taught. This is more than walking through a settlement or knowing its customs. It can be learned through repeated accompanied visits and oral instruction, without assuming that the milieu is illicit.",
      boundaries: [
        "Underworld requires knowledge of the relevant illicit network and its working arrangements.",
        "Bargaining and Deception are not established by asking questions or making introductions.",
        "Research requires a fuller disciplined inquiry than collecting local reports.",
      ],
      source: "full-catalogue",
    },
    /* G15 — Covert entry practice */
    G15: {
      shortDescription:
        "Learners inspect an approach, move without attracting notice and open locks through coached entry exercises.",
      fullDescription:
        "A teacher prepares and reviews repeated entries in which learners search for relevant details, choose a quiet approach and work with familiar lock mechanisms. Afterward they examine what they overlooked, what exposed them and why a lock did or did not yield.\n\nObservation, unobtrusive movement and manipulation of locks each receive deliberate practice. The group concerns this combined instruction, not every way of entering a place or every competence useful to someone acting covertly. Demonstrations and supervised exercises can teach it without a formal institution.",
      boundaries: [
        "Trapmaking requires technical knowledge of constructed traps; seeing a suspicious feature does not teach their design or bypass.",
        "Climbing is not included merely because some entries involve height.",
        "Warded-Lock Entry needs its specialist lock instruction.",
        "Underworld is knowledge of an illicit milieu, not an entry technique.",
      ],
      source: "full-catalogue",
    },
    /* G16 — Impersonation and distraction practice */
    G16: {
      shortDescription:
        "Learners prepare an assumed appearance and sustain a misleading account through rehearsed encounters.",
      fullDescription:
        "Training alternates preparation with encounters in which another person questions or challenges the presentation. Learners adjust clothing, grooming and other identifying details, develop a consistent account and review the points where appearance and explanation failed to agree.\n\nThe teacher directly corrects the making of a disguise and the delivery of a deception. Encounters may involve distraction, but distracting an observer does not itself establish Sleight of Hand, Acting or another separate competence. A learner may encounter those further lessons through other instruction.",
      boundaries: [
        "Acting concerns dramatic performance and is not inferred from impersonation.",
        "Sleight of Hand requires deliberate manual manipulation practice.",
        "Customs may supply useful contextual knowledge but must be taught separately.",
        "Document & Credential Forgery requires making convincing documents rather than carrying them.",
      ],
      source: "full-catalogue",
    },
    /* G17 — Interview and evidence practice */
    G17: {
      shortDescription:
        "Learners conduct structured inquiries, question people and compare accounts with observable evidence under a mentor.",
      fullDescription:
        "A mentor has learners frame questions, locate witnesses or other evidence and keep track of the origin of claims. Learners practise interviews, check what an answer actually establishes and revisit observations that do not fit. Feedback concerns the conduct of the inquiry as well as what was noticed or inferred.\n\nInterrogation belongs in the expanded version described here because structured questioning, follow-up and evaluation of answers are expressly rehearsed. It is not inferred from any conversation. Research can proceed through oral testimony and physical observations; literacy and an archive are not inherent requirements of this practice.",
      boundaries: [
        "Law requires learning a particular legal system and its procedure.",
        "Intimidation and Deception are not necessary constituents of structured questioning.",
        "Palaeography & Decipherment requires specialist instruction with writing, beyond using a readable record.",
        "No spoken or written competency is acquired merely because an inquiry uses it.",
      ],
      source: "full-catalogue",
    },
    /* F01 — Field surveying and map production */
    F01: {
      shortDescription:
        "Learners measure ground and turn their checked observations into usable maps under a field surveyor and map maker.",
      fullDescription:
        "Learners establish reference points, take connected measurements and check their work before deciding how to represent the ground. They then make maps, choose signs and scale appropriate to the purpose, and compare the result with another visit or an independent set of observations.\n\nThe apprenticeship follows the work from field measurement through cartographic judgment. It does not describe a survey party in which one learner only carries equipment while someone else makes the map. A teacher may combine both practices, or two practitioners may supervise the same learner through the whole process.",
      boundaries: [
        "Chart Navigation concerns using a navigation chart, not producing a map.",
        "Geography requires a wider body of knowledge than the area being measured.",
        "Mathematics is not included merely because the work teaches the calculations needed for a survey.",
      ],
      source: "full-catalogue",
    },
    /* F14 — Speech and memory practice */
    F14: {
      shortDescription:
        "Learners prepare and deliver speeches while deliberately training techniques for organizing and retrieving what they intend to say.",
      fullDescription:
        "An instructor teaches learners to build an argument, arrange it for listeners and deliver it without losing the sequence of ideas. Alongside speech practice, learners experiment with deliberate associations, ordered images or other taught memory methods and are asked to recover material after interruptions or changes of order.\n\nFeedback addresses the speech and the method of remembering separately. Repeating a text until it happens to be remembered is not sufficient evidence for Mnemonics. This group describes a rhetorical teaching tradition in which trained recall is an explicit part of the lessons.",
      boundaries: [
        "Poetry & Literary Composition concerns literary creation rather than merely an effective speech.",
        "Storytelling is not established by including an anecdote in an argument.",
        "Meditation is not supplied by composing oneself before speaking.",
      ],
      source: "full-catalogue",
    },
    /* F15 — Historical text investigation */
    F15: {
      shortDescription:
        "Learners investigate questions by examining difficult writing and testing what the recovered text can establish.",
      fullDescription:
        "A scholar or experienced reader gives learners material whose signs, hands or abbreviations require investigation. Learners compare examples, propose readings and search for further evidence, while keeping separate what they can read, what they infer and what remains uncertain.\n\nThe teaching also develops a full inquiry: learners frame a question, seek relevant sources and revise an explanation when the evidence resists it. Copying unfamiliar characters alone is insufficient. The group describes mentored investigation using texts, rather than treating literacy as the definition of Research.",
      boundaries: [
        "A particular Written Tradition is not taught automatically by examining its difficult forms.",
        "Translation & Interpretation concerns conveying meaning between languages, rather than recovering signs.",
        "History requires a broader learned account of the past than a single investigation.",
        "Document & Credential Forgery concerns producing misleading documents, not examining old ones.",
      ],
      source: "full-catalogue",
    },
    /* F17 — Self-accompanied song practice */
    F17: {
      shortDescription:
        "Learners develop their singing and instrumental playing together through coached self-accompanied performance.",
      fullDescription:
        "A teacher works with the learner on the voice and the instrument separately, then on keeping them coordinated through complete songs. Learners practise musical phrasing, timing and responsiveness as well as vocal production, breath and clear delivery of the sung material.\n\nThe same learner is taught both competencies. Merely rehearsing in an ensemble where one person sings and another plays does not establish this combined group. The instrument and musical tradition give the practice its character without becoming a new base Skill or supplying a language by association.",
      boundaries: [
        "Music Composition requires deliberate composition and revision instruction.",
        "Storytelling and Poetry & Literary Composition are not supplied by performing an existing song.",
        "A spoken language is not established by memorizing lyrics.",
      ],
      source: "full-catalogue",
    },
    /* F18 — Dramatic acting and dance practice */
    F18: {
      shortDescription:
        "Learners portray dramatic roles and perform a developed movement tradition through an actor-dancer’s instruction.",
      fullDescription:
        "Training alternates the interpretation of a role with repeated work on the movements, timing and expression of the performance tradition. Learners rehearse complete scenes and movement passages while teachers correct both dramatic intention and the execution of dance.\n\nThis describes traditions in which performers genuinely train as both actors and dancers. Moving to a place on a stage is not enough to establish Dance, and repeating dance steps without dramatic role work is not enough to establish Acting. Instruction can be transmitted through a performer’s household or apprenticeship as readily as through a theatre school.",
      boundaries: [
        "Athletics is not established merely by difficult or energetic movement.",
        "Music and Singing require their own complete musical or vocal instruction.",
        "Disguise and Deception are not supplied by theatrical costume or portraying a fictional person.",
        "Oratory has a different persuasive task from playing a role.",
      ],
      source: "full-catalogue",
    },
    /* F19 — Oral narrative composition and performance */
    F19: {
      shortDescription:
        "Learners compose verbal narratives and perform them for listeners under an experienced storyteller and composer.",
      fullDescription:
        "Learners create and revise plots, descriptions and language, then test their work through spoken performance. The teacher corrects both the composition and the way the story is made understandable and engaging to listeners, including pacing, emphasis and adaptation to the occasion.\n\nThe practice can be oral throughout. It does not assume that original composition requires writing or that an accomplished teller necessarily composes new work. This group describes the apprenticeship that deliberately teaches both creation and performance rather than simply learning a fixed tale.",
      boundaries: [
        "Mnemonics requires deliberate memory techniques, not oral transmission alone.",
        "Acting requires dramatic role practice beyond giving characters distinctive voices in a tale.",
        "Oratory concerns addressing an audience for explanation or persuasion rather than necessarily narrating a story.",
        "No Written Tradition is implied by literary composition.",
      ],
      source: "full-catalogue",
    },
    /* F20 — Drawing and modelling workshop */
    F20: {
      shortDescription:
        "Learners develop images and three-dimensional forms through a workshop that teaches both drawing and sculpture.",
      fullDescription:
        "The teacher has learners study forms through composed drawings and through original modelling or carving. Learners revise proportion, arrangement and the treatment of surfaces in both media, comparing what each form of representation makes clear or distorts.\n\nBoth practices must develop beyond preparatory marks or mechanical copying. A sculptor who gives a learner only a few layout sketches is not necessarily teaching the full Visual Art competence. This group describes an integrated artistic apprenticeship with sustained work and criticism in both.",
      boundaries: [
        "Masonry concerns construction-oriented stonework, not sculpture’s artistic purpose.",
        "Pottery requires the complete ceramic process, beyond using clay as a modelling material.",
        "Cartography is not supplied by making a picture of a place.",
      ],
      source: "full-catalogue",
    },
  });

/**
 * Accepted reader prose for canonical V2 Profession families, keyed by canonical `family.code`.
 * All 84 families, each carrying a short description, a full description, typical activities and a
 * boundaries statement.
 */
export const competencyContentV2FamilyReaderProse: Readonly<Record<string, V2ReaderProse>> =
  Object.freeze({
    /* P01 — Hunter and Trapper */
    P01: {
      shortDescription:
        "A hunter or trapper finds game and obtains it through a practised method suited to the quarry.",
      fullDescription:
        "Learners accompany experienced hunters or work a trapline under supervision, learning when to follow, wait, withdraw or revisit a site. They become responsible for their approach, the condition of their equipment and the consequences of disturbing game. Hunting can sustain a household, supply customers or serve a patron; those arrangements do not make every hunter a soldier. Tracking hunts, trapline work and longbow hunting are distinct training routes within this livelihood.",
      typicalActivities: [
        "Read a trail before committing to pursuit.",
        "Plan and revisit a trapline.",
        "Choose an approach suited to the quarry.",
        "Guide a patron through a hunt.",
      ],
      boundaries: [
        "Hunting does not supply a complete human close-combat curriculum, military scouting or every weapon used to take game.",
      ],
      source: "profession-catalogue",
    },
    /* P02 — Wild Plant Gatherer */
    P02: {
      shortDescription:
        "A wild plant gatherer locates, identifies and collects useful plants for food, materials or other users.",
      fullDescription:
        "Training follows plants through different seasons and habitats, with an experienced gatherer correcting mistaken identifications and unsuitable collecting choices. The gatherer plans repeated visits, judges the condition of the resource and brings back material that can actually be used. Some work close to home; others make demanding journeys for scarce plants. Supplying a healer does not by itself train the preparation of medicines.",
      typicalActivities: [
        "Locate a seasonal gathering place.",
        "Distinguish similar plants.",
        "Select useful material in good condition.",
        "Plan a return journey with a gathered load.",
      ],
      boundaries: [
        "The role does not automatically include Pharmacy, Farming or athletic training.",
      ],
      source: "profession-catalogue",
    },
    /* P03 — Field and Caravan Guide */
    P03: {
      shortDescription:
        "A field guide leads travellers through unfamiliar country and helps them reach suitable stopping places.",
      fullDescription:
        "A guide learns routes by accompanying capable travellers, comparing landmarks and seasons, and taking responsibility for decisions under supervision. Work includes assessing a party’s pace, choosing places to stop and responding when a familiar route becomes difficult. A guide may serve neighbours, merchants, messengers or visiting officials. Caravan employment can add animal or vehicle instruction, but carrying trade goods does not automatically make the guide a merchant.",
      typicalActivities: [
        "Choose a route around an obstruction.",
        "Locate a usable camp.",
        "Adjust travel to deteriorating weather.",
        "Brief travellers on the next stage.",
      ],
      boundaries: [
        "Guiding is not Trade, Military Reconnaissance or automatic animal care; the armed variant is additional training.",
      ],
      source: "profession-catalogue",
    },
    /* P04 — Fisher */
    P04: {
      shortDescription:
        "A fisher catches aquatic animals using methods learned for particular waters and quarry.",
      fullDescription:
        "Learners work beside experienced fishers, comparing places, conditions, equipment and the results of different attempts. They gradually take responsibility for choosing where and when to fish and for bringing the catch back. Shore work and boat work are both substantial livelihoods, but only the latter necessarily teaches operating a vessel. Household fishing, seasonal crews and market supply can all provide sustained practice.",
      typicalActivities: [
        "Select a fishing place for present conditions.",
        "Prepare and work fishing equipment.",
        "Judge when to move or return.",
        "Organize a day’s catch and landing.",
      ],
      boundaries: ["Fishing does not imply Swimming, navigation with charts or boat construction."],
      source: "profession-catalogue",
    },
    /* P05 — Farmer */
    P05: {
      shortDescription:
        "A farmer cultivates crops and organizes the recurring work that keeps a holding productive.",
      fullDescription:
        "People learn through repeated growing seasons, household instruction and work beside experienced cultivators. They prepare ground, establish crops, judge changing conditions and coordinate harvest and storage. A mixed holding also teaches the continuing care of domestic animals; a specialist crop worker may never learn that whole practice. Tenancy, wage service and ownership change the farmer’s obligations without determining the quality of their cultivation.",
      typicalActivities: [
        "Prepare a field for its next crop.",
        "Recognize a developing cultivation problem.",
        "Organize sowing and harvest work.",
        "Balance field work with a mixed holding’s animals.",
      ],
      boundaries: [
        "Holding land does not confer Farming, and cultivation does not teach formal estate accounts.",
      ],
      source: "profession-catalogue",
    },
    /* P06 — Herd Keeper */
    P06: {
      shortDescription:
        "A herd keeper maintains domestic animals and directs their movement, grazing and seasonal care.",
      fullDescription:
        "An experienced keeper teaches learners to handle individuals while attending to the condition and movement of the herd as a whole. Work includes finding grazing, managing young stock, arranging feed and shelter, and recognizing when routine care is insufficient. Mobile pastoral households and settled estates can both provide this training. Ownership may bring influence, but an employed herder can possess the same practical competence.",
      typicalActivities: [
        "Move a herd without losing its scattered members.",
        "Plan grazing and water stops.",
        "Organize care of young animals.",
        "Recognize declining condition across the stock.",
      ],
      boundaries: [
        "Routine husbandry does not supply Veterinary Medicine, Animal Training or Mounted Combat.",
      ],
      source: "profession-catalogue",
    },
    /* P07 — Animal Trainer and Falconer */
    P07: {
      shortDescription:
        "An animal trainer deliberately establishes reliable learned behaviours in animals used for work or hunting.",
      fullDescription:
        "Learners assist an experienced trainer, observe how an animal responds and repeat exercises while the teacher corrects timing and expectations. Responsibility extends beyond obtaining one successful response to maintaining behaviour across changing circumstances. Falconry is a specialist branch involving the hunting bird’s training and participation in a hunt. Training other animals does not make someone a falconer, herder or veterinary practitioner.",
      typicalActivities: [
        "Establish a useful response to a signal.",
        "Adapt practice when an animal becomes unreliable.",
        "Maintain trained behaviour during work.",
        "Prepare and conduct a falconry outing in the specialist branch.",
      ],
      boundaries: [
        "Falconry remains nested under Animal Training under Animal Handling; no parent, prerequisite or acquisition rule is changed.",
      ],
      source: "profession-catalogue",
    },
    /* P08 — Driver and Teamster */
    P08: {
      shortDescription:
        "A driver moves people or loads by controlling a vehicle and its draught animals.",
      fullDescription:
        "Training takes place beside an experienced driver who corrects the handling of the team and the vehicle on real routes. Learners judge loads, turning space, slopes and the animals’ response, then take responsibility for a complete journey. Farm, market, construction and caravan work may all supply this experience. Driving remains substantial skilled work even when the driver neither owns the vehicle nor negotiates the cargo’s sale.",
      typicalActivities: [
        "Manoeuvre a loaded vehicle through a tight approach.",
        "Set a pace the team can sustain.",
        "Respond to a difficult animal.",
        "Choose a practical stopping place on a delivery.",
      ],
      boundaries: [
        "Driving does not supply Riding, Trade, long-term husbandry or vehicle manufacture.",
      ],
      source: "profession-catalogue",
    },
    /* P09 — Sailor and Boat Worker */
    P09: {
      shortDescription: "A sailor or boat worker operates a vessel as part of its working crew.",
      fullDescription:
        "Learners take recurring watches and tasks under experienced crew, progressing from corrected exercises to responsibility for vessel work in changing conditions. A small boat, a rigged ship and an armed merchant vessel demand different additions to that foundation. Seafaring can support household transport, trade, fishing or long voyages. Neither working at sea nor enduring danger automatically teaches swimming, navigation with charts or professional warfare.",
      typicalActivities: [
        "Work a vessel during a change of conditions.",
        "Prepare and handle working lines.",
        "Coordinate a task with other crew.",
        "Stand an armed watch when explicitly trained.",
      ],
      boundaries: [
        "G08 and F35 are separate equipment routes; both apply only if both are actually taught. No military formation or chart practice is implied.",
      ],
      source: "profession-catalogue",
    },
    /* P10 — Navigator and Pilot */
    P10: {
      shortDescription:
        "A navigator or pilot works out a vessel’s passage and guides it through the waters they have learned.",
      fullDescription:
        "A learner accompanies experienced navigators, reconstructs progress and practises decisions about position, routes and approach to local hazards. Pilotage depends on learned waters; a new coastline is not mastered merely by travelling elsewhere. Some traditions additionally teach charted and celestial passage work. The profession includes those trained routes without treating maps or written calculation as inevitable features of every maritime society.",
      typicalActivities: [
        "Reconstruct a passage from course and progress.",
        "Choose an approach through familiar waters.",
        "Compare landmarks with a proposed route.",
        "Review a charted open-water passage in the specialist route.",
      ],
      boundaries: [
        "Charts are not inherent to Pilotage; no spoken or written competency or automatic geographic extension is supplied.",
      ],
      source: "profession-catalogue",
    },
    /* P11 — Shipmaster */
    P11: {
      shortDescription:
        "A shipmaster directs a vessel’s working crew and takes responsibility for the conduct of its voyage.",
      fullDescription:
        "Entry commonly follows substantial crew or navigation work, with an experienced master teaching decisions about the vessel, the people aboard and the progress of a voyage. The work includes allocating duties, judging whether plans remain practicable and responding when conditions or obligations change. Commercial ownership, military command and being the vessel’s best navigator are different matters; the master’s actual training must state which responsibilities are combined.",
      typicalActivities: [
        "Allocate crew work for a difficult passage.",
        "Revise a voyage plan when conditions change.",
        "Settle conflicting demands aboard.",
        "Review a junior crew member’s performance.",
      ],
      boundaries: [
        "Commanding a merchant vessel does not confer Military Command, cargo ownership or an office.",
      ],
      source: "profession-catalogue",
    },
    /* P12 — Courier and Messenger */
    P12: {
      shortDescription:
        "A courier carries messages reliably between people or places, often over repeated demanding journeys.",
      fullDescription:
        "An experienced messenger teaches route planning, the handling of entrusted messages and how to keep a journey moving under changing conditions. Foot and mounted service use different training, while long-distance work adds sustained field practice. A messenger can work for a community, household, trader or public authority. Delivering a message does not make the courier its political author, interpreter or military scout.",
      typicalActivities: [
        "Plan a dependable delivery route.",
        "Sustain an appropriate pace.",
        "Carry an entrusted message between settlements.",
        "Report a delay without losing the message’s meaning.",
      ],
      boundaries: [
        "Mounted travel does not mean Mounted Combat; everyday errands alone do not teach the complete F04 curriculum.",
      ],
      source: "profession-catalogue",
    },
    /* P13 — Trader and Merchant */
    P13: {
      shortDescription:
        "A trader obtains goods for exchange and judges the terms on which to buy and sell them.",
      fullDescription:
        "Learners accompany experienced traders through purchases, inspections, negotiation and disposal of goods. They learn to distinguish saleable quality from appearance, judge competing offers and maintain working dealings with suppliers and customers. A travelling peddler and a substantial merchant share this practical occupation at different scales. Craft production, lending and formal office accounts require additional instruction rather than following automatically from handling money.",
      typicalActivities: [
        "Inspect goods before purchase.",
        "Negotiate a workable exchange.",
        "Judge an unfamiliar offer.",
        "Plan a sequence of purchases and sales.",
      ],
      boundaries: [
        "Banking, smithing and bookkeeping are not universal parts of trade apprenticeship.",
      ],
      source: "profession-catalogue",
    },
    /* P14 — Guard, Watcher and Escort */
    P14: {
      shortDescription:
        "A guard protects people, places or travellers through watchfulness and practised intervention.",
      fullDescription:
        "Training takes place with experienced protectors through watch routines, paired fighting exercises and rehearsed responses to disturbance. Community defence, household service, market watching and paid escort work can all sustain the role without a standing police force. Rough-contact instruction is appropriate when the guard is expected to restrain people or fight at close quarters. Different equipment requires its own explicit training; the title does not imply an army curriculum.",
      typicalActivities: [
        "Watch an approach or entrance.",
        "Escort a person through a difficult place.",
        "Intervene in a physical disturbance.",
        "Relieve another watcher and explain a concern.",
      ],
      boundaries: [
        "Watching does not grant complete Perception or Law; formation drill, tactical planning and command belong to separate military routes.",
      ],
      source: "profession-catalogue",
    },
    /* P15 — Enforcer */
    P15: {
      shortDescription:
        "An enforcer uses practised physical pressure to compel compliance on behalf of a person or group.",
      fullDescription:
        "Learners work with experienced enforcers who teach rough fighting, restraint and how threats are presented and followed through. The work can involve collecting contested dues, protecting an illicit enterprise or intimidating rivals. It depends on relationships and circumstances rather than a universal licence to use force. A capable enforcer may be socially marginal or attached to a powerful household; neither position makes them a military professional.",
      typicalActivities: [
        "Confront someone over a disputed demand.",
        "Restrain a resisting person.",
        "Guard an illicit meeting.",
        "Judge how to present a credible threat.",
      ],
      boundaries: ["Physical coercion is not Law, Interrogation or Military Command."],
      source: "profession-catalogue",
    },
    /* P16 — Local Informant */
    P16: {
      shortDescription:
        "A local informant develops contacts and supplies information about people and events in a familiar milieu.",
      fullDescription:
        "A learner accompanies a well-connected practitioner, observes how introductions are made and learns which reports need checking. The work involves maintaining contact, judging a person’s position and returning with information that answers a real question. It may be an occasional paid service alongside other work or a sustained livelihood. Knowing a neighbourhood does not by itself teach burglary, disguise or the specialist customs of every criminal network.",
      typicalActivities: [
        "Find someone likely to know an answer.",
        "Check a local report through another contact.",
        "Arrange a discreet introduction.",
        "Explain what a source actually knows.",
      ],
      boundaries: [
        "A source’s old Night Entry learning history is not a universal informant curriculum.",
      ],
      source: "profession-catalogue",
    },
    /* P17 — Investigator and Intelligence Agent */
    P17: {
      shortDescription:
        "An investigator pursues a question about events, people or plans by examining evidence and questioning people.",
      fullDescription:
        "Training proceeds through supervised inquiries: the learner frames questions, seeks evidence, interviews witnesses and revises explanations when the material does not agree. A household, community authority, legal practitioner or other patron may entrust this work. Investigation need not depend on written archives or modern police. Its defining competence is following an inquiry carefully, rather than merely having access to secrets or imposing pressure.\n\nA covert intelligence assignment can add trained cover identities and settlement contacts when both receive deliberate instruction. The agent remains responsible for pursuing and checking an inquiry; an informant who supplies one circle of knowledge is a different role. This branch does not assume a modern intelligence agency.",
      typicalActivities: [
        "Reconstruct the sequence of an incident.",
        "Question witnesses with follow-up.",
        "Compare accounts with physical observations.",
        "Explain which conclusions remain uncertain.",
      ],
      boundaries: [
        "The occupation grants no legal authority and does not automatically include Law, coercion or covert entry.",
      ],
      source: "profession-catalogue",
    },
    /* P18 — Thief */
    P18: {
      shortDescription:
        "A thief takes property through a learned covert method rather than relying on force alone.",
      fullDescription:
        "An experienced practitioner may teach entry, concealment, observation or the handling of another person’s possessions through rehearsals and closely reviewed attempts. Burglary and theft by sleight of hand are different occupational methods within this role, not a universal collection of tricks. Some thieves work alone, while others serve a network. Illicit work does not automatically make a person a fighter, forger or expert on every town.",
      typicalActivities: [
        "Examine an approach before an entry.",
        "Move through a place without drawing notice.",
        "Manipulate a small object discreetly.",
        "Prepare an exit from a theft attempt.",
      ],
      boundaries: [
        "This role does not grant Underworld, armed intimidation or magical Warded-Lock Entry.",
      ],
      source: "profession-catalogue",
    },
    /* P19 — Confidence Trickster */
    P19: {
      shortDescription:
        "A confidence trickster obtains cooperation or valuables through a sustained misleading identity or story.",
      fullDescription:
        "Learners rehearse false accounts and physical presentation with an experienced deceiver, then review where listeners became suspicious or the disguise failed. The occupation concerns maintaining a deception across an encounter, sometimes across repeated dealings. It may imitate trade, social service or a claimed office without supplying the real expertise or authority of those roles. Its methods are distinct from a performer’s openly acknowledged fiction.",
      typicalActivities: [
        "Prepare a consistent assumed identity.",
        "Respond to an unexpected question.",
        "Adapt appearance for an impersonation.",
        "Maintain a misleading account across meetings.",
      ],
      boundaries: [
        "Acting, document forgery and commercial expertise are not supplied by pretending to possess them.",
      ],
      source: "profession-catalogue",
    },
    /* P20 — Smuggler and Illicit Trader */
    P20: {
      shortDescription:
        "A smuggler moves and trades goods through channels that evade a relevant restriction or controller.",
      fullDescription:
        "Training combines genuine dealing with practical instruction in concealing cargo and understanding the illicit network used. A maritime carrier, border traveller and settlement dealer can perform different parts of the business, so transport instruction must match the actual work. The occupation depends on a defined restriction and a route around it. It does not imply that every traveller, tax dispute or secret exchange belongs to the same underworld.",
      typicalActivities: [
        "Arrange an illicit purchase and delivery.",
        "Hide cargo within a legitimate load.",
        "Assess a proposed intermediary.",
        "Revise a route when an inspection point changes.",
      ],
      boundaries: [
        "Riding as a passenger does not teach driving, and smuggling does not automatically train combat.",
      ],
      source: "profession-catalogue",
    },
    /* P21 — Document Forger */
    P21: {
      shortDescription:
        "A document forger produces misleading records or credentials that can withstand the scrutiny expected of them.",
      fullDescription:
        "A learner studies genuine examples and practises their preparation under a skilled forger, who corrects forms, materials and inconsistencies. Work includes understanding what a document claims and how the intended reader is likely to examine it. This occupation requires access to the relevant written and documentary tradition. It is not a universal power to invent convincing records in an unfamiliar language or legal system.",
      typicalActivities: [
        "Examine the form of a genuine credential.",
        "Prepare a consistent false record.",
        "Correct a conspicuous mismatch.",
        "Anticipate a document’s likely examination.",
      ],
      boundaries: [
        "A forged document grants no real office, legal authority or written-language competence.",
      ],
      source: "profession-catalogue",
    },
    /* P22 — Soldier */
    P22: {
      shortDescription:
        "A soldier trains and serves as a fighting member of an organized military unit.",
      fullDescription:
        "Learners undergo repeated weapon and defensive instruction, contact practice and the collective exercises required by their unit. Infantry, militia service and hired military service can all supply substantial training without conferring high social status. Equipment tracks identify what the unit actually teaches: a bow, crossbow or firearm course is combined with complete close-combat training. Advanced experience develops through supervised service and real encounters, not by calling a recruit a veteran.\n\nA communal or household contingent without formation service can instead use the complete rough-combat course. Its military character comes from sustained service to an organized force and its responsibilities, not from inventing metal equipment or formation instruction.",
      typicalActivities: [
        "Carry out a formation change under instruction.",
        "Fight with the unit’s trained equipment.",
        "Maintain a place during collective movement.",
        "Review a difficult encounter with experienced soldiers.",
      ],
      boundaries: [
        "Equipment tracks are alternatives, not a grant of every weapon. Combat Experience and Battlefield Awareness remain taught experience proposals without costs or thresholds.",
      ],
      source: "profession-catalogue",
    },
    /* P23 — Mounted Soldier and Lancer */
    P23: {
      shortDescription:
        "A mounted soldier fights as part of a trained mounted unit and sustains its working riding duties.",
      fullDescription:
        "Entry combines practical instruction with mounts and the separate lessons of mounted fighting and troop participation. In the proposed lancer route, the learner is taught lance and one-handed edged sidearm use, complete defensive and rough fighting, and collective movement. Household retainers, supplied military service and pastoral contingents can provide different entry paths. Mount ownership is not assumed, and riding competence alone does not establish mounted warfare.",
      typicalActivities: [
        "Prepare for a mounted troop exercise.",
        "Keep position during a collective movement.",
        "Use the trained lance and sidearm.",
        "Review the unit’s performance after an encounter.",
      ],
      boundaries: [
        "No horse ownership, elite band, Animal Training or remount specialization is granted.",
      ],
      source: "profession-catalogue",
    },
    /* P24 — Military Scout */
    P24: {
      shortDescription:
        "A military scout gathers and reports field information for the needs of an organized force.",
      fullDescription:
        "Learners accompany experienced scouts, practise concealed observation and review whether their reports answer the unit’s actual questions. Field travel and military fighting are taught separately from the reconnaissance work. A foot scout and a mounted scout can serve the same purpose through different equipment routes. Hunting knowledge may be valuable, but the profession is distinguished by deliberate reconnaissance and reporting for a force.",
      typicalActivities: [
        "Observe an approach without revealing the patrol.",
        "Compare ground with a unit’s intended movement.",
        "Return with a clear account of enemy activity.",
        "Choose a concealed observation position.",
      ],
      boundaries: [
        "Ordinary wilderness guiding does not equal Military Reconnaissance; neither Hunting nor universal local knowledge is implied.",
      ],
      source: "profession-catalogue",
    },
    /* P25 — Military Commander */
    P25: {
      shortDescription:
        "A military commander directs an organized unit and remains responsible for how it carries out its tasks.",
      fullDescription:
        "Learners work under experienced commanders, practise choosing tactical responses and receive correction in giving orders, organizing people and following through on decisions. Service may begin within a household force, militia or larger military institution. The profession concerns actual command practice; a prestigious title without that work is not the same training. Command of a unit remains distinct from designing an entire campaign or personally mastering every subordinate’s equipment.",
      typicalActivities: [
        "Issue a practicable order.",
        "Adjust a unit’s task to changed conditions.",
        "Coordinate subordinates during an exercise.",
        "Review why an operation did not unfold as intended.",
      ],
      boundaries: [
        "Military Command remains distinct from Leadership, Battle Tactics, Formation Fighting and Campaign Strategy; Formation Command stays deferred.",
      ],
      source: "profession-catalogue",
    },
    /* P26 — Military Quartermaster */
    P26: {
      shortDescription:
        "A military quartermaster organizes the supplies and transport that keep a force functioning.",
      fullDescription:
        "A learner follows experienced supply officers or stewards through estimates, distribution, shortages and the consequences of changed routes. Account and office instruction can support this work but does not replace its military judgment. Some quartermasters travel with troops and learn their fighting curriculum; others work principally through stores and transport. The occupation is distinguished from trading by responsibility for sustaining a particular force over time.",
      typicalActivities: [
        "Estimate supplies for an intended movement.",
        "Arrange distribution to working units.",
        "Revise a transport plan after a delay.",
        "Reconcile stores with recorded obligations.",
      ],
      boundaries: [
        "Buying goods does not automatically teach Trade, and keeping records does not establish campaign command.",
      ],
      source: "profession-catalogue",
    },
    /* P27 — Campaign Planner */
    P27: {
      shortDescription:
        "A campaign planner relates operations, resources and timing to the purpose of a wider campaign.",
      fullDescription:
        "Training develops through reviewed plans and sustained work beside experienced campaign leaders. The planner compares proposed movements, changing information and the demands placed on forces across time and distance. This can be advisory work or part of a commander’s responsibilities; the proposal does not invent a modern permanent staff. Local tactical success, supply competence and high rank are each insufficient substitutes for learning campaign judgment.",
      typicalActivities: [
        "Compare competing sequences of operations.",
        "Identify a plan that outruns its resources.",
        "Revise priorities after a reversal.",
        "Explain how a local operation serves the wider aim.",
      ],
      boundaries: [
        "Planning provides neither a fighting curriculum nor an office, troops or authority.",
      ],
      source: "profession-catalogue",
    },
    /* P28 — Siege Engineer */
    P28: {
      shortDescription:
        "A siege engineer designs and organizes technical works intended to attack or defend a fortified place.",
      fullDescription:
        "Learners assist experienced builders and siege specialists, comparing the intended work with ground, materials, forces and the needs of those who will use it. Timber mechanisms may supply one practical foundation, while larger projects require separate specialist study and supervised construction. The occupation concerns technical design and works. It is distinct from directing the battle or operating a completed engine as one of its crew.",
      typicalActivities: [
        "Assess a site for a proposed siege work.",
        "Develop a workable construction plan.",
        "Review a structure or mechanism under load.",
        "Adapt a work to changing ground or resources.",
      ],
      boundaries: [
        "The profession supplies no default weapon, Siege Engine Operation or Siege Operations specialization.",
      ],
      source: "profession-catalogue",
    },
    /* P29 — Siege Engine Crew Specialist */
    P29: {
      shortDescription:
        "A siege engine crew specialist prepares, positions and operates a large engine with its working crew.",
      fullDescription:
        "An experienced crew leader teaches the learner how the complete engine is made ready, used, monitored and recovered between actions. Where the engine belongs to an existing weapon family, that family’s training is taught separately and remains exactly as defined in the approved catalogue. This proposal describes the existing Crossbow-family engine route. Other engine designs require later verified training bindings, rather than being silently classified here.",
      typicalActivities: [
        "Prepare an engine’s working position.",
        "Coordinate the crew’s sequence of work.",
        "Recognize a problem during operation.",
        "Prepare the engine for movement or renewed use.",
      ],
      boundaries: [
        "No cannon, firearm artillery or new Crossbow mapping is inferred; design work remains Siege Engineering.",
      ],
      source: "profession-catalogue",
    },
    /* P30 — Physician */
    P30: {
      shortDescription:
        "A physician assesses illness and injury and directs continuing medical care.",
      fullDescription:
        "Learners accompany a practitioner through recurring cases, discuss symptoms and histories, undertake appropriate care and review how patients change. Household, community, temple-associated and other organized settings can sustain such teaching when medical practice is actually present. Specialist diagnostic or treatment work requires its own additional instruction. The profession concerns clinical judgment; it does not automatically include operating, producing medicines or holding a religious office.",
      typicalActivities: [
        "Assess a patient’s developing illness.",
        "Compare a history with observed signs.",
        "Review whether treatment is helping.",
        "Direct continuing bedside care.",
      ],
      boundaries: [
        "The Temple Physician antecedent is a context, not a reason to give every physician Surgery or Religion.",
      ],
      source: "profession-catalogue",
    },
    /* P31 — Surgeon */
    P31: {
      shortDescription:
        "A surgeon carries out learned operative treatment and manages its immediate practical care.",
      fullDescription:
        "Training is through repeated supervised operations and their preparation and follow-up, with an experienced practitioner correcting technique and judgment. A surgeon may learn within a household lineage, a craft-associated practice or an organized place of care. Field service adds the particular constraints of treating casualties amid disrupted resources. Broader medical education is a separate possible route rather than an assumed consequence of operative work.",
      typicalActivities: [
        "Prepare for an operative case.",
        "Carry out a taught surgical procedure.",
        "Assess an immediate operative complication.",
        "Organize operative work under field constraints.",
      ],
      boundaries: [
        "Surgery remains a base Skill. No Heart Surgery, combat curriculum or physician qualification is implied.",
      ],
      source: "profession-catalogue",
    },
    /* P32 — Nurse and Patient Attendant */
    P32: {
      shortDescription:
        "A nurse provides sustained bedside care and notices changes that need further attention.",
      fullDescription:
        "A learner works beside an experienced attendant, practises recurring care and learns to communicate changes in a patient’s condition. Household sickrooms, community care and organized places of treatment can all provide this instruction. The work is a substantial practice in its own right, including careful observation and follow-through. Assisting a physician does not necessarily teach the physician’s complete diagnostic and treatment competence.",
      typicalActivities: [
        "Maintain a patient’s daily care.",
        "Notice and report a change in condition.",
        "Carry out an instructed care plan.",
        "Prepare a useful handover to another attendant.",
      ],
      boundaries: [
        "The profession does not grant Medicine or Surgery. A complete clinical apprenticeship can separately support Physician.",
      ],
      source: "profession-catalogue",
    },
    /* P33 — Birth Attendant and Midwife */
    P33: {
      shortDescription:
        "A birth attendant supports childbirth and provides the learned specialist care associated with it.",
      fullDescription:
        "Learners assist an experienced practitioner across repeated births, discussing preparation, progress and the need for further help. Training can be maintained through household and practitioner lineages without a modern maternity institution. Responsibility concerns the particular course of childbirth and immediate related care. The occupation is not a claim that every experienced parent has the approved specialist competence or that a birth attendant knows all of Medicine.",
      typicalActivities: [
        "Prepare a place and support for a birth.",
        "Follow the course of labour.",
        "Recognize a situation needing further help.",
        "Provide the taught immediate care after birth.",
      ],
      boundaries: [
        "Obstetrics remains under Medicine; no prerequisite or automatic parent acquisition is invented.",
      ],
      source: "profession-catalogue",
    },
    /* P34 — Veterinary Practitioner */
    P34: {
      shortDescription:
        "A veterinary practitioner investigates and treats illness or injury in animals.",
      fullDescription:
        "Training involves following animal cases with an experienced practitioner, learning to compare condition, history and response to care. Stable, herd, household and specialist service settings may supply cases, but routine stockkeeping is not the same education. The work may serve common working animals as well as valued mounts. Species and local practice shape the cases encountered without turning this role into automatic mastery of every animal.",
      typicalActivities: [
        "Investigate an animal’s declining condition.",
        "Compare an injury with its working history.",
        "Review a course of treatment.",
        "Advise a keeper when routine care is insufficient.",
      ],
      boundaries: [
        "Animal Handling, Animal Husbandry and Riding are not automatically taught as whole Skills by clinical work.",
      ],
      source: "profession-catalogue",
    },
    /* P35 — Herbalist and Remedy Maker */
    P35: {
      shortDescription:
        "A remedy maker identifies medicinal plant materials and prepares usable medicines from them.",
      fullDescription:
        "An experienced practitioner teaches learners to distinguish useful materials, judge their condition and prepare, preserve and dispense remedies with attention to consistency. The combined plant-and-remedy apprenticeship is one ordinary route; specialist distilling requires further deliberate training. A shop, household or practitioner lineage may sustain the work. Preparing a medicine does not establish the ability to diagnose the patient who might receive it.",
      typicalActivities: [
        "Identify and assess medicinal plant material.",
        "Prepare a remedy to a taught method.",
        "Preserve a preparation in usable condition.",
        "Explain a preparation’s intended handling.",
      ],
      boundaries: ["The role does not automatically teach Medicine, Surgery, Alchemy or Poisons."],
      source: "profession-catalogue",
    },
    /* P36 — Smith and Weaponsmith */
    P36: {
      shortDescription: "A smith shapes and joins worked metal into usable objects and repairs.",
      fullDescription:
        "Apprentices learn by preparing stock, practising joins and forms, and having an experienced smith correct the work before taking on more demanding commissions. Ironmaking, weapon manufacture and weapon servicing are distinct additions when a workshop actually teaches them. A village, estate, urban workshop or itinerant service can sustain smithing. The profession does not require high social status, and making a weapon does not teach fighting with it.",
      typicalActivities: [
        "Shape stock into a useful fitting.",
        "Repair a failed metal part.",
        "Judge a join before further work.",
        "Produce and service weapons in the specialist branch.",
      ],
      boundaries: [
        "Smithing does not include Smelting or Weaponsmithing unless their full additional courses are taught.",
      ],
      source: "profession-catalogue",
    },
    /* P37 — Smelter */
    P37: {
      shortDescription:
        "A smelter extracts usable metal from ore through a controlled furnace practice.",
      fullDescription:
        "Learners prepare charges, tend working conditions and compare the resulting metal and waste under an experienced smelter’s direction. Repeated production teaches judgment that cannot be replaced by simply heating a finished metal object. Mining settlements, estate works and independent production sites may sustain the occupation. A smelter can supply a forge without having been trained to manufacture its finished objects.",
      typicalActivities: [
        "Prepare a charge from available materials.",
        "Attend a furnace run.",
        "Assess the result of a batch.",
        "Identify a recurring production problem.",
      ],
      boundaries: ["Mining and Smithing remain separately taught competences."],
      source: "profession-catalogue",
    },
    /* P38 — Armorer */
    P38: {
      shortDescription:
        "An armorer makes and repairs protective equipment suited to a learned material and construction tradition.",
      fullDescription:
        "An experienced maker teaches how a protective piece is formed, fitted and assembled so that it works as a whole. Training follows the material tradition: forged metal requires a different workshop foundation from layered textile or leather construction. Those differences are described as actual practice rather than new base Skills. The occupation remains distinct from tailoring everyday clothing or making weapons.",
      typicalActivities: [
        "Fit a protective piece to its intended wearer.",
        "Assemble interacting components.",
        "Repair damaged protection.",
        "Judge whether a change impairs movement or coverage.",
      ],
      boundaries: [
        "Armoring stays a base Skill; no universal Smithing parent, combat training or ownership of armor is implied.",
      ],
      source: "profession-catalogue",
    },
    /* P39 — Carpenter */
    P39: {
      shortDescription:
        "A carpenter makes and repairs structures or objects by shaping and joining timber.",
      fullDescription:
        "Apprentices select and prepare wood, practise fitting parts and work through complete commissions under a carpenter’s correction. Building frames, household fittings and furnishings can provide substantial instruction without shipbuilding or mechanism design. A carpenter may work within a household, a travelling crew or a workshop. Planning an entire building and conducting a formal survey remain separate learned responsibilities.",
      typicalActivities: [
        "Lay out a timber joint.",
        "Fit parts into a stable assembly.",
        "Repair a damaged frame.",
        "Choose a workable repair for worn woodwork.",
      ],
      boundaries: ["The role does not imply Architecture, Masonry, Shipbuilding or Mechanics."],
      source: "profession-catalogue",
    },
    /* P40 — Shipbuilder */
    P40: {
      shortDescription:
        "A shipbuilder constructs and repairs vessels as complete working structures.",
      fullDescription:
        "Learners work through timber vessel projects with an experienced builder, practising both the underlying woodwork and how the assembled hull serves a vessel’s use. They learn to recognize problems that arise only when parts become a working whole. Construction may occur in a shore workshop or an organized yard. Building a vessel does not by itself teach how to sail it, plot its passages or make its sails.",
      typicalActivities: [
        "Lay out a vessel’s structural parts.",
        "Fit timber into a working hull.",
        "Assess damage before repair.",
        "Coordinate construction stages around the hull.",
      ],
      boundaries: ["Shipbuilding does not grant Seamanship, Sailmaking or navigation."],
      source: "profession-catalogue",
    },
    /* P41 — Sailmaker */
    P41: {
      shortDescription:
        "A sailmaker constructs and repairs sails that take an appropriate working shape under load.",
      fullDescription:
        "An apprentice works with an experienced sailmaker to judge material, lay out panels, assemble edges and attachments and review how a sail performs in service. This is a complete maritime craft rather than a small extension of clothing manufacture. Repair work can be taught aboard ship, but the full occupation requires more than stitching a temporary patch. The maker’s particular vessel and sail traditions remain relevant context.",
      typicalActivities: [
        "Lay out panels for a sail.",
        "Reinforce a loaded attachment.",
        "Assess wear before repairing it.",
        "Correct a poor working shape.",
      ],
      boundaries: [
        "Neither Tailoring, Weaving nor Seamanship follows automatically from making sails.",
      ],
      source: "profession-catalogue",
    },
    /* P42 — Spinner and Weaver */
    P42: {
      shortDescription: "A spinner and weaver turns prepared fibres into yarn and woven fabric.",
      fullDescription:
        "Learners follow material through fibre preparation, yarn production and weaving under a household or workshop teacher. Repeated correction links the qualities of the yarn to what happens during fabric production. This proposal describes a genuine combined craft route, not every specialized worker in a large textile industry. Where yarn preparation and weaving are separately taught occupations, a narrower worker’s training should remain explicit.",
      typicalActivities: [
        "Prepare fibre for working.",
        "Produce yarn suited to a fabric.",
        "Set up and continue a woven piece.",
        "Trace a fabric fault to material or working practice.",
      ],
      boundaries: [
        "F02 does not include Tailoring, Sailmaking or every independent textile specialization.",
      ],
      source: "profession-catalogue",
    },
    /* P43 — Tailor */
    P43: {
      shortDescription:
        "A tailor cuts, fits and assembles clothing for its intended wearer and use.",
      fullDescription:
        "Apprentices work from preparation and fitting through assembly and alteration under an experienced clothing maker. They learn to judge how pieces hang and move, recognize a poor fit and repair garments without spoiling their intended use. Household, travelling and workshop routes can sustain the craft. Making clothing from purchased cloth does not imply the ability to manufacture the cloth or construct a sail.",
      typicalActivities: [
        "Plan a garment’s pieces.",
        "Fit a garment to a wearer.",
        "Alter an unsuitable cut.",
        "Repair a worn seam or panel.",
      ],
      boundaries: ["Clothing, armor and sails retain distinct competences."],
      source: "profession-catalogue",
    },
    /* P44 — Leatherworker */
    P44: {
      shortDescription: "A leatherworker shapes and joins leather into durable useful goods.",
      fullDescription:
        "Learners practise selecting material for a purpose, laying out parts and assembling goods under a skilled maker’s correction. Bags, straps, footwear and other familiar products provide different commissions within the craft’s scope. The work can be domestic, itinerant or workshop-based. Making a protective item, a vehicle fitting or an animal’s equipment does not automatically teach the separate profession that uses it.",
      typicalActivities: [
        "Lay out leather parts for a commission.",
        "Make a durable join.",
        "Repair a worn fitting.",
        "Choose material suited to repeated strain.",
      ],
      boundaries: [
        "Armoring, Animal Handling and Cart Driving are not supplied by manufacturing their equipment.",
      ],
      source: "profession-catalogue",
    },
    /* P45 — Potter */
    P45: {
      shortDescription: "A potter forms and fires clay into usable ceramic objects.",
      fullDescription:
        "Apprentices learn how prepared clay behaves through forming, drying and firing, reviewing unsuccessful work with an experienced potter. A vessel-producing workshop may be technically demanding without teaching Sculpture. A workshop that deliberately develops modelled figures and forms can provide the combined sculptural route. Household kilns, estate production and independent shops are different settings for the same material responsibility.",
      typicalActivities: [
        "Prepare clay for a planned object.",
        "Form a usable vessel.",
        "Identify a drying or firing defect.",
        "Model a ceramic figure in the sculptural branch.",
      ],
      boundaries: ["Not every potter is a sculptor, and owning a kiln grants no competence."],
      source: "profession-catalogue",
    },
    /* P46 — Mason */
    P46: {
      shortDescription:
        "A mason constructs and repairs buildings or works in stone and other masonry materials.",
      fullDescription:
        "Learners prepare construction-oriented pieces, lay courses and review alignment and stability under an experienced mason. Work on walls, foundations and repairs develops judgment about the assembled construction rather than only an isolated dressed stone. A mason may serve a local household, a travelling building crew or a large commission. Complete building design, artistic sculpture and extraction underground remain different occupations.",
      typicalActivities: [
        "Dress stone for a construction joint.",
        "Lay a stable course.",
        "Diagnose a masonry repair.",
        "Coordinate work on a wall or foundation.",
      ],
      boundaries: [
        "Masonry includes construction-oriented stone dressing, not all Sculpture, Mining or Architecture.",
      ],
      source: "profession-catalogue",
    },
    /* P47 — Miner and Quarry Worker */
    P47: {
      shortDescription:
        "A miner or quarry worker extracts material by assessing the deposit and conducting the working safely enough to continue.",
      fullDescription:
        "An experienced worker teaches learners to read the material being followed, plan an extraction and recognize problems in the working. Surface quarries and underground workings provide different contexts within the approved Mining scope. Recurring material judgment makes this more than generic heavy labour. A skilled dependent worker need not own the mine, and extraction does not imply knowing how to smelt or build with the result.",
      typicalActivities: [
        "Assess where to continue a working.",
        "Prepare an extraction face.",
        "Recognize a developing working problem.",
        "Plan removal of useful material.",
      ],
      boundaries: [
        "The profession grants neither mine ownership nor Smelting, Masonry or a universal labour Skill.",
      ],
      source: "profession-catalogue",
    },
    /* P48 — Millwright and Mechanician */
    P48: {
      shortDescription:
        "A millwright builds and repairs timber mechanisms that transmit and apply force.",
      fullDescription:
        "Learners work beside an experienced maker through complete mechanisms, shaping timber parts and tracing how forces pass through the assembled work. Repeated failures and adjustments teach why a device behaves differently under load. Mills are a recognizable setting, but the route can also serve other established timber mechanisms. The profession does not assume every device is a mill or that every carpenter learns Mechanics.",
      typicalActivities: [
        "Trace a mechanism’s failing movement.",
        "Fit a replacement timber part.",
        "Adjust interacting components.",
        "Test a repaired assembly under working conditions.",
      ],
      boundaries: [
        "The occupation does not automatically include Smithing, Alchemy or siege expertise.",
      ],
      source: "profession-catalogue",
    },
    /* P49 — Building Designer */
    P49: {
      shortDescription:
        "A building designer plans stable, usable structures and relates the design to its site.",
      fullDescription:
        "Learners assist an experienced designer in measuring sites, developing plans and reviewing how a proposed structure will stand and be used. Supervised responsibility for complete projects distinguishes this education from copying drawings. Courts, estates, civic works and private commissions can provide different settings. Designing a building does not automatically teach every craft required to construct it.",
      typicalActivities: [
        "Assess a proposed building site.",
        "Develop a workable structural plan.",
        "Check a design against measurements.",
        "Resolve a problem between intended use and construction.",
      ],
      boundaries: [
        "The role does not supply Masonry, Carpentry or siege command merely because a project needs them.",
      ],
      source: "profession-catalogue",
    },
    /* P50 — Surveyor and Mapmaker */
    P50: {
      shortDescription:
        "A surveyor and mapmaker measures ground and turns those measurements into a usable map.",
      fullDescription:
        "Training follows the same tract from field observation and measurement to a representation that another person can use. An experienced surveyor corrects both the gathering of measurements and the decisions made in drawing the result. Land, route and works commissions can sustain this combined occupation. Making a map does not automatically teach navigation by charts or a broad scholarly account of the world.",
      typicalActivities: [
        "Measure a boundary or tract.",
        "Resolve inconsistent field measurements.",
        "Draw a map for a stated purpose.",
        "Explain the limitations of a surveyed result.",
      ],
      boundaries: ["Maps do not automatically confer Chart Navigation, Architecture or Geography."],
      source: "profession-catalogue",
    },
    /* P51 — Locksmith */
    P51: {
      shortDescription:
        "A locksmith constructs and repairs locks and their working means of access.",
      fullDescription:
        "An experienced maker teaches learners to understand a lock’s working parts, fit them correctly and trace failures in use. Repeated repair and manufacture develop a whole technical craft, not just the ability to open a familiar example. Material preparation may come from another workshop. The occupation can serve modest households as well as protected institutions without making the maker a thief or a combatant.",
      typicalActivities: [
        "Identify a fault in a lock.",
        "Fit a working replacement part.",
        "Construct an appropriate key or access component.",
        "Review a repaired lock in use.",
      ],
      boundaries: [
        "Locksmithing does not automatically provide Lockpicking, Warded-Lock Entry or complete Smithing.",
      ],
      source: "profession-catalogue",
    },
    /* P52 — Trapmaker */
    P52: {
      shortDescription:
        "A trapmaker designs, constructs and technically services constructed traps.",
      fullDescription:
        "A learner works through the design, assembly, testing and examination of trap mechanisms under a specialist’s correction. The work includes understanding how a completed construction can be maintained or technically bypassed. It may serve protection or other locally defined purposes without being the same livelihood as animal trapping. Merely noticing a suspicious feature does not supply this technical training.",
      typicalActivities: [
        "Design a trap for a defined purpose.",
        "Diagnose a construction fault.",
        "Maintain a working trap.",
        "Examine how an existing mechanism can be technically bypassed.",
      ],
      boundaries: [
        "Perception detects or suspects traps; Trapping and Trapmaking remain separate. No new disarming rule is created.",
      ],
      source: "profession-catalogue",
    },
    /* P53 — Cook */
    P53: {
      shortDescription:
        "A cook prepares meals and organizes the work needed to serve them in usable condition.",
      fullDescription:
        "Learners work through preparation, cooking and the care of ingredients under an experienced cook. Seasonal household or provisioning work can also teach preservation as a deliberate specialist practice. Baking and court service are additional routes when their narrower work is taught. Feeding a household, a travelling party or a large establishment changes the scale and demands without automatically creating a different profession.",
      typicalActivities: [
        "Plan preparation around available ingredients.",
        "Bring several dishes to readiness.",
        "Preserve a seasonal surplus in the trained route.",
        "Adapt a meal to a household’s requirements.",
      ],
      boundaries: ["Brewing, Winemaking and Distilling remain separate occupations and Skills."],
      source: "profession-catalogue",
    },
    /* P54 — Brewer */
    P54: {
      shortDescription:
        "A brewer prepares and manages a learned brewing process to produce a consistent drink.",
      fullDescription:
        "An experienced brewer teaches material preparation, the progress of a batch and how to recognize changes that affect the result. Repeated production and review distinguish the craft from making one successful household drink. A household, estate or commercial workplace may sustain training. Scale does not turn brewing into winemaking or distillation, each of which has its own complete practice.",
      typicalActivities: [
        "Prepare materials for a batch.",
        "Assess progress during brewing.",
        "Investigate an inconsistent result.",
        "Prepare a finished brew for keeping or service.",
      ],
      boundaries: ["Cooking, Winemaking and Distilling are not automatically included."],
      source: "profession-catalogue",
    },
    /* P55 — Vintner */
    P55: {
      shortDescription:
        "A vintner produces wine by managing the material and course of a learned winemaking process.",
      fullDescription:
        "Learners assist an experienced producer through repeated batches and seasonal work, comparing the condition of the material with changes in the wine. Responsibility includes deciding how to proceed when the expected course changes. A grower may also make wine, but cultivation and wine production are separate training routes. Trading finished wine alone does not teach the maker’s craft.",
      typicalActivities: [
        "Assess material intended for a batch.",
        "Follow the course of wine production.",
        "Investigate a developing fault.",
        "Prepare wine for keeping or distribution.",
      ],
      boundaries: ["Farming, Trade and Distilling do not follow from making wine."],
      source: "profession-catalogue",
    },
    /* P56 — Distiller */
    P56: {
      shortDescription:
        "A distiller separates and collects materials through a controlled distillation practice.",
      fullDescription:
        "An experienced practitioner teaches preparation of the apparatus, attention to the process and judgment of what is collected. Repeated work develops control of the complete practice rather than familiarity with a vessel’s name. Drinks, scents or other appropriate materials can give the occupation different commissions. Making medicinal preparations additionally requires Pharmacy and is represented separately by the remedy-maker branch.",
      typicalActivities: [
        "Prepare apparatus for a run.",
        "Monitor the course of a distillation.",
        "Separate collected material according to the taught practice.",
        "Diagnose an inconsistent result.",
      ],
      boundaries: [
        "Alchemy, Pharmacy and Brewing remain distinct; historical application must be bound before availability.",
      ],
      source: "profession-catalogue",
    },
    /* P57 — Alchemist */
    P57: {
      shortDescription:
        "An alchemist investigates and transforms materials through a learned alchemical tradition.",
      fullDescription:
        "Learners study a practitioner’s methods, prepare materials, repeat operations and compare results within the tradition’s account of how substances behave. Oral teaching, texts and workshop demonstration may combine in different ways. Alchemy is a sustained material practice with its own purposes and explanations, not a universal substitute for every craft or a synonym for magic. Actual supernatural effects remain matters for the Setting and rules.",
      typicalActivities: [
        "Prepare a material for a taught operation.",
        "Repeat and compare a transformation.",
        "Investigate an unexpected result.",
        "Explain a procedure within the learned tradition.",
      ],
      boundaries: [
        "No automatic Pharmacy, Smithing, Poisons, distillation expertise or magical effect is supplied.",
      ],
      source: "profession-catalogue",
    },
    /* P58 — Clerk and Steward */
    P58: {
      shortDescription:
        "A clerk or steward keeps an establishment’s work and accounts in usable order.",
      fullDescription:
        "Learners receive matters, follow obligations through their stages and maintain accounts under a responsible clerk or steward. Repeated responsibility for both the work and its record teaches more than copying documents. Household, estate, commercial and public offices can supply different scales of practice. Court service adds particular specialist demands, while knowledge of a legal system requires separate legal education.",
      typicalActivities: [
        "Follow an unresolved obligation.",
        "Reconcile accounts with work performed.",
        "Prepare a usable handover.",
        "Organize recurring household or office business.",
      ],
      boundaries: ["Written competence, Law, Research and office authority remain separate."],
      source: "profession-catalogue",
    },
    /* P59 — Legal Practitioner and Advocate */
    P59: {
      shortDescription:
        "A legal practitioner interprets a legal system and assists people in using its recognized procedures.",
      fullDescription:
        "Learners study rules and decisions with an experienced practitioner, compare cases and receive correction in what a procedure actually permits. Some traditions sustain specialist pleading; others train counsel or legal interpretation without that full public advocacy practice. Oral authorities can be part of a rigorous legal education. The profession provides no judicial office and does not turn the law of one jurisdiction into universal competence.",
      typicalActivities: [
        "Explain which rule governs a dispute.",
        "Prepare a matter for a recognized procedure.",
        "Compare a case with relevant authorities.",
        "Present a case in the trained advocacy branch.",
      ],
      boundaries: [
        "Customs, political influence and a judge’s authority are not automatically granted.",
      ],
      source: "profession-catalogue",
    },
    /* P60 — Envoy */
    P60: {
      shortDescription:
        "An envoy carries a principal’s position to others and conducts entrusted negotiations.",
      fullDescription:
        "An experienced representative teaches learners to understand what has been entrusted to them, present it appropriately and distinguish acceptable terms from promises they cannot make. Work may occur between communities, households, rulers or commercial bodies without a modern diplomatic service. Travel is a separate route when the envoy actually learns to conduct it. Representation does not itself confer the office, status or authority of the person represented.",
      typicalActivities: [
        "Explain an entrusted proposal.",
        "Negotiate within stated instructions.",
        "Clarify the meaning of a response.",
        "Report what was and was not agreed.",
      ],
      boundaries: [
        "A courier carries messages; an envoy negotiates within instructions. No automatic Administration, language acquisition or command is supplied.",
      ],
      source: "profession-catalogue",
    },
    /* P61 — Mediator and Community Convenor */
    P61: {
      shortDescription:
        "A mediator helps parties explain a disagreement and work toward terms they can accept.",
      fullDescription:
        "People learn through mentored participation in real and rehearsed discussions, receiving correction in how they interpret responses, frame proposals and respect the conventions of the meeting. A community, household or other recurring deliberative setting can sustain the role without a court or salaried office. Convening a discussion does not make the practitioner a judge, military leader or expert on a legal system.",
      typicalActivities: [
        "Clarify what the parties disagree about.",
        "Restate a proposed settlement.",
        "Keep a discussion usable after a misunderstanding.",
        "Explain the conventions governing a meeting.",
      ],
      boundaries: [
        "Mediation is an assembled practice, not a new base Skill or a power to impose a decision.",
      ],
      source: "profession-catalogue",
    },
    /* P62 — Banker and Credit Practitioner */
    P62: {
      shortDescription:
        "A credit practitioner manages lending, obligations and financial exposure over time.",
      fullDescription:
        "Learners examine obligations, follow repayment and reconcile accounts with an experienced practitioner’s decisions. The work concerns who owes what, on what terms and with what exposure if circumstances change. A credit house, merchant establishment or other continuing financial practice can supply instruction. Handling someone else’s capital does not make the practitioner wealthy, and ordinary trading does not automatically teach credit judgment.",
      typicalActivities: [
        "Assess a proposed credit arrangement.",
        "Track an outstanding obligation.",
        "Reconcile a debtor’s account.",
        "Review exposure when repayment becomes doubtful.",
      ],
      boundaries: [
        "Trade, legal expertise and ownership of a bank or lending fund are not implied.",
      ],
      source: "profession-catalogue",
    },
    /* P63 — Political Agent and Council Representative */
    P63: {
      shortDescription:
        "A political agent organizes support and advances a continuing interest within a community’s political arrangements.",
      fullDescription:
        "Training comes through assisting experienced organizers and representatives, comparing interests, maintaining support and reviewing the consequences of proposals. Work can concern a household, civic body, association or faction without resembling a modern political party. Public negotiation is one learned component, while broader understanding of institutions and contests for influence requires direct study and experience. Holding this profession grants neither a seat nor a right to rule.",
      typicalActivities: [
        "Assess support for a proposed course.",
        "Coordinate people with overlapping interests.",
        "Present a position to a council.",
        "Adapt a plan after a political response.",
      ],
      boundaries: ["No office, franchise, title or Leadership Skill is acquired automatically."],
      source: "profession-catalogue",
    },
    /* P64 — Teacher */
    P64: {
      shortDescription:
        "A teacher deliberately develops another person’s competence through explanation, practice and correction.",
      fullDescription:
        "Learners assist an experienced teacher, plan lessons, watch how pupils respond and revise explanations and exercises. Household tutoring, oral practitioner lineages, workshops and organized schools can all teach the work of teaching. Subject knowledge remains essential but separate: explaining one’s craft occasionally does not prove complete Teaching, and a teacher’s profession does not confer every subject they might later teach.",
      typicalActivities: [
        "Plan an exercise for a learner’s difficulty.",
        "Explain a practice in another way.",
        "Identify why a pupil repeats an error.",
        "Review whether instruction produced usable understanding.",
      ],
      boundaries: [
        "Choose and train the actual subject separately; this is not a route to every group through claimed teaching authority.",
      ],
      source: "profession-catalogue",
    },
    /* P65 — Scribe and Copyist */
    P65: {
      shortDescription:
        "A scribe produces and checks written material in a learned written tradition.",
      fullDescription:
        "An experienced scribe teaches learners to read and produce the forms used in their work, compare copies with exemplars and correct mistakes that change meaning or usability. The occupation can serve private people, households, religious establishments or public offices. Some scribes also learn accounts and office work, but copying alone does not supply those complete competences. The actual written tradition must be supplied by context; no generic Literacy Skill is introduced.",
      typicalActivities: [
        "Prepare a legible copy.",
        "Compare a copy against its exemplar.",
        "Write a dictated or agreed text in the learned tradition.",
        "Identify an omission that changes a record.",
      ],
      boundaries: [
        "The core acquisition route is to a context-bound Written Tradition, not an automatic spoken language, Research or generic Literacy.",
      ],
      source: "profession-catalogue",
    },
    /* P66 — Translator and Interpreter */
    P66: {
      shortDescription:
        "A translator or interpreter conveys meaning between languages while preserving what matters in the exchange.",
      fullDescription:
        "Learners compare renderings, practise live exchanges or written translation and receive correction from someone competent in both the languages and the translation practice. The work includes explaining ambiguities and recognizing when a literal rendering misleads. Travel, legal dealings, scholarship and household service can supply different commissions. Knowing two languages is not the same as this complete professional practice, and the profession does not supply unknown languages.",
      typicalActivities: [
        "Interpret a negotiated exchange.",
        "Resolve an ambiguity between speakers.",
        "Translate a passage for a stated reader.",
        "Explain a meaning that has no direct verbal match.",
      ],
      boundaries: [
        "No automatic spoken-to-written transfer or decipherment competence is supplied.",
      ],
      source: "profession-catalogue",
    },
    /* P67 — Historian and Genealogist */
    P67: {
      shortDescription:
        "A historian investigates and explains the past through the evidence and traditions available to them.",
      fullDescription:
        "Learners study with an experienced keeper or investigator of the past, comparing accounts, building a wider historical understanding and explaining how a conclusion was reached. Some investigate difficult texts; others specialize in family descent through oral and documentary material. These are specific training routes rather than a rule that History requires literacy. Reconstructing a lineage does not establish every family claim as true or automatically confer social standing.",
      typicalActivities: [
        "Compare conflicting accounts of an event.",
        "Explain an event in a wider historical setting.",
        "Investigate a claimed line of descent.",
        "Review a difficult text in the trained textual branch.",
      ],
      boundaries: [
        "Storytelling, written competence and a noble pedigree are not grants of this profession.",
      ],
      source: "profession-catalogue",
    },
    /* P68 — Mathematical Practitioner */
    P68: {
      shortDescription:
        "A mathematical practitioner develops and applies learned methods for numerical and formal problems.",
      fullDescription:
        "Training involves worked problems, explanation of methods and correction of reasoning under a capable practitioner. An office, workshop, observatory or independent teacher may provide purposes for this study, but using a few task-specific calculations does not supply the whole competence. The occupation can range from practical numerical service to sustained theoretical inquiry without inventing separate base Skills for each application.",
      typicalActivities: [
        "Choose a method for a quantitative problem.",
        "Check a calculation by another route.",
        "Explain why a result follows.",
        "Adapt a known method to an unfamiliar problem.",
      ],
      boundaries: [
        "Bookkeeping, Surveying and Astronomy are separate applications and do not automatically come with Mathematics.",
      ],
      source: "profession-catalogue",
    },
    /* P69 — Philosopher */
    P69: {
      shortDescription:
        "A philosopher examines difficult questions through sustained reasoning, argument and criticism.",
      fullDescription:
        "Learners study with experienced thinkers, reconstruct arguments and practise answering objections rather than merely memorizing conclusions. Oral discussion and written study can each sustain serious work. A philosophical vocation may rely on teaching, patronage or another livelihood, but the substantive inquiry remains recognizable. Persuasive speech, religious doctrine and political influence are neighbouring practices rather than automatic parts of philosophical competence.",
      typicalActivities: [
        "Clarify a disputed concept.",
        "Reconstruct an argument fairly.",
        "Test a conclusion against an objection.",
        "Explain the assumptions behind a position.",
      ],
      boundaries: ["The occupation does not grant Religion, Oratory, Politics or a school office."],
      source: "profession-catalogue",
    },
    /* P70 — Astronomer */
    P70: {
      shortDescription:
        "An astronomer observes celestial patterns and develops a learned account of their cycles and relationships.",
      fullDescription:
        "Training combines repeated observation with comparison, explanation and review under an experienced practitioner. Calendrical, scholarly and navigational interests may motivate the work, but they do not all teach the same complete competences. A maintained observing tradition need not resemble a modern observatory. The profession concerns the study of celestial phenomena; interpreting their divinatory significance remains Astrology or another defined practice.",
      typicalActivities: [
        "Compare observations over a cycle.",
        "Investigate an apparent irregularity.",
        "Explain a celestial pattern.",
        "Prepare an account for a calendrical purpose.",
      ],
      boundaries: [
        "Celestial Navigation, Mathematics and Astrology are not automatic acquisitions.",
      ],
      source: "profession-catalogue",
    },
    /* P71 — Astrologer */
    P71: {
      shortDescription:
        "An astrologer interprets celestial configurations according to a learned astrological tradition.",
      fullDescription:
        "Learners study a tradition’s methods, prepare and compare interpretations and receive correction in how its rules are applied. Consultation, calendrical work or institutional service may sustain the occupation in different settings. The profession describes a historical learned practice without deciding its supernatural truth. It remains distinct from observing the heavens as Astronomy and from other divinatory methods.",
      typicalActivities: [
        "Prepare an interpretation within a tradition.",
        "Explain how a configuration is read.",
        "Compare competing applications of a rule.",
        "Advise a client about the interpretation’s stated meaning.",
      ],
      boundaries: ["No automatic Astronomy, Divination or actual supernatural effect is supplied."],
      source: "profession-catalogue",
    },
    /* P72 — Naturalist */
    P72: {
      shortDescription:
        "A naturalist studies animals and plants through sustained observation and comparison.",
      fullDescription:
        "An experienced observer teaches learners to distinguish organisms, compare habits and habitats and revise mistaken accounts. The work may be maintained through oral specialist knowledge, field collection or more formal study. It is defined by the continued investigation and learned description of living things, not by hunting them or preparing medicines. A naturalist may work with those occupations without being trained in their complete practices.",
      typicalActivities: [
        "Compare the habits of similar animals.",
        "Identify a plant in its habitat.",
        "Investigate a doubtful natural-history report.",
        "Explain how seasonal conditions affect an organism.",
      ],
      boundaries: [
        "Hunting, Pharmacy and generic Research are not supplied merely by interest in natural things.",
      ],
      source: "profession-catalogue",
    },
    /* P73 — Geographer */
    P73: {
      shortDescription:
        "A geographer develops and explains a broad learned account of places and their relationships.",
      fullDescription:
        "Learners compare travellers’ accounts, known routes and other evidence with an experienced practitioner, building an understanding beyond one familiar journey. Some also learn measured mapping, while others concentrate on describing regions and the relationships between them. The occupation may support travel, scholarship or administration. Knowing about a place is not the same as being able to navigate its waters or survive there.",
      typicalActivities: [
        "Compare descriptions of a region.",
        "Explain connections between places.",
        "Reconcile inconsistent accounts of distance or position.",
        "Prepare a regional account for a stated purpose.",
      ],
      boundaries: [
        "No automatic Wayfinding, Pilotage or universal knowledge of unknown places is granted.",
      ],
      source: "profession-catalogue",
    },
    /* P74 — Religious Practitioner */
    P74: {
      shortDescription:
        "A religious practitioner sustains and explains the learned practices of a particular religious tradition.",
      fullDescription:
        "People enter through household or practitioner instruction, communal service, apprenticeship or organized religious study. They learn the tradition’s accounts, observances and responsibilities through repeated participation that is explicitly taught and corrected. Systematic doctrinal study and trained mental preparation are separate specialist routes when the tradition actually includes them. The vocation supplies neither a rank within an institution nor a decision about supernatural efficacy.",
      typicalActivities: [
        "Explain an observance within the tradition.",
        "Prepare people for a ceremony.",
        "Resolve a question about religious practice.",
        "Undertake trained preparation before a demanding rite.",
      ],
      boundaries: [
        "No generic Ritual Performance, magical power, religious office or Meditation bonus is invented.",
      ],
      source: "profession-catalogue",
    },
    /* P75 — Diviner */
    P75: {
      shortDescription:
        "A diviner interprets signs or a learned procedure according to a defined divinatory tradition.",
      fullDescription:
        "A practitioner teaches learners how the method is conducted, which observations matter within it and how interpretations are formed and explained. Recurring consultations or communal duties can sustain the occupation without a formal temple. Omen reading is a specialist branch, while astrology remains its own learned practice. Describing the work does not assert that the interpretation is either supernaturally effective or false.",
      typicalActivities: [
        "Conduct a taught divinatory procedure.",
        "Explain an interpretation within its tradition.",
        "Distinguish relevant signs according to that method.",
        "Review an omen-reading case in the specialist branch.",
      ],
      boundaries: [
        "Augury remains a context of Omen Reading, not a new base Skill; Astrology and Religion are not automatic.",
      ],
      source: "profession-catalogue",
    },
    /* P76 — Herald */
    P76: {
      shortDescription:
        "A herald interprets recognized identifying signs and performs the formal communications entrusted to that role.",
      fullDescription:
        "Learners study an experienced herald’s conventions and practise identifying, describing and using signs accurately. Where the role includes formal announcements, public speech and deliberate recall can also receive sustained teaching. Some heralds investigate lineages, but that specialist work is not assumed from a tabard or title. The occupation depends on an actual heraldic tradition; it is not a label applied to every society’s messenger.",
      typicalActivities: [
        "Identify an authorized sign within the tradition.",
        "Describe a bearing consistently.",
        "Prepare a formal announcement.",
        "Investigate a lineage in the trained specialist branch.",
      ],
      boundaries: [
        "A herald is not automatically a diplomat, legal advocate or military commander.",
      ],
      source: "profession-catalogue",
    },
    /* P77 — Musician and Singer */
    P77: {
      shortDescription:
        "A musician or singer prepares and performs music through a learned vocal or instrumental practice.",
      fullDescription:
        "Learners rehearse with an experienced performer who corrects execution, phrasing and the demands of the chosen musical tradition. Self-accompanied song is one genuine combined route; instrumental and vocal specialists need not learn each other’s whole competence. Composition requires additional specialist study. Household, community, itinerant and patron-supported work can sustain performance without a modern concert institution.",
      typicalActivities: [
        "Prepare a piece for an occasion.",
        "Rehearse a difficult passage.",
        "Adapt a performance to other musicians.",
        "Develop a composition in the specialist branch.",
      ],
      boundaries: [
        "No new instrument base Skills are created; Music, Singing and Composition remain distinct.",
      ],
      source: "profession-catalogue",
    },
    /* P78 — Actor and Dancer */
    P78: {
      shortDescription:
        "An actor or dancer prepares expressive performances for an audience through a learned performance tradition.",
      fullDescription:
        "Learners rehearse roles and movements with experienced performers, receiving correction in how an intended effect becomes intelligible to an audience. Some traditions directly combine dramatic acting and dance; others train one without the other. Community occasions, travelling companies, courts and other venues provide different livelihoods. Performing an acknowledged fiction is distinct from deceiving an unsuspecting person about a real identity.",
      typicalActivities: [
        "Rehearse a scene with other performers.",
        "Develop a role for an audience.",
        "Prepare a formal dance sequence.",
        "Adjust a performance to its space.",
      ],
      boundaries: [
        "Dance is not Athletics, and Acting does not automatically teach Deception or Disguise.",
      ],
      source: "profession-catalogue",
    },
    /* P79 — Visual Artist and Sculptor */
    P79: {
      shortDescription:
        "A visual artist makes images or forms intended to communicate a chosen appearance or meaning.",
      fullDescription:
        "Learners work through studies and commissions under an experienced maker, comparing intention with what a viewer can actually see. Drawing and modelling can form a shared workshop education, while an exclusively pictorial or sculptural tradition may remain narrower. Household craft, communal work and patronage can each sustain the occupation. Artistic representation does not automatically teach the construction or extraction of its materials.",
      typicalActivities: [
        "Prepare a study for a commission.",
        "Revise a form that reads poorly.",
        "Develop a model before finished work.",
        "Complete an image for a particular use.",
      ],
      boundaries: ["Sculpture, Masonry, Mining and Pottery keep their distinct scopes."],
      source: "profession-catalogue",
    },
    /* P80 — Storyteller and Poet */
    P80: {
      shortDescription:
        "A storyteller or poet composes and presents narratives or literary works for an audience.",
      fullDescription:
        "Learners compose, rehearse and revise with an experienced practitioner, learning how events, language and delivery hold together. An oral narrative tradition can teach both storytelling and literary composition without writing. Other poets concentrate on written composition and need not become trained narrators. Community memory, travelling performance and patronage can sustain the work without making every performance a reliable historical account.",
      typicalActivities: [
        "Shape an account into a coherent narrative.",
        "Compose a work for an occasion.",
        "Revise a passage that loses its audience.",
        "Perform a story with deliberate pacing.",
      ],
      boundaries: ["History, Oratory and Mnemonics are not automatic products of telling stories."],
      source: "profession-catalogue",
    },
    /* P81 — Athlete and Physical Performer */
    P81: {
      shortDescription:
        "An athlete develops and displays trained running and athletic movement through sustained practice.",
      fullDescription:
        "An experienced practitioner coaches pace, movement and repeated exercises, then reviews performance under the demands of a contest or display. Community events, household patronage and specialist venues can support this vocation. The proposed combined field route teaches Running and Athletics as separate complete competences. It does not turn one physical discipline into every bodily skill or give an athlete a military education.",
      typicalActivities: [
        "Prepare for a running event.",
        "Practise a difficult jump or vault.",
        "Adjust pace to the demands of a course.",
        "Review movement after a performance.",
      ],
      boundaries: ["Climbing, Swimming, Dance, Brawling and combat training remain separate."],
      source: "profession-catalogue",
    },
    /* P82 — Weapon Instructor */
    P82: {
      shortDescription:
        "A weapon instructor teaches a defined fighting curriculum through demonstration, paired practice and correction.",
      fullDescription:
        "A prospective instructor studies both the fighting practice and how to teach it, assisting experienced teachers before taking responsibility for learners. The occupation can be sustained by household service, independent instruction or an established school of practice. A compact edged-weapon course, rough guard fighting and the approved swashbuckling Fencing tradition are distinct teaching routes. The profession is neither a licence to teach every weapon nor a new combat style.",
      typicalActivities: [
        "Correct a learner’s weapon handling.",
        "Demonstrate avoidance and parrying.",
        "Plan a paired exercise.",
        "Review a student’s recurring difficulty.",
      ],
      boundaries: [
        "Fencing remains the existing tradition including sword-and-buckler/main-gauche practice; no extra style or weapon acquisition is created.",
      ],
      source: "profession-catalogue",
    },
    /* P83 — Gambler */
    P83: {
      shortDescription:
        "A gambler makes a livelihood through skilled participation in games involving stakes and uncertain outcomes.",
      fullDescription:
        "An experienced player teaches the rules of particular games, judgment of play and attention to how an encounter develops. Sustained practice and review distinguish the occupational route from occasional wagering. Gambling may be itinerant, attached to a venue or conducted through recurring gatherings. Playing well does not automatically imply cheating, theft or the broad financial judgment of a credit practitioner.",
      typicalActivities: [
        "Assess a play within a known game.",
        "Recognize a change in the course of play.",
        "Judge when to continue a session.",
        "Explain a disputed rule within the learned game.",
      ],
      boundaries: ["Deception, Sleight of Hand and Banking & Credit are not automatic."],
      source: "profession-catalogue",
    },
    /* P84 — Diver and Water Worker */
    P84: {
      shortDescription:
        "A diver or water worker performs sustained tasks in water using trained swimming competence.",
      fullDescription:
        "Training proceeds beside experienced water workers, with repeated correction of movement, breath management and judgment appropriate to the actual task and conditions. Gathering, recovery and work around vessels can sustain the livelihood without modern diving equipment. Boat operation is separately taught if the worker also crews the vessel. The role does not invent a new Diving Skill or guarantee survival under any depth or water condition.",
      typicalActivities: [
        "Reach and inspect a submerged object.",
        "Work around a vessel in the water.",
        "Return with gathered material.",
        "Judge whether conditions exceed the taught practice.",
      ],
      boundaries: [
        "No new depth, breath, drowning or rescue mechanics are supplied; medicine and navigation remain separate.",
      ],
      source: "profession-catalogue",
    },
  });

/* ------------------------------------------------------------------------------------------ */
/* Coverage accounting                                                                          */
/* ------------------------------------------------------------------------------------------ */

/**
 * Every prose key must name a canonical identity. A key that does not is a transcription mistake, so
 * it fails the build rather than becoming prose nobody can reach.
 */
function assertKeysResolve(): void {
  const groupIds = new Set(competencyContentV2LearningGroups.map((group) => group.id));
  const familyCodes = new Set(competencyContentV2Families.map((family) => family.code));
  const strayGroups = Object.keys(competencyContentV2GroupReaderProse).filter(
    (id) => !groupIds.has(id),
  );
  const strayFamilies = Object.keys(competencyContentV2FamilyReaderProse).filter(
    (code) => !familyCodes.has(code),
  );
  if (strayGroups.length || strayFamilies.length)
    throw new Error(
      `Competency V2 reader prose names unknown identities: ${[...strayGroups, ...strayFamilies].join(", ")}`,
    );
  const shortAsFull = [
    ...Object.entries(competencyContentV2GroupReaderProse),
    ...Object.entries(competencyContentV2FamilyReaderProse),
  ].filter(([, prose]) => prose.fullDescription.trim() === prose.shortDescription.trim());
  if (shortAsFull.length)
    throw new Error(
      `Competency V2 reader prose repeats a short description as a full description: ${shortAsFull
        .map(([key]) => key)
        .join(", ")}`,
    );
}
assertKeysResolve();

/**
 * Canonical Learning Groups whose accepted page predates the curriculum canonical V2 now teaches.
 *
 * The page exists, is accepted and is prose-complete, but it describes a narrower earlier practice,
 * so publishing it would tell a reader something canonical data contradicts. Withheld rather than
 * published or silently edited; a refreshed description is content work, under #365.
 */
export const competencyContentV2GroupsWithSupersededSourceProse: readonly {
  id: string;
  reason: string;
}[] = Object.freeze([
  Object.freeze({
    id: "F04",
    reason: "The canonical practice now also teaches Swimming and Climbing.",
  }),
  Object.freeze({
    id: "F09",
    reason: "The canonical practice now also teaches Climbing and Weather Lore.",
  }),
]);

/**
 * Canonical Learning Groups with no published reader prose, returned rather than fabricated. Derived
 * from the canonical catalogue, so it cannot drift from what is actually published.
 */
export const competencyContentV2GroupsAwaitingReaderProse: readonly {
  id: string;
  name: string;
  disposition: string;
}[] = Object.freeze(
  competencyContentV2LearningGroups
    .filter((group) => !competencyContentV2GroupReaderProse[group.id])
    .map((group) =>
      Object.freeze({ id: group.id, name: group.name, disposition: group.disposition }),
    ),
);

/** Canonical Profession families with no accepted reader prose. Expected to be empty. */
export const competencyContentV2FamiliesAwaitingReaderProse: readonly {
  code: string;
  name: string;
}[] = Object.freeze(
  competencyContentV2Families
    .filter((family) => !competencyContentV2FamilyReaderProse[family.code])
    .map((family) => Object.freeze({ code: family.code, name: family.name })),
);

/**
 * Published prose that names a catalogue identifier a reader cannot reach, returned for content
 * review rather than silently rewritten.
 *
 * Four accepted boundaries statements cite group codes, and three of the cited groups are ones the
 * V2 redesign removed or revised. The prose is otherwise correct and is published as accepted;
 * rewording it is authoring, which this publication layer does not do. Recorded as data because
 * `Glantri should explain Glantri, not explain its own interface`
 * (`docs/product/chargen-competency-experience-contract.md` section 2), and an identifier in reader
 * prose is the interface leaking into the game.
 */
export const competencyContentV2ReaderProseContentReviewFlags: readonly {
  key: string;
  citedIdentifier: string;
  reason: string;
}[] = Object.freeze([
  Object.freeze({
    key: "P09",
    citedIdentifier: "G08, F35",
    reason: "Both cited groups were removed by the V2 redesign.",
  }),
  Object.freeze({
    key: "P12",
    citedIdentifier: "F04",
    reason: "F04 survives but its curriculum was revised after this sentence was written.",
  }),
  Object.freeze({
    key: "P42",
    citedIdentifier: "F02",
    reason: "F02 is canonical; the bare code is still an identifier in reader prose.",
  }),
]);

/** Publication coverage, so the honest gap is data rather than a claim in a report. */
export const competencyContentV2ReaderProseCoverage = Object.freeze({
  groups: Object.freeze({
    canonical: competencyContentV2LearningGroups.length,
    published: Object.keys(competencyContentV2GroupReaderProse).length,
    awaiting: competencyContentV2GroupsAwaitingReaderProse.length,
  }),
  families: Object.freeze({
    canonical: competencyContentV2Families.length,
    published: Object.keys(competencyContentV2FamilyReaderProse).length,
    awaiting: competencyContentV2FamiliesAwaitingReaderProse.length,
  }),
});

/** Reader prose for a canonical Learning Group, or `undefined` while it awaits authoring. */
export function competencyV2GroupReaderProse(groupId: string): V2ReaderProse | undefined {
  return competencyContentV2GroupReaderProse[groupId];
}

/** Reader prose for a canonical Profession family, addressed by its canonical `code`. */
export function competencyV2FamilyReaderProse(familyCode: string): V2ReaderProse | undefined {
  return competencyContentV2FamilyReaderProse[familyCode];
}
