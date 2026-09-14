# Path-aware dev integration gate

## Scope and authority

Issue [#163](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/163)
implements the validation classes authorized in
[#161 comment 4354](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/161#issuecomment-4354).
The [development baseline policy](./development-baseline.md) owns integration
authority. This document describes the executable candidate and its transition;
it does not change branch protection or grant integration authority.

## Changed-path policy

The workflow emits `changes`, `docs`, `tooling`, `application-ci`,
`application-docker-test`, `dev-integration-gate`, `ci` and `docker-test` job
contexts. The aggregate uses actual dependency
results within the same workflow run. It does not create commit statuses through
an API or use labels, titles, a manually selected class, or another run's result.

| Changed surface                                                                                                                                                 | Required validation                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular, non-executable `AGENTS.md`, root `README.md`, and Markdown beneath `docs/` except `docs/source/` and `docs/rules/`                                     | Exact-diff whitespace and formatting, changed-document links/headings, inbound references to changed/deleted targets                                                                                                                                 |
| `.github/workflows/ci.yml`, `scripts/ci/dev-integration-gate*.mjs`, and the four exact regular service-helper paths listed below                                | Documentation/formatting checks plus focused gate and service regressions, the production sanitizer entrypoint, a real Docker synthetic, and actual workflow YAML parsing/static semantics; relevant hosted proof is also required at independent QA |
| Files beneath `apps/` or `packages/`, including tests and data                                                                                                  | Documentation/formatting checks plus retained application validation in `application-ci` and, for PRs, `application-docker-test`                                                                                                                     |
| Other paths, dependency manifests/lockfiles, raw source/rule documents, other scripts/workflows, infrastructure, symlinks, submodules, or executable file modes | Full application validation plus tooling validation; never documentation-only                                                                                                                                                                        |
| Mixed changes                                                                                                                                                   | Union of every applicable validation above                                                                                                                                                                                                           |

The tooling allowlist is intentionally narrow. New tooling paths require all
checks until a reviewed gate change supplies appropriate focused coverage.
The exact service-helper paths are
`scripts/ci/current-run-services.mjs`,
`scripts/ci/current-run-services.synthetic.sh`,
`scripts/ci/current-run-services.test.mjs`, and
`scripts/ci/sanitize-service-logs.mjs`. Their narrower classification is
coupled to mandatory helper tests, execution of the production sanitizer via
standard input, and a real Docker synthetic in the `tooling` job. Deleting or
breaking one of these paths fails that mandatory job. A rename to an unknown
path, executable mode, or symlink fails closed to full validation. No broader
scripts glob is allowlisted.
This includes `scripts/checkChangedFormatting.mjs`, which is used by the
application job: adding, modifying, deleting or renaming that helper requires
full application validation plus tooling validation. A passing gate regression
suite alone does not establish that the application formatting command still
works. The conservative route remains until focused behavioral coverage can
justify a narrower gate.
Markdown under the runtime/source rule directories remains conservative because
those sources can affect application behavior. Test files under application
packages are runtime changes, even when their purpose is documentation or QA.
Non-`dev` PR targets and `main` pushes keep full application/tooling validation.
The deployment workflow is unchanged.

The `docs` job installs declared tools with lifecycle scripts disabled. It does
not run application tests, build applications, connect to a database, start
Docker or launch browsers. A documentation-only PR can therefore pass this
aggregate despite unrelated application or Docker failures. `application-ci` and
`application-docker-test` are intentionally **skipped**, never represented as executed PASS,
when their surfaces are absent. The legacy protected `ci` and `docker-test` PR
jobs execute explicit aggregate-result checks instead of being skipped. Both
fail unless the aggregate succeeds, including when it fails, is canceled, is
skipped or has no result. They have no application steps or database services.
Applicable jobs must be exactly `success`;
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
The accepted #151 service-isolation behavior is mechanically imported into
`application-docker-test`; the separately owned artifact-isolation candidate
(#138) remains outside this change.

## Verification

Using pinned Node 22.23.2 and the declared dependencies:

```bash
node --test scripts/ci/dev-integration-gate*.test.mjs
node --test scripts/ci/current-run-services.test.mjs
printf 'sessionId=fixture-secret safe=yes' | node scripts/ci/sanitize-service-logs.mjs
bash scripts/ci/current-run-services.synthetic.sh
pnpm format:check:changed <accepted-base-sha>
```

The focused suite creates disposable Git repositories without services. It
covers documentation success with unrelated application failures, application
and workflow changes, mixed scopes, unknown paths, executable tests/modes,
symlinks, renames/deletions, missing/invalid/empty diffs, stale provenance, every
non-success applicable result, main/release behavior, and internal links. It
parses the actual workflow through the already-declared Prettier YAML parser
and checks dependency and retained application-job semantics. Formatter
regressions use actual Git deletion, rename-away and broken-modification
fixtures, execute the failing formatting command, and reject skipped, missing
or failed application results for PR and push events. All three regressions
failed against the prior classifier at `9094a899ab9f7b8fa689c7dc18d76acdb25c1fee`
before the repair.

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

Forgejo emitted `CI / dev-integration-gate (pull_request)` for PR #164.
Its actual terminal result at the final immutable head must be recorded before
adopting it. The aggregate push context is not interchangeable.
The historical `CI / ci (pull_request)` and
`CI / docker-test (pull_request)` identities remain present as compatibility checks that require the aggregate
to succeed. They never treat a skipped application job as executed proof. This
candidate does not modify required contexts.

The documented current protection requires both legacy PR contexts. Keeping
those contexts as explicit aggregate-result checks makes the current protection
enforce the path-aware decision without waiting for a settings change. A
Forgejo mapping from a skipped application job to a successful commit status
cannot bypass the compatibility checks: they depend on the aggregate's actual
job result. The new aggregate is the single decision; the legacy names only
relay that decision through the existing protection contract.

After independent exact-head QA and real hosted proof pass, the smallest
optional settings transition is to replace only those two required names with
`CI / dev-integration-gate (pull_request)`. If live protection still prevents
compliant integration, return that exact proposal to control plane. Record the
candidate SHA and current settings through an authorized administrative read
before executing any transition. Builder and Orchestrator read-scope failures
do not justify selecting an administrator credential.

Retain direct-push prohibition, the `glantri-orchestrator` merge allowlist,
administrator enforcement, review/outdated-head restrictions and every other
setting; keep `main` and deployment untouched. The PR's durable handoff owns the
actual hosted context evidence, exact SHA and transition proposal. Until the
approved transition is effective, the existing protection remains authoritative.
