# Target Critical catalogue V1 unresolved items

## Catalogue acceptance blockers

None.

- All 608 approved keys have authored prose and structured dispositions.
- All 2,179 source effect rows have final dispositions.
- No source row has disposition `unresolved`.
- No unsupported family/location combination or result index was added.
- No Secondary Critical rule was incorporated.

## External rule item that does not block the catalogue

Combat Experience Panic still has an approved `5–10 rounds` interval but no certified selection
method in Combat Round End & Review V1. Each catalogue result can nevertheless schedule its fresh CE
roll in the next CE pre-phase because the current CE state persists until replacement. Choosing the
subsequent Panic interval remains part of the existing #116 CE reconciliation, not a per-Critical
catalogue decision.

## Explicit activation boundaries, not unresolved content

The following are complete structured target content but are not executable under Forgejo #216:

- terminal-state consumers and death transitions;
- persistent injury/characteristic/function mutation and long-term recovery;
- non-Bleed Fire/Energy periodic loss;
- physiology/shock evaluators;
- attack-mode routing to Critical families;
- armor Critical arithmetic changes;
- Round End, treatment, CE, or condition runtime changes; and
- persistence, schema, migration, API, web, or fixture changes.

Those boundaries require separately authorized implementation design and immutable-head QA. They do
not reopen the 608-key catalogue axes or the authored source dispositions.

## Secondary Criticals

Forgejo #223 owns `Crit 2`, `Second crit.` / `Sec`, trigger conditions, family selection,
grade/result arithmetic, grade caps, and MC limitations. This package neither depends on nor resolves
those semantics.
