# Glantri Product & Presentation Principles

**Status:** Approved; normative Glantri-wide guidance
**Scope:** Glantri-wide product behavior and user-facing presentation
**Audience:** Product owners, implementation agents, reviewers, and QA agents
**Not a visual design system:** This document defines product-quality outcomes and review heuristics. It does not prescribe a component library, visual style, complete screen layouts, or fixed designs for functional areas that have not yet been built.

**Related contracts:** [Combat Presentation Guidelines](../architecture/combat-presentation-guidelines.md), [Combat UX Principles](../architecture/combat-ux-principles.md), [Combat Panel Contract](./combat-panel-contract.md), [Chargen and Competency Experience](./chargen-competency-experience-contract.md), [Chargen and Combat Manager Interaction Preservation](./ui-interaction-preservation.md), and [Implementation Task Contract](../process/task-contract.md)

## 1. Purpose

Glantri may be technically correct and still be wrong as a product. A calculation can be accurate while its result appears in the wrong place. A command can succeed while the accepted result disappears as progression advances. A server can enforce access while the UI discloses another player's private calculation. A feature can expose every stored field while speaking only in architecture vocabulary.

These principles give implementation and QA enough authority to identify such defects even when no automated test, screenshot, or area-specific specification covers the exact case.

The goals are to make Glantri:

- understandable in game-world terms;
- trustworthy across current, pending, resolved, and historical state;
- safe across GM and player perspectives;
- explicit about consequential choices and important mechanical outcomes;
- efficient during play;
- consistent without requiring a complete up-front design system.

## 2. Specification hierarchy

Glantri product behavior is governed by four related levels. Lower levels add
specificity but do not override higher-authority facts or permissions.

### 2.1 Rules, canonical state, authorization, and privacy

Approved rules and canonical domain state determine which facts exist.
Authorization, knowledge, and privacy policy determine who may act on or receive
those facts. Product and presentation guidance cannot create a fact, permission,
or disclosure that these authorities do not support.

### 2.2 Global principles

This document applies across Glantri. It defines stable expectations such as natural terminology, continuity, privacy, calculation transparency, causal order, and a single visible source of truth.

### 2.3 Area-specific presentation contracts

An area contract defines the operational grammar of an implemented functional area. It may define panel responsibilities, state transitions, role-specific views, relevant calculations, history behavior, and canonical terminology.

Examples include the existing Combat presentation guidelines and Combat panel contract. Combat's six-panel workspace, tracker markers, and action/result grammar are Combat-specific; the underlying requirements for continuity, privacy, understandable calculations, and one source of visible truth are global.

### 2.4 Task-specific acceptance criteria

An implementation task translates the global principles and any applicable area contract into concrete, testable examples for the slice being changed. It states which perspectives, states, calculations, and failure paths must be verified.

A task contract must not silently weaken a global principle. A deliberate exception requires an explicit product decision and, when durable, an update to the relevant product or area contract.

## 3. Interpretation and authority

- Rules and canonical domain state determine what facts exist; authorization, knowledge, and privacy determine who may receive them. Presentation never creates authority or reveals a fact merely because it would be convenient to show.
- Approved product and rule decisions take precedence over current implementation and characterization tests. Tests prove behavior; they do not by themselves prove that the behavior is desirable.
- Area-specific contracts may add stricter or more detailed requirements. They may vary the presentation only for a genuine difference in product meaning, workflow, or authorized perspective—not for implementation convenience.
- Where the correct behavior is ambiguous and materially consequential, record `Needs decision`. Do not turn a preference into an invented product rule.
- Where a clear principle is violated, implementation and QA may raise a `product-quality finding` or `presentation finding` even if no existing test fails.

## 4. Global principles

### 4.1 Present the game world and the decision

The UI presents characters, items, actions, effects, places, rolls, consequences, and choices. It should answer what is true, what happened, what the viewer can do, and what needs attention.

Do not make users translate storage models, APIs, state machines, projections, or command infrastructure into game meaning. Administrative and diagnostic tools may expose technical facts only when that is their explicit purpose and they remain clearly separated from ordinary play.

### 4.2 Keep implementation vocabulary out of ordinary UI

Ordinary user-facing presentation must not normally show:

- internal IDs, database keys, revision tokens, timestamps used only for concurrency, or raw source references;
- command, task, descriptor, signature, projection, envelope, read-model, snapshot, or cursor terminology when those words describe implementation rather than play;
- raw diagnostics, stack traces, validation objects, server/domain exceptions, HTTP status language, or serialized payloads;
- architecture or migration vocabulary;
- debug-only state labels or fallback-source names.

