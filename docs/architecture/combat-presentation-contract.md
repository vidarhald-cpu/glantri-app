# Combat Presentation Contract

Status: recommended contract after a read-only audit of the combat domain, API, GM, Player, and historical presentation paths on `feature/player-general-encounter-screen`.

This document defines presentation semantics. It does not change combat rules, command authorization, persistence, calculations, progression, or history.

## 1. Design principles

1. **GM-first, structurally shared.** Build one complete GM presentation from authoritative combat facts and `CombatProgressionProjection`. Sanitize that presentation for Player Combat and GM Player Combat. Do not implement separate screen semantics.
2. **One accepted revision.** Tracker, Current Action, recap, detailed result, and modifiers in one live presentation all describe the same encounter ID and accepted encounter revision.
3. **Tasks describe now.** The canonical projected task determines current work. Events and snapshots describe what happened. Local inspection never changes current work.
4. **Privacy must not erase state.** A viewer may be denied an opponent's die, calculation, note, or identity. The viewer must retain an explicit, safe completion/status fact whenever that fact is needed to render progression correctly.
5. **Execution and attention are different.** An executable task does not automatically deserve a tracker `?`. Ordinary open work can remain `·`; `?` identifies exceptional nested or prerequisite work that needs attention.
6. **Facts before prose.** Presentation models contain stable identities, structured subjects, status, visibility, and source references. Components format these facts; they do not re-run progression or infer completion from hidden raw objects.
7. **History is immutable.** Historical views use recorded events and snapshots. They do not reconstruct old rounds with current progression rules.
8. **Fail closed.** Ambiguous current tasks, mismatched revisions, or severe relevant progression diagnostics suppress actionable presentation. They do not select a plausible-looking fallback.

The target flow is:

```text
persisted combat facts + canonical progression + canonical events
  -> CombatPresentationProjection (GM-full, one revision)
  -> projectCombatPresentationForViewer(...)
  -> shared GM / Player / GM Player components
```

### Workspace loading boundary

Campaign workspace navigation uses compact `EncounterSessionSummary` facts.
Those summaries may select an encounter but must never drive combat
progression, Current Action, tracker, modifiers, or results. Live combat
presentation is built only after the exact selected `EncounterSession` has been
loaded.

GM cross-client polling checks the selected encounter's canonical revision. An
unchanged revision causes no presentation replacement. A newer revision causes
one exact encounter fetch and authoritative replacement. Accepted same-client
mutation responses remain authoritative immediately and must not wait for or be
overwritten by polling. Encounter ID and revision guards discard late
selection/poll responses.

Player Combat history is revision-bound presentation, not an independent
latest-state feed. Its `sourceEncounterId`, `sourceUpdatedAt`, and optional GM
perspective participant must match the exact accepted player-safe encounter.
A known newer revision invalidates action controls until the exact replacement
and its matching history are accepted.

## 2. Current presentation paths

The audited implementation has several strong canonical foundations:

- `CombatProgressionProjection` provides boundaries, processes, stages, execution groups, tasks, blockers, compatibility cursors, and diagnostics.
- `combatHistoryProjection` binds events, snapshots, player-safe facts, and progression to `sourceUpdatedAt`.
- live tracker models index progression tasks rather than re-running progression for every cell;
- committed initiative order is not displayed before initiative commit;
- historical tracker selection uses immutable events and snapshots;
- GM and Player encounter acceptance reject older `updatedAt` revisions;
- GM Player Combat uses the Player Combat route and perspective model;
- boundary-transition commands already bind task identity and expected revision.

Presentation is nevertheless split across these independent paths:

| Concern                  | Current path                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical live work      | domain `CombatProgressionProjection` and its presentation projection                                                                  |
| Player-safe live facts   | API encounter sanitization plus player-safe combat-history projection                                                                 |
| GM tracker               | `buildCombatTrackerModel` plus raw statuses, proposals, results, events, and snapshots                                                |
| Shared/projected tracker | `buildCombatProgressionTrackerModel` and `buildProjectedCombatTrackerModel`                                                           |
| GM Current Action        | a large conditional tree in `CombatRoundManagerPanel` combining projected tasks, cursors, proposals, results, and inspector selection |
| Player Current Action    | a separate conditional tree in `ScenarioPlayerCombatPageContent` combining projected tasks with sanitized raw combat state            |
| GM Action Result         | selected-cell canonical events followed by several legacy result fallbacks                                                            |
| Player Action Result     | fixed-priority selection across health, distance, maneuvers, attacks, initiative, Combat Experience, and local roll state             |
| Latest GM information    | a single command-history summary, separate from canonical combat events                                                               |
| Historical inspection    | event/snapshot selection and historical panel models                                                                                  |

The target architecture should retain the canonical foundations and remove the presentation-level reinterpretations incrementally.

## 3. Panel responsibility matrix

| Panel                    | Owns                                                                                                            | Must not own                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Tracker                  | Compact progression state and recorded outcome by participant/facet; task-derived hover context                 | Commands, detailed calculations, event selection, or local-current-task inference |
| Current Action           | The one canonical current task (or explicit waiting/conflict state), its context, and its primary action        | Historical selection, latest-event fallback, or arbitrary result selection        |
| Progressive Combat Recap | Chronological, viewer-safe major combat facts                                                                   | Every internal command, validation, proposal edit, or calculation contribution    |
| Detailed Action Result   | Details for an explicitly selected recap event/result, or the result explicitly attached to the current process | Selecting an unrelated latest result because the current task has no result yet   |
| Combat Modifiers         | Contributions applicable to the selected/current calculation context at the same revision                       | Progression scheduling or outcome inference                                       |
| Historical Inspector     | Immutable event/snapshot replay for a selected round, participant, or cell                                      | Live commands, live task replacement, or reconstruction using current rules       |

