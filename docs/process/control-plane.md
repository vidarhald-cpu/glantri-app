# Glantri development control plane

## Purpose

The control plane keeps product decisions, implementation work, and repository state understandable while several agents work independently. It optimizes the product owner's time by making decisions and acceptance visible without using chat history as the backlog.

This document describes durable operating policy. The current operational issue
tracker and linked pull requests show what work is happening now. Current Git
and case-management authority is the loopback-only Forgejo repository
`recovery-admin/glantri-app`; historical GitHub records are provenance and
recovery evidence.

The canonical role, workflow, lifecycle, and repository/project map is
[`development-operating-model.md`](./development-operating-model.md). This
document owns the supporting authority, tooling, source-of-truth, governance,
and integration policy.

The canonical MacBook clone is `/Users/vidarhald/dev/glantri-app-forgejo`, and
the canonical Codex project is `Glantri app — Forgejo`. The historical
`Glantri app` project and `/Users/vidarhald/dev/glantri-app` checkout are
read-only, non-mutable recovery/history evidence. Do not use them for new
implementation, Builder work, QA mutation, branch creation,
reset/rebase/cleanup, migration, or routine current-development fetch/push.
Repository documents are authoritative; Codex project references are navigation
aids, not policy or authorization records.

## Sources of truth

| Information                                 | Authoritative location                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Product priorities and current work status  | Local Forgejo issues, labels, and linked PRs                                   |
| Task contract and implementation discussion | Local Forgejo issue, when applicable, and PR                                   |
| Product and presentation quality            | `docs/product/product-presentation-principles.md` plus area and task contracts |
| Architecture and ownership policy           | Repository documentation                                                       |
| Approved rule and architecture rulings      | `docs/decisions/`                                                              |
| Source evidence and provenance              | `docs/source/`, `docs/rules/`, cited external material                         |
| Current implementation behavior             | Code plus tests, interpreted with approved decisions                           |

Chat is useful for exploration and product discussion but is not durable project state. Material decisions must be recorded in the repository or linked Forgejo issue before dependent implementation is accepted.

Historical issues, milestones, and Claude-created architecture work are preserved as input. They do not become the current operational backlog until triaged and deliberately adopted.

## Documentation loading and maintenance

Mandatory agent reading is an architectural and resource cost. Only information required for safe, effective execution belongs in the always-read layer.

- `AGENTS.md` and tool-specific top-level guides contain short operating rules and links.
- Each task contract names the exact additional repository paths required for that task; blanket directions such as `read all architecture docs` are not acceptable.
- Area-specific contracts are read only when the task touches that area.
- Decisions, audits, historical reports, and provenance are on-demand references.
- A new standing document needs a clear reason to join the mandatory reading set. Task- or area-specific detail remains scoped below the top level.
- Periodically prune duplication and move fuller explanations into the linked process, area, or decision document that owns them.

This is an efficiency and resource principle, not a rigid line-count rule. The task still requires enough current context to work safely.

## Authority model

