# Deterministic Builder and QA worktree bootstrap

This is the supported repository-native entry path for a genuinely fresh linked Builder or QA
worktree. It does not change the host Node installation, global package configuration, Forgejo
permissions, protected branches, or the existing disposable-database rules.

## One bootstrap command

Start from the exact accepted `dev` SHA in the task contract and run:

```bash
scripts/bootstrap-worktree.sh \
  --role builder \
  --task 55 \
  --baseline 171756bb64ccf83d2e35ffa8400d8206ab24b1d5
```

Independent QA uses the same command with `--role qa`, its own fresh linked worktree, and the same
accepted baseline. The task number and baseline shown above are examples from Forgejo #55; every
later task supplies its own values. Code-only work may add `--skip-database`. That is an explicit
opt-out; it never redirects database access to the protected shared target.

The entry point performs these phases in order and stops at the first failure:

1. Select exact Node from `.node-version` before executing repository JavaScript. An explicit
   `GLANTRI_NODE_BIN` is accepted only when it matches exactly; an incompatible or broken PATH or
   Homebrew Node is not used as a fallback.
2. Create ignored worktree-local `node` and Corepack shims, then prove Node, declared pnpm, and
   pnpm's reported Node runtime all match. These shims stay first on `PATH` for every child process.
3. Authenticated noninteractive `git fetch origin dev` with exactly `glantri-builder` or
   `glantri-qa`, selected by `--role`; compare live `FETCH_HEAD` with the full accepted baseline.
   There is no anonymous probe, implicit username, credential rendering, or Keychain inspection.
4. Run `pnpm install --frozen-lockfile` with a shared host cache/store, followed by explicit
   `@glantri/database` Prisma client generation and another runtime consistency check.
5. Only after those checks, refuse copied primary `.env` files and inherited database target
   variables, then use the existing `db:task:setup` and `db:task:verify` ownership guards to create
   and verify one worktree-owned PostgreSQL 16 container with distinct application and test
   databases.

The default shared cache is `~/Library/Caches/glantri-worktree-bootstrap` on macOS and
`${XDG_CACHE_HOME:-~/.cache}/glantri-worktree-bootstrap` elsewhere. Override it only with an
absolute `GLANTRI_BOOTSTRAP_CACHE_ROOT`. It contains package artifacts, not Forgejo or database
credentials. `.local-artifacts/bootstrap/manifest.json` records only non-secret runtime, baseline,
cache, database status, and coarse timing evidence.

After bootstrap, run repository commands through the same verified runtime:

```bash
scripts/worktree-runtime.sh pnpm typecheck
scripts/worktree-runtime.sh pnpm db:task:test
scripts/worktree-runtime.sh pnpm db:task:cleanup
```

Do not invoke a broken or incompatible host `node`/`pnpm` directly. Cleanup remains fail-closed:
the existing database command re-derives current-worktree ownership and checks the exact container
labels before removing the exact container, its anonymous PostgreSQL data volume, and `.env.task`.
Docker receives no caller-supplied volume name, so unrelated named or anonymous volumes are outside
the cleanup target.

## Forgejo credential boundary

Bootstrap selects only the persistent role identity assigned by the task: `glantri-builder` for a
Builder or `glantri-qa` for QA. The macOS Keychain-backed value is consumed by Git's existing
credential helper and is never read, printed, placed in arguments, or copied into the worktree.
Missing credentials fail noninteractively. Authentication does not broaden task authority.

The accepted Forgejo #41 contract deliberately gives the Builder token repository scope but no
issue-lifecycle scope. Therefore branch push is a Builder action, while draft-PR creation, durable
issue/PR evidence, and lifecycle movement remain coordinated through the Development Orchestrator's
authorized issue-capable lane. Do not add issue scope to the persistent Builder identity to make a
single task more convenient.

The #55 entry investigation also confirmed that a temporary repository token cannot be safely
revoked by a noninteractive Builder when its only issue/repository scope lacks token-administration
authority. A token created by an authorized Orchestrator or administrator must be revoked by that
same authorized lane; task cleanup cannot merely assume revocation. The persistent role credential
is the normal path, so #55 neither creates a temporary token nor weakens #41.

Before selecting the role credential, bootstrap verifies that `origin` is exactly the canonical
loopback URL. A different or credential-bearing remote is rejected without printing its value.

## Setup-failure evidence retained from #55

The first attempted fresh worktree setup assumed an `origin/main` tracking ref and failed before
bootstrap because that ref was absent in the creating checkout. A remote branch can exist without a
local tracking ref, so worktree creation must not guess `origin/main`. The task contract names
`dev` and an exact SHA: authenticate, fetch `origin dev`, verify that SHA, and create the linked
worktree from the verified commit. This bootstrap repeats the authenticated `dev` verification but
cannot retroactively repair a worktree-creation command that selected an unverified ref.

On the #55 MacBook entry baseline, PATH resolved `/opt/homebrew/bin/node` to Homebrew Node 25.8.2,
which could not start because a dynamic `simdjson` library was missing. The supported
`/opt/homebrew/opt/node@22/bin/node` was healthy at 22.23.2. Bootstrap selected Node 22 first and did
not repair or invoke the broken host runtime.

### Coarse #55 timings

All measurements used Node 22.23.2, pnpm 10.6.0, and explicit Prisma Client 6.19.2 generation. The
fresh Builder and QA runs started from detached `2c69271a` worktrees with no `node_modules` and ran
concurrently against the shared cache.

| Run                                   | Runtime | Forgejo baseline | Dependencies | Prisma client | Database |
| ------------------------------------- | ------: | ---------------: | -----------: | ------------: | -------: |
| Initial Builder, empty worktree/store |    0.9s |             0.2s |        10.2s |          0.6s |     1.9s |
| Same Builder, warm worktree/store     |    0.3s |             0.1s |         1.0s |          0.6s |     0.8s |
| Fresh Builder, shared store           |    0.3s |             0.1s |         5.7s |          0.7s |     1.9s |
| Fresh QA, shared store                |    0.5s |             0.2s |         4.4s |          0.6s |     1.9s |

Both fresh runs reused all 447 packages with zero downloads. Their generated owners, container
names, loopback ports, application databases, and test databases were distinct and passed the
existing PostgreSQL 16 ownership verification.

## Handoff evidence

Record the manifest's coarse phase timings, exact baseline/head, selected Node and pnpm versions,
Prisma generation result, sanitized database ownership/host/port/database names, checks run, and
cleanup. Never record tokens, database passwords, or `.env.task` contents.
