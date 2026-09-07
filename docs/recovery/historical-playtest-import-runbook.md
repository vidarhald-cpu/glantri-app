# Historical playtest import runbook

## Authority and stop boundary

This runbook is the repository-owned R5C procedure for Forgejo issue #61. It imports the verified historical playtest snapshot only into the three explicitly named disposable issue-61 targets. It does not authorize import into `glantri-playtest-pg16` / `glantri_playtest`, port 5433, the protected `localhost:5432/glantri` database, another task database, production, or Azure. Persistent playtest import remains a separate stop gate.

The importer does not call application Campaign, Character, Item, Scenario, Encounter, Critical, or Combat services. It copies approved historical facts through bounded database transactions and never replays history.

## Accepted source

Use only:

```text
/Volumes/Glantri Backup/Glantri-Recovery/r5b-historical-db-20260907T112751Z
```

Before restore, verify `SHA256SUMS.sha256` and every entry in `SHA256SUMS`. The accepted custom dump digest is:

```text
6fa92f4486ba97328e3abe26e5bafe1c46f51628d012dfa17dd26e61b929bed1
```

Restore only `historical-glantri-20260907T112751Z.dump` with `pg_restore --exit-on-error --no-owner --no-privileges`. Do not apply the globals dump or schema-only dump, and never connect to the original `glantri-postgres` container or `glantri-app_glantri_postgres_data` volume.

## Disposable topology

Run the identity command from the current linked task worktree before creating any resource:

```bash
pnpm recovery:historical identity
```

The command derives the worktree key from the repository path and prints the exact non-secret resource names, databases, labels, target confirmations, and prepared markers for that worktree. It refuses a normal checkout. Never copy identity output from another Builder or QA worktree.

Create fresh PostgreSQL 16 containers and named volumes from that output. Bind each container to a Docker-assigned `127.0.0.1` port and reject 5432 or 5433. `<key>` below is the current derived worktree key; database names replace any key hyphen with an underscore.

| Purpose         | Container                                       | Database                                   | Volume                                          |
| --------------- | ----------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Restored source | `glantri-task-issue-61-<key>-r5c-source-pg16`   | `glantri_task_issue_61_<key>_r5c_source`   | `glantri-task-issue-61-<key>-r5c-source-data`   |
| Target A        | `glantri-task-issue-61-<key>-r5c-target-a-pg16` | `glantri_task_issue_61_<key>_r5c_target_a` | `glantri-task-issue-61-<key>-r5c-target-a-data` |
| Target B        | `glantri-task-issue-61-<key>-r5c-target-b-pg16` | `glantri_task_issue_61_<key>_r5c_target_b` | `glantri-task-issue-61-<key>-r5c-target-b-data` |
| Failure proof   | `glantri-task-issue-61-<key>-r5c-failure-pg16`  | `glantri_task_issue_61_<key>_r5c_failure`  | `glantri-task-issue-61-<key>-r5c-failure-data`  |

Every container must use these labels:

```text
glantri.db.kind=disposable-recovery
glantri.db.issue=61
glantri.db.worktree=<key>
glantri.db.purpose=source|target-a|target-b|failure
```

Do not create or copy `.env` or `.env.task`. Supply the source and target URLs explicitly for each command. Every explicit URL is rechecked against the current linked-worktree identity before client construction, and migration configuration performs the same validation before Prisma runs. Logs print only sanitized host, port, database, role, and purpose.

## Prepare and migrate

After restore, prepare the source through the repository command. This verifies the complete R5B checksum set, table/field mapping inventory, row counts, and historical migration lineage before creating `glantri_r5c_reader`. The reader role has `default_transaction_read_only=on`, no superuser/create/bypass privileges, SELECT on every source table, and no write privilege.

```bash
pnpm recovery:historical prepare-source \
  --backup-dir '<accepted-r5b-directory>' \
  --source-url 'postgresql://postgres@127.0.0.1:<source-port>/<identity-source-database>' \
  --source-container <identity-source-container>
```

Mark each still-empty target before migration:

```bash
pnpm recovery:historical prepare-target \
  --purpose target-a \
  --target-url 'postgresql://postgres@127.0.0.1:<target-a-port>/<identity-target-a-database>' \
  --target-container <identity-target-a-container> \
  --confirm-disposable-target <identity-target-a-confirmation>
```

Repeat with the exact target-B and failure identities. Target preparation fails unless the database has zero public tables and no prior marker.

Migrate every target from zero to the exact 17-file current head:

```bash
R5C_TARGET_PURPOSE=target-a \
R5C_TARGET_URL='postgresql://postgres@127.0.0.1:<target-a-port>/<identity-target-a-database>' \
R5C_TARGET_CONTAINER=<identity-target-a-container> \
pnpm recovery:historical:migrate
```

The migration wrapper validates the container image, labels, name, database, and port before Prisma runs. The importer then verifies every applied migration name and checksum and requires head `20260829103000_add_retained_character_ledger`.

## Import and reconcile

The complete A-E table/field inventory is [`historical-playtest-mapping.json`](../../scripts/recovery/historical-playtest-mapping.json). The importer refuses any restored table, field, populated Scenario status, row count, migration, checksum, source role, or target marker outside that inventory.

```bash
pnpm recovery:historical import \
  --backup-dir '<accepted-r5b-directory>' \
  --source-url 'postgresql://glantri_r5c_reader@127.0.0.1:<source-port>/<identity-source-database>' \
  --source-container <identity-source-container> \
  --purpose target-a \
  --target-url 'postgresql://postgres@127.0.0.1:<target-a-port>/<identity-target-a-database>' \
  --target-container <identity-target-a-container> \
  --manifest-out '<private-local-output>/target-a.json'
```

Run the same import on target B and compare the manifests byte for byte. A normal rerun on an already completed target is idempotent and must produce the same manifest. The emitted manifest includes the deterministic importer version as well as its mapping and manifest-format versions.

For the failure proof, add `--fail-after-family Character` on the dedicated failure target. Confirm the database marker ends in `importing-<source-fingerprint>-5`, Users/Roles/UserRoles/Campaigns/Characters are committed, later families are absent, and no manifest was emitted. Rerun without failure injection; it must resume through idempotent upserts and match the successful manifest byte for byte.

## Cleanup

After capturing evidence, remove only the four exact containers and four exact named volumes printed by the current invocation of `identity`. Re-inspect those eight names and record that all are absent. Never use a wildcard, inherited environment value, another worktree's identity output, or a broad Docker cleanup command.

Retain the committed non-secret reconciliation manifest and proof record. Never retain or publish database URLs with credentials, password hashes, session-token hashes, or session rows.
