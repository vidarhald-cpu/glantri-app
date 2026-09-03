# Rule decision 0001: C1 Critical injury and consequence recalibration

- Status: approved
- Date: 2026-09-03 (recovered); original approval predates repository recovery
- Product owner: Vidar Hald
- Related issues/PRs: recovered GitHub #393; Forgejo #5; follow-up Forgejo #4 (#392)
- Supersedes: pre-#393 calibration and prose assumptions for the 34 accepted C1 representative fixtures
- Superseded by: none

## Question

How should the 34 accepted C1 Critical fixtures describe and calibrate injury, Stun, action restrictions, unconsciousness, Bleed, falls, function loss, and the three Fire/Energy outcomes without inventing mechanics or scripting a victim's future turns?

## Evidence and provenance

### Repository-derived evidence

- `docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx`, SHA-256 `47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f`.
- `docs/rules/combat-critical-effects.md`.
- `docs/audits/c1-critical-fixtures.md`, fixture version `c1-2026-08-28`.
- `packages/rules-engine/src/encounters/representativeCriticalFixtures.ts` and the generated Critical table/provenance files.
- The integrated #387 runtime foundation at accepted head `15dabcc422f63a8603a9d673c06443004e91744f`.

These sources prove the pre-recalibration fixture surface, runtime vocabulary, source mapping, and implemented behavior. They do not prove the later #393 product rulings.

### Chat-recovered decision evidence

The former architecture/control-plane conversation and the read-only #393 design lane preserve the product owner's partial acceptance and later three-entry Fire/Energy acceptance. R3C records those outcomes here because GitHub comments were lost as an operational authority source. This record does not present the recovered chat as workbook or code evidence.

## Conflict or limitation

The pre-#393 fixtures frequently used extreme Stun, global action locks, automatic unconsciousness, and future-turn instructions as severity shorthand even when the concrete injury did not make those consequences unavoidable. Some internal-Bleed rates were too fast relative to comparable external wounds. The earlier Fire/Energy rates were internally inverted under three-second rounds, and burn/shock loss does not fit the existing Bleed lifecycle.

The 34-fixture rewrite was a content/design outcome. Canonical fixture code, generated data, workbook data, and runtime behavior have not yet been updated to implement it.

## Ruling

### Injury text and player agency

- Lead with the concrete physical injury or event. Consequence text must remain concise and usable as a GM-facing suggestion, not mandatory fiction.
- Author the injury and unavoidable immediate or physiological consequences. Do not script later player behavior, tactical choices, or roleplay.
- Remove global `no_action`, scripted collapse/crawl, timed forced prone, and similar action locks unless the anatomy or physiology itself makes action impossible.
- Automatic unconsciousness is exceptional and is primarily justified by direct head trauma or other specific physiology. Severe body wounds normally use concrete impairment, collapse, Stun, Bleed, breathing effects, or existing checks while preserving agency where physiology permits.

### Severity envelope

- Indexes 1–4: minor/moderate.
- Indexes 5–8: serious, while usually preserving meaningful agency.
- Indexes 9–12: very severe and possibly lethal.
- Indexes 13–14: catastrophic.
- Indexes 15–16: immediate-death territory mainly for sufficiently destructive head, torso, or whole-body outcomes; catastrophic limb injury need not mean instant death.

This is a calibration envelope, not authority to force identical consequences across every family and location. Source-grounded minimum total damage floors remain unchanged unless a later ruling explicitly changes them.

### Stun and action state

- Numeric Stun uses the existing `-1 / -2 / -4 / -8` ladder.
- `-4` is the ordinary meaningful baseline for a materially stunning injury.
- `-8` is rare, extreme, and near-incapacitating.
- Numeric Stun and action state remain distinct. Stun is not unconsciousness and is not a reason by itself to manufacture a global action lock.
- At most one Stun atom belongs to one Critical. Existing rules for channels, independent-source addition, timing, and duration remain unchanged.

### Bleed

- Internal and external Bleed remain distinct.
- Internal Bleed is generally slower than comparable exposed external Bleed because it is contained, while being harder to detect, localize, access, and control.
- A contained/moderate internal wound may calibrate around `1/4 HP/round`; a very severe cavity or head internal wound may calibrate around `1/3 HP/round`; an exposed/open major-vessel external wound may remain `1/2–3/4 HP/round` when anatomy supports it.
- This is a calibration principle, not a rigid universal table. Concrete anatomy may justify a documented exception.

