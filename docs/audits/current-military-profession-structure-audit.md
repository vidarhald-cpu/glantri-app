# Current Military Profession Structure Audit

Date: 2026-04-30

Scope: read-only audit of the current repo-local/generated Glantri profession catalog after the recent military, guard, route-security, arena, and maritime-command cleanup passes.

No profession/content changes are implemented by this document.

## A. Method And Data Sources

Files and read models inspected:

- `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts`
- `packages/content/scripts/generateRepoLocalGlantriSeed.mjs`
- `data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json`
- `packages/rules-engine/src/professions/resolveEffectiveProfessionPackage.ts`
- `apps/web/src/lib/admin/viewModels.ts`
- `packages/domain/src/content/skills.ts`
- `packages/domain/src/profession/professions.ts`
- Existing reports in `docs/audits/`

Society level:

- Canonical society level comes from `content.societies[*].societyLevel`.
- Current generated availability comes from `content.societyLevels[*].professionIds`, joined to canonical society through `societyId`.
- Recent generated overrides now constrain `tribal_warrior` and `clan_warriors` to society levels 1-2.

Class band:

- `content.societyLevels[*].societyLevel` is the access/class band, not the canonical society level.
- Current class bands are:
- Class 1: Common Folk
- Class 2: Trades and Guilds
- Class 3: Established Households
- Class 4: Court and Elite
- Recent generated overrides now constrain `tribal_warrior` and `clan_warriors` to class bands 1-2.

Skill groups and direct grants:

- Profession package grants were read from generated `professionSkills`.
- Effective package logic matches `resolveEffectiveProfessionPackage`: family grants plus subtype grants, split into group grants and direct skill grants.
- Direct-only skills are direct grants not already reachable through granted groups.

Skill reach:

- The existing app has a clear skill-reach metric: unique skills reachable from effective core/favored groups plus direct-only skills.
- This report uses that same effective unique reachable-skill count.

Meaningful groups:

- This audit treats a group as meaningful when it contributes a coherent profession package, even when a combat group is partly selection-slot based.
- Recent generated contextual groups now include `watch_civic_guard`, `route_security`, `arena_training`, and `ship_command`.

## B. Current Military/Security Profession Table

