# Glantri strategic development areas

This overview helps product owners, contributors, and agents find current strategic
direction and existing proposals before suggesting or claiming work. It is a portfolio
snapshot, not a dispatch ledger or implementation contract.

**Observed:** 2026-08-23 at
`origin/dev@179491fcd7beef02a6860a59e6bb1018a49eb76d`.

GitHub issues and pull requests are the live, durable source of truth for status,
dependencies, exact baselines, ownership, and authorization. They override this summary
whenever it becomes stale. Status terms below follow the
[development control plane](../process/control-plane.md).

## Current strategic focus

Glantri is currently focused on:

- completing a reliable Scenario → Encounter → Combat session flow;
- establishing secure Artifact and content infrastructure;
- building the foundations for player collaboration; and
- validating the first complete playable Scenario with a GM and players.

These directions guide prioritization. They do not authorize implementation by
themselves.

## Active development areas

An **active development area** is a strategic category receiving current attention. It
does not necessarily have an `ACTIVE` Builder claim. Only a live issue-level claim made
under the control-plane protocol means an execution lane is occupied.

| Area                         | Purpose                                                                                                                                                                                                                       | Live status at observation                                                                                                                                                                                                                                                                                                          | Relevant records                                                                                                                                                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenario/session play        | Make the Scenario the usable adventure context that carries a group into Encounter and Combat play and safely back to persistent session state.                                                                               | The Scenario happy path is **integrated and inactive**. Complete Combat validation is **blocked, not authorized, and inactive** at the first player-owned attack until #352 is repaired, independently accepted, and integrated.                                                                                                    | [Pilot initiative #341](https://github.com/vidarhald-cpu/glantri-app/issues/341), [integrated Scenario path #342](https://github.com/vidarhald-cpu/glantri-app/issues/342), [blocked validation #213](https://github.com/vidarhald-cpu/glantri-app/issues/213) |
| Combat validation and repair | Prove that a GM and two separately controlled players can complete the full Combat path, then isolate and repair concrete blockers without widening the validation lane.                                                      | #213 remains blocked by #352. #352 and draft PR #353 are in an **ACTIVE Builder repair** after independent QA found a cross-player projection/privacy defect. The repair head is `33ffcc8f8097ad7b7146a0e6f4b396ec79124fd4`; exact-head checks are running, and a new Builder handoff plus fresh independent QA are still required. | [validation #213](https://github.com/vidarhald-cpu/glantri-app/issues/213), [repair #352](https://github.com/vidarhald-cpu/glantri-app/issues/352), [draft PR #353](https://github.com/vidarhald-cpu/glantri-app/pull/353)                                     |
| Artifact Storage preparation | Establish a secure Campaign-owned content boundary for maps, images, portraits, documents, and handouts that Scenario and Blackboard work can consume without exposing storage locators or creating a generic Asset platform. | #350 is **Ready, Not Authorized, and Inactive**. Its contract is complete, but no Builder may claim or implement it without a separate authorization and refreshed dispatch gate.                                                                                                                                                   | [Artifact Storage #350](https://github.com/vidarhald-cpu/glantri-app/issues/350)                                                                                                                                                                               |

## Near-term planned areas

### Artifact Storage

