# R3D recovered case register

Status: authoritative recovery register for Forgejo issues #9-#17 as of
2026-09-03.

## Purpose, baseline, and evidence policy

R3D recovers exactly nine additional historical identities into the local
Forgejo control plane and restores the three accepted documentation outcomes
that did not reach recovered `dev`. It does not reconstruct the full historical
GitHub backlog.

- Canonical operational repository: private `recovery-admin/glantri-app` at
  `http://127.0.0.1:3001`.
- Exact accepted baseline: Forgejo
  `dev@ab05cfc2f4f4f3989b60b332a1ec8f1715abc735`.
- Historical GitHub issues, PRs, comments, and Git objects are evidence only.
  Forgejo issues and refs are current operational truth.
- `evidence/Repository` means Git objects, repository files/tests, or accepted
  recovery records support the fact.
- `evidence/Chat recovery` means the prior control-plane conversation supports
  the historical status, ruling, authorization, QA, or acceptance fact.

Repository evidence controls code and integration state. Chat recovery does not
manufacture an implementation or merge absent from Git. R3D changes
documentation and local Forgejo control-plane records only. It does not change
product code, schemas, dependencies, tests, R4, `main`, Azure, production,
deployment, protected databases, or runtime state.

## Exact old-to-new mapping

| R3D | Recovered source identity | New Forgejo identity                                                      | Builder-handoff disposition                                                                                  |
| --- | ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A   | GitHub #356 / PR #357     | [Forgejo #9](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/9)   | Open; `status/Ready for Independent QA`; mandatory documentation recovery; unassigned after Builder handoff. |
| B   | GitHub #355 / PR #358     | [Forgejo #10](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/10) | Open; `status/Ready for Independent QA`; mandatory documentation recovery; unassigned after Builder handoff. |
| C   | GitHub #369 / PR #370     | [Forgejo #11](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/11) | Open; `status/Ready for Independent QA`; mandatory documentation recovery; unassigned after Builder handoff. |
| D   | GitHub #349               | [Forgejo #12](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/12) | Open; `status/Design`; `state/Inactive`; `priority/Unassigned`; not authorized.                              |
| E   | GitHub #348               | [Forgejo #13](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/13) | Open; `status/Ready`; `state/Inactive`; `gate/Dependency`; `priority/Unassigned`; not authorized.            |
| F   | GitHub #220               | [Forgejo #14](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/14) | Open; `status/Design`; `state/Inactive`; `priority/Unassigned`; not authorized.                              |
| G   | GitHub #257               | [Forgejo #15](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/15) | Open; `status/Design`; `state/Inactive`; `priority/Unassigned`; not authorized.                              |
| H   | GitHub #320               | [Forgejo #16](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/16) | Open; `status/Ready`; `state/Inactive`; `priority/Unassigned`; not authorized.                               |
| I   | GitHub #354               | [Forgejo #17](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/17) | Open; Proposal/Design; `status/Design`; `state/Inactive`; `priority/Future`; not authorized.                 |

Every issue has exactly one exclusive `status/...` label and one exclusive
`priority/...` label. R3D adds only the minimal non-exclusive `type/Proposal`
label needed to describe #17 without changing its exclusive Design status.

## A — authority and information projection

- Historical identity: GitHub #356 / PR #357.
- Exact historical accepted head:
  `5df9ccc9748dc05a7cf4bd2ce0e72ed5e4a65121`.
