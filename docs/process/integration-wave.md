# Integration lifecycle and wave composition

This document records how accepted work reaches `dev`: the lifecycle, the
relationship between control-plane acceptance and mechanical refresh, the
procedure for deriving a consumed-vocabulary set, the reachability-path
declaration required alongside it, and the conditions under which QA evidence
survives a coordinated wave composition. It amends no authority
boundary; [AGENTS.md](../../AGENTS.md) remains canonical.

## Lifecycle

The block below lists process stages. Some correspond to Forgejo lifecycle
statuses and some do not; in particular, `Ready for Integration` is a stage of
this process, not an entry in the lifecycle status set. Do not infer a status
register entry from it, and do not set a status that the control plane has not
defined.

```text
Builder
  -> independent QA
  -> Ready for Control-plane Acceptance
  -> control-plane acceptance
  -> Ready for Integration
  -> coordinated wave composition
  -> integration verification
  -> Integrated
```

Ordinary QA PASS or ACCEPT WITH FINDINGS does not itself authorize integration.
Only explicitly pre-authorized exceptions may integrate without an explicit
control-plane acceptance. The rule applies to all implementation lanes from the
ruling forward. The ruling ratified specific earlier integrations that preceded
their acceptance packets: those are not reopened, and their outcome is not
reverted solely for that reason. That ratification is limited to those earlier
integrations and is not a standing rule; an acceptance-boundary violation after
the ruling is not excused by it.

### Acceptance and mechanical refresh are different questions

- **Acceptance** asks whether this change should exist at all. It is a
  control-plane judgement, required once per subject.
- **Mechanical refresh** asks whether this is still the same change after `dev`
  moved. It is a mechanical check the Orchestrator can make, and it exists to
  avoid re-asking a question already answered.

The standing mechanical-refresh rule therefore applies only after the subject
has already received control-plane acceptance. It permits a mechanically
identical refresh to integrate without returning for another acceptance. It
never waives the initial acceptance boundary. Treating a green QA verdict as
equivalent to acceptance collapses the two questions and removes the control
plane from the loop.

## Deriving and reviewing a consumed-vocabulary set

