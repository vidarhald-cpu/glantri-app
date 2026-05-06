# Current Criminal / Covert Profession Structure Audit

Date: 2026-05-01

Scope: read-only audit of the current repo-local/generated Glantri criminal, covert, underworld, espionage, coercive-security, and social-manipulation profession structure.

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
- Profession packages are effective family plus subtype grants from generated `professionSkills`.
- Skill reach reuses the existing app/admin-style proxy: unique skills reachable from granted groups plus direct grants not already covered by those groups.
- Criminal/covert relevance is based on profession family, id/name/description, and reach into `street_theft`, `covert_entry`, `fieldcraft_stealth`, `political_acumen`, `social_reading`, `watch_civic_guard`, `performance_basics`, `formal_performance`, `security`, `stealth_group`, or criminal/social-manipulation direct skills.
- `watchman`, `jailer`, and guard roles are included only where relevant as adjacent policing/security comparisons, not as criminal careers.

## B. Current Criminal / Covert Profession Table

| Profession id | Name | Society | Class | Role category | Groups | Direct grants | Reach | Mobility | Verdict |
|---|---|---:|---:|---|---|---|---:|---|---|
| `beggar` | Beggar | 1-6 | 1-4 | Street survival / underclass information | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Insight; Bargaining; Social Perception | 13 | Medium | Useful low-status option, but C4/S6 availability is too broad unless this becomes an informer/social-survivor variant. |
| `bandit` | Bandit | 1-6 | 1-4 | Rural/outlaw violence | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Perception; Bargaining; 1-h conc./axe; Brawling | 14 | Low | Strong low-class/outlaw option, but class 4 and S6 default access feel inappropriate without a high-status outlaw/raider variant. |
| `street_thug` | Street Thug | 1-6 | 1-4 | Urban muscle / gang enforcer | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Brawling; Insight; 1-h conc./axe; Bargaining | 14 | Low-medium | Playable and clear, but ordinary street muscle should probably not remain C4/S6 default. |
| `thief` | Thief | 2-6 | 2-4 | Generic covert criminal | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette | 10 | Medium | Acceptable baseline, but low reach and broad package make it a fallback rather than a distinct profession. |
| `burglar` | Burglar | 2-6 | 2-4 | Technical intruder | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette | 10 | Medium | Concept is good, but package is identical to generic Thief. Needs a small distinction pass. |
| `pickpocket` | Pickpocket | 2-6 | 2-4 | Street theft specialist | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Insight | 11 | Medium | Acceptable, though still inherits broad covert-entry/fieldcraft training that may exceed the narrow concept. |
| `smuggler` | Smuggler | 2-6 | 2-4 | Illicit trader / route crime | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight; Conceal Object; Stealth | 15 | High | Good concept and reach, but direct grants suggest a missing Smuggling/Illicit Trade group. C4 may need an elite/fixer variant. |
| `bounty_hunter` | Bounty Hunter | 2-6 | 2-4 | Pursuit / coercive security | Street Theft; Covert Entry; Fieldcraft Stealth; Watch / Civic Guard | Detect Lies; Etiquette | 14 | Medium | Good enough after cleanup. Hybrid lawful/security and underworld package is coherent and has no command leakage. |
| `conman` | Conman | 2-6 | 2-4 | Fraud / social manipulation | Street Theft; Covert Entry; Fieldcraft Stealth; Political Acumen | Detect Lies; Etiquette; Disguise; Bargaining; Seduction | 16 | High | Strong mobility role, but package leans too physical-infiltration heavy for fraud. Needs a Social Fraud group later. |
| `fixer` | Fixer | 2-6 | 2-4 | Broker / informal access | Mercantile Practice; Commercial Administration; Political Acumen | Language; Etiquette; Teamstering; Riding; Sailing; Banking | 15 | High | Good upward-mobility path. Current merchant inheritance makes it too trade/logistics flavored. |
| `spy` | Spy | 3-6 | 3-4 | Intelligence / political covert | Street Theft; Covert Entry; Fieldcraft Stealth; Political Acumen | Detect Lies; Etiquette; Disguise | 14 | High | Good concept and class placement, but reach is low for elite/state intelligence and there is no separate Court Spy/Intelligence Agent. |
| `assassin` | Assassin | 3-6 | 3-4 | Clandestine violence | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Disguise; Poison Lore; 1-h edged | 13 | Medium-high | Acceptable but thin. Direct 1-h edged is an isolated combat grant; later package should separate political assassin from hired killer. |
| `torturer` | Torturer | 2-6 | 2-4 | Coercive interrogation / punitive specialist | Street Theft; Covert Entry; Fieldcraft Stealth | Detect Lies; Etiquette; Insight; Medicine; Intrigue | 13 | Low-medium | Needs design decision. Current thief/infiltrator package is probably wrong; prison/security/court coercion may fit better. |
| `prostitute` | Prostitute | 2-6 | 2-4 | Commercial/social service | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight | 13 | Medium | Not primarily criminal, but relevant to underworld/social mobility. Merchant inheritance is still odd and broad. |
| `prostitute_courtesan` | Companion | 2-5 | 2-3 | Social companion / performance service | Social Reading; Performance Basics; Formal Performance | Seduction; Bargaining | 12 | Medium | Recent cleanup is good. Distinct from elite Courtesan and no longer C4. |
| `courtesan` | Courtesan | 4-6 | 4 | Elite social influence | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Seduction | 12 | High | Good elite counterpart. Relevant as social intrigue, not ordinary criminal coverage. |
| `slave_master` | Slave master | 3-6 | 3-4 | Coercive authority / estate control | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Captaincy; Bargaining | 13 | Medium | Needs design decision. Sensitive/setting-specific; not a covert profession despite coercive skills. |
| `jailer` | Jailer | 3-5 | 2-3 | Detention security / policing-adjacent | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | None | 17 | Medium | Good policing/security contrast, not underworld. Could later pair with Torturer/Informer content. |
| `watchman` | Watchman | 3-5 | 2-3 | Civic watch / policing-adjacent | Veteran Soldiering; Basic Melee Training; Defensive Soldiering; Watch / Civic Guard | None | 17 | Medium | Good civic-security contrast. Should not be counted as covert/criminal career coverage. |

