# C1 five-key post-#393 freeze and staging record

- Recovery case: Forgejo #51
- Accepted recovery baseline: `dev@87af54c054b99d29f6d8b13d7b84faedfec6717b`
- Artifact date: 2026-09-06
- Scope: exactly five post-#393 Critical keys
- Runtime status: non-executable evidence only

## Outcome

All five requested payloads were recovered without inference. Their exact structured freeze is
[the non-executable JSON artifact](./2026-09-06-c1-five-key-post-393-payloads.json). The governing
six-kind and GM-adjudication contract is
[decision 0004](../decisions/rules/0004-c1-critical-authoring-and-adjudication.md).

This record changes no executable C1 fixture, generated Critical data, manifest, runtime adapter,
Combat projection, route, schema, database, or shared Combat E2E test.

## Evidence inspected

### Accepted design and case evidence

- Forgejo #2–#6, including integrated #387 runtime evidence, recovered #391/#392 contracts,
  accepted #393 design status, and the #394 Combat-preservation record.
- Historical read-only task `#393 Design — Rewrite 34 C1 Critical fixtures`, task
  `01a04f1a-71ad-78c1-91a4-603918e5dd09`.
- Recovered former GitHub #393 payload comments:
  - Part 1/4, comment `5464670629`;
  - Part 2/4, comment `5464670911`;
  - Part 3/4, comment `5464671257`;
  - Part 4/4, comment `5464671539`; and
  - product-owner partial acceptance, comment `5464920284`, which accepted the non-Fire
    directions and required revision only for Fire/Energy 06/09/10.
- Historical read-only task `#391 Preparation — GM Critical-review implementation contract`, task
  `01a04e9f-16e6-7422-83a3-9e1efc1d97cb`, plus the accepted #388 design evidence it routes to.

The historical tasks and `/Users/vidarhald/dev/glantri-app` were used as read-only recovery evidence.
No branch, commit, reset, cleanup, or file mutation was performed there.

### Repository evidence at the accepted baseline

| Evidence                         | Exact identity                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source workbook                  | `docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx`, SHA-256 `47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f`, Git blob `9c97e1c6eacc6ebb2aac699f731c17303cbe87a5`          |
| Pre-#393 representative fixtures | `packages/rules-engine/src/encounters/representativeCriticalFixtures.ts`, SHA-256 `be4ccff72bc28881331d5e59ea36633c8110633f1274f912bf03b4684f5fa58e`, Git blob `1f56fee92984175ddaa7918463c00952126150e2` |
| Generated Critical table         | `packages/domain/src/encounter/criticalEffectsTableData.ts`, SHA-256 `63bb12c2ae0765acd64c70ba4abcc8ebf5d89a71026f70ca2199dd56de0f1673`, Git blob `c5341a46fe3fa8857ad695df1312533941f7338f`              |
| Generated provenance manifest    | `packages/domain/src/encounter/criticalEffectsTableManifest.json`, SHA-256 `449cb041d94f7d3ba9feb5d1e729fc551e2fdbd47378aa67115be7117b629678`, Git blob `99f848bcd6404c26f80a049223d61103f7c65e24`        |
| Accepted injury recalibration    | [`docs/decisions/rules/0001-c1-critical-injury-recalibration.md`](../decisions/rules/0001-c1-critical-injury-recalibration.md)                                                                            |
| Current Critical/runtime rules   | [`docs/rules/combat-critical-effects.md`](../rules/combat-critical-effects.md)                                                                                                                            |
| Combat placement boundary        | [`docs/product/ui-interaction-preservation.md`](../product/ui-interaction-preservation.md)                                                                                                                |

The workbook ranges below establish original row identity, source fields, and source-effect keys. The
workbook and executable fixture remain pre-#393 and therefore do not override the later accepted
payloads.

## Per-key recovery and comparison

Every confidence rating below is **high**: the original workbook row, current executable fixture,
complete post-#393 payload report, and product-owner acceptance chain are all present. No value was
interpolated from another key or severity band.

### `pointed_weapons|arm|02` — high confidence

- Provenance: Part 3/4 comment `5464671257`; `AppFacing_Crits!A515:X515`;
  `AppFacing_Effects!A1738:AE1742`; effect keys `01`–`05`.
- Accepted payload: minor; **Hand puncture breaks the grip**; floor `3 HP`; Stun `-1` for retained
  `1d4 rounds`; hand `impaired` for retained `1d4 rounds`; immediate `drop_held_item`; external Bleed
  `1/8 HP/round`; First Aid bandage information.
- Pre-#393 fixture: the same mechanics, with title **Hand puncture; grip broken.** and earlier prose.
- Difference: title and narrative only. All numeric fields, targets, duration, operation, Bleed type
  and rate, and treatment classification are retained.

### `blunt|arm|12` — high confidence

- Provenance: Part 2/4 comment `5464670911`; `AppFacing_Crits!A109:X109`;
  `AppFacing_Effects!A340:AE345`; effect keys `01`–`06`.
- Accepted payload: very severe; **Hand crushed beyond use**; floor `5 HP`; Stun `-4` for `1` full
  round; hand `function_unusable` until separately resolved; immediate `drop_held_item`; external
  Bleed `1/2 HP/round`; First Aid pressure/splint and Surgery information; permanent hand deficit and
  recovery remain information only.
