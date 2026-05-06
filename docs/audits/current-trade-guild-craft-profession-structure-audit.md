# Current Trade / Guild / Craft Profession Structure Audit

Date: 2026-05-01

Scope: read-only audit of the current repo-local/generated Glantri trade, guild, craft, merchant, transport, logistics, bookkeeping, and commercial-adjacent profession structure.

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
- Skill reach reuses the existing app/admin-style proxy: unique skills reachable from granted groups plus direct grants not already covered by those groups.
- Trade/guild/craft relevance is based on profession family, id/name/description, and reach into merchant, craft, transport, maritime, animal-service, scholar/scribe, bookkeeping, administration, logistics, or commercial skill groups.
- Military/security professions are included only where trade/logistics/admin overlap is material, such as `quartermaster`, `staff_officer`, `imperial_officer`, and `caravan_guard`.

## B. Current Trade / Guild / Craft Profession Table

| Profession id | Name | Society | Class | Role category | Groups | Direct grants | Reach | Mobility | Verdict |
|---|---|---:|---:|---|---|---|---:|---|---|
| `farmer` | Farmer | 1-6 | 1-4 | Rural production / household economy | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining; Baking; Brewing | 9 | Low | Playable low-status local option, but low reach and C4 availability are broad. |
| `herdsman_subtype` | Herdsman | 1-6 | 1-4 | Rural animal work | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining | 7 | Low | Coherent but thin; probably acceptable as low/common work, less so as C4 default. |
| `herder` | Herder | 1-6 | 1-4 | Rural animal work | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining | 7 | Low | Duplicate-looking with Herdsman; needs design decision or merge/alias later. |
| `animal_trainer` | Animal Trainer | 2-6 | 2-4 | Skilled animal trade | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining; Falconry | 8 | Medium | Concept is good, but reach is low for a skilled specialist. |
| `hunter` | Hunter | 1-6 | 1-4 | Rural provisioning / field trade | Animal Husbandry; Mounted Service; Transport and Caravan Work; Fieldcraft Stealth | Bargaining; Perception; Bow; Throwing; Search | 14 | Medium | Strong and playable, though direct combat/field grants may deserve a future package cleanup. |
| `woodcutter` | Woodcutter | 1-6 | 1-4 | Rural resource labor | Technical Measurement | Mechanics; Administration; Smithing; Carpentry; Run; Climb; Self-Control; Leatherworking | 11 | Low | Reach is healthy, but package is oddly direct-grant-heavy and too technical/admin flavored. |
| `prospector` | Prospector | 1-6 | 1-4 | Resource search / extraction | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining; Search; Perception; Stoneworking; Run | 11 | Medium | Good concept, but direct grants suggest a missing Prospecting/Surveying package. |
| `miner` | Miner | 2-6 | 2-4 | Extraction labor / craft | Technical Measurement | Mechanics; Administration; Smithing; Stoneworking; Self-Control; Run; Climb | 10 | Low-medium | Reach is barely acceptable; direct grants are doing most concept work. |
| `crafter` | Crafter | 1-6 | 1-4 | General artisan | Technical Measurement | Mechanics; Administration; Smithing; Carpentry; Leatherworking; Weaving; Pottery | 10 | Medium | Useful baseline, but direct craft skills suggest `craft_group` should be granted directly. |
| `master_craftsmen` | Master Craftsmen | 3-6 | 3-4 | Master artisan / guild craft | Technical Measurement | Mechanics; Administration; Smithing | 6 | Medium-high | Underbuilt for a master/guild role; needs craft and commercial/guild authority coverage. |
| `builder_master_mason` | Builder / Master Mason | 3-6 | 3-4 | Construction master | Technical Measurement | Mechanics; Administration; Smithing; Stoneworking; Carpentry | 8 | Medium-high | Concept is clear but package is too narrow/direct-heavy for master status. |
| `docker` | Docker | 2-6 | 2-4 | Port labor / freight handling | Technical Measurement; Maritime Crew Training | Mechanics; Administration; Smithing; Teamstering; Animal care; Run | 12 | Low-medium | Playable, but engineering-family inheritance makes it too technical/admin flavored. |
| `homemaker` | Homemaker | 2-6 | 2-4 | Household economy | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight | 13 | Low-medium | Reach is high, but merchant-family inheritance is conceptually odd. |
| `local_trader` | Local Trader | 2-6 | 2-4 | Local commerce | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight; Animal care | 14 | Medium | Good mobility role, but looks too similar to Merchant/Peddler/Inn Keeper. |
| `peddler` | Peddler | 1-6 | 1-4 | Itinerant petty trade | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight; Animal care | 14 | High | Very playable low-class mobility path, but C4 availability and banking/sailing inheritance are too broad. |
| `merchant` | Merchant | 2-6 | 2-4 | Commercial trader | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight | 13 | High | Solid baseline, but there is no elite/great merchant or merchant factor distinction. |
| `fixer` | Fixer | 2-6 | 2-4 | Broker / informal commerce | Mercantile Practice; Commercial Administration; Political Acumen | Language; Etiquette; Teamstering; Riding; Sailing; Banking | 15 | High | Good upward-mobility role, but still over-inherits ordinary merchant logistics. |
| `inn_keeper` | Inn Keeper | 2-6 | 2-4 | Hospitality / local business | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight | 13 | Medium | Useful profession, but package is generic merchant rather than hospitality/service. |
| `smuggler` | Smuggler | 2-6 | 2-4 | Illicit trade / contraband route work | Smuggling / Illicit Trade; Covert Entry | Language | 13 | High | Good after recent cleanup. Distinct from ordinary merchant and not overbuilt with direct grants. |
| `prostitute` | Prostitute | 2-6 | 2-4 | Commercial/social service | Mercantile Practice; Commercial Administration | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight | 13 | Medium | Recently distinguished from Courtesan/Companion, but still has generic merchant inheritance. |
| `sailor` | Sailor | 2-6 | 2-4 | Maritime labor / trade-adjacent crew | Maritime Crew Training; Maritime Navigation | Language; Trading; Insight; Swim; Bargaining | 10 | Medium | Coherent but low reach; navigation may be too broad for ordinary sailor. |
| `deck_sailor` | Deck Sailor | 2-6 | 2-4 | Working ship crew | Maritime Crew Training; Maritime Navigation | Language; Trading; Insight; Swim | 9 | Low-medium | Slightly under target and very close to Sailor/Fisher. |
| `fisher` | Fisher | 1-6 | 1-4 | Fishing / coastal provisioning | Maritime Crew Training; Maritime Navigation | Language; Trading; Insight; Swim | 9 | Low | Playable low-society maritime option, but navigation/language/trading inheritance may be too broad. |
| `ships_officer` | Ships Officer | 3-6 | 3-4 | Maritime command / trade-adjacent authority | Maritime Crew Training; Maritime Navigation; Ship Command | Language; Trading | 12 | High | Better after Ship Command, but still low for a command/commercial maritime role. |
| `messenger` | Messenger | 1-6 | 1-4 | Transport / communication service | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining | 7 | Medium | Good concept, but thin and overly animal-trade flavored. |
| `chariot_driver` | Chariot Driver | 2-6 | 2-4 | Transport / elite vehicle service | Animal Husbandry; Mounted Service; Transport and Caravan Work | Bargaining; Captaincy; Throwing | 9 | Medium | Captaincy is suspicious for a driver; needs small cleanup/design decision. |
| `caravan_guard` | Caravan Guard | 2-6 | 2-4 | Route security / trade protection | Veteran Soldiering; Basic Melee Training; Route Security | Throwing | 18 | Medium | Strong and coherent after Route Security. Military-adjacent rather than trade career. |
| `scribe` | Scribe | 3-6 | 3-4 | Literate clerical trade | Literate Foundation; Civic Learning | Theology; Administration; Philosophy; Etiquette | 10 | High | Acceptable bridge into bureaucracy, though direct grants are scholar-heavy. |
| `temple_scribe` | Temple Scribe | 3-6 | 3-4 | Religious/clerical recordkeeping | Literate Foundation; Civic Learning; Sacred Learning | Administration; Philosophy; Etiquette; Divination | 12 | Medium-high | Coherent, but only partly commercial/guild relevant. |
| `court_scribe_clerk` | Court Scribe / Clerk | 4-6 | 4 | Elite clerical administration | Literate Foundation; Civic Learning | Theology; Administration; Philosophy; Etiquette; Courtly Protocol | 11 | High | Good elite clerk concept, but reach is low for C4/high society. |
| `bureaucrat` | Bureaucrat | 4-6 | 4 | Formal administration | Literate Foundation; Civic Learning; Commercial Administration | Theology; Philosophy; Etiquette | 11 | High | Good high-society administrative path, still slightly underbuilt. |
| `tax_collector` | Tax Collector | 4-6 | 4 | Fiscal administration | Literate Foundation; Civic Learning; Commercial Administration | Theology; Philosophy; Etiquette; Insight; Bargaining | 13 | High | Good concept; could later use a dedicated Fiscal Administration group. |
| `lawyer` | Lawyer | 4-6 | 4 | Legal profession / elite service | Literate Foundation; Civic Learning | Theology; Administration; Philosophy; Etiquette; Oratory; Insight | 12 | High | Good class placement, but not a trade/guild profession. |
| `quartermaster` | Quartermaster | 4-6 | 3-4 | Logistics / military-commercial administration | Civic Learning; Commercial Administration; Literate Foundation; Route Security; Defensive Soldiering | None | 17 | High | Strong current logistics role. Good model for later commercial/logistics professions. |
| `staff_officer` | Staff Officer | 5-6 | 4 | Military staff / bureaucratic planning | Veteran Leadership; Civic Learning; Literate Foundation; Veteran Soldiering; Courtly Formation; Commercial Administration; Political Acumen | None | 20 | High | Military first, but demonstrates high-society admin package quality. |
| `imperial_officer` | Imperial / Bureaucratic Officer | 6 | 4 | High-state military bureaucracy | Basic Melee Training; Defensive Soldiering; Veteran Soldiering; Veteran Leadership; Civic Learning; Literate Foundation; Courtly Formation; Political Acumen | None | 27 | High | Military first; not a commercial replacement, but shows richer S6 formal education. |