## C. Society-Level Coverage

| Society level | Street / petty crime | Stealth / infiltration | Rural / outlaw | Organized crime / broker | State / court intelligence | Gaps / inappropriate roles | Scaling verdict |
|---:|---|---|---|---|---|---|---|
| 1 | Beggar; Street Thug | None specialist | Bandit | None | None | Good low-status options, but no Poacher/Informer/Local Fence. | Playable but blunt. |
| 2 | Beggar; Street Thug; Pickpocket; Thief | Burglar; Thief | Bandit | Smuggler; Fixer; Conman; Bounty Hunter | None | Strong class-2 mobility, but many roles start with identical Thief/Infiltrator package. | Good for play. Needs differentiation. |
| 3 | Same S2 plus Spy/Assassin/Torturer | Burglar; Spy; Assassin | Bandit; Bounty Hunter | Smuggler; Fixer; Conman | Spy; Assassin | Solid mid-society covert complexity. Torturer package is suspicious. | Good, with cleanup targets. |
| 4 | Same S3 plus Courtesan | Burglar; Spy; Assassin | Bandit still present | Smuggler; Fixer; Conman | Spy; Assassin; Courtesan; Slave Master | Bandit/Beggar/Street Thug as C4/S4 defaults are questionable. | Good coverage but over-broad availability. |
| 5 | Same S4 minus no new elite intelligence | Same | Bandit still present | Same | Spy; Assassin; Courtesan; Slave Master | No Master Thief, Court Spy, Intelligence Agent, Political Assassin, or Handler. | Underbuilt at elite covert layer. |
| 6 | Same S5 except Companion absent | Same | Bandit still present | Same | Spy; Assassin; Courtesan; Slave Master | Ordinary street/outlaw roles still default; elite covert ladder still thin. | Structurally incomplete for high society espionage. |

Society-level conclusions:

- Low society has genuinely playable criminal options, especially `beggar`, `bandit`, and `street_thug`.
- S2-S3 coverage is strong and likely good for chargen testing.
- S4-S6 availability is too permissive for ordinary street/outlaw roles.
- Higher societies have covert options, but they do not scale much beyond `spy` and `assassin`.
- The catalog lacks explicit elite/intelligence variants for complex high-state societies.

## D. Class-Band Coverage

| Class band | Criminal/covert options | Low-status playable options | Upward-mobility options | Elite/court covert options | Gaps / inappropriate roles |
|---:|---|---|---|---|---|
| 1 | Beggar; Bandit; Street Thug | Strong. These are playable, distinct, and not bland. | Weak. No Informer/Poacher/Cutpurse path yet. | None expected. | Could use Poacher, Informer, or Local Tough. |
| 2 | Beggar; Bandit; Street Thug; Thief; Burglar; Pickpocket; Smuggler; Bounty Hunter; Conman; Fixer; Torturer; Prostitute; Companion; Watch/Jailer adjacent | Very strong. | Strong through Smuggler/Fixer/Conman/Bounty Hunter. | None expected. | Some roles are too broad or too similar mechanically. |
| 3 | All C2 options plus Spy, Assassin, Slave Master; Watch/Jailer adjacent | Strong. | Very strong. Spy/Assassin/Fixer are plausible upward mobility. | Emerging. | Good bridge class, but Spy/Assassin reach may be low. |
| 4 | Beggar; Bandit; Street Thug; Thief; Burglar; Pickpocket; Smuggler; Bounty Hunter; Conman; Fixer; Spy; Assassin; Torturer; Prostitute; Courtesan; Slave Master | Too many ordinary street roles remain. | Strong but noisy. | Spy; Assassin; Courtesan; Slave Master. | Class 4 is overcrowded with ordinary criminals. Needs restrictions or elite variants. |

Class-band conclusions:

- Class 1-2 play is not boring; the catalog has real low-status choices.
- Class 3 is healthy as a mobility band.
- Class 4 violates the design principle that it should remain elite/high-status: too many ordinary street and outlaw professions remain available.
- Before restricting C4 ordinary criminals, add or clarify elite replacements such as Master Thief, Court Spy, Intelligence Agent, Political Assassin, or Underworld Fixer.

## E. Skill-Group Quality Review

| Group | Membership | Coherence | Verdict |
|---|---|---|---|
| Street Theft | Pickpocket; Conceal Object; Stealth | Coherent urban theft/carry package. | Good, though very small. |
| Covert Entry | Stealth; Hide; Lockpicking; Search; Trap Handling | Strong burglary/intrusion package. | Good. Currently overused by many non-burglary subtypes. |
| Fieldcraft Stealth | Stealth; Hide; Camouflage | Coherent rural stealth package. | Good but thin and overlaps heavily with Covert Entry. |
| Political Acumen | Intrigue; Insight; Social Perception | Excellent intrigue/social politics bridge. | Good. Appropriate for Spy/Fixer/Conman, not for all criminals. |
| Social Reading | Insight; Detect Lies; Social Perception | Coherent interpersonal read package. | Good. Underused for fraud/informers. |
| Watch / Civic Guard | Perception; Search; Law; Insight; Social Perception | Coherent civic-security package. | Good. Appropriate for Bounty Hunter as hybrid, not criminal baseline. |
| Performance Basics | Singing; Dancing; Storytelling; Music | Coherent common performance package. | Good for Companion/performers, not covert by itself. |
| Formal Performance | Acting; Recitation; Oratory | Strong social-disguise/court performance support. | Good for Companion, Spy variants, Conman variants. |
| Security | Perception; Search; Conceal Object; Trap Handling; Lockpicking; Pickpocket | Generated broad security/covert group. | Useful but overlaps with Covert Entry and Street Theft. Not currently the main profession package. |
| Stealth | Stealth; Hide; Camouflage; Disguise | Generated stealth/disguise group. | Useful future split candidate for Spy/Assassin. |
| Operations | Bureaucratic Writing; Bargaining; Gambling; Trading; Banking; Administration; Intrigue; Bookkeeping; Appraisal | Broad organization/trade/intrigue group. | Could support Fixer/Fence later, but currently too broad for a single criminal package. |

