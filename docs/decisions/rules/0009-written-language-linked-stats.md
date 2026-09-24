# Rule decision 0009: Written-language linked stats

- Status: approved
- Date: 2026-09-24
- Product owner: Vidar Hald
- Related issues/PRs: Forgejo #306 (canonical Content V2 runtime projection foundation)
- Supersedes: none
- Superseded by: none

## Question

Competency Content V2 authors **11** canonical written-language competencies. The runtime target
catalogue (`packages/content/src/targetCompetencies.ts`) defines linked stats for only **three**
of them — `written:mogrebi:sacred-mogrebi`, `written:ologian:church-ologian`, and
`written:phoenician:phoenician` — each `["int", "int"]`. Runtime skill definitions require linked
stats (`packages/domain/src/content/skills.ts:519`), and the existing projection logic explicitly
forbids resolving written-tradition linked stats by inheritance from generic Literacy or Language
(`packages/content/src/targetCompetencies.ts:129`). What linked stats apply to the remaining eight
written competencies, and is following the pattern of the three existing examples a Builder
inference or a Product Owner decision?

## Evidence and provenance

- `packages/content/src/targetCompetencies.ts:80-82` — the three existing `approvedLinkedStats`
  entries for written traditions, each `["int", "int"]`.
- `packages/content/src/targetCompetencies.ts:129` (`resolveLinkedStats`) — written-tradition
  entries are deliberately excluded from the spoken-language/legacy-counterpart inheritance paths;
  the surrounding comment states: "Written traditions deliberately cannot reuse generic Literacy or
  Language."
- `packages/domain/src/content/skills.ts:519` (`chargenTargetSkillDefinitionSchema`) —
  `linkedStats` is a required, non-empty array for any competency entering the runtime Chargen
  representation.
- Competency Content V2 corpus (`docs/product/proposals/competency-content-v2/`, canonical per
  [rule decision 0008](0008-competency-content-v2-canonical-acceptance.md)) — the full set of 11
  written-language competency identifiers.
- A Builder working #306 correctly stopped rather than assign linked stats to the eight
  undefined written competencies by analogy to the three existing examples, and reported that it
  could not proceed without a Product Owner ruling.

## Conflict or limitation

Eight of the 11 canonical written competencies have no runtime linked-stats definition, and the
projection's own no-inheritance rule (cited above) removes the one mechanism — borrowing from
generic Literacy or Language — that could otherwise supply a value automatically. The three
existing entries are consistent with a uniform `["int", "int"]` rule, but consistency is not
authority: extending that pattern to the other eight without an explicit ruling would have been a
Builder inference of an undocumented rule, which is outside Builder authority. This is exactly why
a decision record was required rather than a routine implementation fill-in.

## Ruling

**For V1, all written-language competencies use linked stats `["int", "int"]`.** This applies
uniformly to all 11 canonical written competencies, including the eight that currently lack a
runtime definition:

- `written:scandian:runic-scandian`
- `written:common`
- `written:old-common`
- `written:nkolian:royal-nkolian`
- `written:old-latin:old-italic`
- `written:mycenaean-greek:linear-b`
- `written:sumerian:cuneiform`
- `written:imperial-aramaic`

together with the three that already carry `["int", "int"]` in
`packages/content/src/targetCompetencies.ts`: `written:mogrebi:sacred-mogrebi`,
`written:ologian:church-ologian`, and `written:phoenician:phoenician`.

**This is a decision, not an inference.** The three pre-existing entries are _consistent with_
this ruling; they are not its basis, and their prior existence did not by itself authorize
extending the same value to the other eight. The Product Owner is recording `["int", "int"]` as an
**explicit current rules decision** for all 11 written competencies, uniformly, precisely because
generalizing from the three examples would have been a rule inference no Builder is authorized to
make on its own.

**What remains prohibited:**

- **Differentiated linked stats** for any written-language competency are not authorized by this
  ruling. All 11 use the same pair.