## C. Society-Level Coverage

| Society level | Local craft/service | Artisan/guild | Merchant/commercial | Transport/caravan/maritime trade | Banking/finance/admin | Elite economic/court supplier | Gaps / inappropriate roles | Scaling verdict |
|---:|---|---|---|---|---|---|---|---|
| 1 | Farmer; Herdsman; Herder; Hunter; Woodcutter; Prospector; Crafter | Crafter | Peddler | Fisher; Messenger | None | None | Good low-status play, but few explicit apprentice/local-service paths. | Playable, broad, low complexity. |
| 2 | Adds Animal Trainer; Miner; Docker; Homemaker | Crafter; Miner; Docker | Local Trader; Peddler; Merchant; Fixer; Inn Keeper; Smuggler; Prostitute | Sailor; Deck Sailor; Fisher; Messenger; Chariot Driver; Caravan Guard | Merchant-family Banking appears early through direct grants | None | Strong coverage, but many commercial roles are mechanically near-identical. | Strong for chargen, needs differentiation. |
| 3 | Adds Master Craftsmen; Builder / Master Mason; Ships Officer; Scribe; Temple Scribe | Master Craftsmen; Builder / Master Mason | Same merchant set | Ships Officer; Caravan Guard | Scribe/Temple Scribe bridge to literate admin | None | Master craft roles are underbuilt relative to their status. | Good breadth, weak guild hierarchy. |
| 4 | Adds Court Scribe / Clerk; Bureaucrat; Tax Collector; Lawyer; Quartermaster | Same craft set | Same merchant set | Same maritime/route set | Stronger admin/fiscal/legal roles | Court Scribe; Bureaucrat; Tax Collector; Quartermaster | Ordinary farmer/herder/peddler/fisher remain C4/S4 defaults. | Rich but too permissive upward. |
| 5 | Adds Staff Officer | Same craft set | Same merchant set | Same maritime/route set | Strong admin/military logistics | Staff Officer | No Great Merchant, Guild Master, Banker/Moneylender, Court Supplier, or Merchant Factor. | Formal state grows, commercial elite does not. |
| 6 | Adds Imperial Officer | Same craft set | Same merchant set | Same maritime/route set | Strong state bureaucracy | Imperial Officer | Ordinary rural/labor/itinerant roles still default; elite commercial ladder is missing. | Admin scales; trade/guild does not. |

