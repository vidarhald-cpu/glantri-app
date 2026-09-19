# Proposed Professions and valid paths (V2)

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with
> Chargen, not projected into canonical content, and does not replace any approved catalogue.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

All 84 approved Profession families are preserved. They yield 96 valid paths (the approved catalogue yields 99). Mutually exclusive tracks are evaluated separately; Specializations never count toward base-Skill breadth.

### P01 — Hunter and Trapper

- **G03** — _Ordinary hunting apprenticeship_
- **F34** — _Trapline service_
- **G04** — _Season away from settlement_
- **F41** — _Longbow hunting tradition_
- _Taught directly by the hunter one works beside_: Animal Lore

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Hunter and Trapper |                             10 |                        0 |                                       10 |

### P02 — Wild Plant Gatherer

- **G04** — _Seasonal collecting rounds_
- **G02** — _Supplying and preparing for a remedy maker_
- **G12** — _Selling the season's collection_
- _Taught directly on the collecting rounds_: Climbing, Animal Lore

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Wild Plant Gatherer |                             10 |                        0 |                                       10 |

### P03 — Field and Caravan Guide

- **G04** — _Ordinary guiding service_
- **G05** — _Mounted route service_
- **F06** — _Caravan vehicle service_
- **M01** — _Escort self-defence instruction_
- _Taught directly by the guide one travels with_: Geography

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Field and Caravan Guide |                             11 |                        1 |                                       10 |

### P04 — Fisher

- **F10** — _Ordinary fishing-boat apprenticeship_
- **N01** — _Working the family boat_
- **G12** — _Selling the catch_
- _Taught directly aboard and on the shore_: Survival, Animal Lore

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Fisher     |                             10 |                        0 |                                       10 |

### P05 — Farmer

- **F08** — _Ordinary holding apprenticeship_
- **F05** — _Keeping the holding's stock_
- **F06** — _Carting to market_
- **F22** — _Household kitchen and storing the season_
- _Taught directly in the working year of the holding_: Weather Lore, Plant Lore, Appraisal, Bargaining

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Farmer     |                             10 |                        0 |                                       10 |

### P06 — Herd Keeper

- **F05** — _Ordinary stockkeeping apprenticeship_
- **G05** — _Mounted herding service_
- **G04** — _Seasonal movement with the herd_
- **F02** — _Household fibre and cloth work from the clip_
- _Taught directly by the herd owner and the older keepers_: Sling, Animal Lore, Steppe Remount Training

| Valid path  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Herd Keeper |                             11 |                        0 |                                       11 |

### P07 — Animal Trainer and Falconer

- **F07** — _Falconry apprenticeship_
- **F05** — _Keeping the animals in condition_
- **G05** — _Mounted work with trained animals_
- **K13** — _Treating the animals in one's charge_
- **G03** — _Hunting with what one has trained_
- _Taught directly in the mews and the yard_: Animal Lore

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Animal Trainer and Falconer |                             10 |                        0 |                                       10 |

### P08 — Driver and Teamster

- **F06** — _Ordinary driving apprenticeship_
- **G04** — _Long-distance caravan service_
- **G05** — _Riding with the team_
- **G12** — _Carrying goods on one's own account_
- _Taught directly on the road and in the yard_: Carpentry

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Driver and Teamster |                             10 |                        0 |                                       10 |

### P09 — Sailor and Boat Worker

- **M01** — _Rough shipboard fighting instruction_
- _Taught directly by the crew one sails with_: Climbing, Perception, Swimming

Mutually exclusive tracks:

- **Small-craft boat worker** — N01 (_Working a boat_)
- **Rigged-vessel deck hand** — F09 (_Rigged-vessel deck apprenticeship_)

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Small-craft boat worker |                             10 |                        1 |                                        9 |
| Rigged-vessel deck hand |                             10 |                        1 |                                        9 |

> The two deck practices remain alternatives, as recorded for the approved catalogue's Sailor exclusion pair.

