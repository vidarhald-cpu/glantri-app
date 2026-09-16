# GLANTRI #117 — GM EQUIPMENT ITEM LIFECYCLE V1

## Durable Product / Architecture Contract

### Status

**Portfolio area:** #117 Items / Equipment\
**Milestone:** GM Equipment Item Lifecycle V1\
**Architecture state:** Ready for activation preflight\
**Nature of this contract:** Product/domain architecture, not an implementation contract

This contract defines the next major #117 capability. It supersedes the fragmented treatment of Item creation, support-state presentation, discovery, and ordinary GM lifecycle management as unrelated small features.

It does not authorize implementation, Builder dispatch, branch creation, schema migration, or PR work.

Because #117 is an active/immediate lane, the bounded current-model inspection already completed is accepted architectural evidence. A later activation preflight may inspect then-current `dev` only as necessary to map this contract onto the implementation.

---

# 1. Product outcome

The controlling milestone outcome is:

> **A GM can efficiently find/select an Equipment Template, create a persistent usable Item from it, customize approved instance properties while preserving Template inheritance, save it, place/assign/equip it, find the same Item again, edit it later, revert overrides, and move/manage it without losing Item identity.**

The same Item architecture must support **descriptive-only Items** that have no Equipment Template and therefore acquire no fabricated Equipment mechanics.

This milestone covers the usable GM Item lifecycle, not merely a better Item-creation form.

The lifecycle includes:

**discover Template → create Item → customize → save → place/assign → equip where relevant → rediscover → inspect → edit → revert overrides → move/reassign → continue using the same persistent Item**

---

# 2. Controlling domain separation

Glantri preserves two distinct concepts.

## 2.1 Equipment Template

An **Equipment Template** is a reusable mechanical definition.

It conceptually owns:

- stable Template identity;
- Equipment category/type;
- canonical Template name;
- canonical Template description;
- approved mechanical structure;
- approved mechanical properties;
- structural relationships and capability definitions;
- the policy describing which existing mechanical properties may be overridden on individual Items;
- active/inactive or otherwise selectable-for-new-creation status.

A Template is a definition.

It is **not**:

- an Item in a Character inventory;
- a world object;
- a stack of objects;
- a specific named sword;
- an ownership/location record.

## 2.2 Item

An **Item** is a persistent game-world object.

It conceptually owns:

- stable Item identity;
- optional Equipment Template reference;
- optional custom instance name;
- instance-specific description/notes;
- ordinary Item physical and lifecycle state;
- explicit permitted Equipment-property overrides;
- quantity where the Item's capability supports quantity;
- holder/location relationship;
- loadout/equipment relationship where relevant;
- concurrency/version identity.

A template-backed Item retains Template provenance throughout its lifecycle.

The Item is not a copied snapshot of the Template's mechanics.

---

# 3. Descriptive-only Items

A persistent Item may exist with **no Equipment Template reference**.

No dummy or fabricated Template is required.

A descriptive-only Item may contain approved generic Item information such as:

- name;
- description/notes;
- holder/location;
- generic physical information;
- encumbrance where coherent semantics exist;
- other ordinary Item-instance metadata supported by the Item domain.

It acquires no:

- weapon mechanics;
- armor mechanics;
- shield mechanics;
- ammunition mechanics;
- attack capability;
- defensive capability;

merely because its prose description suggests that it could physically be used that way.

Any later ordinary-object, secondary-weapon, or improvised-weapon system remains a separate rule domain.

---

# 4. Existing Character-equipment migration boundary

There are currently **no existing Characters with Equipment Item state that must be preserved or migrated for this milestone**.

Therefore the future Item model must not preserve awkward legacy Character-equipment representation solely for backward compatibility with nonexistent live equipped-Character data.

No live Character-equipment migration requirement should constrain the V1 architecture.

This does **not** establish that all persisted Item references are disposable.

Activation must still check for:

- Campaign Items;
- Scenario/world references;
- test fixtures intended as durable data;
- other persisted Item identities or relationships.

Destructive implementation assumptions require that bounded verification.

---

# 5. Item inheritance and override model

