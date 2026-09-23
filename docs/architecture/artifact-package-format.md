# Artifact packages and library (AM1)

AM1 implements the approved [Artifact architecture](artifact-management-package-import.md) for the owning Campaign GM. The controlling contract for the wider content-authoring, Scenario-preparation and Artifact-management model is [Content authoring, Scenario preparation and Artifact management](../product/content-authoring-scenario-preparation-and-artifact-management.md). Artifact management is independent of global GM/Admin roles. Participants retain the existing explicit Campaign and Scenario publication channels; neither a dependency nor an attachment grants visibility.

## Library

Search title/description and filter kind/lifecycle in the Campaign Artifact panel. Uploads begin private. Reuse existing Artifacts through Scenario attachments and Blackboard images/maps. The history inspector lists immutable versions and current/historical Scenario/map/Blackboard uses. A corrected representation is previewed and explicitly approved as a new version of the same Artifact. Every ordinary content URL retains the stable Artifact identity and resolves its current representation. Consumer title/caption snapshots remain intentional historical presentation. Blackboard reports source change after a newer media version, and resolves retired sources for existing authorized uses.

Retire excludes an Artifact from ordinary selection without deleting its media, history or references. Restore permits new uses. Existing sharing remains until explicitly withdrawn. The ordinary DELETE operation rejects requests to delete accepted content. Previously deleted records remain deleted; failed uploads and historical pending cleanup remain cleanable.

The additive migration retains CampaignAsset IDs and existing columns. Ready, live managed representations receive initial revision rows referencing their existing opaque storage keys; no bytes are copied and no URLs are fetched. Pending, failed, legacy and deleted rows retain their classifications. Initial upload and subsequent import/revision transactions update the current-revision pointer and compatibility representation fields together. Accepted revision records are never edited by management operations.

## Transport and limits

POST `/campaigns/:campaignId/artifact-imports` accepts multipart, with one UTF-8 JSON `manifest` field first and resource file parts whose field names equal declared resource IDs. Filenames are display metadata only. There is no ZIP extraction, URL fetch, script execution or path resolution. PNG, JPEG, WebP and PDF use the existing signature, declared-type, length and SHA-256 validator; PDFs remain attachment-only.

Limits: 1 MiB manifest; 100 objects; 100 resources; 25 MiB per resource; 100 MiB aggregate streamed resource bytes; 100 dependencies per object; dependency depth 32. Duplicate resource/object/source IDs, unknown fields, unsupported versions, malformed/trailing multipart, incorrect digests and executable declarations fail closed. Resource bytes must all be present and valid before review. Typed object validation and dependency closure are repeated for each selection. The enabled importable types are **Artifact and Item** — Artifact from AM1, Item from #271 — and a package object declaring any other type is an unsupported object type that may be excluded. Optional unsupported object types may be excluded; no importer beyond the enabled set is available. Importable scope is governed by [Content authoring, Scenario preparation and Artifact management §11.5](../product/content-authoring-scenario-preparation-and-artifact-management.md#115-importable-domain-types).

```json
{
  "schemaVersion": 1,
  "producer": "example-author",
  "packageId": "gatehouse",
  "version": "1",
  "title": "Gatehouse handouts",
  "resources": [
    {
      "id": "portrait",
      "mediaType": "image/png",
      "sha256": "<64 lowercase hexadecimal characters>"
    }
  ],
  "objects": [
    {
      "id": "captain",
      "type": "Artifact",
      "sourceId": "captain-portrait",
      "resourceId": "portrait",
      "optional": false,
      "metadata": {
        "title": "Captain portrait",
        "artifactKind": "portrait",
        "altText": "The captain beside the gatehouse"
      },
      "dependencies": []
    }
  ]
}
```

Object/resource IDs contain 1–100 letters, digits, underscores or hyphens. Artifact kinds remain `map`, `image`, `portrait`, `document`, `handout`; `map` means media, never an interactive Map. Metadata supports the existing description, alt text and attribution fields. New imported objects always begin private regardless of producer claims.

Dependencies are `{ "kind": "local", "id": "other-object" }` or `{ "kind": "existing", "artifactId": "stable-artifact-id" }`. Existing references must resolve to readable accepted Artifacts in the target Campaign. Local dependencies must be selected, resolve independent of declaration order, and be acyclic. Dependencies are provenance/acceptance constraints, not mutations of runtime consumers. Optional defaults to false. `targetArtifactId` explicitly proposes an update to a compatible active Artifact in the same Campaign; it does not approve it.

## Review, conflicts and acceptance

Staging persists separately from accepted Campaign assets, scoped to the current owning GM and upload actor. Preview reports Create, Update candidate, Already present, Conflict or Invalid, per-object reasons and the existing target title. Excluded objects are distinct from failures. Each subset change recomputes closure and issues a new approval token, invalidating prior approvals. Inspect media through authenticated staged-resource routes. Imported records/history are GM-only and never enter common participant DTOs.

Same-source recognition uses Campaign + producer + package ID + source ID. Equal titles or bytes never collapse logical identities. A matching source fingerprint and unchanged current representation/metadata is Already present. Changed content is an update candidate, requiring its own approval. Multiple proposed updates to the same existing Artifact conflict. Explicit targets conflicting with source identity, inaccessible targets and changed target versions fail without overwrite.

Acceptance rechecks current owning-GM authority and the full selected plan under a serializable database transaction. Selected binary integrity is rechecked before that transaction. No upload or provider call occurs inside it. Artifact creation, immutable revisions/current pointers, source mappings, audit and the successful Import Record commit together or all roll back. Retrying an already accepted token returns its existing mapping; conflicting concurrent work returns a reviewable conflict.

The successful Import Record retains manifest identity/version, source declarations, dependencies, selection/statuses, per-update approvals, actor, acceptance time and local-to-Artifact mapping. Failures retain a sanitized durable report. Staged opaque keys are recorded before storage writes so failures are cleanable. Discard/cleanup is explicit and retryable; it never deletes a key referenced by an accepted revision. Removing unused staging leaves successful records and ordinary revision content intact. No source package is a live content dependency.

Application rollback disables new management/import routes while preserving additive data and private media. It must not drop revision or provenance tables. Existing storage configuration/permissions and production deployment authority are unchanged.
