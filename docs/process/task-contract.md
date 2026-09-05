# Implementation task contract

Use this contract for every significant implementation issue. Small defects may use a shorter form only when scope, ownership, rule basis, and verification are still unambiguous.

`Ready` and `Authorized` are separate. `Ready` means the contract below is complete and current. `Authorized` means the product owner/control plane has explicitly permitted implementation dispatch in durable Forgejo case state or another named durable task contract. An agent starts implementation only when both are true; neither technical completeness nor credentials imply authorization. `Active` means a Builder or its repair loop is already in flight.

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

- Contract status: `Ready` / `Blocked` / `Design only` / `Completed` / `Stale/needs refresh`:
- Implementation authorization: `Authorized` / `Not authorized`:
- Activity: `Active` / `Inactive`:
- Durable authorization record (Forgejo issue body/comment/label or other named contract):
- Canonical Codex project (`Glantri app — Forgejo`):
- Execution role (Builder, independent QA, or bounded Investigator):
- Resolved visible task/thread ID/link:
- Dispatch state (`queued`, `running`, `completed`, or `failed`):
- Accepted baseline branch:
- Accepted baseline commit SHA:
- Isolated worktree:
- Short-lived branch:
- Local-only, push authorized, or PR authorized:
- Intended PR target, if confirmed:
- Required reading (exact repository paths):
- Database capability: none, application-only, migrations, reset/seed, integration tests, or other:
- Explicit `DATABASE_URL` owner/target, when database-capable:
- Explicit `DATABASE_URL_TEST` owner/target, when database-capable:
- Disposable PostgreSQL 16 setup, verification, and cleanup commands, when database-capable:

Name only the documents needed to execute this task safely. `AGENTS.md` is always required; area-specific contracts apply only when the task touches that area. Decision records, audits, and historical reports are on-demand references, not blanket startup reading. Do not use instructions such as `read all architecture docs`.

Substantial Builder, independent QA, and dispatched Investigator work uses
separate visible Work/Codex tasks; QA must be a different visible task from the
Builder. Hidden internal sub-agents do not satisfy those roles. If visible task
creation is unavailable, record the capability problem rather than substituting
a hidden lane. Repository documents are authoritative; the Codex project and
task links are navigation and execution evidence only.

Database-capable Builder/QA work must name an isolated disposable target before any application, migration, reset, seed, or integration-test command runs. A separate Git worktree does not isolate PostgreSQL state. Linked worktrees must not copy or inherit the primary checkout `.env` or another worktree's `.env.task`, and must not use the protected normal database at `localhost:5432/glantri`. Every database-capable operation and cleanup must re-bind the declared task environment to the actual current linked worktree and its expected container labels. If current-worktree ownership cannot be proved from the task contract and repository preflight, the command does not run.

### Rule basis

- Source evidence and precise references:
- Conflicts/ambiguities:
- Approved rule decision(s):
- Intended computerized correction/simplification:
- Rule status: sourced, conflicted, approved deviation, or provisional:

### Rule/reference documentation applicability

- Applicability: `Required` / `Regression only` / `Not applicable` / `Needs decision`:
- Canonical current-behavior reference(s):
- Decision and source-provenance reference(s):
- Admin reader-facing surface and registration impact:
- Same-PR update or documented split exception:

Mark this `Required` when the task changes a material Glantri rule, calculation, formula,
mechanically active table, derived value, or user/admin-facing system interpretation. The
implementation is incomplete until its canonical repository documentation is current. Update it
in the same implementation workstream and PR by default. A split requires an explicit reason,
owner, linked work item or PR, merge order, and evidence that no stale required reference will be
accepted or left reader-visible between changes.

Keep current implemented/accepted behavior in [rules documentation](../rules/README.md), material
rulings in `docs/decisions/`, and historical source artifacts and coordinates as provenance; link
these sources instead of copying the same decision, rule, or provenance across doc trees. Where
the established Admin Rules Docs surface is the reader-facing route, keep its
[document registry](../../apps/web/src/lib/rulesDocs.ts) current in the implementing change. Do
not register internal-only notes merely to satisfy this check, and identify provisional or
deferred behavior clearly in any current-behavior reference.

