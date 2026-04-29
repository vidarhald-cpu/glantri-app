# Current Military Profession Structure Audit

Date: 2026-04-29

Scope: read-only audit of the current repo-local/generated Glantri profession catalog for soldier, guard, warrior, militia, policing, naval military, scout, cavalry, bodyguard, officer, and command-adjacent roles.

No content changes are proposed as implemented changes in this document.

## A. Method And Data Sources

Files and read models inspected:
- `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts`
- `packages/content/scripts/generateRepoLocalGlantriSeed.mjs`
- `data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json`
- `packages/rules-engine/src/professions/resolveEffectiveProfessionPackage.ts`
- `apps/web/src/lib/admin/viewModels.ts`
- `packages/domain/src/content/skills.ts`
- `packages/domain/src/profession/professions.ts`

Society level:
- Canonical society level comes from `content.societies[*].societyLevel`.
- Profession minimum society level comes from imported profession subtype rows in `content_bundle.json`.
- Current generated `societyLevels[*].professionIds` include a profession when the society/access-band effective level is high enough.

Class level / allowed grid:
- `content.societyLevels[*].societyLevel` is the social/access band, not the canonical society level.
- Current class labels are:
  - Class 1: Common Folk
  - Class 2: Trades and Guilds
  - Class 3: Established Households
  - Class 4: Court and Elite
- Admin reads allowed slots from `societyLevels[*].professionIds`, then joins canonical society level through the society id.

Skill groups and extra grants:
- Profession package grants are resolved with `resolveEffectiveProfessionPackage`.
- Family and subtype grants are combined into core and favored tiers.
- Group reach is computed from skills whose `groupIds` include a granted group.
- Direct skill exceptions are direct profession/family skill grants not already reachable through granted groups.

Skill reach:
- The existing app has a clear skill-reach metric.
- The rules-engine returns core/favored reachable skill ids in `resolveEffectiveProfessionPackage`.
- Admin combines core/favored reachable ids into a unique `totalReachableSkills`.
- This report uses that same unique reachable skill count as "skill reach."

Weighted group size:
- Admin treats ordinary skills as 2 weighted points and secondary skills as 1 weighted point.
- This report uses that existing weighting as a proxy for whether a skill group is substantial.
- Many current combat groups are selection-slot groups with low fixed weighted points, so their effective value is understated unless selection slots are considered separately.

## B. Current Military Profession Table

