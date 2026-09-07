# Campaign play lifecycle roadmap

Status: accepted product sequencing and portfolio boundary on 2026-09-05.

Accepted against local Forgejo
`dev@369418a7dd89e13146c356a1b5357199c2de8b3f` and reconciled without product
change onto
`dev@171756bb64ccf83d2e35ffa8400d8206ab24b1d5` on 2026-09-06. Live Forgejo
issues and pull requests remain operational truth for status, ownership,
authorization, exact baselines, QA, and integration. This roadmap does not
authorize implementation.

Normative lifecycle and access authority:
[Architecture decision 0003](../decisions/architecture/0003-campaign-play-lifecycle.md).

## Product outcome

A GM can activate a prepared Campaign, bring rostered Characters into a live
Scenario, run roleplay and an optional Combat Encounter, return to the same
Scenario context, close the Encounter with a public outcome, complete the
Scenario, and later reopen its player-safe history; players can always discover
or resume the live context they are entitled to see.

## Operational portfolio

| Order | Forgejo case                                                      | Purpose                                                                       | State observed 2026-09-06                                     | Execution authority                             |
| ----: | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
|     1 | [#34](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/34) | Record the accepted lifecycle, access, kind, history, and portfolio decisions | `status/Active`; assigned documentation Builder               | Documentation/product-decision work only        |
|     2 | [#35](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/35) | Campaign activation and rostered-player discovery                             | `status/Ready`; inactive; unassigned                          | Not authorized                                  |
|     3 | [#36](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/36) | Scenario lifecycle, player authorization, and derived live context            | `status/Ready`; inactive; unassigned                          | Not authorized                                  |
|     4 | [#37](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/37) | Encounter lifecycle, Scenario coupling, Combat continuity, and chronology     | `status/Ready`; dependency-gated on #36; inactive; unassigned | Not authorized                                  |
|     5 | [#38](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/38) | Resumable Campaign -> Scenario -> Encounter -> Combat UI context              | `status/Design`; dependency-gated; inactive; unassigned       | Not authorized; UI contract still needs refresh |
|     6 | [#39](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/39) | Player-safe completed Scenario and Encounter history                          | `status/Ready`; dependency-gated; inactive; unassigned        | Not authorized                                  |
|     7 | [#40](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/40) | Complete two-user Campaign-session acceptance journey                         | `status/Ready`; dependency-gated; inactive; unassigned        | Not authorized                                  |

`Ready` and placement in this roadmap mean that a contract is prepared. They do
not grant implementation permission. `Design` is also non-authorizing.

## Dependency graph

```text
#34 lifecycle decision -> #35 Campaign activation
#34 lifecycle decision -> #36 Scenario lifecycle -> #37 Encounter lifecycle/Combat continuity

#16 Campaign shell + #35 + #36 + #37 -> #38 resumable UI
#36 + #37                           -> #39 safe history
#16 Campaign shell + #35-#39       -> #40 full E2E

Each implementation case -> current lifecycle-document links and focused evidence
```

The graph is a sequencing constraint, not dispatch authority. #35 and #36 may
proceed independently only after separate authorization and clean hotspot
ownership. #37 follows the applicable Scenario lifecycle seam and the
Critical/Combat gate. #37 uses the common product lifecycle Draft -> Active <->
Paused -> Closed -> Archived (plus Draft -> Archived), treats legacy Encounter
kind as descriptive rather than a Combat gate, and returns from Combat to the
same Active Encounter. #38 remains Design until its UI details are refreshed
against this decision and the integrated #16 Campaign shell. #39 depends on the
enforced Scenario and Encounter terminal behavior. #40 proves the integrated
journey after the preceding slices are accepted.

## Shared-shell and documentation coordination

Blackboard #16 / PR #33 exact head
`efb62b7456e3fe63cbd26d19a3897222ba8eadad` is integrated on `dev` by merge
`171756bb64ccf83d2e35ffa8400d8206ab24b1d5`. Its accepted Campaign workspace
shell and documentation remain authoritative in:

- `docs/architecture/ownership.md`;
- `docs/product/campaign-scenario-encounter-workflows.md`;
- `docs/testing-regression-matrix.md`; and
- `packages/domain/src/campaign/README.md`.

#34 does not edit or overwrite those files. #38 must refresh its Campaign-shell
UI contract against the integrated #16 behavior before it can become Ready. The
first applicable implementation Definition of Done must also add or verify
concise links from the four owning documents to
[Architecture decision 0003](../decisions/architecture/0003-campaign-play-lifecycle.md)
and this roadmap, without copying a second lifecycle authority into them.

Scenario-relevant Blackboard behavior remains deferred. #16 supplies safe
Campaign-level findability and stable links; it does not decide Scenario
relevance.

## Hotspot and migration rules

- #37 and any #38/#40 Combat-return seam wait until Critical/Combat ownership is
  clear. Do not overlap writers in Encounter routes, Encounter service or
  repository, Combat persistence/projections, Combat progression, or shared
  Combat fixtures without a written split and merge order.
- Only one active portfolio task owns Prisma schema and migrations at a time.
  The Development Orchestrator names that migration owner and merge order before
  database-capable work starts. A dependent task consumes the landed contract;
  it does not create a competing migration.
- Only one active task owns the shared complete-session/Lost Seal E2E fixtures.
  #40 is the intended integrated-journey owner. Earlier cases may add focused,
  isolated evidence, but changes to the shared journey or seed must be
  coordinated with that owner.
- Campaign workspace/scenario orchestration is a shared hotspot. The integrated
  #16 shell is prerequisite context before #38 changes its shell, links, or
  return path.

## Preserved boundaries

The portfolio preserves Combat Manager and Player Combat, Campaign roster,
Scenario snapshots, explicit Encounter membership, roleplay actions/checks,
Blackboard, Artifact, Items, Character and NPC authority, and server-side
privacy/projection. It does not create a generic session engine or a second
authority for those facts.

The portfolio defers Combat redesign, spatial/VTT, Character Knowledge, AI
recap, a universal graph, new Blackboard kinds, scheduling/attendance,
automatic NPC deduplication, Scenario-relevant Blackboard beyond the integrated
#16 Campaign-level work, and broad Item/Critical rule changes. Contextual
Scenario Artifacts, Blackboard relevance, Item/snapshot readiness,
Campaign-local NPC entry, temporary-actor promotion, durable spontaneous rolls,
richer summaries, and complete Campaign archive/edit lifecycle require later
contracts.

## Acceptance and ownership of final evidence

Each case supplies its focused transition, authorization, projection, reload,
and presentation evidence. #40 owns one integrated two-user desktop and 390px
journey covering activation, rostered discovery, Scenario start, participant
preparation, roleplay, optional Combat, same-context return, public
outcome/private note separation, Encounter Close, Scenario Close, history reopening,
reload/reconnect, and negative payload assertions.

Every Builder publishes an immutable exact head for separate independent QA.
Neither this roadmap nor a passing focused case authorizes a later case, merges
to `dev`, or crosses the `main`/Azure/production boundary.
