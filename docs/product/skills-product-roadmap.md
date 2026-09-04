# Skills product-area roadmap

Status: accepted product sequencing and portfolio boundary on 2026-09-04.

Observed against local Forgejo `dev@2ae4ceb65dc1bbc25275bde8ca54832d31a3dcc3`.
Live Forgejo issues remain operational truth for current status, ownership,
authorization, exact baselines, QA, and integration. This roadmap does not
authorize implementation.

## Product outcome

Glantri will first prove one complete, production-quality Skill content and
documentation model with the bounded Pilot set. The product owner must be able
to inspect every candidate record through a read-only Admin Skill Reference
before approving an immutable release. The accepted structure is then scaled to
the full usable catalogue before it replaces legacy Skill truth in the preserved
Chargen and Character experience.

The Pilot set is a development/calibration set. It is not the eventual game-pilot
catalogue, and manual construction of long-lived test Characters against it is
not a milestone requirement.

Normative content and integrity authority:
[Rule decision 0003](../decisions/rules/0003-skill-documentation-and-release-integrity.md).

## Delivery sequence

1. **Pilot documentation model** — settle the canonical record, release
   integrity, compatibility, provenance, and read-only review contract.
2. **Pilot Admin review surface** — implement a read-only Skill Reference that
   renders candidate and canonical versioned content while retaining a clearly
   labelled Legacy Catalogue compatibility surface.
3. **Pilot authorship** — give every bounded Pilot Skill, language, written
   tradition, and Specialization complete structured scope and
   production-quality concise and full documentation.
4. **Pilot acceptance gate** — review the candidate through Admin, resolve
   contradictions, and explicitly approve/freeze a new immutable release.
5. **Full catalogue rollout and review** — map useful legacy evidence, author and
   calibrate the complete usable catalogue, then review it as a whole.
6. **Preserved Chargen/Character integration** — only after the full catalogue is
   ready, extend the existing mature Chargen and Character flows to consume it
   and resume long-lived test-Character creation.

## Operational portfolio

| Order | Forgejo case                                                      | Purpose                                                      | Current authority                                                             |
| ----: | ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
|     1 | [#22](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/22) | Canonical Skill documentation and release-integrity contract | Authorized for design/documentation only; inactive; no Builder/QA dispatched  |
|     2 | [#23](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/23) | Extend versioned content schema and validators               | Ready, dependency-gated on Case 1; not authorized                             |
|     3 | [#24](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/24) | Read-only Admin Skill Reference                              | Ready, dependency-gated on Case 2; not authorized                             |
|     4 | [#25](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25) | Fully author documentation-complete Pilot content            | Ready, dependency-gated on Case 2; not authorized                             |
|     5 | [#26](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/26) | Product review and immutable Pilot release acceptance        | Design/review gate, dependency-gated on Cases 2-4; not authorized             |
|     6 | [#27](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/27) | Map legacy catalogue into the new authoring model            | Ready/inactive after Case 1 stabilizes; investigation only and not authorized |

Case 2 is the common model dependency for Admin and content authorship. Cases 3
and 4 may later proceed in coordinated order or in parallel only under explicit
authorization and clean hotspots. Case 5 requires both. Case 6 may investigate
legacy mapping after Case 1 is stable, but it cannot populate or activate
content.

```text
Case 1: documentation/release contract
  ├─> Case 2: schema and validators
  │     ├─> Case 3: Admin Skill Reference ─┐
  │     └─> Case 4: Pilot authorship ──────┼─> Case 5: Pilot review/freeze
  └─> Case 6: legacy mapping plan          └─> later full catalogue work

Case 5 accepted release -> full catalogue population/review
                         -> preserved Chargen/Character integration
```

## Preserved authority and boundaries

- [Qualitative Skill Catalogue architecture](../decisions/rules/0002-skill-catalogue-qualitative-architecture.md)
  controls the 19-domain organization, navigation-only taxonomy, competency
  identities, DS/AB interpretation, languages, directional relationships, and
  learning histories.
- [Pilot Skill Rules v1](../rules/pilot-skill-rules-v1.md) controls bounded
  weights, costs, group contributions, relationship arithmetic, Specialization
  acquisition, and the intentionally non-recursive Pilot behavior.
- [Pilot Skill Content Release v1](../rules/pilot-skill-content-release-v1.md)
  records the immutable accepted `pilot-skills-content/1.0.1` release.
- [Retained Character ledger](../rules/retained-character-ledger.md) preserves
  acquisition history and pins rules/content/configuration versions; new
  releases do not silently rewrite Characters.
- [Chargen and Combat Manager preservation](./ui-interaction-preservation.md)
  makes the existing Chargen the presumptive player-product baseline. This does
  not require preserving the legacy Admin catalogue when it obstructs the new
  read-only reference model.

No case in this roadmap authorizes Pilot arithmetic changes, mutable Admin
editing, a documentation database, full-catalogue activation, Chargen/runtime
activation, Character migration, `main`, Azure, production, deployment, or
release work.

## Pilot Skill Content Complete gate

The formal wording and complete record checklist are in
[Rule decision 0003](../decisions/rules/0003-skill-documentation-and-release-integrity.md#pilot-skill-content-complete-gate).
The gate cannot pass from validator tests alone: candidate content must also be
coherently searchable and readable through Admin, contain no placeholder prose,
and receive explicit product-owner acceptance before becoming immutable
canonical content.

## Agent guidance

- Read the live case and exact `dev` before proposing or starting work.
- `status/Ready`, a dependency graph, or placement on this roadmap is not
  authorization.
- Do not use the bounded Pilot set as the catalogue for a game-pilot milestone.
- Do not create a second source of truth between canonical content, Admin, and
  future player consumers.
- Treat the legacy catalogue as evidence and temporary compatibility authority,
  not as the future Skill model.
