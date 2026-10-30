# Implementation task contract

Use this contract for every significant implementation issue. Small defects may use a shorter form only when scope, ownership, rule basis, and verification are still unambiguous.

The [canonical development operating model](./development-operating-model.md)
owns role authority, workflow, exclusive Forgejo lifecycle, visible-lane rules,
and standing execution authority. This document owns the self-contained
contract schema and acceptance detail.

At authorization time, the current Forgejo issue body becomes the executable
task contract. Comments remain evidence/history rather than a second contract.
Before every dispatch, reconcile that body with current authorization: role,
mode, exact baseline/candidate, scope/exclusions, Git authority, dependencies and
return gate. A comment cannot override a stale body for execution.
If a repository recovery contract describes an older execution state, mark it
clearly `provenance/superseded` and link the current issue; QA should not have to
reconstruct authorized scope from a long comment chain or stale recovery file.

`Ready` and `Authorized` are consecutive, exclusive lifecycle states. `Ready`
means the contract below is complete and current but execution is not
permitted. The Product Owner advances it to `Authorized` by copying an explicit
bounded authorization into the operational flow. A Builder starts only from
`Authorized`, after the Development Orchestrator confirms that the contract is
still complete/current and live gates pass. Technical completeness, chat
history, or credentials never imply authorization. `Active` means a named
visible Builder, Investigator, QA task, or bounded repair owns work in flight.

## Preparation before Ready

