# Combat history UI

`CombatTracker` is inspection-only and renders a projected `CombatTrackerModel`; it does not read combat state, call APIs, or advance combat. The GM currently builds the model from full combat history. A future Player tracker can reuse the same component with the player-safe projection.

Live `CombatEventResultList` rendering follows the Combat Log's revision-bound presentation target.
It has no independent latest-result fallback. Immutable step snapshots remain the source for the
separate historical inspector panels.
