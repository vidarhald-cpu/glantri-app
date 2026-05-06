# Current Military Profession Structure Audit

Date: 2026-05-01

Scope: read-only audit of the current repo-local/generated Glantri military and security profession catalog after the recent skill-category, skill-group, soldier/officer, mounted, naval, bounty-hunter, bodyguard/champion, and elite-guard cleanup passes.

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

Interpretation:

- Society availability is read from generated `societyLevels[*].professionIds`, joined to canonical `societies[*].societyLevel`.
- Class availability is read from generated `societyLevels[*].societyLevel`, where class bands are 1-4.
- Profession packages are read as effective family plus subtype grants from generated `professionSkills`, matching the existing app package resolver.
- Skill reach is the current app/admin-style proxy: unique skills reachable from granted skill groups plus direct skills that are not already covered by those groups.
- Command education means a profession has `veteran_leadership`, `captaincy`, `tactics`, or an equivalent command package.
- Combat/foundation means the profession has a coherent martial, security, mounted, maritime, or field package appropriate to the role.

## B. Current Profession Table

| Profession id | Name | Society | Class | Role category | Groups | Direct grants | Reach | Command education? | Combat/foundation? | Verdict |
|---|---|---:|---:|---|---|---|---:|---|---|---|
| `tribal_warrior` | Tribal Warrior | 1-2 | 1-2 | Informal fighter | Veteran Soldiering; Basic Melee Training | Perception; Brawling; Throwing; Bow | 14 | No | Yes | Good enough. Correctly constrained, though `Veteran Soldiering` may be semantically too formal. |
| `clan_warriors` | Clan Warriors | 1-2 | 1-2 | Informal clan fighter | Veteran Soldiering; Basic Melee Training | Perception; 1-h conc./axe; Throwing; Bow; Battlefield Awareness | 14 | No | Yes | Acceptable. Consider singular rename and warband package later. |
| `village_guard` | Village Guard | 1-2 | 1-2 | Local guard | Basic Melee Training; Watch / Civic Guard; Defensive Soldiering | None | 15 | No | Yes | Good. Fills low-society guard gap. |
| `militia_fighter` | Militia Fighter | 1-3 | 1-3 | Militia / part-time defender | Basic Melee Training; Basic Missile Training; Defensive Soldiering | None | 16 | No | Yes | Good. Fills low/mid militia gap. |
| `levy_infantry` | Levy Infantry | 2-4 | 1-3 | Levy infantry | Veteran Soldiering; Basic Melee Training; Defensive Soldiering | Perception; First aid; Polearms; 1-h conc./axe; Battlefield Awareness | 14 | No | Yes | Acceptable. Direct grants are concept-specific enough for now. |
| `garrison_soldier` | Garrison Soldier | 3-5 | 2-3 | Professional soldier | Basic Melee Training; Defensive Soldiering; Veteran Soldiering | None | 13 | No | Yes | Good enough. Reach is modest but coherent. |
| `light_infantry` | Light Infantry | 2-6 | 2-4 | Skirmisher / light soldier | Veteran Soldiering; Basic Missile Training; Defensive Soldiering | Perception; Dodge; Throwing; Bow; Battlefield Awareness | 11 | No | Yes | Needs small cleanup. Availability is broad and direct combat grants remain. |
| `heavy_infantry` | Heavy Infantry | 3-5 | 2-3 | Formation infantry | Veteran Soldiering; Basic Melee Training; Defensive Soldiering | Parry; Formation Fighting; Polearms; 1-h conc./axe; Battlefield Awareness | 13 | No | Yes | Acceptable. Direct grants are plausible formation-infantry specialization. |
| `watchman` | Watchman | 3-5 | 2-3 | Civic watch | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | None | 17 | No | Yes | Good. The package is clean and no longer carries riding/direct soldier leakage. |
| `jailer` | Jailer | 3-5 | 2-3 | Detention security | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | None | 17 | No | Yes | Good enough. A later prison/gaoler package could distinguish it from Watchman. |
| `city_watch_officer` | City Watch Officer | 4-6 | 3-4 | Civic security command | Basic Melee Training; Watch / Civic Guard; Defensive Soldiering; Veteran Leadership; Civic Learning | None | 21 | Yes | Yes | Good. Distinct from Military Officer. |
| `caravan_guard` | Caravan Guard | 2-6 | 2-4 | Route security | Veteran Soldiering; Basic Melee Training; Route Security | Throwing | 18 | No | Yes | Acceptable. Availability remains broad; direct Throwing is small flavor. |
| `bounty_hunter` | Bounty Hunter | 2-6 | 2-4 | Pursuit / coercive security | Street Theft; Covert Entry; Fieldcraft Stealth; Watch / Civic Guard | Detect Lies; Etiquette; Conceal Object; Camouflage; Search; Perception | 14 | No | Yes, security/infiltration | Good enough. Hybrid lawful/underworld package is coherent. |
| `bodyguard` | Bodyguard | 2-6 | 2-4 | Personal protection | Advanced Melee Training; Watch / Civic Guard; Defensive Soldiering; Courtly Formation | None | 18 | No | Yes | Good. Clean protection/security package. |
| `elite_guard_officer` | Elite Guard Officer | 5-6 | 4 | Elite/court guard command | Watch / Civic Guard; Basic Melee Training; Defensive Soldiering; Courtly Formation; Veteran Soldiering; Veteran Leadership; Political Acumen | None | 23 | Yes | Yes | Good. Distinct high-society court-security command path. |
| `gladiator` | Gladiator | 2-6 | 2-4 | Arena fighter | Advanced Melee Training; Arena Training | None | 14 | No | Yes | Acceptable. Culture/urban availability may need later treatment. |
| `champion` | Champion | 3-6 | 3-4 | Court/arena representative fighter | Advanced Melee Training; Arena Training; Courtly Formation | None | 17 | No | Yes | Good. No longer relies on isolated Brawling. |
| `cavalry_mounted_retainer` | Mounted Retainer | 2-4 | 2-3 | Household mounted retainer | Mounted Warrior Training; Mounted Service; Courtly Formation; Route Security | None | 15 | No | Yes | Good. Mechanically distinct from Cavalry. |
| `cavalry` | Cavalry | 3-5 | 2-3 | Mounted soldier | Veteran Soldiering; Mounted Warrior Training; Basic Melee Training; Defensive Soldiering | Perception; Mounted Combat; Animal Care; Battlefield Awareness | 16 | No | Yes | Good enough. Some direct grants remain but are concept-specific. |
| `cavalry_officer` | Cavalry Officer | 4-6 | 3-4 | Mounted command | Mounted Warrior Training; Veteran Soldiering; Veteran Leadership; Defensive Soldiering; Civic Learning; Courtly Formation | None | 19 | Yes | Yes | Good. Distinct from Military Officer. |
| `outrider_scout` | Outrider/Scout | 2-6 | 2-4 | Scout / outrider | Veteran Soldiering; Basic Missile Training; Mounted Service; Fieldcraft Stealth | None | 15 | No | Yes | Acceptable. Broad availability is the main remaining issue. |
| `veteran_sergeant` | Veteran Sergeant | 3-5 | 3 | Small-unit leader | Basic Melee Training; Basic Missile Training; Defensive Soldiering; Veteran Soldiering; Veteran Leadership | None | 20 | Yes | Yes | Good. Bridges soldier and formal officer. |
| `military_officer` | Military Officer | 4-6 | 4 | Land officer | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Veteran Leadership; Civic Learning | Captaincy; Tactics; Perception; Oratory; Administration; Law; Combat Experience | 21 | Yes | Yes | Good. Direct grants are still heavy but coherent. |
| `quartermaster` | Quartermaster | 4-6 | 3-4 | Logistics / military support | Civic Learning; Commercial Administration; Literate Foundation; Route Security; Defensive Soldiering | None | 17 | No | Yes, support | Good. Not a front-line officer clone. |
| `staff_officer` | Staff Officer | 5-6 | 4 | Staff / planning officer | Veteran Leadership; Civic Learning; Literate Foundation; Veteran Soldiering; Courtly Formation; Commercial Administration; Political Acumen | None | 20 | Yes | Yes | Good. Distinct high-society staff path. |
| `imperial_officer` | Imperial / Bureaucratic Officer | 6 | 4 | High-state officer | Basic Melee Training; Defensive Soldiering; Veteran Soldiering; Veteran Leadership; Civic Learning; Literate Foundation; Courtly Formation; Political Acumen | None | 27 | Yes | Yes | Good. Rich L6 formal path. |
| `sailor` | Sailor | 2-6 | 2-4 | Maritime crew | Maritime Crew Training; Maritime Navigation | Boat Handling; Ropework; Language; Trading; Insight; Sailing; Swim; Bargaining | 10 | No | Maritime | Acceptable as civilian/maritime base, not military coverage. |
| `deck_sailor` | Deck Sailor | 2-6 | 2-4 | Maritime crew | Maritime Crew Training; Maritime Navigation | Boat Handling; Ropework; Language; Trading; Insight; Swim | 9 | No | Maritime | Acceptable if civilian; weak for naval-security coverage. |
| `ships_officer` | Ships Officer | 3-6 | 3-4 | Maritime command | Maritime Crew Training; Maritime Navigation; Ship Command | Boat Handling; Ropework; Language; Trading; Insight | 12 | Yes, maritime | Maritime | Needs design decision. Still low reach for command. |
| `fisher` | Fisher | 1-6 | 1-4 | Maritime civilian | Maritime Crew Training; Maritime Navigation | Boat Handling; Ropework; Language; Trading; Insight; Sailing; Navigation; Swim | 9 | No | Maritime | Fine as civilian; do not count as military/security coverage. |
| `spy` | Spy | 3-6 | 3-4 | Intelligence / security-adjacent | Street Theft; Covert Entry; Fieldcraft Stealth; Political Acumen | Detect Lies; Etiquette; Conceal Object; Camouflage; Disguise; Intrigue; Stealth; Search | 14 | No | No martial foundation | Acceptable. Security-adjacent, not soldier/guard coverage. |
| `assassin` | Assassin | 3-6 | 3-4 | Clandestine violence | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Conceal Object; Camouflage; Stealth; Disguise; Search; Poison Lore; 1-h edged | 13 | No | Limited | Acceptable as adjacent role; not military coverage. |