| Profession id | Name | Society levels | Class bands | Role category | Groups | Meaningful groups | Direct grants | Direct-only after groups | Reach | Command education? | Combat/foundation? | Initial verdict |
|---|---|---:|---:|---|---|---:|---|---|---:|---|---|---|
| `tribal_warrior` | Tribal Warrior | 1-2 | 1-2 | Informal fighter / tribal warrior | Veteran Soldiering; Basic Melee Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Brawling; Throwing; Bow | Formation Fighting; Riding; First aid; Weapon Maintenance; Throwing; Bow | 18 | No | Yes | Correctly constrained now. Still has high reach and some direct-grant patchwork; acceptable pending a low-society warband package. |
| `clan_warriors` | Clan Warriors | 1-2 | 1-2 | Informal fighter / clan warrior | Veteran Soldiering; Basic Melee Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; 1-h conc./axe; Throwing; Bow | Formation Fighting; Riding; First aid; Weapon Maintenance; Throwing; Bow | 18 | No | Yes | Correctly constrained now. Consider singular rename and a cleaner clan/warband group later. |
| `levy_infantry` | Levy Infantry | 2-6 | 2-4 | Militia / levy infantry | Veteran Soldiering; Basic Melee Training; Defensive Soldiering | 3 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Polearms; 1-h conc./axe | Riding; First aid; Weapon Maintenance | 16 | No | Yes | Cleaner after officer split. Still too broadly available upward unless treated as default low/mid soldier filler. |
| `caravan_guard` | Caravan Guard | 2-6 | 2-4 | Route guard / caravan security | Veteran Soldiering; Basic Melee Training; Route Security | 3 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Throwing | Formation Fighting; Weapon Maintenance; Throwing | 20 | No | Yes | Much improved. Could later split road patrol/route warden from mercantile caravan guard. |
| `watchman` | Watchman | 2-6 | 2-4 | Civic guard / policing | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | 4 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance | Riding; First aid; Weapon Maintenance | 20 | No | Yes | Much improved. Watch group now carries civic/search/law flavor; remaining Soldier-family direct riding is not ideal. |
| `jailer` | Jailer | 2-6 | 2-4 | Detention / civic security | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | 4 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance | Riding; First aid; Weapon Maintenance | 20 | No | Yes | Improved, but still inherits riding from Soldier family. Later detention-specific group could replace broad soldier flavor. |
| `light_infantry` | Light Infantry | 2-6 | 2-4 | Ordinary soldier / skirmisher | Veteran Soldiering; Basic Missile Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Dodge; Throwing; Bow | Formation Fighting; Riding; First aid; Weapon Maintenance | 13 | No | Yes | Viable but thin. Basic Missile is slot-based, so displayed reach understates weapon choice. Consider Scout/Skirmisher group later. |
| `heavy_infantry` | Heavy Infantry | 2-6 | 2-4 | Ordinary soldier / formation infantry | Veteran Soldiering; Basic Melee Training; Defensive Soldiering | 3 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Parry; Polearms; 1-h conc./axe | Riding; First aid; Weapon Maintenance | 16 | No | Yes | Coherent package. May be too formal for level 2 in some societies and too generic for levels 5-6. |
| `cavalry` | Cavalry | 2-6 | 2-4 | Mounted soldier | Veteran Soldiering; Mounted Warrior Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Mounted Combat; Animal care | Formation Fighting; First aid; Weapon Maintenance; Animal care | 13 | No | Yes | Coherent but low reach for formal cavalry. Likely needs society/class constraints or a future cavalry officer path. |
| `cavalry_mounted_retainer` | Cavalry / Mounted Retainer | 2-6 | 2-4 | Mounted retainer / cavalry | Veteran Soldiering; Mounted Warrior Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Animal care | Formation Fighting; First aid; Weapon Maintenance; Animal care | 13 | No | Yes | Near-duplicate of Cavalry. Keep only if social role differs; otherwise rename/restrict. |
| `bodyguard` | Bodyguard | 2-6 | 2-4 | Bodyguard / elite guard | Veteran Soldiering; Advanced Melee Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Insight | Formation Fighting; Riding; First aid; Weapon Maintenance; Insight | 17 | No | Yes | Good martial reach, but concept wants Social Reading/Watch/Elite Guard coverage more than Riding. |
| `gladiator` | Gladiator | 2-6 | 2-4 | Arena fighter | Advanced Melee Training; Arena Training | 2 | None | None | 14 | No | Yes | Much cleaner after arena-family split. Consider society/class limits or cultural entertainment treatment later. |
| `outrider_scout` | Outrider/Scout | 2-6 | 2-4 | Scout / outrider | Veteran Soldiering; Basic Missile Training; Mounted Service; Fieldcraft Stealth | 4 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance | Formation Fighting; First aid; Weapon Maintenance | 18 | No | Yes | Strong package. Still inherits Formation Fighting from Soldier family; acceptable for now. |
| `champion` | Champion | 3-6 | 3-4 | Elite fighter / champion | Veteran Soldiering; Advanced Melee Training | 2 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Brawling | Formation Fighting; Riding; First aid; Weapon Maintenance | 16 | No | Yes | Good elite fighter, not officer. Needs conceptual split: court champion, duelist, or military champion. |
| `military_officer` | Military Officer | 4-6 | 4 | Land officer / commander | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Veteran Leadership; Civic Learning | 5 | Perception; Formation Fighting; Riding; Battlefield Awareness; First aid; Weapon Maintenance; Captaincy; Tactics; Oratory; Administration; Law; Combat Experience | Riding; First aid; Weapon Maintenance; Oratory; Administration | 24 | Yes | Yes | Strong and correctly class-gated. Still the only land officer path for levels 4-6. |
| `ships_officer` | Ships Officer | 3-6 | 3-4 | Maritime command / ship officer | Maritime Crew Training; Maritime Navigation; Ship Command | 3 | Boat Handling; Ropework; Language; Trading; Insight | Language; Trading | 12 | Yes | Yes, maritime | Improved, but reach remains low for a formal command role. Good candidate for later naval/officer pass. |
| `sailor` | Sailor | 2-6 | 2-4 | Maritime worker / naval base | Maritime Crew Training; Maritime Navigation | 2 | Boat Handling; Ropework; Language; Trading; Insight; Sailing; Swim; Bargaining | Language; Trading; Insight; Swim; Bargaining | 10 | No | Maritime | Civilian/crew role; do not count as military unless naval combat/security package is added. |
| `deck_sailor` | Deck Sailor | 2-6 | 2-4 | Maritime worker / naval base | Maritime Crew Training; Maritime Navigation | 2 | Boat Handling; Ropework; Language; Trading; Insight; Swim | Language; Trading; Insight; Swim | 9 | No | Maritime | Below low-level target; probably okay as civilian support, weak as naval military. |
| `fisher` | Fisher | 1-6 | 1-4 | Maritime civilian | Maritime Crew Training; Maritime Navigation | 2 | Boat Handling; Ropework; Language; Trading; Insight; Sailing; Navigation; Swim | Language; Trading; Insight; Swim | 9 | No | Maritime | Should not count as military coverage. Availability through all levels is fine as civilian, not as formal profession scaling. |
| `bounty_hunter` | Bounty Hunter | 2-6 | 2-4 | Pursuit / coercive security-adjacent | Street Theft; Covert Entry; Fieldcraft Stealth | 3 | Detect Lies; Etiquette; Conceal Object; Camouflage; Search; Perception; Stealth; Captaincy; 1-h edged; Brawling | Detect Lies; Etiquette; Perception; Captaincy; 1-h edged; Brawling | 14 | Suspicious Captaincy only | No coherent guard foundation | Security-adjacent but not military. Captaincy looks wrong; future pursuit/legal group recommended. |
| `assassin` | Assassin | 3-6 | 3-4 | Clandestine violence / intelligence-adjacent | Street Theft; Covert Entry; Fieldcraft Stealth | 3 | Detect Lies; Etiquette; Conceal Object; Camouflage; Stealth; Disguise; Search; Poison Lore; 1-h edged | Detect Lies; Etiquette; Disguise; Poison Lore; 1-h edged | 13 | No | No | Military-adjacent only. Do not count as soldier/guard coverage. |
| `spy` | Spy | 3-6 | 3-4 | Intelligence / state security-adjacent | Street Theft; Covert Entry; Fieldcraft Stealth; Political Acumen | 4 | Detect Lies; Etiquette; Conceal Object; Camouflage; Disguise; Intrigue; Stealth; Search | Detect Lies; Etiquette; Disguise | 14 | No | No | Useful high-class security-adjacent role, but not a military profession. |