### P10 — Navigator and Pilot

- **G07** — _Entrusted coastal passage work_
- **F11** — _Charted open-water instruction_
- **N01** — _Deck grounding before navigation_
- _Taught directly by the pilot one serves under_: Cartography, Mathematics, Geography

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Navigator and Pilot |                             12 |                        0 |                                       12 |

### P11 — Shipmaster

- **F09** — _Deck service before command_
- **G07** — _Responsibility for the passage_
- **G12** — _Trading the voyage_
- _Taught directly by the master one serves under_: Leadership, Bookkeeping

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Shipmaster |                             12 |                        0 |                                       12 |

### P12 — Courier and Messenger

- **F04** — _Conditioning for the road_
- **G05** — _Mounted stage service_
- **G04** — _Carrying across open country_
- _Taught directly by the stage or household one carries for_: Geography, Customs

| Valid path            | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Courier and Messenger |                             11 |                        0 |                                       11 |

### P13 — Trader and Merchant

- **G12** — _Ordinary trading apprenticeship_
- **G11** — _Keeping the house's records_
- **G04** — _Travelling the route personally_
- **F06** — _Moving one's own goods_
- _Taught directly in the counting house and on the road_: Customs, Mathematics

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Trader and Merchant |                             12 |                        0 |                                       12 |

### P14 — Guard, Watcher and Escort

- **G04** — _Escort duty away from the town_
- _Taught directly on watch and on escort_: Perception, Streetwise, Intimidation, Combat Experience

Mutually exclusive tracks:

- **Rough-fighting guard** — M01 (_Guard and rough-fighting drill_)
- **Fencing-trained escort** — F30 (_Swashbuckling fencing instruction_)

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Rough-fighting guard   |                             11 |                        1 |                                       10 |
| Fencing-trained escort |                             10 |                        0 |                                       10 |

> Preserves the approved catalogue's Guard exclusion pair as two explicitly separate valid paths.

### P15 — Enforcer

- **K23** — _Ordinary coercive service_
- **M01** — _Rough-fighting instruction_
- **G14** — _Knowing the district one works_
- _Taught directly by the enterprise one works for_: Perception, Conceal Object

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Enforcer   |                             11 |                        1 |                                       10 |

### P16 — Local Informant

- **G14** — _Ordinary informant practice_
- **K18** — _Standing in an illicit milieu_
- **G16** — _Passing unremarked where one does not belong_
- _Taught directly through the district one works_: Perception, Customs, Mnemonics, Bargaining

| Valid path      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Local Informant |                             10 |                        0 |                                       10 |

### P17 — Investigator and Intelligence Agent

- **G17** — _Entrusted inquiry apprenticeship_
- **G14** — _Working local contacts_
- **G16** — _Approach under another identity_
- _Taught directly by the mentor conducting the inquiry_: Stealth, Law, Mnemonics

| Valid path                          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Investigator and Intelligence Agent |                             10 |                        0 |                                       10 |

### P18 — Thief

- **G15** — _Ordinary covert-entry instruction_
- **K18** — _Standing in an illicit milieu_
- _Taught directly by an established thief_: Sleight of Hand, Climbing, Appraisal, Disguise, Pickpocketing

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Thief      |                             10 |                        0 |                                       10 |

### P19 — Confidence Trickster

- **G16** — _Ordinary impersonation practice_
- **G14** — _Finding the mark_
- **K17** — _Working the gaming tables_
- _Taught directly by the trickster one works with_: Customs, Oratory, Appraisal, Bargaining

| Valid path           | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Confidence Trickster |                             10 |                        0 |                                       10 |

### P20 — Smuggler and Illicit Trader

- **G12** — _Trading what is carried_
- **K18** — _Standing in an illicit milieu_
- **N01** — _Running the boat oneself_
- **G04** — _Overland crossing away from the road_

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Smuggler and Illicit Trader |                             12 |                        0 |                                       12 |

### P21 — Document Forger

