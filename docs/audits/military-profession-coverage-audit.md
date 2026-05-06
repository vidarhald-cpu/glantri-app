# Military Profession Coverage Audit

Date: 2026-04-28

Scope: read-only audit of the current Glantri profession catalog for guard, soldier, warrior, militia, officer, policing, and military-command coverage.

Sources reviewed:
- `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts`
- `data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json`
- Current branch generated content after the recent skill-group merge cleanup.

Important interpretation note: the society level below is the profession subtype's current minimum society level from imported content. Because the generated society-band access includes professions when the society/band effective level is high enough, low-minimum professions can still appear in higher-level societies unless later restricted by additional logic.

## A. Current Military-Related Professions By Society Level

| Society level | Profession id | Profession name | Why classified | Granted skill groups | Key direct skills | Officer markers present | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | `tribal_warrior` | Tribal Warrior | Soldier family; warrior keyword; combat grants | Veteran Soldiering; Veteran Leadership; Basic Melee Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Brawling; Throwing; Bow | Veteran Leadership; Tactics; Captaincy | Good low-organization warrior concept, but currently inherits formal command markers through Soldier family grants. |
| 1 | `clan_warriors` | Clan Warriors | Soldier family; warrior keyword; combat grants | Veteran Soldiering; Veteran Leadership; Basic Melee Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; 1-h conc./axe; Throwing; Bow | Veteran Leadership; Tactics; Captaincy | Plausible at levels 1-2, but suspicious if freely available in level 5-6 societies as a generic profession. |
| 2 | `levy_infantry` | Levy Infantry | Soldier family; infantry keyword; organized troop role | Veteran Soldiering; Veteran Leadership; Basic Melee Training; Defensive Soldiering | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Polearms; 1-h conc./axe | Veteran Leadership; Tactics; Captaincy | Good militia/levy role, but command markers are too broad for a basic levy. |
| 2 | `cavalry_mounted_retainer` | Cavalry / Mounted Retainer | Soldier family; cavalry/mounted retainer role | Veteran Soldiering; Veteran Leadership; Mounted Warrior Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Animal care | Veteran Leadership; Tactics; Captaincy | Fits levels 3-4 better than level 2 if it means trained cavalry retainer rather than pastoral mounted fighter. |
| 2 | `bodyguard` | Bodyguard | Soldier family; guard/protection role | Veteran Soldiering; Veteran Leadership; Advanced Melee Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Insight | Veteran Leadership; Tactics; Captaincy | Strong guard role. Could be available from level 2 upward, but does not need officer training by default. |
| 2 | `bounty_hunter` | Bounty Hunter | Coercive pursuit/security role | Street Theft; Covert Entry; Fieldcraft Stealth | Search; Perception; Stealth; Captaincy; 1-h edged; Brawling; plus Thief/Infiltrator family skills | Captaincy | Borderline guard/policing role. More law-enforcement-adjacent if paired with Law/Tracking; currently sits in Thief/Infiltrator. |
| 2 | `caravan_guard` | Caravan Guard | Soldier family; guard/security role | Veteran Soldiering; Veteran Leadership; Basic Melee Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Throwing | Veteran Leadership; Tactics; Captaincy | Strong level 2-3 guard role. Command markers are probably too strong as inherited defaults. |
| 2 | `cavalry` | Cavalry | Soldier family; cavalry role | Veteran Soldiering; Veteran Leadership; Mounted Warrior Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Mounted Combat; Animal care | Veteran Leadership; Tactics; Captaincy | Good professional mounted soldier role, probably better at levels 3-4+ unless representing tribal/nomadic cavalry. |
| 2 | `gladiator` | Gladiator | Soldier family; combat profession | Veteran Soldiering; Veteran Leadership | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance | Veteran Leadership; Tactics; Captaincy | Combat role, not a soldier/guard by default. Needs refinement or separate arena package. |
| 2 | `heavy_infantry` | Heavy Infantry | Soldier family; infantry role | Veteran Soldiering; Veteran Leadership; Basic Melee Training; Defensive Soldiering | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Parry; Polearms; 1-h conc./axe | Veteran Leadership; Tactics; Captaincy | Good organized soldier role. Probably level 3-4+ for professional armies; level 2 may fit levy heavy infantry in some societies. |
| 2 | `jailer` | Jailer | Soldier family; institutional guard role | Veteran Soldiering; Veteran Leadership; Basic Melee Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Insight; Search; Parry | Veteran Leadership; Tactics; Captaincy | Good policing/security role. Should probably include Law or Administration before Captaincy. |
| 2 | `light_infantry` | Light Infantry | Soldier family; infantry role | Veteran Soldiering; Veteran Leadership; Basic Missile Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Dodge; Throwing; Bow | Veteran Leadership; Tactics; Captaincy | Good early organized troop role. Command markers probably too broad. |
| 2 | `outrider_scout` | Outrider/Scout | Soldier family; scout/military screen role | Veteran Soldiering; Veteran Leadership | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance | Veteran Leadership; Tactics; Captaincy | Current row looks underdeveloped; concept wants Riding, Fieldcraft, Perception, Stealth/Tracking, maybe Basic Missile. |
| 2 | `watchman` | Watchman | Soldier family; civic guard/watch role | Veteran Soldiering; Veteran Leadership; Basic Melee Training; Defensive Soldiering | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Search | Veteran Leadership; Tactics; Captaincy | Good level 3 civic role, but level 2 can fit simple watch. Needs Law/Local Knowledge more than Veteran Leadership. |
| 3 | `assassin` | Assassin | Clandestine violence; military/political contexts in notes | Street Theft; Covert Entry; Fieldcraft Stealth | Stealth; Disguise; Search; Poison Lore; 1-h edged; plus Thief/Infiltrator family skills | None military-specific | Military-adjacent but not guard/soldier coverage. Should not count as ordinary military availability. |
| 3 | `champion` | Champion | Soldier family; elite combat role | Veteran Soldiering; Veteran Leadership; Advanced Melee Training | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Brawling | Veteran Leadership; Tactics; Captaincy | Good elite/retainer role. Better as elite fighter than command path unless explicitly household champion-captain. |
| 3 | `ships_officer` | Ships Officer | Maritime command role | Maritime Crew Training; Maritime Navigation | Sailing; Captaincy; Navigation; Perception; plus sailor family skills | Captaincy | Good naval/officer-adjacent path, but outside land military. |
| 3 | `spy` | Spy | State/military clandestine context in notes | Street Theft; Covert Entry; Fieldcraft Stealth; Political Acumen | Disguise; Intrigue; Stealth; Search; plus Thief/Infiltrator family skills | None military-specific | Intelligence-adjacent, not soldier coverage. |
| 4 | `herald` | Herald | Noble/military formal-precedence notes | Courtly Formation; Political Acumen | Heraldry; Oratory; Etiquette; Courtly Protocol; History; plus court family skills | Courtly Formation; Heraldry; Oratory; Administration; Law | Command-adjacent for elite armies, not a soldier/officer profession by itself. |
| 4 | `military_officer` | Military Officer | Explicit military officer role | Veteran Soldiering; Veteran Leadership | Perception; Formation Fighting; Riding; Battlefield Awareness; Tactics; Captaincy; First aid; Weapon Maintenance; Oratory; Administration; Law; Combat Experience | Veteran Leadership; Tactics; Captaincy; Oratory; Administration; Law; Combat Experience | Strong current formal command path, but only one land-officer subtype exists. |
| 4 | `noble` | Noble | Has Captaincy; military/court authority possible | Courtly Formation; Political Acumen | Etiquette; Heraldry; Insight; Courtly Protocol; Captaincy; Law; plus court family skills | Courtly Formation; Heraldry; Captaincy; Law; Administration | Elite command-adjacent, but too broad to substitute for professional officer careers. |
| 4 | `politician` | Politician | Civic/factional authority; possible military administration adjacency | Courtly Formation; Political Acumen | Intrigue; Oratory; Insight; Law; Administration; Detect Lies; plus court family skills | Courtly Formation; Oratory; Administration; Law | Civil command-adjacent only; should not count as military officer coverage. |

