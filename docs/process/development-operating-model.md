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

## Repository, project, and operating-lane map

| Surface                                                                       | Purpose and boundary                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatGPT project `Glantri — Architecture`                                      | Architecture/control-plane home for portfolio architecture, decisions, decomposition, evaluation, recommendations, and complete authorization prompts.                                                                            |
| Pinned Development Orchestrator chat                                          | Stable operational lane for Forgejo state, claims, baselines, dispatch, coordination, harvesting, QA handoff, repair loops, and control-plane returns. Its exact UI location is operator configuration, not repository authority. |
| Pinned QA Orchestrator/process chat                                           | Stable QA lane for immutable handoffs, independent visible QA dispatch, durable verdicts, and direct return to the Development Orchestrator. Its exact UI location is operator configuration, not repository authority.           |
| Codex project `Glantri app — Forgejo`                                         | Required execution project for new substantial Builder, bounded Investigator, and independent-QA tasks.                                                                                                                           |
| `/Users/vidarhald/dev/glantri-app-forgejo`                                    | Canonical MacBook clone for current development.                                                                                                                                                                                  |
| Local Forgejo `recovery-admin/glantri-app`                                    | Durable Git and case-management authority for branches, issues, PRs, exact SHAs, checks, lifecycle state, and operational evidence.                                                                                               |
| Historical Codex project `Glantri app` and `/Users/vidarhald/dev/glantri-app` | Read-only, non-mutable recovery/history evidence. They cannot be used for new implementation, QA mutation, branch creation, reset/rebase/cleanup, migration, or routine current-development fetch/push.                           |
| `main` -> Azure production                                                    | External-maintainer release/deployment boundary. Ordinary development authority stops at `dev`; release preparation and production support require their own authority.                                                           |

Current verified operator configuration on 2026-09-05:

- pinned Development Orchestrator task
  `01a01f26-5807-7732-b8a1-e5b381a58f29`, titled
  `Glantri Development Orchestrator`; and
- pinned QA control task `01a01609-ea9a-7ed2-a688-eb63fd556596`, titled
  `Coordinate Glantri Builder QA`.

Both pinned control tasks are currently associated in the UI with historical
Codex project ID `e4ef8ae2-51f2-4c1c-b45a-786fa0adcc2b` (`Glantri app`) and
cwd `/Users/vidarhald/dev/glantri-app`. That association is operator
configuration, not development or repository authority. The pinned lanes may
coordinate from there, but they must not mutate the historical project/clone or
use it for current Git, Builder, QA, migration, or cleanup work. All new
substantial execution remains in `Glantri app — Forgejo`.

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

The pinned Development Orchestrator chat is the stable operational lane. It
owns current Forgejo state, issue claims, accepted-baseline checks, visible task
dispatch, dependency and hotspot coordination, Builder and Investigator
supervision, completion harvesting, direct QA handoff, bounded repair loops,
durable execution evidence, and meaningful returns to Architecture/control
plane.

It coordinates the required visible lanes. Hidden helpers cannot replace a
substantial Builder, dispatched Investigator, or independent-QA task.

### QA Orchestrator

The pinned QA Orchestrator/process chat is the stable independent-QA lane. It
receives an immutable exact-head handoff directly from the Development
Orchestrator, creates and supervises a separate visible independent-QA task,
ensures exact-head verification in an appropriate clean environment, records a
durable PASS or FAIL, harvests the QA result, and returns directly to the
Development Orchestrator.

### Visible execution roles

Builders implement only an authorized task contract. Bounded Investigators
answer their authorized question without silently turning investigation into
implementation. Independent QA reviews an immutable result and never shares
the Builder's task. All new substantial execution for these roles runs visibly
in `Glantri app — Forgejo`.

## Canonical workflow

