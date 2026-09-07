# Isolated Builder and independent QA execution

## Purpose and authority

Use this procedure for an authorized implementation case or other named durable task contract that needs an isolated Builder and an independent QA pass. It is tool-agnostic: a human coordinator, Codex, Claude, or another agent may perform a role, but no role depends on private chat history or expands the Git, product, merge, release, or production authority recorded in the contract.

- The [canonical development operating model](./development-operating-model.md)
  owns the role map, workflow, lifecycle, visible-lane requirements, standing
  authority, and return gates. This document owns the detailed isolated
  Builder procedure and Builder return. The compact
  [independent QA procedure](./qa-execution.md) owns QA startup, INITIAL versus
  REPAIR QA, QA handoffs, entry checks, child states, and the QA return.
- The Product Owner decides priority, product and rule behavior, UX,
  consequential architecture, authorization, acceptance, and `dev`
  integration. Architecture/control plane proposes and interprets; it does not
  silently make those decisions. An implementation or QA agent may identify a
  decision but may not invent it.
- The local Forgejo issue, when applicable, is the self-contained task contract and authorization record. The Forgejo PR is the implementation and QA handoff record. Forgejo is authoritative for current case status, exact SHAs, PR state, checks, findings, and readiness; repository documents control standing policy.
- `Ready` means the task contract is complete and current but is not permission
  to start. `Authorized` is the next exclusive lifecycle state, reached only
  after the Product Owner copies explicit bounded authorization into the
  operational flow. A Builder starts from `Authorized` only after the
  Development Orchestrator confirms the contract remains current and live gates
  pass.
- Builder self-assessment is not acceptance. A passing QA verdict is evidence
  for Architecture/control-plane evaluation and Product Owner acceptance; it
  does not substitute for either or for the Product Owner's integration
  decision.
- The task contract defines the stopping point. Nobody infers authority to merge, release, touch `main`, deploy, or change production merely because implementation or QA is complete.

## Case-to-integration loop

1. **Authorize and verify.** Architecture/control plane prepares or interprets
   the complete task contract; the Product Owner decides and copies the
   authorization; the Development Orchestrator confirms the issue is
   `Authorized`, the contract remains complete/current, dependencies and
   hotspots are available, and no more than four implementation Builders will
   be active. The Builder fetches the remote and resolves the exact live
   `origin/dev` SHA. If it differs from the contract's accepted baseline, stop
   for contract refresh; do not silently choose or rebase onto a new baseline.
2. **Build in isolation.** The Builder uses a clean, short-lived branch and isolated worktree at the accepted SHA. It reads `AGENTS.md` and only the exact task-specific documents, implements the approved slice, and does not widen scope to absorb unrelated findings, dependency changes, or hotspot conflicts.
3. **Publish, harvest, and stop.** The Builder runs proportionate verification,
   inspects the resulting diff and status, commits and pushes the authorized
   branch, opens or updates one draft PR targeting `dev`, records the exact PR
   head and structured Builder return in Forgejo, and stops. The Development
   Orchestrator harvests the exact result and advances the issue to
   `Ready for Independent QA`. Builder self-review does not make the PR
   accepted.
4. **Hand off and review the exact head independently.** The Development
   Orchestrator applies only the shallow dispatch gate in
   [`qa-execution.md`](./qa-execution.md) and sends the applicable immutable
   INITIAL or REPAIR tuple directly to the pinned QA Orchestrator. A fresh QA
   reviewer in a separate visible task and clean worktree independently checks
   topology, scope, the actual delta, and the selected substantive gates. A
   mismatch returns quickly as `BLOCKED`; the Orchestrators do not duplicate
   that substantive verification.