A behavior-preserving internal refactor may use `Regression only` when named existing
documentation and registration must remain accurate, or `Not applicable` when it cannot make a
rule/reference stale; give the concrete reason. Use `Needs decision` when the intended documented
meaning or canonical location is materially ambiguous. Missing, stale, duplicated, or
reader-inaccessible required documentation is an acceptance failure for the implementing task,
not optional polish or an unowned follow-up.

### Contracts affected

List API, schema, persistence, event, command, synchronization, and UI read-model changes.

### Acceptance examples

Use concrete scenarios with inputs, actions, and expected outcomes.

### Acceptance dimensions and applicability

Every task must consider the acceptance dimensions below, but not every dimension requires detailed criteria for every task.

Use one of these applicability values for each dimension:

- **Required:** the task can affect this dimension and must include concrete acceptance criteria and evidence.
- **Regression only:** the task should not change this dimension, but named existing behavior must remain protected.
- **Not applicable:** the task cannot materially affect this dimension. Give a short reason; do not add artificial criteria.
- **Needs decision:** the intended behavior is materially ambiguous and requires a product-owner ruling before the task can be `Ready`.

Applicability is based on product effect and risk, not only on the files being edited. A schema, API, projection, synchronization, or refactor task may require presentation or privacy acceptance when it changes facts later consumed by a user-facing workflow.

Purely internal work—such as a behavior-preserving refactor, build/tooling change, isolated test cleanup, or internal performance improvement—may mark user-facing categories `Not applicable` or `Regression only` when the reason is explicit and verification is proportionate.

#### Functional acceptance

State the user-visible or operational behaviors that must work. Include relevant success, empty, failure, retry, reload, undo/supersession, and compatibility cases.

Functional criteria should describe outcomes, not implementation steps. Examples:

- The same item identity remains after rename, equip, unequip, and transfer.
- An accepted player roll advances the intended process exactly once.
- Reload preserves the accepted result and current state.

#### Mechanical/rules acceptance

Required when the task changes or consumes Glantri rules, calculations, tables, modifiers, random results, derived values, or mechanically active item/effect properties.

State:

- the approved rule basis and any unresolved ambiguity;
- representative exact inputs and expected outputs;
- calculation stage and unit for each changed contribution;
- applicable modes, targets, scope, duration, caps, stacking, and rounding where relevant;
- source/provenance and approved computerized deviations;
- required golden, workbook-backed, or executable examples.

Do not treat descriptive or recorded-but-unsupported traits as active mechanics. If the app stores a capability it does not calculate or enforce, acceptance must say so explicitly.

#### Presentation acceptance

Required when a task adds, changes, removes, supplies, or can reorder user-facing information or actions.

Criteria must apply the [Glantri-wide Product & Presentation Principles](../product/product-presentation-principles.md) and the relevant area-specific presentation contract. State, where relevant:

- the user-facing game-world concept and canonical wording;
- which surface owns the decision, current state, result, reference fact, and history;
- how current, pending/provisional, resolved, and historical state are distinguished;
- where important rolls and calculations appear;
- required causal ordering and result grouping;
- continuity after acceptance and progression advance;
- loading, empty, disabled, error, stale, reload, and history behavior;
- basic keyboard, focus, readability, and supported responsive behavior;
- internal terms or diagnostics that must not appear.

Do not prescribe a comprehensive screen design when the functional area is still emerging. Specify the smallest coherent presentation contract needed for the implemented workflow.

#### Information-flow/privacy acceptance

Required when behavior depends on role, character control, involvement, ownership, knowledge, visibility, secret state, private choices, or player-specific calculations.

Apply the canonical [Authority and Information Projection Principle](../architecture/information-authority-and-projection.md). Canonical authority, action authorization, information projection, and rendered presentation are separate acceptance gates.

State:

- who may act;
- who may receive each sensitive input, roll, calculation, note, and outcome;
- what safe completion/status fact remains after redaction;
- which server/domain DTO or serialization boundary enforces projection, separately from where action authorization is enforced;
- behavior for ambiguous visibility and stale/cross-perspective data;
- negative acceptance examples: keys, values, identities, relationships, and executable state that must be absent from unauthorized server/API payloads, DTOs, serialized responses or generated HTML, and UI.

Client-side hiding, a rejected action, zero mutation, and a privacy-equivalent error are each insufficient evidence that protected facts were excluded from the payload.

#### Product-quality acceptance

Required for new or materially changed user workflows. For smaller user-visible changes it may be combined with Presentation acceptance if the distinction remains clear.

State the heuristic outcomes needed to prevent technically correct but clearly unwanted behavior, including as relevant:

- the next action and its consequence are understandable;
- important outcomes do not need to be inferred from logs;
- there are no unnecessary acknowledgement or repetitive safe-action clicks;
- consequential choices remain explicit;
- one visible source of truth exists for each concept;
- controls, values, and results are not duplicated or contradictory;
- current presentation does not become stale or silently mix with history;
- ordering matches game causality and sequence;
- errors explain the user-relevant problem and recovery;
- natural Glantri/RPG terminology is used instead of architecture language.

QA may raise a `product-quality finding` or `presentation finding` for a clear violation of the approved global principles or area contract even when no existing automated test, task sentence, or mockup predicts the exact defect. These are issue-body classifications for now, not new Forgejo labels.

Ambiguous preference goes to `Needs decision`. Clear low-impact polish may be recorded as P3. A clear principle violation is a bug/UX issue and is not reclassified as polish merely because functional tests pass.

### Perspective matrix

Required for multiplayer, role-sensitive, ownership-sensitive, visibility-sensitive, or secret-information workflows. Use `Not applicable` with a reason for work with one materially identical view.

At minimum, consider GM, actor/Player A, target/Player B, and uninvolved player. Add owner/non-owner, controller/observer, hidden/revealed, or admin/support perspectives when relevant.

| Perspective       | May act | Must see | Must not receive | Expected state/result |
| ----------------- | ------- | -------- | ---------------- | --------------------- |
| GM                |         |          |                  |                       |
| Actor / Player A  |         |          |                  |                       |
| Target / Player B |         |          |                  |                       |
| Uninvolved player |         |          |                  |                       |

Delete genuinely irrelevant rows, but do not omit a materially different perspective merely because it is difficult to test.

Where risk warrants it, compare each relevant perspective across:

1. before input;
2. pending or submitted;
3. accepted result;
4. progression advance;
5. reload or reconnect;
6. historical inspection;
7. undo or supersession;
8. stale or conflicting response.

### QA evidence and manual acceptance script

Define the evidence the implementer and QA must provide. Prefer deterministic synthetic/test data and the repository's Playwright/browser harness for browser QA.

Escalate to an isolated development browser session only when real session/authentication state, browser APIs, focus, responsive behavior, or another browser condition cannot be represented by the synthetic harness. Do not require a signed-in personal browser profile by default. Personal accounts or expanded browser/computer access require a concrete task reason and separate approval under the control plane.

Include, as applicable:

- exact setup and synthetic identities;
- the action sequence;
- expected visible result for each perspective;
- expected absent/private facts;
- focused unit/component tests;
- negative server/API payload, DTO, serialized-response or generated-HTML key/value/identity checks;
- API/projection/sanitization evidence separate from action-authorization and DOM evidence;
- Playwright scenario or screenshots;
- reload, history, undo, stale-response, keyboard, and responsive checks;
- known limitations and deliberately deferred findings.

For user-visible work, provide a concise product-owner manual script that can normally be completed without reading implementation details. Use this form:

```text
Setup:
Perspective:
Action:
Expected current/pending state:
Expected accepted result:
Expected state after progression/reload:
Expected private facts absent:
Evidence:
```

Passing automated tests is necessary where specified but does not override an observed presentation, privacy, or product-quality failure.

