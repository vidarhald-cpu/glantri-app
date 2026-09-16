# #113 Profession Provenance / Availability — Durable Product/Content Architecture Contract

## 1. Status and scope

Portfolio area: #113 Profession Provenance / Availability

Contract type: Product/content architecture

Implementation status: No implementation authorized by this contract

Overall status: Preparing for Ready

This contract governs:

- reconciliation of recovered legacy Profession material against the approved target Profession model;
- preservation of Profession provenance;
- future Society-, Arch-Society-, Social-Band-, variant-, and context-sensitive Profession availability;
- the boundary between generic Profession content and later Setting/context bindings.
  It does not govern:

- current Chargen implementation;
- current dev;
- migrations, APIs, schemas, file paths, SHAs, runtime behavior, or implementation ownership;
- redesign of the Profession catalogue;
- redesign of the Learning Group catalogue;
- activation of Campaign Setting behavior.
  The Product Owner has approved the architecture described below. Remaining work is bounded reconciliation and content/evidence completion rather than unresolved architecture.

## 2. Authoritative target-model boundary

The following target model is authoritative:

- 84 Profession families;
- variants/tracks are first-class;
- 115 Profession → Learning Group opportunities;
- 88 direct competency-training opportunities.
  The 84-family catalogue is authoritative independently of legacy Profession count.

The existence of 96 recovered legacy Profession identities does not create a requirement for:

- 96 target Professions;
- one-to-one successors;
- preservation of every old occupational boundary;
- preservation of every legacy association.
  No target Profession may be added, deleted, merged, or split merely to make migration numerically symmetrical.

The target model is a product model. Legacy material is evidence and provenance.

## 3. Reconciliation taxonomy

Every recovered legacy Profession identity should receive one primary reconciliation disposition.

The allowed dispositions are:

Direct successor

The legacy Profession and target Profession represent substantially the same occupational concept.

Renamed successor

The occupational concept survives substantially intact, but the target name or framing has been improved.

Merged into target family

Two or more legacy identities are represented by one broader target Profession family.

Represented as target variant/track

The legacy identity remains meaningful but is narrower than the target family and should survive as a first-class variant or track rather than a separate Profession family.

Split across target concepts

The legacy Profession bundled occupational functions that the target model deliberately separates.

One legacy identity may therefore reconcile to multiple target Professions or variants.

Historical/legacy-only

The legacy concept should remain recoverable as provenance but should not have a target Profession successor.

Unresolved

Available evidence is insufficient to make a defensible reconciliation.

Unresolved is an evidence state, not a request to modify the target catalogue.

Reconciliation cardinality

The reconciliation relationship is explicitly non-bijective.

Valid mappings include:

- one legacy Profession → one target Profession;
- multiple legacy Professions → one target Profession;
- one legacy Profession → multiple target Professions;
- one legacy Profession → one target variant/track;
- one legacy Profession → no target successor.
  There is no requirement for migration symmetry.

## 4. Reconciliation semantics

A reconciliation record answers:

How is this historical Profession concept accounted for in the approved target model?

It does not answer:

Which legacy rules and associations should automatically be copied into the target Profession?

A legacy Profession → target Profession mapping establishes lineage/provenance only.

It does not automatically transfer:

- legacy Skill associations;
- Learning-History-derived associations;
- obsolete weapon or competency identities;
- old availability rules;
- training entitlements;
- historical restrictions;
- context assumptions.
  The 518 recovered legacy associations remain provenance unless a corresponding rule or opportunity has separately been incorporated into approved target content.

## 5. Provenance model

Profession provenance has three distinct layers.

### A. Raw legacy provenance

Preserve recovered source evidence faithfully.

This includes, where available:

- legacy Profession identifier;
- exact legacy Profession name;
- source provenance;
- legacy association records;
- distinction between direct associations and Learning-History-derived associations;
- historical context and restrictions;
- obsolete Skill, weapon, or other identifiers where necessary to understand the source;
- uncertainty in the recovered evidence.
  Raw provenance must not be silently normalized into target rules.

### B. Reconciliation provenance

Record how each legacy Profession is accounted for by the target model.

A reconciliation record should conceptually retain:

- legacy identity;
- reconciliation disposition;
- referenced target Profession family or families;
- referenced variant/track where applicable;
- rationale;
- evidence basis;
- confidence or unresolved status;
- treatment of associated legacy material.
  This layer is interpretive provenance.

It does not alter raw recovered evidence.

### C. Target authority

The approved:

- 84 Profession families;
- variants/tracks;
- 115 Learning Group opportunities;
- 88 direct competency opportunities
  constitute authoritative future Profession content.

Legacy evidence may explain why target content exists.

It does not independently create target content or target entitlement.

## 6. Availability architecture

Profession availability is not one scalar value.

Two distinct questions must always be representable:

Profession presence

Does this Profession family or variant credibly exist and reproduce itself in this context?

Training-opportunity availability

Which approved Learning Group or direct competency opportunities are actually available through that Profession in this context?

These questions must remain separate.

Examples:

- Soldier may exist while a particular ranged, mounted, or formation route is unavailable.
- Navigator and Pilot may exist while chart-navigation instruction is unavailable.
- Physician may exist while Surgery is not part of ordinary local training.
  Availability must therefore be authorable independently at three scopes:

1. Profession family

2. Profession variant/track

3. Individual training opportunity

The availability of a broader scope never automatically proves availability of every narrower scope.

## 7. Society Level rule

Society Level represents:

the minimum structural support ordinarily required for a Profession, variant, or training route to reproduce itself.

It is not:

- a chronological age;
- a technology ladder in itself;
- a civilization ranking;
- a measure of societal worth.
  Minimum-support semantics

Society Level should normally operate as a minimum structural-support condition, not as a minimum/maximum range.

Thus:

A Profession that can reproduce at Society Level 2 does not cease to exist merely because the society is Level 5 or Level 6.

Higher Society Levels may make additional things possible, including:

- specialist Profession variants;
- larger institutions;
- formalized training systems;
- advanced occupational routes;
- more specialized Learning Group opportunities;
- additional direct competency instruction.
  But higher Society Level does not automatically populate the society with every Profession that is theoretically structurally possible.

Society Level describes capacity.

It does not by itself establish presence.

## 8. Arch Society rule

Arch Society is an independent availability dimension.

Two societies at the same Society Level may legitimately differ in:

- occupations;
- institutions;
- materials;
- military structures;
- navigation traditions;
- legal systems;
- religious structures;
- literacy traditions;
- specialist training routes.
  Arch-Society applicability should use the qualitative states:

- Available
- Conditional
- Unresolved
- Not applicable
  Meaning of the states

Available means the Profession or route is ordinarily compatible with and supported by that Arch Society.

Conditional means availability depends on additional context.

Unresolved means current evidence does not establish the answer.

Not applicable means positive evidence or the defining structure of the Arch Society supports exclusion.

Absence of evidence should normally produce Unresolved, not Not applicable.

This is particularly important for low-documentation, oral, household, illicit, informal, or socially marginal occupations.

## 9. Social Band rule

Social Band describes:

ordinary access to entering or learning the Profession route.

It does not describe:

- eventual occupational prestige;
- expertise;
- wealth after career success;
- social standing acquired later;
- Profession category;
- rank;
- office.
  A person entering an ordinary occupational route at B1 does not become B2 simply because the Profession is skilled.

A person serving in an elite household does not automatically enter through an elite Social Band.

No artificial band symmetry

There is no requirement that every Profession or route exist at B1, B2, B3 and B4.

Likewise, there is no universal inheritance rule stating:

If a route is available to B1, it is automatically available to every higher Band.

Higher Bands may have:

- broader opportunities;
- different institutional routes;
- specialist education;
- privileged access;
- alternative variants.
  Conversely, specific routes may depend on restrictions such as:

- legal status;
- citizenship;
- kinship;
- religion;
- sex;
- geography;
- institutional membership;
- patronage;
- secrecy;
- guild or corporate status;
- local custom.
  These restrictions remain independent of Social Band.

## 10. Family, variant, and training-opportunity availability

Availability must be compositional rather than monolithic.

Consider the structure:

Profession family

→ variant/track

