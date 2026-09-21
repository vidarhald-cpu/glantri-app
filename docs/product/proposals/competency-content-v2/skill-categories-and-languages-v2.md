# Proposed player-facing Skill categories and Civilization languages

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with
> Chargen, not projected into canonical content, and does not replace any approved catalogue.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

## Skill categories

Skill categories are **broad, semantically predictable human browse categories**. They describe **what
the competency is**, never where or how it was learned. Two consequences follow, and both are applied
here: placement must be predictable enough that a player looking for a competency guesses the right
category first, and narrow categories must not proliferate — sixteen categories cover all 157
competencies.

`Special access` is therefore removed as a category. It describes how a competency was reached, not what
kind of competency it is: the same Skill reached through a Learning Group and through a direct Profession
route belongs to the same category. The `language` category is preserved and reserved for the spoken and
written competencies below.

Applying this to the runtime enum, `apps/web/src/lib/chargen/chargenBrowse.ts` and
`getPlayerFacingSkillCategoryId({ preferDirectProfession })` is deliberately out of scope for this
content proposal and needs a separate authorized implementation task.

| Category       | Competencies                                                                                                                                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `combat`       | 1-h conc./axe, 1-h edged, 2-h conc./axe, 2-h edged, Bow, Brawling, Crossbow, Dodge, Fencing, Firearms, Lance, Longbow, Mounted Combat, Parry, Polearms, Sling, Throwing                                                                                                                                                                      |
| `covert`       | Conceal Object, Disguise, Document & Credential Forgery, Lockpicking, Pickpocketing, Poisons, Sleight of Hand, Stealth, Streetwise, Trapmaking, Underworld, Warded-Lock Entry                                                                                                                                                                |
| `craft`        | Architecture, Armoring, Baking, Brewing, Carpentry, Cooking, Cordage / Ropemaking, Court Cookery, Distilling, Fibre Working, Food Preservation, Leatherwork, Locksmithing, Masonry, Mining, Pottery, Sailmaking, Sculpture, Shipbuilding, Smelting, Smithing, Tailoring, Visual Art, Weapon Maintenance, Weaponsmithing, Weaving, Winemaking |
| `fieldcraft`   | Animal Handling, Animal Lore, Animal Training, Camouflage, Fishing, Herding, Hunting, Perception, Plant Lore, Survival, Tracking, Trapping, Wayfinding, Weather Lore                                                                                                                                                                         |
| `healing`      | Battlefield Surgery, Bone Setting, Diagnostic Medicine, First Aid, Medicine, Nursing, Obstetrics, Pharmacy, Poison Treatment, Surgery, Veterinary Medicine                                                                                                                                                                                   |
| `high-society` | Courtly Protocol, Heraldry, Politics                                                                                                                                                                                                                                                                                                         |
| `knowledge`    | Alchemy, Astronomy, Cartography, Court Advocacy, Customs, Genealogy, Geography, History, Law, Mathematics, Mechanics, Palaeography & Decipherment, Philosophy, Research, Surveying, Teaching, Translation & Interpretation                                                                                                                   |
| `maritime`     | Celestial Navigation, Chart Navigation, Dead Reckoning, Pilotage, Ropework, Seamanship                                                                                                                                                                                                                                                       |
| `mental`       | Meditation, Mnemonics                                                                                                                                                                                                                                                                                                                        |
| `military`     | Battle Tactics, Battlefield Awareness, Campaign Strategy, Combat Experience, Formation Fighting, Fortification, Military Command, Military Logistics, Military Reconnaissance, Siege Engine Operation, Siege Engineering, Siege Operations                                                                                                   |
| `mystical`     | Astrology, Divination, Omen Reading, Religion, Theology                                                                                                                                                                                                                                                                                      |
| `performance`  | Acting, Dance, Music, Music Composition, Poetry & Literary Composition, Singing, Storytelling                                                                                                                                                                                                                                                |
| `physical`     | Athletics, Climbing, Riding, Running, Swimming                                                                                                                                                                                                                                                                                               |
| `social`       | Deception, Gambling, Insight, Interrogation, Intimidation, Leadership, Oratory                                                                                                                                                                                                                                                               |
| `trade`        | Administration, Animal Husbandry, Appraisal, Banking & Credit, Bargaining, Bookkeeping, Cart Driving, Court Administration, Falconry, Farming, Steppe Remount Training, Trade                                                                                                                                                                |

## Civilization languages

Every canonical Civilization receives a **rollable spoken competency**, and a **rollable written**
competency unless it is explicitly authored as having no written tradition. Written competence is what a
reading roll is made against.

Naming follows the Product Owner ruling: the canonical Glantri name where one is established, and the
appropriate **historical** name where none is. No Glantri name is invented and no linguistic descent is
asserted. The previous revision's invented names are withdrawn — **Kethran, Old Latian, Palace Scyrian,
Kaldan and Aspardic**, and the **Harbour, Hill, Palace, Wedge and Chancery** scripts. Where a written
tradition has an established Glantri language name but no established script name, the competency is named
for the language alone rather than given an invented script.

