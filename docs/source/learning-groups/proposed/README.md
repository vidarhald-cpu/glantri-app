# Proposed Learning Group reader prose — pending Product Owner acceptance

> **STATUS: PROPOSED. NOT ACCEPTED SOURCE.**
> Everything in this directory is newly authored reader prose awaiting Product
> Owner review. It carries no acceptance, no digest, and no authority. It is
> **not** interchangeable with the accepted material in the parent directory.

Authored under Forgejo issue **#365**, which was authorized on 2026-09-26 as
content authoring split out of **#361**. #361 owns publication; this directory
owns only the words.

## Why this exists

`docs/product/chargen-competency-experience-contract.md` §6 authorized a
redesign of the Profession and Learning Group catalogue, explicitly including
"a Learning Group count other than 59". The canonical V2 catalogue that came
out of that redesign has **95** Learning Groups. The accepted source prose in
the parent directory predates the redesign and describes the older roster.

§9.12 of the same contract requires four distinct reader-facing layers for
every canonical Learning Group: a short description, a full description,
typical activities or uses, and boundaries and context where authored. It also
requires that a genuine gap be **returned for review rather than filled with
fabricated mechanics**. This directory is that return, with the prose already
drafted so the Product Owner reviews words rather than a list of holes.

## The inventory

Matched by canonical group identity against
`docs/product/proposals/competency-content-v2/competency-content-v2.json`
(`groups[]`), not by counting headings.

| Measure                                             | Count  |
| --------------------------------------------------- | ------ |
| Canonical V2 Learning Groups                        | 95     |
| Covered by accepted source prose, membership intact | 44     |
| Covered but membership has since changed            | 2      |
| No accepted prose at all                            | 49     |
| **Authored here**                                   | **51** |

The canonical manifest independently confirms the split: `retainedGroups: 44`,
`revisedGroups: 2`, `newGroups: 49`. The 49 groups with no accepted prose are
exactly the 49 groups the redesign created.

The accepted sources carry 59 group pages, but **13 of them describe groups the
redesign removed** — G06, G08, G13, F31, F32, F35, F36, F37, F38, F39, F40 and
the retired F22 and F16 concepts no longer appear in the canonical roster. That
is why 59 accepted pages cover only 46 canonical groups.

### Groups whose accepted prose is no longer sufficient

Both are `revised` in the canonical data: the practice grew, and the accepted
page describes the narrower earlier curriculum.

| Group | Name                                | Now also taught        |
| ----- | ----------------------------------- | ---------------------- |
| F04   | Running and athletic field practice | Swimming, Climbing     |
| F09   | Rigged-vessel deck apprenticeship   | Climbing, Weather Lore |

### Groups with no accepted prose

The 49 `new` groups: C01, C02, C04, C05, C06, C07, C09, C10, C11, C13, C14,
C15, K01, K02, K03, K04, K05, K06, K07, K08, K09, K10, K11, K12, K13, K14, K15,
K16, K17, K18, K20, K21, K22, K23, K24, K25, M01, M02, M03, M04, M05, M06, M07,
M08, M09, M10, M11, M12, N01.

## What was authored, and what was not

For each of the 51 groups the prose supplies a full explanation of the training
practice, what it teaches in reader language, and boundaries and context.

**Short descriptions are carried verbatim from the canonical V2 data** rather
than rewritten. Every canonical group already has a `shortDescription` that
reads as a table row, and authoring a competing second line would put two
different summaries of the same group into the repository. They are reproduced
here so that a reviewer and #361 find all four layers in one place. Where the
Product Owner wants a canonical short line changed, that is a change to the
canonical data, not to this proposal.

## Constraint observed

The prose **describes the canonical data and adds nothing to it**. No Learning
Group membership, choice slot, Profession route, direct Skill access, Society
applicability, Skill identity or acquisition semantic is altered or implied to
change anywhere in this directory. Where the canonical data names a choice, the
prose says a choice is made and does not imply the whole candidate pool is
taught. Where the canonical data is silent, the prose is silent.

No group had to be returned undescribed: every one of the 51 has unambiguous
canonical membership.

## Relationship to the accepted source

The accepted `.md.txt` files in the parent directory are verbatim Product Owner
material with recorded SHA-256 digests. **They were not modified.** This
directory sits beside them precisely so that the two are never confused.