The Current Action remains visible and unchanged while the user inspects history. The inspector may have its own heading and detailed result, but it never becomes the live action source.

## 4. Tracker contract

### 4.1 Marker semantics

| Marker | Canonical meaning                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `·`    | No recorded outcome. This includes unopened work and **ordinary open/pending work**, including a normal declaration. Hover distinguishes unopened from open/pending.                                                          |
| `?`    | Exceptional, currently executable or actively waiting nested/prerequisite work associated with this participant and facet. Hover names the actual required task and required actor. A future planned task never produces `?`. |
| `✓`    | Successfully completed/submitted/reviewed work when no more specific numeric or H/M outcome applies.                                                                                                                          |
| `–`    | A final unsuccessful, skipped, cancelled, locked-out, or not-applicable outcome. It must be supported by a recorded final fact; it is not a generic unopened marker.                                                          |
| `H`    | A recorded attack hit for that attack facet.                                                                                                                                                                                  |
| `M`    | A recorded attack miss for that attack facet.                                                                                                                                                                                 |

Committed initiative values remain numeric markers. They are not replaced by these symbols.

Task state and marker attention are separate fields. The shared tracker view model should carry both:

```ts
type CombatTrackerAttention = "ordinary" | "exceptional";

interface CombatTrackerFacetPresentation {
  status: "unopened" | "open" | "waiting" | "completed" | "unsuccessful" | "historical";
  marker: "·" | "?" | "✓" | "–" | "H" | "M" | `${number}`;
  current: boolean;
  executable: boolean;
  waiting: boolean;
  completed: boolean;
  historical: boolean;
  attention: CombatTrackerAttention;
  taskIds: string[];
  executionGroupIds: string[];
  hover: CombatTrackerHoverPresentation;
}
```

`current` or `executable` must not be translated directly to `?`.

### 4.2 Facet semantics

| Facet | Open ordinary pending (`·`)                                         | Exceptional pending (`?`)                                                                                | Completed                                   | Final negative / not applicable                                                | Historical outcome                               |
| ----- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| DE    | Declaration input                                                   | Combat Experience difficulty/roll or another explicit declaration prerequisite                           | Declaration accepted (`✓`)                  | Explicitly unavailable/cancelled (`–`)                                         | Recorded declaration/CE event                    |
| M1/M2 | GM modifier review                                                  | A phase choice or nested prerequisite requiring participant attention                                    | Review committed (`✓`)                      | Explicit no-review/not-applicable (`–`)                                        | Snapshot/event                                   |
| i1/i2 | Initiative roll window or GM initiative commit                      | Exceptional phase choice, Combat Experience gate, or repair task                                         | Committed numeric initiative                | Explicitly excluded/not participating (`–`)                                    | Committed numeric value/event                    |
| A1/A2 | Standard attack or ordinary action awaiting its actor               | Feint/Adjust Distance roll or response, Double Attack decision, or other nested action prerequisite      | Successful maneuver/non-attack action (`✓`) | Failed maneuver, skipped/cancelled/no attack (`–`)                             | Attack `H`/`M`, maneuver `✓`/`–`, snapshot/event |
| P1/P2 | No defense task yet                                                 | Required defender/parry response                                                                         | Defense resolved (`✓`)                      | Defense not required, declined, failed, or made impossible (`–`) when recorded | Defense event/snapshot                           |
| D1/D2 | No damage task yet                                                  | Hit location, critical, damage/effects review, or other required post-hit work                           | Required post-hit chain committed (`✓`)     | No post-hit work after miss/parry, or explicit non-applicability (`–`)         | Critical/damage event/snapshot                   |
| SU    | Ordinary participant/effect review or GM Start Next Round readiness | Distance contest input/commit, Health check, Combat Experience, or another nested round-end prerequisite | Required round-end work complete (`✓`)      | Recorded not-applicable/skipped review (`–`)                                   | Round-end event/snapshot                         |

The table defines presentation attention, not domain execution strategy. A product decision can move a task between ordinary and exceptional without changing combat progression.

### 4.3 Waiting and ownership

- If the viewer's participant is waiting on another participant, the viewer's cell does not inherit the other participant's `?`.
- The cell associated with the required actor/task receives `?` only when the task is exceptional.
- A viewer-safe hover may say `Waiting for another combatant` when the responder is concealed.
- A GM-only current task may leave participant cells `·`; the GM hover/state says `Awaiting GM: <task>`.
- A top-level GM boundary transition does not open or mark a future facet.

### 4.4 Hover source

Hover text has one canonical source:

1. live: the current task's sanitized `label`, `reason`, required actor, and waiting state;
2. completed current round: the final canonical presentation event for the facet;
3. historical: the immutable snapshot/event;
4. unopened: a facet-specific `Not opened` message.

Generic text such as `current task` is not sufficient. Event-derived hover text must not override a live task unless the event is the result explicitly attached to that task/process.

### 4.5 Round isolation