Technical identifiers may appear in a bounded support or diagnostic view when they are needed to investigate a problem. They should not replace the user-relevant explanation and must not disclose protected data.

### 4.3 Put information at the decision or outcome it serves

Show a fact where the viewer needs it to choose, act, or understand the result.

- Information needed for the current choice belongs with that choice.
- A committed outcome belongs in the result or state presentation that proves what happened.
- A log may provide chronology and provenance, but users must not have to infer an important current outcome by reading raw log entries.
- Reference information should stay close enough to the affected value or choice to be usable without repetitive navigation.
- A fact should not be copied into unrelated panels merely to make each panel self-contained.

### 4.4 Preserve continuity and distinguish state over time

Accepted actions and results remain understandable and available when progression advances. Moving to the next task must not erase the result the user just accepted or rolled before it can be perceived.

Presentation must distinguish, where relevant:

- **current state:** authoritative facts now in effect;
- **pending or provisional state:** entered, proposed, or waiting facts not yet final;
- **resolved state:** accepted outcomes and consequences;
- **historical state:** immutable facts from an earlier step, round, version, or event.

Current and historical facts must not be silently mixed. A stale response must not replace newer current state. Historical presentation must not be recalculated from current character, item, modifier, rule, or template data. Canonical undo or an explicit superseding action may remove or replace a result; ordinary progression may not.

### 4.5 Respect perspective, knowledge, ownership, privacy, and visibility

Every user-facing fact has an intended audience. Presentation must reflect the viewer's role, controlled character, involvement, current knowledge, ownership, and visibility grants.

- The GM may see more than a player where the product and rules permit it.
- A player must not receive another player's private choices, hidden facts, rolls, modifiers, notes, or calculations merely because both participate in the same campaign or encounter.
- An involved player may receive a safe outcome without receiving the other participant's private inputs.
- An uninvolved player must not receive participant-specific private detail.
- Redaction must preserve safe workflow truth when needed. Hiding a private die must not make a completed process look pending.
- Client-side hiding is not an adequate privacy boundary. Protected facts should be excluded or sanitized before reaching an unauthorized client.
- Ambiguous visibility fails closed: show less and give a safe, useful status rather than guessing.

### 4.6 Show important rolls and calculation context to entitled users

When a roll or calculation materially determines an outcome, entitled users should be able to understand how the result was obtained.

As applicable, show:

- the named stat, skill, weapon, item, or other contributing game concept;
- relevant modifiers with understandable labels, values, scope, and provenance;
- the die or dice, including meaningful open-ended or special-roll facts;
- intermediate totals needed to follow the arithmetic;
- the final total or lookup value;
- the resulting game consequence in the result presentation.

Use consistent Glantri calculation terminology. Snapshot accepted calculations so later state changes do not rewrite them. Explain enough mechanics to establish trust and support play, but do not expose signatures, raw payloads, resolver traces, or other plumbing.

Privacy still governs calculation disclosure. A player may see their own calculation and a safe opposed outcome without receiving an opponent's hidden total or modifier list.

### 4.7 Give the GM efficient control without creating a different game language

GM surfaces may add proxy actions, review, override, bulk or automated operations, visibility management, and adjudication. These controls should be efficient and clearly state whose state or roll they affect.

Where useful, GM and player surfaces should share the same game-world concepts, ordering, result grammar, and state meanings. Role-specific authority may differ; the underlying event should not acquire contradictory names or meanings.

Operational workflow feedback for the GM must remain distinct from game-world results. For example, an automation summary may say what routine work it processed or where it stopped, but it must not become a character result or public game log entry unless the underlying game event is itself public.

### 4.8 Automate safe repetition and keep consequential choices explicit

The app should infer or automate repetitive operations when the result is deterministic, reversible where appropriate, and does not make a tactical, narrative, privacy, or resource-allocation decision for the user.

- Do not require acknowledgement clicks merely to let progression continue after an accepted result is already recorded.
- Do not make users repeat equivalent safe actions that can be resolved from canonical state.
- Automation should stop before ambiguity, changed circumstances, a consequential choice, or work owned by another user.
- Consequential choices must remain explicit, attributable, and reviewable before commit.
- A primary action should say what it will do and, where needed, who it affects.

### 4.9 Make errors user-relevant and recoverable

Errors should explain:

1. what the user-relevant problem is;
2. what was or was not changed;
3. what the user can do next.

