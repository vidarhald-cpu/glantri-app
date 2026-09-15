# Chargen Feature

Entrypoint: `ChargenWizard.tsx`.

The App Router file under `apps/web/app/(app)/chargen` is kept as a thin route
wrapper. Feature code for chargen lives here so state, view-models, hooks, and
step components can be split incrementally without adding business logic to the
route layer.

## Target competency consumption (issue168)

`targetCompetencyContent.ts` projects all 172 approved competencies directly from
the exported full catalogue: 131 base Skills, 26 Specializations, 12 spoken
languages, and 3 written traditions. The wizard consumes this projection through
the content/context seam. Unbound/general grants no universal availability,
ordinary-point access, or target Group/Profession membership.

The projection preserves every immediate parent, including Falconry → Animal
Training → Animal Handling. Existing counterpart Specialization thresholds are
retained; otherwise the existing Chargen threshold applies. Nested eligibility
uses the immediate Specialization's acquired ranks, not root-Skill or derived
ranks. Specializations inherit their immediate parent's linked stats. The 61
previously unresolved pairs use the approved issue168 comment5074 proposal with
Campaign Strategy amended to INT/INT; unambiguous legacy counterparts retain
their existing arrays. No spoken/written rank transfer is introduced.

Legacy canonical content remains a separate compatibility input for existing
Group/Profession calculations and group costs. Only exact retained target IDs
keep existing membership/routes. A linked-stat counterpart or matching display
name does not grant a route. New slot choices are filtered to exact target IDs;
cardinality and cost policy remain unchanged and every required slot retains
sufficient candidates. Target Learning Groups and Profession families remain
inactive. Target Skill costs use the existing 2 ordinary/1 flexible values via
the access route; Specializations retain 4 for the first rank and 2 thereafter.
This applies to retained target IDs too: `one_handed_edged` costs 2 with an
ordinary target route, although the unchanged legacy caller's secondary category
costs 1. Preserving the numeric schedule does not imply identical totals across
different access classifications.

A target-tagged Character Skill variant stores its definition and can omit a
Group; legacy rows still require their existing Group. Target Specializations
retain immediate-parent metadata. Existing JSON persistence and offline/local
repositories preserve these variants without database-column changes or a
migration. Read projections include saved target definitions alongside readable
legacy rows. Compatibility aliases are not new target acquisition choices.

The existing wizard sequence, profiles, Civilization/transitional Society,
ordinary/flexible pools and background mother-tongue behavior remain. This does
not add saved-draft hydration: the existing wizard still does not automatically
resume a stored draft. The stopped #160 browser-profile procedure is not a
successful end-to-end certification for this slice; browser evidence must be
reported separately from adapter, repository, and component tests.
