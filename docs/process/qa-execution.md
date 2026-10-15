# Independent QA execution

## Purpose and authority

This is the compact startup procedure for an independent-QA worker in the
visible QA lane, and for the single Development Orchestrator that routes its
result. It preserves independent review of an immutable exact head while
avoiding reconstruction of the complete Glantri operating model on every QA
run.

### What this document does not restrict

The procedure below is written for the visible lane. It does not describe the
only permitted substrate for independent QA, and it must not be read as
withholding what canonical policy allows. [AGENTS.md](../../AGENTS.md) remains
canonical: a fresh background or subagent context is an acceptable substrate
for **normal independent QA** provided it shares no Builder conversational
history. Independence comes from a fresh worker in a separate execution context
from the Builder, a separate clean exact-head worktree, and review-only
authority; a background context that meets those requirements supplies it as
fully as a visible session does. Outside the mandatory QA floor, where this
document says `visible`, read it as naming the lane it is written for, not as a
universal requirement.

The [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) is the standing
exception and is unchanged. Its classes continue through the dedicated visible
QA lane at the strongest reasonably capable model, and the Orchestrator may not
downgrade class, model, or substrate for them.

The Forgejo issue body is the current executable task contract once the task is
authorized. Comments are evidence and history. Repository process documents
remain standing authority, but an old recovery contract must be marked
`provenance/superseded` and point to the current Forgejo issue when execution
has moved forward.

Ordinary QA startup reading is limited to:

1. `AGENTS.md`;
2. this document;
3. the exact INITIAL, REPAIR, or PRESERVATION QA task contract; and
4. only the task-specific domain, rule, decision, or source sections named by
   that contract.

Do not routinely load the full development operating model, control plane,
task-contract template, agent-execution procedure, ownership map, development
baseline, or testing regression matrix. They remain authoritative on-demand
references when the entry check, task risk, or a named source requires them.

The Product Owner retains product, rule, UX, consequential architecture,
acceptance, and integration authority. QA is review-only: it never repairs
Builder-owned work, commits/pushes code, merges, deploys, touches `main`, or
makes product decisions. Authorized verdict/evidence publication is separate
from code mutation; credentials never expand that authority.

## Direct routing gate

### Development Orchestrator

Before creating the fresh independent-QA task, confirm only:

- the issue is durably authorized for QA and at `Ready for Independent QA`;
- an immutable candidate head is supplied;
- REPAIR QA includes a prior durable FAIL; PRESERVATION includes prior durable PASS;
- the applicable handoff tuple below is complete and the issue body is current; and
- no other active QA owner exists for the same candidate.

This is a shallow dispatch gate. The Development Orchestrator does not repeat
the QA worker's provenance, topology, scope, or delta verification.

The Development Orchestrator then:

1. creates exactly one fresh isolated QA task directly — in the visible lane for
   every mandatory-floor class, and otherwise on any substrate `AGENTS.md`
   permits for normal independent QA;
2. records one ledger entry keyed by `issue + QA + mode + exact head`, including
   provisioning request, task ID when materialized, parent task, leased
   worktree, requested SHA, observed `HEAD`, liveness, and next action;
3. supervises only that known child unless it has been conclusively retired;
4. harvests the completed result promptly;
5. publishes the durable verdict; and
6. routes repair, acceptance, or blocker handling.

Provision from the canonical `Glantri app — Forgejo` project or its derived
isolated worktree, never the historical recovery checkout. Verify source,
origin/common Git directory and requested versus observed `HEAD` before QA
starts: detached at the exact candidate, no local branch or upstream. Record the
accepted baseline separately; never infer either SHA from `main`, `origin/main`,
remote HEAD or a default branch. A queued request is pending, not a passed gate.
This mechanical provisioning check does not replace the worker's independent
scope/topology/delta verification.

There is no permanent QA Orchestrator. Independence comes from a fresh worker
in a separate execution context from the Builder, separate clean exact-head
worktree, and review-only authority—not from an additional standing routing
chat. A helper agent operating inside the Builder's execution context does not
supply this independence, regardless of whether that helper is visible.

## Verification classes and evidence validity

- **Substantive implementation:** separate review-only QA at the immutable exact
  head, with applicable functional/runtime and regression proof. Builder
  self-acceptance and Orchestrator override of FAIL remain prohibited.
- **Mechanical refresh:** independent preservation QA verifies equivalence,
  relevant blobs/trees, topology, actual diff and scope, and applicable protected
  checks. It does not repeat full feature review or expensive browser tests
  solely because the SHA changed. Record why prior functional proof remains
  applicable; if behavior changed or preservation cannot be established, use
  substantive QA for the affected claim.
