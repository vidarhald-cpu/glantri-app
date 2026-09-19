# Profession → Learning Group → Skill reference

This reference expands the approved 84 Profession families through their 59 Learning Groups into the actual 131 base Skills. It preserves all routes when several Learning Groups lead to the same Skill. Specializations are shown separately and never counted as base Skills.

**Possible Skill reach** is the family-wide union of every valid alternative. **Effective package breadth** is calculated separately for each valid single-Character path: one explicit track where tracks exist, and one side of each mutually exclusive Learning Group pair. The possible-reach union must never be read as one Character package.

Profession and Learning Group access creates training opportunities; it grants no competency automatically. The Product Owner's current authoring target is approximately 10 effective base Skills for an ordinary Profession. This is a review target rather than a quota: Society Levels 1–2 may legitimately be narrower, specialist Professions may be coherent below it, and no rigid Society-Level thresholds are approved.

All routes below are part of the general, unbound reference. Their Setting, Society Level, Social Band, Arch-Society, institution, equipment, and other contextual availability remains unresolved unless separately stated. A Specialization route never waives immediate-parent eligibility.

The [machine-readable equivalent](./profession-learning-group-skills.json) preserves stable identities, every route, track scope, source lines, overlaps, and diagnostics. See also the [Profession catalogue](./professions.md), [Learning Groups](./learning-groups.md), [Skills](./skills.md), and [availability gaps](./gaps-and-exceptions.md).

## Breadth summary

The 84 families produce 99 valid single-Character paths after separating explicit tracks and mutually exclusive routes. Effective path breadth ranges from 0 to 17 base Skills, with median 3. 7 families have at least one path at or above the approximate 10-Skill authoring target; 4 have every path at or above it; 77 have every current path below it. These counts trigger content review but do not by themselves prove a defect.

Possible-reach family unions range from 0 to 18 base Skills, with median 2. The difference between union reach and effective path breadth is material for track-bearing military Professions and the two explicit exclusive-pair families.

## Choice-slot reconciliation

The current legacy-compatibility catalogue defines seven required choice-slot Learning Groups. A slot contributes only the selected candidates: unselected candidates are possible reach, not fixed membership and not part of one Character's effective breadth. The approved 59-group target catalogue contains no choice-slot field, explicitly defines exact membership with no optional or hidden choices, and the target runtime projection creates all 59 groups from fixed member lists. Consequently, none of these seven slot structures is represented in the target catalogue or in its Profession paths. The target catalogue's exact fixed curricula are approved, but the source does not record a separate decision reconciling the displaced general choice routes.

| Canonical group           | Fixed base Skills                                                                               | Required choice | Candidate pool                                                                                                                        | Target-catalogue result                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic Melee Training      | Dodge<br>Parry<br>Brawling                                                                      | Choose 1        | 1-h edged<br>1-h conc./axe<br>Polearms<br>Lance<br>2-h edged<br>2-h conc./axe                                                         | Slot omitted.<br>1-h edged: G08, F30, F31, F32, F36<br>1-h conc./axe: F35, F36<br>Polearms: F31<br>Lance: F32<br>2-h edged: F37<br>2-h conc./axe: F37                                                                                                                                                                                                                      |
| Advanced Melee Training   | Dodge<br>Parry<br>Brawling                                                                      | Choose 3        | 1-h edged<br>1-h conc./axe<br>Polearms<br>Lance<br>2-h edged<br>2-h conc./axe                                                         | Slot omitted.<br>1-h edged: G08, F30, F31, F32, F36<br>1-h conc./axe: F35, F36<br>Polearms: F31<br>Lance: F32<br>2-h edged: F37<br>2-h conc./axe: F37                                                                                                                                                                                                                      |
| Basic Missile Training    | Perception<br>Concentration<br>Weapon Maintenance                                               | Choose 1        | Throwing<br>Sling<br>Bow<br>Crossbow                                                                                                  | Slot omitted.<br>Throwing: F31<br>Sling: groupless<br>Bow: F38, F41<br>Crossbow: F39                                                                                                                                                                                                                                                                                       |
| Advanced Missile Training | Perception<br>Concentration<br>Weapon Maintenance<br>Battlefield Awareness<br>Combat Experience | Choose 3        | Throwing<br>Sling<br>Bow<br>Crossbow                                                                                                  | Slot omitted.<br>Throwing: F31<br>Sling: groupless<br>Bow: F38, F41<br>Crossbow: F39                                                                                                                                                                                                                                                                                       |
| Craft Specialty           | None                                                                                            | Choose 1        | Pottery<br>Weaving<br>Leatherworking<br>Carpentry<br>Tailoring<br>Baking<br>Brewing<br>Stoneworking<br>Smithing<br>Weapon Maintenance | Slot omitted.<br>Pottery: F21<br>Weaving: F02<br>Leatherworking: groupless<br>Carpentry: F03, F27<br>Tailoring: groupless<br>Baking → Baking (provenance only): groupless<br>Brewing → Brewing (provenance only): groupless<br>Stoneworking → Masonry (provenance only): groupless<br>Smithing → Smithing (provenance only): G13, F24, F25, F26<br>Weapon Maintenance: F25 |
| Advanced Craft Specialty  | None                                                                                            | Choose 1        | Pottery<br>Weaving<br>Leatherworking<br>Carpentry<br>Tailoring<br>Baking<br>Brewing<br>Stoneworking<br>Smithing<br>Weapon Maintenance | Slot omitted.<br>Pottery: F21<br>Weaving: F02<br>Leatherworking: groupless<br>Carpentry: F03, F27<br>Tailoring: groupless<br>Baking → Baking (provenance only): groupless<br>Brewing → Brewing (provenance only): groupless<br>Stoneworking → Masonry (provenance only): groupless<br>Smithing → Smithing (provenance only): G13, F24, F25, F26<br>Weapon Maintenance: F25 |
| Construction Specialty    | None                                                                                            | Choose 2        | Stoneworking<br>Carpentry<br>Smithing<br>Mechanics                                                                                    | Slot omitted.<br>Stoneworking → Masonry (provenance only): groupless<br>Carpentry: F03, F27<br>Smithing → Smithing (provenance only): G13, F24, F25, F26<br>Mechanics: F27                                                                                                                                                                                                 |

Every observed executable group has exactly one slot and every observed slot is required. The schema supports multiple slots and `required: false`, but neither occurs in current data. A fixed member marked with relevance `optional` is still a fixed member; relevance metadata does not turn it into a selectable candidate. Runtime resolution filters unknown candidates, deduplicates selections, caps them at `chooseCount`, and blocks finalization when a required slot lacks enough valid distinct choices.

One implementation inconsistency remains outside this documentation task: the preliminary cost check counts stored candidate IDs before deduplication, while finalization requires distinct normalized choices. The reference therefore uses distinct candidates as the controlling valid-path interpretation.

The live code therefore contains two different states: the current legacy-compatibility catalogue still carries these seven executable slot definitions, while the approved target projection used for the 59-group/84-Profession Chargen model replaces the Skill Group roster with fixed-member target groups. This report treats the slot definitions as recovered canonical evidence and the missing target translation as an unresolved structural discontinuity for Product Owner review, not as a broken target foreign key.

Evidence: [default canonical content](../../../packages/content/src/data/canonicalContent.json), [seed slot definitions](../../../packages/content/scripts/generateRepoLocalGlantriSeed.mjs), [target Learning Group contract](../../../packages/shared/src/contracts/adminContent.ts), [target-group parser](../../../packages/content/src/skillContentPlatform/targetLearningGroups.ts), and the recovered [training-group import](../../../data/import/glantri_content_pack_full_2026-03-30_norm7/training_groups.csv).

### Source and data inconsistencies retained

- **Advanced Melee Training:** recovered import says “choose two related melee attack skills”; current canonical content says “choose three melee weapon skills”. current executable canonical content and regression tests use choose 3; older import retained as conflicting provenance.
- **Advanced Missile Training:** recovered import says “choose one main missile skill and one secondary missile or fallback skill”; current canonical content says “choose three missile weapon skills”. current executable canonical content and regression tests use choose 3; older import retained as conflicting provenance.
- **Advanced Craft Specialty:** recovered import says “no row in recovered training_groups.csv”; current canonical content says “choose one craft specialty”. commit a6e1d5be deliberately changed choose 2 to choose 1 and updated tests; the current group description still incorrectly says two chosen specialties.
- **Field Soldiering:** recovered import says “Choose one attack skill in addition to Dodge, Perception, and Battlefield Awareness.” The candidate set is not specified in the recovered import; descriptive wording implies a choice, but the import has no structured required flag. no selection slot was materialized; commit 626cd8fe later retired/merged Field Soldiering, and it is not one of the 59 target Learning Groups.

### `2-h edged` regression result

`2-h edged` remains a candidate in Basic Melee Training (choose 1) and Advanced Melee Training (choose 3) in the current legacy-compatibility catalogue. In the approved 59-group target catalogue it appears only in **F37 — Two-handed military weapon practice**, where it is a fixed member alongside `2-h conc./axe`, Dodge, Parry, and Brawling. F37 is currently exposed only through P22 Soldier's **Two-handed detachment without formation duties** and **Two-handed detachment with one-handed sidearms and formation duties** tracks. The general basic/advanced melee choice route was not carried into the target catalogue, and no one-to-one legacy-to-target group crosswalk was approved. This report preserves that structural discontinuity for review instead of flattening the candidate pool.

## All-Profession comparison

