# Content verification report — PO revision 16 September 2026

These are document/accounting checks, not runtime tests or independent implementation QA.

| Check                               | Result                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controlling P hash                  | Matches 548a81ec323321609fb7af1a2a78459450556dc32a4df5818965c10b2b48def6.                                                                                   |
| Input integrity                     | All six read-only source hashes unchanged after authoring.                                                                                                  |
| Identity inventory                  | 96 unique exact legacy IDs; all 96 have one disposition; all printed per-identity counts match their printed association lists.                             |
| Association totals                  | 523 printed = 49 family + 474 Profession = 299 groups + 149 ordinary + 75 secondary. Headline 518 and 46/472/294 not certified (E00).                       |
| Duplicates                          | Both within-scope identical healing_practice core repeats retained; duplicate sequence across healer scopes exposed.                                        |
| Reconciliation                      | Recomputed: 69 mapped/reconciled + 22 historical/legacy-only + 5 unresolved = 96. Seven existing disposition labels retained; split count 8 → 10.           |
| Target IDs                          | 84 unique exact profession IDs and codes; all mapped family references valid.                                                                               |
| Target opportunities                | 115 LG + 69 direct base + 19 direct specialization = 203; unique family/type/target IDs; direct reasons 64 groupless and 24 unsuitable-companion groups.    |
| LG roster                           | 59 exact groups after applying M to G; all referenced; 90 distinct grouped base Skills.                                                                     |
| Direct target identities            | 61 distinct base Skills and 18 distinct Specializations across 88 direct rows; every ID exists in C.                                                        |
| Combined occupational base coverage | 130 of 131 base Skills represented by group/direct opportunities; no new target added.                                                                      |
| Routes                              | 202 distinct P route labels; one explicitly unbound P65 writing core outside exact opportunity count; 21 military compositions.                             |
| Axes                                | 11 Arch-Society states on each family/opportunity; only the four requested qualitative values; lower-Level conditional-family cases explicitly flagged.     |
| Context                             | No named setting binding assigned; exact source annotations retained; descriptor versus required-binding distinction preserved.                             |
| History separation                  | No absent Profession→Learning-History→Skill join fabricated or added to direct counts.                                                                      |
| Scope                               | Only local output artifacts and temporary authoring helpers written; no current dev content, Git state, runtime, database or issue state inspected/changed. |

Detailed counts and source hashes are in `validation.json`. New occurrence/variant/context identifiers are document references only and must not be mistaken for source or product IDs.

## PO revision preservation checks

- Original uploaded ZIP passed integrity verification; all 16 working input files matched it before updating.
- All twelve previous unresolved records received a dated PO ruling; seven changed primary disposition and five retain separate, exact missing-evidence questions.
- The other 84 legacy interpretation records remain structurally identical; all 96 raw identity/provenance fields remain unchanged.
- All 523 association objects are structurally identical, preserving order, scope, owner, duplicate occurrences, reference IDs, flags and ranks.
- Protected target, route, military-composition and contextual ledger sections remain structurally identical, beyond merely retaining their counts.
- All six source documents still match the original registered SHA-256 hashes.
- Source register, raw recovery/accounting documents, availability ledgers 05–08, and history/restriction ledger 09 are byte-for-byte unchanged.
- Structured unresolved exceptions exactly match the five unresolved main-ledger records. Standalone validation.json equals the embedded validation object.
- E00 is OPEN, exact 518 certification is BLOCKED, and S01/B1 is OPEN. Generic/unbound consumption is NOT BLOCKED.
- No unexpected evidence contradiction was exposed; no current remote issue status or implementation certification is claimed.

The integrity manifest records original/revised file hashes and unchanged protected-section fingerprints. These are content and provenance checks, not runtime tests or independent implementation QA.
