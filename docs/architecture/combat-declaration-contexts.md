# Combat declaration contexts

## Ownership

A combat declaration has three independently owned selections:

1. the primary action and its primary-action context;
2. the secondary action and its secondary-action context;
3. movement and its movement intent.

These are the three parts of the one player-facing declaration system. Relative
position, movement direction, facing, and action-specific fields are contexts within
that system; they do not authorize a parallel generic-action or task workflow. The
canonical product rules are recorded in
[Combat Declarations](../rules/combat-declarations.md).

Targets belong to the action that uses them. A primary attack target, an Offensive Parry prepared
opponent, and an Observe Opponent target are distinct canonical facts. Changing one must not
retarget another. Current targeted secondary-action support is deliberately narrow:

```text
secondaryActionContext:
  action: observe_opponent
  targetParticipantId: <encounter participant ID>
```

Observe Opponent's selector belongs in Phase 1, not in the general action-selector panel and not in
an attack-owned target field. The acting participant is ineligible. The context persists with the
declaration, snapshots, history, reload, recommit, and undo. Editable scenario/character aliases
are normalized against the canonical round roster at the request boundary: an exact encounter
participant ID wins, unique legacy aliases remain compatible, and ambiguous aliases fail closed.

## Compatibility

The domain compatibility table relates primary action, secondary action, and the current movement
intent kinds. It validates only combinations represented by the table and returns precise
declaration errors. This first slice explicitly permits Parry with an open secondary action or
Observe Opponent. Existing combinations exposed before this slice retain their existing behavior.

The compatibility table does not create tasks or implement a secondary action's later mechanics.

## Movement contexts

Movement intent distinguishes two orthogonal concepts.

Relative movement describes intent relative to a participant or engagement:

- keep distance to a specified person;
- adjust distance to a specified target; and
- hold formation.

Its context may carry a related participant ID, desired distance, or relative intent.

Absolute movement uses the approved eight-direction vocabulary:

- forward;
- forward/right;
- right;
- backward/right;
- backward;
- backward/left;
- left; and
- forward/left.

It may also be left blank. Facing is independently declared with the same directional
vocabulary.

A declaration may contain both relative and absolute movement. They may conflict, and
the declaration remains permissible because feasibility is decided during resolution
or GM adjudication. Generic `How` and `Expected time` fields are not part of the
approved player declaration. Coordinates, paths, terrain constraints, and movement
feasibility require separately approved rules rather than being inferred from this
context model.