## B. Coverage Summary By Society Level

Counts below use the profession minimum society level, not every society/band where that profession later becomes visible.

| Society level | Guard/policing count | Soldier/warrior count | Officer/command count | Obvious missing roles | Suspicious/inappropriate roles |
|---:|---:|---:|---:|---|---|
| 1 | 0 | 2 | 0 clear / 2 inherited | Militia leader, raider, clan war-leader, village watch/guard | Tribal Warrior and Clan Warriors inherit Veteran Leadership, Tactics, and Captaincy from the Soldier family. |
| 2 | 5 | 11 | 0 clear / many inherited | Militia, simple guard, patrolman, scout with fieldcraft, informal sergeant/war leader | Most level-2 soldiers have officer markers because Soldier family favored grants include Veteran Leadership, Tactics, and Captaincy. Cavalry/Heavy Infantry may be too formal for some level-2 societies. |
| 3 | 0-1 | 1 | 1 naval / 0 land | Town guard, city watch, militia captain, sergeant, professional soldier, garrison soldier | Assassin/Spy are military-adjacent but should not fill guard/soldier coverage. |
| 4 | 0 | 1 | 1 clear land officer plus elite/civil-adjacent roles | City guard officer, veteran sergeant, cavalry officer, garrison commander, quartermaster/logistics officer | Military Officer is doing nearly all formal land-command work. Noble/Politician/Herald are not substitutes for professional officer paths. |
| 5 | 0 | 0 assigned directly | 0 assigned directly | Bureaucratic army officer, staff officer, military administrator, military engineer, quartermaster, magistrate/watch commander | Low-minimum Clan Warriors/Tribal Warriors can still appear in high-level societies through broad availability unless restricted. |
| 6 | 0 | 0 assigned directly | 0 assigned directly | Roman-style/bureaucratic command paths: centurion/tribune/strategos, professional staff officer, logistics commander, elite guard officer | Clan Warriors and Tribal Warrior are especially suspicious if presented as normal level-6 careers rather than archaic/foreign/background variants. |

