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

| Record or checkpoint        | Authority                                            | Role                                                                                                                                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-progress chargen session | Browser-local chargen session                        | Recoverable draft. It is not a Character and cannot be rostered or snapshotted.                                                                                                                                                                                                 |
| Finalized Character         | Server `Character` record                            | Canonical identity, build, owner, and revision after authenticated finalization. Existing server Characters are treated as finalized without reinterpreting their build fields.                                                                                                 |
| Browser-local Character     | Browser-local record with optional `serverUpdatedAt` | Local-only finalized Character, or cache/recoverable draft of a server Character. It never wins over a changed server revision automatically.                                                                                                                                   |
| Edit/advancement draft      | Browser-local Character draft                        | Proposed mutation only. Saving it to a server Character requires the server revision on which it was based.                                                                                                                                                                     |
| Campaign roster entry       | Campaign-owned reference                             | Membership reference to the canonical Character. It governs Campaign membership and Campaign-scoped authority and state only; it does **not** establish permanent ownership of the Character. Deleting the Character removes its roster references in the same server mutation. |
| Scenario participant        | Scenario-owned snapshot and live state               | Immutable copy of the Character at admission. Later Character edits or deletion do not rewrite it. The existing explicit equipment-refresh action is the only Character refresh covered by this contract.                                                                       |

## Actor and privacy matrix