## C. Society-Level Coverage

| Society level | Ordinary soldier/guard options | Militia/informal options | Mounted options | Naval options | Policing/security options | Officer/command/staff options | Gaps | Inappropriate roles | Scaling verdict |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Village Guard | Tribal Warrior; Clan Warriors; Militia Fighter | None | Fisher | Village Guard | None | Warband Leader optional; no formal officer needed. | None serious. | Good. Low-society roles are now constrained and plausible. |
| 2 | Village Guard; Levy Infantry; Light Infantry; Caravan Guard; Bodyguard; Gladiator; Outrider/Scout | Tribal Warrior; Clan Warriors; Militia Fighter | Mounted Retainer | Sailor; Deck Sailor; Fisher | Bounty Hunter; Caravan Guard; Bodyguard | None | Route Warden optional; low command optional. | Gladiator/Bodyguard may be culture/class specific but acceptable. | Good enough for chargen. |
| 3 | Garrison Soldier; Heavy Infantry; Watchman; Jailer; Light Infantry; Caravan Guard; Bodyguard; Champion; Outrider/Scout | Militia Fighter; Levy Infantry | Mounted Retainer; Cavalry | Sailor; Deck Sailor; Ships Officer; Fisher | Watchman; Jailer; Bounty Hunter; Spy/Assassin adjacent | Veteran Sergeant; Ships Officer | Town Guard distinct from Watchman optional. | Spy/Assassin are not coverage, just adjacent. | Good. Professionalization begins plausibly. |
| 4 | Garrison Soldier; Heavy Infantry; Watchman; Jailer; Cavalry; Bodyguard; Champion | Levy Infantry; Caravan Guard; Outrider/Scout | Mounted Retainer; Cavalry; Cavalry Officer | Sailor; Deck Sailor; Ships Officer | City Watch Officer; Bounty Hunter; Spy/Assassin adjacent | Veteran Sergeant; Military Officer; City Watch Officer; Cavalry Officer; Quartermaster | Warship Officer optional. | Some L2 roles still available upward, but less damaging now. | Good. Class/career ladder is coherent. |
| 5 | Garrison Soldier; Heavy Infantry; Watchman; Jailer; Cavalry; Bodyguard; Champion | Caravan Guard; Outrider/Scout; Gladiator | Cavalry; Cavalry Officer | Sailor; Deck Sailor; Ships Officer | City Watch Officer; Elite Guard Officer; Bounty Hunter; Spy/Assassin adjacent | Veteran Sergeant; Military Officer; Cavalry Officer; Quartermaster; Staff Officer; Elite Guard Officer | Warship Officer; Prison Official optional. | Caravan Guard/Gladiator remain broad. | Good. Formal/high-society choices now scale. |
| 6 | Light Infantry; Caravan Guard; Bodyguard; Champion | Outrider/Scout; Gladiator | Cavalry Officer | Sailor; Deck Sailor; Ships Officer | City Watch Officer; Elite Guard Officer; Bounty Hunter; Spy/Assassin adjacent | Military Officer; Cavalry Officer; Quartermaster; Staff Officer; Imperial Officer; Elite Guard Officer | Warship Officer remains the biggest naval gap. | Light Infantry and Caravan Guard may be too generic as default L6 rows. | Mostly good. L6 no longer feels structurally empty. |

