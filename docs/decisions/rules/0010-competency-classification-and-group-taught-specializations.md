# Rule decision 0010: Competency classification — Fencing, the limited Specialization audit, and group-taught Specializations

- Status: approved in part; two questions explicitly unresolved
- Date: 2026-09-26
- Product owner: Vidar Hald
- Related issues/PRs: recorded from the Product Owner's 2026-09-26 Chargen
  Alpha inspection of the running application; no implementation issue is
  authorized by this record
- Complements:
  [Competency rules](../../rules/competency-rules.md),
  [Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md),
  [rule decision 0002](0002-skill-catalogue-qualitative-architecture.md),
  [rule decision 0008](0008-competency-content-v2-canonical-acceptance.md),
  [Chargen and Competency Experience Product Contract](../../product/chargen-competency-experience-contract.md)
- Supersedes: none. It changes the **target type** of one competency and records
  findings and open questions. It changes no prior rule decision, no
  relationship semantics, and no acquisition arithmetic.
- Superseded by: none

## Question

Three connected classification questions arose from the Product Owner's
2026-09-26 inspection of the running Chargen Profession and acquisition
experience:

1. Should Fencing continue to be modelled as a Specialization of one-handed
   edged fighting?
2. Does the current canonical 26-Specialization roster contain other entries
   whose type is wrong for the same reason?
3. When a Learning Group explicitly teaches a genuine Specialization, what does
   that membership provide mechanically?

## Evidence and provenance

Established at the sources, at `dev` baseline
`27d0c80027c152becb8396d86d006685e3f62fa4`:

- **Fencing is currently a Specialization of `one_handed_edged` with
  `minimumParentLevel: 6`** (and `minimumGroupLevel: 6`) —
  `packages/content/src/data/canonicalContent.json:5605-5613`, in
  `specializations[]`. That parent minimum is the mechanical source of the
  double-investment problem this record rules on. Fencing has no entry in that
  file's `skills[]`.
- **Canonical V2 group F30 "Swashbuckling fencing instruction"** carries
  `fixedSkillIds: ["one_handed_edged", "dodge", "parry"]` and
  `specializationIds: ["fencing"]`, with the authoring note "Kept without a
  slot: the tradition is defined by its weapon, so an alternative family would
  not be the same practice" —
  `docs/product/proposals/competency-content-v2/competency-content-v2.json:1775-1781`.
- **Canonical V2 group F41 "Longbow hunting apprenticeship"** carries
  `fixedSkillIds: ["bow", "skill:hunting"]` and
  `specializationIds: ["longbow"]` —
  `docs/product/proposals/competency-content-v2/competency-content-v2.json:1864-1869`.
- **`longbow` is a base Skill in legacy `canonicalContent.json`, not a
  Specialization** — `packages/content/src/data/canonicalContent.json:5260-5276`,
  in `skills[]`, with an authored `dependencies` entry
  `{ "skillId": "bow", "strength": "helpful" }`. **V2 introduced the
  Specialization framing for Longbow; the legacy model already held it as a base
  Skill.** This divergence is central to the open Longbow question below, and it
  means interpretation 1 there is a **restoration**, not an invention.
- **Steppe Remount Training's controlling status is Specialization**, settled by
  the final amendments in the accepted 172-entry catalogue:
  `docs/source/competencies/Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt:15`
  ("add Falconry and Steppe Remount Training to Specializations") and its type
  table at line 8 (`| Specialization | 26 | Includes Falconry and Steppe Remount
Training; Sailmaking removed from this type |`). Its parent is Animal
  Husbandry (line 7534), its reader prose is complete (lines 5745-5762), and it
  does not appear in legacy `canonicalContent.json` at all.