→ approved training opportunity

Each layer may have its own availability conditions.

For example:

P22 Soldier

may be generally present.

A specific:

mounted or formation-specialist variant

may require additional structural support.

A particular:

weapon or military Learning Group

may additionally depend on the local weapon tradition.

Therefore:

Availability of a Profession family does not imply availability of all variants.

And:

Availability of a variant does not imply availability of every approved training opportunity associated with that variant.

This allows the generic catalogue to remain stable while actual occupational ecologies differ substantially between societies.

## 11. Competency and Learning Group requirements remain authoritative

Profession availability is a route to training.

It does not override the thing being taught.

Therefore:

A Profession cannot bypass or lower the independent requirements of a Learning Group, Skill, Specialization, language competency, Written Tradition, equipment-dependent competency, or other target competency.

If a Profession theoretically teaches a competency but the contextual prerequisites do not exist, that training route is unavailable in that context.

Examples include missing:

- equipment;
- relevant materials;
- language;
- writing system;
- law;
- vessel type;
- military tradition;
- specialist institution;
- relevant technical practice.
  Profession availability does not manufacture these things.

## 12. Context-binding model

A Profession, variant, or training opportunity may be fully valid generic target content while still requiring later contextual binding.

Such content is context-bound, not incomplete as generic content.

Expected context-binding families include:

| Context family               | Typical binding                                                         |
| ---------------------------- | ----------------------------------------------------------------------- |
| Language                     | Actual spoken language or languages                                     |
| Written Tradition            | Actual script/literary tradition                                        |
| Law/legal institutions       | Actual law, court, legal institution, jurisdiction                      |
| Local customs/polity         | Actual polity, court culture, diplomatic/customary context              |
| Illicit milieu               | Actual enduring criminal, clandestine, or smuggling environment         |
| Navigation/geography         | Actual waters, routes, vessels, charting tradition, hazards             |
| Materials/technology         | Actual craft materials, mechanisms, production traditions               |
| Military equipment/tradition | Actual weapon families, formations, mounts, engines, military practices |
| Alchemy                      | Actual alchemical tradition                                             |
| Religion/theology            | Actual religion, theology, institution, ritual tradition                |
| Divination                   | Actual divinatory tradition                                             |
| Astrology/astronomy          | Actual observational or astrological tradition                          |
| Heraldic/court tradition     | Actual heraldic, ceremonial, or court system                            |
| Performance/art tradition    | Actual artistic, musical, literary, dramatic tradition                  |
| Games/gambling               | Actual games and their social/legal context                             |

These bindings must remain explicit.

Do not invent generic substitutes such as:

- generic Literacy;
- generic law;
- universal languages;
- generic court culture;
- generic weapon traditions;
- generic religion.
  The existence of context-bound Profession content in the generic target catalogue does not activate Campaign Setting behavior.

## 13. Language and Written Tradition rule

Language and writing require particular care.

A Profession may indicate that contextual linguistic competence is relevant.

It must not silently convert that into:

- universal literacy;
- a generic written-language competency;
- a universal administrative language;
- an unspecified “foreign language” entitlement.
  Where applicable, the actual binding must identify:

- spoken language;
- Written Tradition;
- or both.
  These remain independent context data until an actual setting/society provides them.

## 14. B1 occupational viability

B1 must remain a genuinely viable occupational environment.

Low Social Band cannot be reduced to:

- unskilled labor;
- occupational dead ends;
- absence of military or protective training.
  Ordinary occupational routes may legitimately exist at B1 where local institutions support them.

In particular:

Ordinary soldiering may be a B1 entry route where recruitment and training support it.

Military rank, officer training, expensive equipment, elite cavalry, specialist formations, and similar routes may have different accessibility.

The Band of an ordinary recruit is not determined by the later prestige of military office.

## 15. S01 communal fighting rule

S01 has a specific contextual activation requirement.

Before final S01 contextual Profession availability is complete, S01 must contain:

at least one credible B1 communal/civilian protection and fighting route through which a character can learn a complete, context-appropriate fighting curriculum.

P14 Guard, Watcher and Escort is the natural occupational home for this route.

The route might represent forms such as:

- communal watch;
- settlement protection;
- caravan or camp protection;
- local escort duty;
- equivalent civilian protective service.
  This architecture does not decide which exact martial Learning Group or equipment package supplies the route.

That later binding must be supported by actual:

- society evidence;
- equipment availability;
- martial tradition;
- relevant competency structure.
  Hunting alone does not establish a complete fighting curriculum.

Relationship to P22 Soldier

P22 Soldier remains distinct.

Organized military service may require later structural development than S01's communal protection route.

However:

ordinary P22 recruits may still legitimately be B1.

The distinction concerns occupational/institutional organization, not a rule that soldiers must come from higher Social Bands.

## 16. Generic Chargen versus contextual availability

This is a controlling boundary.

Generic/unbound Chargen Profession consumption

Completion of #113 is not required before Chargen can consume the approved generic Profession model.

The planned generic/unbound Chargen Profession slice may use:

- the 84 target Profession identities;
- first-class variants/tracks;
- the approved 115 Profession → Learning Group opportunities;
- the approved 88 direct competency opportunities;
  subject to that Chargen slice's own implementation contract.

Generic Chargen consumption must treat these as unbound target content.

It must not silently infer or activate unfinished:

- Society-Level restrictions;
- Arch-Society restrictions;
- Social-Band restrictions;
- local context bindings;
- Setting-specific Profession availability.
  Therefore:

# #113 must not accidentally block near-term generic/unbound Chargen Profession consumption.

Context-sensitive Chargen or Setting behavior

Setting/Society-sensitive Profession availability requires the relevant #113 content to have been completed.

That includes, as applicable:

- Society-Level authoring;
- Arch-Society applicability;
- Social-Band route availability;
- variant availability;
- training-opportunity availability;
- contextual bindings.
  Likewise:

The unresolved S01 fighting route blocks final S01 contextual availability.

It does not invalidate:

- P14;
- P22;
- the 84-family target Profession catalogue;
- generic Chargen consumption of those Professions.

## 17. Legacy availability formulas

Recovered legacy availability mechanisms are historical evidence.

They are not target architecture.

In particular, any legacy formula that collapsed dimensions—for example a calculation combining Society Level and Band threshold into one value—must not be treated as the future conceptual model merely because it existed historically.

The target architecture instead preserves independent dimensions for:

- Society Level;
- Arch Society;
- Social Band;
- Profession family;
- variant/track;
- training opportunity;
- contextual bindings.
  Legacy availability behavior may still be retained as provenance where necessary.

## 18. Evidence rule

Historical evidence supports only the claim it actually establishes.

Examples:

- presence of a weapon does not prove a resident weaponsmith;
- presence of a ship does not prove every naval Profession;
- hunting does not prove complete combat instruction;
- writing does not prove broad literacy;
- a profession title does not prove every historical association was actually taught;
- an institution does not prove universal Social-Band access;
- an imported object does not prove local manufacture;
- a legacy Learning History relationship does not prove direct Profession training.
  This evidentiary discipline applies throughout Profession availability authoring.

Unknowns must remain explicit rather than being filled for completeness.

## 19. Source-recovery requirement

The architecture pass did not have the complete source ledger containing:

- 96 legacy Profession identities;
- 518 legacy Profession association rows.
  Those rows must not be reconstructed from memory or inferred from the target catalogue.

This is a bounded source-recovery/content-completion requirement.

The required later reconciliation work is conceptually:

recovered legacy identity

→ exact provenance

→ reconciliation disposition

→ target Profession reference(s), if any

→ association provenance/accounting

→ rationale / evidence state

The corresponding association review must preserve the distinction between:

- direct legacy Profession associations;
- Learning-History-derived associations;
- other recovered historical context.
  The absence of this ledger does not cast doubt on:

- the 84 target Profession families;
- the variant/track architecture;
- the approved target training opportunities.
  It prevents complete reconciliation/provenance accounting only.

## 20. Durable normative rules

The following rules are normative for future #113 work.

1. The approved 84-family Profession catalogue is authoritative independently of legacy Profession count.

2. The recovered 96 Profession identities and 518 legacy associations are provenance until separately incorporated into approved target content.