- **K16** — _Ordinary forging apprenticeship_
- **G11** — _Service inside a records office_
- **F15** — _Study of older hands_
- **K18** — _Placing the work through an illicit milieu_
- _Taught directly by the forger one trains under_: Visual Art, Customs

| Valid path      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Document Forger |                             11 |                        0 |                                       11 |

### P22 — Soldier

- **M06** — _Repeated service in the field_
- **G04** — _Marching and camping with the force_
- _Taught directly in drill and on the march_: Athletics

Mutually exclusive tracks:

- **Communal/household contingent** — M01 (_Contingent fighting drill_)
- **Close-order formation soldier** — M03 (_Formation arms drill_)
- **Missile soldier** — M04 (_Issued missile arm and formation drill_)
- **Military longbow specialist** — M04 (_Issued missile arm and formation drill_), F41 (_Longbow tradition brought into service_)

| Valid path                    | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Communal/household contingent |                             10 |                        1 |                                        9 |
| Close-order formation soldier |                             12 |                        2 |                                       10 |
| Missile soldier               |                             10 |                        1 |                                        9 |
| Military longbow specialist   |                             12 |                        1 |                                       11 |

> Nine fixed-weapon tracks collapse to four. Weapon family is now a choice inside the drill, which is what the historical Basic/Advanced Melee and Missile slots described.

### P23 — Mounted Soldier and Lancer

- **F32** — _Mounted troop drill_
- **M06** — _Repeated service in the field_
- _Taught directly in the troop lines_: Animal Handling, Animal Husbandry

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mounted Soldier and Lancer |                             13 |                        1 |                                       12 |

### P24 — Military Scout

- **F33** — _Reconnaissance instruction_
- **G04** — _Working alone forward of the force_
- **M01** — _Fighting instruction for a scout_
- _Taught directly by the scouts one serves with_: Battlefield Awareness, Tracking

Mutually exclusive tracks:

- **Foot military scout** — no additional routes
- **Mounted military scout** — G05 (_Mounted reconnaissance service_)

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Foot military scout    |                             13 |                        1 |                                       12 |
| Mounted military scout |                             15 |                        1 |                                       14 |

### P25 — Military Commander

- **G09** — _Mentored unit command_
- **M06** — _Repeated service in the field_
- _Taught directly by the commander one serves under_: Oratory, Siege Operations

Mutually exclusive tracks:

- **Foot field commander** — M03 (_Formation arms drill with the command_)
- **Mounted field commander** — F32 (_Mounted troop drill with the command_)
- **Communal-force commander** — M01 (_Contingent fighting drill_)

| Valid path               | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Foot field commander     |                             13 |                        2 |                                       11 |
| Mounted field commander  |                             15 |                        1 |                                       14 |
| Communal-force commander |                             11 |                        1 |                                       10 |

### P26 — Military Quartermaster

- **G11** — _Supply-office records_
- **M07** — _Campaign staff service_
- **F06** — _Moving the force's supplies_
- _Taught directly in the supply office_: Mathematics

Mutually exclusive tracks:

- **Supply-office quartermaster** — G12 (_Buying for the force_)
- **Fighting-service quartermaster** — M01 (_Fighting drill alongside supply duties_)

| Valid path                     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Supply-office quartermaster    |                             11 |                        0 |                                       11 |
| Fighting-service quartermaster |                             12 |                        1 |                                       11 |

### P27 — Campaign Planner

- **G09** — _Service beside a commander_
- **M07** — _Ordinary campaign staff service_
- **K09** — _Studying the theatre_
- _Taught directly on the staff one serves_: Politics, Mathematics, Mnemonics

| Valid path       | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Campaign Planner |                             12 |                        0 |                                       12 |

### P28 — Siege Engineer

- **M08** — _Ordinary siege-works apprenticeship_
- **F28** — _Design and setting out_
- **F27** — _Timber mechanism construction_
- **C03** — _Running the trades on the works_
- **M06** — _Repeated service with a besieging force_
- _Taught directly on the works_: Mathematics, Siege Engine Operation

