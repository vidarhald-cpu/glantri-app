# Architecture decision 0009: GM-reversible automation

- Status: approved product and architecture principle; implementation remains separately authorized
- Date: 2026-10-06
- Decision owner: Product Owner / control plane
- Functional areas: Combat engine; Equipment and physical state; GM adjudication; Scenario and Character state editing
- Related issues/PRs: Forgejo #523, #518, #517
- Supersedes: none
- Superseded by: none

## Context

Glantri automates calculation and bookkeeping, but the rules it implements leave
adjudication to the GM. Without a recorded principle, automation can drift into
enforcing rules beyond the purpose of the application.

The Product Owner stated the purpose of this principle, as relayed by the control
plane, as: "so that we don't try to enforce 'rules' we find in the game beyond what
is the purpose of the app."

Principles 1 and 2 below were relayed by the Product Owner on 2026-10-06. This record
adds no rule, mechanism, or value to them.

## Decision

### Principle 1 — GM-reversible automation

Glantri should automate mechanical calculations, bookkeeping and ordinary
consequences where the applicable interpretation is clear in the great majority of
cases.

Automation does not transfer adjudicative authority from the GM.

For consequential state changes, the GM must be able to:

- inspect the proposed consequence before it is committed where review is useful;
- override, alter or suppress it;
- correct/reverse the resulting game state afterwards through ordinary GM editing.

Automated consequential changes should retain sufficient provenance/prior-state
information to make correction practical.

Where a consequence is materially context-sensitive or ambiguous, Glantri should
surface it for GM adjudication rather than autonomously deciding it.

Treat this like a physical tabletop: the application may move the pieces
automatically, but the GM can always say "that was wrong" and move them back.

### Principle 2 — equipment action durations (corollary of Principle 1)

`getRetrievalRounds` may legitimately represent and track a duration. Do not reject
it merely because the GM controls adjudication. Determine whether the current values
are approved game rules or provisional implementation values. If approved, the app
may track/count them; completion of the consequential equipment transition remains
subject to the normal GM review/commit model where context may matter.

The app may calculate and track how long draw/stow/retrieve/etc. should take once
those rules are defined. It should automate the bookkeeping, while leaving
meaningful contextual adjudication and progression under GM control.

#### Established fact: the current durations are not approved rules

The durations are not yet defined as game rules. The current values
`equipped 0 / on_person 1 / backpack 10` are **provisional implementation values,
not approved rules**. This record does not define, approve, or suggest any duration.

Evidence (traced by the Orchestrator; Forgejo #518 comment 12981):

- the code carries no citation for the values;
- their provenance is one commit titled "Add initial equipment domain types and
  validation";
- the approved rules express access qualitatively:
  [`equipment-encumbrance-calculations.md`](../../rules/equipment-encumbrance-calculations.md)
  ratifies `Backpack | 0.75 | Slow access`, and
  [`combat-attack-and-defense.md`](../../rules/combat-attack-and-defense.md) says a
  backpack "is slower to access";
- [`combat-action-rule-inventory.md`](../../rules/combat-action-rule-inventory.md)
  (Vanlige handlinger, PDF p. 10) states that the GM decides how long an ordinary
  action takes;
- the carry factors (`1.0` / `0.75` / `0.0`) are ratified numerically; the round
  counts are not.

## Alternatives considered

None recorded. This record records a ratified principle and does not select among
alternatives.

## Consequences

- The Product Owner's ruling applies to automation of consequential state changes,
  including equipment action durations once those rules are defined.
- Until durations are defined as game rules, the provisional values carry no rule
  authority.
- This record does not change the authority already settled elsewhere. Item
  authority and the rule against parallel canonical copies remain as stated in
  [`0004-canonical-field-equipment-v1.md`](0004-canonical-field-equipment-v1.md);
  information authority and projection remain as stated in
  [`information-authority-and-projection.md`](../../architecture/information-authority-and-projection.md);
  and Item interaction authority remains the settled M7 in
  [`combat-panel-contract.md`](../../product/combat-panel-contract.md) §12.14.

## Integration and verification

Documentation only. No Builder, independent QA, schema, runtime, database,
migration, or release action is authorized by this record. Implementation work
that applies the principle requires its own authorization.

## Release-boundary impact

None. Architecture approval never grants production authority.