For every instance-overridable Equipment property:

> **Effective(Item, property) = explicit Item override when present; otherwise current Template value.**

This is the controlling mechanical invariant.

An Item therefore contains only deliberate exceptions to its Template, not a full copied set of mechanical values.

## 5.1 Explicit override presence

Override presence must be represented explicitly.

The system must distinguish:

- no override;
- explicit `0`;
- explicit `false`;
- any other valid zero-like or empty-looking value.

Truthiness must not determine override presence.

## 5.2 Required conceptual presentation

For an overridable property, the GM must be able to distinguish:

**Template value**\
**Item override:** none or explicit value\
**Effective value**

Example:

Template value: `4`\
Item override: `5`\
Effective value: `5`

or:

Template value: `4`\
Item override: none\
Effective value: `4`

## 5.3 Override operations

The GM must be able to:

- add an override;
- change an override;
- remove an override;
- revert to Template inheritance.

**Revert to Template** means deleting/removing the explicit override.

It does not mean storing a copy of the Template's current value on the Item.

---

# 6. Mechanical property-classification policy

Every mechanical Equipment property is classified into exactly one of three conceptual classes.

## A. Template-only

A Template-only property defines structural or mechanical identity rather than ordinary variation between individual specimens.

Changing it on one Item would ordinarily mean that the Item represents a different mechanical definition.

Current-model examples include structural concepts such as:

- Equipment category;
- Equipment subtype;
- weapon class;
- governing Skill;
- handling class;
- attack-mode identity;
- attack-mode topology/order;
- delivery/slash/strike/thrust identity;
- repeated-attack capability;
- missile-family compatibility;
- preparation model;
- readiness persistence;
- rapid-shot eligibility;
- armor body/component structure;
- equivalent structural rule/capability relationships.

These remain Template concerns.

## B. Instance-overridable

An existing authoritative mechanical **leaf/input property** may be instance-overridable when individual examples of the same Template can legitimately differ in that property without changing fundamental Template identity.

Such an Item may either:

- inherit the Template value; or
- contain an explicit Item override.

Existing operative disarm capability/control-rating override behavior may remain in this class because it has an actual rules consumer.

The allowlist is semantic rather than UI-driven.

A property is not instance-overridable simply because it is stored in a numeric or Boolean field.

## C. Derived / not directly editable

A value is Derived/not directly editable when it is calculated or determined from other authoritative state.

Such values may be displayed but must not independently become Item override inputs unless an approved rule explicitly defines them as such.

Examples include final results calculated from combinations of:

- Equipment inputs;
- Character values;
- loadout;
- situation;
- combat state.

---

# 7. Source-versus-result invariant

Where one Equipment value is derived from another:

> **Override the authoritative source/input and recompute the dependent result.**

Do not independently override both source and result unless approved rules explicitly define both as independent mechanical inputs.

This rule applies particularly to current relationships involving:

- weapon calculations;
- DMB;
- armor general/component/regional calculations;
- disarm control rating;
- Character + Equipment + situation combat outcomes.

The Item editor must not create mechanically contradictory Equipment by exposing every stored or calculated number as independently editable.

---

# 8. Current +1 sword / final-OB mechanism

The existing `finalAttackObDelta` / “+1 sword” mechanism is not the architecture for future Item overrides.

The bounded current-model review established that it is:

- stored as a typed Item fact;
- scoped to final attack OB;
- presented as reference-only;
- not an operative attack-mode OB override;
- not the authoritative general Equipment-property customization mechanism.

The current typed weapon-initiative Item fact is likewise reference-only during play.

## V1 ruling

These reference-only facts must **not** be generalized into the future Item override architecture.

Compatibility/provenance may remain where genuinely needed, but mechanical Item customization must operate on approved authoritative Equipment inputs and let existing calculations derive their results.

The Item editor therefore does not directly edit:

- final Character OB;
- final Character DB;
- final Parry;
- final Character initiative;
- equivalent Character/situational combat outputs.

The useful architectural principle surviving from the old `+1 sword` behavior is simply that an individual Item may have mechanically significant instance state.