### Verification

- Unit/component tests:
- Mechanical/rules examples or golden tests:
- Integration/API/contract tests:
- Information-flow/sanitization tests:
- Synthetic browser/Playwright evidence:
- Isolated development-browser/manual evidence, only when required:
- Reload/history/undo/stale-state checks:
- Accessibility/responsive checks:
- Migration/compatibility checks:
- Database target evidence: sanitized host, port, database names, ownership marker, PostgreSQL version, and cleanup result:
- Performance/security checks:
- Rule/reference documentation and Admin registration evidence:
- Required CI jobs:
- Product-owner acceptance script:

Use `Not applicable` with a short reason rather than leaving irrelevant lines blank.

### Dependencies and integration order

List blockers, upstream contracts, dependent tasks, hotspot scheduling, and intended merge order.

### Product-owner decisions

List only decisions that genuinely require product/rule/UX judgment. Use `None` when complete.

### Handoff requirements

For an authorized Builder/QA loop, use the standard exact-SHA Builder and independent QA returns in `docs/process/agent-execution.md` in addition to the evidence below.

- Result and files changed.
- Decision records created/updated.
- Rule/reference documentation applicability result, changed canonical references, and Admin
  registration evidence or explicit non-applicability/split-exception rationale.
- Verification evidence.
- Acceptance result by applicable dimension: Functional, Mechanical/rules, Presentation, Information-flow/privacy, and Product quality.
- Perspective-matrix evidence and product-owner manual script for relevant user-visible work.
- Product-quality, presentation, privacy, and `Needs decision` findings discovered during implementation or QA, including deliberately deferred P3 items.
- Resulting commit SHA and parent baseline.
- Compatibility/rollback notes.
- Remaining risks and follow-ups.
- Orchestrator harvest evidence: child final state, retrieved exact head/result, durable Forgejo evidence/status update when authorized, and inclusion in the consolidated return.

A task is not `Ready` when a materially applicable acceptance dimension is omitted, when a perspective-sensitive workflow lacks a perspective matrix, or when a consequential presentation/privacy choice remains hidden inside implementation language. Categories that are genuinely irrelevant may be `Not applicable` with a reason. A material unresolved product preference, rules meaning, or visibility choice moves the task to `Needs decision`.

Required rule/reference documentation is part of acceptance: Builder evidence and independent QA
must block handoff when the canonical current-behavior reference or its applicable Admin
registration is missing or stale. An exception recorded under the applicability check changes the
delivery shape, not the freshness requirement.

### Applicability examples

| Task                                                   | Functional      | Mechanical/rules                          | Presentation          | Information-flow/privacy                      | Product quality | Perspective matrix                                  |
| ------------------------------------------------------ | --------------- | ----------------------------------------- | --------------------- | --------------------------------------------- | --------------- | --------------------------------------------------- |
| Rename an internal helper with identical behavior      | Regression only | Not applicable                            | Regression only       | Regression only if projection code is touched | Not applicable  | Not applicable                                      |
| Add a unique item description field and GM editor      | Required        | Not applicable unless mechanically active | Required              | Required if players may see it                | Required        | Required when GM/player visibility differs          |
| Add an item-specific OB variation                      | Required        | Required                                  | Required if displayed | Required if item traits can be hidden         | Required        | Required when multiple viewers see different detail |
| Fix accepted Combat results disappearing after advance | Required        | Regression only unless values change      | Required              | Required for participant-safe result detail   | Required        | Required                                            |
| Improve an internal query plan without changing output | Required        | Not applicable                            | Regression only       | Regression only                               | Not applicable  | Not applicable                                      |

## Cross-area integration plan

Add this section when a task is unusually large, high-risk, or cross-area:

- Why the behavior cannot be split into smaller independently valuable PRs.
- Contract-first sequence and dependency graph.
- Hotspot owner for each stage.
- PR/merge order and compatibility between stages.
- Review stages and named evidence.
- Rollback/recovery strategy.
- Follow-up modularization or debt tasks.