Society-level conclusions:

- Low-society informal roles are now properly constrained.
- Mid-level ordinary military/security coverage is strong.
- High-society officer/staff/court-security coverage is now coherent.
- The largest remaining society issue is broad upward availability for `light_infantry`, `caravan_guard`, `outrider_scout`, `gladiator`, and `bodyguard`.
- That remaining broadness is acceptable for testing unless the next pass wants sharper culture/background or maximum-level rules.

## D. Class-Band Coverage

| Class band | Soldier/guard options | Command/officer options | Elite/court options | Gaps | Inappropriate roles |
|---:|---|---|---|---|---|
| 1 | Tribal Warrior; Clan Warriors; Village Guard; Militia Fighter; Levy Infantry; Fisher | None | None | Warband Leader if informal command is desired. | None serious. |
| 2 | Village Guard; Militia Fighter; Levy Infantry; Garrison Soldier; Infantry; Watchman/Jailer; Caravan Guard; Mounted Retainer; Cavalry; Bodyguard; Gladiator; Outrider/Scout | None | Bodyguard/Gladiator as lower-class roles may be setting-specific. | More explicit Town Guard/Road Patrol optional. | Bodyguard and Gladiator may need social/culture gating later. |
| 3 | Militia Fighter; Levy Infantry; Garrison Soldier; Infantry; Watchman/Jailer; Caravan Guard; Mounted Retainer; Cavalry; Bodyguard; Champion; Outrider/Scout | Veteran Sergeant; City Watch Officer; Cavalry Officer; Quartermaster; Ships Officer | Champion; Mounted Retainer; Bodyguard | Good current bridge coverage. | Spy/Assassin are adjacent, not coverage. |
| 4 | Light Infantry; Caravan Guard; Bodyguard; Champion; Sailor/Deck Sailor | Military Officer; City Watch Officer; Cavalry Officer; Quartermaster; Staff Officer; Imperial Officer; Elite Guard Officer; Ships Officer | Champion; Bodyguard; Elite Guard Officer; Staff/Imperial Officer | Warship Officer if naval military matters. | Generic Light Infantry/Caravan Guard may be too low-status as default C4 rows. |