Its OB-centric data path is a historical implementation constraint, not the future domain model.

---

# 9. Ordinary Item state versus mechanical overrides

Ordinary Item-instance information is distinct from the Equipment override allowlist.

Supported ordinary Item state may include, according to existing domain support:

- custom name;
- description/notes;
- acquisition/source information;
- favorite/status metadata;
- material;
- quality;
- condition;
- durability;
- quantity;
- holder/location;
- loadout relationship;
- generic physical information;
- generic value information.

The existence of any of these facts does not automatically imply mechanical effects.

In particular:

- material;
- quality;
- condition;
- durability

must not automatically alter weapon, armor, shield, or other Equipment mechanics unless an approved rule explicitly establishes that relationship.

Item facts and Equipment mechanics remain distinct concepts.

---

# 10. Naming semantics

Naming semantics are fixed.

For a template-backed Item:

- **no custom Item name** → display the current Template name;
- **custom Item name present** → display and retain the custom Item name.

Consequences:

- ordinary Items follow future Template naming corrections;
- unique/named Items retain their own identity;
- Template name does not need to be permanently copied into every Item instance.

Example:

Template: `Longsword`

Item with no custom name:

> Longsword

Item with custom name:

> Sword of Captain Alrik

Both remain mechanically based on the Longsword Template.

---

# 11. Description semantics

Template and Item prose have different meanings.

**Template description**

> Explains what the Equipment definition is.

**Item description/notes**

> Explain what is distinctive about this particular physical Item.

Item description supplements the Template description.

It does not destructively replace or erase the Template's explanatory content.

---

# 12. Template evolution and live inheritance

Template-backed Items use **live inheritance**.

Example:

Template property X = `4`

Item A:

- override absent

Item B:

- explicit X override = `5`

The Template later changes:

Template X = `3`

The resulting effective values are:

Item A effective X = `3`\
Item B effective X = `5`

This behavior is fundamental to the Template/Item distinction.

The system must not snapshot every Template property into every Item at creation.

---

# 13. Template retirement and deletion

A Template may become:

- retired;
- inactive;
- unavailable for creation of new Items.

Existing Items referencing that Template must nevertheless continue to resolve it.

Ordinary retirement must not:

- corrupt existing Items;
- remove their provenance;
- destroy inherited mechanical state;
- silently turn them into descriptive-only Items.

Hard deletion of a referenced Template is therefore not an ordinary Template lifecycle operation.

Likewise, Template schema changes or changes to the allowed override policy must not silently discard existing Item overrides.

Such changes require deliberate migration or compatibility handling.

---

# 14. No Template switching in V1

Ordinary Item editing does not permit:

> Longsword → Battle Axe

while retaining the same Item as though only a normal instance property changed.

Changing Template association in this way alters fundamental mechanical identity.

Retemplating/conversion is outside GM Equipment Item Lifecycle V1 unless a separate future rule defines its semantics.

---

# 15. Encumbrance

Encumbrance remains a legitimate generic physical concept, but current effective-ENC semantics are not sufficiently coherent to expose one universal mechanical ENC override.

The bounded review identified inconsistent current behavior:

- generic Item ENC override logic can bypass factors such as quantity, material, quality, and carry state;
- armor uses a different calculation path.

Therefore:

> **V1 architecture does not define a universal direct effective-ENC override control.**

Activation must perform a bounded reconciliation of the current calculation paths before such a control is exposed.

This is an activation/design issue, not a reason to reopen the overall Item lifecycle architecture.

---

# 16. Quantity

Quantity is **capability-specific**, not a generic arbitrary property of every Item.

Current product findings support quantity for categories such as:

- supported ammunition families;
- valuables or other specifically quantity-bearing Item types.

Ordinary individual:

- weapons;
- armor;
- shields;
- non-quantity gear

remain individual Items unless their approved capability explicitly says otherwise.

Names, tags, or container roles do not independently grant quantity capability.

A Longsword must not become:

> quantity = 17

merely because the persistence layer contains a quantity column.

## Current bounded inconsistency

The current implementation has a quantity-related inconsistency:

- Item validation expects positive quantity;
- missile consumption may write zero;
- consumption currently subtracts literal `1` despite `quantityPerShot`.

This is an activation defect/consistency concern.

It does not authorize redesign of ammunition-consumption mechanics within this product contract.

---

# 17. Loadout and equip relationship

Current Character equipment state is richer than a generic `equipped=true` flag.

Existing loadout concepts include relationships such as:

- armor;
- shield;
- primary weapon;
- secondary weapon;
- missile weapon;
- active ammunition;
- quick-access Items.

Therefore:

> **The Item lifecycle consumes the existing loadout/equipment-legality model rather than creating a second authoritative equip Boolean.**

The lifecycle must support equip/unequip actions where appropriate, but their validity is determined by existing equipment rules.

This milestone does not redesign:

- weapon combination rules;
- two-handed restrictions;
- armor legality;
- shield legality;
- Combat availability;
- loadout mechanical consequences.

---

# 18. Item identity and movement

A persistent Item retains its identity through ordinary lifecycle operations.

The following operations modify the same Item:

- assign;
- reassign;
- give;
- move;
- place;
- equip;
- unequip;
- edit description;
- rename;
- add/remove permitted overrides.

They must not silently create replacement Items.

Template provenance, overrides, ordinary Item state, and stable Item identity survive movement unless an explicit rule states otherwise.

---

# 19. Concurrency

Editable persistent Items require stale-update protection.

Silent last-write-wins is not acceptable.

Example:

1. GM session A opens Item X.
2. GM session B opens Item X.
3. A saves a change.
4. B attempts to save their older version.

B's stale write must fail safely.

The product behavior should:

- inform the user that the Item changed;
- prevent silent replacement of newer state;
- preserve unsaved user input where practical;
- allow the user to reload and deliberately reapply the intended change.

V1 does not require automatic generic field-by-field merging.

The same safety principle applies to stale:

- holder changes;
- location changes;
- assignment;
- equip/loadout transitions.

---

# 20. Permissions and authority

## GM authority

Within the GM's authorized Campaign scope, the GM may:

- create a Template-backed Item;
- create a descriptive-only Item;
- edit permitted ordinary Item state;
- create permitted mechanical overrides;
- edit permitted overrides;
- remove/revert permitted overrides;
- assign or reassign Items;
- move/place Items;
- equip/unequip Items through existing loadout rules;
- alter quantity where the Item type supports quantity.

Equipment Template editing is a separate capability.

## Player authority

The previously approved principle remains:

> A player may give/drop/move their own controllable out-of-combat Items where the specific operation and context permit it.

This does not authorize the player to:

- edit Equipment Templates;
- edit mechanical Item overrides;
- manipulate another player's Items;
- manipulate GM/world-controlled Items;
- bypass Encounter/Combat authority;
- bypass equipment legality.

Player Item movement is a later consumer of this architecture, not part of this GM milestone.

---

# 21. Core GM workflows

## Workflow A — Create from Character inventory

1. GM opens a Character inventory.
2. GM chooses to add an Item.
3. GM chooses either:
   - Equipment Template-backed Item; or
   - descriptive-only Item.
4. For Template-backed creation, GM searches/filters existing Templates.
5. The selector exposes enough existing mechanical summary to identify the intended Template.
6. GM selects the Template.
7. Item creation initially inherits Template values.
8. GM may enter ordinary Item-instance state.
9. GM may override only approved instance-overridable mechanical properties.
10. The UI distinguishes Template, override, and effective values.
11. GM saves.
12. The Item retains the originating Character as its destination/context.
13. GM may equip it through existing loadout rules where appropriate.

## Workflow B — Create an unassigned/Campaign/world Item

1. GM opens the Campaign Item-management context.
2. GM creates a Template-backed or descriptive-only Item.
3. GM saves it without assigning it to a Character.
4. The Item exists persistently in an appropriate Campaign/world location.
5. It may subsequently be found and assigned/moved.

This supports objects that begin as:

- treasure;
- NPC equipment;
- staged rewards;
- world objects;
- GM-prepared Items.