- The two Profession-specific `choose one` alternatives, including "Guard,
  Watcher and Escort offers either Swashbuckling fencing instruction or
  One-handed edged close-combat practice for that purchase", are recorded under
  [Competency rules → Professions](../../rules/competency-rules.md#professions).
- The accepted acquisition arithmetic that makes the double investment concrete
  is [Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md) sections 4, 5
  and 7.

## Conflict or limitation

Fencing and ordinary one-handed edged fighting principally answer the **same
gameplay purpose**. Modelling Fencing as a Specialization of one-handed edged,
gated behind `minimumParentLevel: 6`, creates an unattractive double investment:
a competent fighter becomes mechanically **worse** at the same primary task when
adopting the specialist tradition, because the specialist competence starts near
zero while the parent competence does not carry it. Learning Groups are meant to
train the relevant combat competence together, not to force the player to
purchase effectively overlapping weapon competence twice.

F30's current membership compounds this: `one_handed_edged` is present in the
group partly because the Specialization-parent model required a parent to reach
level 6.

**Longbow under V2 is structurally analogous** and is therefore **not settled
here**. The classification test this record applies — can a Character be
coherently highly competent in the parent and still a novice at the specialist
task? — must be asked of Longbow by the Product Owner, not answered by analogy
with Fencing.

## Ruling

### 1. Fencing is no longer a Specialization of one-handed edged

**Target direction, approved:**

- Fencing becomes a **base combat Skill**.
- It uses the **same base individual-cost class** as one-handed edged and the
  other ordinary weapon Skills.
- **F30 Swashbuckling fencing instruction is re-derived around Fencing as its
  weapon Skill**, together with the other genuinely taught group members such as
  Dodge and Parry.
- `one_handed_edged` **must not remain in F30 merely to satisfy the now-removed
  Specialization-parent model**, unless a later explicit content ruling
  independently justifies keeping it.
- Relationship minima between Fencing and one-handed edged may still be
  appropriate. **Their exact directions and coefficients remain a separate rules
  decision and are not approved here** — see
  [Preserved relationship semantics](#preserved-relationship-semantics).

**This reclassification is not implemented or scheduled by this record.** The
Product Owner's condition was that it not be implemented until the limited
Specialization follow-up below was recorded; recording it is what this record
does. Implementation requires its own authorized contract, which must address at
minimum: the `specializations[]` → `skills[]` move in
`packages/content/src/data/canonicalContent.json`, F30's membership in the
canonical V2 corpus, the repo-local seed and export paths that carry the
`fencing` identifier, and the existing `choose one` alternative between F30 and
One-handed edged close-combat practice.

### 2. Limited Specialization classification audit

Result against the current canonical 26-Specialization roster:

| Specialization               | Result                             |
| ---------------------------- | ---------------------------------- |
| Fencing                      | **Reclassify** — base Skill, above |
| Longbow                      | **Open — strong review required**  |
| Steppe Remount Training      | **Settled as Specialization**      |
| The remaining 23 named below | No reclassification indicated      |

**Longbow — open, strong review required.** V2's F41 teaches Bow and Hunting and
lists Longbow as a Bow Specialization. If Bow is high but Longbow begins very
low, adopting a longbow can make an experienced archer mechanically much worse at
the same primary task. **This must not be settled by analogy with Fencing.** The
preparation required before the Product Owner rules is:

1. present both principal interpretations —
   - **Longbow as a separate base weapon Skill** with an explicit authored
     relationship to Bow. Note this is a **restoration** of the legacy model,
     where `longbow` is already a base Skill with a `helpful` dependency on
     `bow`; and
   - **Longbow as Bow plus weapon or tradition context**, with no separate
     acquisition;
2. identify the live weapon-template and runtime consequences of each option.
   The `longbow` identifier is carried by the canonical content data, the
   repo-local seed and AI-export scripts, the V2 report generator, the V2 reader
   prose and source modules, semantic fixtures, and Chargen, character-sheet,
   admin and reference tests. The preparation surveys the actual current set;
   this list is orientation, not a closed inventory.

**Steppe Remount Training — settled, not open.** The Product Owner's ruling
called for a status/provenance check. The recorded finding is that its
controlling status **is Specialization**, with Animal Husbandry as parent, per
the accepted 172-entry catalogue's final amendments cited above. **No type change
is proposed and none is required.** One narrow caveat is already recorded at
source: any pre-existing Pilot parent, learning history or relationship for the
Steppe Remount source record needs a separately authorized
compatibility/migration decision
(`docs/source/competencies/Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt:7470`).
That caveat concerns migration, not type.

**No reclassification indicated by this limited audit** for: Court
Administration; Animal Training; Falconry; Fortification; Siege Operations;
Baking; Court Cookery; Food Preservation; Courtly Protocol; Omen Reading;
Cordage / Ropemaking; Genealogy; Court Advocacy; Warded-Lock Entry; Bone Setting;
Diagnostic Medicine; Obstetrics; Poison Treatment; Music Composition; Theology;
Pickpocketing; Weaponsmithing; Battlefield Surgery.

They **provisionally pass** the classification test: a Character can coherently
be highly competent in the parent while remaining a novice at the specialist
task.

**This limited audit approves no coefficients, no costs and no access rules for
those 23 Specializations.** It is a type finding only.

### 3. Group-taught Specializations — open question, not resolved

Canonical V2 explicitly lists genuine Specializations inside several Learning
Groups. The remaining question is **recorded and deliberately not resolved by
inference**:

> When a genuine Specialization is explicitly taught by a Learning Group, does
> that membership provide **only an access and training route**, with the
> Specialization's progression purchased separately — or should the
> Specialization **participate in some form of Group progression after
> acquisition**?

Constraints on how it is answered:

- It must be **decided once for the group-acquisition model**, not independently
  in F29, K15, F07, M08, F13, F25 or any other individual group.
- **Fencing must not be used to answer it**, because Fencing is being
  reclassified out of the Specialization model by ruling 1 above.
- Until it is decided, the current recorded rule stands unchanged:
  Specialization membership in a Learning Group is access-only and is purchased
  separately, per
  [Competency rules → Character generation](../../rules/competency-rules.md#character-generation)
  and [Learning Groups](../../rules/competency-rules.md#learning-groups).
  Nothing here authorizes a different behaviour in the interim.

### Preserved relationship semantics

Relationship semantics are **existing architecture and are not changed by this
record**. They are already recorded correctly and are cited rather than
restated:

- relationships are **minimum-value** relationships, not additive XP transfers —
  `E_y = max(A_y, R_y)`, and incoming results never stack
  ([Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md), section 5);
- they may be **directional**, may exist in both directions, and may use
  different strengths in each direction; no reverse edge is ever inferred
  (same section; and
  [rule decision 0002](0002-skill-catalogue-qualitative-architecture.md),
  "Relationships, histories, languages, and Specializations", items 1, 6 and 7);
- relationship-derived values **must not recursively propagate** through the
  graph or loop back into the same Skill: only acquired base competence may
  source an edge, so cycles cannot amplify competence
  ([Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md), section 5);
- there is no automatic base-to-Specialization or Specialization-to-base
  transfer, and a zero-transfer Specialization is valid (same reference,
  section 7).

**No Fencing relationship coefficient is recorded or implied anywhere in this
record.** The 2026-09-26 review approved **no** Fencing ↔ one-handed edged
strength in either direction, and none may be inferred from it.

## Reasoning

A Specialization is justified when a Character can be highly competent in the
parent and still a novice at the specialist task. Fencing fails that test
against one-handed edged: both answer the same gameplay purpose with the same
weapon class, so the specialist framing produces a mechanical penalty for
adopting a tradition the fiction treats as an advance. Making Fencing a base
Skill at the ordinary weapon cost class removes the double investment without
inventing any new mechanic, and leaves any actual carry-over to the existing
explicit-relationship system where it must be authored deliberately.

The remaining 23 entries survive the same test on inspection, so the audit stops
there rather than re-deriving the whole roster. Longbow plausibly fails it in the
same way Fencing does, but its legacy-versus-V2 divergence and its
weapon-template consequences make it a genuine Product Owner decision rather than
an analogy.

## Executable examples

These are stated for the future implementation contract; **this record
authorizes no test change**.

- After ruling 1 is implemented, `fencing` appears in `skills[]` and not in
  `specializations[]` in the canonical content, and carries no
  `minimumParentLevel`.
- After ruling 1 is implemented, a Character with high one-handed edged
  competence who acquires Fencing is not required to satisfy a parent-level
  minimum, and Fencing's individual cost matches the ordinary weapon-Skill
  class.
- Until ruling 3 is decided, a Learning Group that explicitly lists a
  Specialization grants access to it and no competence in it; its progression is
  purchased separately.

## Implementation consequences

- **None applied by this record.** It is documentation and rule authority only.
  No content, schema, evaluator, importer, seed, UI, Chargen or test change is
  authorized here.
- Ruling 1 will require a separately authorized content change spanning the
  canonical content data, the canonical V2 corpus's F30 membership, and the
  derived seed/export/report/test surfaces that reference `fencing`. Because it
  changes canonical competency data and stored-data semantics, that work is
  expected to be QA-floor class; the floor in
  [`AGENTS.md`](../../../AGENTS.md) governs, not this note.
- Ruling 2's Longbow question and ruling 3 are **decision preparation**, not
  implementation, and each needs a Product Owner ruling before any content or
  runtime change.

## Verification and traceability

- Source: the Product Owner's 2026-09-26 Chargen Alpha inspection rulings.
- Facts verified at `dev` baseline `27d0c80027c152becb8396d86d006685e3f62fa4`
  against `packages/content/src/data/canonicalContent.json`,
  `docs/product/proposals/competency-content-v2/competency-content-v2.json`, and
  `docs/source/competencies/Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt`,
  with the line citations given above.
- Related availability constraint for Fencing:
  [architecture decision 0006](../architecture/0006-setting-foundation.md),
  "2026-09-26 amendment".
- Related Chargen presentation rulings from the same inspection:
  [Chargen and Competency Experience Product Contract, section 10](../../product/chargen-competency-experience-contract.md#10-chargen-profession-and-acquisition-experience--product-owner-rulings-2026-09-26).
- Related Learning Group overlap principle from the same inspection:
  [Competency rules → Overlapping Learning Groups do not stack](../../rules/competency-rules.md#overlapping-learning-groups-do-not-stack).
