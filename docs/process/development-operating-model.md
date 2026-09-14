# Glantri development operating model

## Purpose and authority

This is the canonical high-level map for Glantri development: who decides,
who coordinates, where substantial work runs, how Forgejo state advances, and
where evidence becomes durable. Detailed procedures remain in the linked
owning documents rather than being duplicated here.

Current Git and case-management authority is the loopback-only Forgejo
repository `recovery-admin/glantri-app`. Repository policy and Forgejo evidence
control execution. Chat coordinates work but is not the sole durable authority.

Entry gates use refreshed Forgejo, Git, PR, and QA evidence. An Orchestrator
snapshot or chat summary can identify what to inspect, but it cannot substitute
for fetching the live branch, resolving the exact SHA, and reading the durable
issue, PR, and QA record.

At authorization, the Forgejo issue body is the current executable task
contract. Comments are evidence/history. Older recovery contracts are
provenance only once superseded and must point readers to the current issue.

## Repository, project, and operating-lane map

| Surface                                                                       | Purpose and boundary                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ChatGPT project `Glantri — Architecture`                                      | Architecture/control-plane home for portfolio architecture, decisions, decomposition, evaluation, recommendations, and complete authorization prompts.                                                                                                                   |
| Development Orchestrator task                                                 | Single operational lane for Forgejo state, claims, baselines, dispatch, coordination, harvesting, direct independent-QA dispatch, repair loops, integration gates, and control-plane returns. Its exact UI location is operator configuration, not repository authority. |
| Codex project `Glantri app — Forgejo`                                         | Required execution project for new substantial Builder, bounded Investigator, and independent-QA tasks.                                                                                                                                                                  |
| `/Users/vidarhald/dev/glantri-app-forgejo`                                    | Canonical MacBook clone for current development.                                                                                                                                                                                                                         |
| Local Forgejo `recovery-admin/glantri-app`                                    | Durable Git and case-management authority for branches, issues, PRs, exact SHAs, checks, lifecycle state, and operational evidence.                                                                                                                                      |
| Historical Codex project `Glantri app` and `/Users/vidarhald/dev/glantri-app` | Read-only, non-mutable recovery/history evidence. They cannot be used for new implementation, QA mutation, branch creation, reset/rebase/cleanup, migration, or routine current-development fetch/push.                                                                  |
| `main` -> Azure production                                                    | External-maintainer release/deployment boundary. Ordinary development authority stops at `dev`; release preparation and production support require their own authority.                                                                                                  |

Only one Development Orchestrator is active after a cutover. It may coordinate
from any operator-configured task, but execution must use the canonical Forgejo
project or an isolated worktree derived from it. Do not create or retain a
permanent QA Orchestrator; independent QA is a fresh worker dispatched directly
for each immutable candidate.

All implementation and QA provisioning originates from the canonical Forgejo
project rooted at `/Users/vidarhald/dev/glantri-app-forgejo`. Every contract
supplies an exact SHA. QA uses a detached exact-head worktree with no upstream
tracking. Neither a default branch nor `origin/main` may replace the supplied
SHA. The historical project and clone never provision current work.

The named host and paths describe the current environment, not permanent role
architecture. A later environment move updates this map without changing role
authority by implication.

## Roles and decision authority

### Product Owner

The Product Owner owns priorities, Glantri rules, UX and product decisions,
consequential architecture, implementation authorization, control-plane
acceptance, and development integration decisions. The deliberate authorization
flow is:

`Architecture/control plane proposes or interprets -> Product Owner decides and copies the authorization -> Development Orchestrator executes`

The Product Owner copy step is an intentional decision boundary. It is not
optimized away or inferred from discussion, technical readiness, credentials,
or an existing issue.

### Architecture/control plane

Architecture/control plane lives in the ChatGPT project
`Glantri — Architecture`. It owns portfolio architecture, durable decision
design, task decomposition, dependencies and hotspots, evaluation,
recommendations, complete self-contained authorization prompts, and ensuring
material decisions reach durable records.

It does not implement product code, run ordinary Builders, substitute for
independent QA, bypass the Development Orchestrator, or make Product Owner
decisions.

### Development Orchestrator