Class-band conclusions:

- Formal officers are now correctly gated toward C3-C4 or C4.
- Ordinary guard/soldier paths still remain visible to C4 in some broad legacy rows, but there are now enough elite alternatives to tighten them later.
- C3 is now strong: Veteran Sergeant, City Watch Officer, Cavalry Officer, Quartermaster, Ships Officer.
- C4 is now strong for land command and court security, but naval military command remains thin.

## E. Remaining Direct-Grant Issues

| Profession | Remaining direct grants | Assessment |
|---|---|---|
| `military_officer` | Captaincy; Tactics; Perception; Oratory; Administration; Law; Combat Experience | Acceptable but heavy. If a future Officer Command / Staff Administration group exists, some could move there. |
| `heavy_infantry` | Parry; Formation Fighting; Polearms; 1-h conc./axe; Battlefield Awareness | Acceptable. These are formation-infantry specialization grants, though Parry overlaps combat packages. |
| `levy_infantry` | Perception; First aid; Polearms; 1-h conc./axe; Battlefield Awareness | Acceptable. Could become a Levy / Spear Drill group later. |
| `cavalry` | Perception; Mounted Combat; Animal Care; Battlefield Awareness | Acceptable. Riding is now supplied by mounted groups; direct grants are concept-specific. |
| `bounty_hunter` | Detect Lies; Etiquette; Conceal Object; Camouflage; Search; Perception | Acceptable for hybrid lawful/underworld pursuit, though Etiquette is inherited from Thief/Infiltrator and may be odd. |
| `ships_officer` | Boat Handling; Ropework; Language; Trading; Insight | Acceptable maritime flavor, but reach remains low. |
| `spy` | Detect Lies; Etiquette; Conceal Object; Camouflage; Disguise; Intrigue; Stealth; Search | Acceptable intelligence package, not military coverage. |
| `assassin` | Detect Lies; Etiquette; Conceal Object; Camouflage; Stealth; Disguise; Search; Poison Lore; 1-h edged | Acceptable adjacent package, though direct 1-h edged is an isolated combat grant. |
| `tribal_warrior` / `clan_warriors` | Several low-society weapon/flavor grants | Acceptable due narrow S1-S2/C1-C2 scope; candidate for later warband group. |
| `sailor` / `deck_sailor` / `fisher` | Several maritime direct grants | Acceptable as civilian/maritime support; not military-command issue. |

