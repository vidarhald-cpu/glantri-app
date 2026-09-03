# Recovered Forgejo operational portfolio and crosswalk

Status: R3B minimum viable operational portfolio reconstructed on 2026-09-03.

## Purpose and scope

This record reconstructs only the current late-August Glantri portfolio and mandatory recovery follow-ups needed to resume controlled development after loss of the GitHub operational control plane. It does not reproduce the historical GitHub issue database or its comments verbatim.

This R3B record:

- establishes the Forgejo issue-status, priority, type, evidence, area, and gate conventions;
- maps the recovered GitHub issue identities to their new local Forgejo issues;
- distinguishes repository-derived evidence from chat-recovered operational facts;
- records accepted content/UX boundaries that were not yet durable in the repository; and
- keeps inactive, paused, future, or unapproved work from becoming implementation authority merely because it has been reconstructed.

R3B creates no Builder or QA work, implements no product code, changes no Glantri runtime behavior, and grants no `main`, production, Azure, deployment, or release authority.

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

| Label | Meaning |
| --- | --- |
| `status/Design` | Concept, evidence, or consequential decisions are still being clarified. No implementation authority. |
| `status/Ready` | The task contract is complete, but implementation is not authorized. |
| `status/Authorized` | Product/control plane approved the work; the orchestrator may dispatch only when all gates and baseline checks are clear. |
| `status/Active` | A Builder or QA lane has claimed ownership and work is in progress. |
| `status/Ready for Independent QA` | Builder work is complete and awaits independent QA against an exact immutable head. |
| `status/Ready for Control-plane Acceptance` | Independent QA passed and the exact result awaits control-plane acceptance. |
| `status/Integrated` | The accepted result is integrated into `dev`; for design-only work, the accepted outcome is durably integrated into repository records. |

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

| Recovered source identity | New Forgejo issue | Reconstructed disposition |
| --- | --- | --- |
| GitHub #383 / PR #386 | [Forgejo #1](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/1) | Closed; `status/Integrated`; accepted head `a04c449f...` is the second parent of recovered integration `d533b47a...`. |
| GitHub #387 / PR #390 | [Forgejo #2](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/2) | Closed; `status/Integrated`; accepted head `15dabcc4...` integrated through `8db7ae06...`. |
| GitHub #391 | [Forgejo #3](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/3) | Open; `status/Authorized`; dependency-gated and inactive. |
| GitHub #392 | [Forgejo #4](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/4) | Open; `status/Authorized`; paused/inactive; old package superseded pending refresh from #393. |
| GitHub #393 | [Forgejo #5](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/5) | Closed; accepted design/content outcome durably integrated by this record; non-Bleed runtime explicitly excluded. |
| GitHub #394 | [Forgejo #6](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/6) | Open; `status/Design`; core preservation principles accepted, five narrower questions open. |
| GitHub #395 | [Forgejo #7](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/7) | Open; `status/Design`; future spatial architecture only, inactive and not authorized. |
| R1 finding B2 (no recovered GitHub issue) | [Forgejo #8](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/8) | Open; `status/Ready`; mandatory recovery follow-up, inactive and not yet authorized. |

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

| Fixture | Injury/content intent | Stun/state | Non-Bleed content rate | HP/min | End condition |
| --- | --- | --- | --- | ---: | --- |
| `fire_energy|whole_body|06` | Clothing/fur burning across the body | `-4`, no action lock | `1/4 HP/round` | 5 | Flames extinguished |
| `fire_energy|whole_body|09` | Broad deep burns with systemic shock | `-8`, conscious/actionable | `1/3 HP/round` | 6 2/3 | Cooling and burn-shock stabilization |
| `fire_energy|whole_body|10` | Widespread burns with inhalation injury | `-8` plus breathing impairment | `1/2 HP/round` | 10 | Airway/circulatory stabilization |

Each retains minimum total damage floor 4 and begins after one full three-second interval.

These rates are accepted content semantics only. Burn/shock loss is not Bleed, but a non-Bleed `periodic_loss` runtime capability is **not authorized**. It requires a separate source-linked design, task contract, control-plane authorization, implementation, and independent QA.

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

### #395

The recovered direction favors a Glantri-native spatial scene model, layered over qualified map/Artifact images and implemented with standard rendering/geometry components rather than a competing full VTT product model. Geometry should produce factual spatial queries; Glantri rules should convert them into suggested modifiers; the GM remains the reviewer.

The concept remains future-only and unapproved for implementation. Facing/shield arcs, directional armor, cover/LOS, movement/elevation/formations, library choice, Artifact integration, and prototype scope still require decisions.

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
