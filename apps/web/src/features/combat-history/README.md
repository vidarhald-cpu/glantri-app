# Combat history UI

`CombatTracker` is inspection-only and renders a projected `CombatTrackerModel`; it does not read combat state, call APIs, or advance combat. GM, Player, and GM Player receive the same structural tracker and Combat Log components from their respective sanitized history projections.

Live `CombatEventResultList` rendering follows the Combat Log's revision-bound presentation target.
It has no independent latest-result fallback. Immutable step snapshots remain the source for the
separate historical inspector panels.