## C. Suggested Changes

### Rename Existing Profession

- Rename `clan_warriors` to `Clan Warrior` or `Clan Warband Member` if it remains a level-1/2 role. The plural id/name feels unlike most profession rows and reads as a group rather than a profession.
- Consider renaming `cavalry_mounted_retainer` to either `Mounted Retainer` or `Household Cavalry Retainer`. If kept at level 2, "Mounted Retainer" is easier to justify than formal "Cavalry".
- Consider renaming `watchman` to `Watchman / Patrol Guard` if it remains the broad civic-security row.
- Consider renaming `jailer` to `Jailer / Gaoler` if historical flavor matters, but the current concept is clear.

### Merge Existing Professions

- Consider merging or clearly separating `cavalry_mounted_retainer` and `cavalry`. At present both are Soldier-family mounted roles with similar grants; the distinction is mostly social context.
- Consider merging `tribal_warrior` and `clan_warriors` if both are intended to cover low-organization communal fighters. If both remain, give one a pastoral/tribal raider concept and the other a clan retainer/warband concept.
- Consider separating `gladiator` out of Soldier if it remains arena-focused. It currently inherits broad Soldier family command/field grants that do not fit a pure arena fighter.

### Move Society Level

- Move `watchman` from level 2 to level 3 if it represents organized urban/civic watch rather than village guard.
- Move `heavy_infantry` from level 2 to level 3 or 4 if it represents drilled, equipped formation infantry.
- Move `cavalry` from level 2 to level 3 or 4 if it represents formal cavalry rather than mounted tribal/retainer fighting.
- Keep `tribal_warrior` and `clan_warriors` at level 1-2, but restrict or contextualize them so they do not read as normal level-6 careers.
- Keep `military_officer` at level 4 as a junior/field officer, but add level 5-6 officer/staff paths rather than stretching this one row upward.

