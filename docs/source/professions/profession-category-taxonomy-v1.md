# Player-facing Profession browsing categories v1 — approved

**Status:** approved by the Product Owner on 2026-09-27 as the **approved
player-facing browsing taxonomy for Forgejo #372**. See [rule decision
0012](../../decisions/rules/0012-profession-browsing-taxonomy-approval.md).
This is a presentation/browsing layer only: it carries no cost, level, XP,
progression, eligibility, or acquisition rule, and it is not yet wired to any
runtime, gate, or test.

**Purpose:** unblock Forgejo #372 (Chargen Profession and acquisition
presentation), which was blocked on a Profession browsing roster. The
2026-09-26 ruling stated this roster must not be invented by an implementation
Builder, so it was authored here and brought to the Product Owner for a
decision. The 2026-09-27 ruling recorded below discharges that block.

## What this is, and what it is not

The current Chargen chooser filters by **Profession family**. That narrows
nothing: there are 84 families for 86 paths, so a family is close to a
restatement of a Profession. This document proposes a second, **purely
presentational** label — a _category_ — analogous in purpose to the existing
player-facing Skill categories (`combat`, `fieldcraft`, `maritime`, `craft`,
`knowledge`, and so on; 17 of them in
`packages/domain/src/content/skills.ts`).

- **Profession family remains structural identity.** Nothing here replaces,
  renames, or reinterprets it.
- **Category is for browsing only.** It is a label on a chooser filter.
- **No mechanics are proposed.** A category implies nothing about cost, access,
  availability, prerequisites, Learning Groups, Society-Level or Social-Band
  ranges, or Arch-Society applicability.
- **No Profession identity, `code`, `id`, `name`, or prose is changed.** The
  accepted catalogue was read to categorise, never edited.

## How Professions were categorised

Each Profession was placed by **what the occupation actually does**, read from
its accepted prose in
`docs/source/professions/Glantri_Full_Profession_Catalogue_PO_Proposal.md.txt`
(short description, typical activities, and boundaries) — **not** from its
training graph. Two Professions sharing a Learning Group are frequently not the
same kind of work: P51 Locksmith and P18 Thief overlap in apparatus and share
nothing occupationally. Family `note` fields were treated as authoring
provenance and had no influence on any reader-facing name.

