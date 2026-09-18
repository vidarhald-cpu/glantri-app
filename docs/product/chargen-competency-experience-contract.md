# Chargen and Competency Experience Product Contract

**Status:** Product Owner approved\
**Date:** 2026-09-17\
**Portfolio:** [#114 Chargen](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/114), [#110 Skills / Learning Groups / Professions](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/110)\
**Related content authority:** [#113 Profession Provenance / Availability](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/113)

This contract records playtest-derived product decisions for repeatable Character
creation, competency rules and reference material, and Profession competency
depth. It is product and documentation authority. It does not authorize a UI,
runtime, catalogue, migration, or content implementation.

The integrated Skill → Learning Group → Profession architecture remains
authoritative. This contract does not reopen the completed #110 integration or
restore the previous Skill system.

## 1. Repeatable Character creation

An account may have multiple Characters.

Entering Chargen must offer both of these paths where applicable:

- resume or edit an existing Character whose creation remains in progress;
- **Create new Character**.

Completing or starting one Character must not trap the account in that Character
or remove the ability to begin another. Account role combinations, including
GM/player and other multi-role accounts, must not prevent new Character creation
unless an explicit approved game or product rule requires that restriction.

This requirement controls the target experience independently of the cause of
the current playtest failure. Determining the current implementation gap belongs
to a separately authorized conformance audit.

## 2. Game documentation and reference presentation

The controlling principle is:

> **Glantri should explain Glantri, not explain its own interface.**

Ordinary game, reference, and Admin-facing surfaces present Glantri rules and
content. Controls and labels should make their function clear without
instructional filler that explains:

- how to search;
- what a tab is for;
- how the interface is organized;
- internal implementation concepts or identifiers;
- migration work;
- superseded or previous Skill-system structures.

Historical provenance, reconciliation, compatibility, and migration evidence
remain valuable repository and source documentation. They do not belong in the
ordinary game-reference experience.

### 2.1 Required reference structure

The competency reference area must provide the equivalent of these top-level
game concepts:

- **Rules**;
- **Skills**;
- **Learning Groups**;
- **Professions**;
- **Societies**.

Exact navigation labels may follow established Glantri terminology. The five
conceptual areas are required.

### 2.2 Rules reference

The Rules section explains the competency and Profession system in Glantri game
terms. It covers:

- what a Skill represents;
- what a Learning Group represents and how it relates to Skills;
- what a Profession represents;
- how Professions provide access to Learning Groups and direct competencies;
- how Society Level affects availability;
- how Social Band affects availability;
- how Arch Society and other approved contextual concepts apply;
- how these concepts interact during Character generation.

It must not explain tabs, search controls, database structures, internal IDs,
implementation architecture, or migration from the previous Skill system.

## 3. Contextual availability in the reference

Skill and competency reference material is incomplete when it omits approved
contextual availability that matters to play. Where authoritative content
exists and the dimension genuinely applies, the reference must present:

- Society Level;
- Social Band;
- other approved contextual availability, including Arch Society where
  applicable.

The reference must distinguish approved game content from unfinished content.
It must not fabricate contextual values or imply that unfinished contextual
availability is active in Chargen.

[#113 Profession Provenance / Availability](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/113)
remains the authority for unfinished Profession availability, contextual
bindings, and the S01/B1 gate. Those content dependencies remain visible as
unresolved dependencies until approved; they are not filled by inference.

## 4. Profession competency depth

A Profession must provide a recognizable and useful body of competencies to a
Character. Profession quality is judged by the resulting competency package,
not merely by whether every relationship is structurally valid.

A package that effectively collapses to one competency, such as a Cook route
that provides essentially only Cook, is not adequate merely because its Skill
and Learning Group links are internally consistent.

Improving a thin Profession may require one or more of:

- broader but still coherent Learning Group content;
- additional Profession → Learning Group opportunities;
- direct Profession competency opportunities;
- a genuinely missing Learning Group.

Do not pad a narrowly defined Learning Group with unrelated Skills merely to
make a Profession larger. A Profession may legitimately gain breadth through
multiple coherent Learning Groups and direct competencies. Specialist
Professions may also be narrower where that narrowness remains recognizable and
useful in play.

## 5. Required quantitative audit and future decision

A measurable target for Profession competency depth is required, but no numeric
minimum or target band is yet approved. Earlier example ranges are not
canonical rules.

The future full-catalogue audit must:

1. compute distinct base-Skill coverage for all 84 Profession families;
2. deduplicate overlap between Learning Groups and direct routes;
3. report the actual distribution across the catalogue;
4. identify clearly thin Profession packages;
5. propose a useful target or minimum band for Product Owner approval;
6. distinguish legitimate specialist narrowness from deficient content.

No Profession should receive irrelevant Skills solely to reach a number. The
audit supplies evidence for a later Product Owner decision; it does not set the
number itself.

## 6. Preserved architecture and authority boundaries

The following remain approved:

- the target Skill catalogue;
- Learning Groups as coherent training contexts;
- Profession families and explicitly defined tracks;
- Profession access through Learning Groups and direct competencies;
- historical provenance as evidence;
- already approved structural relationships unless substantive content evidence
  supports a revision.

This contract refines product quality within that architecture. It does not
authorize a return to the previous Skill model, a rewrite of all 84 Professions,
or a change to Chargen mechanics.

## 7. Decision state

### Settled product decisions

- Chargen supports creating multiple Characters per account.
- Resume/edit and Create new Character are both supported paths.
- Reference surfaces explain Glantri rules and content without interface or
  migration narration.
- The reference covers Rules, Skills, Learning Groups, Professions, and
  Societies.
- Approved contextual availability belongs in the reference.
- Profession packages must be recognizable and useful in play.
- The Skill → Learning Group → Profession architecture remains controlling.

### Unresolved content dependencies

- #113 contextual Profession availability and associated Society, Arch Society,
  Social Band, Setting, and S01/B1 content remain unfinished where the
  authoritative sources say so.
- Missing contextual values must not be invented for the reference.

### Future Product Owner decision

- The numeric target or minimum band for distinct Profession base-Skill coverage
  will be decided after the 84-family coverage and distribution audit.

## 8. Required next preparation

This contract must be durable before any of these separately authorized tasks
begin:

1. a Chargen implementation-conformance audit;
2. a competency/reference UI audit;
3. a full Profession competency-depth and content audit.

Those audits are not authorized by this document.