Society-level conclusions:

- Low society has playable non-combat work: farmer/herder/crafter/peddler/fisher/messenger give class 1 characters real options.
- S2-S3 trade coverage is strong, but mostly from broad family packages rather than carefully separated careers.
- S4-S6 administrative education scales better than commercial/guild education.
- High-society commercial roles are missing: there is no great merchant, guild master, banker/moneylender, merchant factor, court supplier, or master artisan with a truly elite package.
- Several ordinary low-status roles remain available upward forever because imported/generated availability is still broad.

## D. Class-Band Coverage

| Class band | Local labor/craft | Guild/trade | Merchant/upward mobility | Elite/high-commercial | Gaps / inappropriate roles |
|---:|---|---|---|---|---|
| 1 | Farmer; Herdsman; Herder; Hunter; Woodcutter; Prospector; Crafter; Fisher; Messenger | Crafter; Peddler | Peddler is the main commercial mobility path | None expected | Good playability, but few apprentice/service distinctions. |
| 2 | Adds Animal Trainer; Miner; Docker; Homemaker; Sailor; Deck Sailor | Local Trader; Merchant; Inn Keeper; Smuggler; Caravan Guard | Merchant; Fixer; Smuggler; Local Trader | None expected | Good mobility, but merchant roles are too similar. |
| 3 | Adds Master Craftsmen; Builder / Master Mason; Scribe; Temple Scribe; Ships Officer; Quartermaster | Master craft and clerical bridges appear | Fixer; Merchant; Ships Officer; Quartermaster | Early formal admin/logistics | Healthy bridge class, but guild-master/factor roles are missing. |
| 4 | Almost all ordinary labor/trade roles remain | Master craft roles remain | Merchant/Fixer/Smuggler remain | Court Scribe; Bureaucrat; Tax Collector; Lawyer; Staff/Imperial Officer | Class 4 is overcrowded with ordinary farmers, herders, peddlers, fishers, dockers, and basic merchants. |

