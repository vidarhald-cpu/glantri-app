# #119 Artifact Management & Package Import — Durable Product/Architecture Contract

## 1. Status and scope

**Status:** Product Owner approved, 2026-09-15. Conceptually Ready for Artifact-first V1; implementation is not authorized.

**Portfolio area:** #119 Artifact Management & Package Import\
**Architecture status:** Product/architecture Ready for an Artifact-first V1\
**Initial milestone:** **AM1 — Artifact Library & Validated Artifact Import**

This contract defines two related capabilities:

1. **Artifact Management** — management of reusable authored media/content assets.
2. **Package Import** — a controlled ingestion boundary through which supported Glantri objects may be proposed, validated, reviewed and accepted.

This is a product/domain architecture contract. It does not define current implementation structure, storage technology, APIs, migrations, repository paths, branches, SHAs or Builder ownership.

The initial implementation scope is deliberately bounded:

> **#119 V1 supports GM-managed Artifacts and Artifact-only package import.**

The package architecture is designed to accommodate other object types later, but no other Glantri domain becomes importable merely because this generic package boundary exists.

---

# 2. Controlling architectural boundary

The controlling separation is:

> **Artifact Management governs reusable authored media/content assets. Package Import is a controlled ingestion boundary that may create or update approved Glantri objects only after validation and authorization.**

A package is not:

- an alternative Glantri runtime;
- an alternative domain model;
- a live data source for accepted objects;
- an automation interface;
- a scripting environment;
- a privileged mutation channel.

The intended lifecycle is:

```text
authored material
      ↓
package
      ↓
staged validation
      ↓
preview / review / conflict resolution
      ↓
final validation
      ↓
atomic acceptance
      ↓
ordinary Glantri objects
```

After successful acceptance:

- the accepted objects are ordinary Glantri domain objects;
- normal domain ownership, permissions, lifecycle and validation rules apply;
- package provenance and audit information remain;
- the package has no continuing operational authority over those objects.

The safe import boundary is therefore a **conversion from proposed authored material into authoritative domain objects**, not continued execution of package instructions.

---

# 3. Artifact domain model

## 3.1 Artifact definition

An **Artifact** is a reusable authored asset whose primary purpose is media, presentation, illustration, reference or handout use.

Typical Artifact kinds include:

- portrait;
- illustration;
- handout;
- document;
- diagram;
- heraldry or seal;
- map image/background;
- other supported authored media/content.

An Artifact is distinct from the game-domain object that uses it.

Examples:

- an NPC may reference a portrait Artifact;
- a Map may reference a background Artifact;
- Story content may reference an illustration or document Artifact;
- a Campaign may organize and expose Artifacts.

The Artifact itself does not become an NPC, Map, Story node or Campaign-state object.

## 3.2 Conceptual structure

An Artifact consists conceptually of:

```text
Artifact
 ├─ stable logical identity
 ├─ kind/type
 ├─ descriptive metadata
 ├─ owning scope/principal
 ├─ visibility and permissions
 ├─ lifecycle state
 ├─ current active revision
 ├─ immutable revision history
 ├─ provenance
 └─ references/backlinks
```

The Artifact is the durable logical object.

The media representation is held by one or more **Artifact Revisions**.

---

# 4. Stable identity and revision semantics

## 4.1 Stable logical identity

Artifact identity represents the logical authored asset, not a particular byte sequence or file.

The relevant question is:

> **Is this still the same authored thing?**

For example, a corrected or higher-quality version of Captain Varro's portrait may remain the same Artifact.

Replacing Captain Varro's portrait with a portrait of another person is not a revision of that Artifact. It is another Artifact.

## 4.2 Immutable revisions

An Artifact revision represents one particular version of the Artifact's media/content.

Accepted revisions are conceptually immutable.

Changing the representation of the same logical Artifact creates a **new revision** rather than modifying the old revision in place.

Historical revisions remain available as revision history according to lifecycle and retention policy.

## 4.3 Current active revision

An Artifact has a current active revision.

Normal Artifact references:

> **point to the stable Artifact identity and resolve to its current active revision.**

Therefore, if an Artifact receives an approved new revision, normal existing references automatically display or use the new current revision.