Every tracker fact is keyed by round number, participant ID, and facet before marker
classification. A task may populate only the round declared by its progression projection. A
result, event, snapshot, initiative, or step status may populate only the round that persisted that
fact. In particular, `M` continues to mean a recorded attack miss; it is never a pending-action or
compatibility marker.

Starting a new round archives the completed participant state and clears all active-round
declarations, initiatives, legacy phase attack slots, and opportunity-keyed attack results. The
active Declaration round therefore contains no M1/i1/A1/P1/D1/M2/i2/A2/P2/D2/SU outcome until a
canonical fact for that round exists. Tracker construction must not apply the active round number
to a previous round's “latest” fact.

An unopened cell without a task or recorded result is not inspectable. Historical cells remain
inspectable under their recorded round, while selecting them never changes Current Action. Tracker
cell identity and rendered React keys include round, participant, and facet so a newly opened round
cannot reuse the previous round's rendered cell state.

## 5. Current Action contract

### 5.1 Canonical model

```ts
interface CurrentActionPresentation {
  encounterId: string;
  encounterRevision: string;
  taskId: string;
  executionGroupId: string;
  processId: string;
  stageId: string;

  taskKind: CombatProgressionTaskKind;
  actionKind?: string;
  actionName: string;
  boundary: string;
  phase?: "phase1" | "phase2";
  trackerFacet: string;
  status: "executable" | "waiting" | "awaiting_gm" | "conflicted";

  actor?: CombatPresentationSubject;
  target?: CombatPresentationSubject;
  requiredActor: CombatPresentationSubject;
  weapon?: CombatPresentationReference;
  skill?: CombatPresentationReference;
  distance?: { current?: number; requested?: number; direction?: string };

  reason: string;
  expectedNextProcess?: { processId?: string; label: string };
  heading: string;
  taskHeading: string;
  primaryAction: {
    label: string;
    commandType: string;
    enabled: boolean;
    gmProxyAvailable: boolean;
    viewerMayInvoke: boolean;
    descriptor: {
      taskId: string;
      expectedRevision: string;
      expectedBoundary?: string;
      targetBoundary?: string;
      opportunityId?: string;
      proposalId?: string;
    };
  };
  sourceRefs: CombatPresentationSourceRefs;
}
```

The descriptor is constructed with the rendered task. The click handler does not independently rediscover a revision, proposal, opportunity, boundary, or target from another live state object.

`CombatProgressionTask` remains the source of task identity and authorization context. Indexed authoritative process facts enrich it with action name, target, weapon/skill, distance, and reason. Missing enrichment does not permit a component to infer a different task from cursors or the latest event.

### 5.2 Task context requirements

| Task kind(s)                                                     | Required context                                                       | Required actor and proxy                         | Expected next work                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| `submit_declaration`                                             | Declarer, declaration boundary, declaration state                      | Participant; GM proxy/edit only where authorized | Remaining declarations or GM boundary transition                            |
| `combat_experience`                                              | Participant, CE action/difficulty, whether a roll is required          | Participant; GM proxy where authorized           | Declaration/initiative/round-end process resumes                            |
| `modifier_review`                                                | Phase, reviewed participant, modifier scope                            | GM only                                          | Next review or initiative boundary transition                               |
| `roll_initiative`                                                | Participant, phase, initiative calculation label                       | Participant; GM proxy where authorized           | Remaining rolls/choices, then GM commit                                     |
| `commit_initiative`                                              | Phase, pending choices/roll state, intended phase-resolution opening   | GM only                                          | Committed execution order and phase resolution                              |
| `double_attack_decision`                                         | Actor, target if visible, first attack outcome, Continue/Cancel choice | Declaring participant; GM proxy where authorized | Second standard attack or process completion                                |
| `attack`                                                         | Attacker, target, phase, opportunity, weapon/mode                      | Attacker; GM proxy where authorized              | Defense, post-hit work, or process completion                               |
| `parry`                                                          | Attack, attacker, defender, weapon/shield context                      | Defender; GM proxy where authorized              | Hit location/post-hit work or process completion                            |
| `hit_location`                                                   | Attacker, target, attack result, location input reason                 | Current authorized actor/GM per existing rule    | Critical or damage review                                                   |
| `critical`                                                       | Attacker, target, hit/location, critical type                          | Current authorized actor/GM per existing rule    | Damage review                                                               |
| `damage_review`                                                  | Attack, target, critical/damage proposal, effects                      | GM only where currently required                 | Process completion                                                          |
| `feint_attacker_roll`, `feint_defender_roll`                     | Feint method, actor, target, selected skill, required roller           | Named roller; GM proxy where authorized          | Other roll or proposal commit                                               |
| `feint_commit`                                                   | Actor, target, proposal result and broad outcome                       | GM only                                          | Maneuver completion; later Phase 2 attack remains boundary-locked           |
| `adjust_distance_response`                                       | Actor, defender, current/requested distance                            | Defender; GM proxy where authorized              | Allow resolution or opposed adjustment/rolls                                |
| `adjust_distance_adjustment`                                     | Pair, current/requested distance, opposed state                        | GM only                                          | Opposed Dodge rolls                                                         |
| `adjust_distance_attacker_roll`, `adjust_distance_defender_roll` | Pair, current/requested distance, Dodge skill, required roller         | Named roller; GM proxy where authorized          | Other roll or proposal commit                                               |
| `adjust_distance_commit`                                         | Pair, proposal broad outcome, old/requested distance                   | GM only                                          | Distance change/final outcome; later Phase 2 attack remains boundary-locked |
| `distance_roll`                                                  | Pair, current/requested distance, required roller                      | Named participant; GM proxy where authorized     | Other roll or distance commit                                               |
| `distance_commit`                                                | Pair, contest broad outcome, old/new distance                          | GM only                                          | Next pair/round-end child process                                           |
| `health_review`                                                  | Participant, health reason, stat/skill and required roll               | Participant; GM proxy where authorized           | Participant/effect review continues                                         |
| `participant_review`, `effect_review`, `round_end_prepare`       | Participant or effect being reviewed, round-end reason                 | GM or participant according to existing command  | Next ordered round-end process                                              |
| `gm_advance_boundary`                                            | Current boundary, target boundary, completed prerequisites             | GM only; never participant proxy                 | Target boundary/process                                                     |