- **Documentation/process:** light formatting, whitespace, internal references,
  scope, and policy/content consistency checks plus the applicable protected
  gate. No unrelated application, database, or browser proof is required. An
  explicit documentation-only QA exemption routes evidence to acceptance and
  does not manufacture independent QA PASS.

QA is always bound to one exact PR head SHA. If a freshness refresh, rebase, or
any other change moves the head of a runtime or code PR after QA, fresh QA on
the new exact head is required; the earlier verdict does not carry forward to a
head it never reviewed. Establishing PR freshness and merge base before dispatch
is the Development Orchestrator's responsibility under
[PR freshness, merge base, and pre-integration recheck](./development-baseline.md#pr-freshness-merge-base-and-pre-integration-recheck).

An unchanged exact-head QA PASS does not expire merely through elapsed time or
unrelated work. A mechanical head change requires preservation QA; a product
change requires fresh substantive exact-head QA. Changed dependencies or other
concrete risks need an applicability assessment, not automatic expiry.

Once an immutable candidate is QA-ready, QA and hosted checks run in parallel
unless one actually depends on the other. Record any measured resource
contention and its scheduling constraint; do not impose blanket serial waiting.
When required QA and applicable checks pass, the integration actor promptly
applies existing conditional integration authority and every remaining gate.

## QA modes and handoff tuples

### INITIAL QA

Use for the first independent certification of an implementation result.
Review the complete approved claim and proportionate regression surface.

Required tuple:

```text
Mode: INITIAL
Issue / PR:
Accepted baseline branch / exact SHA:
Builder branch / exact candidate head:
Issue contract and named task sources:
Declared changed files / scope:
Acceptance gates and required perspectives:
Selected regression, privacy/security, browser, and database gates:
Durable Builder evidence:
Git and publication limits:
```

### REPAIR QA (QA2+)

Use after a durable QA FAIL and a bounded Builder repair. Independently verify
the repaired head and the failed behavior without automatically recertifying
unaffected surfaces.

Required compact tuple:

```text
Mode: REPAIR
Issue / PR:
Accepted baseline branch / exact SHA:
Prior failed exact head:
Repaired exact head:
Builder branch:
Prior durable QA FAIL evidence:
Durable Builder repair evidence:
Exact failed behavior:
Declared changed files / scope:
Selected directly affected regression gates:
Conditional privacy/security, browser, and database gates:
Git and publication limits:
```

For a direct-child repair, prior PASS evidence may be carried forward only when
the reviewer demonstrates from the actual delta that the repair cannot affect
that surface. Record each carried-forward gate and why it remains applicable.
Re-run the exact failed gate and directly affected regressions. Prior evidence
is never carried forward merely because the Builder calls a repair narrow.

Escalate REPAIR QA to broader or full verification when the repair touches, or
the actual delta reveals:

- schema or migrations;
- authorization or projection outside the failed surface;
- shared serialization or API contracts;
- shared domain authority;
- concurrency or transactions;
- cross-cutting exports or toolchain;
- major Combat or Scenario projections;
- unexpectedly broad scope; or
- non-direct-child or rebased topology that makes prior evidence applicability
  unclear.

Record the trigger and the expanded gates. Escalation changes test breadth, not
the immutable-head or independence requirements.

Required process examples:

- The handoff names candidate `A`, but the fetched PR resolves to `B`: return
  `BLOCKED` with both SHAs before broad tests.
- A direct-child repair changes only the failed component behavior and its
  focused test: re-run that failure and directly affected UI regressions; carry
  forward prior database/API PASS evidence only after recording that the delta
  cannot reach those surfaces.
- A repair that also changes a migration or shared authorization serializer:
  record the high-risk trigger and broaden database, API, privacy, and other
  relevant regression verification even when the head is a direct child.

### PRESERVATION QA

Use for a mechanically refreshed candidate with prior durable PASS, rather than
inventing a prior FAIL to use REPAIR. Supply the INITIAL tuple plus the prior
reviewed head/PASS link, new exact baseline/head, refresh operation, declared
delta, and selected equivalence evidence. Independently verify topology, scope,
relevant blob/tree comparisons (see
[blob checks](integration-wave.md#blob-checks-use-a-restricted-tree-level-diff)),
and applicability of carried-forward gates.
Return an exact-head preservation verdict with that durable evidence. A product
change instead needs fresh substantive QA. The same separate-task, immutable
entry, lease, and anti-loop rules apply.

#### Mechanical-refresh preservation conditions

A refreshed candidate may integrate on preservation evidence alone — without
returning to the control plane for a further acceptance — only when all seven
of the following hold at the refreshed head:

1. the accepted commit remains in history;
2. the refresh was performed by merge, not by rewrite: no rebase, no squash, no
   amend;
3. every reviewed blob is byte-identical to the accepted head;
4. no file was added or removed within the reviewed paths relative to the
   accepted head;
5. no manual conflict resolution occurred;
6. the target branch (`dev`) is an ancestor of the refreshed head; and
7. CI is green at the refreshed head.

Check condition 3 with a tree-level diff restricted to the reviewed paths. Do
not compare the reviewed paths one at a time with `git rev-parse`; see
[blob checks](integration-wave.md#blob-checks-use-a-restricted-tree-level-diff)
for why that form fails and what to use instead.

These conditions decide only whether an already-accepted subject survives a
refresh. They never waive the initial acceptance boundary: the
mechanical-refresh rule applies only after the subject has itself received
control-plane acceptance, under
[acceptance and mechanical refresh](integration-wave.md#acceptance-and-mechanical-refresh-are-different-questions).

**Provenance of this list.** It is the set the control plane and the Development
Orchestrator already use in practice, recorded durably here for the first time.
It is not derived from any committed artefact, and no commit in this repository
exhibits it. Read it as a record of operational practice, not as a
reconstruction from evidence. The rule in
[evidence provenance](integration-wave.md#evidence-provenance) applies to this
paragraph as much as to any other.

## Independent worker entry check

In a fresh QA worktree, independently confirm canonical origin/common Git
directory, detached `HEAD` at the requested exact candidate, and no local branch
or upstream. Because `remote.origin.fetch` is intentionally narrow, explicitly
fetch and verify the exact PR head by refspec rather than relying on ambient
remote-tracking refs, and do not widen the configured refspec. Fetch authorized
refs without attaching to a moving branch, then independently resolve:

- PR/ref and actual candidate head;
- accepted baseline and merge base;
- ancestry between baseline and candidate;
- for REPAIR, whether the repaired head is a direct child of the failed head;
- complete changed-file scope; and
- the actual candidate or repair delta.

Compare those facts with the handoff tuple before substantive verification. If
any immutable SHA, ref, baseline, ancestry, repair parent, declared scope, or
required evidence is missing or mismatched:

1. stop immediately;
2. do not spend time on broad tests or historical reconstruction;
3. publish `BLOCKED` with expected versus observed facts and the one event
   needed to resume; and
4. return to the Development Orchestrator.

A changed PR head makes the run stale. Review the new head only through a new
complete handoff; never silently follow a moving branch.

`Running` means the visible QA child exists **and has passed this entry check**.
An intended or merely queued dispatch is not started work.

## Self-service observability

A QA lane fetches its own evidence rather than relying on a relayed copy. Use
the `tea` client with an explicit login; it needs no terminal and no Git
credential helper, so it works from an unattended worker process. See
[Forgejo API access route](./forgejo-agent-credentials.md#forgejo-api-access-route).

```sh
R=/repos/recovery-admin/glantri-app
tea api --login glantri-qa "$R/issues/<n>"            # the live contract
tea api --login glantri-qa "$R/pulls/<n>"             # PR thread and exact head
tea api --login glantri-qa "$R/issues/<n>/comments"   # prior durable evidence
tea api --login glantri-qa "$R/commits/<sha>/status"  # combined required contexts
tea api --login glantri-qa "$R/actions/tasks"         # per-job status by head SHA
```

Prefer the fetched issue body over a supplied copy, and record that the contract
was read directly. Where a copy was supplied as well, a diff against the live
issue is evidence worth recording.

For a failing protected context, `commits/<sha>/status` names the context and
its state, and `actions/tasks` gives the per-job name, status, and head SHA, so
QA can usually separate an infrastructure failure from a product failure without
a relay. **Job log text has no API route in this Forgejo version** — the absence
is version-level and identical for every identity, including write-scoped ones,
so it is not a QA authorization gap. When the log text is genuinely needed,
record the run and job from the status `target_url` and request it from the
Development Orchestrator.

Branch-protection settings are readable only by a repository administrator. The
combined commit status is the supported substitute for required-context state.

Publishing a verdict through `glantri-qa` is authorized evidence, not a widening
of authority: the same credential is denied label changes, issue-state changes,
branch creation, and PR merge server-side. Write the comment body to a file and
post it with `tea api --login glantri-qa -X POST -d @<file> "$R/issues/<n>/comments"`.
If that call fails, fall back to the recorder route below without changing the
verdict or the credential.

## Substantive verification gates

For substantive INITIAL or REPAIR QA, verify and record; for PRESERVATION,
retain independence, exact-head and scope gates and apply the verification class:

- independence: separate execution context, reviewer, and clean worktree from
  the Builder;
- exact head: verdict names the full immutable reviewed SHA;
- contract and scope: approved acceptance, exclusions, changed files, and no
  unauthorized widening;
- checks: focused evidence plus the selected proportional regressions;
- privacy/security: authorization and information projection are separate
  gates; rejected actions, zero mutation, or hidden UI alone do not prove safe
  payloads;
- database: when PostgreSQL is needed, use the linked-worktree QA quick-start
  in `docs/dev-database.md`; never inherit or copy another environment;
- browser: use synthetic/browser evidence when presentation, interaction,
  privacy, responsive behavior, or the contract requires it;
- rendered UI composition: for a UI-affecting PR, re-produce the before/after
  captures and apply the
  [visual review gate](#rendered-ui-composition-and-visual-review); and
- control plane: unresolved product, rule, UX, architecture, scope, hotspot,
  `main`, production, or integration decisions stop and return.

Conditional gates are omitted only with a short applicability reason. Privacy,
security, database isolation, or browser evidence must not be skipped because a
run is in REPAIR mode when the repair can affect that surface.

### Rendered UI composition and visual review

A UI-affecting PR is reviewed by rendering it, never by reading its diff. The
reviewer **re-produces** the before/after captures at the widths the contract
names instead of accepting the images supplied, and reports any composition
change the contract did not authorize as a finding. A UI-affecting PR is one
whose rendered output can move, not one whose diff contains a UI file: a change
touching no UI file can still change what renders.

Record the **usable width actually measured**, not the viewport requested. A
uniform chrome/scrollbar offset of roughly 27px explained every previously
irreproducible figure in the Alpha wave.

Clipping and occlusion are different defects and need different probes. Apply
all three measurements; the first two cannot find what the third finds:

- viewport-relative measurement cannot detect clipping by an intermediate
  scroll container, so measure against the clipping ancestor;
- clipping-ancestor measurement cannot detect **occlusion**: it reports clip 0
  and **is correct**, because the text is painted and then covered by an opaque
  sibling;
- only `elementFromPoint` glyph probes detect text painted and then covered.
  Three separate occlusion defects in the Alpha wave were invisible to both of
  the other methods.

When checking whether a change added persistent explanatory prose, do not sweep
by CSS class. Combat predates the shared presentation primitives and styles
inline, and a class-keyed survey missed every Combat string.

## Verdict, child state, and harvesting

The QA verdict is `PASS`, `PASS WITH FOLLOW-UP`, or `FAIL`. A tuple or entry
mismatch returns `BLOCKED` before verdict. Only PASS or safe, durably justified
PASS WITH FOLLOW-UP advances the issue to
`Ready for Control-plane Acceptance`. FAIL returns an in-scope bounded repair
to `Active`; it never advances toward acceptance.

When the issue explicitly pre-authorizes conditional integration, PASS may
advance directly through integration only after the Development Orchestrator
reconfirms that the live PR head is the reviewed head and every stated scope,
dependency, topology, protected-check, and merge-target condition passes. If
any condition is absent or false, stop at the ordinary acceptance/integration
gate.

Track the visible child separately from the exclusive Forgejo issue lifecycle:

| Child state             | Meaning and next action                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Running`               | Entry check passed; QA is active.                                                                             |
| `Recovering`            | Bounded provisioning/handoff recovery; record owner and attempt count.                                        |
| `Waiting-dependency`    | Named dependency, owner and resume event.                                                                     |
| `Waiting-human-action`  | Login, permission, credential or equivalent action surfaced as USER ACTION REQUIRED.                          |
| `Blocked`               | A named prerequisite or tuple mismatch stopped work; record the resume event.                                 |
| `Completed-unharvested` | The child ended with a usable return that the Development Orchestrator has not yet reconciled.                |
| `Completed-harvested`   | Exact result, evidence, and Forgejo state were reconciled and returned.                                       |
| `Failed`                | The task ended without a usable QA return; record the failure and recovery owner.                             |
| `Stalled`               | No progress or terminal return within the declared supervision window; record last evidence and intervention. |

Supervision follows the execution ledger. It inspects the known child, harvests
completion, names blockers, and stops when no child is active. It does not
globally rediscover conversations every cycle or create speculative duplicates.
Validate every return against `issue + role + mode + exact SHA` and the recorded
request/task/lease before publication. Quarantine mismatched responses.
Apply the [liveness rules](./agent-execution.md#human-action-liveness-and-completion-visibility):
record a bounded inspection interval, surface human action immediately, relay
usable completion promptly even while occupied, and deduplicate unchanged
blockers. If the assigned credential blocks authorized verdict publication,
return the exact report and target; the Development Orchestrator/Recorder
publishes it automatically without changing the verdict or credentials.

## QA worktree lease and recovery

The QA worktree is detached at the exact supplied head, has no upstream
tracking, and is leased to its provisioning request/task until the Development
Orchestrator records completion, cancellation, retirement, or confirmed loss.
No outside actor removes or reuses the leased path while the request may still
materialize or the worker may still run. The reviewer stops and reports if its
leased path disappears; it does not silently recreate it unless the contract
explicitly grants that recovery.

Delayed registration, missing task-list visibility, or slow output is not proof
of loss. Before replacement, correlate the provisioning request, task registry,
parent, worktree, PR activity, and completed returns; retire the prior request
and release its lease first. If binding/direct access or terminal cancellation
cannot be verified, replacement is blocked. A proven orphan must contain no
unique/unharvested work or persistent data. Reconcile delayed duplicates,
retain one owner and terminally retire the others before releasing leases.
Use only the bounded identical-contract and
identical-SHA recovery attempts allowed by `agent-execution.md`.

One initial attempt plus at most **two** automatic recovery/replacement attempts
(**three total**) is the ceiling; stop earlier after **two consecutive
substantially identical failures without changed causal condition**. Normal
Builder–QA repair allows at most **two cycles** after initial QA, with a stop
when the same root cause fails twice or the allowance is exhausted. Counters
never reset through new tasks or handoffs. Publish **STOP — REPEATED EXECUTION
FAILURE — CONTROL-PLANE CONFIRMATION REQUIRED**, exact attempts/IDs/SHAs/failures,
changed conditions, cleanup/lease evidence and a recommendation. No further
attempt or different recovery without confirmation. See the detailed
[numeric limits](./agent-execution.md#numeric-anti-loop-limits).

If QA needs login, OS/browser permission, credential interaction, or another
human action, it records that immediately and notifies the Development
Orchestrator. The Orchestrator promptly surfaces `USER ACTION REQUIRED`; QA must
not wait silently for the user to discover the child.

Local Safari/development-browser testing already has
[standing authorization](./control-plane.md#standing-safari-and-development-browser-authority).
Do not ask for it again; actual human-only permission/login/security prompts
still require immediate USER ACTION REQUIRED.

## Temporary timing capture

For the first several QA cycles after this process is integrated (target: five,
unless control plane retires the measurement earlier), record coarse elapsed
minutes for:

- dispatch preflight;
- child creation;
- QA reading/bootstrap;
- environment/database preparation;
- substantive verification;
- evidence/cleanup; and
- completion-to-harvest.

This is temporary process evidence, not a new acceptance gate. Compare it with
the #3 audit baseline: about 802 words/97 lines/17 reading bullets for INITIAL,
841–1,013 words/80–132 lines/~15 bullets for REPAIR, about 20,900 mandatory
repository words initially, and about 19,300 repository words on repair before
issue/PR/code evidence. Do not preserve timing collection after it stops
answering the process question.

At the accepted #56 repository baseline, the nine broad process/ownership/
regression/database documents named by that audit total 14,222 words. The new
ordinary process core (`AGENTS.md` plus this guide) is 2,341 words before the
exact QA contract and task sources: an 84% reduction in process reading. The
audit's larger totals include task-specific material and remain useful as the
observed end-to-end comparison.

## Compact QA return

```text
QA RETURN
Mode: INITIAL | REPAIR | PRESERVATION
Dispatch: Glantri app — Forgejo / independent QA / <child state>
Thread ID / direct link when available / worktree:
PR / exact reviewed head:
Topology and scope check:
Verdict/outcome: PASS | PASS WITH FOLLOW-UP | FAIL | BLOCKED before verdict
Failed/retested gate and directly affected regressions:
Carried-forward prior PASS evidence and rationale, or none:
High-risk escalation trigger and expanded checks, or none:
Privacy/security, browser, and database applicability/evidence:
Findings and durable links:
Recovery/repair counters and remaining allowance:
Publication link or exact ready report/recorder fallback:
Timings while temporary capture is active:
Cleanup:
Next state or exact resume event:
```