### Add New Profession

- Add level-1/2 `Militia Fighter` or `Village Militia`.
- Add level-2/3 `Village Guard` or `House Guard`.
- Add level-3 `Town Watchman` or `Town Guard`.
- Add level-3/4 `Sergeant` or `Veteran Sergeant`.
- Add level-4 `City Watch Officer`.
- Add level-4/5 `Quartermaster`.
- Add level-5 `Staff Officer`.
- Add level-5/6 `Strategist` or `Military Strategist`.
- Add level-5/6 `Imperial Officer`, `Legion Officer`, or `Bureaucratic Military Officer`.
- Add level-5/6 `Elite Guard Officer` or `Household Guard Captain`.

### Remove Or Restrict Inappropriate Profession

- Restrict `clan_warriors` and `tribal_warrior` to low-organization societies or treat them as cultural/background roles, not general high-society professions.
- Restrict `gladiator` from Soldier-family command inheritance, or make it an arena/combat profession with tailored combat groups.
- Do not use `assassin` or `spy` as military coverage. They are useful military-adjacent roles, but they do not solve ordinary guard/soldier/officer gaps.

### Add Skill Group/Skill To Existing Profession

- Add Law or Civic Learning to `watchman` and `jailer` if they are institutional/civic roles.
- Add Fieldcraft Stealth, Wilderness/Fieldcraft, Tracking-equivalent skill, or Riding to `outrider_scout`; its current row is too generic.
- Add Administration, Law, Oratory, and possibly Courtly Formation/Heraldry to formal officer paths at levels 4-6.
- Add a Logistics skill or group if one exists or is planned. I did not find a canonical `logistics` or `military_strategy` skill in the generated skill list; the closest current administrative skills are Administration, Bookkeeping, Law, and the current Captaincy/Tactics pair.
- Review the Soldier family grants. Moving `Veteran Leadership`, `Tactics`, and `Captaincy` from broad family-level favored grants into specific officer/sergeant/veteran subtypes would make the catalog easier to reason about.

## D. Proposed New Professions

