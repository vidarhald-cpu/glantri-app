# Architecture decision: Secure Campaign Artifact storage boundary

- Status: approved
- Date: 2026-08-24
- Decision owner: Glantri product owner / issue #350 control plane
- Functional areas: Campaign and narrative encounters; Platform storage and API; Campaign presentation
- Related issues/PRs: #350, #341, #318, #342, #340, #333
- Supersedes: direct `CampaignAsset.storageUrl` creation and rendering as an application content path
- Superseded by:

## Context

At accepted baseline `origin/dev@546eb9fed96b982e648ca03766996a7605b5b1ab`, `CampaignAsset` stored a required arbitrary URL and exposed it to the GM client. It had coarse visibility, no binary integrity, no authenticated content route, no optimistic metadata lifecycle, and no database-backed same-Campaign Scenario reference. That shape cannot safely support pilot maps, images, portraits, PDFs, or handouts and must not become a generic Asset or Player-Universe authority.

The storage contract also has to remain readable by the immediately previous application during overlap under #333. Existing physical `CampaignAsset` identities and Scenario map references therefore remain intact.

## Decision

Artifact is a Campaign-owned content object mapped additively onto the physical `CampaignAsset` table. `campaignId` is the immutable authorization boundary. Existing URL-only rows are classified as `legacy_reference`, remain visible only in the owning GM catalogue as re-upload-required, and are never fetched or served to players.

Binary content is immutable and lives behind the server-only `ArtifactBinaryStore` streaming port. The port supports put, authenticated read, stat/integrity, and idempotent delete. It never returns a client URL. The local adapter uses an explicitly private root outside the web public tree with opaque random object names and user-limited permissions. The Azure adapter uses a private Blob container through a server credential; hosted configuration intends managed identity and never issues SAS or public URLs. Incomplete production configuration disables binary actions with a sanitized 503 and never falls back to local ephemeral storage.

The API authenticates every metadata, publication, reference, and content operation. Owning-GM private access is derived only from `Campaign.gmUserId`; global admin is not an implicit private override. Campaign publication uses the canonical Campaign access service. Scenario publication requires a published `ScenarioArtifactReference` plus the canonical Scenario player-access service. Same-Campaign Artifact/Scenario identity is enforced with composite database foreign keys and revalidated inside reference mutations.

Supported bytes are exactly PNG, JPEG, WebP, and PDF, at most 25 MiB. The server streams with bounded memory, validates declared type against signature, calculates SHA-256, rejects empty or unlisted/spoofed content, and compensates storage/database failure without a readable partial state. Original filenames are sanitized GM/audit metadata only and never influence keys, paths, logs, or response headers.

Player/common projections contain only safe identity, kind, deliberately shared title/description/alt text, and media type. They exclude storage provider/key/URL, legacy URL, original filename, digest, creator, provenance URI, audit, and hidden counts. Scenario publication snapshots its title/caption/alt presentation. Later metadata edits do not rewrite the snapshot.

Lifecycle is `active | archived | deleted`; storage state is `pending | ready | failed | legacy_reference | deleted`; audience is `gm_private | campaign | scenario`. Metadata uses a positive optimistic version. Archive prevents new publication while preserving existing references. Delete requires Campaign and Scenario publication withdrawal, tombstones access immediately, and retries private object cleanup safely. An immutable GM-only audit records upload, metadata, audience, Scenario reference, lifecycle, deletion, and cleanup transitions without bytes or locators.

## Alternatives considered

- A new generic Asset hierarchy was rejected because no accepted shared ownership, economics, entity, or marketplace semantics exist.
- Binary bytes in PostgreSQL or source control were rejected because they couple large content to relational backups/migrations and violate the accepted storage boundary.
- Public Blob URLs, SAS URLs, and direct browser storage access were rejected because authorization and withdrawal must remain application-mediated.
- Fetching or proxying legacy `storageUrl` values was rejected because those values are untrusted and cannot inherit new authorization guarantees.
- Splitting storage, metadata, Scenario references, and presentation across separate partial PRs was rejected because the security invariant would be incomplete between stages.

## Consequences

One additive migration adds Artifact metadata, audit, and Scenario reference facts while preserving the table name, IDs, required legacy columns, existing enum values, and Scenario map relations. New rows use a non-public `artifact-internal:<id>` compatibility locator in the legacy required column; it is never serialized or resolved. Application rollback disables new routes/UI while additive data and private objects remain. Ordinary rollback does not drop Artifact data.

Blackboard may later consume only active, ready, Campaign-visible safe map/image candidate DTOs. It receives no locator or hidden totals and owns no storage behavior. Character-sensitive grants, Player uploads, cross-Campaign libraries, generation providers, public sharing, transforms, search, and production Azure provisioning remain separate decisions.

## Integration and verification

The contract order is domain/schema, repository/service transactions, storage adapters, API authorization/projection/content headers, then the focused Campaign/Scenario presentation. Issue #350 owns all named hotspots in one draft PR. Verification includes migration replay on PostgreSQL 16, old-row compatibility, same-Campaign composites, optimistic lifecycle/reference tests, local permission/traversal/abort/orphan/signature/digest tests, Azure adapter fakes, API perspective/payload/header/CSRF tests, component/client reload/stale/accessibility checks, isolated browser flow, and exact-head CI/Docker.

## Release-boundary impact

This decision adds an Azure-compatible server configuration path but makes no `infra/`, workflow, Azure resource, RBAC, secret, deployment, `main`, release, or production change. Enabling hosted storage and provisioning the private container/managed-identity role is a separate production-boundary action.
