# Architecture decisions

Store durable cross-area architecture and interface decisions here. Start from `docs/decisions/templates/architecture-decision.md`.

Use a record for consequential shared contracts and hard-to-reverse boundaries, not for routine code choices. Record affected ownership areas, hotspot coordination, compatibility, and verification.

## Current records

- [`artifact-storage.md`](artifact-storage.md) — private Campaign Artifact storage and publication boundary.
- [`0002-spatial-scene-rules-boundary.md`](0002-spatial-scene-rules-boundary.md) — future spatial geometry/facts/rules/GM authority chain and map-source-independent scale boundary; no implementation authorized.