- **Historical-source reconciliation** to look for differentiated linked stats among the 11 is not
  authorized unless a future product requirement reopens the question (see below).
- The existing prohibition on inheriting written-tradition linked stats from generic Literacy or
  Language (`packages/content/src/targetCompetencies.ts:129`) **still stands**. This ruling does
  not relax, narrow, or otherwise change that prohibition; it settles the linked-stats _value_ by
  explicit decision instead of by the inheritance path that prohibition forecloses.

**Reopening condition.** This ruling is revisited only if a future product requirement reopens the
question of differentiated written-language linked stats. Nothing short of that — including
availability of new historical source material on its own — reopens it.

**Not precedent.** This ruling settles linked stats for the 11 canonical written-language
competencies only. It must not be cited as precedent for deriving, inferring, or extending linked
stats for any other competency, skill, or category.

## Reasoning

The runtime schema requires a non-empty `linkedStats` array before any competency can enter the
Chargen representation, and the projection's own logic already forecloses supplying that value
through inheritance for written traditions. That leaves only an explicit Product Owner value. The
Product Owner chose uniformity — `["int", "int"]` for all 11 — over a differentiated, per-tradition
value, judging that the historical-source reconciliation a differentiated approach would require is
not a V1 requirement. Recording the choice as a decision, rather than letting a Builder infer it
from the three existing examples, keeps the distinction between "consistent with" and "the basis
for" intact, and keeps the no-inheritance rule from being silently defeated by analogy.

## Executable examples

- `packages/content/src/targetCompetencies.ts`'s `approvedLinkedStats` map, once #306 implements
  this ruling, contains an `["int", "int"]` entry for each of the 11 identifiers listed above
  (three already present; eight newly added).
- For each of the 11 identifiers, `resolveLinkedStats` returns
  `{ status: "approved", linkedStats: ["int", "int"] }`.
- `chargenTargetSkillDefinitionSchema` validation succeeds for all 11 written-language target
  competencies, with `linkedStats` equal to `["int", "int"]` in each case.

## Implementation consequences

- `packages/content/src/targetCompetencies.ts`'s `approvedLinkedStats` map gains eight new
  `["int", "int"]` entries, one per identifier listed above. Implementing this is #306's work, not
  this record's.
- No change to the no-inheritance logic in `resolveLinkedStats` is authorized or implied.
- No change to the Competency Content V2 corpus content itself (identifiers, names, descriptions,
  reachability) is authorized or implied; this ruling settles a runtime metadata gap only.

## Verification and traceability

- Portfolio: Forgejo #306 (canonical Content V2 runtime projection foundation).
- Product Owner ruling, 2026-09-24, recorded verbatim: "For V1, all written-language competencies
  use linked stats `[int, int]`. Apply this uniformly to all 11 canonical written competencies,
  including the eight currently lacking runtime definitions: `written:scandian:runic-scandian`,
  `written:common`, `written:old-common`, `written:nkolian:royal-nkolian`,
  `written:old-latin:old-italic`, `written:mycenaean-greek:linear-b`,
  `written:sumerian:cuneiform`, `written:imperial-aramaic`. Record this as an explicit current
  rules decision rather than an inference from the three pre-existing examples. Do not undertake
  historical-source reconciliation looking for differentiated linked stats unless a future product
  requirement reopens that question."
- Prior art: `packages/content/src/targetCompetencies.ts:80-82` (three pre-existing examples,
  consistent with but not the basis for this ruling); `packages/content/src/targetCompetencies.ts:129`
  (standing no-inheritance rule, unchanged by this ruling);
  `packages/domain/src/content/skills.ts:519` (linked-stats requirement).
- Related: [rule decision 0008](0008-competency-content-v2-canonical-acceptance.md) (Competency
  Content V2 canonical acceptance; this record settles a runtime metadata gap the projection work
  it unblocks encountered).