## C. Society-Level Review

| Society level | Present roles | Missing roles | Inappropriate or suspicious roles | Education scaling comments |
|---:|---|---|---|---|
| 1 | Tribal Warrior; Clan Warriors; Fisher | Village Guard; Militia Fighter; Warband Leader | Fisher is civilian, not military. | Low-society informal fighters are now correctly constrained. No formal command path exists, which is mostly correct. |
| 2 | Levy Infantry; Caravan Guard; Watchman; Jailer; Light Infantry; Heavy Infantry; Cavalry; Mounted Retainer; Bodyguard; Gladiator; Outrider/Scout; Sailor/Deck/Fisher; Bounty Hunter | Village Guard; Militia Fighter; Road Patrol; simple Town Guard | Heavy Infantry, Cavalry, Watchman/Jailer may be too formal for some L2 societies. Gladiator may be cultural/urban rather than universal. | Reach is healthy, but many rows are inherited upward and still share Soldier-family direct flavor. |
| 3 | Adds Champion; Ships Officer; Assassin; Spy | Garrison Soldier; Veteran Sergeant; Town Guard; City Watchman; Watch Officer | Assassin/Spy should not be counted as guard/soldier coverage. | Ships Officer is now coherent but still reach 12. Land command still absent until L4. |
| 4 | Adds Military Officer | City Watch Officer; Cavalry Officer; Quartermaster; Veteran Sergeant | Many L2 roles still appear as normal options in L4 societies. | Military Officer is strong, but it is the only land officer path. |
| 5 | Same as L4 plus inherited lower roles | Staff Officer; Quartermaster; Imperial/Bureaucratic Officer; Elite Guard Officer; Military Strategist | Levy Infantry, Cavalry, Jailer/Watchman, Gladiator, etc. remain available by upward minimum-level behavior. | Education does not scale enough. High-level societies need richer formal military/staff paths. |
| 6 | Same as L5 | Imperial Officer; Staff Officer; Elite Guard Officer; Palace Guard Officer; Logistics Commander | Same inherited lower roles; no L6-specific command path. | Level 6 remains underbuilt for formal military bureaucracy. |