## Workflow C — Edit an existing Template-backed Item

The GM can reopen the persistent Item and inspect:

- stable Item identity;
- custom name, if any;
- Template provenance;
- Template values;
- explicit overrides;
- effective values;
- ordinary Item state;
- current holder/location;
- current loadout relationship where relevant.

Editing the Item does not edit its Equipment Template.

## Workflow D — Revert an override

For an overridable property:

1. GM selects revert/remove override.
2. The explicit Item override is deleted.
3. Effective value immediately becomes the current Template value.
4. Future Template changes affect the Item again.

## Workflow E — Assign/reassign/move

The GM can move the same persistent Item between permitted holders or locations.

The operation preserves:

- Item identity;
- Template provenance;
- overrides;
- descriptive state;
- supported quantity.

## Workflow F — Equip/unequip

GM chooses an Item already eligible for a Character/loadout context.

The lifecycle requests the appropriate existing loadout change.

The existing loadout legality model decides whether that state is permitted.

## Workflow G — Rediscover and manage

The GM can find an existing Item through Campaign Item discovery using suitable current domain attributes such as:

- Item/custom name;
- Template identity/name;
- holder;
- Character;
- location/context.

From the result the GM can navigate back to the same persistent Item and continue its lifecycle.

---

# 22. Acceptance examples

## Example 1 — Ordinary inherited weapon

GM finds the existing Longsword Template and creates an Item for Armand.

No mechanical override is entered.

The resulting Item:

- references Longsword;
- inherits its current mechanical properties;
- appears in Armand's inventory;
- can participate in existing loadout rules;
- can later be reopened and edited.

## Example 2 — Approved mechanical variation

A Template contains an authoritative property classified as instance-overridable.

Template value:

> X = 4

GM creates an Item and sets:

> X override = 5

The Item's effective X is 5.

Other Template properties remain inherited.

The mechanism does not depend on the property being OB-related.

## Example 3 — Explicit zero

Template value:

> X = 2

GM enters an approved explicit override:

> X = 0

The system treats 0 as a real override, not as absence of an override.

## Example 4 — Revert

The Item above is later reverted.

The X override is removed.

The Item again inherits Template X.

The implementation must not store the current Template value as a pseudo-override.

## Example 5 — Live Template change

Two Items reference Template T.

Item A:

- no X override

Item B:

- X override = 5

Template X changes from 4 to 3.

Results:

Item A effective X = 3\
Item B effective X = 5

## Example 6 — Unique Item name

Template:

> Longsword

The GM creates an Item named:

> Alrik's Sword

The Item continues to reference Longsword mechanically.

A later Template rename does not replace the custom Item name.

## Example 7 — Ordinary unnamed Item

Another Item based on Longsword has no custom name.

The Template is later renamed.

The Item's displayed name follows the current Template name.

## Example 8 — Description preservation

The Longsword Template contains explanatory rules/prose.

The GM adds Item notes describing engraving and ownership history.

Both remain available.

The Item notes do not replace the Template description.

## Example 9 — Descriptive-only Item

GM creates:

> Letter from Prince Jaggar

without an Equipment Template.

It may have ordinary Item state and generic supported physical information.

It gains no Equipment mechanics.

## Example 10 — Quantity-bearing ammunition

GM selects an ammunition family that supports quantity.

GM creates:

> Arrows — quantity 20

The Item preserves its quantity when assigned or moved.

This does not imply that ordinary swords support quantity.

## Example 11 — No false final-OB override

GM creates an unusual weapon Item.

The lifecycle may expose approved authoritative mechanical inputs.

It does not provide a generic editor for:

> Character final OB = +1

as though final Character combat output were an Equipment-property override.

## Example 12 — Stale edit

Two sessions edit the same Item.

One saves first.

The other cannot silently overwrite that newer Item state.

## Example 13 — Movement preserves identity

GM creates an Item as Campaign treasure.

The Item is later assigned to an NPC and subsequently transferred to a PC.

All transitions reference the same Item identity.

## Example 14 — Equip semantics

A weapon Item is assigned to a Character.

The GM equips it as the appropriate loadout role.

