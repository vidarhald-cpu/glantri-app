# Development baseline and integration policy

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

- The product owner/project development process controls `dev`: baseline selection, branch creation/protection, ordinary task-PR review and merge, integration order, and development acceptance.
- The external maintainer is not part of routine development. Their role is limited to production-release/deployment support at the future `dev -> main -> Azure` boundary.
- `main` is production-coupled and remains outside ordinary agent authority. Agents do not push or merge to it, change its rules, deploy, or alter Azure/production configuration.
- Pushes to `dev` run `.github/workflows/ci.yml`. They do not trigger `.github/workflows/deploy.yml`, whose push trigger is restricted to `main`.
- After every production release, reconcile the released `main` state back into `dev` before starting from a newer accepted baseline.

Credentials never replace task authorization. Pushes, PR creation/updates, branch-rule changes, and merges require the authority stated in the task contract and this policy.

## Initial `dev` reconciliation (2026-08-11)

The approved local reconciliation recipe preserves application history, current production/main history, and the control-plane bootstrap:

1. **R0:** `9d6f2dc0f695631fbe2e603dbeec850f7512d8e5`, the clean accepted local application head containing the 50 local commits beyond PR #200's published head.
2. **M1:** merge exact fetched `origin/main` SHA `ab08677b0e48f574d57ca94cc394064cb3a7a1b0` into R0 with `--no-ff`.
3. **M2:** merge exact approved bootstrap head `fe0a63108f3e2745f55b3c4aec871e7410c26117` into M1 with `--no-ff`, retaining bootstrap commits `6d9ffb1e`, `3b6565b0`, and `fe0a6310` in ancestry.
4. **P1:** add one narrow documentation-policy synchronization commit adopting this `dev` authority model and the standing-documentation policy below.
5. Run the complete reconciliation verification gate and obtain product-owner acceptance.
6. Only then create/push `dev` at the reported verified candidate SHA and apply the approved development branch rules.

As of the reconciliation preflight, remote `dev` is absent. A local reconciliation candidate is not yet the shared baseline merely because its commits exist. Publication, branch protection, push CI, and acceptance are separate prerequisites.

Use merges rather than rebasing or cherry-picking this initial history. The merge topology preserves correspondence with PR #200, the 50 local continuation commits, `main` changes #189-#191, and the approved bootstrap lineage.

## Normal task policy after publication

1. Every task contract names the exact accepted `dev` SHA, task branch/worktree, intended target, and Git authority.
2. Work occurs in a clean, isolated, short-lived task branch/worktree.
3. Ordinary development PRs target `dev`; the product owner/project development process may review and merge them when required checks and acceptance are satisfied.
4. Changes arrive as coherent behavior or architecture slices. `dev` must not become another unbounded long-lived feature stream.
5. Reserved hotspots and cross-area contract order are coordinated before implementation.
6. Completed work records parent SHA, resulting SHA, verification, dependencies, compatibility, and follow-ups.
7. A release is prepared from `dev` to `main`; production review/deployment support occurs only at that boundary.
8. After release, merge or otherwise reconcile exact `main` back into `dev`, verify the result, and record the new accepted `dev` SHA.

## Verification and publication prerequisites

Before the initial or any materially reconciled `dev` baseline is published:

- fetch/prune and confirm the exact remote SHAs and production-only deploy trigger;
- preserve the declared application toolchain: Node 22.x, pnpm 10.6.0, and PostgreSQL 16;
- run frozen install, generation, typecheck, lint, formatting, tests, coverage, build, and file-size reporting;
- validate migrations and database integration tests against a disposable PostgreSQL 16 test database only;
- run targeted regression checks for reconciled semantic hotspots, including Combat progression/synchronization and main-only sync/error behavior;
- run Docker readiness and supported Playwright/multi-perspective smoke checks when the existing local environment supports them;
- inspect Git status after generation/build/test steps and finish with a clean committed candidate;
- classify every failure as reconciliation regression, pre-existing issue, environment/tooling issue, or product decision; and
- report the exact candidate topology and obtain product-owner acceptance before publishing.

After publication, verify remote `dev`, its CI run, required checks/rules, task-PR target behavior, and absence of production deployment. PR #200 may then be closed as superseded while its provenance is preserved; it should not be retargeted merely to manufacture the new baseline.

## Standing documentation economy

Mandatory agent reading is an architectural and resource cost. Keep it controlled and reasonably short:

- `AGENTS.md` and tool-specific top-level guides contain concise operating rules and links, not full process duplication.
- The task contract names the exact required reading set for that task; it must not say `read all architecture docs`.
- Area-specific documents are mandatory only when the task touches that area.
- Decision records, audits, historical reports, and provenance material are read on demand when relevant, not at every startup.
- A new standing document needs a clear safety or execution reason to join the mandatory set. If its content is area- or task-specific, keep it scoped there.
- Periodically prune duplication and move detail downward into linked process, area, or decision documents.

This is an efficiency principle, not a rigid line-count rule. The goal is enough context for safe, effective execution without repeatedly loading irrelevant history.