Role authority and the deliberate
`Architecture/control plane -> Product Owner decision and authorization copy -> Development Orchestrator`
boundary are defined in the
[canonical operating model](./development-operating-model.md#roles-and-decision-authority).
The Product Owner owns priority, product/rule/UX and consequential architecture
decisions, authorization, acceptance, and development integration. Operational
coordination does not transfer those decisions to Architecture/control plane,
the Development Orchestrator, a Builder, or QA.

The external maintainer owns production-release/deployment support only at the
future `dev -> main -> Azure` boundary. They do not own development baselines,
routine task work, ordinary development PRs, backlog, or architecture
decisions.

Credentials do not confer product or release authority. Agents must not merge to `main`, approve/cancel deployments, deploy, change Azure production configuration/secrets, or request production write access. `dev` authority does not broaden into `main` or production authority.

## Least privilege and development tooling

### Normal Glantri operating boundary

An agent's default operating boundary is:

- the assigned Glantri repository or isolated worktree;
- existing standard local development and file-processing tools;
- the local Glantri Forgejo repository, subject to the separate read/write, push, PR, merge, and release authority in this control plane and the task contract; and
- Glantri source material explicitly stored in the repository or supplied through the Glantri project context.

Anything outside that boundary needs a concrete task reason and the approval required below. Technical reachability, an existing login, a credential, or an installed tool does not expand the task's scope or the agent's authority.

### Routine local tool use

Existing standard local tools may be used on Glantri files inside the assigned worktree without separate approval. This includes compilers and typecheckers, formatters and linters, test runners, Git tooling, Docker and local database tooling, Prisma, and local PDF, Office, Excel, and general file readers or converters.

The normal repository dependency workflow may install dependencies already declared by the repository and make task-authorized dependency changes using the repository's package manager. It does not authorize installing unrelated or global software.

### Actions that require explicit approval

Obtain explicit user approval, tied to a concrete task need, before:

- installing new software, VS Code extensions, global utilities, or packages outside the normal repository dependency workflow;
- enabling a new external service or integration;
- granting new macOS permissions or filesystem access outside the assigned workspace;
- granting personal-cloud or account access; or
- granting computer-control, Accessibility, screen-recording/screen-capture, or other expanded privileges.

If an existing tool cannot complete the task without one of these changes, stop and request the narrowest useful permission or installation rather than treating the task itself as blanket approval.

### External transmission and personal services

An installed VS Code extension or local tool is not automatically approved to transmit Glantri repository or source content. External AI or cloud analysis, signed-in personal services, publishing/deployment services, and any other tool that sends project content outside the approved Glantri/Forgejo environment require explicit approval before use.

Personal ChatGPT capabilities such as Calendar or Sites may exist for unrelated user purposes. Glantri agents must not use them unless the Glantri task explicitly requires them and the user approves their use where appropriate. Their presence does not make them part of the Glantri control plane.

The personal Google Drive connector has been deliberately disconnected. Current Glantri source workbooks are tracked local snapshots, and live personal Drive access is not required or part of the default workflow. When a source workbook changes, use a deliberate source-ingestion flow: export or otherwise obtain the approved snapshot, replace the tracked repository copy, record provenance as needed, and commit the change. Do not silently substitute a live personal-Drive version.

Persistent local Forgejo role identities, repository-specific token scopes,
Keychain storage, protected-branch enforcement, verification, revocation, and
host recreation are defined in
[`forgejo-agent-credentials.md`](./forgejo-agent-credentials.md). That mechanism
supplies authentication only; the task contract and this control plane still
govern every action. The canonical clone fails closed by combining repository
path matching with a non-existent default username. Every routine command must
select its assigned role explicitly; recovery administration is available only
through its separately explicit break-glass handle. Unqualified credential
selection is never an authorized fallback.

### Tool availability does not grant action authority

Destructive and external actions remain governed by the task contract and the authority model. Installing, discovering, or being able to invoke a tool does not grant authority to push, open or update a PR, merge, deploy, delete, publish, change accounts or permissions, or alter Forgejo, production, or Azure configuration.

## Work lifecycle

Use the exclusive Forgejo lifecycle defined in the
[canonical operating model](./development-operating-model.md#forgejo-lifecycle):

`Design -> Ready -> Authorized -> Active -> Ready for Independent QA -> Ready for Control-plane Acceptance -> Integrated`

Suggested case fields:

- Area
- Type: feature, bug, rule decision, technical debt, investigation, operations
- Priority: P0-P3
- Size: XS-XL
- Risk: low, medium, high, cross-area
- Owner/agent
- Parent initiative
- Blocked by
- Target checkpoint
- Rule status: sourced, conflicted, approved deviation, provisional

Priority is separate from defect severity. Small defects can remain durably recorded at P3 without interrupting active work.

An issue reaches `Ready` only when its task contract supplies an exact baseline,
acceptance examples, ownership, rule basis, affected contracts/hotspots,
verification, required decisions, and an applicability result for every
acceptance dimension. See [`task-contract.md`](./task-contract.md).

`Ready` is complete preparation, not permission. The Product Owner advances a
bounded task to `Authorized`; the Development Orchestrator moves it to `Active`
only when a named lane owns live work. Builder completion moves to
`Ready for Independent QA` when required; an explicit documentation-only QA
exemption routes the complete durable result to acceptance without claiming QA.
QA PASS moves to
`Ready for Control-plane Acceptance`; `Integrated` follows required acceptance
and development integration. QA FAIL returns to bounded repair or another
appropriate pre-acceptance gate. Stale contracts and blockers are recorded as
supporting state and reconciled before lifecycle advancement. No more than four
implementation Builders may be active concurrently, and hotspot or dependency
conflicts can reduce that ceiling.

Portfolio discovery follows
`Proposal -> Architecture review -> Design -> Ready -> Authorized -> Active`.
Proposal, architecture review, and Design clarify direction and boundaries; none
is implementation permission. The current dated portfolio guidance and future
areas are kept in the
[strategic portfolio and future register](../product/2026-09-03-strategic-future-register.md).

## Visible execution and standing authority

Visible-lane requirements, mandatory dispatch evidence, completion harvesting,
direct Development-Orchestrator-to-independent-QA routing, standing execution
authority, return gates, and the concurrency ceiling are defined in the
[canonical operating model](./development-operating-model.md#visible-threads-and-dispatch-evidence).
The detailed isolated execution and exact return formats remain in
[`agent-execution.md`](./agent-execution.md).

These linked rules are mandatory: substantial Builder/Investigator and
independent-QA work uses separate visible tasks in `Glantri app — Forgejo`; a
thread ID is always recorded; hidden helpers do not satisfy a lane; the
Development Orchestrator harvests every child result; and the Product Owner is
not expected to relay QA prompts or notice completion manually.

### Standing task-provisioning recovery authority

Within a Product Owner-authorized lane, the single Development Orchestrator may
identify lost/unregistered requests, verify child existence beyond list
visibility, cancel/retire proven lost requests, safely clean verified orphan
worktrees and submit one identical-contract/exact-SHA replacement at a time.
The [detailed recovery procedure](./agent-execution.md#continuation-first-provisioning-and-worktree-leases)
requires binding/direct-access evidence, verified prevention of late duplicate
execution, lease release, and no unique work, unharvested result or persistent
data in cleanup. Unknown ownership/existence or unavailable platform operations
blocks replacement. Reconcile delayed duplicates and harvest the retained owner.

The ceiling is one initial attempt plus two automatic recovery/replacement
attempts (three total), stopping earlier at two consecutive substantially
identical failures without a changed causal condition. Normal Builder–QA repair
has at most two cycles after initial QA; the same root cause failing twice or an
exhausted allowance requires **STOP — REPEATED EXECUTION FAILURE — CONTROL-PLANE
CONFIRMATION REQUIRED**. No counter resets on handoff or rediscovery. Apply the
[exact report and confirmation rules](./agent-execution.md#numeric-anti-loop-limits)
before any further attempt. Escalate a concrete blocker; never silently stop or
leave unexplained indefinite Active work.

Recovery grants no scope/SHA change, code repair, credential/role change, global
Forgejo/runner configuration, protection change, integration, product decision,
or destructive persistent-data authority. Separately authorized work retains
its own bounds. The Product Owner is not the routine evidence relay: authorized
Investigator, Builder and QA publication uses the
[automatic recorder fallback](./agent-execution.md#investigation-and-evidence-publication)
when a worker's assigned credential cannot publish.

## When I approve a case, what happens next?

Approval advances a complete, current `Ready` issue to `Authorized`. From there
the normal path follows the
[canonical workflow](./development-operating-model.md#canonical-workflow):

`Authorized issue -> isolated Builder -> draft PR to dev -> Development Orchestrator -> fresh separate exact-head independent QA -> control-plane acceptance -> dev integration -> optional release PR -> external-maintainer production release`

| Stage                | Who acts and what is produced                                                                                                                                                                             | Message the product owner should expect                                                               | Product-owner action                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Authorize            | Architecture/control plane prepares a complete prompt; the Product Owner decides and copies authorization for a self-contained issue with exact baseline, scope, acceptance, hotspots, and Git authority. | The issue is `Authorized`; the Development Orchestrator may validate gates and assign a Builder lane. | Decide priority and any product/rule/UX or consequential architecture questions.                                      |
| Build                | A visible isolated Builder verifies live `origin/dev`, implements only the issue, verifies, and publishes a draft PR to `dev` with an exact-head handoff. The Development Orchestrator harvests it.       | **Ready for Independent QA** or a concrete control-plane return.                                      | None unless a decision or coordination blocker is reported.                                                           |
| Independent QA       | The Development Orchestrator directly dispatches a fresh separate visible QA task at the immutable head, harvests it, and publishes its verdict without overriding FAIL.                                  | **Repair required** or **Ready for Control-plane Acceptance**.                                        | Review acceptance evidence and decide genuinely consequential follow-ups.                                             |
| Accept and integrate | Architecture/control plane evaluates the durable result; the Product Owner accepts or rejects it and decides integration; an authorized integration actor merges the accepted PR into shared `dev`.       | **Integrated to dev**, including the resulting exact `dev` SHA.                                       | Accept/reject and choose integration order, or rely on an explicit conditional integration grant with every gate met. |
| Optional release     | Under separate authority, a narrow `dev -> main` release PR is prepared after release readiness is chosen.                                                                                                | **Narrow release PR ready for external maintainer**.                                                  | Decide product release readiness; do not perform production mechanics by implication.                                 |
| Production boundary  | The external maintainer performs production release/deployment support and records verification.                                                                                                          | **Production deployment verified**, when applicable.                                                  | Confirm product outcome; ordinary agents remain read-only at this boundary.                                           |

Exception paths stay narrow:

- Missing product/rule/UX/privacy or consequential architecture decision: the Builder or QA posts **Needs decision** with one concrete question and stops affected work.
- QA `FAIL`: the Development Orchestrator routes an in-scope bounded repair to
  the same Builder/PR, harvests the new exact head, and sends a new immutable
  handoff directly to fresh independent QA within the numeric repair limits.
- Dependency or hotspot collision: stop and coordinate ownership/merge order; do not widen scope.
- Production-only problem: ordinary agents may diagnose safely when authorized, but do not mutate production, merge `main`, change Azure, or deploy.

The [result-routing table](./development-operating-model.md#result-classification-and-routing)
distinguishes scoped defects, unrelated CI/operational failures, decision
findings, incomplete evidence and repeated execution failure. The Orchestrator
cannot override QA FAIL. Conditional integration follows the
[baseline gates](./development-baseline.md#conditional-integration). The approved
[path-aware gate destination](./development-baseline.md#approved-path-aware-dev-gate--pending-implementation-and-transition)
remains pending separate implementation and protected transition; no optional-all
checks, spoofed success or bypass is authorized.

The Forgejo issue, when applicable, and PR hold the durable status, exact SHAs, evidence, decisions, and follow-ups. Chat may notify the product owner, but chat-only context never substitutes for those records.

## Implementation flow

1. Capture the observation or objective in an issue.
2. Triage area, type, priority, risk, and whether a product/rule decision is required.
3. Complete the task contract and architecture review for high-risk/cross-area work.
4. Name the exact accepted baseline branch and SHA.
5. Create one isolated, short-lived task branch/worktree.
6. Implement only the coherent slice; record newly discovered non-blocking work separately.
7. Run `pnpm format:check:changed` against the task's exact accepted parent. Changed files must pass Prettier and `git diff --check`; inherited untouched formatting debt does not block the task.
8. Open a development PR under the confirmed target and push/PR authority; route Builder completion through the Development Orchestrator to required independent QA, or directly to control-plane acceptance under an explicit documentation-only QA exemption.
9. Review code, decisions, tests, compatibility, hotspot coordination, and user-visible evidence.
10. After required QA passes, move the exact result to `Ready for Control-plane Acceptance`; only the Product Owner accepts product behavior.
11. Merge an accepted ordinary task PR into `dev` only under the Product Owner's development-integration decision or explicit conditional integration contract with every gate satisfied. Release preparation from `dev` to `main` is a separate production-boundary workflow.

One coherent behavior or architecture slice is the governing PR size rule. There is no rigid changed-file cap. An unusually large, high-risk, or cross-area PR must include an integration plan describing why it cannot be sliced safely, contract/merge order, hotspot ownership, review stages, verification, compatibility, rollback, and follow-up modularization.

## Cross-area coordination

- Declare all affected areas and shared contracts before implementation.
- Assign one integration owner to every cross-area task.
- Treat the hotspots in `docs/architecture/ownership.md` as reserved surfaces.
- Permit only one task to edit a hotspot unless the integration plan assigns the split and merge order.
- Establish shared contract/schema changes before dependent implementations where practical.
- Architecture review is required before cross-area or high-risk work becomes `Ready`.
- Record interface decisions under `docs/decisions/architecture/` when they create a durable boundary.
- Use PR/issue timelines for active handoffs; do not create a shared mutable agent-log file.

## Rule governance

Source PDFs, texts, workbooks, and tables are evidence and provenance, not unquestionable implementation truth. Approved Glantri implementation rulings may correct errors, resolve conflicts, simplify manual procedures, or use computer calculation to improve accuracy.

Agents must cite relevant evidence, record conflicts and deviations, and never silently reinterpret a source. Material rulings use `docs/decisions/templates/rule-decision.md`, remain traceable when superseded, and are protected by focused executable examples or golden tests.

## Product-owner checkpoints

The product owner should normally need to monitor three queues:

- **Needs decision:** rule, UX, priority, or consequential architecture choice.
- **Ready for Control-plane Acceptance:** QA-passed user-visible slices with a short test script/evidence.
- **Portfolio choices:** initiative ordering, capacity, and deferred work.

Recommended cadence:

- Twice-weekly asynchronous digest: completed, newly blocked, decisions needed, and next likely work.
- Weekly short portfolio checkpoint: priorities and product/rule decisions.
- Architecture checkpoint only for material cross-area tradeoffs.
- Acceptance checkpoint for completed user-visible slices.
- Monthly reconciliation of Forgejo cases, documentation, branches, and the released version.

## Published `dev` and PR #200 provenance

`dev` is the active development integration branch. Its accepted initial baseline is `2203f37e196e2de34cf911ea4fa08ac9feb6f8be`; later accepted `dev` SHAs are recorded by task contracts and merge handoffs without replacing that fixed initial reference.

The local Forgejo `dev` protected-branch rule disables direct push, requires the
`CI / ci (pull_request)` and `CI / docker-test (pull_request)` contexts, requires
zero approving reviews, and allows merge only to `glantri-orchestrator`. The
rule applies to administrators. The historical GitHub ruleset `20708650` is
provenance, not current enforcement. Ordinary task branches start from an exact
accepted `dev` SHA and return through PRs targeting `dev`. The complete local
identity and protection contract is in
[`forgejo-agent-credentials.md`](./forgejo-agent-credentials.md).

PR #200 is superseded provenance, not the active development baseline. Its head `4179034ef13c1713a23bddad7bf9ce01fc4880ea` is an ancestor of `dev`; its work, the 50 local continuation commits, `main` reconciliation, and the control-plane bootstrap were incorporated into the accepted `dev` lineage. Closing it as unmerged does not reject its work, and it must not be retargeted to manufacture a new baseline.

`main` remains production/release only. A future accepted release moves from `dev` toward `main` with the required production-boundary support, and the released `main` state is then reconciled back into `dev` before a newer development baseline is accepted.

## Repository versus Forgejo work

Keep in the repository:

- shared agent instructions;
- this process and ownership model;
- development-baseline policy;
- durable architecture and rule decisions;
- issue/PR templates;
- machine-enforceable architecture checks where valuable.

Keep in Forgejo:

- current backlog and status;
- assignees, priority, dependencies, and checkpoints;
- task discussions and handoffs;
- PR review/check/merge state;
- environment and deployment status visible to authorized maintainers.

## Active repository operating state

- `dev` is published, protected, and used for ordinary task PRs.
- `main` and Azure production remain outside ordinary development authority.
- Pushes to `dev` run CI but do not trigger the `main`-only production deployment workflow.
- The exact accepted parent and resulting `dev` SHA are recorded for each task.
- Release-PR checks and production-support procedure are confirmed separately before a future `dev -> main` release.
- Automatic deletion of merged task branches remains a separate repository-administration decision.

Do not perform broad historical issue, milestone, or branch cleanup as part of ordinary task publication.
