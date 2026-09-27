# Approved competency catalogue reader-prose source

Status: **#102 is NOT dispatchable.** Publication here is provenance only.

Forgejo #102 (`[SKILLS][CONTENT][REFERENCE] Full 172-entry competency catalogue prose
integration`) names this package as its approved prose source and pins its SHA-256 and byte
length in the issue body. The Product Owner ruling of 26 September 2026 requires any
PO-accepted prose that is a controlling implementation input to be durable and portable in
the repository rather than referenced from a private machine filesystem path. This
directory satisfies that requirement for that one package. It grants no execution
authority.

The subject directory follows the existing `docs/source/combat`,
`docs/source/learning-groups` and `docs/source/professions` convention. The historical
proposal wording is retained verbatim; it is not a new request for a product decision.

Publication does not activate any competency, catalogue, Skill, Specialization, prose
surface, mechanic, Chargen path, acquisition, cost, grant, availability, admin reference
export or runtime behaviour. No content package, contract, fixture, schema or migration is
changed by publishing this source. The approved
[target Learning Group sources](../learning-groups/README.md) and the integrated competency
source remain controlling over identities, names, types and parents; this file is prose
evidence and does not override them.

## Dispatch status — 26 September 2026 control-plane ruling

#102 must be **re-evaluated against current `dev`**, and then **rewritten and rebaselined,
or superseded** if current V2/content work has already delivered its substance. It may not
be dispatched on its recorded contract.

- #102's body still names a **completed** Builder (`01a08cd0-7a6b-7dc2-98b2-6e09edc4a6a2`)
  and a private Codex worktree as a resume instruction. That resume instruction is stale
  history, not a dispatchable substrate.
- Its accepted baseline, preserved old remote head and force-with-lease pin were recorded
  against earlier `dev` and are not verified against
  `dev@5c34b1f08b3a1f6c823dc9e4916fdc6e3f151d02`.
- Publishing this source does not restore that worktree, revive PR103, or authorize any
  rebase, push, force-with-lease or merge.

## Supplied files

The `.md.txt` suffix identifies verbatim Markdown source stored as plain text, separate from
this formatted reader guide. The original supplied filename is retained before the final
`.txt` suffix. Do not format the raw evidence.

This package uses the two-file archive form already established by
[`docs/source/professions`](../professions/README.md), because the supplied file contains 667
lines with trailing ASCII spaces — Markdown hard line breaks — which the repository's
whitespace gate rejects. The `.original.base64.txt` archive holds the **exact supplied bytes**
and is the authority. The `.md.txt` readable copy applies one documented, reversible
normalization: trailing ASCII spaces and tabs removed per line, all line breaks and every
other byte preserved. Nothing is reflowed, re-wrapped, corrected, truncated, split or
compressed, and no line-ending conversion is applied.
[`competency-source-provenance.json`](competency-source-provenance.json) records both digests
and the exact rule. Decoding the archive reproduces the supplied file byte-for-byte.

| File                                                                                                                       | Bytes   | SHA-256                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| Supplied original `Glantri_Complete_Competency_Catalogue_Reader_Prose.md`                                                  | 355,963 | 0bedd313d7d49b3cf4846008b75bf126cf956a985f8d1cc9dcab1ef9446b8376 |
| [Exact archive](Glantri_Complete_Competency_Catalogue_Reader_Prose.original.base64.txt) (base64; decodes to the row above) | 480,865 | 0bedd313d7d49b3cf4846008b75bf126cf956a985f8d1cc9dcab1ef9446b8376 |
| [Readable copy](Glantri_Complete_Competency_Catalogue_Reader_Prose.md.txt) (normalized, plus the 2026-09-27 amendment)     | 354,978 | 5dd3af7a39aecfcf337e2ca5d063e1f724a3a14cfd93d21a6ff82ae1d0e187ad |

**Amended 2026-09-27 (Forgejo #389).** The readable copy additionally carries the authorized
Fencing/Longbow reclassification — both are now `Competency type: Base Skill` with no `Parent:`
clause — so it is **no longer a pure normalization of the supplied original**, and its digest above
moved accordingly. The base64 archive and the supplied-original digest are **unchanged**: the archive
still decodes to the supplied file byte-for-byte. The readable copy is a reader convenience and is
**not** the controlling source; the controlling source is
`packages/content/src/skillContentPlatform/fullSkillCatalogueProposalSource.ts`, whose own pinned
digest and byte size were recomputed by the same change. A difference between the readable copy and
the supplied original is therefore expected and is not drift.

Original source directory: `/Users/vidarhald/Documents/Glantri local/`. Supplied file date:
10 September 2026. The original digest and byte length above match the values pinned in
#102's body exactly. The digest was verified against the supplied file before the copy and
against the committed archive after it. Builders must reference this repository path and must
not depend on the private machine path. Any consumer needing the exact approved string must
decode the archive, not read the readable copy.
