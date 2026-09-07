# R5C historical playtest import reconciliation

## Scope and authority

This record captures the disposable proof run for Forgejo issue #61 on 2026-09-07. The implementation branch started from exact accepted `origin/dev` commit `aedbf9ecc4789a41096b7583c6987635ca86f304`. The run used only the checksum-verified R5B custom dump and did not connect to the original historical PostgreSQL container or volume, the protected development database on port 5432, or the persistent playtest database on port 5433.

Persistent playtest import is outside this proof and remains a separate authorization gate.

## Verified source

- Evidence directory: `/Volumes/Glantri Backup/Glantri-Recovery/r5b-historical-db-20260907T112751Z`
- Custom dump SHA-256: `6fa92f4486ba97328e3abe26e5bafe1c46f51628d012dfa17dd26e61b929bed1`
- All entries in `SHA256SUMS` and the checksum wrapper were verified before restore.
- Restored public tables: 23, matching the R5B inventory.
- Historical migration head: `20260819143000_add_scenario_lifecycle_kernel`.
- Source data fingerprint before import: `07fc47b8b77779a6fd139cfa7cd6db43efe39adbc44437f7ad34b4d3c07bf47e`.
- Source data fingerprint after all imports and reruns: `07fc47b8b77779a6fd139cfa7cd6db43efe39adbc44437f7ad34b4d3c07bf47e`.

The importer connected as `glantri_r5c_reader`. That role was proven to have `default_transaction_read_only=on`, no superuser/create/bypass privileges, SELECT on all 23 source tables, and write privileges on zero source tables.

## Disposable proof topology

All containers used PostgreSQL 16, Docker-assigned loopback ports, unique named volumes, and the required disposable recovery labels.

| Purpose       | Container                                      | Database                                  | Volume                                         |  Port |
| ------------- | ---------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | ----: |
| Source        | `glantri-task-issue-61-d543-r5c-source-pg16`   | `glantri_task_issue_61_d543_r5c_source`   | `glantri-task-issue-61-d543-r5c-source-data`   | 54720 |
| Target A      | `glantri-task-issue-61-d543-r5c-target-a-pg16` | `glantri_task_issue_61_d543_r5c_target_a` | `glantri-task-issue-61-d543-r5c-target-a-data` | 54727 |
| Target B      | `glantri-task-issue-61-d543-r5c-target-b-pg16` | `glantri_task_issue_61_d543_r5c_target_b` | `glantri-task-issue-61-d543-r5c-target-b-data` | 54724 |
| Failure proof | `glantri-task-issue-61-d543-r5c-failure-pg16`  | `glantri_task_issue_61_d543_r5c_failure`  | `glantri-task-issue-61-d543-r5c-failure-data`  | 54723 |

Exact-name checks proved all eight resources absent before creation. Each target began with zero public tables, received its purpose-specific marker, and migrated through the exact 17 committed current migrations to `20260829103000_add_retained_character_ledger`.

## Mapping and reconciliation

The complete table-and-field A-E inventory is [`historical-playtest-mapping.json`](../../scripts/recovery/historical-playtest-mapping.json). The committed machine-readable result is [`2026-09-07-r5c-historical-import-manifest.json`](evidence/2026-09-07-r5c-historical-import-manifest.json). Every restored table and field is inventoried; no populated mapping remains unresolved.

| Family                                 | Source | Imported | Transformed |          Provenance only | Omitted | Unresolved |
| -------------------------------------- | -----: | -------: | ----------: | -----------------------: | ------: | ---------: |
| Users / Roles / UserRoles              |     13 |       13 |           0 |                        0 |       0 |          0 |
| Campaigns                              |      6 |        6 |           0 |                        0 |       0 |          0 |
| Campaign roster                        |     21 |       12 |           0 |                        9 |       0 |          0 |
| Characters                             |      8 |        8 |           0 |                        0 |       0 |          0 |
| Scenarios                              |      8 |        8 |           1 |            8 field-level |       0 |          0 |
| Scenario relationships / participants  |     26 |       26 |           0 |                        0 |       0 |          0 |
| Scenario event log                     |  5,097 |    5,097 |           0 |                        0 |       0 |          0 |
| Encounters                             |     73 |       73 |          73 | source statuses retained |       0 |          0 |
| Active combat states / archived rounds |     52 |       52 |           0 |                        0 |       0 |          0 |
| Reusable entities                      |      3 |        3 |           0 |                        0 |       0 |          0 |
| Campaign assets                        |      0 |        0 |           0 |                        0 |       0 |          0 |
| Equipment items / storage / loadouts   |     77 |       77 |           0 |       conflicts reported |       0 |          0 |
| Sessions                               |     89 |        0 |           0 |                        0 |      89 |          0 |
| Canonical content snapshot             |      1 |        0 |           0 |                        1 |       0 |          0 |
| Historical migration rows              |     15 |        0 |           0 |                       15 |       0 |          0 |
| Legacy weapons / lifecycle transitions |      0 |        0 |           0 |                        0 |       0 |          0 |

