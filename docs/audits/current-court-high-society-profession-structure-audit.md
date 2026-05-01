# Current Court / High-Society Profession Structure Audit

Date: 2026-05-01

Scope: read-only audit of the current repo-local/generated Glantri court, high-society, social, political, administrative, bureaucratic, performance, and elite-service profession structure.

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

- Society availability is read from generated `societyLevels[*].professionIds`, joined to `societies[*].societyLevel`.
- Class availability is read from generated `societyLevels[*].societyLevel`, where class bands are 1-4.
- Profession packages are effective family plus subtype grants from generated `professionSkills`.
- Skill reach uses the existing app/admin proxy: unique skills reachable from granted groups plus direct grants not already covered by those groups.
- Court/high-society relevance is based on profession family, profession naming/description, and reach into `courtly_formation`, `political_acumen`, `civic_learning`, `literate_foundation`, `performance_basics`, `formal_performance`, `performance_group`, `social_reading`, `commercial_administration`, or key High Society/Social/Performance skills.

## B. Current Court / High-Society Profession Table

| Profession id | Name | Society | Class | Role category | Groups | Direct grants | Reach | Key court/social/performance skills reached | Verdict |
|---|---|---:|---:|---|---|---|---:|---|---|
| `household_courtier` | Household Courtier | 4-6 | 4 | Court service / courtier | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Insight; Intrigue; Seduction | 12 | Etiquette; Heraldry; Courtly Protocol; Intrigue; Insight; Social Perception; Law; Administration | Good baseline courtier, but direct grants are heavy. |
| `noble` | Noble | 4-6 | 4 | Noble / elite status | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Etiquette; Heraldry; Insight; Courtly Protocol; Captaincy | 12 | Etiquette; Heraldry; Courtly Protocol; Intrigue; Insight; Social Perception; Law; Administration; Captaincy | Acceptable but needs design decision: social estate, profession, or command-adjacent role? |
| `herald` | Herald | 4-6 | 4 | Heraldic / court officer | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Heraldry; Oratory; Etiquette; Courtly Protocol; History | 13 | Heraldry; Etiquette; Courtly Protocol; Oratory; Law; Administration | Good concept, but many direct grants duplicate group identity. |
| `politician` | Politician | 4-6 | 4 | Political operator | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Intrigue; Oratory; Insight | 12 | Intrigue; Oratory; Insight; Social Perception; Law; Administration | Acceptable. Reach is modest for elite politics. |
| `courtesan` | Courtesan | 4-6 | 4 | Elite social performer / influence | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Seduction; Insight; Etiquette; Intrigue | 12 | Etiquette; Intrigue; Insight; Social Perception; Law; Administration | Needs design decision: court role is clear, performance side is under-modeled. |
| `prostitute_courtesan` | Prostitute - Courtesan | 2-6 | 2-4 | Social/influence service | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Seduction; Insight; Bargaining; Etiquette | 13 | Etiquette; Intrigue; Insight; Social Perception; Law; Administration | Needs cleanup. Overlaps with `courtesan` and has broad low-class availability. |
| `personal_servant` | Personal Servant | 3-6 | 3-4 | Elite household service | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Etiquette; Insight; Courtly Protocol | 11 | Etiquette; Courtly Protocol; Insight; Social Perception; Law; Administration | Acceptable but thin; likely should be household/service rather than political acumen heavy. |
| `slave_master` | Slave master | 3-6 | 3-4 | Coercive household/estate authority | Courtly Formation; Political Acumen | Language; Law; Rhetorical Composition; Detect Lies; Administration; Social Perception; Captaincy; Insight; Bargaining | 13 | Law; Administration; Captaincy; Insight; Social Perception | Needs design decision. Sensitive/setting-specific and command-adjacent. |
| `bureaucrat` | Bureaucrat | 4-6 | 4 | Bureaucracy / administration | Literate Foundation; Civic Learning; Commercial Administration | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Bureaucratic Writing; Bookkeeping | 11 | Law; Bureaucratic Writing; Administration; Rhetorical Composition; Etiquette | Needs small cleanup: reach is low for high formal bureaucracy and direct grants are heavy. |
| `court_scribe_clerk` | Court Scribe / Clerk | 4-6 | 4 | Court bureaucracy / records | Literate Foundation; Civic Learning | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Courtly Protocol; Bureaucratic Writing | 11 | Law; Bureaucratic Writing; Administration; Courtly Protocol; Etiquette | Needs small cleanup. Should likely add Courtly Formation or Commercial Administration rather than direct court flavor. |
| `lawyer` | Lawyer | 4-6 | 4 | Law / formal argument | Literate Foundation; Civic Learning | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Oratory; Bureaucratic Writing; Insight | 12 | Law; Oratory; Bureaucratic Writing; Administration; Insight; Etiquette | Acceptable, but a Legal Practice group would be cleaner later. |
| `tax_collector` | Tax Collector | 4-6 | 4 | Revenue administration | Literate Foundation; Civic Learning; Commercial Administration | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Bookkeeping; Bureaucratic Writing; Insight; Bargaining | 13 | Law; Administration; Bookkeeping; Bureaucratic Writing; Insight | Good enough. Direct grants are heavy but coherent. |
| `scribe` | Scribe | 3-6 | 3-4 | Literate profession | Literate Foundation; Civic Learning | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Literacy; Bureaucratic Writing | 10 | Literacy; Law; Bureaucratic Writing; Administration; Etiquette | Acceptable low reach; generic scholarly baseline. |
| `temple_scribe` | Temple Scribe | 3-6 | 3-4 | Temple/literate administration | Literate Foundation; Civic Learning; Sacred Learning | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Ritual Interpretation; Divination | 12 | Theology; Law; Administration; Etiquette | Good enough. |
| `student` | Student | 3-6 | 3-4 | Education / literate learner | Literate Foundation; Civic Learning | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette; Literacy; Language | 10 | Literacy; Language; Law; Etiquette | Acceptable but generic. |
| `philosopher` | Philosopher | 3-6 | 3-4 | Scholar / intellectual | Literate Foundation; Civic Learning | History; Theology; Administration; Philosophy; Rhetorical Composition; Law; Etiquette | 10 | Philosophy; Law; Etiquette | Acceptable but low; should maybe gain Scholarly Inquiry instead of civic admin direct grants. |
| `priest` | Priest | 3-6 | 3-4 | Religious elite / public speaker | Healing Practice; Herb and Remedy Craft; Sacred Learning; Omen and Ritual Practice | Theology; Concentration; Medicine; Administration; Etiquette; Ritual Interpretation; History; Divination; Literacy; Oratory | 16 | Oratory; Theology; Administration; Etiquette | Good. Court relevance depends on society. |
| `actor` | Actor | 3-6 | 3-4 | Formal performer | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing; Acting; Recitation; Insight; Storytelling | 13 | Acting; Oratory; Singing; Dancing; Storytelling; Etiquette; Insight | Good enough. Direct grants duplicate performance groups. |
| `musician` | Musician | 2-6 | 2-4 | Performer | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing; Music; Storytelling | 12 | Music; Singing; Dancing; Storytelling; Etiquette | Acceptable. Needs elite/court performer split if court music matters. |
| `entertainer` | Entertainer | 1-6 | 1-4 | Broad performer | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing; Storytelling; Music; Acting; Bargaining | 13 | Singing; Dancing; Storytelling; Music; Acting; Etiquette | Acceptable common performer, but too broad as a universal court option. |
| `folk_performer` | Folk Performer | 1-6 | 1-4 | Folk performance | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing; Storytelling; Music | 12 | Singing; Dancing; Storytelling; Music; Etiquette | Acceptable. Etiquette/formal performance may be too polished for folk role. |
| `dancer_acrobat` | Dancer/Acrobat | 1-6 | 1-4 | Performer / physical performance | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing | 12 | Dancing; Singing; Etiquette | Acceptable but duplicates entertainer variants. |
| `entertainers_singer_musician` | Entertainers Singer/Musician | 1-6 | 1-4 | Performer variant | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing | 12 | Singing; Dancing; Etiquette | Needs cleanup. Duplicate/variant naming feels generated rather than canonical. |
| `entertainers_dancer_acrobat` | Entertainers Dancer/Acrobat | 1-6 | 1-4 | Performer variant | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing | 12 | Singing; Dancing; Etiquette | Needs cleanup. Duplicate with `dancer_acrobat`. |
| `entertainers_trickster_fool` | Entertainers Trickster/Fool | 1-6 | 1-4 | Performer/fool | Performance Basics; Formal Performance | Seduction; Disguise; Etiquette; Language; Rhetorical Composition; Singing; Dancing | 12 | Singing; Dancing; Etiquette | Needs cleanup. Concept is useful but package is not distinct. |
| `mourner` | Mourner | 2-6 | 2-4 | Ritual/performance service | Healing Practice; Herb and Remedy Craft; Performance Basics; Omen and Ritual Practice | Theology; Concentration; Medicine; Administration; Etiquette; Singing; Recitation; Ritual Interpretation; History | 19 | Singing; Recitation; Theology; Etiquette | Good mechanically; concept may belong in ritual/service audit more than court. |
| `champion` | Champion | 3-6 | 3-4 | Court/arena representative fighter | Advanced Melee Training; Arena Training; Courtly Formation | None | 17 | Etiquette; Heraldry; Courtly Protocol; Acting; Oratory | Good court-facing elite fighter. |
| `bodyguard` | Bodyguard | 2-6 | 2-4 | Personal protection / elite service | Advanced Melee Training; Watch / Civic Guard; Defensive Soldiering; Courtly Formation | None | 18 | Etiquette; Heraldry; Courtly Protocol; Law; Insight; Social Perception | Good court-facing security role. |
| `elite_guard_officer` | Elite Guard Officer | 5-6 | 4 | Elite/court security command | Watch / Civic Guard; Basic Melee Training; Defensive Soldiering; Courtly Formation; Veteran Soldiering; Veteran Leadership; Political Acumen | None | 23 | Etiquette; Heraldry; Courtly Protocol; Intrigue; Insight; Social Perception; Captaincy; Tactics | Good high-society court command. |
| `staff_officer` | Staff Officer | 5-6 | 4 | Bureaucratic military staff | Veteran Leadership; Civic Learning; Literate Foundation; Veteran Soldiering; Courtly Formation; Commercial Administration; Political Acumen | None | 20 | Law; Administration; Etiquette; Heraldry; Intrigue; Captaincy; Tactics | Good high-society staff role. |
| `imperial_officer` | Imperial / Bureaucratic Officer | 6 | 4 | High-state officer | Basic Melee Training; Defensive Soldiering; Veteran Soldiering; Veteran Leadership; Civic Learning; Literate Foundation; Courtly Formation; Political Acumen | None | 27 | Law; Administration; Etiquette; Heraldry; Intrigue; Captaincy; Tactics | Good elite bureaucratic military role. |
| `quartermaster` | Quartermaster | 4-6 | 3-4 | Administrative/logistics official | Civic Learning; Commercial Administration; Literate Foundation; Route Security; Defensive Soldiering | None | 17 | Law; Administration; Bureaucratic Writing | Good support bureaucracy role. |
| `spy` | Spy | 3-6 | 3-4 | Intelligence / court intrigue-adjacent | Street Theft; Covert Entry; Fieldcraft Stealth; Political Acumen | Detect Lies; Etiquette; Conceal Object; Camouflage; Disguise; Intrigue; Stealth; Search | 14 | Intrigue; Insight; Social Perception; Etiquette | Good intrigue-adjacent role, not a courtier substitute. |