## 4.4 Revision pinning

Future capabilities may explicitly pin a consumer to a particular Artifact revision where historical fidelity requires it.

Possible future examples include:

- published historical material;
- archived play records;
- fixed handout snapshots.

Universal revision pinning is not required as a prominent AM1 workflow.

## 4.5 Update versus reference replacement

These are separate operations.

### Update Artifact

Meaning:

> "This is a corrected or improved version of the same logical Artifact."

Result:

- create a new immutable revision;
- make it current;
- retain the same Artifact identity;
- ordinary references continue to point to it.

### Replace Artifact reference

Meaning:

> "This consuming object should use a different Artifact."

Result:

- the consuming object's reference changes from Artifact A to Artifact B;
- neither Artifact's identity is changed merely by that reference change.

These operations must not be conflated.

---

# 5. Metadata

Metadata is divided conceptually between the logical Artifact and individual revisions.

## 5.1 Artifact-level metadata

Essential Artifact metadata may include:

- title/name;
- Artifact kind/type;
- concise description where appropriate;
- optional discovery metadata such as tags;
- ownership scope;
- visibility;
- lifecycle state;
- provenance/attribution.

The architecture does not require all future Artifact kinds to expose identical optional metadata.

AM1 does not require an arbitrary user-defined metadata schema.

## 5.2 Revision-level metadata

A revision may carry representation-specific information such as:

- media/content type;
- dimensions or other applicable media characteristics;
- size;
- integrity checksum;
- source filename where useful;
- accessibility description where applicable;
- revision note;
- revision-specific provenance.

Exact supported media formats and operational limits are activation-time implementation concerns and do not alter this domain contract.

---

# 6. Ownership and scope

## 6.1 Ownership is distinct from visibility

Every accepted Artifact has an owning scope or principal.

Ownership determines where durable management authority resides.

Visibility determines who may see the Artifact.

These concepts must remain separate.

## 6.2 V1 ownership model

For AM1:

> **Campaign ownership is the primary accepted-content ownership model.**

An accepted Campaign Artifact normally has the Campaign as its durable home/scope and is managed under GM authority according to Campaign permissions.

This does not mean the Campaign Management domain owns Artifact media semantics. The **Campaign is the ownership scope**; **Artifact Management remains the domain responsible for the Artifact itself**.

## 6.3 Temporary/private scope

The architecture may permit a temporary GM-private authoring or import-staging scope where useful.

AM1 does not require a sophisticated permanent cross-Campaign GM library.

## 6.4 No implicit ownership transfer

None of the following automatically transfers ownership:

- referencing an Artifact;
- sharing an Artifact;
- exposing it to players;
- using it from Story;
- using it from a Map;
- organizing it through Campaign Management.

An explicit supported ownership operation would be required to transfer ownership.

## 6.5 Future extensibility

Artifact identity and permission architecture must not assume that Campaign ownership is the only possible model forever.

Future work may introduce, without redesigning Artifact identity:

- GM-owned Artifacts;
- player-owned drafts or content;
- shared libraries;
- other deliberate ownership scopes.

---

# 7. Lifecycle

## 7.1 Accepted Artifact lifecycle

The principal accepted lifecycle is:

```text
Active
  ↓
Retired / Archived
```

An Active Artifact is available for ordinary use.

A Retired/Archived Artifact remains part of the historical object graph but is normally excluded or de-emphasized in new-selection workflows.

## 7.2 Draft and staging state

Drafts, package staging and unaccepted submissions are not ordinary accepted Campaign Artifacts merely because their content resembles one.

They remain outside authoritative accepted Campaign state until validation and acceptance complete.

## 7.3 Retirement rather than destructive deletion

Routine lifecycle management of accepted Artifacts should use retirement/archive rather than destructive deletion.

Retirement must preserve:

- stable identity;
- revision history;
- existing references;
- provenance;
- relevant historical usage.

Hard deletion is not an ordinary AM1 content-management workflow.

---

# 8. Reuse, update and reference rules

## 8.1 Reuse

The same Artifact may be referenced by multiple objects.

For example:

```text
Portrait Artifact
 ├─ NPC
 ├─ Story entry
 ├─ Campaign reference
 └─ another permitted consumer
```

Reuse does not require media duplication.

## 8.2 Consumers reference Artifact identity

Normal consumers reference the stable Artifact identity rather than embedding independent copies of the media.

This permits:

- reuse;
- coherent revision updates;
- usage inspection;
- stable provenance.

## 8.3 Backlinks and usage

AM1 should provide basic ability to determine where an Artifact is in use.

The purpose is both discoverability and safe lifecycle management.

A GM considering retirement or reference replacement should be able to identify material existing uses.

## 8.4 Revisions do not change semantic identity

A new revision is appropriate only while the logical identity remains the same.

Material semantic replacement requires a different Artifact and a reference change.

---

# 9. Permissions and visibility

Artifact authorization distinguishes at least four conceptual capabilities:

1. **View** — permission to see the Artifact.
2. **Use/reference** — permission to attach/reference it from an object the actor is permitted to modify.
3. **Edit/manage** — permission to change Artifact metadata or create a new revision.
4. **Administer** — permission to perform ownership, permission or lifecycle administration where supported.

Possession of one capability does not inherently grant the others.

## 9.1 V1 visibility

AM1 should support the practical distinction between:

- GM/private visibility;
- Campaign-participant visibility where appropriate.

Sophisticated selected-audience/group models are deferred.

## 9.2 References do not grant view rights

A reference to an Artifact does not itself grant access.

If a player-visible object references an Artifact that the player may not view, Glantri must not reveal that Artifact simply because the reference exists.

Authoring interfaces should avoid silently creating misleading visibility arrangements and may warn where appropriate.

## 9.3 Player authority in V1

AM1 is GM-controlled.

It does not provide:

- direct player creation into accepted Campaign Artifact state;
- player auto-acceptance;
- player overwrite authority over GM/Campaign-owned Artifacts.

Future player submission may use the same validation boundary but belongs to later product work.

---

# 10. Artifact workflows

AM1 should support the following conceptual GM workflows.

## 10.1 Create/upload

1. Supply supported media/content.
2. Provide essential metadata.
3. Select or inherit the appropriate Campaign ownership scope.
4. Set permitted visibility.
5. Create the Artifact and initial revision.
6. Optionally reference it from another supported object.

## 10.2 Find and reuse

The GM can discover existing Artifacts through appropriate library/search mechanisms using information such as:

- title;
- Artifact kind;
- tags or description where supported;
- ownership scope;
- lifecycle;
- provenance where useful.

The workflow should encourage reuse rather than repeated upload.

## 10.3 Inspect

The GM can inspect:

- current media/content;
- metadata;
- current revision;
- revision history;
- ownership;
- visibility;
- provenance;
- current uses/backlinks.

## 10.4 Update

The GM identifies an improvement or correction to the same logical Artifact.

A new immutable revision is created and becomes current.

Normal references continue to point to the Artifact.

## 10.5 Replace a consumer reference

The GM selects another Artifact for a particular consuming object.

This alters the consumer's reference without modifying either Artifact's identity.

## 10.6 Retire

The GM retires an Artifact from ordinary future selection.

Existing references and historical information remain intact.

## 10.7 Package import

The GM supplies a package, reviews validation and conflict results, chooses the valid desired subset, explicitly approves relevant updates, and atomically accepts the selected graph.

---

# 11. Package model

## 11.1 Definition

A package is a **declarative import envelope** containing proposed Glantri objects, resources, references and provenance.

Conceptually:

```text
Package
 ├─ package identity/version
 ├─ schema/version information
 ├─ manifest
 ├─ package metadata/provenance
 ├─ object declarations
 │    ├─ package-local identity
 │    ├─ declared Glantri object type
 │    ├─ proposed object data
 │    └─ references/dependencies
 └─ media/content resources
```

## 11.2 Package status versus accepted state

Package contents remain proposals until accepted.

Parsing, validating or previewing a package must not itself make its objects authoritative Campaign objects.

## 11.3 Package has no continuing authority

After import succeeds:

- package-local identities are mapped to accepted Glantri identities;
- the accepted objects become ordinary domain objects;
- the package remains relevant for provenance/audit only.

