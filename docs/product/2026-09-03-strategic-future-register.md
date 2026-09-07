# Glantri strategic portfolio and future register

Status: current portfolio guidance recovered on 2026-09-03.

Observed against canonical local Forgejo
`dev@ab05cfc2f4f4f3989b60b332a1ec8f1715abc735`. The live Forgejo issues and
pull requests are operational truth for status, ownership, dependencies,
authorization, exact heads, QA, and integration. Historical GitHub records and
Git objects are evidence only.

This register helps the product owner, contributors, and agents find current
direction before proposing or claiming work. It is not a dispatch ledger and
grants no implementation authority.

## Discovery-to-delivery lifecycle

New product directions move through distinct states:

`Proposal -> Architecture review -> Design -> Ready -> Authorized -> Active`

- **Proposal** records a useful problem, opportunity, or product concept for
  discovery. It does not choose architecture or authorize implementation.
- **Architecture review** identifies domain authority, ownership, information
  flow, compatibility, and cross-area boundaries before a consequential design
  is treated as implementable.
- **Design** records accepted decisions and deliberately open questions. It is
  still not implementation permission.
- **Ready** means a self-contained implementation contract is complete and
  current against an exact baseline. Ready alone is not permission to start.
- **Authorized** is the separate product-owner/control-plane dispatch decision.
  It is valid only for the named scope, baseline, gates, and Git authority.
- **Active** requires actual Builder or QA ownership. Strategic attention does
  not occupy an execution lane.

After Builder handoff, independent QA, control-plane acceptance, and integration
remain separate stages under the
[development control plane](../process/control-plane.md).

## Current recovered portfolio

The accepted recovered product-code foundation remains the lineage documented
by the [local control-plane recovery baseline](../recovery/2026-09-03-local-control-plane-recovery-baseline.md).
R3B and R3C recovered the minimum operational portfolio as Forgejo issues #1-#8.
R3D adds exactly nine historical identities as Forgejo issues #9-#17; their
self-contained state is in the
[R3D recovered case register](../recovery/2026-09-03-r3d-recovered-case-register.md).

At R3D Builder handoff:

- [#9](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/9),
  [#10](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/10), and
  [#11](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/11) are the three
  documentation-recovery cases awaiting fresh independent QA;
- [#12](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/12) through
  [#17](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/17) remain open,
  inactive, and not authorized in their ruled Design/Ready states; and
- the prepared R4 localhost inspection contract remains separate operational
  work. R3D does not start the Glantri app or change R4.

## Established foundations that constrain future design

### Artifact authority

The approved [Campaign Artifact storage boundary](../decisions/architecture/artifact-storage.md)
owns Campaign-scoped content identity, authenticated binary access, safe common
projection, publication channels, lifecycle, and storage-locator secrecy.
Artifacts are not a generic Campaign-object, Player Universe, knowledge,
marketplace, or economy authority.

### Blackboard boundary

The integrated Blackboard has four entry categories: clue/fact, document text,
image/map, and GM-approved recap. Its restricted-detail grants and viewer
capabilities are bounded Blackboard features. They do not create a generic
Character Knowledge model, canonical reference index, AI-generation authority,
or Artifact ownership.

### Authority and information projection

The [Authority and Information Projection Principle](../architecture/information-authority-and-projection.md)
keeps canonical authority, action authorization, viewer projection, and
rendering separate. Protected facts are absent from unauthorized payloads, not
merely hidden in the client. Every future knowledge, search, collaboration,
recap, and Campaign-object design must respect that boundary.

## Near and future design areas

### Skills product area

The accepted [Skills product-area roadmap](./skills-product-roadmap.md) makes
Skills the current highest-priority product area and sequences the bounded Pilot
documentation model, read-only Admin review, Pilot content acceptance, full
usable catalogue rollout, and only then preserved Chargen/Character integration.
Its six operational cases remain governed by their live Forgejo status and
separate authorization; the roadmap itself grants no implementation authority.

### Campaign play lifecycle

The accepted
[Campaign play lifecycle decision](../decisions/architecture/0003-campaign-play-lifecycle.md)
defines the first game-usable Campaign, Scenario, Encounter, and optional Combat
journey without replacing the mature Combat surfaces or creating a new session
engine. The bounded
[#34-#40 roadmap](./campaign-play-lifecycle-roadmap.md) records current sequencing,
the #16 Campaign-shell dependency, Critical/Combat hotspot gate, and single-owner
migration and shared-E2E rules. Live Forgejo state remains authoritative; the
roadmap does not authorize its inactive Ready or Design cases.

### Player-authored Campaign objects

[Forgejo #17](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/17)
recovers old GitHub #354 as a standalone Proposal/Design item. It explores
player-created proposals for Campaign-world objects with deliberate GM review
before canonicalization, publication, sharing, or mechanical activation.

Dependencies include Character Knowledge
[#15](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/15), Campaign-object
authority, the Artifact boundary, collaboration and revision, later
economy/value/ledger work, and the old Creative points idea. No generic object
type, schema, economy, or implementation is authorized.

### Character Knowledge

[Forgejo #15](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/15)
preserves stable Character-scoped knowledge receipts, reveal/correction/
supersession, provenance, sharing, controller continuity, and the distinction
between knowing a fact and mechanically activating it. It remains Design,
inactive, and separate from Blackboard detail grants and safe search.

### Safe search, filters, and canonical reference index

[Forgejo #16](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/16)
is `status/Integrated`, and PR #33 is merged. Its accepted safe-search contract
preserves the four-entry Blackboard boundary, current Artifact authority,
Character Knowledge #15, and server-side projection rules. Search does not
become canonical content, publication, visibility, knowledge, or mechanical
authority.

### Structured conditions and accumulated damage

[Forgejo #12](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/12)
holds the remaining structured-condition identity, lifecycle, persistence,
privacy, GM correction, and producer-compatibility design. It does not reopen
integrated C1.

[Forgejo #13](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/13)
is dependency-gated on #12 and current Critical/condition rulings. Its old
accumulated-damage threshold/warning contract requires refresh and new explicit
authorization; it creates no new condition or action engine.

### Critical injuries and recovery risk

[Forgejo #14](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/14)
preserves future design for mortality/death clocks, permanent characteristic or
function loss, deterioration/stabilization/recovery cadence, treatment
transitions, hidden diagnoses, and physiological shock distinct from
pain/morale. It excludes integrated C1 and the recovered #393 decision and
contains no invented mechanics.

### AI-assisted recaps

Structured Scenario, Encounter, Skill, and Combat history could support a draft
recap for deliberate GM review and publication. Generated text must never become
canonical or visible by inference. This direction depends on reliable history,
audience-safe projection, an explicit approval workflow, provider/governance
decisions, and a separate Proposal/Design record before implementation.

### Artifact Studio and content workflows

A future studio could support authoring, revising, approving, organizing, and
publishing Campaign content with durable provenance. The current Artifact
decision is a secure storage and publication foundation, not authorization for
a Studio, generation provider, transform service, cross-Campaign library, or
player upload workflow.

### Contributor and content ecosystem

External contributors may eventually create bounded content through stable,
versioned, reviewable contracts rather than direct access to canonical state.
Security, provenance, compatibility, validation, governance, and mature review
flows must be designed first. No contributor platform or extension marketplace
is authorized.

### Economy, value, and Creative points

Campaign resources may later need explicit value units, budgets, ledgers,
commitments, ownership, and costs. Player-authored objects #17 preserves the old
Creative points idea as a dependency/question only. No unit, price, grant,
spending rule, or generic economy behavior is decided here.

### Player Universe

Player Universe describes possible persistent player-created, acquired,
controlled, or developed resources beyond a Character sheet: buildings,
retainers, organizations, businesses, estates, and units. It depends on
accepted Campaign-object identity, ownership/control/visibility, lifecycle,
canonical reference, collaboration, and economy decisions. It remains strategic
direction, not an implementation initiative.

## Agent guidance

- Search live Forgejo issues before creating a proposal or task; link the
  nearest current record and avoid duplicates.
- Historical GitHub issues, PRs, comments, and commits are evidence, not live
  status or permission.
- A strategic area, dependency chain, Proposal, Architecture review, Design, or
  Ready contract never implies authorization.
- Re-read the live issue and current exact Forgejo `dev` before claiming work.
- Record consequential product/rule/architecture decisions durably; do not use
  this portfolio snapshot to invent missing answers.