Class-band conclusions:

- Class 1-2 non-combat play is in a good place: trade/craft/service options are available and varied enough for testing.
- Class 3 is the strongest mobility band and has plausible guild, merchant, maritime, clerical, and logistics routes.
- Class 4 needs cleanup. Ordinary labor and petty trade should not crowd elite slots unless intentionally modeled as estate-owning/high-status variants.
- The catalog lacks distinct class-4 economic power professions.

## E. Skill-Group Quality Review

| Group | Membership | Coherence | Verdict |
|---|---|---|---|
| Mercantile Practice | Bargaining; Trading; Appraisal | Strong basic commerce package. | Good. Should stay broad and low/mid accessible. |
| Commercial Administration | Bureaucratic Writing; Administration; Bookkeeping | Coherent office/accounting package. | Good. Appropriate for merchant/admin/logistics roles. |
| Transport and Caravan Work | Trading; Animal care; Teamstering | Coherent overland freight base. | Good but small. Could support peddler/teamster/caravan master better with a companion package. |
| Route Security | Perception; Animal care; Riding; Teamstering; Search; First aid | Coherent security/travel awareness package. | Good for Caravan Guard and Quartermaster, not ordinary merchant baseline. |
| Mounted Service | Animal care; Animal Training; Riding | Coherent animal/mounted service. | Good, but currently inherited by many rural roles. |
| Craft | Pottery; Weaving; Leatherworking; Carpentry; Tailoring; Baking; Brewing; Stoneworking; Smithing; Weapon Maintenance | Coherent broad craft package. | Good group, but underused by actual craft professions in the generated package output. |
| Technical Measurement | Measurement; Mathematics; Surveying | Coherent technical/surveying group. | Good for builders/surveyors, too narrow as the only group for craft/master craft roles. |
| Physical Science | Measurement; Mathematics; Astronomy; Alchemy; Natural Philosophy; Surveying; Mechanics | Broad science/technical education. | Good but not currently central to trade/craft packages. |
| Maritime Crew Training | Sailing; Ropework; Boat Handling | Strong working seamanship. | Good. |
| Maritime Navigation | Measurement; Sailing; Navigation | Coherent advanced navigation. | Good, but probably too broad for every Fisher/Deck Sailor. |
| Ship Command | Administration; Insight; Oratory; Perception; Sailing; Navigation; Captaincy | Coherent command package. | Good for Ships Officer only; not ordinary trade. |
| Smuggling / Illicit Trade | Bargaining; Trading; Appraisal; Insight; Teamstering; Sailing; Conceal Object; Stealth | Coherent illicit trade package. | Good recent model for replacing scattered direct grants. |
| Operations | Bureaucratic Writing; Bargaining; Gambling; Trading; Banking; Administration; Intrigue; Bookkeeping; Appraisal | Broad organization/trade/intrigue package. | Useful future support for factor/fixer/guild roles, but too broad for baseline merchants. |
| Animal Handling | Animal care; Animal Training; Herding; Riding; Teamstering; Falconry | Coherent animal work. | Good, but overlaps with Animal Husbandry/Mounted Service/Transport. |

