# Independent QA execution

## Purpose and authority

This is the compact startup procedure for a visible independent-QA worker and
the two Orchestrators that route its result. It preserves independent review of
an immutable exact head while avoiding reconstruction of the complete Glantri
operating model on every QA run.

The Forgejo issue body is the current executable task contract once the task is
authorized. Comments are evidence and history. Repository process documents
remain standing authority, but an old recovery contract must be marked
`provenance/superseded` and point to the current Forgejo issue when execution
has moved forward.

Ordinary QA startup reading is limited to:

1. `AGENTS.md`;
2. this document;
3. the exact INITIAL or REPAIR QA task contract; and
4. only the task-specific domain, rule, decision, or source sections named by
   that contract.

Do not routinely load the full development operating model, control plane,
task-contract template, agent-execution procedure, ownership map, development
baseline, or testing regression matrix. They remain authoritative on-demand
references when the entry check, task risk, or a named source requires them.

The Product Owner retains product, rule, UX, consequential architecture,
acceptance, and integration authority. QA never repairs Builder-owned work,
merges, deploys, touches `main`, or treats credentials as authority.

## Thin routing gates

### Development Orchestrator

Before direct handoff to the QA Orchestrator, confirm only:

- the issue is durably authorized for QA and at `Ready for Independent QA`;
- an immutable candidate head is supplied;
- REPAIR QA includes a prior durable FAIL;
- the applicable handoff tuple below is complete; and
- no other active QA owner exists for the same candidate.

This is a shallow dispatch gate. The Development Orchestrator does not repeat
the QA worker's provenance, topology, scope, or delta verification.

### QA Orchestrator

Use the known `Glantri app — Forgejo` project and pinned QA lane directly. Do
not rediscover projects or list unrelated conversations when the recorded IDs
remain valid. The QA Orchestrator:

1. creates one isolated visible QA task;
2. records its task ID, worktree, ownership, mode, and candidate head;
3. supervises only known active child IDs;
4. harvests the completed result;
5. publishes the durable verdict; and
6. returns directly to the Development Orchestrator.

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

## Independent worker entry check

In a fresh QA worktree, fetch the authorized refs and independently resolve:

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
4. return to the QA Orchestrator.

A changed PR head makes the run stale. Review the new head only through a new
complete handoff; never silently follow a moving branch.

`Running` means the visible QA child exists **and has passed this entry check**.
An intended or merely queued dispatch is not started work.

## Substantive verification gates

For either mode, verify and record:

- independence: separate visible task, reviewer, and clean worktree from the
  Builder;
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
  privacy, responsive behavior, or the contract requires it; and
- control plane: unresolved product, rule, UX, architecture, scope, hotspot,
  `main`, production, or integration decisions stop and return.

Conditional gates are omitted only with a short applicability reason. Privacy,
security, database isolation, or browser evidence must not be skipped because a
run is in REPAIR mode when the repair can affect that surface.

## Verdict, child state, and harvesting

The QA verdict is `PASS`, `PASS WITH FOLLOW-UP`, or `FAIL`. A tuple or entry
mismatch returns `BLOCKED` before verdict. Only PASS or safe, durably justified
PASS WITH FOLLOW-UP advances the issue to
`Ready for Control-plane Acceptance`. FAIL returns an in-scope bounded repair
to `Active`; it never advances toward acceptance.

Track the visible child separately from the exclusive Forgejo issue lifecycle:

| Child state             | Meaning and next action                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Running`               | Entry check passed; QA is active.                                                                             |
| `Blocked`               | A named prerequisite or tuple mismatch stopped work; record the resume event.                                 |
| `Completed-unharvested` | The child ended with a usable return that the QA Orchestrator has not yet reconciled.                         |
| `Completed-harvested`   | Exact result, evidence, and Forgejo state were reconciled and returned.                                       |
| `Failed`                | The task ended without a usable QA return; record the failure and recovery owner.                             |
| `Stalled`               | No progress or terminal return within the declared supervision window; record last evidence and intervention. |

Heartbeat supervision is a fallback. It inspects known active child IDs,
harvests completed children, names blockers, and stops when no child is active.
It does not globally rediscover conversations every cycle.

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
Mode: INITIAL | REPAIR
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
Timings while temporary capture is active:
Cleanup:
Next state or exact resume event:
```
