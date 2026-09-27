# Approved target Learning Group sources

Issue #104 approves reference publication of the supplied full catalogue and its
martial revision. Their historical proposal wording is retained verbatim; it is
not a new request for a product decision. Publication does not activate Chargen,
acquisition, costs, grants, availability, Professions, or Combat.

The subject directory follows the existing `docs/source/professions` and
`docs/source/combat` convention. Both raw evidence files preserve exact supplied UTF-8 bytes. The `.md.txt`
suffix identifies verbatim Markdown source stored as plain text, separate from
this formatted reader guide. Their original supplied filenames are retained
before the final `.txt` suffix. Do not format the raw evidence.

| Supplied file                                                                                                          | SHA-256                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Glantri_Full_Catalogue_Learning_Groups_PO_Proposal.md](Glantri_Full_Catalogue_Learning_Groups_PO_Proposal.md.txt)     | 7452da9e5fb0b324ea74b3eb618472c512d3c3f04288a49f124fa50821790423 |
| [Glantri_Learning_Groups_Martial_Revision_PO_Proposal.md](Glantri_Learning_Groups_Martial_Revision_PO_Proposal.md.txt) | f44447d438fc33f0a37cc3703bb33d711f4423b95c9c0e047691ea4a12004e8a |

Original source directory: `/Users/vidarhald/Documents/Glantri local/`.

The canonical V2 catalogue has grown beyond the roster these files describe. Newly authored reader prose for the canonical V2 Learning Groups these accepted sources do not cover is proposed separately in [`proposed/`](proposed/README.md); it is **not** accepted source material.

`packages/content/src/skillContentPlatform/targetLearningGroupsSource.ts` embeds
these same strings for deterministic packaging without filesystem dependencies.
The focused test checks both copies against these hashes. The parser consumes
only explicit group pages, preserves reader prose and practice explanations, and
validates exact competency IDs, names, types, and immediate parents against the
integrated competency source. It replaces G08/F30/F31/F32 and adds F35–F41; the
other 48 pages remain unchanged. Derived old counts and reverse indexes remain
source evidence and are not target data.

`targetLearningGroupCatalogue` is exported from `@glantri/content`. Its typed
reference contract is in `packages/shared/src/contracts/adminContent.ts`. The
manifest and digest are deterministic: 59 groups, 151 base memberships across
90 base Skills, 9 explicit Specialization memberships, and 41 groupless base
Skills. Group provenance identifies the exact source path, hash, and line range.
The Pilot snapshot is parsed separately and checked against the integrated
18-group/46-link source snapshot. Its obsolete weapon identities are never
converted into target memberships.

Admin reference exposes this export through the existing Admin-only reference
endpoint and `/admin/skills/reference/groups`. Skill prose remains unchanged;
its secondary Learning Group section uses the approved graph while preserving
earlier annotations in a disclosure. No runtime acquisition consumer is wired.
