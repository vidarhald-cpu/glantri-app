# Combat history UI

`CombatTracker` is inspection-only and renders a projected `CombatTrackerModel`; it does not read combat state, call APIs, or advance combat. The GM currently builds the model from full combat history. A future Player tracker can reuse the same component with the player-safe projection.

Chronological Action Result rendering remains separate in `CombatEventResultList`. Immutable step snapshots remain the source for the other historical panels.