- Pre-#393 fixture: title **Hand crushed to ruin.**; floor `5 HP`; Stun `-8`; immediate whole-body
  `collapse`; hand unusable until separately resolved; drop; external Bleed `1/2 HP/round`; the same
  authored treatment stages and deferred permanence/recovery information.
- Difference: Stun changes exactly from `-8` to `-4` and its accepted duration is exactly `1` full
  round; whole-body `collapse` is removed; title/narrative are rewritten. Floor, localized hand loss,
  drop, Bleed, and information remain.

### `pointed_weapons|chest|07` — high confidence

- Provenance: Part 4/4 comment `5464671539`; `AppFacing_Crits!A552:X552`;
  `AppFacing_Effects!A1901:AE1904`; effect keys `01`–`04`.
- Accepted payload: serious; **Punctured lung shortens every breath**; floor `5 HP`; Stun `-4` until
  appropriate care; breathing and general action `impaired` until appropriate care; internal Bleed
  `1/4 HP/round`; generic immediate care names no Skill.
- Pre-#393 fixture: title **Lung nicked.**; floor `5 HP`; the same Stun and impairment boundary; an
  executable fixture rate of internal Bleed `1/2 HP/round` whose copied `sourceRate` text still says
  `1 HP / round`; generic immediate treatment.
- Difference: internal Bleed changes exactly from the executable pre-#393 fixture's rational `1/2`
  to `1/4 HP/round`; title/narrative are rewritten. The workbook's original `1 HP/round` is source
  provenance, not authority to replace the accepted `1/4` rate. All other mechanics remain.

### `sharp|head|10` — high confidence

- Provenance: Part 1/4 comment `5464670629`; `AppFacing_Crits!A27:X27`;
  `AppFacing_Effects!A88:AE89`; effect keys `01`–`02`.
- Accepted payload: very severe; **Severe concussion causes unconsciousness**; floor `3 HP`; no
  numeric Stun; `unconscious` for a retained `1d4 hours` or until GM-managed appropriate care; no
  Bleed or operation; generic care and recovery are information only and name no Skill.
- Pre-#393 fixture: the same mechanics, with title **Severe concussion.** and earlier prose.
- Difference: title and narrative only. The source row is typed as Stun/action, but the accepted and
  current C1 interpretation is a condition with no numeric modifier; prose does not create Stun.

### `sharp|chest|04` — high confidence

- Provenance: Part 1/4 comment `5464670629`; `AppFacing_Crits!A37:X37`;
  `AppFacing_Effects!A114:AE117`; effect keys `01`–`04`; expressly retained by product-owner comment
  `5464920284` as one of exactly two narrow chest-index-04 `parry_only` cases.
- Accepted payload: moderate; **Pectoral slash disables attacks**; floor `2 HP`; no numeric Stun;
  stance `impaired` for retained `1d4 rounds`; `parry_only` for retained `1d4 rounds`; immediate
  `drop_held_item`; no Bleed; generic treatment information names no Skill.
- Pre-#393 fixture: the same mechanics, with title **Chest slash; shield parries only.** and earlier
  prose.
- Difference: title and narrative only. No numeric Stun is manufactured from the source row's
  Stun/action classification.

## Exactness and schema notes

- The freeze contains exactly the five named keys and no substitute fixture.
- All numerical fields come from an accepted per-key payload or retained exact source evidence.
- Each active consequence uses one of six kinds: `damage_floor`, `modifier`, `periodic_loss`,
  `condition`, `operation`, or `information`.
- Narrative is stored separately and cannot activate mechanics.
- Conditions and operations are distinct, and active atoms use structured targets.
- Ordinary Bleed records exact rational rates, a three-second round, first following-round SU tick,
  and its external or internal lifecycle.
- Treatment, permanence, and recovery text is explicitly non-mechanical unless the accepted payload
  names an already-supported Skill stage.

## Future-task staging

### Forgejo #3 / recovered #391

The refreshed contract is a future five-key implementation task. It may consume only the five keys
in this freeze, through the existing Current Action -> Results -> Combat Log/history path. It remains
Ready, inactive, unassigned, and not authorized. Its execution baseline must be refreshed to the
exact post-#51 integrated `dev` SHA before a Product Owner may authorize or dispatch it.

### Forgejo #4 / recovered #392

The superseded thirteen-key package is not reusable as written. Its refreshed staging is:

- Stage 1: exactly the same five keys in this freeze; Ready for future authorization only after #51
  is accepted and integrated.
- Stage 2: the remaining 29 accepted representative keys; dependency-gated behind Stage 1
  acceptance and integration, with a separately refreshed exact baseline and separate Product Owner
  authorization.

Stage 2 is not authorized, assigned, dispatched, or implementation-ready merely because this
recovery record exists. Fire/Energy 06/09/10 are part of the remaining 29 content evidence, but their
non-Bleed recurring loss remains non-executable and cannot be activated by either stage without a
separate periodic-loss design and authorization.

## Boundary confirmation

This freeze authorizes documentation recovery only. It does not implement #3/#391 or #4/#392,
perform QA, activate any C1 fixture, modify Combat behavior, enable non-Bleed `periodic_loss`, invent
medical mechanics, redesign Combat Manager, assign future work, merge a PR, or grant release or
deployment authority.