Specific society-level findings:

- `tribal_warrior` and `clan_warriors` are now properly constrained to S1-S2 and C1-C2.
- `levy_infantry`, `heavy_infantry`, `cavalry`, `watchman`, `jailer`, `caravan_guard`, `bodyguard`, `champion`, and `gladiator` still appear upward through high societies.
- Some upward availability is fine, but advanced societies should not rely on the same L2 roles as their main military catalog.
- L5-L6 remain the biggest gap: there are no dedicated staff, logistics, elite guard officer, or imperial/bureaucratic officer paths.

## D. Class-Band Review

| Class band | Current military/security availability | Officer/commander access | Too low / too high concerns | Missing paths |
|---:|---|---|---|---|
| 1 | Tribal Warrior; Clan Warriors; Fisher | None | Correct for informal roles. Fisher is civilian. | Village Guard; Militia Fighter; informal Warband Leader. |
| 2 | Most ordinary soldier/guard roles: Levy, Caravan Guard, Watchman, Jailer, Infantry, Cavalry, Bodyguard, Gladiator, Outrider, Sailors, Bounty Hunter | None clear | Cavalry, Heavy Infantry, Bodyguard, Watchman/Jailer may be too institutional or equipment-heavy for some C2 contexts. | Village Guard, Road Patrol, Militia Fighter, Garrison Recruit. |
| 3 | Adds Champion, Ships Officer, Assassin, Spy | Ships Officer | Ships Officer C3-C4 is plausible. Champion is okay if elite fighter, not officer. | Veteran Sergeant, Town Guard, City Watch Officer junior path. |
| 4 | Adds Military Officer | Military Officer; Ships Officer | Land officer is correctly C4. Many ordinary rows still remain available to C4. | Staff Officer, Quartermaster, Cavalry Officer, Elite Guard Officer. |

Class-band findings:

- Officers are mostly class-gated appropriately: `military_officer` is C4, `ships_officer` is C3-C4.
- Ordinary soldiers/guards are broadly C2-C4. This is usable as an interim model, but it makes elite/court bands show too many basic occupations.
- Classes 3-4 need more specialist and commander options before constraining ordinary rows further.

## E. Constraint Candidates

| Profession | Current availability | Proposed availability | Reason | Risk | Replacement needed first? |
|---|---|---|---|---|---|
| `levy_infantry` | S2-S6, C2-C4 | S2-S4, C1-C3 or C2-C3 | Levy is less plausible as default high-society/court profession. | Could leave L5-L6 with too few ordinary soldier rows. | Yes: Garrison Soldier / Professional Soldier. |
| `heavy_infantry` | S2-S6, C2-C4 | S3-S5, C2-C3; elite variants C3-C4 | Formal heavy infantry should start later or be society-specific. | Could remove a useful core infantry role from L2. | Yes: Militia Fighter / Garrison Soldier. |
| `cavalry` | S2-S6, C2-C4 | S3-S5, C3-C4 | Formal cavalry is equipment/socially restricted. | Mounted societies may need low-society cavalry analogues. | Yes: Mounted Warrior / Cavalry Officer split. |
| `cavalry_mounted_retainer` | S2-S6, C2-C4 | S2-S4, C2-C3, or rename as Mounted Retainer | Currently duplicates Cavalry. | Losing a useful mounted household role. | Maybe: Mounted Retainer can remain if renamed. |
| `watchman` | S2-S6, C2-C4 | S3-S5, C2-C3; high variants replaced by Watch Officer | Urban/institutional watch is not universal low/high role. | Could remove civic guard coverage from S2. | Yes: Village Guard / Town Guard. |
| `jailer` | S2-S6, C2-C4 | S3-S5, C2-C3; high variants replaced by Watch Officer/Prison Official | Institutional detention needs civic state support. | Could reduce security coverage. | Yes: Village Guard / City Watch Officer. |
| `caravan_guard` | S2-S6, C2-C4 | S2-S5, C2-C3; C4 as Route Warden/Officer later | Route security is plausible broadly but less elite. | High societies still need road patrol/security. | Maybe: Route Warden. |
| `bodyguard` | S2-S6, C2-C4 | S2-S6, C2-C4, but split Elite Guard at high classes | Bodyguard is plausible broadly, but elite/court bodyguard needs social skills. | Low risk if left unchanged. | Later: Elite Guard / Elite Guard Officer. |
| `gladiator` | S2-S6, C2-C4 | S2-S5, C2-C3, culture/urban as needed | Arena profession is urban/cultural, not universal. | Could remove a fun combat role from many builds. | No, can be culture/background later. |
| `champion` | S3-S6, C3-C4 | S3-S6, C3-C4, but clarify court vs military champion | Good elite fighter, not commander. | Low. | Maybe: Duelist / Elite Guard. |
| `ships_officer` | S3-S6, C3-C4 | Keep for now | New `ship_command` makes it coherent. | Low. | Later: Warship Officer if naval military grows. |
| `bounty_hunter` | S2-S6, C2-C4 | Keep but remove/rework Captaincy later | Security-adjacent but current command marker is odd. | Medium if used in chargen tests. | Later: Pursuit/Warrant group. |
| `fisher` | S1-S6, C1-C4 | No military constraint needed; treat as civilian | It should not count as naval coverage. | None. | No. |