The resulting state uses the existing loadout model rather than setting an independent generic `equipped=true` value.

---

# 23. Existing #139–#145 conceptual reconciliation

These dispositions are architectural and must be reconciled against actual current Forgejo issue state during activation.

## #139 — truthful Item support-state presentation

**Disposition:** substantially absorbed into GM Equipment Item Lifecycle V1 acceptance.

Its durable requirement survives as:

- accurate inherited/override/effective presentation;
- no UI implication that reference-only or unsupported values are mechanically operative.

Do not automatically dispatch #139 as a separate overlapping Builder task.

## #140 — quantity/ammunition support

**Disposition:** retained product requirement.

Prefer inclusion in the primary lifecycle slice if the activation preflight shows it can be implemented coherently without introducing an unrelated dependency/hotspot.

Otherwise treat it as a bounded follow-up Slice B.

Its product requirement is not discarded either way.

## #141 — Campaign Item discovery/contextual navigation

**Disposition:** core lifecycle capability absorbed into Slice A.

“Create Item” without being able to rediscover and manage the same Item does not satisfy the milestone.

## #142 — ordinary Item creation/conflict behavior

**Disposition:** substantially superseded/absorbed by the major lifecycle milestone.

Its meaningful requirements survive through:

- efficient creation;
- persistent Item identity;
- stale-update protection;
- safe lifecycle management.

It should not independently drive another overlapping Item creator.

## #143 — mobile/personal inventory work

**Disposition:** separate later product capability.

It consumes the resulting Item architecture but is not part of this GM milestone.

## #144 — player out-of-combat Item movement

**Disposition:** separate later capability.

The approved authority principle is preserved, but player movement is not bundled into the GM lifecycle implementation.

## #145 — catalogue-content consumption

**Disposition:** independent content/catalogue stream.

It can expand the Template set exposed through the Item selector without redefining Item lifecycle architecture.

---

# 24. Explicit exclusions

GM Equipment Item Lifecycle V1 does not include:

- redesign of weapon mechanics;
- redesign of armor mechanics;
- redesign of shield mechanics;
- Critical-system redesign;
- Combat action-rule redesign;
- improvised-weapon mechanics;
- automatic ordinary-object weapon conversion;
- secondary-weapon rules for arbitrary Worldly Items;
- enchanting;
- crafting;
- new durability/repair mechanics;
- broad Equipment Template authoring/redesign;
- arbitrary Template switching/retemplating;
- shop/economy/pricing systems;
- player editing of mechanical Item properties;
- broad player/mobile inventory redesign;
- Scenario architecture redesign;
- stack splitting;
- stack merging;
- ammunition-consumption redesign;
- snapshotting all Template mechanics into every Item;
- generic editing of final Character combat outputs.

Existing ordinary Item facts such as condition/durability may remain Item state without this milestone inventing mechanical consequences for them.

---

# 25. Recommended implementation slice structure

The product milestone remains singular:

> **GM Equipment Item Lifecycle V1**

Implementation should prefer one substantial primary vertical slice rather than re-fragmenting the capability.

## Slice A — GM Equipment Item Lifecycle

Preferred scope:

- Template search;
- Template filtering;
- Template selection;
- sufficient mechanical summary for selection;
- Template provenance;
- Template-backed Item creation;
- descriptive-only Item creation;
- live Template inheritance;
- approved mechanical instance overrides;
- truthful Template/override/effective presentation;
- add/edit/remove/revert override;
- custom Item name;
- instance description/notes;
- create from Character inventory context;
- create as unassigned/Campaign/world Item;
- persistence;
- stable Item identity;
- stale-edit protection;
- assign/reassign;
- preserve identity through movement;
- equip/unequip through existing loadout legality;
- Campaign Item discovery;
- contextual navigation;
- reopen and edit existing Item.

This slice absorbs the meaningful product substance previously distributed across #139, #141, and #142.

## Optional Slice B — quantity-bearing Equipment / ammunition

A separate Slice B should exist only if activation finds a genuine technical/dependency boundary that would make quantity materially unsafe or disproportionately expensive to include in Slice A.