Prefer messages such as `This item is no longer available. Refresh the inventory and choose another item.` over raw exceptions such as `holder reference invalid` or `projection revision mismatch`.

Do not claim success when canonical state was not accepted. Preserve entered work where safely possible. If retry could duplicate a consequential action, refresh and ask the user to review rather than replaying automatically. Technical details may be available separately for support without replacing the recovery message.

### 4.10 Match game sequence, causality, and time

Presentation order should reflect how the game event unfolded.

- Show cause before consequence and prerequisite before dependent outcome.
- Preserve the canonical order of actions, responses, rolls, comparisons, and applied effects.
- Group subordinate facts with the action they belong to.
- Later results append without moving, renumbering, or duplicating earlier accepted results.
- Current workflow order and visible tracker/order must agree unless an explicit Glantri rule explains the difference.
- Do not present internal housekeeping, empty-work closure, or transport events as though they were game-world actions.

### 4.11 Maintain one visible source of truth

Do not present duplicate or contradictory controls, values, results, or state summaries.

- One product concept should have one canonical visible meaning in a given context.
- Live values, visible modifiers, and accepted calculations should reconcile.
- Current state and historical snapshots should be clearly distinguished rather than blended.
- A transient confirmation may help a result be noticed, but it must not become a second permanent result authority.
- Compatibility data and legacy sources must not silently compete with the current authority.
- If sources disagree, fail safely and surface a user-relevant conflict or route it for product/technical resolution.

### 4.12 Use natural Glantri and RPG terminology consistently

Prefer concise, familiar game language over software language. Use the same term for the same concept across GM, player, current, and historical views unless a real perspective difference requires otherwise.

Labels should state facts and actions directly: `Equipped`, `On person`, `Roll attack`, `OB +1`, `Waiting for the GM`, or `History`. Avoid labels whose meaning depends on knowledge of database or domain type names.

When Glantri uses a term in a precise mechanical sense, preserve that meaning. Do not casually collapse distinct concepts such as template characteristic, item-specific variation, applied modifier, and final calculated value.

### 4.13 Grow area contracts from real workflows

New functional areas do not need a comprehensive screen design before implementation. They do need a bounded presentation contract for each coherent workflow that is built.

For each implemented slice, define enough to answer:

- who uses it and from which perspectives;
- what decision or state the surface serves;
- what is current, pending, resolved, and historical;
- which information is visible to whom;
- where important inputs and outcomes appear;
- which terminology is user-facing;
- which mechanics are active, descriptive only, unsupported, or future work;
- what evidence proves the workflow is understandable and safe.

Extend the area contract as workflows become real. Do not invent every future screen, expose non-functional placeholders, or lock exploratory areas to arbitrary layouts before the product has learned enough.

### 4.14 Meet accessibility, readability, and responsive basics

Product-quality acceptance should include basic usability across supported devices and input methods without turning this document into a visual specification.

- Use meaningful headings, labels, control names, and semantic relationships.
- Keep text readable and important state distinguishable without relying on color alone.
- Preserve keyboard access, visible focus, and logical focus/order for interactive workflows.
- Associate errors and instructions with the relevant control.
- Avoid clipping, overlap, inaccessible hover-only facts, and controls that become unusable at supported viewport sizes.
- Prefer reflow and progressive disclosure over hiding required information.
- Keep loading, empty, disabled, and error states understandable.
- Use accessible names for dice, icons, status markers, images, and future item illustrations where they carry meaning.

Exact styling, tokens, breakpoints, animation, and component appearance belong in separate UI conventions or a future design system.

## 5. Area-specific presentation contracts

An area contract should remain no larger than the implemented workflows require. Where relevant, it should define:

1. **Purpose and boundaries:** what the area helps users do and which neighboring area owns related work.
2. **Roles and perspectives:** GM, controlling player, involved other player, uninvolved player, and administrative/support roles.
3. **Workflow and state:** current decisions, pending work, committed outcomes, history, undo/supersession, reload, and stale-state behavior.
4. **Information placement:** which surface owns choices, current state, results, reference facts, and history.
5. **Visibility:** what each perspective may receive, what must be redacted, and which safe status remains after redaction.
6. **Mechanics and calculations:** which rolls and calculations must be shown, their terminology, and whether accepted values are snapshots.
7. **Terminology and copy:** canonical Glantri names, action labels, state labels, empty states, and recovery messages.
8. **Ordering and grouping:** causal sequence, result grouping, and how later state relates to earlier outcomes.
9. **Accessibility and responsive behavior:** only the relevant basics and supported contexts.
10. **Conformance evidence:** representative scenarios, perspective comparisons, and known deviations.

