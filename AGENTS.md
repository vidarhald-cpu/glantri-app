# Glantri repository instructions

This file is the canonical, provider-neutral execution policy for every worker on this repository, whatever agent product or model runs it. Provider-specific files (for example `CLAUDE.md`) are thin adapters: they may map this policy onto a client's substrate, but they never restate, extend, or override it.

## Authority and roles

- Work from the existing Glantri monorepo and preserve established architecture unless the task explicitly changes it.
- The product owner decides priority, game rules, user experience, development integration, and acceptance.
- The architecture/control plane authorizes work. One Development Orchestrator coordinates and dispatches Builders, Investigators/Ops workers, and fresh independent QA directly; a permanent QA Orchestrator is not part of the operating model.
- The Orchestrator does not author tracked implementation, rules, architecture, product, or process content. Coordination output, issue and PR evidence, and execution-ledger records are its own work and are not tracked repository content.
- Current Git and case-management authority is the loopback-only Forgejo repository `recovery-admin/glantri-app`. The canonical MacBook clone is `/Users/vidarhald/dev/glantri-app-forgejo`, and the canonical Codex project is `Glantri app — Forgejo`.
- The historical `Glantri app` Codex project and `/Users/vidarhald/dev/glantri-app` checkout are read-only, non-mutable recovery/history evidence. Do not use them for new implementation, Builder work, QA mutation, branch creation, reset/rebase/cleanup, migration, or routine current-development fetch/push. Repository documents remain authoritative; Codex project references are navigation aids.
- `dev` is the shared development integration branch. The product owner/project development process may create and protect it and merge ordinary task PRs into it.
- The external maintainer participates only in future production-release/deployment support at the `dev -> main -> Azure` boundary.
- Direct push to `dev` is prohibited. Never push or merge to `main`, deploy, change production/Azure configuration or secrets, or treat credentials as authority.
- Pushes and PR changes require explicit task or user authorization and a confirmed target.
- Discussion and proposed prompts are not dispatch. A product-owner/control-plane order must actually reach the Development Orchestrator; process-policy updates do not authorize product work or change existing lane contracts/states.

## Execution substrate and independence