## C. Society-Level Coverage

| Society level | Court/high-society roles | Political/bureaucratic roles | Literate/administrative roles | Performance/court entertainment | Elite household/service | Gaps / inappropriate roles | Scaling verdict |
|---:|---|---|---|---|---|---|---|
| 1 | None formal | None formal | None formal | Entertainer; Folk Performer; Dancer/Acrobat variants | None | Performance roles include formal-performance package even at S1. | Plausible for folk performance, but no court structure expected. |
| 2 | Prostitute - Courtesan appears; no true court roles | Merchant/fixer-style social roles, not court bureaucracy | Healers/merchants with admin flavor | Musician; Entertainer; Folk Performer; Dancer/Acrobat; Mourner | Bodyguard; Mounted Retainer | `prostitute_courtesan` and formal-performance-heavy performers may be too polished for broad low society. | Good enough, but low-society performance should be less courtly. |
| 3 | Personal Servant; Champion; Spy/Assassin adjacent | Scribe; Temple Scribe; Student; Philosopher; Priest | Scribe family appears | Actor; Musician; Entertainer; Folk Performer; Dancer/Acrobat; Mourner | Bodyguard; Mounted Retainer; Champion | No Courtier/Envoy yet; personal servant has Political Acumen by default. | Plausible mid-society transition. |
| 4 | Household Courtier; Noble; Herald; Politician; Courtesan; Lawyer; Bureaucrat; Tax Collector | Strong courtier, legal, political, scribe, bureaucrat coverage | Strong literate/admin coverage | Actor/Musician/Entertainer plus broad variants | Bodyguard; Champion; Quartermaster; City Watch Officer | Courtier/diplomat family roles have modest reach and many direct grants. | Strong but somewhat generic. |
| 5 | Same as S4 plus Staff Officer and Elite Guard Officer | Staff Officer; Quartermaster; Military/City/Cavalry Officer | Strong | Same performers | Elite Guard Officer; Bodyguard; Champion | No explicit Diplomat/Envoy/Chamberlain/Steward; performer variants still not court-specific. | Good, but court bureaucracy could be richer. |
| 6 | Same as S5 plus Imperial Officer | Imperial Officer; Staff Officer; Quartermaster; Bureaucrat; Lawyer; Tax Collector | Strong | Same performers | Elite Guard Officer; Bodyguard; Champion | No distinct Courtier/Envoy/Chamberlain; no Court Performer. | Good enough, but elite civil court career ladder is thinner than military/staff ladder. |

