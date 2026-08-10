# Glantri development control plane

## Purpose

The control plane keeps product decisions, implementation work, and repository state understandable while several agents work independently. It optimizes the product owner's time by making decisions and acceptance visible without using chat history as the backlog.

This document describes durable operating policy. GitHub Issues and one GitHub Project show what work is happening now.

## Sources of truth

| Information | Authoritative location |
| --- | --- |
| Product priorities and current work status | GitHub Project and linked Issues/PRs |
| Task contract and implementation discussion | GitHub Issue and PR |
| Architecture and ownership policy | Repository documentation |
| Approved rule and architecture rulings | `docs/decisions/` |
| Source evidence and provenance | `docs/source/`, `docs/rules/`, cited external material |
| Current implementation behavior | Code plus tests, interpreted with approved decisions |

Chat is useful for exploration and product discussion but is not durable project state. Material decisions must be recorded in the repository or linked GitHub issue before dependent implementation is accepted.

Historical issues, milestones, and Claude-created architecture work are preserved as input. They do not become the current operational backlog until triaged and deliberately adopted.

## Authority model

| Role | Owns | Does not own |
| --- | --- | --- |
| Product owner | Priority, Glantri rule/UX rulings, acceptance, portfolio choices | Production deployment mechanics |
| External maintainer | `main` merge, release decision, production approval, Azure production configuration | Routine task implementation unless separately participating |
| Architecture/control-plane agent | Task decomposition, ownership, contract design, cross-area planning, decision records, verification review | Unapproved product rulings or production authority |
| Implementation agent | Changes and tests inside an authorized task contract | Undeclared scope, unapproved rules, shared-baseline selection, `main` merge, production actions |
| Integration owner | Coordination and merge order for one cross-area task | Standing authority over `main` or production |

Credentials do not confer product or release authority. Agents must not merge to `main`, approve/cancel deployments, deploy, change Azure production configuration/secrets, or request production write access.

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

An issue reaches `Ready` only when its task contract supplies an exact baseline, acceptance examples, ownership, rule basis, affected contracts/hotspots, verification, and required decisions. See `docs/process/task-contract.md`.

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
10. Merge into the authorized development target according to documented authority. `main` remains external-maintainer-only.

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

## Current exceptional context: PR #200

PR #200 is overwhelmingly accumulated work from the product owner's ChatGPT/Codex development process, not unknown third-party code. Its size reflects a long-lived development stream without an available merge path to `main`.

Treat it as a baseline/integration-management problem:

- freeze unrelated scope accumulation;
- map its functional slices and reserved hotspots;
- establish the exact accepted committed development state;
- start subsequent tasks from that explicit state in isolated worktrees;
- let the external maintainer determine how the accumulated state eventually reaches `main`.

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

These are separate administrative actions and are not performed by this bootstrap branch:

1. Confirm the exact `main` ruleset, required reviews/checks, who may update/merge it, and whether any `main` update triggers production.
2. Confirm whether a non-production integration branch is permitted, who may create/update/merge it, and what CI/preview behavior it triggers.
3. Decide the initial integration baseline, including the pushed and local-only portions of the PR #200 development stream.
4. Create or verify one GitHub Project and configure the statuses/fields above.
5. Add a minimal label vocabulary: `area:*`, `type:*`, `priority:P0-P3`, `risk:high`, `risk:cross-area`, and `needs:*`.
6. Create saved views for Needs decision, Acceptance, Portfolio choices, and each active functional area.
7. Decide whether automatic deletion of merged task branches is safe for the approved development target.
8. Confirm which checks should be required for development PRs and eventual release PRs.
9. Grant GitHub Project read/write scopes only if board inspection or automation is explicitly desired.

Do not perform broad historical issue/milestone/branch cleanup until the operational system is working.
