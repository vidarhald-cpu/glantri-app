# Implementation task contract

Use this contract for every significant implementation issue. Small defects may use a shorter form only when scope, ownership, rule basis, and verification are still unambiguous.

## Ready contract

### Outcome

State the user-visible or operational result, not merely the code to edit.

### Why now

Explain impact and why this task has priority.

### Scope

- In scope:
- Out of scope:

### Ownership

- Primary functional area:
- Owner/agent:
- Cross-area integration owner:
- Other affected areas:
- Reserved hotspots:

### Baseline and Git authority

- Accepted baseline branch:
- Accepted baseline commit SHA:
- Local branch/worktree name:
- Local-only, push authorized, or PR authorized:
- Intended PR target, if confirmed:

### Rule basis

- Source evidence and precise references:
- Conflicts/ambiguities:
- Approved rule decision(s):
- Intended computerized correction/simplification:
- Rule status: sourced, conflicted, approved deviation, or provisional:

### Contracts affected

List API, schema, persistence, event, command, synchronization, and UI read-model changes.

### Acceptance examples

Use concrete scenarios with inputs, actions, and expected outcomes.

### Verification

- Unit/component tests:
- Integration/contract tests:
- Browser/manual evidence:
- Migration/compatibility checks:
- Performance/security checks:
- Required CI jobs:

### Dependencies and integration order

List blockers, upstream contracts, dependent tasks, hotspot scheduling, and intended merge order.

### Product-owner decisions

List only decisions that genuinely require product/rule/UX judgment. Use `None` when complete.

### Handoff requirements

- Result and files changed.
- Decision records created/updated.
- Verification evidence.
- Resulting commit SHA and parent baseline.
- Compatibility/rollback notes.
- Remaining risks and follow-ups.

## Cross-area integration plan

Add this section when a task is unusually large, high-risk, or cross-area:

- Why the behavior cannot be split into smaller independently valuable PRs.
- Contract-first sequence and dependency graph.
- Hotspot owner for each stage.
- PR/merge order and compatibility between stages.
- Review stages and named evidence.
- Rollback/recovery strategy.
- Follow-up modularization or debt tasks.