Otherwise quantity should be incorporated into Slice A.

If separate, Slice B covers only the already-approved quantity capability and necessary ammunition lifecycle behavior.

It must not become a general ammunition/combat-mechanics redesign.

---

# 26. Activation-preflight requirements

Before Builder authorization, the Orchestrator should perform a bounded activation preflight against then-current `dev`.

The preflight must not reopen this product architecture.

It should establish implementation mapping for the following.

## 26.1 Current domain/schema mapping

Identify the current representations corresponding to:

- Equipment Templates;
- Items;
- Template references;
- ordinary Item state;
- Item facts;
- loadout relationships;
- holder/location relationships;
- version/concurrency state.

## 26.2 Property classification pass

Classify the actual current Equipment properties using the approved policy:

**structural/identity property → Template-only**

**legitimate per-specimen authoritative leaf/input → Instance-overridable**

**calculated/result property → Derived/not directly editable**

Do not send every field back for PO approval.

Escalate only a property for which there is a genuine gameplay/product ambiguity about whether individual physical Items may legitimately differ.

## 26.3 Override model mapping

Determine the clean current implementation mechanism for:

- explicit override presence;
- typed values;
- inheritance;
- effective-value calculation;
- override removal.

Do not automatically reuse the old reference-only final-OB/initiative fact mechanism.

## 26.4 Existing persisted references

Because Character-equipment migration is not required, activation may replace legacy Character-Item representation where appropriate.

However, first verify any persisted:

- Campaign Item references;
- Scenario/world references;
- other durable Item identities.

## 26.5 Encumbrance reconciliation

Resolve enough of the current ENC calculation inconsistency to determine:

- which physical ENC state remains valid Item information;
- how effective ENC is calculated;
- whether any direct Item-level ENC input can safely be exposed.

Do not expose a generic effective-ENC override until semantics are coherent.

## 26.6 Quantity boundary

Verify:

- which current categories actually support quantity;
- ammunition quantity semantics;
- handling of zero quantity;
- existing `quantityPerShot` interaction.

Determine whether #140 safely belongs in Slice A or requires bounded Slice B.

## 26.7 Loadout integration

Map Item lifecycle operations onto the existing authoritative loadout model.

Do not create an independent equip-state authority.

## 26.8 Concurrency mechanism

Establish the implementation mechanism providing stale-update protection for persistent Item changes and state transitions.

## 26.9 Issue-state reconciliation

Inspect actual current Forgejo state for:

- #117;
- #139;
- #140;
- #141;
- #142;
- #143;
- #144;
- #145.

Reconcile titles/status/dependencies/subsumption before implementation dispatch.

No issue should be independently implemented merely because it exists.

## 26.10 Builder contract preparation

Only after the preflight should the Orchestrator prepare:

- accepted baseline branch/SHA;
- implementation ownership boundaries;
- hotspots;
- exact source files;
- verification requirements;
- Builder authority;
- independent QA contract.

Those are activation artifacts, not part of this durable product contract.

---

# 27. Remaining Product Owner decisions

**No material product or architecture decision remains open for GM Equipment Item Lifecycle V1.**

The following are deliberately **not** unresolved PO questions:

- the complete current property-to-field implementation mapping;
- exact persistence mechanism for overrides;
- exact stale-update technology;
- whether quantity implementation fits safely into Slice A;
- reconciliation of inconsistent current ENC implementation paths.

Those are bounded activation/implementation-preparation questions under the approved architecture.

A field should return to the Product Owner only if the activation classification pass finds genuine ambiguity about the game meaning of individual Item variability.

---

# Final readiness

## **#117 GM Equipment Item Lifecycle V1 — product architecture Ready for activation preflight**

The durable product contract is complete.

The next permitted step is bounded Orchestrator activation against then-current `dev`, followed by task-contract preparation and the normal Builder → independent QA → conditional integration lifecycle under the applicable authorization. Genuine unresolved product/rule/architecture questions return to the control plane.

No implementation is authorized by this document itself.

The activation preflight requires a separate control-plane order; this documentation publication does not authorize it.