- Builder and independent QA execute in distinct isolated contexts. Builder and QA for one result are never the same context.
- Attended substantial Builders normally use separate visible execution sessions where the client supports them.
- Explicitly authorized unattended Builders may use fresh background/subagent contexts when the task is bounded and the substrate is durably recorded.
- Fresh background/subagent contexts are acceptable for normal independent QA provided they share no Builder conversational history.
- **A helper agent operating inside the Builder's implementation context is not independent QA.**
- A Builder never self-accepts. The control plane and the Orchestrator do not substitute for QA. QA reviews and reports; it never repairs, pushes code, merges, or makes product decisions.
- Every QA verdict names the exact PR head SHA verified.
- Substantive work requires independent immutable-head QA. Mechanical refreshes use preservation QA; process/docs work uses light relevant checks and its explicit exemption route, which carries complete evidence to control-plane acceptance without a QA claim. An unchanged exact-head PASS does not expire merely with time. See [QA classes](docs/process/qa-execution.md#verification-classes-and-evidence-validity).
- Read-only investigation and bounded operational diagnosis may be delegated to Investigator/Ops workers. They do not silently become implementation. Authorized read-only investigation includes assigned-issue evidence publication; if a worker cannot publish with its assigned credential, the Orchestrator/Recorder publishes the exact ready result.

### Mandatory QA floor

These classes **require** full adversarial independent QA at the strongest reasonably capable model, in a visible dedicated QA session. The Orchestrator **may not** downgrade class, model, or substrate on cost grounds:

1. database migrations and any change to persisted schema or stored data semantics;
2. authorization, authentication, privacy projection, or other security-relevant behaviour;
3. any change to the `dev` integration gate, protected-branch configuration, or CI workflow definitions.

Escalation above the floor is discretionary. Where a task spans a floor class and ordinary work, the floor governs the whole task.

## Task start and required reading

Before non-trivial work:

1. Read this file and its authoritative Forgejo task/QA contract.
2. Confirm the current Forgejo issue, when applicable, has reached `Authorized` through the canonical lifecycle and its body is the complete, current executable contract. Reconcile stale bodies before dispatch; comments cannot silently override them. `Ready` alone is not permission to start.
3. Confirm outcome, scope, ownership, accepted baseline branch/SHA, reserved hotspots, acceptance examples, verification, and Git authority.
4. Fetch and resolve the live `origin/dev` SHA. Stop for contract refresh if it differs from the accepted baseline; do not silently choose a new baseline.
5. Verify canonical provisioning source, origin/common Git directory and requested versus observed exact `HEAD`; use the authorized continuation parent when specified. QA is detached with no branch/upstream. Never infer from `main`, remote HEAD, or defaults. Inspect current task sources/tests, not old branches or chat history.
6. Stop if the task requires an unapproved product/rule decision, an unknown baseline, or uncoordinated hotspot edits.

Beyond this file and the task contract, a worker reads only the additional task-specific documents or sections its dispatch packet explicitly names. Area documents are required only when the task touches that area; decision records, audits, and historical reports are read on demand. `docs/process/development-operating-model.md` is primarily an Orchestrator/control-plane reference and is **not** mandatory startup reading for ordinary workers. Do not create redundant provider-specific copies of general policy.

For an ordinary independent-QA task, the mandatory process set is only this file, `docs/process/qa-execution.md`, the exact QA task contract, and the exact task-specific sources named there.

### Scope precision

- Dispatch packets name the **exact files and paths** the task owns, not only a surface or a document list, and never say `read all architecture docs`.
- For data-heavy content or analysis work, process large data files with a script rather than reading them into context.

Useful references:

- Task contract: `docs/process/task-contract.md`
- Isolated Builder/QA execution: `docs/process/agent-execution.md`
- Compact independent QA execution: `docs/process/qa-execution.md`
- Canonical development operating model: `docs/process/development-operating-model.md`
- Durable authority and baseline policy: `docs/process/control-plane.md` and `docs/process/development-baseline.md`
- Functional ownership/hotspots: `docs/architecture/ownership.md`
- Global user-facing principles: `docs/product/product-presentation-principles.md`
- Regression guidance: `docs/testing-regression-matrix.md`
- Rule and architecture decisions: `docs/decisions/`

## Controlling sources, decision frontier, and development-stage data

Product Owner process ruling, effective **2026-09-24**. It governs how workers use repository documentation and how the project currently treats application data. It **does not** relax any safety, QA, or authority rule — see [What this ruling does not change](#what-this-ruling-does-not-change).

### Controlling sources

- Each implementation issue names a **small controlling source set**: the current product/architecture contracts and explicit decisions that actually govern that slice. Builders implement against that set and the issue contract, and are **not** expected to reconcile the repository's complete documentation history.
- Current approved contracts and explicit decisions **control over** older proposals, superseded descriptions, stale issue wording, historical investigations, and provenance material. Historical material remains useful evidence and provenance; it is **not an independent blocker merely because its wording differs** from a newer controlling decision.
- The Orchestrator may update, mark historical, supersede, or quarantine stale guidance where the current controlling intent is clear. Do not seek semantic consistency with old material at the expense of a newer approved product decision.

### Escalation threshold

Escalate to the control plane when: two **current controlling** sources genuinely conflict; a choice materially changes current V1 product behaviour; security, privacy, or authorization is materially affected; destructive handling of data that actually requires preservation is involved; or a consequential architectural choice is required for the current slice.

Differences with historical or non-controlling material are normally documentation maintenance, not a product-owner decision. The Orchestrator has authority to perform that maintenance, but **not** to reinterpret or override newer approved product intent merely to manufacture semantic coherence with older documentation.

### Decision frontier

Decide only what the currently authorized product actually requires. Future or hypothetical behaviour is deferred unless the current implementation materially depends on it, or the current choice would materially foreclose a reasonably foreseeable near-term requirement.

In particular, present implementation work must not be required to settle hypothetical future semantics such as moving or copying Characters between Campaigns, transferring equipment between future Campaigns, future multi-Campaign Character lifecycle, future player ownership models, or other scenarios for which no current product feature exists.

**Reasonable extensibility is sufficient; hypothetical completeness is not required.**

### Feature preparation leaves one clear contract

Before dispatch: make the issue contract self-contained; name its controlling sources; update or clearly supersede nearby stale guidance likely to mislead a Builder; and leave one obvious current implementation contract for that feature. Do not ask Builders to adjudicate generations of historical documentation.

### Development-stage data policy

Glantri is currently in a **draft/development stage**. Until the product owner explicitly declares otherwise, current application data is development/test data, and preserving existing in-app content is not a product requirement in itself.

Do migration, backward-compatibility, or data-preservation work only where needed to: preserve the ability to continue development; preserve meaningful regression or diagnostic fixtures; avoid masking a real product defect; or satisfy an explicitly approved near-term requirement.

Resetting, rebuilding, or recreating development data is acceptable where materially simpler and safer than preserving draft state. Before destructive or resetting work, preserve a copy only where existing data has genuine testing or diagnostic value. **Do not build generalized migration, compatibility, or zero-downtime preservation machinery merely to retain current development records.**

#### Reversal condition — check before applying the policy above

**This policy changes the moment the product owner explicitly identifies Campaign/play state as durable play data whose results must be retained. From that point onward, preservation and migration become first-class product constraints for that data.**

The draft-stage policy applies only while the draft/development stage is in force, and only to development records. A reader arriving after that declaration, or after Glantri leaves the draft/development stage, must not apply it to durable play data or to production data.

### What this ruling does not change

The development-stage data policy concerns the **disposability of development records**. It is not a safety relaxation, and it weakens none of the following, which remain in force exactly as written:

- **The [mandatory QA floor](#mandatory-qa-floor).** Its first trigger — "database migrations and any change to persisted schema or stored data semantics" — is unchanged. A change can be floor-class **because it changes stored-data semantics**, even when the stored records themselves are disposable. Forgejo issue #306 is the live worked example: projecting the canonical Competency corpus onto the runtime catalogue is floor-class on its stored-data semantics regardless of whether current rows are disposable.
- **The protected playtest database.** `docs/dev-database.md`: "The normal database at `localhost:5432/glantri` is **protected shared user state**." This file: "never use the protected `localhost:5432/glantri` database from a linked worktree." Disposable task databases remain mandatory for all worker database use.
- **Every destructive-action confirmation requirement already in force**, including the named-disposable-target and explicit-confirmation requirements in `docs/process/task-contract.md` and `docs/dev-database.md`: "If current-worktree ownership cannot be proved from the task contract and repository preflight, the command does not run."
- **The production, branch-protection, and credential boundary.** This file: "Never push or merge to `main`, deploy, change production/Azure configuration or secrets, or treat credentials as authority." Branch protection is unchanged.

## Cost-aware execution

- The Orchestrator owns per-task model/effort selection and fresh-versus-resume, within control-plane policy. Workers may recommend escalation but may not independently spawn workers or expand model budget.
- **Do not default to resuming an existing agent.** Resume only when prior reasoning context has material value. Prefer a fresh narrow worker for mechanical fixes, formatting, preservation verification, small documentation amendments, and anything completely describable from durable state.
- Use the least expensive model/effort reasonably capable of satisfying the complete task and verification standard.
- Cost optimization must never weaken acceptance, verification, QA independence, stop conditions, or authority boundaries.
- After a failure or QA handoff, provide a compact repair packet — exact SHA, defects and evidence, authorized repair scope, implicated files, required verification — instead of relying on transcript replay. Where practical, QA identifies all material in-scope defects before returning one repair cycle.
- Prefer the largest coherent vertical capability under one Builder. Prepare settled decisions, scope, acceptance, dependencies, hotspots and verification proportionately. For future work, keep durable conceptual specifications and do the exact-code/baseline preflight near activation. Product lanes needing substantial definition use Preparing for Ready under Design; importance alone does not make a lane Active. See the [operating model](docs/process/development-operating-model.md#capability-sizing-and-preparation).

### Where economy is taken

Builder and reviewer errors are not symmetric: a weaker Builder produces work the reviewer catches, while a weaker reviewer lets defects reach `dev`. Measured execution also shows QA is not the expensive half — independent QA runs have cost materially less than the Builder runs they review.

**Prefer taking model economy on the Builder side and preserving reviewer capability.** Independent QA must not be routed to a cheaper model merely because its work appears checklist-shaped; its value lies in adversarial verification no test plan enumerates.

Preservation QA and other mechanically specifiable verification may use a cheaper model **only when the dispatch packet enumerates the exact proofs required**, so capability comes from the contract rather than being assumed of the model. The mandatory QA floor above still governs.

## Continuation-first execution

- Continue the current authorized task, branch, PR, and worker whenever it can make meaningful progress. Do not create a replacement merely because status delivery is delayed, a worktree path briefly disappears, or a task is slow.
- **Continuation-first governs Git issue, branch, and worktree ownership. It is not a requirement to resume the same conversational or model context.**
- The Orchestrator maintains one durable execution-ledger entry per `issue + role + mode + exact SHA`, including the provisioning request, real task/agent ID, parent task, leased worktree, observed HEAD, liveness, and next action. A replacement is allowed only after the prior owner is confirmed completed, canceled, retired, or lost.
- A provisioned worktree is leased to its request/task until that ownership is durably released. Do not remove, reuse, or recreate it from the outside while the request may still materialize or the task may still be running.
- An authorized Builder has the full bounded authority stated in its contract: implementation, proportionate tests, commit, task-branch push, draft-PR publication/updates, evidence, and automatic batched in-scope repair continuations including repair commits/pushes without routine reapproval. It does not gain merge, product-decision, `main`, release, or production authority.
- If a worker needs login, OS/browser permission, credential interaction, or another human action, record it and surface `USER ACTION REQUIRED` promptly. Safari launch, authorized testing-process control, and ordinary local/development Glantri browser checks have [standing authorization](docs/process/control-plane.md#standing-safari-and-development-browser-authority); actual human-only OS/login/security prompts still require immediate `USER ACTION REQUIRED` and are never bypassed, nor do they imply external/production access.
- Integration may proceed automatically only when the task contract explicitly pre-authorizes it and the exact-head QA, scope, dependency, topology, and protected-check conditions all pass. Then integrate promptly without another approval stamp. Otherwise stop at the stated gate.
- Permit one initial attempt plus at most two automatic recovery/replacement attempts (three total); stop earlier after two substantially identical consecutive failures without a changed causal condition. Normally allow at most two Builder–QA repair cycles after initial QA; the same root cause twice or exhausted allowance requires **STOP — REPEATED EXECUTION FAILURE — CONTROL-PLANE CONFIRMATION REQUIRED**. Counters do not reset on handoff. Publish exact attempts/IDs/SHAs/failures, changed conditions and recommendation; no further attempt without confirmation. Follow `docs/process/agent-execution.md`.
- Validate returns against the ledger key; quarantine routing mismatches. Reconcile delayed duplicates to one retained owner and terminally retire the others before releasing leases. Unknown child existence blocks replacement.
- The coordinator never overrides QA FAIL: scoped defects go to the existing Builder, unrelated CI/environment failures to bounded Ops repair, and product, rule, UX, consequential architecture or permission decisions to the control plane.

## Freshness, checks, and integration readiness

- Before QA or control-plane acceptance, establish actual protected-branch freshness and merge-base state. **Do not infer freshness from `mergeable=true` or the PR `base_sha`** — the former means only "no conflicts", and the latter reports the base branch head, not the merge base. See [PR freshness, merge base, and pre-integration recheck](docs/process/development-baseline.md#pr-freshness-merge-base-and-pre-integration-recheck).
- Refresh outdated PRs mechanically before QA where practical. A head-changing refresh after runtime QA requires an exact-head QA verdict on the new head; preservation QA may be proportionate for mechanically proven deltas.
- **Do not move work to Ready for Control-plane Acceptance while required CI or protected contexts are still pending.** Required CI must have settled.
- Immediately before integration, recheck exact head, target branch, freshness, required checks, and mergeability.
- The path-aware dev gate is integrated through #163/PR #164. Its aggregate controls integration through the existing protected compatibility guards; no bypass or fabricated success. See `docs/process/development-baseline.md`.
- Run QA and hosted checks in parallel unless a concrete dependency or measured resource constraint prevents it.

## Rule and architecture discipline

- Cite source documents, pages, sheets, cells, ranges, formulas, or approved rule decisions precisely.
- Do not silently resolve source conflicts or invent Glantri rules. Record material rulings under `docs/decisions/` and protect them with focused examples/tests. This governs Glantri rule and source evidence; stale or superseded documentation wording is governed by [controlling sources](#controlling-sources) and is normally documentation maintenance.
- Keep raw import, enrichment, normalization, derivation, and verification separate.
- Current combat convention: `effectiveSkillNumber` is total skill XP, including direct and group-derived contributions.
- Apps may import packages; packages never import apps. `packages/domain` is the bottom layer, and `packages/rules-engine` imports only from domain.
- Database repositories are internal; callers use services. Game calculations belong in rules-engine. `@glantri/test-scenarios` is test/e2e only.
- Preserve canonical helpers/services and avoid duplicate calculation paths, unrelated refactors, or placeholders for unimplemented features.

### Codebase orientation

- `apps/web`: Next.js UI; route files stay thin and feature logic belongs under `apps/web/src/features/`.
- `apps/api`: Fastify routes and server orchestration.
- `packages/domain`: independent schemas/state/contracts.
- `packages/rules-engine`: deterministic calculations; imports only from domain.
- `packages/database`: internal repositories and outward-facing services.
- `packages/content` and `packages/importers`: curated content and source ingestion.

Large web features normally separate `components/`, `hooks/`, `state/`, `view-models/`, tests, and a responsibility README; roughly 500 lines is a review signal, not a mandatory split. Apply `docs/product/product-presentation-principles.md` when the task changes user-visible behavior.

## Git, provenance, tools, and verification

- Use one clean, short-lived task branch/worktree from the exact accepted `dev` SHA. Do not continue feature work on accepted or long-lived branches.
- Coordinate reserved hotspots and cross-area merge order through the task contract.
- Builder commits use an approved Builder Git identity rather than silently inheriting the product owner's personal identity; mechanical Orchestrator refresh commits use an Orchestrator identity where practical.
- **Required identity mechanism:** linked worktrees share `.git/config`, so a naive identity change alters the canonical checkout. `extensions.worktreeConfig` is enabled in this repository, so set identity worktree-scoped at provisioning (`git -C <worktree> config --worktree user.name/user.email`) or pass it per commit (`git -c user.name=... commit`). **Never set `user.name`/`user.email` at global or repository scope, and never modify the canonical checkout's identity.**
- Service authentication remains governed by the `glantri-builder`, `glantri-orchestrator`, and `glantri-qa` identities and by branch protections. Do not expose or alter credentials. See `docs/process/forgejo-agent-credentials.md`.
- The narrow `remote.origin.fetch` (`dev` only) is an operational constraint and is not to be silently broadened. Builder/QA packets supply explicit task-ref/head fetch information.
- Actual execution substrate must be stated accurately. **A background subagent must not be described as a separate visible session.** Retain the agent/session ID in durable execution evidence.
- If the QA agent can post as `glantri-qa`, prefer that. If the Orchestrator must relay, post under `glantri-orchestrator` and identify it explicitly as a relay from independent QA subagent `<id>`. **Do not impersonate QA provenance.**
- Existing repository tools, Docker/local database tooling, and declared dependency installation are allowed. New software, global tools, services, permissions, or external transmission require explicit approval.
- A linked Builder/QA worktree that can reach PostgreSQL must own an explicit disposable task target; worktree filesystem isolation is not database isolation. Follow `docs/dev-database.md`, never copy the primary checkout `.env`, and never use the protected `localhost:5432/glantri` database from a linked worktree.
- Run verification proportional to the change class and affected layers: light relevant checks for process/docs, preservation evidence for mechanical refreshes, and applicable typecheck, lint, tests, build, database or browser proof for substantive implementation.
- Changed-file formatting verification in a narrow-fetch worktree must be supplied an explicit correct base SHA, including `FORMAT_BASE_SHA` where that gate requires it. **Lint and typecheck are not substitutes for formatting verification.**
- Inspect Git status after generation/build/test steps. Do not silently commit generated output.

At handoff report outcome, files, decisions, exact baseline/head, verification, Git/PR state, remaining risks, and follow-ups.
