# Combat task integration matrix

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

| Task kind                                     | Status                 | Canonical command integration                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit_declaration`                          | Fully descriptor-bound | Declaration/edit values remain form input; participant, task, group, and revision identity come only from the descriptor.                                                                                                                                                                                                                                        |
| `combat_experience`                           | Fully descriptor-bound | Difficulty setup, CE roll, and initiative-choice commands require the exact projected task identity.                                                                                                                                                                                                                                                             |
| `modifier_review`                             | Fully descriptor-bound | M1/M2 review uses the projected participant task, phase, group, and revision.                                                                                                                                                                                                                                                                                    |
| `roll_initiative`                             | Fully descriptor-bound | GM proxy and player rolls use descriptor participant/phase identity; submitted calculation inputs remain server-validated.                                                                                                                                                                                                                                       |
| `commit_initiative`                           | Fully descriptor-bound | GM commit requires the projected GM task, execution group, phase, and revision.                                                                                                                                                                                                                                                                                  |
| `attack`                                      | Fully descriptor-bound | Invocation and persistence require the exact declaration/opportunity/index/source/template/instance/mode plus participant pair, task, group, phase, and revision.                                                                                                                                                                                                |
| `parry`                                       | Fully descriptor-bound | GM/player handlers and API retain the upstream opportunity and exact attack result through the parry task. Offensive Parry reuses this task with explicit purpose, maneuver declaration, selected opponent, deterministic attempt, parry source, and process/stage identity; it is projected for a selected opponent's hit or miss without cursor/latest lookup. |
| `offensive_parry_brawling_roll`               | Fully descriptor-bound | Two participant-owned tasks share one parallel group after an exact successful-parry trigger. Contest/declaration/opportunity/attack/parry/process/stage identities authorize both player and GM-proxy rolls.                                                                                                                                                    |
| `hit_location`                                | Fully descriptor-bound | Exact attack/result/opportunity/task/group identity authorizes the command; new results carry source-specific downstream damage inputs.                                                                                                                                                                                                                          |
| `critical`                                    | Fully descriptor-bound | Exact attack/location/critical/task/group identity authorizes the command and retains upstream opportunity/source lineage.                                                                                                                                                                                                                                       |
| `damage_roll`                                 | Fully descriptor-bound | Graze damage uses the exact attack opportunity/result and its persisted source-specific DMB/armor context.                                                                                                                                                                                                                                                       |
| `damage_review`                               | Fully descriptor-bound | Both damage resolution and review commit are bound to exact attack/review identity.                                                                                                                                                                                                                                                                              |
| `double_attack_decision`                      | Fully descriptor-bound | The decision value is form input; participant/opportunity/task identity comes only from the descriptor.                                                                                                                                                                                                                                                          |
| `feint_attacker_roll` / `feint_defender_roll` | Fully descriptor-bound | GM proxy and player rolls require exact participant, proposal, task, group, and revision identity.                                                                                                                                                                                                                                                               |
| `feint_commit`                                | Fully descriptor-bound | GM review values remain form input; proposal/task/group/revision identity is immutable.                                                                                                                                                                                                                                                                          |
| Adjust Distance tasks                         | Fully descriptor-bound | Response, adjustment, parallel rolls, and commit all use exact proposal/task/group/revision identity.                                                                                                                                                                                                                                                            |
| `distance_roll` / `distance_commit`           | Fully descriptor-bound | Round-end pair, opponent, proposal, participant, task, group, and revision come from the descriptor.                                                                                                                                                                                                                                                             |
| `health_review`                               | Fully descriptor-bound | Health roll identity and participant ownership are descriptor-bound for player and GM proxy.                                                                                                                                                                                                                                                                     |
| `participant_review`                          | Fully descriptor-bound | This is the ordered Round End process stage; its mutation point is the canonical `effect_review` task below.                                                                                                                                                                                                                                                     |
| `effect_review`                               | Fully descriptor-bound | The GM participant/effect commit requires the exact projected participant task and revision.                                                                                                                                                                                                                                                                     |
| `round_end_prepare`                           | Fully descriptor-bound | The guarded preparation effect invokes only its exact projected GM descriptor and is keyed by task plus revision.                                                                                                                                                                                                                                                |
| `gm_advance_boundary`                         | Fully descriptor-bound | Requires command type, revision, exact task/group, current boundary, and target boundary for every top-level transition.                                                                                                                                                                                                                                         |

There are no remaining task-integration gaps. Editable rule inputs (declarations, choices, roll
sources, and GM review values) remain local form state by design, but no handler derives combat
identity or command eligibility from those forms, the inspector, cursors, or latest-result chains.

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
attacks and round-end maintenance/escape remain explicitly deferred and therefore do not yet add
task kinds.
