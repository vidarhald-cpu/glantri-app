# Isolated Builder and independent QA execution

## Purpose and authority

Use this procedure for an authorized implementation issue that needs an isolated Builder and an independent QA pass. It is tool-agnostic: a human coordinator, Codex, Claude, or another agent may perform a role, but no role depends on private chat history or expands the Git, product, merge, release, or production authority recorded in the issue.

- The product owner/control plane decides priority, product and rule behavior, consequential architecture choices, acceptance, and `dev` integration. An implementation or QA agent may identify a decision but may not invent it.
- The GitHub issue is the self-contained task contract and authorization record. The PR is the implementation and QA handoff record. GitHub is authoritative for exact SHAs, PR state, checks, findings, and readiness.
- `Ready` means the issue contract is complete and current. `Authorized` means the product owner/control plane has explicitly permitted implementation. A Builder starts only when both are recorded; `Ready` alone is not permission to start. `Active` means a role-specific Builder/repair or Independent QA lane is currently claimed.
- Builder self-assessment is not acceptance. A passing QA verdict is evidence for, not a substitute for, control-plane/product-owner acceptance and integration.
- The issue defines the stopping point. Nobody infers authority to merge, release, touch `main`, deploy, or change production merely because implementation or QA is complete.

## ACTIVE lane claim and release protocol

Before substantive work, every external Builder or Independent QA agent must claim its role-specific lane on the owning GitHub issue. The claim records occupancy; it does not create `Ready` status, authorization, acceptance, merge authority, or release authority.

Use one of these exact first-line forms with the real issue, PR, and full SHA substituted:

```text
ACTIVE — Builder — issue #NNN — baseline <full SHA>
ACTIVE — Independent QA — PR #NNN — head <full SHA>
```

- A Builder resolves the issue's exact accepted baseline and live `origin/dev` before claiming. An Independent QA agent resolves the exact current PR head before claiming and before review or test work.
- Include agent/tool identity, branch and PR or `PR pending`, reserved hotspots or ownership area, an ISO 8601 start timestamp, and an explicit statement that the lane is claimed and must not be duplicated.
- If the branch, PR, baseline, or reviewed head materially changes, update the claim or post a new `ACTIVE` claim that explicitly supersedes it. A changed PR head invalidates an older QA claim and verdict.
- A current valid claim means that role-specific lane is occupied. Another external agent must not duplicate it unless the control plane explicitly authorizes parallel ownership and records the split.
- GitHub assignees are optional metadata and are not ownership authority because several agent tools may share one GitHub identity. The issue-level claim plus exact SHA/PR is the durable ownership signal.
- Issue-level claims take precedence for occupancy even when the GitHub Project or portfolio ledger such as issue #260 has not yet been refreshed. The GitHub watch/control plane may use the standardized first lines and terminal states to discover transitions.

Before stopping, the claimant must post a current issue handoff or release whose first line begins with one of these standardized states and includes the exact issue/PR/head where applicable:

- `READY FOR INDEPENDENT QA` — Builder work is published and the Builder lane is released for exact-head QA.
- `READY FOR CONTROL-PLANE ACCEPTANCE` — QA passed and the QA lane is released for acceptance/integration review.
- `REPAIR REQUIRED` — QA found an integration-blocking defect; the QA lane is released, and authorized Builder repair must publish a fresh Builder `ACTIVE` claim.
- `NEEDS DECISION` — the claimant is no longer active; state the one concrete decision and current exact state.
- `RELEASED / NOT ACTIVE` — use when abandoning or stalling without a completed handoff; state the exact reason and current branch/PR/head.

These states end the claimant's current lane; they do not automatically authorize the next role. Never stop with a stale `ACTIVE` claim.

## Issue-to-integration loop

1. **Authorize and verify.** The control plane confirms that the issue is `Ready + Authorized`, dependencies and hotspots are available, and no more than four authorized implementation Builders will be active. The Builder reads `AGENTS.md` and only the exact task-specific documents, fetches the remote, and resolves the exact live `origin/dev` SHA. If it differs from the issue's accepted baseline, stop for contract refresh; do not silently choose or rebase onto a new baseline.
2. **Claim and build in isolation.** The Builder uses a clean, short-lived branch and isolated worktree at the accepted SHA, confirms that the Builder lane is unoccupied, posts the Builder `ACTIVE` claim, implements the approved slice, and does not widen scope to absorb unrelated findings, dependency changes, or hotspot conflicts.
3. **Publish, hand off, and release.** The Builder runs proportionate verification, inspects the resulting diff and status, commits and pushes the authorized branch, opens or updates one draft PR targeting `dev`, records the exact PR head and structured Builder return in GitHub, posts `READY FOR INDEPENDENT QA` on the owning issue, then stops. Builder self-review does not make the PR accepted.
4. **Claim and review the exact head independently.** A fresh QA reviewer uses a separate clean worktree, fetches the PR, resolves its exact head SHA, posts the Independent QA `ACTIVE` claim on the owning issue, and reviews that immutable head against the issue. QA checks acceptance, scope, regressions, required perspectives, presentation, privacy, product quality, database evidence, and relevant CI/local checks. QA does not repair Builder-owned code. If the PR head changes during review, the claim and result are stale; QA claims and reviews the new head before issuing a verdict.
5. **Route the verdict.** QA posts `PASS`, `PASS WITH FOLLOW-UP`, or `FAIL` with evidence. `PASS WITH FOLLOW-UP` is allowed only for durably recorded non-blocking work; it must identify why integration is safe. `FAIL` returns clear in-scope defects to the same Builder and PR. The Builder publishes a new exact head and fresh handoff, then independent QA reruns against that head.
6. **Accept and integrate.** On a passing QA verdict, the control plane/product owner decides acceptance and integration. An authorized integration actor may merge the accepted ordinary PR into shared `dev` after required checks and coordination. QA and Builder do not infer merge authority.
7. **Release separately when chosen.** A release is optional and separately authorized. The product owner decides release readiness; a narrow `dev -> main` release PR is prepared under the release contract; the external maintainer owns production release/deployment support. Ordinary agents do not merge `main`, deploy, or mutate Azure/production.

