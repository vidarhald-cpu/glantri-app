# Combat history UI

`CombatTracker` is inspection-only and renders a projected `CombatTrackerModel`; it does not read combat state, call APIs, or advance combat. GM, Player, and GM Player receive the same structural tracker and Combat Log components from their respective sanitized history projections. The component owns bounded horizontal positioning of the canonical current cell; history selection disables that live-follow behavior.

The tracker is the combat board. Its live marker comes from the revision-bound
`canonicalOperationalPosition`, not from the viewer's first visible/actionable task.
When task ownership is private or ownerless, the current step header remains the safe
board marker. A selected historical cell is an independent overlay; `Current task`
clears it and repositions the shared live marker.

The amber marker represents the canonical board position. The green outline is the
inspection cursor and names the exact panel context. Auto-follow selects a viewer-safe
cell at the canonical step; explicit history selection moves only the green cursor.
Active-round marker evidence is stage-gated, so compatibility events or empty future
work cannot mark a later cell complete before the canonical board reaches it.

Projected `round_boundary` events remain readable compatibility/provenance evidence,
but generic boundary advancement is workflow history and is filtered from participant
Result lists. Combat Log owns concise human-visible round-transition narration.

Combat Log selection retains its revision-bound presentation target for highlighting. It does not
infer a tracker cell or retarget the inspector because a result envelope does not yet carry one
unambiguous tracker-selection identity. Immutable step snapshots remain the source for historical
inspector panels.
