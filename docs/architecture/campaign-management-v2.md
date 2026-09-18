# Campaign Management V2 — Product and UX Contract

**Status:** Product Owner approved; product architecture Ready; implementation not authorized\
**Date:** 2026-09-17\
**Portfolio provenance:** [#120 Campaign Management V1](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/120)\
**Successor work:** [#227 Campaign Management V2 — GM task-oriented workspace](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/227)\
**Recorded against:** `dev@c04660281f3ae237fba4569c279f75c0ff0d98a5`

This contract defines the target for the next Campaign Management iteration
after the integrated V1 milestone. It preserves V1 history and the established
Campaign, Persistent Play, Character, Item, Artifact, Map, and Blackboard domain
boundaries. It does not authorize a current-implementation audit, UI work,
runtime work, Map work, or a Blackboard redesign.

## 1. Product objective

Campaign Management V2 organizes the Campaign workspace around the work a GM
is trying to do rather than around internal object types or implementation
subsystems.

The workspace must support five major functions:

1. manage Campaign membership;
2. manage Scenarios;
3. review Campaign log and history;
4. create Campaign material;
5. keep track of Campaign Notes, Items, and Artifacts.

Exact final navigation labels may be refined later. These user jobs and their
separation are controlling.

## 2. Campaign membership

Provide one Campaign membership surface answering:

> **Who belongs to this Campaign?**

It covers both:

- PCs;
- NPCs.

PCs and NPCs may be segmented or filtered within the same surface. Current and
Former PC distinctions from V1 remain intact, as does the approved distinction
between Campaign-relevant and merely historical NPCs.

The membership surface must not become a duplicate general Character editor.
Selecting a Character should lead to the Character's normal canonical home when
the user needs Character management beyond the Campaign relationship.

## 3. Scenario management and play navigation

Provide one Campaign-level Scenario management surface. It is the normal
Campaign route into the Scenario structure.

Scenarios and Encounters retain their canonical pages, navigation, lifecycle,
and subtabs. Persistent Play remains authoritative for Scenario, Encounter, and
Combat runtime state.

### 3.1 No separate Play hierarchy

The separate **Play** Campaign navigation concept is not part of the V2 target.

The GM reaches current play through the ordinary Scenario and Encounter
navigation. A Campaign surface may conveniently identify the current or active
Scenario and Encounter, but selecting them resolves to their normal object
screens.

> **Do not create a second navigation hierarchy for playing an object that
> already has a canonical Scenario or Encounter home.**

This removes duplicated navigation without transferring runtime authority into
Campaign Management.

## 4. Campaign log and history

Campaign history remains available but secondary to current GM work.

The Campaign log:

- starts collapsed or closed;
- can be expanded by the user;
- presents events chronologically;
- loads a bounded recent history initially;
- offers **Load more** or an equivalent action for older history;
- does not eagerly render an unbounded history.

The exact placement may be a dedicated section or a secondary panel within the
Campaign workspace where existing architecture favors that choice. The
collapsed-by-default and bounded-loading behavior is required.

Persistent Play history remains authoritative for runtime events. V2 does not
change the V1 provenance or non-mutating-history rules.

## 5. Create Campaign material

Provide one Campaign surface for making game material.

The initial required creation functions are:

- create Items;
- upload Artifacts.

Items and Artifacts may share a common result or list presentation with useful
segmentation or filtering. Sharing a workflow or list does not merge their
domain identities.

### 5.1 Artifact upload dependency

The current package-oriented Artifact import workflow is not sufficient as an
ordinary GM authoring experience. Campaign V2 depends on a simpler workflow in
which a GM can upload ordinary image or file material without manually handling
package-engineering details.

The Artifact domain remains authoritative for Artifact identity, revision,
ownership, visibility, and provenance.

Map creation and broader Map UX expansion remain deferred until ordinary
Artifact and image upload is usable. Do not expand Maps to compensate for the
current uploader.

## 6. Campaign material tracking

Provide one Campaign working surface for keeping track of:

- Notes;
- Items;
- Artifacts.

These may share a compact index while retaining distinct canonical identities,
permissions, and lifecycles.

### 6.1 Notes

Preserve the existing Campaign Note concept and improve its authoring
ergonomics.

Required behavior:

- a clear **New note** action;
- an appropriately sized writing field or editor;
- no requirement to compose meaningful notes in a tiny inline control.

A Note may be associated with multiple relevant contexts. Required association
choices include:

- Scenario;
- Encounter;
- PC;
- NPC;
- custom tag.

Associations are multi-choice where appropriate. References do not change
ownership of the associated domain objects. Notes remain lightweight Campaign
working material rather than Story prose or a general task-management system.

### 6.2 Index behavior and canonical homes

The material index supports:

- a compact list view;
- expansion or preview without immediately navigating away;
- clear navigation to the object's canonical home.

Examples include:

- Character → Character screen;
- Item → Item home or details;
- Artifact → Artifact home or inspection;
- Map → Map after Map work resumes;
- Scenario → Scenario;
- Encounter → Encounter.

> **The Campaign index references domain objects; it does not duplicate them.**

## 7. Creation and retrieval are separate user jobs

Creating material and finding, reviewing, or managing existing Campaign
material are distinct workflows.

The UI may reuse components, queries, and lists where useful. It must not
conflate the user's jobs merely because the workflows involve the same entity
types.

## 8. Artifact and image inspection

Artifact or image inspection must use essentially the available screen. Merely
making an image somewhat larger inside its existing card is insufficient.

The reusable inspection pattern should provide, where appropriate for the media:

- a full-screen or effectively full-viewport inspection mode;
- sensible scaling;
- zoom;
- pan;
- an obvious exit or back control.

Normal Campaign chrome must not consume most of the viewport while the user is
trying to read or examine visual material. The same inspection pattern should be
reusable later for Maps and other visual content.

## 9. Blackboard boundary

V2 does not redesign the Blackboard.

The only currently approved Blackboard correction is:

> **Blackboard controls and buttons must not obscure or overlap the content
> being used.**

Broader Blackboard product work remains deferred until actual use establishes a
concrete need.

## 10. Controlling V2 principles

1. Organize Campaign UI by GM task, not internal entity taxonomy.
2. Domain objects have one canonical home.
3. Campaign lists and indexes reference objects rather than duplicating their
   management UI.
4. Do not maintain a separate Play navigation hierarchy.
5. Creation and retrieval are distinct workflows.
6. Items and Artifacts may share useful lists without becoming the same domain
   type.
7. Notes are first-class Campaign working material and need proper writing
   ergonomics.
8. Logs are secondary information and begin collapsed.
9. Inspection uses the available screen.
10. Map expansion waits for a usable Artifact and image-upload path.
11. Do not redesign the Blackboard speculatively.

## 11. Dependencies

### Artifact uploader usability

Ordinary Campaign authoring requires an upload flow for ordinary image and file
material. Package validation may remain available for package import, but it is
not the ordinary authoring experience.

### Items

Campaign creation and tracking use the authoritative Item domain and canonical
Item home. Campaign Management does not create a second Item model.

### Notes

The existing Note concept is retained. V2 adds the product requirement for
usable authoring and multiple contextual associations.

### Scenario and Encounter navigation

Canonical Scenario and Encounter routes must support direct navigation from the
Campaign workspace. Persistent Play retains runtime authority.

### Maps

Later Map integration depends on ordinary Artifact and image upload and on the
reusable full-screen inspection pattern. Map implementation is outside V2.

## 12. Relationship to V1 and documented conflicts

The integrated V1 contract remains the historical authority for Campaign as a
durable root, Persistent Play runtime authority, reference-based relationships,
non-mutating historical inspection, Character membership, Note identity, and
GM-first access.

V2 changes these presentation and workflow assumptions:

| V1 documentation                                                                                                  | V2 ruling                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The conceptual information architecture includes a distinct **Current Play** section and current-play navigation. | Surface current context where useful, but navigate through canonical Scenario and Encounter homes; remove a separate Play hierarchy. |
| Campaign Home is framed as a broad current-context overview.                                                      | Organize the successor workspace around the five explicit GM jobs.                                                                   |
| Notes have an optional relationship to relevant objects without a complete authoring interaction.                 | Provide a proper New note editor and multi-choice Scenario, Encounter, PC, NPC, and custom-tag associations.                         |
| Chronology presentation and loading behavior are left open.                                                       | The log begins collapsed, loads bounded recent history, and provides progressive older-history loading.                              |
| Related material is primarily navigational.                                                                       | Add distinct creation and material-tracking jobs while preserving canonical object homes.                                            |
| Artifact presentation has no common inspection requirement.                                                       | Use full-screen or effectively full-viewport inspection with appropriate scaling, zoom, pan, and exit controls.                      |

These are successor decisions, not evidence that V1 was unaccepted or
unfinished.

No direct conflict was found with the V1 domain invariants. Items, Artifacts,
Characters, Scenarios, Encounters, Maps, and Blackboard retain their distinct
authorities.

## 13. Decision state and next step

### Settled

- the five GM jobs;
- unified PC/NPC membership management;
- canonical Scenario/Encounter navigation without a separate Play hierarchy;
- collapsed and bounded Campaign history;
- common creation surface for Items and Artifact upload;
- separate material-tracking surface for Notes, Items, and Artifacts;
- multi-context Note associations and usable editing space;
- canonical object homes;
- full-viewport Artifact inspection;
- Artifact-upload dependency before Map expansion;
- narrow Blackboard overlap correction with redesign deferred.

### Deliberately left to later design within this contract

- exact final tab labels;
- whether the collapsed Campaign log is a dedicated section or secondary panel;
- media-specific inspection controls beyond the approved common behavior.

These choices do not require reopening the V2 product architecture unless they
materially change the approved user jobs or domain boundaries.

The next permitted preparation is a separately authorized audit of the current
implementation against this contract. This document does not authorize that
audit or implementation.
