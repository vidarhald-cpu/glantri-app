# Proposed player-facing Skill categories and Civilization languages

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with
> Chargen, not projected into canonical content, and does not replace any approved catalogue.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

## Skill categories

`Special access` is removed as a category. It describes how a competency was reached, not what kind
of competency it is: the same Skill reached through a Learning Group and through a direct Profession
route belongs to the same category. The `language` category is preserved and reserved for the spoken
and written competencies below.

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

Every canonical Civilization receives a spoken competency, and a written one unless it is explicitly
authored as having no written tradition. Real-world analogue names are replaced by Glantri names.

| Civilization      | Spoken                | Written                                        | Replaces                                                   | Needs a Product Owner naming ruling |
| ----------------- | --------------------- | ---------------------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| Scandia           | Spoken Scandian       | Written Scandian in Runic Scandian             | —                                                          | No                                  |
| Iest              | Spoken Common         | Written Common in the Common Hand              | —                                                          | Yes                                 |
| Thyatis           | Spoken Common         | Written Common in the Common Hand              | —                                                          | Yes                                 |
| Glantri           | Spoken Common         | Written Common in the Common Hand              | —                                                          | Yes                                 |
| Scyria            | Spoken Old Common     | Written Old Common in the Old Common Hand      | —                                                          | Yes                                 |
| Byzantine Empire  | Spoken Old Common     | Written Old Common in the Old Common Hand      | —                                                          | Yes                                 |
| Lankhmar          | Spoken Lankhmaran     | Written Lankhmaran in the Harbour Hand         | Spoken Phoenician; Written Phoenician in Phoenician script | No                                  |
| Olog              | Spoken Ologian        | Written Ologian in Church Ologian              | —                                                          | No                                  |
| Mogreb            | Spoken Mogrebi        | Written Mogrebi in Sacred Mogrebi              | —                                                          | No                                  |
| N'Kolo            | Spoken N'kolian       | Written N'kolian in Royal N'kolian             | —                                                          | Yes                                 |
| San Forager Bands | Spoken Tuu            | _authored as having no writing_                | —                                                          | Yes                                 |
| Scythians         | Spoken Kethran        | _authored as having no writing_                | Spoken Scythian                                            | Yes                                 |
| Latial Chiefdoms  | Spoken Old Latian     | Written Old Latian in the Hill Script          | Spoken Old Latin; Old Italic                               | Yes                                 |
| Mycenaean Greece  | Spoken Palace Scyrian | Written Palace Scyrian in the Palace Syllabary | Spoken Mycenaean Greek; Linear B                           | Yes                                 |
| Sumer             | Spoken Kaldan         | Written Kaldan in the Wedge Script             | Spoken Sumerian; Cuneiform                                 | Yes                                 |
| Achaemenid Persia | Spoken Aspardic       | Written Aspardic in the Chancery Script        | Spoken Old Persian; Imperial Aramaic                       | Yes                                 |

### Notes

- **Scandia.** Both names are already Glantri names. Only the missing written competency is added.
- **Iest.** The script, register and conventions of the Common written tradition remain an open case in the approved gap report.
- **Thyatis.** Shares the Common written tradition; the same open case applies.
- **Glantri.** Shares the Common written tradition; Old Common remains an authored optional second tongue.
- **Scyria.** The Old Common written identity must be defined without inferring equivalence with Common.
- **Byzantine Empire.** The Civilization name itself is a real-world analogue; renaming it is outside this task's scope.
- **Lankhmar.** Clear correction: the Civilization is already a Glantri name, so the language takes it directly.
- **Olog.** Already complete in the approved catalogue; carried forward unchanged.
- **Mogreb.** Already complete in the approved catalogue; carried forward unchanged.
- **N'Kolo.** Glantri names already; the written tradition's register and script support remain an open case.
- **San Forager Bands.** No spoken competency exists for this Civilization today; one is added. The Civilization is explicitly authored as having no written tradition. The approved gap report still asks for a precise Tuu identity.
- **Scythians.** Candidate name only. The Civilization name is itself a real-world analogue, so the language cannot be finally named until the Civilization is. Authored as having no written tradition.
- **Latial Chiefdoms.** Candidate names only; the Civilization name is itself a real-world analogue.
- **Mycenaean Greece.** Candidate names only. The proposed tie to Scyria is a suggestion about descent, not an established Glantri fact, and needs a ruling.
- **Sumer.** Candidate names only. The approved gap report explicitly refuses a universal Cuneiform competence; the language and tradition behind the script still need authoring.
- **Achaemenid Persia.** Candidate names only. Language, script and administrative written tradition must still be separated with explicit evidence, as the approved gap report requires.
