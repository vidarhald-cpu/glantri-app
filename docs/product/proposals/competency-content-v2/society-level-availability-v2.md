# Society Level and Social Band route availability (V2)

> **Status: CANONICAL — accepted by the Product Owner on 2026-09-23 (Forgejo #250).**
> See [decision record 0008](../../../decisions/rules/0008-competency-content-v2-canonical-acceptance.md).
> Generated from `packages/content/src/proposals/competencyContentV2/`. #306 projects the
> canonical mechanics into runtime content. Chargen conformance is #251; presentation is #252.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

This report is the authored answer to the one question the settled availability model left open:
**which individual routes a low Society Level withholds.** The model itself is settled and is not
revisited here. What is authored is where each bound sits, and the consequence is measured rather
than asserted.

## Scope of this pass

Only the **Society Level 1-2 boundary** is authored, together with the Social Band bounds that bite
inside it. A `minSocietyLevel` of 3 therefore means exactly "not at Society Level 1 or 2"; whether
the true floor is 3, 4, 5 or 6 is a later pass's decision, and the build refuses a higher bound so
the wider claim cannot be smuggled in here. For the same reason a Social Band bound is authored only
on a route that still exists at Society Level 1 or 2 — which is why the grid below is coarser above
the boundary than beneath it.

## What the bounds are authored against

`canonicalContent.json` already records, per society and per Social Band, which bodies of training
that cell reaches. Read back, it gives four tiers and nothing else:

| Tier                        | Society Level | Social Band               |
| --------------------------- | ------------: | ------------------------- |
| Available everywhere        |             1 | L1 Common Folk            |
| Trades and Guilds tier      |             2 | L2 Trades and Guilds      |
| Established Households tier |             3 | L3 Established Households |
| Court and Elite tier        |             4 | L4 Court and Elite        |

Two facts in that grid do real work here. The Society Level 1 society reaches the same set at
**every** band — it has no trade, household or court stratum whose training differs — and a Society
Level 2 society's ladder **stops at the trades tier**. Both reproduce below, from independently
authored bounds rather than by construction.

The grid is also coarser than this catalogue, and it disagrees with the route model in two places.
The **Product Owner ruling of 2026-09-22 on #266 settles which wins**: the Content V2 route model is
authoritative, and the grid may be used as evidence and for the general shape of a restriction but
must not override explicit approved route semantics. The grid is therefore used as corroboration for
the **shape** of a restriction, never as per-group authority, and each disagreement is recorded
below as a settled divergence rather than an open question.

### Settled divergences from the older access grid

#### Scholarly, legal, fiscal, mercantile and ship-command training at the Society Level 1 Common Folk cell

**The older grid.** `societyBandSkillAccess` in `canonicalContent.json` admits it there. Its base
set is a flat legacy import applied to every society, not an authored statement about what a Society
Level 1 society actually teaches.

**Content V2.** Withheld. K01, K02, K07, K21, F12, F13, F11 and G12 carry their own minimums, each
with an authored reason about the institution or technology the society does not have.

**Settled.** The Product Owner ruling of 2026-09-22 on #266 gives the route model authority.
Scholarly, legal, fiscal, mercantile and ship-command access is NOT restored at Society Level 1
merely because the grid permits it. The grid supplied the shape of the four tiers and nothing more.

**Later reconciliation.** Other implementation may still consume `societyBandSkillAccess` directly.
Where it does, the grid's Society Level 1 base set will disagree with this model and must be
reconciled against it in a later pass; nothing in this proposal rewrites the grid.

#### Whether a society below Society Level 3 writes at all

**The older grid.** The canonical `literacy` Skill records `societyLevel: 3`, and read as a
statement about societies rather than about that one generic training route it says no society below
Society Level 3 reads or writes.

**Content V2.** Latial Chiefdoms is a Society Level 2 Civilization whose canonical record carries
the written language Old Italic, and whose written competency is authored here. It is reachable at
Society Level 2.

**Settled.** The Product Owner ruling of 2026-09-22 on #266 holds that Latial Chiefdoms remains a
writing-capable Society Level 2 Civilization using Old Italic. A generic Literacy Skill or training
route may keep its own Society Level restriction — G11, K16 and F15 keep theirs — but that
restriction must not suppress a Civilization's explicitly authored written-language competency. The
two are separate things and are modelled separately.

**Later reconciliation.** Other implementation may still read `skills.literacy.societyLevel` as a
universal gate on written competence. Where it does, it will disagree with the Civilization-owned
written competencies and must be reconciled against them later; the generic Skill's own floor is not
changed here.

## The grid

Each cell counts what a learner in that society and that stratum can actually reach: Learning Groups
whose own bound the cell meets, Professions with at least one satisfiable core route, and base Skills
reached by the **union** of every valid route.

| Society Level | Social Band               | Learning Groups | Professions | Valid paths | Base Skills reached |
| ------------: | ------------------------- | --------------: | ----------: | ----------: | ------------------: |
|             1 | L1 Common Folk            |              45 |          42 |          42 |                  82 |
|             1 | L2 Trades and Guilds      |              45 |          42 |          42 |                  82 |
|             1 | L3 Established Households |              45 |          42 |          42 |                  82 |
|             1 | L4 Court and Elite        |              45 |          42 |          42 |                  82 |
|             2 | L1 Common Folk            |              57 |          50 |          52 |                  98 |
|             2 | L2 Trades and Guilds      |              73 |          63 |          65 |                 112 |
|             2 | L3 Established Households |              73 |          63 |          65 |                 112 |
|             2 | L4 Court and Elite        |              73 |          63 |          65 |                 112 |
|             3 | L1 Common Folk            |              79 |          71 |          73 |                 121 |
|             3 | L2 Trades and Guilds      |              95 |          84 |          86 |                 132 |
|             3 | L3 Established Households |              95 |          84 |          86 |                 132 |
|             3 | L4 Court and Elite        |              95 |          84 |          86 |                 132 |
|             4 | L1 Common Folk            |              79 |          71 |          73 |                 121 |
|             4 | L2 Trades and Guilds      |              95 |          84 |          86 |                 132 |
|             4 | L3 Established Households |              95 |          84 |          86 |                 132 |
|             4 | L4 Court and Elite        |              95 |          84 |          86 |                 132 |
|             5 | L1 Common Folk            |              79 |          71 |          73 |                 121 |
|             5 | L2 Trades and Guilds      |              95 |          84 |          86 |                 132 |
|             5 | L3 Established Households |              95 |          84 |          86 |                 132 |
|             5 | L4 Court and Elite        |              95 |          84 |          86 |                 132 |
|             6 | L1 Common Folk            |              79 |          71 |          73 |                 121 |
|             6 | L2 Trades and Guilds      |              95 |          84 |          86 |                 132 |
|             6 | L3 Established Households |              95 |          84 |          86 |                 132 |
|             6 | L4 Court and Elite        |              95 |          84 |          86 |                 132 |

## Inherent Learning Group minimums

45 of the 95 proposed Learning Groups carry no bound at all and are available at Society Level 1,
Social Band L1. 28 first exist at Society Level 2, and 22 do not exist at Society Level 1 or 2.

A bound is authored here only where **the training itself** genuinely requires it. Two shapes are
used: a Society Level alone, where the society must have the thing but the training is then ordinary
work at any band; and a Society Level with a Social Band, where the training also belongs to a
stratum.

| Group | Name                                      | Society Level | Social Band | Canonical tier         | Why the training requires it                                                                                                                                                                                                                                                                                          |
| ----- | ----------------------------------------- | ------------: | ----------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01   | General artisan apprenticeship            |             2 | L2          | Trades and Guilds tier | The general artisan apprenticeship is market craft: it charges Appraisal and Bargaining because the apprentice is being placed in a trade. That is the canonical Trades and Guilds stratum, and it exists from Society Level 2.                                                                                       |
| C02   | Master artisan practice                   |             2 | L2          | Trades and Guilds tier | A master's shop taking apprentices is the guild tier of the same trade.                                                                                                                                                                                                                                               |
| C07   | Mine and quarry apprenticeship            |             2 | L2          | Trades and Guilds tier | Worked mine and quarry workings are an organised extraction trade with a face to keep open. Prospecting is not this practice.                                                                                                                                                                                         |
| C09   | Sail and canvas workshop                  |             2 | L2          | Trades and Guilds tier | A sail and canvas loft exists only where there are rigged vessels to canvas.                                                                                                                                                                                                                                          |
| C11   | Vineyard and winemaking practice          |             2 | L2          | Trades and Guilds tier | A vineyard is a standing planted holding worked as a trade over years.                                                                                                                                                                                                                                                |
| C13   | Lock and mechanism workshop               |             2 | L2          | Trades and Guilds tier | Locks and their working parts are metal trade work, and presuppose fixed premises with something worth locking.                                                                                                                                                                                                       |
| C14   | Trap and device workshop                  |             2 | L1          | level only             | A constructed trap-and-device practice is mechanism work, under the same requirement as the timber mechanism trade beside it. Setting a snare on a trapline is a different route and is not restricted.                                                                                                               |
| C15   | Alchemical workshop practice              |             3 | L1          | level only             | An alchemical tradition and the furnished workshop it is practised in.                                                                                                                                                                                                                                                |
| F01   | Field surveying and map production        |             3 | L1          | level only             | Map production from measured ground.                                                                                                                                                                                                                                                                                  |
| F03   | Timber vessel construction                |             2 | L2          | Trades and Guilds tier | A yard laying down vessels is a timber trade with the yard behind it.                                                                                                                                                                                                                                                 |
| F06   | Draught-team and vehicle practice         |             2 | L1          | level only             | A draught team and a wheeled vehicle are a settled society's equipment. Below Society Level 2 there is neither the kept team nor the vehicle the practice is about.                                                                                                                                                   |
| F09   | Rigged-vessel deck apprenticeship         |             2 | L1          | level only             | A rigged vessel is a built ship with standing and running rigging. Below Society Level 2 there is nothing rigged to serve aboard. Open-boat working is a separate route and is not restricted.                                                                                                                        |
| F11   | Charted open-water navigation practice    |             3 | L1          | level only             | Charted passage work requires charts and the conventions they are read by.                                                                                                                                                                                                                                            |
| F12   | Credit-house accounts and obligations     |             3 | L1          | level only             | A credit house lends against written obligation that outlives the handshake.                                                                                                                                                                                                                                          |
| F13   | Legal study and pleading practice         |             3 | L1          | level only             | Pleading presupposes a standing forum and a stated legal system. Customary settlement is reached through council and mediation practice, which is not restricted.                                                                                                                                                     |
| F15   | Historical text investigation             |             3 | L1          | level only             | There is no standing corpus of older record, and no scholarly practice of investigating one. This is a bound on the study route, not a claim that nobody below writes: Latial Chiefdoms writes Old Italic at Society Level 2, and its written competency is reached through the Civilization, not through this route. |
| F23   | Distilling remedy workshop                |             3 | L1          | level only             | The still is equipment a society has to be able to make and keep.                                                                                                                                                                                                                                                     |
| F24   | Ironmaking and forge apprenticeship       |             2 | L1          | level only             | Ore furnace and forge work is taught at a furnace and a forge. The Society Level 1 forager and ritual-tribal society runs none, so the practice has nothing to be taught at. From Society Level 2 it is ordinary work at every band: the common folk who keep the furnace are the people who learn it.                |
| F25   | Weapon-forge and servicing apprenticeship |             2 | L2          | Trades and Guilds tier | Weapon forging and servicing is the same metal trade, specialised.                                                                                                                                                                                                                                                    |
| F26   | Forged-metal armor workshop               |             2 | L2          | Trades and Guilds tier | Forged defences are the same metal trade, specialised. Hide and strap defences are reached through the leather workshop, which is not restricted.                                                                                                                                                                     |
| F27   | Timber millwright apprenticeship          |             2 | L1          | level only             | Timber mechanism work is the making and keeping of machines — mill gear, windlass, lifting frame — and needs a society that builds them. Ordinary woodwork is not this practice.                                                                                                                                      |
| F28   | Building design and site surveying        |             2 | L2          | Trades and Guilds tier | Designed building, and the setting out that goes with it, is a building trade. Stone working itself is deliberately NOT restricted: the Society Level 1 society's own canonical reference is a megalithic monument.                                                                                                   |
| F29   | Field surgical apprenticeship             |             2 | L1          | level only             | A field surgical apprenticeship is learned where an organised force carries its wounded back to an operator. Society Level 1 fighting is not organised that way. Ordinary operative care is a separate route and is not restricted.                                                                                   |
| F33   | Concealed field reconnaissance practice   |             2 | L2          | Trades and Guilds tier | Reconnaissance reported for military decisions requires a force that makes them and a scouting arm it keeps.                                                                                                                                                                                                          |
| G05   | Mounted travel and animal care            |             2 | L1          | level only             | Riding is taught on kept riding stock. The Society Level 1 forager and ritual-tribal society keeps none, so the practice has nothing to be taught on. From Society Level 2 it is ordinary work at every band: a pastoral clan's common folk ride.                                                                     |
| G07   | Passage navigation                        |             2 | L1          | level only             | Entrusted passage work presupposes regular voyages somebody is answerable for. Below Society Level 2 there is no such traffic to be entrusted with.                                                                                                                                                                   |
| G09   | Unit coordination and command practice    |             2 | L2          | Trades and Guilds tier | Command over an organised unit requires both the unit and the standing to be given it.                                                                                                                                                                                                                                |
| G11   | Records-office practice                   |             3 | L1          | level only             | A records office is a standing bureaucracy keeping written record.                                                                                                                                                                                                                                                    |
| G12   | Trading practice                          |             2 | L2          | Trades and Guilds tier | Trading practice is a merchant's apprenticeship in a market. Petty carrying and exchange are not this training.                                                                                                                                                                                                       |
| G15   | Covert entry practice                     |             2 | L2          | Trades and Guilds tier | Covert entry is taught against locks and fastenings, and follows the lock trade that makes them.                                                                                                                                                                                                                      |
| K01   | Scholarly study practice                  |             3 | L1          | level only             | Scholarly study as a standing practice with a body of record behind it.                                                                                                                                                                                                                                               |
| K02   | Natural philosophy practice               |             3 | L1          | level only             | A philosophical school with a tradition to argue within.                                                                                                                                                                                                                                                              |
| K03   | Celestial observation practice            |             3 | L1          | level only             | Observation reduced by learned mathematical method. Watching the sky is not this practice.                                                                                                                                                                                                                            |
| K04   | Astrological reading practice             |             3 | L1          | level only             | A learned astrological tradition with a doctrine to read against.                                                                                                                                                                                                                                                     |
| K07   | Instruction and schooling practice        |             3 | L1          | level only             | Schooling as an establishment somebody is apprenticed into. Instruction inside a trade or a household is not this practice.                                                                                                                                                                                           |
| K09   | Chorographic and geographic study         |             3 | L1          | level only             | Chorography assembled and drawn as maps.                                                                                                                                                                                                                                                                              |
| K10   | Heraldic office practice                  |             3 | L1          | level only             | There is no heraldic office, and no armorial system for one to keep.                                                                                                                                                                                                                                                  |
| K11   | Court service practice                    |             3 | L1          | level only             | There is no court to serve inside.                                                                                                                                                                                                                                                                                    |
| K12   | Naturalist field study                    |             3 | L1          | level only             | Naturalist field study is a standing comparative practice against a collection and a record. Knowing plants and animals is reached through ordinary field routes, which are not restricted.                                                                                                                           |
| K16   | Documentary hand practice                 |             3 | L1          | level only             | Documentary hands, credentials and older writing presuppose a documentary culture to imitate.                                                                                                                                                                                                                         |
| K21   | Applied calculation practice              |             3 | L1          | level only             | Applied calculation is kept accounts and measured ground reduced to figures.                                                                                                                                                                                                                                          |
| M03   | Formation arms drill                      |             2 | L1          | level only             | Close-order drill exists only where there is a close-order force to drill. This is the settled model's own worked example of a curriculum that simply is not there.                                                                                                                                                   |
| M04   | Military missile and formation practice   |             2 | L1          | level only             | Issued missile arms drilled in formation require the same formed force as close-order drill.                                                                                                                                                                                                                          |
| M06   | Campaign service experience               |             2 | L1          | level only             | Campaign service is repeated exposure with a force in the field over a campaign. Below Society Level 2 there is raiding, not campaigning. Coercive service remains the other authored route to Combat Experience and is not restricted, so the competence itself is not withdrawn.                                    |
| M07   | Campaign staff practice                   |             3 | L1          | level only             | Campaign staff work is written logistics and administration behind a force.                                                                                                                                                                                                                                           |
| M08   | Siege works practice                      |             3 | L1          | level only             | Siege works are built against fortified places, which have to exist first.                                                                                                                                                                                                                                            |
| M09   | Siege engine crew practice                |             3 | L1          | level only             | Siege engines have to be built and kept before a crew can be trained on them.                                                                                                                                                                                                                                         |
| M10   | Arms instruction practice                 |             2 | L2          | Trades and Guilds tier | Formal arms instruction charged together with weapon upkeep belongs to the same metal-arms trade.                                                                                                                                                                                                                     |
| M11   | Mounted combat practice                   |             2 | L1          | level only             | Fighting from the saddle requires kept riding stock, exactly as mounted travel does.                                                                                                                                                                                                                                  |
| M12   | Mounted lance and formation drill         |             2 | L2          | Trades and Guilds tier | Lance and troop drill requires kept mounts and a formed troop together.                                                                                                                                                                                                                                               |

## Profession route restrictions

The narrower tool, preferred wherever the restriction is specific to the occupational context: the
curriculum exists here, but this occupation cannot reach it by this road. Each entry is one the
group's own bound does not already cover.

| Profession                    | Into | Society Level | Social Band | Why                                                                                                                                                                                                               |
| ----------------------------- | ---- | ------------: | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P03 Field and Caravan Guide   | F06  |             2 | L2          | Caravan service is the trading stratum's carrying, not simply driving a team. The team-and-vehicle practice itself stays available to common folk from Society Level 2.                                           |
| P06 Herd Keeper               | F02  |             2 | L1          | The herd keeper works the clip off her own stock, and there is no kept clip below Society Level 2. The fibre-to-cloth trade itself is not restricted, so the competence is not withdrawn — only this way into it. |
| P14 Guard, Watcher and Escort | G04  |             2 | L1          | Escort duty away from the town needs the town and the traffic between towns. The guard's own watch and guard instruction is not restricted, so a Society Level 1 village guard is still a Guard.                  |
| P22 Soldier                   | G04  |             2 | L1          | Marching and camping with the force requires the force. A Society Level 1 soldier keeps her contingent fighting core and learns field living by another road.                                                     |

## Direct route restrictions

A direct route grants everything it lists as one route, so restricting it withdraws the whole grant.
Each is therefore authored only where the **whole** grant belongs above the boundary. Every Skill a
restriction withdraws is then either still reached by another route at that level, or is itself an
absence recorded and argued below — nothing disappears unaccounted for.

| Profession                     | Society Level | Social Band | Why                                                                                                                                                                                         |
| ------------------------------ | ------------: | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P10 Navigator and Pilot        |             3 | L1          | The pilot's direct teaching is chartwork and calculation, which belong to a charted, reckoning tradition. Entrusted passage work itself remains the Navigator's route from Society Level 2. |
| P13 Trader and Merchant        |             3 | L1          | The counting house's direct teaching is calculation kept in figures. Below that the trader still learns her trade; she learns it without the arithmetic.                                    |
| P25 Military Commander         |             3 | L1          | The commander's direct teaching is set-piece speech and siege operations, which belong with the siege practice it names. Command itself remains the Military Commander's core route.        |
| P48 Millwright and Mechanician |             3 | L1          | Calculation and measured setting out, neither of which the mill trade itself requires.                                                                                                      |
| P49 Building Designer          |             3 | L1          | Calculation, office administration and fortification, none of which the design apprenticeship itself supplies.                                                                              |
| P60 Envoy                      |             3 | L1          | Courtly protocol and a stated legal system require the court and the code. Ordinary negotiation practice remains the Envoy's core route, so an envoy exists without either.                 |
| P83 Gambler                    |             3 | L1          | Calculation at the tables is learned method, not the play itself. The gaming-house practice is not restricted.                                                                              |

## Flagged route gaps

A route gap is a Skill that **plausibly belongs** at a low Society Level, but whose every authored
route happens to require more. The settled model requires these to be flagged rather than treated as
statements about the Skill, and explicitly forbids adding routes to close them — that would be adding
routes to hit a coverage target, which is the thing the ruling rules out. Each flag is checked against
the computed availability, so a flag that goes stale fails the build.

8 are flagged.

### Camouflage — no route at Society Level 1

Concealing oneself against the ground is a hunter's competence, and hunting is the Society Level 1 society's own work.

- F33 Concealed field reconnaissance practice — the catalogue's only route to Camouflage, and it is military reconnaissance, closed below the trades tier

### Leadership — no route at Society Level 1

A band has a leader, and a Society Level 1 society is made of bands.

- G09 Unit coordination and command practice — closed below the trades tier, because military command needs the unit
- P11 Shipmaster's direct teaching — the Shipmaster's own core route needs a rigged vessel, so the Profession does not exist here to teach it

### Politics — no route at Society Level 2

An early agrarian chiefdom has factions, standing and collective decisions, which is what the competence is about. The flag is raised at Society Level 2 rather than 1 because that is where the institutions the competence describes first exist.

- K11 Court service practice — the catalogue's only route to Politics, and it needs a court

### Teaching — no route at Society Level 1

Explaining, demonstrating and correcting is how every competence in an oral society is passed on at all.

- K07 Instruction and schooling practice — schooling as an establishment
- C02 Master artisan practice — the guild tier of a trade
- M10 Arms instruction practice — the metal-arms trade

### Trade — no route at Society Level 1

Bands exchange, and the canonical Society Level 1 occupation roster carries a Peddler. The competence is the organisation of exchange, not the merchant's establishment.

- G12 Trading practice — the catalogue's only route to Trade, and it is a merchant's apprenticeship in a market

### Trapmaking — no route at Society Level 1

A deadfall and a snare are constructed traps, and building them is forager work. The Trapping competence beside it IS reachable here, through the trapline route, which makes the split look accidental rather than authored.

- C14 Trap and device workshop — the catalogue's only route to Trapmaking, and it is closed because the same group teaches Mechanics, which is genuinely absent here

### Throwing — no route at Society Level 1

The thrown spear is the oldest weapon the catalogue carries.

- M02 Advanced close-combat weapon practice and M05 Advanced missile practice — both reachable only through the Weapon Instructor, whose core arms-instruction route is closed below the trades tier
- M03 Formation arms drill — needs a formed force

### Weapon Maintenance — no route at Society Level 1

Keeping one's own weapons serviceable is not a trade, and a Society Level 1 fighter has weapons.

- F25 Weapon-forge and servicing apprenticeship and M10 Arms instruction practice — the metal-arms trade
- M04 Military missile and formation practice and M09 Siege engine crew practice — need a formed force and siege engines respectively

## Every Skill absent at Society Level 1, accounted for

51 of the 133 base Skills have no route at Society Level 1. The set is asserted exactly, so the
authored consequence of this pass cannot drift, and each entry is either a **deliberate** statement
about the society or a flagged **route gap**.

| Skill                         | Disposition |
| ----------------------------- | ----------- |
| Alchemy                       | deliberate  |
| Astrology                     | deliberate  |
| Astronomy                     | deliberate  |
| Banking & Credit              | deliberate  |
| Battlefield Awareness         | deliberate  |
| Camouflage                    | route-gap   |
| Military Command              | deliberate  |
| Crossbow                      | deliberate  |
| Formation Fighting            | deliberate  |
| Heraldry                      | deliberate  |
| Lance                         | deliberate  |
| Mathematics                   | deliberate  |
| Mechanics                     | deliberate  |
| Mounted Combat                | deliberate  |
| Philosophy                    | deliberate  |
| Administration                | deliberate  |
| Architecture                  | deliberate  |
| Bookkeeping                   | deliberate  |
| Campaign Strategy             | deliberate  |
| Cart Driving                  | deliberate  |
| Cartography                   | deliberate  |
| Celestial Navigation          | deliberate  |
| Chart Navigation              | deliberate  |
| Dead Reckoning                | deliberate  |
| Distilling                    | deliberate  |
| Document & Credential Forgery | deliberate  |
| Firearms                      | deliberate  |
| Leadership                    | route-gap   |
| Lockpicking                   | deliberate  |
| Locksmithing                  | deliberate  |
| Military Logistics            | deliberate  |
| Military Reconnaissance       | deliberate  |
| Mining                        | deliberate  |
| Palaeography & Decipherment   | deliberate  |
| Pilotage                      | deliberate  |
| Poisons                       | deliberate  |
| Politics                      | route-gap   |
| Riding                        | deliberate  |
| Sailmaking                    | deliberate  |
| Shipbuilding                  | deliberate  |
| Siege Engine Operation        | deliberate  |
| Siege Engineering             | deliberate  |
| Smelting                      | deliberate  |
| Smithing                      | deliberate  |
| Teaching                      | route-gap   |
| Trade                         | route-gap   |
| Trapmaking                    | route-gap   |
| Winemaking                    | deliberate  |
| Battle Tactics                | deliberate  |
| Throwing                      | route-gap   |
| Weapon Maintenance            | route-gap   |

## Cores and paths under restriction

Every one of the 86 valid paths still satisfies an applicable core route somewhere, which the build
asserts: a Profession that existed nowhere would fail rather than ship. A society that supports none
of a Profession's core routes simply does not support that Profession, which is the model working
rather than a defect.

**P65 Scribe and Copyist** is the case to watch, because its core is G11 plus a free choice over the
written-language set rather than a named group. G11 is a records office, which does not exist at
Society Level 1 or 2, so the Scribe first exists at Society Level 3, band L1 — at 16 of the 24 cells
in all. The written-language choice is satisfied from the written competencies reachable **at that
cell**, and the build checks each one directly: the thinnest of them still offers 4 written
competencies against a core choice of one. Checking it at the cell matters, because a written
competency suppressed by a literacy route's bound would surface here as an unexplained core failure
rather than as an obvious routing one.

## Written-language competency availability

A Civilization's own written language and a generic literacy training route are two different
things, and the Product Owner ruling of 2026-09-22 on #266 keeps them apart: a generic Literacy
Skill or training route may keep its own Society Level restriction, but that restriction must not
suppress a Civilization's explicitly authored written-language competency. G11, K16 and F15
therefore keep their own floors, and none of them stands between a learner and the writing their own
Civilization does.

Each written competency's floor is consequently the Society Level of the Civilization that writes
it, read back from `canonicalContent.json` rather than authored here. **Latial Chiefdoms writes Old
Italic at Society Level 2**, so its written competency is reachable at Society Level 2, at every
band — below the generic `literacy` Skill's own canonical Society Level 3, which is exactly the
separation the ruling requires.

| Written competency                      | Society Level | Written by                         |
| --------------------------------------- | ------------: | ---------------------------------- |
| Written Common                          |             4 | Iest (6), Thyatis (5), Glantri (4) |
| Written Imperial Aramaic                |             4 | Achaemenid Persia (4)              |
| Written Mogrebi in Sacred Mogrebi       |             3 | Mogreb (3)                         |
| Written Mycenaean Greek in Linear B     |             3 | Mycenaean Greece (3)               |
| Written N'kolian in Royal N'kolian      |             4 | N'Kolo (4)                         |
| Written Old Common                      |             5 | Scyria (5), Byzantine Empire (5)   |
| Written Old Latin in Old Italic         |             2 | Latial Chiefdoms (2)               |
| Written Ologian in Church Ologian       |             5 | Olog (5)                           |
| Written Phoenician in Phoenician script |             5 | Lankhmar (5)                       |
| Written Scandian in Runic Scandian      |             4 | Scandia (4)                        |
| Written Sumerian in Cuneiform           |             3 | Sumer (3)                          |

11 written competencies in all, none of them lost: every one is reachable at the widest cell, and
each is reachable at exactly the Society Levels at or above its own Civilization's. The counts per
cell are 1: 0, 2: 1, 3: 4, 4: 8, 5: 11, 6: 11.

## Specializations whose parent is not reached under restriction

None, at any cell. A restricted path never offers a Specialization whose parent Skill that same path
no longer reaches.