5. **Harvest and route the verdict.** The QA Orchestrator harvests the separate
   QA task and records `PASS`, `PASS WITH FOLLOW-UP`, or `FAIL` with durable
   evidence, then returns directly to the Development Orchestrator.
   `PASS WITH FOLLOW-UP` is allowed only for durably recorded non-blocking work;
   it must identify why integration is safe. PASS advances the issue to
   `Ready for Control-plane Acceptance`. FAIL never does: clear in-scope
   defects return through the Development Orchestrator to the same Builder and
   PR as an `Active` bounded repair. The Builder publishes a new exact head,
   followed by a compact REPAIR handoff and fresh independent QA. A direct-child
   narrow repair may retain demonstrably unaffected prior PASS evidence;
   high-risk or unclear topology triggers broader verification as defined in
   `qa-execution.md`.
6. **Accept and integrate.** On a passing QA verdict, Architecture/control plane
   evaluates the durable result and the Product Owner decides acceptance and
   integration. An authorized integration actor may merge the accepted ordinary
   PR into shared `dev` after required checks and coordination. QA and Builder
   do not infer merge authority.
7. **Release separately when chosen.** A release is optional and separately
   authorized. The Product Owner decides release readiness; a narrow
   `dev -> main` release PR is prepared under the release contract; the
   external maintainer owns production release/deployment support. Ordinary
   agents do not merge `main`, deploy, or mutate Azure/production.

The Development Orchestrator and QA Orchestrator move handoffs directly and keep
the issue/PR current. The Product Owner receives decision and acceptance
messages; they do not normally copy QA prompts or monitor child completion.
Manual copy/paste is only an explicitly authorized technical fallback when
direct routing is unavailable.

## Visible task dispatch and completion

Substantial implementation Builder, independent QA, and dispatched bounded
Investigator lanes each use a separate visible Work/Codex task. Builder and QA
for the same result must be different visible tasks. Hidden internal sub-agents
may assist minor orchestration inside a lane, but same-thread or hidden work does
not satisfy a Builder, QA, or dispatched Investigator lane. If visible task
creation is unavailable, the Development Orchestrator reports the capability
problem and uses only an explicitly authorized manual visible fallback; it does
not claim that a hidden substitute fulfilled the role.

At Builder or Investigator dispatch, record:

- canonical Codex project (`Glantri app — Forgejo`);
- role and Forgejo issue when applicable;
- resolved visible Work/Codex thread ID, which is mandatory;
- direct task/thread link when the client provides one, recorded separately from the thread ID because neither substitutes for the other;
- isolated worktree;
- branch when applicable;
- exact accepted baseline SHA; and
- current state: `queued`, `running`, `completed`, or `failed`.

Independent-QA dispatch and the explicit `Running`, `Blocked`,
`Completed-unharvested`, `Completed-harvested`, `Failed`, and `Stalled`
child states are defined in `qa-execution.md`. These coordination states do not
replace the exclusive Forgejo issue lifecycle.

The Development Orchestrator must follow each Builder/Investigator task through
completion, retrieve its exact head/result, reconcile Forgejo evidence/status,
and surface the harvested outcome in the consolidated return. The QA
Orchestrator does the same for its independent-QA child and returns directly to
the Development Orchestrator. A child task merely ending, or a dispatch
remaining queued, is not operational completion.

## Standing execution authority

After a bounded lane is Product Owner authorized, the Development Orchestrator
may claim task/issue ownership, mark it `Active`, transfer or release ownership at
Builder-to-QA-to-orchestrator boundaries, clear ownership at completion, and
apply defined lifecycle transitions for Builder completion, QA outcomes,
bounded repair, or control-plane return without repeated product-owner
confirmation. Normal execution also proceeds without repeated confirmation for
worktree/branch setup, authorized task dispatch, local Forgejo push/PR/evidence,
task-token creation/use/revocation, direct QA handoff, explicitly authorized
bounded repair, and disposable cleanup.

This standing authority does not authorize starting work that is merely
`Design` or `Ready`, broadening scope, accepting product/rule/UX/architecture
decisions, performing control-plane acceptance, or integrating behind an
explicit gate. Stop and return for a material scope, product/rule/UX/architecture,
new authorization, hotspot/dependency ownership, destructive persistent-data,
`main`/production, unresolved-behavior, or explicit acceptance/integration gate.

## Capacity, collisions, and exception paths