Society-level conclusions:

- The catalog now has a strong court/high-society core from S4 onward.
- S5-S6 gained high-state military/bureaucratic options through Staff Officer, Imperial Officer, and Elite Guard Officer.
- Civil court options still mostly come from the imported `courtier_diplomat` family and are somewhat generic.
- Performance professions exist at all levels, but there is no clear `court performer` / `master performer` distinction.

## D. Class-Band Coverage

| Class band | Social/court professions | Political/administrative professions | Performance professions | Elite/court professions | Gaps / concerns |
|---:|---|---|---|---|---|
| 1 | None true court; folk/common social roles only | None formal | Entertainer/Folk Performer/Dancer variants | None | Good. Formal court roles should not be here. |
| 2 | Prostitute - Courtesan, merchants/innkeepers with Etiquette inheritance | Merchant/trader admin flavor | Most broad performer roles | Bodyguard; Gladiator; Mounted Retainer | Some court/performance polish may appear too low via broad performer packages. |
| 3 | Personal Servant; Champion; Spy; Assassin; Priest/Scribe adjacent | Scribe; Student; Philosopher; Temple Scribe; Priest | Actor; Musician; Entertainer variants | Bodyguard; Champion; Mounted Retainer; Veteran Sergeant/Cavalry Officer adjacent | Good bridge band, but no explicit courtier/envoy below C4. |
| 4 | Household Courtier; Noble; Herald; Politician; Courtesan | Bureaucrat; Lawyer; Tax Collector; Staff/Imperial/Quartermaster; Court Scribe | All performer roles, no court-specific upgrade | Elite Guard Officer; Staff Officer; Imperial Officer; Bodyguard; Champion | C4 is rich, but civil court professions need differentiation. |

