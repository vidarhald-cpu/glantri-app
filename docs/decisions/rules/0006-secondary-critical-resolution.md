# Rule decision 0006: Secondary Critical resolution

- Status: approved
- Date: 2026-09-19
- Amended: 2026-09-21 (Forgejo #223 Product Owner ruling — severity semantics, capping, and hit
  location; self-amendment, same record)
- Product owner: Vidar Hald
- Related portfolio areas: Forgejo #111 Criticals / Injury; Forgejo #223 Secondary Critical source recovery
- Complements: [decision 0004](./0004-c1-critical-authoring-and-adjudication.md), [decision 0005](./0005-critical-effect-semantics-and-timing.md), the `Sec` weapon-table column described in [Combat loadout calculations](../../rules/combat-loadout-calculations.md), and the settled grammar in [Secondary Critical `Sec` grammar reconciliation](../../rules/secondary-critical-sec-grammar.md)
- Supersedes: this record's own original §2/§4 framing of the grade reduction as a code-relative
  distance with no absolute cap, amended 2026-09-21 per the Forgejo #223 Product Owner ruling that
  settled the table columns as maxima (a universal two-grade-step reduction, then capped by the
  `Sec` first character)
- Superseded by: none

## Question

When a weapon attack produces a Critical, what decides whether a second
Critical also occurs, at what grade is it resolved, and from which roll?

## Evidence and limitation

This decision records the Product Owner rulings taken after the bounded
read-only source recovery authorized by Forgejo #223. That recovery established
that `Crit 2` and the Secondary Critical field (`Sec` / `Second crit.`) are
separate weapon-table fields, and that `Crit 2` denotes an alternate attack
mode rather than a Secondary Critical.

Before this record, the only Secondary Critical statement in the repository was
the one-line `Sec` column gloss in
[Combat loadout calculations](../../rules/combat-loadout-calculations.md). That
gloss remains a data-column description; this record is the rule authority.

This is a rules and documentation decision only. **No runtime Secondary
Critical implementation is authorized by it.** No schema, evaluator, resolution
path, catalogue position, or user-facing behavior changes on the basis of this
record alone.

The decision does not alter the 608 primary Critical catalogue positions, their
families, locations, indices, prose, or effects. A Secondary Critical performs a
second lookup against those existing positions; it never adds, removes, or
rewrites them.

**2026-09-21 amendment.** The deferred `Sec` grammar reconciliation (see the
former Deferred section, now resolved below) surfaced four open questions,
returned to the Product Owner on Forgejo #223. The Product Owner's ruling on
that issue settled all four and, in doing so, corrected the framing of the
grade-reduction rule below: the weapon-table columns (`Crit 1` and the `Sec`
first character) are **maxima**, not the reduction distance itself. §2 is
amended to state the universal two-step reduction and add the
Secondary-maximum cap that follows it; its worked example is unchanged and
still correct. The original §4 ("there is no absolute grade cap") is
retracted — a cap does exist, exactly the one §2 now states — and its section
number is reused below for the hit-location rule the original record left
unspecified. §1, §3, and §5 are unaffected and remain exactly as originally
approved.

## Ruling

### 1. Secondary Critical capability is weapon-authored

Whether an attack can produce a Secondary Critical, and how that Secondary
Critical is routed, is controlled solely by the weapon-authored `Sec` field and
its code.

Secondary Critical capability is never inferred independently of weapon data,
and it is never derived from `Crit 2`, which source recovery established is a
separate alternate-attack-mode field.

### 2. Severity semantics and the grade relationship

The weapon-table Critical columns are **maxima**, not fixed points and not the
reduction distance:

- `Crit 1` grade letter = maximum Primary Critical grade for the weapon. The
  resolved Primary Critical is capped by it before anything below applies.
- First character of `Sec` = maximum Secondary Critical grade for the weapon.
- Second character of `Sec` = Secondary Critical family (see the grammar
  document cited above for routing).

The Secondary Critical grade is then derived from the resolved (already
`Crit 1`-capped) Primary Critical grade by a **universal two-grade-step
reduction** — the same fixed distance for every weapon and every `Sec` code —
**and then capped** at the Secondary maximum encoded by the `Sec` first
character.

Worked example for the universal two-grade reduction (unchanged from the
original record; it is exactly the universal two-step this amendment names
explicitly):

| Resolved Primary | Reduced (universal two-step) |
| ---------------- | ---------------------------- |
| F                | D                            |
| E                | C                            |
| D                | B                            |
| C                | A                            |
| B                | none                         |
| A                | none                         |

