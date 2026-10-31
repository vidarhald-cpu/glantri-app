# QA instrument register

A **QA instrument** is any probe, fixture, mutation harness, or measurement script
that a reviewer writes once and a later reviewer could reuse. This file is the
register of those instruments. It exists because an instrument carries its
author's knowledge of how to read it, and that knowledge does not travel with the
file.

[AGENTS.md](../../AGENTS.md) remains canonical and this file amends no authority
boundary. [`qa-execution.md`](./qa-execution.md) owns QA startup, verification
classes, verdicts and returns; this file owns only the register and the rules for
reading an instrument's result.

## The rule this register exists to enforce

**A green run of a recording instrument is evidence of nothing until its output
has been read.** An instrument that records rather than asserts has no verdict in
its exit code. To its author that is correct and convenient. To the next reviewer,
and to anyone harvesting the run, the exit code looks like the result.

The origin is the #798 cycle-1 probes `probe813f1Covering` and
`probe813f1Differential`. Both wrote their measurements to
`process.env.QA_PROBE_OUT ?? "/dev/null"` and asserted nothing about the outcome,
which is what let the same file run against two different trees. When the
Orchestrator routed cycle 2 to a fresh reviewer and pointed it at those probes
(#798 comment 18529), a run with the variable unset would have exited green and
measured nothing. The cycle-2 reviewer defused it: it copied the probes under new
names and replaced the `/dev/null` default so that an unset `QA_PROBE_OUT`
throws, then proved the guard by running it bare and getting `Tests no tests`
(recorded by the Orchestrator at #798 comment 18584). Every figure in that verdict
came from an output file the reviewer read, not from an exit code.

Three consequences, binding on every instrument in this register:

1. **A recording instrument fails closed when its output target is unset**, or it
   prints its result table to stdout as well, so that a bare run shows numbers
   rather than silence.
2. **An instrument is handed over with its setup, not only its path.** State the
   required placement, environment variables, import roots, and any tree
   extraction the instrument assumes. The #798 handover needed relative import
   paths, re-extracted `git archive` trees, and `QA_PROBE_OUT`; none of that is
   inferable from the file.
3. **An instrument must be shown able to fail.** A probe that passes at the
   candidate head and also at the head before it has discriminated nothing. The
   #798 cycle-2 verdict established discrimination by swapping the prior head's
   two production files back in and watching the leak return (#798 comment 18569).

### The same failure in three other shapes

The probe sink was the fourth instance of one class recorded in this programme,
and the register is for all four:

- a Playwright spec placed in a worktree whose absolute path matched the suite's
  `testIgnore` pattern, which collected **0 tests** and reported as a pass;
- a check that printed a hardcoded `PASS`;
- a test named for the case it was supposed to cover, which never ran that case;
- the probe sink above.

The common property is that **the instrument's name or exit code was trusted in
place of its output**. An instrument row below is incomplete until it says what
would make that mistake visible.

## Where the register lives and who updates it

The register is this file, in the repository, on the normal documentation/process
gate. It is **not** required startup reading: a reviewer reads it only when its
dispatch packet names an instrument, or when it is about to reuse one.

- The **reviewer that writes or materially changes an instrument** adds or updates
  its row, in the same change that publishes the instrument where one is
  committed, and otherwise in the change that records the instrument's location.
- The **reviewer that reuses an instrument** records what it had to repair. A
  repair that another reviewer will also have to make belongs in the row, not
  only in that run's verdict.
- The **Orchestrator** records the instrument it pointed a lane at, in that lane's
  dispatch evidence, so a verdict citing an instrument can be traced to the row
  that described it.

An instrument that lives only in a reviewer's released worktree is still
registered. Record where it was, that it is gone, and what a successor would have
to rebuild; a row saying "rebuild this" is worth more than an absent row.

## Row schema

Every row states all six fields. `unknown` is a permitted value and is more useful
than an optimistic one.

| Field                | What it must say                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Instrument           | Name, and its path or the fact that it was released with its worktree.                                             |
| Purpose              | The one question it answers. Not the surface it touches.                                                           |
| Controls for         | What it holds fixed, and which of its own measurements are controls rather than discriminators.                    |
| Limitations          | What it reads rather than measures, and which planes it never drives.                                              |
| Known failure modes  | How it can report a result that is not the one it appears to report. **Including: can it pass measuring nothing?** |
| Discrimination proof | The state in which it was shown to fail, or `unproven`.                                                            |

**`Known failure modes` is the field this register exists for.** A row whose
failure-mode cell says `none known` is a row nobody has interrogated. State the
mode even when the current guard closes it, because the next reviewer inherits
the instrument and not the guard.

## Registered instruments

Seeded with the instruments this programme has actually produced and reused. A
row here is a record of an instrument, not a certification of a result.

| Instrument                                                              | Purpose                                                                                                               | Controls for                                                                                                                                                                            | Limitations                                                                                     | Known failure modes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Discrimination proof                                                                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probe813f1Covering`, `probe813f1Differential` (#798 cycle 1, released) | Whether a crafted player-written display name recovers a GM-hidden participant's rows through the real player routes. | Drives the production HTTP routes rather than the domain function; runs the same file against five extracted trees so the tree is the only variable.                                    | Does not measure real-play frequency; the live Alpha database is out of scope.                  | **Yes — it could pass measuring nothing.** Output defaulted to `QA_PROBE_OUT ?? "/dev/null"` and it asserted nothing, so an unset variable gave a green run and no numbers.                                                                                                                                                                                                                                                                                                                                                | Proven in cycle 2 by swapping `613e54c8`'s two production files back in: the leak returned (#798 comment 18569).                                          |
| #798 cycle-2 copies of the two probes above (released)                  | Same question, at `61a7df21`.                                                                                         | Same, plus an explicit throw when the output target is unset.                                                                                                                           | Same.                                                                                           | The row-id split on `-` broke on ids containing `-` (`p-ari`); the integration spec threw `ENOENT` outside the repository root. Both were found and labelled before any result was read.                                                                                                                                                                                                                                                                                                                                   | As above, plus the bare-run guard check (`Tests no tests`).                                                                                               |
| #798 five-tree differential (released)                                  | Whether a head's behaviour differs from its predecessor's, and at which site.                                         | Holds the request sequence fixed and varies only the extracted tree.                                                                                                                    | Byte-comparison of responses only; says nothing about why two trees agree.                      | Agreement between trees is reported identically whether the instrument is discriminating or inert — it needs a known-different tree in the set to be readable.                                                                                                                                                                                                                                                                                                                                                             | 108/108 byte-identical between head and predicted merge tree, with the earlier head differing (#798 comment 18675).                                       |
| #798 mutation battery M1/M2/M3 (released)                               | Which of three candidate matcher behaviours each committed test actually discriminates.                               | Each mutant isolates one behaviour: M1 this cycle's change, M2 the matcher itself, M3 the prior `includes` form.                                                                        | Mutants were applied to source in a disposable worktree, not to a built artefact.               | A mutant that fails nothing reads as "the code is fine" rather than "the suite is blind"; the count of failing specs is the result, so a bare pass/fail reading loses it.                                                                                                                                                                                                                                                                                                                                                  | All three produced distinct, predicted failure sets (#798 comment 18569).                                                                                 |
| #771 R2-8 rendered-geometry probe (released)                            | The vertical-space cost of a change, in document coordinates.                                                         | Reads both states inside **one** `page.evaluate` so no scroll can straddle the measurements; returns `scrollY` with each read.                                                          | Chromium only; emulated viewports, not real devices; no zoom, screen reader, or large-text run. | Reads taken across `await` boundaries straddle the page's own autoscroll and report hundreds of spurious pixels — the reason the single-evaluate form is mandatory.                                                                                                                                                                                                                                                                                                                                                        | Measured a known deletion and re-insertion of the same element (#771 comment 18640).                                                                      |
| #790/#786 §3 gate proof (released)                                      | Whether the per-Scenario access gate denies a state the product cannot currently produce.                             | Constructs the state directly (`membershipState = 'former'` with `controlledByUserId` intact) so the measurement is about the gate.                                                     | Covers only the handlers that call the gate; says nothing about handlers that bypass it.        | A gate proof reports only the routes it visited. #790 measured 16/16 gated routes denying while `/campaigns/player-home` admitted on a bare controller.                                                                                                                                                                                                                                                                                                                                                                    | The constructed state was shown to be denied, and the ungated route shown to admit.                                                                       |
| Bounded CI watch, `head_sha` poll (#826, released)                      | Whether every job of the protected gate has reached a terminal state at one exact head.                               | Polls the Actions `tasks` API by `head_sha`, never the combined commit status, because a skipped job reports `success` there. Bounded by an explicit iteration count so it cannot hang. | Says nothing about why a job failed, and nothing about jobs the workflow has not created yet.   | **Yes - it reported a settled run that had barely started.** Its first form settled on "no unsettled tasks at this head", which is vacuously true while only the first job exists: it returned `SETTLED` with one successful `changes` job and seven jobs not yet created. The corrected form requires the aggregate `dev-integration-gate` job to be **present** and every job terminal. A settle condition over a set that is still being populated is the same defect as an output target that defaults to `/dev/null`. | Proven by the correction: the same poll against the same head reported `aggregate present=False` at poll 1 and the full eight-job terminal set at poll 2. |
| `critical-effects:verify`                                               | Whether the generated critical-effects data still matches the source workbook and its manifest hash.                  | The workbook plus manifest `sha256` is the controlling source; editing the generated `.ts` is not a valid repair.                                                                       | Verifies correspondence, not game correctness.                                                  | **It is in no CI gate.** Nothing runs it unless a lane runs it, so its silence is not a pass. Adding it to a gate is a `dev`-gate change and therefore floor-class (#819 amendment 1 point 3).                                                                                                                                                                                                                                                                                                                             | Not applicable: it is a committed verifier, run on demand.                                                                                                |

## Before reusing a registered instrument

1. Read the row, then read the instrument. The row records what was true when it
   was written.
2. Re-establish discrimination at **this** candidate. A proof recorded against an
   earlier head is provenance, not evidence for the head under review.
3. Prove collection, do not assume it. `vitest list` and
   `playwright test --list` report what was actually collected; a suite that
   collects zero tests exits green.
4. Read the output. If the instrument records rather than asserts, quote figures
   from the file you read, and say which file.
5. Repair the instrument before reading any result, and label output produced
   before the repair as bad rather than quietly re-running.
