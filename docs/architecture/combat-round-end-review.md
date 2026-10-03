# Combat Round End & Review V1

Status: Product Owner approved architecture; implementation authorized for S7 via Forgejo issue #481

Date: 2026-09-17

Portfolio: #116 Combat Actions / Turn Flow / Review

Authority: Product Owner decision, “Record Combat Round End & Review V1”.

## 1. Canonical round lifecycle

The current round remains open through all round-end processing and GM review.

```text
ROUND N — NORMAL PLAY
  ↓
FINAL ROUND ACTIONS
  e.g. GM-moderated opposed Set Combat Distance
  ↓
ROUND END EFFECTS
  visible timer / checkpoint / recovery processing [still Round N]
  ↓
GM ROUND REVIEW [still Round N]
  ↓
GM: START NEW ROUND
  closes Round N / creates Round N+1
  ↓
CE PRE-PHASE
  scheduled CE rolls due for the new round
  ↓
DECLARATION
  ↓
ROUND N+1 NORMAL PLAY
```

The application must not advance the round number in the middle of Round End
processing or Review. The GM explicitly starts the new round.

## 2. Final round actions

Some actions belong at the very end of the current round before time advances.
The known example is the GM-moderated opposed roll used to Set Combat Distance.
These are still actions in Round N. Round-based countdowns and expiry must not
process before these actions resolve.

## 3. One explicit visible Round End Effects slot

Every round has one recognizable Round End Effects slot. Its purpose is to let
players and GM see time/state progression rather than hiding it as server
housekeeping. It exposes, as applicable:

- active timed effects;
- countdown/checkpoint progression;
- old → new remaining time/check state;
- expirations;
- checks/rolls that become due;
- resulting state after those rolls.

This is the common table-time moment for processing round-based time.
Action/attack/phase-scoped effects such as “one attack” or P1/P2 remain governed
by their own scope and must not become generic round timers.

## 4. Canonical fixed-duration semantics

**N rounds means the remainder of the round in which the effect is created,
plus N complete subsequent rounds.** If created during Round 7:

| Duration           | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| Remainder of round | Expires at the end of R7.                              |
| 1 round            | Active throughout R8; expires at the end of R8.        |
| 2 rounds           | Active throughout R8 and R9; expires at the end of R9. |

One round is mechanically distinct from remainder of this round. The creation
round must not consume one of the promised complete rounds.

## 5. Distinct temporal structures

Do not impose one universal temporal mechanism on all Critical/effect outcomes.

- **Fixed duration:** a known effect expires after a defined duration, such as
  “−1 for 2 rounds”.
- **Scheduled uncertain resolution:** the existing state persists, but another
  roll/check becomes due after an interval, such as “Roll again in 2 rounds”.
  The timer specifies when uncertainty is resolved, not the future result.
  Reaching it does not itself expire the state.
- **Bounded uncertain resolution:** repeated checks create uncertainty, but an
  individual rule may impose a sensible maximum number of checkpoints or a
  forced transition where an arbitrarily long random tail would be implausible
  or poor gameplay.
- **Condition/event based:** the effect persists until a defined condition,
  treatment, event or other rule-defined termination.

## 6. Preserve uncertainty where it creates gameplay

Do not rewrite “roll/check again in X rounds” into “effect ends in X rounds”
merely because deterministic timers are easier to implement. Scheduled
uncertainty lets players estimate probabilities and make tactical choices
without knowing the future result. Deterministic durations remain legitimate
where the underlying effect is genuinely deterministic. Critical/effect
authoring may choose the temporal form best representing fiction and gameplay.

## 7. Combat Experience

Preserve the existing CE structure. The approved source rule is:

| CE result | Action/state | PER/manoeuvre modifier | Roll again in |
| --------- | ------------ | ---------------------- | ------------- |
| ≤5        | Panic / flee | −4                     | 5–10 rounds   |
| 6–10      | Passive      | −2                     | 4 rounds      |
| 11–15     | Active       | −2                     | 2 rounds      |
| 16–20     | Active       | −1                     | 1 round       |
| 21+       | Active       | 0                      | —             |

Approved timing:

- Every combat begins with a CE roll.
- CE processing belongs in a pre-declaration phase, not Round End.
- Scheduled subsequent CE rolls occur in that CE phase when due.
- A result establishes both current CE state/modifier and the interval until
  another CE roll.
- State/modifier persists until replaced by another CE result; the reroll
  interval is not an expiry duration.
- A Critical hit causes a fresh CE roll/reset according to the CE rule.
- Panic may persist through repeated CE rolls without an artificial
  deterministic maximum merely to force termination.

