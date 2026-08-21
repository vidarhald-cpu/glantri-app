# Glantri development control plane

## Purpose

The control plane keeps product decisions, implementation work, and repository state understandable while several agents work independently. It optimizes the product owner's time by making decisions and acceptance visible without using chat history as the backlog.

This document describes durable operating policy. GitHub Issues and one GitHub Project show what work is happening now.

## Sources of truth

| Information                                 | Authoritative location                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Product priorities and current work status  | GitHub Project and linked Issues/PRs                                           |
| Task contract and implementation discussion | GitHub Issue and PR                                                            |
| Product and presentation quality            | `docs/product/product-presentation-principles.md` plus area and task contracts |
| Architecture and ownership policy           | Repository documentation                                                       |
| Approved rule and architecture rulings      | `docs/decisions/`                                                              |
| Source evidence and provenance              | `docs/source/`, `docs/rules/`, cited external material                         |
| Current implementation behavior             | Code plus tests, interpreted with approved decisions                           |

Chat is useful for exploration and product discussion but is not durable project state. Material decisions must be recorded in the repository or linked GitHub issue before dependent implementation is accepted.

Historical issues, milestones, and Claude-created architecture work are preserved as input. They do not become the current operational backlog until triaged and deliberately adopted.

## Documentation loading and maintenance

Mandatory agent reading is an architectural and resource cost. Only information required for safe, effective execution belongs in the always-read layer.

- `AGENTS.md` and tool-specific top-level guides contain short operating rules and links.
- Each task contract names the exact additional repository paths required for that task; blanket directions such as `read all architecture docs` are not acceptable.
- Area-specific contracts are read only when the task touches that area.
- Decisions, audits, historical reports, and provenance are on-demand references.
- A new standing document needs a clear reason to join the mandatory reading set. Task- or area-specific detail remains scoped below the top level.
- Periodically prune duplication and move fuller explanations into the linked process, area, or decision document that owns them.

This is an efficiency and resource principle, not a rigid line-count rule. The task still requires enough current context to work safely.

## Authority model

| Role                             | Owns                                                                                                                                                                      | Does not own                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Product owner                    | Priority, Glantri rule/UX rulings, acceptance, portfolio choices, `dev` creation/protection, ordinary task-PR review/merge, development integration and release readiness | Production deployment mechanics                                                                               |
| External maintainer              | Production-release/deployment support at the future `dev -> main -> Azure` boundary                                                                                       | Development baselines, `dev`, routine task work, ordinary development PRs, backlog, or architecture decisions |
| Architecture/control-plane agent | Task decomposition, ownership, contract design, cross-area planning, decision records, verification review                                                                | Unapproved product rulings or production authority                                                            |
| Implementation agent             | Changes and tests inside an authorized task contract                                                                                                                      | Undeclared scope, unapproved rules, shared-baseline selection, `main` merge, production actions               |
| Integration owner                | Coordination and merge order for one cross-area task                                                                                                                      | Standing authority over `main` or production                                                                  |

Credentials do not confer product or release authority. Agents must not merge to `main`, approve/cancel deployments, deploy, change Azure production configuration/secrets, or request production write access. `dev` authority does not broaden into `main` or production authority.

## Least privilege and development tooling

### Normal Glantri operating boundary

An agent's default operating boundary is:

- the assigned Glantri repository or isolated worktree;
- existing standard local development and file-processing tools;
- the Glantri GitHub repository, subject to the separate read/write, push, PR, merge, and release authority in this control plane and the task contract; and
- Glantri source material explicitly stored in the repository or supplied through the Glantri project context.

Anything outside that boundary needs a concrete task reason and the approval required below. Technical reachability, an existing login, a credential, or an installed tool does not expand the task's scope or the agent's authority.

### Routine local tool use

Existing standard local tools may be used on Glantri files inside the assigned worktree without separate approval. This includes compilers and typecheckers, formatters and linters, test runners, Git tooling, Docker and local database tooling, Prisma, and local PDF, Office, Excel, and general file readers or converters.

The normal repository dependency workflow may install dependencies already declared by the repository and make task-authorized dependency changes using the repository's package manager. It does not authorize installing unrelated or global software.

### Actions that require explicit approval

Obtain explicit user approval, tied to a concrete task need, before:

- installing new software, VS Code extensions, global utilities, or packages outside the normal repository dependency workflow;
- enabling a new external service or integration;
- granting new macOS permissions or filesystem access outside the assigned workspace;
- granting personal-cloud or account access; or
- granting computer-control, Accessibility, screen-recording/screen-capture, or other expanded privileges.

If an existing tool cannot complete the task without one of these changes, stop and request the narrowest useful permission or installation rather than treating the task itself as blanket approval.

### External transmission and personal services

An installed VS Code extension or local tool is not automatically approved to transmit Glantri repository or source content. External AI or cloud analysis, signed-in personal services, publishing/deployment services, and any other tool that sends project content outside the approved Glantri/GitHub environment require explicit approval before use.

