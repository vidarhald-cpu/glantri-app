# R3C recovered case register

Status: authoritative recovery register for Forgejo issues #1-#8 as of 2026-09-03.

## Purpose and evidence policy

This register expands the minimum R3B crosswalk into self-contained recovered contracts. It records only the late-August cases and mandatory recovery follow-up authorized for R3C. It does not reconstruct all historical GitHub work and does not authorize product implementation, Builder/QA dispatch, `main`, Azure, production, deployment, or release work.

Evidence is classified throughout:

- **Repository-derived evidence** is preserved in Git objects, source, tests, repository documentation, or accepted R1-R3B recovery records.
- **Chat-recovered evidence** is operational state, approvals, pauses, product rulings, and QA/integration reports recovered from the architecture/control-plane conversation after GitHub became unavailable.

Repository evidence controls implemented state. Chat evidence may recover a decision or past status, but it does not manufacture code, QA, or integration that Git cannot support. A reconstructed issue retains its old identity for provenance while the local Forgejo issue is the current operational record.

## Portfolio summary

| Forgejo | Recovered identity | Purpose | Current state | Implementation state |
| ---: | --- | --- | --- | --- |
| #1 | GitHub #383 / PR #386 | Retained Character acquisition ledger and headless Chargen foundation | Closed — Integrated | Implemented and integrated in recovered `dev` |
| #2 | GitHub #387 / PR #390 | C1 Stun, timing, Bleed, treatment, persistence, and privacy runtime | Closed — Integrated | Implemented and integrated in recovered `dev` |
| #3 | GitHub #391 | GM Critical-review workflow with auditable overrides | Authorized, dependency-gated, inactive | Not implemented or dispatched |
| #4 | GitHub #392 | Activate the accepted n1-13 Critical content slice | Authorized, paused, inactive, superseded pending refresh | Not implemented or dispatched |
| #5 | GitHub #393 | Rewrite and recalibrate the 34 C1 representative fixtures | Closed — accepted decision integrated | Content/rule decision recorded; fixture/runtime code unchanged |
| #6 | GitHub #394 | Preserve mature Chargen and Combat Manager patterns | Design, inactive | Core preservation decision recorded; five questions open |
| #7 | GitHub #395 | Future Glantri-native spatial scene and movement tracker | Future/Design, inactive, not authorized | No prototype or implementation |
| #8 | R1 finding B2 | Investigate intermittent equipment read-model race | Ready, mandatory recovery, inactive, not authorized | No investigation or repair yet |

## Forgejo #1 — recovered GitHub #383 / PR #386

### Identity and purpose

- Original issue: `#383 [PILOT][CHARACTER] Implement retained Character acquisition ledger and headless Chargen foundation`
- Original PR: `#386`
- Purpose: add the server-authoritative, privacy-safe, retained Character acquisition ledger and headless Chargen/finalization foundation needed for later Character lifecycle and UI work.

### Repository-derived evidence

- Accepted implementation head: `a04c449f8407f35abc2c4b734629c781b75783c9`.
- Recovered integration commit: `d533b47a31dc437fe77857339fa983e2ec7ebfbc`, whose second parent is the accepted head and whose tree is `0744a76481331f875ae93756f03911502831deb8`.
- Migration `20260829103000_add_retained_character_ledger`, implementation, tests, privacy projection, and retained-Character rule documentation are present.
- R1 reran targeted Character, privacy, migration, database, Docker, and browser gates against the recovered integration candidate; they passed.

### Chat-recovered operational evidence

- Independent adversarial QA initially found nested protected-evidence exposure and weak migration-plan identity binding.
- A bounded repair removed nested protected identity without losing owner-facing mechanical explanation and bound apply operations to server-issued migration-plan identity.
- Independent QA passed the repaired exact head. The original integration was blocked only by GitHub suspension; the exact prospective merge object survived and later passed R1 recovery verification.

### Accepted decisions and current disposition

