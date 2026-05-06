# Current Scholar / Healing Profession Structure Audit

Date: 2026-05-01

Scope: read-only audit of the current repo-local/generated Glantri scholar, literate, bureaucratic, religious, ritual, and healing profession and skill-group structure.

No profession/content changes are implemented by this document.

## A. Current Profession Table

Method:

- Source of truth: `packages/content/src/seeds/generatedRepoLocalGlantriSeed.ts`.
- Society stage is reconstructed by joining generated `societyLevels[*].societyId` to `data/import/glantri_content_pack_full_2026-03-30_norm7/content_bundle.json` `societyTypes[*].level`.
- Class band is read from generated `societyLevels[*].socialClass`: C1 `Common Folk`, C2 `Trades and Guilds`, C3 `Established Households`, C4 `Court and Elite`.
- Groups/direct grants/reach use the existing effective package resolver in `packages/rules-engine/src/professions/resolveEffectiveProfessionPackage.ts`.
- Reach is the current app/admin proxy: unique skills reachable through effective groups plus direct-only grants.

| Profession id | Name | Society | Class | Role category | Groups | Direct grants | Reach | Verdict |
|---|---|---:|---:|---|---|---|---:|---|
| `scribe` | Scribe | S3-S6 | C3-C4 | Literate clerk | Literate Foundation; Civic Learning | Literacy; Bureaucratic Writing; History; Theology; Philosophy; Law; Rhetorical Composition; Administration; Etiquette | 10 | Acceptable baseline, but direct-heavy and low for C4. |
| `student` | Student | S3-S6 | C3-C4 | Education / trainee scholar | Literate Foundation; Civic Learning | Literacy; Language; History; Theology; Philosophy; Law; Rhetorical Composition; Administration; Etiquette | 10 | Good mobility concept, but too similar to Scribe and direct-heavy. |
| `philosopher` | Philosopher | S3-S6 | C3-C4 | Scholar / thinker | Literate Foundation; Civic Learning | History; Theology; Philosophy; Law; Rhetorical Composition; Administration; Etiquette | 10 | Underbuilt; needs scholar/humanities distinction. |
| `temple_scribe` | Temple Scribe | S3-S6 | C3-C4 | Religious literate clerk | Literate Foundation; Civic Learning; Sacred Learning | Theology; History; Philosophy; Law; Rhetorical Composition; Administration; Etiquette; Divination; Ritual Interpretation | 12 | Coherent bridge role, still direct-heavy. |
| `court_scribe_clerk` | Court Scribe / Clerk | S4-S6 | C4 | Elite court clerk | Literate Foundation; Civic Learning | Administration; History; Theology; Philosophy; Law; Bureaucratic Writing; Rhetorical Composition; Etiquette; Courtly Protocol | 11 | Needs cleanup. C4 court role is under-reached and lacks Courtly Formation/Commercial Admin. |
| `bureaucrat` | Bureaucrat | S4-S6 | C4 | Formal administration | Literate Foundation; Civic Learning; Commercial Administration | Bureaucratic Writing; Administration; History; Theology; Philosophy; Law; Rhetorical Composition; Bookkeeping; Etiquette | 11 | Needs cleanup. Good concept, but underbuilt for C4 and direct-heavy. |
| `lawyer` | Lawyer | S4-S6 | C4 | Legal professional | Literate Foundation; Civic Learning | Law; Oratory; History; Theology; Philosophy; Bureaucratic Writing; Rhetorical Composition; Administration; Etiquette; Insight | 12 | Needs cleanup. Legal Advocate/Magistrate distinction may be useful. |
| `tax_collector` | Tax Collector | S4-S6 | C4 | Fiscal official | Literate Foundation; Civic Learning; Commercial Administration | Administration; Bookkeeping; History; Theology; Philosophy; Law; Bureaucratic Writing; Rhetorical Composition; Bargaining; Etiquette; Insight | 13 | Acceptable but direct-heavy; Fiscal Administration group could help. |
| `folk_healer` | Folk Healer | S1-S6 | C1-C4 | Low/local healer | Healing Practice; Herb and Remedy Craft | First Aid; Herb Lore; Theology; Administration; Etiquette; Insight; Concentration; Medicine; Poison Lore; Nursing | 11 | Good low-roll option, but C4 broadness and inherited admin/etiquette are odd. |
| `healer` | Healer | S2-S6 | C2-C4 | General healer | Healing Practice; Herb and Remedy Craft | Medicine; First Aid; Theology; Administration; Etiquette; Concentration; Herb Lore; Poison Lore; Pharmacy; Nursing | 10 | Acceptable baseline, but thin/direct-heavy for formal/high-status contexts. |
| `herbalist` | Herbalist | S1-S6 | C1-C4 | Herb/remedy specialist | Herb and Remedy Craft; Healing Practice | Herb Lore; Pharmacy; Theology; Administration; Etiquette; Concentration; Medicine; First Aid; Poison Lore | 10 | Acceptable, but too similar to Healer/Folk Healer. |
| `shaman` | Shaman | S1-S6 | C1-C4 | Ritual healer / spirit specialist | Omen and Ritual Practice; Healing Practice; Herb and Remedy Craft | Divination; Ritual Interpretation; Theology; Administration; Etiquette; Insight; Concentration; Medicine; Herb Lore | 14 | Good playable package; high-society/C4 availability may need culture/background treatment later. |
| `soothsayer` | Soothsayer | S2-S6 | C2-C4 | Diviner / omen reader | Omen and Ritual Practice; Healing Practice; Herb and Remedy Craft | Divination; Omen Reading; Theology; Administration; Etiquette; Insight; Concentration; Medicine; Ritual Interpretation; Astrology | 15 | Good reach and concept, though direct grants overlap group identity. |
| `priest` | Priest | S3-S6 | C3-C4 | Formal religious office | Sacred Learning; Omen and Ritual Practice; Healing Practice; Herb and Remedy Craft | Theology; Ritual Interpretation; Literacy; History; Administration; Etiquette; Oratory; Concentration; Medicine; Divination | 16 | Good enough. Strong formal role, though low/high priest hierarchy is not modeled. |
| `mourner` | Mourner | S2-S6 | C2-C4 | Ritual/performance funerary specialist | Performance Basics; Healing Practice; Herb and Remedy Craft; Omen and Ritual Practice | Singing; Recitation; History; Theology; Administration; Etiquette; Concentration; Medicine; Ritual Interpretation | 19 | Mechanically strong and distinct; may be overbroad for C4 without elite/funerary-office framing. |
| `embalmer` | Embalmer | S3-S6 | C3-C4 | Mortuary specialist | Healing Practice; Herb and Remedy Craft | Medicine; Pharmacy; History; Theology; Administration; Etiquette; Concentration; Poison Lore | 11 | Needs cleanup. Concept is good but package is too close to Healer/Herbalist and underbuilt. |

