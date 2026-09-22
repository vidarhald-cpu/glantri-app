# Proposed Professions and valid paths (V2)

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with
> Chargen, not projected into canonical content, and does not replace any approved catalogue.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

All 84 approved Profession families are preserved. They yield 86 valid paths (the approved catalogue yields 99). Mutually exclusive tracks are evaluated separately; Specializations never count toward base-Skill breadth.

Every Profession declares at least one **defining core route**: the training it is not that Profession
without. A path is valid only when it satisfies one of its applicable core routes; a track's own core
routes refine or replace its parent's. This is an annotation over Learning Groups and directly taught
Skills that already exist, not a separate mechanism, and it needs no GM override.

Every valid path satisfies an applicable core route. 90 path/core-route pairs are declared and 90 are satisfied by the authored content. No core route is blocked on an external question any more: P65 Scribe was the last one, and the 2026-09-22 language ruling settles it.

## Core minimality

A core states what a Profession is not that Profession without — enough for identity, never a rigid
class build. Every declared core route is audited against that, and the build now refuses any core that
requires more than two things in total. A written-language choice counts as exactly one requirement however many competencies it may be satisfied from, because it is one choice the learner makes rather than a list the Profession dictates. Largest core in the catalogue: 2 requirement(s). 88 of 90 path/core pairs require exactly one thing — 85 a single Learning Group and 3 a single direct competency route.