Class-band conclusions:

- Court/high-society roles are correctly concentrated in C4.
- C3 has useful literate and service paths but few explicit court-service advancement paths.
- C2 broad performance and courtesan access may need later culture/class refinement.
- C4 has enough options for testing, but many are generic family/subtype direct-grant variants.

## E. Skill-Group Quality Review

| Group | Membership | Assessment |
|---|---|---|
| Courtly Formation | Etiquette; Heraldry; Courtly Protocol | Coherent and clean. Narrow enough to remain useful as elite-court baseline. |
| Political Acumen | Intrigue; Insight; Social Perception | Coherent as faction/social-reading package. `Intrigue` being High Society while the group is Social is acceptable but worth watching. |
| Civic Learning | Law; Bureaucratic Writing; Rhetorical Composition | Coherent civic/legal writing package. Good for officers, lawyers, scribes, officials. |
| Literate Foundation | Literacy; Language; History | Coherent baseline education, but broad `Language` placeholder deserves continued care so it does not become a standalone raw skill. |
| Commercial Administration | Bookkeeping; Administration; Bureaucratic Writing | Coherent trade/admin group. Useful for bureaucrats, tax collectors, quartermasters. |
| Performance Basics | Singing; Dancing; Storytelling; Music | Coherent broad performer base. |
| Formal Performance | Acting; Recitation; Oratory | Coherent formal/stage/public-speaking package. It may be too polished for every low-level folk performer. |
| Performance | Singing; Dancing; Storytelling; Music; Acting; Recitation; Oratory | Useful matrix/category group, but overlaps heavily with Performance Basics and Formal Performance. |
| Social Reading | Insight; Detect Lies; Social Perception | Coherent and useful. Underused as a direct profession group compared with direct skill inheritance. |
| Arena Training | Combat Experience; Perception; Acting; Oratory; Weapon Maintenance | Coherent for arena/show combat. It is court/performance-adjacent but should not become generic court performance. |
| Watch / Civic Guard | Perception; Search; Law; Insight; Social Perception | Coherent civic/security package. Relevant to elite guard/bodyguard, but not a court/social group in itself. |
| Veteran Leadership | Tactics; Captaincy; Perception; Combat Experience | Coherent military command group. Should stay out of ordinary court/social professions except elite security/officer roles. |

