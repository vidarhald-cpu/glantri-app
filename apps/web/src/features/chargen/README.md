# Chargen Feature

Entrypoint: `ChargenWizard.tsx`.

The App Router file under `apps/web/app/(app)/chargen` is kept as a thin route
wrapper. Feature code for chargen lives here so state, view-models, hooks, and
step components can be split incrementally without adding business logic to the
route layer.

## Target competency preparation (issue168)

`targetCompetencyContent.ts` projects all 172 approved competencies directly from
the exported full catalogue: 131 base Skills, 26 Specializations, 12 spoken
languages, and 3 written traditions. The source/context seam supports this typed
projection independently of legacy canonical content. The target context is
explicitly unbound/general; it grants no universal availability, ordinary-point
access, or target Group/Profession membership.

The projection preserves every immediate parent, including Falconry → Animal
Training → Animal Handling. Existing counterpart Specialization thresholds are
retained; otherwise the existing Chargen schema threshold is used. Eligibility
can read acquired ranks of an immediate Specialization parent without counting
the root Skill or relationship-granted ranks instead.

The separate group-free target Skill type requires resolved linked stats and
does not weaken legacy SkillDefinition validation or change Character/API
schemas. Target Skill pricing uses the existing ordinary/flexible price values
through an explicit access route; legacy callers retain their existing prices.
This is preparation for allocation wiring, not an active purchase path.

Linked stats are inherited only from clear existing counterparts, preserving
their arrays. The 61 remaining base/written mappings await Product Owner review;
proposed pairs are not runtime metadata. The definition builder refuses to
produce an incomplete target runtime set. Written traditions cannot inherit
generic Literacy or gain competence from a spoken-language entry.

The visual wizard still consumes its existing legacy source. Target activation,
allocation integration, persisted target interpretation, and browser evidence
remain incomplete while these mappings are pending. Legacy content is retained
separately as compatibility input, including existing Profession and Group
calculations. No target Groups or Professions are activated, no draft or Character
migration is performed, and no new draft-hydration behavior is claimed.