Deleting, archiving or losing the source package must not disable the accepted object graph.

---

# 12. Manifest

The package manifest should conceptually identify enough information to validate and interpret the package, including:

- package identity;
- package format/schema version;
- package title/description where supplied;
- package version;
- author/producer/source metadata where supplied;
- contained object declarations;
- package-local identities;
- declared object types;
- dependencies/references;
- included media/content resources;
- integrity information/checksums where applicable;
- stable source-object identities where provided;
- requested target context where applicable.

Manifest claims are proposals.

In particular, the manifest cannot make authoritative declarations about:

- Campaign ownership;
- user permissions;
- GM authority;
- update entitlement;
- runtime mutation rights.

Those are determined by Glantri and the target domain.

---

# 13. Typed object registry

Package Import uses an explicit set of supported importable object types.

The package cannot define arbitrary new Glantri object types by naming them.

For each supported type, its owning domain defines:

- what may be imported;
- required validation;
- legal references;
- legal creation semantics;
- legal update semantics;
- conflict handling;
- permissions;
- lifecycle consequences.

Conceptually:

```text
Generic package boundary
        |
        +-- Artifact importer      [enabled in AM1]
        +-- Map importer           [not enabled by #119]
        +-- Story importer         [not enabled by #119]
        +-- Item importer          [not enabled by #119]
        +-- other domains          [only by later explicit opt-in]
```

For #119 V1:

> **Artifact is the only enabled importable Glantri object type.**

The existence of the generic registry does not authorize any other importer.

---

# 14. Reference model

## 14.1 Package-local identity

Every proposed package object that needs identity within the package has a stable package-local identifier.

Objects and references inside the package use these identifiers rather than relying on ordering or display names.

## 14.2 Package-local references

Where an enabled object's schema supports references, one package object may explicitly reference another package-local object.

The dependency graph is resolved independently of declaration order.

## 14.3 Existing-object references

A package may refer to an already-existing Glantri object only through an explicitly supported stable reference mechanism.

Existing-object references must be:

- unambiguous;
- permitted by the relevant target domain;
- validated for existence;
- validated for type compatibility;
- validated for authorization.

Display-name matching is not sufficient identity.

The importer must not silently resolve something such as `"King's Portrait"` by fuzzy search and assume a binding.

## 14.4 Accepted mapping

On successful acceptance, Glantri establishes the mapping:

```text
package-local object identity
          ↓
accepted Glantri object identity
```

This mapping is recorded in the Import Record.

Accepted Glantri references then use ordinary Glantri identities rather than depending on the package.

## 14.5 Required dependency integrity

Every required reference in the selected import graph must resolve either to:

- another selected package object that will be accepted; or
- a valid, authorized existing Glantri object.

Otherwise the selected graph is invalid.

---

# 15. Validation and import lifecycle

The normative lifecycle is:

```text
Package supplied
      ↓
Parse and integrity validation
      ↓
Structural/schema validation
      ↓
Typed object validation
      ↓
Reference/dependency validation
      ↓
Permission/authority validation
      ↓
Duplicate/conflict/update analysis
      ↓
Preview
      ↓
GM selection and conflict resolution
      ↓
Dependency graph recomputation
      ↓
Final full validation
      ↓
Explicit acceptance
      ↓
Atomic commit
      ↓
Import Record / provenance
```

## 15.1 Parse and integrity validation

The importer verifies conceptually that:

- the package is readable;
- its declared format/schema is supported;
- the manifest is structurally valid;
- required resources exist;
- integrity information is consistent where used.

## 15.2 Typed validation

Each proposed Artifact is validated according to the Artifact domain contract.

A generic package parser must not substitute generic field validation for domain validation.

## 15.3 Reference validation

The importer verifies:

- required references resolve;
- references point to permitted object types;
- dependencies are structurally valid;
- unsupported reference forms are rejected.

## 15.4 Authority validation

The importer verifies what the current actor is actually allowed to do.

A package declaration cannot grant the importer additional authority.

## 15.5 Preview

Before acceptance, the GM receives a meaningful preview of the proposed effect.

Relevant outcomes include:

- **Create**
- **Update candidate**
- **Already present / no new import needed**
- **Conflict requiring resolution**
- **Invalid / cannot accept**

The preview should expose significant relationships, dependencies and update consequences.

## 15.6 Final validation

Any object deselection or conflict-resolution choice may alter the dependency graph.

Therefore:

> **the complete selected result is validated again after all selections and conflict decisions and before commit.**

No stale earlier validation result is sufficient.

---

# 16. Conflict, duplicate and update semantics

## 16.1 Name equality is not identity equality

Two Artifacts may legitimately share the same title.

A title collision is therefore not automatically an identity conflict.

## 16.2 Binary equality is not logical identity

Two Artifacts may contain identical bytes while representing separate logical authored assets.

A content checksum may assist:

- duplicate detection;
- import preview;
- storage optimization.

It must not automatically collapse two logical Artifact identities.

## 16.3 Source identity

Provenance may identify an incoming object as corresponding to a previously imported source object.

This supports safe re-import recognition and update detection.

It does not itself authorize replacement.

## 16.4 Same-source update candidate

When provenance strongly indicates that an incoming Artifact is a newer representation of a previously imported Artifact, the importer should present:

> **Update candidate**

The preview should make the proposed effect visible.

The update requires explicit GM approval.

The importer must not automatically overwrite because:

- package version increased;
- source identity matches;
- source timestamp is newer;
- producer states that the content supersedes an older version.

## 16.5 Generic merge prohibited

There is no generic field-by-field package merge semantics for arbitrary Glantri objects.

Any future domain that supports merging must define its own product semantics deliberately.

AM1 does not require general merge.

## 16.6 Exact re-import recognition

Re-importing material already accepted should preferably be recognized rather than blindly producing another duplicate object set.

The preview may report objects as already present or unchanged.

Recognition assists idempotent operation but never permits an unauthorized overwrite.

---

# 17. Subset selection and atomicity

## 17.1 Optional selection

Before acceptance, the GM may deselect optional objects from the package.

This is a deliberate user choice.

## 17.2 Dependency recomputation

Whenever selection changes:

1. recompute the selected dependency graph;
2. determine required dependency closure;
3. validate all remaining references;
4. perform complete validation again.

A required dependency cannot simply be deselected while leaving its dependent object selected.

The GM must either:

- retain the dependency;
- remove the dependent object as well; or
- otherwise resolve the dependency through an explicitly supported valid reference.

## 17.3 Atomic acceptance

The final approved selected graph is accepted atomically.

The governing rule is:

> **Either the complete validated selected graph commits successfully, or none of that acceptance attempt becomes authoritative.**

## 17.4 No best-effort partial import

AM1 must not behave as:

> "Import whatever succeeds and leave the rest failed."

Unexpected runtime partial success is not a supported content state.

Intentional pre-commit subset selection and runtime partial failure are fundamentally different concepts.

## 17.5 Failed commit

If final acceptance fails:

- no partial accepted-object changes from that attempt remain authoritative;
- staged material is not treated as accepted content;
- the Import Record/report indicates failure appropriately.

The technical rollback mechanism is an implementation concern; atomic behavior is the product contract.

---

# 18. Provenance and Import Record

## 18.1 Object provenance

Imported objects retain useful origin information, which may include:

- originating package identity;
- package version;
- package checksum/integrity identity;
- source-object identity;
- declared author/producer;
- import actor;
- import/acceptance time;
- source category where known;
- subsequent local revision history.

Provenance is historical evidence.

It does not give the package, source author, AI or external tool continuing authority over the accepted object.

## 18.2 Import Record

Every completed import attempt that reaches the appropriate acceptance stage should produce a durable Import Record sufficient to explain what happened.

A successful Import Record should conceptually capture:

- package identity/version;
- relevant package integrity identity;
- importer/approver;
- target ownership context;
- validation outcome;
- package-local → Glantri identity mapping;
- created objects;
- updated objects;
- skipped/already-present objects;
- conflict decisions;
- update approvals;
- relevant warnings.

A failed import should retain enough report information to explain why acceptance did not occur where appropriate.

## 18.3 Operational independence