| Profession id | Profession name | Current society levels | Current class bands | Military role category | Skill groups | Meaningful group count | Overlapping groups? | Direct extra skills | Direct count | Skill reach | Soldier or commander? | Initial verdict |
|---|---|---|---|---|---|---:|---|---|---:|---:|---|---|
| `tribal_warrior` | Tribal Warrior | L1-L6 | 1,2,3,4 | Informal fighter / clan warrior | Basic Melee Training; Veteran Soldiering | 2 | Basic Melee is small/slot-based; Veteran Soldiering overlaps perception/combat awareness flavor | Perception; Riding; Weapon Maintenance; First aid; Brawling; Throwing; Bow; Formation Fighting | 8 | 18 | Soldier | Mechanically healthy reach, but too available upward. Restrict from high-society default grids or make culture-specific. |
| `clan_warriors` | Clan Warriors | L1-L6 | 1,2,3,4 | Informal fighter / clan warrior | Basic Melee Training; Veteran Soldiering | 2 | Same overlap as Tribal Warrior | Perception; Riding; Weapon Maintenance; First aid; Throwing; Bow; Formation Fighting | 7 | 18 | Soldier | Same issue as Tribal Warrior; especially odd in level-5/6 contexts. |
| `levy_infantry` | Levy Infantry | L2-L6 | 2,3,4 | Militia / levy | Basic Melee Training; Defensive Soldiering; Veteran Soldiering | 3 | Basic + Defensive both small combat foundations; acceptable together | Perception; Riding; Weapon Maintenance; First aid; 1-h conc./axe; Polearms; Formation Fighting | 7 | 16 | Soldier | Good militia/infantry row, but should not necessarily remain universal through L6. |
| `caravan_guard` | Caravan Guard | L2-L6 | 2,3,4 | Guard / route security | Basic Melee Training; Veteran Soldiering | 2 | Weak concept coverage; no travel/security group beyond direct skills | Perception; Riding; Weapon Maintenance; First aid; Throwing; Formation Fighting | 6 | 17 | Soldier/guard | Needs a Caravan/Route Guard group later or Mounted Service/Transport support. |
| `watchman` | Watchman | L2-L6 | 2,3,4 | Guard / policing / watch | Basic Melee Training; Civic Learning; Defensive Soldiering; Veteran Soldiering | 4 | Civic Learning is useful; soldiering may be too military for simple watch | Perception; Riding; Search; Weapon Maintenance; First aid | 5 | 21 | Soldier/guard | Much better after command split. Could use a dedicated Watch/Guard group and Law. |
| `jailer` | Jailer | L2-L6 | 2,3,4 | Guard / policing / watch | Basic Melee Training; Civic Learning; Defensive Soldiering; Veteran Soldiering | 4 | Similar to Watchman | Perception; Insight; Riding; Search; Weapon Maintenance; First aid | 6 | 22 | Soldier/guard | Good reach. Needs Law/Administration/Detention group more than riding/soldiering. |
| `light_infantry` | Light Infantry | L2-L6 | 2,3,4 | Ordinary soldier | Basic Missile Training; Veteran Soldiering | 2 | Basic Missile has no fixed weighted skills because it is slot-based | Riding; Weapon Maintenance; First aid; Throwing; Bow; Formation Fighting | 6 | 13 | Soldier | Acceptable reach, but group structure depends too much on direct Bow/Throwing. |
| `heavy_infantry` | Heavy Infantry | L2-L6 | 2,3,4 | Ordinary soldier | Basic Melee Training; Defensive Soldiering; Veteran Soldiering | 3 | Solid infantry concept | Riding; Weapon Maintenance; First aid; 1-h conc./axe; Polearms; Formation Fighting | 6 | 16 | Soldier | Coherent, though high-society availability should perhaps become Professional Soldier/Garrison Soldier. |
| `cavalry` | Cavalry | L2-L6 | 2,3,4 | Cavalry / mounted soldier | Mounted Warrior Training; Veteran Soldiering | 2 | Good thematic pairing | Perception; Animal care; Riding; Weapon Maintenance; First aid; Formation Fighting | 6 | 13 | Soldier | Good concept, but low reach for formal cavalry and too broad through L6. |
| `cavalry_mounted_retainer` | Cavalry / Mounted Retainer | L2-L6 | 2,3,4 | Cavalry / mounted soldier | Mounted Warrior Training; Veteran Soldiering | 2 | Nearly duplicates Cavalry | Perception; Animal care; Riding; Weapon Maintenance; First aid; Formation Fighting | 6 | 13 | Soldier | Redundant with Cavalry unless social context is made explicit. |
| `bodyguard` | Bodyguard | L2-L6 | 2,3,4 | Bodyguard / elite guard | Advanced Melee Training; Veteran Soldiering | 2 | Advanced Melee is slot-based/small | Perception; Battlefield Awareness; Insight; Riding; Weapon Maintenance; First aid; Formation Fighting | 7 | 17 | Soldier/guard | Strong martial row; may need Social Perception/Protocol for elite guard variants. |
| `gladiator` | Gladiator | L2-L6 | 2,3,4 | Arena fighter / combat specialist | Advanced Melee Training; Veteran Soldiering | 2 | Veteran Soldiering is battlefield-themed and may not fit arena-only concept | Riding; Weapon Maintenance; First aid; Formation Fighting | 4 | 16 | Soldier, not commander | No longer has command markers, good. Needs an Arena/Gladiator group later. |
| `outrider_scout` | Outrider/Scout | L2-L6 | 2,3,4 | Scout / outrider | Basic Missile Training; Fieldcraft Stealth; Mounted Service; Veteran Soldiering | 4 | Good spread; Basic Missile remains slot-based | Weapon Maintenance; First aid; Formation Fighting | 3 | 18 | Soldier/scout | One of the better rebuilt packages. Could later add tracking/survival if available. |
| `champion` | Champion | L3-L6 | 3,4 | Bodyguard / elite fighter | Advanced Melee Training; Veteran Soldiering | 2 | Similar to Bodyguard/Gladiator | Perception; Battlefield Awareness; Riding; Weapon Maintenance; First aid; Brawling; Formation Fighting | 7 | 16 | Elite soldier, not commander | Good elite fighter, not currently an officer. Could split court champion vs military champion later. |
| `military_officer` | Military Officer | L4-L6 | 4 | Commander / officer | Basic Melee Training; Civic Learning; Defensive Soldiering; Veteran Leadership; Veteran Soldiering | 5 | Good breadth; some overlap between soldiering/leadership | Administration; Oratory; Riding; Weapon Maintenance; First aid; Formation Fighting | 6 | 24 | Commander | Strong current land-command path. Still lacks formal Logistics/Strategy skill if those become canonical. |
| `ships_officer` | Ships Officer | L3-L6 | 3,4 | Naval military / ship command | Maritime Crew Training; Maritime Navigation | 2 | Appropriate, but not explicitly military | Captaincy; Language; Trading; Insight; Perception; Ropework; Boat Handling | 7 | 10 | Commander | Reach is low for command; many direct grants suggest a Ship Command group. |
| `deck_sailor` | Deck Sailor | L2-L6 | 2,3,4 | Naval worker / possible naval military base | Maritime Crew Training; Maritime Navigation | 2 | Appropriate maritime overlap | Language; Trading; Insight; Ropework; Boat Handling; Swim | 6 | 9 | Soldier-equivalent support | Below suggested low-level threshold. Likely okay as nonmilitary sailor, but weak if used as naval military. |
| `sailor` | Sailor | L2-L6 | 2,3,4 | Naval worker / possible naval military base | Maritime Crew Training; Maritime Navigation | 2 | Appropriate | Language; Bargaining; Trading; Insight; Ropework; Boat Handling; Swim | 7 | 10 | Soldier-equivalent support | At low threshold. Not a military role unless armed/naval groups are added. |
| `fisher` | Fisher | L1-L6 | 1,2,3,4 | Maritime civilian, military-adjacent only | Maritime Crew Training; Maritime Navigation | 2 | Navigation may be high for generic fisher | Language; Trading; Insight; Ropework; Boat Handling; Swim | 6 | 9 | Civilian | Should not count as naval military coverage. |
| `assassin` | Assassin | L3-L6 | 3,4 | Military/security-adjacent clandestine | Covert Entry; Fieldcraft Stealth; Street Theft | 3 | Good covert spread | Disguise; Etiquette; Detect Lies; Poison Lore; 1-h edged | 5 | 13 | Not soldier/commander | Useful for state violence, but not military coverage. |
| `spy` | Spy | L3-L6 | 3,4 | Military/security-adjacent intelligence | Covert Entry; Fieldcraft Stealth; Political Acumen; Street Theft | 4 | Good social/covert spread | Disguise; Etiquette; Detect Lies | 3 | 14 | Not soldier/commander | Good intelligence role. Should remain separate from soldier/officer coverage. |
| `bounty_hunter` | Bounty Hunter | L2-L6 | 2,3,4 | Guard / policing adjacent | Covert Entry; Fieldcraft Stealth; Street Theft | 3 | More criminal/covert than lawful guard | Perception; Etiquette; Detect Lies; Brawling; 1-h edged; Captaincy | 6 | 14 | Policing-adjacent, not commander | Captaincy is suspicious here; role wants pursuit/legal/fieldcraft more than command. |

