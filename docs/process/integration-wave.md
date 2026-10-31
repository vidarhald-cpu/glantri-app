# Integration lifecycle and wave composition

This document records how accepted work reaches `dev`: the lifecycle, the
relationship between control-plane acceptance and mechanical refresh, the
procedure for deriving a consumed-vocabulary set, the reachability-path
declaration required alongside it, the conditions under which QA evidence
survives a coordinated wave composition, and the provenance a measurement or an
inherited claim must have before it becomes policy text. It amends no authority
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

### Look for semantic twins that nothing forces to stay complete

The caution above is one half of the problem: naive matching overstates the
surface. It also understates it. A semantic twin — a second, hand-maintained
enumeration of the same members — need not be derived from the vocabulary and
need not import it. Whether it mentions the vocabulary's name is incidental:
some twins name it in the same file, and one may sit in the file that
re-exports it, while others name it nowhere. A twin is a place that enumerates
the members by hand; some are compiler-caught, and the dangerous ones are those
with nothing obliging them to stay complete, so derivation tracing does not
reach them however reachable they may be by identifier search. The procedure
must therefore look for such places directly:

- array literals enumerating vocabulary members;
- `switch` cases over vocabulary values;
- if/else chains testing vocabulary values;
- object-key maps or `Set`s keyed by vocabulary values;
- the schema, `.default()` and fallback sites steps 1 and 2 already cover.

This is not an instruction to grep harder. It is an instruction to ask, of each
place that handles the value, whether that place enumerates the vocabulary —
and then to ask the question that decides how much suspicion it deserves.

**The shape of the twin determines whether anything will catch it.** An
exhaustive `Record<Vocabulary, …>`, a `switch` closed by a `never` guard, or a
type inferred from the vocabulary gives a compiler net: diverge it and the
build fails. An array literal, a `Set`, an object-key map or an if/else chain
gives nothing — an array literal that omits a member is still well-typed, and
an if/else chain carries no exhaustiveness obligation. The first class
announces itself; the second class is where the search effort belongs.

Wave 1's Combat lane added one member to `CombatRoundStep` and found four twins
of that vocabulary one at a time across four discovery rounds. Four is what one
lane discovered, not a census: further hand-maintained enumerations of this
vocabulary exist in non-test source, and the lane's own first commit had to
repair compiler-caught ones beyond the single one recorded here. Read the four
as illustrations of the classes above, not as the surface.

Only one of the four was reliably compiler-caught: the hand-maintained `z.enum`
in `combatStepEventSchema.ts`, whose divergence fails the typecheck at many
assignment sites across several files. A second,
`combatRoundCursorStepSchema`, failed only at runtime: it is a `z.enum` of step
abbreviations, so the new member does not type-error against it. The adjacent
`COMBAT_ROUND_STEP_ABBREVIATIONS` object carries a
`satisfies Record<CombatRoundStep, string>` clause and is therefore
compiler-forced directly, which drew attention into the vicinity without
forcing the enum itself; the missing member surfaced only at runtime, when the
cursor mapping was reached. The other two were caught by nothing. One is the
`||` equality chain in `isGlobalCombatRoundStep`, with its hand-maintained web
counterpart `isGlobalCombatRoundParticipantStep` whose body is byte-identical,
and the other is the pair of `CombatRoundStep[]` array literals that
`apps/web/src/lib/campaigns/liveCombatModifiers.ts` hand-maintains. The new
member appeared in neither array, so it fell through silently and was treated
like `round_summary` — while a nested ternary chain in
`apps/web/src/features/combat-history/view-models/buildRecordedCombatModifierRows.ts`
mapped the same member to `phase1`, leaving the two in disagreement with nothing
to force either into line.

The lesson to carry forward is that a workflow vocabulary can have behavioural
twins that are invisible both to derivation tracing and to compiler
exhaustiveness. Neither a complete derivation trace nor a green build will
surface them.

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
redundant became load-bearing the instant the predicate widened, so the process
could never become executable. None of that was a missing vocabulary item.
All of it was ordinary code reading a symbol the declaration already covered.

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

## Batch integration and integration capacity

### Integration capacity is not Builder capacity

They are tracked separately because they are consumed by different things and they
free up on different events. A Builder slot frees when a lane finishes. Integration
capacity is **one serial CI runner**, at roughly 25 minutes of runner time per
protected gate run, and it does not free when a lane finishes — it frees when a gate
run completes.

Three consequences, each measured on this host:

- **Each merge invalidates the next PR's gate.** `dev` requires a protected check,
  and `dev` moving makes every other open PR's head behind its base. PR #813's merge
  was refused with `the head branch is behind the base branch`; the branch was
  updated, which produced a new head, which needed its own gate run (#798
  comment 18675). With three accepted heads the sequence is strictly serial: rerun,
  merge, update, rerun, merge, update, rerun, merge — about 25 minutes of runner per
  step, with the rebuild and playtest still to come (#798 comment 18680).
- **Capacity is measured where the gate runs, not where the Orchestrator sits.** The
  host's network recovered to 0.70–3.31 s TCP connect, which the Orchestrator read as
  sufficient to start integrating. Inside the image build, `pnpm install` then failed
  on `EAI_AGAIN` — DNS resolution failing outright — with retries exhausted. The
  Orchestrator recorded the correction in terms: host-side timing is **not** a usable
  predictor for this gate, and readiness is tested by DNS and a tarball fetch **from
  inside a build container** (#798 comment 18680).
- **The control plane owns the capacity policy; the Orchestrator measures and
  enforces it.** Concurrent-lane limits and reserved integration/CI headroom are
  control-plane policy. The Orchestrator — later the dispatcher — measures the
  actual capacity where the gate runs and enforces that policy against the
  measurement before dispatching more implementation work. It does not set the
  number. Accepted, unintegrated heads are a queue with a known service rate.
  Adding a Builder while that queue is full produces another accepted head waiting
  on the same runner, and each one that arrives makes the others' gates stale. The
  standing policy while one runner serves the gate caps concurrent lanes at about
  two, and the Orchestrator holds one consolidated watch rather than one per head.

Re-triggering is bounded: **one re-trigger per head**, and none while the cause is
known to be unresolved. Three settled runs are worth more than nine inconclusive
ones, and the runner they consume is the same runner the batch needs.

### The standard batch

A **batch** composes several independently reviewed exact heads onto one integration
branch, which then receives **one** combined protected gate run, in place of one run
per head and one per intervening update.

**What each member must already have, before it may join:**

1. an independent QA verdict of PASS or PASS WITH FOLLOW-UP, bound to that exact
   head, with **no open A, B or C finding**;
2. explicit control-plane acceptance of that subject, or an explicit
   pre-authorization to integrate without it — a green verdict is not acceptance,
   under [acceptance and mechanical refresh](#acceptance-and-mechanical-refresh-are-different-questions);
3. the Orchestrator's [load-bearing re-check](./development-operating-model.md#the-load-bearing-re-check-between-harvesting-a-verdict-and-acting-on-it)
   recorded as reproduced;
4. a declared consumed-vocabulary set, and a reachability-path declaration where it
   introduces or alters a workflow-driving state;
5. no computed changed-path overlap with another member that is not resolved by a
   recorded merge order, under
   [hotspot overlap is declared and computed](./development-operating-model.md#hotspot-overlap-is-declared-and-computed).

**How the batch is composed and verified:**

1. Create the integration branch from the current accepted `dev`, by merge only — no
   rebase, no squash, no amend — in the recorded merge order.
2. Merge each member in turn. **A member requiring manual conflict resolution leaves
   the batch** rather than being resolved in place; a resolved conflict is a change
   nobody reviewed.
3. Run the five [composition verification conditions](#composition-verification-conditions)
   against the composed head, with blob identity checked by a
   [restricted tree-level diff](#blob-checks-use-a-restricted-tree-level-diff) over
   the reviewed paths.
4. **Where a member's reviewed tree survives composition byte-identically, its PASS
   transfers by tree identity rather than by assumption.** This is verifiable with
   one `rev-parse`, and it has been done: PR #813's updated head carried tree
   `09489f11`, byte-identical to the merge tree QA had computed with
   `git merge-tree --write-tree` and run its whole evidence against (#798
   comment 18675).
5. Run the protected gate **once**, on the composed head, and read per-job results
   from the Actions `tasks` API by `head_sha` — a skipped job reports `success` in
   the combined commit-status API, so the combined status cannot distinguish an
   executed pass from a skip.
6. Merge the integration branch into `dev` through the protected path, by the
   authorized integration identity, after the final recheck of exact head, target,
   freshness, required checks and mergeability in
   [PR freshness, merge base, and pre-integration recheck](./development-baseline.md#pr-freshness-merge-base-and-pre-integration-recheck).
7. Perform downstream work **once per batch, not once per member** — one rebuild,
   then the playtest.

**When one member fails:**

- **The gate fails on the composed head.** Attribute the failure before composing
  anything new. Where it is attributable to one member, drop that member, recompose
  without it, and run the gate once more. Where it is not attributable, the batch is
  the problem: reduce it rather than re-running it.
- **A member is dropped, not repaired in the batch.** It returns to its own lane at
  its own head, with its verdict intact and bound to the head it still has. The
  batch never carries a repair.
- **An environmental failure does not drop anybody.** Where the cause is outside
  every member's diff — the `EAI_AGAIN` build-container case is the standing example
  — the batch holds, the required check stays blocking, nothing is bypassed and no
  success is fabricated. Record the evidence and route it to bounded operational
  repair.
- **No bypass, ever.** Not a forced merge, not a protection change, not a
  reconfigured runner. Branch protection on `dev` stands as configured (#819
  amendment 3).

A batch is a composed wave and inherits everything this document already says about
one, including the limitation that composition condition 4 passes vacuously for a
dependency nobody declared.

## Evidence provenance

Durable policy text inherits whatever confidence its sources carried, and says
nothing about where that confidence came from unless it is made to. Two rules
keep the inheritance honest:

- **A quantitative or factual measurement used as durable evidence must be
  reproducible from a committed state, or else explicitly labelled transient.**
  Record which committed state exhibits the condition the measurement
  describes. Where none does, say so and mark the figure transient rather than
  recording it as a finding.
- **A statement inherited from an issue body or a dispatch packet is a
  hypothesis or a claim until it has been independently established.** Attribute
  it as inherited, or establish it from source, before it becomes policy text.

Wave 1 produced several instances of an unverified claim reaching committed
policy text. Two of them show why each rule exists:

- A `git rev-parse` failure mechanism was written confidently into an issue and
  from there into policy, and was wrong in the direction that ruled out the
  actual fix. The command does fail, with exit status 128; what it does besides
  failing is echo its own argument rather than return an object ID. The
  corrected account is in
  [blob checks](#blob-checks-use-a-restricted-tree-level-diff).
- A figure of eleven `tsc` error sites, carried forward from an issue body, was
  put at 23 by independent measurement. That it was wrong is the lesser fault.
  It was unverifiable in principle: the lane's own first commit already
  contained the change, so no committed state exhibited the condition the figure
  described, and nobody could have reproduced it. That is the sharper case, and
  it is why the first rule above is stated as reproducibility rather than as
  accuracy.