- Aggressively parallelize independent design and investigation, and start independent QA when its Builder finishes.
- No more than four authorized implementation Builders may be active at once. This is a ceiling, not a requirement to fill all lanes.
- A blocked lane does not stop unrelated lanes. Serialize only a real hotspot or dependency, and keep its owner and merge order explicit.
- One active task owns a reserved hotspot unless a written integration plan assigns a safe split and merge order. A dependency or hotspot collision stops the affected Builder for coordination; it does not authorize wider scope.
- A missing product, rule, UX, privacy, or consequential architecture decision becomes `Needs decision`. State one concrete question and stop affected implementation.
- A clear in-scope QA failure returns to the same Builder/PR, followed by fresh independent QA. An unrelated defect becomes a bounded backlog issue; low-impact non-blocking polish may become a durably recorded P3 follow-up.
- For a production-only problem, ordinary agents may perform safe, read-only diagnosis when authorized. They do not mutate production, change Azure, merge `main`, or deploy; route the evidence to the external-maintainer release boundary.
- Durable decisions, scope changes, SHAs, verdicts, and status belong in the issue, PR, or repository docs. Chat-only context cannot authorize or complete work.

## Standard Builder return

Post this concise handoff to the draft PR (and link it from the Forgejo issue when useful):

```text
BUILDER RETURN
Issue: #<number> — <title>, or N/A — <durable authorization record>
Dispatch: Glantri app — Forgejo / Builder / completed
Thread ID: <mandatory resolved visible Work/Codex thread ID>
Direct task/thread link: <link when the client provides one; otherwise unavailable>
Worktree: <absolute path>
Exact baseline: origin/dev <full SHA>
Branch / PR / exact head: <branch> / #<PR> / <full SHA>
Changes: <concise result>
Explicit exclusions: <not changed>
Tests/checks: <commands and results; distinguish pre-existing/environment failures>
Schema/migration/data impact: <none or exact impact and database-safety evidence>
Risks/follow-ups: <none or durable links>
State: READY FOR INDEPENDENT QA | BLOCKED — <one concrete blocker>
```

## Independent QA return

Use the compact mode-aware return in [`qa-execution.md`](./qa-execution.md).
Only `PASS` or `PASS WITH FOLLOW-UP` may advance to
`READY FOR CONTROL-PLANE ACCEPTANCE`. A QA return always identifies the exact
reviewed head; a branch name alone is insufficient.

## Isolation and database safety

Builder and QA use separate clean filesystems/worktrees for clean-room verification. Same-worktree helper agents are suitable only for bounded analysis that does not claim independent QA.

Git worktree isolation does not isolate PostgreSQL. Before a database-capable Builder or QA starts application code, migrations, resets, seeds, or integration tests, its task contract must name explicit `DATABASE_URL` and `DATABASE_URL_TEST` ownership and the worktree must pass the disposable PostgreSQL 16 setup and verification in `docs/dev-database.md`. Never copy or inherit the primary checkout `.env` or another worktree's `.env.task`; environment values are not ownership proof until they match the actual current worktree and expected container labels. Record the sanitized target before every database-capable command and clean up only the current worktree-owned container at handoff.

## Finding routes

Route each finding once, without broadening the active task:

- unauthorized information disclosure: blocking privacy finding; return it to the same Builder/PR when in scope, otherwise record a durable blocking defect without broadening the active task;
- clear, in-scope defect: same Builder task and PR;
- unrelated defect: durable backlog issue;
- clear low-impact polish: P3 backlog;
- material product or rule ambiguity: Architecture/control plane prepares the
  question and recommendation for Product Owner decision;
- cross-area architecture or ownership conflict: architecture/control-plane review.

Do not add speculative placeholders, disabled future controls, or unapproved future UI to make a later task appear prepared.

## Unattended local operation

Long local runs need stable network connectivity, an awake machine, and preferably connected power. If the machine sleeps, local commands, tests, databases, and worktrees pause. If connectivity disappears, coordination and Forgejo operations can disconnect or fail even when an already-started local process continues.