Round End Effects advances/displays the next-CE-roll schedule, but does not
perform the ordinary scheduled CE reroll there. Present “CE Active −1 — next
roll 1 round → due next round”, not “CE −1 → expires”.

The exact selection mechanism for the source table's 5–10 round Panic interval
remains an open reconciliation item unless authoritative source establishes it.

## 8. Rolls/checks due at Round End

When a timer/checkpoint becomes due during Round End Effects, the relevant roll
happens in that same visible slot unless its rule explicitly places it elsewhere,
as CE does. Classes include Health, Bleed, Observation, Combat Task checks and
effect-specific recovery checks.

Do not invent a generic recovery roll for every status. Each effect's own rule
determines whether it expires deterministically, schedules/repeats a roll, has a
bounded number of rolls, or waits for another condition.

## 9. GM Round Review

Review follows all Round End Effects and their due rolls. It is a chronological
review of consequential events, not a mathematical round summary.

Automatically include only characters with something reviewable during the
round: damage/healing; condition/status changes; modifier creation/removal/change;
special modifiers; timed-effect progression/expiry; recovery/check outcomes;
or other consequential character-state changes. Skip characters with nothing
reviewable automatically.

Every combatant must nevertheless remain manually selectable from the Round
Manager so the GM can inspect or adjust them if necessary.

### 9.1 Reviewable material is judged by consequence, not by blocking flags

A participant carrying consequential content must never be treated as a no-work
participant. Whether a requirement blocks the Review step is a separate question
from whether it is reviewable. In particular, a due unresolved requirement — the
death-timer case introduced after this document's original date is the known
example — remains reviewable even where it is declared non-blocking
(`blocksReview: false`). Non-blocking means the GM is not prevented from
proceeding; it does not mean there is nothing for the GM to see.

The inclusion list above remains the authority on what counts as reviewable.
This subsection only forbids reading a non-blocking flag as an absence of
consequence.

### 9.2 GM authority over Review completion

Glantri must not autonomously decide that Round End or Review is finished, and
must not advance the Combat step or the round on its own judgement. The GM
explicitly decides when Review is finished and when to advance and start the next
round. The GM-authority boundary is the overall Review / Combat-step transition,
not every internal bookkeeping operation. Existing automatic participant-level
bookkeeping is therefore permitted.

Accordingly:

- Participants with no consequential or otherwise reviewable material may be
  omitted from the default Review sequence, exactly as §9 already provides.
- Glantri may automatically mark a genuinely no-work participant's Review work
  `complete` during Review, including before the GM presses Start New Round. That
  is participant-level bookkeeping under the GM's retained step authority, not
  autonomous adjudication.
- Persisted `complete` therefore means that no participant-level Review work
  remains. It does not assert that the GM personally inspected that participant.
- The system must never automatically commit or advance the overall Review step,
  and must never automatically perform Start New Round. §12 continues to govern
  the round boundary.

That automatic participant-level bookkeeping is permitted only where it:

- does not execute or authorize `complete_round`;
- does not advance the Combat step or the round;
- never treats a consequential participant as a no-work participant;
- leaves every participant manually selectable;
- leaves the GM able to make permitted adjustments before advancing;
- carries no stronger meaning than “no participant-level work remains”, rather
  than “the GM personally inspected this participant”.

A deterministic transition may be mechanically calculated and applied. Doing so
does not by itself make its participant a no-work participant: where the outcome
is consequential or otherwise reviewable, the participant must remain in the GM's
Review sequence. Only genuinely no-work, non-consequential participants may be
omitted from the default Review sequence and deterministically completed as
participant-level bookkeeping. That is the boundary between permitted bookkeeping
and Glantri deciding Review on the GM's behalf.

Remaining manually selectable for inspection or adjustment does not require an
empty or no-op `commit_round_end_participant_review` for an otherwise no-work
participant. Adjustment happens through the legitimate controls that own the
corrected state, as §11 describes for corrections. Where an adjustment creates
consequential or otherwise reviewable state, the Review projection must reflect
it, and the participant is no longer a no-work participant.

The Round Manager and the Combat Inspector are distinct co-existing surfaces; see
[combat panel contract](../product/combat-panel-contract.md) §2 for the Round
Manager, §12 for consolidating actions into the Combat Inspector, and §12.1 for
the Round Manager's retention. §9's requirement that every combatant remain
manually selectable from the Round Manager divides between the two surfaces as
follows:

- The Round Manager owns participant selection and navigation during Review.
- Selecting a combatant makes that combatant available in the Combat Inspector.
- The Combat Inspector is where the GM inspects a combatant and makes permitted
  adjustments.