The Development Orchestrator task is the single stable operational lane. It
owns current Forgejo state, issue claims, accepted-baseline checks, visible task
dispatch, dependency and hotspot coordination, Builder, Investigator/Ops, and
independent-QA supervision, completion harvesting, bounded repair loops,
conditional integration, durable execution evidence, and meaningful returns to
Architecture/control plane.

For QA dispatch it performs only the shallow gate in
[`qa-execution.md`](./qa-execution.md): QA authorization/state, supplied head,
prior FAIL for repair, complete handoff tuple, and no duplicate active QA owner.
The independent QA worker—not the Development Orchestrator—owns substantive
topology, scope, and delta verification.

It coordinates the required visible lanes directly. Hidden helpers cannot
replace a substantial Builder, dispatched Investigator/Ops task, or independent
QA task.

### Visible execution roles

Builders receive the complete bounded authority in their authorized contract:
implementation, verification, commit, task-branch push, draft-PR publication,
evidence, and in-scope repair continuation. Bounded Investigators/Ops workers
answer or diagnose only their authorized question. Independent QA reviews an
immutable result in a different visible task and never repairs Builder work.
All substantial execution runs visibly in `Glantri app — Forgejo`.

## Canonical workflow

```text
Product Owner sets direction
  -> Architecture/control plane proposes, interprets, and prepares authorization
  -> Product Owner decides and copies the authorization
  -> Development Orchestrator validates durable gates and dispatches
  -> visible Builder or bounded Investigator
  -> Development Orchestrator harvests exact result and Forgejo evidence
  -> Development Orchestrator dispatches separate exact-head independent QA
  -> Development Orchestrator harvests and records the verdict or blocker
  -> bounded repair and fresh QA, or meaningful control-plane gate
  -> Architecture/control plane evaluates the durable result
  -> Product Owner accepts, integrates, or makes the next decision
```

The Product Owner does not relay QA prompts or monitor child completion. The
Development Orchestrator owns direct routing, liveness, harvesting, durable
evidence, and escalation.

## Forgejo lifecycle

Every operational issue carries exactly one of these lifecycle statuses:

| Status                               | Meaning                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Design`                             | Evidence, scope, or consequential decisions are still being developed. No execution authority.                                                                                     |
| `Ready`                              | The self-contained task contract is complete and current. Prepared only; not authorized.                                                                                           |
| `Authorized`                         | The Product Owner has approved the bounded execution and copied that authorization into the operational flow. Dispatch may proceed only after live gates pass.                     |
| `Active`                             | A named visible Builder, Investigator, QA lane, or bounded repair owns work in flight.                                                                                             |
| `Ready for Independent QA`           | Builder work is complete at an exact immutable head and awaits independent QA.                                                                                                     |
| `Ready for Control-plane Acceptance` | Required independent QA passed, or an investigation that did not require QA produced its complete durable result; acceptance/integration remains pending.                          |
| `Integrated`                         | Required acceptance and development integration are complete. For a design or investigation, the accepted outcome is integrated into the durable operational or repository record. |

Issue existence is not authorization. `Ready` is a preparation state, not
permission. `Authorized` records approved execution. `Active` requires a named
owner. Builder completion advances to `Ready for Independent QA`. QA PASS
advances to `Ready for Control-plane Acceptance`. QA FAIL never advances to
acceptance: an in-scope bounded repair returns to `Active`, produces a new
immutable head, and receives fresh independent QA; a genuine decision or scope
problem returns to the appropriate pre-acceptance control-plane state.
`Integrated` is used only after every required acceptance and integration gate.

Investigation-only work uses the same lifecycle. It moves through `Authorized`
and `Active`, then either through independent QA when the contract requires it
or directly to `Ready for Control-plane Acceptance` with a durable report. It
does not gain a parallel “completed” lifecycle.

Supporting fields or labels may record priority, inactivity, dependencies, or a
blocker, but they do not replace or silently change the exclusive lifecycle
status.

## Self-contained task contracts

Implementation authorization must stand on its own. It names the issue or
other durable contract, exact baseline branch and SHA, sources, outcome and
scope, exclusions, ownership and reserved hotspots, acceptance examples,
verification, Git/PR authority, dependencies and integration order, Builder
role, and independent-QA requirements. Builders must not depend on chat history
to reconstruct any of these facts.

The complete schema and acceptance-dimension guidance live in
[`task-contract.md`](./task-contract.md). Exact Builder, QA, database-isolation,
and handoff mechanics live in [`agent-execution.md`](./agent-execution.md), the
compact [`qa-execution.md`](./qa-execution.md), and
[`../dev-database.md`](../dev-database.md).

## Visible threads and dispatch evidence

Substantial Builder, bounded Investigator, and independent-QA work requires
separate visible tasks. Builder and QA for one result must never be the same
task. Hidden sub-agents may assist minor orchestration mechanics only; they do
not satisfy a required lane.

For every visible lane, the Development Orchestrator maintains one durable
execution-ledger record keyed by `issue + role + mode + exact SHA`, containing:

- project;
- role;
- applicable Forgejo issue;
- parent task and provisioning request ID;
- mandatory resolved visible thread ID;
- a separate direct link whenever the client exposes one;
- leased worktree and lease state;
- applicable branch;
- requested SHA and independently observed `HEAD`;
- liveness state, owner, last meaningful progress, and next action.

The thread ID is required once the task materializes. A request without a task
ID remains pending, not proven lost. A direct link never substitutes for the
task ID.

### Continuation-first and worktree leases

Continue an existing authorized worker, branch, PR, or repair whenever it can
make meaningful progress. Provisioning delay, a missing list entry, or a slow
status update is not enough to create a replacement. The worktree is leased to
the request/task from creation until the ledger records completion,
cancellation, retirement, or confirmed loss. No other actor removes, reuses, or
recreates a leased worktree.

Before replacement, correlate the request with the task registry, parent task,
worktree, Forgejo branch/PR activity, and any completed return. Retire the prior
owner first. At most the contract's bounded recovery attempts may repeat the
identical contract and SHA. If the initial attempt and those repetitions fail
without meaningful progress, **STOP**: publish one consolidated failure report,
state what remains safe and unchanged, and request explicit confirmation before
another replacement or a materially different action.

QA child coordination uses `Running`, `Blocked`,
`Completed-unharvested`, `Completed-harvested`, `Failed`, and `Stalled` as
defined in `qa-execution.md`. `Running` begins only after a visible child passes
its entry gate. These are not additional Forgejo issue lifecycle statuses.

## Harvesting, direct QA, and repair

The Development Orchestrator detects and harvests child completion, retrieves
the exact head or investigation result, reconciles Forgejo evidence and state,
and includes the outcome in its consolidated return. The Product Owner is not
expected to monitor child tasks.

At `Ready for Independent QA`, the Development Orchestrator dispatches one
fresh separate visible QA task with the immutable INITIAL or REPAIR contract.
It supervises that exact child, harvests its result, records durable evidence,
and routes the outcome. The QA worker independently verifies the exact head,
topology, scope, and actual delta; any tuple mismatch produces a quick
`BLOCKED` return.

On FAIL, the loop is:

`bounded Builder repair -> new immutable head -> direct QA handoff -> fresh independent QA`

The Development Orchestrator may repeat in-scope Builder repair and fresh QA
without new approval while the existing task contract remains sufficient. It
stops for a genuine product, rule, UX, architecture, priority, scope,
dependency, or hotspot decision, or after repeated failures cease producing
meaningful progress.
Direct-child narrow repairs may carry forward only demonstrably unaffected
prior PASS evidence. Schema/migration, shared authority/projection/API/domain,
concurrency/transaction, cross-cutting toolchain/export, major Combat/Scenario,
broad-scope, or unclear/rebased topology changes require broader QA.

## Standing execution authority and return gates

Within an already authorized bounded lane, the Development Orchestrator may,
without repetitive confirmation:

- claim or release ownership and apply the defined operational lifecycle;
- create the authorized branch, worktree, and visible execution task;
- push to local Forgejo and create or update the authorized PR;
- post exact-SHA evidence and send direct QA handoffs;
- continue in-scope Builder repairs and fresh independent QA automatically;
- create and revoke scoped temporary Forgejo credentials; and
- clean disposable task infrastructure safely.

An authorized Builder likewise has full bounded branch authority for its task:
implement, test, commit, push the task branch, update the draft PR, publish
evidence, and perform requested in-scope repairs. It never merges or changes
product scope by implication.

Conditional integration is allowed only when the issue explicitly
pre-authorizes it and the exact QA-reviewed head, scope, dependencies,
topology, required checks, and merge target all satisfy that condition. No
general standing merge authority is created.

This standing authority never weakens Product Owner acceptance. Return for a
material scope expansion; new authorization; product, UX, Glantri-rule,
consequential architecture, or priority decision; acceptance or integration
gate; unexpected hotspot conflict; destructive persistent/recovery-data action;
the `main`/Azure/production boundary; or unresolved behavior.

Persistent Forgejo authentication follows the fail-closed contract in
[`forgejo-agent-credentials.md`](./forgejo-agent-credentials.md). Every Git or
API operation selects its assigned role explicitly. An unqualified repository
credential lookup must fail with prompting disabled; recovery administration
is a separate, explicitly selected break-glass path and never a default.

## QA independence

A Builder never self-accepts. Architecture/control plane and the Development
Orchestrator do not substitute for QA. The Development Orchestrator dispatches
a fresh independent worker, and that worker reviews the exact immutable head in
appropriate isolation. Only durable Forgejo evidence can advance the result.

## Human action and liveness escalation

A worker that needs login, OS/browser permission, credential interaction, or
other human action records it immediately and notifies the Development
Orchestrator. The Orchestrator promptly surfaces a concise
`USER ACTION REQUIRED` state naming the action and blocked task. It does not
silently wait for the user to discover the child.

Every authorized workflow is visibly progressing, recovering, waiting for a
named dependency, waiting for explicit human action, completed awaiting
harvest, or explicitly stopped/blocked. Unchanged blockers are deduplicated;
completion is harvested promptly even while other orchestration work continues.

## Parallelism and ownership

Parallelize independent architecture, design, and investigation aggressively.
No more than four implementation Builders run concurrently; four is a ceiling,
not a target. Reserve repair or infrastructure capacity when useful, begin QA
as soon as a Builder finishes, and do not pause unrelated lanes. Serialize only
real dependencies or declared hotspots, with explicit write ownership and
merge order. Cross-area redesign returns for control-plane coordination.

Favor batched Product Owner decisions over serial requests for trivial
approvals. This improves throughput without bypassing the deliberate Product
Owner authorization and acceptance gates.

## Durable authority hierarchy

- Forgejo issues, PRs, labels, exact SHAs, checks, and evidence are durable
  operational authority.
- Repository process and decision documents are durable standing authority.
- Code and tests show implemented behavior, interpreted with accepted
  decisions.
- Historical workbooks, PDFs, files, GitHub records, chats, and recovery
  artifacts are evidence or provenance; they are not automatic Glantri rules or
  current execution authority.
- Credentials and technical access never confer product, Git, integration,
  release, or production authority.

## Owning documents

This document owns the high-level operating map. Details stay with:

- [`control-plane.md`](./control-plane.md): durable authority, tooling,
  governance, sources of truth, and integration policy;
- [`task-contract.md`](./task-contract.md): self-contained contract and
  acceptance schema;
- [`agent-execution.md`](./agent-execution.md): isolated Builder procedure and
  exact Builder return;
- [`qa-execution.md`](./qa-execution.md): compact INITIAL/REPAIR QA dispatch,
  worker entry, verification breadth, child states, and QA return;
- [`development-baseline.md`](./development-baseline.md): branch, baseline,
  integration, and release-boundary policy;
- [`forgejo-agent-credentials.md`](./forgejo-agent-credentials.md): persistent
  local Forgejo identities, explicit fail-closed credential selection, secure
  storage, scoped permissions, and branch enforcement;
- [`../architecture/ownership.md`](../architecture/ownership.md): functional
  ownership and reserved hotspots; and
- [`../dev-database.md`](../dev-database.md): protected and disposable database
  workflows.

## Process governance

A material change to role authority, dispatch routing, QA independence,
lifecycle, acceptance, concurrency, or durable-source hierarchy requires an
explicit control-plane decision, an update to this operating model,
reconciliation of affected owning documents, and independent QA when required.
Task prompts may refine bounded execution details but cannot silently
contradict this model.