## C. Society-Level Coverage Summary

| Society level | Ordinary fighter/soldier/guard roles present | Veteran soldier roles present | Commander/officer roles present | Missing roles | Inappropriate roles / scaling comments |
|---:|---|---|---|---|---|
| 1 | Tribal Warrior; Clan Warriors; Fisher | Informal warriors have Veteran Soldiering | None | Village guard, militia leader, raider/warband leader | Fisher is maritime civilian; Tribal/Clan are plausible here. |
| 2 | Levy Infantry; Caravan Guard; Watchman; Jailer; Light Infantry; Heavy Infantry; Cavalry; Retainer; Bodyguard; Gladiator; Outrider; Sailor roles | Most Soldier-family rows include Veteran Soldiering | None | Village Guard, Militia Fighter, informal War Leader | Some roles are advanced for L2: formal Cavalry, Heavy Infantry, Watchman/Jailer if institutional. |
| 3 | Adds Champion, Assassin, Spy, Ships Officer | Champion and most soldiers remain available | Ships Officer only | Town Guard, Garrison Soldier, Sergeant, Watch Officer | Good mid-level breadth, but no land command until L4. |
| 4 | Adds Military Officer | All lower soldier roles remain available | Military Officer, Ships Officer | City Watch Officer, Veteran Sergeant, Cavalry Officer | Land officer exists and is rich enough. Low-level tribal/clan roles still appear in L4 societies. |
| 5 | Same as L4 | Same as L4 | Military Officer, Ships Officer | Staff Officer, Quartermaster, Strategist, Elite Guard Officer | Education does not scale upward because no L5-specific military rows exist. Low-level roles remain over-available. |
| 6 | Same as L4/L5 | Same as L4/L5 | Military Officer, Ships Officer | Imperial/Bureaucratic Officer, Staff Officer, Military Strategist | Current L6 has no distinct high-civilization military path; Tribal/Clan rows are most suspicious here. |

