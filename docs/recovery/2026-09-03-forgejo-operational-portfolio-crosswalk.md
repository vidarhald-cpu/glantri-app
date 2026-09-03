# Recovered Forgejo operational portfolio and crosswalk

Status: R3B-R3D recovered operational portfolio crosswalk current on 2026-09-03.

R3C reconciliation on 2026-09-03 moved the recovered contracts and accepted decisions into dedicated durable records. Use this document as the identity/status crosswalk, then consult:

- [R3C recovered case register](./2026-09-03-r3c-recovered-case-register.md) for the self-contained state of Forgejo issues #1-#8;
- [R3D recovered case register](./2026-09-03-r3d-recovered-case-register.md) for the self-contained state of Forgejo issues #9-#17 and the durable omission boundary;
- [C1 Critical content calibration decision](../decisions/rules/0001-c1-critical-injury-recalibration.md);
- [Skill Catalogue qualitative architecture decision](../decisions/rules/0002-skill-catalogue-qualitative-architecture.md);
- [Authority and Information Projection Principle](../architecture/information-authority-and-projection.md);
- [strategic portfolio and future register](../product/2026-09-03-strategic-future-register.md);
- [Chargen and Combat Manager preservation contract](../product/ui-interaction-preservation.md);
- [future spatial subsystem boundary](../decisions/architecture/0002-spatial-scene-rules-boundary.md); and
- [prepared R4 localhost inspection contract](./2026-09-03-r4-localhost-inspection-task-contract.md).

The R3B text below is retained as recovery provenance. Where its summary is less detailed, the R3C/R3D case registers and dedicated decision records control.

## Purpose and scope

This record reconstructs only the current late-August Glantri portfolio and mandatory recovery follow-ups needed to resume controlled development after loss of the GitHub operational control plane. It does not reproduce the historical GitHub issue database or its comments verbatim.

This R3B record:

- establishes the Forgejo issue-status, priority, type, evidence, area, and gate conventions;
- maps the recovered GitHub issue identities to their new local Forgejo issues;
- distinguishes repository-derived evidence from chat-recovered operational facts;
- records accepted content/UX boundaries that were not yet durable in the repository; and
- keeps inactive, paused, future, or unapproved work from becoming implementation authority merely because it has been reconstructed.

R3B creates no Builder or QA work, implements no product code, changes no Glantri runtime behavior, and grants no `main`, production, Azure, deployment, or release authority.

