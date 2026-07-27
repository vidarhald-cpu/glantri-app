# Combat task integration matrix

## Persistence boundary

Every accepted task mutation retains its existing descriptor and domain transition,
then persists through the revision-guarded active-state boundary. Task kind does not
select a storage path. Only canonical round transition may append one archive row,
and only cross-boundary undo may remove that exact row.

This matrix records whether a projected combat task is invoked through an immutable
`CurrentActionCommandDescriptor`, or whether a handler still reconstructs command context from
component or inspector state. It is an implementation audit, not a combat-rule specification.

Authority remediation (2026-07-23): obsolete Feint-feasibility, skip-current-action,
advance-current-phase-resolution, and complete-current-phase-resolution routes were removed. Every
supported boundary mutation now validates the exact projected command, revision, task, execution
group, current boundary, and target boundary. Attack, parry, hit-location, and critical routes no
longer add compatibility-cursor eligibility after canonical authorization.

Attack-lineage remediation (2026-07-23): declaration creates one deterministic canonical identity
per attack opportunity. Attack tasks/descriptors/requests require its action, index, participant
pair, source/template/instance, and mode identities. Commands, results, events, parry and post-hit
tasks retain the exact opportunity/result chain. Missing lineage is historical/read-only and cannot
authorize a live command.

