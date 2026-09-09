# Architecture decisions

Store durable cross-area architecture and interface decisions here. Start from `docs/decisions/templates/architecture-decision.md`.

Use a record for consequential shared contracts and hard-to-reverse boundaries, not for routine code choices. Record affected ownership areas, hotspot coordination, compatibility, and verification.

## Current records

- [`artifact-storage.md`](artifact-storage.md) — private Campaign Artifact storage and publication boundary.
- [`0002-spatial-scene-rules-boundary.md`](0002-spatial-scene-rules-boundary.md) — future spatial geometry/facts/rules/GM authority chain and map-source-independent scale boundary; no implementation authorized.
- [`0003-campaign-play-lifecycle.md`](0003-campaign-play-lifecycle.md) — accepted Campaign, Scenario, and Encounter lifecycle, access, Combat-kind capability, resumable-context, and terminal-history boundary; implementation remains separately authorized.
- [`0004-canonical-field-equipment-v1.md`](0004-canonical-field-equipment-v1.md) — one durable Item identity, Character equipment aggregate, Scenario projection/reconciliation, ammunition, evidence, and relationship-authority boundary; implementation remains separately authorized.
- [`0005-role-scope-and-campaign-ownership.md`](0005-role-scope-and-campaign-ownership.md) — additive roles, explicit scopes, relationship-derived authority, player-initiated Character joining, and Campaign ownership/security boundaries.
- [`0006-setting-foundation.md`](0006-setting-foundation.md) — reusable Setting authority between generic rules and Campaigns, Setting-bound Characters, repository-defined built-in content, and the post-#26 design sequence; no implementation authorized.