## B. Scholar / Literate / Bureaucratic Review

Current relevant groups:

| Group | Membership | Coherence | Verdict |
|---|---|---|---|
| Literate Foundation | Literacy; Language; History | Good basic literate education. | Keep. Good low/mid entry to educated roles. |
| Civic Learning | Literacy; Law; Bureaucratic Writing; Rhetorical Composition | Coherent civic/legal writing package. | Keep. Strong base for clerks and officials. |
| Commercial Administration | Bureaucratic Writing; Administration; Bookkeeping | Coherent office/accounting package. | Keep. Underused by some C4 clerk/legal roles. |
| Courtly Formation | Etiquette; Heraldry; Courtly Protocol | Coherent court/status package. | Keep. Should probably support court clerk and elite bureaucratic roles more often. |
| Humanities | Literacy; Language; History; Theology; Philosophy; Law; Rhetorical Composition; Etiquette; Heraldry; Courtly Protocol; Insight; Social Perception; Detect Lies; Seduction | Very broad social/scholarly/court taxonomy group. | Useful taxonomy but too broad for ordinary profession grants. |

Scholar/bureaucratic findings:

- `scribe`, `student`, and `philosopher` are too mechanically similar: all are mostly Literate Foundation + Civic Learning plus direct history/theology/philosophy/admin/etiquette.
- `philosopher` needs a real scholar/humanities or contemplative/academic package if it is meant to be distinct from a general literate student.
- C4 formal roles are under-reached: `court_scribe_clerk` 11, `bureaucrat` 11, `lawyer` 12, `tax_collector` 13.
- `court_scribe_clerk` does not currently receive `courtly_formation`, despite being an explicitly court-facing role.
- `bureaucrat`, `lawyer`, and `tax_collector` have good concepts but rely too much on direct grants. They suggest missing groups such as Legal Practice, Fiscal Administration, Bureaucratic Office, and Scholarly Formation.
- Class-3 educational mobility exists, but it is narrow: `scribe`, `student`, `philosopher`, and `temple_scribe` cover most of the space.

