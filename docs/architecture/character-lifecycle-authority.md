# Character lifecycle authority and mutation contract

## Scope

This contract defines who owns Character state at each lifecycle checkpoint and how existing write paths may change it. It does not add or change progression economics, stat formulas, Skill policy, or Character read-model calculations.

The future stat model remains:

```text
Rolled/Base -> Original -> Developed -> Current
```

- `Original` is the finalized chargen value after authorized chargen and GM adjustments.
- `Developed` is permanent post-creation development.
- `Current` is the presently applicable value and may include temporary or semi-long-term magic, rituals, drugs, curses, bodily enhancement, and similar effects.
- Tactical one-roll modifiers remain separate from `Current`.
- Skills may later need analogous `Original` and `Current` semantics.
- Existing `statModifiers` behavior is evidence for later conformance work, not authority to map it to one of these layers.

## Authorities

| Record or checkpoint        | Authority                              | Role                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-progress chargen session | Browser-local chargen session          | Recoverable draft. It is not a Character and cannot be rostered or snapshotted.                                                                                                                           |
| Finalized Character         | Server `Character` record              | Canonical identity, build, owner, and revision after authenticated finalization. Existing server Characters are treated as finalized without reinterpreting their build fields.                           |
| Browser-local Character     | Non-authoritative canonical cache      | Cache of the last canonical Character response. It has no gameplay or replacement authority and is never used when canonical state is unavailable.                                                        |
| Character recovery          | Account-scoped field patch             | Proposed user-authored changes only. It records its canonical base revision/hash, changed fields, source, time, and save attempt; it never acts as an old whole-Character replacement.                    |
| Campaign roster entry       | Campaign-owned reference               | Membership reference to the canonical Character. Deleting the Character removes its roster references in the same server mutation.                                                                        |
| Scenario participant        | Scenario-owned snapshot and live state | Immutable copy of the Character at admission. Later Character edits or deletion do not rewrite it. The existing explicit equipment-refresh action is the only Character refresh covered by this contract. |

## Actor and privacy matrix

| Action                                 |                                           Player owner |                                             Owning campaign GM |                                            Other GM |                                               Admin |
| -------------------------------------- | -----------------------------------------------------: | -------------------------------------------------------------: | --------------------------------------------------: | --------------------------------------------------: |
| Finalize a new Character               |                                     Yes, becomes owner |            Yes, becomes owner of their own finalized Character | Yes, becomes owner of their own finalized Character | Yes, becomes owner of their own finalized Character |
| Read/edit/delete an existing Character |                                                    Yes | Yes, while the Character is rostered in one of their campaigns |                                                  No |                                                 Yes |
| List Character records                 |                                       Owned Characters |              Owned plus Characters rostered in their campaigns |                                      Own scope only |                                                 All |
| Use a Character in a Scenario          | Existing Campaign/Scenario authorization still applies |         Existing Campaign/Scenario authorization still applies |                     No authority from GM role alone |                            Existing admin authority |

Unauthorized Character reads and mutations return `404` so they do not disclose another owner's record or revision.

Browser-local records follow the same presentation boundary. An owner may recover their own retained record, an owning GM may see one only when the scoped server Character remains accessible, and an admin may see retained records. A GM role by itself never grants access to another account's browser-local Character. Account switching therefore cannot expose retained records that are outside the active actor's scope.

## Server mutation contract

All finalized Character build writes go through `CharacterService` and the Character routes.

### Finalize/create

`POST /characters` accepts a validated finalized build and binds it to the authenticated user. Authenticated chargen reports success, writes a synced browser cache, and clears its session only after this request returns the canonical server record. An existing synced browser record never bypasses the request. A retry with the same id, owner, and identical build returns the existing canonical record. The same id with a different owner or changed build returns `409 character_already_exists`; it never becomes an update or a local success.

### Edit/synchronize

`PUT /characters/:id` requires:

- an authorized actor;
- a build whose id matches the path;
- a valid build;
- `expectedUpdatedAt`, copied from the canonical server record on which the draft was based.

The database update compares both id and revision. A mismatch returns `409 stale_character` with the current canonical record after authorization. The stale draft remains local for recovery and does not overwrite the server. The caller must reload and deliberately reconcile before retrying.

When a retained local draft and the canonical server revision differ, Character screens present the canonical server record as current and keep the retained draft as a separate recovery candidate. The actor may review the retained draft, return to the canonical version, or discard the retained draft. Review does not merge or save anything automatically; a later deliberate save uses the current canonical revision. Reloading repeats this bounded state instead of promoting the stale draft or hiding the canonical record.

`updatedAt` is the server's opaque Character revision; clients compare it for equality and do not infer ordering or game meaning from it. Browser-local canonical-cache `updatedAt` mirrors that revision. Recovery records separately retain the exact base revision/hash and attempted changed fields. A canonical load clears only empty or canonical-equal residue, safely rebases demonstrably disjoint field changes, and requires explicit review when the same field changed. Successful save removes the matching recovery record; failed or lost responses retain it until canonical reconciliation proves the attempted values were accepted.

Recovery is scoped to the authenticated account and Character. Another account cannot query or inherit it. Explicit logout purges that account's pending recovery from the device. Older unsynced whole-build rows with insufficient provenance are copied into a separate quarantine during browser-database upgrade; they are never applied, promoted, or silently deleted.

### Delete

`DELETE /characters/:id` requires the same actor authorization and `expectedUpdatedAt` comparison. A successful delete atomically removes the canonical Character and its generic Campaign roster references. Character-owned database records follow their declared cascade behavior. Scenario participant rows, snapshots, and live state remain; their nullable Character source link becomes `null`.

A stale delete returns `409 stale_character` and changes nothing.

## Golden transitions

1. **Draft -> finalized:** a valid local chargen draft is finalized by an authenticated user; one canonical server Character is created and the browser stores a synced cache with its server revision.
2. **Finalize retry:** the response is lost and the identical request is repeated; the existing record is returned without rewriting it.
3. **Finalized -> edited:** an owner, owning GM, or admin submits the exact base revision; one new canonical revision is returned and cached.
4. **Failed edit -> recovered:** the browser retains only the attempted changed fields and their canonical base while saving. A retry succeeds only after canonical reconciliation proves a safe base or the user explicitly reviews a conflict.
5. **Concurrent edit conflict:** another actor saves first; the later stale draft receives `409`, remains recoverable locally, and cannot overwrite the newer Character.
6. **Conflict recovery:** the canonical server Character is shown as current while the retained draft can be reviewed, left for later, or discarded. No recovery choice automatically merges or overwrites either record.
7. **Rostered:** Campaign membership refers to the canonical Character; it does not create another Character authority.
8. **Snapshotted:** Scenario admission copies the Character into Scenario-owned snapshot/live state. Later Character edits have no effect unless the owning GM invokes the existing explicit equipment refresh.
9. **Deleted:** the canonical Character and roster references are removed at the expected revision. Existing Scenario snapshots remain usable historical state with no live Character link.
10. **Retired:** the current schema has no Character retirement state. Retirement is unsupported rather than silently represented as deletion, roster removal, or a browser-local flag; adding it requires a future explicit server lifecycle decision.

## Compatibility limits

- Existing server Character builds are accepted as finalized records. This task does not migrate or reinterpret rolled stats, `Original`, `Developed`, `Current`, Skills, progression fields, or `statModifiers`.
- Existing local-only/unsynced whole-Character rows are legacy quarantine input only. They are not playable, are not submitted as recovery, and do not acquire server mutation authority.
- Existing synced local caches use their saved server timestamp only as cache compatibility metadata; canonical load refreshes them before use.
- Character read-model and formula conformance belongs to C&P-2 and is deliberately outside this contract.