An area contract is a product contract, not a restatement of TypeScript types or database schemas.

## 6. Items-lane seed example

This section illustrates how the principles apply before a complete Items design exists. It is not a complete Items presentation contract and does not choose a final screen layout.

### 6.1 Player-facing concept

The UI should present a particular possession in game terms, for example:

```text
Alaric's Long sword
Long sword
Equipped · Primary weapon
On person
OB +1
```

The UI should not ordinarily present:

```text
CampaignItemInstance
combat_ob_delta
projection version 2
holder reference
item instance id
```

Internal fields may preserve exact identity and provenance without becoming the visible vocabulary.

### 6.2 Template and individual variation

A template describes the normal item type. A concrete item may vary from that template in any characteristic the approved item model supports. Variation may be better, worse, neutral in overall power, conditional, or simply different.

A concrete item's supported differences may include:

- typed overrides of existing template characteristics, such as initiative, parry, or an OB input;
- additional active mechanics that contribute at a different calculation stage, such as `+1 final OB`;
- descriptive traits such as an engraving, maker, appearance, or history; and
- known but unsupported mechanics, such as a spell capability recorded by the app but not yet calculated or enforced.

These are distinct meanings, not interchangeable property bags. The task and area contracts must name the type, unit, scope, calculation stage, visibility, and support state that apply. Ordinary UI must not expose internal property keys or projection terminology.

Where the viewer is entitled to know, the UI should make the meaningful difference understandable. It should distinguish, for example:

- the actual value for this item;
- the ordinary template value or a concise `Differs from standard Long sword` comparison when useful;
- the resulting active gameplay contribution, such as `OB +1`, when that is the approved mechanical meaning;
- the affected attack mode, situation, or limitation when the variation is not universal.

The acceptance contract must define whether a displayed change overrides a template characteristic, contributes at a later calculation stage, or changes the final result. The UI uses natural labels; it does not expose the internal property key used to implement that meaning.

### 6.3 Unique does not mean magical or strictly better

Glantri contains few unmistakably magical items and many exceptional, inferior, unusual, traded-off, historical, crafted, storied, or subtly enhanced items. A unique item is not assumed to be magical or strictly better and must not be forced into a simple magical/non-magical or bonus-only model.

Presentation should support items that:

- differ from template norms in more than one direction;
- exchange one advantage for a limitation;
- are remarkable because of provenance, craftsmanship, appearance, or use;
- have qualities whose gameplay meaning is not yet implemented;
- later gain an image without requiring the item's identity or mechanics to be recreated.

### 6.4 Description and mechanical support state

An item may have a unique name, description, engraving, maker's mark, unusual trait, spell capability, history, notes, and future image even when some of those facts have no implemented gameplay effect.

The UI must distinguish:

- **active mechanics:** calculated or enforced by the app;
- **descriptive traits:** meaningful fiction with no automatic calculation;
- **known but unsupported mechanics:** a stated capability the app records but does not yet calculate or enforce.

Do not imply that descriptive text changes a calculation. Do not silently discard unsupported traits. Do not render an unsupported capability as an active bonus. When needed, use concise wording such as `Descriptive trait` or `Not calculated by the app`; final terminology belongs in the incremental Items presentation contract.

### 6.5 Possession, location, and visibility

Possession, ownership, control, storage, and visibility may be different concepts even if the current implementation historically conflates them. Player-facing copy should describe the relevant game fact—such as `Held by Alaric`, `On person`, `In backpack`, or `Equipped`—without exposing the underlying holder or storage reference.

Transfer must preserve the identity and history of the same item. After transfer, the visible holder/location/loadout state changes; the unique description and approved mechanics do not become a newly created item.

Item facts may be individually revealable. The default policy is:

- unrevealed instance-specific properties and traits are GM-only and fail closed;
- possession does not automatically reveal every instance-specific property;
- a known or revealed instance-specific property may be shown to the controlling player;
- ordinary, template-normal characteristics are not hidden merely because no identification workflow has occurred; reveal state primarily applies to instance-specific facts; and
- `Partially revealed` is a future capability and must not be implemented unless a concrete workflow requires and defines it.

The visibility boundary must be enforced before protected facts reach an unauthorized client. Presentation may show a safe status when appropriate, but must not imply or disclose the hidden fact.

## 7. QA review dimensions

QA reviews user-visible work across four distinct dimensions. A task may pass one dimension and fail another.

### 7.1 Functional correctness

