# Combat task integration matrix

This matrix records whether a projected combat task is invoked through an immutable
`CurrentActionCommandDescriptor`, or whether a handler still reconstructs command context from
component or inspector state. It is an implementation audit, not a combat-rule specification.

Authority remediation (2026-07-23): obsolete Feint-feasibility, skip-current-action,
advance-current-phase-resolution, and complete-current-phase-resolution routes were removed. Every
supported boundary mutation now validates the exact projected command, revision, task, execution
group, current boundary, and target boundary. Attack, parry, hit-location, and critical routes no
longer add compatibility-cursor eligibility after canonical authorization.

| Task kind                                     | Status                 | Canonical command integration                                                                                                       |
| --------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `submit_declaration`                          | Fully descriptor-bound | Declaration/edit values remain form input; participant, task, group, and revision identity come only from the descriptor.           |
| `combat_experience`                           | Fully descriptor-bound | Difficulty setup, CE roll, and initiative-choice commands require the exact projected task identity.                                |
| `modifier_review`                             | Fully descriptor-bound | M1/M2 review uses the projected participant task, phase, group, and revision.                                                       |
| `roll_initiative`                             | Fully descriptor-bound | GM proxy and player rolls use descriptor participant/phase identity; submitted calculation inputs remain server-validated.          |
| `commit_initiative`                           | Fully descriptor-bound | GM commit requires the projected GM task, execution group, phase, and revision.                                                     |
| `attack`                                      | Fully descriptor-bound | Attack invocation requires projected participant, target, phase, opportunity, task, group, and revision; no cursor shadow remains.  |
| `parry`                                       | Fully descriptor-bound | GM/player handlers and API require exact parry task/group/revision and attack identities; no cursor shadow remains.                 |
| `hit_location`                                | Fully descriptor-bound | Exact attack/result/task/group identity authorizes the command; compatibility cursor state cannot reject it afterwards.             |
| `critical`                                    | Fully descriptor-bound | Exact attack/location/critical/task/group identity authorizes the command; compatibility cursor state cannot reject it afterwards.  |
| `damage_roll`                                 | Fully descriptor-bound | Graze damage is rolled by the projected attacker (or GM proxy) using exact attack, opportunity, task, group, and revision identity. |
| `damage_review`                               | Fully descriptor-bound | Both damage resolution and review commit are bound to exact attack/review identity.                                                 |
| `double_attack_decision`                      | Fully descriptor-bound | The decision value is form input; participant/opportunity/task identity comes only from the descriptor.                             |
| `feint_attacker_roll` / `feint_defender_roll` | Fully descriptor-bound | GM proxy and player rolls require exact participant, proposal, task, group, and revision identity.                                  |
| `feint_commit`                                | Fully descriptor-bound | GM review values remain form input; proposal/task/group/revision identity is immutable.                                             |
| Adjust Distance tasks                         | Fully descriptor-bound | Response, adjustment, parallel rolls, and commit all use exact proposal/task/group/revision identity.                               |
| `distance_roll` / `distance_commit`           | Fully descriptor-bound | Round-end pair, opponent, proposal, participant, task, group, and revision come from the descriptor.                                |
| `health_review`                               | Fully descriptor-bound | Health roll identity and participant ownership are descriptor-bound for player and GM proxy.                                        |
| `participant_review`                          | Fully descriptor-bound | This is the ordered Round End process stage; its mutation point is the canonical `effect_review` task below.                        |
| `effect_review`                               | Fully descriptor-bound | The GM participant/effect commit requires the exact projected participant task and revision.                                        |
| `round_end_prepare`                           | Fully descriptor-bound | The guarded preparation effect invokes only its exact projected GM descriptor and is keyed by task plus revision.                   |
| `gm_advance_boundary`                         | Fully descriptor-bound | Requires command type, revision, exact task/group, current boundary, and target boundary for every top-level transition.            |

There are no remaining task-integration gaps. Editable rule inputs (declarations, choices, roll
sources, and GM review values) remain local form state by design, but no handler derives combat
identity or command eligibility from those forms, the inspector, cursors, or latest-result chains.

This matrix describes handler authority. The separate canonical-conformance audit still identifies
attack opportunity/source persistence and latest-snapshot calculation inputs as the next required
lineage slice; “fully descriptor-bound” does not claim that those persistence findings are fixed.
