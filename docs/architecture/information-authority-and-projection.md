# Authority and Information Projection Principle

- Status: approved; recovered as current architecture guidance on 2026-09-03
- Current recovery issue: [Forgejo #9](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/9)
- Historical provenance: GitHub issue `#356`, PR `#357`, accepted head
  `5df9ccc9748dc05a7cf4bd2ce0e72ed5e4a65121`

The historical head received independent QA PASS and control-plane acceptance
but did not reach the recovered `dev` lineage. This document restores its
accepted semantics against the current Forgejo baseline; the historical commit
is evidence, not an implementation commit reused by recovery.

A client receives only the information required for its permitted actions and
intended view.

Server-side rejection of unauthorized actions is necessary but insufficient.
Unauthorized information must not be included in payloads.

This principle makes the information-flow and privacy requirements in the
[Glantri Product & Presentation Principles](../product/product-presentation-principles.md)
operational for architecture, task shaping, implementation, and QA. The product
principles remain authoritative for user-facing privacy and safe workflow truth;
this document defines the distinct boundaries and evidence needed to enforce
them. It does not define a projection framework or redesign authorization.

## Separate concepts

- **Canonical authority** is the server/domain source of truth for which facts
  and state exist.
- **Action authorization** decides whether a user may perform an action against
  canonical state.
- **Information projection** decides which facts a particular viewer may
  receive from canonical state.

These concepts may use the same canonical identities, ownership, involvement,
visibility, revision, and workflow facts, but they answer different questions.
Passing an action-authorization check does not imply visibility of every fact
used by that action. Being authenticated, controlling one participant, or being
involved in the same Campaign, Scenario, Encounter, or contest does not
automatically entitle a viewer to another participant's executable or private
state.

## Role, scope, and relationship authority

A role describes a kind of capability; a scope describes where that capability
applies. Roles are additive and do not subsume each other. A global
`game_master` role does not grant access to another GM's Campaign, and
application-global Admin authority does not automatically confer Campaign GM
authority.

Concrete authority continues to derive from the relevant relationship:
Campaign management or membership, Character ownership or control, Scenario or
Encounter participation, Artifact entitlement, or another explicitly accepted
viewer relationship. Do not use a global role as a shortcut around those
relationships.

Reusable templates and concrete Campaign objects also have separate
projections. Template-library authority may expose a reusable source without
exposing an NPC, Item, Artifact, Blackboard entry, Scenario, Encounter, note,
or other concrete state created in another Campaign. A Campaign is the
ownership and information-security boundary for its concrete game state.

The complete approved boundary, including player-initiated Character joining,
is recorded in
[Architecture decision 0005](../decisions/architecture/0005-role-scope-and-campaign-ownership.md).

## Setting and Campaign authority

A Setting is reusable world-content authority between generic rules and
Campaigns. Generic Skills declare contextual needs without embedding particular
societies, languages, scripts, legal systems, regions, or other world instances.
The Setting supplies those reusable definitions.

Visibility of Setting content does not expose concrete Campaign state. A
Campaign may select or filter reusable Setting definitions, but an NPC, Item,
Artifact, Blackboard entry, Scenario, Encounter, note, or other mutable object
created or used in Campaign A remains inside Campaign A's ownership and
information-security boundary. A Character is created within a Setting and may
join only a compatible Campaign under the accepted relationship-derived join
authority.

The built-in Glantri Setting is repository-defined canonical content. Runtime
databases may reference or instantiate it but do not become its sole authority.
See [Architecture decision 0006](../decisions/architecture/0006-setting-foundation.md).

## Projection rules

1. Player payloads are minimal by default. Add a fact only for a named permitted
   action or intended view.
2. Do not transmit hidden or protected information and rely on UI omission,
   conditional rendering, CSS, or client-side filters to hide it.
3. Private facts must be absent from unauthorized DTOs, API/read-model payloads,
   serialized responses, and generated HTML or embedded client state.
4. Executable state belonging to another Player is not exposed unless an
   explicit accepted contract requires that viewer to receive it. A viewer's
   involvement in the same workflow is not sufficient by itself.
5. Preserve only the safe shared workflow truth needed for collaboration or
   progression, such as a generic pending/completed status or an approved public
   outcome. Redaction must not make a completed process appear pending, but the
   residue must not identify or reconstruct the protected input, owner, value,
   or executable descriptor.
6. Ambiguous visibility fails closed. Record `Needs decision` when the intended
   audience is materially unresolved; do not infer disclosure from technical
   availability.
7. Enforce projection at the server/domain serialization boundary appropriate
   to the protected fact. Avoid late, ad hoc client filters and parallel
   viewer-unaware response paths.

## GM inspection of player-facing surfaces

A GM may inspect a participant through a player-facing Action or Combat
surface, but inspection is a view, not a grant of that participant's authority.
A GM viewing a player-facing Action/Combat surface for inspection must not act
through player controls as though they were that participant. GM actions belong
on GM-authorized command paths. Read-only inspection remains valid; player
action controls do not.

The control plane ratified this rule on
[Forgejo #433](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/433)
when accepting
[PR #496](http://127.0.0.1:3001/recovery-admin/glantri-app/pulls/496), and
recorded that the earlier ability for a GM to use player Action controls as the
inspected participant is not an intended capability and does not need to be
preserved. It is recorded here, through
[Forgejo #498](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/498),
because it is a negative rule: code that complies with it shows nothing to a
reader, so a rule left only in the ratifying issue is easily lost.

The hazard is not visible from either side alone. Player-facing components are
written for a viewer who controls a participant. When such a component is
rendered for a GM with an inspected participant, it can make that participant
the controlled participant, and its player action handlers then act as them.
The roleplay Action surface, for example, builds its player view with the
inspected participant as `controlledScenarioParticipantId`. Nothing in the
GM-side caller looks like an action path and nothing in the player component
looks GM-aware, yet together they let a GM act as a player.

Enforcement is opt-in and defaults to the unsafe value. The shared player
components accept a `readOnlyInspection` prop that defaults to `false`:
`PlayerRoleplayingEncounterScreen` in
`apps/web/src/features/roleplay/RoleplayEncounterScreens.tsx` derives
`canUsePlayerActions` from it, and `ScenarioPlayerCombatPageContent` gates its
declaration and roll handlers on it. Before PR #496 the prop existed but no
production caller passed it, so a GM inspecting a participant on the Action
view could clear and make rolls as that player. PR #496 did not remove the
mechanism; it passed the missing prop on the GM inspection branch of the Action
view in `CampaignWorkspaceShell.tsx`. Compliance is a single prop at the call
site, and its absence looks like nothing at all.

Accordingly:

1. Any surface that renders a player-facing component for a GM with an
   inspected participant must pass `readOnlyInspection`. Omitting it fails
   open: the GM receives working player controls for the inspected participant.
2. The flag disables only the controls a component wires to it. A nested panel
   that issues its own commands does not inherit it and must be checked
   separately. PR #496 recorded that the player Combat surface's nested Item
   interaction controls do not honour its inspection flag, which is why Combat
   is not composed into the GM's Action view.
3. A GM action the product requires belongs on a GM-authorized command path,
   such as the GM proxy commands of the
   [GM Combat Round Manager](../product/combat-panel-contract.md#2-gm-combat-round-manager),
   not on a player control reached through inspection.

QA reviewing a GM inspection entry point checks the rendered surface as the GM:
the read-only view of the inspected participant remains usable, and every player
action control for that participant, including those in nested panels, is
disabled or absent.

## Perspective review

Information projection is viewer-specific. At minimum, a role-sensitive or
multiplayer contract reviews these perspectives:

| Perspective                   | Projection question                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GM                            | Which complete facts and review/proxy state is the GM explicitly permitted to receive, and what must remain out of player-facing responses? |
| Owning or acting Player       | Which own inputs, executable state, calculations, and outcomes are required to act and understand the result?                               |
| Other involved Player         | Which safe shared status or outcome is required without exposing the acting Player's private inputs or executable state?                    |
| Unauthorized user or observer | Which public fact, if any, may remain without confirming protected identity, existence, value, or workflow state?                           |

Check each materially different perspective at the meaningful stages of the
workflow: before action; pending or current; after resolution; reload,
reconnect, or polling; and stale or conflicting state when relevant. Add
historical, undo/supersession, visibility-change, owner/non-owner, or
hidden/revealed stages when they can change the permitted projection. A clean
fresh response does not prove that cached or delayed responses revoke protected
facts correctly.

## Builder guidance

The [Implementation Task Contract](../process/task-contract.md) for work that
handles protected facts identifies:

- each sensitive fact, including private values, identities, existence signals,
  executable descriptors, calculations, notes, and authority-only fields;
- the intended recipients and materially different perspectives;
- the server/domain DTO or serialization boundary that enforces projection;
- the separate action-authorization boundary;
- the safe shared residue, if any, needed after redaction; and
- concrete negative payload examples: keys, values, identities, or relationships
  that must not be present for each unauthorized perspective.

Implement projection and action checks from shared canonical facts where that
keeps them consistent, but do not collapse them into one authority. Exercise all
relevant response paths and state transitions rather than assuming one safe DTO
or page proves every consumer is safe. Do not introduce a generic projection
framework or shared projection library merely to satisfy this guidance.

## QA guidance

Independent QA follows the
[Builder and QA execution procedure](../process/agent-execution.md) and evaluates
three separate gates for protected facts:

1. **Action authorization and mutation:** unauthorized attempts fail with zero
   mutation and privacy-equivalent errors where required.
2. **Information projection:** protected keys, values, identities, relationships,
   and executable state are absent from server/API payloads, DTOs, read models,
   serialized responses, generated HTML, and embedded client state.
3. **Rendered presentation:** protected facts and controls are absent from the
   DOM and other user-visible output while approved safe workflow truth remains
   understandable.

A `403` or `404`, zero mutation, or no visible control does not pass privacy when
the response has already exposed a protected fact. Likewise, a clean DOM does
not prove a safe payload.

Use negative payload key, value, identity, and relationship checks together with
role-matrix evidence. Check blank or defaulted authority-only fields when their
presence itself reveals private shape or capability. Where applicable, inspect
fresh load, mutation responses, generated HTML/serialized bootstrap state,
reload/reconnect, polling, visibility revocation, and stale or out-of-order
responses. Report an unauthorized disclosure as a blocking privacy finding,
separately from authorization-error and zero-mutation results.

## Motivating evidence

These cases motivate the durable rule; they do not narrow it to Scenario or
Combat code:

- [Issue #342](https://github.com/vidarhald-cpu/glantri-app/issues/342) and
  [PR #351](https://github.com/vidarhald-cpu/glantri-app/pull/351) showed that a
  safe primary response did not make alternate and cached player projections
  safe. QA had to inspect both payloads and DOM across fresh load, polling,
  visibility changes, reload, and reconnect before the privacy boundary passed.
- [Issue #352](https://github.com/vidarhald-cpu/glantri-app/issues/352) and
  [PR #353](https://github.com/vidarhald-cpu/glantri-app/pull/353), especially the
  [independent QA privacy finding](https://github.com/vidarhald-cpu/glantri-app/pull/353#issuecomment-5386700173),
  showed that an involved Player could receive another Player's executable state
  even though the UI omitted the control and the server rejected a forged action.

The architectural lesson is the same in both cases: canonical authority, action
authorization, information projection, and rendered presentation must agree,
but each requires its own contract and evidence.

The current recovery identity and future QA/integration state are tracked in
[Forgejo #9](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/9).
