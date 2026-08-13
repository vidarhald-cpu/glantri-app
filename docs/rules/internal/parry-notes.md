# Parry — Internal Notes

Audience: rules maintainers and implementers. Table instructions live in
[Player rules](../player/parry.md) and the [GM procedure](../gm/parry.md).

## Provenance

| Evidence                                                           | Parry coverage                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `docs/source/combat/merged_3968_3980.pdf`, PDF p. 2                | Percentage-style OB, DB, and Parry modifier model                                    |
| `docs/source/combat/merged_3968_3980.pdf`, PDF p. 6                | Full-round `Parere` action and source-only extensions                                |
| [Combat Action Rule Inventory](../combat-action-rule-inventory.md) | Visual extraction, classification, implementation status, and deferred source tables |
| [Source Mapping](../source-mapping.md)                             | Checked-in Combat source identity and mapping boundary                               |

The scanned source extraction has not completed the reconciliation required by
[issue #211](https://github.com/vidarhald-cpu/glantri-app/issues/211). This documentation split does
not approve a new interpretation or change executable behavior.

## Implemented Rule Mapping

| Concern          | Maintained behavior                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Declaration      | Untargeted primary action; no attack target, attack source, attack mode, or outgoing attack opportunity |
| Dodge input      | Stable `dodge` skill identity and its `effectiveSkillNumber`, the canonical total combat-skill XP value |
| Derived modifier | `floor(total Dodge / 5)` stored as a raw percentage input in the DB/Parry bucket                        |
| Stable source    | Modifier id `generated:parry:round:db-parry-percentage`; source rule `parry-dodge-one-fifth`            |
| Lifecycle        | Applies for the declared round; recommit replaces it; declaration undo and round expiry remove it       |
| Ordinary Parry   | `Parry/P base + workbook percentage adjustment + open-ended d20 total`; target number `21`              |
| Secondary action | Open secondary action or separately targeted Observe Opponent declaration                               |
| Movement         | Existing declaration behavior is unchanged; terrain and forced-movement rules are not automated         |

The declaration modifier is a raw percentage input, not a flat bonus. The canonical workbook helper
composes it with the other current percentage modifiers before the ordinary Parry roll is totaled.

## Implementation And Executable Evidence

| Responsibility                                        | Path                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Dodge-derived declaration calculation                 | `packages/rules-engine/src/combat/deriveParryPrimaryActionModifier.ts`                |
| Boundary examples for Dodge totals                    | `packages/rules-engine/src/combat/deriveParryPrimaryActionModifier.test.ts`           |
| Stable modifier identity and lifecycle row            | `packages/domain/src/encounter/combatActionModifiers.ts`                              |
| Declaration projection and committed-row preservation | `apps/web/src/features/combat-round-manager/combatDistanceModifierProjection.test.ts` |
| Canonical Dodge hydration at the API boundary         | `apps/api/src/routes/scenarios/encounterRoutes.conformance.test.ts`                   |
| Ordinary Parry total and target                       | `packages/rules-engine/src/combat/resolveCombatParry.ts`                              |
| Success boundary and percentage consumption           | `packages/rules-engine/src/combat/resolveCombatParry.test.ts`                         |

Representative executable examples:

- Dodge 17 derives a raw `+3%` declaration modifier.
- Parry base 9 plus roll total 12 succeeds exactly at 21.
- Parry base 9 plus roll total 11 fails at 20.
- Parry base 15 with raw `+3%` and roll total 1 resolves to a calculated adjustment of `+5` and a
  final total of 21.

## Deferred Source Rules And Ambiguities

The following remain deferred unless ordinary Combat mechanics already supply them:

- combining two parrying weapons or a weapon and shield beyond existing source composition;
- special minimum `+1` treatment for weak parrying weapons;
- prioritization among multiple simultaneous incoming attacks;
- front, back, and side restrictions;
- missile-specific Parry calculations;
- mandatory one-metre backward movement;
- blocked-retreat DB penalty;
- environmental space validation.

The source assumes sufficient room for defensive maneuvering. Until reconciliation supplies an
approved operational rule, terrain validation, forced backward movement, and the blocked-retreat
penalty remain documented gaps rather than new app behavior.

Keep the maneuvering-room assumption in rules documentation. Current Action and precise validation
messages remain the table-facing locations for actionable declaration guidance; do not add tactical
advice beneath the declaration controls.

The compatibility route [docs/rules/parry.md](../parry.md) remains in place for existing inbound
links.
