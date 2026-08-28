# C1 representative Critical fixtures

**Fixture version:** `c1-2026-08-28`

**Authority:** issue #377 and accepted #371 control-plane ruling comment `5452750034`

**Source:** `docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx`, SHA-256
`47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f`

This is the concise product-owner review table for the representative C1 content slice. The 34 keys
are the accepted investigation set retained because each supplies a distinct #377 coverage need or a
necessary cross-family comparison. “C1/C2” wording in the earlier #371 investigation did not grant a
second implementation slice: these are C1 fixtures only. The remaining 574 results, later GM review
UI, and all bulk/runtime activation remain unimplemented.

## Key-to-coverage map

| Key                                | #377 coverage need                                                                                      | Frozen interpretation                                                                                       | Exact source                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `sharp\|arm\|01`                   | Mild localized outcome; explicit drop                                                                   | Hand impaired for the instant and held item dropped; no damage floor                                        | `AppFacing_Crits!A2:X2`; `AppFacing_Effects!A2:AE3`           |
| `sharp\|arm\|12`                   | Severe Stun; external `3/4`; amputation; drop; First Aid; permanence boundary                           | Floor 5, Stun -8, conscious collapse, hand unusable, drop, external `3/4`; lasting loss is information only | `AppFacing_Crits!A13:X13`; `AppFacing_Effects!A36:AE42`       |
| `sharp\|head\|03`                  | Moderate numeric Stun and `parry_only`; rolled duration                                                 | Floor 1, Stun -4, parry only for one retained D4-round duration                                             | `AppFacing_Crits!A20:X20`; `AppFacing_Effects!A68:AE69`       |
| `sharp\|head\|04`                  | Required false-unconscious correction; explicit next-round onset                                        | Floor 2, no action next round, not unconscious                                                              | `AppFacing_Crits!A21:X21`; `AppFacing_Effects!A70:AE71`       |
| `sharp\|head\|10`                  | True unconsciousness; retained roll-once duration                                                       | Floor 3, unconscious for one retained D4-hour duration; generic treatment end GM-managed                    | `AppFacing_Crits!A27:X27`; `AppFacing_Effects!A88:AE89`       |
| `sharp\|chest\|04`                 | Required `no_action -> parry_only`; stance plus drop                                                    | Floor 2, impaired stance, shield parries only, explicit drop                                                | `AppFacing_Crits!A37:X37`; `AppFacing_Effects!A114:AE117`     |
| `sharp\|chest\|05`                 | Fall/prone separation                                                                                   | Floor 2; `fall_to_ground` operation, continuing prone state, later parry-only state                         | `AppFacing_Crits!A38:X38`; `AppFacing_Effects!A118:AE120`     |
| `sharp\|chest\|09`                 | True unconsciousness; internal `1/2`                                                                    | Floor 5, unconscious, internal `1/2`; generic treatment remains GM-managed                                  | `AppFacing_Crits!A42:X42`; `AppFacing_Effects!A127:AE129`     |
| `sharp\|lower_leg\|12`             | Corrected collapse; target-specific loss; calibrated external `1/2`                                     | Floor 4, Stun -8, collapse without unconsciousness, lower leg unusable, external `1/2`                      | `AppFacing_Crits!A93:X93`; `AppFacing_Effects!A287:AE291`     |
| `blunt\|arm\|12`                   | Required accepted example; equal/later timing; multi-effect; Surgery                                    | Floor 5, Stun -8, conscious collapse, hand unusable, drop, external `1/2`; First Aid then Surgery           | `AppFacing_Crits!A109:X109`; `AppFacing_Effects!A340:AE345`   |
| `blunt\|head\|04`                  | Cross-family false-unconscious correction                                                               | Floor 2, no action next round, not unconscious                                                              | `AppFacing_Crits!A117:X117`; `AppFacing_Effects!A367:AE368`   |
| `blunt\|head\|10`                  | Cross-family true unconsciousness                                                                       | Floor 3, unconscious for one retained D4-hour duration                                                      | `AppFacing_Crits!A123:X123`; `AppFacing_Effects!A384:AE385`   |
| `blunt\|chest\|04`                 | Cross-family `parry_only` correction                                                                    | Floor 2, impaired stance, shield parries only, explicit drop                                                | `AppFacing_Crits!A133:X133`; `AppFacing_Effects!A411:AE414`   |
| `blunt\|chest\|09`                 | Cross-family internal `1/2` and true unconsciousness                                                    | Floor 4, unconscious, internal `1/2`                                                                        | `AppFacing_Crits!A138:X138`; `AppFacing_Effects!A424:AE426`   |
| `blunt\|upper_leg\|12`             | Collapse correction; hidden internal `2/3`; staged care                                                 | Floor 5, Stun -8, conscious collapse, leg unusable, internal `2/3`; First Aid then Surgery                  | `AppFacing_Crits!A173:X173`; `AppFacing_Effects!A528:AE532`   |
| `blunt\|lower_leg\|12`             | Collapse correction; target-specific mobility; internal `1/2`                                           | Floor 4, Stun -4, conscious collapse, ankle unusable, internal `1/2`; First Aid then Surgery                | `AppFacing_Crits!A189:X189`; `AppFacing_Effects!A578:AE582`   |
| `pointed_weapons\|arm\|02`         | Required mild Stun; exact `1/8`; composite decomposition; First Aid                                     | Floor 3, Stun -1, impaired hand plus explicit drop, external `1/8`; bandage maps to First Aid               | `AppFacing_Crits!A515:X515`; `AppFacing_Effects!A1738:AE1742` |
| `pointed_weapons\|arm\|09`         | Moderate Stun; target/global correction; exact `1/3`; generic treatment negative                        | Floor 3, Stun -2, arm unusable without global collapse, external `1/3`; no Skill manufactured               | `AppFacing_Crits!A522:X522`; `AppFacing_Effects!A1771:AE1774` |
| `pointed_weapons\|arm\|10`         | Required severe example; exact `3/4`; impairment plus function loss                                     | Floor 5, Stun -4, general impairment, arm unusable, external `3/4`; First Aid control                       | `AppFacing_Crits!A523:X523`; `AppFacing_Effects!A1775:AE1778` |
| `pointed_weapons\|arm\|11`         | Composite cleanup; embedded weapon/removal; drop                                                        | Floor 3, Stun -4, hand unusable, external `1/3`, explicit drop; removal remains a separate GM-managed gate  | `AppFacing_Crits!A524:X524`; `AppFacing_Effects!A1779:AE1784` |
| `pointed_weapons\|head\|08`        | Severe Stun; calibrated external `1/2`; First Aid                                                       | Floor 4, Stun -8, impaired action/stance, external `1/2`; immediate field control                           | `AppFacing_Crits!A537:X537`; `AppFacing_Effects!A1840:AE1843` |
| `pointed_weapons\|head\|10`        | True unconsciousness; internal `2/3`; generic immediate care                                            | Floor 4, unconscious/no action, internal `2/3`; “immediate” creates no named Skill                          | `AppFacing_Crits!A539:X539`; `AppFacing_Effects!A1850:AE1853` |
| `pointed_weapons\|chest\|07`       | Impaired state; calibrated internal `1/2`; generic treatment                                            | Floor 5, Stun -4, impaired action, internal `1/2`; no Skill manufactured                                    | `AppFacing_Crits!A552:X552`; `AppFacing_Effects!A1901:AE1904` |
| `pointed_weapons\|chest\|12`       | Required complex example; collapse plus no-action; internal `2/3`; embedded/removal; mortality boundary | Floor 5, Stun -8, collapse and no action, internal `2/3`; stabilization only; rapidly dying is information  | `AppFacing_Crits!A557:X557`; `AppFacing_Effects!A1926:AE1931` |
| `pointed_weapons\|abdomen\|08`     | Embedded projectile/removal; internal `1/2`; generic care                                               | Floor 4, Stun -4, impaired action, internal `1/2`; controlled removal remains separate and GM-managed       | `AppFacing_Crits!A569:X569`; `AppFacing_Effects!A1976:AE1979` |
| `pointed_weapons\|upper_leg\|12`   | Severe multi-effect; external `3/4`; mortality info; First Aid                                          | Floor 6, Stun -8, collapse, leg/stance restriction, external `3/4`; rapidly dying is information            | `AppFacing_Crits!A589:X589`; `AppFacing_Effects!A2076:AE2081` |
| `pointed_weapons\|lower_leg\|16`   | Catastrophic addressable result; no-action; external `2/3`; permanence info                             | Floor 4, no action until staunched, leg unusable, external `2/3`; maiming/mortality prose is information    | `AppFacing_Crits!A609:X609`; `AppFacing_Effects!A2176:AE2180` |
| `arrows_bolts\|chest\|11`          | Specialized family; embedded missile; calibrated internal `2/3`; GM-managed extraction                  | Floor 5, collapse/no action, internal `2/3`; extraction and legacy consciousness check remain GM-managed    | `AppFacing_Crits!A332:X332`; `AppFacing_Effects!A1037:AE1042` |
| `firearms\|lower_leg\|12`          | Specialized family; collapse; calibrated external `1/2`; Surgery                                        | Floor 4, Stun -8, collapse, ankle unusable, external `1/2`; First Aid then Surgery                          | `AppFacing_Crits!A477:X477`; `AppFacing_Effects!A1598:AE1602` |
| `falling_crushing\|whole_body\|10` | Specialized family; paired retained D4/12 rates; generic treatment; permanence boundary                 | Floor 4, Stun -8, impaired/crawl-only, independent external and internal D4/12 sources                      | `AppFacing_Crits!A491:X491`; `AppFacing_Effects!A1643:AE1649` |
| `falling_crushing\|whole_body\|12` | Specialized family; paired retained D6/12 rates; mortality info; Surgery                                | Floor 4, Stun -8, collapse/no action, independent external and internal D6/12; mortality inert              | `AppFacing_Crits!A493:X493`; `AppFacing_Effects!A1657:AE1662` |
| `fire_energy\|whole_body\|06`      | Required specialized restriction; prone without fall; non-Bleed burn                                    | Floor 4, only rolling/reaching water allowed, prone while extinguishing; no ordinary Bleed                  | `AppFacing_Crits!A503:X503`; `AppFacing_Effects!A1692:AE1696` |
| `fire_energy\|whole_body\|09`      | Specialized no-action; conditional consciousness unresolved; Medicine candidate                         | Floor 4, no action; legacy consciousness and permanence claims inert; burn care maps to Medicine            | `AppFacing_Crits!A506:X506`; `AppFacing_Effects!A1704:AE1709` |
| `fire_energy\|whole_body\|10`      | Specialized GM-managed/unresolved action state; generic treatment negative                              | Floor 4; no active unconscious/global action state; burn/shock and legacy claims are information            | `AppFacing_Crits!A507:X507`; `AppFacing_Effects!A1710:AE1713` |

