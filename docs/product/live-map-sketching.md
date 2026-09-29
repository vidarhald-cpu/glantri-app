# GLANTRI — LIVE MAP SKETCHING

## Editor-specific authoring workflow

**Portfolio area:** #118 Maps / Spatial Play\
**Architecture status:** Recorded, 2026-09-29\
**Implementation status:** Future / activation-gated — **no implementation,
dispatch or dependency installation is authorized by this document**

---

## 1. What this document is, and is not

This document records the **editor-specific authoring workflow** for drawing a
Map inside Glantri during live play.

> **The Map model is not defined here.** It is defined by
> [Maps / Spatial Play](../architecture/maps-spatial-play.md), which is the
> controlling common Map contract.

Everything common — Map identity, the coordinate frame, layers, placement,
disclosure, player presentation and persistence — lives there and is referenced
from here. **Do not restate it in this document, and do not let this document
diverge from it.**

| Concern                                             | Controlling home                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One Map facility across authoring paths             | [Maps §2.3](../architecture/maps-spatial-play.md#23-one-map-facility-many-authoring-paths)                                                                                                        |
| Coordinate frame and expansion                      | [Maps §6](../architecture/maps-spatial-play.md#6-coordinate-model)                                                                                                                                |
| Retained arrangements, explicit placement, cameras  | [Maps §7.8–§7.10](../architecture/maps-spatial-play.md#78-retained-placement-arrangements)                                                                                                        |
| Layers, and the published image as a representation | [Maps §8.1](../architecture/maps-spatial-play.md#81-layers-carry-visual-representations) and [§8.3](../architecture/maps-spatial-play.md#83-a-visual-representation-may-be-authored-in-app)       |
| Disclosure, and the D1 ruling                       | [Maps §8.2.1](../architecture/maps-spatial-play.md#821-the-d1-disclosure-ruling--a-layer-is-a-disclosure-unit) and [Maps §9](../architecture/maps-spatial-play.md#9-visibility-and-sharing-model) |
| The private-source versus published-image boundary  | [Maps §13](../architecture/maps-spatial-play.md#13-editing-and-update-model)                                                                                                                      |
| Exclusions                                          | [Maps §17](../architecture/maps-spatial-play.md#17-explicitly-deferred-tactical-and-spatial-mechanics)                                                                                            |
| Server-side projection authority                    | [Authority and Information Projection](../architecture/information-authority-and-projection.md)                                                                                                   |

---

## 2. Product outcome

A GM can improvise a useful rough Map during live play without leaving Glantri
and without manually exporting and uploading a file. The GM draws walls,
openings, windows, stairs and other simple features, publishes when ready, and
uses the **ordinary** Map positioning controls to place and move Characters,
People and objects.

The normal target is a useful room or small location in roughly one or two
minutes. **That is a usability target to validate, not a measured result.**

> **The drawing editor produces a visual representation of an ordinary Map. It
> does not become Glantri's Map, marker, disclosure or Combat engine.**

---

## 3. Workflow

1. Open a new sketch within the current Campaign, or edit drawing content
   associated with an existing Map.
2. Begin drawing without selecting a Place, building a Scenario package or
   supplying technical metadata. A provisional display name can be refined
   later.
3. Work on a blank surface, or against an imported image used as reference.
4. Publish when ready, to the intended layer and its **explicit eligible
   audience**
   ([Maps §8.2.1](../architecture/maps-spatial-play.md#821-the-d1-disclosure-ruling--a-layer-is-a-disclosure-unit)).
5. Add Characters, People and objects **explicitly**, through the ordinary
   positioning controls, and move placed markers live
   ([Maps §7.9](../architecture/maps-spatial-play.md#79-placement-is-explicit-and-marker-movement-is-immediate)).
6. Extend the drawing as exploration proceeds, and publish another update when
   ready.
7. Switch to another Map and later return, without reconstructing the previous
   arrangement
   ([Maps §7.8](../architecture/maps-spatial-play.md#78-retained-placement-arrangements)).

**No polished-Map promotion step exists.** Improving the picture retains the
same Map identity
([Maps §4](../architecture/maps-spatial-play.md#4-map-identity-model)).

> **Draft persistence must not require a canonical Sketch object or a
> Scenario-owned Map type.** Neither exists, and neither is authorized.

### 3.1 Minimal tools

Freehand/pencil; straight line; rectangle; text; select, move and delete;
undo/redo; a small choice of stroke colours and thicknesses; pan and zoom.

Doors, windows and stairs may initially be pencil marks. Dedicated stamps are an
optional later refinement if playtesting shows a speed benefit, and a symbol
library is not required.

> **These shapes depict the fiction. They carry no collision, movement, distance
> or rules-engine meaning**
> ([Maps §2.2](../architecture/maps-spatial-play.md#22-map-purpose--illustration-not-authoritative-rules-state)).

**Drawing undo operates on the private drawing only.** It never reverses a
marker movement and never changes game state.

### 3.2 Full-page and tablet use

The GM can expand the editor to fill the application content area, retaining
compact drawing tools and publication controls. Browser or OS fullscreen is not
required, and exiting the view preserves work.

> **The full-page editor is a presentation of the same authoring workflow, not a
> different Map.**

Comfortable pen drawing, palm handling, erasing, finger navigation and zoom must
be validated on a real tablet, browser and stylus combination during evaluation.
Desktop mouse use remains supported. **Essential operations must not require
hover, right-click or a keyboard.** Pressure sensitivity, handwriting
recognition and stylus-button shortcuts are not requirements, and **no native
iPad application is in scope**
([Maps §17](../architecture/maps-spatial-play.md#17-explicitly-deferred-tactical-and-spatial-mechanics)).

---

## 4. The editor-to-Map boundary

```text
Private GM editable source + referenced assets
                 |
           explicit Publish
                 v
Rendered image + its Map-space alignment
                 |
                 v
Ordinary visual Map layer / Artifact lifecycle
                 |
       normal Glantri server-side projection
                 v
Each viewer's own composed presentation + separately managed markers
```

| State                                                       | Owner                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Editable drawing, engine/version information, source assets | private GM authoring storage — enough to reopen the drawing         |
| Published image                                             | ordinary visual representation and Artifact lifecycle               |
| Image origin and extent in Map space                        | the common Map coordinate frame                                     |
| Layer identity, ordering, eligibility and knowledge         | the Map and disclosure model                                        |
| Latest placement arrangement                                | common per-Map positioning state                                    |
| Viewer pan and zoom                                         | individual view state — never drawing content, and never disclosure |

**This is a conceptual boundary, not a mandated database schema.** Engine-specific
editable data may remain engine-specific. It must **not** become canonical
Character, Item, Map identity or knowledge data.

> **Players receive the published pixels, never the private editable document.**
> The published image must contain no embedded editable scene data.

### 4.1 Alignment and expansion

Publish the image with the exact Map-space rectangle its pixels represent,
accounting for export padding and resolution. If a sketch grows leftward its
image origin may change, but **existing content and marker coordinates retain
their Map-space positions**, and the image is never stretched into a fixed
full-Map rectangle
([Maps §6](../architecture/maps-spatial-play.md#6-coordinate-model)).

**The editor's current zoom and pan must not affect the exported scale, crop or
Map alignment.**

Practical image dimensions, export duration and memory use require measurement
during evaluation. Distant content must not be silently lost and labels must not
become unreadable. Tiled or composite export is **not** added by this document
([Maps §8.1](../architecture/maps-spatial-play.md#81-layers-carry-visual-representations)).

### 4.2 Publication and failure

- **Saving the private source does not activate a published Artifact revision.**
  Only publication updates the player-facing representation.
- **Image and alignment metadata change together**, coherently.
- **A failed export, upload or publication leaves the previous published image
  usable and the private draft recoverable**, and a retry cannot leave image and
  alignment mismatched.
- Publishing refreshes eligible viewers of that Map **without resetting any
  camera** and without switching anyone away from another Map
  ([Maps §7.10](../architecture/maps-spatial-play.md#710-viewer-camera-is-individual-view-state)).
- Reopening a Map obtains its latest **permitted** composed presentation, exactly
  as any other Map does.

Simultaneous editing of one drawing is out of scope. If more than one GM session
opens the same source, silent overwrites must be prevented.

---

## 5. Recorded product direction

| ID  | Direction                                                                                     |
| --- | --------------------------------------------------------------------------------------------- |
| S1  | Drawing happens inside Glantri and supports improvisation during play.                        |
| S2  | Sketches use the common Map facility, not a second sketch-Map domain.                         |
| S3  | The editor retains an editable source privately and publishes an ordinary image into a layer. |
| S4  | The drawing space can expand; adding space must not shift existing content or placements.     |
| S5  | Each Map retains its latest placement arrangement across navigation, imported Maps included.  |
| S6  | GM and players have independent pan and zoom.                                                 |
| S7  | Drawing edits remain private until the GM publishes.                                          |
| S8  | Marker movements update permitted viewers immediately, independently of drawing publication.  |
| S9  | Nothing is placed automatically; placement is a deliberate act.                               |
| S10 | Pen/tablet drawing and a full-page GM drawing view are requirements.                          |

S2 and S4 through S9 are recorded as common Map behaviour in
[Maps / Spatial Play](../architecture/maps-spatial-play.md) and are **not**
re-decided here.

---

## 6. Engine posture — no canonical mandate

> **This contract mandates no editor and no drawing library.**

The intended **first authorized implementation phase** is a **bounded evaluation
of a pinned released version of one candidate editor, behind the
image-publication boundary of [section 4](#4-the-editor-to-map-boundary)**. Such
an evaluation requires its own authorization; **nothing here authorizes
installing a dependency.**

Criteria such a candidate must meet:

- an embeddable editor with the [section 3.1](#31-minimal-tools) tool set;
- save and restore of a private editable source;
- image export with **explicit control over export bounds**, so Map-space
  alignment can be published coherently;
- transparent output where an overlay over imported imagery is wanted;
- acceptable pen, palm and zoom behaviour on the actual target tablet;
- a licence compatible with the project, with any required notices retained, and
  no required hosted collaboration service.

> **If the evaluation fails, the Map architecture recorded in
> [Maps / Spatial Play](../architecture/maps-spatial-play.md) is unchanged**, and
> another editor remains evaluable against the same boundary. The boundary exists
> precisely so that engine choice is reversible.

Costs that remain in any case: integration and independent verification; private
source and published image storage and transfer; dependency maintenance;
saved-format compatibility; and browser and device regression checks.

---

## 7. Acceptance examples for future authorized work

These illustrate the recorded contract. **They authorize nothing.**

| ID  | Example and expected result                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The GM creates a blank sketch and draws a room with a door and stairs without leaving Glantri or uploading a file.                                  |
| A2  | Private drawing changes are absent from player responses and images until publication; the previous image remains usable meanwhile.                 |
| A3  | Publishing refreshes eligible viewers of that Map, preserves each camera, and does not switch users viewing another Map.                            |
| A4  | The drawing expands in every direction; existing content and markers keep their Map-space positions across repeated publication.                    |
| A5  | An imported Map and a sketched Map each retain their placement arrangement after switching away and returning; no marker is created automatically.  |
| A6  | A permitted marker movement appears live while an unpublished room addition stays private; drawing undo changes neither.                            |
| A7  | GM and two players pan and zoom independently, with no effect on each other.                                                                        |
| A8  | The GM closes and reopens the editor and continues editing; the published image contains no embedded private source.                                |
| A9  | Pen drawing, erasing, pan/zoom and publication work in full-page tablet mode without mandatory keyboard use.                                        |
| A10 | A publication failure leaves the last published image intact and the private source recoverable; a retry cannot mismatch image and alignment.       |
| A11 | A publication adding a newly drawn room reaches only its explicit eligible audience; an absent Character learns nothing, and no second Map appears. |
| A12 | A retained arrangement is not exposed through the Knowledge Library or Blackboard, and is not treated as canonical actor location.                  |
| A13 | A transparent generated overlay aligns correctly over imported imagery and leaves the original image intact.                                        |
| A14 | Evaluation records actual export time, dimensions and memory symptoms for large sketches rather than assuming unlimited raster capacity.            |

---

## 8. Exclusions specific to this authoring path

The common Map exclusions at
[Maps §17](../architecture/maps-spatial-play.md#17-explicitly-deferred-tactical-and-spatial-mechanics)
apply in full. In particular, this authoring path adds **none** of:

- player drawing, or simultaneous collaborative drawing;
- a native iPad application;
- pressure-dependent functionality, handwriting recognition, or a mandatory
  symbol library;
- any dependency on AI generation;
- a semantic Map-package importer
  ([Content authoring §18.41](content-authoring-scenario-preparation-and-artifact-management.md#1841-map-intake--identity-layer-choice-and-eligibility));
- automatic Place or SpatialRegion creation, or Place proliferation;
- general Map branching, rollback or revision-history UI;
- automated fog of war, exploration-based revelation, collision, line of sight
  or tactical measurement.

> **An imported reference image and a generated image are both images.** Drawing
> a door creates no canonical Door object, and drawing a room creates no Place or
> SpatialRegion.