Group-model conclusions:

- The core commerce groups are clean and useful.
- Craft roles are not using `craft_group` as directly as expected; many craft identities are built from direct grants instead.
- Merchant-family roles overuse direct grants for language, etiquette, transport, sailing, banking, and insight.
- Maritime groups are clean but may be over-applied to all sailor/fisher variants.
- `smuggling_illicit_trade` is a good example of the kind of focused group that ordinary merchant/factor/guild cleanup could follow.

## F. Direct-Grant Review

| Profession(s) | Direct grants | Review |
|---|---|---|
| `local_trader`, `peddler`, `merchant`, `inn_keeper`, `homemaker`, `prostitute` | Language; Etiquette; Teamstering; Riding; Sailing; Banking; Insight, plus small subtype flavor | This is the largest recurring issue. The direct grants make many merchant-family professions broad, similar, and sometimes conceptually odd. |
| `fixer` | Language; Etiquette; Teamstering; Riding; Sailing; Banking | Reach is healthy, but the logistics/travel inheritance dilutes the broker/political-access concept. |
| `woodcutter`, `miner`, `crafter`, `master_craftsmen`, `builder_master_mason`, `docker` | Mechanics; Administration; Smithing plus subtype skills | Engineer-builder family direct grants are doing too much. `craft_group`, Technical Measurement, and maybe future Construction/Workshop groups should carry more of this. |
| `farmer` | Bargaining; Baking; Brewing | Acceptable flavor but reach remains low. Could use a Rural Household or Farming package later. |
| `hunter`, `prospector` | Perception/Search/field/craft direct grants | Mostly acceptable, though future Hunting/Prospecting packages would be cleaner. |
| `sailor`, `deck_sailor`, `fisher` | Language; Trading; Insight; Swim; Bargaining | Conceptually plausible, but makes all maritime labor somewhat trader-like. Fisher/Deck Sailor may need narrower packages. |
| `chariot_driver` | Bargaining; Captaincy; Throwing | Captaincy is the most suspicious direct grant in this audit. It should probably be removed or replaced unless source rules explicitly mean command/driver leadership. |
| `scribe`, `temple_scribe`, `court_scribe_clerk`, `bureaucrat`, `tax_collector`, `lawyer` | Theology/Philosophy/Etiquette/Admin/Oratory/Insight variants | Mostly acceptable scholar-family flavor, but elite admin roles could use more dedicated groups instead of direct identity grants. |

Direct-grant conclusions:

- Merchant and engineer-builder families should be the first cleanup targets.
- Several roles have acceptable reach only because direct grants compensate for missing/underused groups.
- `chariot_driver` Captaincy is the clearest single suspicious skill.
- Craft and merchant roles are good candidates for small, focused group cleanup passes rather than broad refactors.

## G. Class Mobility Review

Current strengths:

- Class 1-2 characters have real non-combat paths: `farmer`, `herdsman_subtype`, `herder`, `hunter`, `woodcutter`, `prospector`, `crafter`, `peddler`, `fisher`, and `messenger`.
- Class 2-3 characters have strong mobility through `merchant`, `local_trader`, `fixer`, `smuggler`, `sailor`, `ships_officer`, `scribe`, `master_craftsmen`, `builder_master_mason`, and `quartermaster`.
- Class 3 functions well as a bridge into literate administration, maritime command, logistics, and master craft roles.
- Recent `smuggler` and `quartermaster` packages are better examples of group-based mobility than the older merchant-family defaults.

