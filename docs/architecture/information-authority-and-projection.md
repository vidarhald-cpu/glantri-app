# Authority and Information Projection Principle

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
