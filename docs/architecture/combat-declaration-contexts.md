# Combat declaration contexts

## Ownership

A combat declaration has three independently owned selections:

1. the primary action and its primary-action context;
2. the secondary action and its secondary-action context;
3. movement and its movement intent.

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
declaration, snapshots, history, reload, recommit, and undo.

## Compatibility

The domain compatibility table relates primary action, secondary action, and the current movement
intent kinds. It validates only combinations represented by the table and returns precise
declaration errors. This first slice explicitly permits Parry with an open secondary action or
Observe Opponent. Existing combinations exposed before this slice retain their existing behavior.

The compatibility table does not create tasks or implement a secondary action's later mechanics.

## Future movement split

Current movement behavior remains unchanged, but future declarations need to distinguish two
orthogonal concepts.

Relative movement describes intent relative to a participant or engagement:

- maintain, close, or increase distance;
- follow or disengage;
- circle or flank.

Its context may carry a related participant ID, desired distance, or relative intent.

Absolute movement describes intent in encounter space:

- remain in place;
- move toward a location;
- retreat in a direction;
- move to cover;
- cross terrain.

Its context may carry a location, zone, coordinate, path, distance allowance, and terrain
constraints.

A future declaration may contain both relative and absolute movement. This document reserves that
distinction only; it does not change the current movement dropdown, distance process, terrain
validation, or combat formulas.