## C. Religion / Healing Review

Current relevant groups:

| Group | Membership | Coherence | Verdict |
|---|---|---|---|
| Healing Practice | Medicine; First Aid; Nursing | Strong practical healing package. | Keep. Good medical core. |
| Herb and Remedy Craft | Herb Lore; Poison Lore; Pharmacy | Coherent remedy/apothecary package. | Keep. Good specialist support. |
| Sacred Learning | History; Theology; Ritual Interpretation | Coherent formal religious learning. | Keep. Useful but probably underused outside Priest/Temple Scribe. |
| Omen and Ritual Practice | Divination; Omen Reading; Ritual Interpretation | Coherent divination/ritual package. | Keep. Good ritual specialist group. |
| Medicine | Medicine; First Aid; Herb Lore; Poison Lore; Pharmacy; Nursing | Broad taxonomy-style medicine group. | Useful taxonomy; too broad as a profession grant unless intended. |
| Mental Discipline | Concentration; Memory; Self-Control; Meditation | Coherent discipline package. | Candidate support for monk/scholar/ritual specialist later. |

Religion/healing findings:

- Low-status religious/healing play is strong: `folk_healer`, `herbalist`, and `shaman` are available from S1/C1 and remain playable.
- `healer` and `herbalist` are mechanically close. Herbalist has the same two main groups as Healer, with direct grants doing flavor work.
- `folk_healer` is useful and reachable but inherits odd formal flavor such as Administration and Etiquette.
- `shaman` and `soothsayer` are coherent and better differentiated by Omen and Ritual Practice; `soothsayer` reaches 15 and is one of the stronger packages.
- `priest` is currently the only formal clergy path and is strong enough at reach 16, but there is no High Priest, Temple Healer, Monastic Scholar, or Ritual Specialist hierarchy.
- `mourner` is mechanically strong at reach 19 and distinct through Performance Basics, but may be too broad upward unless framed as a formal funerary/ritual office.
- `embalmer` is underbuilt at reach 11 and too similar to the healer/herbalist package for a specialized mortuary profession.

## D. Class And Society Review

Society-level pattern:

| Society stage | Scholar/literate/bureaucratic | Religion/healing | Gaps / notes |
|---:|---|---|---|
| S1 | None | Folk Healer; Herbalist; Shaman | Good low-society spiritual/healing play. No formal literacy expected. |
| S2 | None | Adds Healer; Soothsayer; Mourner | Strong low/mid healing and ritual breadth. No scholar path yet, plausibly. |
| S3 | Scribe; Student; Philosopher; Temple Scribe | Adds Priest; Embalmer | Good start of literacy, temple service, formal healing. |
| S4 | Adds Bureaucrat; Court Scribe / Clerk; Lawyer; Tax Collector | Same healing/religious set | Formal administration appears, but C4 scholarly roles are under-reached. |
| S5 | Same as S4 | Same as S4 | No new high-bureaucratic/high-religious tier. |
| S6 | Same as S4 | Same as S4 | High civilization lacks richer scholar, state, legal, and temple hierarchy. |

Class-band pattern:

| Class band | Scholar/literate/bureaucratic | Religion/healing | Assessment |
|---:|---|---|---|
| C1 | None | Folk Healer; Herbalist; Shaman | Good low-roll non-martial play. |
| C2 | None | Healer; Herbalist; Shaman; Soothsayer; Mourner; Folk Healer | Strong healing/ritual options; no education bridge yet. |
| C3 | Scribe; Student; Philosopher; Temple Scribe | Priest; Embalmer; Mourner; Healer/Shaman/Soothsayer variants | Good mobility band into education, temple service, and formal healing. |
| C4 | All scholar/bureaucratic roles; most healing/religious roles | Broad access including low/local roles | C4 has enough options but ordinary healers/shamans/herbalists remain broad, and elite formal roles are thin. |