**The written-language core route (#113).** 1 path/core pair(s) additionally require the learner to hold at least one written-language competency, chosen freely rather than named: P65 (1). This is the narrow representation extension the 2026-09-22 ruling authorizes, and it is the whole of it: a `writtenLanguageChoiceCount` on the core route. Written languages are **not** turned into base Skills, no core route is enumerated per Civilization, and no new path-body concept is added. The choice is satisfied from the 11 written competencies the Civilization language table authors, so it is satisfiable wherever a literate Civilization is reachable.

**A core is a necessary defining training route, not a unique classification key.** The
"PRODUCT OWNER RULING — Profession cores (settled)" comment recorded on
[issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266) on 2026-09-21 rejects the
assumption that a core must discriminate one Profession from every other. **Several Professions may
share the same core Learning Group where that training is genuinely defining for each**, and a shared
core is therefore correct content rather than a defect to be designed away. G10 is the core of the Envoy,
the Mediator and the Political Agent; G11 of the Clerk and the Scribe; F24 of the Smith and the Smelter;
M07 of the Quartermaster and the Campaign Planner; F04 of the Athlete and the foot Courier. **No Learning
Group is invented to manufacture a unique core.**

The same ruling settles that a core requirement may name **an existing Learning Group route or an
existing direct competency route**. That is an annotation over routes the Profession already has, not a
new primitive. Three Professions are defined by a direct route rather than by a group: the Cook by
Cooking, the Wild Plant Gatherer by Plant Lore, and the Carpenter by Carpentry. In each case the group
that previously held the core — C10, G02 and F27 — remains an ordinary optional route, and because
overlapping routes are charged once, moving the core changes no breadth figure.

A Profession may declare a small set of **alternative core routes**, of which one must be satisfied. 2 paths use them today.

- **P12 Courier and Messenger** — one of F04, G05 or F06: the foot, mounted and vehicle courier are the
  same occupation practised three ways, and any one of them makes the courier.
- **P22 Soldier** — one of M01, M03 or M04: a soldier is made by being drilled to arms. **M06 Campaign
  service experience is not core.** It stays an ordinary route, because Combat Experience is experiential
  competence earned by real service — available to the soldier who sees it, not required of the one who
  does not.

Both are stated as alternatives rather than as tracks, which the cores ruling requires explicitly and the
track-discipline ruling below independently demands.

## Track discipline

A track is a **named player-visible curriculum variant representing a materially different form of the
occupation** — not a weapon, Skill or equipment choice, and not a restatement of something the Learning
Groups already say. The audit applies one mechanisable test: **a track must declare a core route of its
own.** If the defining training does not differ, the variant is a route choice and belongs in the
Profession's own group list. The build refuses a track that declares no core.

**Settled by Product Owner ruling.** The "PRODUCT OWNER RULING — Profession tracks (settled)" comment
recorded on [issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266) on 2026-09-21
approves this retirement outcome as authoritative settled input, not merely this proposal's own internal
audit: **"A Profession track exists only where it changes the defining core curriculum of the
occupation. If the difference can be expressed through Learning Groups, choice slots, equipment,
Society/cultural availability, or optional routes, do not create a track."** The mechanisable build test
above — a track must declare a core route of its own — is how that governing rule is enforced in this
catalogue; the two are the same discipline stated once as product policy and once as an executable check.

The same ruling settles two dispositions by name, so neither is an open track question:

- **Soldier longbow identity** is represented through the appropriate longbow/combat Learning Group (F41,
  reachable through the retired track's former route) plus contextual/cultural availability, **not**
  through a Profession track.
- **Communal/militia command** (the former P25 communal-command track) remains a route/context
  distinction, **not** a track, unless future content demonstrates a materially different defining
  curriculum.

**No further track investigation is required.** The result below is final for this reconciliation, not
pending further Product Owner review. The 2026-09-21 Profession-cores ruling does not reopen it: P12 and
P22 gain **alternative core routes**, never tracks, and the retained/retired set below is unchanged.

Result: 2 of 84 Professions keep tracks, carrying 4 tracks between them (16 retired). Valid paths fall to 86.

| Profession                    | Tracks before | Tracks after | Why                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------: | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P09 Sailor and Boat Worker    |             2 |            2 | Kept. Inshore boat work and rigged-vessel deck service have different defining training — N01 against F09 — so each track carries its own core.                                                                                                                                                               |
| P31 Surgeon                   |             2 |            2 | Kept. The civil operative surgeon and the field surgeon are defined by different apprenticeships, G18 against F29, and only the field surgeon has an authored route to combat exposure.                                                                                                                       |
| P14 Guard, Watcher and Escort |             2 |            0 | Retired. The tracks differed only in which combat group the guard bought; M01 and F30 are now both openly available routes.                                                                                                                                                                                   |
| P22 Soldier                   |             4 |            0 | Retired. All four differed only in which combat Learning Group they bought — contingent drill, formation drill, the issued missile arm, the longbow tradition. The Soldier is one identity whose core is being drilled to arms, stated as the alternative core routes M01, M03 and M04 rather than as tracks. |
| P24 Military Scout            |             2 |            0 | Retired. Foot and mounted scouting differed only by whether the scout was given a horse, which G05 already says.                                                                                                                                                                                              |
| P25 Military Commander        |             3 |            0 | Retired. Foot, mounted and communal command differed only in the combat groups shared with the command.                                                                                                                                                                                                       |
| P26 Military Quartermaster    |             2 |            0 | Retired. Neither refined the defining core; G12 and M01 state the difference themselves.                                                                                                                                                                                                                      |
| P82 Weapon Instructor         |             3 |            0 | Retired. The subject an arms master teaches is a weapon choice, already expressed by M02, M05 and F30. The narrow-by-design exemption the one-tradition fencing track needed is gone with it.                                                                                                                 |

The Soldier collapse is the ruling applied at its sharpest, and it is deliberate: breadth that used to be
split across four near-identical tracks is now what the breadth ruling actually asks for — one identity
with access to several coherent Learning Groups. The cores ruling completes it. Where a difference really
is a difference in defining training but not in occupational identity — the mounted courier against the
foot courier — the answer is an alternative core route, not a track. Tracks remain reserved for a
materially different occupational form, which is why only the Sailor and the Surgeon keep any.

## Combat Experience route audit

Combat Experience is experiential competence from credible real combat or field exposure. Weapon
instruction, fencing, drill and advanced combat training do not grant it. It is reachable only through
M06 Campaign service experience and K23 Coercive service practice, and a Profession may expose it only
through an authored experiential route that explains the exposure. Every path that reaches it is listed
here; there are no others, and the build enforces that.

| Path                                                            | Route group | Authored route                            |
| --------------------------------------------------------------- | ----------- | ----------------------------------------- |
| P15 Enforcer — Enforcer                                         | K23         | _Ordinary coercive service_               |
| P22 Soldier — Soldier                                           | M06         | _Repeated service in the field_           |
| P23 Mounted Soldier and Lancer — Mounted Soldier and Lancer     | M06         | _Repeated service in the field_           |
| P24 Military Scout — Military Scout                             | M06         | _Repeated service forward of the force_   |
| P25 Military Commander — Military Commander                     | M06         | _Repeated service in the field_           |
| P28 Siege Engineer — Siege Engineer                             | M06         | _Repeated service with a besieging force_ |
| P29 Siege Engine Crew Specialist — Siege Engine Crew Specialist | M06         | _Repeated service in the field_           |
| P31 Surgeon — Field surgeon                                     | M06         | _Repeated service with a force_           |

Professions that train hard and fight rarely are the point of the audit: the Weapon Instructor, the
Guard, the Military Quartermaster and the civil Surgeon reach no Combat Experience by any route.

## Cost invariants

Overlapping routes never require duplicate payment for the same competency, and final cost does not
depend on purchase order. Across all valid paths the routes name a competency more than once on
105 occasions; every one is charged exactly once. Accumulating each path's routes in reverse order yields the identical charged
set, which is what order-independence means here. Both properties are enforced by the build, not asserted
in prose: a catalogue that broke either would fail to build.

### P01 — Hunter and Trapper

- **Core route** — _Ordinary hunting apprenticeship_: G03
- **G03** — _Ordinary hunting apprenticeship_
- **F34** — _Trapline service_
- **G04** — _Season away from settlement_
- **F41** — _Longbow hunting tradition_
- _Taught directly by the hunter one works beside_: Animal Lore

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Hunter and Trapper |                             10 |                        0 |                                       10 |

### P02 — Wild Plant Gatherer

- **Core route** — _Knowing what grows wild, learned directly on the collecting rounds_: Plant Lore
- **G04** — _Seasonal collecting rounds_
- **G02** — _Supplying and preparing for a remedy maker_
- **G12** — _Selling the season's collection_
- _Taught directly on the collecting rounds_: Climbing, Plant Lore

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Wild Plant Gatherer |                              9 |                        0 |                                        9 |

> Core settled by the 2026-09-21 Profession-cores ruling: the gatherer is defined by knowing the plant itself, learned on the rounds, not by the remedy maker's preparation curriculum. G02 remains an ordinary optional route for a gatherer who also learns to prepare what is collected.

### P03 — Field and Caravan Guide

- **Core route** — _Ordinary guiding service_: G04
- **G04** — _Ordinary guiding service_
- **G05** — _Mounted route service_
- **F06** — _Caravan vehicle service_
- **M01** — _Escort self-defence instruction_
- _Taught directly by the guide one travels with_: Geography

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Field and Caravan Guide |                             10 |                        1 |                                        9 |

### P04 — Fisher

- **Core route** — _Ordinary fishing-boat apprenticeship_: F10
- **F10** — _Ordinary fishing-boat apprenticeship_
- **N01** — _Working the family boat_
- **G12** — _Selling the catch_

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Fisher     |                              8 |                        0 |                                        8 |

### P05 — Farmer

- **Core route** — _Ordinary holding apprenticeship_: F08
- **F08** — _Ordinary holding apprenticeship_
- **F05** — _Keeping the holding's stock_
- **F06** — _Carting to market_
- **C10** — _Household brewing and storing the season_
- _Taught directly in the working year of the holding_: Weather Lore

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Farmer     |                              8 |                        0 |                                        8 |

### P06 — Herd Keeper

- **Core route** — _Ordinary stockkeeping apprenticeship_: F05
- **F05** — _Ordinary stockkeeping apprenticeship_
- **G05** — _Mounted herding service_
- **G04** — _Seasonal movement with the herd_
- **F02** — _Household fibre and cloth work from the clip_
- _Taught directly by the herd owner and the older keepers_: Sling, Steppe Remount Training

| Valid path  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Herd Keeper |                             10 |                        0 |                                       10 |

### P07 — Animal Trainer and Falconer

- **Core route** — _Falconry apprenticeship_: F07
- **F07** — _Falconry apprenticeship_
- **F05** — _Keeping the animals in condition_
- **G05** — _Mounted work with trained animals_
- **K13** — _Treating the animals in one's charge_
- **G03** — _Hunting with what one has trained_

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Animal Trainer and Falconer |                              9 |                        0 |                                        9 |

### P08 — Driver and Teamster

- **Core route** — _Ordinary driving apprenticeship_: F06
- **F06** — _Ordinary driving apprenticeship_
- **G04** — _Long-distance caravan service_
- **G05** — _Riding with the team_
- **G12** — _Carrying goods on one's own account_

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Driver and Teamster |                              9 |                        0 |                                        9 |

### P09 — Sailor and Boat Worker

- **Core route** — _Working an open boat under sail and oar_: N01
- **Core route** — _Deck service in a rigged vessel_: F09
- **M01** — _Rough shipboard fighting instruction_
- _Taught directly by the crew one sails with_: Swimming

Mutually exclusive tracks:

- **Small-craft boat worker** — N01 (_Working a boat_)
- **Rigged-vessel deck hand** — F09 (_Rigged-vessel deck apprenticeship_)

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Small-craft boat worker |                              7 |                        1 |                                        6 |
| Rigged-vessel deck hand |                              8 |                        1 |                                        7 |

> The two deck practices remain alternatives, as recorded for the approved catalogue's Sailor exclusion pair.

### P10 — Navigator and Pilot

- **Core route** — _Entrusted coastal passage work_: G07
- **G07** — _Entrusted coastal passage work_
- **F11** — _Charted open-water instruction_
- **N01** — _Deck grounding before navigation_
- _Taught directly by the pilot one serves under_: Cartography, Mathematics

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Navigator and Pilot |                             11 |                        0 |                                       11 |

### P11 — Shipmaster

- **Core route** — _Deck service before command_: F09
- **F09** — _Deck service before command_
- **G07** — _Responsibility for the passage_
- **G12** — _Trading the voyage_
- _Taught directly by the master one serves under_: Leadership

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Shipmaster |                             11 |                        0 |                                       11 |

### P12 — Courier and Messenger

- **Core route** — _Foot courier practice: conditioned to carry it there oneself_: F04
- **Core route** — _Mounted courier practice: riding the stage and keeping the animal_: G05
- **Core route** — _Vehicle courier practice: driving the carrying team_: F06
- **F04** — _Conditioning for the road_
- **G05** — _Mounted stage service_
- **F06** — _Driving the carrying team_
- **G04** — _Carrying across open country_
- _Taught directly by the stage or household one carries for_: Geography

| Valid path            | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Courier and Messenger |                             11 |                        0 |                                       11 |

> Core settled by the 2026-09-21 Profession-cores ruling: the courier is defined by a practised way of getting it there — on foot, mounted or by vehicle — and any one of the three makes the occupation. These are alternative core routes, which the model already carries; the ruling is explicit that they must not become Profession tracks. F06 is added as an ordinary route so the vehicle alternative is genuinely reachable rather than merely declared.

### P13 — Trader and Merchant

- **Core route** — _Ordinary trading apprenticeship_: G12
- **G12** — _Ordinary trading apprenticeship_
- **G11** — _Keeping the house's records_
- **G04** — _Travelling the route personally_
- **F06** — _Moving one's own goods_
- _Taught directly in the counting house and on the road_: Customs, Mathematics

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Trader and Merchant |                             12 |                        0 |                                       12 |

### P14 — Guard, Watcher and Escort

- **Core route** — _Ordinary watch and guard instruction_: K24
- **K24** — _Ordinary watch and guard instruction_
- **G04** — _Escort duty away from the town_
- **M01** — _Guard and rough-fighting drill_
- **F30** — _Swashbuckling fencing instruction_

| Valid path                | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Guard, Watcher and Escort |                             10 |                        1 |                                        9 |

> Both tracks retired under the track-discipline ruling. They differed only in which combat Learning Group the guard bought, and that distinction is already expressed by the groups themselves: a rough house guard takes M01, an escort trained in the fencing tradition takes F30. One Profession, one identity, two openly available fighting curricula.

### P15 — Enforcer

- **Core route** — _Ordinary coercive service_: K23
- **K23** — _Ordinary coercive service_
- **M01** — _Rough-fighting instruction_
- **G14** — _Knowing the district one works_
- _Taught directly by the enterprise one works for_: Conceal Object

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Enforcer   |                              9 |                        1 |                                        8 |

### P16 — Local Informant

- **Core route** — _Ordinary informant practice_: G14
- **G14** — _Ordinary informant practice_
- **K18** — _Standing in an illicit milieu_
- **G16** — _Passing unremarked where one does not belong_
- _Taught directly through the district one works_: Perception, Customs, Mnemonics

| Valid path      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Local Informant |                              9 |                        0 |                                        9 |

### P17 — Investigator and Intelligence Agent

- **Core route** — _Entrusted inquiry apprenticeship_: G17
- **G17** — _Entrusted inquiry apprenticeship_
- **G14** — _Working local contacts_
- **G16** — _Approach under another identity_
- _Taught directly by the mentor conducting the inquiry_: Stealth, Law

| Valid path                          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Investigator and Intelligence Agent |                              9 |                        0 |                                        9 |

### P18 — Thief

- **Core route** — _Ordinary covert-entry instruction_: G15
- **G15** — _Ordinary covert-entry instruction_
- **K18** — _Standing in an illicit milieu_
- **K25** — _Learning the trade from an established thief_
- _Taught directly by an established thief_: Disguise

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Thief      |                             10 |                        0 |                                       10 |

### P19 — Confidence Trickster

- **Core route** — _Ordinary impersonation practice_: G16
- **G16** — _Ordinary impersonation practice_
- **G14** — _Finding the mark_
- **K17** — _Working the gaming tables_
- _Taught directly by the trickster one works with_: Customs, Oratory

| Valid path           | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Confidence Trickster |                              8 |                        0 |                                        8 |

### P20 — Smuggler and Illicit Trader

- **Core route** — _Trading goods that must not be seen, with standing in the milieu that moves them_: G12, K18
- **G12** — _Trading what is carried_
- **K18** — _Standing in an illicit milieu_
- **N01** — _Running the boat oneself_
- **G04** — _Overland crossing away from the road_

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Smuggler and Illicit Trader |                             12 |                        0 |                                       12 |

### P21 — Document Forger

- **Core route** — _Ordinary forging apprenticeship_: K16
- **K16** — _Ordinary forging apprenticeship_
- **G11** — _Service inside a records office_
- **F15** — _Study of older hands_
- **K18** — _Placing the work through an illicit milieu_
- _Taught directly by the forger one trains under_: Visual Art

| Valid path      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Document Forger |                             10 |                        0 |                                       10 |

### P22 — Soldier

- **Core route** — _Contingent fighting drill_: M01
- **Core route** — _Formation arms drill_: M03
- **Core route** — _Issued missile arm and formation drill_: M04
- **M06** — _Repeated service in the field_
- **G04** — _Marching and camping with the force_
- **M01** — _Contingent fighting drill_
- **M03** — _Formation arms drill_
- **M04** — _Issued missile arm and formation drill_
- **F41** — _Longbow tradition brought into service_

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Soldier    |                             16 |                        4 |                                       12 |

> The approved catalogue's nine fixed-weapon Soldier tracks became four in the previous revision; the track-discipline ruling retires those four as well. Every one of them differed from its siblings only in which combat Learning Group it bought — contingent drill, formation drill, the issued missile arm, the longbow tradition — and a track must not exist for an ordinary weapon or equipment choice. Core settled by the 2026-09-21 Profession-cores ruling: M06 Campaign service experience is NOT core. A soldier is made by being drilled to arms, so the core is one of M01, M03 or M04, stated as alternative core routes rather than as tracks. M06 remains an ordinary route: Combat Experience is experiential competence earned by real service, available to the soldier who sees it and not required of the soldier who does not. That keeps the Combat Experience route audit correct — M06 and K23 remain its only two routes — and it is exactly the access-to-several-groups shape the breadth ruling asks for.

### P23 — Mounted Soldier and Lancer

- **Core route** — _Learning to fight from the saddle_: M11
- **M11** — _Learning to fight from the saddle_
- **M12** — _Lance and troop drill_
- **M01** — _Sidearm and close-combat drill_
- **M06** — _Repeated service in the field_
- _Taught directly in the troop lines_: Animal Handling

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mounted Soldier and Lancer |                             11 |                        1 |                                       10 |

### P24 — Military Scout

- **Core route** — _Reconnaissance instruction_: F33
- **F33** — _Reconnaissance instruction_
- **G04** — _Working alone forward of the force_
- **M01** — _Fighting instruction for a scout_
- **M06** — _Repeated service forward of the force_
- **G05** — _Mounted reconnaissance service_
- _Taught directly by the scouts one serves with_: Tracking

| Valid path     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Military Scout |                             15 |                        1 |                                       14 |

> Both tracks retired under the track-discipline ruling: foot and mounted scouting differed only by whether the scout was given a horse, which is an equipment choice already expressed by G05.

### P25 — Military Commander

- **Core route** — _Mentored unit command_: G09
- **G09** — _Mentored unit command_
- **M06** — _Repeated service in the field_
- **M03** — _Formation arms drill with the command_
- **M11** — _Commanding from the saddle_
- **M12** — _Lance and troop drill with the command_
- **M01** — _Contingent and sidearm fighting drill_
- _Taught directly by the commander one serves under_: Oratory, Siege Operations

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Military Commander |                             16 |                        3 |                                       13 |

> All three tracks retired under the track-discipline ruling. Foot, mounted and communal commanders differed only in which combat Learning Groups they bought; commanding a body of troops is one occupational identity, and the fighting curriculum a commander shares with the command is a route choice, not a separate occupation.

### P26 — Military Quartermaster

- **Core route** — _Keeping a campaign supplied and recorded_: M07
- **G11** — _Supply-office records_
- **M07** — _Campaign staff service_
- **F06** — _Moving the force's supplies_
- **G12** — _Buying for the force_
- **M01** — _Fighting drill alongside supply duties_
- _Taught directly in the supply office_: Mathematics

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Military Quartermaster |                             14 |                        1 |                                       13 |

> Both tracks retired under the track-discipline ruling. Neither refined the defining core — keeping a campaign supplied and recorded — and the difference between a quartermaster who buys for the force and one who drills alongside it is already stated by G12 and M01.

### P27 — Campaign Planner

- **Core route** — _Planning a campaign on a commander's staff_: M07
- **G09** — _Service beside a commander_
- **M07** — _Ordinary campaign staff service_
- **K09** — _Studying the theatre_
- _Taught directly on the staff one serves_: Mathematics

| Valid path       | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Campaign Planner |                             10 |                        0 |                                       10 |

### P28 — Siege Engineer

- **Core route** — _Ordinary siege-works apprenticeship_: M08
- **M08** — _Ordinary siege-works apprenticeship_
- **F28** — _Design and setting out_
- **F27** — _Timber mechanism construction_
- **M06** — _Repeated service with a besieging force_
- _Taught directly on the works_: Mathematics, Siege Engine Operation

| Valid path     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Siege Engineer |                             10 |                        0 |                                       10 |

### P29 — Siege Engine Crew Specialist

- **Core route** — _Ordinary engine-crew instruction_: M09
- **M09** — _Ordinary engine-crew instruction_
- **M04** — _Serving in the missile line_
- **M06** — _Repeated service in the field_
- _Taught directly by the engine crew_: Carpentry, Ropework

| Valid path                   | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Siege Engine Crew Specialist |                             11 |                        1 |                                       10 |

### P30 — Physician

- **Core route** — _Ordinary clinical apprenticeship_: G01
- **G01** — _Ordinary clinical apprenticeship_
- **G02** — _Preparing what one prescribes_
- **K01** — _Learned study of the art_
- _Taught directly by the practitioner one attends_: Diagnostic Medicine, Poison Treatment, Bone Setting

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Physician  |                              7 |                        0 |                                        7 |

### P31 — Surgeon

- **Core route** — _Operating under a civil master surgeon_: G18
- **Core route** — _Operating with a force in the field_: F29
- **G01** — _Clinical grounding_
- **K01** — _Learned study of the art_
- _Taught directly by the operator one assists_: Pharmacy

Mutually exclusive tracks:

- **Civil operative surgeon** — G18 (_Operative care practice_)
- **Field surgeon** — F29 (_Field surgical apprenticeship_), M06 (_Repeated service with a force_)

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Civil operative surgeon |                              7 |                        0 |                                        7 |
| Field surgeon           |                             10 |                        0 |                                       10 |

### P32 — Nurse and Patient Attendant

- **Core route** — _Ordinary attendance apprenticeship_: K14
- **K14** — _Ordinary attendance apprenticeship_
- **G01** — _Attendance under a practitioner_
- **G02** — _Preparing what the patient is given_
- **C10** — _Feeding and dosing the sick household_
- _Taught directly at the bedside_: Insight

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Nurse and Patient Attendant |                              9 |                        0 |                                        9 |

### P33 — Birth Attendant and Midwife

- **Core route** — _Ordinary birth-attendance apprenticeship_: K15
- **K15** — _Ordinary birth-attendance apprenticeship_
- **G02** — _Preparing remedies for mother and child_
- **K14** — _Continuing attendance after the birth_
- _Taught directly by the attendant one accompanies_: Insight, Religion

| Valid path                  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Birth Attendant and Midwife |                              8 |                        0 |                                        8 |

> Closes the approved catalogue's only zero-base-Skill package and applies the approved Medicine -> Obstetrics correction (#231) by supplying the immediate parent inside the same practice.

### P34 — Veterinary Practitioner

- **Core route** — _Ordinary stock-medicine apprenticeship_: K13
- **K13** — _Ordinary stock-medicine apprenticeship_
- **G02** — _Preparing animal remedies_
- **F05** — _Working among kept stock_
- _Taught directly among the stock one treats_: Animal Lore

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Veterinary Practitioner |                              7 |                        0 |                                        7 |

### P35 — Herbalist and Remedy Maker

- **Core route** — _Ordinary plant-remedy apprenticeship_: G02
- **G02** — _Ordinary plant-remedy apprenticeship_
- **F23** — _Still-room practice_
- **K12** — _Comparing what is collected_
- _Taught directly in the remedy maker's shop_: First Aid, Survival

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Herbalist and Remedy Maker |                              7 |                        0 |                                        7 |

### P36 — Smith and Weaponsmith

- **Core route** — _Ironmaking and forge apprenticeship_: F24
- **F24** — _Ironmaking and forge apprenticeship_
- **F25** — _Weapon-forge and servicing apprenticeship_
- **F26** — _Armor workshop practice_
- **C02** — _Master's shop with apprentices_

| Valid path            | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Smith and Weaponsmith |                              8 |                        1 |                                        7 |

### P37 — Smelter

- **Core route** — _Ordinary furnace apprenticeship_: F24
- **F24** — _Ordinary furnace apprenticeship_
- **C07** — _Working with the extraction face_
- **C01** — _Workshop apprenticeship_

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Smelter    |                              7 |                        1 |                                        6 |

### P38 — Armorer

- **Core route** — _Ordinary armor workshop apprenticeship_: F26
- **F26** — _Ordinary armor workshop apprenticeship_
- **F25** — _Weapon-forge and servicing work_
- **C04** — _Hide and strap work for fittings_
- **C01** — _Workshop apprenticeship_

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Armorer    |                              8 |                        1 |                                        7 |

### P39 — Carpenter

- **Core route** — _Working timber, learned directly at the bench one is set to_: Carpentry
- **F27** — _Ordinary timber apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the bench by the carpenter one is set to, and set out on site with him_: Carpentry, Surveying

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Carpenter  |                              6 |                        1 |                                        5 |

> Core settled by the 2026-09-21 Profession-cores ruling: the carpenter is defined by working timber itself, not by the millwright's mechanism curriculum. F27 remains an ordinary optional route for a carpenter who also builds working timber mechanisms.

### P40 — Shipbuilder

- **Core route** — _Ordinary yard apprenticeship_: F03
- **F03** — _Ordinary yard apprenticeship_
- **F27** — _Timber mechanism work in the yard_
- _Taught directly in the yard_: Ropework, Appraisal

| Valid path  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Shipbuilder |                              5 |                        0 |                                        5 |

### P41 — Sailmaker

- **Core route** — _Ordinary sail-loft apprenticeship_: C09
- **C09** — _Ordinary sail-loft apprenticeship_
- **F02** — _Cloth work behind the canvas_
- **C01** — _Workshop apprenticeship_

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Sailmaker  |                              7 |                        1 |                                        6 |

### P42 — Spinner and Weaver

- **Core route** — _Ordinary fibre-to-cloth apprenticeship_: F02
- **F02** — _Ordinary fibre-to-cloth apprenticeship_
- **C05** — _Making up what is woven_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the wheel and the loom_: Ropework, Cordage / Ropemaking

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Spinner and Weaver |                              7 |                        1 |                                        6 |

### P43 — Tailor

- **Core route** — _Ordinary garment apprenticeship_: C05
- **C05** — _Ordinary garment apprenticeship_
- **F02** — _Cloth work behind the garment_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the cutting shop_: Customs

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Tailor     |                              7 |                        1 |                                        6 |

### P44 — Leatherworker

- **Core route** — _Ordinary leather apprenticeship_: C04
- **C04** — _Ordinary leather apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the bench_: Tailoring, Armoring

| Valid path    | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Leatherworker |                              7 |                        1 |                                        6 |

### P45 — Potter

- **Core route** — _Ordinary ceramic apprenticeship_: F21
- **F21** — _Ordinary ceramic apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the wheel and the kiln_: Visual Art, Masonry

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Potter     |                              7 |                        1 |                                        6 |

### P46 — Mason

- **Core route** — _Ordinary stone apprenticeship_: C06
- **C06** — _Ordinary stone apprenticeship_
- **F28** — _Setting out a building_
- **C07** — _Winning the stone one works_
- _Taught directly on the site and at the banker_: Appraisal

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mason      |                              7 |                        0 |                                        7 |

### P47 — Miner and Quarry Worker

- **Core route** — _Ordinary extraction apprenticeship_: C07
- **C07** — _Ordinary extraction apprenticeship_
- **F24** — _Feeding the furnace_
- **G04** — _Working a mine far from settlement_
- _Taught directly at the face_: Ropework, Appraisal

| Valid path              | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Miner and Quarry Worker |                              9 |                        0 |                                        9 |

### P48 — Millwright and Mechanician

- **Core route** — _Ordinary millwright apprenticeship_: F27
- **F27** — _Ordinary millwright apprenticeship_
- **C01** — _Workshop apprenticeship in the trade one also works_
- _Taught directly at the mill and on installation_: Mathematics, Ropework, Surveying

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Millwright and Mechanician |                              8 |                        1 |                                        7 |

### P49 — Building Designer

- **Core route** — _Ordinary design apprenticeship_: F28
- **F28** — _Ordinary design apprenticeship_
- **F01** — _Measuring and drawing the site oneself_
- _Taught directly in the design office and on site_: Mathematics, Administration, Fortification

| Valid path        | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Building Designer |                              5 |                        0 |                                        5 |

### P50 — Surveyor and Mapmaker

- **Core route** — _Ordinary surveying apprenticeship_: F01
- **F01** — _Ordinary surveying apprenticeship_
- **K09** — _Assembling what is known of the country_
- **G04** — _Working away from settlement_
- _Taught directly in the field and at the drawing table_: Mathematics, Astronomy

| Valid path            | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| --------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Surveyor and Mapmaker |                              9 |                        0 |                                        9 |

### P51 — Locksmith

- **Core route** — _Ordinary locksmith apprenticeship_: C13
- **C13** — _Ordinary locksmith apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly at the bench_: Lockpicking

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Locksmith  |                              7 |                        1 |                                        6 |

### P52 — Trapmaker

- **Core route** — _Ordinary trapmaking apprenticeship_: C14
- **C14** — _Ordinary trapmaking apprenticeship_
- **C13** — _Mechanism workshop practice_
- _Taught directly at the bench and on the line_: Carpentry, Ropework, Animal Lore

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Trapmaker  |                              8 |                        0 |                                        8 |

### P53 — Cook

- **Core route** — _Cooking, learned directly in the kitchen one serves_: Cooking
- **C10** — _Ordinary kitchen and brewhouse apprenticeship_
- **C01** — _Buying for the kitchen as a trained trade_
- _Taught directly in the kitchen it serves_: Customs, Plant Lore, Cooking, Baking, Court Cookery

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Cook       |                              7 |                        1 |                                        6 |

> Core settled by the 2026-09-21 Profession-cores ruling: the cook is defined by cooking, not by the brewhouse's brewing-and-preserving cycle. C10 remains an ordinary optional route and still carries the Food Preservation access; C10 stays the Brewer's core, which the ruling affirms.

### P54 — Brewer

- **Core route** — _Ordinary brewhouse apprenticeship_: C10
- **C10** — _Ordinary brewhouse apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the brewhouse_: Farming, Plant Lore

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Brewer     |                              7 |                        1 |                                        6 |

### P55 — Vintner

- **Core route** — _Ordinary vineyard apprenticeship_: C11
- **C11** — _Ordinary vineyard apprenticeship_
- **C01** — _Workshop apprenticeship_
- _Taught directly in the vineyard and the cellar_: Plant Lore, Weather Lore

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Vintner    |                              7 |                        1 |                                        6 |

### P56 — Distiller

- **Core route** — _Ordinary still-room apprenticeship_: F23
- **F23** — _Ordinary still-room apprenticeship_
- **C10** — _Brewhouse work behind the still_
- **C15** — _Service in an alchemical workshop_
- _Taught directly at the still_: Plant Lore, Mechanics

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Distiller  |                              7 |                        0 |                                        7 |

### P57 — Alchemist

- **Core route** — _Ordinary alchemical apprenticeship_: C15
- **C15** — _Ordinary alchemical apprenticeship_
- **K01** — _Learned study of the tradition_
- **K02** — _Argument about the nature of matter_
- _Taught directly in the alchemist's workshop_: Plant Lore, Smelting

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Alchemist  |                              9 |                        0 |                                        9 |

### P58 — Clerk and Steward

- **Core route** — _Ordinary records-office service_: G11
- **G11** — _Ordinary records-office service_
- **K11** — _Service inside a court or great household_
- **K21** — _Accounts, measures and the estate_
- _Taught directly in the establishment one serves_: Law, Appraisal, Court Administration

| Valid path        | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Clerk and Steward |                              9 |                        0 |                                        9 |

### P59 — Legal Practitioner and Advocate

- **Core route** — _Ordinary legal apprenticeship_: F13
- **F13** — _Ordinary legal apprenticeship_
- **G11** — _Service in a records office_
- **F15** — _Study of the older record_
- **K01** — _Learned study of the art_
- _Taught directly by the advocate one reads with_: Customs, Insight

| Valid path                      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Legal Practitioner and Advocate |                              9 |                        0 |                                        9 |

### P60 — Envoy

- **Core route** — _Ordinary negotiation apprenticeship_: G10
- **G10** — _Ordinary negotiation apprenticeship_
- **K11** — _Service inside a court_
- **G05** — _Travelling to the other party_
- _Taught directly in the service one is entrusted with_: Law, Courtly Protocol

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Envoy      |                             10 |                        0 |                                       10 |

### P61 — Mediator and Community Convenor

- **Core route** — _Ordinary convening practice_: G10
- **G10** — _Ordinary convening practice_
- **F14** — _Speaking from memory before the community_
- **K07** — _Instructing those who will convene after_
- _Taught directly in the community one convenes_: Law

| Valid path                      | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mediator and Community Convenor |                              7 |                        0 |                                        7 |

### P62 — Banker and Credit Practitioner

- **Core route** — _Ordinary credit-house apprenticeship_: F12
- **F12** — _Ordinary credit-house apprenticeship_
- **G12** — _Trading alongside lending_
- **G11** — _Keeping the house's records_
- _Taught directly in the credit house_: Law, Mathematics

| Valid path                     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Banker and Credit Practitioner |                              8 |                        0 |                                        8 |

### P63 — Political Agent and Council Representative

- **Core route** — _Ordinary council practice_: G10
- **G10** — _Ordinary council practice_
- **K11** — _Service among those who decide_
- **G14** — _Working the district for support_
- _Taught directly in the council one serves_: Law

| Valid path                                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Political Agent and Council Representative |                              9 |                        0 |                                        9 |

### P64 — Teacher

- **Core route** — _Ordinary instruction apprenticeship_: K07
- **K07** — _Ordinary instruction apprenticeship_
- **K01** — _Learned study of what is taught_
- **F14** — _Delivering from memory_
- _Taught directly by the master one assists_: History, Philosophy

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Teacher    |                              6 |                        0 |                                        6 |

### P65 — Scribe and Copyist

- **Core route** — _Ordinary records-office service, plus at least one written language the scribe actually writes_: G11
- **G11** — _Ordinary records-office service_
- **F15** — _Reading and copying older hands_
- **K01** — _Learned study behind the copying_
- _Taught directly in the writing room_: Visual Art

| Valid path         | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Scribe and Copyist |                              6 |                        0 |                                        6 |

> SETTLED (#113). The Profession-cores ruling fixes the core shape — G11 Records-office practice plus at least one applicable written-language competency — and the 2026-09-22 language ruling supplies what the previous revision was waiting for. Both halves of the dependency are now discharged. Representation: the core carries `writtenLanguageChoiceCount: 1`, which states the choice without naming a tradition, without turning written languages into base Skills, and without one core route per Civilization. Content: the proposal now authors 11 distinct written competencies across the 14 literate Civilizations, so the choice has something to choose from wherever a scribe is trained. G11 plus the one choice is exactly two requirements, which is the core maximum, so the minimality rule needs no adjustment and the core cannot quietly grow. Which tradition a given scribe writes remains the contextual availability question #113 owns; this package is still not universal literacy, and grants no written competency by itself.

### P66 — Translator and Interpreter

- **Core route** — _Ordinary interpreting apprenticeship_: K08
- **K08** — _Ordinary interpreting apprenticeship_
- **F15** — _Working from written originals_
- **K01** — _Learned study of the languages' matter_
- _Taught directly in the service one interprets for_: Oratory

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Translator and Interpreter |                              7 |                        0 |                                        7 |

> The spoken languages themselves remain separate contextual competencies and are not granted here.

### P67 — Historian and Genealogist

- **Core route** — _Ordinary historical study_: F15
- **F15** — _Ordinary historical study_
- **K10** — _Service in a heraldic office_
- **K01** — _Learned study of the art_
- _Taught directly by the scholar one reads with_: Research, Genealogy

| Valid path                | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Historian and Genealogist |                              6 |                        0 |                                        6 |

### P68 — Mathematical Practitioner

- **Core route** — _Ordinary applied-calculation apprenticeship_: K21
- **K21** — _Ordinary applied-calculation apprenticeship_
- **K01** — _Learned study of method_
- **K03** — _Calculation applied to the sky_

| Valid path                | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Mathematical Practitioner |                              7 |                        0 |                                        7 |

### P69 — Philosopher

- **Core route** — _Ordinary philosophical study_: K02
- **K02** — _Ordinary philosophical study_
- **K01** — _Learned study of the tradition_
- **K07** — _Teaching within a school_
- _Taught directly within the school_: History

| Valid path  | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Philosopher |                              7 |                        0 |                                        7 |

### P70 — Astronomer

- **Core route** — _Ordinary observational apprenticeship_: K03
- **K03** — _Ordinary observational apprenticeship_
- **K01** — _Learned study of the record_
- **K02** — _Argument about what is observed_
- _Taught directly at the instrument and the record_: Celestial Navigation

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Astronomer |                              7 |                        0 |                                        7 |

### P71 — Astrologer

- **Core route** — _Ordinary astrological apprenticeship_: K04
- **K04** — _Ordinary astrological apprenticeship_
- **K03** — _Observation behind the reading_
- **K01** — _Learned study of the tradition_
- _Taught directly by the astrologer one reads with_: Divination, Insight

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Astrologer |                              9 |                        0 |                                        9 |

### P72 — Naturalist

- **Core route** — _Ordinary field-study apprenticeship_: K12
- **K12** — _Ordinary field-study apprenticeship_
- **G04** — _Working away from settlement_
- **K01** — _Learned study of the record_
- _Taught directly in the field and the collection_: Geography, Visual Art

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Naturalist |                              9 |                        0 |                                        9 |

### P73 — Geographer

- **Core route** — _Ordinary chorographic study_: K09
- **K09** — _Ordinary chorographic study_
- **F01** — _Measuring the ground oneself_
- **G04** — _Travelling what one describes_
- _Taught directly by the geographer one works with_: Astronomy, Customs

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Geographer |                              9 |                        0 |                                        9 |

### P74 — Religious Practitioner

- **Core route** — _Ordinary vocation apprenticeship_: K06
- **K06** — _Ordinary vocation apprenticeship_
- **K01** — _Learned study of the tradition_
- **F14** — _Delivering before the congregation_
- **K22** — _Contemplative discipline within the vocation_

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Religious Practitioner |                              7 |                        0 |                                        7 |

### P75 — Diviner

- **Core route** — _Ordinary divinatory apprenticeship_: K05
- **K05** — _Ordinary divinatory apprenticeship_
- **K04** — _Celestial method within the practice_
- **K22** — _Contemplative discipline of the practice_

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Diviner    |                              8 |                        0 |                                        8 |

### P76 — Herald

- **Core route** — _Ordinary heraldic office apprenticeship_: K10
- **K10** — _Ordinary heraldic office apprenticeship_
- **F14** — _Proclamation from memory_
- **K11** — _Service inside the court_
- _Taught directly in the heraldic office_: Visual Art, Genealogy

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Herald     |                              8 |                        0 |                                        8 |

> Closes the recorded Herald parent-access gaps: History for Genealogy and Customs for Courtly Protocol are supplied by K10 inside the family's own envelope.

### P77 — Musician and Singer

- **Core route** — _Ordinary song apprenticeship_: F17
- **F17** — _Ordinary song apprenticeship_
- **F19** — _Composing the matter one performs_
- **F18** — _Performing with players and dancers_
- _Taught directly by the players one performs with_: Mnemonics, Music Composition

| Valid path          | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Musician and Singer |                              7 |                        0 |                                        7 |

### P78 — Actor and Dancer

- **Core route** — _Ordinary company apprenticeship_: F18
- **F18** — _Ordinary company apprenticeship_
- **F17** — _Music and song in the company_
- **F19** — _The matter the company performs_
- _Taught directly by the company_: Athletics, Mnemonics

| Valid path       | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Actor and Dancer |                              8 |                        0 |                                        8 |

### P79 — Visual Artist and Sculptor

- **Core route** — _Ordinary workshop apprenticeship_: F20
- **F20** — _Ordinary workshop apprenticeship_
- **F21** — _Modelling and firing_
- **C01** — _Workshop trade practice_
- _Taught directly in the workshop_: Masonry

| Valid path                 | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Visual Artist and Sculptor |                              7 |                        1 |                                        6 |

### P80 — Storyteller and Poet

- **Core route** — _Ordinary oral composition apprenticeship_: F19
- **F19** — _Ordinary oral composition apprenticeship_
- **F14** — _Holding and delivering the matter_
- **F17** — _Singing what one composes_
- _Taught directly by the teller one learns from_: History

| Valid path           | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| -------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Storyteller and Poet |                              7 |                        0 |                                        7 |

### P81 — Athlete and Physical Performer

- **Core route** — _Ordinary athletic training_: F04
- **F04** — _Ordinary athletic training_
- **F18** — _Performing before an audience_
- _Taught directly by the trainer one works under_: Brawling

| Valid path                     | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ------------------------------ | -----------------------------: | -----------------------: | ---------------------------------------: |
| Athlete and Physical Performer |                              7 |                        0 |                                        7 |

### P82 — Weapon Instructor

- **Core route** — _Ordinary arms-instruction apprenticeship_: M10
- **M10** — _Ordinary arms-instruction apprenticeship_
- **M02** — _Advanced close-combat instruction_
- **M05** — _Advanced missile instruction_
- **F30** — _Swashbuckling fencing instruction_

| Valid path        | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ----------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Weapon Instructor |                             12 |                        6 |                                        6 |

> All three tracks retired under the track-discipline ruling: the subject a weapon master teaches is an ordinary weapon choice, already expressed by M02, M05 and F30. The Profession no longer needs the narrow-by-design exemption the one-tradition fencing track required. The instructor still reaches no Combat Experience by any of these routes, which is the point of the Combat Experience ruling: instructing is not exposure.

### P83 — Gambler

- **Core route** — _Ordinary gaming-house practice_: K17
- **K17** — _Ordinary gaming-house practice_
- **G14** — _Knowing the house and the players_
- **K18** — _Standing in an illicit milieu_
- **G16** — _Passing as what one is not_
- _Taught directly at the tables_: Mathematics

| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Gambler    |                              9 |                        0 |                                        9 |

### P84 — Diver and Water Worker

- **Core route** — _Ordinary diving apprenticeship_: K20
- **K20** — _Ordinary diving apprenticeship_
- **N01** — _Working from a boat_
- _Taught directly on the working line_: Athletics, Appraisal

| Valid path             | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |
| ---------------------- | -----------------------------: | -----------------------: | ---------------------------------------: |
| Diver and Water Worker |                              7 |                        0 |                                        7 |