Main society-level finding:
- The current grid is minimum-level-only. That is useful mechanically, but it means archaic/informal roles remain available in advanced societies unless a max-level, society-type, or allowed-grid override is added.
- Education does not meaningfully scale past level 4 for military roles because `military_officer` is the only land command path and remains the same at L4-L6.

## D. Class-Level Coverage Summary

| Class level | Military/guard professions available | Commander/officer professions available | Too low / too high class | Missing paths |
|---:|---|---|---|---|
| 1 Common Folk | Tribal Warrior; Clan Warriors; Fisher | None | Tribal/Clan are plausible; Fisher should not count as military | Village guard, militia, raider |
| 2 Trades and Guilds | All L2 soldier/guard/maritime rows: Levy, guards, infantry, cavalry, bodyguard, jailer/watchman, sailors | None | Cavalry/Heavy Infantry may be too formal for class 2 in some societies | Militia fighter, caravan guard is good; add local guard |
| 3 Established Households | Adds Champion, Assassin, Spy, Ships Officer | Ships Officer | Ships Officer as class 3 is plausible; Assassin/Spy are not soldier coverage | Sergeant, town guard captain, garrison soldier |
| 4 Court and Elite | Adds Military Officer | Military Officer; Ships Officer | Officer class placement is good; Noble/court command paths are outside this soldier audit | High-class staff officer, elite guard officer, cavalry officer |

Class-level finding:
- Command/officer access is now correctly class 3-4 for naval and class 4 for land officer.
- High-class slots lack multiple formal military command choices.
- Low-class slots have fighters but not a clean militia/guard path distinct from Tribal/Clan.

## E. Skill Group Quality Review

| Profession | At least two non-overlapping groups? | Group quality notes | Suggested group changes |
|---|---|---|---|
| Tribal Warrior | Barely | Basic Melee is slot-based/small; Veteran Soldiering is advanced-sounding for tribal baseline. | Consider Basic Missile or Fieldcraft group; consider renaming Veteran Soldiering use to Field Soldiering-like concept later. |
| Clan Warriors | Barely | Same as Tribal Warrior. | Same as above; restrict to low society/culture. |
| Levy Infantry | Yes | Basic Melee + Defensive + Veteran Soldiering is coherent. | If available, replace Veteran Soldiering with a lower Drill/Formation group for true levy. |
| Caravan Guard | Barely | Lacks travel/route/security group coverage. | Add Mounted Service or Transport/Caravan Work; later create Route Security. |
| Watchman | Yes | Civic + Defensive + Basic Melee works. | Later create Watch/Guard group including Search, Law, Perception. |
| Jailer | Yes | Civic + Defensive works; soldiering is somewhat broad. | Later create Detention/Security group. |
| Light Infantry | Barely | Basic Missile has 0 fixed weighted points because it is selection-slot based. | Add Fieldcraft Stealth or Defensive Soldiering depending concept. |
| Heavy Infantry | Yes | Coherent formation infantry set. | Good current package. |
| Cavalry | Yes | Mounted Warrior Training is substantial; Veteran Soldiering supports battlefield context. | Good, but may need class/society restriction. |
| Mounted Retainer | Yes | Same as Cavalry; too similar. | Differentiate with Courtly Formation or Household Service if retained. |
| Bodyguard | Barely | Advanced Melee is slot-based/small; Veteran Soldiering helps. | Add Social Reading/Insight or Defensive Soldiering for guard concept. |
| Gladiator | Barely | No arena-specific group; Veteran Soldiering may be conceptually off. | Add future Arena Combat group. |
| Outrider/Scout | Yes | Good mix of missile, mounted, stealth, soldiering. | Good current package. |
| Champion | Barely | Similar to Bodyguard/Gladiator. | Add Courtly Formation or Advanced Melee expansion depending concept. |
| Military Officer | Yes | Strong group breadth and appropriate foundation plus command. | Good; later add Logistics/Staff if created. |
| Ships Officer | Barely | Maritime groups are good but command is direct-skill heavy. | Add future Ship Command group. |
| Sailor/Deck/Fisher | Barely/No for military use | Maritime groups are civilian/work focused. | Do not count as military unless naval combat/security group is added. |
| Assassin/Spy/Bounty Hunter | Yes | Covert groups are coherent. | Keep separate from military coverage; Bounty Hunter may need Law/Pursuit group. |

