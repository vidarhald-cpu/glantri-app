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

## The 2026-09-26 accepted prose for the canonical V2 roster

The canonical V2 catalogue has grown beyond the roster the two files above describe: it has **95**
Learning Groups, and those accepted pages cover **44** of them. The remaining **51** — the 49 groups
the V2 redesign created, and the 2 whose accepted page describes a narrower curriculum than canonical
now teaches — are described in
[`2026-09-26-v2-learning-group-prose.md`](2026-09-26-v2-learning-group-prose.md).

That document was authored under issue #365, reviewed and corrected by the Product Owner, and
accepted and integrated through issue #367 together with #386's C02 canonical correction. It is
**accepted source**, and it is the single accepted source for those 51 descriptions. It is stored as
a formatted Markdown document rather than as `.md.txt` raw evidence, because it is not verbatim
supplied bytes: it is repository-authored prose the Product Owner accepted.

| Accepted document                                                              | SHA-256                                                          |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [2026-09-26-v2-learning-group-prose.md](2026-09-26-v2-learning-group-prose.md) | 9bb02fb830162e3afac3ae39b5f199d619d35a80fcd044bbb329c007ba1e4421 |

Matched by canonical group identity against
`docs/product/proposals/competency-content-v2/competency-content-v2.json` (`groups[]`), not by
counting headings. The canonical manifest independently confirms the split: `retainedGroups: 44`,
`revisedGroups: 2`, `newGroups: 49`. The two accepted `.md.txt` files carry 59 group pages, but 13 of
them describe groups the redesign removed — G06, G08, G13, F16, F22, F31, F32, F35, F36, F37, F38,
F39 and F40 — which is why 59 accepted pages cover only 46 canonical groups, and why publication
filters on canonical identity rather than on the existence of an accepted page.

Short descriptions in that document are carried verbatim from the canonical V2 data rather than
rewritten, so a second competing summary of the same group never enters the repository. Where the
Product Owner wants a canonical short line changed, that is a change to the canonical data.

The prose describes the canonical data and adds nothing to it. No Learning Group membership, choice
slot, Profession route, direct Skill access, Society applicability, Skill identity or acquisition
semantic is altered or implied to change by it. Two entries were corrected after acceptance — **M04**
and **M05**, which now name the longbow among the missile arms their slots offer, because issue #389
added `longbow` to both candidate pools after these pages were written. Nothing else was reworded.

The earlier accepted `.md.txt` pages for **F04** and **F09** are retained unmodified as historical
evidence; canonical V2 reads those two groups from the 2026-09-26 document instead, which is recorded
in `competencyContentV2GroupsWithSupersededSourceProse`.

`packages/content/src/proposals/competencyContentV2/competencyContentV2ReaderProse.ts` embeds all
four accepted documents' prose, with each document's SHA-256 recorded beside it, and publishes it to
the runtime reader-content projection: 95 of 95 canonical Learning Groups and 84 of 84 Profession
families (issues #361 and #396).

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