Direct-grant conclusion:

- The broad Soldier-family direct-grant problem is fixed.
- Remaining direct grants are mostly subtype-specific and acceptable for current testing.
- The most useful later refactor would be grouping repeated direct patterns for Infantry, Naval, and Clandestine roles.

## F. Remaining Group-Model Issues

Potential group-model issues:

- `Basic Missile Training` is slot/choice-like, so fixed reach understates missile professions.
- `Veteran Soldiering` may be semantically too formal for `tribal_warrior`, `clan_warriors`, and `levy_infantry`.
- `Advanced Melee Training` currently appears to overlap with `Basic Melee Training`; this may be intentional pending weapon/specialization cleanup.
- `Ship Command` is useful but may be too small alone to make `ships_officer` feel like a full command role.
- `Street Theft` / `Covert Entry` / `Fieldcraft Stealth` make Bounty Hunter work, but a purpose-built `Fugitive Pursuit` or `Warrant Work` group could be cleaner.
- No current inspected non-combat/context group contains isolated Parry/Dodge/Brawling/weapon skills from recent cleanup targets.
- No ordinary profession group currently leaks `Veteran Leadership`, `Captaincy`, or `Tactics` into ordinary soldiers/guards.

Group-model conclusion:

- The group model is good enough for current chargen testing.
- Further improvements are taxonomy/content quality work, not emergency fixes.

## G. Constraint / Availability Issues

| Profession | Current availability | Proposed availability | Reason | Replacement exists? |
|---|---|---|---|---|
| `light_infantry` | S2-S6, C2-C4 | Consider S2-S5, C2-C3 | Generic light infantry looks odd as a default C4/L6 role. | Mostly yes: Garrison Soldier, Veteran Sergeant, Staff/Officer roles. |
| `caravan_guard` | S2-S6, C2-C4 | Consider S2-S5, C2-C3; leave C4 to Route Warden later | Caravan guard is useful but not usually elite/court. | Partial: no Route Warden yet. |
| `outrider_scout` | S2-S6, C2-C4 | Consider S2-S5, C2-C3; high versions need Scout Officer/Ranger later | Broad availability may be fine but high-society default is generic. | Partial. |
| `gladiator` | S2-S6, C2-C4 | Consider culture/urban/background gating later | Arena profession should depend on society/culture more than universal access. | No replacement needed. |
| `bodyguard` | S2-S6, C2-C4 | Keep for now; maybe C2-C4 is fine | Bodyguard plausibly spans class bands. Elite Guard Officer now covers C4 command. | Yes. |
| `bounty_hunter` | S2-S6, C2-C4 | Keep for now; maybe later S2-S5/C2-C3 | Pursuit/security profession can span widely, but C4 may be odd as default. | Partial. |
| `ships_officer` | S3-S6, C3-C4 | Keep until Warship Officer exists | Maritime command path remains needed. | No. |
| `spy` / `assassin` | S3-S6, C3-C4 | Keep as security-adjacent, not military coverage | They are not guard/soldier paths but fill intrigue/security roles. | Not applicable. |

