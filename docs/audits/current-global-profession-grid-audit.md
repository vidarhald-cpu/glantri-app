# Current Global Profession Grid Audit

Date: 2026-05-01

Scope: read-only audit of the current repo-local/generated Glantri profession catalog after the recent military, court, criminal, trade, guild, craft, and class-availability cleanup passes.

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
- Existing reports under `docs/audits/`

Interpretation:

- The audit uses current generated canonical content as source of truth.
- Generated `societyLevels[*].professionIds` is the app grid of profession availability.
- Important model note: generated `societyLevels[*].societyLevel` currently contains the social class band number, not the source society-stage number. For this audit, society stage 1-6 is reconstructed by joining each generated row's `societyId` to `data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json` `societyTypes[*].level`.
- Class availability is read from generated `societyLevels[*].socialClass`: C1 `Common Folk`, C2 `Trades and Guilds`, C3 `Established Households`, C4 `Court and Elite`.
- Skill groups and direct grants are read through the existing effective package resolver in `packages/rules-engine/src/professions/resolveEffectiveProfessionPackage.ts`, which combines family grants and profession/subtype grants.
- Skill reach uses the current app/admin proxy: unique skills reachable through effective skill groups plus direct skills not already covered by those groups. Slot-bearing groups count their candidate skills as reachable in the current generated/admin model.

Current catalog shape:

- 96 active generated professions.
- 44 generated society/class rows.
- 6 source society stages represented by 11 society archetypes.
- 4 class bands represented for each society archetype.

## B. Society-Level Coverage Summary

| Society stage | Total professions | Martial/security | Criminal/covert | Craft/trade/guild | Rural/survival/local | Court/high-society | Scholarly/bureaucratic | Religious/healing | Maritime/transport | Gaps / pressure points |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 24 | 4 | 3 | 3 | 8 | 0 | 0 | 3 | 0 | Good low-status play; no formal literate/court paths expected. Rural roles are playable but several have low reach. |
| 2 | 55 | 11 | 11 | 11 | 9 | 1 | 0 | 6 | 2 | Strong low/mid breadth. Criminal, trade, martial, rural, performance, and healing options are all present. Scholarly paths are still absent, plausibly. |
| 3 | 73 | 16 | 13 | 13 | 9 | 3 | 4 | 8 | 2 | Professionalization begins well: scribes, master craft, watch/jailer, ships officer, and broader civic paths appear. |
| 4 | 88 | 19 | 13 | 16 | 9 | 9 | 7 | 8 | 2 | Very rich coverage. The main issue is ordinary roles continuing upward alongside elite replacements. |
| 5 | 88 | 19 | 12 | 17 | 9 | 9 | 7 | 8 | 2 | High society has strong military/staff/commercial options now. Rural and ordinary covert/trade roles remain broad. |
| 6 | 75 | 14 | 10 | 12 | 9 | 8 | 7 | 8 | 2 | Elite options exist, but mundane rural/service/performance roles still appear by default. Maritime high-status coverage remains thin. |

Society-level assessment:

- Martial/security now scales plausibly from village guard, militia, tribal/clan fighters, infantry, watch roles, officers, staff, and imperial officers.
- Criminal/covert low and mid play is strong, with beggar, bandit, street thug, thief, burglar, smuggler, fixer, spy, assassin, and bounty hunter. It is still broad at high society, but that is less urgent than before.
- Trade/guild/craft coverage is much better after elite commercial additions and craft slots. The remaining pressure is not breadth but overbroad availability for generic `merchant`, `crafter`, `homemaker`, `prostitute`, `miner`, and some labor roles.
- Rural/survival/local options are good for low-roll play, but several have low reach and remain available as C4/high-society defaults.
- Court/high-society and scholarly/bureaucratic roles now exist in the right stage bands, but many are under-reached for C4 and rely on direct grants.
- Religious/healing is available at every stage and class, which is playable, but elite/formal religious distinctions may need a dedicated future audit.
- Maritime/transport remains the thinnest category globally: only `sailor`, `deck_sailor`, `fisher`, and `ships_officer` carry much of that space, and `deck_sailor` reach is below target.

## C. Class-Band Coverage Summary

