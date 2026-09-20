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
  -> visible Builder or bounded Investigator
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
| `Active`                             | A named visible Builder, Investigator, QA lane, or bounded repair owns work in flight.                                                                                             |
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
not a target. Reserve repair or infrastructure capacity when useful, begin QA
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