Group-model conclusions:

- The core covert groups are coherent, but the `thief_infiltrator` family grants all three broad covert groups by default.
- This makes Burglar, Thief, Pickpocket, Bandit, Assassin, and Torturer mechanically closer than their concepts imply.
- No current group clearly represents fraud/confidence work, smuggling, fencing stolen goods, underworld networking, forgery, or intelligence handling.
- Combat skills still appear as direct grants on Bandit, Street Thug, and Assassin rather than through coherent combat packages.

## F. Direct-Grant Review

| Profession | Direct grants | Review |
|---|---|---|
| `beggar` | Detect Lies; Etiquette; Insight; Bargaining; Social Perception | Mostly coherent social-survival flavor, but Etiquette is inherited and may be too polished. |
| `bandit` | Detect Lies; Etiquette; Perception; Bargaining; 1-h conc./axe; Brawling | Combat direct grants are conceptually plausible but should eventually come from a coherent outlaw/combat package. |
| `street_thug` | Detect Lies; Etiquette; Brawling; Insight; 1-h conc./axe; Bargaining | Similar concern: isolated Brawling/weapon grants. Could become Gang Enforcer package later. |
| `thief` / `burglar` | Detect Lies; Etiquette | Direct grants are minimal; problem is lack of subtype distinction. |
| `pickpocket` | Detect Lies; Etiquette; Insight | Acceptable, but a Street Reading/Mark Selection group could be better later. |
| `smuggler` | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight; Conceal Object; Stealth | Too many direct grants. Strong signal for Smuggling/Illicit Trade group. |
| `bounty_hunter` | Detect Lies; Etiquette | Acceptable after recent cleanup. No Captaincy/Veteran Leadership/Tactics. |
| `conman` | Detect Lies; Etiquette; Disguise; Bargaining; Seduction | Coherent, but would be cleaner as Social Fraud / Confidence Work group. |
| `fixer` | Language; Etiquette; Teamstering; Riding; Sailing; Banking | Merchant inheritance creates route/trade flavor that may be too broad. |
| `spy` | Detect Lies; Etiquette; Disguise | Acceptable, but elite spy probably needs Formal Performance or Social Reading rather than only direct Disguise. |
| `assassin` | Detect Lies; Etiquette; Disguise; Poison Lore; 1-h edged | Poison/Disguise are coherent. Direct weapon skill is an isolated combat grant. |
| `torturer` | Detect Lies; Etiquette; Insight; Medicine; Intrigue | Conceptually coherent but attached to the wrong family package. |
| `prostitute` | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight | Merchant inheritance is broad and odd for this role. Needs design decision separate from criminal audit. |
| `prostitute_courtesan` / Companion | Seduction; Bargaining | Clean and minimal after recent cleanup. |
| `courtesan` | Language; Law; Rhetorical Composition; Detect Lies; Administration; Seduction | Heavy but coherent for elite social intrigue. |

Direct-grant conclusions:

- The broad direct-grant problems are mostly in inherited family defaults, especially `merchant_trader` and `thief_infiltrator`.
- Smuggler and Fixer are the clearest candidates for group-based cleanup.
- Bandit, Street Thug, and Assassin need a future decision on whether criminal violence should use existing combat packages or new narrow underworld-combat packages.

## G. Class Mobility Review

Professions that give class 1-2 characters interesting playable paths:

- `beggar`: social survival, information-gathering, underclass access.
- `bandit`: rural/outlaw direct-action route.
- `street_thug`: urban muscle/intimidation route.
- `thief`, `burglar`, `pickpocket`: classic covert skill tracks from C2 upward.
- `smuggler`, `conman`, `fixer`, `bounty_hunter`: strong C2-C3 upward-mobility tracks.
- `prostitute_courtesan` / Companion: social/performance mobility without becoming elite C4 by default.

Professions that allow class 2-3 movement upward:

- `fixer` is currently the strongest bridge from commerce/crime to political/social access.
- `conman` bridges underworld, performance, and political acumen.
- `smuggler` bridges trade, travel, and covert work.
- `spy` and `assassin` begin at C3, which is appropriate for patronage/state/political work.