Group-size finding:
- Several combat groups are intentionally slot-based and look small by weighted fixed memberships:
  - Basic Melee Training: 3
  - Advanced Melee Training: 3
  - Basic Missile Training: 0
  - Defensive Soldiering: 3
- This makes the "at least 6 weighted points" heuristic hard to apply without counting required selection slots.
- Mounted Warrior Training is healthier at 7 weighted points.
- Veteran Leadership is 7 weighted points.

## F. Extra Skill Grant Review

Direct grants that are justified:
- Watchman/Jailer: Perception and Search are sensible.
- Military Officer: Administration and Oratory are sensible; Law is no longer direct after the recent current generated state, but would be justified.
- Ships Officer: Captaincy, Sailing/Navigation-adjacent direct skills are sensible.
- Outrider/Scout: Weapon Maintenance/First Aid are acceptable, though not distinctive.
- Cavalry: Animal Care and Perception are useful flavor.

Direct grants that compensate for missing groups:
- Tribal Warrior / Clan Warriors direct Bow, Throwing, Brawling suggest a low-society Warband/Skirmisher group.
- Caravan Guard direct Riding, Throwing, First Aid suggest Route Security / Caravan Guard group.
- Light Infantry direct Bow/Throwing suggest Basic Missile selection is not materialized enough in reach/points.
- Bodyguard/Champion direct Insight/Battlefield Awareness/Brawling suggest Elite Guard or Duelist/Retainer groups.
- Ships Officer direct Captaincy + many maritime skills suggest Ship Command group.
- Bounty Hunter direct Captaincy is questionable; pursuit/legal/coercive skills suggest Pursuit or Warrant Officer group.

Repeated patterns suggesting future groups:
- `Perception + Search + Law/Civic + Basic Melee/Defensive` = Watch / Civic Guard.
- `Riding + Perception + Fieldcraft + Missile` = Outrider / Scout.
- `Captaincy + Tactics + Administration + Oratory + Law` = Officer Staff / Command.
- `Captaincy + Sailing + Navigation + Ropework/Boat Handling` = Ship Command.
- `Brawling + melee weapon + performance/arena style` = Arena Fighter / Gladiator.

## G. Skill Reach Review

Existing app skill reach metric:
- Unique reachable skills across core and favored tiers after resolving profession family and subtype grants.
- This report uses the same value Admin calls `totalReachableSkills`.

Below low-level target of roughly 10:
- Deck Sailor: 9
- Fisher: 9

At low threshold:
- Sailor: 10
- Ships Officer: 10

Above low-level target but potentially underbuilt for formal/high roles:
- Cavalry: 13
- Mounted Retainer: 13
- Light Infantry: 13
- Bounty Hunter: 14
- Spy: 14
- Ships Officer: 10 is the largest concern among command roles.

Healthy reach:
- Tribal Warrior: 18
- Clan Warriors: 18
- Levy Infantry: 16
- Watchman: 21
- Jailer: 22
- Outrider/Scout: 18
- Military Officer: 24

Low-society roles that may be overbuilt:
- Tribal Warrior and Clan Warriors reach 18 and remain available through L6.
- Their reach is mechanically healthy but conceptually too universal.

High-society roles that are underbuilt:
- Ships Officer has only 10 reach despite being a command role.
- Military Officer is healthy at 24, but it is the only land command path at L4-L6.
- No L5/L6 staff, logistics, strategy, elite guard officer, or imperial officer path exists yet.

Likely causes:
- Some low-level rows inherit robust Soldier-family Veteran Soldiering plus many direct grants.
- Some formal command rows lack dedicated command/logistics groups and rely on direct skills.
- Selection-slot groups are undervalued by the fixed weighted group-size heuristic.

## H. Recommended Changes, Not Implemented

### Remove From Allowed Grid / Restrict Society Level

