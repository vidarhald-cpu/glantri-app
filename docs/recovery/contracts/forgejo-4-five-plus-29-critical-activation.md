# Forgejo #4 future contract: five-key activation, then remaining 29

- Recovered predecessor: GitHub #392
- Superseded premise: the former broad thirteen-key activation package
- Lifecycle after Forgejo #51: Ready, inactive, unassigned, not authorized
- Contract owner: Product Owner
- Execution owner: none until explicit authorization and visible dispatch
- Reference baseline: `dev@87af54c054b99d29f6d8b13d7b84faedfec6717b`
- Accepted execution baseline: unset; each stage requires a refreshed exact live `dev` SHA

## Outcome and staged scope

Replace the obsolete thirteen-key package with two explicit stages:

### Stage 1 — exact five keys

Activate exactly the accepted payloads frozen by Forgejo #51:

1. `pointed_weapons|arm|02`
2. `blunt|arm|12`
3. `pointed_weapons|chest|07`
4. `sharp|head|10`
5. `sharp|chest|04`

Stage 1 updates canonical fixture content and the narrow supporting executable assertions needed to
make those five payloads authoritative at runtime. It must use
[the exact freeze](../2026-09-06-c1-five-key-post-393-payloads.json) and
[decision 0004](../../decisions/rules/0004-c1-critical-authoring-and-adjudication.md); it must not
substitute keys or reactivate superseded pre-#393 values.

### Stage 2 — remaining 29 keys

Stage 2 may address the other 29 accepted representative C1 keys only after Stage 1 is independently
accepted and integrated. It requires a separately refreshed, self-contained per-key evidence package,
exact live `dev` baseline, Product Owner authorization, visible Builder dispatch, and independent QA.

Stage 2 is currently unauthorized. It is not made Ready for implementation by Stage 1, this issue
body, or the existence of accepted #393 prose.

## Entry and dependency gates

This issue is Ready for future authorization but neither stage is authorized to start. Stage 1 may
be dispatched only after Forgejo #51 is accepted and integrated and the issue names the exact new
`dev` SHA. The Product Owner must confirm hotspot availability, move the issue through `Authorized`
to `Active`, assign the visible Builder, and record task/branch evidence.

Stage 2 remains dependency-gated and unauthorized after Stage 1 dispatch. It needs its own contract
refresh and authorization after Stage 1 acceptance and integration. Builder and independent QA are
separate visible tasks. Neither role may merge.

## Stage 1 behavior and data contract

- Preserve stable `family|location|NN` identities and exact source-effect provenance.
- Replace only the five canonical names, narratives, and changed atoms shown in the freeze.
- Keep title/narrative separate from mechanics and encode active consequences only as the six kinds:
  `damage_floor`, `modifier`, `periodic_loss`, `condition`, `operation`, and `information`.
- Keep structured targets, condition/operation separation, exact Stun channels and addition, exact
  rational ordinary-Bleed arithmetic, first-tick timing, independent source identity, and separate
  external/internal lifecycles.
- Preserve `pointed_weapons|arm|02`, `sharp|head|10`, and `sharp|chest|04` mechanics exactly while
  updating accepted title/narrative.
- For `blunt|arm|12`, change Stun from `-8` to `-4` for exactly one full round and remove only the
  whole-body collapse; retain floor `5`, hand function loss, drop, external `1/2 HP/round`, and
  information.
- For `pointed_weapons|chest|07`, set internal Bleed to exactly `1/4 HP/round`; retain floor `5`, Stun
  `-4`, breathing/general-action impairment, and generic-care information.
- Use one structured operational adapter path. Do not create parallel legacy/canonical derivation or
  duplicate projected consequences.

## Stage 1 expected ownership and hotspots

Future dispatch must inspect the accepted execution baseline and reserve exact paths. Expected scope
is limited to:

- `packages/rules-engine/src/encounters/representativeCriticalFixtures.ts` and its focused tests;
- the smallest domain/runtime adapter surface required by the accepted six-kind contract, only if
  the exact baseline proves a gap and the Product Owner accepts it;
- focused verification/provenance documentation required to demonstrate exact source identity.

Do not edit generated table/workbook content merely to mirror accepted post-#393 values: those are
pre-#393 sources and their differences must remain explicit unless a separate source-maintenance
contract authorizes a change. Avoid broad Item/Encounter hotspots and coordinate any unavoidable
`encounterRoutes.ts`, Combat projection, schema, database, or shared Combat E2E ownership before
mutation.

## Out of scope for both stages

- Forgejo #3/#391 GM-review UI or adjudication implementation;
- any key outside the active stage;
- bulk 608-row activation or changes to the 574 legacy rows;
- invented values, interpolation, source normalization, or using severity as a substitute for
  per-key evidence;
- new medical, recovery, mortality, death-clock, permanent-loss, or hidden-diagnosis mechanics;
- Combat Manager redesign, a new panel, parallel proposal/review/commit flow, new command owner,
  `main`, Azure, deployment, or release work.

## Fire/Energy and periodic-loss boundary

Fire/Energy 06/09/10 belong to the remaining 29 accepted content set. Their accepted floors, Stun,
injury facts, and rates remain documented in
[decision 0001](../../decisions/rules/0001-c1-critical-injury-recalibration.md), but burn/shock loss is
not Bleed and non-Bleed `periodic_loss` is non-executable. Neither stage may enable it. Any executable
non-Bleed periodic-loss capability requires a separate source-linked design, contract, Product Owner
authorization, implementation, and independent QA.

## Stage 1 acceptance examples

1. Exact key/source assertions cover all five keys and no sixth key changes.
2. `blunt|arm|12` produces Stun `-4` for one round, no whole-body collapse, hand unusable, drop, and
   external `1/2 HP/round`.
3. `pointed_weapons|chest|07` produces internal `1/4 HP/round`, never the fixture's old `1/2` or the
   workbook's `1 HP/round` source text.
4. `sharp|head|10` produces unconsciousness with retained `1d4 hours`/GM-managed care and no numeric
   Stun.
5. `sharp|chest|04` produces separate stance-impaired and parry-only conditions plus drop, with no
   numeric Stun or Bleed.
6. `pointed_weapons|arm|02` retains floor `3`, Stun `-1` for retained `1d4 rounds`, hand impairment,
   drop, and external `1/8 HP/round`.
7. The other 29 representative fixtures and all 574 legacy rows are byte/behavior unchanged.
8. Fire/Energy 06/09/10 create no non-Bleed periodic-loss tick.

## Verification

Stage 1 Builder checks must prove exact key/source identity, exact accepted values, explicit
pre/post comparison, no inferred values, no sixth-key diff, one adapter path, ordinary-Bleed
arithmetic and lifecycle compatibility, and no non-Bleed periodic execution. Run focused fixture and
runtime tests plus repository typecheck, lint, tests, and build proportional to touched layers.
Inspect generated output and Git status.

Independent QA starts from the exact accepted Builder head in a separate visible task, reproduces
all five cases and negative boundaries, publishes exact evidence, and does not implement fixes or
merge.

## Git and lifecycle

Each authorized stage uses one clean short-lived `codex/` branch from its exact accepted `dev` SHA,
one draft PR to `dev`, and exact Builder head evidence. Builder completion moves the active stage to
Ready for Independent QA; QA approval moves it to Ready for Merge. Only the Product Owner or an
authorized integrator may merge. Stage 2 must not inherit Stage 1's authorization, assignment,
branch, or baseline. This contract grants no current Builder, QA, merge, release, or deployment
authority.
