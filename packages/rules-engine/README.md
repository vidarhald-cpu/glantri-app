# @glantri/rules-engine

Rene spillregelberegninger. Ingen database-avhengigheter, ingen sideeffekter.

Importerer kun fra `@glantri/domain`.

## Ansvar

All beregningslogikk som er direkte avledet fra spillreglene (Rolemaster):
- OB-beregning (Offensive Bonus)
- DB-beregning (Defensive Bonus)
- Ferdighetsbidrag og XP-derivasjon
- Kampstatistikk per deltaker

## Testpolicy

Tester i denne pakken skal bruke hardkodede forventede verdier hentet fra kildearbeidsboken. Testnavn skal inneholde workbook/sheet/celle-referanse:

```ts
it("OB primary weapon — Chargen.xlsx K47 — stat 90, skill 35 → OB 72", () => { ... });
```

## Importregel

`rules-engine` importeres av `apps/*`. Den importerer **aldri** fra `apps/*`, `packages/database`, eller `packages/content`.