| Valid path     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Siege Engineer |                             12 |                        2 |                                       10 |

### P29 — Siege Engine Crew Specialist

- **M09** — _Ordinary engine-crew instruction_
- **M04** — _Serving in the missile line_
- **M06** — _Repeated service in the field_
- _Taught directly by the engine crew_: Carpentry, Ropework

| Valid path                   | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Siege Engine Crew Specialist |                             11 |                        1 |                                       10 |

### P30 — Physician

- **G01** — _Ordinary clinical apprenticeship_
- **G02** — _Preparing what one prescribes_
- **K01** — _Learned study of the art_
- _Taught directly by the practitioner one attends_: Customs, Teaching, Diagnostic Medicine, Poison Treatment, Bone Setting

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Physician  |                             10 |                        0 |                                       10 |

### P31 — Surgeon

- **G01** — _Clinical grounding_
- **K01** — _Learned study of the art_
- _Taught directly by the operator one assists_: Pharmacy, Teaching, Plant Lore

Mutually exclusive tracks:

- **Civil operative surgeon** — G18 (_Operative care practice_)
- **Field surgeon** — F29 (_Field surgical apprenticeship_), M06 (_Repeated service with a force_)

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Civil operative surgeon |                             10 |                        0 |                                       10 |
| Field surgeon           |                             13 |                        0 |                                       13 |

### P32 — Nurse and Patient Attendant

- **K14** — _Ordinary attendance apprenticeship_
- **G01** — _Attendance under a practitioner_
- **G02** — _Preparing what the patient is given_
- **F22** — _Feeding the sick household_
- _Taught directly at the bedside_: Insight, Teaching, Mnemonics

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Nurse and Patient Attendant |                             10 |                        0 |                                       10 |

### P33 — Birth Attendant and Midwife

- **K15** — _Ordinary birth-attendance apprenticeship_
- **G02** — _Preparing remedies for mother and child_
- **K14** — _Continuing attendance after the birth_
- _Taught directly by the attendant one accompanies_: Insight, Teaching, Religion, Mnemonics

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Birth Attendant and Midwife |                             10 |                        0 |                                       10 |

> Closes the approved catalogue's only zero-base-Skill package and applies the approved Medicine -> Obstetrics correction (#231) by supplying the immediate parent inside the same practice.

### P34 — Veterinary Practitioner

- **K13** — _Ordinary stock-medicine apprenticeship_
- **G02** — _Preparing animal remedies_
- **F05** — _Working among kept stock_
- _Taught directly among the stock one treats_: Animal Lore, First Aid, Riding, Appraisal

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Veterinary Practitioner |                             10 |                        0 |                                       10 |

### P35 — Herbalist and Remedy Maker

- **G02** — _Ordinary plant-remedy apprenticeship_
- **F23** — _Still-room practice_
- **K12** — _Comparing what is collected_
- _Taught directly in the remedy maker's shop_: First Aid, Appraisal, Bargaining, Customs, Survival

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Herbalist and Remedy Maker |                             10 |                        0 |                                       10 |

### P36 — Smith and Weaponsmith

- **F24** — _Ironmaking and forge apprenticeship_
- **F25** — _Weapon-forge and servicing apprenticeship_
- **F26** — _Armor workshop practice_
- **C02** — _Master's shop with apprentices_
- _Taught directly at the forge_: Mechanics

| Valid path            | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Smith and Weaponsmith |                             11 |                        3 |                                        8 |

### P37 — Smelter

- **F24** — _Ordinary furnace apprenticeship_
- **C07** — _Working with the extraction face_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the furnace_: Mechanics, Trade

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Smelter    |                             10 |                        1 |                                        9 |

### P38 — Armorer

