# Glantri development operating model

## Purpose and authority

This is the canonical high-level map for Glantri development: who decides,
who coordinates, where substantial work runs, how Forgejo state advances, and
where evidence becomes durable. Detailed procedures remain in the linked
owning documents rather than being duplicated here.

The canonical provider-neutral execution policy every worker reads is
[`../../AGENTS.md`](../../AGENTS.md). This document is primarily an
Orchestrator/control-plane reference and is not mandatory startup reading for
ordinary workers; a worker reads it only when its dispatch packet names it.

Current Git and case-management authority is the loopback-only Forgejo
repository `recovery-admin/glantri-app`. Repository policy and Forgejo evidence
control execution. Chat coordinates work but is not the sole durable authority.

Entry gates use refreshed Forgejo, Git, PR, and QA evidence. An Orchestrator
snapshot or chat summary can identify what to inspect, but it cannot substitute
for fetching the live branch, resolving the exact SHA, and reading the durable
issue, PR, and QA record.

At authorization, the Forgejo issue body is the current executable task
contract. Before each dispatch, synchronize that body with current
authorization; a stale
or contradictory body blocks launch even if a newer comment grants authority.
Comments are evidence/history. Older recovery contracts are
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
supplies an exact SHA. QA uses a detached exact-head worktree with no local
branch or upstream
tracking. Apply the [prelaunch identity/HEAD gate](./development-baseline.md#exact-sha-provisioning-gate)
to the canonical clone or its derived isolated worktree. Neither a default
branch nor `origin/main` may replace the supplied SHA. The historical project
and clone never provision current work.

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

Architecture discussion, proposed prompts, and planning notes are not execution
orders. A Product Owner/control-plane prompt is dispatched only when actually
sent to the Development Orchestrator. Policy changes and implementation orders
remain separate; an approved process update does not dispatch product work.

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
owns current Forgejo state, issue claims, accepted-baseline checks, task
dispatch on the authorized substrate, dependency and hotspot coordination, Builder, Investigator/Ops, and
independent-QA supervision, completion harvesting, bounded repair loops,
conditional integration, durable execution evidence, and meaningful returns to
Architecture/control plane.

For QA dispatch it performs only the shallow gate in
[`qa-execution.md`](./qa-execution.md): QA authorization/state, supplied head,
prior FAIL for repair, complete handoff tuple, and no duplicate active QA owner.
The independent QA worker—not the Development Orchestrator—owns substantive
topology, scope, and delta verification.

It coordinates the required execution lanes directly, on the substrate
authorized in [`../../AGENTS.md`](../../AGENTS.md). A helper agent operating
inside another lane's context never replaces a substantial Builder, a dispatched
Investigator/Ops lane, or independent QA.

The Development Orchestrator does not author tracked repository content. Code,
tests, documentation, rules, architecture, and process content all reach the
repository through bounded workers on authorized task branches. Coordination
output, issue and PR evidence, and execution-ledger records are not tracked
repository content and remain the Orchestrator's own work.

Before dispatching QA or requesting control-plane acceptance, it establishes
actual PR freshness and merge-base state, and it rechecks head, target,
freshness, checks, and mergeability immediately before integration. See
[PR freshness, merge base, and pre-integration recheck](./development-baseline.md#pr-freshness-merge-base-and-pre-integration-recheck).

### Visible execution roles

Builders receive the complete bounded authority in their authorized contract:
implementation, verification, commit, task-branch push, draft-PR publication,
evidence, and in-scope repair continuation. Bounded Investigators/Ops workers
answer or diagnose only their authorized question. Independent QA reviews an
immutable result in a context isolated from the Builder's and never repairs
Builder work. Attended substantial execution normally runs visibly in
`Glantri app — Forgejo`; the authorized substrate alternatives are defined in
[`../../AGENTS.md`](../../AGENTS.md) under "Execution substrate and independence",
including the mandatory QA floor.

## Canonical workflow

```text
Product Owner sets direction
  -> Architecture/control plane proposes, interprets, and prepares authorization
  -> Product Owner decides and copies the authorization
  -> Development Orchestrator validates durable gates and dispatches
  -> Builder (visible or authorized background/subagent context) or bounded Investigator
  -> Development Orchestrator harvests exact result and Forgejo evidence
  -> Development Orchestrator dispatches separate exact-head independent QA
  -> Development Orchestrator harvests and records the verdict or blocker
  -> bounded repair and fresh QA, or meaningful control-plane gate
  -> integrate promptly when explicit conditional authority and all gates pass
  -> otherwise Architecture/control plane and Product Owner resolve acceptance or decisions
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
| `Active`                             | A named Builder, Investigator, QA lane, or bounded repair owns work in flight, on the authorized substrate.                                                                        |
| `Ready for Independent QA`           | Builder work is complete at an exact immutable head and awaits independent QA.                                                                                                     |
| `Ready for Control-plane Acceptance` | Required independent QA passed, or an investigation that did not require QA produced its complete durable result; acceptance/integration remains pending.                          |
| `Integrated`                         | Required acceptance and development integration are complete. For a design or investigation, the accepted outcome is integrated into the durable operational or repository record. |

Issue existence is not authorization. `Ready` is a preparation state, not
permission. `Authorized` records approved execution. `Active` requires a named
owner. Builder completion advances to `Ready for Independent QA` when required.
An
explicit contract exemption for documentation-only work routes the complete
durable result directly to `Ready for Control-plane Acceptance`, without
claiming QA PASS. QA PASS
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

### Label names for the exclusive statuses

These labels exist in `recovery-admin/glantri-app` and are the Forgejo
representation of the statuses above. They are recorded here so that a dispatcher
can read and set state without guessing a name. **This section documents label
names; it does not create them.** Creating or renaming a lifecycle label is a
control-plane act.

| Status                               | Label                                       |
| ------------------------------------ | ------------------------------------------- |
| `Design`                             | `status/Design`                             |
| `Ready`                              | `status/Ready`                              |
| `Authorized`                         | `status/Authorized`                         |
| `Active`                             | `status/Active`                             |
| `Ready for Independent QA`           | `status/Ready for Independent QA`           |
| `Ready for Control-plane Acceptance` | `status/Ready for Control-plane Acceptance` |
| `Integrated`                         | `status/Integrated`                         |

Supporting labels that record state **without** changing the exclusive status
include `state/Inactive`, `state/Paused`, `gate/Dependency`, `priority/Future`,
`relation/Superseded`, and the `area/`, `type/` and `priority/` families. A
supporting label never substitutes for a status and never contradicts one.

**Two states have no label and are not in the exclusive set.** A dispatcher looking
for them will not find them, so the current representation is recorded here rather
than invented:

| Wanted state           | Current representation                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Deferred`             | `Design` or `Ready` as the exclusive status, plus `priority/Future` and, where something concrete blocks it, `gate/Dependency`. #819's deferral of the remove/re-add family is recorded this way: as a ruling naming the issues, not as a status. |
| `PO Decision Required` | The pre-acceptance status the work is actually in, plus a `Needs decision` classification in the issue body with one concrete question. `task-contract.md` already defines `Needs decision` as a body classification rather than a label.         |

**`Deferred` and `PO Decision Required` are mutually exclusive lifecycle states.**
A work order is in one or the other, never both, and no issue carries both
representations at the same time (Product Owner ruling recorded on #826 and #819 on
2026-10-31).

Adding either as an eighth or ninth exclusive status is a change to the lifecycle
and therefore requires an explicit control-plane decision under
[process governance](#process-governance). Until then, do not set a status that the
control plane has not defined, and do not infer one from a stage name used in prose.
`Ready for Integration` is the standing example of a process stage that is
deliberately **not** a status.

### Which transitions are mechanical and which need judgement

A **mechanical** transition follows from a fact somebody can check. A **judgement**
transition is somebody deciding something, and no amount of green evidence performs
it.

| Transition                                                                | Kind       | Who performs it                                         | The fact or the judgement                                                                                                                      |
| ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Design` to `Ready`                                                       | Judgement  | Control plane                                           | The contract is complete and current, with an applicability result for every acceptance dimension. Completeness is assessed, not counted.      |
| `Ready` to `Authorized`                                                   | Judgement  | **Product Owner only**                                  | The deliberate decision boundary. Never inferred from technical readiness, credentials, discussion, or an existing issue.                      |
| `Authorized` to `Active`                                                  | Mechanical | Orchestrator                                            | A named lane owns live work and a claim comment exists. Live gates passed.                                                                     |
| `Active` to `Ready for Independent QA`                                    | Mechanical | Orchestrator                                            | The Builder returned an exact immutable head and the PR exists at it.                                                                          |
| `Ready for Independent QA` to `Active` (repair)                           | Mechanical | Orchestrator                                            | A durable FAIL with an open A or B finding, within the repair allowance.                                                                       |
| `Ready for Independent QA` to `Ready for Control-plane Acceptance`        | Mechanical | Orchestrator                                            | A durable PASS or PASS WITH FOLLOW-UP bound to the exact head, **after** the load-bearing re-check below. Required CI has settled.             |
| `Active` to `Ready for Control-plane Acceptance` (docs/process exemption) | Mechanical | Orchestrator                                            | The contract explicitly exempts the work from independent QA. This routes evidence; it does not claim a QA PASS.                               |
| `Ready for Control-plane Acceptance` to `Integrated`                      | Judgement  | **Product Owner**, then an authorized integration actor | Acceptance asks whether the change should exist. A green verdict does not answer it. Only an explicit pre-authorization integrates without it. |
| Any state to a successor work order (supersession)                        | Judgement  | Product Owner, or Orchestrator for a non-product change | [Supersession of an active work order](./task-contract.md#supersession-of-an-active-work-order).                                               |
| Any state to STOP                                                         | Mechanical | Whichever lane hits the limit                           | The anti-loop counters, or an unresolved product, rule, authority or ownership question. A STOP is reached by rule, and lifted by judgement.   |

The asymmetry is deliberate: **every transition that lets work move forward past
acceptance is a judgement, and every transition that stops it is mechanical.**

## Hotspot overlap is declared and computed

A lane declares its expected hotspots in its work order. The Orchestrator then
computes the actual overlap, from the real changed-path sets, before dispatching a
second lane and again before composing an integration batch:

1. **Declared against declared.** Intersect the candidate lane's declared expected
   hotspots with every standing claim's reserved hotspots. A non-empty intersection
   serialises the two lanes, and the merge order is recorded in both contracts.
2. **Computed against computed.** For work already in flight, intersect the actual
   changed-path sets — `git diff --name-only <baseline> <head>` on each — rather than
   the declarations. A declaration is a prediction; this is the measurement.
3. **Computed against declared.** Intersect a running lane's actual changed paths
   with a queued lane's declared expected hotspots. This is the case that catches a
   lane whose real diff grew past what it predicted.
4. **Then ask what no path intersection can see.** Path overlap does not expose
   coupling that runs through a shared symbol. The
   [consumed-vocabulary set](./integration-wave.md#deriving-and-reviewing-a-consumed-vocabulary-set)
   is the separate instrument for that, and it is not replaced by any of the three
   intersections above.

Record the computed result, not only the conclusion. #817 was held behind #813
because both edit the same disclosure module — a correct call, made as an
Orchestrator judgement rather than from a stated rule, which is why it is a rule
now. The same incident shows why the sequence matters in both directions: the #817
F3 ruling enlarges the very name set #813's defect fed on, so #817 on top of an
unfixed #813 would have widened the leak (#798 comment 18407).

## Capability sizing and preparation

Prefer the largest coherent vertical user capability whose decisions are settled,
hotspots are manageable, one Builder can own it, and QA can review it as a
meaningful unit. Crossing domain, rules, persistence, API, UI, tests, or many
files is not itself a reason to split. Split for a real unresolved decision,
dependency, conflicting ownership, materially different verification risk, or
size beyond coherent ownership. Four Builders is a ceiling, not a utilization
target.

Before substantial dispatch, prepare the objective, settled known decisions,
scope and exclusions, acceptance examples, dependencies, likely hotspots, and
verification class. Resolve predictable missing decisions first when practical.
Preparation is targeted and proportionate; it does not require exhaustive
historical investigation. Ordinary implementation choices remain Builder authority.

An active product lane needs a sizeable implementation-ready capability available
or executing; importance alone is insufficient. When substantial definition is
still needed, record **Preparing for Ready** as supporting preparation state
under Design, then use the normal Ready, Authorized, and Active gates. This does
not introduce another exclusive Forgejo lifecycle status or prohibit separately
authorized bounded investigation. An Active issue still requires a named owner
of live work.

For future work that is not immediately next, keep preparation durable and
conceptual: objectives, workflows, rules, concepts, permissions, invariants,
acceptance, content, architecture boundaries, exclusions, and Product Owner
decisions. Avoid premature current-code audits, SHA-specific designs, exact-path
contracts, migration plans, and exhaustive runtime investigations likely to go
stale. Near activation, a short preflight against then-current dev translates
that specification into the exact executable contract and accepted baseline.

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

## Dispatch substrate and execution evidence

Substantial Builder, bounded Investigator, and independent-QA work runs on the
substrate authorized in
[`../../AGENTS.md`](../../AGENTS.md): attended substantial Builders normally use
separate visible sessions; explicitly authorized unattended Builders may use
fresh background/subagent contexts for bounded, durably recorded tasks; and a
fresh background/subagent context sharing no Builder conversational history is
normal independent QA. Builder and QA for one result must never share a context,
and a helper agent inside the Builder's implementation context never satisfies
the QA lane. The mandatory QA floor there is not downgradable on cost grounds.

The actual substrate must be stated accurately in dispatch evidence. **A
background subagent must not be recorded or reported as a separate visible
session.**

For every lane, the Development Orchestrator maintains one durable
execution-ledger record keyed by `issue + role + mode + exact SHA`, containing:

- project, provisioning root, verified origin and common Git directory;
- role;
- applicable Forgejo issue;
- parent task and provisioning request ID;
- the actual execution substrate, stated accurately;
- the mandatory resolved visible thread ID or background agent/session ID;
- a separate direct link whenever the client exposes one;
- leased worktree and lease state;
- applicable branch;
- accepted baseline, requested SHA and independently observed `HEAD`;
- recovery/replacement and repair-cycle counts;
- liveness state, owner, last meaningful progress, and next action;
- approximate token usage and task class, so fresh-versus-resume rests on
  observed context size rather than estimation. The minimal form suffices:
  `agent <id> - <model>/<effort> - ~<n>k tokens - <task class> - resume: yes/no`.

The thread or agent ID is required once the task materializes. A request without
an ID remains pending, not proven lost. A direct link never substitutes for the
ID. Validate all returns against the correlation key and recorded lease;
quarantine another issue/role/mode/SHA as a routing mismatch.

QA verdicts name the exact PR head SHA verified. Where the QA agent can post as
`glantri-qa`, it does. Where the Orchestrator must relay, it posts under
`glantri-orchestrator` and identifies the comment explicitly as a relay from
independent QA subagent `<id>`. **QA provenance is never impersonated.**

### Visible-Builder launch packet

A dispatched Builder packet is complete when the Product Owner needs only to
open the session, select the supplied worktree, choose the recommended model and
effort, and paste the packet. The Orchestrator pre-creates the worktree, and the
packet states literal model and effort values. The durable minimum is:

- the Forgejo issue;
- the role;
- the execution substrate;
- the recommended model;
- the recommended effort;
- the exact accepted baseline branch and SHA;
- the pre-created worktree path;
- the branch;
- the minimal required reading, as exact documents or sections;
- the exact owned files, paths and reserved hotspots;
- the complete self-contained prompt, depending on no chat history;
- acceptance criteria;
- verification, including explicit base SHAs for changed-file gates;
- stop conditions; and
- Git and PR authority, stated as granted or withheld.

QA packets carry the equivalent minimum plus the immutable candidate head, and
for preservation or other mechanically specifiable verification they enumerate
the exact proofs required.

### Continuation-first and worktree leases

Continue an existing authorized worker, branch, PR, or repair whenever it can
make meaningful progress. Provisioning delay, a missing list entry, or a slow
status update is not enough to create a replacement. The worktree is leased to
the request/task from creation until the ledger records completion,
cancellation, retirement, or confirmed loss. No other actor removes, reuses, or
recreates a leased worktree.

The [recovery procedure](./agent-execution.md#continuation-first-provisioning-and-worktree-leases)
owns binding/direct-access checks, proven-orphan cleanup and verified terminal
retirement. Unknown child existence blocks replacement. Reconcile delayed
duplicates, retain one owner, harvest unique results and terminally retire the
others before releasing leases. Manual visible fallback requires explicit
authorization; a helper agent inside another lane's context never fulfills a
required lane.

One initial attempt plus at most **two automatic recovery/replacement attempts**
(**three total**) is allowed, with one live attempt at a time. Stop earlier after
**two consecutive substantially identical failures without a changed causal
condition**. Normally allow at most **two Builder–QA repair cycles** after initial
QA; the same root cause failing twice or exhausted allowance requires **STOP —
REPEATED EXECUTION FAILURE — CONTROL-PLANE CONFIRMATION REQUIRED**. Counters do
not reset on handoff or rediscovery. Publish exact attempts/IDs/SHAs/failures,
changed conditions, lease/cleanup evidence and a recommendation. No further
attempt or materially different recovery without confirmation. The detailed
[counting and stop rules](./agent-execution.md#numeric-anti-loop-limits) apply to
all lanes; a contract may set lower limits.

QA child coordination uses `Running`, `Recovering`, `Waiting-dependency`,
`Waiting-human-action`, `Blocked`,
`Completed-unharvested`, `Completed-harvested`, `Failed`, and `Stalled` as
defined in `qa-execution.md`. `Running` begins only after a visible child passes
its entry gate. These are not additional Forgejo issue lifecycle statuses.

## Harvesting, direct QA, and repair

The Development Orchestrator detects and harvests child completion, retrieves
the exact head or investigation result, reconciles Forgejo evidence and state,
and includes the outcome in its consolidated return. The Product Owner is not
expected to monitor child tasks.

At `Ready for Independent QA`, the Development Orchestrator dispatches one
fresh independent QA context, isolated from the Builder's, with the immutable INITIAL, REPAIR, or PRESERVATION contract.
It supervises that exact child, harvests its result, records durable evidence,
and routes the outcome. The QA worker independently verifies the exact head,
topology, scope, and actual delta; any tuple mismatch produces a quick
`BLOCKED` return.

### The load-bearing re-check, between harvesting a verdict and acting on it

**After harvesting a QA verdict and before acting on it, the Orchestrator
independently re-checks the single most load-bearing claim in that verdict.** This
is a check **on QA**, not a re-run of QA, and it is not an override: the Orchestrator
still cannot override a FAIL, and a re-check that agrees adds nothing to the verdict's
authority.

**Identifying the claim.** It is the one claim on which the verdict's outcome turns —
the single measurement whose falsity would change PASS to FAIL, or FAIL to PASS. For
a PASS it is usually the proof that the defect is gone, or that the instrument used
to show it can fail. For a FAIL it is the measurement of the defect itself. The
verdict names it in its return, and where the verdict does not, the Orchestrator
names the claim it chose and why, so the choice is auditable rather than convenient.
One claim, not a re-audit: picking three is how this step becomes a second QA pass
and stops being done.

**What counts as an independent re-check.** Reading the claim at source, or running
the measurement, in the Orchestrator's own context:

- for a source claim, opening the named file at the exact head and reading the code
  the verdict describes;
- for a measurement, running it, or running the one adjacent check that would be
  inconsistent with it;
- for a diff or scope claim, recomputing it from Git at the exact head;
- for a CI claim, reading the Actions `tasks` API by `head_sha` rather than the
  combined status.

Accepting the verdict's own figure, re-reading the verdict more carefully, or
agreeing with its reasoning are **not** re-checks.

**When it does not reproduce**, the verdict is not discarded and the lane does not
advance. Record expected versus observed, return the discrepancy to the same
reviewer, and resolve it before the verdict is used. A verdict whose load-bearing
claim does not reproduce is `BLOCKED` in effect, whatever letter it carried. Where
the discrepancy is the Orchestrator's own error, record that too.

**Why this step exists, measured.** Four instances, none hypothetical:

- a Builder reported its diff as `+379/−8` when the diff against its own parent was
  `+742/−8`; the file list was right, so only recomputing the diff caught it (#798
  comment 18335, confirmed independently at 18394);
- a lane's new helper was wired on one of the two surfaces its PR claimed to cover —
  the GM panel never imported it — which a source read found and a report read would
  not have (#823);
- #777's stated premise was measured **false** at `dev`: the issue said parry
  allocation reached the stack for one declaration, and at `f9fcaa3d` it reached it
  for none, which inverted the whole characterization (comment 18558);
- the Orchestrator's own record of an accepted cost was narrower than the measured
  trigger, and the correction came from QA rather than from the Orchestrator reading
  its own ruling again (#798 comment 18584, N1).

Two of the four were the Orchestrator's own claims. The step is not an expression of
distrust in QA; it is the acknowledgement that **whoever acts on a measurement should
have touched it**.

On FAIL, the loop is:

`bounded Builder repair -> new immutable head -> direct QA handoff -> fresh independent QA`

Batch related in-scope defects into one coherent Builder repair, then fresh QA.
The Development Orchestrator may repeat in-scope Builder repair and fresh QA
without new approval while the existing task contract remains sufficient. It
stops for a product, rule, UX, consequential architecture, priority, scope,
dependency or hotspot decision, and obeys the numeric limits above regardless
of apparent progress. It cannot override QA FAIL.
Direct-child narrow repairs may carry forward only demonstrably unaffected
prior PASS evidence. Schema/migration, shared authority/projection/API/domain,
concurrency/transaction, cross-cutting toolchain/export, major Combat/Scenario,
broad-scope, or unclear/rebased topology changes require broader QA.

### Result classification and routing

| Result                                                                           | Required action by the Development Orchestrator                                                                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA PASS                                                                          | Publish exact-head evidence and route to acceptance, or conditional integration only when every explicit condition passes.                            |
| QA PASS WITH FOLLOW-UP                                                           | Record non-blocking findings and why integration is safe; follow the contract's acceptance gate. Never relabel a blocking finding to force progress.  |
| In-scope QA FAIL                                                                 | Return to the existing Builder/PR for bounded repair, then fresh exact-head QA within the numeric limits. Never override the verdict.                 |
| Unrelated CI, environment or tooling failure                                     | Record evidence and route to bounded operational repair; keep unmet protected checks blocking. Do not reopen unrelated product scope or claim a pass. |
| Product/rule/UX/consequential architecture, permission, source or scope decision | Stop affected work and return the exact question and recommendation to control plane/Product Owner.                                                   |
| Entry/tuple/evidence mismatch or missing human action                            | Record BLOCKED or USER ACTION REQUIRED with expected/observed facts and the resume event; incomplete evidence is not FAIL or PASS certification.      |
| Usable investigation or explicitly QA-exempt documentation                       | Publish the complete result and route to control-plane acceptance under its contract; do not manufacture QA or acceptance.                            |
| Repeated execution failure                                                       | Apply the numeric STOP/report/confirmation rule before any further attempt.                                                                           |

Authorized read-only investigation includes publishing evidence to its assigned
issue. If a worker's credential scope blocks authorized PR/report/verdict
publication, the Development Orchestrator acts as Recorder (or assigns an
explicit recorder), publishes the exact ready result automatically and verifies
the durable link. The report remains valid; prepared is not published. This is
a recording function, not a permanent QA coordination role. See
[publication fallback](./agent-execution.md#investigation-and-evidence-publication).

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
general standing merge authority is created. The
[approved path-aware gate](./development-baseline.md#path-aware-dev-gate--integrated-status)
is integrated by #163/PR #164 and controls integration through the existing
protected compatibility guards. Applicable protected checks remain binding;
no settings transition was required.

This standing authority never weakens Product Owner acceptance. Return for a
material scope expansion; new authorization; product, UX, Glantri-rule,
consequential architecture, or priority decision; acceptance or integration
gate; unexpected hotspot conflict; destructive persistent/recovery-data action;
new permissions, global credential/runner/Forgejo infrastructure changes,
protection changes beyond the separately approved gate transition;
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
appropriate isolation for substantive implementation. Mechanical refreshes use
preservation QA; documentation/process work uses light relevant checks and its
explicit exemption route where applicable. Follow the
[verification classes](./qa-execution.md#verification-classes-and-evidence-validity).
Only durable Forgejo evidence can advance the result.

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
The Orchestrator records a bounded observation interval and next inspection,
relays usable completion before deeper processing, and releases completed work
from implementation capacity while publication or QA is pending. Detailed
[liveness rules](./agent-execution.md#human-action-liveness-and-completion-visibility)
own inspection, direct notifications and deduplication.

## Parallelism and ownership

Parallelize independent architecture, design, and investigation where useful;
keep future preparation proportionate and durable.
No more than four implementation Builders run concurrently; four is a ceiling,
not a target. **Integration capacity is a separate ceiling, tracked separately**,
and it is the binding one on this host: see
[batch integration and integration capacity](./integration-wave.md#batch-integration-and-integration-capacity).
Builder slots free up when a lane finishes; a single serial CI runner does not. Reserve repair or infrastructure capacity when useful, begin QA
as soon as a Builder finishes, and do not pause unrelated lanes. Run QA and
hosted checks for the immutable candidate in parallel whenever neither
depends on the other. Do not wait for hosted completion merely to start QA.
Serialize only real dependencies, declared hotspots, or measured resource
contention; record the concrete constraint, owner, and scheduling or merge
order. Blanket serial ordering is not the default. Cross-area redesign returns
for control-plane coordination.

Favor batched Product Owner decisions over serial requests for trivial
approvals. This improves throughput without bypassing the deliberate Product
Owner authorization and acceptance gates.

## Process update boundary

The execution-efficiency policy in
[case #192](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/192) authorizes publication and
integration of process Markdown only through the normal documentation/process
gate. It does not start, stop, reprioritize, change lane state, or dispatch
implementation in Chargen, Campaign, Combat, Equipment, or any other product
lane. Existing separately authorized product contracts continue unchanged; only
separately dispatched product orders authorize that work.

## Provider pools and qualification

A **provider pool** is one source of execution capacity: a client, a model family,
or a locally hosted model, running on one substrate. A pool is **not** a role.
Roles are Builder, independent QA, Investigator/Ops and Orchestrator, and
[AGENTS.md](../../AGENTS.md#execution-substrate-and-independence) owns them. The
same work order serves every pool, and a pool name never appears where a role
belongs.

**What an adapter owns.** A provider adapter — `CLAUDE.md` is the current one —
maps this policy onto one client's substrate: which of the client's surfaces counts
as a visible session, how a background context is identified, how model and effort
are named, how provenance is recorded. It owns nothing else. It does not restate,
extend, or override policy, and general process must not be duplicated into it. A
rule that would be true of every pool belongs in `AGENTS.md` or in the owning
process document, never in an adapter.

**Dispatch is pool-blind by default.** The work order names `eligible provider
pools` only where a qualification rung, a measured capability, or a substrate
requirement actually constrains the choice. "This pool is the one we usually use" is
not such a constraint.

### The qualification ladder

A new pool climbs these rungs in order. Each rung is cleared by evidence from that
pool's own completed work, not by argument about the pool's capability, and the
control plane records the rung reached.

| Rung | The pool may take                                                            | Cleared by                                                                                                                                          |
| ---- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Nothing. The protocol is run **by hand** across real work in existing pools. | Several complete work orders executed manually under this process, with their defects recorded, before any dispatcher automates it.                 |
| 1    | Read-only investigation and bounded diagnosis.                               | Returns that distinguish what the pool measured from what it read, and that stop rather than widening into implementation.                          |
| 2    | Documentation and process orders.                                            | A result that cites its sources precisely and does not restate a rule that already has an owner.                                                    |
| 3    | Ordinary non-floor implementation, under QA-2.                               | Builder returns whose declared scope matches the computed diff, and whose own figures survive the load-bearing re-check.                            |
| 4    | Independent QA at QA-1, then QA-2.                                           | Verdicts that bind to an exact head, execute their own load-bearing measurements, and find at least one thing the Builder's report did not contain. |
| 5    | Floor-class implementation, and independent QA at QA-3.                      | An explicit control-plane decision. It is not reached by accumulating rung-4 passes.                                                                |

**Rung 0 is a real rung and it is first.** Run the Stage 2 protocol manually across
real work in the pools already in use before building a dispatcher for it. A
dispatcher automates whatever the protocol actually does, including the parts that
are wrong, and the cheapest place to find those is by hand.

### Local-model QA comes late, and why

A locally hosted model may reach rung 3 on the ordinary evidence. **It does not take
independent QA — any level — until it has cleared rungs 1 through 3 on its own
completed work**, and it never takes QA-3 without an explicit control-plane
decision. Two reasons, both already written down elsewhere in this policy:

- **Reviewer and Builder errors are not symmetric.** A weaker Builder produces work
  the reviewer catches; a weaker reviewer lets defects reach `dev`. `AGENTS.md`
  therefore directs economy to the Builder side and preserves reviewer capability,
  and a local model is adopted for economy. See
  [where economy is taken](../../AGENTS.md#where-economy-is-taken).
- **QA's value is in the finding no test plan enumerates.** The verdicts that have
  mattered in this programme were adversarial in a way a checklist cannot specify:
  attacking a guard by deleting it to see whether a second layer exists, racing a
  check-then-write gap a code reading had called unreachable, crafting a display name
  through two ordinary player routes. A pool is credited with that capability only
  after its own returns show it.

The corollary is that a cheaper pool may be used for **mechanically specifiable**
verification — preservation QA and the like — only when the dispatch packet
enumerates the exact proofs required, so that the capability comes from the contract
rather than being assumed of the pool. The mandatory QA floor still governs.

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

- [`../../AGENTS.md`](../../AGENTS.md): the canonical provider-neutral execution
  policy read by every worker, including execution substrate, the mandatory QA
  floor, required reading, and cost-aware execution;
- [`control-plane.md`](./control-plane.md): durable authority, tooling,
  governance, sources of truth, and integration policy;
- [`task-contract.md`](./task-contract.md): self-contained contract and
  acceptance schema;
- [`agent-execution.md`](./agent-execution.md): isolated Builder procedure and
  exact Builder return;
- [`qa-execution.md`](./qa-execution.md): compact INITIAL/REPAIR QA dispatch,
  worker entry, verification breadth, QA levels and independence, finding
  dispositions, child states, and QA return;
- [`qa-instruments.md`](./qa-instruments.md): the register of reusable QA probes,
  their limitations, and their known failure modes;
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