Professions suitable for C3 as stepping-stones to elite/court/state roles:

- `spy`
- `assassin`
- `fixer`
- `conman`
- `bounty_hunter`
- `companion`

Professions that should probably be restricted from C4 unless explicitly elite/court/state:

- `beggar`
- `bandit`
- `street_thug`
- `thief`
- `burglar`
- `pickpocket`
- `smuggler`, unless a high-status smuggling/fence/factor variant is intended
- `bounty_hunter`, unless a state-sanctioned hunter/officer variant exists
- `torturer`, unless a prison/court official variant exists
- `prostitute`, unless an elite social/professional variant is intentionally modeled separately

## H. Constraint / Availability Candidates

| Profession | Current availability | Proposed availability | Reason | Replacement needed first? |
|---|---:|---:|---|---|
| `beggar` | S1-S6, C1-C4 | S1-S6, C1-C2, maybe C3 | Keep low-status option broad by society, but C4 should not default to beggar. | No, unless Informer is added. |
| `bandit` | S1-S6, C1-C4 | S1-S4, C1-C3 | Ordinary bandit/outlaw should not be a default high-society elite role. | Maybe Highwayman/Outlaw Captain later. |
| `street_thug` | S1-S6, C1-C4 | S1-S5, C1-C3 | Ordinary muscle should not crowd C4. | Add Gang Enforcer/Underworld Lieutenant later. |
| `thief` | S2-S6, C2-C4 | S2-S5, C2-C3 | Generic thief should not occupy elite C4 if Master Thief is absent. | Yes, Master Thief/Fixer can cover high tier. |
| `burglar` | S2-S6, C2-C4 | S2-S5, C2-C3 | Technical intruder can be mid-class, but C4 needs Master Burglar/Agent. | Yes. |
| `pickpocket` | S2-S6, C2-C4 | S2-S5, C2-C3 | Street pickpocket is not elite by default. | No. |
| `smuggler` | S2-S6, C2-C4 | S2-S5, C2-C3 | C4 should probably be Fence, Trade Factor, or Smuggling Lord. | Yes, Fence/Smuggling Factor. |
| `bounty_hunter` | S2-S6, C2-C4 | S2-S5, C2-C3 | Ordinary bounty hunter is not elite; state hunter variant could be. | Maybe. |
| `spy` | S3-S6, C3-C4 | Keep | Appropriate bridge/elite covert role. | No. |
| `assassin` | S3-S6, C3-C4 | Keep for now | Useful high-stakes covert role, but split later. | Political Assassin later. |
| `torturer` | S2-S6, C2-C4 | Needs design decision | Role may be prison/court/state coercion, not thief/infiltrator. | Prison Official/Gaoler first. |
| `fixer` | S2-S6, C2-C4 | Keep or S2-S6/C2-C4 | Plausible upward mobility and elite access broker. | No. |
| `conman` | S2-S6, C2-C4 | Maybe S2-S6/C2-C3 unless Court Charlatan exists | High-class con artist is plausible but should be explicit. | Maybe. |

## I. New Professions Worth Considering