```text
Product Owner sets direction
  -> Architecture/control plane proposes, interprets, and prepares authorization
  -> Product Owner decides and copies the authorization
  -> pinned Development Orchestrator validates durable gates and dispatches
  -> visible Builder or bounded Investigator
  -> Development Orchestrator harvests exact result and Forgejo evidence
  -> direct exact-head handoff to pinned QA Orchestrator, when QA applies
  -> separate visible independent QA
  -> QA Orchestrator harvests and records PASS or FAIL
  -> direct return to Development Orchestrator
  -> bounded repair and fresh QA, or meaningful control-plane gate
  -> Architecture/control plane evaluates the durable result
  -> Product Owner accepts, integrates, or makes the next decision
```

The Product Owner does not normally relay QA prompts or notice child-task
completion manually. Direct inter-task routing is the standard. Manual
copy/paste is only an explicitly authorized technical fallback when direct
routing is unavailable, and it must preserve the immutable contract and
evidence.

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
and handoff mechanics live in
[`agent-execution.md`](./agent-execution.md) and
[`../dev-database.md`](../dev-database.md).

## Visible threads and dispatch evidence

Substantial Builder, bounded Investigator, and independent-QA work requires
separate visible tasks. Builder and QA for one result must never be the same
task. Hidden sub-agents may assist minor orchestration mechanics only; they do
not satisfy a required lane. If visible task creation fails, report the failure
and use only an explicitly authorized manual visible fallback.

For every visible lane, the Development Orchestrator records:

- project;
- role;
- applicable Forgejo issue;
- mandatory resolved visible thread ID;
- a separate direct link whenever the client exposes one;
- worktree;
- applicable branch;
- exact accepted baseline SHA; and
- `queued`, `running`, `completed`, or `failed` state.

The thread ID is always required. A direct link never substitutes for it.

## Harvesting, direct QA, and repair

The Development Orchestrator detects and harvests child completion, retrieves
the exact head or investigation result, reconciles Forgejo evidence and state,
and includes the outcome in its consolidated return. The Product Owner is not
expected to monitor child tasks.

At `Ready for Independent QA`, the Development Orchestrator sends the immutable
QA contract directly to the pinned QA Orchestrator. The QA Orchestrator
dispatches a separate visible QA task, verifies the exact head in appropriate
isolation, records durable PASS/FAIL evidence in Forgejo, harvests the QA task,
and returns directly to the Development Orchestrator.

On FAIL, the loop is:

`bounded Builder repair -> new immutable head -> direct QA handoff -> fresh independent QA`

It repeats until PASS or until a genuine product, rule, UX, architecture,
priority, scope, dependency, or hotspot issue requires a control-plane return.

## Standing execution authority and return gates

Within an already authorized bounded lane, the Development Orchestrator may,
without repetitive confirmation:

- claim or release ownership and apply the defined operational lifecycle;
- create the authorized branch, worktree, and visible execution task;
- push to local Forgejo and create or update the authorized PR;
- post exact-SHA evidence and send direct QA handoffs;
- coordinate explicitly authorized bounded repairs;
- create and revoke scoped temporary Forgejo credentials; and
- clean disposable task infrastructure safely.

This standing authority never weakens Product Owner acceptance. Return for a
material scope expansion; new authorization; product, UX, Glantri-rule,
consequential architecture, or priority decision; acceptance or integration
gate; unexpected hotspot conflict; destructive persistent/recovery-data action;
the `main`/Azure/production boundary; or unresolved behavior.

## QA independence

A Builder never self-accepts. Architecture/control plane and the Development
Orchestrator do not substitute for QA. The QA Orchestrator owns independent QA
dispatch, and QA reviews the exact immutable head in appropriate isolation.
Only durable Forgejo evidence can advance the result toward control-plane
acceptance.

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
- [`agent-execution.md`](./agent-execution.md): isolated Builder/QA procedures,
  exact returns, and repair mechanics;
- [`development-baseline.md`](./development-baseline.md): branch, baseline,
  integration, and release-boundary policy;
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
