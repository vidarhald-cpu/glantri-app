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

## Implementation flow

1. Capture the observation or objective in an issue.
2. Triage area, type, priority, risk, and whether a product/rule decision is required.
3. Complete the task contract and architecture review for high-risk/cross-area work.
4. Name the exact accepted baseline branch and SHA.
5. Create one isolated, short-lived task branch/worktree.
6. Implement only the coherent slice; record newly discovered non-blocking work separately.
7. Open a development PR only when the target and push/PR authority are confirmed.
8. Review code, decisions, tests, compatibility, hotspot coordination, and user-visible evidence.
9. Move user-visible work to `Acceptance`; only the product owner accepts product behavior.
10. Merge an accepted ordinary task PR into `dev` under the product-owner-controlled development process. Release preparation from `dev` to `main` is a separate production-boundary workflow.

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

## Current exceptional context: PR #200 and initial `dev`

PR #200 is overwhelmingly accumulated work from the product owner's ChatGPT/Codex development process, not unknown third-party code. Its size reflects a long-lived development stream without an available merge path to `main`.

Treat it as a baseline/integration-management problem:

- freeze unrelated scope accumulation;
- map its functional slices and reserved hotspots;
- reconcile its published history, the accepted local continuation, current `main`, and the approved control-plane bootstrap into one verified candidate;
- publish that accepted candidate as `dev` only after verification and branch-rule readiness;
- start subsequent tasks from exact accepted `dev` SHAs in isolated worktrees; and
- involve the external maintainer only when a future accepted release moves from `dev` toward `main` and Azure.

Do not make historical cleanup or mechanically splitting PR #200 a prerequisite for this control-plane bootstrap. Its eventual integration still needs architecture, compatibility, verification, and playtest review.

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

## GitHub configuration still required

These are separate administrative actions and are not performed by the local reconciliation candidate:

1. Finish and accept the locally reconciled initial `dev` candidate under `docs/process/development-baseline.md`.
2. Verify working GitHub authentication/tooling for the authorized push and rules operations.
3. Create/push `dev` at the accepted candidate SHA; do not update `main` or production.
4. Protect `dev` with the approved task-PR/check rules and confirm the product-owner/project process can merge ordinary development PRs.
5. Verify the first push CI and confirm that no `deploy.yml`/production run is triggered.
6. Confirm the release-PR checks and external production-support procedure for a future `dev -> main` release.
7. Decide whether automatic deletion of merged task branches is safe for `dev`.
8. Maintain the existing operational Project, labels, views, and access with least privilege.

Do not perform broad historical issue/milestone/branch cleanup until the operational system is working.
