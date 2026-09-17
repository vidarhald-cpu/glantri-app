# Standing local playtest

The Product Owner playtest runs only from the canonical checkout and keeps its
PostgreSQL data between Web/API restarts:

```bash
cd /Users/vidarhald/dev/glantri-app-forgejo
pnpm playtest:start
```

Open [http://localhost:3000](http://localhost:3000). A successful start ends
with:

```text
Glantri playtest is ready: http://localhost:3000
```

## Operator controls

```bash
pnpm playtest:start    # validate, migrate, build, and start Web/API
pnpm playtest:status   # report database, API, Web, and overall readiness
pnpm playtest:logs     # show the latest managed API and Web logs
pnpm playtest:restart  # stop owned Web/API processes, then start again
pnpm playtest:stop     # stop only owned Web/API processes
```

`stop` deliberately leaves `glantri-playtest-pg16` and its
`glantri_playtest_pg16_data` volume running and intact. Runtime state and logs
are kept under the ignored `.local-artifacts/playtest/` directory.

## Login

Use `local-playtest-gm@example.invalid`. The supported password remains only in
the private external environment. On the playtest Mac, copy it to the clipboard
without printing it:

```bash
(
  set -a
  . "$HOME/Glantri-Server/playtest-db/.env.playtest"
  set +a
  printf '%s' "$GLANTRI_LOCAL_SEED_PASSWORD" | pbcopy
)
```

Paste the value into the password field, then clear the clipboard when it is no
longer needed. Do not copy the environment file into the repository or a linked
worktree.

## Safety boundary

The standing runtime uses the existing database `glantri_playtest` on
`127.0.0.1:5433`. Startup verifies the exact existing container, local named
volume, port binding, external environment permissions, and PostgreSQL 16. It
generates the Prisma client and applies committed migrations with
`prisma migrate deploy`.

Ordinary playtest commands must never reset, reseed, replace, recreate, or
delete the database container, database, volume, accounts, or records. If the
expected persistent resources are missing or inconsistent, the controller
fails closed instead of repairing them.

Builder and independent-QA worktrees use their own disposable task databases
and alternate ports under [the database workflow](./dev-database.md). They must
not run these standing controls or access the persistent playtest target.

## Troubleshooting

- **Port 3000 or 4000 is occupied:** the controller reports the foreign listener
  and does not kill it. Stop the owning application, then retry.
- **Docker or persistent resource failure:** start Docker Desktop if needed. If
  the named container or volume is missing or has the wrong topology, stop and
  investigate; do not recreate or reseed it through ordinary startup.
- **External environment failure:** the supported file is
  `$HOME/Glantri-Server/playtest-db/.env.playtest` and must be a private regular
  file with no group/other permissions. Secrets are never logged.
- **Node or pnpm failure:** the wrapper selects the repository-pinned Node from
  `.node-version` and requires the `packageManager` pnpm version. Install the
  declared versions or set the already-supported `GLANTRI_NODE_BIN` selector;
  do not fall back to an incompatible host Node.
- **Migration or readiness failure:** run `pnpm playtest:logs`, then
  `pnpm playtest:status`. The API readiness check is
  `http://localhost:4000/ready`; startup never substitutes `migrate dev`, reset,
  or seed.
- **Stale managed state:** use `pnpm playtest:stop`. It validates the recorded
  PID, process group, start time, and command before sending any signal. If
  ownership cannot be proved, it refuses to kill the process and reports the
  conflict for manual investigation.