- **F26** — _Ordinary armor workshop apprenticeship_
- **F25** — _Weapon-forge and servicing work_
- **C04** — _Hide and strap work for fittings_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the armor shop_: Mechanics, Trade

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Armorer    |                             10 |                        1 |                                        9 |

### P39 — Carpenter

- **F27** — _Ordinary timber apprenticeship_
- **C03** — _Working on building sites_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the timber shop_: Ropework, Teaching, Trade

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Carpenter  |                             11 |                        3 |                                        8 |

### P40 — Shipbuilder

- **F03** — _Ordinary yard apprenticeship_
- **F27** — _Timber mechanism work in the yard_
- **C03** — _Setting out and running the yard_
- _Taught directly in the yard_: Ropework, Sailmaking, Appraisal, Teaching

| Valid path  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Shipbuilder |                             10 |                        2 |                                        8 |

### P41 — Sailmaker

- **C09** — _Ordinary sail-loft apprenticeship_
- **F02** — _Cloth work behind the canvas_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the sail loft_: Seamanship, Tailoring, Trade

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Sailmaker  |                             10 |                        1 |                                        9 |

### P42 — Spinner and Weaver

- **F02** — _Ordinary fibre-to-cloth apprenticeship_
- **C05** — _Making up what is woven_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the wheel and the loom_: Ropework, Trade, Teaching, Plant Lore, Cordage / Ropemaking

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Spinner and Weaver |                             10 |                        1 |                                        9 |

### P43 — Tailor

- **C05** — _Ordinary garment apprenticeship_
- **F02** — _Cloth work behind the garment_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the cutting shop_: Leatherwork, Trade, Customs, Teaching

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Tailor     |                             10 |                        1 |                                        9 |

### P44 — Leatherworker

- **C04** — _Ordinary leather apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the bench_: Tailoring, Animal Husbandry, Trade, Teaching, Armoring

| Valid path    | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Leatherworker |                             10 |                        1 |                                        9 |

### P45 — Potter

- **F21** — _Ordinary ceramic apprenticeship_
- **C06** — _Winning and preparing the material_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the wheel and the kiln_: Visual Art, Trade, Teaching

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Potter     |                             10 |                        1 |                                        9 |

### P46 — Mason

- **C06** — _Ordinary stone apprenticeship_
- **C03** — _Running the trades on site_
- **F28** — _Setting out a building_
- _Taught directly on the site and at the banker_: Appraisal, Teaching, Mechanics

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mason      |                             10 |                        2 |                                        8 |

### P47 — Miner and Quarry Worker

- **C07** — _Ordinary extraction apprenticeship_
- **C06** — _Dressing what is won_
- **F24** — _Feeding the furnace_
- _Taught directly at the face_: Mechanics, Appraisal, Ropework

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Miner and Quarry Worker |                             10 |                        0 |                                       10 |

### P48 — Millwright and Mechanician

- **F27** — _Ordinary millwright apprenticeship_
- **C03** — _Installing on site_
- _Taught directly at the mill and on installation_: Smithing, Mathematics, Architecture, Ropework, Teaching

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Millwright and Mechanician |                             10 |                        2 |                                        8 |

### P49 — Building Designer

- **F28** — _Ordinary design apprenticeship_
- **C03** — _Running the trades on site_
- _Taught directly in the design office and on site_: Mathematics, Masonry, Carpentry, Cartography, Administration, Bargaining, Fortification

| Valid path        | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Building Designer |                             10 |                        2 |                                        8 |

### P50 — Surveyor and Mapmaker

- **F01** — _Ordinary surveying apprenticeship_
- **K09** — _Assembling what is known of the country_
- **G04** — _Working away from settlement_
- _Taught directly in the field and at the drawing table_: Mathematics, Astronomy, Visual Art, Administration

| Valid path            | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Surveyor and Mapmaker |                             11 |                        0 |                                       11 |

### P51 — Locksmith

- **C13** — _Ordinary locksmith apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the bench_: Lockpicking, Trade, Teaching, Carpentry, Perception

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Locksmith  |                             11 |                        1 |                                       10 |