The consumed-vocabulary set is defined in
[what a lane declares](../architecture/ownership.md#what-a-lane-declares). Wave 1
showed that authors cannot safely derive it from memory or issue prose: both
non-trivial declarations were incomplete before independent tracing, and both
were written by the party most familiar with the lanes. Neither gap was exotic;
both fell out of mechanically tracing every derivation and every cross-area
read. A stated procedure makes that tractable.

1. **Trace direct schema and type derivations.** For each symbol the lane reads,
   find every schema, type, union, or enum derived from it (for example, types
   inferred from a schema, `z.infer`, `keyof`, indexed-access and mapped types).
2. **Identify interpretation sites affected by a widened vocabulary.** Find every
   `.default()`, fallback, `??`, coercion, exhaustive switch and parse-time
   transform that assigns meaning to the value. A `.default()` is a site where a
   record omitting a field acquires a value on read; it changes behaviour when
   the vocabulary changes even though no file shares an edit with the other
   lane.
3. **Trace cross-area reads and projections.** Find every repository, selector,
   projection, view-model, or API response in another functional area that reads
   the semantic value, including predicates that test it (for example an
   eligibility filter that also tests a lifecycle state).
4. **Identify persisted structures.** Find stored records that carry or derive
   the value, including nested lifecycle structures that embed it as a field.
5. **Check known consumers outside the edit set.** Inspect files the lane does
   not edit but that the ownership register, hotspot register, or sibling lane
   declarations show consuming the same symbols.
6. **Independently sanity-check the declared set before dispatch or
   composition.** Someone other than the author traces the set again from source
   and compares it with the declaration. Re-verify amendments against source as
   well: a review's own correction can omit a predicate the original also
   missed.

### Distinguish genuine consumers from suffixed-identifier matches

A search for a symbol name overstates the surface. In Wave 1, three non-test
source files matched `CombatRoundStep` only through `CombatRoundStepSnapshot`,
`CombatRoundStepOnServer` and `CombatRoundStepForCursorStep`. (A naive search
that includes tests finds eight such files, with four further suffixes:
`CombatRoundStepCurrentForGm`, `CombatRoundStepExecutable`,
`CombatRoundStepLegacy` and `CombatRoundStepAndRewind`.) One of them,
`combatHistoryProjection.ts`, had been recorded as a live blocker overlap
between two issues on exactly that false basis. A naive match can manufacture a
dependency that does not exist. Match whole identifiers (for example with word
boundaries), then confirm each remaining hit consumes the symbol's type or value
rather than merely containing its name.

### What the procedure does not guarantee

The procedure does not prove completeness. Composition condition 4 below is a
negative claim: that no composed lane changed a consumed semantic dependency of
another accepted lane. An omitted dependency is, by definition, absent from the
set the condition is checked against, so the condition passes vacuously. The
procedure lowers the rate of omission. It does not bound it. A passing
condition 4 shows that no declared dependency changed; it is not evidence that
no undeclared one did. Do not cite it as a guarantee, and do not treat having
followed the procedure as a substitute for continued suspicion when a lane
touches shared vocabulary.

## Declaring the reachability path for a workflow-driving state

The consumed-vocabulary set is necessary and not sufficient. It exposes who
reads a symbol whose meaning a lane could change; it does not ask whether the
product can reach the state that symbol names. A change that introduces or
materially alters a workflow-driving state — a phase, step, status, action or
declaration kind, lifecycle state, or any other vocabulary that changes what
operations are possible — therefore carries a second declaration alongside the
consumed-vocabulary set. The second is required in addition to the first, not
instead of it: a lane of this kind derives and reviews both.

The contract states, and the review confirms:

1. **How the product enters the state.** The production path that puts a record
   into it, not a hand-built state that assumes it.
2. **What operations are valid there.** The operations the state exists to
   host, each reachable end to end rather than at one plane only.
3. **What operations must remain invalid there.** The operations the state must
   continue to refuse. This is the limb most easily omitted and is often the
   whole point of the state: a step that opens one operation while holding
   another closed has achieved nothing if the closure is left unstated and
   unchecked.
4. **How the product exits the state.** What discharges it, what happens when
   several obligations are outstanding at once, and what the exit leaves
   behind.
5. **Which progression, authorization, API and projection surfaces
   participate.** Name them. A state is reachable only where every plane that
   gates it agrees the state exists.

The independent check before dispatch or composition challenges this path. It
is not discharged by intersecting consumed-vocabulary sets. It asks, surface by
surface, whether the declared entry, the valid operations, the invalid
operations and the exit hold at source.

Wave 1's Combat lane (S5) is the case that established the rule. Its
consumed-vocabulary set was reviewed for completeness before dispatch, amended
twice, and did find every semantic consumer of `CombatRoundStep` — and the new
`pre_declaration` step was still unreachable through the product. The
progression projection's `boundaryForStep` had no case for it and fell through
to `round_end`; authorization required `boundary: "declaration"` for the very
operations the step exists to host, so both API routes returned 409 whatever
the domain guard said; and a `roundNumber === 1` clause that had been fully
redundant became load-bearing the instant the predicate widened, so no task was
ever projected. None of that was a missing vocabulary item. All of it was
ordinary code reading a symbol the declaration already covered.

## QA across wave composition

Feature QA remains anchored to its reviewed exact head. It may be preserved
through composition only when the reviewed blobs, the declared consumed
semantics and the relevant floor invariant remain unaffected. Where any of them
is affected, the affected claim needs fresh QA on the composed head under
[QA classes](qa-execution.md#verification-classes-and-evidence-validity).

### Composition verification conditions

Integration verification of a composed wave confirms all of the following:

1. Accepted feature commits remain in history.
2. Reviewed blobs remain unchanged.
3. No manual conflict resolution altered reviewed work.
4. No composed lane changed a consumed semantic dependency of another accepted
   lane (subject to the limitation above).
5. No composition change affects a floor invariant.

### Blob checks use a restricted tree-level diff

Do not compare reviewed blobs path by path with `git rev-parse <commit>:<path>`
and trust its output. For a path that is absent at that commit, including any
deleted file, the command fails: it exits with status 128 and prints `fatal:`
on stderr. It also echoes its own argument, the literal string `<commit>:<path>`,
on stdout. A check shaped like `git rev-parse "$sha:$path" 2>/dev/null | cut -c1-12`
captures stdout, discards stderr, loses the exit status through the pipe, and
abbreviates the echoed string, so it reads the commit SHA prefix as if it were
a blob hash: when the argument carries a full 40-character object name, as it did here, the result is pure hex, indistinguishable from a real one. Two different commits
always echo two different strings, so the failure is one-directional: it
reports a spurious difference and never a spurious pass. This occurred during
#387's integration. Honouring the exit status (or using
`git rev-parse -q --verify`, which exits 1 and prints nothing) catches the
fault. The remedy below is preferred because it also compares deletions
directly. Use a tree-level diff restricted to the reviewed
paths instead, for example
`git diff --exit-code <reviewed-commit> <composed-commit> -- <reviewed paths>`
or `git diff --name-status`, and treat an empty result as identity. Deletions
then appear as deletions and are compared as such.
