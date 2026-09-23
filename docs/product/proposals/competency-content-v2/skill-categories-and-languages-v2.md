# Proposed player-facing Skill categories and Civilization languages

> **Status: CANONICAL — accepted by the Product Owner on 2026-09-23 (Forgejo #250).**
> See [decision record 0007](../../../decisions/rules/0007-competency-content-v2-canonical-acceptance.md).
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not yet registered
> with Chargen, not yet projected into canonical content, and does not yet replace any approved
> catalogue — that wiring is the separate, explicitly scoped work of #251/#252.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

## Skill categories

Skill categories are **broad, semantically predictable human browse categories**. They describe **what
the competency is**, never where or how it was learned. Two consequences follow, and both are applied
here: placement must be predictable enough that a player looking for a competency guesses the right
category first, and narrow categories must not proliferate — fourteen categories cover all 157
competencies.

The roster is **simplified** under the ruling's new latitude, which releases it from preserving awkward
current categories for compatibility. `Mental` held only Meditation and Mnemonics: two members is
proliferation, and neither name points a player at the word. Meditation joins `mystical` beside the
contemplative competencies; Mnemonics joins `knowledge`. `High society` described a milieu — who has
access — rather than what a competency is: Heraldry joins `knowledge` as the body of lore it is, and
Politics and Courtly Protocol join `social`. One arbitrary placement is corrected: Agriculture &
Husbandry defaulted to `trade`, which split the living-animal competencies between two categories, so
it now defaults to `fieldcraft`, with Cart Driving overridden back to `trade` as the transport trade it
is. The build refuses a retired category, and refuses any category that falls below four competencies.

`Special access` is therefore removed as a category. It describes how a competency was reached, not what
kind of competency it is: the same Skill reached through a Learning Group and through a direct Profession
route belongs to the same category. The `language` category is preserved and reserved for the spoken and
written competencies below.

Applying this to the runtime enum, `apps/web/src/lib/chargen/chargenBrowse.ts` and
`getPlayerFacingSkillCategoryId({ preferDirectProfession })` is deliberately out of scope for this
content proposal and needs a separate authorized implementation task.

| Category      | Competencies                                                                                                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `combat`      | 1-h conc./axe, 1-h edged, 2-h conc./axe, 2-h edged, Bow, Brawling, Crossbow, Dodge, Fencing, Firearms, Lance, Longbow, Mounted Combat, Parry, Polearms, Sling, Throwing                                                                                                                                                                      |
| `covert`      | Conceal Object, Disguise, Document & Credential Forgery, Lockpicking, Pickpocketing, Poisons, Sleight of Hand, Stealth, Streetwise, Trapmaking, Underworld, Warded-Lock Entry                                                                                                                                                                |
| `craft`       | Architecture, Armoring, Baking, Brewing, Carpentry, Cooking, Cordage / Ropemaking, Court Cookery, Distilling, Fibre Working, Food Preservation, Leatherwork, Locksmithing, Masonry, Mining, Pottery, Sailmaking, Sculpture, Shipbuilding, Smelting, Smithing, Tailoring, Visual Art, Weapon Maintenance, Weaponsmithing, Weaving, Winemaking |
| `fieldcraft`  | Animal Handling, Animal Husbandry, Animal Lore, Animal Training, Camouflage, Falconry, Farming, Fishing, Herding, Hunting, Perception, Plant Lore, Steppe Remount Training, Survival, Tracking, Trapping, Wayfinding, Weather Lore                                                                                                           |
| `healing`     | Battlefield Surgery, Bone Setting, Diagnostic Medicine, First Aid, Medicine, Nursing, Obstetrics, Pharmacy, Poison Treatment, Surgery, Veterinary Medicine                                                                                                                                                                                   |
| `knowledge`   | Alchemy, Astronomy, Cartography, Court Advocacy, Customs, Genealogy, Geography, Heraldry, History, Law, Mathematics, Mechanics, Mnemonics, Palaeography & Decipherment, Philosophy, Research, Surveying, Teaching, Translation & Interpretation                                                                                              |
| `maritime`    | Celestial Navigation, Chart Navigation, Dead Reckoning, Pilotage, Ropework, Seamanship                                                                                                                                                                                                                                                       |
| `military`    | Battle Tactics, Battlefield Awareness, Campaign Strategy, Combat Experience, Formation Fighting, Fortification, Military Command, Military Logistics, Military Reconnaissance, Siege Engine Operation, Siege Engineering, Siege Operations                                                                                                   |
| `mystical`    | Astrology, Divination, Meditation, Omen Reading, Religion, Theology                                                                                                                                                                                                                                                                          |
| `performance` | Acting, Dance, Music, Music Composition, Poetry & Literary Composition, Singing, Storytelling                                                                                                                                                                                                                                                |
| `physical`    | Athletics, Climbing, Riding, Running, Swimming                                                                                                                                                                                                                                                                                               |
| `social`      | Courtly Protocol, Deception, Gambling, Insight, Interrogation, Intimidation, Leadership, Oratory, Politics                                                                                                                                                                                                                                   |
| `trade`       | Administration, Appraisal, Banking & Credit, Bargaining, Bookkeeping, Cart Driving, Court Administration, Trade                                                                                                                                                                                                                              |

## Civilization languages

Every canonical Civilization receives a **rollable spoken competency**, and a **rollable written**
competency unless it is explicitly authored as having no written tradition. Written competence is what a
reading roll is made against. Only the minimum canonical data is authored: identity, spoken or written
type, Civilization association, route and ownership. Script histories, registers and conventions are
later enrichment and deliberately wait.

Naming follows the Product Owner ruling: the established Glantri name where one exists, and the
appropriate **historical** name where none does. In practice this required almost no judgement, because
the established names already exist — `canonicalContent.json` carries a spoken and a written language
name for all sixteen Civilizations and a roster of 21 named language records. **Every name in the table
below is taken verbatim from that roster, and the build fails if any name used is absent from it.** That
check, not this paragraph, is what guarantees nothing here is invented.

Naming shape follows the approved catalogue's own convention, set by its three existing written
traditions: `Written <language> in <tradition>` where a separate tradition name is established, and
`Written <language>` where none is.

Two corrections to the previous revision follow from the provenance check, in opposite directions.
**Lankhmaran** was introduced by the previous revision and appears nowhere else in the repository; it was
derived from the Civilization's name, which is exactly the invention the ruling forbids, and it is
withdrawn in favour of the established Phoenician names the approved catalogue already carries.
**Royal N'kolian** and **Runic Scandian** were withdrawn by the previous revision as inventions, but both
are established Glantri language records in the canonical content and are listed by name in the approved
gap report; both are restored. The previous revision's genuine inventions stay withdrawn — **Kethran, Old
Latian, Palace Scyrian, Kaldan and Aspardic**, and the **Harbour, Hill, Palace, Wedge and Chancery**
scripts.

**Olog is flagged for later correction and deliberately not corrected here:** it appears modelled from a
historical stage somewhat later and more advanced than the intended Glantri Olog society. That is a
separate low-priority follow-up, not part of this reconciliation.

**11 distinct written competencies** serve the 14 literate Civilizations; 2 are authored as having no writing. 13 distinct spoken competencies serve all 16.

| Civilization      | Spoken                                             | Written                                                                    | Status                    | Withdrawn here                                                 | Needs a Product Owner naming ruling |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| Scandia           | Spoken Scandian<br>`spoken:scandian`               | Written Scandian in Runic Scandian<br>`written:scandian:runic-scandian`    | Newly proposed            | Written Scandian in runes                                      | No                                  |
| Iest              | Spoken Common<br>`spoken:common`                   | Written Common<br>`written:common`                                         | Newly proposed            | —                                                              | No                                  |
| Thyatis           | Spoken Common<br>`spoken:common`                   | Written Common<br>`written:common`                                         | Newly proposed            | —                                                              | No                                  |
| Glantri           | Spoken Common<br>`spoken:common`                   | Written Common<br>`written:common`                                         | Newly proposed            | —                                                              | No                                  |
| Scyria            | Spoken Old Common<br>`spoken:old-common`           | Written Old Common<br>`written:old-common`                                 | Newly proposed            | —                                                              | No                                  |
| Byzantine Empire  | Spoken Old Common<br>`spoken:old-common`           | Written Old Common<br>`written:old-common`                                 | Newly proposed            | —                                                              | No                                  |
| Lankhmar          | Spoken Phoenician<br>`spoken:phoenician`           | Written Phoenician in Phoenician script<br>`written:phoenician:phoenician` | In the approved catalogue | Spoken Lankhmaran; Written Lankhmaran in the Phoenician script | No                                  |
| Olog              | Spoken Ologian<br>`spoken:ologian`                 | Written Ologian in Church Ologian<br>`written:ologian:church-ologian`      | In the approved catalogue | —                                                              | No                                  |
| Mogreb            | Spoken Mogrebi<br>`spoken:mogrebi`                 | Written Mogrebi in Sacred Mogrebi<br>`written:mogrebi:sacred-mogrebi`      | In the approved catalogue | —                                                              | No                                  |
| N'Kolo            | Spoken N'kolian<br>`spoken:nkolian`                | Written N'kolian in Royal N'kolian<br>`written:nkolian:royal-nkolian`      | Newly proposed            | Written N'kolian                                               | No                                  |
| San Forager Bands | Spoken Tuu<br>`spoken:tuu`                         | _authored as having no writing_                                            | Newly proposed            | —                                                              | No                                  |
| Scythians         | Spoken Scythian<br>`spoken:scythian`               | _authored as having no writing_                                            | In the approved catalogue | —                                                              | No                                  |
| Latial Chiefdoms  | Spoken Old Latin<br>`spoken:old-latin`             | Written Old Latin in Old Italic<br>`written:old-latin:old-italic`          | Newly proposed            | Written Old Latin in the Old Italic script                     | No                                  |
| Mycenaean Greece  | Spoken Mycenaean Greek<br>`spoken:mycenaean-greek` | Written Mycenaean Greek in Linear B<br>`written:mycenaean-greek:linear-b`  | Newly proposed            | —                                                              | No                                  |
| Sumer             | Spoken Sumerian<br>`spoken:sumerian`               | Written Sumerian in Cuneiform<br>`written:sumerian:cuneiform`              | Newly proposed            | —                                                              | No                                  |
| Achaemenid Persia | Spoken Old Persian<br>`spoken:old-persian`         | Written Imperial Aramaic<br>`written:imperial-aramaic`                     | Newly proposed            | —                                                              | No                                  |

### Routes and ownership

A language competency is owned by its Civilization. Neither route below is a grant: the competency is
still acquired, and holding a spoken competency confers nothing written, nor the reverse. Which
Civilizations a given character may reach remains the contextual availability question, unchanged here.

| Route                                                                            | Applies to                                                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spoken — Grown up within the Civilization, or learned in long dealings with it   | Every Civilization                                                                                                                                      |
| Written — Taught wherever the Civilization's own records and letters are written | Scandia, Iest, Thyatis, Glantri, Scyria, Byzantine Empire, Lankhmar, Olog, Mogreb, N'Kolo, Latial Chiefdoms, Mycenaean Greece, Sumer, Achaemenid Persia |

### Civilizations authored as having no writing

An absence is authored, never merely missing data. The build rejects a Civilization with no written
competency and no reason, and equally rejects one authored as having no writing whose canonical record
does name a written language.

- **San Forager Bands.** Authored as having no written tradition. The canonical Civilization record carries no written language for the San forager bands, and the Civilization is described as a non-literate forager society. No reading roll is made for it and no written competency is invented to carry one.
- **Scythians.** Authored as having no written tradition. The canonical Civilization record carries no written language for the Scythians, and the Civilization is described as a mobile steppe society without one. No reading roll is made for it.

### Notes

- **Scandia.** Both names are established Glantri names: Scandian is the spoken language and Runic Scandian the written one, exactly as the canonical Civilization record states. The previous revision's lowercase 'in runes' descriptor is withdrawn in favour of the established name. The approved gap report's open question — which script supports the tradition, and how the compound name decomposes — is untouched here; binding the competency to the language it writes does not answer it and does not need to.
- **Iest.** Common is an established Glantri name and the canonical record gives the same name to the written language, so the written competency takes it directly and no script name is invented. The competency is rollable as it stands, and a reading roll is made against it. Script, register and conventions are later enrichment, not a blocker.
- **Thyatis.** Shares the rollable Common written competency. Sharing an identity is a consequence of the canonical records naming the same language, not an asserted relationship between the two Civilizations.
- **Glantri.** Shares the rollable Common written competency. Old Common remains the authored optional second tongue recorded in the canonical Civilization; no descent between the two is asserted.
- **Scyria.** Old Common is an established Glantri name and the canonical record gives the same name to the written language, so no script name is invented. The written competency is rollable in its own right and is what an Old Common reading roll is made against. The approved gap report's refusal to infer equivalence with Common is respected: the two are separate competencies here and no descent is asserted in either direction.
- **Byzantine Empire.** Shares the rollable Old Common written competency, as the canonical record states. The Civilization name itself is a real-world analogue; renaming it is outside this task's scope.
- **Lankhmar.** CORRECTION. The previous revision renamed both competencies to Lankhmaran, reasoning that Lankhmar is an established Glantri name so its language may take the name directly. That reasoning derives a language name from a Civilization name, which is invention; Lankhmaran appears nowhere in the canonical language roster, the approved catalogue or any ruling. The canonical Civilization record names Lankhmar's spoken and written language Phoenician, and the approved catalogue already carries both competencies. Both are restored unchanged, including the approved catalogue's exact wording for the written one.
- **Olog.** Already complete in the approved catalogue and carried forward unchanged. FLAGGED FOR LATER CORRECTION, deliberately not corrected here: Olog appears modelled from a historical stage somewhat later and more advanced than the intended Glantri Olog society. That chronology question is a separate low-priority follow-up and is out of scope for this pass.
- **Mogreb.** Already complete in the approved catalogue; carried forward unchanged.
- **N'Kolo.** CORRECTION. The previous revision withdrew Royal N'kolian as an invented register. It is not invented: it is an established Glantri language record in the canonical content and is listed by name in the approved gap report. It is restored, bound to the language it writes in the same shape as Sacred Mogrebi and Church Ologian. What the gap report leaves open — the register's relationship to the spoken language, and its script support — stays open and is not answered here.
- **San Forager Bands.** The one spoken competency the approved catalogue does not yet carry; it is added here. Tuu is an established Glantri language record, so the name is not invented. RETURNED AMBIGUITY, not resolved here: the approved gap report asks for a sufficiently precise language identity before a player-acquirable Tuu record is counted, because Tuu is a language family rather than one language. This pass gives the Civilization the rollable spoken competency the ruling requires and declines to invent a narrower name to close the gap report's question.
- **Scythians.** Scythian is an established Glantri language record and the approved catalogue already carries the spoken competency. The previous revision's invented Kethran stays withdrawn.
- **Latial Chiefdoms.** Both names are established Glantri language records; the previous revision's invented Old Latian and Hill Script stay withdrawn. The written competency is newly added so that a reading roll has something to roll against. Binding it to Old Latin specifically is deliberate: the approved gap report asks that Old Italic's contextual breadth be resolved rather than assumed, and a competency tied to one language claims no competence in the others the script also served.
- **Mycenaean Greece.** Both names are established Glantri language records. The previous revision's invented Palace Scyrian stays withdrawn, and with it the implied descent from Scyria, which was never an established Glantri fact. The language/tradition pairing the gap report asks to confirm is exactly the pairing the canonical Civilization record already states.
- **Sumer.** Both names are established Glantri language records; the previous revision's invented Kaldan and Wedge Script stay withdrawn. The competency is Sumerian written in Cuneiform specifically, which is what lets the approved gap report's refusal of a universal Cuneiform competence stand: it is tied to one language and grants nothing in the other languages the script served.
- **Achaemenid Persia.** Both names are established Glantri language records; the previous revision's invented Aspardic and Chancery Script stay withdrawn. The spoken tongue and the written language are deliberately different languages here, which is what the canonical Civilization record states and what the approved gap report asks for: the written competency is not a way of writing the spoken one, and holding one grants nothing of the other. No separate tradition name is established for it, so none is invented.