### P52 — Trapmaker

- **C14** — _Ordinary trapmaking apprenticeship_
- **C13** — _Mechanism workshop practice_
- _Taught directly at the bench and on the line_: Carpentry, Ropework, Animal Lore, Hunting, Appraisal

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Trapmaker  |                             10 |                        0 |                                       10 |

### P53 — Cook

- **F22** — _Ordinary kitchen apprenticeship_
- **C10** — _Brewhouse attached to the kitchen_
- _Taught directly in the kitchen it serves_: Appraisal, Bargaining, Plant Lore, Customs, Trade, Teaching, Farming, Animal Husbandry, Baking, Court Cookery

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Cook       |                             10 |                        0 |                                       10 |

### P54 — Brewer

- **C10** — _Ordinary brewhouse apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the brewhouse_: Farming, Plant Lore, Trade, Teaching, Carpentry

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Brewer     |                             10 |                        1 |                                        9 |

### P55 — Vintner

- **C11** — _Ordinary vineyard apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the vineyard and the cellar_: Plant Lore, Weather Lore, Trade, Teaching, Carpentry, Bookkeeping

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Vintner    |                             11 |                        1 |                                       10 |

### P56 — Distiller

- **F23** — _Ordinary still-room apprenticeship_
- **C10** — _Brewhouse work behind the still_
- **C15** — _Service in an alchemical workshop_
- _Taught directly at the still_: Plant Lore, Appraisal, Trade, Mechanics, Teaching

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Distiller  |                             10 |                        0 |                                       10 |

### P57 — Alchemist

- **C15** — _Ordinary alchemical apprenticeship_
- **K01** — _Learned study of the tradition_
- **K02** — _Argument about the nature of matter_
- _Taught directly in the alchemist's workshop_: Plant Lore, Smelting, Appraisal

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Alchemist  |                             11 |                        0 |                                       11 |

### P58 — Clerk and Steward

- **G11** — _Ordinary records-office service_
- **K11** — _Service inside a court or great household_
- **K21** — _Accounts, measures and the estate_
- _Taught directly in the establishment one serves_: Law, Appraisal, Trade, Court Administration

| Valid path        | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Clerk and Steward |                             10 |                        0 |                                       10 |

### P59 — Legal Practitioner and Advocate

- **F13** — _Ordinary legal apprenticeship_
- **G11** — _Service in a records office_
- **F15** — _Study of the older record_
- **K01** — _Learned study of the art_
- _Taught directly by the advocate one reads with_: Customs, Politics, Insight

| Valid path                      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Legal Practitioner and Advocate |                             11 |                        0 |                                       11 |

### P60 — Envoy

- **G10** — _Ordinary negotiation apprenticeship_
- **K11** — _Service inside a court_
- **G05** — _Travelling to the other party_
- _Taught directly in the service one is entrusted with_: Law, Geography, Mnemonics, Administration, Courtly Protocol

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Envoy      |                             12 |                        0 |                                       12 |

### P61 — Mediator and Community Convenor

- **G10** — _Ordinary convening practice_
- **F14** — _Speaking from memory before the community_
- **K07** — _Instructing those who will convene after_
- _Taught directly in the community one convenes_: Law, Religion, History, Administration

| Valid path                      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mediator and Community Convenor |                             10 |                        0 |                                       10 |

### P62 — Banker and Credit Practitioner

- **F12** — _Ordinary credit-house apprenticeship_
- **G12** — _Trading alongside lending_
- **G11** — _Keeping the house's records_
- _Taught directly in the credit house_: Law, Insight, Politics, Mathematics

| Valid path                     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Banker and Credit Practitioner |                             10 |                        0 |                                       10 |

### P63 — Political Agent and Council Representative

- **G10** — _Ordinary council practice_
- **K11** — _Service among those who decide_
- **G14** — _Working the district for support_
- _Taught directly in the council one serves_: Law, History, Administration