### Fall, prone, and function loss

- Use immediate `fall_to_ground` when the injury directly causes a fall.
- Record current `prone` as the resulting physical position.
- Use localized `function_unusable` where anatomy warrants it.
- Do not author a future prone duration merely because the victim fell. Standing, crawling, rolling, shielding, escaping, or other later choices remain gameplay unless physically impossible.

### Narrow `parry_only` exceptions

Retain exactly the two source-anchored chest-index-04 `parry_only` cases—Sharp/Chest/04 and Blunt/Chest/04—only with concrete chest, pectoral, or shoulder-muscle injury text explaining why offensive weapon use is temporarily prevented while defensive shield movement remains possible. This is not a reusable low-index action-lock pattern.

### Fire/Energy content

The following content intent is approved. Each result retains a minimum total damage floor of 4 HP and its recurring loss begins after one full three-second interval.

| Fixture | Concrete injury/content intent | Stun and state | Non-Bleed content rate | HP/min | Ends when |
| --- | --- | --- | --- | ---: | --- |
| `fire_energy|whole_body|06` | Clothing or fur burns across the body; the victim remains able to act to fight the flames | `-4`; no general action lock | `1/4 HP/round` | 5 | Flames are extinguished |
| `fire_energy|whole_body|09` | Broad deep burns produce severe systemic shock | `-8`; conscious and actionable | `1/3 HP/round` | 6 2/3 | Cooling and burn-shock stabilization |
| `fire_energy|whole_body|10` | Widespread burns include inhalation injury and impaired breathing | `-8` plus concrete breathing impairment | `1/2 HP/round` | 10 | Airway and circulatory stabilization |

Burn/shock loss is not Bleed. These rates are approved content semantics only.

## Explicit runtime boundary

Executable non-Bleed `periodic_loss` is **not authorized**. Neither this decision nor the accepted Fire/Energy content authorizes a new atom, lifecycle, persistence path, round tick, treatment/control mechanic, UI, database change, or automatic HP loss.

Any executable non-Bleed periodic-loss capability requires a separate source-linked design, its own task contract, explicit product/control-plane authorization, implementation, and independent QA. Until then, the Fire/Energy recurring-loss content remains non-executable content intent.

## Reasoning

The ruling aligns consequence severity with concrete anatomy, keeps Stun and loss of agency conceptually separate, and preserves player choice unless physiology removes it. The internal-Bleed ladder better reflects the trade-off between slower contained loss and more difficult detection/treatment. The Fire/Energy progression is monotonic under three-second rounds and no longer uses arbitrary action locks to compensate for inconsistent rates.

## Executable examples

These examples become test authority only in a separately authorized implementation task:

1. A meaningful non-incapacitating wound uses Stun `-4` without automatically adding `no_action`.
2. A victim physically knocked down receives one immediate fall plus current prone state; no later turns are scripted.
3. Sharp/Chest/04 may retain `parry_only` only when the concrete pectoral/shoulder injury explains the narrow restriction.
4. Fire/Energy/06, /09, and /10 retain the content rates above but produce no automatic non-Bleed periodic HP tick until a separate runtime is authorized.

## Implementation consequences

- Forgejo #4 (#392) must not use its superseded pre-#393 package unchanged. Control plane must decide whether to refresh, partially reuse, or replace it.
- Forgejo #3 (#391) may consume accepted content only through its existing dependency gate and must not manufacture unsupported runtime semantics.
- The canonical 34-fixture module, generated table, workbook, rules text, and tests remain unchanged by this decision record.
- Mortality, death clocks, permanent loss, recovery, treatment execution, new checks, and non-Bleed periodic runtime remain outside this ruling unless already supported by separate accepted authority.

## Verification and traceability

- Recovered operational crosswalk: `docs/recovery/2026-09-03-forgejo-operational-portfolio-crosswalk.md`.
- Forgejo issue #5 is the recovered #393 decision record and must distinguish this approved content from unimplemented code/runtime.
- Any activation task must cite this record, the exact workbook/fixture evidence, the refreshed canonical `dev` SHA, and independent QA evidence.