[Issue #350](https://github.com/vidarhald-cpu/glantri-app/issues/350) is the next planned
secure content foundation. It must be separately authorized, implemented, independently
QA-reviewed, accepted, and integrated before downstream work can treat its Artifact
identity and authenticated content boundary as available. `Ready` does not grant that
dispatch.

### Blackboard foundation and workspace

The [Blackboard foundation design #318](https://github.com/vidarhald-cpu/glantri-app/issues/318)
is accepted as design, but its implementation remains **Design only, Not Authorized, and
Inactive**. #350 must integrate first. The media trust/input boundary in #318 must then be
refreshed against the accepted Artifact contract and the exact current `dev` baseline.
#318 does not become implementation-ready or dispatchable until its remaining decisions
and implementation contract are complete and separately authorized.

The [Blackboard workspace #319](https://github.com/vidarhald-cpu/glantri-app/issues/319)
remains **Blocked, Not Authorized, and Inactive** downstream of an accepted and integrated
#318 foundation. Neither this sequence nor strategic priority authorizes a Builder claim.

## Future strategic ideas

These are unscheduled directions. A linked record may contain useful design work, but its
own live status governs and none of these entries grants implementation authority.

### Player-authored campaign objects

- **Concept:** let players propose objects and other Campaign creations, with deliberate GM
  review establishing canonical content.
- **Why it matters:** it makes world-building collaborative while preserving GM authority,
  provenance, privacy, and rule boundaries.
- **Dependencies:** the product rulings, rule decisions, privacy model, Knowledge boundary,
  and refreshed technical design identified by the proposal.
- **Current status:** [#354](https://github.com/vidarhald-cpu/glantri-app/issues/354)
  is **Draft for review/discussion — not Ready and not Authorized**. It is a requirements
  description, not an implementation task.

### Knowledge system

- **Concept:** represent what each Character has learned as a durable relation distinct
  from possession, publication, and what a player happened to see.
- **Why it matters:** discoveries, secrets, and later corrections need perspective-safe
  continuity across sessions and controller changes.
- **Dependencies:** approved audience and knowledge semantics, canonical object/reference
  identity, current-controller authorization, and privacy-safe projections.
- **Current status:** [#257](https://github.com/vidarhald-cpu/glantri-app/issues/257)
  is ready for product-design work only; implementation is not Ready or Authorized.

### Campaign object and availability model

- **Concept:** define how Campaign objects are identified, made safely available in a
  Scenario, owned or referenced, and projected without collapsing Items, Artifacts,
  knowledge, and player-created resources into one generic type.
- **Why it matters:** Scenario, Blackboard, Creations, and future resource workflows need
  stable identity and availability without duplicate domain authority.
- **Dependencies:** evidence from the accepted Scenario boundary, Artifact Storage,
  Knowledge design, and object/ownership decisions in #354 and the
  [three-domain architecture map #340](https://github.com/vidarhald-cpu/glantri-app/issues/340).
- **Current status:** strategic architecture topic only. No dedicated Ready or Authorized
  implementation contract was found.

### Structured conditions

- **Concept:** model numeric and nonnumeric Combat consequences as durable, typed,
  explainable conditions with lifecycle and provenance.
- **Why it matters:** Criticals, accumulated damage, continuing effects, and GM/player
  presentation need one authority rather than generic prose or competing modifiers.
- **Dependencies:** accepted pilot consequence evidence, closed vocabulary and lifecycle
  decisions, privacy rules, and compatibility with downstream Combat consumers.
- **Current status:** [#349](https://github.com/vidarhald-cpu/glantri-app/issues/349)
  is **Design only, Not Authorized, and Inactive**; material decisions remain open.

### AI-assisted recaps

- **Concept:** create draft recaps from structured Scenario, Encounter, skill, and Combat
  history for GM review and deliberate publication.
- **Why it matters:** concise reviewed continuity can help groups resume play without
  making generated text the source of truth.
- **Dependencies:** reliable structured history, audience-safe projections, an explicit GM
  approval/publication workflow, and provider/governance decisions.
- **Current status:** idea only; no dedicated implementation proposal was found. The
  accepted [Scenario path #342](https://github.com/vidarhald-cpu/glantri-app/issues/342)
  preserves structured history as the source of truth, while current Blackboard work
  permits only GM-approved recap text and excludes AI generation.

### Artifact Studio and content workflows

- **Concept:** give creators a workspace for authoring, revising, approving, organizing,
  and publishing Campaign content with durable provenance.
- **Why it matters:** secure storage becomes useful when content can move through a clear
  creative workflow without silently becoming canonical or public.
- **Dependencies:** integrated Artifact Storage, versioned content/reference contracts,
  approval and audience rules, and evidence from concrete Scenario and Blackboard uses.
- **Current status:** idea only; no dedicated implementation contract was found. #350 is a
  storage foundation, not authorization for an Artifact Studio.

### External contributor and content ecosystem

- **Concept:** support bounded contributor-created content and extensions through stable,
  reviewable contracts rather than direct access to canonical state.
- **Why it matters:** Glantri can grow through outside creativity while keeping validation,
  provenance, compatibility, and approval explicit.
- **Dependencies:** versioned public contracts, security and governance rules, target-domain
  validation, and mature contribution/review workflows.
- **Current status:** strategic direction in
  [#340](https://github.com/vidarhald-cpu/glantri-app/issues/340); no implementation is
  authorized and no dedicated implementation contract was found.

### Economy and value systems

- **Concept:** define value, budgets, ledgers, commitments, ownership, and resource costs
  for player-created or controlled Campaign resources.
- **Why it matters:** durable creations and organizations need explainable value and change
  history without hiding economic rules in individual features.
- **Dependencies:** product/rule decisions for units and pricing, the Campaign
  object/ownership model, worked examples, provenance, and rules-engine boundaries.
- **Current status:** design idea only. #354 discusses Creative points and #340 identifies
  future resource-ledger design, but neither authorizes a general economy implementation.

### Player Universe

- **Concept:** let players create, acquire, control, and develop persistent resources such
  as buildings, retainers, organizations, businesses, estates, and units.
- **Why it matters:** it extends player agency beyond a Character sheet into durable
  participation in the Campaign world.
- **Dependencies:** accepted ownership/control/visibility and lifecycle scenarios, economy
  decisions, canonical reference boundaries, and evidence about composition versus any
  future shared resource abstraction.
- **Current status:** architecture/decomposition direction in
  [#340](https://github.com/vidarhald-cpu/glantri-app/issues/340), not a Ready or Authorized
  implementation initiative.

## Agent guidance

- Idea, Proposal, and Design records are not implementation tasks.
- Before suggesting or creating work, search for existing issues and proposals; report and
  link the closest records instead of silently duplicating them.
- New ideas enter through proposal/design and architecture review before an implementation
  contract is prepared.
- `Ready` means a contract is complete and current. It is not dispatch permission.
- Only an exact `Authorized` record for the bounded scope permits a Builder to claim the
  lane. Work becomes `Active` only through the normal issue-level `ACTIVE` protocol.
- Re-read the live issue, linked PR, and current `origin/dev` before proposing, claiming,
  or reporting status. Live GitHub state overrides this observed snapshot.
