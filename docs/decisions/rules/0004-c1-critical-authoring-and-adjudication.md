# Rule decision 0004: C1 Critical authoring and GM adjudication

- Status: approved
- Date: 2026-09-06
- Product owner: Vidar Hald
- Related issues: Forgejo #51; recovered Forgejo #3–#6; former GitHub #391–#394
- Complements: [decision 0001](./0001-c1-critical-injury-recalibration.md)
- Supersedes: ambiguous pre-recovery C1 atom and GM-review assumptions
- Superseded by: [decision 0005](./0005-critical-effect-semantics-and-timing.md) for named Stunned/Dazed values, additive source stacking, fixed-round duration semantics, future Bleed/Health cadence, and source-specific treatment dependencies; all other authority remains in force

## Question

What is the durable authoring and adjudication contract for the accepted C1 representative
Criticals, including exact atom kinds, GM authority, Stun and Bleed arithmetic, treatment control,
manual adjustments, presentation, persistence, and the boundary around non-executable content?

## Evidence and limitation

This ruling recovers the accepted #388/#391 review design, the accepted #393 content rulings now
recorded in [decision 0001](./0001-c1-critical-injury-recalibration.md), the integrated #387 runtime
foundation, and the current Combat product contracts. The exact five post-#393 payloads recovered by
Forgejo #51 are frozen separately in
[the five-key evidence artifact](../../recovery/2026-09-06-c1-five-key-post-393-payloads.json) and
[its comparison record](../../recovery/2026-09-06-c1-five-key-freeze-and-staging.md).

This is a documentation and recovery ruling. It does not change runtime behavior, schemas,
databases, fixtures, adapters, or Combat Manager.

> **Successor boundary:** [Decision 0005](./0005-critical-effect-semantics-and-timing.md)
> defines the approved target effect model. In particular, Stunned is now one named General `-4`
> effect, Dazed is a separate General `-2` effect, and future fixed durations do not consume the
> creation round. The older C1 rules below remain historical/current implementation evidence until
> separately authorized reconciliation; they do not override the successor target.

## Canonical authoring model

An accepted C1 payload has exactly six available atom kinds:

1. `damage_floor` — a minimum-total-damage constraint, never a second damage stream;
2. `modifier` — a numeric effect on named calculation channels;
3. `periodic_loss` — a typed, exact-rate loss source with its own lifecycle;
4. `condition` — a durable state or restriction on a structured target;
5. `operation` — a one-time command consequence such as dropping a held item; and
6. `information` — guidance or deferred facts with `mechanicallyActive: false`.

The title and narrative are not mechanics. They explain the injury but cannot create a modifier,
condition, operation, target dependency, duration, treatment gate, or periodic loss. A condition is
not an operation: `prone` does not cause `fall_to_ground`, `function_unusable` does not cause
`drop_held_item`, and `unconscious` does not imply either unless separate atoms say so.

Every mechanically active atom has a structured target. The target identifies the combatant,
anatomical part, body function, held item, action class, or other approved dependency. Labels and
prose cannot stand in for that target. Operational restriction follows only from the typed atom and
the action's canonical dependency metadata.

## Authority and provenance

- The accepted canonical C1 atoms are immutable mechanics authority. A GM review creates an
  instance-level delta; it never rewrites the canonical payload.
- All 34 accepted representative identities keep stable `family|location|NN` keys. Only the five
  keys frozen by Forgejo #51 are authorized for the next staged work. The other 29 representative
  keys are accepted content but remain inactive pending a separate authorization. The other 574
  catalogue rows remain legacy.
- A manual adjustment co-commits independently with provenance `manual`. It is not a C1 atom
  override, is not C1 adjudication telemetry, and must not be collapsed into or derived from the
  canonical payload.
- There is one structured operational adapter path from accepted atoms plus allowed GM delta to
  committed consequences. Canonical, legacy, and manual inputs must not create parallel derivation
  paths that duplicate a consequence.

## Exact GM adjudication authority

The following authority describes the accepted historical/current C1 payload. Decision 0005
supersedes its variable-Stun choice for future catalogue authoring; no current payload is changed by
this documentation update.

For one proposed Critical instance, the GM may:

- suppress a `modifier` Stun atom;
- suppress a `condition` atom;
- suppress an `operation` atom;
- suppress an ordinary-Bleed `periodic_loss` atom;
- change a Stun value only to a server-permitted member of `-1`, `-2`, `-4`, or `-8`;
- edit the instance title and narrative; and
- record an optional GM-only reason.

The GM may not:

- suppress or alter `damage_floor`;
- add, duplicate, retype, reorder, or retarget atoms;
- change an atom's canonical identity, source Critical key, source-effect identity, target,
  function, onset, timing, or modifier channels;
- change Bleed type, exact rate, arithmetic, source identity, retained rate roll, or lifecycle
  vocabulary;
- change a fixed duration, a roll formula, a retained roll result, or a duration's unit;
- turn one condition or operation into another, or use prose to manufacture a new mechanic; or
- treat a manual adjustment as if it were a canonical rejection or edit.