Class/society conclusions:

- Low-status religious/healing play is good and should not be reduced without replacements.
- Class 3 works as an education/temple mobility band.
- C4 has enough entries but not enough high-quality elite packages. It is crowded by ordinary healer/ritual roles and underpowered formal bureaucracy.
- S5-S6 do not currently add much beyond S4 for scholars, bureaucrats, law, or religion.

## E. Group-Quality Review

Main group-quality issues:

- Literate Foundation and Civic Learning are good, but overused as the entire package for too many distinct scholar/bureaucratic professions.
- Civic Learning includes both law and writing, which works as a foundation but does not distinguish legal, clerical, scholarly, and administrative careers.
- Commercial Administration is a good fit for `bureaucrat` and `tax_collector`; it may also belong on `court_scribe_clerk` or a future Account Clerk.
- Courtly Formation is underused for explicit C4 court literate roles.
- Healing Practice and Herb and Remedy Craft are good, but Healer/Herbalist/Folk Healer need clearer differentiation.
- Sacred Learning is coherent but not enough by itself to support a full religious hierarchy.
- Omen and Ritual Practice is clean and currently does useful work for Shaman/Soothsayer/Priest/Mourner.
- There is no focused Legal Practice, Fiscal Administration, Scholarly Formation, Temple Service, Mortuary Practice, or Apothecary group.

## F. Direct-Grant Review

Direct-grant-heavy professions:

| Profession | Direct-only pattern | Assessment |
|---|---|---|
| `scribe` / `student` | History; Theology; Philosophy; Administration; Etiquette | Direct grants are carrying general education. Suggests Scholarly Formation or Clerkship group. |
| `philosopher` | History; Theology; Philosophy; Law; Rhetorical Composition; Administration; Etiquette | Needs a real scholar/philosophy package. Administration/Etiquette may be inherited noise. |
| `court_scribe_clerk` | Administration; History; Theology; Philosophy; Law; Bureaucratic Writing; Rhetorical Composition; Etiquette; Courtly Protocol | Direct grants suggest Court Clerk / Court Office group. |
| `lawyer` | Oratory; Law; Bureaucratic Writing; Rhetorical Composition; Insight; Administration; Etiquette | Strong candidate for Legal Practice group. |
| `tax_collector` | Bargaining; Insight; Law; Bureaucratic Writing; Rhetorical Composition; Administration; Etiquette | Strong candidate for Fiscal Administration group. |
| `folk_healer` | Theology; Administration; Etiquette; Insight; Concentration plus healing repeats | Administration/Etiquette look too formal for local folk healing. |
| `healer` / `herbalist` | Theology; Administration; Etiquette; Concentration | Direct grants blur the distinction; could use Village Healer / Apothecary split. |
| `embalmer` | Pharmacy; History; Theology; Administration; Etiquette; Concentration | Suggests Mortuary Practice group. |
| `priest` | Literacy; History; Theology; Administration; Etiquette; Oratory; Concentration; Divination | Acceptable for now, but Temple Service / Clerical Office group could reduce direct load. |

Direct-grant conclusion:

- This catalog area is more direct-heavy than the recently cleaned military/trade/craft areas.
- The direct grants are not usually wrong, but they often compensate for missing professional groups.
- The best next implementation pass should add/reuse a few focused groups rather than adding many individual skills.

## G. New Professions Or Groups Worth Considering

Do not implement in this audit. Conservative candidates:

| Candidate | Type | Intended availability | Concept | Suggested package direction | Priority |
|---|---|---|---|---|---|
| Clerk / Account Clerk | Profession | S3-S6, C2-C3 | Entry clerical/accounting role below C4 bureaucracy. | Literate Foundation; Commercial Administration; Civic Learning. | Medium |
| Scholar | Profession | S4-S6, C3-C4 | Formal learned scholar distinct from Student/Philosopher. | Literate Foundation; Scholarly Formation; Humanities if narrowed. | Medium |
| Tutor | Profession | S4-S6, C3-C4 | Education/patronage bridge role. | Literate Foundation; Scholarly Formation; Social Reading or Courtly Formation. | Low-medium |
| Magistrate | Profession | S4-S6, C4 | Legal/civic authority above Lawyer. | Civic Learning; Legal Practice; Courtly Formation; possibly Political Acumen. | Medium-high |
| Legal Practice | Group | S4+ | Legal advocacy, civic law, rhetoric. | Law; Oratory; Bureaucratic Writing; Rhetorical Composition; Insight. | High |
| Fiscal Administration | Group | S4+ | Tax, account, ledger, valuation. | Administration; Bookkeeping; Law; Bargaining; Appraisal. | High |
| Scholarly Formation | Group | S3+ | Formal study and argument. | History; Philosophy; Rhetorical Composition; Memory or Theology depending scope. | High |
| Temple Service | Group | S3+ | Practical religious office. | Theology; Ritual Interpretation; Administration; Oratory; Etiquette. | High |
| Temple Healer | Profession | S3-S6, C3-C4 | Formal healer attached to temple/institution. | Healing Practice; Sacred Learning; Herb and Remedy Craft. | Medium |
| Court Physician | Profession | S5-S6, C4 | Elite formal physician. | Healing Practice; Herb and Remedy Craft; Literate Foundation; Courtly Formation. | Medium |
| High Priest | Profession | S5-S6, C4 | Elite religious authority. | Sacred Learning; Omen and Ritual Practice; Temple Service; Courtly Formation or Political Acumen. | Medium |
| Ritual Specialist / Diviner | Profession | S2-S6, C2-C3 | More focused ritual/omen path than broad Shaman/Soothsayer. | Omen and Ritual Practice; Sacred Learning or Mental Discipline. | Low-medium |
| Apothecary | Profession | S3-S6, C2-C3 | Remedy/pharmacy specialist distinct from Healer. | Herb and Remedy Craft; Commercial Administration or Mercantile Practice. | Medium |
| Mortuary Practice | Group | S3+ | Embalming/funerary preparation. | Medicine; Pharmacy; Ritual Interpretation; Theology; Concentration. | Medium |

## H. Top 10 Cleanup Decisions

1. Small cleanup now: add or reuse a `Scholarly Formation` group to distinguish Student/Scribe/Philosopher without many direct grants.
2. Small cleanup now: add `Legal Practice` and apply it to Lawyer, possibly Magistrate later.
3. Small cleanup now: add `Fiscal Administration` or similar for Tax Collector and high bureaucracy.
4. Small cleanup now: add `Temple Service` for Priest and Temple Scribe, reducing direct-grant load.
5. Small cleanup now or defer: add `Mortuary Practice` for Embalmer and possibly Mourner.
6. Needs design decision: whether `folk_healer`, `healer`, and `herbalist` should be split into Village Healer / Healer / Apothecary-style paths.
7. Needs design decision: whether C4 access for Folk Healer, Herbalist, Shaman, Mourner, and ordinary Healer should remain broad or wait for elite replacements.
8. Defer: add C4 elite roles such as Court Physician, High Priest, Magistrate, and Scholar only after the foundational groups are cleaner.
9. Defer: decide whether Philosopher should be a low/mid scholar, elite philosopher, monastic thinker, or public intellectual.
10. Later content-model refactor: unify ordinary, secondary, specialization, parentage, dependencies, bridge metadata, group memberships, and derived grants in the canonical skill graph.

## I. Implementation Recommendation

The scholar/healing catalog is good enough for current chargen testing, but it needs one small cleanup pass before final balancing.

Why it is good enough:

- Low-status religious/healing options are playable and varied.
- Class 3 has real upward mobility through Scribe, Student, Philosopher, Temple Scribe, Priest, Embalmer, and healing/ritual paths.
- C4 has enough options to test elite scholarly, legal, bureaucratic, and religious access.

Why it still needs cleanup:

- C4 scholar/bureaucratic roles are under-reached relative to their status.
- Scholar/bureaucratic professions rely too much on direct grants.
- Healer/Herbalist/Folk Healer are too similar.
- Formal religious hierarchy is thin: Priest is doing almost all high-formal clergy work.

Recommended next implementation pass:

- Add a small set of focused groups: Scholarly Formation, Legal Practice, Fiscal Administration, Temple Service, and possibly Mortuary Practice.
- Apply those groups narrowly to existing professions first.
- Do not add many new professions until the group foundations are cleaner.
- Defer C4 availability constraints until Court Physician / High Priest / Magistrate / Scholar-style replacements are available.
