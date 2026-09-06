# Pilot Skill Content Release v1

## Status, identity, and boundary

This is the canonical reference for the bounded content release accepted in
[issue #378](https://github.com/vidarhald-cpu/glantri-app/issues/378#issuecomment-5453498780)
and implemented by [issue #382](https://github.com/vidarhald-cpu/glantri-app/issues/382).

- Release ID: `content-release:pilot-skills:1`
- Content version: `pilot-skills-content/1.0.1`
- Schema: `pilot-skill-content-release/v1`
- Rules version consumed: `pilot-skill-rules/v1`
- Canonical payload digest:
  `sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419`
- Deterministic serialization: `canonical-json-lexicographic-keys/v1`

The machine-readable release is in `packages/content/src/pilotSkillContentRelease`. It is separate
from the synthetic Gate A fixtures described in [Pilot Skill Rules v1](./pilot-skill-rules-v1.md),
legacy broad `canonicalContent`, Character persistence, and runtime catalogue activation.

## Additive documentation-complete content platform

The accepted `1.0.1` release above remains immutable under
`pilot-skill-content-release/v1`. It is not converted or rewritten in place.

Future documentation-complete candidates use the additive
`skill-content-release/v2` contract. That contract requires full and concise names and
descriptions plus a structured task envelope for every competence-bearing record. It also carries
versioned domain and script identities, explicit language/written-tradition bindings,
Specialization parents and transfer declarations, access profiles, histories, provenance, and the
existing `proposal` or `canonical` publication status. Candidate and canonical releases can both
be projected read-only for the later Admin Skill Reference; this does not publish or activate
content.

The v2 validator applies conservative presentation floors so presence cannot be satisfied by
placeholder fragments: trimmed names and short labels require at least 2 characters, concise
descriptions at least 12, and substantive descriptions at least 40. These are minimum integrity
checks, not a substitute for the production-quality editorial review required by the content gate.
Prerequisite thresholds `6` and `11` are standard; any other positive threshold must carry an
authored justification. A Specialization declaring explicit zero transfer cannot coexist with an
authored parent-to-Specialization relationship edge.

Each v2 manifest carries two deterministic values:

- `packageDigest` covers the complete release except the digest fields themselves, including
  presentation and documentation;
- `semanticDigest` covers structured interpretation facts, including identity/kind, weight, task
  envelope, prerequisites, relationships, access, histories, Specializations, and
  language/script/written-tradition bindings.

Editorial prose and presentation ordering therefore alter the package digest without altering the
semantic digest. Record status and provenance remain paired and validated separately from those
mechanical facts. Compatibility remains an explicit release classification; no digest comparison
by itself decides Character migration. The governing architecture is
[Rule decision 0003](../decisions/rules/0003-skill-documentation-and-release-integrity.md).

This release contains only the accepted content needed by eight retained pilot Character concepts:
53 base/language/written competencies, 17 histories, 8 inert Professions, 8 backgrounds, 15
directional relationships, 8 Specializations, 7 society profiles, and 4 narrow access exceptions.
It is not completion or activation of the full v0.2 catalogue.

## Content facts versus mechanics

This document records content facts: identities, weights, memberships, choices, edges,
prerequisites, access routes, and language sources. [Pilot Skill Rules v1](./pilot-skill-rules-v1.md)
owns the mechanics: direct cost, strongest-history contribution, final-bundle pricing, relationship
rounding/source selection, Specialization acquisition, access resolution, budgets, and the spoken
language finalization invariant.

Navigation domains are mechanically inert. Profession is mechanically inert. DS/AB and accepted
exceptions grant exactly zero XP. Spoken competence never implies a written tradition. Relationship
edges are explicit, directional, non-stacking, and non-recursive in Pilot v1; no reverse edge is
inferred.

## Exact competency weights

Weight 1:

- `skill:first-aid` — First Aid
- `skill:dodge` — Dodge

Weight 3:

- `skill:battle-tactics` — Battle Tactics
- `skill:medicine` — Medicine
- `skill:surgery` — Surgery
- `skill:research` — Research
- `skill:law:olog-princely` — Law — Olog Princely Law
- `skill:dead-reckoning` — Dead Reckoning
- `skill:chart-navigation` — Chart Navigation

Weight 2:

- Sword, Shield, Knife/Dagger, Spear
- Perception, Athletics, Survival, Leadership
- Pharmacy, Plant Lore
- Streetwise, Underworld, Deception, Stealth, Lockpicking, Sleight of Hand, Insight, Disguise
- Administration, Customs, Oratory, Bookkeeping
- Trade, Bargaining, Appraisal, Smithing
- Seamanship, Pilotage, Swimming, Weather Lore, Wayfinding
- Animal Handling, Tracking, Hunting, Riding
- Spoken Common, Mogrebi, Ologian, Phoenician, N'kolian, and Scythian
- Written Mogrebi in Sacred Mogrebi, Written Ologian in Church Ologian, and Written Phoenician in
  Phoenician script

The release assigns no weight or new content fact to an unused catalogue entry.

## Histories and retained Character fixtures

Every history supports intensity 1–4. Fixed memberships remain visible even when another selected
history supplies a stronger contribution. Choice candidates not selected by the retained fixture
grant and cost nothing.

| Retained concept                             | Selected histories and resolved choices                                              |               Exact total |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------: |
| Glantrian household-retainer veteran         | Household Retainer Service 4 (Athletics); Western Border Campaign 2 (Battle Tactics) |                        49 |
| Mogrebi temple physician                     | Mogrebi Temple Infirmary 4; Medical Scribe School 2                                  |                        40 |
| Iest dockside informant / entry investigator | Iest Dockside Network 4 (Deception); Night-Entry Crew 3 (Sleight of Hand)            |                        56 |
| Olog princely-chancery clerk                 | Princely Chancery Service 4 (Oratory); Olog Clerk School 3                           |                        51 |
| Lankhmar merchant-house weaponsmith factor   | Lankhmar Merchant House 4 (Appraisal); Smith Apprenticeship 4                        | 63 (Formation 60, Flex 3) |
| Lankhmar coastal pilot                       | Coastal Vessel Crew 4; Harbor Pilot House 3 (Wayfinding and Chart Navigation)        |                        58 |
| N'Kolian caravan scout-militia hybrid        | Frontier Levy Service 3; Caravan Factor Service 3 (Bargaining); Scout Journeys 2     |                        54 |
| Scythian mounted envoy after Olog fosterage  | Horse-Clan Camp 4; Olog Diplomatic Fosterage 2 (written tradition)                   |                        50 |

Group costs in the same order are `30, 20, 32, 30, 35, 40, 32, 34`. The hybrid deliberately keeps
Wayfinding, Perception, and Survival in every authored history that contains them; Pilot v1 chooses
only the strongest contribution and the explanation output preserves the suppressed memberships.

Each matching `profession:*` record contains suggestions and `mechanics: none`. Replacing only the
Profession identity changes no history, purchase, price, competence, or Specialization result.

## Explicit relationships and Specializations

The 15 edges are:

- Medicine -> First Aid 100%
- Pilotage -> Home-Coast Pilotage 75%
- Sword -> Knife/Dagger 50%
- Trade -> Bargaining 50%
- Tracking -> Hunting 50%
- Medicine -> Diagnostic Medicine 50%
- Lockpicking -> Warded-Lock Entry 50%
- Administration -> Court Administration 50%
- Smithing -> Weaponsmithing 50%
- Wayfinding -> Desert Wayfinding 50%
- Medicine -> Surgery 25%
- Administration -> Bookkeeping 25%
- Seamanship -> Pilotage 25%
- Wayfinding -> Pilotage 25%
- Riding -> Animal Handling 25%

Every row is one direction only. Pilot v1 never uses a relationship-derived Pilotage level to feed
Home-Coast Pilotage, and it never infers family/domain transfer.

The eight explicitly acquired Specializations are:

| Identity                               | Prerequisite         | Weight | Transfer declaration                 |
| -------------------------------------- | -------------------- | -----: | ------------------------------------ |
| Household Guard Sword-and-Shield Drill | Sword 6 and Shield 6 |      1 | zero transfer                        |
| Diagnostic Medicine                    | Medicine 6           |      1 | Medicine -> specialization 50%       |
| Warded-Lock Entry                      | Lockpicking 6        |      1 | Lockpicking -> specialization 50%    |
| Court Administration                   | Administration 6     |      1 | Administration -> specialization 50% |
| Weaponsmithing                         | Smithing 11          |      2 | Smithing -> specialization 50%       |
| Home-Coast Pilotage                    | Pilotage 6           |      1 | Pilotage -> specialization 75%       |
| Desert Wayfinding                      | Wayfinding 6         |      1 | Wayfinding -> specialization 50%     |
| Steppe Remount Training                | Animal Handling 6    |      1 | zero transfer                        |

Every retained fixture explicitly acquires 2 ranks. Prerequisite competence or a transfer candidate
never creates ownership.

## Society, access, and language facts

The bounded profiles are Glantri DS4/AB2, Mogreb DS3/AB3, Iest DS6/AB1, Olog DS5/AB3, Lankhmar
DS5/AB2, N'Kolo DS4/AB2, and Scythians DS2/AB1. Their machine-readable routes retain the accepted
band distinctions:

- Mogreb has lower-band household First Aid at AB1 alongside the AB3 temple healing and
  medical-text route.
- Iest street/social practice is AB1, while the ordinary Trade and Smithing route is AB2.
- Olog routine Law, Administration, bookkeeping, and written tradition are AB2; princely-chancery
  and clerk-school practice, including Court Administration, are AB3.
- N'Kolo caravan/animal and outdoor/scout practice are AB1; frontier-levy practice and the named
  Desert Wayfinding tradition are AB2.
- Scythian home-profile unavailability explicitly includes Written Ologian, routine Administration,
  Olog Princely Law, and Court Administration. The narrow fosterage exception still excludes the
  latter two.

Every listed route or override is access metadata only and grants zero competence or XP.

Four narrow exceptions are retained:

- `access:mogreb-surgeon-neseret` opens only Surgery training.
- `access:iest-contact-copper-latch` opens only the Night-Entry Crew history.
- `access:lankhmar-master-hanno` opens only Weaponsmithing.
- `access:olog-fosterage-house-vorodin` opens only Spoken Ologian, Written Ologian in Church
  Ologian, Customs, Insight, routine Administration, and the named fosterage history. It excludes
  Olog Princely Law and Court Administration.

Every exception records `grantsCompetence: 0`.

Each background supplies exactly one starting spoken-language identity under
`max(11, Education)`. The retained fixtures assume Education at most 11 and therefore record 11.
Writing appears only through Medical Scribe School, Princely Chancery / Clerk School, Lankhmar
Merchant House / Pilot House, or the explicitly selected Olog fosterage writing choice. No
background automatically grants writing.

## Deferred work and retained risks

- Access exceptions must remain source-specific; generic travel or biography must not become a
  universal bypass.
- Choice lists and histories require fictional coherence even though final-state pricing prevents
  order/permutation gaming.
- The strong mother-tongue grant remains isolated; no language-family or script relationship is
  inferred.
- Recursive relationships remain deferred. Before a later rules version, audit cycles,
  amplification, convergence, rounding, strongest-source behavior, explanations, and migration,
  especially the medical, weapon, navigation, trade, and riding graphs represented here.
- Any change to weights, edges, thresholds, membership, access facts, or another mechanical content
  fact requires a new content version and later explicit Character migration. Retained Characters
  must never be silently repriced or rebuilt.
