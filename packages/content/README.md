# @glantri/content

Statisk spillinnhold: utstyrsmaler, ferdighetsdata, profesjoner og sample-data for utvikling.

Importerer fra `@glantri/domain` og `@glantri/shared`.

## Struktur

```
src/
  equipment/      ← våpen-, rustnings-, skjold-, gear- og verdisaker-maler
                  ← sampleLoadouts.ts — sample-utstyr for dev/test
  pilotSkillContentRelease/ ← immutable accepted `pilot-skill-content-release/v1`
  skillContentPlatform/     ← additive documentation-complete release v2, validation and reference projection
  seeds/          ← genererte seed-data (ikke rediger manuelt)
  skills/         ← ferdighetsinnhold
  professions/    ← profesjonsinnhold
```

## Eksportpunkter

| Import                               | Innhold                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| `@glantri/content`                   | Hoved-barrel: alle maler og sample-data                        |
| `@glantri/content/equipment`         | Kun utstyrsmaler og sample-loadouts                            |
| `@glantri/content/semantic-fixtures` | Ikke-live designfixtures og semantisk konformitetsrapportering |

## Sample-data

`sampleLoadouts.ts` inneholder dev-data for utstyrsfeatures. Denne er tillatt i produksjonskode (i motsetning til `@glantri/test-scenarios`).

## Importregel

`packages/content` importeres av `apps/api` og `apps/web`. Den importerer **aldri** fra `apps/*`, `packages/database`, eller `packages/rules-engine`.

## Skill content releases

The accepted Pilot `1.0.1` payload remains immutable in `pilotSkillContentRelease`. New
documentation-complete candidates use `skill-content-release/v2`; `buildSkillContentRelease`
creates deterministic package and semantic digests, `validateSkillContentRelease` checks content
and reference integrity, and `projectSkillContentReleaseForReference` supplies a read-only
candidate/canonical snapshot for the later Admin reference. Semantic integrity normalizes
presentation ordering and excludes editorial prose; the package digest still covers both. This
platform does not activate runtime Skills or decide Character migration.