Personal ChatGPT capabilities such as Calendar or Sites may exist for unrelated user purposes. Glantri agents must not use them unless the Glantri task explicitly requires them and the user approves their use where appropriate. Their presence does not make them part of the Glantri control plane.

The personal Google Drive connector has been deliberately disconnected. Current Glantri source workbooks are tracked local snapshots, and live personal Drive access is not required or part of the default workflow. When a source workbook changes, use a deliberate source-ingestion flow: export or otherwise obtain the approved snapshot, replace the tracked repository copy, record provenance as needed, and commit the change. Do not silently substitute a live personal-Drive version.

### Tool availability does not grant action authority

Destructive and external actions remain governed by the task contract and the authority model. Installing, discovering, or being able to invoke a tool does not grant authority to push, open or update a PR, merge, deploy, delete, publish, change accounts or permissions, or alter GitHub, production, or Azure configuration.

## Work lifecycle

Use these Project statuses:

`Inbox -> Triage -> Needs decision -> Ready -> In progress -> In review -> Acceptance -> Done`

Terminal alternative: `Cancelled / Duplicate`.

Suggested Project fields:

- Area
- Type: feature, bug, rule decision, technical debt, investigation, operations
- Priority: P0-P3
- Size: XS-XL
- Risk: low, medium, high, cross-area
- Owner/agent
- Parent initiative
- Blocked by
- Target checkpoint
- Rule status: sourced, conflicted, approved deviation, provisional

Priority is separate from defect severity. Small defects can remain durably recorded at P3 without interrupting active work.

An issue reaches `Ready` only when its task contract supplies an exact baseline, acceptance examples, ownership, rule basis, affected contracts/hotspots, verification, required decisions, and an applicability result for every acceptance dimension. See `docs/process/task-contract.md`.

`Ready` is a completeness state, not implementation permission. `Authorized` is a separate, explicit product-owner/control-plane dispatch decision recorded in durable GitHub state. `Active` means a Builder or repair loop is in flight. `Blocked`, `Design only`, `Completed`, and `Stale/needs refresh` remain non-dispatchable; a stale contract must be reconciled to live `origin/dev` before it can return to `Ready`. No more than four authorized implementation Builders may be active concurrently, and hotspot or dependency conflicts can reduce that number.

## When I approve a case, what happens next?

Approval for implementation makes a complete issue `Ready + Authorized`. From there the normal path is:

`Approved issue -> isolated Builder -> draft PR to dev -> independent QA -> control-plane acceptance -> dev integration -> optional release PR -> external-maintainer production release`

| Stage                | Who acts and what is produced                                                                                                                      | Message the product owner should expect                                       | Product-owner action                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Authorize            | Product owner/control plane records a self-contained authorized issue, exact baseline, scope, acceptance, hotspots, and Git authority.             | The issue is `Ready + Authorized`; a Builder lane is assigned.                | Decide priority and any product/rule/consequential architecture questions.            |
| Build                | An isolated Builder verifies live `origin/dev`, implements only the issue, verifies, and publishes a draft PR to `dev` with an exact-head handoff. | **Builder complete / QA pending** or **Needs decision**.                      | None unless a decision or coordination blocker is reported.                           |
| Independent QA       | A fresh QA reviewer tests the exact PR head in a separate worktree and posts `PASS`, `PASS WITH FOLLOW-UP`, or `FAIL` with evidence.               | **QA failed / repair required** or **QA passed / ready for dev integration**. | Review acceptance evidence; decide genuinely consequential follow-ups.                |
| Accept and integrate | Control plane/product owner accepts the slice; an authorized integration actor merges the checked PR into shared `dev`.                            | **Integrated to dev**, including the resulting exact `dev` SHA.               | Accept/reject and choose integration order.                                           |
| Optional release     | Under separate authority, a narrow `dev -> main` release PR is prepared after release readiness is chosen.                                         | **Narrow release PR ready for external maintainer**.                          | Decide product release readiness; do not perform production mechanics by implication. |
| Production boundary  | The external maintainer performs production release/deployment support and records verification.                                                   | **Production deployment verified**, when applicable.                          | Confirm product outcome; ordinary agents remain read-only at this boundary.           |

Exception paths stay narrow:

- Missing product/rule/UX/privacy or consequential architecture decision: the Builder or QA posts **Needs decision** with one concrete question and stops affected work.
- QA `FAIL`: the same Builder repairs the same PR where in scope, publishes a new exact head, and fresh independent QA runs again.
- Dependency or hotspot collision: stop and coordinate ownership/merge order; do not widen scope.
- Production-only problem: ordinary agents may diagnose safely when authorized, but do not mutate production, merge `main`, change Azure, or deploy.

The issue and PR hold the durable status, exact SHAs, evidence, decisions, and follow-ups. Chat may notify the product owner, but chat-only context never authorizes work or substitutes for those records.

## Implementation flow

