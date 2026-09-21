# Secondary Critical `Sec` grammar reconciliation

Status: rules/content reconciliation candidate from Forgejo #223; non-runtime

Authority: [Rule decision 0006](../decisions/rules/0006-secondary-critical-resolution.md) and the
bounded read-only source recovery recorded on Forgejo #223

Portfolio: Forgejo #111 Criticals / Injury

## Purpose and boundary

[Rule decision 0006](../decisions/rules/0006-secondary-critical-resolution.md) settled that
Secondary Critical capability is weapon-authored through the `Sec` field, that the Secondary grade
is a fixed relative reduction from the resolved Primary grade, that a result below `A` produces no
Secondary Critical, and that the Secondary Critical uses a fresh independent 2d8. It explicitly
deferred the `Sec` grammar itself. This document completes that deferred reconciliation from the
evidence already recovered.

This document is documentation only.

- It authorizes no runtime work: no schema, evaluator, parser, resolution path, routing change, or
  user-facing behavior follows from it.
- It does not alter the 608 primary Critical catalogue described in
  [Target Critical catalogue V1](./target-critical-catalogue-v1.md). A Secondary Critical performs a
  second lookup against existing positions; it never adds, removes, or rewrites one.
- It does not reopen the three settled rulings in decision 0006.
- Where the sources cannot settle a question, it records the competing readings and returns the
  question to the Product Owner rather than choosing between them. See
  [Open Product Owner questions](#open-product-owner-questions).

The `Sec` column description in
[Combat loadout calculations](./combat-loadout-calculations.md) remains a data-column gloss. Rule
authority stays with decision 0006; this document is its grammar reconciliation.

## Evidence base

Primary evidence is `data/raw/glantri/Themistogenes 1.07.xlsx`, sheet `Weapon1`. Supporting evidence
is `docs/source/combat/New_Combat_Arena.xlsx`, sheet `cleon vs slaver`.

Header row `Weapon1!A1:Q1` gives the field layout:

| Column | `Weapon1` row 1 header |
| ------ | ---------------------- |
| `K`    | `Arm.mod.1`            |
| `L`    | `Arm.mod.2`            |
| `M`    | `Crit 1`               |
| `N`    | `Crit 2`               |
| `O`    | `Enc.`                 |
| `P`    | `Defencive`            |
| `Q`    | `Second crit.`         |

`Weapon1!Q` is the `Sec` field. `Weapon1!N` (`Crit 2`) is the alternate attack mode's Critical code
and is paired with `OB 2` (`Weapon1!F1`), `DMB 2` (`Weapon1!G1`), and `Arm.mod.2` (`Weapon1!L1`). It
is never a Secondary Critical, which decision 0006 §1 records.

`Weapon1!Q` is inert in the source. No formula in the workbook reads it. The widest weapon-table
ranges any formula uses stop at column `P`:

- `Calculations!AI17 = DGET(Weapon1!A:P,16,$B16:$B17)`
- `Calculations!C17 = DGET(Weapon1!$A$1:$O$48,2,$B16:$B17)`
- `Calculations!N17 = DGET(Weapon1!A:O,13,$B16:$B17)` (column `M`, `Crit 1`)
- `Calculations!O17 = DGET(Weapon1!A:O,14,$B16:$B17)` (column `N`, `Crit 2`)
- `Calculations!F70 = VLOOKUP(C70,Weapon1!A1:P99,16,false)`
- `'Character sheet entry'!O10 = VLOOKUP(I10,Weapon1!A$1:P$100,15,false)`

Column `Q` is the seventeenth column and falls outside every one of them. **No source arithmetic
consumes `Sec`**, so no source formula can settle how a `Sec` code resolves. Everything below is
read from the authored values and their relationship to the authored `Crit 1` values.

The `Crit 1` code's grade letter is a **maximum** grade in the source:

- `Game sheet!F31 = "Max Critical"` labels the value obtained by `Calculations!N17` from `Weapon1!M`,
  and `Game sheet!J31 = "Max Critical2"` labels the `Crit 2` value from `Weapon1!N`.
- `'cleon vs slaver'!C130 = (left(R10,1))`, labelled `B130 = "Max critical"`, takes the first
  character of the selected weapon's MC code, and
  `'cleon vs slaver'!C131 = IF(C129<>"", IF(CODE(C130)<code(C129),C130,C129),"")` keeps the
  alphabetically lower of the attack's table grade and that first character.

A weapon's `Crit 1` grade letter is therefore the ceiling on the grade any attack with that weapon
can resolve at.

## 1. Code vocabulary

`Weapon1!Q` is populated in exactly twelve rows. Every populated value is exactly two characters
with no whitespace, qualifier, or sentinel.

| Row | `Weapon1!A` weapon | `Weapon1!C` prime attack | `Weapon1!M` `Crit 1` | `Weapon1!N` `Crit 2` | `Weapon1!Q` `Sec` |
| --- | ------------------ | ------------------------ | -------------------- | -------------------- | ----------------- |
| 15  | Morning star       | Strike                   | `FC`                 | (blank)              | `AP`              |
| 18  | Hatchet            | Strike                   | `DS`                 | (blank)              | `AC`              |
| 19  | Wood axe           | Strike                   | `ES`                 | (blank)              | `AC`              |
| 20  | Hand axe           | Strike                   | `FS`                 | (blank)              | `CC`              |
| 22  | Great sword        | Slash                    | `FS`                 | `EP`                 | `DC`              |
| 24  | Battle Axe         | Strike                   | `FS`                 | (blank)              | `DC`              |
| 28  | 1-h Spear          | Thrust                   | `FP`                 | `BS`                 | `AS`              |
| 29  | 2-h Javelin        | Thrust                   | `FP`                 | `CS`                 | `AS`              |
| 30  | 2-h Spear          | Thrust                   | `FP`                 | `DS`                 | `BS`              |
| 32  | Halberd            | Strike                   | `FS`                 | `FP cs`              | `DC`              |
| 33  | Pole axe           | Strike                   | `FS`                 | (blank)              | `DC`              |
| 35  | Lance              | Charge                   | `FP`                 | (blank)              | `DC`              |

This confirms the inventory reported on Forgejo #223 cell for cell: `Q15`, `Q18`, `Q19`, `Q20`,
`Q22`, `Q24`, `Q28`, `Q29`, `Q30`, `Q32`, `Q33`, `Q35`.

### Attested `Sec` codes

Six distinct codes are attested: `AP`, `AC`, `AS`, `BS`, `CC`, `DC`.

### Recognized grammar

```text
Sec := <grade letter><family letter>
grade letter  := A | B | C | D
family letter := S | P | C
```

- Grade letters observed: `A` (`Q15`, `Q18`, `Q19`, `Q28`, `Q29`), `B` (`Q30`), `C` (`Q20`),
  `D` (`Q22`, `Q24`, `Q32`, `Q33`, `Q35`). `E` and `F` never appear in `Weapon1!Q`.
- Family letters observed: `S` (`Q28`, `Q29`, `Q30`), `P` (`Q15`), `C` (`Q18`, `Q19`, `Q20`, `Q22`,
  `Q24`, `Q32`, `Q33`, `Q35`).

Whether the recognized grammar is the full twelve-combination `A-D` by `S|P|C` matrix or only the
six attested codes is not decided by the source. See
[question Q2](#q2-recognized-grammar-versus-attested-inventory).

The `Sec` vocabulary is **stricter than the `Crit 1` and `Crit 2` vocabularies** and must not be
generalized to them. `Weapon1!N32 = "FP cs"` carries a qualifier, and `Weapon1!M36`, `Weapon1!N36`,
and `Weapon1!M42` carry the sentinel `N/A`. No `Weapon1!Q` cell carries either shape.

### Absent `Sec`

A blank `Weapon1!Q` is an authored absence, not missing data. Decision 0006 §1 makes Secondary
Critical capability solely a property of the weapon-authored `Sec` field, so a weapon with no `Sec`
code produces no Secondary Critical. `Weapon1!M14 = "FC"` with `Q14` blank (Heavy mace) and
`Weapon1!M25 = "FC"` with `Q25` blank (Maul) stand beside `Weapon1!M15 = "FC"` with
`Weapon1!Q15 = "AP"` (Morning star): the same `Crit 1` code with and without a `Sec` code.

## 2. Critical-family routing

The second character selects the Critical family. The `Weapon1!C` prime-attack labels fix the letter
meanings directly:

- `Weapon1!C2 = "Thrust"` with `Weapon1!M2 = "DP"` (Knife)
- `Weapon1!C4 = "Slash"` with `Weapon1!M4 = "ES"` (Short sword)
- `Weapon1!C12 = "Strike"` with `Weapon1!M12 = "DC"` (Club)

| `Sec` family letter | Source attack mode | Canonical melee mode | Frozen catalogue family |
| ------------------- | ------------------ | -------------------- | ----------------------- |
| `S`                 | Slash              | `slash`              | `sharp`                 |
| `P`                 | Thrust             | `thrust`             | `pointed_weapons`       |
| `C`                 | Strike             | `strike`             | `blunt`                 |

The frozen family names are those listed in
[Target Critical catalogue V1](./target-critical-catalogue-v1.md).

Two properties of the attested inventory are worth recording as inventory facts rather than rules:

1. **Every `Sec` code routes to a different family from its own `Crit 1` code.** All twelve rows
   change family: `FC` to `AP` (Morning star), `DS`/`ES`/`FS` to `AC`/`CC`/`DC` (the axes,
   Great sword, Battle Axe, Halberd, Pole axe), `FP` to `AS`/`BS` (spears and javelin), and `FP` to
   `DC` (Lance). Each pairing is physically legible: the morning star's spikes, an axe's haft and
   back, a spear's edge, a lance's mass.
2. **Only three of the eight frozen families are reachable from `Sec`.** `arrows_bolts`,
   `teeth_claws`, `firearms`, `falling_crushing`, and `fire_energy` have no `Sec` letter. The
   missile weapon sheet has no Secondary Critical field at all: `Weapon2!A1:K1` is `Weapon`,
   `Skill`, `OB 1`, `DMB 1`, `Parry%`, `Initiativ`, `Range`, `Arm.mod. 1`, `Crit 1`, `Enc.`,
   `Ammo Enc.` — there is no `Second crit.` column. See
   [question Q3](#q3-scope-of-sec-outside-the-melee-weapon-table).

## 3. Grade reduction per code

### What the source encodes

The source encodes an **absolute grade letter**, not a reduction. `Sec` uses the same grade alphabet
and the same position as the `Crit 1` grade letter that `Game sheet!F31` calls `Max Critical` and
that `'cleon vs slaver'!C130:C131` applies as a ceiling.

Decision 0006 §2 and §4 replaced absolute-grade semantics with a **fixed relative reduction from the
resolved Primary grade**, with no absolute cap. Converting the authored absolute letters into
reductions requires an anchor grade to measure each `Sec` letter against, and **no source states an
anchor**, because no formula consumes column `Q` at all.

Two anchors are available from the evidence. They agree on ten of the twelve rows.

- **Reading A — weapon-anchored.** The reduction is the grade distance from the weapon's own
  `Crit 1` grade letter to its `Sec` grade letter. This preserves the authored pairing exactly at
  the weapon's maximum grade.
- **Reading B — `F`-anchored.** The reduction is the grade distance from `F` to the `Sec` grade
  letter, making the reduction a property of the `Sec` code alone.

| Row | Weapon       | `Crit 1` | `Sec` | Reading A reduction | Reading B reduction |
| --- | ------------ | -------- | ----- | ------------------- | ------------------- |
| 15  | Morning star | `FC`     | `AP`  | 5                   | 5                   |
| 18  | Hatchet      | `DS`     | `AC`  | **3**               | **5**               |
| 19  | Wood axe     | `ES`     | `AC`  | **4**               | **5**               |
| 20  | Hand axe     | `FS`     | `CC`  | 3                   | 3                   |
| 22  | Great sword  | `FS`     | `DC`  | 2                   | 2                   |
| 24  | Battle Axe   | `FS`     | `DC`  | 2                   | 2                   |
| 28  | 1-h Spear    | `FP`     | `AS`  | 5                   | 5                   |
| 29  | 2-h Javelin  | `FP`     | `AS`  | 5                   | 5                   |
| 30  | 2-h Spear    | `FP`     | `BS`  | 4                   | 4                   |
| 32  | Halberd      | `FS`     | `DC`  | 2                   | 2                   |
| 33  | Pole axe     | `FS`     | `DC`  | 2                   | 2                   |
| 35  | Lance        | `FP`     | `DC`  | 2                   | 2                   |

The readings diverge only on `Weapon1!Q18` and `Weapon1!Q19`, the two `Sec`-bearing weapons whose
`Crit 1` grade letter is below `F` (`Weapon1!M18 = "DS"`, `Weapon1!M19 = "ES"`).

The most common authored reduction is `2`, carried by `Weapon1!Q22`, `Q24`, `Q32`, `Q33`, and `Q35`.
That is the same reduction decision 0006 §2 uses for its worked `F` to `D`, `E` to `C`, `D` to `B`,
`C` to `A` example.

### The reduction is not a property of the code alone

Under Reading A, the identical code `AC` encodes a reduction of `3` at `Weapon1!Q18` (Hatchet,
`Crit 1` `DS`) and a reduction of `4` at `Weapon1!Q19` (Wood axe, `Crit 1` `ES`). The reduction is
then a property of the **pair** (`Crit 1` grade letter, `Sec` grade letter), not of the `Sec` code
in isolation. Under Reading B it is a property of the code alone.

This is the single decisive difference between the two readings, and it is exactly what a future
parser would have to encode. It is returned to the Product Owner as
[question Q1](#q1-anchor-for-the-relative-grade-reduction), not resolved here.

### Grade order

The grade alphabet used above is `A < B < C < D < E < F`, the order applied by
`'cleon vs slaver'!C131` through `CODE()` comparison and by the `A..F` rows of
`'Critical table'!A1:C7` in the same workbook.

## 4. Exceptions and inconsistencies in the source

1. **`Sec` is authored but never executed.** No workbook formula reads `Weapon1!Q`; the widest
   ranges stop at column `P` (see [Evidence base](#evidence-base)). Every semantic question about
   `Sec` that needs arithmetic is therefore unanswerable from this workbook by construction.
2. **`Sec` grammar is narrower than the other Critical-code fields.** `Weapon1!N32 = "FP cs"` is a
   five-character qualified code and `Weapon1!M36`, `Weapon1!N36`, `Weapon1!M42` are `N/A`
   sentinels. Nothing of that shape appears in `Weapon1!Q`. The strict two-character `Sec` grammar
   must not be generalized to `Crit 1` or `Crit 2`.
3. **The same `Sec` code carries different reductions.** `Weapon1!Q18 = Weapon1!Q19 = "AC"` sit on
   `Crit 1` values `DS` and `ES` respectively. See
   [question Q1](#q1-anchor-for-the-relative-grade-reduction).
4. **No uniform per-weapon-family authoring.** Four axes carry four different pairings: Hatchet
   `DS`/`AC`, Wood axe `ES`/`AC`, Hand axe `FS`/`CC`, Battle Axe `FS`/`DC` (`Weapon1!M18:M20`,
   `M24`, `Q18:Q20`, `Q24`). `Sec` is authored per weapon, and no family-level or class-level rule
   reproduces it.
5. **Near-identical weapons diverge in whether they carry `Sec` at all.** `Weapon1!M27 = "FP"`
   (1-h Javelin) has `Q27` blank, while `Weapon1!M29 = "FP"` (2-h Javelin) has `Q29 = "AS"`.
   Likewise 1-h Spear `Weapon1!Q28 = "AS"` against 2-h Spear `Weapon1!Q30 = "BS"`. These are not
   contradictions, but they show `Sec` is a sparse hand-authored field: absence carries no implied
   default from a similar weapon.
6. **Reading B makes two authored rows unreachable.** Under the `F`-anchored reading, Hatchet
   (`Weapon1!M18 = "DS"`, maximum grade `D`) and Wood axe (`Weapon1!M19 = "ES"`, maximum grade `E`)
   would need a resolved Primary grade of `F` to produce any Secondary Critical, which their own
   `Crit 1` ceiling forbids. Both authored `Sec` codes would then be dead entries. This is evidence
   against Reading B, but it is an argument from authoring intent rather than a source statement,
   so it does not settle [question Q1](#q1-anchor-for-the-relative-grade-reduction).
7. **`Sec` exists only on the melee weapon table.** `Weapon2` has no `Second crit.` column
   (`Weapon2!A1:K1`). Missile and ammunition rows cannot author a Secondary Critical.
8. **Non-weapon and unarmed rows carry no `Sec`.** `Weapon1!A34 = "Movement"` and
   `Weapon1!A36 = "Action"` are layout rows; `Weapon1!M36 = "N/A"` and `Weapon1!M42 = "N/A"`
   (Garotte) are non-codes. Shield, Punch, and Kick rows `Weapon1!37:41` and `Weapon1!43` all carry
   `Crit 1 = "AC"` with `Q` blank.
9. **Quarterstaff repeats its own code across modes.** `Weapon1!M31 = "DC"` and
   `Weapon1!N31 = "DC"`. This is unrelated to `Sec` (`Q31` is blank) but is a parsing hazard for any
   reader that treats a repeated code as evidence of a Secondary Critical.

## 5. Parsing guidance

Decision 0006 requires parsing work to preserve the raw code and its provenance and to fail closed
on unrecognized grammar. Concretely, and still without authorizing any implementation:

- Read `Sec` only from `Weapon1` column `Q`. Never derive it from `Crit 1`, `Crit 2`, `Crit 3`, a
  damage class, a weapon family, or a concatenation of codes.
- Retain the raw cell value and its provenance (workbook, sheet, row, cell) alongside any
  normalized form.
- Normalize only by trimming surrounding whitespace and upper-casing. Do not strip internal spaces,
  split on a qualifier, or repair a malformed value.
- Accept a value only if it matches the recognized grammar in
  [Code vocabulary](#recognized-grammar). Treat anything else — including a qualified code such as
  the `Crit 2` shape `FP cs`, an `N/A` sentinel, or a grade letter `E` or `F` — as unrecognized:
  record it, produce no Secondary Critical, and do not guess.
- Treat a blank or absent `Sec` as "no Secondary Critical", not as unknown.
- Attach `Sec` to the main attack mode only, consistent with the `Sec` gloss in
  [Combat loadout calculations](./combat-loadout-calculations.md).

The Forgejo #223 recovery report records that current runtime concatenates the primary MC code and
`secondCrit` into one `weaponCriticalCode`. That concatenation is inconsistent with every reading
above, because it produces a four-character string that is neither a `Crit 1` code nor a `Sec` code.
Correcting it is runtime work and is not authorized by this document.

## Open Product Owner questions

Each question below is genuinely unsettled by the recovered evidence. None may be closed by
preference.

### Q1: anchor for the relative grade reduction

Decision 0006 §2 makes the Secondary grade a fixed relative reduction from the resolved Primary
grade. The source authors an absolute grade letter and never states an anchor, because no formula
reads `Weapon1!Q`.

- **Reading A — weapon-anchored.** Reduction is the distance from the weapon's own `Crit 1` grade
  letter to its `Sec` grade letter. Evidence: `Sec` shares the grade alphabet and position with the
  `Crit 1` letter that `Game sheet!F31` calls `Max Critical`; this preserves the authored pairing
  exactly at the weapon's maximum grade; it keeps `Weapon1!Q18` and `Weapon1!Q19` reachable.
  Consequence: the reduction is a property of the (`Crit 1`, `Sec`) pair, so `AC` means `3` on the
  Hatchet and `4` on the Wood axe.
- **Reading B — `F`-anchored.** Reduction is the distance from `F` to the `Sec` grade letter.
  Evidence: ten of the twelve rows have `Crit 1` grade `F`, so `F` is the dominant implicit anchor;
  the reduction becomes a self-contained property of the `Sec` code, which is the simplest thing to
  encode. Consequence: `Weapon1!Q18` (`DS`/`AC`) and `Weapon1!Q19` (`ES`/`AC`) become dead entries
  that can never fire.

Both readings reproduce decision 0006's worked two-grade example. The two rows that separate them
are `Weapon1!Q18` and `Weapon1!Q19`.

### Q2: recognized grammar versus attested inventory

Six codes are attested (`AP`, `AC`, `AS`, `BS`, `CC`, `DC`). The source does not say whether the
authorized vocabulary is:

- **Reading A —** the full `A-D` by `S|P|C` matrix of twelve combinations, of which six happen to be
  used; or
- **Reading B —** only the six attested codes, with any other well-formed combination treated as
  unrecognized until content authoring adds it.

Both fail closed on `E`/`F` grade letters and on non-`S|P|C` family letters, which are unattested in
`Weapon1!Q` in either reading.

### Q3: scope of `Sec` outside the melee weapon table

`Weapon2!A1:K1` has no `Second crit.` column, so missile and ammunition rows cannot author a `Sec`
code, and no `Sec` letter routes to `arrows_bolts`, `teeth_claws`, `firearms`, `falling_crushing`,
or `fire_energy`. The source does not say whether this is a deliberate melee-only boundary or simply
the limit of what was authored. The question matters because it decides whether five of the eight
frozen catalogue families are permanently unreachable through Secondary Criticals.

### Q4: hit location for the Secondary Critical

Decision 0006 §5 rules that the Secondary Critical uses a fresh independent 2d8 for the Critical
roll. It does not state whether the Secondary Critical reuses the Primary Critical's hit location or
rolls its own, and the hit location is one of the three axes of the catalogue key. The Forgejo #223
recovery found no source supporting a fresh hit-location roll, and both options it offered reused
the location, but that reuse was never explicitly ruled. Confirmation is needed before the Secondary
lookup key is fully specified.

## Verification and traceability

- Portfolio: Forgejo #111 Criticals / Injury.
- Source recovery and Product Owner rulings: Forgejo #223.
- Rule authority: [decision 0006](../decisions/rules/0006-secondary-critical-resolution.md).
- Primary evidence: `data/raw/glantri/Themistogenes 1.07.xlsx`, sheets `Weapon1`, `Weapon2`,
  `Game sheet`, `Calculations`, `Character sheet entry`.
- Supporting evidence: `docs/source/combat/New_Combat_Arena.xlsx`, sheet `cleon vs slaver`.
- Catalogue structure: [Target Critical catalogue V1](./target-critical-catalogue-v1.md).
- Data-column gloss: [Combat loadout calculations](./combat-loadout-calculations.md).