`participant_review` exists in the task vocabulary but is not consistently emitted by the current composed round-end plan. The implementation should either emit it where it has distinct user work or remove it from presentation mappings after confirming it is unused; UI code must not invent it.

### 5.3 Required wording

The panel answers, in order:

1. who is acting;
2. to whom;
3. what action/process this is;
4. who must act now;
5. why the input is required;
6. exactly what the primary button does.

Examples:

```text
Adjust Distance · Scyrian cavalry → The Gladiator · Phase 1
Adjust Distance — Defender response
The Gladiator must choose whether to allow or oppose moving from distance 3 to 2.
[Allow or oppose]
```

```text
Single Attack · The Gladiator → Scyrian cavalry · Phase 1
Single Attack — Attack roll
The Gladiator must roll the current attack opportunity.
[Roll phase 1 attack]
```

```text
Round progression · GM
Round End — Start next round
All round-end processes are complete. The GM must open Round 3.
[Start next round]
```

Player views receive the same structure but `viewerMayInvoke: false` for GM-only work and display `Waiting for GM` instead of a control.

## 6. Standard headings and summaries

Use these templates:

- action/process heading: `<Action> · <Actor> → <Target> · <Phase>`;
- task heading: `<Action> — <Required input>`;
- outcome: `<Actor> <succeeded/failed/hit/missed/won/lost> ...`;
- GM-only process: `<Process> · GM`;
- participant review: `Round End · <Participant>`;
- boundary: `Round progression · GM`.

Fallbacks are semantic, not empty strings:

- hidden actor: `An unseen combatant`;
- hidden target: `an unseen target`;
- visible action but both identities hidden: `<Action> · concealed participants · <Phase>`;
- no opponent: omit the arrow and target;
- GM-only: use `GM`, never a fabricated participant;
- hidden required actor: `Another combatant must respond`;
- hidden reason/details: use a broad safe reason such as `A response is required before combat can continue`.

## 7. Progressive Combat Recap

The product name for this panel is **Combat Log**. The Combat Log records what happened in the
fiction; Action Outcome explains how the rules produced that result. It is not command history or
audit history. It excludes calculations, dice, modifiers, table lookups, proposal administration,
and routine GM review mechanics.

The canonical log is a GM-full projection of discrete structured events. Viewer-specific identity
and field sanitization happens after that projection through `projectCombatLogForViewer`. The same
sanitized structural log is delivered to Player Combat and GM Player Combat; GM retains the
full projection. The log can be viewed while a round is open and recalled from the same immutable
round facts after the round closes.

### 7.1 Event model

The existing canonical combat event stream, persisted declaration/action facts, and immutable round
facts are the sources. Project a smaller narrative stream rather than displaying every command:

```ts
type CombatPresentationEventCategory =
  | "declaration"
  | "attempt"
  | "response"
  | "roll_recorded"
  | "contest_resolved"
  | "attack_resolved"
  | "defense_resolved"
  | "state_changed"
  | "damage_committed"
  | "review_completed"
  | "boundary_opened";

interface CombatRecapEventPresentation {
  id: string;
  encounterId: string;
  encounterRevision: string;
  roundNumber: number;
  sequence: number;
  occurredAt: string;
  category: CombatPresentationEventCategory;
  phase?: string;
  processId?: string;
  actor?: CombatPresentationSubject;
  target?: CombatPresentationSubject;
  summary: string;
  outcome?: string;
  state: "provisional" | "final";
  compactionKey?: string;
  supersedesEventIds: string[];
  presentationTargetId?: string;
  presentationTargetKind?:
    | "attack"
    | "defense"
    | "maneuver"
    | "damage"
    | "declaration"
    | "participant_review";
}
```

Default recap events include declarations, visible attempts/targets, responses, meaningful rolls, contest results, attacks, defenses, distance changes, criticals, committed damage/effects, participant-review outcomes, and boundary/round openings. They exclude validations, authorization failures, draft edits, intermediate proposal mutations, and raw contribution changes.

### 7.2 Compaction and supersession

A final resolution may supersede provisional narrative events with the same process/contest compaction key in the default feed. Superseded facts remain expandable in Detailed Action Result or historical audit; they are not deleted.

The initial Combat Log foundation does not compact or supersede events. Its IDs, structured summary
facts, provisional/final state, and source links leave that capability additive for a later slice.

Example:

```text
Scyrian cavalry attempted to move closer to The Gladiator.
The Gladiator opposed the attempt.
Scyrian cavalry won the distance contest. Distance changed from 3 to 2.
```

