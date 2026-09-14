# Glantri repository instructions

## Core rules

- Work from the existing Glantri monorepo and preserve established architecture unless the task explicitly changes it.
- Current Git and case-management authority is the loopback-only Forgejo repository `recovery-admin/glantri-app`. The canonical MacBook clone is `/Users/vidarhald/dev/glantri-app-forgejo`, and the canonical Codex project is `Glantri app — Forgejo`.
- The historical `Glantri app` Codex project and `/Users/vidarhald/dev/glantri-app` checkout are read-only, non-mutable recovery/history evidence. Do not use them for new implementation, Builder work, QA mutation, branch creation, reset/rebase/cleanup, migration, or routine current-development fetch/push. Repository documents remain authoritative; Codex project references are navigation aids.
- The product owner decides priority, game rules, user experience, development integration, and acceptance.
- `dev` is the shared development integration branch. The product owner/project development process may create and protect it and merge ordinary task PRs into it.
- The external maintainer participates only in future production-release/deployment support at the `dev -> main -> Azure` boundary.
- Never push or merge to `main`, deploy, change production/Azure configuration or secrets, or treat credentials as authority.
- Pushes and PR changes require explicit task or user authorization and a confirmed target.
- One Development Orchestrator owns execution coordination. It dispatches
  Builders, Investigators/Ops workers, and fresh independent QA directly; a
  permanent QA Orchestrator is not part of the operating model.

Canonical operating map: `docs/process/development-operating-model.md`. Detailed
authority and baseline policy: `docs/process/control-plane.md` and
`docs/process/development-baseline.md`.

## Task start and reading

Before non-trivial work:

1. Read this file and the exact additional documents named in the task contract.
2. Confirm the current Forgejo issue, when applicable, has reached `Authorized` through the canonical lifecycle and its body is the complete, current executable contract. Reconcile stale bodies before dispatch; comments cannot silently override them. `Ready` alone is not permission to start.
3. Confirm outcome, scope, ownership, accepted baseline branch/SHA, reserved hotspots, acceptance examples, verification, and Git authority.
4. Fetch and resolve the live `origin/dev` SHA. Stop for contract refresh if it differs from the accepted baseline; do not silently choose a new baseline.
5. Verify canonical provisioning source, origin/common Git directory and requested versus observed exact `HEAD`; use the authorized continuation parent when specified. QA is detached with no branch/upstream. Never infer from `main`, remote HEAD or defaults. Inspect current task sources/tests, not old branches or chat history.
6. Stop if the task requires an unapproved product/rule decision, an unknown baseline, or uncoordinated hotspot edits.

Keep mandatory startup reading controlled and task-specific. Area documents are required only when the task touches that area. Decision records, audits, and historical reports are read on demand. Task contracts must name exact paths rather than say `read all architecture docs`.

For an ordinary independent-QA task, the mandatory process set is only this
file, `docs/process/qa-execution.md`, the exact QA task contract, and the exact
task-specific sources named there. Load the broader process documents below
only when the task or an entry/risk check requires them.

Useful references:

- Task contract: `docs/process/task-contract.md`
- Isolated Builder/QA execution: `docs/process/agent-execution.md`
- Compact independent QA execution: `docs/process/qa-execution.md`
- Canonical development operating model: `docs/process/development-operating-model.md`
- Functional ownership/hotspots: `docs/architecture/ownership.md`
- Global user-facing principles: `docs/product/product-presentation-principles.md`
- Regression guidance: `docs/testing-regression-matrix.md`
- Rule and architecture decisions: `docs/decisions/`

## Continuation-first execution

- Continue the current authorized task, branch, PR, and worker whenever it can
  make meaningful progress. Do not create a replacement merely because status
  delivery is delayed, a worktree path briefly disappears, or a task is slow.
- The Development Orchestrator maintains one durable execution-ledger entry per
  `issue + role + mode + exact SHA`, including the provisioning request, real
  task ID, parent task, leased worktree, observed HEAD, liveness, and next
  action. A replacement is allowed only after the prior owner is confirmed
  completed, canceled, retired, or lost.
- A provisioned worktree is leased to its request/task until that ownership is
  durably released. Do not remove, reuse, or recreate it from the outside while
  the request may still materialize or the task may still be running.
