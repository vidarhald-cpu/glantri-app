# Development baseline and integration policy

The [canonical development operating model](./development-operating-model.md)
owns the high-level role, workflow, lifecycle, execution-lane, and
repository/project map. This document owns branch, accepted-baseline,
integration, verification, and release-boundary policy.

## Branch model and authority

`dev` is Glantri's non-production integration branch. Short-lived task branches start from an accepted `dev` commit and return through coherent task PRs.

```text
short-lived task branches/worktrees
              |
              v
             dev  -- CI, no production deployment
              |
              v
        release PR to main
              |
              v
        Azure production
```

- The Product Owner owns `dev` baseline selection, development acceptance, and
  integration decisions. Within an already authorized bounded lane, the
  Development Orchestrator may perform the routine branch, PR, evidence, and
  lifecycle operations granted by the canonical operating model; an authorized
  integration actor merges only after the required acceptance gate, including
  explicitly pre-authorized conditional integration when every condition passes.
- The external maintainer is not part of routine development. Their role is limited to production-release/deployment support at the future `dev -> main -> Azure` boundary.
- `main` is production-coupled and remains outside ordinary agent authority. Agents do not push or merge to it, change its rules, deploy, or alter Azure/production configuration.
- Pushes to `dev` run `.github/workflows/ci.yml`. They do not trigger `.github/workflows/deploy.yml`, whose push trigger is restricted to `main`.
- After every production release, reconcile the released `main` state back into `dev` before starting from a newer accepted baseline.

Credentials never replace task authorization. Pushes, PR creation/updates, branch-rule changes, and merges require the authority stated in the task contract and this policy.

## Canonical development environment

- Current Git and case-management authority is the loopback-only Forgejo repository `recovery-admin/glantri-app`.
- The canonical MacBook clone is `/Users/vidarhald/dev/glantri-app-forgejo`.
- The canonical Codex project is `Glantri app — Forgejo`.
- The historical `Glantri app` project and `/Users/vidarhald/dev/glantri-app` checkout are read-only, non-mutable recovery/history evidence. Do not use them for new implementation, Builder work, QA mutation, branch creation, reset/rebase/cleanup, migration, or routine current-development fetch/push.
- Repository documents are authoritative. Codex project references are navigation aids and do not grant task, Git, integration, release, or production authority.
- The canonical clone's repository-local Git configuration sets
  `credential.useHttpPath=true` and
  `credential.username=glantri-no-default`. Because that username has no
  Keychain item, unqualified access fails with prompting disabled. Every role,
  including separately authorized recovery administration, must be selected
  explicitly through the repository-path-scoped handles in
  [`forgejo-agent-credentials.md`](./forgejo-agent-credentials.md).
- `remote.origin.fetch` in the canonical clone is intentionally narrow
  (`+refs/heads/dev:refs/remotes/origin/dev`). Task preparation, QA, and
  integration checks must fetch task branches and PR heads through explicit
  refspecs rather than relying on ambient remote-tracking refs, and must not
  widen the configured refspec to work around that.
- `main`, Azure, and production remain the external-maintainer release boundary described above.
- One Development Orchestrator coordinates all visible execution directly. Its
  UI association is operator configuration, not repository authority. Historical
  coordinators are retired from normal routing after their running children are
  harvested; they do not provision new work. All substantial Builder,
  Investigator/Ops, and independent-QA execution uses `Glantri app — Forgejo`.

### Exact-SHA provisioning gate

All implementation and QA provisioning, including replacements, originates from
`Glantri app — Forgejo` rooted at
`/Users/vidarhald/dev/glantri-app-forgejo`, or an isolated worktree derived from
that saved project. A derived path is valid execution, not an identity failure.
The historical `/Users/vidarhald/dev/glantri-app` checkout never provisions work.

Every contract supplies full exact accepted baseline and requested execution
SHAs. A fresh Builder starts at the accepted `dev` baseline; an authorized
continuation starts at its separately specified exact parent on the existing
branch/PR. QA starts at the immutable candidate head, with the accepted baseline
recorded separately. Never infer a SHA from `main`, `origin/main`, remote HEAD,
or a project/default branch.

Before execution, verify the source project, root/worktree, canonical loopback
Forgejo origin, common Git directory, and `HEAD` equal to the requested SHA.
Record requested versus observed facts. QA is detached at that head with no
local branch or upstream tracking. A queued client request, task-list entry, or
branch name alone does not pass this gate. A mismatch blocks launch and requires
explicit reconciliation; never substitute a baseline silently.

## Operational baseline status (2026-08-11)

- `dev` is the active integration branch. Its accepted initial baseline is `2203f37e196e2de34cf911ea4fa08ac9feb6f8be`.
- The local Forgejo `dev` protected-branch rule disables direct push, requires
  the `CI / ci (pull_request)` and `CI / docker-test (pull_request)` contexts,
  requires zero approving reviews, applies to administrators, and allows merge
  only to `glantri-orchestrator`. The historical GitHub ruleset `20708650` is
  provenance, not current enforcement. See
  [`forgejo-agent-credentials.md`](./forgejo-agent-credentials.md).