The coordinator moves handoffs between roles and keeps the issue/PR current. The product owner should receive decision-point messages, not have to copy private chat between Builder and QA.

## Capacity, collisions, and exception paths

- No more than four authorized implementation Builders may be active at once. This is a ceiling, not a requirement to fill all lanes.
- One active task owns a reserved hotspot unless a written integration plan assigns a safe split and merge order. A dependency or hotspot collision stops the affected Builder for coordination; it does not authorize wider scope.
- A missing product, rule, UX, privacy, or consequential architecture decision becomes `Needs decision`. State one concrete question and stop affected implementation.
- A clear in-scope QA failure returns to the same Builder/PR, followed by fresh independent QA. An unrelated defect becomes a bounded backlog issue; low-impact non-blocking polish may become a durably recorded P3 follow-up.
- For a production-only problem, ordinary agents may perform safe, read-only diagnosis when authorized. They do not mutate production, change Azure, merge `main`, or deploy; route the evidence to the external-maintainer release boundary.
- Durable decisions, scope changes, SHAs, verdicts, and status belong in the issue, PR, or repository docs. Chat-only context cannot authorize or complete work.

## Standard Builder return

Post this concise handoff to the draft PR. Post or link the exact result from the owning issue and make `READY FOR INDEPENDENT QA` its current terminal state:

```text
BUILDER RETURN
Issue: #<number> — <title>
Exact baseline: origin/dev <full SHA>
Branch / PR / exact head: <branch> / #<PR> / <full SHA>
Changes: <concise result>
Explicit exclusions: <not changed>
Tests/checks: <commands and results; distinguish pre-existing/environment failures>
Schema/migration/data impact: <none or exact impact and database-safety evidence>
Risks/follow-ups: <none or durable links>
State: READY FOR INDEPENDENT QA | BLOCKED — <one concrete blocker>
```

## Standard independent QA return

Post this to the PR after reviewing the exact head. Post or link the exact verdict from the owning issue and leave the applicable QA terminal state there:

```text
QA RETURN
PR / exact reviewed head: #<PR> / <full SHA>
Verdict: PASS | PASS WITH FOLLOW-UP | FAIL
Criteria reviewed: <issue acceptance criteria and applicable dimensions>
Independent tests/checks: <commands, evidence, and results>
Findings/severity: <none or each finding with severity and durable link>
Integration blockers: <none or exact blockers>
Follow-ups: <none or non-blocking durable links and why integration is safe>
State: READY FOR CONTROL-PLANE ACCEPTANCE | REPAIR REQUIRED | NEEDS DECISION
```

Only `PASS` or `PASS WITH FOLLOW-UP` may use `READY FOR CONTROL-PLANE ACCEPTANCE`. A QA return always identifies the exact reviewed head; a branch name alone is insufficient.

## Isolation and database safety

Builder and QA use separate clean filesystems/worktrees for clean-room verification. Same-worktree helper agents are suitable only for bounded analysis that does not claim independent QA.

Git worktree isolation does not isolate PostgreSQL. Before a database-capable Builder or QA starts application code, migrations, resets, seeds, or integration tests, its task contract must name explicit `DATABASE_URL` and `DATABASE_URL_TEST` ownership and the worktree must pass the disposable PostgreSQL 16 setup and verification in `docs/dev-database.md`. Never copy or inherit the primary checkout `.env` or another worktree's `.env.task`; environment values are not ownership proof until they match the actual current worktree and expected container labels. Record the sanitized target before every database-capable command and clean up only the current worktree-owned container at handoff.

## Finding routes

Route each finding once, without broadening the active task:

- clear, in-scope defect: same Builder task and PR;
- unrelated defect: durable backlog issue;
- clear low-impact polish: P3 backlog;
- material product or rule ambiguity: `Needs decision` for the product owner/control plane;
- cross-area architecture or ownership conflict: architecture/control-plane review.

Do not add speculative placeholders, disabled future controls, or unapproved future UI to make a later task appear prepared.

## Unattended local operation

Long local runs need stable network connectivity, an awake machine, and preferably connected power. If the machine sleeps, local commands, tests, databases, and worktrees pause. If connectivity disappears, coordination and GitHub operations can disconnect or fail even when an already-started local process continues.
