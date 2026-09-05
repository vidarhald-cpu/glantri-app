# Canonical Field Equipment v1 roadmap

Status: accepted product sequencing and portfolio boundary on 2026-09-05.

Observed against local Forgejo
`dev@369418a7dd89e13146c356a1b5357199c2de8b3f`. Live Forgejo issues and pull
requests remain operational truth for current labels, ownership, authorization,
exact heads, QA, and integration. This roadmap does not authorize any inactive
case.

Normative authority:
[Architecture decision 0004](../decisions/architecture/0004-canonical-field-equipment-v1.md).

## Product outcome

> The same durable Item can be assigned, carried, equipped, made available, picked up, transferred and used from Campaign through Character, Scenario and Combat; the application always makes clear which state is canonical and which is a Scenario projection, detects external staleness rather than silently diverging, preserves authoritative in-play changes across reload, and never exposes Item information beyond the viewer’s actual relationship authority.

Field Equipment v1 is the smallest integrated portfolio that makes existing
Items trustworthy through ordinary play. It completes one identity and authority
chain; it is not an Item-economy, world-object, container, catalogue-release, or
general consumables initiative.

## Operational portfolio

| Order | Forgejo case                                                      | Purpose                                                           | Current authority                                                                                               |
| ----: | ----------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
|     0 | [#8](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/8)   | Investigate the intermittent equipment read-model race            | Ready/inactive Mandatory Recovery; not authorized and causally separate                                         |
|     1 | [#43](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/43) | Record accepted Field Equipment authority and portfolio           | Authorized/Active documentation Builder only                                                                    |
|     2 | [#44](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/44) | Repair GM-private Item projection authority                       | Authorized/Active narrow security repair; independent only while avoiding aggregate, Scenario, and Combat scope |
|     3 | [#45](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/45) | Make Character equipment one atomic revision-controlled aggregate | Ready/inactive/unassigned; not authorized; dependency-gated                                                     |
|     4 | [#46](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/46) | Reconcile canonical equipment with Scenario play                  | Ready/inactive/unassigned; not authorized; dependency-gated                                                     |
|     5 | [#47](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/47) | Deliver the integrated Canonical Field Equipment v1 milestone     | Ready/inactive/unassigned; not authorized; dependency-gated                                                     |

`Ready` never grants execution authority. #8, #45, #46, and #47 require a fresh
exact-baseline gate and separate Product Owner authorization before a Builder
may start. #43 is documentation-only. #44 remains a bounded security repair and
does not authorize the later aggregate or Scenario work.

## Delivery sequence

```text
#43 authority and portfolio ───────────────────────────────┐
                                                          │
#44 relationship-authority security repair ───────────────┤
                                                          ├─> #47 integrated milestone
#45 Character equipment aggregate + same-ID transfer ─────┤
                 │                                        │
                 └─> #46 Scenario projection/reconciliation┘

#8 separate Mandatory Recovery investigation
  └─> must be resolved or explicitly cleared as non-blocking before #47
```

#45 supplies the aggregate and transfer contract required by #46. #46 then owns
Scenario availability, pickup/drop, staleness, reconciliation, and frozen play
facts. #47 integrates the accepted result with existing Character, Campaign,
Scenario, and Combat experiences; it does not absorb deferred mechanics.

## Shared ownership and hotspots

The portfolio crosses these reserved surfaces:

- Prisma schema and migrations;
- Character equipment repository and read/write services;
- Campaign Items;
- Character inventory, storage, carry, and loadout;
- Scenario service/repository and Item API/UI;
- `apps/api/src/routes/scenarios/encounterRoutes.ts` and related route registration;
- Combat Item service and projections;
- package exports and shared API contracts; and
- Item, Combat, Lost Seal, and other shared fixtures/E2E setup.

Coordination rules:

- one migration owner controls schema and data-change order;
- #44 may proceed independently only while avoiding aggregate, Scenario, and
  Combat hotspots;
- #45 and #46 serialize their shared Character equipment and Scenario services;
- Combat-facing Field Equipment work serializes with active Critical/Encounter
  owners;
- Scenario work coordinates with the Campaign play lifecycle;
- shared exports and Item/Combat/Lost Seal fixtures have one owner at a time;
- no more than four implementation Builders run concurrently; and
- #8 may instrument independently but must not infer an aggregate cause without
  evidence.

## Accepted implementation evidence

The complete milestone needs bounded durable proof for:

- assignment and unassignment;
- Character-to-Character same-ID transfer;
- Scenario availability, pickup, and drop;
- loadout, draw, stow, and approved Combat Item operations;
- quantity and authoritative ammunition consumption;
- supported undo;
- expected-revision conflict and atomic rollback;
- visible external staleness, blocked dependent play, and explicit GM
  reconciliation;
- authoritative in-play mutations remaining reconciled through reload; and
- viewer-specific negative payloads for relationship-derived Item facts.

Each evidence record names the Item, actor authority, applicable Character,
Campaign, Scenario, and Combat context, and order/time. Before/after revisions
or quantities are retained where the transition changes them. A full Item
ledger is not required.

## Mechanical and product boundaries

- Freeze resolved supported structured facts plus provenance/fingerprint for
  play. Do not create a Skills-style Item release platform.
- Authored final-OB and initiative Item facts remain unsupported and
  non-operative without an explicit later rule decision.
- Complete only the existing ammunition-family mechanism: persistent selection,
  server compatibility, reload persistence, authoritative consumption, and its
  bounded undo.
- Do not add quiver capacity/recovery, generalized consumables/charges,
  containers, split/merge, economics, generalized degradation/repair, new
  encumbrance/carry rules, or a broad custom/versioned definition platform.
- Scenario availability is play-context authority, not a world, storage, or
  container engine.

## Concurrent documentation integration order

This roadmap was authored while Blackboard PR #33 and Campaign lifecycle PR #42
were open at exact heads
`efb62b7456e3fe63cbd26d19a3897222ba8eadad` and
`6864b0314547f172cf7b9b7ef776f4d09bb78462` respectively.

PR #33 owns `docs/architecture/ownership.md`,
`docs/product/campaign-scenario-encounter-workflows.md`, and
`docs/testing-regression-matrix.md`; #43 deliberately does not edit them. After
#33 is integrated, the Field Equipment integration owner must add the accepted
aggregate/Scenario/Combat hotspot map to ownership, the canonical-versus-stale
equipment workflow to the Campaign guide, and the #45-#47 evidence expectations
to the regression matrix without dropping Blackboard changes.

PR #42 owns the Campaign lifecycle decision/roadmap, both decision indexes, and
`docs/product/2026-09-03-strategic-future-register.md`. PR #43 uses architecture
decision number `0004` and limits index overlap to additive `0004`/roadmap links.
Integrate #42 first, then rebase #43 and preserve both `0003` and `0004` index
entries. Add the Field Equipment roadmap to the strategic future register in
that same reconciliation; #43 does not overwrite PR #42's owned register.

No source code, schema, migration, tests, product behavior, `main`, Azure,
production, deployment, acceptance, or integration is authorized by this
roadmap.