- Ordinary task branches start from an exact accepted `dev` SHA and their PRs target `dev`.
- `main` remains production/release only. After every production release, reconcile the released `main` state back into `dev` before accepting a newer development baseline.
- PR #200 is superseded provenance, not the active development baseline. Its head, `4179034ef13c1713a23bddad7bf9ce01fc4880ea`, is an ancestor of the accepted `dev` lineage.

The current accepted `dev` SHA advances through compliant task PRs and is recorded in each task contract and merge handoff. The initial baseline above remains the fixed publication reference.

## Initial `dev` reconciliation provenance

The accepted initial baseline preserves application history, production/main reconciliation, and the control-plane bootstrap:

1. **R0:** `9d6f2dc0f695631fbe2e603dbeec850f7512d8e5`, the accepted application head containing the 50 local continuation commits beyond PR #200's published head.
2. **M1:** merge exact fetched `origin/main` SHA `ab08677b0e48f574d57ca94cc394064cb3a7a1b0` into R0 with `--no-ff`.
3. **M2:** merge exact approved bootstrap head `fe0a63108f3e2745f55b3c4aec871e7410c26117` into M1 with `--no-ff`, retaining bootstrap commits `6d9ffb1e`, `3b6565b0`, and `fe0a6310` in ancestry.
4. **P1 and publication repair:** synchronize the development policy, complete the verification gate, and repair the candidate to accepted SHA `2203f37e196e2de34cf911ea4fa08ac9feb6f8be` before publication.

The merge topology preserves correspondence with PR #200, the 50 local continuation commits, `main` changes #189-#191, and the approved bootstrap lineage. Closing PR #200 as superseded and unmerged preserves that provenance and does not reject its work; do not retarget it.

## Normal task policy after publication

1. Every task contract names the exact accepted `dev` SHA, task branch/worktree, intended target, and Git authority.
2. Work occurs in a clean, isolated, short-lived task branch/worktree.
3. Ordinary local Forgejo development PRs target `dev`; the Product Owner
   decides acceptance and integration, and an authorized integration actor may
   merge when the required checks and acceptance are satisfied.
4. Changes arrive as coherent behavior or architecture slices. `dev` must not become another unbounded long-lived feature stream.
5. Reserved hotspots and cross-area contract order are coordinated before implementation.
6. Completed work records parent SHA, resulting SHA, verification, dependencies, compatibility, and follow-ups.
7. A release is prepared from `dev` to `main`; production review/deployment support occurs only at that boundary.
8. After release, merge or otherwise reconcile exact `main` back into `dev`, verify the result, and record the new accepted `dev` SHA.

## PR freshness, merge base, and pre-integration recheck

Before independent QA is dispatched and before control-plane acceptance is
requested, the Development Orchestrator must establish the actual protected-branch
freshness and merge-base state of the candidate PR.

- The Forgejo `mergeable` field means only that no conflict was detected. It is
  not a freshness statement.
- The PR `base_sha` field reports the base branch head, not the merge base
  between the base branch and the PR head. It must not be read as evidence that
  the PR contains the current `dev`.
- Resolve the real facts explicitly: the current `dev` head, the PR head, and
  the actual merge base between them. An outdated merge base means the PR is
  outdated regardless of `mergeable`.

Handling an outdated PR:

1. Refresh it mechanically wherever that is possible, before QA rather than
   after it.
2. Independent QA remains bound to one exact PR head SHA; a verdict always names
   the full immutable SHA it reviewed.
