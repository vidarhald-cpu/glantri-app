# Functional ownership and integration hotspots

These are coordination boundaries for concurrent development, not necessarily permanent package boundaries. Agents may read the entire repository but normally write only inside the task's declared area.

The [canonical development operating model](../process/development-operating-model.md)
owns role authority, parallelism, dispatch, and lifecycle. This document owns
functional-area and reserved-hotspot definitions.

## Functional areas

| Area                              | Primary responsibility                                                                             | Typical paths/surfaces                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rules and content governance      | Source evidence, mappings/imports, ambiguity, approved implementation rulings, curated content     | `docs/rules/`, `docs/source/`, `docs/decisions/rules/`, `packages/content`, `packages/importers` |
| Character lifecycle               | Character generation, sheet/editing, advancement, skills, professions, societies                   | Chargen and character web/API features; corresponding domain/database services                   |
| Equipment and physical state      | Inventory, loadout, armor, weapons, encumbrance, movement, equipment-derived values                | Equipment web/API features; equipment/domain/rules/database services                             |
| Campaign and narrative encounters | Campaigns, scenarios, participants, roleplay, non-combat encounter flows                           | Campaign/scenario web/API features and services                                                  |
| Combat engine                     | Canonical combat state, progression, commands, calculations, persistence, command API              | Domain/rules/database/API combat implementation                                                  |
| Combat experience                 | GM/player combat UI, history, tracker, read models, synchronization, presentation                  | Combat web features, presentation projections, encounter client synchronization                  |
| Platform                          | Authentication, shared infrastructure, build/toolchain, cross-cutting API/database concerns, CI/CD | Auth, shared config/contracts, root tooling, workflows, infrastructure                           |

Combat engine and combat experience are separate ownership areas. Their boundary should be explicit command, mutation-response, event, synchronization, and read-model contracts rather than assumptions duplicated in handlers and React state.

## Reserved integration hotspots

The following require declaration in the task contract and scheduling by an integration owner:

| Hotspot                                                                           | Coordination risk                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Prisma schema and migrations                                                      | Ordering, data compatibility, deployment coupling   |
| Package root exports and shared API contracts                                     | Broad compile/runtime impact across areas           |
| `apps/api/src/routes/scenarios/encounterRoutes.ts` and related route registration | Large shared API orchestration surface              |
| `packages/domain/src/encounter/combatRoundManager.ts`                             | Canonical combat progression and state              |
| Encounter API clients, live synchronization, and mutation responses               | GM/player consistency and backward compatibility    |
| Campaign workspace/scenario orchestration                                         | Shared shell across roleplay and combat experiences |
| Root package/toolchain/configuration files                                        | Repository-wide developer and CI behavior           |
| `.github/workflows/` and `infra/`                                                 | Release and production boundary                     |

This list is intentionally surface-oriented. If a refactor replaces a hotspot, update this document in the same PR.

## Coordination rules

1. One active task owns a hotspot at a time unless a written integration plan assigns a safe split.
2. Cross-area work names one integration owner, even when several agents implement independent stages.
3. Shared contract/schema changes are decided first and land before dependent implementations where practical.
4. Each stage remains compatible with the accepted baseline or documents an explicit stacked merge order.
5. Product-rule changes link an approved rule decision; architectural boundary changes link an architecture decision.
6. UI and engine agents do not independently invent parallel representations of the same combat fact.
7. Platform/release surfaces never broaden an implementation task into production authority.
8. Apply the operating model's parallelism ceiling and keep unrelated lanes
   running when one lane blocks. Serialize only declared hotspots or real
   dependencies, with explicit ownership and merge order.

## Path ownership is not exclusive code ownership

These areas guide coordination and triage. They do not prevent a coherent vertical slice from crossing layers. A vertical slice may touch domain, API, presentation, and tests when that is the smallest behaviorally complete change; it then requires declared cross-area ownership and, when unusually large, an integration plan.