For future work, first capture the durable specification described in
[capability sizing and preparation](./development-operating-model.md#capability-sizing-and-preparation).
Use Preparing for Ready as supporting Design state while substantial definition
remains. Near activation, perform a short then-current dev preflight and fill
this exact execution contract. Resolve predictable missing decisions before
substantial dispatch when practical; ordinary implementation choices remain
with the Builder. Preparation must cover objective, settled decisions,
scope/exclusions, acceptance examples, dependencies, likely hotspots, and
verification class without exhaustive archaeology.

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
- Edit set (the exact files this task may write):
- Consumed-vocabulary set (schemas, unions, exhaustive switches, enums and interfaces this task reads whose meaning another task could change):
- Floor invariant (floor-class tasks only; the invariant in reviewable terms that caused the floor classification):

These three declarations are defined in
[what a lane declares](../architecture/ownership.md#what-a-lane-declares).
Reserved hotspots is the subset of the edit set that appears in the hotspot
register, plus any hotspot this task must coordinate without editing; it
narrows and annotates the edit set rather than duplicating or replacing it.
Name symbols in the consumed-vocabulary set, not only the paths that hold them:
its purpose is to expose coupling that no file-path reservation can see.
Derive and independently review the set using the
[consumed-vocabulary procedure](./integration-wave.md#deriving-and-reviewing-a-consumed-vocabulary-set);
it lowers, but does not bound, the rate of omission. Where the task introduces
or materially alters a workflow-driving state — a phase, step, status, action
or declaration kind, lifecycle state, or any other vocabulary that changes what
operations are possible — also declare its
[reachability path](./integration-wave.md#declaring-the-reachability-path-for-a-workflow-driving-state),
which is required in addition to the consumed-vocabulary set rather than
instead of it. State
the floor invariant for this slice specifically; never inherit one by analogy
from a sibling slice.

### Baseline and Git authority

- Forgejo lifecycle status: `Design` / `Ready` / `Authorized` / `Active` / `Ready for Independent QA` / `Ready for Control-plane Acceptance` / `Integrated`:
- Contract completeness/currentness evidence:
- Blocking, inactivity, dependency, or stale-contract support state, if any:
- Durable authorization record (Forgejo issue body/comment/label or other named contract):
- Canonical Codex project (`Glantri app — Forgejo`):
- Provisioning source root (`/Users/vidarhald/dev/glantri-app-forgejo`) or derived worktree:
- Execution role (Builder, independent QA, or bounded Investigator/Ops):
- Correlation key: issue + role + mode + full exact SHA:
- Sole supervising Development Orchestrator/parent task:
- Provisioning request ID (pending until resolved; separate from task ID):
- Resolved visible Work/Codex thread ID (required):
- Direct task/thread link (required when the client provides one; otherwise unavailable):
- Liveness state, owner, last meaningful progress and next action/inspection:
- Recovery/replacement count and changed causal conditions:
- Builder–QA repair-cycle count, root causes and remaining allowance:
- Worktree lease state, retained owner and terminal retirement evidence for duplicates:
- Accepted baseline branch:
- Accepted baseline commit SHA:
- Requested execution commit SHA (fresh Builder: baseline; continuation: authorized parent; QA: exact candidate):
- Isolated worktree:
- Prelaunch identity/HEAD evidence: source, origin, common Git directory, requested versus observed SHA:
- QA checkout state: detached exact head, no local branch or upstream:
- Short-lived branch (or N/A when no branch applies):
- Full bounded Builder authority or explicit narrower limit: implementation, verification, commit, task-branch push, create/update draft PR, evidence, batched in-scope QA repair, repair commit/push:
- Evidence/PR publication identity and exact target; automatic Orchestrator/Recorder fallback:
- Assigned credential role and non-secret repository-path-scoped handle:
- Independent QA required, or explicit authorized exemption with reason:
- Return/acceptance gate and any explicit conditional dev integration authority:
- Intended PR target, if confirmed:
- Required reading (exact repository paths):
- Database capability: none, application-only, migrations, reset/seed, integration tests, or other:
- Explicit `DATABASE_URL` owner/target, when database-capable:
- Explicit `DATABASE_URL_TEST` owner/target, when database-capable:
- Disposable PostgreSQL 16 setup, verification, and cleanup commands, when database-capable:

All execution SHAs are full exact commit IDs. Apply the
[prelaunch gate](./development-baseline.md#exact-sha-provisioning-gate); never infer
from `main`, `origin/main`, remote HEAD or a default branch, and never provision
from the historical recovery clone. A derived canonical worktree is valid.
Pending request IDs do not satisfy the resolved task-ID/launch gate. Preserve
binding, direct-access, attempt, lease, cleanup and blocker evidence under the
[recovery procedure](./agent-execution.md#continuation-first-provisioning-and-worktree-leases).
Validate every return against its correlation key before using it.

Use at most two automatic recovery/replacement attempts after the initial
attempt, stopping earlier after two substantially identical consecutive failures
without changed causal condition. Normally allow at most two Builder–QA repair
cycles after initial QA; the same root cause twice or exhausted allowance invokes
the [mandatory STOP/report/confirmation rule](./agent-execution.md#numeric-anti-loop-limits).
A lower contract limit is allowed; counters do not reset through handoffs.

Authorized read-only investigation includes publishing evidence to its assigned
issue. If the credential blocks publication, return the exact ready report and
target for automatic Orchestrator/Recorder publication; do not invalidate the
report, change credentials or ask the Product Owner to relay it. Surface login,
permission or other human needs immediately as USER ACTION REQUIRED.

Name only the documents needed to execute this task safely. `AGENTS.md` is always required; area-specific contracts apply only when the task touches that area. Decision records, audits, and historical reports are on-demand references, not blanket startup reading. Do not use instructions such as `read all architecture docs`.

For independent QA, use `docs/process/qa-execution.md`: ordinary mandatory
reading is `AGENTS.md`, that compact guide, this issue's exact QA contract, and
only explicitly named task-specific sources or sections. Do not automatically
assign the full process, ownership, baseline, or regression documents. Name
on-demand escalation references separately from startup reading.

Substantial Builder, independent QA, and dispatched Investigator work uses
separate isolated execution contexts—normally separate visible Work/Codex
tasks; QA must be a different execution context from the Builder. A helper
agent operating inside another lane's execution context does not satisfy that
lane, whether or not that helper is visible. If separate-context dispatch
fails, apply bounded recovery; if unresolved, record and escalate the
capability problem and use only an explicitly authorized manual fallback in
its own separate context. A same-context lane is not a substitute. Repository
documents are authoritative; the
Codex project and task links
are navigation and execution evidence only. Builders must not rely on chat
history to reconstruct issue, baseline, sources, scope, exclusions,
ownership/hotspots, acceptance, verification, Git/PR authority, dependencies,
role, or QA requirements.

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

For a UI-affecting task — one whose rendered output can move, which includes a task whose changed files contain no UI file at all — also state:

- which existing surfaces are an invariant and must render unchanged, and any visual change the task **is** authorized to make, surface by surface; absent an explicit authorization, established composition is preserved under [`AGENTS.md`](../../AGENTS.md#established-ui-composition-is-an-invariant), and intentional redesign is a separate authorization rather than a detail of this one;
- the exact widths at which before/after rendered captures are required, stated as **usable width** rather than the viewport requested, because the two differ by a chrome/scrollbar offset of roughly 27px;
- that the implementer produces those captures and independent QA re-produces them under the [rendered UI composition gate](./qa-execution.md#rendered-ui-composition-and-visual-review), which carries the required measurement method.

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

Use an isolated development browser session when real session/authentication
state, browser APIs, focus, responsive behavior, or another required condition
needs it. Safari launch, authorized testing-process control, and ordinary
local/development Glantri testing have
[standing authorization](./control-plane.md#standing-safari-and-development-browser-authority).
Do not require a personal signed-in profile by default. Personal accounts or
expanded access outside that scope require separate approval; actual human-only
OS/login/security prompts are surfaced immediately.

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

- Verification class: substantive implementation, mechanical preservation, or documentation/process; selected evidence and rationale under [QA classes](./qa-execution.md#verification-classes-and-evidence-validity).
- QA/hosted-check parallel schedule, or concrete dependency/measured resource constraint:
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
- Required CI jobs and actual protected contexts:
- Applicable [path-aware validation class](./development-baseline.md#path-aware-dev-gate--integrated-status), with implemented/transition state and local versus hosted evidence kept separate:
- Product-owner acceptance script:

Use `Not applicable` with a short reason rather than leaving irrelevant lines blank.

Catalogue publication, corpus completeness, and content-coverage changes run the
full test suite of the owning application rather than a targeted selection.
Presentation tests may depend indirectly on how complete the corpus is, and a
targeted selection cannot reach them: the affected test may name no content
module and import no catalogue source, so no search over the changed modules
finds it. Forgejo issue #396 is the worked example — publishing accepted reader
prose for 51 Learning Groups moved coverage from 44-of-95 to 95-of-95 and
falsified an `apps/web` presentation test that had selected Learning Group N01
precisely because it lacked a full description and asserted the honest-absence
note. This is a verification-scope requirement, not a new automated guard;
existing CI caught the real instance and no additional product guard is
introduced.

### Dependencies and integration order

List blockers, upstream contracts, dependent tasks, hotspot scheduling, and intended merge order.

### Product-owner decisions

List only decisions that genuinely require product/rule/UX judgment. Use `None` when complete.

### Handoff requirements

For an authorized Builder/QA loop, use the exact-SHA Builder return in
`docs/process/agent-execution.md` and the mode-aware QA handoff and return in
`docs/process/qa-execution.md` in addition to the evidence below. The
Development Orchestrator harvests the Builder result and sends the compact
immutable-head INITIAL, REPAIR, or PRESERVATION contract directly to a fresh
independent-QA task in its own separate execution context, harvests the
verdict and routes it without overriding FAIL.
The Product Owner is not the routine relay.

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

## Work-order field set

A **work order** is the dispatchable projection of the Ready contract above. It is
not a second contract and never carries a value the issue body contradicts: the
issue body remains the executable contract, and the work order is the field set a
dispatcher — human or, later, mechanical — must be able to read out of it without
interpretation. Where a field below already exists above, the name above is
authoritative and this section only says whether it is mandatory and what a worker
may assume when it is absent.

A work order is representable as YAML, as Markdown key/value lines, or as
issue-body headings. The representation is not the contract; the field set is.

### Mandatory fields

A packet missing any of these is not dispatchable. The hazard is not the missing
field but the default a worker invents in its place.

| Field                        | Carries                                                                                                                                                                            | Absent means                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`                         | The work-order identity, distinct from the issue number, so that a superseded order and its successor on one issue stay separable.                                                 | Stop. A reader cannot tell which order a verdict binds to.                                                                         |
| `issue`                      | The Forgejo issue whose body is the executable contract.                                                                                                                           | Stop, unless the contract names another durable authorization record explicitly.                                                   |
| `kind`                       | `implementation`, `investigation`, `ops`, `docs/process`, or `qa`. Selects the verification class and the return format.                                                           | Stop. Verification class is not inferable from the file list.                                                                      |
| `state`                      | The current lifecycle state, by label name.                                                                                                                                        | Stop. `Ready` is not permission, and the difference is the whole point of the state.                                               |
| `priority horizon`           | Whether this is on the current authorized path, queued behind a named item, or deferred. #819's authorized order is the live example of a horizon stated as an ordered path.       | Stop. A worker cannot judge its own urgency, and an unqueued lane competes for one serial CI runner.                               |
| `baseline branch`            | Normally `dev`.                                                                                                                                                                    | Stop. Never infer from `main`, remote HEAD, or a default branch.                                                                   |
| `baseline SHA`               | The full exact accepted SHA. A continuation also carries its authorized parent; a QA order also carries the immutable candidate head.                                              | Stop. Apply the [exact-SHA provisioning gate](./development-baseline.md#exact-sha-provisioning-gate).                              |
| `required reading`           | Exact repository paths or sections. `AGENTS.md` is always included.                                                                                                                | Read `AGENTS.md` and this contract, and nothing else. Do not self-expand the set.                                                  |
| `scope`                      | What the order exists to achieve, stated as an outcome.                                                                                                                            | Stop.                                                                                                                              |
| `exclusions`                 | What the order must not change, stated positively.                                                                                                                                 | **Nothing is excluded by default.** An empty exclusion list is a real statement, so write it rather than omit the field.           |
| `edit set`                   | The exact files the order may write.                                                                                                                                               | Stop. See [what a lane declares](../architecture/ownership.md#what-a-lane-declares).                                               |
| `declared expected hotspots` | The subset of the edit set that appears in the hotspot register, plus any hotspot the order must coordinate without editing.                                                       | The whole edit set is treated as reserved, which blocks more than necessary. State it.                                             |
| `acceptance`                 | Concrete acceptance examples with inputs, actions and expected outcomes, plus the applicability result for every acceptance dimension.                                             | Stop.                                                                                                                              |
| `performance expectation`    | The sizing at which the result must remain sane. Under the Alpha execution policy this is **roughly 200 participants/entities**, carried in every dispatch (#819 standing rule 2). | The floor above applies. It is not waived by silence.                                                                              |
| `eligible provider pools`    | Which execution pools may take this order. See [provider pools and qualification](./development-operating-model.md#provider-pools-and-qualification).                              | Any pool qualified for this `kind`. A pool not yet qualified for that kind does not self-select into it.                           |
| `QA level`                   | `QA-1`, `QA-2` or `QA-3`, with its independence requirement. See [QA levels](./qa-execution.md#qa-levels-and-what-independence-means).                                             | Stop for implementation work. A lane does not choose its own review depth.                                                         |
| `git authority`              | Granted or withheld, per operation: commit, task-branch push, draft-PR publication, evidence publication.                                                                          | **Withheld.** Produce the result and return it; do not push.                                                                       |
| `return gate`                | Where the order stops, and whether conditional integration is pre-authorized.                                                                                                      | Stop at `Ready for Independent QA`, or at acceptance for an explicitly QA-exempt docs/process order. Integration is never implied. |

### Fields that may be absent, and what a worker may then assume

| Field                          | Absent means                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consumed-vocabulary set`      | The order reads no symbol another lane could reinterpret. A worker that finds this false stops and reports rather than deriving a set mid-flight.                      |
| `floor invariant`              | The order is not floor-class. A worker that concludes otherwise stops; once the floor applies it governs the whole task.                                               |
| `database capability`          | **None.** No application, migration, reset, seed, or integration-test command runs, and no `DATABASE_URL` is assumed.                                                  |
| `browser capability`           | Synthetic evidence only. Standing Safari/development-browser authority still applies where the acceptance contract requires a real browser condition.                  |
| `provenance IDs`               | The worker records what it can observe and omits what it cannot. It never substitutes the orchestrating session's UUID for a background agent ID.                      |
| `dependencies and merge order` | No declared dependency. A dependency discovered in flight is a stop, not a scope expansion.                                                                            |
| `repair allowance`             | The standing limits apply: one initial attempt plus two recoveries, and two Builder–QA repair cycles after initial QA. A contract may lower them and never raise them. |

### Declared expected hotspots plus computed actual overlap

The declaration above is half of the mechanism. The other half is computed from the
real diff, and the Orchestrator owns it: see
[hotspot overlap is declared and computed](./development-operating-model.md#hotspot-overlap-is-declared-and-computed).
A declaration is a prediction, and a prediction is checkable.

## Supersession of an active work order

**A material change to the contract, or to a ruling the contract depends on, while
a lane is active, closes that work order and opens a new one.** It does not amend
the running order in place, and it does not reach the lane as one more acceptance
item.

This is the one named exception to continuation-first in
[AGENTS.md](../../AGENTS.md#continuation-first-execution). Continuation-first
protects a lane from being replaced for slowness. It does not oblige anyone to keep
a lane running against a contract that no longer describes the work.

### What `material` means

A change is material when it alters any of:

1. the outcome the order exists to achieve;
2. the authority model the order implements — who may act, who owns a persisted
   field, what the server decides rather than the client;
3. the acceptance criteria, **including the withdrawal of one**;
4. the edit set, the declared hotspots, or the floor classification;
5. the baseline the order was cut from, where the lane cannot be mechanically
   refreshed onto the new one.

A change is **not** material when it corrects a wrong number, clarifies wording
without changing what passes, names a source more precisely, or records evidence.
Those are reconciled into the issue body under
[executable contract and dispatch correlation](./agent-execution.md#executable-contract-and-dispatch-correlation).

A withdrawn acceptance item is material, and it is the case most often mistaken for
a clarification. On #798 the Orchestrator's own acceptance item 5 — that a visible
participant's longer name wins — was the cause of the defect the next QA cycle
blocked on, and withdrawing it was a changed contract rather than a third attempt at
one problem (comment 18407).

### Who decides, and what happens to the branch and the PR

- **The Product Owner decides materiality** where the change concerns product
  behaviour, a rule, authority or ownership. The control plane prepares the
  question; the Orchestrator does not answer it. #786 is the worked example: after
  three failed heads the Product Owner replaced the contract verbatim — revert to
  `dev` semantics, fix only the concrete defect, defer delegation to #784 — and
  recorded it as a changed causal condition (comment 18354).
- **The Orchestrator decides materiality** for a baseline or edit-set change that
  carries no product judgement, and records the decision with its reason.
- **The branch is kept.** Nothing is force-deleted and nothing is reset. #790's
  branch was retained at its tip precisely so that every measurement in comments
  17864, 18080, 18247 and 18339 stays addressable.
- **The PR is closed as superseded** — not merged, not reverted. #790 closed as
  superseded and the successor opened a **new** PR from current `dev` rather than
  continuing on the old head.
- **The successor order starts fresh from the current accepted baseline** unless the
  superseding ruling says otherwise, and takes fresh exact-head QA.

### How the superseded order is recorded, so the evidence is not lost

The superseded order's record carries, durably on the issue:

1. its work-order `id`, and the successor's;
2. the exact last head it reached, and the branch retained at that head;
3. the verdicts it received, by comment id, each still bound to the head it
   reviewed;
4. what caused supersession, quoted, with the ruling's own comment id;
5. which earlier rulings the change makes moot, listed, so that no later reader
   applies a superseded ruling to the successor. #786 comment 18168 is the model: a
   table of three earlier rulings with their status for the new repair, each marked
   `not to be built` or `not a prerequisite`;
6. the recovery and repair-cycle counters at the moment of supersession, with an
   explicit statement of whether they carry to the successor, and why.

On (6): counters do not reset merely because a new order exists. They reset only
where the superseding change is itself the changed causal condition that
[AGENTS.md](../../AGENTS.md#continuation-first-execution) requires after a STOP —
which is what #786 comment 18354 recorded, in terms, when it replaced the design
rather than retrying it.

## Cross-area integration plan

Add this section when actual size, risk, dependencies, or ownership conflicts
need coordination. Crossing established layers or many files alone does not
require splitting a coherent capability.

- Coherent user capability and reasons for any necessary split.
- Contract-first sequence and dependency graph.
- Hotspot owner for each stage.
- PR/merge order and compatibility between stages.
- Review stages and named evidence.
- Rollback/recovery strategy.
- Follow-up modularization or debt tasks.
