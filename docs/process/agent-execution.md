# Supervisor-led agent execution

## Purpose and authority

Use this procedure for an isolated implementation task that needs an independent QA pass. It records the proven Glantri execution pattern; it does not expand anyone's Git, product, merge, release, or production authority.

- ChatGPT acting as product architect owns task shaping, product and rule decisions, and any interaction or acceptance checkpoint named by the task contract.
- The GitHub Issue is the durable work definition. The GitHub PR is the implementation and QA handoff record. GitHub is authoritative for exact SHAs, PR state, required checks, QA findings, and readiness.
- The task contract defines the stopping point. A supervisor must not infer authority to merge, release, touch `main`, deploy, or change production merely because QA passed.

## Isolated Builder and QA loop

For implementation plus independent QA where filesystem or branch isolation matters, use one Codex desktop supervisor authorized to create separate top-level Builder and QA tasks/worktrees.

1. **Verify the baseline.** The supervisor fetches the remote and resolves the exact current `origin/dev` SHA. Never trust a stale local `dev` branch. Confirm the Issue contract, scope, ownership, hotspots, required reading, acceptance, verification, and authorized checkpoint against that SHA.
2. **Launch the Builder.** Give the Builder an isolated worktree and the exact contract and baseline. The Builder implements only the approved slice, verifies it, commits, pushes a short-lived branch, opens a draft PR to `dev`, and posts a structured GitHub handoff containing the baseline, exact head SHA, acceptance evidence, checks, known limits, and state.
3. **Wait for publication.** The supervisor does not start independent QA until the Builder has published a stable PR head and handoff. Re-read the live PR head rather than relying on a chat message.
4. **Launch independent QA.** Give QA a separate worktree and the exact PR head SHA. QA verifies the Issue contract, required perspectives, regressions, presentation, privacy, and product quality, then posts evidence and classified findings to the PR or Issue. QA does not repair Builder-owned code.
5. **Route findings.** Clear in-scope defects return to the same Builder task and PR. The Builder repairs and publishes a new exact head; QA reruns against that head. Continue until QA passes or a genuine product decision blocks progress.
6. **Stop at the authorized checkpoint.** Record the final head, QA result, checks, decisions, and follow-ups in GitHub. If the contract ends at “QA passed / ready for integration,” leave the PR open and unmerged.

The product owner should not have to copy and paste handoffs between Builder and QA. The supervisor coordinates the tasks and GitHub remains the shared durable record.

## Finding routes

Route each finding once, without broadening the active task:

- clear, in-scope defect: same Builder task and PR;
- unrelated defect: durable backlog issue;
- clear low-impact polish: P3 backlog;
- material product or rule ambiguity: `Needs decision` for the product architect;
- cross-area architecture or ownership conflict: architecture/control-plane review.

Do not add speculative placeholders, disabled future controls, or unapproved future UI to make a later task appear prepared.

## Isolation and context discipline

Separate top-level Codex tasks are required when Builder and QA need independent filesystems, branches, worktrees, or clean-room verification. Same-task subagents share the checkout; use them only for bounded work where filesystem isolation is unnecessary.

Git worktree isolation does not isolate PostgreSQL. Before a database-capable Builder or QA starts application code, migrations, resets, seeds, or integration tests, its task contract must name explicit `DATABASE_URL` and `DATABASE_URL_TEST` ownership and the worktree must pass the disposable PostgreSQL 16 setup and verification in `docs/dev-database.md`. Never copy or inherit the primary checkout `.env`. Record the sanitized target before every database-capable command and clean up the owned container at handoff.

Mandatory reading stays task-specific and short: always read `AGENTS.md`, then only the exact documents named by the Issue contract or required by a concrete question. Do not repeat general Codex orchestration research or reload broad documentation on each task. Re-check orchestration guidance only if this runbook fails in practice or the installed capability has materially changed.

## Unattended local operation

Long local runs need stable network connectivity, an awake Mac, and preferably connected power. If the Mac sleeps, local commands, tests, databases, and worktrees pause. If connectivity disappears, model coordination and GitHub operations can disconnect or fail even when an already-started local process continues.

An operator may use macOS `caffeinate` as an aid for an unattended session. It is not a mandatory agent command, and closing a MacBook lid may still suspend the machine depending on its setup.
