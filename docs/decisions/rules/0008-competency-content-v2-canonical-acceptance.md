# Rule decision 0008: Competency Content V2 canonical acceptance

- Status: approved
- Date: 2026-09-23
- Product owner: Vidar Hald
- Related issues/PRs: Forgejo #250 (umbrella #249), successor #266; unblocks #251, #252
- Complements: [Chargen and Competency Experience Product Contract](../../product/chargen-competency-experience-contract.md); the corpus itself under [`docs/product/proposals/competency-content-v2/`](../../product/proposals/competency-content-v2/README.md)
- Supersedes: none — this record does not change any prior rule decision. It changes only the
  status of the Competency Content V2 corpus itself, from Product Owner proposal to accepted
  canonical content.
- Superseded by: none

## Question

Is the Competency Content V2 corpus (Learning Groups, Profession families/paths/core routes,
player-facing categories and Civilization languages, and Society Level / Social Band route
availability) now Glantri's canonical competency content, or does it remain a Product Owner
proposal pending further review?

## Evidence and provenance

- [`docs/product/proposals/competency-content-v2/README.md`](../../product/proposals/competency-content-v2/README.md)
  and the reports it indexes, authored from
  `packages/content/src/proposals/competencyContentV2/`.
- The completion gate run against `dev` at `de1da0ab5794d407c69097581dea8115ccaf6597`, which
  established, independently:
  - outputs regenerate byte-identically and committed outputs are current;
  - 84 Profession families, 86 valid paths, and 90 core routes, none blocked;
  - exactly two families carry tracks (Sailor, Surgeon), per the settled #266 ruling;
  - all 42 specialization/parent pairs are reachable;
  - all 11 written competencies are reachable, with floors derived and the lowest — Old Italic —
    at Society Level 2;
  - all 24 Society Level x Social Band cells are non-empty and monotonic in both directions;
  - no-invention enforcement is a build-time throw;
  - zero defects and zero blocking incompleteness.
- The Product Owner's acceptance, recorded 2026-09-23: "Accept Content V2 canonical now. It is
  independent of this test-harness problem and its completion gate is clean. Unblock #251/#252."

## Conflict or limitation

Before this ruling, the corpus carried the status constant
`COMPETENCY_CONTENT_V2_STATUS = "non-canonical-product-owner-proposal"` and matching
NON-CANONICAL banners throughout its documents, reflecting that the 2026-09-21 rulings had closed
Content V2 **product design** (see the corpus README's "Remaining Product Owner decisions"
section) without yet making the catalogue itself canonical. Those two things — design closure and
canonical acceptance — were deliberately kept distinct in the prior record; this decision is the
separate, later act that settles the second one.

This ruling is independent of, and not blocked by, the unrelated test-harness problem the Product
Owner's acceptance comment refers to.

## Ruling

**Competency Content V2 is canonical Glantri content**, effective 2026-09-23, on the Product
Owner's acceptance above and the clean completion gate run against `dev` at
`de1da0ab5794d407c69097581dea8115ccaf6597` that justifies it.

This ruling is a **status change only**:

1. The status constant `COMPETENCY_CONTENT_V2_STATUS` changes from
   `"non-canonical-product-owner-proposal"` to `"canonical-product-owner-accepted"`, and every
   document banner and status assertion that encoded the non-canonical value is updated to match.
2. No Profession, route, group, skill, language, core, or availability data changes as part of
   this ruling. The content accepted here is exactly the content the completion gate verified.
3. The corpus is **not** wired into any runtime or application path by this ruling. It remains
   deliberately unexported from `packages/content/src/index.ts`, unprojected into
   `CanonicalContent`, and unreachable from Chargen. Making the application consume it is the
   separate, explicitly scoped work of **#251** and **#252**, which this ruling unblocks.
4. The corpus's own location under `docs/product/proposals/competency-content-v2/` and
   `packages/content/src/proposals/competencyContentV2/` is unchanged. Canonical acceptance is not
   a relocation; any future rename or move is separate, coordinated work.

## Reasoning

The completion gate is the mechanism this repository already uses to verify content correctness
and completeness independent of the test-harness problem the Product Owner's acceptance comment
distinguishes it from. Its clean run against the accepted `dev` baseline is sufficient evidence
for the Product Owner's acceptance, and nothing about that acceptance requires or implies
premature runtime wiring, which stays properly scoped to #251/#252.

## Executable examples

- `COMPETENCY_CONTENT_V2_STATUS` (exported from
  `packages/content/src/proposals/competencyContentV2/competencyContentV2Source.ts`) equals
  `"canonical-product-owner-accepted"`.
- `competencyContentV2Catalogue.status` equals `"canonical-product-owner-accepted"`.
- `docs/product/proposals/competency-content-v2/competency-content-v2.json`'s `"status"` field
  equals `"canonical-product-owner-accepted"`, regenerated from the same source.

## Implementation consequences

- Documentation and status metadata only: the corpus's document banners, the source module's
  header comments, and the generator's banner template are updated to state CANONICAL status and
  cite this record.
- `packages/content/src/proposals/competencyContentV2/competencyContentV2.test.ts` asserts the new
  canonical status value in place of the retired non-canonical one.
- No schema, evaluator, importer, UI, or Chargen change is authorized by this record. #251 and
  #252 remain the authority for any runtime wiring.

## Verification and traceability

- Portfolio: Forgejo #250 (umbrella #249), successor #266.
- Completion gate: run against `dev` at `de1da0ab5794d407c69097581dea8115ccaf6597`, clean.
- Product Owner acceptance: 2026-09-23 comment, "Accept Content V2 canonical now. It is
  independent of this test-harness problem and its completion gate is clean. Unblock #251/#252."
- Corpus: [`docs/product/proposals/competency-content-v2/README.md`](../../product/proposals/competency-content-v2/README.md).
- Source: `packages/content/src/proposals/competencyContentV2/`.