Group-quality conclusions:

- The new High Society/Social/Performance groups are directionally sound.
- The court/social groups are currently small and composable, which is good.
- The main issue is not group content; it is profession packages relying on family direct grants in addition to these groups.
- Performance has an overlap problem: `performance_group` duplicates the union of basics/formal and may be better as a category/matrix concept than a profession grant.

## F. Direct-Grant Review

Professions still relying heavily on direct high-society/social/performance identity:

| Profession/family | Direct-grant pattern | Assessment |
|---|---|---|
| `courtier_diplomat` family and subtypes | Language, Law, Rhetorical Composition, Detect Lies, Administration, Social Perception plus subtype Etiquette/Intrigue/etc. | Heavy but coherent. Suggests future Diplomatic Service / Court Office / Household Service groups. |
| `scholar_scribe` family and subtypes | History, Theology, Administration, Philosophy, Rhetorical Composition, Law, Etiquette plus subtype specifics | Heavy and generic. Suggests Legal Practice, Scribe Office, Scholarly Inquiry groups. |
| `performer` family and subtypes | Seduction, Disguise, Etiquette, Language, Rhetorical Composition plus many performance subtype direct grants | Heavy and duplicative with Performance Basics/Formal Performance. Suggests separate common performer vs court performer packages. |
| `merchant_trader` family | Etiquette, Insight, Administration, Commercial skills spread widely | Acceptable for trade/social audit, but this makes many merchants look court-adjacent. |
| `healer` family | Administration and Etiquette appear broadly | Acceptable as imported package, but not all healers should count as court/high-society roles. |
| `noble` | Captaincy plus court/political direct grants | Conceptually plausible but needs design decision: Noble as status role vs command profession. |
| `ships_officer`, `military_officer`, `staff_officer`, `imperial_officer`, `elite_guard_officer` | High-society/civic/command overlap | Mostly good after military cleanup. They are court-facing only insofar as elite command roles. |