The Import Record and provenance survive without making the original package a live dependency.

The accepted object graph remains usable if the package later becomes:

- unavailable;
- deleted;
- archived;
- moved out of storage.

---

# 19. Architectural invariants

The following are controlling architectural invariants for #119 and for future domains that later opt into Package Import.

## INV-IMP-01 — Accepted objects do not depend operationally on the package

After successful import, accepted Glantri objects are authoritative ordinary domain objects.

They must remain usable even if the original package is deleted, unavailable or archived.

Preserve where useful:

- Import Record;
- provenance;
- source-object mapping;
- package identity/version;
- integrity/checksum information.

Do not use the original package as the live operating source for accepted objects.

---

## INV-IMP-02 — Package authority is weaker than target-domain authority

A package may request creation, update or reference operations.

The target domain determines:

- whether such operations exist;
- their meaning;
- validation rules;
- authorization;
- ownership;
- update semantics;
- lifecycle consequences.

A package cannot decide:

- ownership;
- permissions;
- runtime authority;
- update semantics;
- object lifecycle;
- live-state mutation.

This invariant governs every future typed importer.

---

## INV-IMP-03 — Packages are declarative, not executable

V1 packages do not contain or execute:

- scripts;
- plugins;
- database commands;
- repository/filesystem instructions;
- arbitrary network fetches;
- imperative runtime mutation instructions.

Package Import is not an automation or scripting API.

---

## INV-ART-01 — References do not grant visibility

Referencing an Artifact does not automatically reveal it to an actor who lacks view authority.

The following remain distinct capabilities:

- view;
- use/reference;
- edit/manage;
- administer.

A consuming object's visibility does not silently override the referenced Artifact's visibility policy.

---

## INV-ART-02 — Logical identity is distinct from binary identity

Identical media bytes do not imply identical Artifact identity.

Content hashing and storage deduplication may be implementation optimizations or duplicate-detection aids.

They must not collapse intentionally distinct logical Artifacts.

---

# 20. Acceptance examples

## 20.1 Create a portrait

A GM imports a package containing one valid Captain Varro portrait.

Preview:

```text
CREATE
Captain Varro Portrait
```

The GM approves.

A Campaign-owned Artifact is created with provenance and an Import Record.

**Accepted.**

---

## 20.2 Multi-Artifact package

A package contains:

- gatehouse exterior illustration;
- gatehouse floor-plan image;
- royal seal;
- player handout.

All are valid Artifact declarations.

The GM selects all four and approves the package.

All four become ordinary Campaign Artifacts in one atomic acceptance.

**Accepted.**

---

## 20.3 Update existing Artifact

An imported package contains a corrected image carrying source identity that corresponds to a previously imported Captain Varro portrait.

Preview shows:

```text
UPDATE CANDIDATE
Existing: Captain Varro Portrait
Incoming: revised source representation
```

No update occurs merely because the incoming package is newer.

The GM explicitly approves the update.

A new immutable Artifact revision is created and made current.

Existing normal references continue to resolve through the same Artifact identity.

**Accepted.**

---

## 20.4 Same bytes, separate identities

A package contains the same underlying image twice for two deliberately distinct authored purposes.

The importer may note the matching content checksum.

It does not automatically merge the declarations into one Artifact.

**Accepted as two logical Artifacts if that is the approved intent.**

---

## 20.5 Optional subset selection

A package contains Artifacts A, B and C.

C is optional.

The GM deselects C.

The importer recomputes the dependency graph, confirms that A and B do not require C, validates A+B again and allows approval.

A and B are committed atomically.

**Accepted.**

---

## 20.6 Illegal dependency removal

Artifact/object A has a required supported dependency on package object B.

The GM attempts to deselect B while retaining A.

The selected graph becomes invalid.

Acceptance remains blocked until the dependency is restored or A is also excluded.

**Not accepted in the invalid form.**

---

## 20.7 Source package removed later

A package is successfully accepted.

Its Artifacts are subsequently used throughout a Campaign.

The original package is later archived or deleted.

The accepted Artifacts and their normal references continue to work.

The Import Record and provenance remain.

**Required behavior under INV-IMP-01.**

---

## 20.8 Unsupported Map object in AM1

