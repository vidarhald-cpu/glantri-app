# Architecture decision 0002: Spatial scene facts remain upstream of Glantri rules

- Status: approved boundary; future design only
- Date: 2026-09-03 (recovered); original direction predates repository recovery
- Decision owner: Product owner / architecture control plane
- Functional areas: Spatial, maps, Combat, rules engine, GM review
- Related issues/PRs: recovered GitHub #395; Forgejo #7
- Supersedes: none
- Superseded by: none

## Context

Glantri may eventually need a spatial scene and movement model that can use maps from different sources and represent encounters ranging from a small floorplan to a mass battlefield. The subsystem must support reviewable spatial facts without becoming a competing virtual tabletop or a second rules engine.

Repository evidence currently establishes general Combat authority, presentation, and rules-engine ownership. The specific spatial direction was recovered from the former architecture/control-plane discussion; no spatial implementation was integrated.

## Decision

The authority chain is:

```text
scene geometry
  -> derived spatial facts
  -> Glantri rules engine
  -> suggested modifiers
  -> GM review
```

- Scene geometry owns factual queries such as distance, intersection, line of sight, facing relationship, footprint overlap, cover geometry, and elevation relationship once those concepts are defined.
- The Glantri rules engine—not the spatial subsystem—interprets those facts under approved game rules and produces suggested modifiers or consequences.
- The GM reviews the suggestions through established Glantri authority and workflow boundaries.
- Runtime geometry must be explicit and reviewable. Repeated interpretation of background-image pixels is not an authoritative gameplay calculation.

The scene model is map-source independent. A qualified map or Artifact image may be used as a background, but scene scale, coordinates, tokens, facing, footprints, obstacles/cover, and later optional elevation are explicit scene data rather than properties inferred from one vendor or image format.

The model must scale progressively from small rooms/floorplans to large battlefields. Detail may be added only where needed; spatial indexing, on-demand queries, and future formation/squad representation must remain possible without requiring a second representation for large encounters.

The spatial subsystem must not calculate Glantri combat rules, become a second modifier authority, or introduce a competing full-VTT product model.

## Alternatives considered

- **Embed Glantri in a full VTT model:** rejected as the architectural default because it would import a competing product/rules model and couple Glantri to one map source.
- **Interpret map pixels for each rule query:** rejected as an authoritative runtime path because the derived facts are not stable or reviewable.
- **Put rule modifiers directly in geometry code:** rejected because game calculations belong in the Glantri rules engine and require normal rule-decision provenance.
- **Use separate small-encounter and mass-battle engines:** not accepted; the direction is one progressively detailed scene model unless later evidence requires a new ruling.

## Consequences

Before any implementation, the control plane must still decide or commission bounded design work for:

- facing sectors and shield-protection arcs;
- directional armor semantics;
- cover, obstruction, and line-of-sight rules;
- movement, footprint, elevation, and formation semantics;
- rendering/geometry library choice;
- integration with qualified map/Artifact images; and
- the scope and acceptance criteria of any feasibility prototype.

AI may propose map-qualification features, but the GM must confirm gameplay geometry. No image-analysis proposal becomes an authoritative spatial fact without that confirmation.

## Integration and verification

No integration is authorized. A future task must begin with a refreshed exact `dev` baseline, a source-linked rules/design contract, declared ownership across Spatial/Combat/Artifact seams, and explicit scale examples covering both a small floorplan and a large battlefield. Any product implementation requires a Builder and independent QA through the normal orchestrator lanes.

## Release-boundary impact

None. This record changes no code, database, UI, `main`, Azure, production configuration, deployment, or release state. Forgejo #7 remains Design, Future, inactive, and not authorized.
