# Architecture decision 0005: Role, scope, and Campaign ownership

- Status: approved
- Date: 2026-09-08
- Decision owner: Product Owner / control plane
- Functional areas: authentication, Campaign, Character, reusable content,
  information projection
- Related issues/PRs: none; decision recording only
- Supersedes: any wording that treats a global role as Campaign authority or
  permits a GM to pull another user's Character into a Campaign
- Superseded by: none

## Context

Authentication identifies a user, but authorization depends on both the kind
of capability and the object or relationship to which it applies. Glantri also
distinguishes reusable global sources from concrete Campaign game state.
Collapsing those concepts would let a global role bypass Campaign ownership,
Character control, or viewer-specific projection boundaries.

## Decision

### Role and scope are separate

A **role** describes what kind of capability a user may exercise. A **scope**
describes where that capability applies. Roles are additive; they do not
subsume one another.

A user may simultaneously be an application-global Admin, GM of Campaign A,
and controller of Character X. None of those facts grants access to Campaign B.
A global `game_master` role alone never grants access to another GM's Campaign
or private Campaign state. Admin authority likewise does not automatically
make the user a Campaign GM.

The model may later add roles or scopes such as Campaign co-GM, observer,
content editor, rules maintainer, or template curator without redesigning
authentication. This decision does not define those permissions.

### Relationship-derived authority remains authoritative

Character ownership or control, Campaign membership or management, Scenario or
Encounter participation, Artifact entitlement, and other viewer-specific
relationships continue to determine relevant actions and projections. A global
role is not a shortcut around those relationships.

### Player-owned Character joining

A player initiates joining an eligible Campaign with a Character they are
authorized to control. A Campaign-managing GM may not pull another user's
player-owned Character into the Campaign. The managing GM may remove a
Character from their Campaign.

This preserves the distinction between Character ownership/control and
Campaign management. It does not add an invitation, application, approval, or
other joining mechanic beyond existing accepted Campaign rules.

### Templates and concrete Campaign objects

Global or reusable templates may be visible and reusable across Campaigns under
their template-library authority. Using a template in a Campaign creates or
uses concrete Campaign-scoped state.

Visibility of a Bandit template does not expose a Bandit-derived NPC belonging
to another Campaign. Visibility of an Item definition does not expose another
Campaign's concrete Item. The same Campaign boundary applies to concrete NPCs
and reusable entities, Items, Artifacts and maps, Blackboard content, Scenario
and Encounter state, Campaign notes, and other private Campaign information.

### Campaign boundary

A Campaign is an ownership and information-security boundary for concrete
Campaign game state. Authorization for concrete Campaign objects derives from
the viewer's actual relationship to that Campaign or object, not merely from a
global role.

This principle governs Campaigns, Character membership, NPCs and reusable
entities, Items, Artifacts, Blackboard, Scenario and Encounter, and future
Character Knowledge and collaboration work.

## Consequences

- Authorization checks must combine the required capability with the relevant
  Campaign, Character, participant, entitlement, or object relationship.
- Global Admin and GM roles remain useful capability labels but are not
  universal Campaign access grants.
- Reusable-source visibility and concrete-object visibility are evaluated
  separately.
- Future roles and scopes can be added explicitly without changing the login or
  authentication identity model.
- Existing behavior that conflicts with this decision requires a separately
  authorized implementation task; this record alone does not change runtime
  behavior.

## Integration and verification

This is a direct record of explicit control-plane decisions. No Builder, PR, or
independent QA is required for the decision itself. Future implementations must
verify action authorization, information projection, and rendered presentation
for global Admin, managing GM, unrelated GM, Character controller, Campaign
member, and unrelated viewer perspectives as applicable.

## Release-boundary impact

None. This decision does not authorize changes to `main`, deployment, Azure, or
production configuration.