| Action                                                             | Player owner                                           | Designated managing GM (Characters with no player owner only)                                                                                                                                                                                                              | Owning campaign GM                                                                                                                         | Other GM                                            | Admin                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------- |
| Finalize a new Character                                           | Yes, becomes owner                                     | Yes for a Character authored with no player owner; the resulting Character has a designated managing GM. This contract does not prescribe how designation is recorded; see [the representation constraint](#the-representation-constraint--ownerid-may-not-be-overloaded). | Yes, becomes owner of their own finalized Character                                                                                        | Yes, becomes owner of their own finalized Character | Yes, becomes owner of their own finalized Character |
| Read/edit/delete an existing Character **that has a player owner** | Yes                                                    | **Never.** This column never applies to a player-owned Character.                                                                                                                                                                                                          | Yes, while the Character is rostered in one of their campaigns                                                                             | No                                                  | Yes                                                 |
| Read/edit/delete an existing Character **with no player owner**    | No such actor exists                                   | Yes. Permanent-Character lifecycle authority, **independent of Campaign roster membership**: before first rostering, while rostered, and after removal from a Campaign.                                                                                                    | Campaign-scoped authority and state only, while the Character is rostered. The roster entry does not confer permanent lifecycle authority. | No                                                  | Yes                                                 |
| List Character records                                             | Owned Characters                                       | The ownerless Characters they manage, independent of roster membership                                                                                                                                                                                                     | Owned plus Characters rostered in their campaigns                                                                                          | Own scope only                                      | All                                                 |
| Use a Character in a Scenario                                      | Existing Campaign/Scenario authorization still applies | Existing Campaign/Scenario authorization still applies                                                                                                                                                                                                                     | Existing Campaign/Scenario authorization still applies                                                                                     | No authority from GM role alone                     | Existing admin authority                            |

Unauthorized Character reads and mutations return `404` so they do not disclose another owner's record or revision.

Campaign membership does not transfer Character ownership or control. A player
initiates joining an eligible Campaign with a Character they are authorized to
control. A managing Campaign GM may remove that Character from the Campaign but
may not pull another user's player-owned Character into it. No additional
invitation or approval workflow is implied. A Character with **no player owner**
is covered separately by
[GM-controlled Characters with no player owner](#gm-controlled-characters-with-no-player-owner);
that section does not weaken this paragraph.

Global roles do not replace these relationships. The `game_master` role alone
does not grant access to another GM's Campaign or Characters, and Admin
capability does not automatically make the user a Campaign GM. Any separately
accepted Admin Character operation remains an Admin-scoped action rather than
Campaign-management authority. See
[Architecture decision 0005](../decisions/architecture/0005-role-scope-and-campaign-ownership.md).

## GM-controlled Characters with no player owner

**PRODUCT OWNER RULING, 2026-09-23. Settled.** Recorded as
[OPEN-PPL-4](../product/people-artifact-and-gm-authoring-model.md#open-ppl-4--what-a-persistent-npc-record-is).

> "A persistent NPC is a Character using the same full Character/rules model as
> a PC, but with no player owner and with GM control under the applicable
> GM/Campaign authority.
> `CampaignRosterEntry` provides Campaign membership; Character itself remains
> independent of Campaign.
> `ReusableEntity` is reusable source/archetype material, not the canonical
> persistent identity of a person."

A `Character` may therefore exist with **no player owner**. It uses the same
full Character and rules model as a player-owned Character; only control
semantics differ.

- **Control.** A Character with no player owner is controlled by the GM under
  the applicable GM/Campaign authority. Such a Character has no actor in the
  _player owner_ column of the
  [actor and privacy matrix](#actor-and-privacy-matrix); the permanent
  lifecycle authority over it is held by its **designated managing GM**, per
  [the managing GM ruling](#pre-roster-and-post-removal-authority--the-designated-managing-gm).
- **Identity is not Campaign-scoped.** `CampaignRosterEntry` provides Campaign
  membership. The canonical `Character` record remains independent of Campaign,
  and membership still creates no second Character authority.
- **`ReusableEntity` is not this record.** It remains reusable source/archetype
  material and is not the canonical persistent identity of a person.
- **Schema evidence.** `Character.ownerId` is already declared `String?` in
  `packages/database/prisma/schema.prisma`, so "no player owner" is an ownership
  state the current schema already permits. The only GM-holding relation in that
  schema today is `ReusableEntity.gmUserId`, which is a required `String` on
  `ReusableEntity` — a record the ruling above has already excluded as the
  canonical persistent identity of a person. Both facts are recorded as evidence
  of the existing shape, not as an implementation instruction and not as a
  prescription of what to build.
- **The V1 rule is unchanged.** One active Campaign per Character continues to
  apply to Characters with and without a player owner alike.

### The player-owned protection is unchanged

**A managing Campaign GM may not pull another user's player-owned Character into
a Campaign.** That protection survives this ruling intact. It is neither
weakened, qualified, nor traded against the new capability.

| Character               | Who may add it to a Campaign                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Has a player owner**  | Only the controlling player initiates joining an eligible Campaign. A managing GM may remove that membership but **may not** pull another user's player-owned Character into one. |
| **Has no player owner** | The GM may add it under the applicable GM/Campaign authority, because there is no player owner whose control would be bypassed.                                                   |

The new capability is defined by the **absence of a player owner**, not by the
GM role. A GM role by itself never becomes authority over a Character that has a
player owner, and an ownerless Character never becomes a route to reach one.

### Pre-roster and post-removal authority — the designated managing GM

**PRODUCT OWNER RULING, 2026-09-23. Settled.** This answers what authority binds
a GM-controlled Character with no player owner before it is rostered in any
Campaign, and after it is removed from one. Authoring necessarily precedes
rostering, so without this ruling the
[actor and privacy matrix](#actor-and-privacy-matrix) left an unrostered
ownerless Character with no actor holding edit authority at all.

> "A persistent ownerless NPC Character has a designated managing GM. That
> managing GM has permanent-Character lifecycle authority independent of
> Campaign roster membership, including before first rostering and after removal
> from a Campaign.
> `CampaignRosterEntry` continues to govern Campaign membership and
> Campaign-scoped authority/state; it does not establish permanent ownership.
> Existing player-owned Character protection remains unchanged: GM status or
> Campaign membership never grants lifecycle ownership/authority over another
> user's player-owned Character.
> Do not overload player `ownerId` to represent the managing GM. If no suitable
> durable authority relation exists, the implementation must add an explicit
> representation rather than infer it from GM role or Campaign membership.
> Record this without narrowing OPEN-PPL-5 or other remaining open decisions."

The four elements of the ruling, stated separately:

1. **A designated managing GM exists.** Every persistent ownerless NPC Character
   has one. It is a property of that Character, not of a Campaign.
2. **That GM's permanent-Character lifecycle authority is independent of roster
   membership.** It holds before first rostering, while the Character is
   rostered, and after the Character is removed from a Campaign. Rostering
   neither creates nor terminates it.
3. **`CampaignRosterEntry` governs Campaign membership and Campaign-scoped
   authority and state only.** It does **not** establish permanent ownership.
   The [authorities table](#authorities) and the
   [actor and privacy matrix](#actor-and-privacy-matrix) are updated to say so.
4. **The player-owned protection is unchanged.** GM status or Campaign
   membership never grants lifecycle ownership or authority over another user's
   player-owned Character. Nothing in this ruling reaches a Character that has a
   player owner. The two cases are kept distinguishable throughout: the
   _designated managing GM_ column of the matrix applies **only** to Characters
   with no player owner, and the read/edit/delete row is split so the
   player-owned case retains its existing, unamended grant.

This ruling states **who** holds the authority. It does not enlarge **what**
that authority is: the lifecycle checkpoints, mutation contract, revision
comparison and `404` non-disclosure behaviour of this document apply to an
ownerless Character exactly as they apply to a player-owned one.

Later materialization or promotion from reusable content to a persistent
Character remains the concern of
[OPEN-PPL-5](../product/people-artifact-and-gm-authoring-model.md#open-ppl-5--what-actor-to-persistent-npc-promotion-preserves)
and is not answered, narrowed or pre-empted here. No other open decision is
narrowed by this ruling.

### The representation constraint — `ownerId` may not be overloaded

**This is a binding constraint on the implementing lane, not a suggestion.**

- **`Character.ownerId` must not be overloaded to represent the designated
  managing GM.** `ownerId` means the player owner. A GM user id written into it
  would make an ownerless NPC indistinguishable from a player-owned Character
  and would silently extend player-owner semantics to GM-managed records.
- **If no suitable durable authority relation exists, the implementation must
  add an explicit representation.** It may **not** infer the managing GM from
  the `game_master` role, from Campaign ownership, or from
  `CampaignRosterEntry` membership. Inference from role or membership is
  precisely what the ruling forbids, because both are Campaign-scoped or global
  and the authority being represented is neither.
- **Schema evidence about what exists today**, recorded as evidence and not as
  an instruction about what to build: in
  `packages/database/prisma/schema.prisma`, `Character.ownerId` is `String?`,
  and the only GM-holding relation is `ReusableEntity.gmUserId`, a required
  `String` on `ReusableEntity` — which this document has already excluded as
  the canonical persistent identity of a person. Whether any of this is a
  suitable durable authority relation for the managing GM is the implementing
  lane's determination under the constraint above; this document does not make
  it.
- Adding such a representation is a persisted-schema and security-relevant
  change and therefore carries the
  [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor).

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

`updatedAt` is the server's opaque Character revision; clients compare it for equality and do not infer ordering or game meaning from it. Browser-local `updatedAt` is only the local save time. `serverUpdatedAt` records the canonical revision on which that cache or draft was based. For existing synced browser records created before `serverUpdatedAt`, their `updatedAt` is used once as the compatibility base revision.

### Delete

`DELETE /characters/:id` requires the same actor authorization and `expectedUpdatedAt` comparison. A successful delete atomically removes the canonical Character and its generic Campaign roster references. Character-owned database records follow their declared cascade behavior. Scenario participant rows, snapshots, and live state remain; their nullable Character source link becomes `null`.

A stale delete returns `409 stale_character` and changes nothing.

## Golden transitions

1. **Draft -> finalized:** a valid local chargen draft is finalized by an authenticated user; one canonical server Character is created and the browser stores a synced cache with its server revision.
2. **Finalize retry:** the response is lost and the identical request is repeated; the existing record is returned without rewriting it.
3. **Finalized -> edited:** an owner, owning GM, or admin submits the exact base revision; one new canonical revision is returned and cached.
4. **Offline edit -> synchronized:** the browser retains the base server revision while saving local changes. Synchronization succeeds only if that base is still current.
5. **Concurrent edit conflict:** another actor saves first; the later stale draft receives `409`, remains recoverable locally, and cannot overwrite the newer Character.
6. **Conflict recovery:** the canonical server Character is shown as current while the retained draft can be reviewed, left for later, or discarded. No recovery choice automatically merges or overwrites either record.
7. **Rostered:** the controlling player initiates eligible Campaign joining;
   Campaign membership refers to the canonical Character and does not create
   another Character authority. The managing GM may remove the membership but
   may not pull in another user's player-owned Character.
   A Character with **no player owner** is instead rostered by the GM under the
   applicable GM/Campaign authority; membership still refers to the canonical
   Character, still creates no second Character authority, and still does not
   make Character identity Campaign-scoped. Its designated managing GM already
   held permanent-Character lifecycle authority before this transition and
   continues to hold it after the Character is removed from the Campaign;
   the roster entry neither creates nor terminates that authority. The
   prohibition in the preceding sentence is unaffected and continues to protect
   every player-owned Character. See
   [GM-controlled Characters with no player owner](#gm-controlled-characters-with-no-player-owner).
8. **Snapshotted:** Scenario admission copies the Character into Scenario-owned snapshot/live state. Later Character edits have no effect unless the owning GM invokes the existing explicit equipment refresh.
9. **Deleted:** the canonical Character and roster references are removed at the expected revision. Existing Scenario snapshots remain usable historical state with no live Character link.
10. **Retired:** the current schema has no Character retirement state. Retirement is unsupported rather than silently represented as deletion, roster removal, or a browser-local flag; adding it requires a future explicit server lifecycle decision.

## Compatibility limits

- Existing server Character builds are accepted as finalized records. This task does not migrate or reinterpret rolled stats, `Original`, `Developed`, `Current`, Skills, progression fields, or `statModifiers`.
- Existing local-only Characters remain local and have no server mutation authority until finalized through the create contract.
- Existing synced local caches use their saved server timestamp as the initial base revision; once refreshed or saved, `serverUpdatedAt` is explicit.
- Character read-model and formula conformance belongs to C&P-2 and is deliberately outside this contract.