A package contains:

- two valid Artifact declarations;
- one interactive Map declaration.

AM1 recognizes Artifact as an enabled import type but does not have an enabled Map importer.

The Map declaration cannot be accepted merely because the package format can name object types.

The GM may accept a valid Artifact-only subset if the Map is optional and the resulting graph validates.

**Maps remain outside #119 import authority.**

---

## 20.9 Attempted runtime mutation

A package contains instructions equivalent to:

- start an Encounter;
- move a character;
- reduce HP;
- change initiative;
- equip an Item.

These are imperative runtime mutations rather than accepted Artifact declarations.

The package boundary does not execute them.

**Rejected.**

---

## 20.10 Future AI-authored package

A future AI authoring system produces a package containing proposed Artifacts.

The package receives no special authority because its producer is AI.

It must follow:

```text
draft
  ↓
package
  ↓
validation
  ↓
GM review
  ↓
explicit approval
  ↓
ordinary accepted Artifacts
```

**Valid future use of the architecture.**

---

# 21. Adjacent-domain boundaries

## 21.1 Maps

An Artifact may contain the visual background or illustration used by a Map.

However:

> **Artifact ≠ Map.**

Artifact Management does not define:

- coordinates;
- scale;
- markers;
- layers;
- movement;
- grids;
- terrain;
- line of sight;
- fog;
- spatial state.

Those belong to Maps/Spatial Play.

Replacing or revising a background Artifact does not make the Artifact itself an interactive Map.

Map import is not enabled by AM1.

---

## 21.2 Story

A PDF containing an adventure manuscript may be an Artifact.

Structured Story objects derived from that manuscript are not Artifacts.

Therefore:

> **document media ≠ structured Story content.**

Story may reference Artifacts, but Story structure and Story import semantics belong to the Story domain.

AM1 does not enable Story import.

---

## 21.3 Campaign Management

Campaign Management may:

- organize Artifacts;
- surface Artifacts;
- reference Artifacts;
- show their situational relationship to Campaign material.

Artifact Management remains responsible for:

- Artifact identity;
- media/content;
- revisions;
- Artifact lifecycle;
- Artifact visibility/permissions.

The Campaign may be the Artifact's ownership scope without Campaign Management becoming the owner of Artifact media semantics.

---

## 21.4 Runtime play

Package Import is not an interface for altering active play.

It may not use #119 authority to:

- start or end Scenarios or Encounters;
- alter Combat;
- change HP or other live character state;
- move participants;
- advance phases or turns;
- equip inventory;
- perform other imperative runtime actions.

Any future controlled content transfer into persistent runtime-related domains must be defined by those domains themselves.

---

## 21.5 AI and player authoring

AI is an author/source, not a privileged integration.

Players likewise do not obtain accepted Campaign mutation authority merely because they can author material.

The intended future boundary is:

```text
draft / authored proposal
        ↓
validated package
        ↓
review and authorization
        ↓
accepted Glantri objects
```

Provider-specific AI architecture is outside #119.

Direct player Artifact authoring into accepted Campaign state is outside AM1.

---

# 22. Artifact-first V1

## 22.1 Artifact Management V1 includes

AM1 includes:

- stable Artifact identity;
- supported media/content upload;
- essential metadata;
- Artifact kind/type;
- Campaign ownership as the primary accepted scope;
- GM/private versus Campaign-participant visibility where appropriate;
- reusable references;
- current active revision;
- immutable revision history;
- update by creating a new revision;
- find/select/reuse workflows;
- basic usage/backlink inspection;
- retirement/archive.

## 22.2 Artifact Management V1 does not require

AM1 does not require:

- public/global Artifact marketplace;
- sophisticated audience groups;
- arbitrary metadata schemas;
- collaborative simultaneous editing;
- revision branching;
- universal revision pinning;
- sophisticated cross-Campaign personal Artifact library;
- direct player accepted-content authoring.

## 22.3 Package Import V1 includes

AM1 includes:

- declarative manifest;
- package/schema version;
- package metadata/provenance;
- multiple Artifact declarations;
- package-local object identities;
- media resources;
- integrity/checksum validation;
- typed Artifact validation;
- explicit supported references;
- explicit supported existing-object references;
- permission/authority validation;
- duplicate analysis;
- conflict/update-candidate analysis;
- preview;
- explicit conflict resolution;
- optional-object deselection;
- dependency recomputation;
- full revalidation after selections;
- explicit update approval;
- atomic acceptance;
- durable Import Record;
- provenance;
- same-source/re-import recognition.

## 22.4 Package Import V1 excludes

AM1 does not include:

- arbitrary object mutation;
- generic field-by-field merge;
- scripts or executable package content;
- live runtime mutation;
- automatic overwrite;
- player auto-acceptance;
- silent best-effort partial import;
- import of Maps;
- import of Story;
- import of Items;
- import of Characters/NPCs;
- import of Campaign runtime/state;
- import of Combat state;
- import of any other domain that has not explicitly opted into the package boundary.

---

# 23. AM1 — Artifact Library & Validated Artifact Import

## Product outcome

> **A GM can create, find, reuse, revise and retire reusable Artifacts, and can safely import one or many Artifacts through a validated preview/approval workflow with durable provenance.**

AM1 is one substantial product milestone with two integrated capability areas.

## A. Artifact Library

The GM can:

- create/upload an Artifact;
- provide essential metadata;
- manage appropriate ownership and visibility;
- find existing Artifacts;
- reuse them from supported consumers;
- inspect current uses/backlinks;
- inspect revision history;
- publish a new revision of the same logical Artifact;
- retire/archive an Artifact.

## B. Validated Artifact Import

The GM can:

- supply a valid Artifact package;
- inspect package contents;
- validate multiple Artifact declarations;
- resolve package-local references;
- detect existing/same-source objects;
- see update candidates and conflicts;
- deselect optional content;
- review the resulting dependency graph;
- explicitly approve updates;
- perform final validation;
- atomically accept the selected graph;
- retain durable Import Record and provenance.

These are parts of one coherent capability rather than unrelated product programs.

A later activation preflight may sequence implementation work internally where technically necessary, but the durable product milestone remains AM1.

---

# 24. Resolved Product Owner decisions

The following are settled and must not be reopened during normal activation unless genuinely new requirements invalidate the underlying assumptions.

## PO-1 — Default Artifact reference revision behavior

**Resolved:** Normal references target stable Artifact identity and resolve to the current active revision.

Revision pinning may be added later for explicit historical-fidelity needs.

---

## PO-2 — Artifact ownership model

**Resolved:** Artifact ownership/scope remains distinct from visibility.

For AM1, Campaign ownership is the primary accepted-content model.

The architecture remains extensible to later GM-owned or player-owned scopes.

---

## PO-3 — Player Artifact creation/submission

**Resolved:** Deferred from AM1.

AM1 is GM Artifact management plus GM-controlled Package Import.

The package boundary remains suitable for future player/AI submission and approval workflows.

---

## PO-4 — Package subset selection

**Resolved:** Supported.

The GM may deselect optional objects before acceptance.

Every change triggers dependency recomputation and full revalidation of the selected graph.

Required dependencies cannot simply be discarded.

---

## PO-5 — Same-source update behavior

**Resolved:** Explicit approval is required.

Source identity, matching provenance or newer package version may identify an update candidate but never authorize automatic overwrite.

---

## PO-6 — Initial importable object scope

**Resolved:** Artifact only.

AM1 establishes the generic package envelope and import architecture, but only Artifact is enabled as an importable type.

Every other domain must explicitly define and approve its own future import semantics.

---

# 25. Remaining Product Owner decisions

No material product or architecture decisions remain before #119 can be considered conceptually Ready for AM1.

A future activation preflight against then-current `dev` will still need to determine implementation-specific matters such as:

- available infrastructure;
- concrete supported media formats and limits;
- integration points;
- implementation sequencing;
- current ownership/hotspots;
- regression and verification requirements.

Those are activation concerns, not unresolved product architecture.

They do not reopen the domain decisions in this contract unless the preflight exposes a genuine architectural incompatibility requiring Product Owner review.

# #119 Artifact Management & Package Import — conceptually Ready for Artifact-first V1
