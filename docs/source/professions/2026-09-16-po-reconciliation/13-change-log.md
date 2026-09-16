# PO revision delta — 16 September 2026

Product Owner instruction in this task, headed INCORPORATE PO RULINGS INTO THE EVIDENCE DOSSIER; recorded 16 September 2026. This is authority for reconciliation interpretation only, not new recovered source evidence.

## Recomputed accounting

| Measure                          | Before | After |
| -------------------------------- | ------ | ----- |
| Mapped/reconciled legacy records | 67     | 69    |
| Historical/legacy-only           | 17     | 22    |
| Unresolved                       | 12     | 5     |
| Total identities                 | 96     | 96    |

| Detailed disposition         | Before | After |
| ---------------------------- | ------ | ----- |
| target variant/track         | 31     | 31    |
| split across target concepts | 8      | 10    |
| merged into target family    | 9      | 9     |
| historical/legacy-only       | 17     | 22    |
| unresolved                   | 12     | 5     |
| renamed successor            | 14     | 14    |
| direct successor             | 5      | 5     |

## Exact interpretation changes

- Bandit, Bounty Hunter, Homemaker, Docker and Prospector: unresolved → historical/legacy-only.
- Staff Officer: unresolved → split across P25 Military Commander, P26 Military Quartermaster and P27 Campaign Planner.
- Elite Guard Officer: unresolved → split across P14 Guard, Watcher and Escort and P25 Military Commander.
- Tribal Warrior, Clan Warriors, Crafter, Master Craftsmen and Guild Master: remain unresolved; exact missing evidence and separate PO authority recorded.
- Seven primary dispositions changed; five unresolved descriptions were narrowed. The other 84 legacy interpretations are unchanged.
- Target-side correspondence coverage changes from 41 to 42 of 84 families, with P27 newly represented by the Staff Officer umbrella ruling. This does not add a family or recover individual-duty evidence.

## Preserved evidence and content

- All 96 raw identity/provenance fields, all 523 scoped association occurrences, source hashes, family references, core/favored flags, ranks, legacy availability and history-separation statements remain unchanged.
- All 84 target families, 59 Learning Groups, 115 LG opportunities and 88 direct opportunities are structurally identical to the uploaded dossier. Variant routes, military compositions and unbound contextual ledgers are also unchanged.
- The source register, identity recovery, association accounting, availability ledgers 05–08, and history/restriction ledger 09 are byte-for-byte unchanged.
- Historical recovery_target_status values remain source provenance; current PO interpretation appears separately. The prior interpretation of all twelve affected records is retained in the JSON PO register.
- E00 stays OPEN and all 523 occurrences are retained. S01/B1 stays OPEN as a contextual gate. No equivalent martial route is selected.
- Generic/unbound Chargen consumption remains unblocked by the remaining evidence/content work.

## Contradictions and next work

No unexpected evidence contradiction was exposed. The actual ledger matches the expected 69 / 22 / 5 / 96 accounting. The two officer splits are explicitly PO interpretations of historical umbrella/composite roles and preserve the lack of individual duty/institution evidence.

Remaining work is limited to the five narrow source questions, E00 correction, and contextual availability authoring/S01 evidence. No further broad Profession architecture review is requested. No repository/runtime changes, issue submission, branch, PR or implementation/QA dispatch occurred.