3. If a later refresh changes the head of a runtime or code PR after QA, fresh
   QA on the new exact head is required. See
   [QA verification classes](./qa-execution.md#verification-classes-and-evidence-validity).
4. Control-plane acceptance should normally be requested only for an
   integration-ready exact head.

Immediately before integration, recheck the exact head, the target branch,
freshness against the current `dev`, the required protected checks, and
mergeability. Earlier evidence does not substitute for that final recheck.

Direct pushes to `dev` remain prohibited for every identity; task work reaches
`dev` only through a reviewed PR merged by the authorized integration identity.
`main` remains outside agent authority entirely.

## Verification and publication prerequisites

Before the initial or any materially reconciled `dev` baseline is published:

- fetch/prune and confirm the exact remote SHAs and production-only deploy trigger;
- preserve the declared application toolchain: Node 22.x, pnpm 10.6.0, and PostgreSQL 16;
- run frozen install, generation, typecheck, lint, changed-file formatting, tests, coverage, build, and file-size reporting;
- validate migrations and database integration tests against a disposable PostgreSQL 16 test database only;
- run targeted regression checks for reconciled semantic hotspots, including Combat progression/synchronization and main-only sync/error behavior;
- run Docker readiness and supported Playwright/multi-perspective smoke checks when the existing local environment supports them;
- inspect Git status after generation/build/test steps and finish with a clean committed candidate;
- classify every failure as reconciliation regression, pre-existing issue, environment/tooling issue, or product decision; and
- report the exact candidate topology and obtain product-owner acceptance before publishing.

### Path-aware dev gate — integrated status

The [#161 cutover authorization](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/161#issuecomment-4354)
authorized the separate gate implementation case #163/PR #164, now integrated
at `dev@5ac0f9debda4e6c761d1c68482de24c40f266889`. The
[integration record](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/163#issuecomment-4590)
confirms the independently reviewed implementation and hosted proof. The
`CI / dev-integration-gate (pull_request)` aggregate is the controlling decision
and succeeds only when all applicable checks for the actual change pass:

| Change class                          | Required validation                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure non-executable documentation     | Changed-file formatting, whitespace, links/references, scope and policy/content consistency.                                                    |
| CI, workflow, or tooling              | Focused tooling/workflow checks and regressions, plus relevant hosted execution/artifact proof. Local proof does not stand in for hosted proof. |
| Application runtime, schema, or data  | The full appropriate application gate, including relevant typecheck, lint, tests/build, database, privacy/security, and browser evidence.       |
| Mixed changes                         | The strongest applicable validation across all affected classes; adding documentation never downgrades another class.                           |
| Unknown or sensitive executable paths | Fail closed; require explicit classification and adequate validation before integration.                                                        |

The implementation is integrated, not pending. The existing required
`CI / ci (pull_request)` and `CI / docker-test (pull_request)` contexts execute
compatibility guards which fail unless the aggregate succeeds. They enforce the
path-aware decision without a branch-protection settings transition. Inapplicable
application jobs are skipped, not claimed as executed runtime validation.
The [technical gate reference](./dev-integration-gate.md) owns classification,
workflow details and the optional future required-context rename. Verify the
current candidate's actual hosted results and live Forgejo state; the #163
integration record does not certify a later PR or authorize its integration.

Preserve protection throughout. Do not make all checks optional, spoof success,
or bypass a failing or absent check. If an optional protected-context transition is blocked,
prepare the smallest exact one-time transition proposal, with current and
proposed settings, evidence and restoration conditions, for control-plane
confirmation. The approval is not general authority to change credentials,
runner/Forgejo infrastructure, other protections, `main`, Azure or production.

### Conditional integration

Only an issue contract that explicitly grants conditional `dev` integration
allows it without another approval round trip. The integration actor must verify
the live head equals the independently reviewed exact head, required QA is PASS,
applicable protected checks are PASS, and all scope, decision, dependency,
topology, target and acceptance conditions are satisfied. An explicit acceptance
gate remains binding. A documented QA exemption is not a QA PASS and does not
create conditional integration authority. Never override FAIL or infer merge
authority from local verification or technical mergeability.

When all stated conditions pass, integrate promptly without another Product
Owner stamp; do not leave completed candidates idle and create avoidable refresh
churn. An unresolved rule, product, UX, or consequential architecture finding
still blocks integration. QA and hosted checks run in parallel by default once
the immutable candidate is ready, except for concrete dependencies or measured
resource contention. An unchanged exact-head PASS remains valid over time;
mechanical head changes use preservation QA, while product changes require fresh
substantive QA under [verification classes](./qa-execution.md#verification-classes-and-evidence-validity).
None of this grants main, production, or Azure authority.

### Formatting debt baseline

The initial reconciliation inherited 470 files that fail a full-repository Prettier check. Wholesale normalization is explicit P3 technical debt and is not part of initial `dev` publication. `pnpm format:check` remains the debt-audit command; it is not a publication gate while that debt remains.

The required gate is `pnpm format:check:changed -- <accepted-parent-sha>`. It runs `git diff --check` and Prettier on added, copied, modified, renamed, type-changed, or unmerged files relative to the accepted parent. CI supplies the PR base or prior push SHA and falls back to reconciliation candidate `581841e99afd536d41cce4e5a5bac5a09f2be194` for a new branch. When a release PR targets a base older than that candidate, the gate clamps the comparison to the inherited-debt baseline so the known historical backlog does not become release-blocking. Thus every post-baseline touched file must be formatted while untouched historical debt remains non-blocking.

For every published baseline change, verify remote `dev`, required checks, task-PR target behavior, and absence of production deployment. Record the resulting `dev` SHA in the task handoff.

## Standing documentation economy

Mandatory agent reading is an architectural and resource cost. Keep it controlled and reasonably short:

- `AGENTS.md` and tool-specific top-level guides contain concise operating rules and links, not full process duplication.
- The task contract names the exact required reading set for that task; it must not say `read all architecture docs`.
- Area-specific documents are mandatory only when the task touches that area.
- Decision records, audits, historical reports, and provenance material are read on demand when relevant, not at every startup.
- A new standing document needs a clear safety or execution reason to join the mandatory set. If its content is area- or task-specific, keep it scoped there.
- Periodically prune duplication and move detail downward into linked process, area, or decision documents.

This is an efficiency principle, not a rigid line-count rule. The goal is enough context for safe, effective execution without repeatedly loading irrelevant history.