| Name | Society level | Concept | Likely skill groups | Likely direct skills | Tags | Rationale |
|---|---:|---|---|---|---|---|
| Village Militia | 1-2 | Part-time local defender raised from a clan, village, or manor. | Basic Melee Training; Basic Missile Training; Defensive Soldiering optional | Perception; First aid; local weapon skill | militia; soldier | Covers low-level defense without implying professional soldiering or formal command. |
| Warband Leader | 1-2 | Informal clan/tribal combat leader. | Basic Melee Training; Veteran Soldiering optional | Captaincy or Tactics at low/core-light value; Oratory optional | militia; command | Gives low-level societies a command path distinct from formal officer education. |
| Village Guard | 2 | Local guard for gates, storehouses, roads, or manor compounds. | Basic Melee Training; Defensive Soldiering | Perception; Search; Law optional | guard; policing | Fills the gap between clan warrior and urban watch. |
| Town Watchman | 3 | Organized urban watch or patrol guard. | Basic Melee Training; Defensive Soldiering | Perception; Search; Law; Insight | guard; policing | Cleaner fit for civic societies than current broad Soldier-family inheritance. |
| Garrison Soldier | 3 | Professional or semi-professional soldier attached to a fort or town. | Basic Melee Training; Defensive Soldiering; Veteran Soldiering optional | Formation Fighting; Battlefield Awareness; Weapon Maintenance | soldier | Covers organized troops without making every soldier an officer. |
| Veteran Sergeant | 3-4 | Experienced small-unit leader. | Veteran Soldiering; Defensive Soldiering | Tactics; Captaincy; Oratory optional | soldier; command | Bridges ordinary soldiers and officers. |
| City Watch Officer | 4 | Officer of an organized urban watch. | Veteran Leadership; Defensive Soldiering; Civic Learning optional | Captaincy; Law; Administration; Oratory; Perception | guard; officer; policing | Fills the civic command gap at level 4. |
| Cavalry Officer | 4-5 | Mounted unit commander. | Mounted Warrior Training; Veteran Soldiering; Veteran Leadership | Captaincy; Tactics; Riding; Heraldry optional | mounted; officer | Separates formal mounted command from generic cavalry. |
| Quartermaster | 4-5 | Supply, equipment, payroll, and movement administrator. | Commercial Administration; Civic Learning; Veteran Leadership optional | Administration; Bookkeeping; Law; Weapon Maintenance | logistics; staff | Gives formal armies a non-combat command/support path. |
| Staff Officer | 5 | Bureaucratic military planner and aide. | Veteran Leadership; Civic Learning; Courtly Formation optional | Tactics; Administration; Law; Oratory; Heraldry optional | officer; staff | Fits level-5 formal states better than stretching Military Officer alone. |
| Military Strategist | 5-6 | Senior planner for campaigns and large formations. | Veteran Leadership; Civic Learning; Political Acumen optional | Tactics; Captaincy; Administration; History; Law | officer; staff; strategy | Covers the requested Military Strategy niche if/when that skill exists. |
| Imperial / Bureaucratic Officer | 6 | High-civilization officer shaped by formal bureaucracy and elite institutions. | Veteran Leadership; Civic Learning; Courtly Formation; Literate Foundation | Captaincy; Tactics; Administration; Law; Heraldry; Etiquette | officer; high-society; staff | Provides a Roman/bureaucratic level-6 command path and avoids level-6 reliance on Clan Warriors. |
| Elite Guard Officer | 5-6 | Commander of palace, household, or imperial guard troops. | Veteran Leadership; Veteran Soldiering; Defensive Soldiering; Courtly Formation optional | Captaincy; Tactics; Heraldry; Etiquette; Insight | guard; officer; elite | Bridges military command and high-society court service. |

## Main Findings

1. The current catalog has many Soldier-family combat professions at levels 1-2, but very few clearly assigned level-3 to level-6 professional military careers.
2. The `Soldier` family currently grants or favors `Veteran Leadership`, `Tactics`, and `Captaincy`, so almost every soldier/guard/warrior row looks officer-like even when the profession concept is basic infantry, caravan guard, jailer, or tribal warrior.
3. There is one strong land-officer profession: `military_officer` at society level 4.
4. There is one naval command profession: `ships_officer` at society level 3.
5. There is no clear level-5 or level-6 land military officer/staff/logistics path in the current profession subtype list.
6. The current generated skill list appears not to contain `logistics` or `military_strategy` as canonical skills. Formal command currently relies mostly on Captaincy, Tactics, Administration, Law, Oratory, Heraldry, and Courtly/Academic groups.
7. Low-level warrior roles such as `tribal_warrior` and `clan_warriors` are plausible at society levels 1-2, but should probably be restricted, renamed, or contextualized before they are treated as normal level-5/6 military professions.

## Unclear Assumptions / Follow-Up Questions

- Should profession minimum society level mean "first available and remains available upward", or should some professions have a maximum society level / society-type restriction?
- Should Soldier family grants represent broad professional familiarity, or should command skills be moved into subtype-specific officer/sergeant paths?
- Should naval roles be included in the same military coverage model, or handled under a separate maritime command audit?
- Should `gladiator` remain in Soldier, or become a separate arena/combat profession family/subtype with less battlefield-command inheritance?
