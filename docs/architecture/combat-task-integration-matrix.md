# Combat task integration matrix

This matrix records whether a projected combat task is invoked through an immutable
`CurrentActionCommandDescriptor`, or whether a handler still reconstructs command context from
component or inspector state. It is an implementation audit, not a combat-rule specification.

| Task kind                                      | Status                 | Canonical command integration                                                                                                  |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `submit_declaration`                           | Fully descriptor-bound | Declaration/edit values remain form input; participant, task, group, and revision identity come only from the descriptor.      |
| `combat_experience`                            | Fully descriptor-bound | Difficulty setup, CE roll, and initiative-choice commands require the exact projected task identity.                           |
| `modifier_review`                              | Fully descriptor-bound | M1/M2 review uses the projected participant task, phase, group, and revision.                                                   |
| `roll_initiative`                              | Fully descriptor-bound | GM proxy and player rolls use descriptor participant/phase identity; submitted calculation inputs remain server-validated.     |
| `commit_initiative`                            | Fully descriptor-bound | GM commit requires the projected GM task, execution group, phase, and revision.                                                |
| `attack`                                       | Fully descriptor-bound | Attack invocation requires the projected participant, target, phase, opportunity, task, execution group, and revision.         |
| `parry`                                        | Fully descriptor-bound | GM/player handlers and API require the exact parry task/group/revision and authoritative attack identities.                    |
| `hit_location`                                 | Fully descriptor-bound | —                                                                                                                              |
| `critical`                                     | Fully descriptor-bound | —                                                                                                                              |
| `damage_review`                                | Fully descriptor-bound | Both damage resolution and review commit are bound to exact attack/review identity.                                            |
| `double_attack_decision`                       | Fully descriptor-bound | The decision value is form input; participant/opportunity/task identity comes only from the descriptor.                        |
| `feint_attacker_roll` / `feint_defender_roll`  | Fully descriptor-bound | GM proxy and player rolls require exact participant, proposal, task, group, and revision identity.                              |
| `feint_commit`                                 | Fully descriptor-bound | GM review values remain form input; proposal/task/group/revision identity is immutable.                                        |
| Adjust Distance tasks                          | Fully descriptor-bound | Response, adjustment, parallel rolls, and commit all use exact proposal/task/group/revision identity.                          |
| `distance_roll` / `distance_commit`             | Fully descriptor-bound | Round-end pair, opponent, proposal, participant, task, group, and revision come from the descriptor.                           |
| `health_review`                                | Fully descriptor-bound | Health roll identity and participant ownership are descriptor-bound for player and GM proxy.                                  |
| `participant_review`                           | Fully descriptor-bound | This is the ordered Round End process stage; its mutation point is the canonical `effect_review` task below.                   |
| `effect_review`                                | Fully descriptor-bound | The GM participant/effect commit requires the exact projected participant task and revision.                                  |
| `round_end_prepare`                            | Fully descriptor-bound | The guarded preparation effect invokes only its exact projected GM descriptor and is keyed by task plus revision.             |
| `gm_advance_boundary`                          | Fully descriptor-bound | —                                                                                                                              |

There are no remaining task-integration gaps. Editable rule inputs (declarations, choices, roll
sources, and GM review values) remain local form state by design, but no handler derives combat
identity or command eligibility from those forms, the inspector, cursors, or latest-result chains.