**Olog is flagged for later correction and deliberately not corrected here:** it appears modelled from a
historical stage somewhat later and more advanced than the intended Glantri Olog society. That is a
separate follow-up, not part of this reconciliation.

| Civilization      | Spoken                 | Written                                     | Replaces          | Needs a Product Owner naming ruling |
| ----------------- | ---------------------- | ------------------------------------------- | ----------------- | ----------------------------------- |
| Scandia           | Spoken Scandian        | Written Scandian in runes                   | —                 | No                                  |
| Iest              | Spoken Common          | Written Common                              | —                 | Yes                                 |
| Thyatis           | Spoken Common          | Written Common                              | —                 | Yes                                 |
| Glantri           | Spoken Common          | Written Common                              | —                 | Yes                                 |
| Scyria            | Spoken Old Common      | Written Old Common                          | —                 | Yes                                 |
| Byzantine Empire  | Spoken Old Common      | Written Old Common                          | —                 | Yes                                 |
| Lankhmar          | Spoken Lankhmaran      | Written Lankhmaran in the Phoenician script | Spoken Phoenician | No                                  |
| Olog              | Spoken Ologian         | Written Ologian in Church Ologian           | —                 | No                                  |
| Mogreb            | Spoken Mogrebi         | Written Mogrebi in Sacred Mogrebi           | —                 | No                                  |
| N'Kolo            | Spoken N'kolian        | Written N'kolian                            | —                 | Yes                                 |
| San Forager Bands | Spoken Tuu             | _authored as having no writing_             | —                 | Yes                                 |
| Scythians         | Spoken Scythian        | _authored as having no writing_             | —                 | No                                  |
| Latial Chiefdoms  | Spoken Old Latin       | Written Old Latin in the Old Italic script  | —                 | No                                  |
| Mycenaean Greece  | Spoken Mycenaean Greek | Written Mycenaean Greek in Linear B         | —                 | No                                  |
| Sumer             | Spoken Sumerian        | Written Sumerian in Cuneiform               | —                 | No                                  |
| Achaemenid Persia | Spoken Old Persian     | Written Imperial Aramaic                    | —                 | No                                  |

### Notes

- **Scandia.** Both names are already Glantri names. Only the missing written competency is added.
- **Iest.** Common is an established Glantri name, so the written competency takes it directly and no script name is invented. The script, register and conventions of the Common written tradition remain an open case in the approved gap report.
- **Thyatis.** Shares the Common written tradition; the same open case applies.
- **Glantri.** Shares the Common written tradition; Old Common remains an authored optional second tongue.
- **Scyria.** Old Common is an established Glantri name and no script name is invented. The Old Common written identity must still be defined without inferring equivalence with Common.
- **Byzantine Empire.** The Civilization name itself is a real-world analogue; renaming it is outside this task's scope.
- **Lankhmar.** Lankhmar is an established Glantri name, so the spoken language takes it directly. The script has no established Glantri name, so it keeps its historical one; the invented Harbour Hand is withdrawn.
- **Olog.** Names already complete in the approved catalogue and carried forward unchanged. FLAGGED FOR LATER CORRECTION, deliberately not corrected here: Olog appears modelled from a historical stage somewhat later and more advanced than the intended Glantri Olog society. That is a separate follow-up.
- **Mogreb.** Already complete in the approved catalogue; carried forward unchanged.
- **N'Kolo.** N'kolian is an established Glantri name, so the written competency takes it directly and the invented Royal N'kolian register is withdrawn. Register and script support remain an open case.
- **San Forager Bands.** No spoken competency exists for this Civilization today; one is added. The Civilization is explicitly authored as having no written tradition. The approved gap report still asks for a precise Tuu identity.
- **Scythians.** No established Glantri name exists, so the historical name stands. The invented Kethran is withdrawn. Authored as having no written tradition.
- **Latial Chiefdoms.** Historical names stand; the invented Old Latian and Hill Script are withdrawn. The written competency is newly added so that a reading roll has something to roll against.
- **Mycenaean Greece.** Historical names stand. The invented Palace Scyrian is withdrawn, and with it the implied descent from Scyria, which was never an established Glantri fact.
- **Sumer.** Historical names stand; the invented Kaldan and Wedge Script are withdrawn. The written competency is Sumerian written in Cuneiform specifically — the approved gap report's refusal of a universal Cuneiform competence is respected, because the competency is tied to one language.
- **Achaemenid Persia.** Historical names stand; the invented Aspardic and Chancery Script are withdrawn. The spoken tongue and the chancery written tradition are deliberately different languages here, which is what the approved gap report asks for: the written competency is not a way of writing the spoken one.