- Historical state: independent QA PASS and control-plane acceptance.
- Recovery fact: the accepted head did not reach recovered `dev`.
- Current issue: [Forgejo #9](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/9).

The recovered
[Authority and Information Projection Principle](../architecture/information-authority-and-projection.md)
keeps canonical authority, action authorization, viewer-specific information
projection, and rendered presentation distinct. Protected facts are absent from
unauthorized payloads, serialized state, generated HTML, and rendered output;
client hiding or a rejected mutation is not sufficient evidence.

R3D used the historical accepted head as evidence and freshly reconciled the
guidance to current Forgejo/process semantics. Fresh independent QA and
integration are still required.

## B — strategic development areas and Proposal-to-Design workflow

- Historical identity: GitHub #355 / PR #358.
- Exact historical accepted head:
  `0689a9fe10056afe6a823e36a855ab93d946a3cf`.
- Recovery fact: the accepted documentation did not reach recovered `dev`.
- Current issue: [Forgejo #10](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/10).

The fresh
[strategic portfolio and future register](../product/2026-09-03-strategic-future-register.md)
uses current Forgejo identities and records
`Proposal -> Architecture review -> Design -> Ready -> Authorized -> Active`.
Proposal, Architecture review, Design, and Ready do not grant implementation
permission. The register covers Campaign objects, old #354, Player Universe,
AI-assisted recaps, Artifact Studio/content workflows, the contributor
ecosystem, and economy/value/Creative-point ideas.

## C — Skill Catalogue qualitative architecture

- Historical identity: GitHub #369 / PR #370.
- Exact historical accepted head:
  `5f0de383442bedad878ba8a48a306844ac0d17a2`.
- Recovery fact: the accepted decision did not reach recovered `dev`.
- Current issue: [Forgejo #11](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/11).

The historical branch used rule-decision number `0001`, but recovered `dev`
already assigns `0001` to the C1 Critical recalibration. R3D therefore uses the
next non-conflicting rule-decision number:
[0002 — Skill Catalogue qualitative architecture](../decisions/rules/0002-skill-catalogue-qualitative-architecture.md).
This follows the repository's explicit category-local convention: decision
numbers are sequential within each directory. Architecture `0002` is therefore
independent of rules `0002`. Fresh QA must inspect every decision filename plus
the root, architecture, and rules indexes and confirm the corpus is unambiguous.

The decision preserves all 19 navigation domains, non-mechanical domain and
cross-discovery semantics, concrete Skills versus Specializations, DS/AB access,
separate spoken/written competence, explicit directional relationships, and
narratable overlapping learning histories. It is reconciled with current Pilot
Skill v1 authority without changing any quantitative mechanics, content,
calibration, arithmetic, fixture, migration, or runtime behavior.

## D — structured-condition authority

[Forgejo #12](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/12)
recovers old #349 as open Design/Inactive/Unassigned and not authorized. It owns
only the remaining cross-system identity, lifecycle, persistence, privacy/
projection, GM correction/supersession, and producer-compatibility questions.
It does not reopen #361, #363, #364, integrated C1, or create a new condition or
action engine. It explicitly gates #13.

## E — accumulated-damage thresholds and warnings

[Forgejo #13](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/13)
recovers old #348 with its exact title. It is Ready but dependency-gated,
inactive, unassigned, open, and not authorized. Before dispatch it requires a
fresh contract and baseline, reconciliation with #12 and current Critical/
condition rulings, and new explicit authorization. It creates no new condition
or action engine.

## F — critical injuries and recovery risk

[Forgejo #14](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/14)
recovers old #220 with exact title `Critical injuries, evolving effects, and
analyzable recovery risk`. It preserves mortality/death clocks, permanent
characteristic/function loss, deterioration/stabilization/recovery cadence,
treatment transitions, hidden diagnoses, and physiological shock distinct from
pain/morale. It excludes integrated C1 Stun/Bleed and R3C #393 and invents no
decision.

## G — Character Knowledge and mechanical activation

[Forgejo #15](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/15)
recovers old #257 as Design/Inactive/Unassigned and not authorized. It preserves
stable Character-scoped knowledge receipts, reveal/correction/supersession,
provenance, deliberate sharing, controller continuity, privacy-safe projection,
and knowing versus mechanically activating. It is separate from #16 and from
the integrated Blackboard's bounded restricted-detail grants.

## H — safe search and canonical reference index

[Forgejo #16](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/16)
recovers old #320 as Ready/Inactive/Unassigned and not authorized. Before any
authorization, its contract must be refreshed against the integrated
Blackboard's four-entry boundary, current Artifact authority, Character
Knowledge #15, and current information-projection guidance.

## I — player-authored Campaign objects

[Forgejo #17](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/17)
recovers old #354 as a standalone Proposal/Design issue with status Design,
priority Future, state Inactive, open, and not authorized. It depends on ideas
from #15, Campaign-object authority, Artifact, collaboration, later economy/
value/ledger work, and Creative points. It grants no schema, mechanics, or
implementation authority and is included in the strategic register.

## Durable omission and deferment boundary

R3D intentionally creates no historical case beyond the nine identities above.
The following old GitHub identities are not recreated by R3D:

- `#340`, `#258`, `#361`, `#363`, `#364`, `#368`, `#371`, `#372`, `#377`,
  `#378`, `#379`, `#380`, `#382`, `#346`, `#287`, `#388`, `#389`, `#213`,
  `#318`, `#319`, `#342`, `#345`, `#350`, `#352`, `#359`, `#365`, and `#373`;
  and
- `#279`, `#280`, `#306`, and `#309`.

Their historical evidence may remain linked where needed to explain an accepted
boundary. A link is not issue recreation, backlog adoption, current status, or
implementation authorization. Integrated behavior represented by omitted cases
remains governed by current repository code, tests, decisions, and existing
Forgejo recovery records.

## Handoff boundary

The R3D Builder leaves #9, #10, and #11 open at
`status/Ready for Independent QA` against one immutable documentation-only PR
head and releases their active ownership. Only a fresh independent QA pass and
later control-plane acceptance may advance them. The Builder does not merge the
PR or close these issues.

Issues #12-#17 remain exactly in their ruled inactive metadata/body states. R3D
does not authorize, dispatch, or modify product work for them.