The Secondary maximum cap then applies to the reduced grade, never raising it:
if the reduced grade exceeds the `Sec` first character's maximum, the
Secondary Critical resolves at that maximum instead. If the reduced grade is
at or below the maximum, it resolves as reduced, uncapped.

Worked examples showing the cap resolving the Hatchet / Wood axe anomaly
(`Crit 1` capping the Primary, then the universal two-step reduction, then the
`Sec`-maximum cap):

| Weapon   | `Crit 1` (Primary max) | Resolved Primary (at cap) | Reduced (two-step) | `Sec` | Secondary max | Secondary result |
| -------- | ---------------------- | ------------------------- | ------------------ | ----- | ------------- | ---------------- |
| Hatchet  | `D`                    | `D`                       | `B`                | `AC`  | `A`           | **A, blunt**     |
| Wood axe | `E`                    | `E`                       | `C`                | `AC`  | `A`           | **A, blunt**     |

Both weapons resolve to Secondary grade `A`, family blunt, from the same `AC`
code, because the cap — not a code-specific reduction distance — is what
`Sec`'s first character means. This is the anomaly the original relative-only
framing left unresolved; see the grammar document for the full evidence.

Resolution order:

```text
Primary Critical roll
  -> capped by the weapon's Crit 1 maximum
  -> resolved Primary Critical grade
  -> apply the universal two-grade-step reduction
  -> cap at the Sec first character's Secondary maximum
  -> Secondary Critical grade, or none when the reduction falls below A
  -> route by the Sec second character's family
  -> reuse the Primary Critical's hit location (see §4)
  -> fresh independent 2d8 for the Secondary result (see §5)
```

### 3. Below A produces no Secondary Critical

When the universal two-grade-step reduction would place the Secondary
Critical below `A` (i.e. the resolved Primary was `B` or `A`), **no Secondary
Critical occurs**. There is no minimum-grade substitution. This check applies
to the reduced grade before the Secondary-maximum cap; the cap can only lower
an already-produced Secondary Critical, never manufacture one that the
two-step reduction did not produce.

### 4. The Secondary Critical reuses the Primary Critical's hit location

The Secondary Critical is looked up at the **same body hit location** the
Primary Critical resolved at. Only the family, index, and result differ; no
second, independent hit-location roll occurs. (This was left unspecified in
the original record; it is settled by the 2026-09-21 amendment and does not
change anything §1, §3, or §5 already stated.)

### 5. The Secondary Critical uses a fresh independent roll

The Secondary Critical is resolved from a **fresh independent 2d8** roll. The
Primary Critical's 2d8 result is never reused for it. This is unchanged from
the original record.

## Grammar reconciliation (resolved)

The exact `Sec` weapon-table grammar, deferred by the original record, is now
reconciled and ratified. See
[Secondary Critical `Sec` grammar reconciliation](../../rules/secondary-critical-sec-grammar.md)
for the code vocabulary, family routing, evidence, and citations:

- the recognized vocabulary is the six attested codes `AP, AC, AS, BS, CC, DC`;
  unknown codes fail closed, and future content may add codes explicitly;
- Critical-family routing per code is fixed by the `Sec` second character;
- the grade reduction is the universal two-step named in §2 above, not a
  per-code distance; and
- exceptions and internal inconsistencies in the source data are recorded in
  the grammar document and do not affect the ruling above.

Parsing work must still preserve the raw `Sec` code and its provenance, and
must still fail closed on grammar it does not recognize.

## Implementation consequences

None are authorized by this record. Separate authority is required before any
Secondary Critical schema, parsing, resolution, or presentation work begins. The
rulings above are the target that such work must satisfy when it is authorized.

## Verification and traceability

- Portfolio: Forgejo #111 Criticals / Injury.
- Source recovery: Forgejo #223 Secondary Critical source recovery.
- 2026-09-21 amendment authority: Forgejo #223, Product Owner ruling comment
  "PRODUCT OWNER RULING — Secondary Criticals, all four questions settled".
- Grammar reconciliation: [Secondary Critical `Sec` grammar reconciliation](../../rules/secondary-critical-sec-grammar.md).
- Open-question record (now resolved): [Ambiguity Log](../../rules/ambiguity-log.md),
  "Secondary Critical `Sec` Grammar" entry.
- Existing `Sec` column description:
  [Combat loadout calculations](../../rules/combat-loadout-calculations.md).