## F. New Profession Gap Analysis

| Proposed profession | Society range | Class bands | Role category | Concept | Suggested groups | Direct skills only if needed | Reach target | Replaces/complements | Priority |
|---|---|---|---|---|---|---|---:|---|---|
| Village Guard | S1-S2 | C1-C2 | Guard / policing | Local household, gate, or village security. | Basic Melee Training; Watch / Civic Guard or lighter Village Watch group | Perception or Search only if group absent | 10-14 | Complements Watchman/Jailer; allows restricting them upward. | High |
| Militia Fighter | S1-S3 | C1-C3 | Militia / levy | Part-time local defender. | Basic Melee Training; Basic Missile Training; Defensive Soldiering | First aid; Formation Fighting | 10-15 | Complements Levy Infantry; supports low/mid gaps. | High |
| Warband Leader | S1-S2 | C2-C3 | Informal command | Clan/tribal small-unit leader. | Basic Melee Training; Veteran Soldiering or low command group | Oratory; Captaincy only if low-command intended | 12-16 | Complements Tribal/Clan; avoids formal officer skills. | Medium |
| Town Guard | S3-S4 | C2-C3 | Guard / policing | Organized town security. | Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | Law if not already covered | 14-18 | Lets Watchman become more specific. | High |
| Garrison Soldier | S3-S5 | C2-C3 | Ordinary soldier | Professional fort/town soldier. | Basic Melee Training; Defensive Soldiering; Veteran Soldiering | Weapon Maintenance; First Aid | 15-18 | Replaces upward Levy/Heavy Infantry generic use. | High |
| Veteran Sergeant | S3-S5 | C3 | Small-unit leader | Experienced troop leader, not formal officer. | Veteran Soldiering; Defensive Soldiering; limited Leadership/Command group | Captaincy or Tactics, not both unless justified | 16-20 | Bridges soldiers and officers. | High |
| City Watch Officer | S4-S6 | C3-C4 | Policing command | Officer of urban watch/security. | Watch / Civic Guard; Veteran Leadership or Civic Command group | Law; Administration; Oratory | 16-22 | Enables constraining Watchman/Jailer. | High |
| Cavalry Officer | S4-S6 | C3-C4 | Mounted officer | Mounted unit commander. | Mounted Warrior Training; Veteran Soldiering; Veteran Leadership | Captaincy; Tactics; Heraldry | 18-22 | Complements Cavalry / Mounted Retainer. | Medium |
| Quartermaster | S4-S6 | C3-C4 | Logistics / staff | Supply, equipment, pay, movement, stores. | Commercial Administration; Civic Learning; Operations | Weapon Maintenance; Bookkeeping | 16-22 | Adds non-combat military staff path. | High |
| Staff Officer | S5-S6 | C4 | Staff / command | Literate/bureaucratic planning officer. | Veteran Leadership; Civic Learning; Courtly Formation or Operations | Tactics; Administration; Law | 18-24 | Complements Military Officer at high society. | High |
| Imperial/Bureaucratic Officer | S6 | C4 | High-state officer | Roman/imperial officer shaped by bureaucracy. | Veteran Leadership; Civic Learning; Courtly Formation; Literate Foundation | Captaincy; Tactics; Administration; Law; Heraldry | 20-26 | Replaces generic L6 reliance on L4 Military Officer. | Medium |
| Elite Guard Officer | S5-S6 | C4 | Elite guard / court military | Palace/household guard commander. | Veteran Leadership; Defensive Soldiering; Courtly Formation; Watch / Civic Guard | Insight; Heraldry; Etiquette | 18-24 | Complements Bodyguard/Champion. | Medium |
| Warship Officer | S4-S6 | C3-C4 | Naval command | Military naval officer, distinct from merchant Ships Officer. | Maritime Crew Training; Maritime Navigation; Ship Command | Tactics only if naval tactics exists later | 16-22 | Complements Ships Officer. | Low until naval combat pass. |
| Route Warden / Road Patrol | S3-S5 | C2-C3 | Route security / state patrol | State road patrol, toll/security enforcement. | Route Security; Watch / Civic Guard; Basic Missile Training | Law; Riding | 14-18 | Complements Caravan Guard. | Medium |

