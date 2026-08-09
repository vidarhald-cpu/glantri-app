# Combat history UI

`CombatTracker` is inspection-only and renders a projected `CombatTrackerModel`; it does not read combat state, call APIs, or advance combat. GM, Player, and GM Player receive the same structural tracker and Combat Log components from their respective sanitized history projections. The component owns bounded horizontal positioning of the canonical current cell; history selection disables that live-follow behavior.

The tracker is the combat board. Its live marker comes from the revision-bound
`canonicalOperationalPosition`, not from the viewer's first visible/actionable task.
When task ownership is private or ownerless, the current step header remains the safe
board marker. A selected historical cell is an independent overlay; `Current task`
clears it and repositions the shared live marker.

Combat Log selection retains its revision-bound presentation target for highlighting. It does not
infer a tracker cell or retarget the inspector because a result envelope does not yet carry one
unambiguous tracker-selection identity. Immutable step snapshots remain the source for historical
inspector panels.