After resolution, an earlier card must not continue to say `Awaiting opponent roll`. `roll_recorded` completion is an explicit viewer-safe fact even when the opponent's die is hidden.

### 7.3 Current event gaps

The event schema already covers most attack, maneuver, distance, health, and participant-review facts. It does not consistently provide canonical major events for Combat Experience, effect review, initiative commit, top-level boundary opening, and next-round opening. These should be additive derived presentation events from existing command/event facts; they do not require a history schema redesign unless no immutable source fact exists.

## 8. Calculation presentation standard

Every calculation presenter uses this default order:

```text
Skill/base   <label and value>
Modifier     <signed total>
Die roll     <visible roll or privacy-safe “Recorded”>
Result       <final numeric/table result>
Outcome      <plain-language outcome>
```

An optional collapsed `Contribution details` section lists canonical contribution ID, label, value, scope, and applicability context for fields the viewer may see. It is never used to recompute the total.

| Calculation       | Standard mapping                                                                                      | Intentional difference                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Initiative        | Initiative base; modifiers; die; total; committed rank/order                                          | Rank exists only after commit                              |
| Attack            | Skill/OB base; attacker modifiers and opposing DB/Parry as labeled terms; die; lookup/result; H/M     | Has an opposing defense term and table lookup              |
| Parry             | Parry base; modifiers; die; total; success/failure                                                    | Defender-owned calculation                                 |
| Dodge             | Dodge skill; modifiers; die; total; waiting/win/loss                                                  | Opposed contests can show two sanitized calculation blocks |
| Feint             | Selected attack/defense skill; modifiers; die; total; contest outcome                                 | Attacker and defender may use different skills/stats       |
| Adjust Distance   | Dodge; roll-local adjustment/modifiers; die; total; contest/distance outcome                          | Allow path has `Die roll: Not required`                    |
| Distance control  | Dodge; modifiers; die; total; contest/distance outcome                                                | Pair process, sometimes suppressed by in-round contest     |
| Health            | Health/Constitution base; modifiers; die; result; health outcome                                      | Difficulty/reason is outcome context                       |
| Combat Experience | Skill/base; modifiers/difficulty; die or `Not required`; result; CE outcome                           | Some paths require no roll                                 |
| Critical          | Critical base/type; modifiers; dice; table result; critical outcome                                   | Uses its canonical critical dice/table                     |
| Damage/effects    | Damage base; modifiers/mitigation; relevant dice or `Not required`; committed amount/effects; outcome | May be a multi-step table/effect calculation               |

Current intentional rule differences should remain. Current accidental presentation inconsistencies should not: attack uses an inline formula while Dodge uses five labeled rows, GM and Player have duplicate formatter branches, and generic events sometimes render humanized raw object keys. Standardization changes formatting only, never formulas.

### Parry declaration and targeted secondary context

Parry is displayed as an untargeted primary action. During declaration, Current Action describes
the defensive focus; no independent roll button appears until an ordinary incoming attack creates
defensive work. The generated modifier appears in DB/Parry preview and review as
`Parry +<derived>%`, with concise Dodge and one-fifth provenance. The ordinary parry calculation
shows the non-zero raw percentage row and uses authoritative workbook arithmetic.

Observe Opponent is displayed in the secondary-action selector. When selected, its
`Opponent to observe` participant selector appears in the shared Phase 1 panel, never in the
general action selector. It is separate from any primary attack, Feint, Adjust Distance, Offensive
Parry, or Reactive Attack target. This declaration-only slice presents no Observe roll, result,
modifier, or tracker marker.

### 8.1 Implemented Offensive Parry Brawling subset

Offensive Parry Brawling now uses the reusable combat roll/contest presentation model without
claiming that every combat calculation has migrated. Brawling modifier contributions are workbook
percentage inputs, not flat skill points. One roll displays:

```text
Skill: <base value used by the roll>
Percentage modifiers: <signed raw percentage total>%
- <non-zero modifier source>: <signed raw value>%
Effective skill: <persisted workbook-adjusted skill>
Die roll: <canonical open-ended roll total>
Total: <persisted final total>
```

For example, base Brawling 15 with Offensive Parry parry quality `+2%` uses the shared workbook
percentage table and resolves to effective skill 18. The UI presents the persisted raw percentage,
table adjustment, and effective value; it does not independently add two skill points or recompute
the table.

The final contest displays both sides to the GM, followed by the signed difference and winner. The
difference convention is controller total minus affected-participant total; zero is a tie under the
existing strictly-higher rule. An involved player receives their own full concise roll, the
opponent's total, the difference, and the broad result. The opponent's die and modifier breakdown
remain private.

Calculation attachment is identity- and result-kind-specific: Attack receives the attack
calculation, purpose-tagged Offensive Parry receives the parry calculation, and the final
`Offensive Parry — Brawling` result receives one contested calculation keyed by contest result
identity. Sharing an `attackResultId` is lineage, not permission to copy every child calculation
onto every parent result.

Action buttons consume validation facts projected for the exact viewer-owned task. In a parallel or
tied group, task selection applies viewer ownership before selecting the first executable task; a
different participant's earlier task cannot suppress the viewer's validation tuple. GM proxy and
participant execution then use the same factual attack/parry tuple, differing only in authority.
Accepted encounter revisions replace the rendered descriptor. A rejected action remains a
recoverable action-panel error while the newly projected combat state remains renderable.