If an atom is inappropriate for the instance, the permitted action is suppression. It is never
transformation into a different atom. Suppressed atoms and optional reasons are immutable GM-only
audit facts. An unchanged canonical proposal emits no override telemetry. A prose-only edit is not
mechanical override telemetry. Player-safe projections show accepted current consequences, not
suppressed atoms or private reasons.

## Historical C1 Stun contract — target superseded

Numeric Stun has exactly four permitted values: `-1`, `-2`, `-4`, and `-8`. One Stun atom projects
the same value to all three channels:

- `ob_skill` — Offensive Bonus and Skill;
- `db_parry` — Defensive Bonus and Parry; and
- `initiative`.

Separate Stun sources add. There is no generic cap. Each source retains identity, duration, onset,
and independent resolution. Numeric Stun is not unconsciousness and does not manufacture collapse,
no-action, parry-only, or function loss. Those require their own typed conditions or operations.

This section records the existing C1 contract only. Decision 0005 supersedes it for future target
authoring: Stunned is General `-4`, Dazed is General `-2`, and any other historical numeric row must
be reconciled deliberately rather than retaining the Stunned name automatically.

## Ordinary Bleed contract

Each ordinary external or internal Bleed atom is a separate exact rational source. At SU, all active
rates for one participant add as rationals before any whole HP is applied. The aggregate keeps its
exact reduced remainder for the next interval. A variable rate rolls once when the Critical is
accepted and retains that numerator. A source created during a round first accrues at SU of the
following round, after one full three-second interval; it never ticks in its creation round.

The authoring lifecycles are distinct:

- external: `active -> controlled -> staunched -> resolved`;
- internal: `active -> stabilised -> resolved`.

`controlled` reduces but does not erase an external source. `staunched` records zero continuing
external loss while the wound remains separately unresolved. Internal Bleed never inherits pressure,
partial control, self-staunch, or external treatment behavior. The existing #387 persistence uses
compatibility state names `partial` and `staunched_zero`; future work may map those stored names to
the authoring terms `controlled` and `staunched` through the single adapter, but Forgejo #51 does not
authorize a migration or runtime edit.

## Minimal treatment control and presentation

Treatment control is limited to existing, authored ordinary-Bleed state transitions. It does not
invent medical rules, checks, difficulties, equipment requirements, timing, assistance, healing,
recovery, or mortality behavior.

The GM uses the existing Damage/effects review in **Current Action** to select an allowed existing
transition for a named Bleed source and commit it with the current action. **Results** shows the
accepted current consequence. **Combat Log/history** records the immutable command, source,
transition, actor, and allowed adjudication delta. Existing persistence/reload and command-backed
undo/history restore the prior state; there is no second control owner, mutable history state, or new
Critical/medical panel.

Manual damage or effect rows may be committed in the same action as independent `manual`
provenance. They do not replace, redefine, or report telemetry for a C1 atom.

## Injury, severity, roleplay, and unconsciousness

[Decision 0001](./0001-c1-critical-injury-recalibration.md) remains authoritative for the severity
envelope and injury language:

- lead with concrete anatomy or physiology and preserve meaningful agency where physiology permits;
- severity guides calibration but does not automatically create Stun, a global lock, mortality, or
  unconsciousness;
- authored consequences do not script later movement, posture, tactics, or roleplay;
- automatic unconsciousness is exceptional and requires a specific physiological basis, commonly
  direct head trauma; and
- falls, current prone state, localized function loss, and global action restrictions remain
  separate typed facts.

Mortality, death clocks, permanent loss, recovery, hidden diagnosis, and unsupported checks remain
`information` unless a separately accepted rule activates them.

## Fire/Energy evidence and non-executable boundary

Decision 0001 accepts this content evidence:

| Key                                              | Floor | Stun/state                     | Non-Bleed content rate | Ends when                            |
| ------------------------------------------------ | ----: | ------------------------------ | ---------------------: | ------------------------------------ |
| <code>fire_energy&#124;whole_body&#124;06</code> |  4 HP | `-4`; no general action lock   |         `1/4 HP/round` | Flames are extinguished              |
| <code>fire_energy&#124;whole_body&#124;09</code> |  4 HP | `-8`; conscious and actionable |         `1/3 HP/round` | Cooling and burn-shock stabilization |
| <code>fire_energy&#124;whole_body&#124;10</code> |  4 HP | `-8` plus breathing impairment |         `1/2 HP/round` | Airway and circulatory stabilization |

Burn/shock loss is not Bleed. No non-Bleed `periodic_loss` is executable or authorized. These three
rows remain content evidence only and are outside the five-key implementation slice. Enabling them
requires a separate design, task contract, product authorization, implementation, and independent
QA.

## Implementation and release boundary

This ruling prepares future Forgejo #3/#391 and #4/#392 work only. It does not dispatch either task,
activate a fixture, enable periodic loss, change Combat Manager, grant QA authority, permit a merge,
or grant `main`, Azure, deployment, or release authority.