Current weaknesses:

- Class 4 contains too many ordinary labor and petty-trade roles by default.
- There is no dedicated high-status commercial ladder: no great merchant, guild master, banker/moneylender, merchant factor, court supplier, or master artisan with class-4 weight.
- Craft/guild mobility is implied but mechanically thin: `master_craftsmen` has reach 6 and is weaker than many lower-status roles.
- Commercial upward mobility is over-concentrated in generic `merchant` and `fixer`.

## H. Constraint / Availability Candidates

| Profession | Current availability | Proposed availability | Reason | Replacement needed first? |
|---|---|---|---|---|
| `farmer` | S1-S6, C1-C4 | Keep S1-S6, restrict to C1-C2 or C1-C3 | Ordinary farmer should not be default elite C4 unless a landowner/estate manager variant exists. | Yes, if C4 rural estate role is desired. |
| `herdsman_subtype` / `herder` | S1-S6, C1-C4 | Merge/alias or distinguish; likely C1-C2/C3 | Duplicate-looking and too broad upward. | No for merge; yes for elite livestock owner. |
| `peddler` | S1-S6, C1-C4 | S1-S5, C1-C3 | Good mobility role, but should not be ordinary C4/S6 elite default. | Yes: Merchant Factor / Great Merchant for elite trade. |
| `fisher` | S1-S6, C1-C4 | S1-S6, C1-C2 or C1-C3 | Good local profession, but ordinary fisher as C4 default is odd. | Yes, if ship owner/fleet master is desired. |
| `woodcutter` | S1-S6, C1-C4 | S1-S5, C1-C2/C3 | Ordinary labor role should not crowd elite class. | Maybe: Forester/Woodwarden if high-status variant desired. |
| `docker` | S2-S6, C2-C4 | S2-S5, C1-C3 or C2-C3 | Port labor should not default to C4. | Maybe: Dockmaster/Harbor Master later. |
| `local_trader` | S2-S6, C2-C4 | S2-S5, C2-C3 | Local trader should not substitute for elite merchant. | Yes: Merchant Factor / Great Merchant. |
| `inn_keeper` | S2-S6, C2-C4 | S2-S5, C2-C3 | Ordinary hospitality role should not crowd elite C4. | Maybe: Guild Innkeeper / Court Host if desired. |
| `merchant` | S2-S6, C2-C4 | Keep broad for now, but split elite variant later | Merchant can plausibly rise high, but generic package is too flat across classes. | Yes: Great Merchant / Merchant House Factor. |
| `master_craftsmen` | S3-S6, C3-C4 | Keep, but rebuild package | Availability is plausible; package is too weak. | No. |
| `builder_master_mason` | S3-S6, C3-C4 | Keep, but rebuild package | Availability is plausible; package is thin. | No. |
| `chariot_driver` | S2-S6, C2-C4 | Needs design decision | Could be transport/service, elite sport, military, or ceremonial. Captaincy is suspicious. | Maybe. |

## I. New Professions Worth Considering

