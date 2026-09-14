# Path-aware dev integration gate

## Scope and authority

Issue [#163](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/163)
implements the validation classes authorized in
[#161 comment 4354](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/161#issuecomment-4354).
The [development baseline policy](./development-baseline.md) owns integration
authority. This document describes the executable candidate and its transition;
it does not change branch protection or grant integration authority.

## Changed-path policy

The workflow always emits `changes`, `docs`, `tooling`, `ci`, `docker-test` and
`dev-integration-gate` job contexts. The aggregate uses actual dependency
results within the same workflow run. It does not create commit statuses through
an API or use labels, titles, a manually selected class, or another run's result.

| Changed surface                                                                                                                                                 | Required validation                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular, non-executable `AGENTS.md`, root `README.md`, and Markdown beneath `docs/` except `docs/source/` and `docs/rules/`                                     | Exact-diff whitespace and formatting, changed-document links/headings, inbound references to changed/deleted targets                                                      |
| `.github/workflows/ci.yml`, `scripts/ci/dev-integration-gate*.mjs`, `scripts/checkChangedFormatting.mjs`                                                        | Documentation/formatting checks plus focused gate regressions and actual workflow YAML parsing/static semantics; relevant hosted proof is also required at independent QA |
| Files beneath `apps/` or `packages/`, including tests and data                                                                                                  | Documentation/formatting checks plus existing `ci` validation and, for PRs, existing `docker-test` validation                                                             |
| Other paths, dependency manifests/lockfiles, raw source/rule documents, other scripts/workflows, infrastructure, symlinks, submodules, or executable file modes | Full application validation plus tooling validation; never documentation-only                                                                                             |
| Mixed changes                                                                                                                                                   | Union of every applicable validation above                                                                                                                                |

The tooling allowlist is intentionally narrow. New tooling paths require all
checks until a reviewed gate change supplies appropriate focused coverage.
Markdown under the runtime/source rule directories remains conservative because
those sources can affect application behavior. Test files under application
packages are runtime changes, even when their purpose is documentation or QA.
Non-`dev` PR targets and `main` pushes keep full application/tooling validation.
The deployment workflow is unchanged.

The `docs` job installs declared tools with lifecycle scripts disabled. It does
not run application tests, build applications, connect to a database, start
Docker or launch browsers. A documentation-only PR can therefore pass this
aggregate despite unrelated application or Docker failures. `ci` and
`docker-test` are intentionally **skipped**, never represented as executed PASS,
when their surfaces are absent. Applicable jobs must be exactly `success`;
missing, failed, canceled, pending, neutral or skipped results fail the aggregate.

## Provenance and failure handling

Every checkout is pinned to the event's exact candidate SHA. The classifier
requires full nonzero base/head SHAs, verifies the checkout, resolves one merge
base, and reads a NUL-delimited Git diff with rename detection disabled. A rename
is therefore assessed as both deletion and addition; moving runtime code into
documentation cannot erase the runtime classification. File modes participate in
classification. Empty, unavailable or malformed evidence fails closed.

PRs use the event's exact base/head commits. Pushes use `before` and the event
head; a new branch push with a zero `before` fails closed until a PR supplies a
valid comparison. Such push results are not the protected PR gate. There is no
fallback to a historical formatting baseline, a default branch, or a guessed
parent. The aggregate independently reconstructs the plan and checks the
classifier's base, head, merge base, event, target and required-class outputs.
The protected outdated-head rule remains necessary when `dev` moves after an
event was created; a prior run does not certify a new base.

The aggregate has `if: always()` and explicitly depends on every validation job.
Failure to schedule or complete it remains non-success and cannot authorize a
merge. The retained application commands, PostgreSQL/Docker/Playwright steps,
failure artifacts, retention and cleanup are not replaced by synthetic tests.
The implementation does not import the separately owned artifact or service
isolation candidates (#138 and #151).

## Verification

Using pinned Node 22.23.2 and the declared dependencies:

```bash
node --test scripts/ci/dev-integration-gate*.test.mjs
pnpm format:check:changed <accepted-base-sha>
```

The focused suite creates disposable Git repositories without services. It
covers documentation success with unrelated application failures, application
and workflow changes, mixed scopes, unknown paths, executable tests/modes,
symlinks, renames/deletions, missing/invalid/empty diffs, stale provenance, every
non-success applicable result, main/release behavior, and internal links. It
parses the actual workflow through the already-declared Prettier YAML parser
and checks dependency and retained application-job semantics.

`GATE_BASE_SHA`, `GATE_HEAD_SHA`, `GATE_EVENT` and `GATE_TARGET` identify the
immutable event when invoking the helpers directly. For a local exact-commit
documentation check, set those four values and run
`node scripts/ci/dev-integration-gate-docs.mjs`. The helper checks committed
changes; `format:check:changed` additionally checks local work before commit.

Documentation consistency remains an independent reviewer responsibility for
meaning and authority; the automated checks establish formatting and reference
integrity. Relevant hosted proof must record the immutable candidate, event
base, run/job URLs, actual emitted contexts and results, including intentional
non-applicable skips. Local/synthetic results are not hosted certification.
The dependency and output behavior follows the
[Forgejo 15 workflow reference](https://forgejo.org/docs/v15.0/user/actions/reference/);
the candidate's real run must confirm it on this instance.

## Protected-context transition

The expected aggregate PR context is
`CI / dev-integration-gate (pull_request)`; confirm its actual emission in
Forgejo before adopting it. The aggregate push context is not interchangeable.
The historical `CI / ci (pull_request)` and
`CI / docker-test (pull_request)` identities remain present. This candidate does
not silently redefine a skipped legacy job as successful or modify required
contexts.

The documented current protection requires both legacy PR contexts. A candidate
whose applicable aggregate succeeds may remain integration-blocked because
those legacy contexts are skipped. If so, the smallest transition proposal is
to replace only those two required names with the **observed** aggregate PR
context, after independent exact-head QA and real hosted proof pass. Record the
exact candidate SHA and current settings through an authorized administrative
read before executing any transition. Builder and Orchestrator read-scope
failures do not justify selecting an administrator credential.

Retain direct-push prohibition, the `glantri-orchestrator` merge allowlist,
administrator enforcement, review/outdated-head restrictions and every other
setting; keep `main` and deployment untouched. The PR's durable handoff owns the
actual hosted context evidence, exact SHA and transition proposal. Until the
approved transition is effective, the existing protection remains authoritative.