- The retained acquisition ledger and headless foundation are accepted implemented behavior.
- Headless Chargen does not replace the visual Chargen journey. Future Character UI preserves and extends existing Chargen under the [UI interaction preservation contract](../product/ui-interaction-preservation.md).
- Current state: `status/Integrated`, closed.
- Dependencies/gates: none for the historical integrated work. Any new Character UI is a separate contract and must answer applicable #394 questions.
- Unresolved questions: none inside #383. The UI continuation belongs to #394/future work.

## Forgejo #2 — recovered GitHub #387 / PR #390

### Identity and purpose

- Original issue: `#387 [PILOT][CRITICALS][RUNTIME] Implement C1 source-linked Stun, timing, Bleed, and treatment state`
- Original PR: `#390`
- Purpose: implement the reusable source-linked C1 Critical runtime, including initiative/timing, condition compatibility, exact Bleed, treatment state, persistence, privacy, history, and round-end processing.

### Repository-derived evidence

- Accepted implementation head: `15dabcc422f63a8603a9d673c06443004e91744f`.
- Merge commit `8db7ae068a6ad52a20f36361d4dee9539503c53c` records PR #390 and is the first parent of recovered integration `d533b47a...`.
- The repository contains the runtime, projection, history, modifier, round-manager, representative-fixture, API, and Scenario test surfaces.
- R1 reran seven targeted files / 693 tests plus Encounter integration tests against recovered `dev`; they passed.

### Chat-recovered operational evidence

- Independent QA passed the exact head, including highest-initiative-first ordering, equal-initiative simultaneity, later-group activation, next-round deferral, function-specific action compatibility, persistence, privacy, Stun, Bleed, and treatment behavior.
- Post-merge CI and Docker/Playwright passed before GitHub access was lost.

### Accepted decisions and current disposition

- The #387 timing, lifecycle, persistence, privacy, and effect-processing architecture remains the accepted runtime foundation.
- #393 may change content atoms and calibration, but does not invalidate the #387 architecture.
- Current state: `status/Integrated`, closed.
- Dependencies/gates: none for the historical integrated work.
- Unresolved questions: non-Bleed `periodic_loss` is not part of #387 and remains separately unauthorized.

## Forgejo #3 — recovered GitHub #391

### Identity and purpose

- Original issue: `#391 [PILOT][CRITICALS][UI] Implement GM Critical-review workflow with auditable overrides`
- Purpose: let the GM review server-authored Critical outcomes, make bounded overrides with durable audit evidence, and commit the result through the established Combat workflow.

### Repository-derived evidence

- Recovered `dev` contains #387's Critical runtime foundation.
- `docs/product/combat-panel-contract.md`, `docs/product/combat-ui-audit.md`, `docs/architecture/combat-ux-principles.md`, and related Combat documents define the existing tracker, panel ownership, Damage/effects review, result, history, privacy, and command seams.
- No #391 implementation commit, PR, migration, or tests are present.

### Chat-recovered operational evidence

- The task was prepared against integrated #387 and historically authorized only behind dependencies. It was never dispatched.
- The generic server-authored atom/adjudication design remained viable and was expected to need one additive audit-persistence migration.

### Accepted decisions, gates, and current disposition

- #391 must extend the existing Damage/effects review and keep authoritative commit ownership in Current Action.
- It must preserve the tracker, six-panel shell, Results, Combat Log/history, terminology, and control placement under the [UI interaction preservation contract](../product/ui-interaction-preservation.md).
- No new general Combat panel, navigation redesign, round-shell redesign, second review grammar, or broad layout redesign is authorized.
- Current state: `status/Authorized`, `gate/Dependency`, `state/Inactive`; no active owner.
- Before dispatch, the orchestrator must refresh the contract and exact `dev` SHA, use the accepted #393 content boundary, resolve the applicable #394 questions, and coordinate Combat/database hotspots.
- Explicit unresolved question: how the new Critical review coexists with the older broad/manual damage-adjustment path.

## Forgejo #4 — recovered GitHub #392

### Identity and purpose

- Original issue: `#392 [PILOT][CRITICALS][CONTENT] Implement accepted n1-13 Critical activation slice`
- Purpose: activate a bounded 13-key portion of the representative C1 Critical content using the accepted runtime.

### Repository-derived evidence