Availability conclusion:

- No urgent availability fix is required before current chargen testing.
- A later pass can safely tighten generic high-society rows now that high-level alternatives exist.

## H. New Professions Still Worth Adding

Conservative remaining candidates:

| Proposed profession | Why it is still useful | Suggested availability | Suggested package direction | Priority |
|---|---|---|---|---|
| Warship Officer | Naval military command remains the clearest gap; Ships Officer is coherent but low-reach and may be merchant/crew command. | S4-S6, C3-C4 | Maritime Crew Training; Maritime Navigation; Ship Command; Veteran Leadership or naval command equivalent if created. | High if naval military matters soon; otherwise medium. |
| Route Warden / Road Patrol | Would let Caravan Guard become less broad and less high-class. | S3-S5, C2-C3 | Route Security; Watch / Civic Guard; Basic Missile Training or Mounted Service. | Medium. |
| Duelist | Could distinguish Champion from arena/gladiator and court guard roles. | S4-S6, C3-C4 | Advanced Melee Training; Courtly Formation; possibly Political Acumen. | Medium-low. |
| Prison Official / Gaoler | Would distinguish Jailer from Watchman and support higher-society detention institutions. | S4-S6, C3-C4 | Watch / Civic Guard; Civic Learning; possibly Defensive Soldiering. | Low. |
| Warband Leader | Could support low-society informal command without formal officer education. | S1-S2, C2-C3 | Basic Melee Training; Veteran Soldiering or a future low-command group; Oratory if appropriate. | Low-medium. |

No large batch of new professions is immediately required.

## I. Top 10 Remaining Cleanup Decisions

1. Small cleanup now or defer: decide whether `light_infantry` should be constrained below S6/C4 now that formal high-society roles exist.
2. Small cleanup now or defer: decide whether `caravan_guard` should remain S6/C4 or wait for Route Warden / Road Patrol.
3. Needs design decision: whether `ships_officer` is merchant/civil maritime command or should be split from `warship_officer`.
4. Needs design decision: whether `gladiator` should be culture/urban/background-gated rather than universally available upward.
5. Defer: consider a low-society `warband_leader` if informal command becomes important.
6. Defer: consider a `duelist` profession if Champion should not carry all court/representative fighter concepts.
7. Defer: decide whether `Veteran Soldiering` should be renamed or supplemented for low-society warriors and levies.
8. Later content-model refactor: move repeated infantry direct grants into a cleaner infantry/formation package if desired.
9. Later content-model refactor: represent specialization, parent skills, group memberships, and relationship grants in one canonical skill graph.
10. Defer: create a clearer naval/maritime military taxonomy only if naval campaigns become a near-term focus.

## J. Implementation Recommendation

The current military/security catalog is good enough for current chargen testing.

The recent cleanup passes have resolved the major structural problems:

- Ordinary soldiers and officers are now distinct.
- Low-society informal warriors are constrained.
- Civic guards, route guards, arena fighters, mounted roles, bounty hunters, bodyguards, champions, and elite guard officers now have coherent packages.
- High-society command/staff options now exist.
- Broad Soldier-family direct grants no longer leak Riding, Formation Fighting, First Aid, and Weapon Maintenance into every Soldier-family profession.
- Command education no longer leaks into ordinary soldier/guard professions.

Recommended next step:

- Move on to another catalog area unless the immediate product need is naval military. If one more military/security pass is desired, make it a small naval pass: clarify `ships_officer` versus a possible `warship_officer`.