1. Capture the observation or objective in an issue.
2. Triage area, type, priority, risk, and whether a product/rule decision is required.
3. Complete the task contract and architecture review for high-risk/cross-area work.
4. Name the exact accepted baseline branch and SHA.
5. Create one isolated, short-lived task branch/worktree.
6. Implement only the coherent slice; record newly discovered non-blocking work separately.
7. Run `pnpm format:check:changed` against the task's exact accepted parent. Changed files must pass Prettier and `git diff --check`; inherited untouched formatting debt does not block the task.
8. Open a development PR only when the target and push/PR authority are confirmed.
9. Review code, decisions, tests, compatibility, hotspot coordination, and user-visible evidence.
10. Move user-visible work to `Acceptance`; only the product owner accepts product behavior.
11. Merge an accepted ordinary task PR into `dev` under the product-owner-controlled development process. Release preparation from `dev` to `main` is a separate production-boundary workflow.

One coherent behavior or architecture slice is the governing PR size rule. There is no rigid changed-file cap. An unusually large, high-risk, or cross-area PR must include an integration plan describing why it cannot be sliced safely, contract/merge order, hotspot ownership, review stages, verification, compatibility, rollback, and follow-up modularization.

## Cross-area coordination

- Declare all affected areas and shared contracts before implementation.
- Assign one integration owner to every cross-area task.
- Treat the hotspots in `docs/architecture/ownership.md` as reserved surfaces.
- Permit only one task to edit a hotspot unless the integration plan assigns the split and merge order.
- Establish shared contract/schema changes before dependent implementations where practical.
- Architecture review is required before cross-area or high-risk work becomes `Ready`.
- Record interface decisions under `docs/decisions/architecture/` when they create a durable boundary.
- Use PR/issue timelines for active handoffs; do not create a shared mutable agent-log file.

## Rule governance

Source PDFs, texts, workbooks, and tables are evidence and provenance, not unquestionable implementation truth. Approved Glantri implementation rulings may correct errors, resolve conflicts, simplify manual procedures, or use computer calculation to improve accuracy.

Agents must cite relevant evidence, record conflicts and deviations, and never silently reinterpret a source. Material rulings use `docs/decisions/templates/rule-decision.md`, remain traceable when superseded, and are protected by focused executable examples or golden tests.

## Product-owner checkpoints

The product owner should normally need to monitor three queues:

- **Needs decision:** rule, UX, priority, or consequential architecture choice.
- **Acceptance:** completed user-visible slices with a short test script/evidence.
- **Portfolio choices:** initiative ordering, capacity, and deferred work.

Recommended cadence:

- Twice-weekly asynchronous digest: completed, newly blocked, decisions needed, and next likely work.
- Weekly short portfolio checkpoint: priorities and product/rule decisions.
- Architecture checkpoint only for material cross-area tradeoffs.
- Acceptance checkpoint for completed user-visible slices.
- Monthly reconciliation of the Project, issues, documentation, branches, and released version.

## Published `dev` and PR #200 provenance

`dev` is the active development integration branch. Its accepted initial baseline is `2203f37e196e2de34cf911ea4fa08ac9feb6f8be`; later accepted `dev` SHAs are recorded by task contracts and merge handoffs without replacing that fixed initial reference.

Ruleset `20708650` requires PRs plus successful `ci` and `docker-test` checks for `dev`, requires zero approving reviews, and blocks force-pushes and deletion. Ordinary task branches start from an exact accepted `dev` SHA and return through PRs targeting `dev`.

PR #200 is superseded provenance, not the active development baseline. Its head `4179034ef13c1713a23bddad7bf9ce01fc4880ea` is an ancestor of `dev`; its work, the 50 local continuation commits, `main` reconciliation, and the control-plane bootstrap were incorporated into the accepted `dev` lineage. Closing it as unmerged does not reject its work, and it must not be retargeted to manufacture a new baseline.

`main` remains production/release only. A future accepted release moves from `dev` toward `main` with the required production-boundary support, and the released `main` state is then reconciled back into `dev` before a newer development baseline is accepted.

## Repository versus GitHub work

Keep in the repository:

- shared agent instructions;
- this process and ownership model;
- development-baseline policy;
- durable architecture and rule decisions;
- issue/PR templates;
- machine-enforceable architecture checks where valuable.

Keep in GitHub:

- current backlog and status;
- assignees, priority, dependencies, and checkpoints;
- task discussions and handoffs;
- PR review/check/merge state;
- environment and deployment status visible to authorized maintainers.

## Active repository operating state

- `dev` is published, protected, and used for ordinary task PRs.
- `main` and Azure production remain outside ordinary development authority.
- Pushes to `dev` run CI but do not trigger the `main`-only production deployment workflow.
- The exact accepted parent and resulting `dev` SHA are recorded for each task.
- Release-PR checks and production-support procedure are confirmed separately before a future `dev -> main` release.
- Automatic deletion of merged task branches remains a separate repository-administration decision.

Do not perform broad historical issue, milestone, or branch cleanup as part of ordinary task publication.