- An authorized Builder has the full bounded authority stated in its contract:
  implementation, proportionate tests, commit, task-branch push, draft-PR
  publication, evidence, and automatic in-scope repair continuations. It does
  not gain merge, product-decision, `main`, release, or production authority.
- Independent QA is always a fresh separate visible task at the exact immutable
  candidate head when required by the contract. An explicit documentation-only
  exemption routes complete evidence to control-plane acceptance, without a QA
  claim. The Development Orchestrator dispatches and harvests QA directly. QA
  reviews/reports; it never repairs, pushes code, merges or makes product decisions.
- Read-only investigation and bounded operational diagnosis may be delegated to
  Investigator/Ops tasks. They do not silently become implementation. Authorized
  read-only investigation includes assigned-issue evidence publication; if a
  worker cannot publish with its assigned credential, the Development
  Orchestrator/Recorder automatically publishes the exact ready result.
- If a worker needs login, OS/browser permission, credential interaction, or
  another human action, record it and surface `USER ACTION REQUIRED` promptly.
- Integration may proceed automatically only when the task contract explicitly
  pre-authorizes it and the exact-head QA, scope, dependency, topology, and
  protected-check conditions all pass. Otherwise stop at the stated gate.
- Permit one initial attempt plus at most two automatic recovery/replacement
  attempts (three total); stop earlier after two substantially identical
  consecutive failures without a changed causal condition. Normally allow at
  most two Builder–QA repair cycles after initial QA; the same root cause twice
  or exhausted allowance requires **STOP — REPEATED EXECUTION FAILURE —
  CONTROL-PLANE CONFIRMATION REQUIRED**. Counters do not reset on handoff.
  Publish exact attempts/IDs/SHAs/failures, changed conditions and recommendation;
  no further attempt without confirmation. Follow `docs/process/agent-execution.md`.
- Validate returns against the ledger key; quarantine routing mismatches.
  Reconcile delayed duplicates to one retained owner and terminally retire the
  others before releasing leases. Unknown child existence blocks replacement.
- The coordinator never overrides QA FAIL: scoped defects go to the existing
  Builder, unrelated CI/environment failures to bounded Ops repair, and product,
  rule, UX, consequential architecture or permission decisions to control plane.
- The approved path-aware dev gate remains pending separate implementation and
  protected transition. Current protected checks remain binding; no bypass or
  fabricated success. See `docs/process/development-baseline.md`.

## Rule and architecture discipline

- Cite source documents, pages, sheets, cells, ranges, formulas, or approved rule decisions precisely.
- Do not silently resolve source conflicts or invent Glantri rules. Record material rulings under `docs/decisions/` and protect them with focused examples/tests.
- Keep raw import, enrichment, normalization, derivation, and verification separate.
- Current combat convention: `effectiveSkillNumber` is total skill XP, including direct and group-derived contributions.
- Apps may import packages; packages never import apps. `packages/domain` is the bottom layer, and `packages/rules-engine` imports only from domain.
- Database repositories are internal; callers use services. Game calculations belong in rules-engine. `@glantri/test-scenarios` is test/e2e only.
- Preserve canonical helpers/services and avoid duplicate calculation paths, unrelated refactors, or placeholders for unimplemented features.

## Git, tools, and verification

- Use one clean, short-lived task branch/worktree from the exact accepted `dev` SHA. Do not continue feature work on accepted or long-lived branches.
- Substantial implementation Builder, independent QA, and dispatched bounded
  Investigator/Ops roles use separate visible Codex tasks. Builder and QA must
  never be the same visible task; hidden helper agents do not satisfy these
  roles. The single Development Orchestrator coordinates all of them directly.
- Coordinate reserved hotspots and cross-area merge order through the task contract.
- Existing repository tools, Docker/local database tooling, and declared dependency installation are allowed. New software, global tools, services, permissions, or external transmission require explicit approval.
- A linked Builder/QA worktree that can reach PostgreSQL must own an explicit disposable task target; worktree filesystem isolation is not database isolation. Follow `docs/dev-database.md`, never copy the primary checkout `.env`, and never use the protected `localhost:5432/glantri` database from a linked worktree.
- Run verification proportional to the affected layers; normally typecheck, lint, tests, and build, plus database or browser checks when relevant.
- Inspect Git status after generation/build/test steps. Do not silently commit generated output.

At handoff report outcome, files, decisions, exact baseline/head, verification, Git/PR state, remaining risks, and follow-ups.