| Valid path                                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Political Agent and Council Representative |                             10 |                        0 |                                       10 |

### P64 — Teacher

- **K07** — _Ordinary instruction apprenticeship_
- **K01** — _Learned study of what is taught_
- **F14** — _Delivering from memory_
- _Taught directly by the master one assists_: History, Philosophy, Customs, Administration, Insight

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Teacher    |                             10 |                        0 |                                       10 |

### P65 — Scribe and Copyist

- **G11** — _Ordinary records-office service_
- **F15** — _Reading and copying older hands_
- **K01** — _Learned study behind the copying_
- _Taught directly in the writing room_: Visual Art, Law, Customs, Appraisal

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Scribe and Copyist |                             10 |                        0 |                                       10 |

> BLOCKED DEPENDENCY: the defining Written Tradition core remains unresolved under #113 and is deliberately not supplied here. This package must not be presented as universal literacy.

### P66 — Translator and Interpreter

- **K08** — _Ordinary interpreting apprenticeship_
- **F15** — _Working from written originals_
- **K01** — _Learned study of the languages' matter_
- _Taught directly in the service one interprets for_: Oratory, Geography, History, Administration

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Translator and Interpreter |                             11 |                        0 |                                       11 |

> The spoken languages themselves remain separate contextual competencies and are not granted here.

### P67 — Historian and Genealogist

- **F15** — _Ordinary historical study_
- **F16** — _Lineage investigation apprenticeship_
- **K10** — _Service in a heraldic office_
- **K01** — _Learned study of the art_
- _Taught directly by the scholar one reads with_: Geography, Politics, Religion

| Valid path                | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Historian and Genealogist |                             10 |                        0 |                                       10 |

### P68 — Mathematical Practitioner

- **K21** — _Ordinary applied-calculation apprenticeship_
- **K01** — _Learned study of method_
- **K03** — _Calculation applied to the sky_
- _Taught directly by the practitioner one calculates for_: Architecture, Teaching, Cartography, Philosophy

| Valid path                | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mathematical Practitioner |                             11 |                        0 |                                       11 |

### P69 — Philosopher

- **K02** — _Ordinary philosophical study_
- **K01** — _Learned study of the tradition_
- **K07** — _Teaching within a school_
- _Taught directly within the school_: Religion, History, Politics

| Valid path  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Philosopher |                             10 |                        0 |                                       10 |

### P70 — Astronomer

- **K03** — _Ordinary observational apprenticeship_
- **K01** — _Learned study of the record_
- **K02** — _Argument about what is observed_
- _Taught directly at the instrument and the record_: Celestial Navigation, Cartography, Geography, Teaching

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Astronomer |                             10 |                        0 |                                       10 |

### P71 — Astrologer

- **K04** — _Ordinary astrological apprenticeship_
- **K03** — _Observation behind the reading_
- **K01** — _Learned study of the tradition_
- _Taught directly by the astrologer one reads with_: Religion, Divination, Insight, History

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Astrologer |                             11 |                        0 |                                       11 |

### P72 — Naturalist

- **K12** — _Ordinary field-study apprenticeship_
- **G04** — _Working away from settlement_
- **K01** — _Learned study of the record_
- _Taught directly in the field and the collection_: Geography, Visual Art, Teaching, Philosophy

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Naturalist |                             12 |                        0 |                                       12 |

### P73 — Geographer

- **K09** — _Ordinary chorographic study_
- **F01** — _Measuring the ground oneself_
- **G04** — _Travelling what one describes_
- _Taught directly by the geographer one works with_: Astronomy, Customs, History, Mathematics

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Geographer |                             11 |                        0 |                                       11 |

### P74 — Religious Practitioner

- **K06** — _Ordinary vocation apprenticeship_
- **K01** — _Learned study of the tradition_
- **F14** — _Delivering before the congregation_
- _Taught directly within the vocation_: Meditation, History, Teaching, First Aid, Insight

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Religious Practitioner |                             11 |                        0 |                                       11 |

