# Local control-plane recovery baseline

Status: Accepted recovery baseline established by R3A on 2026-09-03.

## Purpose and authority

This record establishes the recovered local Forgejo repository baseline after loss of the prior GitHub operational control plane. It records provenance and recovery evidence only. It does not reconstruct the issue portfolio, make a Glantri rule or UX decision, authorize ordinary implementation, change the production branch, deploy, or alter Azure.

The canonical local Forgejo working repository is private `recovery-admin/glantri-app`. Its default branch is `dev`.

## Accepted Git provenance

The accepted recovered development topology is:

- Last GitHub-integrated `dev`: `8db7ae068a6ad52a20f36361d4dee9539503c53c`.
- Accepted issue/PR #383 head: `a04c449f8407f35abc2c4b734629c781b75783c9`.
- Accepted recovered merge: `d533b47a31dc437fe77857339fa983e2ec7ebfbc`.
- Accepted recovered merge tree: `0744a76481331f875ae93756f03911502831deb8`.
- Recovered merge parents, in order: `8db7ae068a6ad52a20f36361d4dee9539503c53c` and `a04c449f8407f35abc2c4b734629c781b75783c9`.
- Preserved recovered production/release boundary on `main`: `e8b4f1f335c2ea37a5230f5ee2f63811ff3a76fc`.

R3A sets `refs/heads/dev` exactly to the accepted recovered merge. It does not add this document to `dev`, because doing so would change that required pointer. This document is committed on `refs/heads/recovery/r3a-control-plane-baseline`, rooted directly at the accepted recovered merge. Any later integration of recovery documentation into `dev` must use the normal separately authorized development workflow.

## R1 verification

R1 verified `d533b47a31dc437fe77857339fa983e2ec7ebfbc` in an isolated clean clone/worktree and reported PASS for:

- full Git object integrity;
- changed-file formatting and whitespace checks;
- typecheck, lint, unit/component/package tests, aggregate coverage, and production build;
- Prisma generation, deterministic critical-effect generation, and file-size reporting;
- all committed migrations and database suites against isolated PostgreSQL 16 targets;
- targeted #383 retained-character regressions;
- targeted #387 combat-critical runtime regressions;
- Docker API/web image builds and readiness;
- the CI-style Playwright suite; and
- the storage-enabled Artifact and Blackboard scenarios when run with isolated storage roots.

R1 made no GitHub write, push, deployment, Azure change, `main` change, history rewrite, or baseline promotion.

## Mandatory B2 follow-up

R1 observed an intermittent B2 equipment read-model race: on two full-suite attempts, a player-added equipped dagger was visible in the UI before it appeared in the immediate server equipment read model. A clean isolated B2 rerun and the final complete CI-style suite passed. The recovery baseline is accepted with this mandatory follow-up; the observation must not be silently classified as resolved.

Before dependent equipment/read-model work is accepted, the control plane must create and authorize a bounded investigation or repair task that reproduces the timing path, determines whether the defect is in application synchronization or test isolation, and adds deterministic regression coverage as appropriate. This recovery record makes no rule, product, or UX decision about the eventual fix.

## R2 verification and preserved evidence

R2 installed the local Forgejo 15.0.7 LTS control plane at `http://127.0.0.1:3001` with SQLite and all mutable state under `/Users/vidarhald/Glantri-Server/forgejo/data`. The service is bound to loopback only, publishes no SSH port, and has open registration disabled.

R2 imported and verified all 544 recovered refs, including `refs/stash`, with exact object-ID parity and full Git integrity. Persistence across controlled restarts passed. A stopped-instance backup and clean isolated restore drill passed.

The canonical R2 stopped-instance backup is retained on the encrypted external APFS volume at:

`/Volumes/Glantri Backup/Glantri-Recovery/forgejo-15.0.7-r2-20260903T094645Z`

Its portable-root archive SHA-256 is:

`ee1db08f2885fc59acca7ad908507a32c673465d808d083cc1ea99d9dc5cd1c7`

R3A preserves the imported recovery evidence in two forms:

1. private archived/read-only Forgejo repository `recovery-admin/glantri-recovery-evidence`, containing the same 544 imported refs; and
2. independent read-only bare mirror `/Volumes/Glantri Backup/Glantri-Recovery/r3a-control-plane-baseline/glantri-recovery-evidence.git`, with its ref manifest, Git integrity result, and checksums stored beside it.

The R2 backup directory and the independent R3A evidence directory are made read-only after verification. The original recovered working tree at `/Users/vidarhald/dev/glantri-app` remains unchanged and is not the canonical working checkout.

## R3A control-plane state

- Canonical working repository: private `recovery-admin/glantri-app`.
- Default branch: `dev`.
- Exact `dev`: `d533b47a31dc437fe77857339fa983e2ec7ebfbc`.
- Exact `main`: `e8b4f1f335c2ea37a5230f5ee2f63811ff3a76fc`.
- Recovery-document branch: `recovery/r3a-control-plane-baseline`.
- Recovery-document path: `docs/recovery/2026-09-03-local-control-plane-recovery-baseline.md`.
- Evidence repository: private and archived/read-only.
- Forgejo administrator: private password set, stored in the local macOS login keychain, and verified without recording it in repository, scripts, logs, or reports.

No GitHub write, `main` mutation, Azure change, deployment, issue reconstruction, portfolio adoption, or product/rule/UX decision occurred in R3A.