GM Player Combat accepts mutation responses whose authoritative encounter changed but whose route
does not return a participant snapshot. It updates participant caches only when a participant is
present and always reprojects from the returned encounter; an omitted optional participant may
never be dereferenced by presentation code.

## 9. Visibility and sanitization

### 9.1 Visibility levels

Each presentation fact or field is assigned one level:

- `gm_full`: GM-only notes, diagnostics, hidden identities, private proposals, all dice/calculations;
- `involved_participant`: facts needed by the actor, target, required responder, or affected participant;
- `aware_observer`: perceptible broad action and outcome facts for a participant aware of the combatants/event;
- `hidden`: omitted entirely, except that an enclosing visible fact may use a non-identifying fallback.

Visibility is field-level. An event can be visible while its die, exact contribution, identity, or note is not.

### 9.2 Matrix

| Field/fact                                        | GM   | Actor/roller                         | Involved target/opponent            | Aware third party               | Hidden viewer          |
| ------------------------------------------------- | ---- | ------------------------------------ | ----------------------------------- | ------------------------------- | ---------------------- |
| Task/event ID and completion status               | Full | Safe stable ID/status                | Safe stable ID/status when involved | Broad status if perceptible     | Omit                   |
| Action kind, phase, broad reason                  | Full | Full                                 | Full when involved                  | Broad visible action            | Omit                   |
| Actor/target identity                             | Full | Visible identities or fallback       | Visible identities or fallback      | Only identities already visible | Fallback or omit       |
| Required responder                                | Full | Visible or safe fallback             | Visible or safe fallback            | Only if perceptible             | Omit                   |
| Broad success/failure, hit/miss, distance change  | Full | Full                                 | Full                                | If perceptible                  | Omit                   |
| Own die and calculation                           | Full | Full                                 | Not unless they rolled it           | No                              | No                     |
| Other participant's exact die/private calculation | Full | No, except an explicitly public rule | No                                  | No                              | No                     |
| Roll-recorded/completion boolean                  | Full | Yes                                  | Yes when needed for involved status | Broad status if perceptible     | No                     |
| Proposal status and public outcome                | Full | Safe involved fields                 | Safe involved fields                | Broad final outcome only        | No                     |
| Proposal arithmetic/private adjustments           | Full | Only own/explicitly shared facts     | Only own/explicitly shared facts    | No                              | No                     |
| Weapon/skill                                      | Full | Own and visibly used facts           | If perceptible                      | If perceptible                  | Generic action wording |
| Current/requested distance                        | Full | When involved                        | When involved                       | If perceptible                  | No                     |
| Damage/effects                                    | Full | Own/visible detail                   | Affected visible detail             | Broad perceptible outcome       | No                     |
| GM notes, blockers, diagnostics                   | Full | Sanitized waiting reason only        | Sanitized waiting reason only       | No                              | No                     |

Players may see declarations, attempts, and broad outcomes for combatants/events they are aware of. Involved players must clearly see what is being done to them. Concealment still wins over identity disclosure.

GM Player Combat consumes exactly the same sanitized presentation as real Player Combat. Proxy capability is an additive authorization/display capability; it does not switch the data model to `gm_full` and does not add GM review controls.

### 9.3 Completion without private dice

Every opposed or multi-party process exposes sanitized facts such as:

```ts
{
  actorInputRecorded: boolean;
  targetInputRecorded: boolean;
  processResolved: boolean;
  outcomeVisible: boolean;
}
```

These are derived from authoritative facts before private raw roll objects are removed. React components never infer `targetInputRecorded` from the presence of `targetRoll`.

## 10. Revision and staleness rules

`CombatPresentationProjection` is an atomic bundle:

```ts
interface CombatPresentationProjection {
  encounterId: string;
  encounterRevision: string;
  progressionTaskSetId: string;
  currentAction: CurrentActionPresentation | null;
  tracker: CombatTrackerPresentation;
  recapEvents: CombatRecapEventPresentation[];
  selectedPresentationTargetId?: string;
  selectedDetailedResult?: CombatDetailedResultPresentation;
  modifierRows: CombatModifierPresentation[];
}
```

Rules:

1. The client accepts a candidate encounter/presentation only if its revision is not older than the accepted revision. Same-revision payloads must be identical or rejected as contradictory.
2. A history/progression payload is displayed only with the encounter revision that produced it. Partial replacement does not mix revisions.
3. Current Action's command descriptor is immutable and uses the task's bound revision.
4. Combat Log selection owns `selectedPresentationTargetId`; Action Outcome consumes that target. A local tracker cell or participant inspection never replaces the live selection with a latest-result fallback. The historical inspector retains its own immutable selection. None of these selections change canonical task IDs, execution group, boundary, tracker state, or Current Action.
5. A fresh live view defaults to the newest Combat Log event with a presentation target. A selected target survives newer accepted revisions while it still exists; undo/removal clears it without jumping to an unrelated target.
6. Player/GM Player participant switching re-sanitizes the accepted canonical presentation and clears viewer-local transient results. It does not rebuild progression.
7. A task change or accepted newer revision invalidates transient local roll-result cards unless they are attached to a canonical event/result.
8. Reconnect/reload replaces the complete accepted bundle. Polling does not rebuild the projection per row/cell.
9. Missing task enrichment or severe relevant diagnostics yield a non-actionable conflict/waiting presentation, never a latest-event or cursor fallback.
10. An accepted mutation response is the immediate source of the next live encounter revision and command envelope. The client replaces the prior revision, clears prior-task inspection state, and renders the envelope-selected task without waiting for polling.
11. Attack modifier validation belongs to the exact revision, task, execution group, initiative group, opportunity, effect cutoff, and active-modifier fingerprints that produced it. Initiative-group advancement discards the old validation rather than patching it.
12. A Player-safe history projection is displayed only when its `sourceUpdatedAt` matches the accepted encounter revision. After an accepted Player mutation, the prior history descriptor is hidden until the matching authoritative projection loads.
13. A genuine `stale_revision`, task/group mismatch, or modifier-signature mismatch refreshes canonical state and asks the user to review the new action. The mutation is not replayed automatically.