Does the workflow complete the intended operation and preserve canonical state? Examples: a transfer changes possession once, an accepted roll advances the correct process, reload retains the result, and undo affects the intended action.

Mechanical/rules verification is a specialized part of functional correctness and should be separately stated in the task contract whenever game calculations or rule outcomes are affected.

### 7.2 Presentation contract

Does the UI present the right fact, in the right place, with the right state, wording, ordering, grouping, and continuity under the global principles and applicable area contract?

### 7.3 Information-flow and privacy

Does each perspective receive only the facts it may know while retaining enough safe status to understand the workflow? Check both rendered UI and, where relevant, API/read-model payloads so client hiding is not mistaken for sanitization.

### 7.4 Product-quality heuristics

Is the result clearly usable and desirable even where no existing contract predicts the exact issue? This includes unnecessary clicks, confusing primary actions, stale current-state presentation, duplicate truth, incomprehensible errors, hidden outcomes, poor responsive behavior, and other clear violations of this document.

## 8. QA findings and triage

QA may report a finding when evidence shows a clear principle violation even if:

- no automated test fails;
- the implementation matches an old characterization test;
- no screen mockup covers the case;
- the exact behavior is absent from the task's original acceptance examples.

Use the following issue-body classifications. They are not new GitHub labels; adding labels requires a separate control-plane decision.

- **Defect / bug or UX issue:** a clear violation with a concrete harmful outcome. Classify it as a `presentation finding` when primarily about placement, wording, grouping, state, ordering, or continuity. Classify it as a `product-quality finding` when it concerns the wider usability or workflow heuristic. Privacy and data exposure follow the project's security/defect escalation rules in addition to these classifications.
- **Needs decision:** evidence shows a material ambiguity or competing reasonable product choices. State the alternatives, affected users, and proposed default; do not file a preference as a defect.
- **P3 polish:** a clear, low-impact improvement that does not materially obscure a decision, result, privacy boundary, or source of truth. Priority is separate from defect severity.
- **No finding:** a personal aesthetic preference, hypothetical future concern, or desired redesign with no principle, contract, task outcome, or observed user harm behind it.

A clear principle violation is not downgraded to polish merely because the code is technically correct or tests pass.

## 9. Perspective-sensitive QA

For multiplayer or knowledge-sensitive workflows, compare these views where relevant:

| Perspective       | Minimum questions                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GM                | Can the GM see and perform authorized review/proxy work without leaking operational or secret data into player-visible results?         |
| Actor / Player A  | Can the acting player see their choice, roll, calculation, accepted outcome, and current state without another player's private inputs? |
| Target / Player B | Can the target understand the visible consequence and their own required response without receiving Player A's protected detail?        |
| Uninvolved player | Is participant-specific private information absent while public campaign/encounter facts remain understandable?                         |

Add owner versus non-owner, hidden versus revealed, or controller versus observer rows when the area requires them.

The comparison should cover the relevant sequence, not only a final screenshot: before input, pending/submitted, accepted result, progression advance, reload/reconnect, history, undo/supersession, and stale response where risk warrants it.

## 10. QA environment and evidence

Use deterministic synthetic/test data and Playwright or the equivalent automated browser harness by default. This makes perspective comparison reproducible and avoids relying on personal accounts or accidental session state.

Escalate to an isolated development browser session only when actual browser behavior, authentication/session transitions, focus, responsive layout, browser APIs, or another state that the synthetic harness cannot represent must be observed. Use dedicated development/test identities and isolated storage.

A signed-in personal browser profile is never the default QA requirement. Access to personal accounts, cloud services, or broader computer control requires a concrete task reason and the separate approval required by the control plane.

Evidence should be proportional to risk and may include:

- focused unit, component, projection, API, or contract tests;
- a deterministic Playwright scenario;
- screenshots for representative perspectives and states;
- a concise manual script with expected visible results;
- payload/sanitization evidence for privacy-sensitive work;
- reload, history, stale-state, undo, keyboard, and responsive checks where relevant.

Passing automated checks does not close an observed product-quality or presentation finding. The finding closes when the unwanted behavior is corrected, explicitly accepted as a product decision, or deliberately deferred with recorded priority and risk.

## 11. Maintenance and adoption

- Keep existing Combat documents as the more specific Combat contracts.
- Record conflicts between older area guidance and this normative guidance rather than silently reconciling them in code.
- Require task contracts to state product, presentation, privacy, perspective, and product-quality acceptance where applicable.
- Grow Items and other area contracts only as coherent workflows are implemented.
- Update this document only through an explicit product decision when a change would alter its normative meaning.
