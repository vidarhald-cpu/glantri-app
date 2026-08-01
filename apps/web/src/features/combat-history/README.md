# Combat history UI

`CombatTracker` is inspection-only and renders a projected `CombatTrackerModel`; it does not read combat state, call APIs, or advance combat. GM, Player, and GM Player receive the same structural tracker and Combat Log components from their respective sanitized history projections. The component owns bounded horizontal positioning of the canonical current cell; history selection disables that live-follow behavior.

Combat Log selection retains its revision-bound presentation target for highlighting. It does not
infer a tracker cell or retarget the inspector because a result envelope does not yet carry one
unambiguous tracker-selection identity. Immutable step snapshots remain the source for historical
inspector panels.
