# Situation view

The player Situation body of the Scenario Play arena: three narrow
People / Items / Artifacts selector rails with simple search, a dominant
Inspector, and full-width Activity below.

Controlling contracts: [Player Play V1](../../../../../../docs/architecture/player-play-v1.md)
§8, §9 and §13, and
[Scenario Play Workspace](../../../../../../docs/architecture/scenario-play-workspace.md)
§4.5, §5 and §8.

## Responsibilities

| File                        | Responsibility                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `ScenarioSituationView.tsx` | Composes the rails, the Inspector and Activity; owns selection state and the Artifact load. |
| `SituationRail.tsx`         | One narrow selector rail: heading, simple search, optional simple filters, sparse rows.     |
| `SituationInspector.tsx`    | The generic visual/detail area, and the click-through to an existing canonical full view.   |
| `SituationActivity.tsx`     | Full-width presentation of `session.history`.                                               |
| `playerArtifactSource.ts`   | The single boundary between the Artifacts rail and the Artifact data it presents.           |

## Boundaries

- **It presents; it does not disclose.** Every rail reads an existing
  projection unchanged. `resolveScenarioAvailableObjects` already omits rows a
  player may not see, and the client DTO deliberately carries no `visibility`
  field — a player seeing no row for a present-but-hidden Item is the required
  behaviour. Nothing here re-derives or supplements that decision.
- **One event model.** Activity presents `projectScenarioObjectiveHistory`'s
  output and renders only distinctions the existing event types already
  express. Player Play V1 §9.4 records that adding an event type is
  floor-class and part of no slice.
- **Vocabulary.** Reveal, Share and Place/Remove are three distinct operations
  (PO-SPW-2). This view performs none of them, so none of that vocabulary
  appears here; `situationVocabulary.test.ts` guards it.
- **No state preservation.** Switching Play views still unmounts this view.
  Preservation is a separate later slice.
- **GM surfaces are untouched.** `ScenarioSessionPanel` remains the GM
  Scenario-detail and session-management body and is not changed by this view.