The Scenario provenance count is field-level: all eight base rows were imported, while their historical lifecycle revision/cycle values remain provenance because there is no approved current field. The Encounter source-status evidence is likewise retained while every imported Encounter is made historical/read-only by setting current status to `archived`.

## Acceptance evidence

1. The verified custom dump restored successfully, and its restored table counts match the accepted R5B inventory.
2. Targets A, B, and failure-proof migrated from zero schema to the exact current migration head.
3. Imports completed on targets A and B.
4. Every family reconciles in the committed manifest.
5. Every omission and provenance-only treatment has an explicit reason.
6. Six Campaigns were imported, including `Brave new world`.
7. Eight Characters were imported, including `The Gladiator`; all eight retain their source IDs.
8. The three Characters with multiple historical Campaign memberships have zero current roster rows.
9. All nine of those historical memberships remain in manifest provenance: four for The Gladiator, three for Scyrian cavalry guy, and two for Test Glantrian soldier.
10. The single historical `closed` Scenario is current `completed`; no other status was invented.
11. All 73 historical Encounters are current `archived`. The three historically active Encounter IDs are included in that total and none is live.
12. The target has zero Session rows; all 89 historical Sessions are accounted for as intentional omissions.
13. All five password hashes passed the current scrypt format proof and were preserved. No credential, hash value, email, or token appears in the manifest or logs.
14. CharacterRevision, CharacterLedgerEvent, ArtifactAuditEvent, and ScenarioArtifactReference counts are zero. No Character, acquisition, item, loadout, or provenance history was fabricated.
15. The source fingerprint is identical before and after all importer executions.
16. An idempotent rerun on target A produced the same target data fingerprint and byte-identical manifest.
17. Targets A and B produced target data fingerprint `b78fccfa80325133a0d9f44e4cd52bc59c93d07b95c16e18bb0a2b72bca7c210` and byte-identical manifest SHA-256 `b7fd4d02d80983837affae7c8f3d5562c57f16593294ef02b1b8e39fb3d5a006`.
18. Failure injection after the Character family left a known checkpoint with Users, Roles, UserRoles, Campaigns, and Characters committed, no later families, and no manifest. A normal rerun recovered to the same successful manifest.
19. Guard tests reject the protected development endpoint, the persistent playtest endpoint, remote hosts, ambiguous database names, wrong labels/containers, mismatched migrations, mutable source roles, and mapping drift. A real port-5433/playtest preparation attempt was refused before any Docker or database access. Secret scanning of the changed files found no credentials, password hashes, session tokens, or token hashes.
20. After evidence capture, only the four exact disposable containers and four exact named volumes above are removed and re-inspected as absent. Cleanup outcome is recorded below after execution.

## Embedded equipment conflict evidence

Historical embedded Character equipment arrays were empty while canonical item rows existed for three Characters: The Gladiator (20 canonical items), Player test character (9), and Scyrian cavalry guy (4). The importer preserves the empty embedded facts and the 33 canonical item rows independently, reports the mismatch in the manifest, and does not silently select or synthesize an authority.

## Verification

- Focused importer tests: 11 passed.
- Repository typecheck: 17 tasks passed.
- Repository lint: 17 tasks passed.
- Repository tests: 11 tasks passed; all enabled tests passed. Database/API suites that require their separate integration environment remained explicitly skipped by their existing harness; the disposable database proof above exercised the importer against PostgreSQL 16 directly.
- Repository production build: 11 tasks passed.
- Every issue-61 file passes a direct Prettier check, and `git diff --check` passes. The repository helper's wider comparison also selected hundreds of accepted-baseline files and reported only two unrelated pre-existing recovery documents; neither is part of this change.

## Cleanup result

The four exact containers and four exact named volumes in the topology table were removed after the final ownership inspection. Individual exact-name container and volume inspections then confirmed all eight resources absent. No general Docker cleanup ran, and no protected, persistent, original-source, or foreign resource was removed.