| Task kind                                     | Status                 | Canonical command integration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit_declaration`                          | Fully descriptor-bound | Declaration/edit values remain form input; participant, task, group, and revision identity come only from the descriptor.                                                                                                                                                                                                                                                                                                                                                                                         |
| `combat_experience`                           | Fully descriptor-bound | Difficulty setup, CE roll, and initiative-choice commands require the exact projected task identity.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `modifier_review`                             | Fully descriptor-bound | M1/M2 review uses the projected participant task, phase, group, and revision.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `roll_initiative`                             | Fully descriptor-bound | GM proxy and player rolls use descriptor participant/phase identity; submitted calculation inputs remain server-validated.                                                                                                                                                                                                                                                                                                                                                                                        |
| `commit_initiative`                           | Fully descriptor-bound | GM commit requires the projected GM task, execution group, phase, and revision.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `attack`                                      | Fully descriptor-bound | Invocation and persistence require the exact declaration/opportunity/index/source/template/instance/mode plus participant pair, task, execution group, initiative group, phase, revision, effect cutoff, and canonical modifier fingerprints. Viewer ownership is applied while selecting the validation task, so tied/parallel sibling ordering cannot suppress a player's tuple. GM and Player use the same projected facts.                                                                                    |
| `parry`                                       | Fully descriptor-bound | GM/player handlers and API retain the upstream opportunity and exact attack result through the parry task. The validation tuple additionally binds the purpose, source, process/stage, effect cutoff, attack-result modifier, combined DB/Parry plus combat-wide General value, and contribution fingerprint. Offensive Parry reuses this task with maneuver declaration, selected opponent, and deterministic attempt identity; one resolved attempt is terminal and cannot be replayed from a stale descriptor. |
| `offensive_parry_brawling_roll`               | Fully descriptor-bound | Two participant-owned tasks share one parallel group after an exact successful-parry trigger. Contest/declaration/opportunity/attack/parry/process/stage identities authorize both player and GM-proxy rolls.                                                                                                                                                                                                                                                                                                     |
| `continued_contact_maintenance_roll`          | Fully descriptor-bound | Two participant-owned Round End Brawling tasks share one parallel group. Exact contest, Continued Contact, participant/opponent, roll-purpose, process, stage, task, execution-group, and revision identities authorize player and GM-proxy rolls.                                                                                                                                                                                                                                                                |
| `hit_location`                                | Fully descriptor-bound | Exact attack/result/opportunity/task/group identity authorizes the command; new results carry source-specific downstream damage inputs.                                                                                                                                                                                                                                                                                                                                                                           |
| `critical`                                    | Fully descriptor-bound | Exact attack/location/critical/task/group identity authorizes the command and retains upstream opportunity/source lineage.                                                                                                                                                                                                                                                                                                                                                                                        |
| `damage_roll`                                 | Fully descriptor-bound | Graze damage uses the exact attack opportunity/result and its persisted source-specific DMB/armor context.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `damage_review`                               | Fully descriptor-bound | Both damage resolution and review commit are bound to exact attack/review identity.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `double_attack_decision`                      | Fully descriptor-bound | The decision value is form input; participant/opportunity/task identity comes only from the descriptor.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `feint_attacker_roll` / `feint_defender_roll` | Fully descriptor-bound | GM proxy and player rolls require exact participant, proposal, task, group, and revision identity.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `feint_commit`                                | Fully descriptor-bound | GM review values remain form input; proposal/task/group/revision identity is immutable.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Adjust Distance tasks                         | Fully descriptor-bound | Response, adjustment, parallel rolls, and commit all use exact proposal/task/group/revision identity.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `distance_roll` / `distance_commit`           | Fully descriptor-bound | Round-end pair, opponent, proposal, participant, task, group, and revision come from the descriptor.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `health_review`                               | Fully descriptor-bound | Health roll identity and participant ownership are descriptor-bound for player and GM proxy.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `participant_review`                          | Fully descriptor-bound | This is the ordered Round End process stage; its mutation point is the canonical `effect_review` task below.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `effect_review`                               | Fully descriptor-bound | The GM participant/effect commit requires the exact projected participant task and revision.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `round_end_prepare`                           | Fully descriptor-bound | The guarded preparation effect invokes only its exact projected GM descriptor and is keyed by task plus revision.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `gm_advance_boundary`                         | Fully descriptor-bound | Requires command type, revision, exact task/group, current boundary, and target boundary for every top-level transition.                                                                                                                                                                                                                                                                                                                                                                                          |

There are no remaining task-integration gaps. Editable rule inputs (declarations, choices, roll
sources, and GM review values) remain local form state by design, but no handler derives combat
identity or command eligibility from those forms, the inspector, cursors, or latest-result chains.

Read-source separation (2026-07-26): task authority and mutation projection
continue to load the full authoritative write model. Read-only revision and
history routes now use strict metadata and `CombatHistorySourceView` contracts,
respectively. The history view carries the exact active/archive facts and
revision needed for presentation, but cannot authorize a command and cannot be
cast back to `EncounterSession`. Player-safe history remains viewer-projected
after access checks. This read seam changes no task identity or progression
behavior.

Declaration-context ownership (2026-07-25): Parry is an untargeted primary action and therefore
projects no outgoing A1/A2 opportunity. Its one deterministic round modifier is derived from the
stable total Dodge skill identity as `floor(Dodge / 5)%`, stored in the DB/Parry bucket, reviewed
and consumed by the ordinary parry pipeline. Observe Opponent is primary-ineligible and is
selectable only as a typed Parry secondary declaration. Its independently persisted participant
target appears in Phase 1 and creates no attack-phase task. The complete-round boundary
first authorizes the exact currently projected `complete_round` descriptor, then advances
non-threshold progress from immutable declaration and attack-result facts before archiving the
round. Progress mutation must not be used to re-project or replace the command being authorized.
At a threshold, SU instead projects one observer-owned `observation_roll` task; the observed target
receives no task. The accepted command resolves both canonical rolls server-side in one revision,
records compact inverse facts, and derives pair-scoped OB and DB/Parry contributions from the
relationship's single best-bonus source. Primary action context, secondary action context, and
movement intent remain separate canonical facts.

Tracker round isolation (2026-07-24): the completed round retains its declaration, initiative,
attack, defense, damage, and round-end facts, while the new active participant state clears both
legacy phase attack slots and canonical opportunity-keyed attack results. Tracker cells are keyed
by round, participant, and facet; an unopened cell is not inspectable. `M` remains the explicit
recorded-miss outcome and is never carried forward as a pending marker. This presentation repair
does not change task sequencing or initiative-group behavior.

This matrix now covers both handler authority and canonical attack lineage. Historical records that
predate opportunity/source/mode persistence may use read-only snapshot compatibility, but that path
cannot provide a live descriptor or authorize a mutation.

Offensive Parry Slice 1 adds a proactive purpose on the ordinary `parry` task plus its post-success
Brawling task. The selected opponent is bound at declaration, and a qualifying committed attack
creates the task regardless of hit outcome. The shared declaration UI binds that opponent in the
Phase 1 panel. One round-scoped `flat_db` fact supplies preview, modifier review, persisted
calculation context, and authoritative effective DB. Player-safe projection preserves the Brawling
contest identity across the two stable `parallel_all` child tasks; completion of one child leaves
the other executable. The second roll completes the group, leaves no Brawling task projected,
clears its tracker attention, and advances Current Action from the accepted post-mutation
projection; undo restores exactly one unresolved child. GM Combat refreshes the active encounter
revision while open so a final player-owned roll replaces a stale GM descriptor instead of leaving
an obsolete proxy button. The final contest owns one concise, viewer-sanitized calculation;
Attack and purpose-tagged parry retain only their exact calculations. Continued Contact follow-up
attacks remain explicitly deferred and therefore add no attack task kind.

Continued Contact maintenance/escape (2026-07-25): after the establishment round's
controller-owned distance choice and one complete ordinary round, active relationships project one
Round End `parallel_all` maintenance contest before distance work. The first roll leaves the other
task stable and executable. The final roll either maintains the relationship and returns
controller-owned distance selection, or atomically ends Continued Contact and Unbalanced and
restores ordinary opposed distance control; ties use the escape outcome. The affected participant's
descriptor carries `rollPurpose: escape_continued_contact`, so only the linked Unbalanced
contribution is excluded while other modifiers remain. Undo of the final roll restores exactly one
unresolved task and the pre-result state.

Initiative-group execution (2026-07-24): A1/A2 now selects the highest unresolved committed
initiative value and projects all exact-tie opportunities at that value. Resolution descriptors
carry the stable round/phase/initiative group identity and value with existing task, execution
group, opportunity, and result lineage. Child work keeps the initiative group open, so lower values
cannot authorize until damage/effect commit closes it.

Initiative-commit undo compaction (2026-07-26): `commit_initiative` keeps the same projected
task/group/revision authorization and next-task envelope, but new persisted commands carry a strict
versioned inverse for only the navigation, changed phase/action statuses, and opened
Feint/Adjust Distance proposal states. Full `CombatRoundState` snapshots are forbidden for new
commits. Legacy `facts.previousState` commands remain readable and undoable. The API returns the
authoritative encounter and compact command envelope without duplicating the committed command as
a second top-level payload.

Damage and Offensive Parry consequences created in a tie persist their source group and activation
boundary. They remain visible but non-effective within that group and become effective
automatically for the next group. No activation endpoint or GM review task was added.

Post-mutation handoff (2026-07-24): accepted GM mutations adopt the returned encounter and command
envelope immediately. Completing an initiative group therefore replaces its attack validation with
the lower group's new revision/group/cutoff/fingerprints before that button renders. Completing the
final SU participant review selects the returned `gm_advance_boundary` task, so Open declarations
uses the post-review revision on its first click. Player Combat invalidates any history projection
whose source revision no longer matches its accepted encounter while it loads the new sanitized
projection. Genuine cross-client stale requests still fail closed, refresh canonical state once,
and are never replayed automatically.

Player Combat refresh consolidation (2026-07-26): every player-enabled mutation adopts its returned
exact encounter through one monotonic revision gate, then requests at most one player-safe history
projection keyed by encounter, revision, and optional GM perspective. Interval and focus refreshes
poll only compact revision metadata; unchanged polls project no task and fetch no encounter or
history. A newer revision invalidates action controls until the exact player-safe encounter and
matching progression/history projection arrive.
