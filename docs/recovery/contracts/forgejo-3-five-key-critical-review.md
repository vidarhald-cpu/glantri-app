# Forgejo #3 future contract: five-key GM Critical review

- Recovered predecessor: GitHub #391
- Lifecycle after Forgejo #51: Ready, inactive, unassigned, not authorized
- Contract owner: Product Owner
- Execution owner: none until explicit authorization and visible dispatch
- Reference baseline: `dev@87af54c054b99d29f6d8b13d7b84faedfec6717b`
- Accepted execution baseline: unset; must be the exact post-#51 and Stage-1-integrated `dev` SHA

## Outcome

Implement bounded, auditable GM review for exactly five accepted C1 Critical payloads inside the
existing Damage/effects review in Current Action. Commit accepted canonical atoms, permitted
instance deltas, and independently authored manual rows in one command; project current results and
immutable audit evidence through the existing Results and Combat Log/history surfaces.

The five keys are exactly:

1. `pointed_weapons|arm|02`
2. `blunt|arm|12`
3. `pointed_weapons|chest|07`
4. `sharp|head|10`
5. `sharp|chest|04`

No substitution or sixth key is permitted. The payload authority is
[the five-key freeze](../2026-09-06-c1-five-key-post-393-payloads.json), governed by
[decision 0004](../../decisions/rules/0004-c1-critical-authoring-and-adjudication.md).

## Entry and dependency gates

This contract is Ready for future authorization but is not authorization to start. Before dispatch,
the Product Owner must:

1. accept and integrate Forgejo #51;
2. accept and integrate Forgejo #4 Stage 1, or explicitly approve a different merge-order contract;
3. refresh this issue to name the exact live `dev` SHA and confirm Forgejo `dev` matches it;
4. confirm no conflicting owner in the reserved Combat hotspots;
5. move the issue through `Authorized` to `Active`, assign the visible Builder, and record the task
   and branch in a dispatch comment.

Builder and independent QA must be separate visible tasks. Neither role may merge.

## User-visible behavior

- The GM reviews the server-authored canonical proposal inside the existing Damage/effects section
  of **Current Action**.
- The GM may suppress only Stun modifiers, conditions, operations, and ordinary-Bleed periodic-loss
  atoms; choose a server-permitted Stun value from `-1/-2/-4/-8`; edit instance title/narrative; and
  add an optional private reason.
- The GM may not alter the damage floor or redefine atom identity, kind, source, target, timing,
  channels, Bleed semantics, or duration semantics.
- Existing manual damage/effect input remains usable in the same action. Manual rows commit with
  separate `manual` provenance and are not C1 override telemetry.
- **Results** shows the accepted current consequences. Player-safe projections exclude suppressed
  atoms and private reasons.
- **Combat Log/history** stores the immutable canonical identity, accepted values, GM delta, actor,
  reason visibility, and independently committed manual provenance.
- Existing reload/persistence and command-backed Clear/undo restore the whole commit coherently.
- A minimal ordinary-Bleed control may expose only existing source-specific transitions from
  Current Action, with the result and immutable command shown in the existing Results and Combat
  Log/history paths. It may not create a new medical rule or second control owner.

## Rule and data contract

- Support exactly six kinds: `damage_floor`, `modifier`, `periodic_loss`, `condition`, `operation`,
  and `information`.
- Narrative is not mechanics. Conditions and operations remain distinct. Mechanically active atoms
  use structured targets.
- Accepted canonical atoms are immutable mechanics authority; adjudication is an instance delta.
- Stun applies equally to OB/Skill, DB/Parry, and Initiative. Separate sources add with no generic
  cap. Stun is not unconsciousness.
- Ordinary Bleed uses exact rational arithmetic, sums active rates before whole-HP application,
  retains exact remainder and any roll-once numerator, starts at following-round SU after a full
  three-second interval, and keeps external and internal lifecycles separate.