## G. Skill Group Quality Review

Recent cleanup improvements:

- `Watch / Civic Guard` now gives Watchman/Jailer a civic/search/law package without Parry.
- `Route Security` now gives Caravan Guard a road-security package without officer skills.
- `Arena Training` now gives Gladiator arena context without Dodge/Brawling/Parry/weapon duplication.
- `Ship Command` now gives Ships Officer a maritime command package without land `Veteran Leadership`.
- Ordinary soldier roles no longer inherit broad `Veteran Leadership`, Captaincy, and Tactics.

Remaining group-quality issues:

- Soldier-family direct grants still leak `Riding`, `First aid`, and `Weapon Maintenance` into many roles where they are not concept-specific.
- `Veteran Soldiering` is still broad and may be too advanced-sounding for `tribal_warrior`, `clan_warriors`, and true levy roles.
- `Basic Missile Training` is selection-slot based and has low fixed-membership reach, so light infantry may look thinner than intended.
- Cavalry and Mounted Retainer are still too similar.
- Bodyguard and Champion still lack an elite/court guard or duelist-style context group.
- Ships Officer improved, but reach 12 is still low for a command role.

## H. Extra Direct Grant Review

Direct grants that remain justified:

- `ships_officer`: `language` and `trading` are useful maritime officer flavor after group coverage.
- `gladiator`: now none, which is clean.
- `caravan_guard`: `throwing` and `weapon_maintenance` are useful flavor; `formation_fighting` is inherited and less clearly route-security oriented.
- `military_officer`: `oratory` and `administration` are justified officer flavor.

Direct grants that suggest future cleanup:

- Soldier-family `riding` appears in Watchman/Jailer/Bodyguard/Infantry where it is not always appropriate.
- Soldier-family `formation_fighting` appears in Caravan Guard, Watchman/Jailer, Bodyguard, Champion, and Outrider; some of these are not formation troops.
- `bounty_hunter` has `captaincy`, which is suspicious and should probably become Law/Pursuit/Tracking-style coverage instead.
- `bodyguard` and `champion` direct `insight`/`brawling` patterns suggest a future Elite Guard, Duelist, or Personal Guard group.

## I. Skill Reach Review

Below low-level target around 10:

- `deck_sailor`: 9
- `fisher`: 9

At low threshold:

- `sailor`: 10

Low for formal/command expectations:

- `ships_officer`: 12, improved but still below the preferred 15+ for formal command.
- `cavalry`: 13 and `cavalry_mounted_retainer`: 13, low for formal/high-society cavalry.
- `light_infantry`: 13, acceptable but thin.
- `gladiator`: 14, acceptable after cleanup.

Healthy:

- `military_officer`: 24
- `watchman`: 20
- `jailer`: 20
- `caravan_guard`: 20
- `outrider_scout`: 18
- `tribal_warrior` and `clan_warriors`: 18, now constrained to low society/class bands.

Main reach conclusion:

- The worst mechanical gap is no longer ordinary guards; it is high-society/formal command breadth.
- Ships Officer needs either a richer command package later or a separate `Warship Officer`.
- L5-L6 military career diversity remains weak despite healthy `military_officer` reach.