### P75 — Diviner

- **K05** — _Ordinary divinatory apprenticeship_
- **K04** — _Celestial method within the practice_
- _Taught directly by the diviner one serves_: Meditation, Insight, Animal Lore, Weather Lore, Mnemonics, Oratory

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Diviner    |                             11 |                        0 |                                       11 |

### P76 — Herald

- **K10** — _Ordinary heraldic office apprenticeship_
- **F16** — _Lineage investigation_
- **F14** — _Proclamation from memory_
- **K11** — _Service inside the court_
- _Taught directly in the heraldic office_: Administration, Visual Art, Law

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Herald     |                             10 |                        0 |                                       10 |

> Closes the recorded Herald parent-access gaps: History for Genealogy and Customs for Courtly Protocol are supplied by K10 inside the family's own envelope.

### P77 — Musician and Singer

- **F17** — _Ordinary song apprenticeship_
- **F19** — _Composing the matter one performs_
- **F18** — _Performing with players and dancers_
- _Taught directly by the players one performs with_: Customs, Teaching, Mnemonics, History, Music Composition

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Musician and Singer |                             10 |                        0 |                                       10 |

### P78 — Actor and Dancer

- **F18** — _Ordinary company apprenticeship_
- **F17** — _Music and song in the company_
- **F19** — _The matter the company performs_
- _Taught directly by the company_: Customs, Athletics, Disguise, Mnemonics

| Valid path       | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Actor and Dancer |                             10 |                        0 |                                       10 |

### P79 — Visual Artist and Sculptor

- **F20** — _Ordinary workshop apprenticeship_
- **F21** — _Modelling and firing_
- **C01** — _Workshop trade practice_
- _Taught directly in the workshop_: Masonry, Carpentry, Customs, Teaching, Heraldry

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Visual Artist and Sculptor |                             11 |                        1 |                                       10 |

### P80 — Storyteller and Poet

- **F19** — _Ordinary oral composition apprenticeship_
- **F14** — _Holding and delivering the matter_
- **F17** — _Singing what one composes_
- _Taught directly by the teller one learns from_: Customs, History, Religion, Geography, Insight

| Valid path           | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Storyteller and Poet |                             11 |                        0 |                                       11 |

### P81 — Athlete and Physical Performer

- **F04** — _Ordinary athletic training_
- **F18** — _Performing before an audience_
- _Taught directly by the trainer one works under_: Brawling, Teaching, Customs, First Aid

| Valid path                     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Athlete and Physical Performer |                             10 |                        0 |                                       10 |

### P82 — Weapon Instructor

- _Taught directly in the salle one instructs in_: Teaching, Combat Experience, Weapon Maintenance, Athletics, First Aid, Customs

Mutually exclusive tracks:

- **Close-combat weapon master** — M02 (_Advanced close-combat instruction_)
- **Fencing master** — F30 (_Swashbuckling fencing instruction_)
- **Missile weapon master** — M05 (_Advanced missile instruction_)

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Close-combat weapon master |                             12 |                        3 |                                        9 |
| Fencing master             |                              9 |                        0 |                                        9 |
| Missile weapon master      |                             10 |                        3 |                                        7 |

> The fencing-master path is deliberately narrow: a single named tradition is the whole occupation.

### P83 — Gambler

- **K17** — _Ordinary gaming-house practice_
- **G14** — _Knowing the house and the players_
- **K18** — _Standing in an illicit milieu_
- **G16** — _Passing as what one is not_
- _Taught directly at the tables_: Mathematics, Customs, Bargaining

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Gambler    |                             11 |                        0 |                                       11 |

### P84 — Diver and Water Worker

- **K20** — _Ordinary diving apprenticeship_
- **N01** — _Working from a boat_
- _Taught directly on the working line_: Athletics, Climbing, Fishing, Survival, Appraisal

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Diver and Water Worker |                             10 |                        0 |                                       10 |