- External authoring states are `active -> controlled -> staunched -> resolved`; internal states are
  `active -> stabilised -> resolved`. Any compatibility mapping to current stored #387 names belongs
  in the one structured adapter path.
- The remaining 29 accepted representative keys remain inactive. The other 574 catalogue rows stay
  on the legacy path.
- Non-Bleed `periodic_loss` remains non-executable. Fire/Energy 06/09/10 must not tick.

## Ownership and expected hotspots

Future dispatch must reserve the narrowest exact paths after inspecting the accepted execution
baseline. Expected ownership is:

- `packages/domain/src/encounter/**` for proposal, delta, provenance, persistence, and projection
  contracts;
- `packages/rules-engine/src/encounters/**` for the single structured adjudication/operation path;
- `apps/api/src/routes/encounterRoutes.ts` only for the existing authoritative command seam;
- the existing Combat Current Action Damage/effects, Results, and Combat Log/history components;
- focused domain, rules-engine, API, app, and shared Combat E2E tests.

These are future reservations, not permission for Forgejo #51 to touch them. Avoid unrelated Item,
Encounter, Combat shell, generated table, schema, database, or broad E2E changes.

## Out of scope

- any key beyond the exact five;
- activation of the remaining 29 or any of the other 574 legacy rows;
- non-Bleed periodic-loss runtime;
- new treatment checks, difficulties, equipment rules, assistance, timing, healing, mortality,
  permanent-loss, recovery, or diagnosis mechanics;
- a new Critical/medical/general Combat panel, parallel review flow, navigation change, or Combat
  Manager redesign;
- fixture prose/rule redesign, workbook editing, bulk catalogue normalization, database migration
  without a separately accepted need, `main`, Azure, deployment, or release work.

## Acceptance examples

1. Default accept of `pointed_weapons|arm|02` commits its exact canonical floor, Stun, hand
   impairment, drop operation, and external `1/8 HP/round` source with zero override telemetry.
2. For `blunt|arm|12`, changing Stun from canonical `-4` to permitted `-2` records one Stun delta;
   the floor `5`, hand target, drop, and external `1/2` rate remain immutable.
3. Suppressing `pointed_weapons|chest|07` internal Bleed removes that instance source and records the
   private delta; it cannot convert the source into external Bleed or change `1/4` to another rate.
4. `sharp|head|10` remains unconscious without a numeric Stun; prose editing cannot create one.
5. `sharp|chest|04` keeps stance and parry-only as separate conditions plus a separate drop
   operation; suppressing one does not suppress or transform the others.
6. A manual damage row entered with a five-key proposal co-commits as `manual`, survives reload, and
   is absent from C1 override telemetry.
7. Undo restores the prior encounter state and removes the accepted consequences, manual rows, and
   command projections without mutating immutable history.
8. A Fire/Energy fixture produces no non-Bleed periodic tick.

## Verification

Future Builder verification must include focused schema/domain/rules/API/UI tests, source-key and
privacy assertions, manual co-commit, reload/persistence, stale/conflict behavior, Clear/undo/history,
wide/narrow and keyboard/focus behavior, no duplicate adapter path, and negative tests for every
prohibited mutation. Run repository typecheck, lint, tests, build, and shared Combat E2E proportional
to touched layers. Inspect generated output and Git status.

Independent QA must start from the exact accepted Builder head in a separate visible task, exercise
all five keys and every perspective boundary, and publish evidence without implementing fixes or
merging.

## Git and lifecycle

On authorization, create one clean short-lived `codex/` branch from the exact accepted `dev` SHA.
Push and open a draft PR to `dev` only when the dispatch grants that authority. Builder completion
moves the issue to Ready for Independent QA with exact branch, head, files, and checks. QA approval
moves it to Ready for Merge. Only the Product Owner or authorized integrator may merge. This contract
grants no current Builder, QA, merge, release, or deployment authority.