## J. Recommended Changes, Not Implemented

### 1. Constraints That Can Probably Be Applied Soon

- Keep `tribal_warrior` and `clan_warriors` constrained as they are.
- Consider restricting `fisher` from any future military/security rollups; leave availability as civilian.
- Consider removing or replacing `captaincy` from `bounty_hunter`; this is a content cleanup, not a grid constraint.

### 2. Constraints That Need Replacement Professions First

- Restrict `levy_infantry` upward only after adding `Garrison Soldier` or `Professional Soldier`.
- Restrict `watchman`/`jailer` upward only after adding `Town Guard` and `City Watch Officer`.
- Restrict `cavalry`/`mounted_retainer` only after deciding whether both remain and adding `Cavalry Officer`.
- Restrict `heavy_infantry` only after adding a mid/high formal soldier path.

### 3. New Low/Mid Soldier And Guard Professions

- Add `Village Guard`.
- Add `Militia Fighter`.
- Add `Town Guard`.
- Add `Garrison Soldier`.
- Add `Veteran Sergeant`.

### 4. New Officer/Commander Professions

- Add `City Watch Officer`.
- Add `Cavalry Officer`.
- Add `Quartermaster`.
- Add `Staff Officer`.
- Add `Imperial/Bureaucratic Officer`.
- Add `Elite Guard Officer`.

### 5. Naval/Maritime Military Pass

- Keep `ships_officer` as generic maritime command for now.
- Later decide whether it is merchant/naval/both.
- If naval combat becomes important, add `Warship Officer` and possibly a naval tactics group instead of putting land `Tactics` into `ship_command`.

### 6. Direct-Grant Cleanup

- Review Soldier-family direct grants after replacement professions exist.
- Move repeated direct patterns into coherent groups where possible.
- Avoid removing direct grants before replacement groups are available, because several roles currently rely on them for reach.

## K. Proposed Implementation Batches

1. Safe cleanup now:
- Keep current low-society constraints.
- Remove/rework suspicious `bounty_hunter` Captaincy if desired.
- Add no broad grid restrictions yet.

2. Low/mid coverage:
- Add Village Guard, Militia Fighter, Town Guard, and Garrison Soldier.
- Then restrict Watchman/Jailer/Levy/Heavy Infantry more confidently.

3. Small-unit command:
- Add Veteran Sergeant and Warband Leader.
- Keep Veteran Leadership reserved for true commanders/officers.

4. Formal command:
- Add City Watch Officer, Cavalry Officer, Quartermaster, Staff Officer.
- Add Imperial/Bureaucratic Officer or equivalent L6 command path.

5. Naval pass:
- Decide whether Ships Officer is merchant, naval, or both.
- Add Warship Officer only if naval military coverage needs a separate path.

6. Final direct-grant cleanup:
- Revisit Soldier-family direct grants.
- Replace repeated direct-grant patterns with groups.
- Tighten class/society availability once replacements exist.

## Top 5 Recommended Next Implementation Decisions

1. Decide whether to add `Village Guard` and `Town Guard` before constraining `watchman` and `jailer`.
2. Decide whether `levy_infantry` and `heavy_infantry` should remain available through S6 or be replaced upward by `Garrison Soldier`.
3. Decide whether `cavalry` and `cavalry_mounted_retainer` should both remain, and if so what society/class distinction separates them.
4. Decide whether `ships_officer` is merchant command, naval command, or both before adding `Warship Officer`.
5. Decide whether to clean `bounty_hunter` now by removing Captaincy or wait for a pursuit/legal-security group.

## Design Questions Requiring Approval

- Should high-society availability use max society/class constraints broadly, or should advanced societies keep all lower professions as default options?
- Should culture/background/foreign professions be modeled separately so roles like Gladiator, Tribal Warrior, and Clan Warrior can appear outside their default society bands when fictionally appropriate?
- Should `Veteran Soldiering` be split into a lower `Field Soldiering`/`Common Soldiering` package and a true veteran package later?
- Should `Ship Command` remain merchant/naval-neutral, or should naval command receive separate Tactics-like support in a later content pass?
- Should Bounty Hunter be treated as lawful/security-adjacent or as a thief/infiltrator subtype with coercive flavor?
