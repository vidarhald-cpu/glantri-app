# Development baseline and integration policy

## Why this policy exists

Glantri development cannot assume frequent merges to `main`: `main` and production are controlled by the external maintainer, and a push to `main` participates in the production workflow. Long-lived work accumulated in PR #200 because there was no available release path.

Future parallel work therefore needs a stable, non-production accepted development baseline, but the repository does not yet have enough confirmed rules to create one safely.

## Observed bootstrap context (2026-08-10)

- GitHub default branch: protected `main` at `ab08677b0e48f574d57ca94cc394064cb3a7a1b0`.
- Repository workflow behavior: CI runs for pushes and PRs; `deploy.yml` is triggered by pushes to `main` and uses the `production` environment.
- PR #200: open against `main`, pushed head `4179034ef13c1713a23bddad7bf9ce01fc4880ea`, 60 pushed commits and 212 changed files.
- Local development head: `e738773b22ea18c554ce1556c563af3c563b9ddd`, 47 commits beyond the pushed PR head and 107 commits ahead/15 commits behind `origin/main` by commit-graph count.
- The original local checkout also contained uncommitted combat work. That work is deliberately excluded from this documentation bootstrap.

The public branch metadata confirms that `main` is protected, but the exact ruleset, bypass actors, and non-`main` merge permissions were not fully inspectable with the available authentication. Do not infer them.

## Interim policy

Until a shared integration branch is approved:

1. Every task contract names the exact accepted baseline branch and immutable commit SHA.
2. The product owner explicitly accepts that committed state as the development starting point.
3. Each task uses a separate short-lived branch/worktree from that SHA.
4. Agents do not add task scope to PR #200's branch or another shared long-lived worktree.
5. A task may be developed and verified locally while its PR target remains undecided.
6. No agent pushes, opens/retargets a PR, or merges without explicit authority and a confirmed target.
7. A completed task records its parent baseline SHA, resulting head SHA, dependencies, and intended integration order.

The bootstrap itself uses local committed development SHA `e738773b22ea18c554ce1556c563af3c563b9ddd` as its working parent. This records provenance only; it does not designate that commit or branch as the permanent shared integration baseline.

## Recommended shared model

After the constraints below are confirmed, use a non-production integration branch as the latest accepted development state:

```text
external release authority
main -> production workflow
  ^
  | maintainer-controlled release PR/merge
integration/dev (latest accepted development state)
  ^
  | reviewed development PRs; merge authority must be confirmed
short-lived task branches/worktrees
```

Properties of the integration branch:

- It must not deploy to production.
- It must run the checks needed to remain testable.
- It has a named owner and documented merge authority.
- Changes arrive through coherent, reviewed task PRs.
- It is not a place for direct feature accumulation.
- The external maintainer decides how and when an integration/release PR reaches `main`.

Suggested name: `integration/dev`. The name is only a recommendation and must not be created yet.

## Constraints to establish before creation

Obtain explicit answers from the external maintainer/repository settings:

1. Does every update to `main` trigger or queue production deployment?
2. What ruleset protects `main`, including required reviews/checks and bypass actors?
3. May the product owner/Codex create and merge into a non-production integration branch?
4. Can that branch be guaranteed not to trigger production or modify production state?
5. Which CI, preview, database, and end-to-end workflows should run on it?
6. Should task PRs target the integration branch directly, and who reviews/merges them?
7. Which exact PR #200/local commit becomes the initial accepted baseline?
8. How are local-only commits and current uncommitted work audited before inclusion?
9. What release review and acceptance are required before integration reaches `main`?
10. Should merged task branches be deleted automatically, and are any branches exempt?

## Initial baseline procedure after approval

1. Freeze the candidate development state.
2. Record the exact branch/SHA and its relationship to `origin/main` and PR #200.
3. Ensure uncommitted work is either excluded or captured in a separately reviewed task.
4. Run the agreed verification suite and map cross-area/hotspot changes.
5. Have the product owner accept the development baseline and the maintainer confirm release-boundary implications.
6. Create the integration branch at the accepted SHA.
7. Protect it with the agreed PR/check rules.
8. Start all new work in short-lived task worktrees from that branch.

## Failure mode to avoid

Do not treat an integration branch as a second unbounded PR #200. If work cannot be reviewed and accepted as coherent task slices, the control plane is not functioning even if the branch is technically separate from `main`.