3. Reconciliation may be non-bijective. One-to-one, many-to-one, one-to-many, target-variant, historical-only and unresolved dispositions are legitimate.

4. Profession family and variant/track are distinct availability scopes.

5. Profession presence and training-opportunity availability are distinct propositions.

6. Society Level describes structural capacity for ordinary reproduction of an occupation or training route.

7. Higher Society Level broadens the possible occupational ecology without automatically populating that ecology.

8. Arch-Society applicability is authored independently of Society Level.

9. Social Band represents ordinary entry/access, not eventual prestige, competence, wealth, rank or office.

10. No symmetry across B1–B4 is required, and higher Bands do not universally inherit every lower-Band route.

11. B1 must remain a viable occupational environment, including ordinary soldiering where appropriately supported.

12. S01 requires a credible B1 communal/civilian protection-and-fighting route before final S01 contextual availability is complete.

13. Profession availability cannot override or bypass the requirements of the competencies and Learning Groups that the Profession teaches.

14. Language and Written Tradition bindings remain independent contextual data.

15. Context-bound target content may remain valid generic content until an actual context supplies the required binding.

16. Legacy availability formulas are historical evidence, not target rules.

17. Evidence establishes only what it directly supports; unsupported occupational, institutional or training conclusions must not be invented.

18. Reconciliation records establish lineage, not automatic training semantics.

19. Availability may be authored independently at Profession-family, variant/track, and individual-training-opportunity level.

20. Generic target Profession content may be consumed by unbound Chargen without activating unfinished contextual availability.

## 21. Readiness assessment

Approved / conceptually Ready

The following architecture is settled:

- 84-family Profession taxonomy
- first-class variant/track model
- 115 Profession → Learning Group opportunity model
- 88 direct competency-training opportunity model
- non-bijective reconciliation architecture
- three-layer provenance model
- Profession-presence versus training-opportunity distinction
- Society Level semantics
- Arch Society semantics
- Social Band semantics
- family/variant/opportunity availability hierarchy
- context-binding architecture
- generic Chargen versus contextual-availability boundary
- S01/B1 architectural rule
  These areas should not be reopened merely because later evidence completion is incomplete.

Still incomplete content/evidence

The following bounded work remains:

- literal reconciliation of all 96 recovered legacy Profession identities;
- provenance accounting for all 518 recovered associations;
- detailed Profession-family availability authoring;
- detailed variant/track availability authoring;
- detailed training-opportunity availability authoring;
- contextual bindings where actual Setting/society evidence is needed;
- exact S01 fighting curriculum and equipment/Learning Group binding.
  These are content/evidence tasks under the approved architecture.

They are not grounds for redesigning the target Profession or Learning Group catalogues.

## 22. Remaining PO decisions

No material Profession-provenance or availability architecture decision remains open.

Later work may surface genuinely ambiguous content cases requiring Product Owner adjudication—for example:

- an individual legacy Profession whose disposition cannot be established from the recovered evidence;
- a contested Arch-Society applicability judgment;
- an S01 martial route with multiple defensible alternatives.
  Those should be brought back individually if and when evidence produces a genuine product choice.

They do not prevent approval of this architecture.

Final status

# #113 Profession Provenance / Availability — architecture approved; bounded reconciliation/content completion remains before Ready.

## Reconciliation evidence update — 16 September 2026

The [PO-approved reconciliation dossier](../source/professions/README.md) supersedes the earlier completion assessment above: 69 mapped/reconciled, 22 historical/legacy-only and five unresolved identities, totaling 96. All 523 recovered association occurrences are retained (49 family-scoped, 474 Profession-scoped); 518 is the controlling source claim, not a certified recovered total. E00 remains OPEN pending source correction or scoped healer ownership evidence.

Architecture and the 84-family / 59-group / 115-LG-opportunity / 88-direct-opportunity target model are unchanged. Remaining work is the five narrow source questions, E00 certification and contextual family/variant/opportunity availability, bindings and S01/B1 evidence. These do not block generic/unbound Chargen consumption under separate authorization. Overall #113 remains Preparing for Ready. No further content or implementation work is authorized by this publication.