## 11. GM-first view-model and component architecture

Recommended pure view-model boundary:

```ts
projectCombatPresentation({
  encounter,
  progression,
  events,
  snapshots,
  modifierProjection,
}): CombatPresentationProjection;

projectCombatPresentationForViewer(
  canonical: CombatPresentationProjection,
  viewer: CombatPresentationViewerContext,
): CombatPresentationProjection;
```

Build and index progression, process facts, events, participant identities, pairs, opportunities, proposals, results, and modifier contexts once per encounter revision. Components receive display-ready models. Shared components should include:

- `CombatTracker` backed only by `CombatTrackerPresentation`;
- `CombatCurrentActionPanel` backed only by `CurrentActionPresentation`;
- `CombatRecap` backed only by `CombatRecapEventPresentation[]`;
- `CombatDetailedResult` backed by a selected canonical result ID;
- `CombatCalculationSummary` for the five-row standard;
- `CombatModifierList` backed by the same calculation context/revision.

The domain progression presentation currently removes most task identity after filtering (opponent, pair, opportunity, proposal, and attack-result links). A canonical presentation builder needs those fields before sanitization. The preferred solution is to enrich and sanitize task presentation at the domain/API presentation boundary, not to make web components search raw combat state again.

## 12. Confirmed current deviations

1. **Any current facet becomes `?`.** Both tracker paths effectively translate current-task presence to `?`, including ordinary declaration work. This violates the attention semantics above.
2. **Generic current hover.** A live current facet without a result can fall back to `current task` instead of the actual required task/actor.
3. **Legend conflates states.** `✓` currently includes “ready for review,” and `–` combines skipped, cancelled, locked, and not applicable without requiring a final fact.
4. **Duplicate tracker interpretation.** `buildCombatTrackerModel` and the projected tracker independently combine tasks, statuses, proposals, results, events, and snapshots.
5. **GM Current Action follows inspection.** Manual inspector selection can replace the action area with an inspection message. Current Action is therefore not fully independent of local selection.
6. **GM Current Action is still inferred.** It starts from projected tasks but then branches through cursors, proposal status, damage state, phase choice, and round-end state.
7. **Player Current Action is still inferred.** Projected task kinds are cross-checked with raw cursors/proposals/results, and button labels come from a separate conditional tree.
8. **Task presentation lacks context identity.** Player-safe task identity retains phase/execution group but not enough opponent, pair, opportunity, proposal, or attack-result context for a complete Current Action.
9. **Player Action Result has fixed-priority stale selection.** Health/distance/maneuver/latest-attack and other candidates can win independently of the projected current task.
10. **GM Action Result can retain an older event.** When a current cell has no exact event, `retainLatestWhenEmpty` can select the participant's latest event from another cell; legacy fallbacks add more stale-selection paths.
11. **Known Adjust Distance completion bug.** The player-safe proposal preserves `attackerRollRecorded` and `defenderRollRecorded`, but Player Action Result still checks for the hidden opponent raw roll object. A completed contest can therefore remain `Awaiting opponent roll`.
12. **Visibility is event/cohort-level rather than a presentation field contract.** Existing public/involved/perceived/GM scopes are useful, but UI status still depends on raw object presence in places.
13. **Aware declaration visibility is incomplete.** Declaration events are currently involved-only even though the intended contract permits declarations visible to aware observers.
14. **No chronological major-event recap.** GM displays one command-history summary; Player displays prioritized result cards. Neither is the canonical compacted event feed described here.
15. **Calculation layouts diverge.** Dodge follows a five-row structure, attack uses an inline formula, and generic events may dump humanized raw fact keys. GM and Player also duplicate formatter logic.
16. **Atomic revision use is partial.** Monotonic revision guards and history `sourceUpdatedAt` checks exist, but encounter facts, history, local results, and presentation inference are stored/selected through separate paths.

## 13. Recommended implementation slices

### Slice 1 — Tracker marker semantics and task hover context (recommended first)

- **Problem solved:** ordinary open work no longer appears as exceptional `?`; hover identifies the real task and required actor.
- **Likely files:** progression task presentation types/builders; `buildCombatProgressionTrackerModel.ts`; `buildProjectedCombatTrackerModel.ts`; `buildCombatTrackerModel.ts`; tracker tests and legend.
- **Tests:** every facet's unopened/open/exceptional/waiting/final/historical state; declaration opens as `·`; CE/Health/defender/maneuver tasks show `?`; future tasks remain `·`; GM/Player parity; hover privacy.
- **Risk:** existing tests and user expectations currently equate `current` with `?`. Add an explicit attention classification rather than changing task executability.
- **Non-goals:** Current Action migration, recap, command behavior, calculation formatting.