- Every combatant remains manually selectable regardless of whether it appears in
  the default consequential Review sequence.

Editing controls must not be duplicated into the Round Manager merely to satisfy
“inspect or adjust”. That is a design constraint, not only a description of
current behaviour: inspection and adjustment belong to the Combat Inspector,
while the Round Manager owns selection and progression.

## 10. Chronological presentation

For an affected character, show relevant events chronologically so the GM can
reconstruct what happened. Do not require a calculated “net effect this round”
summary; current totals belong in character/modifier panels. Show special
modifiers explicitly by semantic description, rather than absorbing them into a
numerical total, because they matter to roleplay and adjudication.

## 11. GM corrections

The GM may correct an erroneous result during Review. This is exceptional, not
the normal rules workflow. A correction changes authoritative state correctly
and retains evidence that an automated/original result was subsequently
corrected, rather than silently rewriting history.

Track correction use as an Encounter diagnostic statistic. Preserve, where
practical, occurrence/count, round, affected character/event, natural before/after
values, and a simple optional comment. A comment is not mandatory. These are
primarily development/diagnostic records, not ordinary player-facing fiction.

## 12. Starting the next round

Only the explicit GM action **Start New Round**:

- closes/finalizes Round N;
- advances the round number and creates Round N+1;
- carries forward approved editable declaration defaults;
- preserves continuing Combat Task identity;
- resets genuinely round-scoped state where applicable.

Do not automatically advance merely because all effects/checks have completed.

## 13. Future new-round messages — deferred

Preserve the new-round boundary as a future place for public GM messages to all
and private messages to one or more characters/players, potentially supporting
narrative, sensory or situational information. Do not implement this in V1.

## 14. Reconstructed Criticals

Lost/incomplete historical Critical tables do not define these timing semantics.
Future/reconstructed Criticals consume this temporal model. Authoring may use
remainder of current round; 1/2/N fixed rounds; indefinite or bounded scheduled
checks; condition/event termination; and persistent/injury consequences.

Balance severity using the combined burden of damage, impairment, Bleed,
modifiers, duration, recovery uncertainty and incapacity—not duration alone.
Do not force every Critical into the same temporal structure.

## 15. Open activation/reconciliation items

These factual/rule-integration items remain unresolved; they do not reopen the
approved Round End workflow:

1. Exact current Health/Bleed trigger, cadence and consequence rules.
2. Audit and reconcile exact current Stun lifecycle(s) against the approved Stunned/Dazed target in
   [rule decision 0005](../decisions/rules/0005-critical-effect-semantics-and-timing.md).
3. Exact Observe Opponent 3/6/10 progression/boundary behavior.
4. Exact continuing Combat Task timer/check behavior.
5. CE Panic 5–10 interval-selection mechanism if not already canonical.
6. Audit current round timers for off-by-one behavior under the approved N-round semantics.
7. Any implementation treating a next-check schedule as deterministic expiry.
8. Eventual Critical catalogue temporal/severity distribution.

## 16. Scope and relationship to existing documentation

The architecture recorded here was approved by the Product Owner as architecture.
That approval provenance is unchanged. What has since changed is the
authorization status: the approved architecture is now authorized for
implementation in S7 under Forgejo issue #481, which is the dispatch authority
for Round End implementation and the associated runtime changes. Work outside
the scope of that issue is still not authorized by this document.

[Combat architecture overview](./combat-architecture-overview.md) remains the
architecture entry point. [Combat declarations](../rules/combat-declarations.md)
owns declaration intent and continuing task/default boundaries.

[Combat Experience](../rules/combat-experience.md) describes current implementation,
including a duration-labelled result table, expiry-style effect storage and
`1d6 + 4` Panic selection. These are reconciliation evidence, not authority to
replace the approved scheduled-reroll semantics here. The documented die formula
is not certified as the authoritative source selection mechanism by this order.
Existing phase-attack CE mechanics are not redesigned by this documentation.

[Critical effects](../rules/combat-critical-effects.md) describes existing SU
countdown proposals and stored next-round offsets. Preserve that historical
implementation account for the bounded timer audit; it does not override the
fixed-duration semantics or separate due-roll processing from Review approved
here. Likewise current presentation/task mappings do not authorize scheduled CE
rerolls in Round End. This contract controls future Round End & Review V1;
implementation equivalence has not been claimed or audited by this publication.

The shared Critical-effect semantics that consume this lifecycle are recorded in
[rule decision 0005](../decisions/rules/0005-critical-effect-semantics-and-timing.md). That successor
does not alter the Round End ordering defined here and authorizes no runtime change.
