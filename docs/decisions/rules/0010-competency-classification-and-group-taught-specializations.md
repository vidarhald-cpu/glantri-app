# Rule decision 0010: Competency classification — Fencing, Longbow, the limited Specialization audit, and group-taught Specializations

- Status: approved, and **fully resolved**. Both questions left unresolved at first
  recording are settled by the 2026-09-26 final competency rulings amendment below, and
  the one question that amendment left open — the existing `specializationBridge`
  coefficients — is **settled by the 2026-09-27 amendment: delete the mechanism.**
  Nothing in this record is open, and nothing in it blocks implementation any longer.
- Date: 2026-09-26
- Amended: 2026-09-26 (Product Owner final competency rulings — Longbow settled as
  a base Skill, Fencing reinforced, group-taught Specializations settled for V1, the
  existing overlap rule confirmed as not open design, and the `specializationBridge`
  seam recorded open; self-amendment, same record)
- Amended: 2026-09-27 (Product Owner rulings — Fencing's base-Skill metadata, weapon
  binding activation, F30/F41 memberships, the M04/M05 military Longbow route,
  **ruling 5 RESOLVED as delete**, and the two follow-up rulings of the same date on
  ordinary Bow's civilian route and F30's generic availability; self-amendment, same
  record. Implemented by Forgejo #389, which supersedes the implementation halves of
  #373 and #374.)
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
  relationship semantics, and no acquisition arithmetic. **As amended 2026-09-26 it
  changes the target type of two competencies**, Fencing and Longbow, and still
  changes no prior rule decision, no relationship semantics, and no acquisition
  arithmetic.
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

**2026-09-26 amendment.** All three questions are now answered. The list above is
preserved exactly as first recorded, because it establishes what was open at the
time: question 1 was answered by ruling 1; question 2's Longbow branch stayed open
until the final-rulings amendment to ruling 2; question 3 is settled for V1 by the
final-rulings amendment to ruling 3. A fourth question, not asked at first
recording, is **opened** by ruling 5 below and is deliberately not answered.

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

**2026-09-26 final competency rulings.** The Product Owner's final competency
rulings of 2026-09-26 amend this section. Rulings 1, 2 and 3 are preserved as first
approved, each followed by its own clearly marked amendment; rulings 4 and 5 are
added by the same amendment. **Ruling 5 is open and blocks implementation of rulings
1 and 2.**

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

> **2026-09-26 amendment — reinforced, not rewritten.** The final competency rulings
> repeat this ruling's direction without changing it and add one requirement. The
> base cost class recorded above is unchanged: Fencing uses the same base cost class
> as the other weapon Skills. The addition is that **F30 must use Fencing as the
> actual weapon competence and must not charge both Fencing and one-handed edged**
> solely because of the obsolete parent-Specialization model. No exact Fencing ↔
> one-handed edged relationship coefficient is approved, as
> [Preserved relationship semantics](#preserved-relationship-semantics) already
> records. Fencing's Setting availability — its normal availability horizon, the one
> explicit historical Setting exception, and manual GM enforcement until the Setting
> layer can represent it — is repeated by the final rulings **without change** and
> remains recorded in
> [architecture decision 0006](../architecture/0006-setting-foundation.md),
> "Setting-level competency availability — 2026-09-26 amendment". It is **cited here,
> not restated**, and the named civilization identities deliberately stay in the
> Setting record rather than entering this generic competency record. Implementation
> remains unauthorized and is additionally blocked by
> [ruling 5](#5-resolved-delete--the-existing-specializationbridge-coefficients).

### 2. Limited Specialization classification audit

Result against the current canonical 26-Specialization roster:

| Specialization               | Result                             |
| ---------------------------- | ---------------------------------- |
| Fencing                      | **Reclassify** — base Skill, above |
| Longbow                      | **Open — strong review required**  |
| Steppe Remount Training      | **Settled as Specialization**      |
| The remaining 23 named below | No reclassification indicated      |

> **2026-09-26 amendment — Longbow is settled.** The Longbow row above reads
> `Open — strong review required` exactly as first recorded. **As amended, Longbow is
> reclassified: it is a base combat Skill, not a Specialization.** That row and the
> subsection immediately below are preserved as provenance of what was open and of
> the preparation the Product Owner required before ruling. The settled ruling is
> [Longbow — settled, 2026-09-26 amendment](#longbow--settled-2026-09-26-amendment)
> below.

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

#### Longbow — settled, 2026-09-26 amendment

**The Product Owner ruled on 2026-09-26: Longbow is a base combat Skill, not a
Specialization.** Both principal interpretations required above were presented, and
**interpretation 1 was chosen** — Longbow as a separate base weapon Skill with an
explicit authored relationship to Bow, which the preparation above already identifies
as a **restoration** of the legacy model rather than an invention. **Interpretation 2
was not chosen**: Longbow is not modelled as Bow plus weapon or tradition context
with no separate acquisition.

Settled terms:

- Longbow uses the **same base individual-purchase cost class** as Bow and the
  ordinary weapon Skills.
- The **existing authored qualitative relationship to Bow is preserved** — the
  `helpful` dependency already recorded in the evidence above. It is preserved as
  authored, not re-derived.
- **No numerical Longbow ↔ Bow relationship coefficient is approved, and none may be
  inferred** — not from this record, and not from data that already exists. See
  [ruling 5](#5-resolved-delete--the-existing-specializationbridge-coefficients).

Curriculum consequences, settled:

- **F41 Longbow hunting apprenticeship teaches Longbow and Hunting.** It does **not**
  separately train or charge Bow merely because Bow and Longbow are related. F41 is
  the civilian and hunting route.
- **Military curricula that actually teach Longbow teach Longbow directly.** Longbow
  should be a valid missile-family choice in **M04** where appropriate, and should be
  represented appropriately in **M05** advanced missile-family training.
- **The Soldier longbow-specialist path must not pull in F41 merely to obtain
  Longbow** when Hunting is not actually part of the military curriculum.

**This reclassification is not implemented or scheduled by this record**, on the same
terms as ruling 1, and it is additionally blocked by
[ruling 5](#5-resolved-delete--the-existing-specializationbridge-coefficients).

#### Longbow reclassification — consequences established by inspection

Established by Orchestrator architecture inspection at this amendment's baseline
`c75bb3503cbc5bbdb6ecdb435302725e633b99fd`. These are **findings**, not
authorizations:

- **The live V2 runtime treats Fencing and Longbow symmetrically.** Both project as
  Specializations carrying the same parent minimum recorded above for Fencing
  (`minimumParentLevel: 6`) — `packages/content/src/targetCompetencies.ts:179-206`.
  This holds **despite** `longbow` having a base-Skill entry with its `helpful` Bow
  dependency in legacy `packages/content/src/data/canonicalContent.json:5260-5276`,
  so the legacy divergence cited in the evidence above does **not** make the runtime
  behaviour asymmetric.
- **Both carry authored canonical prose that explicitly describes them as
  specializations**, which reclassification would make wrong —
  `docs/source/competencies/Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt:5615`
  and `:5618` and `:5628` for Fencing, and `:5925` and `:5928` and `:5938` for
  Longbow. **Re-authoring that prose is a consequence with its own authoring and
  review path** and is not authorized here.
- **The Soldier longbow path is a hardcoded name match** —
  `packages/content/src/targetProfessions.ts:125`.
- **Neither M04 nor M05 currently offers Longbow.** Both missile selection slots
  carry the same approved candidate pool of five missile families — bow, crossbow,
  firearms, sling and throwing — each slot with `chooseCountStatus: "approved"`: M04
  `chooseCount: 1` at
  `docs/product/proposals/competency-content-v2/competency-content-v2.json:1837-1839`
  and M05 `chooseCount: 3` at the same file's lines 1855-1857. **Adding a candidate
  changes the pool, not the count**, so neither approved choose-count is disturbed.

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

### 3. Group-taught Specializations — settled for V1

> **Heading amended 2026-09-26.** This section was first approved under the heading
> "Group-taught Specializations — open question, not resolved". The question and its
> constraints are preserved below exactly as first recorded, as provenance, and are
> **marked resolved**; the settled V1 answer follows them.

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

#### Resolved — settled for V1, 2026-09-26 amendment

**The question quoted above is answered.** The interim access-only position it
protected is now the **settled V1 rule** rather than a placeholder, and the
constraint that it be decided once for the group-acquisition model is satisfied by
this amendment: it is **not** a per-group decision for F29, K15, F07, M08, F13, F25
or any other individual group.

A genuine Specialization explicitly listed in a Learning Group **receives access and
training through that Group, but does not receive Group XP.** Therefore:

1. Group cost and Group XP apply to the Group's **base Skills and selected base-Skill
   choices**.
2. A listed Specialization becomes an **authorized acquisition route**.
3. It must still satisfy its **normal parent and prerequisite rules**.
4. It is **acquired and progressed separately**.
5. It receives **no retroactive Group-XP catch-up**.
6. Future Group purchases **do not directly add Specialization Group XP**.
7. Competency relationships **may establish non-additive minima as already defined** —
   the minimum-value semantics cited under
   [Preserved relationship semantics](#preserved-relationship-semantics), not a new
   mechanic.

On presentation: the UI should show the taught Specialization **inline with the
relevant Group**, including eligibility and the purchase action where appropriate.
The presentation principles in
[Chargen and Competency Experience Product Contract](../../product/chargen-competency-experience-contract.md)
govern how; nothing here authorizes a UI change on its own.

**Fencing and Longbow are not examples of this mechanic.** Both become **base Skills**
under rulings 1 and 2, so once those rulings are implemented neither F30's
`specializationIds: ["fencing"]` nor F41's `specializationIds: ["longbow"]` may be
read as a worked example of group-taught Specialization behaviour. The constraint
above that **Fencing must not be used to answer this question continues to apply, and
applies equally to Longbow.**

### 4. The existing overlap rule is not open design

**Added by the 2026-09-26 final competency rulings.** The recorded rule that **only
the strongest applicable Group contribution counts**, and that a duplicate or
overlapping group component producing no useful competence **produces no price**,
**remains controlling**. It is **not open design**, and it is **cited here rather
than restated or re-legislated**:

- only the strongest group's contribution counts, with weaker memberships kept in the
  explanation output marked suppressed rather than deleted —
  [Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md), section 4, line 50;
- the recorded `usefulGroup_s` formula that prices only useful group competence —
  same reference, line 57;
- the recorded worked overlapping-Sword case that fixes the reading — same reference,
  line 67;
- the same principle in the rules narrative —
  [Competency rules → Overlapping Learning Groups do not stack](../../rules/competency-rules.md#overlapping-learning-groups-do-not-stack).

**All this record adds is a verification obligation: implementation conformance to
that existing rule is to be verified.** Divergence found in implementation is a
**defect**, repaired against the recorded rule. It is **not a new Product Owner
decision and not an occasion to reopen the rule.**

### 5. RESOLVED (delete) — the existing `specializationBridge` coefficients

> **2026-09-27 amendment — RESOLVED. The Product Owner chose option 1: delete the bridge.**
> The paragraphs below are preserved exactly as first recorded, as provenance of what was open
> and of the three options weighed. The settled answer is
> [Ruling 5 settled — delete the mechanism](#ruling-5-settled--delete-the-mechanism-2026-09-27-amendment)
> immediately after them. **Ruling 5 no longer blocks rulings 1 and 2.**

**Open as first recorded. Not resolved by the 2026-09-26 record. It blocked implementation of
rulings 1 and 2 until the 2026-09-27 amendment below.**

Rulings 1 and 2 both state that **no numerical relationship coefficient is approved
and none may be inferred.** An Orchestrator architecture inspection at this
amendment's baseline established that **relationship parameters for both competencies
already exist in shipped content metadata**:

- `packages/content/src/skillRelationshipMetadata.ts:44-52` carries a
  `specializationBridge` for `longbow` whose parent skill is `bow`, alongside
  `specializationOfSkillId: "bow"`;
- `packages/content/src/skillRelationshipMetadata.ts:86-93` carries a
  `specializationBridge` for `fencing` whose parent skill is `one_handed_edged`.

Each bridge carries **live numeric parameters** — a parent-level threshold, a
parent-excess offset and a reverse factor. **Their values are deliberately not
reproduced in this record**, consistent with both rulings approving none; they are
cited by file and line so the decision can be taken against the actual data. The
canonical source already flags them as unapproved: "Synthetic Longbow Specialization
and Fencing bridge. Their parameters are not Pilot transfer values"
(`docs/source/competencies/Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt:7562`).

Reclassifying either competency to a base Skill therefore forces a choice among three
options, **each of which requires a Product Owner decision**:

1. **delete the bridge** — a behaviour change for existing content, fixtures and
   characters;
2. **keep the bridge** — which contradicts base-Skill status, since the bridge exists
   to model a Specialization's relation to its parent; or
3. **convert the bridge** into an ordinary authored relationship — which would
   require **approving coefficients that both rulings explicitly withhold**.

**No option is chosen here, no coefficient is written here, and none may be inferred
from the ordering above.** Until the Product Owner decides, rulings 1 and 2 remain
unimplementable: an implementation contract for either **must carry this decision**
before it may touch `packages/content/src/skillRelationshipMetadata.ts`.

#### Ruling 5 settled — delete the mechanism, 2026-09-27 amendment

**The Product Owner ruled on 2026-09-27:**

> Delete `specializationBridge` from the target/runtime model, including
> `specializationBridgeSchema` and both schema fields, provided the verified no-consumer finding
> still holds. Preserve recovered bridge values as provenance only; no compatibility/runtime
> behavior remains.

**Option 1 above is chosen. Options 2 and 3 are rejected**: keeping the bridge would contradict
base-Skill status, and converting it would require approving coefficients both rulings withhold.
**No deleted numeric parameter is replaced by another number**, and the deletion creates no
relationship in either direction.

The authorization was **conditional on the no-consumer finding still holding at dispatch**. It was
re-verified against `dev` `8bc14f31b92663a652e8d398277b935537029ad1` and **holds**: exactly two
authored bridge objects existed repository-wide, the field was never persisted in any database
column, every live read recomputed present-tense values from content definitions with no version
gate, legacy flag or migration branch, and `validateCanonicalContent` re-applies the relationship
appliers to any stored canonical-content snapshot, so a stored value is recomputed rather than read
as legacy data.

**Recovered parameters, preserved here as provenance only — never as runtime data, schema or
approved rule.** These are the values the deleted objects carried at
`packages/content/src/skillRelationshipMetadata.ts`. **They were never approved, they are not Pilot
transfer values, and nothing may be derived from them:**

| Deleted bridge | Parent             | `threshold` | `parentExcessOffset` | `reverseFactor` |
| -------------- | ------------------ | ----------: | -------------------: | --------------: |
| `longbow`      | `bow`              |           6 |                    5 |               1 |
| `fencing`      | `one_handed_edged` |           6 |                    5 |               1 |

`longbow` additionally carried `specializationOfSkillId: "bow"`, which is deleted with it.
**`specializationOfSkillId` itself is retained** as generic Specialization plumbing; only Longbow's
use of it is removed.

What is deleted with the mechanism: both authored objects, the
`specializationRelationshipMetadataById` map and the synthetic-Specialization projection built on it,
`specializationBridgeSchema` and the `specializationBridge` field on **both** the Skill and
Specialization schemas, and every reader — the derived-relationship and selection-evaluation paths in
`packages/rules-engine`, the Chargen primary-allocation draft state, the V2 competency reference and
its `bridges` field, the web skill-reference and admin skill view-models, the Chargen wizard's
bridge-overlap suppression, and the AI-export script. The persisted progression schema keeps
accepting the retired `specialization-bridge-child` / `specialization-bridge-parent`
`relationshipGrantSourceType` values so stored rows still parse, but no code can produce one and no
surface displays one.

**Consequence for Longbow's tie to Bow.** The authored qualitative `helpful` dependency is preserved
byte-identical, exactly as ruling 2 requires. Deleting the bridge therefore removes a numeric
transfer that was never approved and leaves the relationship qualitative in both directions. Fencing
gains no dependency at all, because no Fencing ↔ one-handed edged relationship is approved in either
direction.

### Fencing's base-Skill metadata — 2026-09-27 amendment

Ruling 1 approved Fencing's reclassification without stating the metadata a base Skill needs. The
Product Owner settled it on 2026-09-27:

- **Base combat Skill.**
- **Linked stats STR / DEX — the same as one-handed edged.**
- **No elevated generic Society-Level restriction.** Fencing's availability horizon belongs to
  future Setting logic, not to generic combat — see
  [architecture decision 0006](../architecture/0006-setting-foundation.md), "Setting-level competency
  availability". Where the schema requires a generic numeric value, it takes **the same value as
  one-handed edged**.
- **Sorted immediately after one-handed edged** in Combat ordering.

No value here is invented: each is one-handed edged's own recorded value.

### Curriculum memberships and the military route — 2026-09-27 amendment

- **F30 teaches Fencing, Dodge and Parry.** `one_handed_edged` is removed; it was present only to
  satisfy the retired Specialization-parent model, and charging it alongside Fencing is the double
  investment ruling 1 removes.
- Where a Profession offers ordinary close combat versus Fencing, that is an **alternative Profession
  training route, not a choice inside F30**, and the retired one-handed-edged close-combat group is
  **not revived** to express it.
- **F41 teaches Longbow and Hunting** and charges **no Bow**. It is the civilian and hunting route.
- **F41 is not a Soldier route.** Independent access through some other Character history remains
  possible; it is simply not part of the Soldier package.
- **Military Longbow training comes directly through M04 and M05**, whose approved candidate pools
  gain `longbow`. This changes the **pool, not the count**: both slots keep
  `chooseCountStatus: "approved"` with their approved choose-one and choose-three counts.
- **No Hunting is granted to a military Longbow specialist** merely to obtain Longbow.
- **Legacy and historical missile groups are unchanged**, including the legacy
  `basic_missile_training` and `advanced_missile_training` candidate pools, which are frozen to their
  own four-family list rather than derived from the weapon-family constant.

### Weapon binding activation — 2026-09-27 amendment

Weapon templates and modes **already authored** as `Fencing` or `Longbow` resolve to those base
Skills after reclassification. Before it they resolved to `null`, because the combat inputs are built
only from the sheet's Skills and the weapon's skill is looked up by display name while
`specializationOfSkillId` excluded both competencies from every Skill surface. **That activation is
the intended repair of an existing gap, and it must not spread: ordinary one-handed-edged weapons are
not rebound to Fencing and ordinary bows are not rebound to Longbow.**

### Ordinary Bow's civilian route and F30's generic availability — 2026-09-27 rulings

Implementation surfaced two consequences of the rulings above, which the Product Owner settled the
same day.

**Ordinary Bow keeps a civilian route.** Because F41 no longer charges Bow, ordinary Bow would have
been taught by no civilian curriculum and would have become unreachable at Society Level 1. The
ruling: **restore `bow` as the accepted direct Hunter and Trapper ordinary-archery route**, which the
approved Profession catalogue already justifies for the non-longbow bow-hunting branch. Bow is **not**
recorded as a deliberate Society Level 1 absence and **not** flagged as a route gap — the route
exists, so the absence record must not mention it. Bow is **not** restored to F41.

**Fencing carries no elevated generic Society-Level restriction, and neither does F30.** F30 formerly
carried a Society Level 3 floor whose recorded reason was that swashbuckling fencing is a named school
of a specific urban fencing tradition. That is precisely the cultural/Setting restriction that must
**not** be encoded in generic combat content. The ruling: **F30's generic availability matches the
ordinary one-handed-edged route.** That route's controlling value is Society Level 1, because the
ordinary close-combat group carries no availability bound at all, so **F30's bound is withdrawn
entirely** rather than restated as an explicit floor. Fencing is **not** recorded as a Society Level 1
absence either. The close-order-drill group keeps its own bound, whose reason is force structure
rather than culture, and is untouched.

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

> **2026-09-26 amendment.** The same holds for Longbow: **no Longbow ↔ Bow
> relationship coefficient is approved anywhere in this record, and none may be
> inferred.** The preserved `helpful` dependency on Bow is a **qualitative**
> relationship and is preserved as such. The live numeric bridge parameters that
> already exist for both competencies are **not** an approval — see
> [ruling 5](#5-resolved-delete--the-existing-specializationbridge-coefficients).

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

**2026-09-26 amendment.** Longbow was then ruled on directly rather than by analogy,
as the paragraph above required, and it failed the same test Fencing failed: Bow and
Longbow answer the same gameplay purpose with the same weapon class, so the specialist
framing penalizes adopting the longbow. Restoring the legacy base-Skill model keeps
the authored qualitative tie to Bow without inventing arithmetic. The group-taught
question was settled by separating **access** from **Group XP**: a Group can be the
place a Specialization is taught without that Specialization inheriting the Group's
progression, which is the narrowest answer that makes the canonical corpus's explicit
Specialization listings executable.

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

**2026-09-26 amendment.** The third example's "until ruling 3 is decided"
precondition is **discharged**: the behaviour it describes is now the settled V1 rule,
not an interim position. These further examples are likewise stated for a future
implementation contract, and **this record still authorizes no test change.**

- After ruling 2 is implemented, `longbow` appears in `skills[]` and not in
  `specializations[]` in the canonical content, carries no `minimumParentLevel`, and
  retains its authored `helpful` dependency on `bow`.
- After ruling 2 is implemented, F41 grants Longbow and Hunting and neither grants nor
  charges Bow; and a Soldier longbow-specialist track obtains Longbow without F41 when
  Hunting is not part of that curriculum.
- Under ruling 3, a Learning Group that explicitly lists a genuine Specialization
  grants access to it and **no Group XP** in it; a later Group purchase adds no Group
  XP to it, and no retroactive catch-up occurs.
- No example asserts a Fencing ↔ one-handed edged or a Longbow ↔ Bow coefficient,
  because none is approved.

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

**2026-09-26 amendment.** The two preparation items above have since been ruled on.
As amended:

- **Still none applied by this record.** No content, schema, evaluator, importer,
  seed, UI, Chargen or test change is authorized.
- Ruling 2 will require a separately authorized content change of the same shape as
  ruling 1's, spanning the canonical content data, the canonical V2 corpus's F41, M04
  and M05 membership, the hardcoded Soldier longbow name match at
  `packages/content/src/targetProfessions.ts:125`, and the derived seed, export,
  report and test surfaces that reference `longbow`. Because it changes canonical
  competency data and stored-data semantics it is expected to be QA-floor class; the
  floor in [`AGENTS.md`](../../../AGENTS.md) governs, not this note.
- **Re-authoring the canonical prose** for Fencing and Longbow, which currently
  describes both as specializations, is a consequence of rulings 1 and 2 with its own
  authoring and review path. It is **not** authorized here.
- Ruling 3 is settled for V1 but **implements nothing**. Any group-acquisition,
  Chargen or UI behaviour change needs its own authorized contract.
- Ruling 4 authorizes **verification only** — a conformance check against an existing
  recorded rule, with any divergence handled as a defect.
- **Ruling 5 no longer blocks rulings 1 and 2.** The 2026-09-27 amendment resolves it as
  **delete**, which is what unblocked implementation. Rulings 1, 2 and 5 are implemented
  together as one atomic change by **Forgejo #389**, because the catalogue builders throw at
  module load if a declared group member's type disagrees with the catalogue, so no partial
  state builds; and because deleting the bridge alone would have removed the synthetic
  Specialization row while `specializationOfSkillId` still excluded Longbow from every
  base-Skill surface — **the failure mode is that Longbow silently disappears, not that it
  appears twice.**

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
- **2026-09-26 amendment authority:** the Product Owner's final competency rulings of
  2026-09-26, covering Longbow, Fencing, group-taught Specializations, and the
  standing of the existing overlap rule.
- Amendment facts verified at `dev` baseline
  `c75bb3503cbc5bbdb6ecdb435302725e633b99fd` against
  `packages/content/src/skillRelationshipMetadata.ts`,
  `packages/content/src/targetCompetencies.ts`,
  `packages/content/src/targetProfessions.ts`,
  `packages/content/src/data/canonicalContent.json`,
  `docs/product/proposals/competency-content-v2/competency-content-v2.json`, and
  `docs/source/competencies/Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt`,
  with the line citations given above. The runtime-symmetry finding was established by
  **executing** the competency projection at that baseline, not inferred from a schema
  default.
- Fencing's Setting availability is unchanged and is **cited, not restated**:
  [architecture decision 0006](../architecture/0006-setting-foundation.md),
  "Setting-level competency availability — 2026-09-26 amendment".
- The existing Learning Group overlap rule is **cited, not restated**:
  [Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md) section 4, lines 50, 57
  and 67.
- **2026-09-27 amendment authority:** the Product Owner's Fencing/Longbow implementation
  rulings of 2026-09-27, including the conditional bridge-deletion authorization and the two
  follow-up rulings on ordinary Bow's civilian route and F30's generic availability.
- Amendment facts verified at `dev` baseline
  `8bc14f31b92663a652e8d398277b935537029ad1`. The no-consumer precondition was re-verified by
  repository-wide search plus inspection of every reader and of the canonical-content snapshot
  path, and by confirming that no bridge-related file changed between the 2026-09-26 amendment's
  baseline and this one. Fencing's Combat ordering, Longbow's preserved `helpful` Bow dependency,
  the F30/F41 memberships, the M04/M05 pools, ordinary Bow's Society Level 1 reachability and
  F30's withdrawn bound were all verified by **executing** the real Chargen consumer
  construction, `withCompetencyContentV2(buildTargetRuntimeContent(createTargetCompetencyChargenSource(...)))`,
  not the legacy 59-group accessor.