- The repository contains the 34 pre-recalibration representative fixtures, generated Critical table/provenance, canonical workbook, and #387 runtime.
- No implementation commit, PR, or test delta for the proposed 13-key activation package is present.

### Chat-recovered operational evidence

- The package was historically authorized but never dispatched.
- Its fixture wording and calibration assumptions predated #393. The control plane paused it and treated the old package as superseded pending the complete recalibration outcome.

### Accepted decisions, gates, and current disposition

- The old package must not be dispatched unchanged.
- [Rule decision 0001](../decisions/rules/0001-c1-critical-injury-recalibration.md) controls the refreshed content boundary.
- Executable non-Bleed `periodic_loss` must not be added to #392 by inference.
- Current state: `status/Authorized`, `state/Paused`, `state/Inactive`, `relation/Superseded`, dependency-gated.
- Implementation state: not started.
- Unresolved product decision: refresh, partially reuse, or replace the old activation package.

## Forgejo #5 — recovered GitHub #393

### Identity and purpose

- Original issue: `#393 [PILOT][CRITICALS][CONTENT] Rewrite and recalibrate all 34 C1 Critical fixtures`
- Purpose: produce concrete, coherent, GM-usable Critical text and recalibrate Stun, action state, consciousness, Bleed, function loss, and severity across the representative fixtures before broader activation.

### Repository-derived evidence

- The repository preserves the pre-recalibration fixture code/data, generated table/provenance, rule/audit documents, workbook, and integrated #387 runtime.
- No #393 workbook, fixture, runtime, database, or test implementation is present.

### Chat-recovered operational evidence

- A complete read-only 34-fixture review was produced. The control plane accepted the concrete-injury/agency direction, revised Stun calibration, slower internal-Bleed calibration, severity envelope, immediate fall/current-prone/function-loss treatment, unconsciousness guidance, and two narrow chest-04 `parry_only` cases.
- The initial three Fire/Energy rates were rejected as incoherent under three-second rounds. A revised `1/4`, `1/3`, `1/2 HP/round` progression with concrete narratives, Stun/state, and control events was later accepted as content only.

### Accepted decisions and current disposition

- [Rule decision 0001](../decisions/rules/0001-c1-critical-injury-recalibration.md) is the authoritative recovered ruling.
- Executable non-Bleed `periodic_loss` remains **NOT AUTHORIZED** and must be a separate future design/implementation decision.
- Current state: `status/Integrated`, closed as an accepted design/content outcome.
- Implementation state: the decision is integrated into documentation; the revised fixtures and Fire/Energy behavior are not activated in product code.
- Dependencies/gates: #392 or replacement activation work must refresh against this record.
- Unresolved questions: no remaining #393 content ruling is inferred here. Runtime design, activation scope, and mortality/permanence/recovery mechanics remain separate future work.

## Forgejo #6 — recovered GitHub #394

### Identity and purpose

- Original issue: `#394 [PILOT][UI][ARCHITECTURE] Audit and preserve proven Glantri interaction patterns before new pilot UI`
- Purpose: prevent later Character and Critical work from replacing mature Chargen and Combat Manager surfaces or creating parallel UI authority.

### Repository-derived evidence

- Recovered `dev` contains the existing numbered Chargen journey and mature Combat Manager.
- The product and Combat documents preserve the tracker, six-panel shell, Current Action, Results, Combat Log/history, terminology, privacy, and control responsibilities.

### Chat-recovered operational evidence

- The #394 audit report was completed against `dev@8db7ae068a6ad52a20f36361d4dee9539503c53c`, but GitHub suspension blocked durable publication.
- The control plane accepted the core preservation principles and left five narrower product questions open.

### Accepted decisions and current disposition

- The [UI interaction preservation contract](../product/ui-interaction-preservation.md) controls the preservation boundary.
- Mature Chargen and Combat Manager are preserved product surfaces. Future Character builder work means preserve/extend Chargen. #391 extends existing Damage/effects review.
- Current state: `status/Design`, `state/Inactive`; no implementation authority.
- Implementation state: decision documentation only; no UI change.
- Dependencies/gates: resolve applicable product questions before contracts that would otherwise force an answer.
- Open questions, intentionally undecided:
  1. What local draft restoration promise should Chargen make, given the current “Draft saved locally” message and absence of a restore flow?
  2. Is section `9b` numbering intentional?
  3. What is the narrow-layout Chargen contract?
  4. Should create, owner-edit, and GM-edit remain separate authority journeys?
  5. How should #391 coexist with the older broad/manual damage-adjustment path?