R3D separately reconstructs exactly nine additional issue identities (#9-#17) and one documentation-recovery Builder/QA lane. It does not adopt any other historical case or grant product implementation authority to the six inactive recovered cases.

R3C later promoted the accepted decisions out of this recovery summary into durable rule, product, and architecture records. The issue-status crosswalk below remains the provenance ledger; the normative recovered decisions are:

- `docs/decisions/rules/0001-c1-critical-injury-recalibration.md`;
- `docs/product/ui-interaction-preservation.md`; and
- `docs/decisions/architecture/0002-spatial-scene-rules-boundary.md`.

## Recovered `dev` chronology

The accepted recovered product-code baseline remains:

- integration commit: `d533b47a31dc437fe77857339fa983e2ec7ebfbc`;
- tree: `0744a76481331f875ae93756f03911502831deb8`;
- parents: last GitHub-integrated `dev` `8db7ae068a6ad52a20f36361d4dee9539503c53c` and accepted #383 head `a04c449f8407f35abc2c4b734629c781b75783c9`.

R3B verified that R3A recovery commit `b4c6a61bcb423b81fb01a2d31aac4bf798bc2a59`:

- has `d533b47a31dc437fe77857339fa983e2ec7ebfbc` as its sole parent; and
- adds only `docs/recovery/2026-09-03-local-control-plane-recovery-baseline.md`.

Canonical `dev` was therefore fast-forwarded to `b4c6a61bcb423b81fb01a2d31aac4bf798bc2a59` before this portfolio record was committed. No product-code path changed in that integration.

## Forgejo status convention

Every operational issue must carry exactly one exclusive `status/...` label. The labels preserve the Glantri status model:

| Label                                       | Meaning                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `status/Design`                             | Concept, evidence, or consequential decisions are still being clarified. No implementation authority.                                   |
| `status/Ready`                              | The task contract is complete, but implementation is not authorized.                                                                    |
| `status/Authorized`                         | Product/control plane approved the work; the orchestrator may dispatch only when all gates and baseline checks are clear.               |
| `status/Active`                             | A Builder or QA lane has claimed ownership and work is in progress.                                                                     |
| `status/Ready for Independent QA`           | Builder work is complete and awaits independent QA against an exact immutable head.                                                     |
| `status/Ready for Control-plane Acceptance` | Independent QA passed and the exact result awaits control-plane acceptance.                                                             |
| `status/Integrated`                         | The accepted result is integrated into `dev`; for design-only work, the accepted outcome is durably integrated into repository records. |

Operational rules:

- An open issue may be inactive despite `status/Authorized`; `state/Inactive`, `state/Paused`, and `gate/Dependency` explain why it must not be dispatched.
- `status/Ready` is not implementation permission.
- `status/Active` requires actual ownership; R3B assigns none.
- Close an issue only when its accepted outcome is `status/Integrated` or the control plane explicitly closes it for another recorded reason.
- A recovered authorization must still be refreshed against the current exact `dev` SHA before dispatch.

## Priority, type, and supporting labels

Priority labels are exclusive. `priority/Unassigned` means no recoverable product-owner ranking exists; it is deliberately not an inferred normal priority. `priority/Mandatory Recovery` and `priority/Future` are used only where the recovery/control-plane record explicitly establishes those horizons. `priority/High`, `priority/Normal`, and `priority/Low` exist as future control-plane vocabulary but R3B does not infer them.

Type labels are non-exclusive because a recovery item can also be a Bug and a content activation item can also be Implementation:

- `type/Implementation`
- `type/Bug`
- `type/Content`
- `type/Architecture`
- `type/Recovery`
- `type/Proposal` (added by R3D only for the standalone old #354 Proposal/Design identity)

Supporting conventions created by R3B:

- portfolio/area: `scope/Pilot`, `area/Character`, `area/Combat`, `area/UI`, `area/Equipment`, `area/Spatial`;
- gating/state: `gate/Dependency`, `state/Inactive`, `state/Paused`, `relation/Superseded`;
- decisions: `decision/Accepted with boundary`, `decision/Partially accepted`;
- provenance: `evidence/Repository`, `evidence/Chat recovery`.

## Evidence classification

`evidence/Repository` covers evidence preserved in Git objects, repository files/tests, or the accepted R1-R3A recovery records. `evidence/Chat recovery` covers issue titles/contracts, product-owner rulings, authorization/paused state, QA/acceptance facts, or other operational facts recovered from the architecture/control-plane conversation.

Where the sources differ in strength:

- repository code/tests and Git topology establish implemented state;
- the accepted recovery record establishes recovered baseline and verification state;
- chat evidence establishes missing approvals, pauses, product directions, and issue-state transitions;
- chat evidence does not rewrite Git history or imply code implementation that the repository does not contain.

## Old GitHub to Forgejo crosswalk

| Recovered source identity                 | New Forgejo issue                                                         | Reconstructed disposition                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub #383 / PR #386                     | [Forgejo #1](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/1)   | Closed; `status/Integrated`; accepted head `a04c449f...` is the second parent of recovered integration `d533b47a...`.                                                              |
| GitHub #387 / PR #390                     | [Forgejo #2](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/2)   | Closed; `status/Integrated`; accepted head `15dabcc4...` integrated through `8db7ae06...`.                                                                                         |
| GitHub #391                               | [Forgejo #3](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/3)   | Open; `status/Authorized`; dependency-gated and inactive.                                                                                                                          |
| GitHub #392                               | [Forgejo #4](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/4)   | Open; `status/Authorized`; paused/inactive; old package superseded pending refresh from #393.                                                                                      |
| GitHub #393                               | [Forgejo #5](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/5)   | Closed; accepted design/content outcome durably integrated by this record; non-Bleed runtime explicitly excluded.                                                                  |
| GitHub #394                               | [Forgejo #6](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/6)   | Open; `status/Design`; core preservation principles accepted, five narrower questions open.                                                                                        |
| GitHub #395                               | [Forgejo #7](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/7)   | Open; `status/Design`; future spatial architecture only, inactive and not authorized.                                                                                              |
| R1 finding B2 (no recovered GitHub issue) | [Forgejo #8](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/8)   | Open; `status/Ready`; mandatory recovery follow-up, inactive and not yet authorized.                                                                                               |
| GitHub #356 / PR #357                     | [Forgejo #9](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/9)   | Open; `status/Ready for Independent QA` at Builder handoff; accepted head `5df9ccc9748dc05a7cf4bd2ce0e72ed5e4a65121` did not reach recovered `dev`; fresh QA/integration required. |
| GitHub #355 / PR #358                     | [Forgejo #10](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/10) | Open; `status/Ready for Independent QA` at Builder handoff; accepted head `0689a9fe10056afe6a823e36a855ab93d946a3cf` did not reach recovered `dev`; fresh QA/integration required. |
| GitHub #369 / PR #370                     | [Forgejo #11](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/11) | Open; `status/Ready for Independent QA` at Builder handoff; accepted head `5f0de383442bedad878ba8a48a306844ac0d17a2` did not reach recovered `dev`; fresh QA/integration required. |
| GitHub #349                               | [Forgejo #12](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/12) | Open; `status/Design`; inactive, priority unassigned, not authorized; remaining structured-condition authority only; gates #13.                                                    |
| GitHub #348                               | [Forgejo #13](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/13) | Open; `status/Ready`; dependency-gated, inactive, priority unassigned, not authorized; requires contract refresh and reauthorization.                                              |
| GitHub #220                               | [Forgejo #14](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/14) | Open; `status/Design`; inactive, priority unassigned, not authorized; future evolving-injury/recovery-risk design excluding integrated C1/#393.                                    |
| GitHub #257                               | [Forgejo #15](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/15) | Open; `status/Design`; inactive, priority unassigned, not authorized; Character Knowledge receipts and mechanical-activation boundary.                                             |
| GitHub #320                               | [Forgejo #16](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/16) | Open; `status/Ready`; inactive, priority unassigned, not authorized; refresh against current Blackboard/Artifact/#15 boundaries before authorization.                              |
| GitHub #354                               | [Forgejo #17](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/17) | Open; Proposal/Design, `status/Design`; future priority, inactive, not authorized; standalone player-authored Campaign-object proposal.                                            |

## R3D recovery boundary

R3D restores three historically accepted documentation outcomes through a fresh
documentation-only branch and current Forgejo PR rather than cherry-picking
their stale accepted commits. Forgejo #9-#11 move from actual Builder-owned
`status/Active` work to open, unassigned `status/Ready for Independent QA` at
handoff. Fresh independent QA and later control-plane acceptance/integration are
required.

Forgejo #12-#17 are deliberately non-dispatchable. Their issue bodies preserve
the ruled scope, dependencies, unresolved decisions, and explicit lack of
authorization. R3D does not modify or implement those product areas.

The exact R3D non-recreation list—including old #340, #258, #361, #363, #364,
#368, #371, #372, #377, #378, #379, #380, #382, #346, #287, #388, #389, #213,
#318, #319, #342, #345, #350, #352, #359, #365, #373, #279, #280, #306, and
#309—is durable in the
[R3D register](./2026-09-03-r3d-recovered-case-register.md#durable-omission-and-deferment-boundary).

## Recovered portfolio decisions and boundaries

### #383 and #387

Both implementation lines are part of accepted recovered `dev`. Their Forgejo issues are historical integrated records, not new implementation authority.

### #391

The GM Critical-review workflow remains prepared and authorized behind a dependency gate, with no active owner. It must extend the existing Combat Current Action and Damage/effects review grammar. No new general Combat panel, round shell, navigation scheme, second review grammar, or broad layout redesign is authorized.

Before dispatch, the orchestrator must refresh the exact baseline and task contract, use the accepted #393 content boundary, and ensure the #394 preservation contract is sufficiently resolved and durable.

### #392

The old n1-13 activation package remains authorized in historical state but paused, inactive, and superseded pending refresh. It must not be dispatched unchanged. Control plane must decide whether it is refreshed, partially reused, or replaced using the accepted #393 calibration.

### #393

The recovered accepted content directions are:

- describe the concrete physical injury/event, not only its aftermath;
- author injury and unavoidable immediate/physiological consequences rather than future player behavior;
- keep numeric Stun at `-1 / -2 / -4 / -8`, with `-4` ordinary meaningful Stun and `-8` extreme;
- reserve automatic unconsciousness mainly for justified head trauma instead of using it as generic severity shorthand;
- generally calibrate internal Bleed slower than comparable external Bleed while making it harder to detect and treat;
- maintain coherent 1-16 severity progression while accounting for independent consequences such as prone and function loss;
- use falls, drops, collapse, prone, and functional loss when physically unavoidable without scripting later turns; and
- retain the two narrowly justified chest-index-04 `parry_only` cases where concrete anatomy explains the restriction.

The accepted Fire/Energy content progression is:

| Fixture                                          | Injury/content intent                   | Stun/state                     | Non-Bleed content rate | HP/min | End condition                        |
| ------------------------------------------------ | --------------------------------------- | ------------------------------ | ---------------------- | -----: | ------------------------------------ |
| <code>fire_energy&#124;whole_body&#124;06</code> | Clothing/fur burning across the body    | `-4`, no action lock           | `1/4 HP/round`         |      5 | Flames extinguished                  |
| <code>fire_energy&#124;whole_body&#124;09</code> | Broad deep burns with systemic shock    | `-8`, conscious/actionable     | `1/3 HP/round`         |  6 2/3 | Cooling and burn-shock stabilization |
| <code>fire_energy&#124;whole_body&#124;10</code> | Widespread burns with inhalation injury | `-8` plus breathing impairment | `1/2 HP/round`         |     10 | Airway/circulatory stabilization     |

Each retains minimum total damage floor 4 and begins after one full three-second interval.

These rates are accepted content semantics only. Burn/shock loss is not Bleed, but a non-Bleed `periodic_loss` runtime capability is **not authorized**. It requires a separate source-linked design, task contract, control-plane authorization, implementation, and independent QA.

Normative recovered rule record: `docs/decisions/rules/0001-c1-critical-injury-recalibration.md`.

### #394

Accepted preservation principles:

- preserve the vertically composed, numbered Chargen journey and extend it with #383 rather than replace it;
- preserve Combat Manager's tracker, six-panel shell, Current Action command ownership, Results, and Combat Log/history;
- fit new mechanics into the existing proposal/review/commit structure; and
- require separate control-plane approval for any new general Combat panel, navigation change, round-shell change, second review grammar, or broad layout redesign.

The five narrower questions remain open:

1. Chargen's “Draft saved locally” promise versus the absence of a restore flow;
2. whether section `9b` numbering is intentional;
3. the narrow-layout Chargen contract;
4. whether create, owner-edit, and GM-edit remain separate authority journeys; and
5. how #391 coexists with the older broad/manual damage-adjustment path.

Normative recovered preservation record: `docs/product/ui-interaction-preservation.md`.

### #395

The recovered direction favors a Glantri-native spatial scene model, layered over qualified map/Artifact images and implemented with standard rendering/geometry components rather than a competing full VTT product model. Geometry should produce factual spatial queries; Glantri rules should convert them into suggested modifiers; the GM remains the reviewer.

The concept remains future-only and unapproved for implementation. Facing/shield arcs, directional armor, cover/LOS, movement/elevation/formations, library choice, Artifact integration, and prototype scope still require decisions.

Normative recovered architecture boundary: `docs/decisions/architecture/0002-spatial-scene-rules-boundary.md`.

### B2

R1 observed two intermittent failures where an equipped dagger appeared in the UI before the immediate server equipment read model, while an isolated rerun and final complete suite passed. Forgejo #8 contains a bounded investigation contract. Its `status/Ready` does not authorize work; control plane must choose when to authorize it from a current baseline.

## Outstanding control-plane decisions

The reconstructed portfolio intentionally leaves these decisions open:

1. answer the five #394 product/UX questions;
2. decide whether #392 is refreshed, partially reused, or replaced from accepted #393 content;
3. decide whether and when to design/authorize non-Bleed `periodic_loss` runtime support as a separate issue;
4. clear or revise #391's dependency gate after #392/#394 decisions, including manual-damage coexistence;
5. authorize and sequence the mandatory B2 investigation; and
6. decide whether/when #395 receives a bounded architecture investigation or feasibility prototype.

No priority ordering among these items is inferred by R3B beyond the explicit `Mandatory Recovery` and `Future` labels.