- Restrict `tribal_warrior` and `clan_warriors` to low-society or culture-specific grids instead of allowing them generally through L6.
- Do not count `fisher`, `deck_sailor`, or generic `sailor` as naval military coverage unless a naval military group is added.
- Keep `assassin` and `spy` as clandestine/security-adjacent, not soldier/officer coverage.

### Move To Different Society Level

- Consider moving formal `cavalry` and `heavy_infantry` from L2 to L3 or L4 unless they represent simpler low-society versions.
- Consider keeping `cavalry_mounted_retainer` at L2 only if it is explicitly a household/retainer path, not formal cavalry.
- Consider moving `watchman`/`jailer` to L3 in formal civic societies, while adding a simpler L1/L2 village guard path.

### Move To Different Class Level

- Keep `military_officer` class 4.
- Keep `ships_officer` class 3-4 or move command-heavy variants to class 4.
- Consider `cavalry` at class 3-4 and `mounted_retainer` at class 2-3.
- Keep ordinary guards and militia at classes 1-3.

### Split Soldier vs Commander Path

- The recent command split is structurally correct.
- Next split should be within experienced troops:
  - Veteran Soldier
  - Veteran Sergeant / small-unit leader
  - Officer / commander
- Avoid giving Veteran Leadership to all veteran soldiers.

### Add / Remove Skill Group

- Add or reuse a Watch/Guard group for Watchman and Jailer.
- Add Route Security or Caravan Guard group for Caravan Guard.
- Add Ship Command for Ships Officer.
- Add Arena Fighter / Gladiator group for Gladiator.
- Add Staff/Logistics group if Logistics or Military Strategy become canonical skills.

### Replace Direct Skill Grants With A New Group

- Replace repeated `Perception + Search + Civic/Law` direct patterns with Watch/Guard.
- Replace repeated `Captaincy + Administration + Oratory + Law` direct patterns with Officer Staff.
- Replace repeated maritime command direct grants with Ship Command.
- Replace low-society weapon direct grants with Warband/Skirmisher.

### Add New Profession Later

- Village Guard, Militia Fighter, Warband Leader.
- Town Guard, Garrison Soldier.
- Veteran Sergeant.
- City Watch Officer.
- Cavalry Officer.
- Quartermaster.
- Staff Officer.
- Imperial/Bureaucratic Officer.
- Elite Guard Officer.

### Rename / Reconceptualize Profession

- Rename `clan_warriors` to singular `Clan Warrior` or `Clan Warband Member`.
- Split or merge `cavalry` and `cavalry_mounted_retainer`.
- Rework `gladiator` as arena-specific rather than Soldier-family battlefield-adjacent.
- Clarify whether `champion` is a courtly champion, arena champion, household elite fighter, or battlefield champion.

## I. Proposed Implementation Batches

1. Allowed-grid / society / class corrections
   - Add or model society/class restrictions before adding many new professions.
   - Decide whether professions need maximum society level, society-type tags, or explicit allowlists.
   - Restrict Tribal/Clan roles from generic L5/L6 availability.

2. Skill-group coverage corrections
   - Add or reuse group coverage for Watch/Guard, Caravan/Route Security, Ship Command, Arena Fighter, and possibly Warband/Skirmisher.
   - Rebalance groups so each profession has at least two meaningful groups without relying on many direct grants.

3. Direct-grant cleanup
   - Remove direct grants that duplicate group coverage.
   - Keep direct grants for flavor or specialization.
   - Move repeated patterns into groups.

4. New skill groups if needed
   - Watch / Civic Guard.
   - Ship Command.
   - Officer Staff / Logistics.
   - Arena Fighter.
   - Warband / Skirmisher.

5. New officer / staff / high-society military professions
   - Add a small number of targeted high-level roles after the grid model is clear.
   - Start with Veteran Sergeant, City Watch Officer, Quartermaster, Staff Officer, and Imperial/Bureaucratic Officer.

## Decisions Needed Before Implementation

- Should profession availability support a maximum society level, or should all filtering be done through explicit allowed-grid entries?
- Should low-society cultural roles like Tribal Warrior and Clan Warrior remain visible in advanced societies as background/culture choices?
- Should class level be hard-gated for officers, or advisory with society/campaign overrides?
- Should naval command be part of the same military profession family cleanup, or handled as a separate maritime pass?
- Should group weighted size count required selection slots, so Basic Melee / Basic Missile / Advanced Melee stop looking artificially small?