## Mechanical review anchors

- `blunt|arm|12` accepted at initiative 4 does not affect an equal initiative-4 action and does
  affect an unresolved incompatible initiative-5 action. `sharp|head|04` begins next round and does
  not affect either current-round action.
- Independent `pointed_weapons|arm|02` Stun -1 and `blunt|arm|12` Stun -8 add to -9 on each accepted
  Stun channel while both are active.
- External `pointed_weapons|arm|09` at `1/3` plus internal `sharp|chest|09` at `1/2` accrue as exact
  `5/6` per tick before whole-HP application; exact remainder is carried.
- `falling_crushing|whole_body|10` rolls each external/internal D4 numerator once and stores it over
  denominator 12. `whole_body|12` does the same with D6/12.
- `pointed_weapons|arm|09` proves generic `until treated` text creates no Skill candidate.
  `fire_energy|whole_body|09` supplies the Medicine candidate, and `blunt|arm|12` supplies staged
  First Aid then Surgery.
- Mortality/permanence/recovery facts are mechanically inactive in every fixture.

## Scope statement

No fixture is wired into Combat lookup, proposal acceptance, `combatRoundManager.ts`, persistence,
database state, or UI. No source workbook/generated 608-row payload is changed. The representative
fixture module is an inert content/golden surface for product-owner C1 review and later separately
authorized consumers.