This is the recommended first slice because it is bounded, immediately removes a confirmed semantic error, and introduces the task display metadata later slices can reuse without coupling UI to raw combat facts.

### Slice 2 — Canonical Current Action presentation

- **Problem solved:** GM and Player stop independently reconstructing current action context; local inspection cannot replace it.
- **Likely files:** domain progression presentation; API combat-history projection; a new shared Current Action view model/component; `CombatRoundManagerPanel`; `ScenarioPlayerCombatPageContent`; `PlayerCombatPanels`.
- **Tests:** all task kinds, actor/target/respondent, proxy, boundary tasks, hidden identity wording, inspection independence, immutable request descriptors.
- **Risk:** the existing action panels contain command-specific draft/validation concerns. Move presentation first and retain existing command helpers behind the descriptor.
- **Non-goals:** command authorization redesign, process sequencing, result/recap migration.

### Slice 3 — Player-safe completion facts and stale Action Result fix

- **Problem solved:** hidden opponent rolls no longer make a completed contest look pending; old CE/Dodge/attack cards cannot override current context.
- **Likely files:** player-safe encounter/history projection; player result-selection view model; Adjust Distance/Feint result presenters; API and web tests.
- **Tests:** opponent roll hidden but `inputRecorded`/resolved visible; completed Adjust Distance and Feint; own dice retained; stale priority fallback removed; real Player/GM Player parity.
- **Risk:** revealing completion can leak timing if scoped too broadly. Limit it to involved/perceptible processes.
- **Non-goals:** exposing private dice/calculations, tracker redesign, recap UI.

### Slice 4 — Chronological major-event recap

- **Problem solved:** combat narrative becomes chronological and final resolutions supersede stale provisional wording.
- **Likely files:** combat event projection/schema adapters; API player-safe projection; new recap view model/component; GM/Player panels.
- **Tests:** all event categories, stable ordering, distance/Feint chains, compaction/supersession, hidden identities, aware observers, reload/history immutability.
- **Risk:** event gaps may require additive derived facts. Prefer derivation from persisted commands/events before schema changes.
- **Non-goals:** command log UI, full audit trail replacement, history persistence redesign.

### Slice 5 — Shared calculation and detailed-result components

- **Problem solved:** Initiative, Attack, Parry, Dodge, maneuvers, Health, CE, critical, and damage use one readable structure.
- **Likely files:** combat-history result models/components; Player result panels; GM detail panels; shared calculation presentation types.
- **Tests:** golden display models for every calculation; contribution privacy; no numeric/formula changes.
- **Risk:** superficially similar calculations have intentional rule-specific terms. Normalize layout, not formula semantics.
- **Non-goals:** calculation/modifier engine changes, workbook rule changes.

### Slice 6 — Atomic GM-first presentation projection and sanitization

- **Problem solved:** all panels consume one revision-bound bundle; privacy is field-level and structurally identical across viewers.
- **Likely files:** new domain/API presentation projection; combat-history response; viewer context/sanitizer; GM and Player data hooks/reducers.
- **Tests:** build once per revision; field visibility matrix; out-of-order polling; participant switch; reconnect; severe diagnostics fail closed; GM Player parity.
- **Risk:** transport size and accidental disclosure. Index once, sanitize server-side, and add explicit negative privacy assertions.
- **Non-goals:** persistence changes, polling frequency changes, identity normalization.

### Slice 7 — Retire duplicate GM/Player presentation logic

- **Problem solved:** legacy marker, task, latest-result, and formatter branches can no longer drift.
- **Likely files:** `CombatRoundManagerPanel`; Player Combat page; legacy tracker/result helpers; shared presentation components.
- **Tests:** regression matrix for Single, Reactive, Double, Feint, Adjust Distance, both phases, round end, history, GM/Player parity.
- **Risk:** hidden compatibility dependencies in the large GM panel. Remove paths only after parity tests prove the shared projection covers them.
- **Non-goals:** broad visual redesign, command/request changes, progression or combat rule changes.

## 14. Acceptance criteria for the completed migration

- GM, Player, and GM Player use the same structural presentation models.
- Sanitization never causes a completed process to appear pending.
- Declaration opens with `·`; exceptional nested/prerequisite work alone uses `?`.
- Every live hover names the actual safe task and required actor.
- Current Action is task-derived, revision-bound, and independent of inspection.
- Recap is chronological and final resolutions compact stale provisional messages.
- Detailed Action Result requires an explicit canonical result/event selection.
- All calculation views use the shared structure without changing values.
- Future/unopened work never receives a current marker.
- No application component infers completion from a hidden raw roll, proposal, or calculation object.

## Initiative-group timing

A1/A2 Current Action and tracker projection expose only the highest unresolved initiative value.
Exact ties project together and use the same pre-group effective state. Consequences created during
that group are visible under **Pending modifiers**, with wording such as `Effective after
Initiative 4 finishes`; they are excluded from arithmetic until the group closes.

Lower-group waiting text names the initiative currently resolving. A tied participant whose own
work completed sees a recorded/waiting state rather than an unavailable-task error. The concise
calculation contract may include a `Pending` subsection, but those rows never enter `Modifiers`,
`Effective skill`, or `Total` for the creating group. See
`combat-initiative-group-timing.md` for lifecycle and undo/reload rules.
