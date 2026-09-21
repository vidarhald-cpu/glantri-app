# AI-assisted Artifact and Item intake

The documented interchange format and the staging contract for bringing
material produced in an ordinary AI conversation into a Campaign, with no
developer tooling, no checksums, no manifests and no repository access.

Authoritative product rulings: Forgejo issue #271 (intake) and #268 (the Item
versus Artifact distinction).

## The division of labour

The person or the AI states only **human and semantic facts**. Glantri derives
**every technical fact** — SHA-256, MIME type, byte size, storage identity,
internal package state and every database identity. The format has no place to
supply one, and the schema rejects any attempt to add one.

## The invariant

**No canonical Item or Artifact exists before the GM confirms.** Intake stages
a proposal; the GM reviews it, corrects or binds what needs it, and
confirmation is what creates canonical state. Abandoning or rejecting a staged
proposal leaves no residue: no partial Item, no orphan Artifact, and no
retained stored bytes.

## The format

`glantri-intake` version 1. One JSON object, accepted by paste or as a context
file, alongside the loose files it describes.

```json
{
  "format": "glantri-intake",
  "version": 1,
  "notes": "optional free text kept as GM notes",
  "entries": [
    {
      "represents": "item",
      "filename": "torn-treasure-map.png",
      "title": "Torn Treasure Map",
      "kind": "map",
      "description": "A salt-stained half of a sea chart.",
      "gmNotes": "The missing half is held by the harbourmaster.",
      "playerDescription": "A torn, salt-stained sea chart.",
      "suggestedVisibility": "gm_private",
      "tags": ["clue", "harbour"],
      "relatedTo": "Captain Varro"
    }
  ]
}
```

| Field                 | Required             | Meaning                                                                      |
| --------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `represents`          | yes                  | `item` for a physical game-world object; `artifact` for pure reference media |
| `title`               | yes                  | the name of the Item or Artifact                                             |
| `filename`            | for `artifact`       | exact name of a supplied file; an `item` may be described without one        |
| `kind`                | when a file is named | `map`, `image`, `portrait`, `document` or `handout`                          |
| `description`         | no                   | shared description of the object or the media                                |
| `gmNotes`             | no                   | GM-private notes, never player-facing                                        |
| `playerDescription`   | no                   | becomes the Artifact alt text                                                |
| `suggestedVisibility` | no                   | `gm_private` or `campaign`; recorded as a suggestion only                    |
| `tags`                | no                   | suggested tags, retained as GM notes                                         |
| `relatedTo`           | no                   | plain name of another object                                                 |

Unknown fields, a wrong `format` or `version`, a truncated paste, a missing
required fact, two entries describing one file, and two entries sharing a
title are all refused with the reason shown. Nothing is coerced, and a partly
valid context is never partly accepted.

Free text is retained as GM notes only. **V1 does no prose-to-structure
parsing.**

## Item versus Artifact

Following #268: where the context describes a physical object, intake proposes
the **canonical Item**, and the file, if any, becomes an **Artifact attached to
it as its representation**. The image is never treated as the game-world
object. A pure Artifact entry proposes only the Artifact.

An attached representation is a link and nothing more. It transfers no
ownership, changes no Item presence or location, and makes no Artifact into a
game-world object.

Items created by intake are descriptive-only: they carry campaign presence and
no holder, with no Equipment template and therefore no mechanical behaviour.
The GM gives them mechanics afterwards through the Campaign Items surface.

## Relationship resolution

`relatedTo` is resolved **conservatively** during staging, against campaign
Items, campaign Artifacts, and the other entries in the same proposal. The
comparison is exact, ignoring only letter case and repeated whitespace.

- **exactly one match** — proposed automatically, and shown as a proposal the
  GM can change or clear;
- **no match** — surfaced plainly, and confirmation stays blocked until the GM
  binds a target or clears the relationship;
- **more than one match** — surfaced with the candidates listed, and
  confirmation stays blocked in the same way.

**Nothing is ever guessed.** V1 expresses one relationship: an Artifact
attached to an Item as its representation. Any other pairing is surfaced as
unsupported rather than approximated.

## Visibility

Every Artifact intake creates begins **GM-private**, whatever the context
suggested. A suggested visibility is shown in the preview and kept in the GM
notes; sharing stays a separate, deliberate act on the Artifact surface.

## What the preview shows

What would be created (a canonical Item, a pure Artifact, or an Item with its
attached representation); the semantic fields; which file belongs to which
proposed object; each relationship and how it resolved, including the ones
that did not; the problems; and the technical metadata Glantri derived —
media type, byte size, SHA-256 and storage identity — as confirmation that the
GM never had to supply any of it.

## The advanced path

The `Import Artifact package` route, with its authored manifest and declared
checksums, is unchanged. It remains available for package-shaped work, it is
not a prerequisite for ordinary intake, and ordinary intake never requires a
GM to see a manifest.