| Profession                                                                                               | Learning Groups                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | # Learning Groups | Direct Skills                              | Possible Skill reach                                                                                                                                                                                                                                                        | # possible | Effective package breadth  |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------: | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | -------------------------- |
| [Actor and Dancer](#profession-map-actor-and-dancer)                                                     | [Dramatic acting and dance practice](./learning-groups.md#group-f18)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 1 | Acting<br>Dance                            | Acting<br>Dance                                                                                                                                                                                                                                                             |          2 | 2 across 1 valid path      |
| [Alchemist](#profession-map-alchemist)                                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Alchemy                                    | Alchemy                                                                                                                                                                                                                                                                     |          1 | 1 across 1 valid path      |
| [Animal Trainer and Falconer](#profession-map-animal-trainer-and-falconer)                               | [Falconry apprenticeship](./learning-groups.md#group-f07)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                 1 | Animal Handling                            | Animal Handling<br>Hunting                                                                                                                                                                                                                                                  |          2 | 2 across 1 valid path      |
| [Armorer](#profession-map-armorer)                                                                       | [Forged-metal armor workshop](./learning-groups.md#group-f26)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                 1 | Armoring                                   | Armoring<br>Smithing                                                                                                                                                                                                                                                        |          2 | 2 across 1 valid path      |
| [Astrologer](#profession-map-astrologer)                                                                 | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Astrology                                  | Astrology                                                                                                                                                                                                                                                                   |          1 | 1 across 1 valid path      |
| [Astronomer](#profession-map-astronomer)                                                                 | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Astronomy                                  | Astronomy                                                                                                                                                                                                                                                                   |          1 | 1 across 1 valid path      |
| [Athlete and Physical Performer](#profession-map-athlete-and-physical-performer)                         | [Running and athletic field practice](./learning-groups.md#group-f04)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                 1 | None                                       | Athletics<br>Running                                                                                                                                                                                                                                                        |          2 | 2 across 1 valid path      |
| [Banker and Credit Practitioner](#profession-map-banker-and-credit-practitioner)                         | [Credit-house accounts and obligations](./learning-groups.md#group-f12)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                 1 | None                                       | Banking & Credit<br>Bookkeeping                                                                                                                                                                                                                                             |          2 | 2 across 1 valid path      |
| [Birth Attendant and Midwife](#profession-map-birth-attendant-and-midwife)                               | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | None                                       | None                                                                                                                                                                                                                                                                        |          0 | 0 across 1 valid path      |
| [Brewer](#profession-map-brewer)                                                                         | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Brewing                                    | Brewing                                                                                                                                                                                                                                                                     |          1 | 1 across 1 valid path      |
| [Building Designer](#profession-map-building-designer)                                                   | [Building design and site surveying](./learning-groups.md#group-f28)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 1 | None                                       | Architecture<br>Surveying                                                                                                                                                                                                                                                   |          2 | 2 across 1 valid path      |
| [Campaign Planner](#profession-map-campaign-planner)                                                     | [Unit coordination and command practice](./learning-groups.md#group-g09)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                 1 | Campaign Strategy                          | Battle Tactics<br>Campaign Strategy<br>Leadership<br>Military Command                                                                                                                                                                                                       |          4 | 4 across 1 valid path      |
| [Carpenter](#profession-map-carpenter)                                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Carpentry                                  | Carpentry                                                                                                                                                                                                                                                                   |          1 | 1 across 1 valid path      |
| [Clerk and Steward](#profession-map-clerk-and-steward)                                                   | [Records-office practice](./learning-groups.md#group-g11)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                 1 | None                                       | Administration<br>Bookkeeping                                                                                                                                                                                                                                               |          2 | 2 across 1 valid path      |
| [Confidence Trickster](#profession-map-confidence-trickster)                                             | [Impersonation and distraction practice](./learning-groups.md#group-g16)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                 1 | None                                       | Deception<br>Disguise                                                                                                                                                                                                                                                       |          2 | 2 across 1 valid path      |
| [Cook](#profession-map-cook)                                                                             | [Seasonal kitchen and preservation practice](./learning-groups.md#group-f22)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |                 1 | Cooking                                    | Cooking                                                                                                                                                                                                                                                                     |          1 | 1 across 1 valid path      |
| [Courier and Messenger](#profession-map-courier-and-messenger)                                           | [Running and athletic field practice](./learning-groups.md#group-f04)<br>[Mounted travel and animal care](./learning-groups.md#group-g05)<br>[Field travel and camp practice](./learning-groups.md#group-g04)                                                                                                                                                                                                                                                                                                                            |                 3 | None                                       | Animal Handling<br>Athletics<br>Riding<br>Running<br>Survival<br>Wayfinding<br>Weather Lore                                                                                                                                                                                 |          7 | 7 across 1 valid path      |
| [Distiller](#profession-map-distiller)                                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Distilling                                 | Distilling                                                                                                                                                                                                                                                                  |          1 | 1 across 1 valid path      |
| [Diver and Water Worker](#profession-map-diver-and-water-worker)                                         | [Working a boat](./learning-groups.md#group-g06)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | Swimming                                   | Seamanship<br>Swimming                                                                                                                                                                                                                                                      |          2 | 2 across 1 valid path      |
| [Diviner](#profession-map-diviner)                                                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Divination                                 | Divination                                                                                                                                                                                                                                                                  |          1 | 1 across 1 valid path      |
| [Document Forger](#profession-map-document-forger)                                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Document & Credential Forgery              | Document & Credential Forgery                                                                                                                                                                                                                                               |          1 | 1 across 1 valid path      |
| [Driver and Teamster](#profession-map-driver-and-teamster)                                               | [Draught-team and vehicle practice](./learning-groups.md#group-f06)<br>[Field travel and camp practice](./learning-groups.md#group-g04)                                                                                                                                                                                                                                                                                                                                                                                                  |                 2 | None                                       | Animal Handling<br>Cart Driving<br>Survival<br>Wayfinding<br>Weather Lore                                                                                                                                                                                                   |          5 | 5 across 1 valid path      |
| [Enforcer](#profession-map-enforcer)                                                                     | [Guard and rough-fighting drill](./learning-groups.md#group-f35)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | Intimidation<br>Underworld                 | 1-h conc./axe<br>Brawling<br>Dodge<br>Intimidation<br>Parry<br>Underworld                                                                                                                                                                                                   |          6 | 6 across 1 valid path      |
| [Envoy](#profession-map-envoy)                                                                           | [Council and mediation practice](./learning-groups.md#group-g10)<br>[Mounted travel and animal care](./learning-groups.md#group-g05)                                                                                                                                                                                                                                                                                                                                                                                                     |                 2 | None                                       | Animal Handling<br>Bargaining<br>Customs<br>Insight<br>Oratory<br>Riding                                                                                                                                                                                                    |          6 | 6 across 1 valid path      |
| [Farmer](#profession-map-farmer)                                                                         | [Mixed crop-and-stock household practice](./learning-groups.md#group-f08)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                 1 | Farming                                    | Animal Husbandry<br>Farming                                                                                                                                                                                                                                                 |          2 | 2 across 1 valid path      |
| [Field and Caravan Guide](#profession-map-field-and-caravan-guide)                                       | [Field travel and camp practice](./learning-groups.md#group-g04)<br>[Mounted travel and animal care](./learning-groups.md#group-g05)<br>[Draught-team and vehicle practice](./learning-groups.md#group-f06)<br>[One-handed edged close-combat practice](./learning-groups.md#group-g08)                                                                                                                                                                                                                                                  |                 4 | None                                       | 1-h edged<br>Animal Handling<br>Cart Driving<br>Dodge<br>Parry<br>Riding<br>Survival<br>Wayfinding<br>Weather Lore                                                                                                                                                          |          9 | 9 across 1 valid path      |
| [Fisher](#profession-map-fisher)                                                                         | [Fishing-boat apprenticeship](./learning-groups.md#group-f10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                 1 | Fishing                                    | Fishing<br>Seamanship                                                                                                                                                                                                                                                       |          2 | 2 across 1 valid path      |
| [Gambler](#profession-map-gambler)                                                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Gambling                                   | Gambling                                                                                                                                                                                                                                                                    |          1 | 1 across 1 valid path      |
| [Geographer](#profession-map-geographer)                                                                 | [Field surveying and map production](./learning-groups.md#group-f01)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 1 | Geography                                  | Cartography<br>Geography<br>Surveying                                                                                                                                                                                                                                       |          3 | 3 across 1 valid path      |
| [Guard, Watcher and Escort](#profession-map-guard-watcher-and-escort)                                    | [Guard and rough-fighting drill](./learning-groups.md#group-f35)<br>[One-handed edged close-combat practice](./learning-groups.md#group-g08)<br>[Field travel and camp practice](./learning-groups.md#group-g04)<br>[Swashbuckling fencing instruction](./learning-groups.md#group-f30)                                                                                                                                                                                                                                                  |                 4 | None                                       | 1-h conc./axe<br>1-h edged<br>Brawling<br>Dodge<br>Parry<br>Survival<br>Wayfinding<br>Weather Lore                                                                                                                                                                          |          8 | 8 across 2 valid paths     |
| [Herald](#profession-map-herald)                                                                         | [Speech and memory practice](./learning-groups.md#group-f14)<br>[Lineage investigation apprenticeship](./learning-groups.md#group-f16)                                                                                                                                                                                                                                                                                                                                                                                                   |                 2 | Heraldry                                   | Heraldry<br>Mnemonics<br>Oratory<br>Research                                                                                                                                                                                                                                |          4 | 4 across 1 valid path      |
| [Herbalist and Remedy Maker](#profession-map-herbalist-and-remedy-maker)                                 | [Plant and remedy preparation](./learning-groups.md#group-g02)<br>[Distilling remedy workshop](./learning-groups.md#group-f23)                                                                                                                                                                                                                                                                                                                                                                                                           |                 2 | None                                       | Distilling<br>Pharmacy<br>Plant Lore                                                                                                                                                                                                                                        |          3 | 3 across 1 valid path      |
| [Herd Keeper](#profession-map-herd-keeper)                                                               | [Pastoral stockkeeping apprenticeship](./learning-groups.md#group-f05)<br>[Mounted travel and animal care](./learning-groups.md#group-g05)                                                                                                                                                                                                                                                                                                                                                                                               |                 2 | Sling                                      | Animal Handling<br>Animal Husbandry<br>Herding<br>Riding<br>Sling                                                                                                                                                                                                           |          5 | 5 across 1 valid path      |
| [Historian and Genealogist](#profession-map-historian-and-genealogist)                                   | [Historical text investigation](./learning-groups.md#group-f15)<br>[Lineage investigation apprenticeship](./learning-groups.md#group-f16)                                                                                                                                                                                                                                                                                                                                                                                                |                 2 | History                                    | History<br>Palaeography & Decipherment<br>Research                                                                                                                                                                                                                          |          3 | 3 across 1 valid path      |
| [Hunter and Trapper](#profession-map-hunter-and-trapper)                                                 | [Tracking and hunting practice](./learning-groups.md#group-g03)<br>[Trapline and trail practice](./learning-groups.md#group-f34)<br>[Field travel and camp practice](./learning-groups.md#group-g04)<br>[Longbow hunting apprenticeship](./learning-groups.md#group-f41)                                                                                                                                                                                                                                                                 |                 4 | Bow                                        | Bow<br>Hunting<br>Perception<br>Stealth<br>Survival<br>Tracking<br>Trapping<br>Wayfinding<br>Weather Lore                                                                                                                                                                   |          9 | 9 across 1 valid path      |
| [Investigator and Intelligence Agent](#profession-map-investigator-and-intelligence-agent)               | [Interview and evidence practice](./learning-groups.md#group-g17)<br>[Local contacts and information gathering](./learning-groups.md#group-g14)<br>[Impersonation and distraction practice](./learning-groups.md#group-g16)                                                                                                                                                                                                                                                                                                              |                 3 | None                                       | Deception<br>Disguise<br>Insight<br>Interrogation<br>Perception<br>Research<br>Streetwise                                                                                                                                                                                   |          7 | 7 across 1 valid path      |
| [Leatherworker](#profession-map-leatherworker)                                                           | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Leatherwork                                | Leatherwork                                                                                                                                                                                                                                                                 |          1 | 1 across 1 valid path      |
| [Legal Practitioner and Advocate](#profession-map-legal-practitioner-and-advocate)                       | [Legal study and pleading practice](./learning-groups.md#group-f13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                 1 | Law                                        | Law<br>Oratory                                                                                                                                                                                                                                                              |          2 | 2 across 1 valid path      |
| [Local Informant](#profession-map-local-informant)                                                       | [Local contacts and information gathering](./learning-groups.md#group-g14)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                 1 | Underworld                                 | Insight<br>Streetwise<br>Underworld                                                                                                                                                                                                                                         |          3 | 3 across 1 valid path      |
| [Locksmith](#profession-map-locksmith)                                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Locksmithing                               | Locksmithing                                                                                                                                                                                                                                                                |          1 | 1 across 1 valid path      |
| [Mason](#profession-map-mason)                                                                           | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Masonry                                    | Masonry                                                                                                                                                                                                                                                                     |          1 | 1 across 1 valid path      |
| [Mathematical Practitioner](#profession-map-mathematical-practitioner)                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Mathematics                                | Mathematics                                                                                                                                                                                                                                                                 |          1 | 1 across 1 valid path      |
| [Mediator and Community Convenor](#profession-map-mediator-and-community-convenor)                       | [Council and mediation practice](./learning-groups.md#group-g10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | None                                       | Bargaining<br>Customs<br>Insight<br>Oratory                                                                                                                                                                                                                                 |          4 | 4 across 1 valid path      |
| [Military Commander](#profession-map-military-commander)                                                 | [Unit coordination and command practice](./learning-groups.md#group-g09)<br>[One-handed arms and formation drill](./learning-groups.md#group-f36)<br>[Mounted travel and animal care](./learning-groups.md#group-g05)<br>[Mounted lance and troop drill](./learning-groups.md#group-f32)<br>[Guard and rough-fighting drill](./learning-groups.md#group-f35)                                                                                                                                                                             |                 5 | Battlefield Awareness                      | 1-h conc./axe<br>1-h edged<br>Animal Handling<br>Battle Tactics<br>Battlefield Awareness<br>Brawling<br>Dodge<br>Formation Fighting<br>Lance<br>Leadership<br>Military Command<br>Mounted Combat<br>Parry<br>Riding                                                         |         14 | 8–13 across 3 valid paths  |
| [Military Quartermaster](#profession-map-military-quartermaster)                                         | [Records-office practice](./learning-groups.md#group-g11)<br>[Draught-team and vehicle practice](./learning-groups.md#group-f06)<br>[One-handed arms and formation drill](./learning-groups.md#group-f36)                                                                                                                                                                                                                                                                                                                                |                 3 | Military Logistics                         | 1-h conc./axe<br>1-h edged<br>Administration<br>Animal Handling<br>Bookkeeping<br>Brawling<br>Cart Driving<br>Dodge<br>Formation Fighting<br>Military Logistics<br>Parry                                                                                                    |         11 | 5–11 across 2 valid paths  |
| [Military Scout](#profession-map-military-scout)                                                         | [Concealed field reconnaissance practice](./learning-groups.md#group-f33)<br>[Field travel and camp practice](./learning-groups.md#group-g04)<br>[One-handed arms and formation drill](./learning-groups.md#group-f36)<br>[Mounted travel and animal care](./learning-groups.md#group-g05)<br>[Mounted lance and troop drill](./learning-groups.md#group-f32)<br>[Guard and rough-fighting drill](./learning-groups.md#group-f35)                                                                                                        |                 6 | Battlefield Awareness                      | 1-h conc./axe<br>1-h edged<br>Animal Handling<br>Battlefield Awareness<br>Brawling<br>Camouflage<br>Dodge<br>Formation Fighting<br>Lance<br>Military Reconnaissance<br>Mounted Combat<br>Parry<br>Perception<br>Riding<br>Stealth<br>Survival<br>Wayfinding<br>Weather Lore |         18 | 12–17 across 3 valid paths |
| [Millwright and Mechanician](#profession-map-millwright-and-mechanician)                                 | [Timber millwright apprenticeship](./learning-groups.md#group-f27)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                 1 | None                                       | Carpentry<br>Mechanics                                                                                                                                                                                                                                                      |          2 | 2 across 1 valid path      |
| [Miner and Quarry Worker](#profession-map-miner-and-quarry-worker)                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Mining                                     | Mining                                                                                                                                                                                                                                                                      |          1 | 1 across 1 valid path      |
| [Mounted Soldier and Lancer](#profession-map-mounted-soldier-and-lancer)                                 | [Mounted travel and animal care](./learning-groups.md#group-g05)<br>[Mounted lance and troop drill](./learning-groups.md#group-f32)                                                                                                                                                                                                                                                                                                                                                                                                      |                 2 | Combat Experience<br>Battlefield Awareness | 1-h edged<br>Animal Handling<br>Battlefield Awareness<br>Brawling<br>Combat Experience<br>Dodge<br>Formation Fighting<br>Lance<br>Mounted Combat<br>Parry<br>Riding                                                                                                         |         11 | 11 across 1 valid path     |
| [Musician and Singer](#profession-map-musician-and-singer)                                               | [Self-accompanied song practice](./learning-groups.md#group-f17)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | Music<br>Singing                           | Music<br>Singing                                                                                                                                                                                                                                                            |          2 | 2 across 1 valid path      |
| [Naturalist](#profession-map-naturalist)                                                                 | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Animal Lore<br>Plant Lore                  | Animal Lore<br>Plant Lore                                                                                                                                                                                                                                                   |          2 | 2 across 1 valid path      |
| [Navigator and Pilot](#profession-map-navigator-and-pilot)                                               | [Passage navigation](./learning-groups.md#group-g07)<br>[Working a boat](./learning-groups.md#group-g06)<br>[Charted open-water navigation practice](./learning-groups.md#group-f11)                                                                                                                                                                                                                                                                                                                                                     |                 3 | None                                       | Celestial Navigation<br>Chart Navigation<br>Dead Reckoning<br>Pilotage<br>Seamanship<br>Wayfinding                                                                                                                                                                          |          6 | 6 across 1 valid path      |
| [Nurse and Patient Attendant](#profession-map-nurse-and-patient-attendant)                               | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Nursing                                    | Nursing                                                                                                                                                                                                                                                                     |          1 | 1 across 1 valid path      |
| [Philosopher](#profession-map-philosopher)                                                               | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Philosophy                                 | Philosophy                                                                                                                                                                                                                                                                  |          1 | 1 across 1 valid path      |
| [Physician](#profession-map-physician)                                                                   | [Patient care](./learning-groups.md#group-g01)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                 1 | None                                       | First Aid<br>Medicine<br>Nursing                                                                                                                                                                                                                                            |          3 | 3 across 1 valid path      |
| [Political Agent and Council Representative](#profession-map-political-agent-and-council-representative) | [Council and mediation practice](./learning-groups.md#group-g10)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | Politics                                   | Bargaining<br>Customs<br>Insight<br>Oratory<br>Politics                                                                                                                                                                                                                     |          5 | 5 across 1 valid path      |
| [Potter](#profession-map-potter)                                                                         | [Modelled ceramic workshop](./learning-groups.md#group-f21)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                 1 | Pottery                                    | Pottery<br>Sculpture                                                                                                                                                                                                                                                        |          2 | 2 across 1 valid path      |
| [Religious Practitioner](#profession-map-religious-practitioner)                                         | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Religion<br>Meditation                     | Meditation<br>Religion                                                                                                                                                                                                                                                      |          2 | 2 across 1 valid path      |
| [Sailmaker](#profession-map-sailmaker)                                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Sailmaking                                 | Sailmaking                                                                                                                                                                                                                                                                  |          1 | 1 across 1 valid path      |
| [Sailor and Boat Worker](#profession-map-sailor-and-boat-worker)                                         | [Working a boat](./learning-groups.md#group-g06)<br>[Rigged-vessel deck apprenticeship](./learning-groups.md#group-f09)<br>[One-handed edged close-combat practice](./learning-groups.md#group-g08)<br>[Guard and rough-fighting drill](./learning-groups.md#group-f35)                                                                                                                                                                                                                                                                  |                 4 | None                                       | 1-h conc./axe<br>1-h edged<br>Brawling<br>Dodge<br>Parry<br>Ropework<br>Seamanship                                                                                                                                                                                          |          7 | 6–7 across 2 valid paths   |
| [Scribe and Copyist](#profession-map-scribe-and-copyist)                                                 | [Records-office practice](./learning-groups.md#group-g11)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                 1 | None                                       | Administration<br>Bookkeeping                                                                                                                                                                                                                                               |          2 | 2 across 1 valid path      |
| [Shipbuilder](#profession-map-shipbuilder)                                                               | [Timber vessel construction](./learning-groups.md#group-f03)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |                 1 | None                                       | Carpentry<br>Shipbuilding                                                                                                                                                                                                                                                   |          2 | 2 across 1 valid path      |
| [Shipmaster](#profession-map-shipmaster)                                                                 | [Working a boat](./learning-groups.md#group-g06)<br>[Passage navigation](./learning-groups.md#group-g07)<br>[Trading practice](./learning-groups.md#group-g12)<br>[One-handed edged close-combat practice](./learning-groups.md#group-g08)                                                                                                                                                                                                                                                                                               |                 4 | Leadership                                 | 1-h edged<br>Appraisal<br>Bargaining<br>Dead Reckoning<br>Dodge<br>Leadership<br>Parry<br>Pilotage<br>Seamanship<br>Trade<br>Wayfinding                                                                                                                                     |         11 | 11 across 1 valid path     |
| [Siege Engine Crew Specialist](#profession-map-siege-engine-crew-specialist)                             | [Military crossbow and formation practice](./learning-groups.md#group-f39)<br>[One-handed arms and formation drill](./learning-groups.md#group-f36)                                                                                                                                                                                                                                                                                                                                                                                      |                 2 | Siege Engine Operation                     | 1-h conc./axe<br>1-h edged<br>Brawling<br>Crossbow<br>Dodge<br>Formation Fighting<br>Parry<br>Siege Engine Operation                                                                                                                                                        |          8 | 8 across 1 valid path      |
| [Siege Engineer](#profession-map-siege-engineer)                                                         | [Timber millwright apprenticeship](./learning-groups.md#group-f27)<br>[Building design and site surveying](./learning-groups.md#group-f28)                                                                                                                                                                                                                                                                                                                                                                                               |                 2 | Siege Engineering                          | Architecture<br>Carpentry<br>Mechanics<br>Siege Engineering<br>Surveying                                                                                                                                                                                                    |          5 | 5 across 1 valid path      |
| [Smelter](#profession-map-smelter)                                                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Smelting                                   | Smelting                                                                                                                                                                                                                                                                    |          1 | 1 across 1 valid path      |
| [Smith and Weaponsmith](#profession-map-smith-and-weaponsmith)                                           | [Metalworking apprenticeship](./learning-groups.md#group-g13)<br>[Ironmaking and forge apprenticeship](./learning-groups.md#group-f24)<br>[Weapon-forge and servicing apprenticeship](./learning-groups.md#group-f25)                                                                                                                                                                                                                                                                                                                    |                 3 | None                                       | Smelting<br>Smithing<br>Weapon Maintenance                                                                                                                                                                                                                                  |          3 | 3 across 1 valid path      |
| [Smuggler and Illicit Trader](#profession-map-smuggler-and-illicit-trader)                               | [Trading practice](./learning-groups.md#group-g12)<br>[Working a boat](./learning-groups.md#group-g06)<br>[Field travel and camp practice](./learning-groups.md#group-g04)                                                                                                                                                                                                                                                                                                                                                               |                 3 | Conceal Object<br>Underworld               | Appraisal<br>Bargaining<br>Conceal Object<br>Seamanship<br>Survival<br>Trade<br>Underworld<br>Wayfinding<br>Weather Lore                                                                                                                                                    |          9 | 9 across 1 valid path      |
| [Soldier](#profession-map-soldier)                                                                       | [Guard and rough-fighting drill](./learning-groups.md#group-f35)<br>[One-handed arms and formation drill](./learning-groups.md#group-f36)<br>[Spear, sidearm and throwing formation drill](./learning-groups.md#group-f31)<br>[Two-handed military weapon practice](./learning-groups.md#group-f37)<br>[Military bow and formation practice](./learning-groups.md#group-f38)<br>[Military crossbow and formation practice](./learning-groups.md#group-f39)<br>[Military firearms and formation practice](./learning-groups.md#group-f40) |                 7 | Combat Experience<br>Battlefield Awareness | 1-h conc./axe<br>1-h edged<br>2-h conc./axe<br>2-h edged<br>Battlefield Awareness<br>Bow<br>Brawling<br>Combat Experience<br>Crossbow<br>Dodge<br>Firearms<br>Formation Fighting<br>Parry<br>Polearms<br>Throwing                                                           |         15 | 6–10 across 9 valid paths  |
| [Spinner and Weaver](#profession-map-spinner-and-weaver)                                                 | [Fibre-to-cloth workshop practice](./learning-groups.md#group-f02)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                 1 | None                                       | Fibre Working<br>Weaving                                                                                                                                                                                                                                                    |          2 | 2 across 1 valid path      |
| [Storyteller and Poet](#profession-map-storyteller-and-poet)                                             | [Oral narrative composition and performance](./learning-groups.md#group-f19)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |                 1 | Poetry & Literary Composition              | Poetry & Literary Composition<br>Storytelling                                                                                                                                                                                                                               |          2 | 2 across 1 valid path      |
| [Surgeon](#profession-map-surgeon)                                                                       | [Operative care practice](./learning-groups.md#group-g18)<br>[Field surgical apprenticeship](./learning-groups.md#group-f29)<br>[Patient care](./learning-groups.md#group-g01)                                                                                                                                                                                                                                                                                                                                                           |                 3 | None                                       | First Aid<br>Medicine<br>Nursing<br>Surgery                                                                                                                                                                                                                                 |          4 | 4 across 1 valid path      |
| [Surveyor and Mapmaker](#profession-map-surveyor-and-mapmaker)                                           | [Field surveying and map production](./learning-groups.md#group-f01)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 1 | None                                       | Cartography<br>Surveying                                                                                                                                                                                                                                                    |          2 | 2 across 1 valid path      |
| [Tailor](#profession-map-tailor)                                                                         | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Tailoring                                  | Tailoring                                                                                                                                                                                                                                                                   |          1 | 1 across 1 valid path      |
| [Teacher](#profession-map-teacher)                                                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Teaching                                   | Teaching                                                                                                                                                                                                                                                                    |          1 | 1 across 1 valid path      |
| [Thief](#profession-map-thief)                                                                           | [Covert entry practice](./learning-groups.md#group-g15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                 1 | Sleight of Hand                            | Lockpicking<br>Perception<br>Sleight of Hand<br>Stealth                                                                                                                                                                                                                     |          4 | 4 across 1 valid path      |
| [Trader and Merchant](#profession-map-trader-and-merchant)                                               | [Trading practice](./learning-groups.md#group-g12)<br>[Field travel and camp practice](./learning-groups.md#group-g04)<br>[Draught-team and vehicle practice](./learning-groups.md#group-f06)<br>[One-handed edged close-combat practice](./learning-groups.md#group-g08)                                                                                                                                                                                                                                                                |                 4 | None                                       | 1-h edged<br>Animal Handling<br>Appraisal<br>Bargaining<br>Cart Driving<br>Dodge<br>Parry<br>Survival<br>Trade<br>Wayfinding<br>Weather Lore                                                                                                                                |         11 | 11 across 1 valid path     |
| [Translator and Interpreter](#profession-map-translator-and-interpreter)                                 | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Translation & Interpretation               | Translation & Interpretation                                                                                                                                                                                                                                                |          1 | 1 across 1 valid path      |
| [Trapmaker](#profession-map-trapmaker)                                                                   | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Trapmaking                                 | Trapmaking                                                                                                                                                                                                                                                                  |          1 | 1 across 1 valid path      |
| [Veterinary Practitioner](#profession-map-veterinary-practitioner)                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Veterinary Medicine                        | Veterinary Medicine                                                                                                                                                                                                                                                         |          1 | 1 across 1 valid path      |
| [Vintner](#profession-map-vintner)                                                                       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                 0 | Winemaking                                 | Winemaking                                                                                                                                                                                                                                                                  |          1 | 1 across 1 valid path      |
| [Visual Artist and Sculptor](#profession-map-visual-artist-and-sculptor)                                 | [Drawing and modelling workshop](./learning-groups.md#group-f20)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | Visual Art<br>Sculpture                    | Sculpture<br>Visual Art                                                                                                                                                                                                                                                     |          2 | 2 across 1 valid path      |
| [Weapon Instructor](#profession-map-weapon-instructor)                                                   | [One-handed edged close-combat practice](./learning-groups.md#group-g08)<br>[Guard and rough-fighting drill](./learning-groups.md#group-f35)<br>[Swashbuckling fencing instruction](./learning-groups.md#group-f30)                                                                                                                                                                                                                                                                                                                      |                 3 | Teaching                                   | 1-h conc./axe<br>1-h edged<br>Brawling<br>Dodge<br>Parry<br>Teaching                                                                                                                                                                                                        |          6 | 6 across 1 valid path      |
| [Wild Plant Gatherer](#profession-map-wild-plant-gatherer)                                               | [Field travel and camp practice](./learning-groups.md#group-g04)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                 1 | Plant Lore<br>Climbing                     | Climbing<br>Plant Lore<br>Survival<br>Wayfinding<br>Weather Lore                                                                                                                                                                                                            |          5 | 5 across 1 valid path      |

## Full Profession reference

<a id="profession-map-actor-and-dancer"></a>

## Actor and Dancer

**Learning Groups:** 1

### [Dramatic acting and dance practice](./learning-groups.md#group-f18)

**Profession route:** Integrated acting-and-dance tradition. The same sustained rehearsals deliberately teach complete Acting and Dance.

- [Acting](./skills.md#skill-acting)
- [Dance](./skills.md#skill-dancing)

### Direct Skills

- [Acting](./skills.md#skill-acting) — Acting-only tradition. Coached dramatic work teaches Acting; F18 would incorrectly add complete Dance.
- [Dance](./skills.md#skill-dancing) — Dance-only tradition. Sustained movement rehearsal teaches Dance; F18 would incorrectly add complete Acting.

### Possible Skill reach

- [Acting](./skills.md#skill-acting) — routes: Dramatic acting and dance practice (Integrated acting-and-dance tradition); direct Profession route (Acting-only tradition)
- [Dance](./skills.md#skill-dancing) — routes: Dramatic acting and dance practice (Integrated acting-and-dance tradition); direct Profession route (Dance-only tradition)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Dramatic acting and dance practice

**Direct base Skills:** Acting; Dance

- [Acting](./skills.md#skill-acting)
- [Dance](./skills.md#skill-dancing)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-alchemist"></a>

## Alchemist

**Learning Groups:** 0

None.

### Direct Skills

- [Alchemy](./skills.md#skill-alchemy) — Ordinary alchemical apprenticeship. The mentor teaches complete alchemical material practice; no approved group includes Alchemy, and remedy or forge groups teach different competences.

### Possible Skill reach

- [Alchemy](./skills.md#skill-alchemy) — routes: direct Profession route (Ordinary alchemical apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Alchemy

- [Alchemy](./skills.md#skill-alchemy)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-animal-trainer-and-falconer"></a>

## Animal Trainer and Falconer

**Learning Groups:** 1

### [Falconry apprenticeship](./learning-groups.md#group-f07)

**Profession route:** Falconry branch only. The apprenticeship directly teaches Animal Handling and Hunting together with Animal Training and its nested Falconry specialization.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Hunting](./skills.md#skill-skill-hunting)

### Direct Skills

- [Animal Handling](./skills.md#skill-skill-animal-handling) — Non-falconry trainer. Supervised control and response work teaches handling; the existing animal groups add riding, herding, driving or hunting not intrinsic to this route.

### Possible Skill reach

- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Falconry apprenticeship (Falconry branch only); direct Profession route (Non-falconry trainer)
- [Hunting](./skills.md#skill-skill-hunting) — routes: Falconry apprenticeship (Falconry branch only)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Falconry apprenticeship

**Direct base Skills:** Animal Handling

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Hunting](./skills.md#skill-skill-hunting)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Animal Training](./skills.md#specialization-spec-animal-training) — parent: **Animal Handling**; routes: Falconry apprenticeship (Falconry branch only); direct Profession route (Non-falconry trainer); immediate parent appears in this family envelope.
- [Falconry](./skills.md#specialization-spec-falconry) — parent: **Animal Training**; routes: Falconry apprenticeship (Falconry branch only); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-armorer"></a>

## Armorer

**Learning Groups:** 1

### [Forged-metal armor workshop](./learning-groups.md#group-f26)

**Profession route:** Forged-metal armor workshop only. The apprentice learns complete Smithing and Armoring together through forged protective equipment.

- [Smithing](./skills.md#skill-skill-smithing)
- [Armoring](./skills.md#skill-skill-armoring)

### Direct Skills

- [Armoring](./skills.md#skill-skill-armoring) — Non-forged material tradition. The maker is coached in complete armor construction and fitting; F26 would incorrectly add Smithing to a textile or other non-forged route.

### Possible Skill reach

- [Armoring](./skills.md#skill-skill-armoring) — routes: Forged-metal armor workshop (Forged-metal armor workshop only); direct Profession route (Non-forged material tradition)
- [Smithing](./skills.md#skill-skill-smithing) — routes: Forged-metal armor workshop (Forged-metal armor workshop only)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Forged-metal armor workshop

**Direct base Skills:** Armoring

- [Armoring](./skills.md#skill-skill-armoring)
- [Smithing](./skills.md#skill-skill-smithing)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-astrologer"></a>

## Astrologer

**Learning Groups:** 0

None.

### Direct Skills

- [Astrology](./skills.md#skill-astrology) — Ordinary astrological study. Repeated specialist interpretation directly teaches Astrology; no approved group contains it.

### Possible Skill reach

- [Astrology](./skills.md#skill-astrology) — routes: direct Profession route (Ordinary astrological study)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Astrology

- [Astrology](./skills.md#skill-astrology)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-astronomer"></a>

## Astronomer

**Learning Groups:** 0

None.

### Direct Skills

- [Astronomy](./skills.md#skill-astronomy) — Ordinary observing-and-study tradition. Repeated coached observations and explanation teach complete Astronomy; no approved group includes it.

### Possible Skill reach

- [Astronomy](./skills.md#skill-astronomy) — routes: direct Profession route (Ordinary observing-and-study tradition)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Astronomy

- [Astronomy](./skills.md#skill-astronomy)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-athlete-and-physical-performer"></a>

## Athlete and Physical Performer

**Learning Groups:** 1

### [Running and athletic field practice](./learning-groups.md#group-f04)

**Profession route:** Combined running-and-athletic field route. Coached field practice repeatedly develops complete Running and Athletics.

- [Running](./skills.md#skill-skill-running)
- [Athletics](./skills.md#skill-skill-athletics)

### Direct Skills

None.

### Possible Skill reach

- [Athletics](./skills.md#skill-skill-athletics) — routes: Running and athletic field practice (Combined running-and-athletic field route)
- [Running](./skills.md#skill-skill-running) — routes: Running and athletic field practice (Combined running-and-athletic field route)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Running and athletic field practice

**Direct base Skills:** None

- [Athletics](./skills.md#skill-skill-athletics)
- [Running](./skills.md#skill-skill-running)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-banker-and-credit-practitioner"></a>

## Banker and Credit Practitioner

**Learning Groups:** 1

### [Credit-house accounts and obligations](./learning-groups.md#group-f12)

**Profession route:** Ordinary credit-house apprenticeship. Complete Banking & Credit and Bookkeeping are repeatedly taught through live obligations and their accounts.

- [Banking & Credit](./skills.md#skill-banking)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

### Direct Skills

None.

### Possible Skill reach

- [Banking & Credit](./skills.md#skill-banking) — routes: Credit-house accounts and obligations (Ordinary credit-house apprenticeship)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping) — routes: Credit-house accounts and obligations (Ordinary credit-house apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Credit-house accounts and obligations

**Direct base Skills:** None

- [Banking & Credit](./skills.md#skill-banking)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-birth-attendant-and-midwife"></a>

## Birth Attendant and Midwife

**Learning Groups:** 0

None.

### Direct Skills

None.

### Possible Skill reach

None.

**Total possible distinct base Skills:** 0

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** None

- None.

**Effective distinct base-Skill breadth:** 0

### Reachable Specializations

- [Obstetrics](./skills.md#specialization-obstetrics) — parent: **Medicine**; routes: direct Profession route (Ordinary specialist apprenticeship); immediate parent must be obtained through another approved route.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-brewer"></a>

## Brewer

**Learning Groups:** 0

None.

### Direct Skills

- [Brewing](./skills.md#skill-skill-brewing) — Ordinary brewing apprenticeship. Repeated corrected batches teach the whole Brewing Skill; no approved group includes it.

### Possible Skill reach

- [Brewing](./skills.md#skill-skill-brewing) — routes: direct Profession route (Ordinary brewing apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Brewing

- [Brewing](./skills.md#skill-skill-brewing)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-building-designer"></a>

## Building Designer

**Learning Groups:** 1

### [Building design and site surveying](./learning-groups.md#group-f28)

**Profession route:** Ordinary design-and-site apprenticeship. Complete Architecture and Surveying are taught together through planned building projects.

- [Architecture](./skills.md#skill-skill-architecture)
- [Surveying](./skills.md#skill-surveying)

### Direct Skills

None.

### Possible Skill reach

- [Architecture](./skills.md#skill-skill-architecture) — routes: Building design and site surveying (Ordinary design-and-site apprenticeship)
- [Surveying](./skills.md#skill-surveying) — routes: Building design and site surveying (Ordinary design-and-site apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Building design and site surveying

**Direct base Skills:** None

- [Architecture](./skills.md#skill-skill-architecture)
- [Surveying](./skills.md#skill-surveying)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Fortification](./skills.md#specialization-spec-fortification) — parent: **Architecture**; routes: direct Profession route (Defensive-building specialist route); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-campaign-planner"></a>

## Campaign Planner

**Learning Groups:** 1

### [Unit coordination and command practice](./learning-groups.md#group-g09)

**Profession route:** Commander-planner branch only. A planner who also trains for unit command receives the complete leadership, tactics and command practice. Explicit tracks: Campaign adviser.

- [Battle Tactics](./skills.md#skill-tactics)
- [Leadership](./skills.md#skill-skill-leadership)
- [Military Command](./skills.md#skill-captaincy)

### Direct Skills

- [Campaign Strategy](./skills.md#skill-skill-campaign-strategy) — Ordinary mentored planning work. Repeated campaign planning and critical review teach the complete Skill; no approved group includes it. Tracks: Campaign adviser.

### Possible Skill reach

- [Battle Tactics](./skills.md#skill-tactics) — routes: Unit coordination and command practice (Commander-planner branch only)
- [Campaign Strategy](./skills.md#skill-skill-campaign-strategy) — routes: direct Profession route (Ordinary mentored planning work)
- [Leadership](./skills.md#skill-skill-leadership) — routes: Unit coordination and command practice (Commander-planner branch only)
- [Military Command](./skills.md#skill-captaincy) — routes: Unit coordination and command practice (Commander-planner branch only)

**Total possible distinct base Skills:** 4

### Effective package breadth by valid path

#### Campaign adviser

**Learning Groups:** Unit coordination and command practice

**Direct base Skills:** Campaign Strategy

- [Battle Tactics](./skills.md#skill-tactics)
- [Campaign Strategy](./skills.md#skill-skill-campaign-strategy)
- [Leadership](./skills.md#skill-skill-leadership)
- [Military Command](./skills.md#skill-captaincy)

**Effective distinct base-Skill breadth:** 4

### Reachable Specializations

None.

### Explicit track source map

- **Campaign adviser** — Unit coordination and command practice; Campaign Strategy

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-carpenter"></a>

## Carpenter

**Learning Groups:** 0

None.

### Direct Skills

- [Carpentry](./skills.md#skill-carpentry) — Ordinary carpentry apprenticeship. Repeated whole timber projects teach Carpentry; F03 adds Shipbuilding and F27 adds Mechanics, neither required for general carpentry.

### Possible Skill reach

- [Carpentry](./skills.md#skill-carpentry) — routes: direct Profession route (Ordinary carpentry apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Carpentry

- [Carpentry](./skills.md#skill-carpentry)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-clerk-and-steward"></a>

## Clerk and Steward

**Learning Groups:** 1

### [Records-office practice](./learning-groups.md#group-g11)

**Profession route:** Ordinary office apprenticeship. The establishment expressly teaches complete Administration and Bookkeeping through continuing work and accounts.

- [Administration](./skills.md#skill-skill-administration)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

### Direct Skills

None.

### Possible Skill reach

- [Administration](./skills.md#skill-skill-administration) — routes: Records-office practice (Ordinary office apprenticeship)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping) — routes: Records-office practice (Ordinary office apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Records-office practice

**Direct base Skills:** None

- [Administration](./skills.md#skill-skill-administration)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Court Administration](./skills.md#specialization-spec-court-administration) — parent: **Administration**; routes: direct Profession route (Court-office specialist branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-confidence-trickster"></a>

## Confidence Trickster

**Learning Groups:** 1

### [Impersonation and distraction practice](./learning-groups.md#group-g16)

**Profession route:** Ordinary impersonation apprenticeship. The same coached scenarios develop Deception and the physical presentation of Disguise.

- [Deception](./skills.md#skill-skill-deception)
- [Disguise](./skills.md#skill-skill-disguise)

### Direct Skills

None.

### Possible Skill reach

- [Deception](./skills.md#skill-skill-deception) — routes: Impersonation and distraction practice (Ordinary impersonation apprenticeship)
- [Disguise](./skills.md#skill-skill-disguise) — routes: Impersonation and distraction practice (Ordinary impersonation apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Impersonation and distraction practice

**Direct base Skills:** None

- [Deception](./skills.md#skill-skill-deception)
- [Disguise](./skills.md#skill-skill-disguise)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-cook"></a>

## Cook

**Learning Groups:** 1

### [Seasonal kitchen and preservation practice](./learning-groups.md#group-f22)

**Profession route:** Seasonal kitchen-and-preservation apprenticeship. The kitchen directly teaches complete Cooking and the Food Preservation specialization.

- [Cooking](./skills.md#skill-skill-cooking)

### Direct Skills

- [Cooking](./skills.md#skill-skill-cooking) — Meal-only kitchen route. A kitchen that teaches complete meal preparation without specialist preservation trains Cooking directly; F22 would otherwise overstate the narrower instruction.

### Possible Skill reach

- [Cooking](./skills.md#skill-skill-cooking) — routes: Seasonal kitchen and preservation practice (Seasonal kitchen-and-preservation apprenticeship); direct Profession route (Meal-only kitchen route)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Seasonal kitchen and preservation practice

**Direct base Skills:** Cooking

- [Cooking](./skills.md#skill-skill-cooking)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

- [Baking](./skills.md#specialization-spec-baking) — parent: **Cooking**; routes: direct Profession route (Baker branch); immediate parent appears in this family envelope.
- [Court Cookery](./skills.md#specialization-spec-court-cookery) — parent: **Cooking**; routes: direct Profession route (Court-service branch); immediate parent appears in this family envelope.
- [Food Preservation](./skills.md#specialization-spec-food-preservation) — parent: **Cooking**; routes: Seasonal kitchen and preservation practice (Seasonal kitchen-and-preservation apprenticeship); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-courier-and-messenger"></a>

## Courier and Messenger

**Learning Groups:** 3

### [Running and athletic field practice](./learning-groups.md#group-f04)

**Profession route:** Trained foot-runner branch. Coached running and athletic movement are both repeatedly practised for demanding foot delivery.

- [Running](./skills.md#skill-skill-running)
- [Athletics](./skills.md#skill-skill-athletics)

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Mounted branch. Mounted service expressly teaches complete handling and riding.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Long-distance field branch. Supervised routes include camp, wayfinding and weather instruction where the work demands the whole practice.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### Direct Skills

None.

### Possible Skill reach

- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Mounted travel and animal care (Mounted branch)
- [Athletics](./skills.md#skill-skill-athletics) — routes: Running and athletic field practice (Trained foot-runner branch)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Mounted branch)
- [Running](./skills.md#skill-skill-running) — routes: Running and athletic field practice (Trained foot-runner branch)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Long-distance field branch)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Long-distance field branch)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Long-distance field branch)

**Total possible distinct base Skills:** 7

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Running and athletic field practice; Mounted travel and animal care; Field travel and camp practice

**Direct base Skills:** None

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Athletics](./skills.md#skill-skill-athletics)
- [Riding](./skills.md#skill-skill-riding)
- [Running](./skills.md#skill-skill-running)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 7

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-distiller"></a>

## Distiller

**Learning Groups:** 0

None.

### Direct Skills

- [Distilling](./skills.md#skill-skill-distilling) — Non-medicinal distilling apprenticeship. Complete supervised distillation teaches the Skill; F23 would also require Pharmacy, which beverage or other material work need not teach.

### Possible Skill reach

- [Distilling](./skills.md#skill-skill-distilling) — routes: direct Profession route (Non-medicinal distilling apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Distilling

- [Distilling](./skills.md#skill-skill-distilling)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-diver-and-water-worker"></a>

## Diver and Water Worker

**Learning Groups:** 1

### [Working a boat](./learning-groups.md#group-g06)

**Profession route:** Working-boat branch. A water worker who also operates the boat receives complete Seamanship instruction.

- [Seamanship](./skills.md#skill-skill-seamanship)

### Direct Skills

- [Swimming](./skills.md#skill-skill-swimming) — Ordinary supervised water practice. Repeated coached movement and work in water teach Swimming; no approved group contains it.

### Possible Skill reach

- [Seamanship](./skills.md#skill-skill-seamanship) — routes: Working a boat (Working-boat branch)
- [Swimming](./skills.md#skill-skill-swimming) — routes: direct Profession route (Ordinary supervised water practice)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Working a boat

**Direct base Skills:** Swimming

- [Seamanship](./skills.md#skill-skill-seamanship)
- [Swimming](./skills.md#skill-skill-swimming)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-diviner"></a>

## Diviner

**Learning Groups:** 0

None.

### Direct Skills

- [Divination](./skills.md#skill-divination) — Ordinary method-specific apprenticeship. Repeated corrected procedure and interpretation teach contextual Divination; no group includes it.

### Possible Skill reach

- [Divination](./skills.md#skill-divination) — routes: direct Profession route (Ordinary method-specific apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Divination

- [Divination](./skills.md#skill-divination)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

- [Omen Reading](./skills.md#specialization-spec-omen-reading) — parent: **Divination**; routes: direct Profession route (Omen-reading branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-document-forger"></a>

## Document Forger

**Learning Groups:** 0

None.

### Direct Skills

- [Document & Credential Forgery](./skills.md#skill-skill-document-forgery) — Ordinary forgery apprenticeship. Repeated construction and review of false documents teaches the complete Skill; G16 concerns personal impersonation and F15 investigates old texts.

### Possible Skill reach

- [Document & Credential Forgery](./skills.md#skill-skill-document-forgery) — routes: direct Profession route (Ordinary forgery apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Document & Credential Forgery

- [Document & Credential Forgery](./skills.md#skill-skill-document-forgery)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-driver-and-teamster"></a>

## Driver and Teamster

**Learning Groups:** 2

### [Draught-team and vehicle practice](./learning-groups.md#group-f06)

**Profession route:** Ordinary driving apprenticeship. Repeated journeys teach complete animal handling and cart control together.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Long-distance caravan service. A travelling driver receives direct field instruction in route, weather and camp practice when that is part of the service.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### Direct Skills

None.

### Possible Skill reach

- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Draught-team and vehicle practice (Ordinary driving apprenticeship)
- [Cart Driving](./skills.md#skill-skill-cart-driving) — routes: Draught-team and vehicle practice (Ordinary driving apprenticeship)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Long-distance caravan service)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Long-distance caravan service)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Long-distance caravan service)

**Total possible distinct base Skills:** 5

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Draught-team and vehicle practice; Field travel and camp practice

**Direct base Skills:** None

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 5

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-enforcer"></a>

## Enforcer

**Learning Groups:** 1

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Ordinary rough-combat apprenticeship. Repeated contact drills teach the impact/axe family, both defensive Skills and Brawling.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### Direct Skills

- [Intimidation](./skills.md#skill-skill-intimidation) — Coached coercive dealings. A mentor corrects the presentation and management of threats; no approved group teaches the whole Intimidation competence.
- [Underworld](./skills.md#skill-skill-underworld) — Illicit-network service only. Sustained instruction in the network’s conventions and dealings develops contextual Underworld; G14 teaches Streetwise and Insight instead.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: Guard and rough-fighting drill (Ordinary rough-combat apprenticeship)
- [Brawling](./skills.md#skill-brawling) — routes: Guard and rough-fighting drill (Ordinary rough-combat apprenticeship)
- [Dodge](./skills.md#skill-dodge) — routes: Guard and rough-fighting drill (Ordinary rough-combat apprenticeship)
- [Intimidation](./skills.md#skill-skill-intimidation) — routes: direct Profession route (Coached coercive dealings)
- [Parry](./skills.md#skill-parry) — routes: Guard and rough-fighting drill (Ordinary rough-combat apprenticeship)
- [Underworld](./skills.md#skill-skill-underworld) — routes: direct Profession route (Illicit-network service only)

**Total possible distinct base Skills:** 6

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Guard and rough-fighting drill

**Direct base Skills:** Intimidation; Underworld

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Intimidation](./skills.md#skill-skill-intimidation)
- [Parry](./skills.md#skill-parry)
- [Underworld](./skills.md#skill-skill-underworld)

**Effective distinct base-Skill breadth:** 6

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-envoy"></a>

## Envoy

**Learning Groups:** 2

### [Council and mediation practice](./learning-groups.md#group-g10)

**Profession route:** Ordinary representative apprenticeship. Supervised negotiations teach public speech, Insight, contextual Customs and Bargaining together.

- [Oratory](./skills.md#skill-skill-oratory)
- [Insight](./skills.md#skill-skill-insight)
- [Customs](./skills.md#skill-skill-customs)
- [Bargaining](./skills.md#skill-skill-bargaining)

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Mounted travelling envoy branch. An envoy who travels through mounted service receives complete animal handling and riding instruction.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### Direct Skills

None.

### Possible Skill reach

- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Mounted travel and animal care (Mounted travelling envoy branch)
- [Bargaining](./skills.md#skill-skill-bargaining) — routes: Council and mediation practice (Ordinary representative apprenticeship)
- [Customs](./skills.md#skill-skill-customs) — routes: Council and mediation practice (Ordinary representative apprenticeship)
- [Insight](./skills.md#skill-skill-insight) — routes: Council and mediation practice (Ordinary representative apprenticeship)
- [Oratory](./skills.md#skill-skill-oratory) — routes: Council and mediation practice (Ordinary representative apprenticeship)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Mounted travelling envoy branch)

**Total possible distinct base Skills:** 6

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Council and mediation practice; Mounted travel and animal care

**Direct base Skills:** None

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Customs](./skills.md#skill-skill-customs)
- [Insight](./skills.md#skill-skill-insight)
- [Oratory](./skills.md#skill-skill-oratory)
- [Riding](./skills.md#skill-skill-riding)

**Effective distinct base-Skill breadth:** 6

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-farmer"></a>

## Farmer

**Learning Groups:** 1

### [Mixed crop-and-stock household practice](./learning-groups.md#group-f08)

**Profession route:** Mixed crop-and-stock holding. A mentor teaches complete crop cultivation and continuing livestock care through the same recurring household work.

- [Farming](./skills.md#skill-skill-farming)
- [Animal Husbandry](./skills.md#skill-skill-animal-husbandry)

### Direct Skills

- [Farming](./skills.md#skill-skill-farming) — Crop-only route. Repeated cultivation teaches Farming; F08 would overstate the training if Animal Husbandry is not also taught.

### Possible Skill reach

- [Animal Husbandry](./skills.md#skill-skill-animal-husbandry) — routes: Mixed crop-and-stock household practice (Mixed crop-and-stock holding)
- [Farming](./skills.md#skill-skill-farming) — routes: Mixed crop-and-stock household practice (Mixed crop-and-stock holding); direct Profession route (Crop-only route)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Mixed crop-and-stock household practice

**Direct base Skills:** Farming

- [Animal Husbandry](./skills.md#skill-skill-animal-husbandry)
- [Farming](./skills.md#skill-skill-farming)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-field-and-caravan-guide"></a>

## Field and Caravan Guide

**Learning Groups:** 4

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Ordinary field practice. Repeated supervised journeys directly teach route choice, camp provision and weather assessment.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Mounted guide route. Work with an experienced mounted guide includes complete handling and riding instruction.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### [Draught-team and vehicle practice](./learning-groups.md#group-f06)

**Profession route:** Vehicle-caravan guide route. A guide who also drives is coached in both draught-animal handling and vehicle control.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)

### [One-handed edged close-combat practice](./learning-groups.md#group-g08)

**Profession route:** Armed escort-guide assignment only. An instructor expressly teaches one-handed edged fighting, evasion and parrying for journeys with fighting duties.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### Direct Skills

None.

### Possible Skill reach

- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed edged close-combat practice (Armed escort-guide assignment only)
- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Mounted travel and animal care (Mounted guide route); Draught-team and vehicle practice (Vehicle-caravan guide route)
- [Cart Driving](./skills.md#skill-skill-cart-driving) — routes: Draught-team and vehicle practice (Vehicle-caravan guide route)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed edged close-combat practice (Armed escort-guide assignment only)
- [Parry](./skills.md#skill-parry) — routes: One-handed edged close-combat practice (Armed escort-guide assignment only)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Mounted guide route)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Ordinary field practice)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Ordinary field practice)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Ordinary field practice)

**Total possible distinct base Skills:** 9

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Field travel and camp practice; Mounted travel and animal care; Draught-team and vehicle practice; One-handed edged close-combat practice

**Direct base Skills:** None

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Riding](./skills.md#skill-skill-riding)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 9

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-fisher"></a>

## Fisher

**Learning Groups:** 1

### [Fishing-boat apprenticeship](./learning-groups.md#group-f10)

**Profession route:** Boat-fishing apprenticeship. The learner repeatedly handles the fishing vessel as well as conducting the fishing, with both practices corrected.

- [Seamanship](./skills.md#skill-skill-seamanship)
- [Fishing](./skills.md#skill-skill-fishing)

### Direct Skills

- [Fishing](./skills.md#skill-skill-fishing) — Shore-based route. Repeated supervised fishing teaches the full local fishing practice; F10 is unsuitable when the learner is not taught Seamanship.

### Possible Skill reach

- [Fishing](./skills.md#skill-skill-fishing) — routes: Fishing-boat apprenticeship (Boat-fishing apprenticeship); direct Profession route (Shore-based route)
- [Seamanship](./skills.md#skill-skill-seamanship) — routes: Fishing-boat apprenticeship (Boat-fishing apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Fishing-boat apprenticeship

**Direct base Skills:** Fishing

- [Fishing](./skills.md#skill-skill-fishing)
- [Seamanship](./skills.md#skill-skill-seamanship)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-gambler"></a>

## Gambler

**Learning Groups:** 0

None.

### Direct Skills

- [Gambling](./skills.md#skill-gambling) — Ordinary coached play. Repeated reviewed play teaches Gambling; no approved group includes it and G12 concerns actual trade.

### Possible Skill reach

- [Gambling](./skills.md#skill-gambling) — routes: direct Profession route (Ordinary coached play)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Gambling

- [Gambling](./skills.md#skill-gambling)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-geographer"></a>

## Geographer

**Learning Groups:** 1

### [Field surveying and map production](./learning-groups.md#group-f01)

**Profession route:** Measured-field geographer branch. Where the practitioner also conducts complete measured mapping, Surveying and Cartography are directly taught together.

- [Surveying](./skills.md#skill-surveying)
- [Cartography](./skills.md#skill-skill-cartography)

### Direct Skills

- [Geography](./skills.md#skill-skill-geography) — Ordinary regional study. Sustained corrected study teaches Geography; F01 produces measured maps and does not supply the whole geographical body of knowledge.

### Possible Skill reach

- [Cartography](./skills.md#skill-skill-cartography) — routes: Field surveying and map production (Measured-field geographer branch)
- [Geography](./skills.md#skill-skill-geography) — routes: direct Profession route (Ordinary regional study)
- [Surveying](./skills.md#skill-surveying) — routes: Field surveying and map production (Measured-field geographer branch)

**Total possible distinct base Skills:** 3

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Field surveying and map production

**Direct base Skills:** Geography

- [Cartography](./skills.md#skill-skill-cartography)
- [Geography](./skills.md#skill-skill-geography)
- [Surveying](./skills.md#skill-surveying)

**Effective distinct base-Skill breadth:** 3

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-guard-watcher-and-escort"></a>

## Guard, Watcher and Escort

**Learning Groups:** 4

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Impact-weapon and rough-contact route. Paired guard drill directly teaches the stated weapon family, Dodge, Parry and Brawling.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### [One-handed edged close-combat practice](./learning-groups.md#group-g08)

**Profession route:** Edged-weapon route; additional to F35 when both sets are issued. The instructor expressly coaches one-handed edged fighting with both defensive Skills.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Journey-escort assignment. Guards who conduct extended overland escorts also receive complete camp, route and weather instruction.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### [Swashbuckling fencing instruction](./learning-groups.md#group-f30)

**Profession route:** Swashbuckling retainer/escort branch; alternative to G08. An escort taught the established Fencing tradition receives its complete edged-weapon, defensive and specialist curriculum, without being required to become a teacher.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### Direct Skills

None.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: Guard and rough-fighting drill (Impact-weapon and rough-contact route)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed edged close-combat practice (Edged-weapon route; additional to F35 when both sets are issued); Swashbuckling fencing instruction (Swashbuckling retainer/escort branch; alternative to G08)
- [Brawling](./skills.md#skill-brawling) — routes: Guard and rough-fighting drill (Impact-weapon and rough-contact route)
- [Dodge](./skills.md#skill-dodge) — routes: Guard and rough-fighting drill (Impact-weapon and rough-contact route); One-handed edged close-combat practice (Edged-weapon route; additional to F35 when both sets are issued); Swashbuckling fencing instruction (Swashbuckling retainer/escort branch; alternative to G08)
- [Parry](./skills.md#skill-parry) — routes: Guard and rough-fighting drill (Impact-weapon and rough-contact route); One-handed edged close-combat practice (Edged-weapon route; additional to F35 when both sets are issued); Swashbuckling fencing instruction (Swashbuckling retainer/escort branch; alternative to G08)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Journey-escort assignment)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Journey-escort assignment)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Journey-escort assignment)

**Total possible distinct base Skills:** 8

### Effective package breadth by valid path

#### Family route — Swashbuckling fencing instruction

**Learning Groups:** Guard and rough-fighting drill; Field travel and camp practice; Swashbuckling fencing instruction

**Direct base Skills:** None

**Excluded mutually exclusive alternative:** One-handed edged close-combat practice

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 8

#### Family route — One-handed edged close-combat practice

**Learning Groups:** Guard and rough-fighting drill; One-handed edged close-combat practice; Field travel and camp practice

**Direct base Skills:** None

**Excluded mutually exclusive alternative:** Swashbuckling fencing instruction

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 8

### Reachable Specializations

- [Fencing](./skills.md#specialization-fencing) — parent: **1-h edged**; routes: Swashbuckling fencing instruction (Swashbuckling retainer/escort branch; alternative to G08); immediate parent appears in this family envelope.

### Mutually exclusive Learning Group routes

- **Swashbuckling fencing instruction** or **One-handed edged close-combat practice**; both may not be purchased through this Profession.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-herald"></a>

## Herald

**Learning Groups:** 2

### [Speech and memory practice](./learning-groups.md#group-f14)

**Profession route:** Formal announcing branch. A teacher directly develops complete Oratory and trained Mnemonics through prepared public speech.

- [Oratory](./skills.md#skill-skill-oratory)
- [Mnemonics](./skills.md#skill-skill-mnemonics)

### [Lineage investigation apprenticeship](./learning-groups.md#group-f16)

**Profession route:** Genealogical-service branch. Lineage inquiries expressly teach Research and the Genealogy specialization.

- [Research](./skills.md#skill-skill-research)

### Direct Skills

- [Heraldry](./skills.md#skill-heraldry) — Ordinary heraldic apprenticeship. Repeated interpretation and use of the tradition’s identifying signs teaches Heraldry; no approved group includes it.

### Possible Skill reach

- [Heraldry](./skills.md#skill-heraldry) — routes: direct Profession route (Ordinary heraldic apprenticeship)
- [Mnemonics](./skills.md#skill-skill-mnemonics) — routes: Speech and memory practice (Formal announcing branch)
- [Oratory](./skills.md#skill-skill-oratory) — routes: Speech and memory practice (Formal announcing branch)
- [Research](./skills.md#skill-skill-research) — routes: Lineage investigation apprenticeship (Genealogical-service branch)

**Total possible distinct base Skills:** 4

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Speech and memory practice; Lineage investigation apprenticeship

**Direct base Skills:** Heraldry

- [Heraldry](./skills.md#skill-heraldry)
- [Mnemonics](./skills.md#skill-skill-mnemonics)
- [Oratory](./skills.md#skill-skill-oratory)
- [Research](./skills.md#skill-skill-research)

**Effective distinct base-Skill breadth:** 4

### Reachable Specializations

- [Courtly Protocol](./skills.md#specialization-spec-courtly-protocol) — parent: **Customs**; routes: direct Profession route (Court ceremonial branch); immediate parent must be obtained through another approved route.
- [Genealogy](./skills.md#specialization-spec-genealogy) — parent: **History**; routes: Lineage investigation apprenticeship (Genealogical-service branch); immediate parent must be obtained through another approved route.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-herbalist-and-remedy-maker"></a>

## Herbalist and Remedy Maker

**Learning Groups:** 2

### [Plant and remedy preparation](./learning-groups.md#group-g02)

**Profession route:** Ordinary plant-remedy apprenticeship. Plant identification and properties are repeatedly taught alongside complete Pharmacy preparation and dispensing.

- [Plant Lore](./skills.md#skill-skill-plant-lore)
- [Pharmacy](./skills.md#skill-skill-pharmacy)

### [Distilling remedy workshop](./learning-groups.md#group-f23)

**Profession route:** Distilling-remedy specialist branch. The workshop expressly teaches both Pharmacy and Distilling through medicinal preparations.

- [Pharmacy](./skills.md#skill-skill-pharmacy)
- [Distilling](./skills.md#skill-skill-distilling)

### Direct Skills

None.

### Possible Skill reach

- [Distilling](./skills.md#skill-skill-distilling) — routes: Distilling remedy workshop (Distilling-remedy specialist branch)
- [Pharmacy](./skills.md#skill-skill-pharmacy) — routes: Plant and remedy preparation (Ordinary plant-remedy apprenticeship); Distilling remedy workshop (Distilling-remedy specialist branch)
- [Plant Lore](./skills.md#skill-skill-plant-lore) — routes: Plant and remedy preparation (Ordinary plant-remedy apprenticeship)

**Total possible distinct base Skills:** 3

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Plant and remedy preparation; Distilling remedy workshop

**Direct base Skills:** None

- [Distilling](./skills.md#skill-skill-distilling)
- [Pharmacy](./skills.md#skill-skill-pharmacy)
- [Plant Lore](./skills.md#skill-skill-plant-lore)

**Effective distinct base-Skill breadth:** 3

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-herd-keeper"></a>

## Herd Keeper

**Learning Groups:** 2

### [Pastoral stockkeeping apprenticeship](./learning-groups.md#group-f05)

**Profession route:** Ordinary pastoral apprenticeship. Recurring stock work directly teaches individual handling, population care and collective herd movement.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Animal Husbandry](./skills.md#skill-skill-animal-husbandry)
- [Herding](./skills.md#skill-herding)

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Mounted herding assignment. Where herders are deliberately taught to ride and handle mounts, this separate travel practice is available.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### Direct Skills

- [Sling](./skills.md#skill-sling) — Sling-using pastoral tradition only. A teacher coaches sling handling and accurate release during sustained practice; Sling has no approved group and is not inferred merely from keeping animals.

### Possible Skill reach

- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Pastoral stockkeeping apprenticeship (Ordinary pastoral apprenticeship); Mounted travel and animal care (Mounted herding assignment)
- [Animal Husbandry](./skills.md#skill-skill-animal-husbandry) — routes: Pastoral stockkeeping apprenticeship (Ordinary pastoral apprenticeship)
- [Herding](./skills.md#skill-herding) — routes: Pastoral stockkeeping apprenticeship (Ordinary pastoral apprenticeship)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Mounted herding assignment)
- [Sling](./skills.md#skill-sling) — routes: direct Profession route (Sling-using pastoral tradition only)

**Total possible distinct base Skills:** 5

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Pastoral stockkeeping apprenticeship; Mounted travel and animal care

**Direct base Skills:** Sling

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Animal Husbandry](./skills.md#skill-skill-animal-husbandry)
- [Herding](./skills.md#skill-herding)
- [Riding](./skills.md#skill-skill-riding)
- [Sling](./skills.md#skill-sling)

**Effective distinct base-Skill breadth:** 5

### Reachable Specializations

- [Steppe Remount Training](./skills.md#specialization-spec-steppe-remount-training) — parent: **Animal Husbandry**; routes: direct Profession route (Specialist remount keeper only); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-historian-and-genealogist"></a>

## Historian and Genealogist

**Learning Groups:** 2

### [Historical text investigation](./learning-groups.md#group-f15)

**Profession route:** Historical-text investigation branch. The mentor deliberately teaches Research and Palaeography & Decipherment through complete investigations with difficult writing.

- [Research](./skills.md#skill-skill-research)
- [Palaeography & Decipherment](./skills.md#skill-skill-palaeography-decipherment)

### [Lineage investigation apprenticeship](./learning-groups.md#group-f16)

**Profession route:** Genealogical investigation branch. The apprenticeship expressly teaches Research and the Genealogy specialization through descent inquiries.

- [Research](./skills.md#skill-skill-research)

### Direct Skills

- [History](./skills.md#skill-history) — Ordinary historical study. Sustained study and correction develop the complete History Skill; neither F15 nor F16 teaches the parent historical body of knowledge automatically.

### Possible Skill reach

- [History](./skills.md#skill-history) — routes: direct Profession route (Ordinary historical study)
- [Palaeography & Decipherment](./skills.md#skill-skill-palaeography-decipherment) — routes: Historical text investigation (Historical-text investigation branch)
- [Research](./skills.md#skill-skill-research) — routes: Historical text investigation (Historical-text investigation branch); Lineage investigation apprenticeship (Genealogical investigation branch)

**Total possible distinct base Skills:** 3

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Historical text investigation; Lineage investigation apprenticeship

**Direct base Skills:** History

- [History](./skills.md#skill-history)
- [Palaeography & Decipherment](./skills.md#skill-skill-palaeography-decipherment)
- [Research](./skills.md#skill-skill-research)

**Effective distinct base-Skill breadth:** 3

### Reachable Specializations

- [Genealogy](./skills.md#specialization-spec-genealogy) — parent: **History**; routes: Lineage investigation apprenticeship (Genealogical investigation branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-hunter-and-trapper"></a>

## Hunter and Trapper

**Learning Groups:** 4

### [Tracking and hunting practice](./learning-groups.md#group-g03)

**Profession route:** Tracking-hunt route. Following and approaching game teaches tracking, hunting, concealment of movement and deliberate observation together.

- [Tracking](./skills.md#skill-skill-tracking)
- [Hunting](./skills.md#skill-skill-hunting)
- [Stealth](./skills.md#skill-skill-stealth)
- [Perception](./skills.md#skill-skill-perception)

### [Trapline and trail practice](./learning-groups.md#group-f34)

**Profession route:** Trapline route; alternative or additional apprenticeship. Repeatedly laying and revisiting traplines teaches both trail reading and animal trapping.

- [Tracking](./skills.md#skill-skill-tracking)
- [Trapping](./skills.md#skill-skill-trapping)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Expedition route. Extended supervised journeys teach camp provision, route choice and weather judgment.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### [Longbow hunting apprenticeship](./learning-groups.md#group-f41)

**Profession route:** Longbow-hunting tradition only. The teacher coaches complete hunting and bow practice, including the narrower Longbow practice.

- [Bow](./skills.md#skill-bow)
- [Hunting](./skills.md#skill-skill-hunting)

### Direct Skills

- [Bow](./skills.md#skill-bow) — Non-longbow bow-hunting route. Repeated coached shooting develops Bow; F38 adds military formation and F41 adds Longbow, neither of which an ordinary bow-hunting apprenticeship necessarily teaches.

### Possible Skill reach

- [Bow](./skills.md#skill-bow) — routes: Longbow hunting apprenticeship (Longbow-hunting tradition only); direct Profession route (Non-longbow bow-hunting route)
- [Hunting](./skills.md#skill-skill-hunting) — routes: Tracking and hunting practice (Tracking-hunt route); Longbow hunting apprenticeship (Longbow-hunting tradition only)
- [Perception](./skills.md#skill-skill-perception) — routes: Tracking and hunting practice (Tracking-hunt route)
- [Stealth](./skills.md#skill-skill-stealth) — routes: Tracking and hunting practice (Tracking-hunt route)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Expedition route)
- [Tracking](./skills.md#skill-skill-tracking) — routes: Tracking and hunting practice (Tracking-hunt route); Trapline and trail practice (Trapline route; alternative or additional apprenticeship)
- [Trapping](./skills.md#skill-skill-trapping) — routes: Trapline and trail practice (Trapline route; alternative or additional apprenticeship)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Expedition route)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Expedition route)

**Total possible distinct base Skills:** 9

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Tracking and hunting practice; Trapline and trail practice; Field travel and camp practice; Longbow hunting apprenticeship

**Direct base Skills:** Bow

- [Bow](./skills.md#skill-bow)
- [Hunting](./skills.md#skill-skill-hunting)
- [Perception](./skills.md#skill-skill-perception)
- [Stealth](./skills.md#skill-skill-stealth)
- [Survival](./skills.md#skill-skill-survival)
- [Tracking](./skills.md#skill-skill-tracking)
- [Trapping](./skills.md#skill-skill-trapping)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 9

### Reachable Specializations

- [Longbow](./skills.md#specialization-longbow) — parent: **Bow**; routes: Longbow hunting apprenticeship (Longbow-hunting tradition only); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-investigator-and-intelligence-agent"></a>

## Investigator and Intelligence Agent

**Learning Groups:** 3

### [Interview and evidence practice](./learning-groups.md#group-g17)

**Profession route:** Ordinary inquiry apprenticeship. Structured questioning, follow-up, observation and evaluation of answers are expressly coached, satisfying the accepted Interrogation condition.

- [Research](./skills.md#skill-skill-research)
- [Insight](./skills.md#skill-skill-insight)
- [Perception](./skills.md#skill-skill-perception)
- [Interrogation](./skills.md#skill-skill-interrogation)

### [Local contacts and information gathering](./learning-groups.md#group-g14)

**Profession route:** Settlement-inquiry branch. A mentor additionally teaches complete local-contact practice where finding and interpreting contacts is a recurring part of the work.

- [Streetwise](./skills.md#skill-skill-streetwise)
- [Insight](./skills.md#skill-skill-insight)

### [Impersonation and distraction practice](./learning-groups.md#group-g16)

**Profession route:** Covert intelligence-service branch only. The teacher expressly rehearses complete Deception and Disguise for sustained cover identities; using a discreet contact alone is insufficient.

- [Deception](./skills.md#skill-skill-deception)
- [Disguise](./skills.md#skill-skill-disguise)

### Direct Skills

None.

### Possible Skill reach

- [Deception](./skills.md#skill-skill-deception) — routes: Impersonation and distraction practice (Covert intelligence-service branch only)
- [Disguise](./skills.md#skill-skill-disguise) — routes: Impersonation and distraction practice (Covert intelligence-service branch only)
- [Insight](./skills.md#skill-skill-insight) — routes: Interview and evidence practice (Ordinary inquiry apprenticeship); Local contacts and information gathering (Settlement-inquiry branch)
- [Interrogation](./skills.md#skill-skill-interrogation) — routes: Interview and evidence practice (Ordinary inquiry apprenticeship)
- [Perception](./skills.md#skill-skill-perception) — routes: Interview and evidence practice (Ordinary inquiry apprenticeship)
- [Research](./skills.md#skill-skill-research) — routes: Interview and evidence practice (Ordinary inquiry apprenticeship)
- [Streetwise](./skills.md#skill-skill-streetwise) — routes: Local contacts and information gathering (Settlement-inquiry branch)

**Total possible distinct base Skills:** 7

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Interview and evidence practice; Local contacts and information gathering; Impersonation and distraction practice

**Direct base Skills:** None

- [Deception](./skills.md#skill-skill-deception)
- [Disguise](./skills.md#skill-skill-disguise)
- [Insight](./skills.md#skill-skill-insight)
- [Interrogation](./skills.md#skill-skill-interrogation)
- [Perception](./skills.md#skill-skill-perception)
- [Research](./skills.md#skill-skill-research)
- [Streetwise](./skills.md#skill-skill-streetwise)

**Effective distinct base-Skill breadth:** 7

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-leatherworker"></a>

## Leatherworker

**Learning Groups:** 0

None.

### Direct Skills

- [Leatherwork](./skills.md#skill-leatherworking) — Ordinary material apprenticeship. Repeated complete leather projects teach Leatherwork; no approved group includes the Skill.

### Possible Skill reach

- [Leatherwork](./skills.md#skill-leatherworking) — routes: direct Profession route (Ordinary material apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Leatherwork

- [Leatherwork](./skills.md#skill-leatherworking)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-legal-practitioner-and-advocate"></a>

## Legal Practitioner and Advocate

**Learning Groups:** 1

### [Legal study and pleading practice](./learning-groups.md#group-f13)

**Profession route:** Formal specialist advocacy branch. The teacher directly develops complete Law, Oratory and the contextual Court Advocacy specialization.

- [Law](./skills.md#skill-skill-law)
- [Oratory](./skills.md#skill-skill-oratory)

### Direct Skills

- [Law](./skills.md#skill-skill-law) — Non-advocacy legal route. Repeated substantive legal study teaches Law; F13 would add complete Oratory and specialist advocacy that an adviser or law-keeper need not be taught.

### Possible Skill reach

- [Law](./skills.md#skill-skill-law) — routes: Legal study and pleading practice (Formal specialist advocacy branch); direct Profession route (Non-advocacy legal route)
- [Oratory](./skills.md#skill-skill-oratory) — routes: Legal study and pleading practice (Formal specialist advocacy branch)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Legal study and pleading practice

**Direct base Skills:** Law

- [Law](./skills.md#skill-skill-law)
- [Oratory](./skills.md#skill-skill-oratory)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Court Advocacy](./skills.md#specialization-spec-court-advocacy) — parent: **Law**; routes: Legal study and pleading practice (Formal specialist advocacy branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-local-informant"></a>

## Local Informant

**Learning Groups:** 1

### [Local contacts and information gathering](./learning-groups.md#group-g14)

**Profession route:** Ordinary contact apprenticeship. Mentored contact work directly teaches local Streetwise and the interpretation of people’s motives and positions.

- [Streetwise](./skills.md#skill-skill-streetwise)
- [Insight](./skills.md#skill-skill-insight)

### Direct Skills

- [Underworld](./skills.md#skill-skill-underworld) — Illicit-network informant only. A network mentor teaches its actual practices and relationships; no group includes the complete contextual Underworld Skill.

### Possible Skill reach

- [Insight](./skills.md#skill-skill-insight) — routes: Local contacts and information gathering (Ordinary contact apprenticeship)
- [Streetwise](./skills.md#skill-skill-streetwise) — routes: Local contacts and information gathering (Ordinary contact apprenticeship)
- [Underworld](./skills.md#skill-skill-underworld) — routes: direct Profession route (Illicit-network informant only)

**Total possible distinct base Skills:** 3

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Local contacts and information gathering

**Direct base Skills:** Underworld

- [Insight](./skills.md#skill-skill-insight)
- [Streetwise](./skills.md#skill-skill-streetwise)
- [Underworld](./skills.md#skill-skill-underworld)

**Effective distinct base-Skill breadth:** 3

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-locksmith"></a>

## Locksmith

**Learning Groups:** 0

None.

### Direct Skills

- [Locksmithing](./skills.md#skill-skill-locksmithing) — Ordinary lock apprenticeship. Complete construction and repair teach Locksmithing; G15 teaches covert entry and G13 teaches Smithing, neither of which represents the whole lock craft.

### Possible Skill reach

- [Locksmithing](./skills.md#skill-skill-locksmithing) — routes: direct Profession route (Ordinary lock apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Locksmithing

- [Locksmithing](./skills.md#skill-skill-locksmithing)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-mason"></a>

## Mason

**Learning Groups:** 0

None.

### Direct Skills

- [Masonry](./skills.md#skill-skill-masonry) — Ordinary masonry apprenticeship. Repeated complete construction work directly teaches Masonry; no approved group includes it, and F28 teaches design and surveying.

### Possible Skill reach

- [Masonry](./skills.md#skill-skill-masonry) — routes: direct Profession route (Ordinary masonry apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Masonry

- [Masonry](./skills.md#skill-skill-masonry)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-mathematical-practitioner"></a>

## Mathematical Practitioner

**Learning Groups:** 0

None.

### Direct Skills

- [Mathematics](./skills.md#skill-mathematics) — Ordinary mathematical study. Repeated problems and reasoned review teach complete Mathematics; no approved group includes it.

### Possible Skill reach

- [Mathematics](./skills.md#skill-mathematics) — routes: direct Profession route (Ordinary mathematical study)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Mathematics

- [Mathematics](./skills.md#skill-mathematics)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-mediator-and-community-convenor"></a>

## Mediator and Community Convenor

**Learning Groups:** 1

### [Council and mediation practice](./learning-groups.md#group-g10)

**Profession route:** Ordinary mediation apprenticeship. The same supervised discussions deliberately develop Oratory, Insight, contextual Customs and Bargaining.

- [Oratory](./skills.md#skill-skill-oratory)
- [Insight](./skills.md#skill-skill-insight)
- [Customs](./skills.md#skill-skill-customs)
- [Bargaining](./skills.md#skill-skill-bargaining)

### Direct Skills

None.

### Possible Skill reach

- [Bargaining](./skills.md#skill-skill-bargaining) — routes: Council and mediation practice (Ordinary mediation apprenticeship)
- [Customs](./skills.md#skill-skill-customs) — routes: Council and mediation practice (Ordinary mediation apprenticeship)
- [Insight](./skills.md#skill-skill-insight) — routes: Council and mediation practice (Ordinary mediation apprenticeship)
- [Oratory](./skills.md#skill-skill-oratory) — routes: Council and mediation practice (Ordinary mediation apprenticeship)

**Total possible distinct base Skills:** 4

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Council and mediation practice

**Direct base Skills:** None

- [Bargaining](./skills.md#skill-skill-bargaining)
- [Customs](./skills.md#skill-skill-customs)
- [Insight](./skills.md#skill-skill-insight)
- [Oratory](./skills.md#skill-skill-oratory)

**Effective distinct base-Skill breadth:** 4

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-military-commander"></a>

## Military Commander

**Learning Groups:** 5

### [Unit coordination and command practice](./learning-groups.md#group-g09)

**Profession route:** Command apprenticeship. The mentor directly teaches Leadership, Battle Tactics and Military Command as distinct parts of directing a unit. Explicit tracks: Foot field commander, Mounted field commander, Communal-force commander.

- [Battle Tactics](./skills.md#skill-tactics)
- [Leadership](./skills.md#skill-skill-leadership)
- [Military Command](./skills.md#skill-captaincy)

### [One-handed arms and formation drill](./learning-groups.md#group-f36)

**Profession route:** Foot line-officer service route. An officer serving in this equipment tradition is taught the same complete one-handed formation curriculum as the troops. Explicit tracks: Foot field commander.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Mounted-officer service route. The rider receives complete handling and riding instruction. Explicit tracks: Mounted field commander.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### [Mounted lance and troop drill](./learning-groups.md#group-f32)

**Profession route:** Mounted line-officer route; alternative to F36. The mounted fighting course expressly teaches lance, sidearm, defences, rough combat and troop participation. Explicit tracks: Mounted field commander.

- [Lance](./skills.md#skill-lance)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Mounted Combat](./skills.md#skill-mounted-combat)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Communal-force commander route; alternative to F36. A leader serving in the stated communal equipment tradition learns its complete rough-combat course without implying metal sidearms. Explicit tracks: Communal-force commander.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### Direct Skills

- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — Field-command experience. A senior commander coaches interpretation of developments during and after real encounters; G09 does not supply this whole Skill. Tracks: Foot field commander, Mounted field commander, Communal-force commander.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: One-handed arms and formation drill (Foot line-officer service route); Guard and rough-fighting drill (Communal-force commander route; alternative to F36)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed arms and formation drill (Foot line-officer service route); Mounted lance and troop drill (Mounted line-officer route; alternative to F36)
- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Mounted travel and animal care (Mounted-officer service route)
- [Battle Tactics](./skills.md#skill-tactics) — routes: Unit coordination and command practice (Command apprenticeship)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — routes: direct Profession route (Field-command experience)
- [Brawling](./skills.md#skill-brawling) — routes: One-handed arms and formation drill (Foot line-officer service route); Mounted lance and troop drill (Mounted line-officer route; alternative to F36); Guard and rough-fighting drill (Communal-force commander route; alternative to F36)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed arms and formation drill (Foot line-officer service route); Mounted lance and troop drill (Mounted line-officer route; alternative to F36); Guard and rough-fighting drill (Communal-force commander route; alternative to F36)
- [Formation Fighting](./skills.md#skill-formation-fighting) — routes: One-handed arms and formation drill (Foot line-officer service route); Mounted lance and troop drill (Mounted line-officer route; alternative to F36)
- [Lance](./skills.md#skill-lance) — routes: Mounted lance and troop drill (Mounted line-officer route; alternative to F36)
- [Leadership](./skills.md#skill-skill-leadership) — routes: Unit coordination and command practice (Command apprenticeship)
- [Military Command](./skills.md#skill-captaincy) — routes: Unit coordination and command practice (Command apprenticeship)
- [Mounted Combat](./skills.md#skill-mounted-combat) — routes: Mounted lance and troop drill (Mounted line-officer route; alternative to F36)
- [Parry](./skills.md#skill-parry) — routes: One-handed arms and formation drill (Foot line-officer service route); Mounted lance and troop drill (Mounted line-officer route; alternative to F36); Guard and rough-fighting drill (Communal-force commander route; alternative to F36)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Mounted-officer service route)

**Total possible distinct base Skills:** 14

### Effective package breadth by valid path

#### Foot field commander

**Learning Groups:** Unit coordination and command practice; One-handed arms and formation drill

**Direct base Skills:** Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battle Tactics](./skills.md#skill-tactics)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Leadership](./skills.md#skill-skill-leadership)
- [Military Command](./skills.md#skill-captaincy)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 10

#### Mounted field commander

**Learning Groups:** Unit coordination and command practice; Mounted travel and animal care; Mounted lance and troop drill

**Direct base Skills:** Battlefield Awareness

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Battle Tactics](./skills.md#skill-tactics)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Lance](./skills.md#skill-lance)
- [Leadership](./skills.md#skill-skill-leadership)
- [Military Command](./skills.md#skill-captaincy)
- [Mounted Combat](./skills.md#skill-mounted-combat)
- [Parry](./skills.md#skill-parry)
- [Riding](./skills.md#skill-skill-riding)

**Effective distinct base-Skill breadth:** 13

#### Communal-force commander

**Learning Groups:** Unit coordination and command practice; Guard and rough-fighting drill

**Direct base Skills:** Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Battle Tactics](./skills.md#skill-tactics)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Leadership](./skills.md#skill-skill-leadership)
- [Military Command](./skills.md#skill-captaincy)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 8

### Reachable Specializations

- [Siege Operations](./skills.md#specialization-spec-siege-operations) — parent: **Battle Tactics**; routes: direct Profession route (Experienced siege-command assignment only); immediate parent appears in this family envelope.

### Explicit track source map

- **Foot field commander** — Unit coordination and command practice; One-handed arms and formation drill; Battlefield Awareness; Siege Operations
- **Mounted field commander** — Unit coordination and command practice; Mounted travel and animal care; Mounted lance and troop drill; Battlefield Awareness; Siege Operations
- **Communal-force commander** — Unit coordination and command practice; Guard and rough-fighting drill; Battlefield Awareness; Siege Operations

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-military-quartermaster"></a>

## Military Quartermaster

**Learning Groups:** 3

### [Records-office practice](./learning-groups.md#group-g11)

**Profession route:** Supply-office apprenticeship. The office expressly teaches both Administration and Bookkeeping through continuing responsibility for stores and records. Explicit tracks: Supply-office quartermaster, Fighting-service quartermaster.

- [Administration](./skills.md#skill-skill-administration)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

### [Draught-team and vehicle practice](./learning-groups.md#group-f06)

**Profession route:** Transport-supervision through driving service. A quartermaster who learns by driving is taught whole animal and vehicle practice. Explicit tracks: Supply-office quartermaster, Fighting-service quartermaster.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)

### [One-handed arms and formation drill](./learning-groups.md#group-f36)

**Profession route:** Fighting-service branch only. An attached soldier-quartermaster receives the complete one-handed formation course when expected to fight with that equipment. Explicit tracks: Fighting-service quartermaster.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### Direct Skills

- [Military Logistics](./skills.md#skill-skill-military-logistics) — Ordinary military supply apprenticeship. Mentored planning and revision of force supply teaches the complete Skill; no group combines it with an appropriate co-trained curriculum. Tracks: Supply-office quartermaster, Fighting-service quartermaster.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: One-handed arms and formation drill (Fighting-service branch only)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed arms and formation drill (Fighting-service branch only)
- [Administration](./skills.md#skill-skill-administration) — routes: Records-office practice (Supply-office apprenticeship)
- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Draught-team and vehicle practice (Transport-supervision through driving service)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping) — routes: Records-office practice (Supply-office apprenticeship)
- [Brawling](./skills.md#skill-brawling) — routes: One-handed arms and formation drill (Fighting-service branch only)
- [Cart Driving](./skills.md#skill-skill-cart-driving) — routes: Draught-team and vehicle practice (Transport-supervision through driving service)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed arms and formation drill (Fighting-service branch only)
- [Formation Fighting](./skills.md#skill-formation-fighting) — routes: One-handed arms and formation drill (Fighting-service branch only)
- [Military Logistics](./skills.md#skill-skill-military-logistics) — routes: direct Profession route (Ordinary military supply apprenticeship)
- [Parry](./skills.md#skill-parry) — routes: One-handed arms and formation drill (Fighting-service branch only)

**Total possible distinct base Skills:** 11

### Effective package breadth by valid path

#### Supply-office quartermaster

**Learning Groups:** Records-office practice; Draught-team and vehicle practice

**Direct base Skills:** Military Logistics

- [Administration](./skills.md#skill-skill-administration)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)
- [Cart Driving](./skills.md#skill-skill-cart-driving)
- [Military Logistics](./skills.md#skill-skill-military-logistics)

**Effective distinct base-Skill breadth:** 5

#### Fighting-service quartermaster

**Learning Groups:** Records-office practice; Draught-team and vehicle practice; One-handed arms and formation drill

**Direct base Skills:** Military Logistics

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Administration](./skills.md#skill-skill-administration)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)
- [Brawling](./skills.md#skill-brawling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Military Logistics](./skills.md#skill-skill-military-logistics)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 11

### Reachable Specializations

None.

### Explicit track source map

- **Supply-office quartermaster** — Records-office practice; Draught-team and vehicle practice; Military Logistics
- **Fighting-service quartermaster** — Records-office practice; Draught-team and vehicle practice; One-handed arms and formation drill; Military Logistics

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-military-scout"></a>

## Military Scout

**Learning Groups:** 6

### [Concealed field reconnaissance practice](./learning-groups.md#group-f33)

**Profession route:** Reconnaissance apprenticeship. The mentor directly teaches Military Reconnaissance, Perception, Stealth and Camouflage through concealed field work. Explicit tracks: Foot military scout, Mounted military scout, Communal-force foot scout.

- [Military Reconnaissance](./skills.md#skill-skill-military-reconnaissance)
- [Perception](./skills.md#skill-skill-perception)
- [Stealth](./skills.md#skill-skill-stealth)
- [Camouflage](./skills.md#skill-camouflage)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Field-service foundation. Extended patrols include full wayfinding, camp and weather instruction. Explicit tracks: Foot military scout, Mounted military scout, Communal-force foot scout.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### [One-handed arms and formation drill](./learning-groups.md#group-f36)

**Profession route:** Foot-scout fighting route. The foot service explicitly trains both one-handed families, complete defences, Brawling and formation participation. Explicit tracks: Foot military scout.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Mounted-scout route. The mounted branch supplies complete handling and riding instruction. Explicit tracks: Mounted military scout.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### [Mounted lance and troop drill](./learning-groups.md#group-f32)

**Profession route:** Mounted-scout fighting route; alternative to F36. The stated mounted branch uses the complete lance-and-sidearm troop curriculum, rather than inferring combat from riding. Explicit tracks: Mounted military scout.

- [Lance](./skills.md#skill-lance)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Mounted Combat](./skills.md#skill-mounted-combat)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Communal-force foot-scout route; alternative to F36. A scout in an unformed communal contingent receives the complete impact-weapon, defensive and rough-fighting course without invented sidearms or formation training. Explicit tracks: Communal-force foot scout.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### Direct Skills

- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — Experienced reconnaissance service. Reviewed field encounters teach the significance of changing battle developments; F33 does not teach this whole groupless Skill. Tracks: Foot military scout, Mounted military scout, Communal-force foot scout.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: One-handed arms and formation drill (Foot-scout fighting route); Guard and rough-fighting drill (Communal-force foot-scout route; alternative to F36)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed arms and formation drill (Foot-scout fighting route); Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36)
- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Mounted travel and animal care (Mounted-scout route)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — routes: direct Profession route (Experienced reconnaissance service)
- [Brawling](./skills.md#skill-brawling) — routes: One-handed arms and formation drill (Foot-scout fighting route); Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36); Guard and rough-fighting drill (Communal-force foot-scout route; alternative to F36)
- [Camouflage](./skills.md#skill-camouflage) — routes: Concealed field reconnaissance practice (Reconnaissance apprenticeship)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed arms and formation drill (Foot-scout fighting route); Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36); Guard and rough-fighting drill (Communal-force foot-scout route; alternative to F36)
- [Formation Fighting](./skills.md#skill-formation-fighting) — routes: One-handed arms and formation drill (Foot-scout fighting route); Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36)
- [Lance](./skills.md#skill-lance) — routes: Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36)
- [Military Reconnaissance](./skills.md#skill-skill-military-reconnaissance) — routes: Concealed field reconnaissance practice (Reconnaissance apprenticeship)
- [Mounted Combat](./skills.md#skill-mounted-combat) — routes: Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36)
- [Parry](./skills.md#skill-parry) — routes: One-handed arms and formation drill (Foot-scout fighting route); Mounted lance and troop drill (Mounted-scout fighting route; alternative to F36); Guard and rough-fighting drill (Communal-force foot-scout route; alternative to F36)
- [Perception](./skills.md#skill-skill-perception) — routes: Concealed field reconnaissance practice (Reconnaissance apprenticeship)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Mounted-scout route)
- [Stealth](./skills.md#skill-skill-stealth) — routes: Concealed field reconnaissance practice (Reconnaissance apprenticeship)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Field-service foundation)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Field-service foundation)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Field-service foundation)

**Total possible distinct base Skills:** 18

### Effective package breadth by valid path

#### Foot military scout

**Learning Groups:** Concealed field reconnaissance practice; Field travel and camp practice; One-handed arms and formation drill

**Direct base Skills:** Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Camouflage](./skills.md#skill-camouflage)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Military Reconnaissance](./skills.md#skill-skill-military-reconnaissance)
- [Parry](./skills.md#skill-parry)
- [Perception](./skills.md#skill-skill-perception)
- [Stealth](./skills.md#skill-skill-stealth)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 14

#### Mounted military scout

**Learning Groups:** Concealed field reconnaissance practice; Field travel and camp practice; Mounted travel and animal care; Mounted lance and troop drill

**Direct base Skills:** Battlefield Awareness

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Camouflage](./skills.md#skill-camouflage)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Lance](./skills.md#skill-lance)
- [Military Reconnaissance](./skills.md#skill-skill-military-reconnaissance)
- [Mounted Combat](./skills.md#skill-mounted-combat)
- [Parry](./skills.md#skill-parry)
- [Perception](./skills.md#skill-skill-perception)
- [Riding](./skills.md#skill-skill-riding)
- [Stealth](./skills.md#skill-skill-stealth)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 17

#### Communal-force foot scout

**Learning Groups:** Concealed field reconnaissance practice; Field travel and camp practice; Guard and rough-fighting drill

**Direct base Skills:** Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Camouflage](./skills.md#skill-camouflage)
- [Dodge](./skills.md#skill-dodge)
- [Military Reconnaissance](./skills.md#skill-skill-military-reconnaissance)
- [Parry](./skills.md#skill-parry)
- [Perception](./skills.md#skill-skill-perception)
- [Stealth](./skills.md#skill-skill-stealth)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 12

### Reachable Specializations

None.

### Explicit track source map

- **Foot military scout** — Concealed field reconnaissance practice; Field travel and camp practice; One-handed arms and formation drill; Battlefield Awareness
- **Mounted military scout** — Concealed field reconnaissance practice; Field travel and camp practice; Mounted travel and animal care; Mounted lance and troop drill; Battlefield Awareness
- **Communal-force foot scout** — Concealed field reconnaissance practice; Field travel and camp practice; Guard and rough-fighting drill; Battlefield Awareness

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-millwright-and-mechanician"></a>

## Millwright and Mechanician

**Learning Groups:** 1

### [Timber millwright apprenticeship](./learning-groups.md#group-f27)

**Profession route:** Ordinary timber-mechanism apprenticeship. Complete Carpentry and Mechanics are directly taught through the same functioning mechanisms.

- [Carpentry](./skills.md#skill-carpentry)
- [Mechanics](./skills.md#skill-mechanics)

### Direct Skills

None.

### Possible Skill reach

- [Carpentry](./skills.md#skill-carpentry) — routes: Timber millwright apprenticeship (Ordinary timber-mechanism apprenticeship)
- [Mechanics](./skills.md#skill-mechanics) — routes: Timber millwright apprenticeship (Ordinary timber-mechanism apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Timber millwright apprenticeship

**Direct base Skills:** None

- [Carpentry](./skills.md#skill-carpentry)
- [Mechanics](./skills.md#skill-mechanics)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-miner-and-quarry-worker"></a>

## Miner and Quarry Worker

**Learning Groups:** 0

None.

### Direct Skills

- [Mining](./skills.md#skill-skill-mining) — Ordinary extraction apprenticeship. Repeated coached extraction teaches Mining; no approved group contains it.

### Possible Skill reach

- [Mining](./skills.md#skill-skill-mining) — routes: direct Profession route (Ordinary extraction apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Mining

- [Mining](./skills.md#skill-skill-mining)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-mounted-soldier-and-lancer"></a>

## Mounted Soldier and Lancer

**Learning Groups:** 2

### [Mounted travel and animal care](./learning-groups.md#group-g05)

**Profession route:** Working mounted-service foundation. Experienced riders teach complete Animal Handling and Riding. Explicit tracks: Mounted lancer.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Riding](./skills.md#skill-skill-riding)

### [Mounted lance and troop drill](./learning-groups.md#group-f32)

**Profession route:** Lancer and mounted-troop curriculum. The separate mounted course directly teaches its two weapons, both defences, Brawling, Mounted Combat and Formation Fighting. Explicit tracks: Mounted lancer.

- [Lance](./skills.md#skill-lance)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Mounted Combat](./skills.md#skill-mounted-combat)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### Direct Skills

- [Combat Experience](./skills.md#skill-combat-experience) — Experienced fighting service only. Reviewed encounters develop practical functioning in combat; neither G05 nor F32 supplies this groupless Skill. Tracks: Mounted lancer.
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — Mentored battlefield service only. A veteran teaches how the rider’s immediate encounter relates to changes across the battle; no group teaches the complete Skill. Tracks: Mounted lancer.

### Possible Skill reach

- [1-h edged](./skills.md#skill-one-handed-edged) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Mounted travel and animal care (Working mounted-service foundation)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — routes: direct Profession route (Mentored battlefield service only)
- [Brawling](./skills.md#skill-brawling) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Combat Experience](./skills.md#skill-combat-experience) — routes: direct Profession route (Experienced fighting service only)
- [Dodge](./skills.md#skill-dodge) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Formation Fighting](./skills.md#skill-formation-fighting) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Lance](./skills.md#skill-lance) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Mounted Combat](./skills.md#skill-mounted-combat) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Parry](./skills.md#skill-parry) — routes: Mounted lance and troop drill (Lancer and mounted-troop curriculum)
- [Riding](./skills.md#skill-skill-riding) — routes: Mounted travel and animal care (Working mounted-service foundation)

**Total possible distinct base Skills:** 11

### Effective package breadth by valid path

#### Mounted lancer

**Learning Groups:** Mounted travel and animal care; Mounted lance and troop drill

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Lance](./skills.md#skill-lance)
- [Mounted Combat](./skills.md#skill-mounted-combat)
- [Parry](./skills.md#skill-parry)
- [Riding](./skills.md#skill-skill-riding)

**Effective distinct base-Skill breadth:** 11

### Reachable Specializations

None.

### Explicit track source map

- **Mounted lancer** — Mounted travel and animal care; Mounted lance and troop drill; Combat Experience; Battlefield Awareness

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-musician-and-singer"></a>

## Musician and Singer

**Learning Groups:** 1

### [Self-accompanied song practice](./learning-groups.md#group-f17)

**Profession route:** Self-accompanied song route. The same rehearsal directly develops complete Music and Singing through playing while singing.

- [Music](./skills.md#skill-music)
- [Singing](./skills.md#skill-singing)

### Direct Skills

- [Music](./skills.md#skill-music) — Instrumental-only route. Complete instrumental musical practice is coached; F17 would additionally require Singing.
- [Singing](./skills.md#skill-singing) — Vocal-only route. Complete vocal practice is coached; F17 would additionally require instrumental Music.

### Possible Skill reach

- [Music](./skills.md#skill-music) — routes: Self-accompanied song practice (Self-accompanied song route); direct Profession route (Instrumental-only route)
- [Singing](./skills.md#skill-singing) — routes: Self-accompanied song practice (Self-accompanied song route); direct Profession route (Vocal-only route)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Self-accompanied song practice

**Direct base Skills:** Music; Singing

- [Music](./skills.md#skill-music)
- [Singing](./skills.md#skill-singing)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Music Composition](./skills.md#specialization-spec-music-composition) — parent: **Music**; routes: direct Profession route (Composer branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-naturalist"></a>

## Naturalist

**Learning Groups:** 0

None.

### Direct Skills

- [Animal Lore](./skills.md#skill-skill-animal-lore) — Animal-study branch. Repeated observation and corrected comparison teach the whole Animal Lore Skill; no group currently includes it.
- [Plant Lore](./skills.md#skill-skill-plant-lore) — Plant-study branch. Complete plant identification, habitat and properties are studied; G02 would incorrectly add Pharmacy to this route.

### Possible Skill reach

- [Animal Lore](./skills.md#skill-skill-animal-lore) — routes: direct Profession route (Animal-study branch)
- [Plant Lore](./skills.md#skill-skill-plant-lore) — routes: direct Profession route (Plant-study branch)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Animal Lore; Plant Lore

- [Animal Lore](./skills.md#skill-skill-animal-lore)
- [Plant Lore](./skills.md#skill-skill-plant-lore)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-navigator-and-pilot"></a>

## Navigator and Pilot

**Learning Groups:** 3

### [Passage navigation](./learning-groups.md#group-g07)

**Profession route:** Passage-and-local-pilotage apprenticeship. The teacher coaches Dead Reckoning, Wayfinding and Pilotage as complete parts of planning and guiding passages.

- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Pilotage](./skills.md#skill-skill-pilotage)

### [Working a boat](./learning-groups.md#group-g06)

**Profession route:** Working-crew entry route. A navigator who learns through crew service receives complete vessel-work instruction.

- [Seamanship](./skills.md#skill-skill-seamanship)

### [Charted open-water navigation practice](./learning-groups.md#group-f11)

**Profession route:** Historically appropriate charted open-water route only. The course expressly teaches Dead Reckoning, Chart Navigation and Celestial Navigation together.

- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning)
- [Chart Navigation](./skills.md#skill-skill-chart-navigation)
- [Celestial Navigation](./skills.md#skill-skill-celestial-navigation)

### Direct Skills

None.

### Possible Skill reach

- [Celestial Navigation](./skills.md#skill-skill-celestial-navigation) — routes: Charted open-water navigation practice (Historically appropriate charted open-water route only)
- [Chart Navigation](./skills.md#skill-skill-chart-navigation) — routes: Charted open-water navigation practice (Historically appropriate charted open-water route only)
- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning) — routes: Passage navigation (Passage-and-local-pilotage apprenticeship); Charted open-water navigation practice (Historically appropriate charted open-water route only)
- [Pilotage](./skills.md#skill-skill-pilotage) — routes: Passage navigation (Passage-and-local-pilotage apprenticeship)
- [Seamanship](./skills.md#skill-skill-seamanship) — routes: Working a boat (Working-crew entry route)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Passage navigation (Passage-and-local-pilotage apprenticeship)

**Total possible distinct base Skills:** 6

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Passage navigation; Working a boat; Charted open-water navigation practice

**Direct base Skills:** None

- [Celestial Navigation](./skills.md#skill-skill-celestial-navigation)
- [Chart Navigation](./skills.md#skill-skill-chart-navigation)
- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning)
- [Pilotage](./skills.md#skill-skill-pilotage)
- [Seamanship](./skills.md#skill-skill-seamanship)
- [Wayfinding](./skills.md#skill-skill-wayfinding)

**Effective distinct base-Skill breadth:** 6

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-nurse-and-patient-attendant"></a>

## Nurse and Patient Attendant

**Learning Groups:** 0

None.

### Direct Skills

- [Nursing](./skills.md#skill-nursing) — Ordinary bedside apprenticeship. Sustained corrected patient care teaches Nursing; G01 would also require complete Medicine and First Aid, which this narrower occupation does not necessarily teach.

### Possible Skill reach

- [Nursing](./skills.md#skill-nursing) — routes: direct Profession route (Ordinary bedside apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Nursing

- [Nursing](./skills.md#skill-nursing)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-philosopher"></a>

## Philosopher

**Learning Groups:** 0

None.

### Direct Skills

- [Philosophy](./skills.md#skill-philosophy) — Ordinary sustained philosophical study. Repeated argument and criticism directly teach Philosophy; no approved group covers the whole Skill.

### Possible Skill reach

- [Philosophy](./skills.md#skill-philosophy) — routes: direct Profession route (Ordinary sustained philosophical study)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Philosophy

- [Philosophy](./skills.md#skill-philosophy)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-physician"></a>

## Physician

**Learning Groups:** 1

### [Patient care](./learning-groups.md#group-g01)

**Profession route:** Ordinary clinical apprenticeship. Repeated cases expressly teach First Aid, Medicine and Nursing as complete practices.

- [First Aid](./skills.md#skill-skill-first-aid)
- [Medicine](./skills.md#skill-skill-medicine)
- [Nursing](./skills.md#skill-nursing)

### Direct Skills

None.

### Possible Skill reach

- [First Aid](./skills.md#skill-skill-first-aid) — routes: Patient care (Ordinary clinical apprenticeship)
- [Medicine](./skills.md#skill-skill-medicine) — routes: Patient care (Ordinary clinical apprenticeship)
- [Nursing](./skills.md#skill-nursing) — routes: Patient care (Ordinary clinical apprenticeship)

**Total possible distinct base Skills:** 3

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Patient care

**Direct base Skills:** None

- [First Aid](./skills.md#skill-skill-first-aid)
- [Medicine](./skills.md#skill-skill-medicine)
- [Nursing](./skills.md#skill-nursing)

**Effective distinct base-Skill breadth:** 3

### Reachable Specializations

- [Bone Setting](./skills.md#specialization-bone-setting) — parent: **Medicine**; routes: direct Profession route (Bone-setting specialist branch); immediate parent appears in this family envelope.
- [Diagnostic Medicine](./skills.md#specialization-spec-diagnostic-medicine) — parent: **Medicine**; routes: direct Profession route (Diagnostic specialist branch); immediate parent appears in this family envelope.
- [Poison Treatment](./skills.md#specialization-poison-treatment) — parent: **Medicine**; routes: direct Profession route (Poisoning-care specialist branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-political-agent-and-council-representative"></a>

## Political Agent and Council Representative

**Learning Groups:** 1

### [Council and mediation practice](./learning-groups.md#group-g10)

**Profession route:** Deliberative representative branch. A representative who receives full coached discussion training learns speech, Insight, Customs and Bargaining together.

- [Oratory](./skills.md#skill-skill-oratory)
- [Insight](./skills.md#skill-skill-insight)
- [Customs](./skills.md#skill-skill-customs)
- [Bargaining](./skills.md#skill-skill-bargaining)

### Direct Skills

- [Politics](./skills.md#skill-skill-politics) — Ordinary political apprenticeship. Mentored work teaches how institutions, interests and influence interact; no approved group includes the complete Politics Skill.

### Possible Skill reach

- [Bargaining](./skills.md#skill-skill-bargaining) — routes: Council and mediation practice (Deliberative representative branch)
- [Customs](./skills.md#skill-skill-customs) — routes: Council and mediation practice (Deliberative representative branch)
- [Insight](./skills.md#skill-skill-insight) — routes: Council and mediation practice (Deliberative representative branch)
- [Oratory](./skills.md#skill-skill-oratory) — routes: Council and mediation practice (Deliberative representative branch)
- [Politics](./skills.md#skill-skill-politics) — routes: direct Profession route (Ordinary political apprenticeship)

**Total possible distinct base Skills:** 5

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Council and mediation practice

**Direct base Skills:** Politics

- [Bargaining](./skills.md#skill-skill-bargaining)
- [Customs](./skills.md#skill-skill-customs)
- [Insight](./skills.md#skill-skill-insight)
- [Oratory](./skills.md#skill-skill-oratory)
- [Politics](./skills.md#skill-skill-politics)

**Effective distinct base-Skill breadth:** 5

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-potter"></a>

## Potter

**Learning Groups:** 1

### [Modelled ceramic workshop](./learning-groups.md#group-f21)

**Profession route:** Modelled-ceramic specialist route only. The workshop expressly teaches both complete Pottery and Sculpture through modelled ceramic work.

- [Pottery](./skills.md#skill-pottery)
- [Sculpture](./skills.md#skill-skill-sculpture)

### Direct Skills

- [Pottery](./skills.md#skill-pottery) — Ordinary vessel-pottery route. Repeated ceramic production teaches Pottery; F21 would overstate training in a workshop that does not teach complete Sculpture.

### Possible Skill reach

- [Pottery](./skills.md#skill-pottery) — routes: Modelled ceramic workshop (Modelled-ceramic specialist route only); direct Profession route (Ordinary vessel-pottery route)
- [Sculpture](./skills.md#skill-skill-sculpture) — routes: Modelled ceramic workshop (Modelled-ceramic specialist route only)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Modelled ceramic workshop

**Direct base Skills:** Pottery

- [Pottery](./skills.md#skill-pottery)
- [Sculpture](./skills.md#skill-skill-sculpture)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-religious-practitioner"></a>

## Religious Practitioner

**Learning Groups:** 0

None.

### Direct Skills

- [Religion](./skills.md#skill-skill-religion) — Ordinary tradition-specific instruction. Sustained teaching of the complete religious practice develops contextual Religion; no approved group includes it.
- [Meditation](./skills.md#skill-meditation) — Explicit preparatory-discipline branch. A teacher trains entry into and maintenance of the appropriate mental state before ceremonies or rituals; no group includes Meditation and prayer alone does not establish it.

### Possible Skill reach

- [Meditation](./skills.md#skill-meditation) — routes: direct Profession route (Explicit preparatory-discipline branch)
- [Religion](./skills.md#skill-skill-religion) — routes: direct Profession route (Ordinary tradition-specific instruction)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Religion; Meditation

- [Meditation](./skills.md#skill-meditation)
- [Religion](./skills.md#skill-skill-religion)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Theology](./skills.md#specialization-spec-theology) — parent: **Religion**; routes: direct Profession route (Systematic doctrinal specialist branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-sailmaker"></a>

## Sailmaker

**Learning Groups:** 0

None.

### Direct Skills

- [Sailmaking](./skills.md#skill-skill-sailmaking) — Ordinary sailmaking apprenticeship. Complete layout, construction and repair are directly taught; no approved group includes Sailmaking, and Tailoring does not represent it.

### Possible Skill reach

- [Sailmaking](./skills.md#skill-skill-sailmaking) — routes: direct Profession route (Ordinary sailmaking apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Sailmaking

- [Sailmaking](./skills.md#skill-skill-sailmaking)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-sailor-and-boat-worker"></a>

## Sailor and Boat Worker

**Learning Groups:** 4

### [Working a boat](./learning-groups.md#group-g06)

**Profession route:** General vessel-work route. Experienced crew repeatedly correct complete Seamanship during actual vessel work.

- [Seamanship](./skills.md#skill-skill-seamanship)

### [Rigged-vessel deck apprenticeship](./learning-groups.md#group-f09)

**Profession route:** Rigged-vessel apprenticeship; normally replaces G06 as the fuller route. Deck instruction teaches both Seamanship and complete Ropework, rather than a few memorized knots.

- [Seamanship](./skills.md#skill-skill-seamanship)
- [Ropework](./skills.md#skill-ropework)

### [One-handed edged close-combat practice](./learning-groups.md#group-g08)

**Profession route:** Edged-weapon armed-crew assignment. Additional paired instruction teaches the issued one-handed edged family together with Dodge and Parry.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Impact-weapon and rough-contact armed-crew assignment. Additional guard drill teaches its one-handed impact/axe family, both defences and Brawling.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### Direct Skills

None.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: Guard and rough-fighting drill (Impact-weapon and rough-contact armed-crew assignment)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed edged close-combat practice (Edged-weapon armed-crew assignment)
- [Brawling](./skills.md#skill-brawling) — routes: Guard and rough-fighting drill (Impact-weapon and rough-contact armed-crew assignment)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed edged close-combat practice (Edged-weapon armed-crew assignment); Guard and rough-fighting drill (Impact-weapon and rough-contact armed-crew assignment)
- [Parry](./skills.md#skill-parry) — routes: One-handed edged close-combat practice (Edged-weapon armed-crew assignment); Guard and rough-fighting drill (Impact-weapon and rough-contact armed-crew assignment)
- [Ropework](./skills.md#skill-ropework) — routes: Rigged-vessel deck apprenticeship (Rigged-vessel apprenticeship; normally replaces G06 as the fuller route)
- [Seamanship](./skills.md#skill-skill-seamanship) — routes: Working a boat (General vessel-work route); Rigged-vessel deck apprenticeship (Rigged-vessel apprenticeship; normally replaces G06 as the fuller route)

**Total possible distinct base Skills:** 7

### Effective package breadth by valid path

#### Family route — Rigged-vessel deck apprenticeship

**Learning Groups:** Rigged-vessel deck apprenticeship; One-handed edged close-combat practice; Guard and rough-fighting drill

**Direct base Skills:** None

**Excluded mutually exclusive alternative:** Working a boat

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Ropework](./skills.md#skill-ropework)
- [Seamanship](./skills.md#skill-skill-seamanship)

**Effective distinct base-Skill breadth:** 7

#### Family route — Working a boat

**Learning Groups:** Working a boat; One-handed edged close-combat practice; Guard and rough-fighting drill

**Direct base Skills:** None

**Excluded mutually exclusive alternative:** Rigged-vessel deck apprenticeship

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Seamanship](./skills.md#skill-skill-seamanship)

**Effective distinct base-Skill breadth:** 6

### Reachable Specializations

None.

### Mutually exclusive Learning Group routes

- **Rigged-vessel deck apprenticeship** or **Working a boat**; both may not be purchased through this Profession.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-scribe-and-copyist"></a>

## Scribe and Copyist

**Learning Groups:** 1

### [Records-office practice](./learning-groups.md#group-g11)

**Profession route:** Administrative-accounting scribe branch only. An office that actually teaches complete Administration and Bookkeeping can provide this additional apprenticeship.

- [Administration](./skills.md#skill-skill-administration)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

### Direct Skills

None.

### Possible Skill reach

- [Administration](./skills.md#skill-skill-administration) — routes: Records-office practice (Administrative-accounting scribe branch only)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping) — routes: Records-office practice (Administrative-accounting scribe branch only)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Records-office practice

**Direct base Skills:** None

- [Administration](./skills.md#skill-skill-administration)
- [Bookkeeping](./skills.md#skill-skill-bookkeeping)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-shipbuilder"></a>

## Shipbuilder

**Learning Groups:** 1

### [Timber vessel construction](./learning-groups.md#group-f03)

**Profession route:** Timber-vessel apprenticeship. The same complete projects directly teach Carpentry and Shipbuilding together.

- [Carpentry](./skills.md#skill-carpentry)
- [Shipbuilding](./skills.md#skill-skill-shipbuilding)

### Direct Skills

None.

### Possible Skill reach

- [Carpentry](./skills.md#skill-carpentry) — routes: Timber vessel construction (Timber-vessel apprenticeship)
- [Shipbuilding](./skills.md#skill-skill-shipbuilding) — routes: Timber vessel construction (Timber-vessel apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Timber vessel construction

**Direct base Skills:** None

- [Carpentry](./skills.md#skill-carpentry)
- [Shipbuilding](./skills.md#skill-skill-shipbuilding)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-shipmaster"></a>

## Shipmaster

**Learning Groups:** 4

### [Working a boat](./learning-groups.md#group-g06)

**Profession route:** Crew-service foundation. A working master learns complete Seamanship through repeated supervised vessel work.

- [Seamanship](./skills.md#skill-skill-seamanship)

### [Passage navigation](./learning-groups.md#group-g07)

**Profession route:** Navigating-master branch. Masters who navigate are taught the whole passage-and-pilotage practice.

- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Pilotage](./skills.md#skill-skill-pilotage)

### [Trading practice](./learning-groups.md#group-g12)

**Profession route:** Owner-trading master branch only. A master who personally trades receives coached buying, bargaining and appraisal, not merely cargo custody.

- [Trade](./skills.md#skill-skill-trade)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Appraisal](./skills.md#skill-skill-appraisal)

### [One-handed edged close-combat practice](./learning-groups.md#group-g08)

**Profession route:** Armed civilian command branch. If the master shares the crew’s edged-weapon fighting duties, the same complete compact course is expressly taught.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### Direct Skills

- [Leadership](./skills.md#skill-skill-leadership) — Working command apprenticeship. A senior master coaches delegation, motivation and coordination of the crew; G09 would improperly add Battle Tactics and Military Command.

### Possible Skill reach

- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed edged close-combat practice (Armed civilian command branch)
- [Appraisal](./skills.md#skill-skill-appraisal) — routes: Trading practice (Owner-trading master branch only)
- [Bargaining](./skills.md#skill-skill-bargaining) — routes: Trading practice (Owner-trading master branch only)
- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning) — routes: Passage navigation (Navigating-master branch)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed edged close-combat practice (Armed civilian command branch)
- [Leadership](./skills.md#skill-skill-leadership) — routes: direct Profession route (Working command apprenticeship)
- [Parry](./skills.md#skill-parry) — routes: One-handed edged close-combat practice (Armed civilian command branch)
- [Pilotage](./skills.md#skill-skill-pilotage) — routes: Passage navigation (Navigating-master branch)
- [Seamanship](./skills.md#skill-skill-seamanship) — routes: Working a boat (Crew-service foundation)
- [Trade](./skills.md#skill-skill-trade) — routes: Trading practice (Owner-trading master branch only)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Passage navigation (Navigating-master branch)

**Total possible distinct base Skills:** 11

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Working a boat; Passage navigation; Trading practice; One-handed edged close-combat practice

**Direct base Skills:** Leadership

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Appraisal](./skills.md#skill-skill-appraisal)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Dead Reckoning](./skills.md#skill-skill-dead-reckoning)
- [Dodge](./skills.md#skill-dodge)
- [Leadership](./skills.md#skill-skill-leadership)
- [Parry](./skills.md#skill-parry)
- [Pilotage](./skills.md#skill-skill-pilotage)
- [Seamanship](./skills.md#skill-skill-seamanship)
- [Trade](./skills.md#skill-skill-trade)
- [Wayfinding](./skills.md#skill-skill-wayfinding)

**Effective distinct base-Skill breadth:** 11

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-siege-engine-crew-specialist"></a>

## Siege Engine Crew Specialist

**Learning Groups:** 2

### [Military crossbow and formation practice](./learning-groups.md#group-f39)

**Profession route:** Existing Crossbow-family engine route. The specialist receives complete Crossbow and formation instruction in addition to engine-crew work. Explicit tracks: Existing Crossbow-family engine crew.

- [Crossbow](./skills.md#skill-crossbow)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [One-handed arms and formation drill](./learning-groups.md#group-f36)

**Profession route:** Military close-combat foundation. The crew member also trains the complete one-handed military course for the stated personal fighting equipment. Explicit tracks: Existing Crossbow-family engine crew.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### Direct Skills

- [Siege Engine Operation](./skills.md#skill-skill-siege-engine-operation) — Ordinary engine-crew apprenticeship. Supervised emplacement and operation of the whole engine teaches this distinct Skill; F39 explicitly excludes it. Tracks: Existing Crossbow-family engine crew.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: One-handed arms and formation drill (Military close-combat foundation)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed arms and formation drill (Military close-combat foundation)
- [Brawling](./skills.md#skill-brawling) — routes: One-handed arms and formation drill (Military close-combat foundation)
- [Crossbow](./skills.md#skill-crossbow) — routes: Military crossbow and formation practice (Existing Crossbow-family engine route)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed arms and formation drill (Military close-combat foundation)
- [Formation Fighting](./skills.md#skill-formation-fighting) — routes: Military crossbow and formation practice (Existing Crossbow-family engine route); One-handed arms and formation drill (Military close-combat foundation)
- [Parry](./skills.md#skill-parry) — routes: One-handed arms and formation drill (Military close-combat foundation)
- [Siege Engine Operation](./skills.md#skill-skill-siege-engine-operation) — routes: direct Profession route (Ordinary engine-crew apprenticeship)

**Total possible distinct base Skills:** 8

### Effective package breadth by valid path

#### Existing Crossbow-family engine crew

**Learning Groups:** Military crossbow and formation practice; One-handed arms and formation drill

**Direct base Skills:** Siege Engine Operation

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Brawling](./skills.md#skill-brawling)
- [Crossbow](./skills.md#skill-crossbow)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)
- [Siege Engine Operation](./skills.md#skill-skill-siege-engine-operation)

**Effective distinct base-Skill breadth:** 8

### Reachable Specializations

None.

### Explicit track source map

- **Existing Crossbow-family engine crew** — Military crossbow and formation practice; One-handed arms and formation drill; Siege Engine Operation

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-siege-engineer"></a>

## Siege Engineer

**Learning Groups:** 2

### [Timber millwright apprenticeship](./learning-groups.md#group-f27)

**Profession route:** Timber-mechanism apprenticeship. Where the engineer learns through timber mechanisms, complete Carpentry and Mechanics are both expressly taught. Explicit tracks: Technical siege specialist.

- [Carpentry](./skills.md#skill-carpentry)
- [Mechanics](./skills.md#skill-mechanics)

### [Building design and site surveying](./learning-groups.md#group-f28)

**Profession route:** Construction-design branch. A builder-engineer receives complete Architecture and Surveying instruction when responsible for designed site works. Explicit tracks: Technical siege specialist.

- [Architecture](./skills.md#skill-skill-architecture)
- [Surveying](./skills.md#skill-surveying)

### Direct Skills

- [Siege Engineering](./skills.md#skill-skill-siege-engineering) — Ordinary siege specialist instruction. The mentor teaches the technical design and conduct of siege works; no approved group includes this complete Skill. Tracks: Technical siege specialist.

### Possible Skill reach

- [Architecture](./skills.md#skill-skill-architecture) — routes: Building design and site surveying (Construction-design branch)
- [Carpentry](./skills.md#skill-carpentry) — routes: Timber millwright apprenticeship (Timber-mechanism apprenticeship)
- [Mechanics](./skills.md#skill-mechanics) — routes: Timber millwright apprenticeship (Timber-mechanism apprenticeship)
- [Siege Engineering](./skills.md#skill-skill-siege-engineering) — routes: direct Profession route (Ordinary siege specialist instruction)
- [Surveying](./skills.md#skill-surveying) — routes: Building design and site surveying (Construction-design branch)

**Total possible distinct base Skills:** 5

### Effective package breadth by valid path

#### Technical siege specialist

**Learning Groups:** Timber millwright apprenticeship; Building design and site surveying

**Direct base Skills:** Siege Engineering

- [Architecture](./skills.md#skill-skill-architecture)
- [Carpentry](./skills.md#skill-carpentry)
- [Mechanics](./skills.md#skill-mechanics)
- [Siege Engineering](./skills.md#skill-skill-siege-engineering)
- [Surveying](./skills.md#skill-surveying)

**Effective distinct base-Skill breadth:** 5

### Reachable Specializations

- [Fortification](./skills.md#specialization-spec-fortification) — parent: **Architecture**; routes: direct Profession route (Defensive-building specialist branch); immediate parent appears in this family envelope.

### Explicit track source map

- **Technical siege specialist** — Timber millwright apprenticeship; Building design and site surveying; Siege Engineering; Fortification

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-smelter"></a>

## Smelter

**Learning Groups:** 0

None.

### Direct Skills

- [Smelting](./skills.md#skill-skill-smelting) — Ordinary extraction apprenticeship. Repeated supervised extraction teaches Smelting; F24 would additionally require complete Smithing, absent in a stand-alone smelting occupation.

### Possible Skill reach

- [Smelting](./skills.md#skill-skill-smelting) — routes: direct Profession route (Ordinary extraction apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Smelting

- [Smelting](./skills.md#skill-skill-smelting)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-smith-and-weaponsmith"></a>

## Smith and Weaponsmith

**Learning Groups:** 3

### [Metalworking apprenticeship](./learning-groups.md#group-g13)

**Profession route:** General forge apprenticeship. Repeated workshop practice directly teaches the complete Smithing competence.

- [Smithing](./skills.md#skill-skill-smithing)

### [Ironmaking and forge apprenticeship](./learning-groups.md#group-f24)

**Profession route:** Integrated ironmaking-forge branch. The same learners are taught complete Smelting and Smithing rather than just receiving prepared metal.

- [Smelting](./skills.md#skill-skill-smelting)
- [Smithing](./skills.md#skill-skill-smithing)

### [Weapon-forge and servicing apprenticeship](./learning-groups.md#group-f25)

**Profession route:** Weapon-forge branch. Weapon production and servicing expressly teach Smithing, Weapon Maintenance and Weaponsmithing.

- [Smithing](./skills.md#skill-skill-smithing)
- [Weapon Maintenance](./skills.md#skill-weapon-maintenance)

### Direct Skills

None.

### Possible Skill reach

- [Smelting](./skills.md#skill-skill-smelting) — routes: Ironmaking and forge apprenticeship (Integrated ironmaking-forge branch)
- [Smithing](./skills.md#skill-skill-smithing) — routes: Metalworking apprenticeship (General forge apprenticeship); Ironmaking and forge apprenticeship (Integrated ironmaking-forge branch); Weapon-forge and servicing apprenticeship (Weapon-forge branch)
- [Weapon Maintenance](./skills.md#skill-weapon-maintenance) — routes: Weapon-forge and servicing apprenticeship (Weapon-forge branch)

**Total possible distinct base Skills:** 3

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Metalworking apprenticeship; Ironmaking and forge apprenticeship; Weapon-forge and servicing apprenticeship

**Direct base Skills:** None

- [Smelting](./skills.md#skill-skill-smelting)
- [Smithing](./skills.md#skill-skill-smithing)
- [Weapon Maintenance](./skills.md#skill-weapon-maintenance)

**Effective distinct base-Skill breadth:** 3

### Reachable Specializations

- [Weaponsmithing](./skills.md#specialization-spec-weaponsmithing) — parent: **Smithing**; routes: Weapon-forge and servicing apprenticeship (Weapon-forge branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-smuggler-and-illicit-trader"></a>

## Smuggler and Illicit Trader

**Learning Groups:** 3

### [Trading practice](./learning-groups.md#group-g12)

**Profession route:** Trading apprenticeship. Actual buying and selling directly teaches Trade, Bargaining and Appraisal.

- [Trade](./skills.md#skill-skill-trade)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Appraisal](./skills.md#skill-skill-appraisal)

### [Working a boat](./learning-groups.md#group-g06)

**Profession route:** Working-boat carrier branch. A carrier who operates the vessel receives complete Seamanship instruction.

- [Seamanship](./skills.md#skill-skill-seamanship)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Overland carrier branch. Repeated journeys teach the whole route, weather and camp practice.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### Direct Skills

- [Conceal Object](./skills.md#skill-conceal-object) — Cargo-concealment branch. A mentor repeatedly corrects placement and concealment of goods; no approved group teaches this Skill.
- [Underworld](./skills.md#skill-skill-underworld) — Ordinary network apprenticeship. The practitioner learns the dealings and obligations of the particular illicit milieu; no group covers that contextual competence.

### Possible Skill reach

- [Appraisal](./skills.md#skill-skill-appraisal) — routes: Trading practice (Trading apprenticeship)
- [Bargaining](./skills.md#skill-skill-bargaining) — routes: Trading practice (Trading apprenticeship)
- [Conceal Object](./skills.md#skill-conceal-object) — routes: direct Profession route (Cargo-concealment branch)
- [Seamanship](./skills.md#skill-skill-seamanship) — routes: Working a boat (Working-boat carrier branch)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Overland carrier branch)
- [Trade](./skills.md#skill-skill-trade) — routes: Trading practice (Trading apprenticeship)
- [Underworld](./skills.md#skill-skill-underworld) — routes: direct Profession route (Ordinary network apprenticeship)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Overland carrier branch)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Overland carrier branch)

**Total possible distinct base Skills:** 9

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Trading practice; Working a boat; Field travel and camp practice

**Direct base Skills:** Conceal Object; Underworld

- [Appraisal](./skills.md#skill-skill-appraisal)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Conceal Object](./skills.md#skill-conceal-object)
- [Seamanship](./skills.md#skill-skill-seamanship)
- [Survival](./skills.md#skill-skill-survival)
- [Trade](./skills.md#skill-skill-trade)
- [Underworld](./skills.md#skill-skill-underworld)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 9

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-soldier"></a>

## Soldier

**Learning Groups:** 7

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Communal or household fighting contingent without formation service. Repeated organized fighting instruction teaches the available impact-weapon family, Dodge, Parry and Brawling; no edged equipment or formation is promised. Explicit tracks: Communal/household contingent.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### [One-handed arms and formation drill](./learning-groups.md#group-f36)

**Profession route:** One-handed formation route; melee foundation for ranged tracks below. Both one-handed families, both defences, Brawling and Formation Fighting are directly drilled. Explicit tracks: One-handed formation soldier, Military archer, Military crossbow soldier, Military firearms soldier, Two-handed detachment with one-handed sidearms and formation duties, Military longbow specialist.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Spear, sidearm and throwing formation drill](./learning-groups.md#group-f31)

**Profession route:** Alternative spear, sidearm and throwing formation route. The unit explicitly teaches Polearms, 1-h edged and Throwing along with both defences, Brawling and formation work. Explicit tracks: Spear, short-sword and throwing-spear soldier.

- [Polearms](./skills.md#skill-polearms)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Throwing](./skills.md#skill-throwing)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Two-handed military weapon practice](./learning-groups.md#group-f37)

**Profession route:** Two-handed specialist detachment. Both approved two-handed families and complete defensive/rough-combat practice are taught; formation service adds F36 only where that full course is also trained. Explicit tracks: Two-handed detachment without formation duties, Two-handed detachment with one-handed sidearms and formation duties.

- [2-h edged](./skills.md#skill-two-handed-edged)
- [2-h conc./axe](./skills.md#skill-two-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### [Military bow and formation practice](./learning-groups.md#group-f38)

**Profession route:** Military archer track, combined with F36. Bow and formation instruction supplement the separate complete melee foundation. Explicit tracks: Military archer, Military longbow specialist.

- [Bow](./skills.md#skill-bow)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Military crossbow and formation practice](./learning-groups.md#group-f39)

**Profession route:** Military crossbow track, combined with F36. Crossbow handling and formation instruction supplement the complete melee foundation. Explicit tracks: Military crossbow soldier.

- [Crossbow](./skills.md#skill-crossbow)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### [Military firearms and formation practice](./learning-groups.md#group-f40)

**Profession route:** Military firearms track, combined with F36. Handheld-firearms and formation instruction supplement the complete melee foundation. Explicit tracks: Military firearms soldier.

- [Firearms](./skills.md#skill-skill-firearms)
- [Formation Fighting](./skills.md#skill-formation-fighting)

### Direct Skills

- [Combat Experience](./skills.md#skill-combat-experience) — Experienced service only. Reviewed real fighting develops functioning under combat conditions; no group supplies it and recruit drill alone does not establish it. Tracks: Communal/household contingent, One-handed formation soldier, Spear, short-sword and throwing-spear soldier, Military archer, Military crossbow soldier, Military firearms soldier, Two-handed detachment without formation duties, Two-handed detachment with one-handed sidearms and formation duties, Military longbow specialist.
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — Mentored battlefield service only. Experienced soldiers teach interpretation of changing battlefield developments; no group teaches this whole awareness Skill. Tracks: Communal/household contingent, One-handed formation soldier, Spear, short-sword and throwing-spear soldier, Military archer, Military crossbow soldier, Military firearms soldier, Two-handed detachment without formation duties, Two-handed detachment with one-handed sidearms and formation duties, Military longbow specialist.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: Guard and rough-fighting drill (Communal or household fighting contingent without formation service); One-handed arms and formation drill (One-handed formation route; melee foundation for ranged tracks below)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed arms and formation drill (One-handed formation route; melee foundation for ranged tracks below); Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route)
- [2-h conc./axe](./skills.md#skill-two-handed-concussion-axe) — routes: Two-handed military weapon practice (Two-handed specialist detachment)
- [2-h edged](./skills.md#skill-two-handed-edged) — routes: Two-handed military weapon practice (Two-handed specialist detachment)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness) — routes: direct Profession route (Mentored battlefield service only)
- [Bow](./skills.md#skill-bow) — routes: Military bow and formation practice (Military archer track, combined with F36)
- [Brawling](./skills.md#skill-brawling) — routes: Guard and rough-fighting drill (Communal or household fighting contingent without formation service); One-handed arms and formation drill (One-handed formation route; melee foundation for ranged tracks below); Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route); Two-handed military weapon practice (Two-handed specialist detachment)
- [Combat Experience](./skills.md#skill-combat-experience) — routes: direct Profession route (Experienced service only)
- [Crossbow](./skills.md#skill-crossbow) — routes: Military crossbow and formation practice (Military crossbow track, combined with F36)
- [Dodge](./skills.md#skill-dodge) — routes: Guard and rough-fighting drill (Communal or household fighting contingent without formation service); One-handed arms and formation drill (One-handed formation route; melee foundation for ranged tracks below); Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route); Two-handed military weapon practice (Two-handed specialist detachment)
- [Firearms](./skills.md#skill-skill-firearms) — routes: Military firearms and formation practice (Military firearms track, combined with F36)
- [Formation Fighting](./skills.md#skill-formation-fighting) — routes: One-handed arms and formation drill (One-handed formation route; melee foundation for ranged tracks below); Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route); Military bow and formation practice (Military archer track, combined with F36); Military crossbow and formation practice (Military crossbow track, combined with F36); Military firearms and formation practice (Military firearms track, combined with F36)
- [Parry](./skills.md#skill-parry) — routes: Guard and rough-fighting drill (Communal or household fighting contingent without formation service); One-handed arms and formation drill (One-handed formation route; melee foundation for ranged tracks below); Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route); Two-handed military weapon practice (Two-handed specialist detachment)
- [Polearms](./skills.md#skill-polearms) — routes: Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route)
- [Throwing](./skills.md#skill-throwing) — routes: Spear, sidearm and throwing formation drill (Alternative spear, sidearm and throwing formation route)

**Total possible distinct base Skills:** 15

### Effective package breadth by valid path

#### Communal/household contingent

**Learning Groups:** Guard and rough-fighting drill

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 6

#### One-handed formation soldier

**Learning Groups:** One-handed arms and formation drill

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 8

#### Spear, short-sword and throwing-spear soldier

**Learning Groups:** Spear, sidearm and throwing formation drill

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)
- [Polearms](./skills.md#skill-polearms)
- [Throwing](./skills.md#skill-throwing)

**Effective distinct base-Skill breadth:** 9

#### Military archer

**Learning Groups:** One-handed arms and formation drill; Military bow and formation practice

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Bow](./skills.md#skill-bow)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 9

#### Military crossbow soldier

**Learning Groups:** One-handed arms and formation drill; Military crossbow and formation practice

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Crossbow](./skills.md#skill-crossbow)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 9

#### Military firearms soldier

**Learning Groups:** One-handed arms and formation drill; Military firearms and formation practice

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Firearms](./skills.md#skill-skill-firearms)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 9

#### Two-handed detachment without formation duties

**Learning Groups:** Two-handed military weapon practice

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [2-h conc./axe](./skills.md#skill-two-handed-concussion-axe)
- [2-h edged](./skills.md#skill-two-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 7

#### Two-handed detachment with one-handed sidearms and formation duties

**Learning Groups:** One-handed arms and formation drill; Two-handed military weapon practice

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [2-h conc./axe](./skills.md#skill-two-handed-concussion-axe)
- [2-h edged](./skills.md#skill-two-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 10

#### Military longbow specialist

**Learning Groups:** One-handed arms and formation drill; Military bow and formation practice

**Direct base Skills:** Combat Experience; Battlefield Awareness

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Battlefield Awareness](./skills.md#skill-battlefield-awareness)
- [Bow](./skills.md#skill-bow)
- [Brawling](./skills.md#skill-brawling)
- [Combat Experience](./skills.md#skill-combat-experience)
- [Dodge](./skills.md#skill-dodge)
- [Formation Fighting](./skills.md#skill-formation-fighting)
- [Parry](./skills.md#skill-parry)

**Effective distinct base-Skill breadth:** 9

### Reachable Specializations

- [Longbow](./skills.md#specialization-longbow) — parent: **Bow**; routes: direct Profession route (Explicit military-longbow specialist branch); immediate parent appears in this family envelope.

### Explicit track source map

- **Communal/household contingent** — Guard and rough-fighting drill; Combat Experience; Battlefield Awareness
- **One-handed formation soldier** — One-handed arms and formation drill; Combat Experience; Battlefield Awareness
- **Spear, short-sword and throwing-spear soldier** — Spear, sidearm and throwing formation drill; Combat Experience; Battlefield Awareness
- **Military archer** — One-handed arms and formation drill; Military bow and formation practice; Combat Experience; Battlefield Awareness
- **Military crossbow soldier** — One-handed arms and formation drill; Military crossbow and formation practice; Combat Experience; Battlefield Awareness
- **Military firearms soldier** — One-handed arms and formation drill; Military firearms and formation practice; Combat Experience; Battlefield Awareness
- **Two-handed detachment without formation duties** — Two-handed military weapon practice; Combat Experience; Battlefield Awareness
- **Two-handed detachment with one-handed sidearms and formation duties** — One-handed arms and formation drill; Two-handed military weapon practice; Combat Experience; Battlefield Awareness
- **Military longbow specialist** — One-handed arms and formation drill; Military bow and formation practice; Combat Experience; Battlefield Awareness; Longbow

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-spinner-and-weaver"></a>

## Spinner and Weaver

**Learning Groups:** 1

### [Fibre-to-cloth workshop practice](./learning-groups.md#group-f02)

**Profession route:** Combined fibre-to-cloth apprenticeship. The teacher develops complete Fibre Working and Weaving through the same chain of production.

- [Fibre Working](./skills.md#skill-skill-fibre-working)
- [Weaving](./skills.md#skill-weaving)

### Direct Skills

None.

### Possible Skill reach

- [Fibre Working](./skills.md#skill-skill-fibre-working) — routes: Fibre-to-cloth workshop practice (Combined fibre-to-cloth apprenticeship)
- [Weaving](./skills.md#skill-weaving) — routes: Fibre-to-cloth workshop practice (Combined fibre-to-cloth apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Fibre-to-cloth workshop practice

**Direct base Skills:** None

- [Fibre Working](./skills.md#skill-skill-fibre-working)
- [Weaving](./skills.md#skill-weaving)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

- [Cordage / Ropemaking](./skills.md#specialization-spec-cordage-ropemaking) — parent: **Fibre Working**; routes: direct Profession route (Ropemaking specialist branch); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-storyteller-and-poet"></a>

## Storyteller and Poet

**Learning Groups:** 1

### [Oral narrative composition and performance](./learning-groups.md#group-f19)

**Profession route:** Oral narrative-composition route. Coached composition and performance directly teach Storytelling and Poetry & Literary Composition together.

- [Storytelling](./skills.md#skill-storytelling)
- [Poetry & Literary Composition](./skills.md#skill-skill-poetry-literary-composition)

### Direct Skills

- [Poetry & Literary Composition](./skills.md#skill-skill-poetry-literary-composition) — Non-narrative or written-only composition route. Complete composition is taught directly; F19 would additionally require full Storytelling performance.

### Possible Skill reach

- [Poetry & Literary Composition](./skills.md#skill-skill-poetry-literary-composition) — routes: Oral narrative composition and performance (Oral narrative-composition route); direct Profession route (Non-narrative or written-only composition route)
- [Storytelling](./skills.md#skill-storytelling) — routes: Oral narrative composition and performance (Oral narrative-composition route)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Oral narrative composition and performance

**Direct base Skills:** Poetry & Literary Composition

- [Poetry & Literary Composition](./skills.md#skill-skill-poetry-literary-composition)
- [Storytelling](./skills.md#skill-storytelling)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-surgeon"></a>

## Surgeon

**Learning Groups:** 3

### [Operative care practice](./learning-groups.md#group-g18)

**Profession route:** Ordinary operative apprenticeship. The teacher directly develops Surgery and complete First Aid through operative and immediate care.

- [Surgery](./skills.md#skill-skill-surgery)
- [First Aid](./skills.md#skill-skill-first-aid)

### [Field surgical apprenticeship](./learning-groups.md#group-f29)

**Profession route:** Field surgical apprenticeship; specialist alternative. The same work expressly includes Battlefield Surgery alongside Surgery and First Aid.

- [First Aid](./skills.md#skill-skill-first-aid)
- [Surgery](./skills.md#skill-skill-surgery)

### [Patient care](./learning-groups.md#group-g01)

**Profession route:** Integrated physician-surgeon route only. A practitioner additionally taught the complete patient-care course learns Medicine and Nursing as well as First Aid.

- [First Aid](./skills.md#skill-skill-first-aid)
- [Medicine](./skills.md#skill-skill-medicine)
- [Nursing](./skills.md#skill-nursing)

### Direct Skills

None.

### Possible Skill reach

- [First Aid](./skills.md#skill-skill-first-aid) — routes: Operative care practice (Ordinary operative apprenticeship); Field surgical apprenticeship (Field surgical apprenticeship; specialist alternative); Patient care (Integrated physician-surgeon route only)
- [Medicine](./skills.md#skill-skill-medicine) — routes: Patient care (Integrated physician-surgeon route only)
- [Nursing](./skills.md#skill-nursing) — routes: Patient care (Integrated physician-surgeon route only)
- [Surgery](./skills.md#skill-skill-surgery) — routes: Operative care practice (Ordinary operative apprenticeship); Field surgical apprenticeship (Field surgical apprenticeship; specialist alternative)

**Total possible distinct base Skills:** 4

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Operative care practice; Field surgical apprenticeship; Patient care

**Direct base Skills:** None

- [First Aid](./skills.md#skill-skill-first-aid)
- [Medicine](./skills.md#skill-skill-medicine)
- [Nursing](./skills.md#skill-nursing)
- [Surgery](./skills.md#skill-skill-surgery)

**Effective distinct base-Skill breadth:** 4

### Reachable Specializations

- [Battlefield Surgery](./skills.md#specialization-battlefield-surgery) — parent: **Surgery**; routes: Field surgical apprenticeship (Field surgical apprenticeship; specialist alternative); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-surveyor-and-mapmaker"></a>

## Surveyor and Mapmaker

**Learning Groups:** 1

### [Field surveying and map production](./learning-groups.md#group-f01)

**Profession route:** Ordinary field-and-map apprenticeship. The complete Surveying and Cartography competences are repeatedly taught through one measured mapping project.

- [Surveying](./skills.md#skill-surveying)
- [Cartography](./skills.md#skill-skill-cartography)

### Direct Skills

None.

### Possible Skill reach

- [Cartography](./skills.md#skill-skill-cartography) — routes: Field surveying and map production (Ordinary field-and-map apprenticeship)
- [Surveying](./skills.md#skill-surveying) — routes: Field surveying and map production (Ordinary field-and-map apprenticeship)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Field surveying and map production

**Direct base Skills:** None

- [Cartography](./skills.md#skill-skill-cartography)
- [Surveying](./skills.md#skill-surveying)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-tailor"></a>

## Tailor

**Learning Groups:** 0

None.

### Direct Skills

- [Tailoring](./skills.md#skill-tailoring) — Ordinary clothing apprenticeship. Complete garment construction and fitting are repeatedly taught; no approved group includes Tailoring, and F02 teaches fibre and weaving instead.

### Possible Skill reach

- [Tailoring](./skills.md#skill-tailoring) — routes: direct Profession route (Ordinary clothing apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Tailoring

- [Tailoring](./skills.md#skill-tailoring)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-teacher"></a>

## Teacher

**Learning Groups:** 0

None.

### Direct Skills

- [Teaching](./skills.md#skill-skill-teaching) — Ordinary mentored teaching practice. Planning, observed lessons and correction teach the whole Teaching Skill; no approved Learning Group contains it.

### Possible Skill reach

- [Teaching](./skills.md#skill-skill-teaching) — routes: direct Profession route (Ordinary mentored teaching practice)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Teaching

- [Teaching](./skills.md#skill-skill-teaching)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-thief"></a>

## Thief

**Learning Groups:** 1

### [Covert entry practice](./learning-groups.md#group-g15)

**Profession route:** Burglar route. Repeated supervised entry teaches Stealth, deliberate Perception and Lockpicking together.

- [Stealth](./skills.md#skill-skill-stealth)
- [Perception](./skills.md#skill-skill-perception)
- [Lockpicking](./skills.md#skill-skill-lockpicking)

### Direct Skills

- [Sleight of Hand](./skills.md#skill-skill-sleight-of-hand) — Manual-theft route. Repeated coached manipulation develops the complete Skill; none of the approved groups teaches it.

### Possible Skill reach

- [Lockpicking](./skills.md#skill-skill-lockpicking) — routes: Covert entry practice (Burglar route)
- [Perception](./skills.md#skill-skill-perception) — routes: Covert entry practice (Burglar route)
- [Sleight of Hand](./skills.md#skill-skill-sleight-of-hand) — routes: direct Profession route (Manual-theft route)
- [Stealth](./skills.md#skill-skill-stealth) — routes: Covert entry practice (Burglar route)

**Total possible distinct base Skills:** 4

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Covert entry practice

**Direct base Skills:** Sleight of Hand

- [Lockpicking](./skills.md#skill-skill-lockpicking)
- [Perception](./skills.md#skill-skill-perception)
- [Sleight of Hand](./skills.md#skill-skill-sleight-of-hand)
- [Stealth](./skills.md#skill-skill-stealth)

**Effective distinct base-Skill breadth:** 4

### Reachable Specializations

- [Pickpocketing](./skills.md#specialization-spec-pickpocketing) — parent: **Sleight of Hand**; routes: direct Profession route (Specialist pocket-theft route); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-trader-and-merchant"></a>

## Trader and Merchant

**Learning Groups:** 4

### [Trading practice](./learning-groups.md#group-g12)

**Profession route:** Ordinary trade apprenticeship. Actual coached transactions teach Trade, Bargaining and Appraisal together.

- [Trade](./skills.md#skill-skill-trade)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Appraisal](./skills.md#skill-skill-appraisal)

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Overland travelling route. Travelling traders receive the whole field course when they plan and conduct their own journeys.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### [Draught-team and vehicle practice](./learning-groups.md#group-f06)

**Profession route:** Owner-driver route. Traders who drive their own draught teams are taught complete animal and vehicle handling.

- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Cart Driving](./skills.md#skill-skill-cart-driving)

### [One-handed edged close-combat practice](./learning-groups.md#group-g08)

**Profession route:** Armed travelling route only. Explicit weapon instruction supplies edged-weapon fighting and both defensive Skills.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### Direct Skills

None.

### Possible Skill reach

- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed edged close-combat practice (Armed travelling route only)
- [Animal Handling](./skills.md#skill-skill-animal-handling) — routes: Draught-team and vehicle practice (Owner-driver route)
- [Appraisal](./skills.md#skill-skill-appraisal) — routes: Trading practice (Ordinary trade apprenticeship)
- [Bargaining](./skills.md#skill-skill-bargaining) — routes: Trading practice (Ordinary trade apprenticeship)
- [Cart Driving](./skills.md#skill-skill-cart-driving) — routes: Draught-team and vehicle practice (Owner-driver route)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed edged close-combat practice (Armed travelling route only)
- [Parry](./skills.md#skill-parry) — routes: One-handed edged close-combat practice (Armed travelling route only)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Overland travelling route)
- [Trade](./skills.md#skill-skill-trade) — routes: Trading practice (Ordinary trade apprenticeship)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Overland travelling route)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Overland travelling route)

**Total possible distinct base Skills:** 11

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Trading practice; Field travel and camp practice; Draught-team and vehicle practice; One-handed edged close-combat practice

**Direct base Skills:** None

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Animal Handling](./skills.md#skill-skill-animal-handling)
- [Appraisal](./skills.md#skill-skill-appraisal)
- [Bargaining](./skills.md#skill-skill-bargaining)
- [Cart Driving](./skills.md#skill-skill-cart-driving)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Survival](./skills.md#skill-skill-survival)
- [Trade](./skills.md#skill-skill-trade)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 11

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-translator-and-interpreter"></a>

## Translator and Interpreter

**Learning Groups:** 0

None.

### Direct Skills

- [Translation & Interpretation](./skills.md#skill-skill-translation-interpretation) — Ordinary specialist language-service training. Repeated coached renderings teach the complete Skill; none of the approved groups teaches it.

### Possible Skill reach

- [Translation & Interpretation](./skills.md#skill-skill-translation-interpretation) — routes: direct Profession route (Ordinary specialist language-service training)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Translation & Interpretation

- [Translation & Interpretation](./skills.md#skill-skill-translation-interpretation)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-trapmaker"></a>

## Trapmaker

**Learning Groups:** 0

None.

### Direct Skills

- [Trapmaking](./skills.md#skill-skill-trapmaking) — Ordinary specialist construction practice. Repeated design, testing and technical servicing teach Trapmaking; F34 teaches animal trapping and tracking instead.

### Possible Skill reach

- [Trapmaking](./skills.md#skill-skill-trapmaking) — routes: direct Profession route (Ordinary specialist construction practice)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Trapmaking

- [Trapmaking](./skills.md#skill-skill-trapmaking)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-veterinary-practitioner"></a>

## Veterinary Practitioner

**Learning Groups:** 0

None.

### Direct Skills

- [Veterinary Medicine](./skills.md#skill-skill-veterinary-medicine) — Ordinary animal-clinical apprenticeship. Repeated mentored investigation and treatment teaches the complete Skill; animal groups teach handling, husbandry, herding or riding instead of clinical practice.

### Possible Skill reach

- [Veterinary Medicine](./skills.md#skill-skill-veterinary-medicine) — routes: direct Profession route (Ordinary animal-clinical apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Veterinary Medicine

- [Veterinary Medicine](./skills.md#skill-skill-veterinary-medicine)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-vintner"></a>

## Vintner

**Learning Groups:** 0

None.

### Direct Skills

- [Winemaking](./skills.md#skill-skill-winemaking) — Ordinary wine-production apprenticeship. Repeated supervised production teaches Winemaking; no approved group covers it.

### Possible Skill reach

- [Winemaking](./skills.md#skill-skill-winemaking) — routes: direct Profession route (Ordinary wine-production apprenticeship)

**Total possible distinct base Skills:** 1

### Effective package breadth by valid path

#### Family route

**Learning Groups:** None

**Direct base Skills:** Winemaking

- [Winemaking](./skills.md#skill-skill-winemaking)

**Effective distinct base-Skill breadth:** 1

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-visual-artist-and-sculptor"></a>

## Visual Artist and Sculptor

**Learning Groups:** 1

### [Drawing and modelling workshop](./learning-groups.md#group-f20)

**Profession route:** Drawing-and-modelling workshop. Complete Visual Art and Sculpture are deliberately taught together through complementary studies and finished work.

- [Visual Art](./skills.md#skill-skill-visual-art)
- [Sculpture](./skills.md#skill-skill-sculpture)

### Direct Skills

- [Visual Art](./skills.md#skill-skill-visual-art) — Pictorial-only workshop. Complete image-making is taught directly; F20 would additionally require Sculpture.
- [Sculpture](./skills.md#skill-skill-sculpture) — Sculpture-only workshop. Complete three-dimensional artistic work is taught directly; F20 adds Visual Art and F21 adds Pottery, neither inevitable in this route.

### Possible Skill reach

- [Sculpture](./skills.md#skill-skill-sculpture) — routes: Drawing and modelling workshop (Drawing-and-modelling workshop); direct Profession route (Sculpture-only workshop)
- [Visual Art](./skills.md#skill-skill-visual-art) — routes: Drawing and modelling workshop (Drawing-and-modelling workshop); direct Profession route (Pictorial-only workshop)

**Total possible distinct base Skills:** 2

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Drawing and modelling workshop

**Direct base Skills:** Visual Art; Sculpture

- [Sculpture](./skills.md#skill-skill-sculpture)
- [Visual Art](./skills.md#skill-skill-visual-art)

**Effective distinct base-Skill breadth:** 2

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-weapon-instructor"></a>

## Weapon Instructor

**Learning Groups:** 3

### [One-handed edged close-combat practice](./learning-groups.md#group-g08)

**Profession route:** Compact edged-weapon instructor route. The teacher’s own training develops the complete edged-weapon, Dodge and Parry course.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### [Guard and rough-fighting drill](./learning-groups.md#group-f35)

**Profession route:** Guard-practice instructor route. The teacher learns the complete impact-weapon, defensive and rough-fighting curriculum.

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Brawling](./skills.md#skill-brawling)

### [Swashbuckling fencing instruction](./learning-groups.md#group-f30)

**Profession route:** Swashbuckling Fencing instructor route. The school explicitly teaches 1-h edged, Dodge, Parry and the established Fencing specialization.

- [1-h edged](./skills.md#skill-one-handed-edged)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)

### Direct Skills

- [Teaching](./skills.md#skill-skill-teaching) — Instructional apprenticeship. Observed lessons and mentored correction train Teaching itself; no martial group automatically supplies it.

### Possible Skill reach

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe) — routes: Guard and rough-fighting drill (Guard-practice instructor route)
- [1-h edged](./skills.md#skill-one-handed-edged) — routes: One-handed edged close-combat practice (Compact edged-weapon instructor route); Swashbuckling fencing instruction (Swashbuckling Fencing instructor route)
- [Brawling](./skills.md#skill-brawling) — routes: Guard and rough-fighting drill (Guard-practice instructor route)
- [Dodge](./skills.md#skill-dodge) — routes: One-handed edged close-combat practice (Compact edged-weapon instructor route); Guard and rough-fighting drill (Guard-practice instructor route); Swashbuckling fencing instruction (Swashbuckling Fencing instructor route)
- [Parry](./skills.md#skill-parry) — routes: One-handed edged close-combat practice (Compact edged-weapon instructor route); Guard and rough-fighting drill (Guard-practice instructor route); Swashbuckling fencing instruction (Swashbuckling Fencing instructor route)
- [Teaching](./skills.md#skill-skill-teaching) — routes: direct Profession route (Instructional apprenticeship)

**Total possible distinct base Skills:** 6

### Effective package breadth by valid path

#### Family route

**Learning Groups:** One-handed edged close-combat practice; Guard and rough-fighting drill; Swashbuckling fencing instruction

**Direct base Skills:** Teaching

- [1-h conc./axe](./skills.md#skill-one-handed-concussion-axe)
- [1-h edged](./skills.md#skill-one-handed-edged)
- [Brawling](./skills.md#skill-brawling)
- [Dodge](./skills.md#skill-dodge)
- [Parry](./skills.md#skill-parry)
- [Teaching](./skills.md#skill-skill-teaching)

**Effective distinct base-Skill breadth:** 6

### Reachable Specializations

- [Fencing](./skills.md#specialization-fencing) — parent: **1-h edged**; routes: Swashbuckling fencing instruction (Swashbuckling Fencing instructor route); immediate parent appears in this family envelope.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

<a id="profession-map-wild-plant-gatherer"></a>

## Wild Plant Gatherer

**Learning Groups:** 1

### [Field travel and camp practice](./learning-groups.md#group-g04)

**Profession route:** Travelling collection route. Supervised collecting journeys also teach route finding, weather judgment and camp practice when these receive sustained instruction.

- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

### Direct Skills

- [Plant Lore](./skills.md#skill-skill-plant-lore) — Ordinary plant apprenticeship. Identification, habitat and properties are taught directly; G02 would additionally require the complete Pharmacy practice.
- [Climbing](./skills.md#skill-climb) — Cliff or canopy collection specialist only. Repeated coached access to difficult gathering sites develops Climbing; no approved group teaches it.

### Possible Skill reach

- [Climbing](./skills.md#skill-climb) — routes: direct Profession route (Cliff or canopy collection specialist only)
- [Plant Lore](./skills.md#skill-skill-plant-lore) — routes: direct Profession route (Ordinary plant apprenticeship)
- [Survival](./skills.md#skill-skill-survival) — routes: Field travel and camp practice (Travelling collection route)
- [Wayfinding](./skills.md#skill-skill-wayfinding) — routes: Field travel and camp practice (Travelling collection route)
- [Weather Lore](./skills.md#skill-skill-weather-lore) — routes: Field travel and camp practice (Travelling collection route)

**Total possible distinct base Skills:** 5

### Effective package breadth by valid path

#### Family route

**Learning Groups:** Field travel and camp practice

**Direct base Skills:** Plant Lore; Climbing

- [Climbing](./skills.md#skill-climb)
- [Plant Lore](./skills.md#skill-skill-plant-lore)
- [Survival](./skills.md#skill-skill-survival)
- [Wayfinding](./skills.md#skill-skill-wayfinding)
- [Weather Lore](./skills.md#skill-skill-weather-lore)

**Effective distinct base-Skill breadth:** 5

### Reachable Specializations

None.

**Contextual availability:** unresolved; this does not block general, unbound reference use.

## Extraction diagnostics

Possible-reach union distribution: minimum 0; lower quartile 1; median 2; upper quartile 5; maximum 18. Effective single-path distribution: minimum 0; median 3; maximum 17. These are observations, not Profession-quality rules.

### Approximate 10-Skill authoring target

The Product Owner's target is approximately 10 effective base Skills for an ordinary Profession. It is a review aid, not a quota; specialist coherence and lower-Society-Level breadth remain legitimate reasons for a smaller package. The following families have every currently valid path below 10 and therefore merit review rather than automatic expansion:

- Actor and Dancer: Family route 2
- Alchemist: Family route 1
- Animal Trainer and Falconer: Family route 2
- Armorer: Family route 2
- Astrologer: Family route 1
- Astronomer: Family route 1
- Athlete and Physical Performer: Family route 2
- Banker and Credit Practitioner: Family route 2
- Birth Attendant and Midwife: Family route 0
- Brewer: Family route 1
- Building Designer: Family route 2
- Campaign Planner: Campaign adviser 4
- Carpenter: Family route 1
- Clerk and Steward: Family route 2
- Confidence Trickster: Family route 2
- Cook: Family route 1
- Courier and Messenger: Family route 7
- Distiller: Family route 1
- Diver and Water Worker: Family route 2
- Diviner: Family route 1
- Document Forger: Family route 1
- Driver and Teamster: Family route 5
- Enforcer: Family route 6
- Envoy: Family route 6
- Farmer: Family route 2
- Field and Caravan Guide: Family route 9
- Fisher: Family route 2
- Gambler: Family route 1
- Geographer: Family route 3
- Guard, Watcher and Escort: Family route — Swashbuckling fencing instruction 8; Family route — One-handed edged close-combat practice 8
- Herald: Family route 4
- Herbalist and Remedy Maker: Family route 3
- Herd Keeper: Family route 5
- Historian and Genealogist: Family route 3
- Hunter and Trapper: Family route 9
- Investigator and Intelligence Agent: Family route 7
- Leatherworker: Family route 1
- Legal Practitioner and Advocate: Family route 2
- Local Informant: Family route 3
- Locksmith: Family route 1
- Mason: Family route 1
- Mathematical Practitioner: Family route 1
- Mediator and Community Convenor: Family route 4
- Millwright and Mechanician: Family route 2
- Miner and Quarry Worker: Family route 1
- Musician and Singer: Family route 2
- Naturalist: Family route 2
- Navigator and Pilot: Family route 6
- Nurse and Patient Attendant: Family route 1
- Philosopher: Family route 1
- Physician: Family route 3
- Political Agent and Council Representative: Family route 5
- Potter: Family route 2
- Religious Practitioner: Family route 2
- Sailmaker: Family route 1
- Sailor and Boat Worker: Family route — Rigged-vessel deck apprenticeship 7; Family route — Working a boat 6
- Scribe and Copyist: Family route 2
- Shipbuilder: Family route 2
- Siege Engine Crew Specialist: Existing Crossbow-family engine crew 8
- Siege Engineer: Technical siege specialist 5
- Smelter: Family route 1
- Smith and Weaponsmith: Family route 3
- Smuggler and Illicit Trader: Family route 9
- Spinner and Weaver: Family route 2
- Storyteller and Poet: Family route 2
- Surgeon: Family route 4
- Surveyor and Mapmaker: Family route 2
- Tailor: Family route 1
- Teacher: Family route 1
- Thief: Family route 4
- Translator and Interpreter: Family route 1
- Trapmaker: Family route 1
- Veterinary Practitioner: Family route 1
- Vintner: Family route 1
- Visual Artist and Sculptor: Family route 2
- Weapon Instructor: Family route 6
- Wild Plant Gatherer: Family route 5

### Professions with 0 base Skills

- Birth Attendant and Midwife

### Professions with 1 base Skill

- Alchemist
- Astrologer
- Astronomer
- Brewer
- Carpenter
- Cook
- Distiller
- Diviner
- Document Forger
- Gambler
- Leatherworker
- Locksmith
- Mason
- Mathematical Practitioner
- Miner and Quarry Worker
- Nurse and Patient Attendant
- Philosopher
- Sailmaker
- Smelter
- Tailor
- Teacher
- Translator and Interpreter
- Trapmaker
- Veterinary Practitioner
- Vintner

### Professions with 2–3 base Skills

- Actor and Dancer
- Animal Trainer and Falconer
- Armorer
- Athlete and Physical Performer
- Banker and Credit Practitioner
- Building Designer
- Clerk and Steward
- Confidence Trickster
- Diver and Water Worker
- Farmer
- Fisher
- Geographer
- Herbalist and Remedy Maker
- Historian and Genealogist
- Legal Practitioner and Advocate
- Local Informant
- Millwright and Mechanician
- Musician and Singer
- Naturalist
- Physician
- Potter
- Religious Practitioner
- Scribe and Copyist
- Shipbuilder
- Smith and Weaponsmith
- Spinner and Weaver
- Storyteller and Poet
- Surveyor and Mapmaker
- Visual Artist and Sculptor

### Statistically high base-Skill counts

Using the descriptive Tukey upper fence (> 11), without treating it as a design limit:

- Military Commander: 14
- Military Scout: 18
- Soldier: 15

### Professions with exactly one Learning Group

- Actor and Dancer
- Animal Trainer and Falconer
- Armorer
- Athlete and Physical Performer
- Banker and Credit Practitioner
- Building Designer
- Campaign Planner
- Clerk and Steward
- Confidence Trickster
- Cook
- Diver and Water Worker
- Enforcer
- Farmer
- Fisher
- Geographer
- Legal Practitioner and Advocate
- Local Informant
- Mediator and Community Convenor
- Millwright and Mechanician
- Musician and Singer
- Physician
- Political Agent and Council Representative
- Potter
- Scribe and Copyist
- Shipbuilder
- Spinner and Weaver
- Storyteller and Poet
- Surveyor and Mapmaker
- Thief
- Visual Artist and Sculptor
- Wild Plant Gatherer

### Professions with no Learning Group

- Alchemist
- Astrologer
- Astronomer
- Birth Attendant and Midwife
- Brewer
- Carpenter
- Distiller
- Diviner
- Document Forger
- Gambler
- Leatherworker
- Locksmith
- Mason
- Mathematical Practitioner
- Miner and Quarry Worker
- Naturalist
- Nurse and Patient Attendant
- Philosopher
- Religious Practitioner
- Sailmaker
- Smelter
- Tailor
- Teacher
- Translator and Interpreter
- Trapmaker
- Veterinary Practitioner
- Vintner

These families normally use direct base-Skill routes. Birth Attendant and Midwife instead has only a direct Obstetrics Specialization in the current catalogue.

### Direct-Skill-heavy Professions

The following have more direct base-Skill routes than distinct group-derived base Skills:

- Alchemist: 1 direct routes; 0 group-derived base Skills
- Astrologer: 1 direct routes; 0 group-derived base Skills
- Astronomer: 1 direct routes; 0 group-derived base Skills
- Brewer: 1 direct routes; 0 group-derived base Skills
- Carpenter: 1 direct routes; 0 group-derived base Skills
- Distiller: 1 direct routes; 0 group-derived base Skills
- Diviner: 1 direct routes; 0 group-derived base Skills
- Document Forger: 1 direct routes; 0 group-derived base Skills
- Gambler: 1 direct routes; 0 group-derived base Skills
- Leatherworker: 1 direct routes; 0 group-derived base Skills
- Locksmith: 1 direct routes; 0 group-derived base Skills
- Mason: 1 direct routes; 0 group-derived base Skills
- Mathematical Practitioner: 1 direct routes; 0 group-derived base Skills
- Miner and Quarry Worker: 1 direct routes; 0 group-derived base Skills
- Naturalist: 2 direct routes; 0 group-derived base Skills
- Nurse and Patient Attendant: 1 direct routes; 0 group-derived base Skills
- Philosopher: 1 direct routes; 0 group-derived base Skills
- Religious Practitioner: 2 direct routes; 0 group-derived base Skills
- Sailmaker: 1 direct routes; 0 group-derived base Skills
- Smelter: 1 direct routes; 0 group-derived base Skills
- Tailor: 1 direct routes; 0 group-derived base Skills
- Teacher: 1 direct routes; 0 group-derived base Skills
- Translator and Interpreter: 1 direct routes; 0 group-derived base Skills
- Trapmaker: 1 direct routes; 0 group-derived base Skills
- Veterinary Practitioner: 1 direct routes; 0 group-derived base Skills
- Vintner: 1 direct routes; 0 group-derived base Skills

### Similar Learning Group base-Skill sets

Pairs below share at least 60% of their combined base-Skill set. Explicit Specializations and training context can still distinguish them.

- G08 **One-handed edged close-combat practice** / F30 **Swashbuckling fencing instruction**: 3/3 shared-union coverage (1.000); shared: 1-h edged, Dodge, Parry; G08 Specializations: none; F30 Specializations: Fencing.
- G18 **Operative care practice** / F29 **Field surgical apprenticeship**: 2/2 shared-union coverage (1.000); shared: First Aid, Surgery; G18 Specializations: none; F29 Specializations: Battlefield Surgery.
- F31 **Spear, sidearm and throwing formation drill** / F36 **One-handed arms and formation drill**: 5/8 shared-union coverage (0.625); shared: 1-h edged, Brawling, Dodge, Formation Fighting, Parry; No explicit Specialization distinction.
- F32 **Mounted lance and troop drill** / F36 **One-handed arms and formation drill**: 5/8 shared-union coverage (0.625); shared: 1-h edged, Brawling, Dodge, Formation Fighting, Parry; No explicit Specialization distinction.
- F35 **Guard and rough-fighting drill** / F36 **One-handed arms and formation drill**: 4/6 shared-union coverage (0.667); shared: 1-h conc./axe, Brawling, Dodge, Parry; No explicit Specialization distinction.

### Eligibility and binding cautions

These are not missing catalogue references. They are current routes whose immediate parent or contextual identity is not supplied by the same Profession envelope:

- Birth Attendant and Midwife: Obstetrics requires immediate parent Medicine through another approved route.
- Herald: Courtly Protocol requires immediate parent Customs through another approved route.
- Herald: Genealogy requires immediate parent History through another approved route.
- Scribe and Copyist has an explicitly unbound Written Tradition core; no exact Written Tradition is counted or invented.
- Poisons and Warded-Lock Entry intentionally have no generic Profession route.

### Integrity result

- 84 Profession families extracted.
- 115 Profession → Learning Group opportunities resolved to all 59 approved groups.
- 69 direct base-Skill and 19 direct Specialization opportunities resolved to approved target identities.
- 0 missing Profession → Learning Group targets.
- 0 missing Profession → competency targets.
- 0 missing or mismatched Learning Group members.
- 0 track-family opportunities are outside every explicit track.
- Specialization parent eligibility remains independent and is never synthesized by this extraction.

Machine mapping digest: `sha256:d05e74b5090b5f9ddb69871fc40cccd20746c3e2d8b764d4ac98e320cdbb65be`.