## Forgejo #7 — recovered GitHub #395

### Identity and purpose

- Recovered identity: GitHub `#395`; the exact original title/body did not survive in repository evidence.
- Recovered title: `[FUTURE][SPATIAL][ARCHITECTURE] Glantri-native spatial scene and movement tracker`.
- Purpose: preserve a future direction for map-backed positions, movement, facing, line of sight, cover, derived spatial facts, and mass-play readiness without building a full VTT or duplicating Combat rules.

### Repository-derived evidence

- No #395 code, prototype, persistence model, library choice, or rule implementation is present.
- Existing architecture places calculations in the Glantri rules engine and preserves the established Combat Manager boundary.

### Chat-recovered operational evidence

- The product owner explicitly accepted map-source independence and preparation for mass-play scaling as future design constraints.
- The control plane recorded #395 as Future/Design and not authorized for implementation.

### Accepted decisions and current disposition

- [Architecture decision 0002](../decisions/architecture/0002-spatial-scene-rules-boundary.md) records the chain `scene geometry -> derived spatial facts -> Glantri rules engine -> suggested modifiers -> GM review`.
- The scene model must be map-source independent, scale from a small floorplan to a mass battlefield, and must not become a second rules engine.
- Current state: `status/Design`, `priority/Future`, `state/Inactive`; not authorized.
- Implementation state: none.
- Gates: a separate product/control-plane decision is required even for a feasibility prototype.
- Unresolved questions: facing/shield arcs, directional armor, cover/LOS rules, movement/elevation/formations, library choice, Artifact integration, persistence, and prototype scope.

## Forgejo #8 — mandatory recovery finding B2

### Identity and purpose

- Source identity: R1 recovery finding `B2`; no recovered GitHub issue number.
- Purpose: reproduce and explain the intermittent equipment write/read timing path, classify the cause, and define deterministic regression or bounded repair work if supported by evidence.

### Repository-derived evidence

- Two R1 full Playwright attempts showed a player-added equipped dagger in the UI before it appeared in the immediate server equipment read model.
- An isolated B2 rerun and the final complete CI-style Playwright suite passed.
- `docs/recovery/2026-09-03-local-control-plane-recovery-baseline.md` records the finding and its mandatory follow-up status.

### Chat-recovered operational evidence

- The control plane accepted the recovered code baseline with B2 as a mandatory follow-up rather than a recovery blocker.
- No conclusion was reached about whether the cause is application synchronization, test isolation, or another timing defect.

### Prepared investigation contract and current disposition

The future investigation must:

1. identify the exact equipment write/read sequence and authoritative read-model boundary;
2. produce a deterministic reproduction or document why the original failure cannot be reproduced;
3. classify the cause from evidence;
4. add focused regression coverage for the confirmed cause;
5. preserve current equipment authority and privacy semantics; and
6. receive independent QA at an exact immutable head if code changes are proposed.

- Current state: `status/Ready`, `priority/Mandatory Recovery`, `state/Inactive`.
- Implementation state: no investigation, repair, Builder, or QA work has started.
- Gate: explicit control-plane authorization from a freshly resolved `dev` baseline.
- Unresolved question: the actual cause and whether code repair, test repair, or no change is warranted.

## Remaining product-owner/control-plane decisions

R3C deliberately leaves only these portfolio decisions open:

1. answer the five #394 product/UX questions;
2. decide whether #392 is refreshed, partially reused, or replaced;
3. decide whether and when to design and authorize non-Bleed `periodic_loss` runtime as a separate case;
4. clear or revise #391's dependency gate after the applicable #392/#394 decisions;
5. authorize and sequence mandatory B2 investigation; and
6. decide whether/when #395 receives a bounded architecture investigation or feasibility prototype.

No priority beyond B2's explicit `Mandatory Recovery` and #395's explicit `Future` horizon is inferred.
