# data/

Lokalt spilldata-katalog. Innholdet her er **ikke** en del av applikasjonen — det er arbeidsmateriell for import og verifisering.

## Mappestruktur

| Mappe | Innhold | Git-status |
|---|---|---|
| `raw/workbook/` | Kildekalkark (xlsx) fra spillsystemet | Ignorert (`data/raw/workbook/*`) |
| `raw/glantri/` | Eksporterte rådata fra Glantri-kilden | Sporet |
| `staging/` | Midlertidige filer under importprosessen | Ignorert (`data/staging/*`) |
| `snapshots/` | Punkt-i-tid-dumper av innhold for diff og verifikasjon | Ignorert (`data/snapshots/*`) |
| `import/` | Rapporter og logger fra importkjøringer | Sporet |

## Gitignore-policy

Bare `.gitkeep`-filer beholdes i ignorerte mapper slik at mappestrukturen eksisterer i repoet uten at arbeidsfilene følger med.

```
data/raw/workbook/*
!data/raw/workbook/.gitkeep
data/staging/*
!data/staging/.gitkeep
data/snapshots/*
!data/snapshots/.gitkeep
```

Legg **aldri** til store binærfiler eller sensitiv kildeinformasjon i `data/raw/glantri/` eller `data/import/` uten å vurdere om de bør ignoreres.

## Importflyt

```
raw/workbook/  →  importers-pakken  →  staging/  →  packages/content/src/
                                                  →  import/  (rapporter)
```

Se `packages/importers/` for faktisk importkode og `docs/architecture/system-overview.md` for kontekst.