| Class band | Total professions | Coverage quality | Playable low-status paths | Upward-mobility paths | Elite/high-status paths | Main concerns |
|---:|---:|---|---|---|---|---|
| C1 Common Folk | 25 | Good for chargen testing. | Farmer, herder/herdsman, hunter, woodcutter, prospector, crafter, fisher, peddler, beggar, bandit, street thug, village guard, militia fighter, tribal/clan warriors, folk healer, shaman, performers. | Peddler, crafter, militia fighter, hunter, prospector, folk healer/shaman. | None expected. | Rural options are interesting but several are low reach; no low literate path, probably acceptable. |
| C2 Trades and Guilds | 60 | Strong. | Low/mid criminal, trade, craft, service, maritime, martial, healing, and performance roles. | Merchant, local trader, smuggler, fixer, burglar, bounty hunter, watchman, garrison soldier, sailor, companion, healer. | Very limited, as expected. | Some generic professions remain too broad, but class 2 is lively and playable. |
| C3 Established Households | 79 | Very strong mobility band. | Almost all C2 lines continue; stronger military, craft, court-service, criminal, religious, and scholarly paths appear. | Master Craftsmen, Builder/Master Mason, Guild Master, Merchant Factor, Banker/Moneylender, Veteran Sergeant, City Watch Officer, Quartermaster, Ships Officer, Scribe, Temple Scribe, Spy, Assassin. | Early elite service and command roles. | This is currently the healthiest band. Some roles may be too broad upward but it works well for play. |
| C4 Court and Elite | 70 | Much improved but still crowded. | Many ordinary roles still appear: crafter, homemaker, merchant, miner, prostitute, chariot driver, sailor, deck sailor, thief, burglar, smuggler, bounty hunter, performer roles, animal trainer, hunter, hermit, messenger, prospector. | Elite commercial, military, court, scholarly, religious, and covert paths exist. | Noble, Herald, Politician, Courtesan, Great Merchant, Guild Master, Merchant Factor, Banker/Moneylender, Military Officer, Imperial Officer, Staff Officer, Elite Guard Officer, Priest, Lawyer, Bureaucrat. | C4 still contains too many ordinary/lower-status defaults, but there are enough elite replacements to tighten later. |

Class-band assessment:

- Low-roll playability is good; C1 and C2 do not feel barren.
- C3 is now the catalog's best structural band because it contains plausible mobility through guilds, trade, crime, military/civic service, scholarship, religion, and court service.
- C4 now has enough elite options, but ordinary/lower-status professions still crowd it. This is the main global balancing issue left.

## D. Top Low-Roll Playability Review

Assuming a low social access result around 10 or below, current C1/C2 characters have meaningful options:

- Martial/local security: `village_guard`, `militia_fighter`, `tribal_warrior`, `clan_warriors`, `levy_infantry`.
- Criminal/underworld: `beggar`, `bandit`, `street_thug`, `thief`, `burglar`, `pickpocket`, `smuggler`, `bounty_hunter`.
- Craft/trade: `crafter`, `peddler`, `local_trader`, `merchant`, `inn_keeper`, `prostitute`, `homemaker`.
- Rural/survival/local: `farmer`, `herder`, `herdsman_subtype`, `hunter`, `woodcutter`, `prospector`, `fisher`, `messenger`, `hermit`.
- Religious/healing: `folk_healer`, `herbalist`, `shaman`, `healer`, `soothsayer`.
- Performance/service: `folk_performer`, `entertainer`, `dancer_acrobat`, `musician`, `prostitute_courtesan` as Companion.

Verdict:

- Low-roll playability is good enough for current chargen testing.
- The biggest low-roll weaknesses are not lack of choice but uneven reach: `herder`, `herdsman_subtype`, `messenger`, `farmer`, `fisher`, `animal_trainer`, and `deck_sailor` are below or near the low-role target.
- The low-status catalog is not over-realistic or boring. If anything, it is generous, which is preferable for testing and play.

## E. Class-3 Mobility Review

Class 3 currently supports strong upward movement through multiple routes:

- Guild/trade: `master_craftsmen`, `builder_master_mason`, `guild_master`, `merchant_factor`, `banker_moneylender`, `merchant`, `fixer`, `smuggler`.
- Military/civic: `veteran_sergeant`, `city_watch_officer`, `cavalry_officer`, `quartermaster`, `ships_officer`, `garrison_soldier`, `watchman`, `jailer`.
- Criminal/covert: `spy`, `assassin`, `conman`, `burglar`, `bounty_hunter`, `smuggler`, `fixer`.
- Court-service/social: `personal_servant`, `slave_master`, `companion`, `champion`, `bodyguard`.
- Scholarly/bureaucratic: `scribe`, `temple_scribe`, `student`, `philosopher`.
- Religious/healing: `priest`, `mourner`, `embalmer`, `healer`, `soothsayer`, `shaman`.

Mobility gaps:

- Court mobility is present but coarse: there is no dedicated `Courtier`, `Chamberlain`, `Steward`, or `Diplomat/Envoy` yet.
- Scholarly/bureaucratic mobility exists but is under-reached and direct-heavy.
- Religious mobility exists, but formal clergy hierarchy is underdefined.
- Maritime mobility has `ships_officer`, but there is no `Warship Officer`, `Ship Factor`, `Harbor Master`, or `Dockmaster`.

Verdict:

- Class 3 is structurally successful.
- The next mobility improvements should be targeted, not broad: court-service hierarchy, formal religion/healing, scholar/bureaucratic packages, and maritime leadership.

## F. Class-4 Elite Review

Class 4 now has enough elite alternatives:

- Court/high-society: `noble`, `herald`, `politician`, `courtesan`, `household_courtier`.
- Military/security: `military_officer`, `staff_officer`, `imperial_officer`, `elite_guard_officer`, `cavalry_officer`, `city_watch_officer`, `quartermaster`.
- Commercial/guild: `great_merchant`, `guild_master`, `merchant_factor`, `banker_moneylender`.
- Scholarly/bureaucratic: `court_scribe_clerk`, `bureaucrat`, `lawyer`, `tax_collector`, `temple_scribe`.
- Religious/healing: `priest`, `mourner`, `soothsayer`, `shaman`, `healer`.
- Covert/elite-adjacent: `spy`, `assassin`, `fixer`, `conman`.

Ordinary/lower-status professions still appearing in C4:

| Profession | Current availability | Recommendation |
|---|---|---|
| `crafter` | S1-S6, C1-C4 | Keep for now or constrain later after deciding whether generic crafter represents elite artisan access. Craft slots make it playable, but C4 may be too broad. |
| `merchant` | S2-S6, C2-C4 | Keep for now; generic merchant can plausibly span high status, but `great_merchant` now exists for true elite commerce. |
| `homemaker` | S2-S6, C2-C4 | Likely constrain later or reconceptualize as household manager/steward if C4 stays. |
| `prostitute` | S2-S6, C2-C4 | Likely constrain later; `courtesan` and `companion` cover higher-status social roles. |
| `miner` | S2-S6, C2-C4 | Likely constrain later or add Mine Foreman/Mining Engineer replacement. |
| `chariot_driver` | S2-S6, C2-C4 | Needs design decision: service driver, elite sport, ceremonial role, or transport specialist. |
| `sailor` / `deck_sailor` | S2-S6, C2-C4 | Likely constrain ordinary crew later after adding maritime command/commercial replacements. |
| `thief` / `burglar` / `smuggler` / `bounty_hunter` | Mostly S2-S6, C2-C4 | Keep until elite covert/state-agent variants are added. |
| `dancer_acrobat`, `entertainer`, `folk_performer`, `musician`, `actor` | Broad C4 presence | Consider Court Performer/Master Entertainer later before constraining common variants. |
| `animal_trainer`, `hunter`, `hermit`, `messenger`, `prospector` | Some or all C4 | Rural/local high-class status needs a future service/estate/specialist pass. |

Verdict:

- C4 is no longer structurally empty, but it is still too permissive.
- The safest future C4 pass should constrain ordinary service/rural/performance/maritime roles only after adding or confirming elite replacements.

## G. Skill-Reach And Group-Quality Review

Professions below reach 10:

| Profession | Reach | Groups | Assessment |
|---|---:|---|---|
| `herder` | 7 | Animal Husbandry; Mounted Service; Transport and Caravan Work | Very low despite three groups; likely group membership/reach issue or duplicate with Herdsman. |
| `herdsman_subtype` | 7 | Animal Husbandry; Mounted Service; Transport and Caravan Work | Same issue as Herder. Merge/distinguish decision needed. |
| `messenger` | 7 | Animal Husbandry; Mounted Service; Transport and Caravan Work | Conceptually useful, but package is too thin and too animal-trade flavored. |
| `animal_trainer` | 8 | Animal Husbandry; Mounted Service; Transport and Caravan Work | Skilled role under target; likely needs Animal Handling or more focused training. |
| `farmer` | 9 | Animal Husbandry; Mounted Service; Transport and Caravan Work | Playable but below target; needs rural household/farming package later. |
| `fisher` | 9 | Maritime Crew Training; Maritime Navigation | Slightly weak; may need Fishing/Coastal Work package instead of broad Navigation. |
| `deck_sailor` | 9 | Maritime Crew Training; Maritime Navigation | Slightly weak for recurring maritime labor. |

High-status or C4 professions below reach 15:

| Profession | Reach | Concern |
|---|---:|---|
| `court_scribe_clerk` | 11 | Elite clerk role is underbuilt and direct-heavy. |
| `courtesan` | 12 | Elite social role relies on direct grants; could use a richer court/social group later. |
| `herald` | 13 | Good concept but under target for C4. |
| `household_courtier` | 12 | Needs stronger court/service package. |
| `noble` | 12 | Underbuilt for C4; may need estate/court command or noble education group. |
| `personal_servant` | 11 | C3-C4 service role probably needs its own household service package. |
| `politician` | 12 | Political package is thin/direct-heavy. |
| `slave_master` | 13 | Needs design decision and likely availability/package cleanup. |
| `builder_master_mason` | 13 | Better after craft slots but still below high-status target. |
| `merchant` | 11 | Acceptable generic role, weak as C4. |
| `miner` | 10 | Too low/direct-heavy for C4. |
| `prostitute` | 11 | Too ordinary for C4 now that Companion/Courtesan exist. |
| `assassin` | 13 | Elite covert variant may be needed before constraining. |
| `spy` | 14 | Close to target; likely acceptable until elite intelligence pass. |
| `ships_officer` | 12 | Still underbuilt for command. |
| `actor`, `entertainer`, `folk_performer`, `musician`, `dancer_acrobat` | 12-13 | Common performance roles remain C4 but lack elite court-performance distinction. |
| `embalmer`, `healer`, `herbalist`, `folk_healer` | 10-11 | Healing hierarchy needs a focused audit. |
| `bureaucrat`, `lawyer`, `scribe`, `student`, `philosopher`, `tax_collector` | 10-13 | Scholarly/bureaucratic roles are coherent but under-reached and direct-heavy. |

Professions with fewer than two meaningful groups:

| Profession | Groups | Assessment |
|---|---|---|
| `woodcutter` | Technical Measurement | Direct-heavy; needs Woodcraft/Forestry/Resource Labor group or availability cleanup. |
| `miner` | Technical Measurement | Direct-heavy; needs Mining/Extraction package. |

Heavy direct-grant reliance:

- Court/social: `noble`, `herald`, `politician`, `courtesan`, `household_courtier`, `personal_servant`, `slave_master`.
- Criminal/covert: `thief`, `burglar`, `assassin`, `spy`, `pickpocket`, `bandit`, `street_thug`, `conman`.
- Religious/healing: `folk_healer`, `healer`, `herbalist`, `shaman`, `soothsayer`, `priest`, `mourner`, `embalmer`.
- Scholarly/bureaucratic: `scribe`, `student`, `temple_scribe`, `court_scribe_clerk`, `bureaucrat`, `lawyer`, `tax_collector`.
- Rural/resource: `woodcutter`, `miner`, `fisher`, `hunter`, `prospector`.

Group-quality notes:

- Recent craft-specialty slot work is working for `crafter`, `master_craftsmen`, and `builder_master_mason`.
- `craft_group` remains as an interim approximation elsewhere, especially `guild_master` and `homemaker`.
- `animal_husbandry`, `mounted_service`, and `transport_and_caravan_work` are coherent but do not produce enough reach for several rural professions.
- `courtly_formation` plus `political_acumen` is overused as the whole identity of many C4 court roles.
- `literate_foundation` plus `civic_learning` is overused as the whole identity of many scholar/bureaucratic roles.
- Performance roles are clean after duplicate cleanup, but common/court performer distinction remains incomplete.
- Combat skills are much cleaner now and mostly stay inside coherent combat packages.

## H. Remaining Catalog Areas Needing Focused Audit

Recommended next audit areas:

1. Rural/local/survival: highest immediate value. Multiple low-reach professions and C4 ordinary-role issues cluster here: `farmer`, `herder`, `herdsman_subtype`, `messenger`, `animal_trainer`, `hunter`, `prospector`, `woodcutter`, `miner`.
2. Scholar/literate/bureaucratic: many C4 roles are under-reached and direct-heavy; this affects high-society quality.
3. Religion/healing: broad availability is playable, but hierarchy and packages are still blunt.
4. Maritime/transport: small area but clear issues around `deck_sailor`, `ships_officer`, and missing maritime leadership/commercial variants.
5. Service/household/performance: C4 is still crowded with ordinary performer/service roles, and household service lacks a strong package.

No immediate global magic/special-institution audit was performed here; if magical professions exist in imported content, they are not prominent in the current generated profession grid.

## I. Top 10 Recommended Next Implementation Decisions

1. Small cleanup now: fix or document the generated row naming/model issue where `societyLevels[*].societyLevel` stores class band, not source society stage. This is a reporting/model clarity risk, even if app behavior is currently stable.
2. Small cleanup now: rural/local reach pass for `herder`, `herdsman_subtype`, `messenger`, `animal_trainer`, `farmer`, and `fisher`.
3. Small cleanup now: resource labor pass for `woodcutter` and `miner`, both one-group/direct-heavy professions.
4. Small cleanup now or defer: constrain or reconceptualize ordinary C4 roles now that elite replacements exist, starting with `homemaker`, `prostitute`, `miner`, `chariot_driver`, and common performer roles.
5. Needs design decision: decide whether `herder` and `herdsman_subtype` are aliases, regional variants, or distinct professions.
6. Needs design decision: decide what `chariot_driver` is: transport labor, elite sport, ceremonial service, military vehicle role, or court performance.
7. Defer but important: scholar/bureaucratic package pass for `bureaucrat`, `lawyer`, `tax_collector`, `scribe`, `student`, `court_scribe_clerk`, and `philosopher`.
8. Defer but important: religious/healing hierarchy pass for `healer`, `folk_healer`, `herbalist`, `shaman`, `soothsayer`, `priest`, `mourner`, and `embalmer`.
9. Defer: maritime/transport pass adding or distinguishing `Warship Officer`, `Ship Factor`, `Dockmaster/Harbor Master`, and ordinary deck/fisher packages.
10. Later content-model refactor: represent ordinary skills, secondary skills, specializations, group memberships, slots, parentage, bridge metadata, and derived grants in a unified canonical skill graph rather than relying on audit-time reach proxies.

## J. Implementation Recommendation

The current profession catalog is good enough for current chargen testing.

The recent passes have solved the biggest structural problems:

- Ordinary soldiers and officers are distinct.
- Low-society warriors are constrained.
- C3 military/civic/commercial mobility is strong.
- C4 has real elite military, court, commercial, scholarly, and religious options.
- Low-status characters have interesting choices across martial, criminal, rural, craft, trade, service, performance, and healing paths.
- Craft professions now use choice-slot style specialty modeling in the focused craft-guild roles.

The catalog still needs one small balancing pass before moving too far toward final balancing. I recommend the next implementation pass be a rural/local/survival cleanup, because it addresses both low-roll quality and C4 crowding without needing a large new profession expansion.

Recommended next implementation pass:

- Improve or distinguish `herder` / `herdsman_subtype`.
- Strengthen `messenger` and `animal_trainer`.
- Decide whether `farmer` and `fisher` need focused low-status packages or just reach tuning.
- Move `woodcutter` and `miner` away from one-group/direct-heavy technical packages if suitable existing groups can be reused.
- Leave broader C4 tightening for after those packages are healthier.
