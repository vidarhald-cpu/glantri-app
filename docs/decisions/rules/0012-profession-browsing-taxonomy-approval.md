# Rule decision 0012: Profession browsing taxonomy approval

- Status: approved
- Date: 2026-09-27
- Product owner: Vidar Hald
- Related issues/PRs: Forgejo #372 (blocking roster dependency discharged); PR #379
  (`codex/profession-category-taxonomy`)
- Supersedes: none
- Superseded by: none

## Question

Should Glantri adopt the proposed 16-category player-facing Profession browsing taxonomy (PR #379)
as the approved roster for Forgejo #372's Chargen Profession/acquisition presentation, or should the
three smallest categories be folded into larger ones to give 13 categories?

## Evidence and provenance

- [`docs/source/professions/profession-category-taxonomy-v1.md`](../../source/professions/profession-category-taxonomy-v1.md)
  (moved from `proposed/` on this ruling): 16 categories, the complete 84-family mapping, the §4
  ambiguous-case log, and the §5 assessment.
- `docs/product/proposals/competency-content-v2/competency-content-v2.json` — canonical 84
  Profession families, verified mapped exactly once each, none duplicated, none invented.
- Orchestrator PR #379 review packet (2026-09-27): recomputed distribution and verified the
  16-category totals.
- Orchestrator PR #379 follow-up comment (2026-09-27): recomputed the fold's arithmetic and
  itemized the 9 Professions the fold would move against the receiving categories' own stated
  boundaries.

## Conflict or limitation

§5 of the proposal offered folding the three smallest categories — **Guarding and Arms Training**
(3), **Letters and Teaching** (3), and **Religion and Divination** (3) — into **Military Service**
and **Learning and Inquiry**, and stated this "would give thirteen categories with a largest size of
eleven." **That figure is wrong.** Two categories fold into Learning and Inquiry, not one: Letters
and Teaching and Religion and Divination both move there, on top of its existing 8, giving
8 + 3 + 3 = **14**. Military Service alone becomes 8 + 3 = 11. The corrected 13-category
distribution is 14, 11, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4.

Beyond the arithmetic, 8 of the 9 moved Professions conflict with the receiving category's own
stated "Does not belong here" boundary:

| Moved                          | Into                 | Conflicts with                                    |
| ------------------------------ | -------------------- | ------------------------------------------------- |
| P14 Guard, Watcher and Escort  | Military Service     | excludes "Civil guarding"                         |
| P15 Enforcer                   | Military Service     | excludes "Civil guarding"                         |
| P82 Weapon Instructor          | Military Service     | excludes "Civil guarding"                         |
| P64 Teacher                    | Learning and Inquiry | excludes "Teaching it to others"                  |
| P65 Scribe and Copyist         | Learning and Inquiry | excludes "Teaching it to others"                  |
| P66 Translator and Interpreter | Learning and Inquiry | excludes "Teaching it to others"                  |
| P74 Religious Practitioner     | Learning and Inquiry | excludes "religious or divinatory interpretation" |
| P75 Diviner                    | Learning and Inquiry | excludes "religious or divinatory interpretation" |

Only **P71 Astrologer** (Religion and Divination → Learning and Inquiry) moves cleanly — it also
resolves an existing §4 ambiguous case rather than creating a new conflict. One clean move is not
sufficient reason to distort the taxonomy.

## Ruling

**Approve the 16-category Profession taxonomy**, exactly as authored in
`docs/source/professions/profession-category-taxonomy-v1.md` §§1-4 (the 16 categories, their scope
statements, and the complete 84-family mapping), as the **approved player-facing browsing taxonomy
for Forgejo #372**, effective 2026-09-27.

**Reject the proposed 16→13 folds.** The corrected arithmetic (largest 14, not 11) and the 8-of-9
boundary conflicts above are not sufficient reason to distort the taxonomy. Only the Astrologer move
is clean, which is not enough on its own. No category is folded, renamed, or re-authored to force a
smaller count.

This ruling discharges Forgejo #372's blocking dependency on an authored Profession browsing roster
(its dependency previously recorded the roster as unauthored and blocking for the chooser work).
#372 remains held behind its other stated sequencing (the acquisition repairs #381/#382) independent
of this ruling.

## Reasoning

The 16-category roster narrows well on its own terms: picking one category leaves at most 8
Professions to scan, against 84 today, matching the order of the existing 17 player-facing Skill
categories. The fold does not improve on this — its corrected largest category (14) is nearly double
the 16-category roster's maximum (8) — and it is reached only by moving 8 of 9 Professions into
categories whose own authored scope statements exclude them. Preserving the taxonomy's internal
consistency, a category's members matching its own stated boundary, outweighs reducing the category
count by three.

## Executable examples

- The Profession browsing chooser for #372 offers exactly 16 categories, matching
  `docs/source/professions/profession-category-taxonomy-v1.md` §1.
- Every one of the 84 canonical Profession family codes (`competency-content-v2.json` `families[]`)
  appears in exactly one category per §3's mapping; none is folded, merged, or reassigned.
- No category's scope statement or "Does not belong here" boundary is edited by this ruling.

## Implementation consequences

- Documentation only: `docs/source/professions/profession-category-taxonomy-v1.md` moves from
  `proposed/` to the accepted parent directory, and its status banner changes from proposed to
  approved. No category, scope statement, or family placement changes.
- No mechanics (cost, level, XP, progression, eligibility, or acquisition rule) are introduced or
  implied by this ruling.
- Actual Chargen chooser implementation remains the separate, not-yet-dispatchable scope of #372,
  sequenced after #381/#382.

## Verification and traceability

- Portfolio: Forgejo #372 (blocking dependency discharged); PR #379 (`codex/profession-category-taxonomy`).
- Product Owner ruling, 2026-09-27: "Approve the 16-category Profession taxonomy. Reject the
  proposed 16→13 folds... Record the 16-category roster as the approved player-facing browsing
  taxonomy for #372. Do not re-author the categories to force a smaller count."
- Orchestrator PR #379 review packet and follow-up comment (2026-09-27), recomputing the fold's
  distribution and enumerating the 9 moved Professions' boundary conflicts.
- Roster: [`docs/source/professions/profession-category-taxonomy-v1.md`](../../source/professions/profession-category-taxonomy-v1.md).