Each Profession sits in **exactly one** category. No Profession is
dual-categorised; the genuinely contested placements are listed explicitly in
[Ambiguous cases](#ambiguous-cases) rather than resolved by duplication.

## 1. The category roster

Sixteen categories. Each name is intended to be recognisable without
explanation.

| Category                            | Belongs here                                                                                           | Does not belong here                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Land and Wilderness**             | Livelihoods that take food, game, or raw material directly from land, water, and domestic animals.     | Processing or selling what is taken; treating animals clinically.      |
| **Travel, Transport and Seafaring** | Moving people, goods, or messages over road and water, and working a vessel or in water.               | Building the vessel; owning the cargo; military movement.              |
| **Trade and Money**                 | Livelihoods made from exchange, credit, reckoning, and the keeping of accounts.                        | Producing the goods; the legal system itself; supplying an army.       |
| **Law, Office and Diplomacy**       | Speaking, negotiating, or acting formally on behalf of a principal, a party, or a community.           | Private commercial dealing; military command; clerical record-keeping. |
| **Guarding and Arms Training**      | Armed civil work — watching, protecting, compelling — and the teaching of a fighting curriculum.       | Service in an organized military force; covert methods.                |
| **Military Service**                | Roles within an organized military force, from the ranks to command, supply, planning, and siege work. | Civil guarding; the arms and armour trades.                            |
| **Covert and Illicit Work**         | Work whose method depends on concealment, pretence, or evading a controller.                           | Lawful advocacy; open armed force; ordinary trade.                     |
| **Healing and Care**                | Treating and caring for the sick, the injured, the birthing, and animals, and preparing remedies.      | Wild gathering of the materials; alchemical inquiry.                   |
| **Metal and Mechanism Crafts**      | Winning and working metal, and making the fitted mechanisms and fittings that depend on it.            | Timber and stone structures; using a lock or trap covertly.            |
| **Building and Extraction**         | Raising, repairing, and designing structures, and extracting the bulk material they need.              | Fine metal fitting; surveying as a knowledge product.                  |
| **Textile, Leather and Pottery**    | Shaping soft and plastic materials — fibre, cloth, hide, clay — into finished goods.                   | Metal armour; timber or stone construction.                            |
| **Food and Drink**                  | Preparing food and managed fermentation or distillation for consumption.                               | Growing or gathering the ingredients; alchemical practice.             |
| **Letters and Teaching**            | Transmitting competence and text — instruction, copying, and moving meaning between languages.         | The subject matter itself; original inquiry into it.                   |
| **Learning and Inquiry**            | Developing and explaining a learned account of the world through study, measurement, and reasoning.    | Teaching it to others; religious or divinatory interpretation.         |
| **Religion and Divination**         | Sustaining a religious tradition, or interpreting signs according to a defined tradition.              | Astronomical observation; philosophical argument.                      |
| **Performance and Display**         | Preparing and presenting work for an audience — music, stage, image, narrative, athletic display.      | Teaching performance; games played for stakes.                         |

## 2. Distribution

| Category                        | Professions |
| ------------------------------- | ----------- |
| Military Service                | 8           |
| Learning and Inquiry            | 8           |
| Travel, Transport and Seafaring | 7           |
| Land and Wilderness             | 6           |
| Covert and Illicit Work         | 6           |
| Healing and Care                | 6           |
| Building and Extraction         | 6           |
| Law, Office and Diplomacy       | 5           |
| Metal and Mechanism Crafts      | 5           |
| Textile, Leather and Pottery    | 5           |
| Performance and Display         | 5           |
| Trade and Money                 | 4           |
| Food and Drink                  | 4           |
| Guarding and Arms Training      | 3           |
| Letters and Teaching            | 3           |
| Religion and Divination         | 3           |
| **Total**                       | **84**      |

Largest category: 8 (Military Service; Learning and Inquiry). Smallest: 3
(Guarding and Arms Training; Letters and Teaching; Religion and Divination).
Mean 5.25. Choosing any one category leaves at most eight Professions to read.

## 3. Complete mapping — all 84 families

| Code | Profession family                          | Category                        |
| ---- | ------------------------------------------ | ------------------------------- |
| P01  | Hunter and Trapper                         | Land and Wilderness             |
| P02  | Wild Plant Gatherer                        | Land and Wilderness             |
| P03  | Field and Caravan Guide                    | Travel, Transport and Seafaring |
| P04  | Fisher                                     | Land and Wilderness             |
| P05  | Farmer                                     | Land and Wilderness             |
| P06  | Herd Keeper                                | Land and Wilderness             |
| P07  | Animal Trainer and Falconer                | Land and Wilderness             |
| P08  | Driver and Teamster                        | Travel, Transport and Seafaring |
| P09  | Sailor and Boat Worker                     | Travel, Transport and Seafaring |
| P10  | Navigator and Pilot                        | Travel, Transport and Seafaring |
| P11  | Shipmaster                                 | Travel, Transport and Seafaring |
| P12  | Courier and Messenger                      | Travel, Transport and Seafaring |
| P13  | Trader and Merchant                        | Trade and Money                 |
| P14  | Guard, Watcher and Escort                  | Guarding and Arms Training      |
| P15  | Enforcer                                   | Guarding and Arms Training      |
| P16  | Local Informant                            | Covert and Illicit Work         |
| P17  | Investigator and Intelligence Agent        | Covert and Illicit Work         |
| P18  | Thief                                      | Covert and Illicit Work         |
| P19  | Confidence Trickster                       | Covert and Illicit Work         |
| P20  | Smuggler and Illicit Trader                | Covert and Illicit Work         |
| P21  | Document Forger                            | Covert and Illicit Work         |
| P22  | Soldier                                    | Military Service                |
| P23  | Mounted Soldier and Lancer                 | Military Service                |
| P24  | Military Scout                             | Military Service                |
| P25  | Military Commander                         | Military Service                |
| P26  | Military Quartermaster                     | Military Service                |
| P27  | Campaign Planner                           | Military Service                |
| P28  | Siege Engineer                             | Military Service                |
| P29  | Siege Engine Crew Specialist               | Military Service                |
| P30  | Physician                                  | Healing and Care                |
| P31  | Surgeon                                    | Healing and Care                |
| P32  | Nurse and Patient Attendant                | Healing and Care                |
| P33  | Birth Attendant and Midwife                | Healing and Care                |
| P34  | Veterinary Practitioner                    | Healing and Care                |
| P35  | Herbalist and Remedy Maker                 | Healing and Care                |
| P36  | Smith and Weaponsmith                      | Metal and Mechanism Crafts      |
| P37  | Smelter                                    | Metal and Mechanism Crafts      |
| P38  | Armorer                                    | Metal and Mechanism Crafts      |
| P39  | Carpenter                                  | Building and Extraction         |
| P40  | Shipbuilder                                | Building and Extraction         |
| P41  | Sailmaker                                  | Textile, Leather and Pottery    |
| P42  | Spinner and Weaver                         | Textile, Leather and Pottery    |
| P43  | Tailor                                     | Textile, Leather and Pottery    |
| P44  | Leatherworker                              | Textile, Leather and Pottery    |
| P45  | Potter                                     | Textile, Leather and Pottery    |
| P46  | Mason                                      | Building and Extraction         |
| P47  | Miner and Quarry Worker                    | Building and Extraction         |
| P48  | Millwright and Mechanician                 | Building and Extraction         |
| P49  | Building Designer                          | Building and Extraction         |
| P50  | Surveyor and Mapmaker                      | Learning and Inquiry            |
| P51  | Locksmith                                  | Metal and Mechanism Crafts      |
| P52  | Trapmaker                                  | Metal and Mechanism Crafts      |
| P53  | Cook                                       | Food and Drink                  |
| P54  | Brewer                                     | Food and Drink                  |
| P55  | Vintner                                    | Food and Drink                  |
| P56  | Distiller                                  | Food and Drink                  |
| P57  | Alchemist                                  | Learning and Inquiry            |
| P58  | Clerk and Steward                          | Trade and Money                 |
| P59  | Legal Practitioner and Advocate            | Law, Office and Diplomacy       |
| P60  | Envoy                                      | Law, Office and Diplomacy       |
| P61  | Mediator and Community Convenor            | Law, Office and Diplomacy       |
| P62  | Banker and Credit Practitioner             | Trade and Money                 |
| P63  | Political Agent and Council Representative | Law, Office and Diplomacy       |
| P64  | Teacher                                    | Letters and Teaching            |
| P65  | Scribe and Copyist                         | Letters and Teaching            |
| P66  | Translator and Interpreter                 | Letters and Teaching            |
| P67  | Historian and Genealogist                  | Learning and Inquiry            |
| P68  | Mathematical Practitioner                  | Learning and Inquiry            |
| P69  | Philosopher                                | Learning and Inquiry            |
| P70  | Astronomer                                 | Learning and Inquiry            |
| P71  | Astrologer                                 | Religion and Divination         |
| P72  | Naturalist                                 | Learning and Inquiry            |
| P73  | Geographer                                 | Learning and Inquiry            |
| P74  | Religious Practitioner                     | Religion and Divination         |
| P75  | Diviner                                    | Religion and Divination         |
| P76  | Herald                                     | Law, Office and Diplomacy       |
| P77  | Musician and Singer                        | Performance and Display         |
| P78  | Actor and Dancer                           | Performance and Display         |
| P79  | Visual Artist and Sculptor                 | Performance and Display         |
| P80  | Storyteller and Poet                       | Performance and Display         |
| P81  | Athlete and Physical Performer             | Performance and Display         |
| P82  | Weapon Instructor                          | Guarding and Arms Training      |
| P83  | Gambler                                    | Trade and Money                 |
| P84  | Diver and Water Worker                     | Travel, Transport and Seafaring |

<a id="ambiguous-cases"></a>

## 4. Ambiguous cases

Every placement below was genuinely contested. Each names the candidate
categories, the choice made, and the reason. A reviewer who disagrees with any
of these can move it without disturbing the rest of the roster.

| Code | Profession                          | Candidates                                                                       | Chosen                          | Reasoning                                                                                                                                                                                                |
| ---- | ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P03  | Field and Caravan Guide             | Travel, Transport and Seafaring / Land and Wilderness                            | Travel, Transport and Seafaring | The wilderness competence is the method, but the deliverable is getting travellers to a destination, which is what a reader browsing for a guide is after.                                               |
| P84  | Diver and Water Worker              | Travel, Transport and Seafaring / Building and Extraction                        | Travel, Transport and Seafaring | It is working water rather than raising a structure, and it sits with the vessel and harbour trades a reader would look through; Building and Extraction is defensible if salvage is read as extraction. |
| P58  | Clerk and Steward                   | Trade and Money / Law, Office and Diplomacy                                      | Trade and Money                 | The accepted boundary separates the clerk's accounts from office authority and Law, so reckoning is the occupation and the office is not.                                                                |
| P83  | Gambler                             | Trade and Money / Performance and Display                                        | Trade and Money                 | The livelihood is made by judging stakes and odds, not by being watched; a reader looking for a stakes-and-reckoning occupation finds it beside the trader and the banker.                               |
| P76  | Herald                              | Law, Office and Diplomacy / Performance and Display                              | Law, Office and Diplomacy       | Formal proclamation is public but the role is entrusted, formal communication on behalf of a principal, which is the diplomatic category's scope.                                                        |
| P15  | Enforcer                            | Guarding and Arms Training / Covert and Illicit Work                             | Guarding and Arms Training      | The method is open physical pressure on behalf of a named principal, not concealment; legality varies but the occupation is not covert.                                                                  |
| P82  | Weapon Instructor                   | Guarding and Arms Training / Military Service / Letters and Teaching             | Guarding and Arms Training      | An instructor teaches a fighting curriculum without belonging to a force, so the martial trade governs; Letters and Teaching would place the subject matter out of reach of a browsing reader.           |
| P26  | Military Quartermaster              | Military Service / Trade and Money                                               | Military Service                | Buying and moving supplies is the activity, but the accepted boundary states it does not teach Trade, and the role exists only inside a force.                                                           |
| P28  | Siege Engineer                      | Military Service / Building and Extraction                                       | Military Service                | The technical works are designed for attacking or defending a fortified place, which is a military purpose, not a construction livelihood.                                                               |
| P29  | Siege Engine Crew Specialist        | Military Service / Metal and Mechanism Crafts                                    | Military Service                | The specialist operates the engine with its crew in the field; making and designing engines is a separate occupation.                                                                                    |
| P17  | Investigator and Intelligence Agent | Covert and Illicit Work / Law, Office and Diplomacy                              | Covert and Illicit Work         | This is the hardest placement here: the work is often lawful, but the accepted prose grants no legal authority and no Law, and the method is discreet evidence-gathering and questioning.                |
| P20  | Smuggler and Illicit Trader         | Covert and Illicit Work / Trade and Money                                        | Covert and Illicit Work         | It is trade, but the defining competence is evading a restriction or controller, which is the covert category's scope.                                                                                   |
| P35  | Herbalist and Remedy Maker          | Healing and Care / Land and Wilderness / Food and Drink                          | Healing and Care                | The output is usable medicine; identifying plant material is shared with the gatherer, but the remedy maker is sought as a healer.                                                                       |
| P34  | Veterinary Practitioner             | Healing and Care / Land and Wilderness                                           | Healing and Care                | Clinical investigation and treatment is the occupation; the accepted boundary separates it from husbandry and handling.                                                                                  |
| P51  | Locksmith                           | Metal and Mechanism Crafts / Covert and Illicit Work                             | Metal and Mechanism Crafts      | The locksmith builds and repairs; the accepted boundary states Locksmithing does not provide Lockpicking, so the covert reading is wrong.                                                                |
| P52  | Trapmaker                           | Metal and Mechanism Crafts / Covert and Illicit Work                             | Metal and Mechanism Crafts      | Same reasoning: designing and servicing constructed traps is fabrication, and Trapping and Trapmaking are separate.                                                                                      |
| P38  | Armorer                             | Metal and Mechanism Crafts / Textile, Leather and Pottery                        | Metal and Mechanism Crafts      | Armour traditions include leather, but a reader looks for the armourer beside the smith; the material tradition varies within the one occupation.                                                        |
| P48  | Millwright and Mechanician          | Building and Extraction / Metal and Mechanism Crafts                             | Building and Extraction         | The mechanisms are timber and built in place; the accepted boundary excludes Smithing.                                                                                                                   |
| P40  | Shipbuilder                         | Building and Extraction / Travel, Transport and Seafaring                        | Building and Extraction         | Constructing a complete working structure is the occupation, and the accepted boundary states it grants no Seamanship or navigation.                                                                     |
| P41  | Sailmaker                           | Textile, Leather and Pottery / Travel, Transport and Seafaring                   | Textile, Leather and Pottery    | It is cut-and-sewn fabric work; the accepted boundary separates it from Seamanship, Tailoring, and Weaving alike.                                                                                        |
| P45  | Potter                              | Textile, Leather and Pottery / Building and Extraction / Performance and Display | Textile, Leather and Pottery    | Forming a plastic material into household goods is the shared character of that category; the accepted boundary states not every potter is a sculptor.                                                   |
| P50  | Surveyor and Mapmaker               | Learning and Inquiry / Building and Extraction                                   | Learning and Inquiry            | The product is a usable map — a knowledge artefact — and the accepted boundary separates it from Architecture; site measurement for construction is the defensible alternative reading.                  |
| P57  | Alchemist                           | Learning and Inquiry / Food and Drink / Healing and Care                         | Learning and Inquiry            | Investigating and transforming materials within a learned tradition is inquiry; the accepted boundary supplies no Pharmacy and no distillation expertise.                                                |
| P71  | Astrologer                          | Religion and Divination / Learning and Inquiry                                   | Religion and Divination         | Interpretation according to a defined tradition is the method, and the accepted boundary states no automatic Astronomy — the astronomer and the astrologer are deliberately separated.                   |
| P79  | Visual Artist and Sculptor          | Performance and Display / Textile, Leather and Pottery                           | Performance and Display         | The purpose is to communicate a chosen appearance or meaning to a viewer, which places it with the other audience-facing occupations rather than with household manufacture.                             |
| P80  | Storyteller and Poet                | Performance and Display / Letters and Teaching                                   | Performance and Display         | The accepted prose has the work composed _and presented_ for an audience; the accepted boundary separates it from History.                                                                               |

## 5. Assessment

In the author's judgement the taxonomy is genuinely narrowing. Picking one
category reduces 84 families to between three and eight, which a reader can
scan in one view, and sixteen categories is the same order as the seventeen
existing player-facing Skill categories, so the chooser gains no new kind of
complexity. The two largest categories are large because the underlying content
is genuinely dense there — Glantri carries eight distinct military roles and
eight distinct scholarly ones — and both remain readable lists.

The weakest points are the three categories of three. **Guarding and Arms
Training**, **Letters and Teaching**, and **Religion and Divination** are each
small enough that a reviewer might prefer to fold them into **Military
Service**, **Learning and Inquiry**, and **Learning and Inquiry**
respectively. That would give thirteen categories with a largest size of eleven.
The roster above keeps them separate because a reader distinguishes a town guard
from a soldier, a scribe from a philosopher, and a priest from an astronomer,
and because a maximum category size of eight narrows better than eleven. Either
shape is coherent; the choice is the Product Owner's.

**Correction, recorded at Product Owner ruling (2026-09-27).** The figure
above — "thirteen categories with a largest size of eleven" — is wrong. Two
categories fold into Learning and Inquiry, not one: **Letters and Teaching**
(3) and **Religion and Divination** (3) both move there, on top of its
existing 8, giving 8 + 3 + 3 = **14**, not 11. **Military Service** alone
receives **Guarding and Arms Training**, becoming 8 + 3 = 11. The corrected
13-category distribution is 14, 11, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4.

### Product Owner ruling — 2026-09-27

**Approved: the 16-category taxonomy above, exactly as authored in §§1-4.**
**Rejected: the fold to 13 categories considered in this section.** Grounds:

- The corrected arithmetic gives a largest category of 14 (Learning and
  Inquiry: 8 + 3 + 3), not the 11 this section originally stated — a 14-item
  list is close to twice the maximum of 8 that the 16-category roster
  achieves, which materially weakens the case for folding rather than
  supporting it.
- 8 of the 9 moved Professions conflict with the receiving category's own
  stated "Does not belong here" boundary:
  - Into **Military Service** (excludes "Civil guarding"): P14 Guard, Watcher
    and Escort; P15 Enforcer; P82 Weapon Instructor.
  - Into **Learning and Inquiry** (excludes "Teaching it to others"): P64
    Teacher; P65 Scribe and Copyist; P66 Translator and Interpreter.
  - Into **Learning and Inquiry** (excludes "religious or divinatory
    interpretation"): P74 Religious Practitioner; P75 Diviner.
  - Only **P71 Astrologer** (Religion and Divination → Learning and Inquiry)
    moves cleanly — it also resolves an existing §4 ambiguous case rather than
    creating a new conflict. One clean move is not sufficient reason to
    distort the taxonomy.

This ruling does not re-author any category name, scope statement, or family
placement. The roster in §§1-4 stands exactly as authored, now as approved
content. See [rule decision
0012](../../decisions/rules/0012-profession-browsing-taxonomy-approval.md)
for the complete record.

## 6. Verification performed

The mapping was checked by script against
`docs/product/proposals/competency-content-v2/competency-content-v2.json`:
all 84 canonical family `code` values are present exactly once, no code is
duplicated across categories, and no code appears that is not canonical.
Profession `code`, `id`, and `name` values in the mapping table are taken
verbatim from that file.
