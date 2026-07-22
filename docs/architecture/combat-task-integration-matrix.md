# Combat task integration matrix

This matrix records whether a projected combat task is invoked through an immutable
`CurrentActionCommandDescriptor`, or whether a handler still reconstructs command context from
component or inspector state. It is an implementation audit, not a combat-rule specification.

| Task kind                              | Status                     | Remaining integration work                                                                                                 |
| -------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `submit_declaration`                   | Partially descriptor-bound | GM/player handlers still assemble declaration input from their editor models after the canonical task gate.                |
| `combat_experience`                    | Partially descriptor-bound | GM flow still resolves difficulty and participant context from inspector state.                                            |
| `modifier_review`                      | Partially descriptor-bound | Review completion still routes through the legacy step-advance handler.                                                    |
| `roll_initiative`                      | Partially descriptor-bound | Roll inputs and phase are still recovered by the GM/player initiative handlers.                                            |
| `commit_initiative`                    | Partially descriptor-bound | The canonical task gates visibility, but commit invocation still uses the legacy current-step path.                        |
| `attack`                               | Partially descriptor-bound | API authorization is task-based; GM/player request construction still contains phase-model context outside the descriptor. |
| `parry`                                | Fully descriptor-bound     | —                                                                                                                          |
| `hit_location`                         | Fully descriptor-bound     | —                                                                                                                          |
| `critical`                             | Fully descriptor-bound     | —                                                                                                                          |
| `damage_review`                        | Fully descriptor-bound     | Both damage resolution and review commit are bound to exact attack/review identity.                                        |
| `double_attack_decision`               | Partially descriptor-bound | GM flow still uses the inspector decision helper.                                                                          |
| Feint tasks                            | Partially descriptor-bound | Proposal and roll context are still selected by Feint-specific inspector helpers.                                          |
| Adjust Distance tasks                  | Fully descriptor-bound     | —                                                                                                                          |
| Round-end distance tasks               | Legacy handler remaining   | Pair/proposal context is still reconstructed by round-end controls.                                                        |
| `health_review`                        | Legacy handler remaining   | Health-roll context still comes from round-end inspector state.                                                            |
| `participant_review` / `effect_review` | Legacy handler remaining   | Ordered review handlers still use the Round End model directly.                                                            |
| `gm_advance_boundary`                  | Fully descriptor-bound     | —                                                                                                                          |

The recommended next migration slice is the initiative and modifier-review pair. They are adjacent
top-level processes, share GM review/commit behavior, and currently retain the largest live-task to
legacy-step adapter boundary outside Round End.