| Proposed profession | Society | Class | Role category | Concept | Suggested groups | Direct skills only if needed | Reach target | Priority |
|---|---:|---:|---|---|---|---|---:|---|
| Apprentice Artisan | S2-S6 | C1-C2 | Craft/guild entry | Low-status formal craft trainee. | Craft; Technical Measurement | One craft specialty if needed | 10-12 | Medium |
| Journeyman Artisan | S3-S6 | C2-C3 | Craft/guild mobility | Skilled mobile craft worker. | Craft; Mercantile Practice; Technical Measurement | One specialty | 12-16 | Medium |
| Guild Master | S4-S6 | C3-C4 | Guild authority | Senior guild official/master workshop owner. | Craft; Commercial Administration; Mercantile Practice; Civic Learning or Operations | Law/Administration only if not covered | 16-22 | High |
| Merchant Factor | S4-S6 | C3-C4 | Commercial agent | Agent of a merchant house/guild, handles contracts and goods. | Mercantile Practice; Commercial Administration; Operations | Language or Etiquette if needed | 16-20 | High |
| Great Merchant | S5-S6 | C4 | Elite commercial power | Major merchant-house owner or financier. | Mercantile Practice; Commercial Administration; Operations; Political Acumen | Banking if not covered | 18-24 | High |
| Banker / Moneylender | S4-S6 | C3-C4 | Finance | Credit, ledgers, contracts, risk, debt. | Commercial Administration; Operations; Civic Learning | Banking, Law, Appraisal if needed | 15-20 | High |
| Court Supplier | S5-S6 | C4 | Elite service/commercial | Supplier to court, army, or palace household. | Mercantile Practice; Commercial Administration; Courtly Formation; Political Acumen | Etiquette/Heraldry if needed | 18-22 | Medium |
| Caravan Master | S3-S6 | C3 | Transport leadership | Leads trade caravans, not a military officer. | Transport and Caravan Work; Route Security; Mercantile Practice; Commercial Administration | Language if needed | 16-20 | Medium |
| Teamster | S1-S5 | C1-C2 | Transport labor | Low/mid freight handler and driver. | Transport and Caravan Work; Animal Handling or Mounted Service | None | 10-12 | Medium |
| Innkeeper / Guild Host variant | S3-S6 | C2-C3 | Hospitality business | More focused hospitality path than merchant-family default. | Mercantile Practice; Social Reading; Commercial Administration | Brewing/Baking if needed | 12-16 | Low-medium |
| Dockmaster / Harbor Master | S4-S6 | C3-C4 | Port administration | Manages docks, freight, fees, crews. | Maritime Crew Training; Commercial Administration; Mercantile Practice; Civic Learning | Law or Administration if needed | 16-20 | Medium |
| Ship Factor / Maritime Trader | S4-S6 | C3-C4 | Maritime commerce | Commercial shipping agent distinct from Ships Officer. | Maritime Navigation; Mercantile Practice; Commercial Administration; Operations | Sailing/Language if needed | 16-20 | Medium |

## J. Top 10 Remaining Cleanup Decisions

1. Small cleanup now: split or narrow merchant-family direct grants so `local_trader`, `peddler`, `merchant`, `inn_keeper`, `homemaker`, and `prostitute` stop sharing the same broad travel/banking/sailing package.
2. Small cleanup now: rebuild `master_craftsmen` and `builder_master_mason` around `craft_group`, Technical Measurement, and commerce/admin instead of mostly direct grants.
3. Small cleanup now: investigate and likely remove/replace `Captaincy` from `chariot_driver`.
4. Small cleanup now: decide whether `herdsman_subtype` and `herder` are duplicates, aliases, or distinct regional variants.
5. Defer until replacement exists: restrict ordinary C4 availability for farmer/herder/peddler/fisher/docker/local trader/inn keeper.
6. High-value addition: add `Guild Master`, `Merchant Factor`, and `Banker / Moneylender` before tightening elite commercial slots.
7. Medium addition: add `Teamster` or `Caravan Master` to separate transport labor/leadership from Route Security and military caravan guard.
8. Defer: refine maritime trade roles after deciding whether ordinary `sailor`, `deck_sailor`, and `fisher` should all inherit Maritime Navigation.
9. Needs content-model refactor: represent craft specialties/specializations more canonically so master artisans can be precise without direct-grant sprawl.
10. Needs design decision: decide whether high-class rural/economic roles should be landowner/estate-manager variants rather than ordinary labor profession rows.

## K. Implementation Recommendation

The current trade/guild/craft catalog is good enough for current chargen testing at low and mid levels. It gives low-status characters meaningful non-combat options and gives class 2-3 characters plausible upward-mobility paths through trade, craft, maritime work, clerical work, smuggling, and logistics.

It still needs one small cleanup pass before moving too far into final balancing: merchant-family direct grants and master-craft packages are doing too much work and make several professions feel mechanically samey. I recommend a narrow next pass that:

- narrows merchant-family broad direct grants,
- rebuilds `master_craftsmen` / `builder_master_mason` around actual craft groups,
- fixes or justifies `chariot_driver` Captaincy,
- leaves class-4 availability constraints until elite commercial replacements exist.

After that, the highest-value new content pass would be a small elite commercial/guild pass adding `Guild Master`, `Merchant Factor`, and `Banker / Moneylender`.