| Proposed profession | Society | Class | Role category | Concept | Suggested groups | Direct skills only if needed | Reach target | Priority |
|---|---:|---:|---|---|---|---|---:|---|
| Cutpurse | S1-S4 | C1-C2 | Petty theft | Low-status purse-cutter and market thief. | Street Theft; Social Reading or Performance Basics | Gambling or Bargaining if needed | 10-12 | Medium |
| Poacher | S1-S4 | C1-C2 | Rural illegal hunting | Low-status forest/game lawbreaker and survival criminal. | Fieldcraft Stealth; Basic Missile Training or Fieldcraft group | Animal Care, Search | 10-13 | High |
| Informer | S1-S6 | C1-C3 | Underclass intelligence | Street-level information broker, watch contact, or spy asset. | Social Reading; Street Theft; Watch / Civic Guard if lawful | Bargaining | 10-14 | High |
| Fence | S2-S6 | C2-C3 | Underworld commerce | Receiver and reseller of stolen goods. | Mercantile Practice; Political Acumen or Operations | Appraisal, Bargaining | 12-16 | High |
| Smuggling Factor | S3-S6 | C3-C4 | Organized illicit trade | Higher-status smuggling broker or corrupt trade agent. | Mercantile Practice; Commercial Administration; Covert Entry or Operations | Conceal Object, Law | 15-18 | Medium |
| Gang Enforcer | S2-S5 | C2-C3 | Urban muscle | More organized version of Street Thug. | Basic Melee Training; Street Theft; Social Reading | Intimidation if ever canonical | 12-16 | Medium |
| Master Thief | S4-S6 | C4 | Elite criminal | High-status or guild-level thief replacing generic Thief in C4. | Covert Entry; Street Theft; Political Acumen; Social Reading | Appraisal or Disguise | 16-20 | High |
| Court Spy | S4-S6 | C4 | Elite intelligence | Court/institutional intelligence operator. | Political Acumen; Social Reading; Formal Performance; Covert Entry | Disguise, Language | 16-20 | High |
| Intelligence Agent | S5-S6 | C3-C4 | State covert service | Bureaucratic/state spy with records, law, and political reach. | Civic Learning; Political Acumen; Covert Entry; Social Reading | Administration | 18-22 | Medium |
| Political Assassin | S4-S6 | C3-C4 | Elite covert violence | Patron-backed assassin distinct from street killer. | Covert Entry; Fieldcraft Stealth; Political Acumen; Poison/Assassin package if created | Poison Lore, Disguise | 16-20 | Medium |
| Forger | S3-S6 | C2-C4 | Document crime | Document, seal, and bureaucratic fraud specialist. | Literate Foundation; Civic Learning; Covert Entry or Operations | Bureaucratic Writing | 12-18 | Medium |
| Gambler / Card Sharp | S2-S6 | C2-C3 | Social gambling fraud | Gambling, reading marks, cheating, and social risk. | Social Reading; Performance Basics; Operations | Gambling | 12-15 | Medium |

## J. Top 10 Remaining Cleanup Decisions

1. Small cleanup now: restrict ordinary street/outlaw roles from C4 where safe, starting with `beggar`, `bandit`, `street_thug`, and `pickpocket`.
2. Small cleanup now: distinguish `burglar` from generic `thief`; they are currently mechanically identical.
3. Small cleanup now: add or reuse a Smuggling/Illicit Trade package for `smuggler` and possibly a Fence package later.
4. Needs design decision: decide whether `torturer` belongs to thief/infiltrator, jail/security, court coercion, or should be replaced by Prison Official/Gaoler.
5. Needs design decision: decide whether C4 generic criminals should remain as “elite criminal society” options or be replaced by Master Thief/Court Spy/etc.
6. Defer: split Assassin into hired killer, political assassin, and possibly state executioner/covert agent only if the catalog needs it.
7. Defer: add Poacher and Informer to improve low-status variety without crowding combat/guard categories.
8. Needs later content-model refactor: reduce broad family inheritance in `thief_infiltrator` so Pickpocket, Burglar, Assassin, and Torturer do not all receive the same three stealth/intrusion groups.
9. Needs later content-model refactor: create social-crime groups such as Confidence Work, Underworld Networking, Forgery, and Illicit Trade.
10. Defer: revisit `prostitute` separately in a service/social/economic audit; recent Companion/Courtesan cleanup is good enough for this pass.

## K. Implementation Recommendation

The criminal/covert catalog is good enough for current chargen testing at low and mid class bands. It has playable options for low social rolls, strong class-2/class-3 mobility routes, and reasonable baseline covert concepts.

It needs one small cleanup pass before moving on if the next focus is class/society realism:

- Restrict ordinary C4 street/outlaw professions where replacements already exist.
- Distinguish `burglar` from generic `thief`.
- Add or repurpose a small Smuggling/Illicit Trade group for `smuggler`.

It is not structurally complete for high-society espionage. S5-S6 currently rely mostly on `spy`, `assassin`, `courtesan`, and `slave_master`; later high-value additions would be `Master Thief`, `Court Spy`, `Intelligence Agent`, and `Political Assassin`.
