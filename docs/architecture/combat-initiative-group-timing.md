# Combat initiative-group timing

## Canonical execution order

A1 and A2 resolve in descending committed initiative values. One initiative value is the
canonical execution group. Only the highest unresolved group projects executable source or child
tasks. A group remains current until every opportunity at that value is resolved or cancelled and
all parry, maneuver, hit-location, critical, damage, contest, review, and effect-commit child work
has completed.

The stable identity is `round:<round>:phase:<phase>:initiative:<value>`. Task descriptors retain
that group ID and value with their task, process, stage, execution-group, opportunity, and result
lineage. Reload derives the same group; undo reopens the group whose work was restored.

## Exact ties

All opportunities with the same initiative value are actionable together. Resolving one tied
opportunity does not serialize, cancel, or change the effective state of a sibling opportunity
unless an existing explicit interruption rule says so.

Calculations in group X include effects effective before X and exclude effects whose activation
boundary is X. This is an effect cutoff, not a participant-sheet snapshot. A tied participant's
already-open opportunity remains legal when a sibling consequence would remove a later action.

## Pending and active effects

Combat consequences are committed with their source event/result/opportunity and creating group.
A consequence created while its group remains open is `pending`: authoritative and visible, but
excluded from arithmetic. When that group is no longer current, the same fact projects as active
automatically. No GM review or activation button exists.

Singleton groups normally complete in the consequence-commit mutation, so their effects are active
before the next lower group opens. In a tie, an early consequence stays pending until all sibling
opportunities and child work close.

The cutoff is idempotent and projection-derived. Reload cannot duplicate an effect. Undoing group
completion makes its effects pending again; undoing the source consequence removes them through
existing source-command cleanup. Declaration and review modifiers active before resolution are not
pending.

An attack modifier validation is immutable for one revision, task, execution group, initiative
group, opportunity, and effect cutoff. When a group completes, the next group's descriptor and
validation are projected from the authoritative post-activation state; clients discard the old
signature instead of carrying it across the boundary. Accepted GM and Player mutations adopt that
post-mutation revision immediately, while polling remains the path for changes made by another
client.

## Presentation

Tracker live markers come only from current-group tasks. Tied participants may have simultaneous
markers; lower groups have none. Waiting players see the initiative currently resolving. A tied
participant who completed their work sees a recorded/waiting state.

Modifier panels separate pending rows from active arithmetic and state when pending rows become
effective. Concise calculations may show pending rows for context, but `Effective skill` and
`Total` use active modifiers only.

Damage-review effects and Offensive Parry Unbalanced effects retain initiative timing and source
lineage. The shared modifier projection applies the cutoff to General/Fatigue, Skill/OB, DB/Parry,
initiative, Dodge, Brawling, and maneuver consumers on the canonical contribution pipeline.
Existing operational action cancellation applies to lower groups; tied siblings are protected.

Offensive Parry Phase 2, Continued Contact maintenance/escape, controller-owned distance changes,
and future maneuvers remain deferred.