Direct-grant conclusion:

- The court/high-society catalog is usable, but direct grants are the biggest remaining structural smell.
- A future pass should convert repeated direct patterns into small groups instead of expanding individual profession overrides one by one.

## G. Category Consistency Review

Current category mappings relevant to this audit:

- High Society: `courtly_protocol`, `etiquette`, `heraldry`, `intrigue`.
- Social: `insight`, `social_perception`, `detect_lies`, `seduction`, `gambling`, and related social-reading skills.
- Performance: `singing`, `music`, `dancing`, `acting`, `storytelling`, `recitation`, `oratory`.
- Civic/legal/admin skills currently sit outside High Society/Social: `law`, `bureaucratic_writing`, `rhetorical_composition`, `administration`, `bookkeeping`.

Findings:

- Courtly Protocol, Etiquette, Heraldry, and Intrigue are in expected places.
- `Etiquette by Culture` exists as a specialization of `etiquette`, which is correct for the current interim model.
- `Intrigue` is High Society but belongs to `political_acumen`, whose group category is Social. This is acceptable because the group bridges elite politics and social reading.
- `Oratory` is Performance, which works for formal speech and public persuasion.
- Performance skills are coherent, but performer professions all get both Performance Basics and Formal Performance, making low/common and elite/formal performers less distinct.
- No obvious category mistake was found in the listed court/social/performance skills.

## H. Constraint / Availability Candidates

| Profession | Current availability | Proposed availability | Reason | Replacement needed first? |
|---|---|---|---|---|
| `prostitute_courtesan` | S2-S6, C2-C4 | Split/rename or constrain; keep `courtesan` as C4 | Duplicates court Courtesan and mixes low-class sex work with high court social role. | Yes, needs design decision. |
| `entertainers_dancer_acrobat` | S1-S6, C1-C4 | Merge into `dancer_acrobat` or make it a variant label | Duplicate package/name. | No. |
| `entertainers_singer_musician` | S1-S6, C1-C4 | Merge into `musician` or rename as Singer/Musician | Duplicate package/name. | No. |
| `entertainers_trickster_fool` | S1-S6, C1-C4 | Give distinct fool/trickster package or merge | Useful concept but not mechanically distinct. | Maybe. |
| `folk_performer` | S1-S6, C1-C4 | Consider S1-S4 or keep as broad cultural role | Folk role in C4/S6 may be okay but not court-specific. | No. |
| `actor` | S3-S6, C3-C4 | Keep | Formal performer availability is plausible. | No. |
| `musician` | S2-S6, C2-C4 | Keep; add Court Performer later if needed | Musician can span classes. | No. |
| `personal_servant` | S3-S6, C3-C4 | Consider adding/renaming household-service group later | Current Political Acumen package may be too political. | No immediate. |
| `household_courtier` | S4-S6, C4 | Keep | Good C4 baseline, but could become Courtier. | No. |
| `noble` | S4-S6, C4 | Keep, but clarify role | Is Noble a profession, status, or command-adjacent path? | Needs design decision. |
| `bureaucrat` / `court_scribe_clerk` | S4-S6, C4 | Keep; improve packages later | Correct availability, modest reach. | No. |
| `spy` / `assassin` | S3-S6, C3-C4 | Keep as intrigue/security-adjacent, not court roles | Useful but should not substitute for diplomat/courtier. | No. |

## I. New Professions Worth Considering

Conservative candidates only:

| Proposed profession | Society | Class | Role category | Concept | Suggested groups | Direct skills only if needed | Reach target | Priority |
|---|---|---:|---|---|---|---|---:|---|
| Courtier | S4-S6 | C4 | Court/social | General elite court operator distinct from Noble and Household Courtier. | Courtly Formation; Political Acumen; Social Reading | Language or Oratory | 14-18 | High if court play is near-term. |
| Diplomat / Envoy | S4-S6 | C3-C4 | Diplomacy | Negotiator between courts, cities, and powers. | Courtly Formation; Political Acumen; Civic Learning; Formal Performance | Language; Etiquette by Culture if specialization support is ready | 16-20 | High. |
| Chamberlain / Steward | S4-S6 | C3-C4 | Household administration | Manages noble household, staff, ceremonies, stores. | Courtly Formation; Commercial Administration; Civic Learning | Administration or Bookkeeping only if not covered | 15-20 | Medium-high. |
| Magistrate | S4-S6 | C4 | Legal/civic authority | Court/legal official with judgment and administration. | Civic Learning; Literate Foundation; Political Acumen | Oratory; Law if needed | 16-20 | Medium. |
| Court Performer | S4-S6 | C3-C4 | Elite performance | Performer trained for elite audiences and court etiquette. | Performance Basics; Formal Performance; Courtly Formation | Etiquette by Culture or Language if needed | 15-18 | Medium. |
| Master of Ceremonies | S5-S6 | C4 | Ceremony / protocol | Runs ceremonies, precedence, announcements, audiences. | Courtly Formation; Formal Performance; Political Acumen | Heraldry or Oratory if needed | 16-20 | Medium. |
| Tutor / Scholar-official | S4-S6 | C3-C4 | Elite education/bureaucracy | Educates elite households or serves scholarly administration. | Literate Foundation; Civic Learning; Scholarly Inquiry if created | Philosophy or History | 14-18 | Medium. |
| High Priest / Court Priest | S4-S6 | C4 | Religious elite | Religious office embedded in court/temple power. | Sacred Learning; Civic Learning; Courtly Formation; Formal Performance | Oratory or Theology | 16-22 | Medium if religious politics matter. |

## J. Top 10 Remaining Cleanup Decisions

1. Small cleanup now: decide whether to merge or differentiate duplicate entertainer variants.
2. Small cleanup now: decide whether `prostitute_courtesan` should split from C4 `courtesan` or be renamed/constrained.
3. Needs design decision: decide whether `noble` is a profession, a social status/background, or a command-adjacent elite path.
4. Small cleanup or defer: add/derive a cleaner Courtier/Diplomat package instead of relying on heavy `courtier_diplomat` direct grants.
5. Small cleanup or defer: add a Court Performer variant so elite performance is distinct from folk/common entertainers.
6. Defer: create Legal Practice / Court Office / Household Service groups to reduce direct grants on lawyer, clerk, bureaucrat, servant, herald.
7. Defer: decide whether personal servant should use Political Acumen or a quieter household-service package.
8. Later content-model refactor: normalize performer variants and source labels without UI-only hiding.
9. Later content-model refactor: keep `Etiquette by Culture` and other specialization/choice rows visible in the canonical skill graph.
10. Defer: audit merchant/trader professions separately, because many have Etiquette/Insight/Admin and can look court-adjacent without being court roles.

## K. Implementation Recommendation

The current court/high-society catalog is good enough for current chargen testing, but it would benefit from one small cleanup pass before being considered polished.

Recommended next implementation pass:

- Normalize performance/courtesan duplication first: merge or differentiate duplicate entertainer variants and clarify `courtesan` versus `prostitute_courtesan`.

If we move on instead, the catalog is still usable:

- Core high-society skills and categories are coherent.
- Courtly Formation, Political Acumen, Civic Learning, Literate Foundation, Performance Basics, and Formal Performance are readable and useful.
- S4-S6 have enough elite/court/bureaucratic choices for testing.
- The remaining problems are mostly duplication and over-broad inherited direct grants, not missing infrastructure.
